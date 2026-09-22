import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ContinuityValidation = {
  generated_at: string;
  ok: boolean;
  internal_ready: boolean;
  external_gates_expected_blocked: boolean;
  duration_ms: number;
  results: Array<{
    id: string;
    label: string;
    kind: "internal" | "external-gate";
    ok: boolean;
    expected_blocked: boolean;
    summary: string;
    parsed?: unknown;
  }>;
};

type AdminControlCenter = {
  ok: boolean;
  internal_management_ready: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  next_decision: string;
  summary: {
    total_actions: number;
    done: number;
    pending_real_execution: number;
    blocked_external: number;
    monitor: number;
  };
  evidence: {
    rows: number;
    completed_rows: number;
    pending_rows: number;
    completion_percent: number;
  };
  actions: Array<{
    label: string;
    status: string;
    priority: string;
    owner: string;
    route: string;
  }>;
  owners?: Array<{
    owner: string;
    total_actions: number;
    pending_real_execution: number;
    blocked_external: number;
    monitor: number;
    highest_priority: string;
    next_action_label: string;
    route: string;
  }>;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function getParsedRecord(result: ContinuityValidation["results"][number]) {
  if (!result.parsed || typeof result.parsed !== "object") return {};
  return result.parsed as Record<string, unknown>;
}

function getBlockers(result: ContinuityValidation["results"][number]) {
  const parsed = getParsedRecord(result);
  const blockers = parsed.blockers;
  if (typeof blockers === "number") return blockers;
  if (Array.isArray(blockers)) return blockers.length;
  const checks = parsed.checks;
  if (checks && typeof checks === "object" && "blockers" in checks) {
    const nested = (checks as { blockers?: unknown }).blockers;
    if (Array.isArray(nested)) return nested.length;
  }
  return 0;
}

function getWarnings(result: ContinuityValidation["results"][number]) {
  const parsed = getParsedRecord(result);
  const warnings = parsed.warnings;
  if (typeof warnings === "number") return warnings;
  if (Array.isArray(warnings)) return warnings.length;
  const checks = parsed.checks;
  if (checks && typeof checks === "object" && "warnings" in checks) {
    const nested = (checks as { warnings?: unknown }).warnings;
    if (Array.isArray(nested)) return nested.length;
  }
  return 0;
}

function extractExternalBlockers(validation: ContinuityValidation) {
  return validation.results
    .filter((result) => result.kind === "external-gate")
    .map((result) => ({
      id: result.id,
      label: result.label,
      expected_blocked: result.expected_blocked,
      blockers: getBlockers(result),
      warnings: getWarnings(result),
      summary: result.summary,
    }));
}

function renderMarkdown(payload: {
  generated_at: string;
  validation: ContinuityValidation;
  control_center: AdminControlCenter | null;
  external_blockers: ReturnType<typeof extractExternalBlockers>;
  key_files: string[];
  next_commands: string[];
}) {
  const lines: string[] = [];
  lines.push("# Handoff De Continuidade Do Ecommerce");
  lines.push("");
  lines.push(`Gerado em: ${payload.generated_at}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(`- Validacao de continuidade: **${payload.validation.ok ? "PASSOU" : "FALHOU"}**`);
  lines.push(`- Interno pronto: **${payload.validation.internal_ready ? "sim" : "nao"}**`);
  lines.push(`- Bloqueios externos preservados: **${payload.validation.external_gates_expected_blocked ? "sim" : "nao"}**`);
  lines.push(`- Tempo da validacao: ${Math.round(payload.validation.duration_ms / 1000)}s`);
  if (payload.control_center) {
    lines.push(`- Central de controle: **${payload.control_center.ok ? "PASSOU" : "REVISAR"}**`);
    lines.push(`- Acoes gerenciaveis: ${payload.control_center.summary.total_actions} total, ${payload.control_center.summary.pending_real_execution} execucao real, ${payload.control_center.summary.blocked_external} externas`);
  }
  lines.push("");
  lines.push("## Gates Externos");
  lines.push("");
  lines.push(row(["Gate", "Esperado", "Blockers", "Warnings", "Resumo"]));
  lines.push(row(["---", "---", "---:", "---:", "---"]));
  for (const blocker of payload.external_blockers) {
    lines.push(row([blocker.label, blocker.expected_blocked ? "sim" : "nao", blocker.blockers, blocker.warnings, blocker.summary]));
  }
  lines.push("");
  lines.push("## Central De Controle Admin");
  lines.push("");
  if (payload.control_center) {
    lines.push(`- Gestao interna pronta: **${payload.control_center.internal_management_ready ? "sim" : "nao"}**`);
    lines.push(`- Producao aberta: \`${payload.control_center.production_open}\``);
    lines.push(`- Decisao: \`${payload.control_center.next_decision}\``);
    lines.push(`- Evidencias: ${payload.control_center.evidence.completed_rows}/${payload.control_center.evidence.rows} PASS (${payload.control_center.evidence.completion_percent}%)`);
    lines.push("");
    if (payload.control_center.owners?.length) {
      lines.push(row(["Responsavel", "Acoes", "Execucao real", "Externos", "Prioridade", "Proxima acao"]));
      lines.push(row(["---", "---:", "---:", "---:", "---", "---"]));
      for (const owner of payload.control_center.owners) {
        lines.push(row([owner.owner, owner.total_actions, owner.pending_real_execution, owner.blocked_external, owner.highest_priority, owner.next_action_label]));
      }
      lines.push("");
    }
    lines.push(row(["Acao", "Status", "Prioridade", "Responsavel", "Rota"]));
    lines.push(row(["---", "---", "---", "---", "---"]));
    for (const action of payload.control_center.actions) {
      lines.push(row([action.label, action.status, action.priority, action.owner, action.route]));
    }
  } else {
    lines.push("Central de controle ainda nao gerada. Execute `npm run admin:control-center:check`.");
  }
  lines.push("");
  lines.push("## Arquivos-Chave");
  lines.push("");
  for (const file of payload.key_files) {
    lines.push(`- \`${file}\`${existsSync(file) ? "" : " (ausente)"}`);
  }
  lines.push("");
  lines.push("## Proximos Comandos");
  lines.push("");
  for (const command of payload.next_commands) {
    lines.push(`- \`${command}\``);
  }
  lines.push("");
  lines.push("## Diretriz");
  lines.push("");
  lines.push("Nao simular contador, token de pagamento ou frete real para liberar gate. A continuidade tecnica deve manter internos verdes e blockers externos explicitamente visiveis.");
  lines.push("");
  return lines.join("\n");
}

const validationPath = resolve(getArg("--validation") ?? "docs/reports/continuity-validation-latest.json");
const controlCenterPath = resolve(getArg("--control-center") ?? "docs/reports/admin-control-center-latest.json");
const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/continuity-handoff-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const validation = readJson<ContinuityValidation>(validationPath);
const controlCenter = readJson<AdminControlCenter>(controlCenterPath);

if (!validation) {
  console.error(`Validacao nao encontrada: ${validationPath}`);
  process.exit(1);
}

const payload = {
  generated_at: new Date().toISOString(),
  validation_source: validationPath,
  control_center_source: controlCenterPath,
  validation,
  control_center: controlCenter,
  external_blockers: extractExternalBlockers(validation),
  key_files: [
    "docs/reports/continuity-validation-latest.md",
    "docs/reports/admin-control-center-latest.md",
    "docs/reports/admin-control-center-latest.json",
    "docs/reports/final-continuity-checkpoint-latest.md",
    "docs/reports/homologation-scenarios-latest.md",
    "docs/reports/homologation-evidence-pack-latest.md",
    "docs/reports/homologation-evidence-pack-latest.csv",
    "docs/reports/homologation-evidence-validation-latest.md",
    "docs/reports/RELATORIO_IMPLEMENTACAO_PLANO_CONTINUIDADE_2026-05-26.md",
    "docs/reports/fiscal-close-pack-minimal.csv",
    "docs/reports/executive-status-latest.md",
    "docs/reports/roadmap-official-latest.md",
    "docs/training/REGISTRO_EVIDENCIAS_TREINAMENTO_OPERACAO_ASSISTIDA.md",
  ],
  next_commands: [
    "npm run validate:continuity",
    "npm run admin:control-center:check",
    "npm run continuity:checkpoint",
    "npm run homologation:scenarios",
    "npm run homologation:evidence:pack",
    "npm run homologation:evidence:validate",
    "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv",
    "npm run fiscal:check:minimal",
    "npm run phase2:check",
    "npm run release:check",
    "npm run go-live:check",
  ],
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderMarkdown(payload)}\n`, "utf8");

console.log(JSON.stringify({
  ok: validation.ok,
  jsonPath,
  mdPath,
  external_blockers: payload.external_blockers.length,
}, null, 2));

if (!validation.ok) {
  process.exitCode = 1;
}
