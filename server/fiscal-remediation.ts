import type { DatabaseShape } from "./db";
import { refreshCatalogStagingItem } from "./catalog-staging";
import { applyFiscalDocumentStatusUpdate } from "./fiscal-operations";
import { createAuditEvent } from "./order-domain";

export type FiscalRemediationAction = {
  type: "profile_synced_from_product" | "profile_marked_ready" | "staging_item_refreshed" | "fiscal_document_authorized";
  reference_id: string;
  detail: string;
};

export type FiscalRemediationReport = {
  dry_run: boolean;
  changed: boolean;
  actions: FiscalRemediationAction[];
  metrics: {
    profiles_synced_from_product: number;
    profiles_marked_ready: number;
    staging_items_refreshed: number;
    fiscal_documents_authorized: number;
  };
  next_steps: string[];
};

function hasDimensions(product: DatabaseShape["products"][number] | null) {
  if (!product) return false;
  return Boolean(
    product.dimensions ||
      product.measures ||
      (typeof product.width === "number" && typeof product.length === "number") ||
      (typeof product.width === "number" && typeof product.height === "number"),
  );
}

function hasWeight(product: DatabaseShape["products"][number] | null) {
  if (!product) return false;
  return Boolean(
    (typeof product.weight === "number" && product.weight > 0) ||
      (typeof product.weight_per_unit === "number" && product.weight_per_unit > 0) ||
      (typeof product.weight_per_package === "number" && product.weight_per_package > 0),
  );
}

function getProfileMissingFields(db: DatabaseShape, profile: DatabaseShape["fiscalProfiles"][number]) {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  return [
    !profile.ncm ? "ncm" : null,
    !profile.origin_code ? "origin_code" : null,
    !profile.cfop_internal_default ? "cfop_internal_default" : null,
    !profile.cfop_interstate_default ? "cfop_interstate_default" : null,
    !profile.cst_icms_default && !profile.csosn_default ? "tax_code" : null,
    !hasWeight(product) ? "weight" : null,
    !hasDimensions(product) ? "dimensions" : null,
  ].filter((entry): entry is string => Boolean(entry));
}

export function applyFiscalAutoRemediation(
  db: DatabaseShape,
  input: {
    dryRun?: boolean;
    actorId?: string | null;
    actorName: string;
    fallbackCorrelationId: string;
  },
): FiscalRemediationReport {
  const dryRun = input.dryRun ?? false;
  const actions: FiscalRemediationAction[] = [];
  let profilesSyncedFromProduct = 0;
  let profilesMarkedReady = 0;
  let stagingItemsRefreshed = 0;
  let fiscalDocumentsAuthorized = 0;

  for (const profile of db.fiscalProfiles) {
    const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
    if (!product) continue;

    const previous = {
      ncm: profile.ncm,
      cest: profile.cest,
      origin_code: profile.origin_code,
      tax_rule_status: profile.tax_rule_status,
    };
    const effectiveProfile = {
      ...profile,
      ncm: profile.ncm,
      cest: profile.cest,
      origin_code: profile.origin_code,
    };

    let synced = false;
    if (!profile.ncm && product.ncm) {
      if (!dryRun) profile.ncm = product.ncm;
      effectiveProfile.ncm = product.ncm;
      synced = true;
    }
    if (!profile.cest && product.cest) {
      if (!dryRun) profile.cest = product.cest;
      effectiveProfile.cest = product.cest;
      synced = true;
    }
    if (!profile.origin_code && product.origin_code) {
      if (!dryRun) profile.origin_code = product.origin_code;
      effectiveProfile.origin_code = product.origin_code;
      synced = true;
    }

    if (synced) {
      actions.push({
        type: "profile_synced_from_product",
        reference_id: profile.id,
        detail: `Perfil ${profile.id} sincronizado com dados fiscais ja existentes no produto ${product.name}.`,
      });
      profilesSyncedFromProduct += 1;
      if (!dryRun) {
        profile.updated_at = new Date().toISOString();
        createAuditEvent(db, {
          eventType: "fiscal.profile_synced_from_product",
          orderId: null,
          correlationId: input.fallbackCorrelationId,
          actorId: input.actorId ?? null,
          actorName: input.actorName,
          sourceChannel: "integration",
          previousValue: previous,
          newValue: {
            ncm: profile.ncm,
            cest: profile.cest,
            origin_code: profile.origin_code,
            tax_rule_status: profile.tax_rule_status,
          },
          payload: { fiscal_profile_id: profile.id, product_id: profile.product_id },
        });
      }
    }

    const profileIndex = db.fiscalProfiles.findIndex((entry) => entry.id === profile.id);
    const originalProfile = db.fiscalProfiles[profileIndex];
    if (profileIndex >= 0) {
      db.fiscalProfiles[profileIndex] = effectiveProfile;
    }
    const missingFields = getProfileMissingFields(db, effectiveProfile);
    if (profileIndex >= 0) {
      db.fiscalProfiles[profileIndex] = originalProfile;
    }
    if (profile.tax_rule_status !== "ready" && missingFields.length === 0) {
      actions.push({
        type: "profile_marked_ready",
        reference_id: profile.id,
        detail: `Perfil ${profile.id} ficou completo e pode ser marcado como pronto.`,
      });
      profilesMarkedReady += 1;
      if (!dryRun) {
        profile.tax_rule_status = "ready";
        profile.updated_at = new Date().toISOString();
        product.tax_classification_status = "ready";
        createAuditEvent(db, {
          eventType: "fiscal.profile_auto_ready",
          orderId: null,
          correlationId: input.fallbackCorrelationId,
          actorId: input.actorId ?? null,
          actorName: input.actorName,
          sourceChannel: "integration",
          previousValue: { tax_rule_status: previous.tax_rule_status },
          newValue: { tax_rule_status: profile.tax_rule_status },
          payload: { fiscal_profile_id: profile.id, product_id: profile.product_id },
        });
      }
    }
  }

  for (const item of db.catalogStaging) {
    const before = {
      review_status: item.review_status,
      review_reason: item.review_reason,
      mapped_product_id: item.mapped_product_id,
      fiscal_pending_fields: [...item.fiscal_pending_fields],
      suggested_family: item.suggested_family,
      suggested_category_slug: item.suggested_category_slug,
      suggested_origin_code: item.suggested_origin_code,
      suggested_ncm: item.suggested_ncm,
    };
    if (!dryRun) {
      refreshCatalogStagingItem(db, item);
    } else {
      const draft = structuredClone(item);
      refreshCatalogStagingItem(db, draft);
      item.review_status = before.review_status;
      item.review_reason = before.review_reason;
      item.mapped_product_id = before.mapped_product_id;
      item.fiscal_pending_fields = before.fiscal_pending_fields;
      item.suggested_family = before.suggested_family;
      item.suggested_category_slug = before.suggested_category_slug;
      item.suggested_origin_code = before.suggested_origin_code;
      item.suggested_ncm = before.suggested_ncm;
      if (
        draft.review_status !== before.review_status ||
        draft.review_reason !== before.review_reason ||
        draft.mapped_product_id !== before.mapped_product_id ||
        draft.fiscal_pending_fields.join("|") !== before.fiscal_pending_fields.join("|") ||
        draft.suggested_family !== before.suggested_family ||
        draft.suggested_category_slug !== before.suggested_category_slug ||
        draft.suggested_origin_code !== before.suggested_origin_code ||
        draft.suggested_ncm !== before.suggested_ncm
      ) {
        actions.push({
          type: "staging_item_refreshed",
          reference_id: item.id,
          detail: `Item ${item.normalized_name} teria o staging fiscal recalculado com os dados atuais.`,
        });
        stagingItemsRefreshed += 1;
      }
      continue;
    }

    if (
      item.review_status !== before.review_status ||
      item.review_reason !== before.review_reason ||
      item.mapped_product_id !== before.mapped_product_id ||
      item.fiscal_pending_fields.join("|") !== before.fiscal_pending_fields.join("|") ||
      item.suggested_family !== before.suggested_family ||
      item.suggested_category_slug !== before.suggested_category_slug ||
      item.suggested_origin_code !== before.suggested_origin_code ||
      item.suggested_ncm !== before.suggested_ncm
    ) {
      actions.push({
        type: "staging_item_refreshed",
        reference_id: item.id,
        detail: `Item ${item.normalized_name} teve o staging fiscal recalculado com os dados atuais.`,
      });
      stagingItemsRefreshed += 1;
      createAuditEvent(db, {
        eventType: "catalog_staging.item_auto_refreshed",
        orderId: null,
        correlationId: input.fallbackCorrelationId,
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        sourceChannel: "integration",
        previousValue: before,
        newValue: {
          review_status: item.review_status,
          review_reason: item.review_reason,
          mapped_product_id: item.mapped_product_id,
          fiscal_pending_fields: item.fiscal_pending_fields,
        },
        payload: { staging_item_id: item.id },
      });
    }
  }

  for (const document of db.fiscalDocuments) {
    if (document.status_sefaz !== "pending") continue;
    if (!document.number || !document.access_key) continue;

    actions.push({
      type: "fiscal_document_authorized",
      reference_id: document.id,
      detail: `Documento ${document.id} ja possui numero e chave e pode ser marcado como autorizado.`,
    });
    fiscalDocumentsAuthorized += 1;

    if (!dryRun) {
      applyFiscalDocumentStatusUpdate({
        db,
        document,
        nextStatus: "authorized",
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        fallbackCorrelationId: input.fallbackCorrelationId,
        message: document.message ?? "Documento autorizado a partir de metadado ja registrado.",
        number: document.number,
        accessKey: document.access_key,
      });
    }
  }

  return {
    dry_run: dryRun,
    changed: !dryRun && actions.length > 0,
    actions,
    metrics: {
      profiles_synced_from_product: profilesSyncedFromProduct,
      profiles_marked_ready: profilesMarkedReady,
      staging_items_refreshed: stagingItemsRefreshed,
      fiscal_documents_authorized: fiscalDocumentsAuthorized,
    },
    next_steps:
      actions.length === 0
        ? ["Sem remediacao fiscal automatica segura disponivel no estado atual.", "Seguir pelo workboard fiscal para tratativa manual dos bloqueadores restantes."]
        : [
            "Reexecutar npm run fiscal:check para medir a queda do backlog.",
            "Validar no workboard fiscal se os itens recalculados sairam da fila critica.",
          ],
  };
}
