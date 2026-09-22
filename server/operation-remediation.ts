import type { DatabaseShape, DbOrder } from "./db";
import { createAuditEvent, createPaymentRecord } from "./order-domain";
import { applyAdminOrderStatusTransition, settleInventoryForOrder } from "./order-operations";
import { ensureFiscalDocumentForOrder } from "./payment-domain";

const operationalStatuses: DbOrder["status"][] = [
  "confirmed",
  "processing",
  "in_separation",
  "in_expedition",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export type OperationRemediationAction = {
  type: "payment_record_backfill" | "fiscal_document_prepare" | "order_confirmed_after_payment" | "confirmed_order_settled";
  order_id: string;
  order_number: string;
  detail: string;
};

export type OperationRemediationReport = {
  dry_run: boolean;
  changed: boolean;
  actions: OperationRemediationAction[];
  metrics: {
    payment_records_backfilled: number;
    fiscal_documents_prepared: number;
    orders_confirmed_after_payment: number;
    confirmed_orders_settled: number;
  };
  next_steps: string[];
};

export function applyOperationAutoRemediation(
  db: DatabaseShape,
  input: {
    dryRun?: boolean;
    actorId?: string | null;
    actorName: string;
  },
): OperationRemediationReport {
  const dryRun = input.dryRun ?? false;
  const actions: OperationRemediationAction[] = [];
  let paymentRecordsBackfilled = 0;
  let fiscalDocumentsPrepared = 0;
  let ordersConfirmedAfterPayment = 0;
  let confirmedOrdersSettled = 0;

  for (const order of db.orders) {
    const payments = db.payments.filter((entry) => entry.order_id === order.id);
    const hasApprovedPayment = payments.some((entry) => entry.status === "approved");
    const hasFiscalDocument = db.fiscalDocuments.some((entry) => entry.order_id === order.id);
    const hasAuthorizedFiscalDocument = db.fiscalDocuments.some((entry) => entry.order_id === order.id && entry.status_sefaz === "authorized");
    const hasPendingFiscalDocument = db.fiscalDocuments.some((entry) => entry.order_id === order.id && entry.status_sefaz === "pending");
    const hasInventorySettlement = db.inventoryMovements.some(
      (entry) => entry.order_id === order.id && entry.movement_type === "baixa",
    );

    if (order.payment_status === "approved" && !hasApprovedPayment) {
      actions.push({
        type: "payment_record_backfill",
        order_id: order.id,
        order_number: order.order_number,
        detail: "Pedido aprovado sem registro financeiro. Backfill manual preparado.",
      });

      if (!dryRun) {
        const occurredAt = order.payment_approved_at ?? order.updated_at ?? new Date().toISOString();
        createPaymentRecord(db, {
          order,
          provider: "manual",
          method: order.payment_method,
          status: "approved",
          amount: order.total,
          externalReference: order.payment_reference ?? order.order_number,
          occurredAt,
        });
        createAuditEvent(db, {
          eventType: "operations.payment_record_backfilled",
          orderId: order.id,
          correlationId: order.correlation_id,
          actorId: input.actorId ?? null,
          actorName: input.actorName,
          sourceChannel: order.source_channel,
          previousValue: {
            payment_records_count: payments.length,
            payment_status: order.payment_status,
          },
          newValue: {
            payment_records_count: payments.length + 1,
            payment_status: order.payment_status,
            payment_reference: order.payment_reference ?? order.order_number,
          },
          payload: {
            reason: "approved_order_missing_payment_record",
          },
          occurredAt,
        });
      }

      paymentRecordsBackfilled += 1;
    }

    if (operationalStatuses.includes(order.status) && order.payment_status === "approved" && !hasFiscalDocument) {
      actions.push({
        type: "fiscal_document_prepare",
        order_id: order.id,
        order_number: order.order_number,
        detail: "Pedido operacional sem documento fiscal. Preparacao local pendente criada.",
      });

      if (!dryRun) {
        ensureFiscalDocumentForOrder(db, order, input.actorName, "pending");
      }

      fiscalDocumentsPrepared += 1;
    }

    // Orders stuck in payment_approved already have the commercial signal to continue.
    // Moving them to confirmed keeps the local workflow consistent and clears fake operational limbo.
    if (order.payment_status === "approved" && order.status === "payment_approved") {
      actions.push({
        type: "order_confirmed_after_payment",
        order_id: order.id,
        order_number: order.order_number,
        detail: "Pedido pago promovido para confirmado para destravar fiscal local e andamento operacional.",
      });

      if (!dryRun) {
        applyAdminOrderStatusTransition({
          db,
          order,
          nextStatus: "confirmed",
          actorId: input.actorId ?? null,
          actorName: input.actorName,
        });
      }

      ordersConfirmedAfterPayment += 1;
      continue;
    }

    // Confirmed orders with approved payment may still miss local settlement if they were created before
    // the current fiscal/stock automation. We settle them without forcing a further status jump.
    if (order.payment_status === "approved" && order.status === "confirmed" && (!hasAuthorizedFiscalDocument || !hasInventorySettlement)) {
      actions.push({
        type: "confirmed_order_settled",
        order_id: order.id,
        order_number: order.order_number,
        detail: "Pedido confirmado com pagamento aprovado recebeu autorizacao fiscal local e baixa operacional.",
      });

      if (!dryRun) {
        const document = ensureFiscalDocumentForOrder(db, order, input.actorName, "authorized");
        settleInventoryForOrder(db, order, document.id);
        createAuditEvent(db, {
          eventType: "operations.confirmed_order_settled",
          orderId: order.id,
          correlationId: order.correlation_id,
          actorId: input.actorId ?? null,
          actorName: input.actorName,
          sourceChannel: order.source_channel,
          payload: {
            fiscal_document_id: document.id,
            fiscal_status: document.status_sefaz,
            had_pending_fiscal_document: hasPendingFiscalDocument,
            had_inventory_settlement: hasInventorySettlement,
          },
          occurredAt: new Date().toISOString(),
        });
      }

      confirmedOrdersSettled += 1;
    }
  }

  return {
    dry_run: dryRun,
    changed: !dryRun && actions.length > 0,
    actions,
    metrics: {
      payment_records_backfilled: paymentRecordsBackfilled,
      fiscal_documents_prepared: fiscalDocumentsPrepared,
      orders_confirmed_after_payment: ordersConfirmedAfterPayment,
      confirmed_orders_settled: confirmedOrdersSettled,
    },
    next_steps:
      actions.length === 0
        ? ["Sem remediacao automatica disponivel no backlog operacional atual."]
        : [
            "Reexecutar operations:check para validar queda do backlog critico",
            "Homologar os pedidos remediados com financeiro e fiscal antes do go-live",
          ],
  };
}
