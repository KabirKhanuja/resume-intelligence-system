import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "next.cmd" : "next";
const args = ["dev"];

const child = spawn(command, args, {
  stdio: "inherit",
});

let interrupted = false;

const forward = (signal) => {
  interrupted = true;
  try {
    child.kill(signal);
  } catch {
  }
};

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  // Ctrl+C should not be treated as an error in dev.
  if (interrupted || signal === "SIGINT" || code === 130) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
