import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const apiHealthUrl = process.env.DEV_API_HEALTH_URL ?? "http://127.0.0.1:3001/api/health";
const timeoutMs = Number(process.env.DEV_API_WAIT_TIMEOUT_MS ?? 30000);
const intervalMs = Number(process.env.DEV_API_WAIT_INTERVAL_MS ?? 500);
const viteCli = resolve("node_modules", "vite", "bin", "vite.js");
const command = existsSync(viteCli) ? process.execPath : process.platform === "win32" ? "npx.cmd" : "npx";
const args = existsSync(viteCli) ? [viteCli] : ["vite"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isApiReady() {
  try {
    const response = await fetch(apiHealthUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi() {
  const started = Date.now();
  process.stdout.write(`[web] aguardando API em ${apiHealthUrl}\n`);

  while (Date.now() - started < timeoutMs) {
    if (await isApiReady()) {
      process.stdout.write("[web] API pronta, iniciando Vite\n");
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error(`API nao respondeu em ${apiHealthUrl} dentro de ${timeoutMs}ms`);
}

function startWeb() {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
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

waitForApi()
  .then(startWeb)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
