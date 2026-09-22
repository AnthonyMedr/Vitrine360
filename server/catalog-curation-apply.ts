import { createId, type DatabaseShape, type DbAuditLog, type DbProduct } from "./db";

export type CatalogCurationDecision =
  | "approve"
  | "manual_review"
  | "reopen"
  | "quarantine"
  | "approve_duplicate"
  | "approve_generic"
  | "approve_metadata"
  | "clear_overrides"
  | "skip";

export type CatalogCurationRow = {
  product_id: string;
  sku?: string | null;
  product_name?: string | null;
  decision?: string | null;
  decision_notes?: string | null;
};

type ApplyOptions = {
  actorName: string;
  actorId?: string | null;
  correlationId?: string;
  apply?: boolean;
};

type ApplyResult = {
  changed: boolean;
  processed: number;
  applied: number;
  skipped: number;
  invalid: Array<{ product_id: string; reason: string }>;
  changes: Array<{ product_id: string; sku: string | null; decision: CatalogCurationDecision }>;
};

function appendAuditOverride(notes: string, tag: "[duplicate-ok]" | "[generic-ok]" | "[metadata-ok]") {
  return notes.includes(tag) ? notes : `${notes.trim()} ${tag}`.trim();
}

function removeAuditOverrides(notes: string) {
  return notes
    .replace(/\[duplicate-ok\]/gi, "")
    .replace(/\[generic-ok\]/gi, "")
    .replace(/\[metadata-ok\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeDecision(input: string | null | undefined): CatalogCurationDecision | null {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return null;
  if (
    value === "approve" ||
    value === "manual_review" ||
    value === "reopen" ||
    value === "quarantine" ||
    value === "approve_duplicate" ||
    value === "approve_generic" ||
    value === "approve_metadata" ||
    value === "clear_overrides" ||
    value === "skip"
  ) {
    return value;
  }
  return null;
}

function buildUpdatedState(product: DbProduct, decision: CatalogCurationDecision, notes: string, now: string) {
  if (decision === "quarantine") {
    return {
      is_active: false,
      is_featured: false,
      status_product: "draft" as const,
      availability: "sob_consulta" as const,
      image_review_status: product.image_review_status === "suspect" ? "suspect" as const : "manual_review" as const,
      image_review_notes: `Quarentena via importacao de curadoria em ${now}. ${notes}`.trim(),
    };
  }

  if (decision === "approve_duplicate") {
    return {
      image_review_status: "approved" as const,
      image_review_notes: appendAuditOverride(`Duplicidade aprovada via importacao de curadoria em ${now}. ${notes}`.trim(), "[duplicate-ok]"),
    };
  }
  if (decision === "approve_generic") {
    return {
      image_review_status: "approved" as const,
      image_review_notes: appendAuditOverride(`Imagem generica aprovada via importacao de curadoria em ${now}. ${notes}`.trim(), "[generic-ok]"),
    };
  }
  if (decision === "approve_metadata") {
    return {
      image_review_status: "approved" as const,
      image_review_notes: appendAuditOverride(`Metadado aprovado via importacao de curadoria em ${now}. ${notes}`.trim(), "[metadata-ok]"),
    };
  }
  if (decision === "clear_overrides") {
    return {
      image_review_status: "manual_review" as const,
      image_review_notes: removeAuditOverrides(`${product.image_review_notes || ""} ${notes}`.trim()),
    };
  }
  if (decision === "approve") {
    return {
      image_review_status: "approved" as const,
      image_review_notes: `Aprovado via importacao de curadoria em ${now}. ${notes}`.trim(),
    };
  }
  if (decision === "reopen") {
    return {
      image_review_status: "manual_review" as const,
      image_review_notes: `Reaberto para revisao via importacao de curadoria em ${now}. ${notes}`.trim(),
    };
  }
  return {
    image_review_status: "manual_review" as const,
    image_review_notes: `Mantido em revisao via importacao de curadoria em ${now}. ${notes}`.trim(),
  };
}

export function applyCatalogCurationRows(db: DatabaseShape, rows: CatalogCurationRow[], options: ApplyOptions): ApplyResult {
  const now = new Date().toISOString();
  const correlationId = options.correlationId || createId();
  const result: ApplyResult = {
    changed: false,
    processed: rows.length,
    applied: 0,
    skipped: 0,
    invalid: [],
    changes: [],
  };

  for (const row of rows) {
    const decision = normalizeDecision(row.decision);
    if (!decision || decision === "skip") {
      result.skipped += 1;
      continue;
    }

    const product = db.products.find((entry) => entry.id === row.product_id);
    if (!product) {
      result.invalid.push({ product_id: row.product_id, reason: "product_not_found" });
      continue;
    }

    const nextState = buildUpdatedState(product, decision, String(row.decision_notes || "").trim(), now);
    result.changes.push({ product_id: product.id, sku: product.sku ?? null, decision });

    if (!options.apply) continue;

    const previousValue = {
      is_active: product.is_active,
      is_featured: product.is_featured,
      status_product: product.status_product ?? null,
      availability: product.availability ?? null,
      image_review_status: product.image_review_status ?? null,
      image_review_notes: product.image_review_notes ?? null,
    };

    Object.assign(product, nextState);

    const auditEntry: DbAuditLog = {
      event_id: createId(),
      event_type: "catalog.image_curation_import_applied",
      occurred_at: now,
      correlation_id: correlationId,
      actor_id: options.actorId ?? null,
      actor_name: options.actorName,
      source_channel: "integration",
      order_id: null,
      previous_value: previousValue,
      new_value: {
        is_active: product.is_active,
        is_featured: product.is_featured,
        status_product: product.status_product ?? null,
        availability: product.availability ?? null,
        image_review_status: product.image_review_status ?? null,
        image_review_notes: product.image_review_notes ?? null,
      },
      payload: {
        product_id: product.id,
        sku: product.sku ?? null,
        product_name: product.name,
        decision,
        imported_notes: row.decision_notes ?? null,
      },
    };
    db.auditLogs.unshift(auditEntry);
    result.applied += 1;
    result.changed = true;
  }

  return result;
}
