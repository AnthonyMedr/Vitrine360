import type { DatabaseShape, DbOrder } from "./db";

type ReconciliationSeverity = "attention" | "critical";

type ReconciliationIssue = {
  code: string;
  severity: ReconciliationSeverity;
  message: string;
};

type ReconciliationStatus = "ok" | "attention" | "critical";

export type OrderReconciliationItem = {
  order_id: string;
  order_number: string;
  customer_name: string;
  status: DbOrder["status"];
  payment_status: DbOrder["payment_status"];
  total: number;
  payment_records_count: number;
  fiscal_documents_count: number;
  inventory_movements_count: number;
  overall_status: ReconciliationStatus;
  reconciled: boolean;
  issues: ReconciliationIssue[];
  recommended_action: string | null;
  last_payment_status: string | null;
  fiscal_statuses: string[];
  movement_types: string[];
  updated_at: string;
};

export type ReconciliationDailyReport = {
  generated_at: string;
  period: {
    from: string;
    to: string;
    days: number;
  };
  metrics: {
    orders: number;
    reconciled: number;
    attention: number;
    critical: number;
    unreconciled_value: number;
    approved_payments: number;
    pending_payments: number;
    refunded_payments: number;
  };
  status_breakdown: Array<{ status: DbOrder["status"]; orders: number; total: number }>;
  payment_breakdown: Array<{ status: string; records: number; amount: number }>;
  action_queue: Array<{
    order_id: string;
    order_number: string;
    customer_name: string;
    overall_status: ReconciliationStatus;
    recommended_action: string;
    total: number;
    updated_at: string;
  }>;
  csv_rows: string[][];
};

const operationalStatuses: DbOrder["status"][] = [
  "confirmed",
  "processing",
  "in_separation",
  "in_expedition",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function buildOrderReconciliationItem(db: DatabaseShape, order: DbOrder): OrderReconciliationItem {
  const payments = db.payments.filter((entry) => entry.order_id === order.id);
  const fiscalDocuments = db.fiscalDocuments.filter((entry) => entry.order_id === order.id);
  const inventoryMovements = db.inventoryMovements.filter((entry) => entry.order_id === order.id);
  const issues: ReconciliationIssue[] = [];

  const approvedPayment = payments.some((entry) => entry.status === "approved");
  const refundedPayment = payments.some((entry) => entry.status === "refunded");
  const authorizedFiscalDocument = fiscalDocuments.some((entry) => entry.status_sefaz === "authorized");
  const pendingFiscalDocument = fiscalDocuments.some((entry) => entry.status_sefaz === "pending");
  const cancelledFiscalDocument = fiscalDocuments.some((entry) => entry.status_sefaz === "cancelled");
  const baixaMovement = inventoryMovements.some((entry) => entry.movement_type === "baixa");
  const estornoMovement = inventoryMovements.some((entry) => entry.movement_type === "estorno");
  const lastPayment = [...payments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;

  if (order.payment_status === "approved" && !approvedPayment) {
    issues.push({
      code: "payment_record_missing",
      severity: "critical",
      message: "Pedido aprovado sem registro financeiro correspondente.",
    });
  }

  if (order.payment_status !== "approved" && approvedPayment && order.status !== "cancelled") {
    issues.push({
      code: "payment_status_mismatch",
      severity: "critical",
      message: "Existe pagamento aprovado, mas o pedido nao reflete aprovacao financeira.",
    });
  }

  if (order.payment_status === "approved" && order.status === "payment_approved") {
    issues.push({
      code: "operation_pending_after_payment",
      severity: "attention",
      message: "Pagamento aprovado aguardando andamento operacional do pedido.",
    });
  }

  if (operationalStatuses.includes(order.status) && order.payment_status === "approved") {
    if (!authorizedFiscalDocument) {
      issues.push({
        code: pendingFiscalDocument ? "fiscal_pending" : "fiscal_missing",
        severity: pendingFiscalDocument ? "attention" : "critical",
        message: pendingFiscalDocument
          ? "Documento fiscal ainda pendente para pedido em operacao."
          : "Pedido em operacao sem documento fiscal autorizado.",
      });
    }

    if (!baixaMovement) {
      issues.push({
        code: "inventory_settlement_missing",
        severity: "attention",
        message: "Pedido operacional sem baixa de estoque consolidada.",
      });
    }
  }

  if (order.status === "cancelled") {
    if (order.inventory_locked) {
      issues.push({
        code: "inventory_lock_open",
        severity: "critical",
        message: "Pedido cancelado ainda com estoque bloqueado.",
      });
    }

    if (approvedPayment && !refundedPayment) {
      issues.push({
        code: "refund_pending",
        severity: "attention",
        message: "Pedido cancelado com pagamento aprovado sem registro de estorno/reembolso.",
      });
    }

    if (baixaMovement && !estornoMovement) {
      issues.push({
        code: "inventory_restore_missing",
        severity: "critical",
        message: "Pedido cancelado com baixa registrada e sem estorno de estoque.",
      });
    }

    if (fiscalDocuments.length > 0 && !cancelledFiscalDocument) {
      issues.push({
        code: "fiscal_cancellation_missing",
        severity: "attention",
        message: "Pedido cancelado com documento fiscal sem cancelamento correspondente.",
      });
    }
  }

  const overallStatus: ReconciliationStatus =
    issues.length === 0 ? "ok" : issues.some((entry) => entry.severity === "critical") ? "critical" : "attention";

  return {
    order_id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    status: order.status,
    payment_status: order.payment_status,
    total: order.total,
    payment_records_count: payments.length,
    fiscal_documents_count: fiscalDocuments.length,
    inventory_movements_count: inventoryMovements.length,
    overall_status: overallStatus,
    reconciled: issues.length === 0,
    issues,
    recommended_action: issues[0]?.message ?? null,
    last_payment_status: lastPayment?.status ?? null,
    fiscal_statuses: fiscalDocuments.map((entry) => entry.status_sefaz),
    movement_types: inventoryMovements.map((entry) => entry.movement_type),
    updated_at: order.updated_at,
  };
}

export function getAdminReconciliationSummary(db: DatabaseShape) {
  const items = db.orders
    .map((order) => buildOrderReconciliationItem(db, order))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return {
    generated_at: new Date().toISOString(),
    metrics: {
      orders: items.length,
      reconciled: items.filter((entry) => entry.reconciled).length,
      attention: items.filter((entry) => entry.overall_status === "attention").length,
      critical: items.filter((entry) => entry.overall_status === "critical").length,
    },
    items,
  };
}

export function getAdminOrderReconciliation(db: DatabaseShape, orderId: string) {
  const order = db.orders.find((entry) => entry.id === orderId) ?? null;
  if (!order) return null;
  return buildOrderReconciliationItem(db, order);
}

function addToMap<T extends string>(
  map: Map<T, { key: T; count: number; amount: number }>,
  key: T,
  amount: number,
) {
  const current = map.get(key) ?? { key, count: 0, amount: 0 };
  current.count += 1;
  current.amount += Number(amount || 0);
  map.set(key, current);
}

export function getAdminReconciliationDailyReport(db: DatabaseShape, days = 1): ReconciliationDailyReport {
  const normalizedDays = Math.min(Math.max(Math.floor(days || 1), 1), 31);
  const to = new Date();
  const from = new Date(to.getTime() - normalizedDays * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const orders = db.orders.filter((order) => order.updated_at >= fromIso && order.updated_at <= toIso);
  const orderIds = new Set(orders.map((order) => order.id));
  const items = orders.map((order) => buildOrderReconciliationItem(db, order));
  const payments = db.payments.filter((payment) => orderIds.has(payment.order_id) || (payment.updated_at >= fromIso && payment.updated_at <= toIso));

  const statusMap = new Map<DbOrder["status"], { key: DbOrder["status"]; count: number; amount: number }>();
  orders.forEach((order) => addToMap(statusMap, order.status, order.total));

  const paymentMap = new Map<string, { key: string; count: number; amount: number }>();
  payments.forEach((payment) => addToMap(paymentMap, payment.status, payment.amount));

  const actionQueue = items
    .filter((item) => item.overall_status !== "ok")
    .sort((a, b) => {
      const severity = { critical: 0, attention: 1, ok: 2 } satisfies Record<ReconciliationStatus, number>;
      return severity[a.overall_status] - severity[b.overall_status] || b.updated_at.localeCompare(a.updated_at);
    })
    .slice(0, 50)
    .map((item) => ({
      order_id: item.order_id,
      order_number: item.order_number,
      customer_name: item.customer_name,
      overall_status: item.overall_status,
      recommended_action: item.recommended_action ?? "Revisar pedido no painel de conciliacao.",
      total: item.total,
      updated_at: item.updated_at,
    }));

  return {
    generated_at: new Date().toISOString(),
    period: {
      from: fromIso,
      to: toIso,
      days: normalizedDays,
    },
    metrics: {
      orders: items.length,
      reconciled: items.filter((item) => item.reconciled).length,
      attention: items.filter((item) => item.overall_status === "attention").length,
      critical: items.filter((item) => item.overall_status === "critical").length,
      unreconciled_value: items
        .filter((item) => item.overall_status !== "ok")
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
      approved_payments: payments.filter((payment) => payment.status === "approved").length,
      pending_payments: payments.filter((payment) => ["pending", "initiated"].includes(payment.status)).length,
      refunded_payments: payments.filter((payment) => payment.status === "refunded").length,
    },
    status_breakdown: [...statusMap.values()].map((entry) => ({
      status: entry.key,
      orders: entry.count,
      total: Number(entry.amount.toFixed(2)),
    })),
    payment_breakdown: [...paymentMap.values()].map((entry) => ({
      status: entry.key,
      records: entry.count,
      amount: Number(entry.amount.toFixed(2)),
    })),
    action_queue: actionQueue,
    csv_rows: [
      ["pedido", "cliente", "status_conciliacao", "status_pedido", "status_pagamento", "total", "acao_recomendada", "atualizado_em"],
      ...items.map((item) => [
        item.order_number,
        item.customer_name,
        item.overall_status,
        item.status,
        item.payment_status,
        String(item.total),
        item.recommended_action ?? "",
        item.updated_at,
      ]),
    ],
  };
}
