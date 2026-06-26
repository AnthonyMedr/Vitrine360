import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function readFile(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf8");
}

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

function readEnv(relativePath) {
  const content = readFile(relativePath);
  return content ? parseEnvFile(content) : null;
}

function looksPlaceholder(value) {
  return /definir-|usuario:senha|host-producao|example\.com|exemplo\.com|admin@2026|vitrine360-local-admin-token/i.test(
    value || "",
  );
}

function fieldStatus(env, key) {
  const value = env?.[key] || "";
  if (!value) return "ausente";
  if (looksPlaceholder(value)) return "placeholder";
  return "definido";
}

function extractLine(content, pattern) {
  if (!content) return null;
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().includes(pattern.toLowerCase()));
  return line?.trim() || null;
}

function fileBullet(relativePath) {
  return existsSync(path.join(process.cwd(), relativePath))
    ? `- [x] \`${relativePath}\``
    : `- [ ] \`${relativePath}\``;
}

const productionEnv = readEnv(".env.production");
const goLiveStatus = readFile("GO-LIVE-STATUS.md");
const productionNext = readFile("PRODUCTION-NEXT-STEPS.md");
const pilotChecklist = readFile("PILOTO-CONTENT-CHECKLIST.md");

const summaryLocal = extractLine(goLiveStatus, "Status do diagnostico local");
const summaryOfficial = extractLine(goLiveStatus, "Status do readiness oficial");
const summaryPilot = extractLine(pilotChecklist, "Loja atual:");

const requiredProductionFields = [
  "DATABASE_URL",
  "APP_BASE_URL",
  "VITE_PUBLIC_SITE_URL",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "ADMIN_BOOTSTRAP_TOKEN",
  "AI_PROVIDER",
  "AI_API_KEY",
];

const fieldRows = requiredProductionFields.map(
  (key) => `| \`${key}\` | ${fieldStatus(productionEnv, key)} |`,
);

const packet = `# Production Packet - Vitrine360

Gerado automaticamente em ${new Date().toISOString()}.

## 1. Objetivo

Centralizar em um unico documento o estado atual da publicacao, os artefatos de apoio e a proxima sequencia pratica do Go-Live assistido.

## 2. Resumo rapido

- ${summaryLocal || "Status local ainda nao gerado."}
- ${summaryOfficial || "Status oficial ainda nao gerado."}
- ${summaryPilot || "Checklist do piloto ainda nao gerada."}

## 3. Estado do ambiente oficial

| Campo | Status |
| --- | --- |
${fieldRows.join("\n")}

## 4. Artefatos principais

### Operacao e producao

${fileBullet("PRODUCTION-HANDOFF.md")}
${fileBullet("GO-LIVE-RUNBOOK.md")}
${fileBullet("GO-LIVE-CHECKLIST.md")}
${fileBullet("GO-LIVE-STATUS.md")}
${fileBullet("PRODUCTION-NEXT-STEPS.md")}

### Piloto e conteudo

${fileBullet("PILOTO-CONTENT-REVIEW.md")}
${fileBullet("PILOTO-CONTENT-SNAPSHOT.md")}
${fileBullet("PILOTO-CONTENT-APPROVED.json")}
${fileBullet("PILOTO-CONTENT-CHECKLIST.md")}

### Relatorios de produto

${fileBullet("PROJECT-STATUS-REPORT.md")}
${fileBullet("TECHNICAL-AUDIT.md")}
${fileBullet("UI-UX-AUDIT.md")}
${fileBullet("ACTION-PLAN.md")}

## 5. Comandos recomendados

\`\`\`bash
npm run production:handoff
npm run pilot:content:checklist
npm run production:check
\`\`\`

## 6. Proxima sequencia pratica

\`\`\`text
${productionNext?.trim() || "PRODUCTION-NEXT-STEPS.md ainda nao gerado."}
\`\`\`

## 7. Observacao

Este pacote nao substitui a validacao real em infraestrutura oficial, mas reduz atrito de handoff e organiza a execucao para time tecnico e comercial.
`;

const outputPath = path.join(process.cwd(), "PRODUCTION-PACKET.md");
writeFileSync(outputPath, packet, "utf8");
console.log(`[OK] Pacote gerado: ${outputPath}`);
