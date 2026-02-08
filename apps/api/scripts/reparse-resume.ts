import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/db.ts";
import { extractTextFromUpload } from "../src/services/extractText.ts";
import { buildResumeSchema, scoreResume } from "resume-core";
import { enqueueResumeEmbeddingJob } from "../src/services/jobQueue.ts";

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}

async function reparseOne(resumeId: string) {
  const row = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!row) {
    throw new Error(`Resume not found: ${resumeId}`);
  }

  if (!row.filePath) {
    throw new Error(`Resume ${resumeId} has no filePath stored; cannot reparse`);
  }

  const absoluteFilePath = path.resolve(process.cwd(), row.filePath);
  const buf = await fs.readFile(absoluteFilePath);

  const mimetype = row.fileMime ?? guessMime(row.filePath);
  const originalname = row.fileName ?? path.basename(row.filePath);

  const extracted = await extractTextFromUpload({
    buffer: buf,
    mimetype,
    originalname,
  });

  const schema = buildResumeSchema(extracted.text, {
    resumeId: row.id,
    studentId: row.studentId ?? undefined,
    batch: row.batch ?? undefined,
    department: row.department ?? undefined,
  });

  const score = scoreResume(schema).totalScore;

  await prisma.resume.update({
    where: { id: row.id },
    data: {
      schema: schema as any,
      score,
      embedding: Prisma.DbNull,
      embeddingModel: null,
      embeddingStatus: "pending",
      embeddingError: null,
      embeddingUpdatedAt: null,
    },
  });

  await enqueueResumeEmbeddingJob(row.id);

  return { id: row.id, score, format: extracted.format, textLength: extracted.text.length };
}

async function main() {
  const resumeId = process.argv[2];
  if (!resumeId) {
    console.error("Usage: tsx scripts/reparse-resume.ts <resumeId>");
    process.exit(1);
  }

  const result = await reparseOne(resumeId);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
    }
  });
