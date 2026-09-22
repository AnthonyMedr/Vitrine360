import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { buildHomologationScenarioReport, type HomologationScenarioReport } from "../server/homologation-scenarios.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(report: HomologationScenarioReport) {
  const lines: string[] = [];
  lines.push("# Cenarios De Homologacao Operacional");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status: **${report.ok ? "PRONTO PARA ENSAIO" : "REVISAR MASSA DE ENSAIO"}**`);
  lines.push(`- Modo: \`${report.mode}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- Cenarios prontos: ${report.scenarios_ready}`);
  lines.push(`- Cenarios bloqueados: ${report.scenarios_blocked}`);
  lines.push("");
  lines.push("## Cenarios");
  lines.push("");
  lines.push(row(["Cenario", "Dominio", "Status", "Objetivo", "Resultado esperado"]));
  lines.push(row(["---", "---", "---", "---", "---"]));
  for (const scenario of report.scenarios) {
    lines.push(row([scenario.title, scenario.domain, scenario.status, scenario.objective, scenario.expected_result]));
  }
  lines.push("");
  lines.push("## Roteiros");
  lines.push("");
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.title}`);
    lines.push("");
    lines.push(`Status: \`${scenario.status}\``);
    lines.push("");
    lines.push("Precondicoes:");
    for (const item of scenario.preconditions) lines.push(`- ${item}`);
    lines.push("");
    lines.push("Passos:");
    for (const item of scenario.steps) lines.push(`- ${item}`);
    lines.push("");
    lines.push("Evidencias esperadas:");
    for (const item of scenario.evidence) lines.push(`- ${item}`);
    if (scenario.blockers.length > 0) {
      lines.push("");
      lines.push("Bloqueios da massa de ensaio:");
      for (const blocker of scenario.blockers) lines.push(`- ${blocker}`);
    }
    lines.push("");
  }
  lines.push("## Proximos Passos");
  lines.push("");
  for (const step of report.next_steps) lines.push(`- ${step}`);
  lines.push("");
  lines.push("Observacao: estes cenarios sao para treinamento e homologacao operacional. Eles nao substituem contador, gateway de pagamento, provider de frete ou emissor fiscal real.");
  lines.push("");
  return lines.join("\n");
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/homologation-scenarios-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

try {
  await initializeDb();
  const report = buildHomologationScenarioReport(readDb());
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${renderMarkdown(report)}\n`, "utf8");
  console.log(JSON.stringify({ ok: report.ok, scenarios_ready: report.scenarios_ready, scenarios_blocked: report.scenarios_blocked, jsonPath, mdPath }, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
