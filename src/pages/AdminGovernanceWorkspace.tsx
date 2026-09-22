import { Link, Navigate } from "react-router-dom";
import { RefreshCw, UsersRound } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEmptyState, AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type PermissionProfile = { id: string; name: string; slug: string; level: number; isSystem: boolean; isActive: boolean; permissions: string[] };
type AuditLog = { event_id: string; event_type?: string; actor_name?: string | null; occurred_at: string; payload?: { entity?: string } | null };
type Integration = { key: string; name: string; category: string; status: string; is_configured: boolean; is_required_for_production: boolean; last_status_message?: string | null };
type AssistedTrainingPlan = {
  training_operation_ready: "PLANEJADO";
  training_executed: false;
  steps_total: number;
  real_execution_pending: number;
  steps: Array<{
    id: string;
    title: string;
    role: string;
    status: "ready" | "requires_real_execution" | "external_blocked";
    objective: string;
    admin_route: string;
    expected_evidence: string[];
    blocker: string | null;
  }>;
};
type HomologationEvidenceStatus = {
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  source_exists: boolean;
  rows: number;
  completed_rows: number;
  pending_rows: number;
  blocked_external_rows: number;
  failed_rows: number;
  completion_percent: number;
  internal_ready: boolean;
  real_execution_required: boolean;
  issues: Array<{ row: number; scenario_id: string; field: string; message: string }>;
};
type SystemStatus = {
  ok: boolean;
  env?: string;
  summary: { blockers: number; warnings: number };
  providers?: Record<string, { provider?: string; ready?: boolean; configured?: boolean; missing?: string[]; mode?: string }>;
  runtime?: { database?: { provider?: string }; queues?: Record<string, unknown> };
  readiness?: Record<string, unknown>;
};
type ControlCenterAction = {
  id: string;
  label: string;
  owner: string;
  status: "done" | "pending_real_execution" | "blocked_external" | "monitor";
  priority: "critical" | "high" | "medium" | "low";
  route: string;
  evidence: string;
  note: string;
};
type ControlCenter = {
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  internal_management_ready: boolean;
  next_decision: string;
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
  actions: ControlCenterAction[];
  owners: Array<{
    owner: string;
    total_actions: number;
    pending_real_execution: number;
    blocked_external: number;
    monitor: number;
    done: number;
    highest_priority: "critical" | "high" | "medium" | "low";
    next_action_label: string;
    route: string;
  }>;
};
type ProgrammaticCompletion = {
  generated_at: string;
  ok: boolean;
  programmable_scope_complete: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  source_exists: boolean;
  failed_checks: string[];
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
};

export default function AdminGovernanceWorkspace() {
  const { isAdmin, loading } = useAdmin();
  const permissions = useAdminResource<PermissionProfile[]>(isAdmin ? "/api/admin/permissions/overview" : null, []);
  const audit = useAdminResource<AuditLog[]>(isAdmin ? "/api/admin/audit-logs?limit=12" : null, []);
  const integrations = useAdminResource<Integration[]>(isAdmin ? "/api/admin/integrations" : null, []);
  const system = useAdminResource<SystemStatus>(isAdmin ? "/api/admin/system-status" : null, { ok: false, summary: { blockers: 0, warnings: 0 } });
  const controlCenter = useAdminResource<ControlCenter>(isAdmin ? "/api/admin/governance/control-center" : null, {
    ok: false,
    production_open: "BLOQUEADO_EXTERNO",
    internal_management_ready: false,
    next_decision: "CARREGANDO",
    continuity: { source_exists: false, ok: false, internal_ready: false, external_gates_expected_blocked: false, generated_at: null, failed_internal_steps: [] },
    evidence: { ok: false, rows: 0, completed_rows: 0, pending_rows: 0, failed_rows: 0, completion_percent: 0, real_execution_required: true },
    training: { ok: false, steps_total: 0, real_execution_pending: 0, training_executed: false },
    summary: { total_actions: 0, done: 0, pending_real_execution: 0, blocked_external: 0, monitor: 0 },
    actions: [],
    owners: [],
  });
  const programmaticCompletion = useAdminResource<ProgrammaticCompletion>(isAdmin ? "/api/admin/governance/programmatic-completion" : null, {
    generated_at: "",
    ok: false,
    programmable_scope_complete: false,
    production_open: "BLOQUEADO_EXTERNO",
    source_exists: false,
    failed_checks: [],
    checks: [],
  });
  const training = useAdminResource<AssistedTrainingPlan>(isAdmin ? "/api/admin/training/assisted-plan" : null, {
    training_operation_ready: "PLANEJADO",
    training_executed: false,
    steps_total: 0,
    real_execution_pending: 0,
    steps: [],
  });
  const evidence = useAdminResource<HomologationEvidenceStatus>(isAdmin ? "/api/admin/homologation/evidence-status" : null, {
    ok: false,
    production_open: "BLOQUEADO_EXTERNO",
    source_exists: false,
    rows: 0,
    completed_rows: 0,
    pending_rows: 0,
    blocked_external_rows: 0,
    failed_rows: 0,
    completion_percent: 0,
    internal_ready: false,
    real_execution_required: true,
    issues: [],
  });

  if (loading) return <AdminLoadingState label="Carregando governanca..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const inactiveRoles = permissions.data.filter((profile) => !profile.isActive);
  const requiredUnconfigured = integrations.data.filter((item) => item.is_required_for_production && !item.is_configured);
  const configuredIntegrations = integrations.data.filter((item) => item.is_configured);
  const gateRows = buildGateRows(system.data);

  const reloadAll = () => {
    void permissions.reload();
    void audit.reload();
    void integrations.reload();
    void system.reload();
    void controlCenter.reload();
    void programmaticCompletion.reload();
    void training.reload();
    void evidence.reload();
  };

  return (
    <AdminWorkspaceShell
      eyebrow="Segurança e governanca"
      title="Permissoes, auditoria e integrações"
      description="Workspace para Admin Master controlar RBAC, logs, providers, secrets mascarados, readiness e riscos de ambiente."
      actions={<><Button asChild variant="outline"><a href="/api/admin/governance/control-center/export?format=md" target="_blank" rel="noreferrer">Relatorio</a></Button><Button asChild variant="outline"><a href="/api/admin/governance/programmatic-completion/export?format=md" target="_blank" rel="noreferrer">Fechamento</a></Button><Button asChild variant="outline"><a href="/api/admin/governance/control-center/export?format=csv" target="_blank" rel="noreferrer">CSV</a></Button><Button variant="outline" onClick={reloadAll}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button asChild variant="outline"><Link to="/admin/usuarios"><UsersRound className="mr-2 h-4 w-4" />Usuarios e perfis</Link></Button><Button asChild><Link to="/admin/audit-logs">Auditoria</Link></Button></>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Perfis RBAC" value={permissions.data.length} detail={`${inactiveRoles.length} inativos`} />
          <WorkspaceMetric label="Integrações configuradas" value={configuredIntegrations.length} detail={`${requiredUnconfigured.length} obrigatorias pendentes`} tone={requiredUnconfigured.length > 0 ? "danger" : "ok"} />
          <WorkspaceMetric label="Blockers sistema" value={system.data.summary.blockers} tone={system.data.summary.blockers > 0 ? "danger" : "ok"} />
          <WorkspaceMetric label="Warnings sistema" value={system.data.summary.warnings} tone={system.data.summary.warnings > 0 ? "warn" : "ok"} />
        </div>

        <WorkspaceSection title="Central de controle">
          <AdminOperationalToolbar
            title="Comando gerenciavel de continuidade"
            description="Consolida validação, evidencias, treinamento e bloqueios reais em uma fila unica de decisao."
            resultLabel={controlCenter.data.next_decision.replace(/_/g, " ")}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetric
              label="Gestao interna"
              value={controlCenter.data.internal_management_ready ? "Pronta" : "Revisar"}
              tone={controlCenter.data.internal_management_ready ? "ok" : "danger"}
            />
            <WorkspaceMetric
              label="Produção aberta"
              value={controlCenter.data.production_open}
              detail="bloqueio externo preservado"
              tone="warn"
            />
            <WorkspaceMetric
              label="Acoes pendentes"
              value={controlCenter.data.summary.pending_real_execution}
              detail={`${controlCenter.data.summary.blocked_external} externas`}
              tone={controlCenter.data.summary.pending_real_execution > 0 ? "warn" : "ok"}
            />
            <WorkspaceMetric
              label="Evidencias"
              value={`${controlCenter.data.evidence.completion_percent}%`}
              detail={`${controlCenter.data.evidence.completed_rows}/${controlCenter.data.evidence.rows} PASS`}
              tone={controlCenter.data.evidence.completion_percent === 100 ? "ok" : "warn"}
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {controlCenter.data.owners.map((owner) => (
              <AdminQueueCard
                key={owner.owner}
                title={owner.owner}
                description={owner.next_action_label}
                tone={owner.blocked_external > 0 ? "danger" : owner.pending_real_execution > 0 ? "warn" : "neutral"}
                eyebrow={<><Badge variant={owner.highest_priority === "critical" ? "destructive" : owner.highest_priority === "high" ? "outline" : "secondary"}>{owner.highest_priority}</Badge><Badge variant="secondary">{owner.total_actions} acao(oes)</Badge></>}
                meta={<span>{owner.pending_real_execution} execucao real, {owner.blocked_external} externo(s), {owner.monitor} monitoramento</span>}
                action={<Button asChild size="sm" variant="outline"><Link to={owner.route}>Abrir</Link></Button>}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {controlCenter.data.actions.map((action) => (
              <AdminQueueCard
                key={action.id}
                title={action.label}
                description={action.note}
                tone={controlActionTone(action.status)}
                eyebrow={<><Badge variant={controlStatusBadge(action.status)}>{formatControlStatus(action.status)}</Badge><Badge variant="secondary">{action.owner}</Badge><Badge variant={action.priority === "critical" ? "destructive" : action.priority === "high" ? "outline" : "secondary"}>{action.priority}</Badge></>}
                meta={<span>{action.evidence}</span>}
                action={<Button asChild size="sm" variant="outline"><Link to={action.route}>Abrir</Link></Button>}
              />
            ))}
            {controlCenter.data.actions.length === 0 ? (
              <AdminEmptyState title="Central de controle ainda não carregada." description="Atualize o workspace ou valide o endpoint de governanca." />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Fechamento programavel">
          <AdminOperationalToolbar
            title="Veredito técnico final"
            description="Mostra se tudo que depende de programacao, validação, relatório, Admin e handoff esta fechado sem liberar produção."
            resultLabel={programmaticCompletion.data.programmable_scope_complete ? "ESCOPO PROGRAMAVEL COMPLETO" : "REVISAR FECHAMENTO"}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetric
              label="Escopo programavel"
              value={programmaticCompletion.data.programmable_scope_complete ? "Completo" : "Revisar"}
              tone={programmaticCompletion.data.programmable_scope_complete ? "ok" : "danger"}
            />
            <WorkspaceMetric
              label="Checks falhos"
              value={programmaticCompletion.data.failed_checks.length}
              detail={`${programmaticCompletion.data.checks.length} check(s) monitorados`}
              tone={programmaticCompletion.data.failed_checks.length > 0 ? "danger" : "ok"}
            />
            <WorkspaceMetric
              label="Relatório"
              value={programmaticCompletion.data.source_exists ? "Encontrado" : "Ausente"}
              detail={programmaticCompletion.data.generated_at || "sem geracao"}
              tone={programmaticCompletion.data.source_exists ? "ok" : "warn"}
            />
            <WorkspaceMetric
              label="Produção aberta"
              value={programmaticCompletion.data.production_open}
              detail="gate externo preservado"
              tone="warn"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {programmaticCompletion.data.checks.map((item) => (
              <AdminQueueCard
                key={item.id}
                title={item.label}
                description={item.detail}
                tone={item.ok ? "ok" : "danger"}
                eyebrow={<Badge variant={item.ok ? "default" : "destructive"}>{item.ok ? "ok" : "falhou"}</Badge>}
                action={<Button asChild size="sm" variant="outline"><a href="/api/admin/governance/programmatic-completion/export?format=md" target="_blank" rel="noreferrer">Abrir</a></Button>}
              />
            ))}
            {programmaticCompletion.data.checks.length === 0 ? (
              <AdminEmptyState title="Fechamento programavel ainda não carregado." description="Execute npm run completion:programmable:check e atualize o workspace." />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Matriz de gates">
          <AdminOperationalToolbar
            title="Continuidades internas e bloqueios externos"
            description="Separe o que a equipe técnica pode manter verde do que depende de contador, credencial ou provider real."
            resultLabel={`${gateRows.filter((gate) => gate.ready).length} de ${gateRows.length} gate(s) prontos`}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gateRows.map((gate) => (
              <AdminQueueCard
                key={gate.key}
                title={gate.label}
                description={gate.detail}
                tone={gate.tone}
                eyebrow={<><Badge variant={gate.ready ? "default" : gate.external ? "outline" : "destructive"}>{gate.status}</Badge><Badge variant="secondary">{gate.owner}</Badge></>}
                meta={<span>{gate.blockers} blocker(s), {gate.warnings} warning(s)</span>}
              />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Evidencias de homologacao">
          <AdminOperationalToolbar
            title="Controle do CSV de evidencias"
            description="Mostra a validação estrutural das evidencias sem transformar pendencia manual em aprovacao."
            resultLabel={`${evidence.data.completed_rows} de ${evidence.data.rows} evidencia(s) com PASS`}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetric label="Evidencias PASS" value={evidence.data.completed_rows} tone={evidence.data.completed_rows > 0 ? "ok" : "neutral"} />
            <WorkspaceMetric label="Pendentes" value={evidence.data.pending_rows} tone={evidence.data.pending_rows > 0 ? "warn" : "ok"} />
            <WorkspaceMetric label="Falhas" value={evidence.data.failed_rows} tone={evidence.data.failed_rows > 0 ? "danger" : "ok"} />
            <WorkspaceMetric label="Conclusao" value={`${evidence.data.completion_percent}%`} tone={evidence.data.completion_percent === 100 ? "ok" : "warn"} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <AdminQueueCard
              title="Validador de evidencias"
              description={evidence.data.ok ? "CSV estruturalmente valido. Evidencias reais ainda precisam ser executadas quando estiverem pendentes." : "CSV ausente ou com problemas estruturais."}
              tone={evidence.data.ok ? "ok" : "danger"}
              eyebrow={<><Badge variant={evidence.data.ok ? "default" : "destructive"}>{evidence.data.ok ? "valido" : "revisar"}</Badge><Badge variant="outline">{evidence.data.production_open}</Badge></>}
              meta={<span>{evidence.data.issues.length} problema(s) estrutural(is), arquivo {evidence.data.source_exists ? "encontrado" : "ausente"}</span>}
            />
            <AdminQueueCard
              title="Execucao real"
              description={evidence.data.real_execution_required ? "Ainda ha evidencias pendentes ou sem PASS. Isso exige execucao real com equipe." : "Todas as evidencias foram classificadas como PASS estruturalmente valido."}
              tone={evidence.data.real_execution_required ? "warn" : "ok"}
              eyebrow={<Badge variant="secondary">{evidence.data.real_execution_required ? "acao manual" : "completo"}</Badge>}
              meta={<span>{evidence.data.blocked_external_rows} bloqueio(s) externo(s), {evidence.data.pending_rows} pendente(s)</span>}
            />
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Treinamento assistido">
          <AdminOperationalToolbar
            title="Roteiro guiado no Admin"
            description="Sequencia por cargo para operar pedidos, WMS, fiscal, integrações e decisao sem liberar produção aberta."
            resultLabel={`${training.data.real_execution_pending} etapa(s) aguardando execucao real`}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {training.data.steps.map((step) => (
              <AdminQueueCard
                key={step.id}
                title={step.title}
                description={step.objective}
                tone={step.status === "ready" ? "ok" : step.status === "external_blocked" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="secondary">{step.role}</Badge><Badge variant={step.status === "external_blocked" ? "outline" : "default"}>{formatTrainingStatus(step.status)}</Badge></>}
                meta={<span>{step.expected_evidence.length} evidencia(s) esperadas - {step.blocker || "sem blocker"}</span>}
                action={<Button asChild size="sm" variant="outline"><Link to={step.admin_route}>Abrir</Link></Button>}
              />
            ))}
            {training.data.steps.length === 0 ? (
              <AdminEmptyState title="Roteiro de treinamento indisponivel." description="Recarregue o workspace ou valide o endpoint de treinamento assistido." />
            ) : null}
          </div>
        </WorkspaceSection>

        <div className="grid gap-6 xl:grid-cols-2">
          <WorkspaceSection title="Perfis e hierarquia">
            <AdminOperationalToolbar
              title="Controle RBAC"
              description="Revise perfis ativos, hierarquia e permissao antes de conceder acesso operacional."
              resultLabel={`${permissions.data.length} perfil(is) cadastrado(s)`}
            />
            <div className="space-y-3">
              {permissions.data
                .slice()
                .sort((a, b) => b.level - a.level)
                .slice(0, 10)
                .map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">{profile.slug} - {profile.permissions.length} permissoes</p>
                    </div>
                    <Badge variant={profile.isActive ? "default" : "secondary"}>nivel {profile.level}</Badge>
                  </div>
                ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Integrações obrigatorias">
            <AdminOperationalToolbar
              title="Gates de providers"
              description="Itens obrigatorios sem configuração real devem permanecer como bloqueio externo."
              resultLabel={`${requiredUnconfigured.length} obrigatoria(s) pendente(s)`}
            />
            <div className="space-y-3">
              {integrations.data.filter((item) => item.is_required_for_production).map((item) => (
                <AdminQueueCard
                  key={item.key}
                  title={item.name}
                  description={`${item.category} - ${item.last_status_message || "Sem ultima mensagem de status."}`}
                  tone={item.is_configured ? "ok" : "danger"}
                  eyebrow={<Badge variant={item.is_configured ? "default" : "destructive"}>{item.status}</Badge>}
                />
              ))}
              {integrations.data.filter((item) => item.is_required_for_production).length === 0 ? (
                <AdminEmptyState title="Sem integração obrigatoria cadastrada." description="Configure os providers obrigatorios para produção antes do go-live." />
              ) : null}
            </div>
          </WorkspaceSection>
        </div>

        <WorkspaceSection title="Auditoria recente">
          <AdminOperationalToolbar
            title="Rastreabilidade administrativa"
            description="Acompanhe eventos recentes para saber quem alterou, quando alterou e qual entidade foi impactada."
            resultLabel={`${audit.data.length} evento(s) retornado(s)`}
          />
          <div className="space-y-3">
            {audit.data.slice(0, 12).map((entry) => (
              <div key={entry.event_id} className="rounded-lg border p-3">
                <p className="font-semibold">{entry.event_type || "audit.event"}</p>
                <p className="text-sm text-muted-foreground">{entry.actor_name || "sistema"} - {entry.payload?.entity || "entidade"} - {new Date(entry.occurred_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
            {audit.data.length === 0 ? <AdminEmptyState title="Sem logs retornados para esta permissao." description="Eventos auditaveis aparecerao aqui conforme a permissao do perfil." /> : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Ambiente e secrets mascarados">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ConfigItem label="APP_ENV" value={system.data.env || "não informado"} />
            <ConfigItem label="DB_PROVIDER" value={system.data.providers?.database?.provider || system.data.runtime?.database?.provider || "não informado"} />
            <ConfigItem label="QUEUE_PROVIDER" value={system.data.providers?.redis?.configured ? "redis configurado" : "fila local/memoria"} />
            <ConfigItem label="PAYMENT_PROVIDER" value={system.data.providers?.payment?.provider || "manual"} />
            <ConfigItem label="FREIGHT_PROVIDER" value={system.data.providers?.freight?.provider || "local-rules"} />
            <ConfigItem label="FISCAL_PROVIDER" value={system.data.providers?.fiscal?.provider || "manual"} />
            <ConfigItem label="METRICS_TOKEN" value={system.data.summary.blockers > 0 ? "validar em readiness" : "protegido/não exibido"} />
            <ConfigItem label="Secrets" value="nunca exibidos; apenas status configurado/ausente" />
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}

function formatTrainingStatus(status: AssistedTrainingPlan["steps"][number]["status"]) {
  if (status === "ready") return "pronto";
  if (status === "external_blocked") return "bloqueio externo";
  return "executar com equipe";
}

function formatControlStatus(status: ControlCenterAction["status"]) {
  if (status === "done") return "concluido";
  if (status === "pending_real_execution") return "execucao real";
  if (status === "blocked_external") return "bloqueio externo";
  return "monitorar";
}

function controlStatusBadge(status: ControlCenterAction["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "done") return "default";
  if (status === "blocked_external") return "destructive";
  if (status === "pending_real_execution") return "outline";
  return "secondary";
}

function controlActionTone(status: ControlCenterAction["status"]) {
  if (status === "done") return "ok" as const;
  if (status === "blocked_external") return "danger" as const;
  if (status === "pending_real_execution") return "warn" as const;
  return "neutral" as const;
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function buildGateRows(system: SystemStatus) {
  const readiness = system.readiness ?? {};
  type GateSummary = { ready?: boolean; ok?: boolean; go_live_ready?: boolean; blockers?: number; warnings?: number };
  const gates = [
    { key: "phase1", label: "Fase 1 infra", owner: "DevOps", external: false },
    { key: "security", label: "Segurança", owner: "DevOps", external: false },
    { key: "operations", label: "Operação", owner: "Operação", external: false },
    { key: "marketing", label: "Marketing", owner: "Marketing", external: false },
    { key: "fiscal_minimal", label: "Fiscal minimo", owner: "Contador", external: true },
    { key: "phase2", label: "Fase 2 providers", owner: "Fornecedores", external: true },
    { key: "release", label: "Release", owner: "Tecnologia", external: true },
    { key: "go_live", label: "Go-live", owner: "Direcao", external: true },
  ];

  return gates.map((gate) => {
    const raw = readiness[gate.key] as { summary?: GateSummary } & GateSummary | undefined;
    const summary: GateSummary = raw?.summary ?? raw ?? {};
    const ready = Boolean(summary.ready ?? summary.ok ?? summary.go_live_ready ?? false);
    const blockers = Number(summary.blockers ?? 0);
    const warnings = Number(summary.warnings ?? 0);
    const blocked = blockers > 0 || !ready;
    const status = ready ? "pronto" : gate.external ? "bloqueio externo" : "acao interna";
    const detail = ready
      ? "Gate validado na leitura atual."
      : gate.external
        ? "Manter bloqueado até haver responsável externo, credencial ou provider real."
        : "Pendencia interna deve ser corrigida antes de nova etapa.";
    return {
      ...gate,
      ready,
      blockers,
      warnings,
      status,
      detail,
      tone: ready ? "ok" as const : gate.external ? "warn" as const : "danger" as const,
      blocked,
    };
  });
}
