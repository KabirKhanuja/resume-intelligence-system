import type { Router } from "express";
import type { Prisma } from "@prisma/client";
import multer from "multer";
import { prisma } from "../db.js";

import { buildResumeSchema, scoreResume } from "resume-core";
import { extractTextFromUpload } from "../services/extractText.js";
import { enqueueResumeEmbeddingJob } from "../services/jobQueue.js";
import { enhanceSchemaWithLLM } from "../services/resumeExtractor.js";

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

    try {
      let schema = buildResumeSchema(text, meta);
      
      // LLM enhancement if confidence is low
      const avgConfidence =
        schema.skills.length + schema.projects.length + schema.experience.length === 0
          ? 0
          : (
              [schema.skills, schema.projects, schema.experience]
                .flatMap((arr) => arr.map((item) => item.confidence))
                .reduce((a, b) => a + b, 0) /
              Math.max(1, schema.skills.length + schema.projects.length + schema.experience.length)
            );

      console.log(`[RESUME_PARSE] Confidence: ${avgConfidence.toFixed(2)}, skills=${schema.skills.length}, projects=${schema.projects.length}, experience=${schema.experience.length}`);

      if (avgConfidence < 0.6) {
        console.log(`[RESUME_PARSE] Low confidence (${avgConfidence.toFixed(2)} < 0.6), calling LLM enhancement`);
        const enhanced = await enhanceSchemaWithLLM(schema, text);
        if (enhanced) {
          console.log(`[RESUME_PARSE] LLM enhancement succeeded, updating schema`);
          schema = enhanced;
        } else {
          console.log(`[RESUME_PARSE] LLM enhancement returned null`);
        }
      } else {
        console.log(`[RESUME_PARSE] Confidence sufficient (${avgConfidence.toFixed(2)} >= 0.6), skipping LLM`);
      }

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
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to parse resume";
      res.status(500).json({ error: message });
    }
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

    try {
      let schema = buildResumeSchema(extractedText, meta);

      // Try LLM enhancement if confidence is low
      const avgConfidence =
        schema.skills.length + schema.projects.length + schema.experience.length === 0
          ? 0
          : (
              [schema.skills, schema.projects, schema.experience]
                .flatMap((arr) => arr.map((item) => item.confidence))
                .reduce((a, b) => a + b, 0) /
              Math.max(1, schema.skills.length + schema.projects.length + schema.experience.length)
            );

      console.log(`[RESUME_UPLOAD] File: ${file.originalname}, confidence: ${avgConfidence.toFixed(2)}, skills=${schema.skills.length}, projects=${schema.projects.length}, experience=${schema.experience.length}`);

      if (avgConfidence < 0.6) {
        console.log(`[RESUME_UPLOAD] Low confidence (${avgConfidence.toFixed(2)} < 0.6), calling LLM enhancement`);
        const enhanced = await enhanceSchemaWithLLM(schema, extractedText);
        if (enhanced) {
          console.log(`[RESUME_UPLOAD] LLM enhancement succeeded, updating schema`);
          schema = enhanced;
        } else {
          console.log(`[RESUME_UPLOAD] LLM enhancement returned null`);
        }
      } else {
        console.log(`[RESUME_UPLOAD] Confidence sufficient (${avgConfidence.toFixed(2)} >= 0.6), skipping LLM`);
      }

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
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed to parse resume";
      res.status(500).json({ error: message });
    }
  });
}
