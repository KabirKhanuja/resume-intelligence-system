import type { Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "./db.js";
import { createApp } from "./app.js";

const srcDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(srcDir, "../../../.env");
const apiEnvPath = resolve(srcDir, "../.env");

const rootEnvResult = loadEnv({ path: rootEnvPath, override: true });
const apiEnvResult = loadEnv({ path: apiEnvPath, override: false });

console.log(
  `[ENV] root .env ${rootEnvResult.error ? "not loaded" : "loaded"} (${rootEnvPath}) | ` +
    `api .env ${apiEnvResult.error ? "not loaded" : "loaded"} (${apiEnvPath}) | ` +
    `DATABASE_URL=${process.env.DATABASE_URL ? "set" : "missing"} | ` +
    `LLM_BASE_URL=${process.env.LLM_BASE_URL ? "set" : "missing"} | ` +
    `LLM_API_KEY=${process.env.LLM_API_KEY ? "set" : "missing"}`,
);

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught exception:", error);
});

const app = createApp();

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