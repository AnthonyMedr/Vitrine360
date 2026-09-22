import { type DatabaseShape, withRelations } from "./db";
import { getCatalogStagingSummary } from "./catalog-staging";
import { ensureOrderOperationState, serializeOrderOperationState } from "./order-operation-state";

export type AdminFiscalReadiness = {
  scope: "global" | "minimal-go-live";
  ready: boolean;
  blockers: number;
  warnings: number;
  metrics: {
    scoped_products: number;
    establishments: number;
    fiscal_profiles: number;
    pending_fiscal_profiles: number;
    ready_eligible_fiscal_profiles: number;
    inventory_lots: number;
    pending_catalog_items: number;
    fiscal_documents: number;
    pending_fiscal_documents: number;
    deferred_fiscal_documents: number;
    authorize_ready_fiscal_documents: number;
  };
  details: {
    pending_fiscal_profiles: Array<{
      fiscal_profile_id: string;
      product_id: string;
      sku: string | null;
      product_name: string;
      category: string | null;
      missing_fields: string[];
      criticality: "critical" | "high";
      responsible: "contador";
      go_live_impact: string;
      recommended_action: string;
    }>;
    pending_fiscal_documents: Array<{
      id: string;
      order_id: string | null;
      order_number: string | null;
      status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
      provider: "manual" | "nfeio" | "tecnospeed" | "erp";
      criticality: "critical" | "high";
      responsible: "contador" | "financeiro";
      go_live_impact: string;
      recommended_action: string;
    }>;
  };
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
};

export type AdminFiscalWorkboard = {
  scope: "global" | "minimal-go-live";
  generated_at: string;
  metrics: {
    scoped_products: number;
    pending_fiscal_profiles: number;
    ready_eligible_fiscal_profiles: number;
    pending_catalog_items: number;
    pending_fiscal_documents: number;
    deferred_fiscal_documents: number;
    authorize_ready_fiscal_documents: number;
    template_candidate_profiles: number;
    stale_pending_fiscal_documents: number;
    delivered_pending_fiscal_documents: number;
    cancelled_pending_fiscal_documents: number;
  };
  profiles: Array<{
    id: string;
    product_id: string;
    product_name: string;
    establishment_id: string;
    tax_rule_status: "pending" | "ready" | "review";
    missing_fields: string[];
    recommended_action: string;
    updated_at: string;
  }>;
  template_candidates: Array<{
    id: string;
    product_id: string;
    product_name: string;
    establishment_id: string;
    template_fields: string[];
    candidate_targets: number;
    recommended_action: string;
    updated_at: string;
  }>;
  staging: {
    pending_fields: Array<{ field: string; count: number }>;
    by_family: Array<{ family: string; count: number }>;
    by_category: Array<{ category: string; count: number }>;
    samples: Array<{
      id: string;
      normalized_name: string;
      category_name: string | null;
      suggested_family: string | null;
      fiscal_pending_fields: string[];
      enrichment_confidence: "high" | "medium" | "low" | null;
      publish_flag: boolean;
      recommended_action: string;
    }>;
  };
  documents: Array<{
    id: string;
    order_id: string | null;
    order_number: string | null;
    order_status: string | null;
    age_days: number;
    establishment_id: string;
    provider: "manual" | "nfeio" | "tecnospeed" | "erp";
    status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
    go_live_gate_status: "required" | "deferred";
    go_live_gate_note: string | null;
    message: string | null;
    recommended_action: string;
    created_at: string;
  }>;
  deferred_documents: Array<{
    id: string;
    order_id: string | null;
    order_number: string | null;
    order_status: string | null;
    age_days: number;
    establishment_id: string;
    provider: "manual" | "nfeio" | "tecnospeed" | "erp";
    status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
    go_live_gate_status: "required" | "deferred";
    go_live_gate_note: string | null;
    message: string | null;
    recommended_action: string;
    created_at: string;
  }>;
  next_steps: string[];
};

export function listAdminBrands(db: DatabaseShape) {
  return [...db.brands].sort((a, b) => a.name.localeCompare(b.name));
}

export function listAdminStores(db: DatabaseShape) {
  return [...db.stores].sort((a, b) => a.name.localeCompare(b.name));
}

export function listAdminDeliveryZones(db: DatabaseShape) {
  return [...db.deliveryZones].sort((a, b) => a.city.localeCompare(b.city) || a.neighborhood.localeCompare(b.neighborhood));
}

export function listAdminFreightCarriers(db: DatabaseShape) {
  return [...db.freightCarriers].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
}

export function listAdminQuotes(db: DatabaseShape) {
  return [...db.quotes].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAdminQuoteItems(db: DatabaseShape, quoteId: string) {
  return db.quoteItems.filter((item) => item.quote_id === quoteId);
}

export function listAdminLeads(db: DatabaseShape) {
  return [...db.leads].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAdminPayments(db: DatabaseShape) {
  return db.payments
    .map((payment) => ({
      ...payment,
      order: db.orders.find((order) => order.id === payment.order_id) ?? null,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAdminOrders(db: DatabaseShape) {
  return [...db.orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((order) => ({
      ...order,
      operation_state: serializeOrderOperationState(db, ensureOrderOperationState(db, order)),
    }));
}

export function listAdminProducts(db: DatabaseShape) {
  return db.products.map((item) => withRelations(db, item));
}

export function listAdminCategories(db: DatabaseShape) {
  return [...db.categories];
}

export function getAdminFiscalOverview(db: DatabaseShape) {
  const defaultSeller = db.establishments.find((entry) => entry.is_default_seller) ?? null;
  const pendingFiscalProfileRows = db.fiscalProfiles.filter((entry) => entry.tax_rule_status !== "ready");
  const pendingCatalog = db.catalogStaging.filter((entry) => entry.review_status !== "approved").length;
  const pendingDocumentRows = db.fiscalDocuments.filter((entry) => entry.status_sefaz === "pending");

  return {
      seller_model: "single_seller_multi_establishment",
      default_seller: defaultSeller,
      metrics: {
        establishments: db.establishments.length,
        fiscal_profiles: db.fiscalProfiles.length,
        pending_fiscal_profiles: pendingFiscalProfileRows.length,
        ready_eligible_fiscal_profiles: pendingFiscalProfileRows.filter((entry) => hasFiscalProfileReadyData(db, entry)).length,
        inventory_lots: db.inventoryLots.length,
        pending_catalog_items: pendingCatalog,
        fiscal_documents: db.fiscalDocuments.length,
        pending_fiscal_documents: pendingDocumentRows.length,
        deferred_fiscal_documents: pendingDocumentRows.filter((entry) => entry.go_live_gate_status === "deferred").length,
        authorize_ready_fiscal_documents: pendingDocumentRows.filter((entry) => isFiscalDocumentAuthorizeReady(entry)).length,
      },
    };
}

export type AdminFiscalScope = "global" | "minimal-go-live";

function requiresFiscalGoLiveScope(product: DatabaseShape["products"][number]) {
  return product.delivery_type !== "quote" && product.is_on_request !== true && product.availability !== "sob_consulta";
}

function getMinimalGoLiveScope(db: DatabaseShape) {
  const featuredCategoryIds = new Set(db.siteContent.featured_category_ids ?? []);
  const explicitGoLiveProductIds = new Set(db.siteContent.go_live_product_ids ?? []);
  const featuredCategoryNames = new Set(
    db.categories
      .filter((category) => featuredCategoryIds.has(category.id))
      .map((category) => category.name.trim().toLowerCase()),
  );
  const scopedProducts = db.products.filter(
    (product) =>
      product.is_active &&
      product.status_product !== "inactive" &&
      requiresFiscalGoLiveScope(product) &&
      (
        explicitGoLiveProductIds.size > 0
          ? explicitGoLiveProductIds.has(product.id)
          : product.is_featured || (product.category_id ? featuredCategoryIds.has(product.category_id) : false)
      ),
  );
  const scopedProductIds = new Set(scopedProducts.map((product) => product.id));
  const scopedOrderIds = new Set(
    db.orderItems
      .filter((item) => scopedProductIds.has(item.product_id))
      .map((item) => item.order_id),
  );

  return {
    scopedProducts,
    scopedProductIds,
    scopedOrderIds,
    featuredCategoryNames,
  };
}

function hasFiscalProfileReadyData(db: DatabaseShape, profile: DatabaseShape["fiscalProfiles"][number]) {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  const hasTaxCode = Boolean(profile.cst_icms_default || profile.csosn_default);
  const hasWeight = Boolean(product?.weight || product?.weight_per_unit || product?.weight_per_package);
  const hasDimensions = Boolean(
    product?.dimensions ||
      product?.measures ||
      typeof product?.width === "number" ||
      typeof product?.height === "number" ||
      typeof product?.length === "number",
  );

  return Boolean(
    profile.ncm &&
      profile.origin_code &&
      profile.cfop_internal_default &&
      profile.cfop_interstate_default &&
      hasTaxCode &&
      hasWeight &&
      hasDimensions,
  );
}

function isFiscalDocumentAuthorizeReady(document: DatabaseShape["fiscalDocuments"][number]) {
  return Boolean(document.number && document.series && document.access_key && document.cfop_summary);
}

function canApplyFiscalProfileTemplate(
  sourceProduct: DatabaseShape["products"][number] | null,
  targetProduct: DatabaseShape["products"][number] | null,
  sourceProfile: DatabaseShape["fiscalProfiles"][number],
  targetProfile: DatabaseShape["fiscalProfiles"][number],
) {
  if (!sourceProduct || !targetProduct) return false;
  if (sourceProfile.establishment_id !== targetProfile.establishment_id) return false;
  if (sourceProfile.id === targetProfile.id) return false;

  const sameFiscalGroup =
    typeof sourceProduct.fiscal_group === "string" &&
    typeof targetProduct.fiscal_group === "string" &&
    sourceProduct.fiscal_group.trim() &&
    sourceProduct.fiscal_group.trim().toLowerCase() === targetProduct.fiscal_group.trim().toLowerCase();
  const sameCategory = sourceProduct.category_id && targetProduct.category_id && sourceProduct.category_id === targetProduct.category_id;
  const sameSubcategory =
    typeof sourceProduct.subcategory === "string" &&
    typeof targetProduct.subcategory === "string" &&
    sourceProduct.subcategory.trim() &&
    sourceProduct.subcategory.trim().toLowerCase() === targetProduct.subcategory.trim().toLowerCase();

  return Boolean(sameFiscalGroup || sameCategory || sameSubcategory);
}

function listFiscalTemplateFields(profile: DatabaseShape["fiscalProfiles"][number]) {
  return [
    profile.ncm ? "ncm" : null,
    profile.cest ? "cest" : null,
    profile.origin_code ? "origin_code" : null,
    profile.cfop_internal_default ? "cfop_internal_default" : null,
    profile.cfop_interstate_default ? "cfop_interstate_default" : null,
    profile.cst_icms_default ? "cst_icms_default" : null,
    profile.csosn_default ? "csosn_default" : null,
  ].filter((entry): entry is string => Boolean(entry));
}

function getScopedFiscalMetrics(db: DatabaseShape, scope: AdminFiscalScope) {
  if (scope === "global") {
    const pendingProfileRows = db.fiscalProfiles.filter((entry) => entry.tax_rule_status !== "ready");
    const pendingDocumentRows = db.fiscalDocuments.filter((entry) => entry.status_sefaz === "pending");
    const overview = getAdminFiscalOverview(db);
    return {
      ...overview.metrics,
      scoped_products: db.products.length,
      pendingProfileRows,
      readyEligibleProfileRows: pendingProfileRows.filter((entry) => hasFiscalProfileReadyData(db, entry)),
      pendingCatalogRows: db.catalogStaging.filter((entry) => entry.review_status !== "approved"),
      pendingDocumentRows,
      deferredDocumentRows: db.fiscalDocuments.filter((entry) => entry.status_sefaz === "pending" && entry.go_live_gate_status === "deferred"),
      authorizeReadyDocumentRows: pendingDocumentRows.filter((entry) => isFiscalDocumentAuthorizeReady(entry)),
    };
  }

  const scoped = getMinimalGoLiveScope(db);
  const pendingProfileRows = db.fiscalProfiles.filter(
    (entry) => scoped.scopedProductIds.has(entry.product_id) && entry.tax_rule_status !== "ready",
  );
  const pendingCatalogRows = db.catalogStaging.filter((entry) => {
    if (entry.review_status === "approved") return false;
    if (entry.go_live_gate_status === "deferred") return false;
    if (entry.mapped_product_id) return scoped.scopedProductIds.has(entry.mapped_product_id);
    const categoryName = String(entry.category_name || "").trim().toLowerCase();
    return entry.publish_flag && scoped.featuredCategoryNames.has(categoryName);
  });
  const pendingDocumentRows = db.fiscalDocuments.filter(
    (entry) =>
      entry.status_sefaz === "pending" &&
      entry.go_live_gate_status !== "deferred" &&
      !!entry.order_id &&
      scoped.scopedOrderIds.has(entry.order_id),
  );
  const deferredDocumentRows = db.fiscalDocuments.filter(
    (entry) =>
      entry.status_sefaz === "pending" &&
      entry.go_live_gate_status === "deferred" &&
      !!entry.order_id &&
      scoped.scopedOrderIds.has(entry.order_id),
  );
  const readyEligibleProfileRows = pendingProfileRows.filter((entry) => hasFiscalProfileReadyData(db, entry));
  const authorizeReadyDocumentRows = pendingDocumentRows.filter((entry) => isFiscalDocumentAuthorizeReady(entry));

  return {
    establishments: db.establishments.length,
    fiscal_profiles: db.fiscalProfiles.filter((entry) => scoped.scopedProductIds.has(entry.product_id)).length,
    pending_fiscal_profiles: pendingProfileRows.length,
    ready_eligible_fiscal_profiles: readyEligibleProfileRows.length,
    inventory_lots: db.inventoryLots.filter((entry) => scoped.scopedProductIds.has(entry.product_id)).length,
    pending_catalog_items: pendingCatalogRows.length,
    fiscal_documents: db.fiscalDocuments.filter((entry) => !!entry.order_id && scoped.scopedOrderIds.has(entry.order_id)).length,
    pending_fiscal_documents: pendingDocumentRows.length,
    deferred_fiscal_documents: deferredDocumentRows.length,
    authorize_ready_fiscal_documents: authorizeReadyDocumentRows.length,
    scoped_products: scoped.scopedProducts.length,
    pendingProfileRows,
    readyEligibleProfileRows,
    pendingCatalogRows,
    pendingDocumentRows,
    deferredDocumentRows,
    authorizeReadyDocumentRows,
  };
}

export function getAdminFiscalReadiness(db: DatabaseShape, options?: { scope?: AdminFiscalScope }): AdminFiscalReadiness {
  const scope = options?.scope ?? "global";
  const metrics = getScopedFiscalMetrics(db, scope);
  const details = buildFiscalReadinessDetails(db, scope, metrics);
  const metricSummary: AdminFiscalReadiness["metrics"] = {
    scoped_products: metrics.scoped_products,
    establishments: metrics.establishments,
    fiscal_profiles: metrics.fiscal_profiles,
    pending_fiscal_profiles: metrics.pending_fiscal_profiles,
    ready_eligible_fiscal_profiles: metrics.ready_eligible_fiscal_profiles,
    inventory_lots: metrics.inventory_lots,
    pending_catalog_items: metrics.pending_catalog_items,
    fiscal_documents: metrics.fiscal_documents,
    pending_fiscal_documents: metrics.pending_fiscal_documents,
    deferred_fiscal_documents: metrics.deferred_fiscal_documents,
    authorize_ready_fiscal_documents: metrics.authorize_ready_fiscal_documents,
  };
  const defaultSeller = db.establishments.find((entry) => entry.is_default_seller) ?? null;
  const checks = {
    ok: [] as Array<{ item: string; detail: string }>,
    warnings: [] as Array<{ item: string; detail: string }>,
    blockers: [] as Array<{ item: string; detail: string }>,
  };

  if (defaultSeller) {
    checks.ok.push({
      item: "default_seller",
      detail: `Seller padrao definido: ${defaultSeller.trade_name}.`,
    });
  } else {
    checks.warnings.push({
      item: "default_seller",
      detail: "Seller padrao ainda nao definido para a operacao fiscal.",
    });
  }

  if (scope === "minimal-go-live" && metrics.scoped_products === 0) {
    checks.warnings.push({
      item: "scope_products",
      detail: "Nenhum produto entrou no recorte de mix minimo validado.",
    });
  } else {
    checks.ok.push({
      item: "scope_products",
      detail:
        scope === "minimal-go-live"
          ? `${metrics.scoped_products} produtos entram no recorte de mix minimo validado.`
          : `${metrics.scoped_products} produtos considerados no backlog fiscal global.`,
    });
  }

  if (metrics.pending_fiscal_profiles === 0) {
    checks.ok.push({
      item: "fiscal_profiles",
      detail:
        scope === "minimal-go-live"
          ? "Perfis fiscais do mix minimo sem pendencias operacionais."
          : "Perfis fiscais sem pendencias operacionais.",
    });
  } else {
    checks.blockers.push({
      item: "fiscal_profiles",
      detail:
        scope === "minimal-go-live"
          ? `${metrics.pending_fiscal_profiles} perfis fiscais do mix minimo ainda precisam de fechamento.`
          : `${metrics.pending_fiscal_profiles} perfis fiscais ainda precisam de fechamento.`,
    });
  }

  if (metrics.pending_catalog_items === 0) {
    checks.ok.push({
      item: "catalog_staging",
      detail:
        scope === "minimal-go-live"
          ? "Staging do mix minimo sem pendencias fiscais para publicacao."
          : "Catalogo em staging sem pendencias fiscais para publicacao.",
    });
  } else {
    checks.blockers.push({
      item: "catalog_staging",
      detail:
        scope === "minimal-go-live"
          ? `${metrics.pending_catalog_items} itens do mix minimo seguem bloqueados no staging fiscal/comercial.`
          : `${metrics.pending_catalog_items} itens seguem bloqueados no staging fiscal/comercial.`,
    });
  }

  if (metrics.pending_fiscal_documents === 0) {
    checks.ok.push({
      item: "fiscal_documents",
      detail:
        scope === "minimal-go-live"
          ? "Nao ha documento fiscal pendente do mix minimo aguardando tratativa."
          : "Nao ha documento fiscal pendente aguardando tratativa.",
    });
  } else {
    checks.blockers.push({
      item: "fiscal_documents",
      detail:
        scope === "minimal-go-live"
          ? `${metrics.pending_fiscal_documents} documentos fiscais do mix minimo seguem pendentes.`
          : `${metrics.pending_fiscal_documents} documentos fiscais seguem pendentes.`,
    });
  }

  return {
    scope,
    ready: checks.blockers.length === 0,
    blockers: checks.blockers.length,
    warnings: checks.warnings.length,
    metrics: metricSummary,
    details,
    checks,
    next_steps:
      checks.blockers.length === 0
        ? [
            scope === "minimal-go-live"
              ? "Manter o mix minimo validado isolado e revalidar o recorte antes de ampliar o catalogo."
              : "Manter o saneamento fiscal do catalogo antes da publicacao",
            "Revalidar documentos fiscais sempre que um novo fluxo entrar em operacao",
          ]
        : Array.from(
            new Set(
              [
                metrics.pending_fiscal_profiles > 0
                  ? scope === "minimal-go-live"
                    ? "Fechar perfis fiscais pendentes do mix minimo validado"
                    : "Fechar perfis fiscais pendentes"
                  : null,
                scope === "minimal-go-live" && metrics.pending_fiscal_profiles > 0
                  ? "Gerar, validar e aplicar o close pack fiscal antes de reexecutar o gate minimo."
                  : null,
                metrics.pending_catalog_items > 0
                  ? scope === "minimal-go-live"
                    ? "Aprovar itens bloqueados do mix minimo com dados fiscais completos"
                    : "Aprovar itens bloqueados no staging com dados fiscais completos"
                  : null,
                metrics.pending_fiscal_documents > 0
                  ? scope === "minimal-go-live"
                    ? "Concluir a tratativa dos documentos fiscais pendentes do mix minimo"
                    : "Concluir a tratativa dos documentos fiscais pendentes"
                  : null,
              ].filter((step): step is string => Boolean(step)),
            ),
          ),
  };
}

function getFiscalProfileMissingFields(db: DatabaseShape, profile: DatabaseShape["fiscalProfiles"][number]) {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  return [
    !profile.ncm ? "ncm" : null,
    !profile.origin_code ? "origin_code" : null,
    !profile.cfop_internal_default ? "cfop_internal_default" : null,
    !profile.cfop_interstate_default ? "cfop_interstate_default" : null,
    !profile.cst_icms_default && !profile.csosn_default ? "tax_code" : null,
    !(product?.weight || product?.weight_per_unit || product?.weight_per_package) ? "weight" : null,
    !(product?.dimensions || product?.measures || ((typeof product?.width === "number" || typeof product?.height === "number" || typeof product?.length === "number"))) ? "dimensions" : null,
  ].filter((entry): entry is string => Boolean(entry));
}

function buildFiscalReadinessDetails(
  db: DatabaseShape,
  scope: AdminFiscalScope,
  metrics: ReturnType<typeof getScopedFiscalMetrics>,
): AdminFiscalReadiness["details"] {
  const categoryById = new Map(db.categories.map((category) => [category.id, category.name]));
  const profileCriticality = scope === "minimal-go-live" ? "critical" : "high";
  const goLiveImpact =
    scope === "minimal-go-live"
      ? "Bloqueia o soft launch regional do mix minimo ate fechamento fiscal validado."
      : "Bloqueia publicacao ampla e escala estadual/nacional ate saneamento fiscal.";

  return {
    pending_fiscal_profiles: metrics.pendingProfileRows.map((profile) => {
      const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const missingFields = getFiscalProfileMissingFields(db, profile);
      return {
        fiscal_profile_id: profile.id,
        product_id: profile.product_id,
        sku: product?.sku ?? null,
        product_name: product?.name ?? "Produto nao encontrado",
        category: product?.category_id ? categoryById.get(product.category_id) ?? null : null,
        missing_fields: missingFields,
        criticality: profileCriticality,
        responsible: "contador",
        go_live_impact: goLiveImpact,
        recommended_action:
          missingFields.length > 0
            ? `Preencher ${missingFields.join(", ")} somente com validacao contabil/fiscal.`
            : "Revisar a regra fiscal e marcar o perfil como pronto somente apos validacao contabil.",
      };
    }),
    pending_fiscal_documents: metrics.pendingDocumentRows.map((document) => {
      const order = document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null;
      return {
        id: document.id,
        order_id: document.order_id,
        order_number: order?.order_number ?? null,
        status_sefaz: document.status_sefaz,
        provider: document.provider,
        criticality: scope === "minimal-go-live" ? "critical" : "high",
        responsible: document.provider === "manual" ? "contador" : "financeiro",
        go_live_impact:
          scope === "minimal-go-live"
            ? "Bloqueia o gate fiscal do primeiro corte se o pedido estiver no escopo minimo."
            : "Mantem pendencia fiscal operacional que impede go-live amplo.",
        recommended_action:
          document.provider === "manual"
            ? "Emitir no processo fiscal real ou registrar autorizacao/cancelamento manual validado pelo contador."
            : "Reprocessar no provider fiscal e atualizar o status SEFAZ.",
      };
    }),
  };
}

export function getAdminFiscalWorkboard(db: DatabaseShape, options?: { scope?: AdminFiscalScope }): AdminFiscalWorkboard {
  const scope = options?.scope ?? "global";
  const stagingSummary = getCatalogStagingSummary(db);
  const scoped = getMinimalGoLiveScope(db);
  const now = Date.now();
  const pendingProfiles = db.fiscalProfiles
    .filter((entry) => {
      if (entry.tax_rule_status === "ready") return false;
      return scope === "global" ? true : scoped.scopedProductIds.has(entry.product_id);
    })
    .map((profile) => {
      const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const missingFields = getFiscalProfileMissingFields(db, profile);
      return {
        id: profile.id,
        product_id: profile.product_id,
        product_name: product?.name ?? "Produto nao encontrado",
        establishment_id: profile.establishment_id,
        tax_rule_status: profile.tax_rule_status,
        missing_fields: missingFields,
        recommended_action:
          missingFields.length > 0
            ? `Completar ${missingFields.join(", ")} e reclassificar o perfil fiscal.`
            : "Revisar regra fiscal e marcar perfil como pronto.",
        updated_at: profile.updated_at,
      };
    })
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));

  const candidateTargets = db.fiscalProfiles.filter((entry) => {
    if (entry.tax_rule_status === "ready") return false;
    return scope === "global" ? true : scoped.scopedProductIds.has(entry.product_id);
  });

  const templateCandidates = db.fiscalProfiles
    .filter((profile) => {
      const sourceProduct = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const templateFields = listFiscalTemplateFields(profile);
      if (templateFields.length === 0) return false;
      if (scope !== "global" && !scoped.scopedProductIds.has(profile.product_id) && profile.tax_rule_status !== "ready") return false;
      const matches = candidateTargets.filter((targetProfile) => {
        const targetProduct = db.products.find((entry) => entry.id === targetProfile.product_id) ?? null;
        return canApplyFiscalProfileTemplate(sourceProduct, targetProduct, profile, targetProfile);
      }).length;
      return matches > 0;
    })
    .map((profile) => {
      const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const templateFields = listFiscalTemplateFields(profile);
      const matches = candidateTargets.filter((targetProfile) => {
        const targetProduct = db.products.find((entry) => entry.id === targetProfile.product_id) ?? null;
        return canApplyFiscalProfileTemplate(product, targetProduct, profile, targetProfile);
      }).length;

      return {
        id: profile.id,
        product_id: profile.product_id,
        product_name: product?.name ?? "Produto nao encontrado",
        establishment_id: profile.establishment_id,
        template_fields: templateFields,
        candidate_targets: matches,
        recommended_action: `Usar este perfil como modelo para ${matches} perfil(is) semelhante(s) ainda pendente(s).`,
        updated_at: profile.updated_at,
      };
    })
    .sort((a, b) => b.candidate_targets - a.candidate_targets || b.updated_at.localeCompare(a.updated_at));

  const pendingStaging = db.catalogStaging
    .filter((entry) => {
      if (entry.review_status === "approved") return false;
      if (scope !== "global" && entry.go_live_gate_status === "deferred") return false;
      if (scope === "global") return true;
      if (entry.mapped_product_id) return scoped.scopedProductIds.has(entry.mapped_product_id);
      const categoryName = String(entry.category_name || "").trim().toLowerCase();
      return entry.publish_flag && scoped.featuredCategoryNames.has(categoryName);
    })
    .map((item) => ({
      id: item.id,
      normalized_name: item.normalized_name,
      category_name: item.category_name,
      suggested_family: item.suggested_family,
      fiscal_pending_fields: item.fiscal_pending_fields,
      enrichment_confidence: item.enrichment_confidence,
      publish_flag: item.publish_flag,
      recommended_action:
        item.fiscal_pending_fields.length > 0
          ? `Completar ${item.fiscal_pending_fields.join(", ")} antes da publicacao.`
          : "Concluir revisao comercial e aprovar o item no staging.",
      created_at: item.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const pendingDocuments = db.fiscalDocuments
    .filter((entry) => {
      if (entry.status_sefaz !== "pending") return false;
      if (entry.go_live_gate_status === "deferred") return false;
      if (scope === "global") return true;
      return !!entry.order_id && scoped.scopedOrderIds.has(entry.order_id);
    })
    .map((document) => {
      const order = document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null;
      const ageDays = Math.max(0, Math.floor((now - new Date(document.created_at).getTime()) / 86_400_000));
      return {
        id: document.id,
        order_id: document.order_id,
        order_number: order?.order_number ?? null,
        order_status: order?.status ?? null,
        age_days: ageDays,
        establishment_id: document.establishment_id,
        provider: document.provider,
        status_sefaz: document.status_sefaz,
        go_live_gate_status: (document.go_live_gate_status === "deferred" ? "deferred" : "required") as "deferred" | "required",
        go_live_gate_note: document.go_live_gate_note ?? null,
        message: document.message,
        recommended_action:
          document.go_live_gate_status === "deferred"
            ? "Documento retirado do gate do primeiro corte; manter acompanhamento fora do go-live."
            : document.provider === "manual"
            ? "Emitir no provider fiscal real ou registrar autorizacao/cancelamento manual."
            : "Reprocessar envio ao provider fiscal e atualizar status da SEFAZ.",
        created_at: document.created_at,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const deferredDocuments = db.fiscalDocuments
    .filter((entry) => {
      if (entry.status_sefaz !== "pending") return false;
      if (entry.go_live_gate_status !== "deferred") return false;
      if (scope === "global") return true;
      return !!entry.order_id && scoped.scopedOrderIds.has(entry.order_id);
    })
    .map((document) => {
      const order = document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null;
      const ageDays = Math.max(0, Math.floor((now - new Date(document.created_at).getTime()) / 86_400_000));
      return {
        id: document.id,
        order_id: document.order_id,
        order_number: order?.order_number ?? null,
        order_status: order?.status ?? null,
        age_days: ageDays,
        establishment_id: document.establishment_id,
        provider: document.provider,
        status_sefaz: document.status_sefaz,
        go_live_gate_status: "deferred" as const,
        go_live_gate_note: document.go_live_gate_note ?? null,
        message: document.message,
        recommended_action:
          "Documento retirado do gate do primeiro corte; manter acompanhamento e fechamento fora da janela inicial.",
        created_at: document.created_at,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    scope,
    generated_at: new Date().toISOString(),
    metrics: {
      scoped_products: scope === "global" ? db.products.length : scoped.scopedProducts.length,
      pending_fiscal_profiles: pendingProfiles.length,
      ready_eligible_fiscal_profiles: pendingProfiles.filter((profile) => hasFiscalProfileReadyData(db, db.fiscalProfiles.find((entry) => entry.id === profile.id)!)).length,
      pending_catalog_items: pendingStaging.length,
      pending_fiscal_documents: pendingDocuments.length,
      deferred_fiscal_documents: deferredDocuments.length,
      authorize_ready_fiscal_documents: pendingDocuments.filter((document) => {
        const source = db.fiscalDocuments.find((entry) => entry.id === document.id);
        return source ? isFiscalDocumentAuthorizeReady(source) : false;
      }).length,
      template_candidate_profiles: templateCandidates.length,
      stale_pending_fiscal_documents: pendingDocuments.filter((document) => document.age_days >= 3).length,
      delivered_pending_fiscal_documents: pendingDocuments.filter((document) => document.order_status === "delivered").length,
      cancelled_pending_fiscal_documents: pendingDocuments.filter((document) => document.order_status === "cancelled").length,
    },
    profiles: pendingProfiles.slice(0, 20),
    template_candidates: templateCandidates.slice(0, 10),
    staging: {
      pending_fields: stagingSummary.pending_fields.slice(0, 10),
      by_family: stagingSummary.by_family.slice(0, 10),
      by_category: stagingSummary.by_category.slice(0, 10),
      samples: pendingStaging.slice(0, 20),
    },
    documents: pendingDocuments.slice(0, 20),
    deferred_documents: deferredDocuments.slice(0, 20),
    next_steps: [
      scope === "minimal-go-live"
        ? "Fechar primeiro os perfis fiscais do mix minimo validado."
        : "Fechar perfis fiscais pendentes pelos campos faltantes priorizados no workboard.",
      scope === "minimal-go-live"
        ? "Atacar o staging do mix minimo pelos campos mais recorrentes antes de publicar o corte."
        : "Atacar os itens de staging pelos campos mais recorrentes antes de tentar publicar em lote.",
      scope === "minimal-go-live"
        ? "Tratar documentos fiscais do mix minimo e reexecutar npm run fiscal:check -- --scope=minimal-go-live."
        : "Tratar documentos fiscais pendentes e reexecutar npm run fiscal:check.",
    ],
  };
}

export function listAdminFiscalProfiles(db: DatabaseShape) {
  return db.fiscalProfiles
    .map((profile) => ({
      ...profile,
      product: db.products.find((entry) => entry.id === profile.product_id) ?? null,
      establishment: db.establishments.find((entry) => entry.id === profile.establishment_id) ?? null,
    }))
    .sort((a, b) => a.product?.name?.localeCompare(b.product?.name || "") ?? 0);
}

export function listAdminCatalogStaging(db: DatabaseShape, status: string | null) {
  const rows = status ? db.catalogStaging.filter((item) => item.review_status === status) : db.catalogStaging;

  return rows
    .map((item) => ({
      ...item,
      mapped_product: item.mapped_product_id ? db.products.find((product) => product.id === item.mapped_product_id) ?? null : null,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAdminInventoryLots(db: DatabaseShape) {
  return db.inventoryLots.map((lot) => ({
    ...lot,
    product: db.products.find((entry) => entry.id === lot.product_id) ?? null,
    establishment: db.establishments.find((entry) => entry.id === lot.establishment_id) ?? null,
  }));
}

export function listAdminInventoryMovements(db: DatabaseShape) {
  return [...db.inventoryMovements].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAdminFiscalDocuments(db: DatabaseShape) {
  return db.fiscalDocuments.map((document) => ({
    ...document,
    go_live_gate_status: document.go_live_gate_status === "deferred" ? "deferred" : "required",
    go_live_gate_note: document.go_live_gate_note ?? null,
    establishment: db.establishments.find((entry) => entry.id === document.establishment_id) ?? null,
    order: document.order_id ? db.orders.find((entry) => entry.id === document.order_id) ?? null : null,
  }));
}

export function listOrderAuditLogs(db: DatabaseShape, orderId: string) {
  return db.auditLogs.filter((item) => item.order_id === orderId);
}

export function listUserOrders(db: DatabaseShape, userId: string) {
  return db.orders.filter((item) => item.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listOrderItems(db: DatabaseShape, orderId: string) {
  return db.orderItems.filter((item) => item.order_id === orderId);
}

export function getTrackedOrderView(db: DatabaseShape, trackingToken: string) {
  const order = db.orders.find((item) => item.tracking_token === trackingToken) ?? null;
  if (!order) return null;

  return {
    order,
    items: listOrderItems(db, order.id),
  };
}
