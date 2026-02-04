import { spawn } from "node:child_process";

// Root dev runner.

const turboCmd = process.platform === "win32" ? "turbo.cmd" : "turbo";
const args = ["run", "dev"];

const child = spawn(turboCmd, args, {
	stdio: "inherit",
	env: process.env,
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
	if (interrupted || signal === "SIGINT" || code === 130) {
		process.exit(0);
	}
	process.exit(code ?? 1);
});
