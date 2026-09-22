import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAssistedTrainingPlan } from "./admin-training-assistant";
import { getAdminHomologationEvidenceStatus } from "./admin-homologation-evidence";

type ContinuityValidationStep = {
  id?: string;
  name?: string;
  label?: string;
  title?: string;
  kind?: string;
  type?: string;
  result?: string;
  ok?: boolean;
  summary?: string;
};

type ContinuityValidation = {
  ok?: boolean;
  internal_ready?: boolean;
  external_gates_expected_blocked?: boolean;
  generated_at?: string;
  steps?: ContinuityValidationStep[];
  results?: ContinuityValidationStep[];
};

export type AdminControlCenterAction = {
  id: string;
  label: string;
  owner: string;
  status: "done" | "pending_real_execution" | "blocked_external" | "monitor";
  priority: "critical" | "high" | "medium" | "low";
  route: string;
  evidence: string;
  note: string;
};

export type AdminControlCenterOwner = {
  owner: string;
  total_actions: number;
  pending_real_execution: number;
  blocked_external: number;
  monitor: number;
  done: number;
  highest_priority: AdminControlCenterAction["priority"];
  next_action_label: string;
  route: string;
};

export type AdminControlCenter = {
  generated_at: string;
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  internal_management_ready: boolean;
  continuity: {
    source_exists: boolean;
    ok: boolean;
    internal_ready: boolean;
    external_gates_expected_blocked: boolean;
    generated_at: string | null;
    failed_internal_steps: string[];
  };
  evidence: {
    ok: boolean;
    rows: number;
    completed_rows: number;
    pending_rows: number;
    failed_rows: number;
    completion_percent: number;
    real_execution_required: boolean;
  };
  training: {
    ok: boolean;
    steps_total: number;
    real_execution_pending: number;
    training_executed: false;
  };
  summary: {
    total_actions: number;
    done: number;
    pending_real_execution: number;
    blocked_external: number;
    monitor: number;
  };
  actions: AdminControlCenterAction[];
  owners: AdminControlCenterOwner[];
  next_decision: string;
};

export function buildAdminControlCenter(
  continuityPath = "docs/reports/continuity-validation-latest.json",
): AdminControlCenter {
  const generatedAt = new Date().toISOString();
  const continuity = readContinuityValidation(continuityPath);
  const evidence = getAdminHomologationEvidenceStatus();
  const training = buildAssistedTrainingPlan();
  const validationSteps = continuity.data.steps ?? continuity.data.results ?? [];
  const failedInternalSteps = validationSteps
    .filter((step) => (step.type ?? step.kind) === "internal" && (step.ok === false || (step.result && step.result !== "ok")))
    .map((step) => step.label ?? step.name ?? step.title ?? step.id ?? "etapa interna");

  const actions: AdminControlCenterAction[] = [
    {
      id: "continuity-validation",
      label: "Manter validacao de continuidade verde",
      owner: "Tech Lead",
      status: continuity.data.ok && failedInternalSteps.length === 0 ? "done" : "monitor",
      priority: continuity.data.ok ? "medium" : "critical",
      route: "/admin/governanca",
      evidence: "docs/reports/continuity-validation-latest.md",
      note: continuity.exists ? "Validacao automatizada disponivel para consulta." : "Gerar com npm run validate:continuity.",
    },
    {
      id: "homologation-evidence",
      label: "Executar evidencias de homologacao com equipe real",
      owner: "Operacao / QA",
      status: evidence.real_execution_required ? "pending_real_execution" : "done",
      priority: evidence.real_execution_required ? "high" : "low",
      route: "/admin/governanca",
      evidence: "docs/reports/homologation-evidence-pack-latest.csv",
      note: `${evidence.completed_rows} de ${evidence.rows} evidencia(s) com PASS.`,
    },
    {
      id: "assisted-training",
      label: "Executar treinamento assistido por cargo",
      owner: "Admin Master / Gestao",
      status: training.real_execution_pending > 0 ? "pending_real_execution" : "done",
      priority: training.real_execution_pending > 0 ? "high" : "low",
      route: "/admin/governanca",
      evidence: "prints, responsaveis, datas e observacoes por participante",
      note: `${training.real_execution_pending} etapa(s) aguardam execucao real.`,
    },
    {
      id: "fiscal-provider",
      label: "Validar fiscal minimo com contador",
      owner: "Contador",
      status: "blocked_external",
      priority: "critical",
      route: "/admin/fiscal-financeiro",
      evidence: "close pack fiscal aprovado pelo contador",
      note: "Nao inferir NCM, tax_code ou decisao fiscal sem responsavel externo.",
    },
    {
      id: "payment-freight-providers",
      label: "Configurar pagamento, webhook e frete reais",
      owner: "DevOps / Providers",
      status: "blocked_external",
      priority: "critical",
      route: "/admin/integracoes",
      evidence: "credenciais reais, teste de webhook e provider de frete homologado",
      note: "Nao promover provider fake ou manual como liberacao produtiva.",
    },
    {
      id: "daily-executive-routine",
      label: "Rodar rotina executiva diaria",
      owner: "Direcao / Gestao",
      status: "monitor",
      priority: "medium",
      route: "/admin",
      evidence: "ata diaria e centro de acoes revisados",
      note: "Usar dashboard executivo para priorizar gargalo, SLA e decisao de corte.",
    },
  ];

  const summary = actions.reduce(
    (acc, action) => {
      acc.total_actions += 1;
      acc[action.status] += 1;
      return acc;
    },
    { total_actions: 0, done: 0, pending_real_execution: 0, blocked_external: 0, monitor: 0 },
  );

  const internalManagementReady = Boolean(
    continuity.data.ok &&
      continuity.data.internal_ready &&
      evidence.ok &&
      training.ok &&
      failedInternalSteps.length === 0,
  );

  return {
    generated_at: generatedAt,
    ok: internalManagementReady,
    production_open: "BLOQUEADO_EXTERNO",
    internal_management_ready: internalManagementReady,
    continuity: {
      source_exists: continuity.exists,
      ok: Boolean(continuity.data.ok),
      internal_ready: Boolean(continuity.data.internal_ready),
      external_gates_expected_blocked: Boolean(continuity.data.external_gates_expected_blocked),
      generated_at: continuity.data.generated_at ?? null,
      failed_internal_steps: failedInternalSteps,
    },
    evidence: {
      ok: evidence.ok,
      rows: evidence.rows,
      completed_rows: evidence.completed_rows,
      pending_rows: evidence.pending_rows,
      failed_rows: evidence.failed_rows,
      completion_percent: evidence.completion_percent,
      real_execution_required: evidence.real_execution_required,
    },
    training: {
      ok: training.ok,
      steps_total: training.steps_total,
      real_execution_pending: training.real_execution_pending,
      training_executed: training.training_executed,
    },
    summary,
    actions,
    owners: buildOwnerSummary(actions),
    next_decision: internalManagementReady
      ? "GESTAO_INTERNA_PRONTA_COM_PRODUCAO_BLOQUEADA_EXTERNAMENTE"
      : "CORRIGIR_CONTROLE_INTERNO_ANTES_DE_DECISAO",
  };
}

function buildOwnerSummary(actions: AdminControlCenterAction[]): AdminControlCenterOwner[] {
  const owners = new Map<string, AdminControlCenterOwner>();
  for (const action of actions) {
    const current = owners.get(action.owner) ?? {
      owner: action.owner,
      total_actions: 0,
      pending_real_execution: 0,
      blocked_external: 0,
      monitor: 0,
      done: 0,
      highest_priority: "low" as const,
      next_action_label: action.label,
      route: action.route,
    };
    current.total_actions += 1;
    current[action.status] += 1;
    if (priorityRank(action.priority) > priorityRank(current.highest_priority)) {
      current.highest_priority = action.priority;
      current.next_action_label = action.label;
      current.route = action.route;
    }
    owners.set(action.owner, current);
  }
  return [...owners.values()].sort((a, b) => {
    const priority = priorityRank(b.highest_priority) - priorityRank(a.highest_priority);
    if (priority !== 0) return priority;
    return b.total_actions - a.total_actions;
  });
}

function priorityRank(priority: AdminControlCenterAction["priority"]) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function readContinuityValidation(filePath: string): { exists: boolean; data: ContinuityValidation } {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) return { exists: false, data: {} };

  try {
    const data = JSON.parse(readFileSync(absolutePath, "utf8")) as ContinuityValidation;
    return { exists: true, data };
  } catch {
    return { exists: true, data: { ok: false, internal_ready: false, external_gates_expected_blocked: false } };
  }
}

export function renderAdminControlCenterMarkdown(report: AdminControlCenter) {
  const lines: string[] = [];
  lines.push("# Central De Controle Administrativo");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status: **${report.ok ? "PASSOU" : "REVISAR"}**`);
  lines.push(`- Gestao interna pronta: **${report.internal_management_ready ? "sim" : "nao"}**`);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- Decisao: \`${report.next_decision}\``);
  lines.push("");
  lines.push("## Indicadores");
  lines.push("");
  lines.push(row(["Indicador", "Valor"]));
  lines.push(row(["---", "---:"]));
  lines.push(row(["Acoes totais", report.summary.total_actions]));
  lines.push(row(["Concluidas", report.summary.done]));
  lines.push(row(["Pendentes de execucao real", report.summary.pending_real_execution]));
  lines.push(row(["Bloqueios externos", report.summary.blocked_external]));
  lines.push(row(["Monitoramento", report.summary.monitor]));
  lines.push(row(["Evidencias PASS", report.evidence.completed_rows]));
  lines.push(row(["Evidencias pendentes", report.evidence.pending_rows]));
  lines.push(row(["Conclusao das evidencias", `${report.evidence.completion_percent}%`]));
  lines.push(row(["Treinamento executado", report.training.training_executed ? "sim" : "nao"]));
  lines.push(row(["Etapas de treinamento pendentes", report.training.real_execution_pending]));
  lines.push("");
  lines.push("## Responsaveis");
  lines.push("");
  lines.push(row(["Responsavel", "Acoes", "Execucao real", "Externos", "Monitor", "Prioridade", "Proxima acao", "Rota"]));
  lines.push(row(["---", "---:", "---:", "---:", "---:", "---", "---", "---"]));
  for (const owner of report.owners) {
    lines.push(row([owner.owner, owner.total_actions, owner.pending_real_execution, owner.blocked_external, owner.monitor, owner.highest_priority, owner.next_action_label, owner.route]));
  }
  lines.push("");
  lines.push("## Fila Gerenciavel");
  lines.push("");
  lines.push(row(["Acao", "Status", "Prioridade", "Responsavel", "Rota", "Evidencia"]));
  lines.push(row(["---", "---", "---", "---", "---", "---"]));
  for (const action of report.actions) {
    lines.push(row([action.label, action.status, action.priority, action.owner, action.route, action.evidence]));
  }
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  lines.push("- Nao abrir producao enquanto `production_open` permanecer `BLOQUEADO_EXTERNO`.");
  lines.push("- Nao marcar treinamento como concluido sem participantes e evidencias reais.");
  lines.push("- Nao converter evidencia pendente em `PASS` sem responsavel, data, caminho de evidencia e observacao.");
  lines.push("- Nao promover provider fake/manual como pagamento ou frete produtivo.");
  lines.push("");
  return lines.join("\n");
}

export function renderAdminControlCenterCsv(report: AdminControlCenter) {
  const header = ["id", "label", "status", "priority", "owner", "route", "evidence", "note"];
  const rows = report.actions.map((action) => [
    action.id,
    action.label,
    action.status,
    action.priority,
    action.owner,
    action.route,
    action.evidence,
    action.note,
  ]);
  return [header, ...rows].map((values) => values.map(csvCell).join(",")).join("\n");
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
