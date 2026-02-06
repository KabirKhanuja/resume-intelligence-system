import type { Router } from "express";
import type { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

import {
  type ResumeSchema,
  scoreResume,
  compareToCohort,
} from "resume-core";

import { cosineSimilarity, embedText } from "resume-embeddings";

import { toResumeSchema, toEmbedding } from "../services/guards.js";
import { computeGapSummary, type GapSummary, type GapEvidence } from "../services/gaps.js";
import { fallbackAdvice, summarizeGapsWithLLM, type LlmProviderConfig } from "../services/llm.js";
import { consumeDailyLlmQuota } from "../services/llmRateLimit.js";

export function registerStudentRoutes(app: Router): void {
  // student score
  app.post("/student/score", async (req, res) => {
    const { resumeId } = req.body as { resumeId?: string };
    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row) return res.status(404).json({ error: "not found" });

    const schema = toResumeSchema(row.schema);
    if (!schema) return res.status(500).json({ error: "invalid schema in db" });

    const score = scoreResume(schema);
    res.json(score);
  });

  // comparing
  app.post("/student/compare", async (req, res) => {
    const { resumeId } = req.body as { resumeId?: string };
    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const student = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!student) return res.status(404).json({ error: "not found" });

    const cohort = await prisma.resume.findMany({
      where: {
        batch: student.batch,
        department: student.department,
      },
    });

    const studentSchema = toResumeSchema(student.schema);
    const cohortSchemas = cohort
      .map((r) => toResumeSchema(r.schema))
      .filter((s): s is ResumeSchema => Boolean(s));

    if (!studentSchema) {
      return res.status(500).json({ error: "invalid schema in db" });
    }

    const comparison = compareToCohort(studentSchema, cohortSchemas);
    res.json(comparison);
  });

  // deterministic gaps (unlimited lane)
  app.post("/student/missing", async (req, res) => {
    const { resumeId, jdText, topN = 10, mode } = req.body as {
      resumeId?: string;
      jdText?: string;
      topN?: number;
      mode?: "score" | "jd";
    };

    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const limit =
      typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

    const studentRow = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!studentRow) return res.status(404).json({ error: "not found" });

    const studentSchema = toResumeSchema(studentRow.schema);
    if (!studentSchema) return res.status(500).json({ error: "invalid schema in db" });

    const cohortWhere = {
      batch: studentRow.batch,
      department: studentRow.department,
      NOT: { id: resumeId },
    } as const;

    let groupRows: Array<{
      id: string;
      schema: Prisma.JsonValue;
      score: number;
      embedding: Prisma.JsonValue | null;
    }> = [];

    const groupMode: "score" | "jd" = mode === "jd" && jdText ? "jd" : "score";

    if (groupMode === "jd") {
      // Top-N most similar using cached embeddings within the cohort
      let jdEmbedding: number[];
      try {
        jdEmbedding = await embedText(jdText!);
      } catch {
        return res.status(503).json({ error: "embeddings server unavailable" });
      }

      const rows = await prisma.resume.findMany({
        where: { ...cohortWhere, embeddingStatus: "done" },
        select: { id: true, embedding: true, schema: true, score: true },
      });

      groupRows = rows
        .map((r) => {
          const emb = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
          if (!emb) return null;
          return { ...r, embedding: r.embedding, similarity: cosineSimilarity(jdEmbedding, emb) };
        })
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity: _s, ...rest }) => rest);
    } else {
      // top n peers by score within the cohort
      groupRows = await prisma.resume.findMany({
        where: cohortWhere,
        select: { id: true, schema: true, score: true, embedding: true },
        orderBy: { score: "desc" },
        take: limit,
      });
    }

    const groupSchemas = groupRows
      .map((r) => toResumeSchema(r.schema))
      .filter((s): s is ResumeSchema => Boolean(s));

    if (groupSchemas.length === 0) {
      return res.json({
        group: {
          mode: groupMode,
          size: 0,
          batch: studentRow.batch,
          department: studentRow.department,
        },
        gaps: {
          missingSkills: [],
          commonProjectDomains: [],
          missingProjectDomains: [],
          experienceGap: null,
          structureGaps: [],
        } satisfies GapSummary,
        adviceBullets: ["Not enough peer resumes available to compare."],
        evidence: {
          groupSize: 0,
          commonSkills: [],
          commonDomains: [],
          commonSections: [],
        } satisfies GapEvidence,
      });
    }

    const { gaps, evidence } = computeGapSummary(studentSchema, groupSchemas);

    const adviceBullets = fallbackAdvice(gaps);

    res.json({
      group: {
        mode: groupMode,
        size: evidence.groupSize,
        batch: studentRow.batch,
        department: studentRow.department,
      },
      gaps,
      adviceBullets,
      evidence,
    });
  });

  // LLM feedback (rate-limited lane)
  app.post("/student/feedback", async (req, res) => {
    const { resumeId, jdText, topN = 10, mode } = req.body as {
      resumeId?: string;
      jdText?: string;
      topN?: number;
      mode?: "score" | "jd";
    };

    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const limit =
      typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

    const studentRow = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!studentRow) return res.status(404).json({ error: "not found" });

    const studentSchema = toResumeSchema(studentRow.schema);
    if (!studentSchema) return res.status(500).json({ error: "invalid schema in db" });

    // For rate limiting we prefer a real studentId, but the system should still work
    // even if the resume doesn't contain one (common in early demos).
    // Use a stable anonymous key so quota still applies per-resume/day.
    const studentId = studentRow.studentId ?? studentSchema.meta.studentId ?? `resume:${resumeId}`;

    const llmBaseUrl = process.env.LLM_BASE_URL;
    const llmApiKey = process.env.LLM_API_KEY;
    const llmModel = process.env.LLM_MODEL ?? "gpt-4o-mini";

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2:latest";
    const ollamaApiKey = process.env.OLLAMA_API_KEY;

    const dailyLimitRaw = process.env.LLM_DAILY_LIMIT || "2";
    const dailyLimit = dailyLimitRaw && Number.isFinite(Number(dailyLimitRaw)) ? Number(dailyLimitRaw) : 2;

    const cohortWhere = {
      batch: studentRow.batch,
      department: studentRow.department,
      NOT: { id: resumeId },
    } as const;

    let groupRows: Array<{
      id: string;
      schema: Prisma.JsonValue;
      score: number;
      embedding: Prisma.JsonValue | null;
    }> = [];

    const groupMode: "score" | "jd" = mode === "jd" && jdText ? "jd" : "score";

    if (groupMode === "jd") {
      let jdEmbedding: number[];
      try {
        jdEmbedding = await embedText(jdText!);
      } catch {
        return res.status(503).json({ error: "embeddings server unavailable" });
      }

      const rows = await prisma.resume.findMany({
        where: { ...cohortWhere, embeddingStatus: "done" },
        select: { id: true, embedding: true, schema: true, score: true },
      });

      groupRows = rows
        .map((r) => {
          const emb = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
          if (!emb) return null;
          return { ...r, embedding: r.embedding, similarity: cosineSimilarity(jdEmbedding, emb) };
        })
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity: _s, ...rest }) => rest);
    } else {
      groupRows = await prisma.resume.findMany({
        where: cohortWhere,
        select: { id: true, schema: true, score: true, embedding: true },
        orderBy: { score: "desc" },
        take: limit,
      });
    }

    const groupSchemas = groupRows
      .map((r) => toResumeSchema(r.schema))
      .filter((s): s is ResumeSchema => Boolean(s));

    if (groupSchemas.length === 0) {
      return res.json({
        group: {
          mode: groupMode,
          size: 0,
          batch: studentRow.batch,
          department: studentRow.department,
        },
        gaps: {
          missingSkills: [],
          commonProjectDomains: [],
          missingProjectDomains: [],
          experienceGap: null,
          structureGaps: [],
        } satisfies GapSummary,
        adviceBullets: ["Not enough peer resumes available to compare."],
        evidence: {
          groupSize: 0,
          commonSkills: [],
          commonDomains: [],
          commonSections: [],
        } satisfies GapEvidence,
        llm: {
          limit: dailyLimit,
          used: 0,
          remaining: dailyLimit,
          model: llmModel,
        },
      });
    }

    const primaryConfigured = Boolean(llmBaseUrl && llmApiKey);
    const primaryIsGemini = Boolean(llmBaseUrl && llmBaseUrl.includes("generativelanguage.googleapis.com"));

    // Quota applies only to the primary (remote) provider.
    const quota = primaryConfigured
      ? await consumeDailyLlmQuota({
          studentId,
          resumeId,
          endpoint: "/student/feedback",
          limit: dailyLimit,
          model: llmModel,
        })
      : {
          allowed: false,
          limit: dailyLimit,
          used: 0,
          remaining: dailyLimit,
          resetAt: null,
        };

    const quotaResetAt = "resetAt" in quota ? quota.resetAt : null;

    const { gaps, evidence } = computeGapSummary(studentSchema, groupSchemas);
    const context = `Give resume feedback for studentId=${studentId}. Compared to top ${evidence.groupSize} peers in batch=${studentRow.batch ?? "?"}, department=${studentRow.department ?? "?"} (mode=${groupMode}).`;

    const providers: LlmProviderConfig[] = [];
    if (primaryConfigured && quota.allowed) {
      providers.push(
        primaryIsGemini
          ? { kind: "gemini", label: "gemini", baseUrl: llmBaseUrl!, apiKey: llmApiKey!, model: llmModel }
          : { kind: "openai-compatible", label: "primary", baseUrl: llmBaseUrl!, apiKey: llmApiKey!, model: llmModel },
      );
    }
    // Always allow local Ollama as fallback if present.
    if (ollamaBaseUrl) {
      providers.push({
        kind: "openai-compatible",
        label: "ollama",
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
        ...(ollamaApiKey ? { apiKey: ollamaApiKey } : {}),
      });
    }

    const llmSummary = providers.length ? await summarizeGapsWithLLM(gaps, context, providers) : null;
    const adviceBullets = llmSummary?.bullets ?? fallbackAdvice(gaps);

    res.json({
      group: {
        mode: groupMode,
        size: evidence.groupSize,
        batch: studentRow.batch,
        department: studentRow.department,
      },
      gaps,
      adviceBullets,
      evidence,
      llm: {
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        model: llmSummary?.model ?? llmModel,
        provider: llmSummary?.provider ?? (quota.allowed ? "primary" : "fallback"),
        quotaBlocked: primaryConfigured && !quota.allowed,
        resetAt: quotaResetAt,
      },
    });
  });
}
