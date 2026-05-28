import { spawn } from "node:child_process";
import process from "node:process";

const commands = [
  { name: "vite", command: "npm", args: ["run", "dev"] },
];

if (!(await isApiRunning())) {
  commands.unshift({ name: "api", command: "node", args: ["server.mjs"] });
} else {
  console.log("[api] already running on http://127.0.0.1:8787");
}

let shuttingDown = false;

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.log(`[${name}] exited with code ${code}`);
    shutdown(code ?? 0);
  });

  return child;
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function shutdown(code) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

async function isApiRunning() {
  try {
    const response = await fetch("http://127.0.0.1:8787/api/health", { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}
