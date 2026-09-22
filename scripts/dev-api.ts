import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const apiHealthUrl = process.env.DEV_API_HEALTH_URL ?? "http://127.0.0.1:3001/api/health";
const tsxCli = resolve("node_modules", "tsx", "dist", "cli.mjs");
const command = existsSync(tsxCli) ? process.execPath : process.platform === "win32" ? "npx.cmd" : "npx";
const args = existsSync(tsxCli) ? [tsxCli, "watch", "server/index.ts"] : ["tsx", "watch", "server/index.ts"];

async function isApiAlreadyRunning() {
  try {
    const response = await fetch(apiHealthUrl, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

function waitUntilStopped() {
  const interval = setInterval(() => undefined, 60_000);
  function stop() {
    clearInterval(interval);
    process.exit(0);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

async function main() {
  if (await isApiAlreadyRunning()) {
    process.stdout.write(`[api] API ja esta ativa em ${apiHealthUrl}. Mantendo processo dev vivo.\n`);
    waitUntilStopped();
    return;
  }

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DB_PROVIDER: process.env.DEV_DB_PROVIDER || "sqlite",
      DATABASE_URL: process.env.DEV_DATABASE_URL || "",
      QUEUE_PROVIDER: process.env.DEV_QUEUE_PROVIDER || "memory",
      REDIS_URL: process.env.DEV_REDIS_URL || "",
      NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1",
    },
    shell: false,
    stdio: "inherit",
  });

  function forwardSignal(signal: NodeJS.Signals) {
    if (!child.killed) child.kill(signal);
  }

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

void main();
