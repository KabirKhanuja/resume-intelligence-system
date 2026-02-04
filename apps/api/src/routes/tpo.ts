import type { Express } from "express";
import type { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

import { cosineSimilarity, embedText } from "resume-embeddings";
import { toEmbedding } from "../services/guards.js";

export function registerTpoRoutes(app: Express): void {
  // for tpo shortlist
  app.post("/tpo/shortlist", async (req, res) => {
    const { jdText, topN = 10 } = req.body as { jdText?: string; topN?: number };
    if (!jdText) return res.status(400).json({ error: "JD text required" });

    const limit =
      typeof topN === "number" && Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 10;

    const rows = await prisma.resume.findMany({
      where: { embeddingStatus: "done" },
      select: { id: true, embedding: true, schema: true, score: true },
    });

    if (rows.length === 0) return res.json([]);

    let jdEmbedding: number[];
    try {
      jdEmbedding = await embedText(jdText);
    } catch {
      return res.status(503).json({
        error: "embeddings server unavailable",
      });
    }

    const scored = rows
      .map((r) => {
        const embedding = toEmbedding(r.embedding as unknown as Prisma.JsonValue | null);
        if (!embedding) return null;

        return {
          resumeId: r.id,
          similarity: cosineSimilarity(jdEmbedding, embedding),
          score: r.score,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    res.json(
      scored.map((r) => ({
        resumeId: r.resumeId,
        matchScore: Number(r.similarity.toFixed(4)),
        baseScore: r.score,
      })),
    );
  });
}
