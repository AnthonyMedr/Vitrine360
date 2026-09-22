import { createId, type DatabaseShape, type DbAdminManagementTaskEvent, type DbAdminManagementTaskOverride } from "./db";
import { createAuditEvent } from "./order-domain";

type ManagementStatus = "novo" | "em_andamento" | "bloqueado" | "aguardando_externo" | "em_revisao" | "concluido" | "cancelado";
type ManagementSeverity = "critical" | "high" | "medium" | "low" | "info";
type ManagementTaskSource = "derived" | "manual";

export type AdminManagementTask = {
  id: string;
  title: string;
  description: string;
  area: string;
  source_module: string;
  source_id: string;
  severity: ManagementSeverity;
  owner: string;
  due_at: string;
  status: ManagementStatus;
  route: string;
  evidence_required: boolean;
  evidence: string;
  evidence_url: string;
  recommended_action: string;
  created_at: string;
  updated_at: string;
  external_blocker: boolean;
  source: ManagementTaskSource;
  note: string;
};

export type AdminManagementMutationContext = {
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
};

type ScoreArea = {
  area: string;
  score: number;
  trend: "stable" | "up" | "down";
  status: "ok" | "atencao" | "bloqueado";
  blockers: number;
  warnings: number;
  justification: string;
  action: string;
  route: string;
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function severityWeight(severity: ManagementSeverity) {
  return severity === "critical" ? 5 : severity === "high" ? 4 : severity === "medium" ? 3 : severity === "low" ? 2 : 1;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function taskStatusForExternal(isExternal: boolean): ManagementStatus {
  return isExternal ? "aguardando_externo" : "novo";
}

function normalizeManagementStatus(value: unknown, fallback: ManagementStatus): ManagementStatus {
  const allowed: ManagementStatus[] = ["novo", "em_andamento", "bloqueado", "aguardando_externo", "em_revisao", "concluido", "cancelado"];
  return allowed.includes(value as ManagementStatus) ? (value as ManagementStatus) : fallback;
}

function normalizeManagementSeverity(value: unknown, fallback: ManagementSeverity): ManagementSeverity {
  const allowed: ManagementSeverity[] = ["critical", "high", "medium", "low", "info"];
  return allowed.includes(value as ManagementSeverity) ? (value as ManagementSeverity) : fallback;
}

function buildTask(input: Omit<AdminManagementTask, "created_at" | "updated_at" | "source" | "note" | "evidence_url"> & Partial<Pick<AdminManagementTask, "source" | "note" | "evidence_url">>): AdminManagementTask {
  const now = new Date().toISOString();
  return { ...input, evidence_url: input.evidence_url ?? "", source: input.source ?? "derived", note: input.note ?? "", created_at: now, updated_at: now };
}

function applyOverride(task: AdminManagementTask, override: DbAdminManagementTaskOverride): AdminManagementTask {
  return {
    ...task,
    title: override.title ?? task.title,
    description: override.description ?? task.description,
    area: override.area ?? task.area,
    source_module: override.source_module ?? task.source_module,
    source_id: override.source_id ?? task.source_id,
    severity: normalizeManagementSeverity(override.severity, task.severity),
    owner: override.owner ?? task.owner,
    due_at: override.due_at ?? task.due_at,
    status: normalizeManagementStatus(override.status, task.status),
    route: override.route ?? task.route,
    evidence_required: override.evidence_required ?? task.evidence_required,
    evidence: override.evidence ?? task.evidence,
    evidence_url: override.evidence_url ?? task.evidence_url,
    recommended_action: override.recommended_action ?? task.recommended_action,
    external_blocker: task.external_blocker || Boolean(override.external_blocker),
    source: override.source,
    note: override.note ?? task.note,
    created_at: override.created_at || task.created_at,
    updated_at: override.updated_at || task.updated_at,
  };
}

function taskFromOverride(override: DbAdminManagementTaskOverride): AdminManagementTask {
  const now = new Date().toISOString();
  return {
    id: override.task_id,
    title: override.title || "Tarefa gerencial manual",
    description: override.description || "Tarefa criada pela equipe administrativa.",
    area: override.area || "Gestao",
    source_module: override.source_module || "management",
    source_id: override.source_id || override.task_id,
    severity: normalizeManagementSeverity(override.severity, "medium"),
    owner: override.owner || "Gerente Ecommerce",
    due_at: override.due_at || now,
    status: normalizeManagementStatus(override.status, "novo"),
    route: override.route || "/admin/tarefas",
    evidence_required: override.evidence_required ?? false,
    evidence: override.evidence || "",
    evidence_url: override.evidence_url || "",
    recommended_action: override.recommended_action || "Acompanhar e registrar andamento.",
    external_blocker: Boolean(override.external_blocker),
    source: override.source,
    note: override.note || "",
    created_at: override.created_at || now,
    updated_at: override.updated_at || now,
  };
}

function getTaskOverrides(db: DatabaseShape) {
  return Array.isArray(db.adminManagementTaskOverrides) ? db.adminManagementTaskOverrides : [];
}

function getTaskEvents(db: DatabaseShape) {
  return Array.isArray(db.adminManagementTaskEvents) ? db.adminManagementTaskEvents : [];
}

function buildDerivedAdminManagementTasks(db: DatabaseShape): AdminManagementTask[] {
  const tasks: AdminManagementTask[] = [];
  const activeProducts = db.products.filter((product) => product.is_active);
  const pendingOrders = db.orders.filter((order) => ["pending", "awaiting_payment", "payment_approved", "confirmed"].includes(order.status));
  const paidWaitingSeparation = db.orders.filter((order) => ["payment_approved", "confirmed"].includes(order.status));
  const lowStockProducts = activeProducts.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= 5);
  const productsWithoutImage = activeProducts.filter((product) => !product.image_url && (!Array.isArray(product.images) || product.images.length === 0));
  const productsWithoutPrice = activeProducts.filter((product) => Number(product.price) <= 0);
  const productsWithoutFiscal = activeProducts.filter((product) => !product.ncm || product.tax_classification_status !== "ready");
  const activeCampaigns = db.marketingCampaigns.filter((campaign) => campaign.status === "active");
  const activeBanners = db.marketingBanners.filter((banner) => banner.status === "active");
  const requiredProviders = db.integrationProviders.filter((provider) => provider.is_required_for_production);
  const blockedProviders = requiredProviders.filter((provider) => !provider.is_configured || provider.status !== "production");

  if (pendingOrders.length > 0) {
    tasks.push(buildTask({
      id: "orders-pending-action",
      title: "Revisar pedidos pendentes",
      description: `${pendingOrders.length} pedido(s) precisam de acompanhamento operacional ou financeiro.`,
      area: "Operacao",
      source_module: "orders",
      source_id: "pending-orders",
      severity: paidWaitingSeparation.length > 0 ? "high" : "medium",
      owner: "Operador de Pedidos",
      due_at: addDays(1),
      status: "novo",
      route: "/admin/pedidos",
      evidence_required: true,
      evidence: "Registrar andamento do pedido ou observacao interna.",
      recommended_action: "Abrir fila de pedidos e priorizar pagos aguardando separacao.",
      external_blocker: false,
    }));
  }

  if (productsWithoutImage.length > 0) {
    tasks.push(buildTask({
      id: "catalog-products-without-image",
      title: "Corrigir produtos ativos sem imagem",
      description: `${productsWithoutImage.length} produto(s) ativo(s) estao sem imagem publica.`,
      area: "Catalogo",
      source_module: "catalog",
      source_id: "products-without-image",
      severity: "high",
      owner: "Catalogo e Conteudo",
      due_at: addDays(2),
      status: "novo",
      route: "/admin/produtos",
      evidence_required: true,
      evidence: "Imagem revisada, alt text e publicacao conferida.",
      recommended_action: "Filtrar produtos sem imagem e revisar os SKUs ativos primeiro.",
      external_blocker: false,
    }));
  }

  if (productsWithoutPrice.length > 0) {
    tasks.push(buildTask({
      id: "catalog-products-without-price",
      title: "Corrigir produtos ativos sem preco",
      description: `${productsWithoutPrice.length} produto(s) ativo(s) nao tem preco valido.`,
      area: "Catalogo",
      source_module: "catalog",
      source_id: "products-without-price",
      severity: "critical",
      owner: "Gestor Comercial",
      due_at: addDays(1),
      status: "novo",
      route: "/admin/produtos",
      evidence_required: true,
      evidence: "Preco revisado e validado comercialmente.",
      recommended_action: "Bloquear publicacao ou preencher preco antes de campanha.",
      external_blocker: false,
    }));
  }

  if (productsWithoutFiscal.length > 0) {
    tasks.push(buildTask({
      id: "fiscal-products-without-classification",
      title: "Resolver fiscal minimo do catalogo ativo",
      description: `${productsWithoutFiscal.length} produto(s) ativo(s) dependem de NCM/tax_code pronto.`,
      area: "Fiscal",
      source_module: "fiscal",
      source_id: "products-without-fiscal",
      severity: "critical",
      owner: "Contador / Fiscal",
      due_at: addDays(3),
      status: "aguardando_externo",
      route: "/admin/fiscal-financeiro",
      evidence_required: true,
      evidence: "Close pack fiscal aprovado pelo contador.",
      recommended_action: "Separar lista fiscal e validar com contador antes de go-live aberto.",
      external_blocker: true,
    }));
  }

  if (lowStockProducts.length > 0) {
    tasks.push(buildTask({
      id: "inventory-low-stock",
      title: "Revisar estoque baixo",
      description: `${lowStockProducts.length} produto(s) ativo(s) estao com estoque baixo.`,
      area: "Estoque",
      source_module: "inventory",
      source_id: "low-stock",
      severity: "medium",
      owner: "Separacao e Expedicao",
      due_at: addDays(2),
      status: "novo",
      route: "/admin/catalogo",
      evidence_required: false,
      evidence: "Conferencia de estoque ou reposicao registrada.",
      recommended_action: "Conferir estoque fisico e ajustar disponibilidade.",
      external_blocker: false,
    }));
  }

  if (activeCampaigns.length > 0 && activeBanners.length === 0) {
    tasks.push(buildTask({
      id: "marketing-campaign-without-banner",
      title: "Campanha ativa sem banner publicado",
      description: `${activeCampaigns.length} campanha(s) ativa(s) sem banner publicado associado.`,
      area: "Marketing",
      source_module: "marketing",
      source_id: "campaign-without-banner",
      severity: "medium",
      owner: "Marketing",
      due_at: addDays(2),
      status: "novo",
      route: "/admin/banners-vitrines",
      evidence_required: true,
      evidence: "Banner publicado e preview conferido.",
      recommended_action: "Publicar banner ou pausar campanha ate o criativo ficar pronto.",
      external_blocker: false,
    }));
  }

  if (blockedProviders.length > 0) {
    tasks.push(buildTask({
      id: "integrations-required-providers",
      title: "Homologar integracoes obrigatorias",
      description: `${blockedProviders.length} provider(s) obrigatorio(s) seguem sem configuracao real ativa.`,
      area: "Integracoes",
      source_module: "integrations",
      source_id: "required-providers",
      severity: "critical",
      owner: "Admin Master / DevOps",
      due_at: addDays(5),
      status: "aguardando_externo",
      route: "/admin/integracoes",
      evidence_required: true,
      evidence: "Credenciais reais configuradas em ambiente seguro e teste de conexao aprovado.",
      recommended_action: "Configurar Mercado Pago, webhook publico e provider de frete real.",
      external_blocker: true,
    }));
  }

  tasks.push(buildTask({
    id: "management-weekly-review",
    title: "Revisao gerencial semanal",
    description: "Consolidar prioridades, tarefas vencidas, bloqueios externos e score do ecommerce.",
    area: "Gestao",
    source_module: "management",
    source_id: "weekly-review",
    severity: "low",
    owner: "Gerente Ecommerce",
    due_at: addDays(7),
    status: "em_revisao",
    route: "/admin/relatorios-gerenciais",
    evidence_required: false,
    evidence: "Relatorio semanal revisado pela gerencia.",
    recommended_action: "Gerar relatorio gerencial e alinhar responsaveis.",
    external_blocker: false,
  }));

  tasks.push(buildTask({
    id: "management-assisted-training",
    title: "Executar treinamento assistido da equipe",
    description: "Rodada pratica com Direcao, Gerente Ecommerce, Operacao, Catalogo, Marketing, Fiscal, Financeiro e Logistica usando o Admin real.",
    area: "Gestao",
    source_module: "training",
    source_id: "assisted-admin-training",
    severity: "high",
    owner: "Gerente Ecommerce",
    due_at: addDays(3),
    status: "novo",
    route: "/admin/documentacao",
    evidence_required: true,
    evidence: "Lista de presenca, roteiro executado, duvidas registradas e ajustes priorizados.",
    recommended_action: "Conduzir treinamento de 60 a 90 minutos usando /admin/hoje, /admin/tarefas, /admin/kanban e /admin/cockpit.",
    external_blocker: false,
  }));

  tasks.push(buildTask({
    id: "management-operational-homologation",
    title: "Executar homologacao operacional real",
    description: "Validar com a equipe fluxos reais de pedido, pagamento, separacao, entrega, cancelamento, fiscal, atendimento e relatorio gerencial.",
    area: "Gestao",
    source_module: "homologation",
    source_id: "real-operational-homologation",
    severity: "critical",
    owner: "Admin Master / Gerente Ecommerce",
    due_at: addDays(5),
    status: "em_revisao",
    route: "/admin/go-live",
    evidence_required: true,
    evidence: "Evidencias reais anexadas: pedido teste, pagamento homologado, separacao, entrega/cancelamento, fiscal e aceite da equipe.",
    recommended_action: "Executar o roteiro de homologacao e anexar evidencias antes de qualquer decisao de soft launch.",
    external_blocker: false,
  }));

  return tasks.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.due_at.localeCompare(b.due_at));
}

export function buildAdminManagementTasks(db: DatabaseShape): AdminManagementTask[] {
  const derived = buildDerivedAdminManagementTasks(db);
  const byTaskId = new Map(getTaskOverrides(db).map((override) => [override.task_id, override]));
  const merged = derived.map((task) => {
    const override = byTaskId.get(task.id);
    if (!override) return task;
    byTaskId.delete(task.id);
    return applyOverride(task, override);
  });
  const manual = Array.from(byTaskId.values())
    .filter((override) => override.source === "manual")
    .map(taskFromOverride);
  return [...merged, ...manual].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.due_at.localeCompare(b.due_at));
}

export function getAdminManagementTaskEvents(db: DatabaseShape, taskId: string) {
  return getTaskEvents(db)
    .filter((event) => event.task_id === taskId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function upsertAdminManagementTask(
  db: DatabaseShape,
  taskId: string | null,
  input: Partial<AdminManagementTask> & { note?: string },
  context: AdminManagementMutationContext,
) {
  const now = new Date().toISOString();
  const derived = buildDerivedAdminManagementTasks(db);
  const nextTaskId = taskId || `manual-${createId()}`;
  const derivedTask = derived.find((task) => task.id === nextTaskId) ?? null;
  const existing = getTaskOverrides(db).find((override) => override.task_id === nextTaskId) ?? null;
  const previousTask = existing ? taskFromOverride(existing) : derivedTask;

  if (!derivedTask && !existing && !input.title?.trim()) {
    throw new Error("Informe um titulo para criar tarefa manual.");
  }

  if ((derivedTask?.external_blocker || existing?.external_blocker) && input.status === "concluido" && !String(input.evidence || existing?.evidence || input.evidence_url || existing?.evidence_url || "").trim()) {
    throw new Error("Bloqueio externo exige evidencia antes de concluir.");
  }

  const nextOverride: DbAdminManagementTaskOverride = {
    id: existing?.id ?? createId(),
    task_id: nextTaskId,
    source: derivedTask ? "derived" : "manual",
    title: input.title ?? existing?.title ?? (derivedTask ? null : "Tarefa gerencial manual"),
    description: input.description ?? existing?.description ?? (derivedTask ? null : ""),
    area: input.area ?? existing?.area ?? (derivedTask ? null : "Gestao"),
    source_module: input.source_module ?? existing?.source_module ?? (derivedTask ? null : "management"),
    source_id: input.source_id ?? existing?.source_id ?? (derivedTask ? null : nextTaskId),
    severity: input.severity ?? existing?.severity ?? (derivedTask ? null : "medium"),
    owner: input.owner ?? existing?.owner ?? (derivedTask ? null : "Gerente Ecommerce"),
    due_at: input.due_at ?? existing?.due_at ?? (derivedTask ? null : now),
    status: input.status ?? existing?.status ?? null,
    route: input.route ?? existing?.route ?? (derivedTask ? null : "/admin/tarefas"),
    evidence_required: typeof input.evidence_required === "boolean" ? input.evidence_required : existing?.evidence_required ?? (derivedTask ? null : false),
    evidence: input.evidence ?? existing?.evidence ?? null,
    evidence_url: input.evidence_url ?? existing?.evidence_url ?? null,
    recommended_action: input.recommended_action ?? existing?.recommended_action ?? (derivedTask ? null : "Acompanhar e registrar andamento."),
    external_blocker: typeof input.external_blocker === "boolean" ? input.external_blocker : existing?.external_blocker ?? (derivedTask ? null : false),
    note: input.note ?? existing?.note ?? null,
    created_by: existing?.created_by ?? context.actorId,
    updated_by: context.actorId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (existing) {
    const index = db.adminManagementTaskOverrides.findIndex((override) => override.id === existing.id);
    db.adminManagementTaskOverrides[index] = nextOverride;
  } else {
    db.adminManagementTaskOverrides.unshift(nextOverride);
  }

  const eventType: DbAdminManagementTaskEvent["event_type"] =
    !existing ? "created" : input.status && input.status !== previousTask?.status ? "status_changed" : input.owner && input.owner !== previousTask?.owner ? "assigned" : (input.evidence && input.evidence !== previousTask?.evidence) || (input.evidence_url && input.evidence_url !== previousTask?.evidence_url) ? "evidence_added" : "updated";
  const event: DbAdminManagementTaskEvent = {
    id: createId(),
    task_id: nextTaskId,
    event_type: eventType,
    actor_id: context.actorId,
    actor_name: context.actorName,
    previous_value: previousTask ? { status: previousTask.status, owner: previousTask.owner, due_at: previousTask.due_at, evidence: previousTask.evidence, evidence_url: previousTask.evidence_url, note: previousTask.note } : null,
    new_value: { status: nextOverride.status, owner: nextOverride.owner, due_at: nextOverride.due_at, evidence: nextOverride.evidence, evidence_url: nextOverride.evidence_url, note: nextOverride.note },
    note: input.note ?? null,
    evidence_url: input.evidence_url ?? null,
    created_at: now,
  };
  db.adminManagementTaskEvents.unshift(event);

  createAuditEvent(db, {
    eventType: `admin.management_task.${eventType}`,
    correlationId: context.correlationId,
    actorId: context.actorId,
    actorName: context.actorName,
    sourceChannel: "web",
    previousValue: event.previous_value,
    newValue: event.new_value,
    payload: { task_id: nextTaskId, source: nextOverride.source, title: nextOverride.title ?? derivedTask?.title },
  });

  return {
    task: buildAdminManagementTasks(db).find((task) => task.id === nextTaskId) ?? taskFromOverride(nextOverride),
    event,
  };
}

export function buildAdminDailyManagement(db: DatabaseShape) {
  const tasks = buildAdminManagementTasks(db);
  const critical = tasks.filter((task) => task.severity === "critical");
  const overdue = tasks.filter((task) => new Date(task.due_at).getTime() < Date.now() && task.status !== "concluido");
  const withoutOwner = tasks.filter((task) => !task.owner);
  const external = tasks.filter((task) => task.external_blocker);

  return {
    generated_at: new Date().toISOString(),
    status: critical.length > 0 ? "ATENCAO_CRITICA" : "ROTINA_GERENCIAVEL",
    summary: {
      total_tasks: tasks.length,
      critical: critical.length,
      overdue: overdue.length,
      without_owner: withoutOwner.length,
      external_blockers: external.length,
      due_today: tasks.filter((task) => new Date(task.due_at).toDateString() === new Date().toDateString()).length,
    },
    priorities: tasks.slice(0, 6),
    overdue,
    without_owner: withoutOwner,
    external_blockers: external,
    quick_actions: [
      { label: "Abrir tarefas", route: "/admin/tarefas" },
      { label: "Kanban operacional", route: "/admin/kanban" },
      { label: "Score gerencial", route: "/admin/score-gerencial" },
      { label: "Relatorios gerenciais", route: "/admin/relatorios-gerenciais" },
    ],
  };
}

export function buildAdminKanban(db: DatabaseShape) {
  const tasks = buildAdminManagementTasks(db);
  const columns: ManagementStatus[] = ["novo", "em_andamento", "bloqueado", "aguardando_externo", "em_revisao", "concluido"];
  return {
    generated_at: new Date().toISOString(),
    columns: columns.map((status) => ({
      status,
      label: status.replace(/_/g, " "),
      tasks: tasks.filter((task) => task.status === status),
    })),
  };
}

export function buildAdminManagementScore(db: DatabaseShape) {
  const tasks = buildAdminManagementTasks(db);
  const areas = ["Operacao", "Catalogo", "Marketing", "Fiscal", "Pagamentos", "Frete", "Seguranca", "Performance", "Go-Live"];
  const scoreAreas: ScoreArea[] = areas.map((area) => {
    const areaTasks = tasks.filter((task) => task.area === area || (area === "Go-Live" && task.external_blocker));
    const blockers = areaTasks.filter((task) => task.severity === "critical").length;
    const warnings = areaTasks.filter((task) => ["high", "medium"].includes(task.severity)).length;
    const external = areaTasks.some((task) => task.external_blocker);
    const score = clampScore(100 - blockers * 22 - warnings * 9 - (external ? 12 : 0));
    return {
      area,
      score,
      trend: blockers > 0 ? "down" : warnings > 0 ? "stable" : "up",
      status: blockers > 0 || external ? "bloqueado" : warnings > 0 ? "atencao" : "ok",
      blockers,
      warnings,
      justification: areaTasks.length > 0 ? `${areaTasks.length} tarefa(s) impactam esta area.` : "Sem pendencia gerencial relevante.",
      action: areaTasks[0]?.recommended_action ?? "Manter monitoramento.",
      route: areaTasks[0]?.route ?? "/admin",
    };
  });
  const average = scoreAreas.reduce((sum, item) => sum + item.score, 0) / scoreAreas.length;
  return {
    generated_at: new Date().toISOString(),
    overall_score: clampScore(average),
    production_open: "BLOQUEADO_EXTERNO",
    areas: scoreAreas,
  };
}

export function buildAdminManagementCockpit(db: DatabaseShape, profile = "gerente_ecommerce") {
  const tasks = buildAdminManagementTasks(db);
  const byProfile: Record<string, string[]> = {
    direcao: ["Gestao", "Fiscal", "Integracoes"],
    gerente_ecommerce: ["Operacao", "Catalogo", "Marketing", "Gestao", "Integracoes"],
    operador_pedidos: ["Operacao", "Estoque"],
    catalogo_conteudo: ["Catalogo", "Estoque"],
    marketing: ["Marketing"],
    fiscal: ["Fiscal", "Pagamentos"],
    financeiro: ["Pagamentos", "Fiscal"],
    logistica: ["Operacao", "Estoque", "Frete"],
    admin_master: ["Operacao", "Catalogo", "Marketing", "Fiscal", "Estoque", "Integracoes", "Gestao"],
  };
  const visibleAreas = byProfile[profile] ?? byProfile.gerente_ecommerce;
  const profileTasks = tasks.filter((task) => visibleAreas.includes(task.area) || (task.external_blocker && visibleAreas.includes("Integracoes")));
  return {
    generated_at: new Date().toISOString(),
    profile,
    visible_areas: visibleAreas,
    summary: {
      tasks: profileTasks.length,
      critical: profileTasks.filter((task) => task.severity === "critical").length,
      external_blockers: profileTasks.filter((task) => task.external_blocker).length,
    },
    tasks: profileTasks,
  };
}

export function buildAdminManagementReports(db: DatabaseShape) {
  const tasks = buildAdminManagementTasks(db);
  const score = buildAdminManagementScore(db);
  const byArea = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.area] = (acc[task.area] ?? 0) + 1;
    return acc;
  }, {});
  const byOwner = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.owner] = (acc[task.owner] ?? 0) + 1;
    return acc;
  }, {});
  return {
    generated_at: new Date().toISOString(),
    weekly_summary: {
      tasks: tasks.length,
      critical: tasks.filter((task) => task.severity === "critical").length,
      external_blockers: tasks.filter((task) => task.external_blocker).length,
      overall_score: score.overall_score,
    },
    by_area: byArea,
    by_owner: byOwner,
    stuck_orders: tasks.filter((task) => task.source_module === "orders"),
    problematic_products: tasks.filter((task) => task.source_module === "catalog"),
    external_blockers: tasks.filter((task) => task.external_blocker),
    recommendations: tasks.slice(0, 5).map((task) => task.recommended_action),
  };
}

export function renderAdminManagementReportMarkdown(report: ReturnType<typeof buildAdminManagementReports>) {
  const lines = [
    "# Relatorio Gerencial - Central Admin",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    "## Resumo Semanal",
    "",
    `- Tarefas: ${report.weekly_summary.tasks}`,
    `- Criticas: ${report.weekly_summary.critical}`,
    `- Bloqueios externos: ${report.weekly_summary.external_blockers}`,
    `- Score gerencial: ${report.weekly_summary.overall_score}`,
    `- Producao aberta: BLOQUEADO_EXTERNO`,
    "",
    "## Distribuicao Por Area",
    "",
    ...Object.entries(report.by_area).map(([area, count]) => `- ${area}: ${count}`),
    "",
    "## Distribuicao Por Responsavel",
    "",
    ...Object.entries(report.by_owner).map(([owner, count]) => `- ${owner}: ${count}`),
    "",
    "## Bloqueios Externos",
    "",
    ...(report.external_blockers.length > 0
      ? report.external_blockers.map((task) => `- ${task.title} | ${task.owner} | ${task.status} | ${task.recommended_action}${task.evidence_url ? ` | Evidencia: ${task.evidence_url}` : ""}`)
      : ["- Nenhum bloqueio externo derivado no momento."]),
    "",
    "## Recomendacoes",
    "",
    ...report.recommendations.map((recommendation) => `- ${recommendation}`),
    "",
    "## Guardrail",
    "",
    "Este relatorio nao contem secrets, credenciais reais ou aprovacao fiscal automatica. Dependencias de contador, gateway, webhook publico e frete real permanecem externas.",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderAdminManagementTasksCsv(tasks: AdminManagementTask[]) {
  const rows = [
    ["id", "title", "area", "owner", "severity", "status", "due_at", "external_blocker", "evidence_url", "route"],
    ...tasks.map((task) => [task.id, task.title, task.area, task.owner, task.severity, task.status, task.due_at, String(task.external_blocker), task.evidence_url, task.route]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}
