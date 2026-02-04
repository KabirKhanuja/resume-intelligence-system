import { prisma } from "../apps/api/src/db.js";
import { embedText, buildResumeEmbeddingText } from "resume-embeddings";
import type { ResumeSchema } from "resume-core";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BATCH_SIZE = 5;
const SLEEP_MS = 2000;
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const IDLE_LOG_EVERY_MS = 15_000;

const watchMode = process.argv.includes("--watch");

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

async function processBatch() {
  const pending = await prisma.resume.findMany({
    where: { embeddingStatus: "pending" },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    return 0;
  }

  // this will only start the embeddings server when there is work to do
  await ensureEmbeddingsServer();

  for (const resume of pending) {
    try {
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

      console.log(`Embedded resume ${resume.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown embedding error";

      // if the server is down it won't mark items as permanently failed
      if (looksLikeEmbeddingsServerDown(err)) {
        console.error(`Embeddings server unavailable while embedding ${resume.id}. Will retry.`);
        console.error(message);
        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            embeddingStatus: "pending",
            embeddingError: message.slice(0, 1000),
          },
        });
        // itll bail out of this batch so we don't spam the DB with the same error
        return pending.length;
      }

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          embeddingStatus: "failed",
          embeddingError: message.slice(0, 1000),
        },
      });

      console.error(`Failed to embed resume ${resume.id}`);
      console.error(message);
    }
  }

  return pending.length;
}

async function run() {
  console.log("Embedding worker started");

  // if the previous run marked some resumes failed due to the server being down
  // we would reset them back to pending so they can be retried
  await prisma.resume.updateMany({
    where: {
      embeddingStatus: "failed",
      embeddingError: {
        contains: "failed to reach embeddings server",
      },
    },
    data: {
      embeddingStatus: "pending",
    },
  });

  let lastIdleLog = 0;

  while (true) {
    try {
      const processed = await processBatch();

      if (processed === 0) {
        if (!watchMode) {
          console.log("No pending resumes. Exiting.");
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