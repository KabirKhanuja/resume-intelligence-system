import type { Prisma } from "@prisma/client";
import type { Socket } from "node:net";
import express from "express";
import multer from "multer";
import { prisma } from "./db.js";

import {
  buildResumeSchema,
  type ResumeSchema,
  scoreResume,
  compareToCohort,
  matchJDToResumes
} from "resume-core";

function toResumeSchema(value: Prisma.JsonValue): ResumeSchema | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ResumeSchema>;
  if (!candidate.meta || typeof candidate.meta !== "object") return null;
  if (typeof (candidate.meta as any).resumeId !== "string") return null;
  return value as unknown as ResumeSchema;
}

const app = express();
const upload = multer();
app.use(express.json());

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
      score
    }
  });
  res.json(saved);
});

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
      department: student.department
    }
  });

  const studentSchema = toResumeSchema(student.schema);
  const cohortSchemas = cohort
    .map(r => toResumeSchema(r.schema))
    .filter((s): s is ResumeSchema => Boolean(s));

  if (!studentSchema) {
    return res.status(500).json({ error: "invalid schema in db" });
  }

  const comparison = compareToCohort(
    studentSchema,
    cohortSchemas
  );

  res.json(comparison);
});

// for tpo shortlist
app.post("/tpo/shortlist", async (req, res) => {
  const { jdText, topN = 10 } = req.body as { jdText?: string; topN?: number };
  if (!jdText) return res.status(400).json({ error: "JD text required" });

  const rows = await prisma.resume.findMany();
  const schemas = rows
    .map(r => toResumeSchema(r.schema))
    .filter((s): s is ResumeSchema => Boolean(s));

  const results = await matchJDToResumes(jdText, schemas, topN);
  res.json(results);
});

const server = app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});

const sockets = new Set<Socket>();
server.on("connection", (socket: Socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

let isShuttingDown = false;
const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    console.log(`\nReceived ${signal}. Shutting down...`);

    // stop accepting new connections
    server.close(() => undefined);

    for (const socket of sockets) socket.destroy();

    void prisma.$disconnect().catch(() => undefined);

    process.exit(0);
  } catch {
    process.exit(0);
  }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));