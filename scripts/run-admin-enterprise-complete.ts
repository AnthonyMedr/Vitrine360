import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type CompletionStep = {
  id: string;
  label: string;
  command: string[];
};

type CompletionResult = CompletionStep & {
  ok: boolean;
  exit_code: number | null;
  duration_ms: number;
  summary: string;
  parsed?: unknown;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const steps: CompletionStep[] = [
  { id: "final", label: "Fechamento final sequencial", command: ["run", "admin:enterprise:final"] },
  { id: "index", label: "Indice consolidado pos-fechamento", command: ["run", "admin:enterprise:index"] },
  { id: "boundary", label: "Boundary de governanca produtiva", command: ["run", "admin:enterprise:boundary"] },
  { id: "index-refresh", label: "Indice consolidado pos-boundary", command: ["run", "admin:enterprise:index"] },
  { id: "manifest", label: "Manifesto de integridade", command: ["run", "admin:enterprise:manifest"] },
  { id: "manifest-verify", label: "Verificacao de drift do manifesto", command: ["run", "admin:enterprise:manifest:verify"] },
];

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function summarize(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return "concluido";
  const record = parsed as Record<string, unknown>;
  return [
    typeof record.ok !== "undefined" ? `ok=${String(record.ok)}` : null,
    typeof record.executed_steps !== "undefined" ? `executed_steps=${String(record.executed_steps)}` : null,
    Array.isArray(record.failed_steps) ? `failed_steps=${record.failed_steps.length}` : null,
    typeof record.verdict !== "undefined" ? `verdict=${String(record.verdict)}` : null,
    typeof record.production_open !== "undefined" ? `production_open=${String(record.production_open)}` : null,
    typeof record.total_menu_routes !== "undefined" ? `total_menu_routes=${String(record.total_menu_routes)}` : null,
    typeof record.missing_routes !== "undefined" ? `missing_routes=${String(record.missing_routes)}` : null,
    typeof record.redirect_routes !== "undefined" ? `redirect_routes=${String(record.redirect_routes)}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function runStep(step: CompletionStep): CompletionResult {
  const started = Date.now();
  const result = spawnSync(npmCommand, step.command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  const duration = Date.now() - started;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const parsed = extractJson(stdout);
  const ok = result.status === 0;

  if (!ok) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  return {
    ...step,
    ok,
    exit_code: result.status,
    duration_ms: duration,
    summary: summarize(parsed),
    parsed,
  };
}

function renderMarkdown(report: { generated_at: string; ok: boolean; steps: CompletionResult[] }) {
  const lines = [
    "# Conclusao Oficial - Central Admin Enterprise",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `OK: ${report.ok}`,
    "",
    "## Sequencia Executada",
    "",
    "| Etapa | Resultado | Duracao | Resumo |",
    "| --- | --- | --- | --- |",
    ...report.steps.map((step) => `| ${step.label} | ${step.ok ? "ok" : "falhou"} | ${step.duration_ms}ms | ${step.summary.replace(/\|/g, "/")} |`),
    "",
    "## Veredito",
    "",
    report.ok
      ? "Central Admin Enterprise concluida no escopo programavel, com indice consolidado atualizado, manifesto de integridade gerado e drift verificado."
      : "Conclusao da Central Admin Enterprise falhou em etapa interna.",
    "",
    "Producao aberta permanece `BLOQUEADO_EXTERNO` ate validacoes reais de fiscal, pagamento, frete e operacao.",
  ];
  return `${lines.join("\n")}\n`;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-complete-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const results: CompletionResult[] = [];

for (const step of steps) {
  console.log(`[admin-complete] ${step.label}`);
  const result = runStep(step);
  results.push(result);
  console.log(`[admin-complete] ${step.label}: ${result.ok ? "OK" : "FALHOU"} - ${result.summary}`);
  if (!result.ok) break;
}

const report = {
  generated_at: new Date().toISOString(),
  ok: results.every((step) => step.ok) && results.length === steps.length,
  steps: results,
  files: {
    json: jsonPath,
    markdown: mdPath,
    final_report: "docs/reports/admin-enterprise-final-latest.json",
    index_report: "docs/reports/admin-enterprise-index-latest.json",
    boundary_report: "docs/reports/admin-enterprise-boundary-latest.json",
    manifest_report: "docs/reports/admin-enterprise-manifest-latest.json",
  },
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      executed_steps: results.length,
      failed_steps: results.filter((step) => !step.ok).map((step) => step.id),
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
