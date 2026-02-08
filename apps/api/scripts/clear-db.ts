import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db.ts";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function clearUploads(uploadsDir: string) {
  const entries = await fs.readdir(uploadsDir, { withFileTypes: true }).catch((e) => {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  });

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await fs.rm(path.join(uploadsDir, entry.name));
    removed += 1;
  }

  return removed;
}

async function main() {
  const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const uploadsDir = path.join(apiDir, "uploads");

  const uploadsOnly = hasFlag("--uploads-only");
  const keepUploads = hasFlag("--keep-uploads");

  const result: Record<string, unknown> = {};

  if (!uploadsOnly) {
    // Order is defensive: remove dependents first.
    result.deletedLlmRequestLogs = await prisma.llmRequestLog.deleteMany({});
    result.deletedJobs = await prisma.job.deleteMany({});
    result.deletedDrives = await prisma.drive.deleteMany({});
    result.deletedResumes = await prisma.resume.deleteMany({});
  }

  if (!keepUploads) {
    result.removedUploadFiles = await clearUploads(uploadsDir);
  }

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
