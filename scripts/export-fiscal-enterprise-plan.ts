import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { initializeDb, readDb } from "../server/db.ts";
import { buildFiscalEnterprisePlan, type FiscalEnterprisePlan } from "../server/fiscal-enterprise-plan.ts";

function row(values: Array<string | number | boolean | null | undefined>) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(plan: FiscalEnterprisePlan) {
  return [
    "# Plano Fiscal Enterprise Executavel",
    "",
    `Gerado em: ${plan.generated_at}`,
    "",
    "## Veredito",
    "",
    row(["Item", "Status"]),
    row(["---", "---"]),
    row(["Fiscal minimo", plan.verdict.fiscal_minimal]),
    row(["Soft launch regional", plan.verdict.regional_soft_launch]),
    row(["Operacao nacional", plan.verdict.national_operation]),
    row(["Marketplace", plan.verdict.marketplace]),
    row(["Black Friday", plan.verdict.black_friday]),
    "",
    "## Scores",
    "",
    row(["Area", "Nota"]),
    row(["---", "---:"]),
    ...Object.entries(plan.scores).map(([key, value]) => row([key, value])),
    "",
    "## Metricas",
    "",
    row(["Metrica", "Valor"]),
    row(["---", "---:"]),
    ...Object.entries(plan.metrics).map(([key, value]) => row([key, String(value)])),
    "",
    "## Fases 0 a 7",
    "",
    row(["Fase", "Status", "Objetivo", "Blockers", "Comandos"]),
    row(["---", "---", "---", "---", "---"]),
    ...plan.phases.map((phase) =>
      row([
        `${phase.id} - ${phase.name}`,
        phase.status,
        phase.objective,
        phase.blockers.length > 0 ? phase.blockers.join("; ") : "Sem blockers no escopo atual",
        phase.commands.join("<br>"),
      ]),
    ),
    "",
    "## Proximas acoes",
    "",
    ...plan.next_actions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

async function main() {
  const outArg = process.argv.find((entry) => entry.startsWith("--out="));
  const outPath = resolve(outArg?.split("=")[1] ?? "docs/reports/PLANO_FISCAL_ENTERPRISE_EXECUTAVEL.md");
  const jsonPath = outPath.replace(/\.md$/i, ".json");

  await initializeDb();
  const plan = buildFiscalEnterprisePlan(readDb());

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderMarkdown(plan), "utf8");
  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        markdown_path: outPath,
        json_path: jsonPath,
        verdict: plan.verdict,
        scores: plan.scores,
        blocked_phases: plan.phases.filter((phase) => phase.status === "blocked").map((phase) => phase.id),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
