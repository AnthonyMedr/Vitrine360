import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
  return Object.fromEntries(pairs);
}

function looksPlaceholder(value) {
  return /definir-|usuario:senha|host-producao|example\.com|exemplo\.com|admin@2026|vitrine360-local-admin-token/i.test(
    value || "",
  );
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function commandStatus(result) {
  return result.status === 0 ? "OK" : "Falhou";
}

function safeReadEnv(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return null;
  return parseEnvFile(readFileSync(fullPath, "utf8"));
}

function maskValue(key, value) {
  if (!value) return "(vazio)";
  if (/PASSWORD|TOKEN|KEY/i.test(key)) {
    return looksPlaceholder(value) ? "(placeholder)" : "(definido)";
  }
  return value;
}

function normalizeText(value) {
  return String(value || "")
    .replaceAll("nÃ£o", "não")
    .replaceAll("NÃ£o", "Não")
    .replaceAll("execuÃ§Ã£o", "execução")
    .replaceAll("aplicaÃ§Ã£o", "aplicação")
    .replaceAll("produÃ§Ã£o", "produção")
    .replaceAll("configuraÃ§Ã£o", "configuração")
    .replaceAll("validaÃ§Ã£o", "validação")
    .replaceAll("estaÃ§Ã£o", "estação")
    .replaceAll("indisponÃ­vel", "indisponível")
    .replaceAll("pÃºblico", "público")
    .replaceAll("mÃ­dia", "mídia")
    .replaceAll("fÃ­sica", "física")
    .replaceAll("operaÃ§Ãµes", "operações")
    .replaceAll("autenticaÃ§Ã£o", "autenticação")
    .replaceAll("Ã¡rea", "área")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãµ", "õ")
    .replaceAll("Ãº", "ú");
}

function summarizeResult(result) {
  const combined = [result.stdout || "", result.stderr || ""].filter(Boolean).join("\n").trim();
  return normalizeText(combined || "sem saida");
}

const localEnv = safeReadEnv(".env");
const productionEnv = safeReadEnv(".env.production");
const productionAiProvider = productionEnv?.AI_PROVIDER || "";

const dbStatus = runCommand(process.execPath, [
  path.join("scripts", "run-with-env.mjs"),
  ".env",
  path.join("scripts", "db-status.mjs"),
]);
const localReadiness = runCommand(process.execPath, [
  path.join("scripts", "run-with-env.mjs"),
  ".env",
  path.join("scripts", "production-readiness.mjs"),
  "PRODUCTION_CHECK_MODE=local",
]);
const productionReadiness = runCommand(process.execPath, [
  path.join("scripts", "run-with-env.mjs"),
  ".env.production",
  path.join("scripts", "production-readiness.mjs"),
]);

const productionFields = [
  "DATABASE_URL",
  "APP_BASE_URL",
  "VITE_PUBLIC_SITE_URL",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "ADMIN_BOOTSTRAP_TOKEN",
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
];

const productionRows = productionFields.map((key) => {
  const value = productionEnv?.[key] ?? "";
  const aiKeyOptional = key === "AI_API_KEY" && productionAiProvider === "mock" && !value;
  const status = aiKeyOptional
    ? "nao aplicavel"
    : !value
      ? "ausente"
      : looksPlaceholder(value)
        ? "placeholder"
        : "definido";
  return `| \`${key}\` | ${status} | ${maskValue(key, value)} |`;
});

const report = `# GO-LIVE Status Report - Vitrine360

Gerado automaticamente em ${new Date().toISOString()}.

## 1. Resumo executivo

- Status do diagnostico local: **${commandStatus(dbStatus)}**
- Status do readiness local: **${commandStatus(localReadiness)}**
- Status do readiness oficial: **${commandStatus(productionReadiness)}**

## 2. Ambiente local

- \`.env\`: ${localEnv ? "encontrado" : "ausente"}
- PostgreSQL local esperado em: \`${localEnv?.DATABASE_URL || "(nao definido)"}\`
- APP local: \`${localEnv?.APP_BASE_URL || "(nao definido)"}\`
- Site publico local: \`${localEnv?.VITE_PUBLIC_SITE_URL || "(nao definido)"}\`

## 3. Ambiente oficial

- \`.env.production\`: ${productionEnv ? "encontrado" : "ausente"}

| Campo | Status | Valor |
| --- | --- | --- |
${productionRows.join("\n")}

## 4. Comandos executados

| Comando | Resultado |
| --- | --- |
| \`npm run db:status\` | ${commandStatus(dbStatus)} |
| \`npm run production:check:local\` | ${commandStatus(localReadiness)} |
| \`npm run production:check\` | ${commandStatus(productionReadiness)} |

## 5. Saida resumida - diagnostico local

\`\`\`text
${summarizeResult(dbStatus)}
\`\`\`

## 6. Saida resumida - readiness local

\`\`\`text
${summarizeResult(localReadiness)}
\`\`\`

## 7. Saida resumida - readiness oficial

\`\`\`text
${summarizeResult(productionReadiness)}
\`\`\`

## 8. Pendencias objetivas

1. Substituir placeholders restantes de \`.env.production\`.
2. Executar \`npm run db:migrate:prod\` no PostgreSQL oficial.
3. Reexecutar \`npm run production:check\`.
4. Validar login administrativo com o bootstrap final.
5. Seguir para \`GO-LIVE-RUNBOOK.md\` e \`GO-LIVE-CHECKLIST.md\`.
`;

const outputPath = path.join(process.cwd(), "GO-LIVE-STATUS.md");
writeFileSync(outputPath, report, "utf8");
console.log(`[OK] Relatorio gerado: ${outputPath}`);
