import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

type Step = {
  id: string;
  command: string;
  required: boolean;
};

type StepResult = Step & {
  ok: boolean;
  status: number | null;
  durationMs: number;
};

type PreflightReport = {
  ok: boolean;
  generated_at: string;
  scope: string;
  ecommerce_future: string;
  include_external: boolean;
  failed_required: string[];
  failed_optional: string[];
  results: StepResult[];
  next_steps: string[];
};

const includeExternal = process.argv.includes("--include-external");

const steps: Step[] = [
  { id: "typecheck", command: "npm run typecheck", required: true },
  { id: "admin_menu_routes", command: "npm run admin:menu-routes:check", required: true },
  { id: "admin_simple_ux", command: "npm run admin:simple-ux:check", required: true },
  { id: "admin_catalog_deploy", command: "npm run gamel:admin-catalog:deploy-check", required: true },
  { id: "env_blueprints", command: "npm run env:blueprints:check", required: true },
  { id: "gamel_phase1_gate", command: "npm run gamel:phase1:go-live:check", required: true },
  { id: "seo", command: "npm run seo:check", required: true },
  { id: "build", command: "npm run build", required: true },
  { id: "performance_budget", command: "npm run performance:budget", required: true },
];

if (includeExternal) {
  steps.push({ id: "phase1_cutover_external", command: "npm run phase1:check", required: false });
}

const results: StepResult[] = [];

for (const step of steps) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    env: process.env,
  });

  results.push({
    ...step,
    ok: result.status === 0,
    status: result.status,
    durationMs: Date.now() - startedAt,
  });
}

const failedRequired = results.filter((result) => result.required && !result.ok);
const failedOptional = results.filter((result) => !result.required && !result.ok);

const report: PreflightReport = {
  ok: failedRequired.length === 0,
  generated_at: new Date().toISOString(),
  scope: "GAMEL Fase 1 - institucional, catalogo, orcamento online e admin",
  ecommerce_future: "stand_by",
  include_external: includeExternal,
  failed_required: failedRequired.map((result) => result.id),
  failed_optional: failedOptional.map((result) => result.id),
  results,
  next_steps:
    failedRequired.length === 0
      ? includeExternal && failedOptional.length > 0
        ? ["Resolver servicos externos do cutover: Postgres, Redis, dominio, HTTPS e credenciais reais."]
        : ["Preflight local aprovado. Avancar para homologacao final, ambiente real e cutover assistido."]
      : ["Corrigir falhas obrigatorias antes de homologar a Fase 1."],
};

const jsonPath = path.resolve(process.cwd(), "docs/reports/gamel-phase1-preflight-latest.json");
const mdPath = path.resolve(process.cwd(), "docs/reports/gamel-phase1-preflight-latest.md");

writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown(report));

console.log(JSON.stringify({
  ok: report.ok,
  failed_required: report.failed_required,
  failed_optional: report.failed_optional,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}

function renderMarkdown(report: PreflightReport) {
  const lines = [
    "# Preflight GAMEL Fase 1",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `Status: ${report.ok ? "OK" : "FALHOU"}`,
    `Escopo: ${report.scope}`,
    `E-commerce completo: ${report.ecommerce_future}`,
    `Incluiu dependencias externas: ${report.include_external ? "sim" : "nao"}`,
    "",
    "## Resultados",
    "",
    "| Check | Obrigatorio | Status | Duracao |",
    "|---|---:|---:|---:|",
    ...report.results.map((result) => `| ${result.id} | ${result.required ? "sim" : "nao"} | ${result.ok ? "OK" : "FALHOU"} | ${result.durationMs}ms |`),
    "",
    "## Proximos Passos",
    "",
    ...report.next_steps.map((step) => `- ${step}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}
