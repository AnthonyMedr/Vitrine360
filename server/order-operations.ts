import { createId, type DatabaseShape, type DbOrder, type OrderStatus } from "./db";
import { createAuditEvent } from "./order-domain";
import { ensureFiscalDocumentForOrder } from "./payment-domain";

export const validOrderStatuses: OrderStatus[] = [
  "draft",
  "pending",
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
];

const orderStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["draft", "pending", "awaiting_payment", "cancelled"],
  pending: ["pending", "awaiting_payment", "payment_approved", "confirmed", "cancelled"],
  awaiting_payment: ["awaiting_payment", "payment_approved", "confirmed", "cancelled"],
  payment_approved: ["payment_approved", "confirmed", "processing", "cancelled"],
  confirmed: ["confirmed", "processing", "in_separation", "cancelled"],
  processing: ["processing", "in_separation", "in_expedition", "cancelled"],
  in_separation: ["in_separation", "in_expedition", "shipped", "cancelled"],
  in_expedition: ["in_expedition", "shipped", "out_for_delivery", "cancelled"],
  shipped: ["shipped", "out_for_delivery", "delivered"],
  out_for_delivery: ["out_for_delivery", "delivered"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

export function isValidOrderStatus(status: string): status is OrderStatus {
  return validOrderStatuses.includes(status as OrderStatus);
}

export function canTransitionOrderStatus(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  return orderStatusTransitions[currentStatus].includes(nextStatus);
}

export function restoreInventory(db: DatabaseShape, orderId: string) {
  const order = db.orders.find((entry) => entry.id === orderId);
  if (!order) return;
  const now = new Date().toISOString();
  const items = db.orderItems.filter((item) => item.order_id === orderId);
  items.forEach((item) => {
    const product = db.products.find((entry) => entry.id === item.product_id);
    if (product) {
      product.stock += item.quantity;
    }
    if (item.allocated_lot_id) {
      const lot = db.inventoryLots.find((entry) => entry.id === item.allocated_lot_id);
      if (lot) {
        lot.quantity_available += item.quantity;
      }
    }
    db.inventoryMovements.unshift({
      id: createId(),
      product_id: item.product_id,
      lot_id: item.allocated_lot_id ?? null,
      establishment_id: item.seller_establishment_id ?? order.seller_establishment_id ?? "est-comercial",
      movement_type: "estorno",
      quantity: item.quantity,
      order_id: orderId,
      fiscal_document_id: null,
      notes: "Estorno automatico por cancelamento do pedido",
      created_at: now,
    });
  });
}

export function settleInventoryForOrder(db: DatabaseShape, order: DbOrder, fiscalDocumentId: string | null) {
  const now = new Date().toISOString();
  const items = db.orderItems.filter((item) => item.order_id === order.id);

  items.forEach((item) => {
    const alreadySettled = db.inventoryMovements.some(
      (movement) =>
        movement.order_id === order.id &&
        movement.product_id === item.product_id &&
        movement.movement_type === "baixa" &&
        movement.lot_id === (item.allocated_lot_id ?? null),
    );
    if (alreadySettled) return;

    db.inventoryMovements.unshift({
      id: createId(),
      product_id: item.product_id,
      lot_id: item.allocated_lot_id ?? null,
      establishment_id: item.seller_establishment_id ?? order.seller_establishment_id ?? "est-comercial",
      movement_type: "baixa",
      quantity: item.quantity,
      order_id: order.id,
      fiscal_document_id: fiscalDocumentId,
      notes: "Baixa operacional consolidada apos aprovacao fiscal local",
      created_at: now,
    });
  });
}

export function cancelFiscalDocumentsForOrder(db: DatabaseShape, order: DbOrder, actorName: string | null) {
  const now = new Date().toISOString();
  const documents = db.fiscalDocuments.filter((entry) => entry.order_id === order.id);
  documents.forEach((document) => {
    document.status_sefaz = "cancelled";
    document.message = "Documento fiscal cancelado no fluxo administrativo local.";
  });
  if (documents.length === 0) return;

  createAuditEvent(db, {
    eventType: "fiscal.document_cancelled",
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: null,
    actorName: actorName ?? "system",
    sourceChannel: order.source_channel,
    newValue: { fiscal_document_ids: documents.map((entry) => entry.id), status_sefaz: "cancelled" },
    occurredAt: now,
  });
}

export function applyAdminOrderStatusTransition(input: {
  db: DatabaseShape;
  order: DbOrder;
  nextStatus: OrderStatus;
  actorId?: string | null;
  actorName: string | null;
}) {
  const { db, order, nextStatus, actorId, actorName } = input;
  if (!isValidOrderStatus(nextStatus)) {
    return { ok: false as const, error: "Status invalido" };
  }

  if (!canTransitionOrderStatus(order.status, nextStatus)) {
    return { ok: false as const, error: `Transicao invalida de ${order.status} para ${nextStatus}` };
  }

  const previousStatus = order.status;
  if (nextStatus === "cancelled" && order.inventory_locked) {
    restoreInventory(db, order.id);
    order.inventory_locked = false;
  }

  order.status = nextStatus;
  order.updated_at = new Date().toISOString();

  if (
    ["confirmed", "processing", "in_separation", "in_expedition", "shipped", "out_for_delivery", "delivered"].includes(nextStatus) &&
    order.payment_status === "approved"
  ) {
    const document = ensureFiscalDocumentForOrder(db, order, actorName, "authorized");
    settleInventoryForOrder(db, order, document.id);
  } else if (nextStatus === "cancelled") {
    cancelFiscalDocumentsForOrder(db, order, actorName);
  }

  createAuditEvent(db, {
    eventType: nextStatus === "delivered" ? "order.delivered" : nextStatus === "cancelled" ? "order.cancelled" : "order.status_updated",
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: order.source_channel,
    previousValue: { status: previousStatus },
    newValue: { status: nextStatus, inventory_locked: order.inventory_locked },
    occurredAt: order.updated_at,
  });

  return { ok: true as const, order };
}

export function applyAdminOrderManualAction(input: {
  db: DatabaseShape;
  order: DbOrder;
  actorId?: string | null;
  actorName: string | null;
  note: string;
  actionLabel?: string | null;
}) {
  const { db, order, actorId, actorName, note, actionLabel } = input;
  const now = new Date().toISOString();
  order.updated_at = now;
  createAuditEvent(db, {
    eventType: "order.manual_action",
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: order.source_channel,
    payload: {
      action_label: actionLabel || "Registro manual",
      note: note.trim(),
    },
    occurredAt: now,
  });
  return { ok: true as const };
}

export function applyAdminOrderShipmentUpdate(input: {
  db: DatabaseShape;
  order: DbOrder;
  actorId?: string | null;
  actorName: string | null;
  carrier?: string | null;
  service?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
  dispatchedAt?: string | null;
  notes?: string | null;
}) {
  const { db, order, actorId, actorName } = input;
  const now = new Date().toISOString();
  const previousValue = order.shipment ?? null;
  const nextShipment = {
    carrier: input.carrier?.trim() || null,
    service: input.service?.trim() || null,
    tracking_code: input.trackingCode?.trim() || null,
    tracking_url: input.trackingUrl?.trim() || null,
    estimated_delivery_at: input.estimatedDeliveryAt?.trim() || null,
    dispatched_at: input.dispatchedAt?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: now,
    updated_by: actorName,
  };

  if (!nextShipment.carrier && !nextShipment.tracking_code && !nextShipment.tracking_url && !nextShipment.estimated_delivery_at && !nextShipment.dispatched_at) {
    return { ok: false as const, error: "Informe transportadora, codigo de rastreio, prazo ou data de despacho" };
  }

  order.shipment = nextShipment;
  order.updated_at = now;
  const shouldAutoShip = Boolean(nextShipment.tracking_code || nextShipment.dispatched_at);
  if (shouldAutoShip && canTransitionOrderStatus(order.status, "shipped")) {
    const statusTransition = applyAdminOrderStatusTransition({
      db,
      order,
      nextStatus: "shipped",
      actorId,
      actorName,
    });
    if (!statusTransition.ok) {
      return { ok: false as const, error: statusTransition.error };
    }
  }

  createAuditEvent(db, {
    eventType: "order.shipment_updated",
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: order.source_channel,
    previousValue: previousValue as unknown as Record<string, unknown> | null,
    newValue: nextShipment as unknown as Record<string, unknown>,
    occurredAt: now,
  });

  return { ok: true as const, order };
}
