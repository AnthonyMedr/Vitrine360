import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ContinuityValidation = {
  generated_at: string;
  ok: boolean;
  internal_ready: boolean;
  external_gates_expected_blocked: boolean;
  results: Array<{ id: string; kind: "internal" | "external-gate"; ok: boolean; expected_blocked: boolean; summary: string }>;
};

type AdminControlCenter = {
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  internal_management_ready: boolean;
  continuity: { generated_at: string | null; ok: boolean; internal_ready: boolean; external_gates_expected_blocked: boolean };
  summary: { total_actions: number; pending_real_execution: number; blocked_external: number };
  evidence: { rows: number; pending_rows: number; real_execution_required: boolean };
  training: { training_executed: false; real_execution_pending: number };
  owners: Array<{ owner: string; highest_priority: string; route: string }>;
};

type Checkpoint = {
  ok: boolean;
  validation_ok: boolean;
  checks_ok?: boolean;
  checks?: Array<{ ok: boolean }>;
};

type Handoff = {
  validation: { ok: boolean; internal_ready: boolean; external_gates_expected_blocked: boolean };
  control_center: AdminControlCenter | null;
  external_blockers: unknown[];
};

type EvidenceValidation = {
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  rows: number;
  pending_rows: number;
  completed_rows: number;
  issues: unknown[];
};

type CompletionCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

function readJson<T>(filePath: string): T | null {
  const absolute = resolve(filePath);
  if (!existsSync(absolute)) return null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const content = readFileSync(absolute, "utf8").trim();
      if (!content) throw new Error(`Arquivo JSON vazio: ${filePath}`);
      return JSON.parse(content) as T;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw lastError;
}

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function check(id: string, label: string, ok: boolean, detail: string): CompletionCheck {
  return { id, label, ok, detail };
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(report: {
  generated_at: string;
  ok: boolean;
  programmable_scope_complete: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  checks: CompletionCheck[];
}) {
  const lines: string[] = [];
  lines.push("# Fechamento Programavel Do Ecommerce");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status: **${report.ok ? "PASSOU" : "REVISAR"}**`);
  lines.push(`- Escopo programavel completo: **${report.programmable_scope_complete ? "sim" : "nao"}**`);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push(row(["Check", "Resultado", "Detalhe"]));
  lines.push(row(["---", "---", "---"]));
  for (const item of report.checks) {
    lines.push(row([item.label, item.ok ? "ok" : "falhou", item.detail]));
  }
  lines.push("");
  lines.push("## Diretriz");
  lines.push("");
  lines.push("- Este fechamento cobre somente codigo, validacoes, relatorios, Admin, Dashboard e handoff.");
  lines.push("- Fiscal, pagamento, frete e execucao real de evidencias continuam dependencias externas.");
  lines.push("- Nao usar este relatorio para abrir producao enquanto `production_open` estiver `BLOQUEADO_EXTERNO`.");
  lines.push("");
  return lines.join("\n");
}

const validation = readJson<ContinuityValidation>("docs/reports/continuity-validation-latest.json");
const control = readJson<AdminControlCenter>("docs/reports/admin-control-center-latest.json");
const checkpoint = readJson<Checkpoint>("docs/reports/final-continuity-checkpoint-latest.json");
const handoff = readJson<Handoff>("docs/reports/continuity-handoff-latest.json");
const evidence = readJson<EvidenceValidation>("docs/reports/homologation-evidence-validation-latest.json");

const checks: CompletionCheck[] = [
  check("validation", "Validacao de continuidade", Boolean(validation?.ok && validation.internal_ready && validation.external_gates_expected_blocked), validation ? `${validation.results.length} etapa(s)` : "arquivo ausente"),
  check("test-suite", "Suite automatizada", Boolean(validation?.results.some((item) => item.id === "test" && item.ok && item.summary.includes("fail=0"))), validation?.results.find((item) => item.id === "test")?.summary ?? "sem resumo"),
  check("control-center", "Central de Controle", Boolean(control?.ok && control.internal_management_ready && control.production_open === "BLOQUEADO_EXTERNO"), control ? `${control.summary.total_actions} acao(oes), ${control.owners.length} responsavel(is)` : "arquivo ausente"),
  check("control-freshness", "Central alinhada a validacao", Boolean(control?.continuity.generated_at && validation?.generated_at && control.continuity.generated_at === validation.generated_at), `central=${control?.continuity.generated_at ?? "?"}; validation=${validation?.generated_at ?? "?"}`),
  check("owners", "Matriz por responsavel", Boolean(control?.owners.some((owner) => owner.owner === "Contador") && control.owners.some((owner) => owner.owner === "DevOps / Providers")), control ? control.owners.map((owner) => owner.owner).join(", ") : "arquivo ausente"),
  check("evidence", "Evidencias estruturais", Boolean(evidence?.ok && evidence.production_open === "BLOQUEADO_EXTERNO" && evidence.rows === 21 && evidence.issues.length === 0), evidence ? `${evidence.completed_rows}/${evidence.rows} PASS; ${evidence.pending_rows} pendente(s)` : "arquivo ausente"),
  check(
    "checkpoint",
    "Checkpoint final",
    Boolean(checkpoint?.ok && checkpoint.validation_ok && (checkpoint.checks_ok ?? checkpoint.checks?.every((item) => item.ok))),
    checkpoint ? `validation_ok=${checkpoint.validation_ok}; checks_ok=${checkpoint.checks_ok ?? checkpoint.checks?.every((item) => item.ok)}` : "arquivo ausente",
  ),
  check("handoff", "Handoff com Central", Boolean(handoff?.validation.ok && handoff.control_center?.ok && handoff.external_blockers.length >= 5), handoff ? `${handoff.external_blockers.length} gate(s) externo(s)` : "arquivo ausente"),
];

const ok = checks.every((item) => item.ok);
const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/programmatic-completion-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const report = {
  generated_at: new Date().toISOString(),
  ok,
  programmable_scope_complete: ok,
  production_open: "BLOQUEADO_EXTERNO" as const,
  checks,
  files: { json: jsonPath, markdown: mdPath },
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  programmable_scope_complete: report.programmable_scope_complete,
  production_open: report.production_open,
  failed_checks: checks.filter((item) => !item.ok).map((item) => item.id),
  jsonPath,
  mdPath,
}, null, 2));

if (!ok) process.exit(1);
