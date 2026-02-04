import type { Express } from "express";
import type { Prisma } from "@prisma/client";
import multer from "multer";
import { prisma } from "../db.js";

import { buildResumeSchema, scoreResume } from "resume-core";

export function registerResumeRoutes(app: Express): void {
  const upload = multer();

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

    res.json(saved);
  });
}
