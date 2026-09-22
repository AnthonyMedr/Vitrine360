import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { closeDbResources, initializeDb, readDb } from "../server/db";
import { buildHomologationPack, type HomologationPack } from "../server/homologation-pack";
import { closePostgresPool } from "../server/postgres";
import { closeRedisClient } from "../server/redis";

const reportDir = path.resolve(process.cwd(), "docs/reports");

function isoStamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, "-").slice(0, 16);
}

function status(value: boolean) {
  return value ? "PASS" : "BLOCKED";
}

function yesNo(value: boolean) {
  return value ? "sim" : "nao";
}

function list(items: string[]) {
  if (items.length === 0) return "- Nenhuma pendencia neste bloco.";
  return items.map((item) => `- ${item}`).join("\n");
}

function table(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => `| ${row.map((cell) => String(cell ?? "-")).join(" | ")} |`).join("\n");
}

function renderMarkdown(pack: HomologationPack) {
  const gateRows = [
    ["Fase 1 infra", status(pack.gates.phase1.ok), pack.gates.phase1.blockers, pack.gates.phase1.warnings],
    ["Fase 2 providers", status(pack.gates.phase2.phase2_ready), pack.gates.phase2.blockers, pack.gates.phase2.warnings],
    ["Seguranca", status(pack.gates.security.ready), pack.gates.security.blockers, pack.gates.security.warnings],
    ["Fiscal minimo", status(pack.gates.fiscal.ready), pack.gates.fiscal.blockers, pack.gates.fiscal.warnings],
    ["Operacao", status(pack.gates.operations.ready), pack.gates.operations.blockers, pack.gates.operations.warnings],
    ["Frete catalogo", status(pack.gates.freight_catalog.national_freight_ready), pack.gates.freight_catalog.blockers.length, pack.gates.freight_catalog.warnings.length],
    ["Release", status(pack.gates.release.ready), pack.gates.release.blockers, pack.gates.release.warnings],
    ["Go-live", status(pack.gates.go_live.go_live_ready), pack.gates.go_live.blockers, pack.gates.go_live.warnings],
  ];

  const envRows = pack.env_requirements.map((item) => [
    item.phase,
    item.key,
    item.requiredFor,
    item.configured ? "configurado" : "pendente",
  ]);

  const blockerDetails = [
    ...pack.gates.phase1.checks.filter((item) => item.status === "blocker").map((item) => `${item.key}: ${item.message}`),
    ...pack.gates.phase2.checks.blockers.map((item) => `${item.item}: ${item.detail}`),
    ...pack.gates.fiscal.checks.blockers.map((item) => `${item.item}: ${item.detail}`),
    ...pack.gates.go_live.checks.blockers.map((item) => `${item.item}: ${item.detail}`),
  ];

  return `# Pacote de homologacao nacional

Gerado em: ${pack.generated_at}

## Decisao

- Base local pronta: ${yesNo(pack.decision.local_base_ready)}
- Homologacao pronta: ${yesNo(pack.decision.homologation_ready)}
- Go-live pronto: ${yesNo(pack.decision.go_live_ready)}
- Ambiente: ${pack.environment.app_env}
- URL publica prevista: ${pack.environment.app_base_url}
- API prevista: ${pack.environment.api_base_url}
- Homologation only: ${yesNo(pack.environment.homologation_only)}

## Gates

${table([
    ["Gate", "Status", "Blockers", "Warnings"],
    ...gateRows,
  ])}

## Variaveis obrigatorias

${table([
    ["Fase", "Variavel", "Uso", "Status"],
    ...envRows,
  ])}

## Pendencias bloqueadoras

${list(Array.from(new Set(blockerDetails)))}

## Sequencia operacional

${pack.command_sequence.map((command, index) => `${index + 1}. ${command}`).join("\n")}

## Proximo passo imediato

${pack.missing_env.length > 0
    ? `Preencher as ${pack.missing_env.length} variaveis pendentes em ambiente de homologacao/producao e reexecutar ${"`npm run phase1:check`"} e ${"`npm run phase2:check`"}.`
    : "Reexecutar release e go-live checks com providers reais ativos."}
`;
}

async function main() {
  await initializeDb();
  const pack = await buildHomologationPack(readDb());
  const markdown = renderMarkdown(pack);
  const stamp = isoStamp();
  const timestampedPath = path.resolve(reportDir, `homologation-pack-${stamp}.md`);
  const latestMarkdownPath = path.resolve(reportDir, "homologation-pack-latest.md");
  const latestJsonPath = path.resolve(reportDir, "homologation-pack-latest.json");

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(timestampedPath, markdown, "utf8");
  fs.writeFileSync(latestMarkdownPath, markdown, "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(pack, null, 2), "utf8");

  console.log(`Pacote de homologacao gerado: ${timestampedPath}`);
  console.log(`Ultima versao Markdown: ${latestMarkdownPath}`);
  console.log(`Ultima versao JSON: ${latestJsonPath}`);
  console.log(`Go-live pronto: ${pack.decision.go_live_ready ? "sim" : "nao"}`);
  console.log(`Variaveis pendentes: ${pack.missing_env.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      closeDbResources();
      await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
    });
}
