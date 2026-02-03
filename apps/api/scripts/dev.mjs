import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "nodemon.cmd" : "nodemon";
const args = [];

const child = spawn(command, args, {
  stdio: "inherit",
});

let interrupted = false;

const forwardAndExitCleanly = (signal) => {
  interrupted = true;
  try {
    child.kill(signal);
  } catch {
    // ignore
  }
};

process.on("SIGINT", () => forwardAndExitCleanly("SIGINT"));
process.on("SIGTERM", () => forwardAndExitCleanly("SIGTERM"));

child.on("exit", (code, signal) => {
  // When you stop the dev server (Ctrl+C), some tooling exits with 130 or 2.
  if (interrupted || signal === "SIGINT" || code === 130 || code === 2) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
