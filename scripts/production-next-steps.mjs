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

function readEnv(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return null;
  return parseEnvFile(readFileSync(fullPath, "utf8"));
}

function runNodeScript(args) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function commandOk(result) {
  return result.status === 0;
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

const localEnv = readEnv(".env");
const productionEnv = readEnv(".env.production");
const aiProvider = productionEnv?.AI_PROVIDER || "";

const dbStatus = runNodeScript([
  path.join("scripts", "run-with-env.mjs"),
  ".env",
  path.join("scripts", "db-status.mjs"),
]);

const productionCheck = productionEnv
  ? runNodeScript([
      path.join("scripts", "run-with-env.mjs"),
      ".env.production",
      path.join("scripts", "production-readiness.mjs"),
    ])
  : null;

const officialPending = [];
for (const key of [
  "DATABASE_URL",
  "APP_BASE_URL",
  "VITE_PUBLIC_SITE_URL",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "ADMIN_BOOTSTRAP_TOKEN",
]) {
  const value = productionEnv?.[key] || "";
  if (!value || looksPlaceholder(value)) officialPending.push(key);
}

if (aiProvider && aiProvider !== "mock") {
  const aiApiKey = productionEnv?.AI_API_KEY || "";
  if (!aiApiKey || looksPlaceholder(aiApiKey)) officialPending.push("AI_API_KEY");
}

const readinessOfficialLabel = productionCheck
  ? commandOk(productionCheck)
    ? "OK"
    : "Bloqueado"
  : "Nao executado";

const localRecoverySteps = commandOk(dbStatus)
  ? "- [x] Banco local acessivel"
  : `- [ ] Iniciar Docker Desktop
- [ ] Executar \`npm run db:up\`
- [ ] Executar \`npm run db:status\`
- [ ] Executar \`npm run production:check:local\``;

const officialEnvSteps = productionEnv
  ? officialPending.map((key) => `- [ ] Definir \`${key}\``).join("\n")
  : "- [ ] Gerar `.env.production` com `npm run production:env:init`";

const productionCheckOutput = productionCheck
  ? summarizeResult(productionCheck)
  : "readiness oficial nao executado";

const report = `# Proximos Passos de Producao - Vitrine360

Gerado automaticamente em ${new Date().toISOString()}.

## 1. Estado atual

- Banco local: **${commandOk(dbStatus) ? "OK" : "Bloqueado"}**
- Readiness oficial: **${readinessOfficialLabel}**
- \`.env\`: ${localEnv ? "encontrado" : "ausente"}
- \`.env.production\`: ${productionEnv ? "encontrado" : "ausente"}

## 2. Proxima sequencia pratica

### Etapa 1 - Recuperar stack local

${localRecoverySteps}

### Etapa 2 - Fechar ambiente oficial

${officialEnvSteps}

- [ ] Executar \`npm run production:check\`
- [ ] Executar \`npm run db:migrate:prod\`
- [ ] Executar \`npm run db:seed:prod\` apenas se a base oficial ainda nao tiver carga homologada

### Etapa 3 - Homologar piloto

- [ ] Revisar \`PILOTO-CONTENT-CHECKLIST.md\`
- [ ] Atualizar \`PILOTO-CONTENT-APPROVED.json\`
- [ ] Executar \`npm run pilot:content:apply\`
- [ ] Validar \`/\`, \`/ofertas\`, \`/totem\` e \`/vitrine\`
- [ ] Validar QR Code com URL oficial

### Etapa 4 - Go-Live assistido

- [ ] Executar \`npm run go-live:preflight\`
- [ ] Executar \`npm run go-live:report\`
- [ ] Executar \`GO-LIVE-RUNBOOK.md\`
- [ ] Executar \`GO-LIVE-CHECKLIST.md\`

## 3. Bloqueios observados agora

### Banco local

\`\`\`text
${summarizeResult(dbStatus)}
\`\`\`

### Readiness oficial

\`\`\`text
${productionCheckOutput}
\`\`\`

## 4. Definicoes externas ainda necessarias

- dominio oficial e SSL
- credenciais reais do PostgreSQL oficial
- senha/token reais do admin
- decisao final sobre operar com \`AI_PROVIDER=mock\` no piloto ou ativar provedor real depois
- midia final aprovada
- validacao fisica de totem, TV e QR Code
`;

const outputPath = path.join(process.cwd(), "PRODUCTION-NEXT-STEPS.md");
writeFileSync(outputPath, report, "utf8");
console.log(`[OK] Plano gerado: ${outputPath}`);
