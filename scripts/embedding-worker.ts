import { prisma } from "../apps/api/src/db.js";
import { embedText, buildResumeEmbeddingText } from "resume-embeddings";
import type { ResumeSchema } from "resume-core";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const BATCH_SIZE = 5;
const SLEEP_MS = 2000;
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const IDLE_LOG_EVERY_MS = 15_000;

const JOB_TYPE = "resume_embedding";
const WORKER_ID = process.env.WORKER_ID ?? randomUUID();

const watchMode = process.argv.includes("--watch");
const backfillMode = process.argv.includes("--backfill");

const embeddingsBaseUrl =
  process.env.RESUME_EMBEDDINGS_URL ??
  process.env.EMBEDDINGS_URL ??
  "http://127.0.0.1:8001";

let embeddingsServer: ChildProcess | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isEmbeddingsServerUp(): Promise<boolean> {
  try {
    const res = await fetch(new URL("/docs", embeddingsBaseUrl), { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

function findPython(): string {
  const candidates = [
    process.env.PYTHON,
    process.platform === "win32" ? undefined : "/opt/homebrew/bin/python3",
    process.platform === "win32" ? undefined : "/usr/local/bin/python3",
    process.platform === "win32" ? undefined : "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3",
    process.platform === "win32" ? undefined : "/usr/bin/python3",
    process.platform === "win32" ? undefined : "python3",
    "python",
    process.platform === "win32" ? "py" : undefined,
  ].filter(Boolean) as string[];

  for (const cmd of candidates) {
    const res = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (!res.error && res.status === 0) return cmd;
  }

  throw new Error(
    "Python not found. Install Python 3 (or set the PYTHON env var to your python executable).",
  );
}

function startEmbeddingsServer(): ChildProcess {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const infraEmbeddingsDir = path.join(repoRoot, "infra", "embeddings");
  if (!fs.existsSync(infraEmbeddingsDir)) {
    throw new Error(`Cannot find embeddings server directory at: ${infraEmbeddingsDir}`);
  }

  const python = findPython();
  const child = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "server:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8001",
      "--log-level",
      process.env.UVICORN_LOG_LEVEL ?? "warning",
    ],
    {
      cwd: infraEmbeddingsDir,
      stdio: "inherit",
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONWARNINGS: process.env.PYTHONWARNINGS ?? "ignore",
      },
    },
  );

  child.on("error", (err) => {
    console.error("Failed to start embeddings server. Ensure python + uvicorn are installed.");
    console.error(err);
  });

  return child;
}

async function ensureEmbeddingsServer(timeoutMs = 10 * 60_000): Promise<void> {
  if (await isEmbeddingsServerUp()) return;

  if (!embeddingsServer) {
    console.log(`Embeddings server not reachable at ${embeddingsBaseUrl}. Starting local server...`);
    embeddingsServer = startEmbeddingsServer();
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isEmbeddingsServerUp()) return;
    await sleep(250);
  }

  throw new Error(`Embeddings server did not start within ${timeoutMs}ms at ${embeddingsBaseUrl}`);
}

function looksLikeEmbeddingsServerDown(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("embedText(): failed to reach embeddings server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed")
  );
}

function backoffMs(attempts: number): number {
  return Math.min(60_000, Math.max(1000, 2 ** Math.min(attempts, 10) * 1000));
}

async function enqueueMissingEmbeddingJobs(): Promise<number> {
  const pending = await prisma.resume.findMany({
    where: { embeddingStatus: "pending" },
    select: { id: true },
  });
  if (pending.length === 0) return 0;

  const now = new Date();
  let touched = 0;
  for (const r of pending) {
    const dedupeKey = `${JOB_TYPE}:${r.id}`;
    await prisma.job.upsert({
      where: { dedupeKey },
      create: {
        type: JOB_TYPE,
        dedupeKey,
        payload: { resumeId: r.id },
        status: "queued",
        runAt: now,
        priority: 0,
        attempts: 0,
        maxAttempts: 5,
      },
      update: {
        status: "queued",
        runAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    });
    touched += 1;
  }

  return touched;
}

async function claimNextJob() {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: {
        type: JOB_TYPE,
        status: "queued",
        runAt: { lte: now },
      },
      orderBy: [{ priority: "desc" }, { runAt: "asc" }, { createdAt: "asc" }],
    });

    if (!job) return null;

    const locked = await tx.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: {
        status: "running",
        lockedAt: new Date(),
        lockedBy: WORKER_ID,
      },
    });

    if (locked.count === 0) return null;
    return tx.job.findUnique({ where: { id: job.id } });
  });
}

async function processOneJob(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const resumeId = (job.payload as any)?.resumeId as string | undefined;
  if (!resumeId) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        lastError: "Invalid job payload: missing resumeId",
      },
    });
    return true;
  }

  // Start embeddings server only when there is work to do
  await ensureEmbeddingsServer();

  try {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "done", lastError: "Resume not found; nothing to do" },
      });
      return true;
    }

    const schema = resume.schema as unknown as ResumeSchema;
    const text = buildResumeEmbeddingText(schema);

    let embedding: number[];
    try {
      embedding = await embedText(text);
    } catch (err) {
      if (looksLikeEmbeddingsServerDown(err)) {
        await ensureEmbeddingsServer();
        embedding = await embedText(text);
      } else {
        throw err;
      }
    }

    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        embedding,
        embeddingModel: EMBEDDING_MODEL,
        embeddingStatus: "done",
        embeddingError: null,
        embeddingUpdatedAt: new Date(),
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });

    console.log(`Embedded resume ${resume.id} (job ${job.id})`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown embedding error";
    const nextAttempts = job.attempts + 1;
    const transient = looksLikeEmbeddingsServerDown(err);

    if (nextAttempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          attempts: nextAttempts,
          lockedAt: null,
          lockedBy: null,
          lastError: message.slice(0, 1000),
        },
      });

      await prisma.resume.updateMany({
        where: { id: resumeId },
        data: {
          embeddingStatus: "failed",
          embeddingError: message.slice(0, 1000),
        },
      });

      console.error(`Failed to embed resume ${resumeId} after ${nextAttempts} attempts (job ${job.id})`);
      console.error(message);
      return true;
    }

    const delay = transient ? 5_000 : backoffMs(nextAttempts);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "queued",
        attempts: nextAttempts,
        runAt: new Date(Date.now() + delay),
        lockedAt: null,
        lockedBy: null,
        lastError: message.slice(0, 1000),
      },
    });

    // keeping resume pending while we retry
    await prisma.resume.updateMany({
      where: { id: resumeId },
      data: {
        embeddingStatus: "pending",
        embeddingError: message.slice(0, 1000),
      },
    });

    console.error(`Job ${job.id} failed (attempt ${nextAttempts}/${job.maxAttempts}). Retrying in ${Math.round(delay / 1000)}s.`);
    console.error(message);
    return true;
  }
}

async function run() {
  console.log("Embedding worker started");

  if (backfillMode) {
    const created = await enqueueMissingEmbeddingJobs();
    console.log(`Backfill: created ${created} embedding job(s)`);
    if (!watchMode) {
      console.log("Backfill complete. Exiting.");
      return;
    }
  }

  let lastIdleLog = 0;

  while (true) {
    try {
      let processedAny = false;
      for (let i = 0; i < BATCH_SIZE; i++) {
        const did = await processOneJob();
        if (!did) break;
        processedAny = true;
      }

      if (!processedAny) {
        if (!watchMode) {
          console.log("No queued jobs. Exiting.");
          return;
        }

        const now = Date.now();
        if (now - lastIdleLog >= IDLE_LOG_EVERY_MS) {
          console.log("No pending resumes. Waiting...");
          lastIdleLog = now;
        }
        await sleep(SLEEP_MS);
      }
    } catch (err) {
      console.error("Worker loop error:", err);
      if (!watchMode) {
        throw err;
      }
      await sleep(SLEEP_MS);
    }
  }
}

process.on("SIGINT", async () => {
  console.log("\nShutting down embedding worker...");
  await prisma.$disconnect();
  if (embeddingsServer) {
    try {
      embeddingsServer.kill("SIGTERM");
    } catch {
    }
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down embedding worker...");
  await prisma.$disconnect();
  if (embeddingsServer) {
    try {
      embeddingsServer.kill("SIGTERM");
    } catch {
    }
  }
  process.exit(0);
});

run().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});