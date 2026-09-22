import { createAuditEvent } from "./order-domain";
import {
  createId,
  type DatabaseShape,
  type DbPickingTask,
  type DbPickingTaskItem,
  type DbProduct,
} from "./db";
import { ensureOrderOperationState, serializeOrderOperationState, advanceOrderOperationStage } from "./order-operation-state";

function resolveTaskPriority(productCount: number) {
  if (productCount >= 6) return "high" as const;
  if (productCount >= 3) return "medium" as const;
  return "low" as const;
}

function getTaskStatusRank(status: DbPickingTask["status"]) {
  switch (status) {
    case "blocked":
      return 0;
    case "in_progress":
      return 1;
    case "assigned":
      return 2;
    case "queued":
      return 3;
    default:
      return 4;
  }
}

export function getAdminWmsSummary(db: DatabaseShape) {
  const openTasks = db.pickingTasks.filter((task) => task.status !== "completed");
  const divergentTasks = db.pickingTaskItems.filter((item) => item.status === "divergent");
  return {
    generated_at: new Date().toISOString(),
    metrics: {
      locations: db.stockLocations.filter((entry) => entry.active).length,
      addresses: db.stockAddresses.filter((entry) => entry.active).length,
      open_picking_tasks: openTasks.length,
      assigned_tasks: openTasks.filter((task) => task.assigned_to).length,
      blocked_tasks: openTasks.filter((task) => task.status === "blocked").length,
      in_progress_tasks: openTasks.filter((task) => task.status === "in_progress").length,
      divergent_items: divergentTasks.length,
      orders_waiting_picking: db.orders.filter((order) => ["confirmed", "processing", "in_separation"].includes(order.status)).length,
    },
    queues: {
      ready_for_picking: db.orders
        .filter((order) => ["confirmed", "processing", "in_separation"].includes(order.status))
        .map((order) => {
          const state = serializeOrderOperationState(db, ensureOrderOperationState(db, order));
          return {
            order_id: order.id,
            order_number: order.order_number,
            current_stage: state.current_stage,
            is_stuck: state.is_stuck,
            next_action: state.next_action,
          };
        })
        .slice(0, 12),
    },
  };
}

export function getAdminWmsPickingQueue(db: DatabaseShape) {
  return db.pickingTasks
    .map((task) => {
      const order = db.orders.find((entry) => entry.id === task.order_id) ?? null;
      const items = db.pickingTaskItems.filter((entry) => entry.picking_task_id === task.id);
      const owner = task.assigned_to ? db.users.find((entry) => entry.id === task.assigned_to) ?? null : null;
      return {
        ...task,
        order,
        owner_name: owner?.user_metadata.full_name ?? null,
        items,
        divergent_items: items.filter((item) => item.status === "divergent").length,
      };
    })
    .sort((a, b) => getTaskStatusRank(a.status) - getTaskStatusRank(b.status) || b.updated_at.localeCompare(a.updated_at));
}

export function createPickingTask(input: {
  db: DatabaseShape;
  orderId: string;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const order = input.db.orders.find((entry) => entry.id === input.orderId);
  if (!order) return { ok: false as const, error: "Pedido nao encontrado." };
  const existing = input.db.pickingTasks.find((entry) => entry.order_id === order.id && entry.status !== "completed");
  if (existing) return { ok: true as const, task: existing, reused: true };

  const orderItems = input.db.orderItems.filter((entry) => entry.order_id === order.id);
  const now = new Date().toISOString();
  const task: DbPickingTask = {
    id: createId(),
    order_id: order.id,
    assigned_to: null,
    assigned_role: "separacao_expedicao",
    status: "queued",
    priority: resolveTaskPriority(orderItems.length),
    started_at: null,
    completed_at: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };
  const items: DbPickingTaskItem[] = orderItems.map((item) => ({
    id: createId(),
    picking_task_id: task.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity_required: item.quantity,
    quantity_picked: 0,
    status: "pending",
    divergence_reason: null,
    confirmed_at: null,
  }));

  input.db.pickingTasks.unshift(task);
  input.db.pickingTaskItems.unshift(...items);
  createAuditEvent(input.db, {
    eventType: "wms.picking_task_created",
    orderId: order.id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: order.source_channel,
    newValue: { picking_task_id: task.id, items: items.length },
    occurredAt: now,
  });
  return { ok: true as const, task, items, reused: false };
}

export function assignPickingTask(input: {
  db: DatabaseShape;
  taskId: string;
  userId: string;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const task = input.db.pickingTasks.find((entry) => entry.id === input.taskId);
  if (!task) return { ok: false as const, error: "Tarefa nao encontrada." };
  const owner = input.db.users.find((entry) => entry.id === input.userId && entry.role === "admin");
  if (!owner) return { ok: false as const, error: "Responsavel nao encontrado." };
  task.assigned_to = owner.id;
  task.assigned_role = owner.user_metadata.permission_profile_id ?? "separacao_expedicao";
  task.status = task.status === "queued" ? "assigned" : task.status;
  task.updated_at = new Date().toISOString();
  createAuditEvent(input.db, {
    eventType: "wms.picking_task_assigned",
    orderId: task.order_id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: "integration",
    newValue: { picking_task_id: task.id, assigned_to: task.assigned_to, assigned_role: task.assigned_role },
    occurredAt: task.updated_at,
  });
  return { ok: true as const, task };
}

export function startPickingTask(input: {
  db: DatabaseShape;
  taskId: string;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
}) {
  const task = input.db.pickingTasks.find((entry) => entry.id === input.taskId);
  if (!task) return { ok: false as const, error: "Tarefa nao encontrada." };
  const now = new Date().toISOString();
  task.status = "in_progress";
  task.started_at = task.started_at ?? now;
  task.updated_at = now;
  const order = input.db.orders.find((entry) => entry.id === task.order_id);
  if (order) {
    advanceOrderOperationStage({
      db: input.db,
      orderId: order.id,
      actorId: input.actorId,
      actorName: input.actorName,
      actorProfileId: input.actorProfileId,
      correlationId: input.correlationId,
      nextStage: "in_separation",
      note: "Picking iniciado no WMS basico.",
    });
  }
  return { ok: true as const, task };
}

export function confirmPickingTaskItem(input: {
  db: DatabaseShape;
  taskId: string;
  itemId: string;
  quantityPicked: number;
  divergenceReason?: string | null;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const task = input.db.pickingTasks.find((entry) => entry.id === input.taskId);
  const item = input.db.pickingTaskItems.find((entry) => entry.id === input.itemId && entry.picking_task_id === input.taskId);
  if (!task || !item) return { ok: false as const, error: "Item de picking nao encontrado." };
  item.quantity_picked = input.quantityPicked;
  item.confirmed_at = new Date().toISOString();
  if (input.divergenceReason?.trim() || input.quantityPicked !== item.quantity_required) {
    item.status = "divergent";
    item.divergence_reason = input.divergenceReason?.trim() || "quantidade divergente na separacao";
    task.status = "blocked";
  } else {
    item.status = "picked";
    item.divergence_reason = null;
  }
  task.updated_at = item.confirmed_at;
  createAuditEvent(input.db, {
    eventType: "wms.picking_item_confirmed",
    orderId: task.order_id,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    sourceChannel: "integration",
    newValue: {
      picking_task_id: task.id,
      item_id: item.id,
      quantity_picked: item.quantity_picked,
      status: item.status,
      divergence_reason: item.divergence_reason,
    },
    occurredAt: item.confirmed_at,
  });
  return { ok: true as const, task, item };
}

export function completePickingTask(input: {
  db: DatabaseShape;
  taskId: string;
  actorId: string | null;
  actorName: string | null;
  actorProfileId: string | null;
  correlationId: string;
}) {
  const task = input.db.pickingTasks.find((entry) => entry.id === input.taskId);
  if (!task) return { ok: false as const, error: "Tarefa nao encontrada." };
  const items = input.db.pickingTaskItems.filter((entry) => entry.picking_task_id === task.id);
  if (items.some((item) => item.status === "divergent")) {
    task.status = "blocked";
    task.updated_at = new Date().toISOString();
    return { ok: false as const, error: "Existe divergencia pendente na tarefa de picking." };
  }
  if (items.some((item) => item.status !== "picked")) {
    return { ok: false as const, error: "Confirme todos os itens antes de concluir o picking." };
  }
  const now = new Date().toISOString();
  task.status = "completed";
  task.completed_at = now;
  task.updated_at = now;
  const order = input.db.orders.find((entry) => entry.id === task.order_id);
  if (order) {
    advanceOrderOperationStage({
      db: input.db,
      orderId: order.id,
      actorId: input.actorId,
      actorName: input.actorName,
      actorProfileId: input.actorProfileId,
      correlationId: input.correlationId,
      nextStage: "in_expedition",
      note: "Picking concluido e liberado para expedicao.",
    });
  }
  return { ok: true as const, task, order };
}

export function createStockMovement(input: {
  db: DatabaseShape;
  product: DbProduct;
  quantity: number;
  establishmentId: string;
  movementType: "entrada" | "baixa" | "ajuste";
  reason: string;
}) {
  input.db.inventoryMovements.unshift({
    id: createId(),
    product_id: input.product.id,
    lot_id: null,
    establishment_id: input.establishmentId,
    movement_type: input.movementType,
    quantity: input.quantity,
    order_id: null,
    fiscal_document_id: null,
    notes: input.reason,
    created_at: new Date().toISOString(),
  });
}

export function getAdminWmsInventoryHealth(db: DatabaseShape) {
  return {
    generated_at: new Date().toISOString(),
    metrics: {
      low_stock_products: db.products.filter((entry) => Number(entry.stock) > 0 && Number(entry.stock) <= Number(entry.stock_minimum ?? 5)).length,
      zero_stock_products: db.products.filter((entry) => Number(entry.stock) <= 0).length,
      lots_without_address: db.inventoryLots.length,
      active_locations: db.stockLocations.filter((entry) => entry.active).length,
      blocked_picking_tasks: db.pickingTasks.filter((entry) => entry.status === "blocked").length,
    },
  };
}
