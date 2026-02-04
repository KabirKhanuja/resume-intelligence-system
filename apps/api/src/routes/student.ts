import type { Express } from "express";
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
import { fallbackAdvice, summarizeGapsWithLLM } from "../services/llm.js";

export function registerStudentRoutes(app: Express): void {
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

  // deterministic gaps + optional llm summary logic
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

    const context = `Compared to the top ${evidence.groupSize} resumes in batch=${studentRow.batch ?? "?"}, department=${studentRow.department ?? "?"} (mode=${groupMode}).`;

    let adviceBullets: string[];
    try {
      adviceBullets = (await summarizeGapsWithLLM(gaps, context)) ?? fallbackAdvice(gaps);
    } catch {
      adviceBullets = fallbackAdvice(gaps);
    }

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
}
