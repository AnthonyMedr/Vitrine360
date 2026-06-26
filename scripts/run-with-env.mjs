import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseEnvFile(content) {
  const pairs = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

const [, , envFileArg, targetScriptArg, ...extraEnvArgs] = process.argv;

if (!envFileArg || !targetScriptArg) {
  console.error("Uso: node scripts/run-with-env.mjs <arquivo-env> <script-alvo>");
  process.exit(1);
}

const envFilePath = path.resolve(process.cwd(), envFileArg);
const targetScriptPath = path.resolve(process.cwd(), targetScriptArg);

if (!existsSync(envFilePath)) {
  console.error(`[FAIL] Arquivo de ambiente nao encontrado: ${envFilePath}`);
  console.error(
    "[INFO] Rode `npm run production:env:init` e preencha os valores reais antes de continuar.",
  );
  process.exit(1);
}

const envContent = readFileSync(envFilePath, "utf8");
for (const [key, value] of parseEnvFile(envContent)) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

for (const pair of extraEnvArgs) {
  const separatorIndex = pair.indexOf("=");
  if (separatorIndex <= 0) continue;
  const key = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1).trim();
  process.env[key] = value;
}

await import(pathToFileURL(targetScriptPath).href);
