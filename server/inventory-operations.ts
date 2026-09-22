import { createId, type DatabaseShape, type DbFiscalDocument, type DbInventoryLot, type DbProduct } from "./db";
import { createAuditEvent } from "./order-domain";

export function applyInventoryTransfer(input: {
  db: DatabaseShape;
  product: DbProduct;
  quantity: number;
  sourceEstablishmentId: string;
  targetEstablishmentId: string;
  notes?: string | null;
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const { db, product, quantity, sourceEstablishmentId, targetEstablishmentId, notes, actorId, actorName, correlationId } = input;
  const source = db.establishments.find((entry) => entry.id === sourceEstablishmentId);
  const target = db.establishments.find((entry) => entry.id === targetEstablishmentId);
  if (!source || !target || source.id === target.id) {
    return { ok: false as const, error: "Informe origem e destino validos para a transferencia" };
  }

  const sourceLots = db.inventoryLots
    .filter((lot) => lot.product_id === product.id && lot.establishment_id === source.id && lot.quantity_available > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sourceAvailable = sourceLots.reduce((sum, lot) => sum + lot.quantity_available, 0);
  if (sourceAvailable < quantity) {
    return { ok: false as const, error: "Saldo insuficiente no estabelecimento de origem" };
  }

  const now = new Date().toISOString();
  const fiscalDocumentId = createId();
  const fiscalDocument: DbFiscalDocument = {
    id: fiscalDocumentId,
    establishment_id: source.id,
    order_id: null,
    document_type: "nfe_transferencia",
    number: null,
    series: "1",
    access_key: null,
    cfop_summary: source.state === target.state ? "5152" : "6152",
    xml_url: null,
    status_sefaz: "pending",
    provider: "manual",
    message: `Transferencia interna preparada de ${source.trade_name} para ${target.trade_name}.`,
    issued_at: null,
    created_at: now,
  };
  db.fiscalDocuments.unshift(fiscalDocument);

  let remaining = quantity;
  let weightedCost = 0;
  for (const lot of sourceLots) {
    if (remaining <= 0) break;
    const transferred = Math.min(lot.quantity_available, remaining);
    lot.quantity_available -= transferred;
    remaining -= transferred;
    weightedCost += transferred * lot.unit_cost;
    db.inventoryMovements.unshift({
      id: createId(),
      product_id: product.id,
      lot_id: lot.id,
      establishment_id: source.id,
      movement_type: "transferencia_out",
      quantity: transferred,
      order_id: null,
      fiscal_document_id: fiscalDocumentId,
      notes: notes?.trim() || `Transferencia interna para ${target.trade_name}`,
      created_at: now,
    });
  }

  const targetLot: DbInventoryLot = {
    id: createId(),
    product_id: product.id,
    establishment_id: target.id,
    source_type: "transferencia",
    source_reference: fiscalDocumentId,
    source_document_number: null,
    quantity_in: quantity,
    quantity_available: quantity,
    unit_cost: quantity > 0 ? Number((weightedCost / quantity).toFixed(2)) : product.cost_price ?? 0,
    landed_cost_unit: quantity > 0 ? Number((weightedCost / quantity).toFixed(2)) : product.cost_price ?? null,
    currency: "BRL",
    created_at: now,
  };
  db.inventoryLots.unshift(targetLot);
  db.inventoryMovements.unshift({
    id: createId(),
    product_id: product.id,
    lot_id: targetLot.id,
    establishment_id: target.id,
    movement_type: "transferencia_in",
    quantity,
    order_id: null,
    fiscal_document_id: fiscalDocumentId,
    notes: notes?.trim() || `Recebimento interno de ${source.trade_name}`,
    created_at: now,
  });

  if (source.can_sell) {
    product.stock = Math.max(product.stock - quantity, 0);
  }
  if (target.can_sell) {
    product.stock += quantity;
  }

  createAuditEvent(db, {
    eventType: "inventory.transfer_created",
    orderId: null,
    correlationId,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: "integration",
    payload: {
      product_id: product.id,
      product_name: product.name,
      quantity,
      source_establishment_id: source.id,
      target_establishment_id: target.id,
      fiscal_document_id: fiscalDocumentId,
    },
    occurredAt: now,
  });

  return {
    ok: true as const,
    fiscalDocument,
    targetLot,
  };
}
