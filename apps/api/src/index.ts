import type { Socket } from "node:net";
import { prisma } from "./db.js";
import { createApp } from "./app.js";

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

    // here we stop accepting new connections
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