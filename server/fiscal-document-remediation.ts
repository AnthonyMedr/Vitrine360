import type { DatabaseShape } from "./db";
import { applyFiscalDocumentGoLiveGateUpdate } from "./fiscal-operations";

export type FiscalDocumentRemediationAction = {
  type: "cancelled_order_document_deferred";
  reference_id: string;
  order_id: string;
  order_number: string;
  detail: string;
};

export type FiscalDocumentRemediationReport = {
  dry_run: boolean;
  changed: boolean;
  actions: FiscalDocumentRemediationAction[];
  metrics: {
    cancelled_documents_deferred: number;
  };
  next_steps: string[];
};

export function applyFiscalDocumentAutoRemediation(
  db: DatabaseShape,
  input: {
    dryRun?: boolean;
    actorId?: string | null;
    actorName: string;
    fallbackCorrelationId: string;
  },
): FiscalDocumentRemediationReport {
  const dryRun = input.dryRun ?? false;
  const actions: FiscalDocumentRemediationAction[] = [];
  let cancelledDocumentsDeferred = 0;

  for (const document of db.fiscalDocuments) {
    if (document.status_sefaz !== "pending") continue;
    if (document.go_live_gate_status === "deferred") continue;
    if (!document.order_id) continue;

    const order = db.orders.find((entry) => entry.id === document.order_id);
    if (!order || order.status !== "cancelled") continue;

    actions.push({
      type: "cancelled_order_document_deferred",
      reference_id: document.id,
      order_id: order.id,
      order_number: order.order_number,
      detail: `Documento ${document.id} do pedido cancelado ${order.order_number} pode sair do gate do primeiro corte.`,
    });
    cancelledDocumentsDeferred += 1;

    if (!dryRun) {
      applyFiscalDocumentGoLiveGateUpdate({
        db,
        document,
        nextGateStatus: "deferred",
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        fallbackCorrelationId: input.fallbackCorrelationId,
        note: "Documento de pedido cancelado retirado automaticamente do gate do primeiro corte.",
      });
    }
  }

  return {
    dry_run: dryRun,
    changed: !dryRun && actions.length > 0,
    actions,
    metrics: {
      cancelled_documents_deferred: cancelledDocumentsDeferred,
    },
    next_steps:
      actions.length > 0
        ? [
            "Reexecutar fiscal:check:minimal para validar a queda das pendencias do corte minimo",
            "Revisar manualmente documentos restantes de pedidos ativos antes do go-live",
          ]
        : ["Nenhum documento fiscal cancelado e pendente estava elegivel para remediacao segura."],
  };
}
