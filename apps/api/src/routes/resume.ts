import type { Router } from "express";
import type { Prisma } from "@prisma/client";
import multer from "multer";
import { prisma } from "../db.js";

import { buildResumeSchema, scoreResume } from "resume-core";
import { extractTextFromUpload } from "../services/extractText.js";
import { enqueueResumeEmbeddingJob } from "../services/jobQueue.js";

export function registerResumeRoutes(app: Router): void {
  const upload = multer({
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // resume parsing api
  app.post("/resume/parse", upload.none(), async (req, res) => {
    const { text, meta } = req.body as { text?: string; meta?: any };
    if (!text) return res.status(400).json({ error: "resume text required" });

    const schema = buildResumeSchema(text, meta);
    const score = scoreResume(schema).totalScore;

    const saved = await prisma.resume.create({
      data: {
        id: schema.meta.resumeId,
        studentId: schema.meta.studentId ?? null,
        batch: schema.meta.batch ?? null,
        department: schema.meta.department ?? null,
        schema: schema as unknown as Prisma.InputJsonValue,
        score,
      },
    });

    await enqueueResumeEmbeddingJob(saved.id);

    res.json(saved);
  });


  app.post("/resume/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file required" });

    let meta: any = undefined;
    const rawMeta = (req.body as any)?.meta;
    if (typeof rawMeta === "string" && rawMeta.trim()) {
      try {
        meta = JSON.parse(rawMeta);
      } catch {
        return res.status(400).json({ error: "meta must be valid JSON" });
      }
    } else if (rawMeta && typeof rawMeta === "object") {
      meta = rawMeta;
    }

    let extractedText: string;
    let format: string;
    try {
      const extracted = await extractTextFromUpload({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      extractedText = extracted.text;
      format = extracted.format;
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to extract text";
      return res.status(400).json({ error: message });
    }

    const schema = buildResumeSchema(extractedText, meta);
    const score = scoreResume(schema).totalScore;

    const saved = await prisma.resume.create({
      data: {
        id: schema.meta.resumeId,
        studentId: schema.meta.studentId ?? null,
        batch: schema.meta.batch ?? null,
        department: schema.meta.department ?? null,
        schema: schema as unknown as Prisma.InputJsonValue,
        score,
      },
    });

    await enqueueResumeEmbeddingJob(saved.id);

    res.json({
      ...saved,
      extraction: {
        format,
        textLength: extractedText.length,
      },
    });
  });
}
