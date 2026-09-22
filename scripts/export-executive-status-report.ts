import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { buildExecutiveStatus, type ExecutiveStatus } from "../server/executive-status.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function boolLabel(value: boolean) {
  return value ? "sim" : "nao";
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(status: ExecutiveStatus) {
  const lines: string[] = [];
  lines.push("# Status Executivo Atual");
  lines.push("");
  lines.push(`Gerado em: ${status.generated_at}`);
  lines.push("");
  lines.push("## Decisao");
  lines.push("");
  lines.push(row(["Escopo", "Status"]));
  lines.push(row(["---", "---"]));
  lines.push(row(["Homologacao local", status.decisions.local_homologation]));
  lines.push(row(["Fase 1 infra", status.decisions.phase1_infra]));
  lines.push(row(["Producao aberta", status.decisions.production_open]));
  lines.push(row(["Go-live nacional", status.decisions.national_go_live]));
  lines.push("");
  lines.push(`Bloqueio principal: \`${status.main_blocker}\``);
  lines.push("");
  lines.push("## Trilha De Fases");
  lines.push("");
  lines.push(row(["Fase", "Nome", "Status", "Responsavel", "Proximo passo"]));
  lines.push(row(["---", "---", "---", "---", "---"]));
  for (const phase of status.phase_roadmap) {
    lines.push(row([phase.phase, phase.label, phase.status, phase.owner, phase.next_step]));
  }
  lines.push("");
  lines.push("## Gates");
  lines.push("");
  lines.push(row(["Gate", "Ready", "Blockers", "Warnings"]));
  lines.push(row(["---", "---", "---", "---"]));
  for (const [gate, summary] of Object.entries(status.gates)) {
    lines.push(row([gate, boolLabel(summary.ready), summary.blockers, summary.warnings]));
  }
  lines.push("");
  lines.push("## Blockers principais");
  lines.push("");
  if (status.blockers_sample.length === 0) {
    lines.push("Nenhum blocker principal no status atual.");
  } else {
    for (const blocker of status.blockers_sample) lines.push(`- ${blocker}`);
  }
  lines.push("");
  lines.push("## Proximos comandos");
  lines.push("");
  for (const command of status.next_commands) lines.push(`- \`${command}\``);
  lines.push("");
  lines.push("Observacao: `BLOQUEADO_EXTERNO` indica dependencia real de contador, credencial, provider ou ambiente produtivo. Nao usar dado falso para liberar gate.");
  lines.push("");
  return lines.join("\n");
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/executive-status-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

try {
  await initializeDb();
  const status = await buildExecutiveStatus(readDb());
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${renderMarkdown(status)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, production_open: status.decisions.production_open }, null, 2));
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
