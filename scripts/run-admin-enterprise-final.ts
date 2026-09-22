import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type FinalStep = {
  id: string;
  label: string;
  command: string[];
};

type FinalStepResult = FinalStep & {
  ok: boolean;
  exit_code: number | null;
  duration_ms: number;
  summary: string;
  parsed?: unknown;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const steps: FinalStep[] = [
  { id: "phases", label: "Fase a fase Admin", command: ["run", "admin:enterprise:check"] },
  { id: "menu-routes", label: "Rotas do menu Admin", command: ["run", "admin:menu-routes:check"] },
  { id: "control-center", label: "Central de controle", command: ["run", "admin:control-center:check"] },
  { id: "external-handoff", label: "Handoff externo Admin", command: ["run", "admin:enterprise:external-handoff"] },
  { id: "programmable-completion", label: "Fechamento programavel", command: ["run", "completion:programmable:check"] },
  { id: "simple-ux-check", label: "Check de UX simples", command: ["run", "admin:simple-ux:check"] },
  { id: "adoption-pack", label: "Pacote de adocao operacional", command: ["run", "admin:adoption:pack"] },
  { id: "adoption-check", label: "Check de adocao operacional", command: ["run", "admin:adoption:check"] },
  { id: "typecheck", label: "Typecheck", command: ["run", "typecheck"] },
  { id: "lint", label: "Lint", command: ["run", "lint"] },
  { id: "build", label: "Build", command: ["run", "build"] },
  { id: "performance-budget", label: "Performance budget", command: ["run", "performance:budget"] },
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

function summarize(step: FinalStep, parsed: unknown, stdout: string) {
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const keys = [
      "ok",
      "total_menu_routes",
      "missing_routes",
      "redirect_routes",
      "internal_management_ready",
      "programmable_scope_complete",
      "production_open",
      "external_blockers",
      "programmable_pending",
      "real_execution_required",
      "total_js_kb",
      "summary",
    ];
    const pairs = keys
      .filter((key) => typeof record[key] !== "undefined")
      .map((key) => {
        const value = record[key];
        if (Array.isArray(value)) return `${key}=${value.length}`;
        if (value && typeof value === "object") {
          const nested = value as Record<string, unknown>;
          const nestedPairs = ["total", "blocked_external", "pending_real_execution", "monitor"]
            .filter((nestedKey) => typeof nested[nestedKey] !== "undefined")
            .map((nestedKey) => `${nestedKey}=${String(nested[nestedKey])}`);
          return nestedPairs.length > 0 ? `${key}(${nestedPairs.join(",")})` : `${key}=object`;
        }
        return `${key}=${String(value)}`;
      });
    if (pairs.length > 0) return pairs.join("; ");
  }

  if (step.id === "build") {
    return stdout.match(/built in ([\d.]+s)/i)?.[0] ?? "build concluido";
  }

  return "concluido";
}

function runStep(step: FinalStep): FinalStepResult {
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
    summary: summarize(step, parsed, stdout),
    parsed,
  };
}

function renderMarkdown(report: {
  generated_at: string;
  ok: boolean;
  steps: FinalStepResult[];
}) {
  const lines = [
    "# Fechamento Final - Central Admin Enterprise",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `OK: ${report.ok}`,
    "",
    "## Sequencia Executada",
    "",
    "| Fase | Resultado | Duracao | Resumo |",
    "| --- | --- | --- | --- |",
    ...report.steps.map((step) => `| ${step.label} | ${step.ok ? "ok" : "falhou"} | ${step.duration_ms}ms | ${step.summary.replace(/\|/g, "/")} |`),
    "",
    "## Veredito",
    "",
    report.ok
      ? "O escopo programavel da Central Admin Enterprise passou no fechamento final."
      : "Ha falha interna no fechamento final da Central Admin Enterprise.",
    "",
    "Producao aberta continua dependente de contador, gateway, frete real e evidencias operacionais reais.",
  ];
  return `${lines.join("\n")}\n`;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-final-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const results: FinalStepResult[] = [];

for (const step of steps) {
  console.log(`[admin-final] ${step.label}`);
  const result = runStep(step);
  results.push(result);
  console.log(`[admin-final] ${step.label}: ${result.ok ? "OK" : "FALHOU"} - ${result.summary}`);
  if (!result.ok) break;
}

const report = {
  generated_at: new Date().toISOString(),
  ok: results.every((step) => step.ok) && results.length === steps.length,
  steps: results,
  files: { json: jsonPath, markdown: mdPath },
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  executed_steps: results.length,
  failed_steps: results.filter((step) => !step.ok).map((step) => step.id),
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
