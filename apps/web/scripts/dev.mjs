import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function tryUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function tryFreePort3000() {
  // Best-effort: if an old next dev is holding 3000, free it.
  // Only implemented for macOS/Linux where lsof exists.
  if (process.platform !== "darwin" && process.platform !== "linux") return;
  try {
    const lsof = spawn("lsof", ["-ti", ":3000"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    lsof.stdout.on("data", (d) => (out += String(d)));
    lsof.on("close", () => {
      const pids = out
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // ignore
  }
}

const command = process.platform === "win32" ? "next.cmd" : "next";
const args = ["dev"];

// Prevent common dev failure mode: stale lock file or an old next dev on 3000.
tryFreePort3000();
tryUnlink(path.resolve(process.cwd(), ".next/dev/lock"));

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
