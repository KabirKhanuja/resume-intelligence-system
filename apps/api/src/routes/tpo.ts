import type { Router } from "express";
import type { Prisma } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "../db.js";

import { cosineSimilarity, embedText } from "resume-embeddings";
import { toEmbedding } from "../services/guards.js";

export function registerTpoRoutes(app: Router): void {

  const driveDb: any = (prisma as any).drive;

  async function computeShortlist(params: { jdText: string; topN: number }) {
    const { jdText, topN } = params;

    const limit =
      typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

    const rows = await prisma.resume.findMany({
      where: { embeddingStatus: "done" },
      select: { id: true, embedding: true, score: true, schema: true },
    });

    if (rows.length === 0) {
      return {
        applicants: 0,
        results: [] as Array<{ resumeId: string; matchScore: number; baseScore: number }>,
      };
    }

    let jdEmbedding: number[];
    try {
      jdEmbedding = await embedText(jdText);
    } catch {
      const err = new Error("embeddings server unavailable");
      (err as any).statusCode = 503;
      throw err;
    }

    const jdKeywords = extractKeywords(jdText, 40);
    const jdKeywordSet = new Set(jdKeywords);

    const scored = rows
      .map((r) => {
        const embedding = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
        if (!embedding) return null;

        const resumeKeywords = extractKeywords(schemaToKeywordText(r.schema as unknown as Prisma.JsonValue), 80);
        const keywordMatch = keywordOverlapScore(jdKeywordSet, resumeKeywords);

        const similarity = cosineSimilarity(jdEmbedding, embedding);

        const combined = 0.75 * similarity + 0.25 * keywordMatch;

        return {
          resumeId: r.id,
          similarity,
          keywordMatch,
          combined,
          score: r.score,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v))

      .filter((r) => r.combined >= 0.18 || r.keywordMatch >= 0.08)
      .sort((a, b) => b.combined - a.combined)
      .slice(0, limit);

    const results = scored.map((r) => ({
      resumeId: r.resumeId,
      matchScore: Number(r.similarity.toFixed(4)),
      baseScore: r.score,
    }));

    return { applicants: rows.length, results };
  }

  const STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "with",
    "will",
    "you",
    "your",
    "we",
    "our",
    "they",
    "their",
    "this",
    "these",
    "those",
    "into",
    "over",
    "under",
    "across",
    "within",
    "using",
    "use",
    "used",
    "based",
    "years",
    "year",
    "month",
    "months",
    "day",
    "days",
  ]);

  function schemaToKeywordText(schemaJson: Prisma.JsonValue): string {
    const s = schemaJson as any;
    const chunks: string[] = [];

    const skills = Array.isArray(s?.skills) ? s.skills.map((x: any) => x?.name).filter(Boolean).join(" ") : "";
    const projectText = Array.isArray(s?.projects)
      ? s.projects
          .map((p: any) => [p?.title, p?.description, Array.isArray(p?.technologies) ? p.technologies.join(" ") : ""].filter(Boolean).join(" "))
          .join("\n")
      : "";
    const experienceText = Array.isArray(s?.experience)
      ? s.experience
          .map((e: any) => [e?.role, e?.company, e?.description, Array.isArray(e?.technologies) ? e.technologies.join(" ") : ""].filter(Boolean).join(" "))
          .join("\n")
      : "";
    const rawSectionsText = Array.isArray(s?.rawSections)
      ? s.rawSections
          .map((sec: any) => {
            const heading = typeof sec?.heading === "string" ? sec.heading : "";
            const content = typeof sec?.content === "string" ? sec.content : "";
            return `${heading}\n${content}`.trim();
          })
          .filter(Boolean)
          .join("\n\n")
      : "";

    if (skills) chunks.push(skills);
    if (experienceText) chunks.push(experienceText);
    if (projectText) chunks.push(projectText);
    if (rawSectionsText) chunks.push(rawSectionsText);

    return chunks.join("\n\n").slice(0, 10_000);
  }

  function extractKeywords(text: string, maxKeywords: number): string[] {
    const lower = (text ?? "").toLowerCase();
    const cleaned = lower.replace(/[^a-z0-9+#\s]/g, " ");
    const tokens = cleaned.split(/\s+/).map((t) => t.trim()).filter(Boolean);

    const counts = new Map<string, number>();
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      if (STOPWORDS.has(tok)) continue;
      if (/^\d+$/.test(tok)) continue;
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(0, maxKeywords))
      .map(([k]) => k);
  }

  function keywordOverlapScore(jdKeywordSet: Set<string>, resumeKeywords: string[]): number {
    if (jdKeywordSet.size === 0) return 0;
    if (!Array.isArray(resumeKeywords) || resumeKeywords.length === 0) return 0;

    const resumeSet = new Set(resumeKeywords);
    let hits = 0;
    for (const k of jdKeywordSet) {
      if (resumeSet.has(k)) hits += 1;
    }
    return hits / jdKeywordSet.size;
  }

  app.get("/tpo/drives", async (req, res) => {
    const limitRaw = req.query.limit;
    const limit =
      typeof limitRaw === "string" && Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0
        ? Math.min(50, Math.floor(Number(limitRaw)))
        : 20;

    const drives = await driveDb.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        company: true,
        role: true,
        topN: true,
        applicants: true,
        shortlisted: true,
        status: true,
        createdAt: true,
      },
    });

    res.json(drives);
  });

  app.get("/tpo/drives/:driveId", async (req, res) => {
    const driveId = req.params.driveId;
    if (!driveId) return res.status(400).json({ error: "driveId required" });

    const drive = await driveDb.findUnique({
      where: { id: driveId },
      select: {
        id: true,
        company: true,
        role: true,
        jdText: true,
        topN: true,
        applicants: true,
        shortlisted: true,
        results: true,
        status: true,
        createdAt: true,
      },
    });

    if (!drive) return res.status(404).json({ error: "not found" });
    res.json(drive);
  });

  app.get("/tpo/drives/:driveId/candidates", async (req, res) => {
    const driveId = req.params.driveId;
    if (!driveId) return res.status(400).json({ error: "driveId required" });

    const drive = await driveDb.findUnique({
      where: { id: driveId },
      select: {
        id: true,
        results: true,
      },
    });

    if (!drive) return res.status(404).json({ error: "not found" });

    const rawResults = drive.results as unknown;
    const parsedResults: Array<{ resumeId: string; matchScore: number; baseScore: number }> =
      Array.isArray(rawResults)
        ? rawResults
            .map((r) => {
              if (!r || typeof r !== "object") return null;
              const rr = r as any;
              if (typeof rr.resumeId !== "string") return null;
              return {
                resumeId: rr.resumeId,
                matchScore: typeof rr.matchScore === "number" ? rr.matchScore : Number(rr.matchScore ?? 0),
                baseScore: typeof rr.baseScore === "number" ? rr.baseScore : Number(rr.baseScore ?? 0),
              };
            })
            .filter((v): v is NonNullable<typeof v> => Boolean(v))
        : [];

    const resumeIds = parsedResults.map((r) => r.resumeId);
    if (resumeIds.length === 0) return res.json([]);

    const rows = await prisma.resume.findMany({
      where: { id: { in: resumeIds } },
      select: {
        id: true,
        studentId: true,
        batch: true,
        department: true,
        schema: true,
        score: true,
        embeddingStatus: true,
        filePath: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        createdAt: true,
      },
    });

    const byId = new Map(rows.map((r) => [r.id, r] as const));

    const enriched = parsedResults
      .map((r, idx) => {
        const row = byId.get(r.resumeId);
        if (!row) return null;
        const fileUrl = row.filePath
          ? `/api/v1/tpo/resumes/${encodeURIComponent(row.id)}/file`
          : null;

        return {
          rank: idx + 1,
          resumeId: row.id,
          matchScore: r.matchScore,
          baseScore: r.baseScore,
          resume: {
            id: row.id,
            studentId: row.studentId,
            batch: row.batch,
            department: row.department,
            score: row.score,
            embeddingStatus: row.embeddingStatus,
            createdAt: row.createdAt,
            schema: row.schema,
            file: row.filePath
              ? {
                  url: fileUrl,
                  name: row.fileName,
                  mime: row.fileMime,
                  size: row.fileSize,
                }
              : null,
          },
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    res.json(enriched);
  });

  app.post("/tpo/drives/:driveId/rerun", async (req, res) => {
    const driveId = req.params.driveId;
    if (!driveId) return res.status(400).json({ error: "driveId required" });

    const { company, role, jdText, topN = 10 } = req.body as {
      company?: string;
      role?: string;
      jdText?: string;
      topN?: number;
    };
    if (!jdText) return res.status(400).json({ error: "JD text required" });

    const existing = await driveDb.findUnique({ where: { id: driveId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "not found" });

    try {
      const computed = await computeShortlist({ jdText, topN: topN ?? 10 });
      const limit =
        typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

      const updated = await driveDb.update({
        where: { id: driveId },
        data: {
          company: typeof company === "string" && company.trim() ? company.trim() : "Unknown Company",
          role: typeof role === "string" && role.trim() ? role.trim() : "Unknown Role",
          jdText,
          topN: limit,
          applicants: computed.applicants,
          shortlisted: computed.results.length,
          results: computed.results as unknown as Prisma.InputJsonValue,
          status: "done",
        },
        select: { id: true },
      });

      res.json({ driveId: updated.id, results: computed.results });
    } catch (e) {
      const statusCode =
        typeof e === "object" && e && "statusCode" in e && typeof (e as any).statusCode === "number"
          ? (e as any).statusCode
          : 500;
      const message = e instanceof Error ? e.message : "failed to rerun analysis";
      res.status(statusCode).json({ error: message });
    }
  });

  app.get("/tpo/stats", async (_req, res) => {
    const [candidateCount, driveCount] = await Promise.all([
      prisma.resume.count(),
      driveDb.count(),
    ]);
    const activeCompanies = await driveDb.findMany({
      distinct: ["company"],
      select: { company: true },
    });

    res.json({
      candidates: candidateCount,
      drives: driveCount,
      companies: activeCompanies.length,
    });
  });

  app.get("/tpo/resumes/:resumeId", async (req, res) => {
    const resumeId = req.params.resumeId;
    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const row = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        studentId: true,
        batch: true,
        department: true,
        schema: true,
        score: true,
        embeddingStatus: true,
        filePath: true,
        fileName: true,
        fileMime: true,
        fileSize: true,
        createdAt: true,
      },
    });

    if (!row) return res.status(404).json({ error: "not found" });

    const fileUrl = row.filePath ? `/api/v1/tpo/resumes/${encodeURIComponent(row.id)}/file` : null;

    res.json({
      id: row.id,
      studentId: row.studentId,
      batch: row.batch,
      department: row.department,
      score: row.score,
      embeddingStatus: row.embeddingStatus,
      createdAt: row.createdAt,
      schema: row.schema,
      file: row.filePath
        ? {
            url: fileUrl,
            name: row.fileName,
            mime: row.fileMime,
            size: row.fileSize,
          }
        : null,
    });
  });

  app.get("/tpo/resumes/:resumeId/file", async (req, res) => {
    const resumeId = req.params.resumeId;
    if (!resumeId) return res.status(400).json({ error: "resumeId required" });

    const row = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: {
        filePath: true,
        fileName: true,
        fileMime: true,
      },
    });

    if (!row) return res.status(404).json({ error: "not found" });
    if (!row.filePath) return res.status(404).json({ error: "resume file not available" });

    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const absolute = path.resolve(process.cwd(), row.filePath);
    if (!absolute.startsWith(uploadsDir + path.sep) && absolute !== uploadsDir) {
      return res.status(400).json({ error: "invalid file path" });
    }

    try {
      await fs.access(absolute);
    } catch {
      return res.status(404).json({ error: "resume file missing on disk" });
    }

    const fileName = (row.fileName ?? "resume.pdf").replaceAll('"', "");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    if (row.fileMime) res.setHeader("Content-Type", row.fileMime);
    return res.sendFile(absolute);
  });

  // for tpo shortlist
  app.post("/tpo/shortlist", async (req, res) => {
    const { jdText, topN = 10, company, role } = req.body as {
      jdText?: string;
      topN?: number;
      company?: string;
      role?: string;
    };
    if (!jdText) return res.status(400).json({ error: "JD text required" });

    const limit =
      typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

    let computed;
    try {
      computed = await computeShortlist({ jdText, topN: limit });
    } catch (e) {
      const statusCode =
        typeof e === "object" && e && "statusCode" in e && typeof (e as any).statusCode === "number"
          ? (e as any).statusCode
          : 500;
      const message = e instanceof Error ? e.message : "shortlisting failed";
      return res.status(statusCode).json({ error: message });
    }

    const results = computed.results;

    const drive = await driveDb.create({
      data: {
        company: typeof company === "string" && company.trim() ? company.trim() : "Unknown Company",
        role: typeof role === "string" && role.trim() ? role.trim() : "Unknown Role",
        jdText,
        topN: limit,
        applicants: computed.applicants,
        shortlisted: results.length,
        results: results as unknown as Prisma.InputJsonValue,
        status: "done",
      },
      select: { id: true },
    });

    res.json({ driveId: drive.id, results });
  });
}
