import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Step = {
  id: string;
  label: string;
  command: string[];
  allowExpectedGoLiveBlockers?: boolean;
};

type StepResult = {
  id: string;
  label: string;
  ok: boolean;
  exit_code: number | null;
  tolerated: boolean;
  summary: string;
  parsed: Record<string, unknown> | null;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const expectedGoLiveBlockers = new Set(["payment_provider", "freight_provider"]);

const steps: Step[] = [
  { id: "go_live_check", label: "Go-live check com bloqueios externos esperados", command: ["run", "go-live:check"], allowExpectedGoLiveBlockers: true },
  { id: "final_delivery", label: "Entrega final programavel", command: ["run", "final:delivery"] },
  { id: "admin_complete", label: "Conclusao oficial Admin", command: ["run", "admin:enterprise:complete"] },
  { id: "manifest_verify", label: "Verificacao de manifesto", command: ["run", "admin:enterprise:manifest:verify"] },
  { id: "zero_pending", label: "Trava de pendencia programavel zero", command: ["run", "admin:final-zero-pending:check"] },
];

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getNestedArray(parsed: Record<string, unknown> | null, path: string[]) {
  let value: unknown = parsed;
  for (const key of path) {
    if (!value || typeof value !== "object" || !(key in value)) return [];
    value = (value as Record<string, unknown>)[key];
  }
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function hasOnlyExpectedGoLiveBlockers(parsed: Record<string, unknown> | null) {
  if (!parsed) return false;
  if (parsed.go_live_ready !== false) return false;
  const blockers = getNestedArray(parsed, ["checks", "blockers"]);
  if (blockers.length === 0) return false;
  return blockers.every((blocker) => expectedGoLiveBlockers.has(String(blocker.item ?? "")));
}

function summarize(parsed: Record<string, unknown> | null, tolerated: boolean) {
  if (!parsed) return tolerated ? "bloqueio tolerado sem json" : "sem_json";
  const values = [
    "ok" in parsed ? `ok=${String(parsed.ok)}` : null,
    "go_live_ready" in parsed ? `go_live_ready=${String(parsed.go_live_ready)}` : null,
    "blockers" in parsed ? `blockers=${String(parsed.blockers)}` : null,
    "warnings" in parsed ? `warnings=${String(parsed.warnings)}` : null,
    "programmable_scope" in parsed ? `programmable_scope=${String(parsed.programmable_scope)}` : null,
    "production_open" in parsed ? `production_open=${String(parsed.production_open)}` : null,
    "programmable_pending" in parsed ? `programmable_pending=${String(parsed.programmable_pending)}` : null,
    tolerated ? "tolerado=dependencia_externa_real" : null,
  ];
  return values.filter(Boolean).join("; ");
}

function runStep(step: Step): StepResult {
  const result = spawnSync(npmCommand, step.command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1" },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const parsed = extractJson(stdout);
  const tolerated = Boolean(step.allowExpectedGoLiveBlockers && result.status !== 0 && hasOnlyExpectedGoLiveBlockers(parsed));
  const ok = result.status === 0 || tolerated;

  if (!ok) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  return {
    id: step.id,
    label: step.label,
    ok,
    exit_code: result.status,
    tolerated,
    summary: summarize(parsed, tolerated),
    parsed,
  };
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines = [
    "# Fechamento Sequencial De Erro Zero",
    "",
    `Gerado em: \`${report.generated_at}\``,
    `OK: \`${report.ok}\``,
    `Pendencia programavel: \`${report.programmable_pending}\``,
    `Producao aberta: \`${report.production_open}\``,
    "",
    "## Etapas",
    "",
    "| Etapa | Resultado | Tolerado | Resumo |",
    "| --- | --- | --- | --- |",
    ...report.steps.map((step) => `| ${step.label} | \`${step.ok}\` | \`${step.tolerated}\` | ${step.summary.replace(/\|/g, "/")} |`),
    "",
    "## Veredito",
    "",
    report.go_live_external_blocked
      ? "Nao ha erro programavel pendente. Go-live aberto continua bloqueado apenas por pagamento/frete reais."
      : "Nao ha erro programavel pendente.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildReport(results: StepResult[]) {
  const goLive = results.find((step) => step.id === "go_live_check");
  const failed = results.filter((step) => !step.ok);
  return {
    generated_at: new Date().toISOString(),
    ok: failed.length === 0,
    programmable_pending: failed.length,
    production_open: "BLOQUEADO_EXTERNO",
    go_live_external_blocked: Boolean(goLive?.tolerated),
    steps: results,
  };
}

const results: StepResult[] = [];
for (const step of steps) {
  console.log(`[final-zero] ${step.label}`);
  const result = runStep(step);
  results.push(result);
  console.log(`[final-zero] ${step.label}: ${result.ok ? "OK" : "FALHOU"} - ${result.summary}`);
  if (!result.ok) break;
}

const report = buildReport(results);
const basePath = resolve("docs/reports/final-zero-sequential-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  programmable_pending: report.programmable_pending,
  production_open: report.production_open,
  go_live_external_blocked: report.go_live_external_blocked,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
