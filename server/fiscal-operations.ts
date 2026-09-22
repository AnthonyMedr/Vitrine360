import { type DatabaseShape, type DbFiscalDocument } from "./db";
import { createAuditEvent } from "./order-domain";
import { restoreInventory, settleInventoryForOrder } from "./order-operations";

export const validFiscalDocumentStatuses: Array<DbFiscalDocument["status_sefaz"]> = ["pending", "authorized", "rejected", "cancelled"];
export const validFiscalGoLiveGateStatuses: Array<NonNullable<DbFiscalDocument["go_live_gate_status"]>> = ["required", "deferred"];

export function applyFiscalDocumentStatusUpdate(input: {
  db: DatabaseShape;
  document: DbFiscalDocument;
  nextStatus: DbFiscalDocument["status_sefaz"];
  actorId?: string | null;
  actorName: string | null;
  fallbackCorrelationId: string;
  message?: string | null;
  number?: string | null;
  series?: string | null;
  accessKey?: string | null;
  cfopSummary?: string | null;
}) {
  const { db, document, nextStatus, actorId, actorName, fallbackCorrelationId } = input;
  if (!validFiscalDocumentStatuses.includes(nextStatus)) {
    return { ok: false as const, error: "Status fiscal invalido" };
  }

  const previousValue = {
    status_sefaz: document.status_sefaz,
    number: document.number,
    series: document.series,
    access_key: document.access_key,
    cfop_summary: document.cfop_summary,
  };

  document.status_sefaz = nextStatus;
  if (typeof input.message === "string") document.message = input.message.trim() || null;
  if (typeof input.number === "string") document.number = input.number.trim() || null;
  if (typeof input.series === "string") document.series = input.series.trim() || null;
  if (typeof input.accessKey === "string") document.access_key = input.accessKey.trim() || null;
  if (typeof input.cfopSummary === "string") document.cfop_summary = input.cfopSummary.trim() || null;
  document.issued_at = nextStatus === "authorized" ? new Date().toISOString() : document.issued_at;

  const relatedOrder = document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null;
  if (nextStatus === "authorized" && relatedOrder) {
    settleInventoryForOrder(db, relatedOrder, document.id);
  }
  if (nextStatus === "cancelled" && relatedOrder && relatedOrder.inventory_locked) {
    restoreInventory(db, relatedOrder.id);
    relatedOrder.inventory_locked = false;
    relatedOrder.status = "cancelled";
    relatedOrder.updated_at = new Date().toISOString();
  }

  createAuditEvent(db, {
    eventType:
      nextStatus === "authorized"
        ? "fiscal.document_authorized"
        : nextStatus === "cancelled"
          ? "fiscal.document_cancelled"
          : nextStatus === "rejected"
            ? "fiscal.document_rejected"
            : "fiscal.document_pending",
    orderId: relatedOrder?.id ?? null,
    correlationId: relatedOrder?.correlation_id ?? fallbackCorrelationId,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: relatedOrder?.source_channel ?? "integration",
    previousValue,
    newValue: {
      status_sefaz: document.status_sefaz,
      number: document.number,
      series: document.series,
      access_key: document.access_key,
      cfop_summary: document.cfop_summary,
    },
    payload: { fiscal_document_id: document.id },
    occurredAt: document.issued_at ?? new Date().toISOString(),
  });

  return { ok: true as const, document, relatedOrder };
}

export function applyFiscalDocumentGoLiveGateUpdate(input: {
  db: DatabaseShape;
  document: DbFiscalDocument;
  nextGateStatus: NonNullable<DbFiscalDocument["go_live_gate_status"]>;
  actorId?: string | null;
  actorName: string | null;
  fallbackCorrelationId: string;
  note?: string | null;
}) {
  const { db, document, nextGateStatus, actorId, actorName, fallbackCorrelationId } = input;
  if (!validFiscalGoLiveGateStatuses.includes(nextGateStatus)) {
    return { ok: false as const, error: "Status de gate de go-live invalido" };
  }

  const relatedOrder = document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null;
  const previousValue = {
    go_live_gate_status: document.go_live_gate_status === "deferred" ? "deferred" : "required",
    go_live_gate_note: document.go_live_gate_note ?? null,
  };

  document.go_live_gate_status = nextGateStatus;
  document.go_live_gate_note = typeof input.note === "string" ? input.note.trim() || null : document.go_live_gate_note ?? null;

  createAuditEvent(db, {
    eventType: nextGateStatus === "deferred" ? "fiscal.document_go_live_deferred" : "fiscal.document_go_live_required",
    orderId: relatedOrder?.id ?? null,
    correlationId: relatedOrder?.correlation_id ?? fallbackCorrelationId,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: relatedOrder?.source_channel ?? "integration",
    previousValue,
    newValue: {
      go_live_gate_status: document.go_live_gate_status,
      go_live_gate_note: document.go_live_gate_note,
    },
    payload: { fiscal_document_id: document.id },
  });

  return { ok: true as const, document, relatedOrder };
}
