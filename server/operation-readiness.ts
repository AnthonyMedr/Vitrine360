import type { DatabaseShape, OrderStatus } from "./db";
import { listAdminReturnRequests, listAdminSupportTickets } from "./customer-center-operations";
import { getAdminReconciliationSummary } from "./reconciliation-operations";

export type OperationReadinessReport = {
  ready: boolean;
  blockers: number;
  warnings: number;
  metrics: {
    reconciliationCritical: number;
    paymentActionRequired: number;
    expeditionBacklog: number;
    expeditionAttention: number;
    ticketsStale: number;
    ticketsAttention: number;
    returnsStale: number;
    returnsAttention: number;
  };
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
};

function getTicketAttentionThreshold(status: string) {
  return status === "open" ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
}

function getExpeditionDelayThreshold(status: OrderStatus) {
  switch (status) {
    case "out_for_delivery":
      return 24 * 60 * 60 * 1000;
    case "in_separation":
      return 48 * 60 * 60 * 1000;
    default:
      return 72 * 60 * 60 * 1000;
  }
}

export function getOperationReadinessReport(db: DatabaseShape): OperationReadinessReport {
  const reconciliation = getAdminReconciliationSummary(db);
  const activeOrders = db.orders.filter((item) => item.status !== "cancelled");
  const customerReturns = listAdminReturnRequests(db);
  const supportTickets = listAdminSupportTickets(db);

  const unresolvedTickets = supportTickets.filter((entry) => entry.status !== "resolved");
  const staleTicketEntries = unresolvedTickets.filter(
    (entry) => new Date(entry.updatedAt || entry.createdAt).getTime() <= Date.now() - 48 * 60 * 60 * 1000,
  );
  const ticketAttentionEntries = unresolvedTickets.filter(
    (entry) => new Date(entry.updatedAt || entry.createdAt).getTime() <= Date.now() - getTicketAttentionThreshold(entry.status),
  );

  const pendingReturns = customerReturns.filter((entry) =>
    ["open", "review", "approved", "awaiting_shipment", "received"].includes(entry.status),
  );
  const staleReturnThreshold = Date.now() - 72 * 60 * 60 * 1000;
  const returnAttentionEntries = pendingReturns.filter(
    (entry) =>
      entry.method === "refund" ||
      new Date(entry.createdAt).getTime() <= staleReturnThreshold ||
      ["awaiting_shipment", "received"].includes(entry.status),
  );

  const expeditionBacklog = activeOrders.filter((entry) =>
    ["in_separation", "in_expedition", "shipped", "out_for_delivery"].includes(entry.status),
  );
  const expeditionStaleEntries = expeditionBacklog.filter(
    (entry) => new Date(entry.updated_at).getTime() <= Date.now() - getExpeditionDelayThreshold(entry.status),
  );

  const paymentActionRequired = reconciliation.items.filter((entry) =>
    entry.issues.some((issue) => issue.code === "operation_pending_after_payment"),
  );
  const reconciliationCritical = reconciliation.items.filter((entry) => entry.overall_status === "critical");

  const metrics = {
    reconciliationCritical: reconciliationCritical.length,
    paymentActionRequired: paymentActionRequired.length,
    expeditionBacklog: expeditionBacklog.length,
    expeditionAttention: expeditionStaleEntries.length,
    ticketsStale: staleTicketEntries.length,
    ticketsAttention: ticketAttentionEntries.length,
    returnsStale: pendingReturns.filter((entry) => new Date(entry.createdAt).getTime() <= staleReturnThreshold).length,
    returnsAttention: returnAttentionEntries.length,
  };

  const checks = {
    ok: [] as Array<{ item: string; detail: string }>,
    warnings: [] as Array<{ item: string; detail: string }>,
    blockers: [] as Array<{ item: string; detail: string }>,
  };

  if (metrics.reconciliationCritical === 0) {
    checks.ok.push({
      item: "reconciliation",
      detail: "Sem conciliacao critica aberta na operacao atual.",
    });
  } else {
    checks.blockers.push({
      item: "reconciliation",
      detail: `${metrics.reconciliationCritical} pedidos estao em conciliacao critica.`,
    });
  }

  if (metrics.expeditionAttention === 0) {
    checks.ok.push({
      item: "expedition",
      detail: "Sem pedido atrasado em expedicao ou ultima milha.",
    });
  } else {
    checks.warnings.push({
      item: "expedition",
      detail: `${metrics.expeditionAttention} pedidos exigem tratativa logistica imediata.`,
    });
  }

  if (metrics.paymentActionRequired === 0) {
    checks.ok.push({
      item: "payment_action_required",
      detail: "Nenhum pedido pago aguardando acao operacional.",
    });
  } else {
    checks.warnings.push({
      item: "payment_action_required",
      detail: `${metrics.paymentActionRequired} pedidos pagos ainda aguardam andamento operacional.`,
    });
  }

  if (metrics.ticketsAttention === 0 && metrics.returnsAttention === 0) {
    checks.ok.push({
      item: "customer_center",
      detail: "Atendimento e devolucoes sem tratativa critica aberta.",
    });
  } else {
    if (metrics.ticketsAttention > 0) {
      checks.warnings.push({
        item: "customer_tickets",
        detail: `${metrics.ticketsAttention} tickets exigem tratativa imediata.`,
      });
    }
    if (metrics.returnsAttention > 0) {
      checks.warnings.push({
        item: "customer_returns",
        detail: `${metrics.returnsAttention} devolucoes exigem acompanhamento operacional.`,
      });
    }
  }

  return {
    ready: checks.blockers.length === 0,
    blockers: checks.blockers.length,
    warnings: checks.warnings.length,
    metrics,
    checks,
    next_steps:
      checks.blockers.length === 0
        ? [
            "Manter o admin sem backlog critico de conciliacao",
            "Tratar warnings operacionais antes do go-live final",
          ]
        : [
            "Resolver os bloqueios operacionais e de conciliacao",
            "Reexecutar operations:check antes da homologacao final",
          ],
  };
}
