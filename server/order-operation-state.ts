import { createId, type DatabaseShape, type DbOrder, type DbOrderOperation, type OrderOperationPriority, type OrderOperationStage, type OrderStatus } from "./db";
import { createAuditEvent } from "./order-domain";
import { applyAdminOrderStatusTransition, canTransitionOrderStatus, isValidOrderStatus } from "./order-operations";
import { getPermissionProfile } from "./admin-permissions";

type WaitingOn = DbOrderOperation["waiting_on"];

const stageConfig: Record<OrderOperationStage, { ownerRole: string; ownerLabel: string; nextAction: string; slaMinutes: number; priority: OrderOperationPriority }> = {
  awaiting_payment: { ownerRole: "caixa_financeiro", ownerLabel: "Caixa e Financeiro", nextAction: "Confirmar pagamento ou acionar cliente.", slaMinutes: 24 * 60, priority: "medium" },
  payment_review: { ownerRole: "caixa_financeiro", ownerLabel: "Caixa e Financeiro", nextAction: "Conferir comprovante, gateway ou conciliacao.", slaMinutes: 120, priority: "high" },
  payment_approved: { ownerRole: "caixa_financeiro", ownerLabel: "Caixa e Financeiro", nextAction: "Encaminhar o pedido para revisao fiscal/local.", slaMinutes: 120, priority: "high" },
  fiscal_review: { ownerRole: "fiscal_contador", ownerLabel: "Fiscal e Contador", nextAction: "Validar documentos, fiscal local e liberar para confirmacao.", slaMinutes: 240, priority: "high" },
  confirmed: { ownerRole: "supervisor_loja", ownerLabel: "Supervisor de Loja", nextAction: "Liberar para conferencia e estoque.", slaMinutes: 240, priority: "medium" },
  processing: { ownerRole: "operador_pedidos", ownerLabel: "Operador de Pedidos", nextAction: "Conferir itens, disponibilidade e endereco.", slaMinutes: 240, priority: "medium" },
  stock_check: { ownerRole: "supervisor_loja", ownerLabel: "Supervisor de Loja", nextAction: "Validar estoque, divergencia ou substituicao.", slaMinutes: 180, priority: "high" },
  in_separation: { ownerRole: "separacao_expedicao", ownerLabel: "Separacao e Expedicao", nextAction: "Separar, conferir e preparar comprovante logistico.", slaMinutes: 240, priority: "high" },
  ready_for_pickup: { ownerRole: "separacao_expedicao", ownerLabel: "Separacao e Expedicao", nextAction: "Avisar retirada e registrar comprovacao.", slaMinutes: 8 * 60, priority: "medium" },
  in_expedition: { ownerRole: "separacao_expedicao", ownerLabel: "Separacao e Expedicao", nextAction: "Embalar, despachar e registrar transportadora.", slaMinutes: 8 * 60, priority: "high" },
  shipped: { ownerRole: "separacao_expedicao", ownerLabel: "Separacao e Expedicao", nextAction: "Acompanhar rastreio e ocorrencias de entrega.", slaMinutes: 48 * 60, priority: "medium" },
  out_for_delivery: { ownerRole: "separacao_expedicao", ownerLabel: "Separacao e Expedicao", nextAction: "Confirmar entrega, tentativa ou retorno.", slaMinutes: 24 * 60, priority: "medium" },
  delivered: { ownerRole: "gerente_ecommerce", ownerLabel: "Gerente de Ecommerce", nextAction: "Encerrar trilha e acompanhar pos-venda.", slaMinutes: 0, priority: "low" },
  cancelled: { ownerRole: "gerente_ecommerce", ownerLabel: "Gerente de Ecommerce", nextAction: "Conferir estorno, inventario e trilha de auditoria.", slaMinutes: 0, priority: "low" },
  blocked: { ownerRole: "gerente_ecommerce", ownerLabel: "Gerente de Ecommerce", nextAction: "Resolver bloqueio ou reencaminhar a fila.", slaMinutes: 60, priority: "critical" },
  waiting_customer: { ownerRole: "atendimento_suporte", ownerLabel: "Atendimento e Suporte", nextAction: "Retomar contato com o cliente e registrar retorno.", slaMinutes: 24 * 60, priority: "medium" },
  waiting_provider: { ownerRole: "gerente_ecommerce", ownerLabel: "Gerente de Ecommerce", nextAction: "Cobrar provider externo e registrar fallback.", slaMinutes: 8 * 60, priority: "high" },
};

const orderStatusToOperationStage: Record<OrderStatus, OrderOperationStage> = {
  draft: "awaiting_payment",
  pending: "awaiting_payment",
  awaiting_payment: "awaiting_payment",
  payment_approved: "payment_approved",
  confirmed: "confirmed",
  processing: "processing",
  in_separation: "in_separation",
  in_expedition: "in_expedition",
  shipped: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
};

const derivedStages = new Set<OrderOperationStage>([
  "awaiting_payment",
  "payment_approved",
  "confirmed",
  "processing",
  "in_separation",
  "in_expedition",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

const financeStages = new Set<OrderOperationStage>(["awaiting_payment", "payment_review", "payment_approved"]);
const fiscalStages = new Set<OrderOperationStage>(["fiscal_review"]);
const operationsStages = new Set<OrderOperationStage>(["confirmed", "processing", "stock_check", "in_separation", "ready_for_pickup", "in_expedition", "shipped", "out_for_delivery", "delivered"]);
const exceptionStages = new Set<OrderOperationStage>(["blocked", "waiting_customer", "waiting_provider", "cancelled"]);

export function deriveOperationStage(order: DbOrder): OrderOperationStage {
  return orderStatusToOperationStage[order.status] ?? "awaiting_payment";
}

function getStageConfig(stage: OrderOperationStage) {
  return stageConfig[stage];
}

function findOwnerName(db: DatabaseShape, userId: string | null) {
  if (!userId) return null;
  return db.users.find((user) => user.id === userId)?.user_metadata.full_name ?? null;
}

function isOverdue(state: DbOrderOperation) {
  if (state.stage_sla_minutes <= 0) return false;
  return Date.now() - new Date(state.stage_started_at).getTime() > state.stage_sla_minutes * 60_000;
}

function buildWaitingBadge(waitingOn: WaitingOn) {
  if (waitingOn === "customer") return "aguardando cliente";
  if (waitingOn === "provider") return "aguardando terceiro";
  if (waitingOn === "accountant") return "aguardando contador";
  return null;
}

export function serializeOrderOperationState(db: DatabaseShape, state: DbOrderOperation) {
  const dueAt = state.stage_sla_minutes > 0 ? new Date(new Date(state.stage_started_at).getTime() + state.stage_sla_minutes * 60_000).toISOString() : null;
  return {
    ...state,
    current_owner_name: findOwnerName(db, state.current_owner_user_id),
    stage_label: state.current_stage,
    owner_label: getStageConfig(state.current_stage).ownerLabel,
    sla_due_at: dueAt,
    is_overdue: isOverdue(state),
    age_minutes: Math.max(0, Math.floor((Date.now() - new Date(state.stage_started_at).getTime()) / 60_000)),
    waiting_badge: buildWaitingBadge(state.waiting_on),
  };
}

export function ensureOrderOperationState(db: DatabaseShape, order: DbOrder) {
  const mappedStage = deriveOperationStage(order);
  const existing = db.orderOperations.find((entry) => entry.order_id === order.id);
  if (!existing) {
    const config = getStageConfig(mappedStage);
    const state: DbOrderOperation = {
      id: createId(),
      order_id: order.id,
      current_stage: mappedStage,
      current_owner_user_id: null,
      current_owner_role: config.ownerRole,
      stage_started_at: order.updated_at || order.created_at,
      stage_sla_minutes: config.slaMinutes,
      is_stuck: false,
      stuck_reason: null,
      stuck_since: null,
      next_action: config.nextAction,
      priority: config.priority,
      waiting_on: null,
      internal_notes: null,
      last_human_action_at: order.updated_at || order.created_at,
      last_system_action_at: null,
      updated_by: null,
      created_at: order.created_at,
      updated_at: order.updated_at || order.created_at,
    };
    db.orderOperations.unshift(state);
    return state;
  }

  if (mappedStage === "delivered" || mappedStage === "cancelled") {
    if (existing.current_stage !== mappedStage) {
      const config = getStageConfig(mappedStage);
      existing.current_stage = mappedStage;
      existing.current_owner_role = config.ownerRole;
      existing.stage_started_at = order.updated_at || existing.stage_started_at;
      existing.stage_sla_minutes = config.slaMinutes;
      existing.next_action = config.nextAction;
      existing.priority = config.priority;
      existing.updated_at = order.updated_at || existing.updated_at;
      existing.is_stuck = false;
      existing.stuck_reason = null;
      existing.stuck_since = null;
      existing.waiting_on = null;
    }
    return existing;
  }

  if (derivedStages.has(existing.current_stage) && existing.current_stage !== mappedStage) {
    const config = getStageConfig(mappedStage);
    existing.current_stage = mappedStage;
    existing.current_owner_role = config.ownerRole;
    existing.stage_started_at = order.updated_at || existing.stage_started_at;
    existing.stage_sla_minutes = config.slaMinutes;
    existing.next_action = config.nextAction;
    existing.priority = config.priority;
    existing.updated_at = order.updated_at || existing.updated_at;
  }

  return existing;
}

export function listOrderOperationStates(db: DatabaseShape) {
  return db.orders
    .map((order) => serializeOrderOperationState(db, ensureOrderOperationState(db, order)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getOrderOperationState(db: DatabaseShape, orderId: string) {
  const order = db.orders.find((entry) => entry.id === orderId);
  if (!order) return null;
  return serializeOrderOperationState(db, ensureOrderOperationState(db, order));
}

function stageAllowedForProfile(profileId: string | null | undefined, stage: OrderOperationStage) {
  const slug = getPermissionProfile(profileId).slug;
  if (slug === "admin_master" || slug === "gerente_ecommerce") return true;
  if (financeStages.has(stage)) return slug === "caixa_financeiro";
  if (fiscalStages.has(stage)) return slug === "fiscal_contador";
  if (operationsStages.has(stage)) return ["supervisor_loja", "operador_pedidos", "separacao_expedicao"].includes(slug);
  if (exceptionStages.has(stage)) return ["supervisor_loja", "operador_pedidos", "atendimento_suporte", "caixa_financeiro", "fiscal_contador", "separacao_expedicao"].includes(slug);
  return false;
}

export function assignOrderOperationOwner(input: {
  db: DatabaseShape;
  orderId: string;
  ownerUserId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
  note?: string | null;
}) {
  const order = input.db.orders.find((entry) => entry.id === input.orderId);
  if (!order) return { ok: false as const, error: "Pedido nao encontrado" };
  if (!["admin_master", "gerente_ecommerce", "supervisor_loja"].includes(getPermissionProfile(input.actorProfileId).slug)) {
    return { ok: false as const, error: "Seu perfil nao pode atribuir responsavel do pedido" };
  }
  const state = ensureOrderOperationState(input.db, order);
  const owner = input.ownerUserId ? input.db.users.find((entry) => entry.id === input.ownerUserId && entry.role === "admin") : null;
  if (input.ownerUserId && !owner) {
    return { ok: false as const, error: "Responsavel informado nao foi encontrado" };
  }

  const previousValue = { current_owner_user_id: state.current_owner_user_id, current_owner_role: state.current_owner_role };
  state.current_owner_user_id = owner?.id ?? null;
  state.current_owner_role = owner?.user_metadata.permission_profile_id ?? state.current_owner_role;
  state.updated_by = input.actorName;
  state.last_human_action_at = new Date().toISOString();
  state.updated_at = state.last_human_action_at;
  if (input.note?.trim()) {
    state.internal_notes = [state.internal_notes, input.note.trim()].filter(Boolean).join("\n");
  }

  createAuditEvent(input.db, {
    eventType: "order.operation_owner_assigned",
    orderId: order.id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: order.source_channel,
    previousValue,
    newValue: { current_owner_user_id: state.current_owner_user_id, current_owner_role: state.current_owner_role },
    payload: { note: input.note?.trim() || null },
    occurredAt: state.updated_at,
  });

  return { ok: true as const, state: serializeOrderOperationState(input.db, state) };
}

export function markOrderOperationStuck(input: {
  db: DatabaseShape;
  orderId: string;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
  reason: string;
  nextAction?: string | null;
  waitingOn?: WaitingOn;
  priority?: OrderOperationPriority;
}) {
  const order = input.db.orders.find((entry) => entry.id === input.orderId);
  if (!order) return { ok: false as const, error: "Pedido nao encontrado" };
  if (!["admin_master", "gerente_ecommerce", "supervisor_loja", "operador_pedidos", "caixa_financeiro", "fiscal_contador", "separacao_expedicao", "atendimento_suporte"].includes(getPermissionProfile(input.actorProfileId).slug)) {
    return { ok: false as const, error: "Seu perfil nao pode travar pedido operacionalmente" };
  }
  const state = ensureOrderOperationState(input.db, order);
  const now = new Date().toISOString();
  const previousValue = { is_stuck: state.is_stuck, stuck_reason: state.stuck_reason, waiting_on: state.waiting_on, current_stage: state.current_stage };
  state.is_stuck = true;
  state.stuck_reason = input.reason.trim();
  state.stuck_since = now;
  state.current_stage = input.waitingOn === "customer" ? "waiting_customer" : input.waitingOn === "provider" || input.waitingOn === "accountant" ? "waiting_provider" : "blocked";
  state.waiting_on = input.waitingOn ?? "internal";
  state.priority = input.priority ?? "critical";
  state.next_action = input.nextAction?.trim() || "Resolver o travamento e encaminhar a proxima etapa.";
  state.stage_started_at = now;
  state.stage_sla_minutes = getStageConfig(state.current_stage).slaMinutes;
  state.last_human_action_at = now;
  state.updated_at = now;
  state.updated_by = input.actorName;

  createAuditEvent(input.db, {
    eventType: "order.operation_marked_stuck",
    orderId: order.id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: order.source_channel,
    previousValue,
    newValue: { is_stuck: true, stuck_reason: state.stuck_reason, waiting_on: state.waiting_on, current_stage: state.current_stage },
    occurredAt: now,
  });

  return { ok: true as const, state: serializeOrderOperationState(input.db, state) };
}

export function resolveOrderOperationStuck(input: {
  db: DatabaseShape;
  orderId: string;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
  note?: string | null;
  nextStage?: OrderOperationStage | null;
}) {
  const order = input.db.orders.find((entry) => entry.id === input.orderId);
  if (!order) return { ok: false as const, error: "Pedido nao encontrado" };
  const state = ensureOrderOperationState(input.db, order);
  if (!state.is_stuck && !["blocked", "waiting_customer", "waiting_provider"].includes(state.current_stage)) {
    return { ok: false as const, error: "Pedido nao esta marcado como travado" };
  }
  const now = new Date().toISOString();
  const previousValue = { is_stuck: state.is_stuck, stuck_reason: state.stuck_reason, waiting_on: state.waiting_on, current_stage: state.current_stage };
  const nextStage = input.nextStage ?? deriveOperationStage(order);
  if (!stageAllowedForProfile(input.actorProfileId, nextStage)) {
    return { ok: false as const, error: "Seu perfil nao pode encaminhar esta etapa" };
  }
  const config = getStageConfig(nextStage);
  state.is_stuck = false;
  state.stuck_reason = null;
  state.stuck_since = null;
  state.waiting_on = null;
  state.current_stage = nextStage;
  state.stage_started_at = now;
  state.stage_sla_minutes = config.slaMinutes;
  state.priority = config.priority;
  state.next_action = input.note?.trim() || config.nextAction;
  state.last_human_action_at = now;
  state.updated_at = now;
  state.updated_by = input.actorName;

  createAuditEvent(input.db, {
    eventType: "order.operation_resolved_stuck",
    orderId: order.id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: order.source_channel,
    previousValue,
    newValue: { is_stuck: false, current_stage: state.current_stage, next_action: state.next_action },
    occurredAt: now,
  });

  return { ok: true as const, state: serializeOrderOperationState(input.db, state) };
}

export function advanceOrderOperationStage(input: {
  db: DatabaseShape;
  orderId: string;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
  nextStage: OrderOperationStage;
  note?: string | null;
}) {
  const order = input.db.orders.find((entry) => entry.id === input.orderId);
  if (!order) return { ok: false as const, error: "Pedido nao encontrado" };
  if (!stageAllowedForProfile(input.actorProfileId, input.nextStage)) {
    return { ok: false as const, error: "Seu perfil nao pode avancar esta etapa" };
  }
  const state = ensureOrderOperationState(input.db, order);
  const previousValue = { current_stage: state.current_stage, order_status: order.status, is_stuck: state.is_stuck };

  if (isValidOrderStatus(input.nextStage) && input.nextStage !== order.status) {
    if (!canTransitionOrderStatus(order.status, input.nextStage)) {
      return { ok: false as const, error: `Transicao invalida de ${order.status} para ${input.nextStage}` };
    }
    const transition = applyAdminOrderStatusTransition({
      db: input.db,
      order,
      nextStatus: input.nextStage,
      actorId: input.actorId,
      actorName: input.actorName,
    });
    if (!transition.ok) {
      return { ok: false as const, error: transition.error };
    }
  }

  const now = new Date().toISOString();
  const config = getStageConfig(input.nextStage);
  state.current_stage = input.nextStage;
  state.current_owner_role = config.ownerRole;
  state.stage_started_at = now;
  state.stage_sla_minutes = config.slaMinutes;
  state.priority = config.priority;
  state.is_stuck = false;
  state.stuck_reason = null;
  state.stuck_since = null;
  state.waiting_on = null;
  state.next_action = input.note?.trim() || config.nextAction;
  state.last_human_action_at = now;
  state.updated_at = now;
  state.updated_by = input.actorName;

  createAuditEvent(input.db, {
    eventType: "order.operation_stage_advanced",
    orderId: order.id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: order.source_channel,
    previousValue,
    newValue: { current_stage: state.current_stage, order_status: order.status, next_action: state.next_action },
    payload: { note: input.note?.trim() || null },
    occurredAt: now,
  });

  return { ok: true as const, state: serializeOrderOperationState(input.db, state), order };
}

export function buildOperationActionCenterItems(db: DatabaseShape) {
  return db.orders
    .map((order) => ({ order, state: serializeOrderOperationState(db, ensureOrderOperationState(db, order)) }))
    .filter(({ order }) => !["delivered", "cancelled"].includes(order.status))
    .filter(({ state }) => state.is_stuck || state.is_overdue || state.current_stage === "payment_approved")
    .map(({ order, state }) => {
      const severity: "CRITICO" | "ALTO" | "MEDIO" = state.is_stuck ? "CRITICO" : state.current_stage === "payment_approved" ? "ALTO" : state.is_overdue ? "ALTO" : "MEDIO";
      return {
        id: `order-${order.id}`,
        type: "order",
        domain: "Pedidos travados",
        severity,
        title: state.is_stuck ? `Pedido #${order.order_number} travado` : `Pedido #${order.order_number} exige andamento`,
        description: state.is_stuck
          ? state.stuck_reason || "Pedido travado sem motivo detalhado."
          : `Etapa ${state.current_stage} parada acima do SLA operacional.`,
        impact: state.is_stuck ? "Impede o fluxo operacional do pedido." : "Aumenta risco de atraso na separacao ou no atendimento.",
        responsible_suggested: state.current_owner_name || getStageConfig(state.current_stage).ownerLabel,
        owner_role: state.current_owner_role || getStageConfig(state.current_stage).ownerRole,
        sla_minutes: state.stage_sla_minutes,
        overdue: Boolean(state.is_overdue || state.is_stuck),
        recommended_next_action: state.next_action || getStageConfig(state.current_stage).nextAction,
        route: `/admin/pedido/${order.id}`,
        action_label: "Abrir pedido",
        status: state.current_stage,
        created_at: state.created_at,
        updated_at: state.updated_at,
        is_external_blocker: state.waiting_on === "provider" || state.waiting_on === "accountant",
        blocks_homologation: false,
        blocks_go_live: false,
        depends_on_third_party: state.waiting_on === "provider",
        depends_on_human_curation: false,
        depends_on_accountant: state.waiting_on === "accountant",
        depends_on_provider: state.waiting_on === "provider",
        waiting_badge: state.waiting_badge,
      };
    });
}
