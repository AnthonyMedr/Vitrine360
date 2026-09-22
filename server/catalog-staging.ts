import type { DatabaseShape, DbCatalogStagingItem, DbFiscalProfile, DbProduct } from "./db";

export const SOFT_LAUNCH_DEFERRED_SKUS = [
  "411-FORRO-PVC-600M",
  "1079-FORRO-PVC-1200M",
  "232-FORRO-PVC-400M",
  "234-FORRO-PVC-500M",
  "798-FORRO-PVC-600M",
  "408-FORRO-PVC-600M",
  "797-FORRO-PVC-600M",
  "410-FORRO-PVC-600M",
  "1158-FORRO-PVC-600M",
  "413-FORRO-PVC",
  "409-FORRO-PVC",
  "412-FORRO-PVC",
] as const;

export const SOFT_LAUNCH_DEFERRED_SKU_SET = new Set<string>(SOFT_LAUNCH_DEFERRED_SKUS);

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function slugifyCatalogText(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getDefaultFiscalProfile(db: DatabaseShape, productId: string): DbFiscalProfile | null {
  return (
    db.fiscalProfiles.find((entry) => entry.product_id === productId && entry.establishment_id === "est-comercial") ??
    db.fiscalProfiles.find((entry) => entry.product_id === productId) ??
    null
  );
}

function hasDimensions(product: DbProduct | null) {
  if (!product) return false;
  return Boolean(
    product.dimensions ||
      product.measures ||
      (typeof product.width === "number" && typeof product.length === "number") ||
      (typeof product.width === "number" && typeof product.height === "number"),
  );
}

function hasWeight(product: DbProduct | null) {
  if (!product) return false;
  return Boolean(
    (typeof product.weight === "number" && product.weight > 0) ||
      (typeof product.weight_per_unit === "number" && product.weight_per_unit > 0) ||
      (typeof product.weight_per_package === "number" && product.weight_per_package > 0),
  );
}

function isPlaceholderImage(value: string | null | undefined) {
  if (!value) return true;
  return value.includes("placeholder.svg") || value.trim() === "/";
}

export type CatalogPublicationIssue = {
  field: string;
  responsible: "catalogo" | "contador" | "estoque" | "comercial";
  severity: "blocker" | "warning";
  detail: string;
};

export function getProductPublicationIssues(product: DbProduct | null): CatalogPublicationIssue[] {
  const issues: CatalogPublicationIssue[] = [];

  if (!product) {
    issues.push({
      field: "product",
      responsible: "catalogo",
      severity: "blocker",
      detail: "Produto origem nao encontrado para publicacao.",
    });
    return issues;
  }

  if (!product.sku?.trim()) {
    issues.push({ field: "sku", responsible: "catalogo", severity: "blocker", detail: "SKU obrigatorio nao preenchido." });
  }
  if (!product.name?.trim()) {
    issues.push({ field: "name", responsible: "catalogo", severity: "blocker", detail: "Nome do produto obrigatorio nao preenchido." });
  }
  if (!product.category_id) {
    issues.push({ field: "category", responsible: "catalogo", severity: "blocker", detail: "Categoria obrigatoria nao vinculada." });
  }
  if (!product.unit_measure && !product.unit) {
    issues.push({ field: "unit_measure", responsible: "comercial", severity: "blocker", detail: "Unidade de medida obrigatoria nao preenchida." });
  }
  if (!(Number(product.price) > 0)) {
    issues.push({ field: "price", responsible: "comercial", severity: "blocker", detail: "Preco de venda precisa ser maior que zero." });
  }
  if (!(Number(product.stock) > 0)) {
    issues.push({ field: "stock", responsible: "estoque", severity: "blocker", detail: "Estoque disponivel precisa ser maior que zero para publicacao." });
  }
  if (isPlaceholderImage(product.image_url) && (!Array.isArray(product.images) || product.images.every((image) => isPlaceholderImage(image)))) {
    issues.push({ field: "image", responsible: "catalogo", severity: "blocker", detail: "Imagem real obrigatoria; placeholder nao libera publicacao." });
  }
  if (!product.ncm || product.tax_classification_status !== "ready") {
    issues.push({
      field: "fiscal",
      responsible: "contador",
      severity: "blocker",
      detail: "Fiscal minimo pendente: NCM e classificacao fiscal precisam estar prontos.",
    });
  }

  return issues;
}

export function getCatalogPublicationIssues(db: DatabaseShape, item: DbCatalogStagingItem): CatalogPublicationIssue[] {
  const issues: CatalogPublicationIssue[] = [];
  const matchedProduct = item.mapped_product_id ? db.products.find((product) => product.id === item.mapped_product_id) ?? null : null;

  if (!item.sku_base?.trim() && !matchedProduct?.sku?.trim()) {
    issues.push({ field: "sku", responsible: "catalogo", severity: "blocker", detail: "SKU base ou SKU do produto origem obrigatorio." });
  }
  if (!item.normalized_name?.trim() && !matchedProduct?.name?.trim()) {
    issues.push({ field: "name", responsible: "catalogo", severity: "blocker", detail: "Nome normalizado obrigatorio." });
  }
  if (!item.category_name?.trim() && !matchedProduct?.category_id) {
    issues.push({ field: "category", responsible: "catalogo", severity: "blocker", detail: "Categoria obrigatoria para publicacao." });
  }
  if (!((item.suggested_price ?? matchedProduct?.price ?? 0) > 0)) {
    issues.push({ field: "price", responsible: "comercial", severity: "blocker", detail: "Preco sugerido ou preco do produto precisa ser maior que zero." });
  }
  if (!((item.estimated_stock ?? matchedProduct?.stock ?? 0) > 0)) {
    issues.push({ field: "stock", responsible: "estoque", severity: "blocker", detail: "Estoque estimado ou estoque do produto precisa ser maior que zero." });
  }
  if (item.fiscal_pending_fields.length > 0) {
    issues.push({
      field: "fiscal",
      responsible: "contador",
      severity: "blocker",
      detail: `Campos fiscais pendentes: ${item.fiscal_pending_fields.join(", ")}.`,
    });
  }
  if (matchedProduct) {
    issues.push(...getProductPublicationIssues(matchedProduct));
  } else {
    issues.push({
      field: "product_origin",
      responsible: "catalogo",
      severity: "blocker",
      detail: "Publicacao exige produto origem materializado e revisado antes de ir ao ar.",
    });
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}:${issue.responsible}:${issue.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type CatalogSuggestion = {
  family: string | null;
  category_slug: string | null;
  origin_code: string | null;
  ncm: string | null;
  dimensions: string | null;
  weight: number | null;
  confidence: "high" | "medium" | "low" | null;
  notes: string | null;
};

function parseDimensionText(value: string | null) {
  if (!value) return null;
  const normalized = normalizeText(value)
    .replace(/\s+/g, " ")
    .replace(/mts?/gi, "m")
    .replace(/centimetros?/gi, "cm")
    .replace(/milimetros?/gi, "mm")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function inferCatalogSuggestion(item: DbCatalogStagingItem): CatalogSuggestion {
  const haystack = slugifyCatalogText(
    [item.normalized_name, item.category_name, item.subcategory_name, item.brand_name, item.size].filter(Boolean).join(" "),
  );
  const dimensions = parseDimensionText(item.size) ?? parseDimensionText(item.normalized_name.match(/\d+[xX]\d+(?:[xX]\d+)?\s*(?:mm|cm|m)?/)?.[0] ?? null);

  if (haystack.includes("ripado") || haystack.includes("painel-ripado")) {
    return {
      family: "ripados-wpc",
      category_slug: "ripados-wpc",
      origin_code: "1",
      ncm: null,
      dimensions,
      weight: null,
      confidence: haystack.includes("wpc") ? "high" : "medium",
      notes: "Sugestao comercial para linha de ripados; validar NCM e peso com fornecedor/contabilidade.",
    };
  }
  if (haystack.includes("placa") || haystack.includes("chapas-e-placas") || haystack.includes("chapas") || haystack.includes("monocril")) {
    return {
      family: "placas-uv-e-paineis",
      category_slug: "placas-uv",
      origin_code: "0",
      ncm: null,
      dimensions,
      weight: null,
      confidence: haystack.includes("placa") ? "medium" : "low",
      notes: "Sugestao ampla para chapas/placas; separar UV, drywall e policarbonato antes da publicacao.",
    };
  }
  if (haystack.includes("vinil") || haystack.includes("piso")) {
    return {
      family: "pisos-vinilicos",
      category_slug: "pisos-vinilicos",
      origin_code: "0",
      ncm: null,
      dimensions,
      weight: null,
      confidence: "high",
      notes: "Linha comercial de pisos vinilicos; validar composicao e NCM do fabricante.",
    };
  }
  if (haystack.includes("forro") || haystack.includes("canelado") || haystack.includes("colonial") || haystack.includes("cantoneira")) {
    return {
      family: "forros-pvc-e-acabamentos",
      category_slug: "forros-pvc",
      origin_code: "0",
      ncm: null,
      dimensions,
      weight: null,
      confidence: haystack.includes("forro") || haystack.includes("canelado") ? "high" : "medium",
      notes: "Linha comercial de forros e acessorios; validar quais itens ficam no ecommerce principal.",
    };
  }
  if (haystack.includes("laminad")) {
    return {
      family: "tetos-laminados",
      category_slug: "tetos-laminados",
      origin_code: "0",
      ncm: null,
      dimensions,
      weight: null,
      confidence: "high",
      notes: "Linha de tetos laminados; validar NCM e peso por perfil.",
    };
  }

  return {
    family: null,
    category_slug: null,
    origin_code: null,
    ncm: null,
    dimensions,
    weight: null,
    confidence: dimensions ? "low" : null,
    notes: dimensions ? "Medida extraida automaticamente, sem classificacao comercial conclusiva." : null,
  };
}

export function findCatalogMatchedProduct(db: DatabaseShape, normalizedName: string, skuBase: string | null) {
  return (
    db.products.find((product) => skuBase && product.sku === skuBase) ??
    db.products.find((product) => slugifyCatalogText(product.name) === slugifyCatalogText(normalizedName)) ??
    null
  );
}

export function resolveCatalogPendingFields(db: DatabaseShape, matchedProduct: DbProduct | null) {
  const profile = matchedProduct ? getDefaultFiscalProfile(db, matchedProduct.id) : null;

  return ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"].filter((field) => {
    if (!matchedProduct) return true;
    if (field === "ncm") return !(profile?.ncm || matchedProduct.ncm);
    if (field === "origin_code") return !(profile?.origin_code || matchedProduct.origin_code);
    if (field === "fiscal_group") return !(matchedProduct.fiscal_group || matchedProduct.subcategory || matchedProduct.material);
    if (field === "weight") return !hasWeight(matchedProduct);
    if (field === "dimensions") return !hasDimensions(matchedProduct);
    return true;
  });
}

export function refreshCatalogStagingItem(db: DatabaseShape, item: DbCatalogStagingItem) {
  const explicitlyMappedProduct = item.mapped_product_id ? db.products.find((product) => product.id === item.mapped_product_id) ?? null : null;
  const matchedProduct = explicitlyMappedProduct ?? findCatalogMatchedProduct(db, item.normalized_name, item.sku_base);
  const fiscalPendingFields = resolveCatalogPendingFields(db, matchedProduct);
  const suggestion = inferCatalogSuggestion(item);

  item.mapped_product_id = matchedProduct?.id ?? null;
  item.fiscal_pending_fields = fiscalPendingFields;
  item.suggested_family = suggestion.family;
  item.suggested_category_slug = suggestion.category_slug;
  item.suggested_origin_code = suggestion.origin_code;
  item.suggested_ncm = suggestion.ncm;
  item.suggested_dimensions = suggestion.dimensions;
  item.suggested_weight = suggestion.weight;
  item.enrichment_confidence = suggestion.confidence;
  item.enrichment_notes = suggestion.notes;

  if (item.review_status !== "rejected") {
    item.review_status = item.publish_flag && fiscalPendingFields.length === 0 ? "approved" : "review";
  }

  if (fiscalPendingFields.length > 0) {
    item.review_reason = "Cadastro fiscal incompleto para publicacao automatica.";
  } else if (item.review_reason === "Cadastro fiscal incompleto para publicacao automatica.") {
    item.review_reason = null;
  }

  return item;
}

export function refreshCatalogStagingBatch(db: DatabaseShape, ids?: string[]) {
  const targetIds = ids ? new Set(ids) : null;
  let refreshed = 0;

  db.catalogStaging = db.catalogStaging.map((item) => {
    if (targetIds && !targetIds.has(item.id)) return item;
    refreshed += 1;
    return refreshCatalogStagingItem(db, item);
  });

  return {
    refreshed,
    approved: db.catalogStaging.filter((item) => item.review_status === "approved").length,
    review: db.catalogStaging.filter((item) => item.review_status === "review").length,
    rejected: db.catalogStaging.filter((item) => item.review_status === "rejected").length,
  };
}

export function getCatalogStagingSummary(db: DatabaseShape) {
  const byStatus = db.catalogStaging.reduce<Record<string, number>>((acc, item) => {
    acc[item.review_status] = (acc[item.review_status] ?? 0) + 1;
    return acc;
  }, {});

  const byCategory = Object.entries(
    db.catalogStaging.reduce<Record<string, number>>((acc, item) => {
      const key = item.category_name || "Sem categoria";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([category, count]) => ({ category, count }));

  const pendingFields = Object.entries(
    db.catalogStaging.reduce<Record<string, number>>((acc, item) => {
      item.fiscal_pending_fields.forEach((field) => {
        acc[field] = (acc[field] ?? 0) + 1;
      });
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => ({ field, count }));

  const byFamily = Object.entries(
    db.catalogStaging.reduce<Record<string, number>>((acc, item) => {
      const key = item.suggested_family || "sem-familia";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([family, count]) => ({ family, count }));

  return {
    total: db.catalogStaging.length,
    by_status: byStatus,
    by_gate_status: {
      required: db.catalogStaging.filter((item) => item.go_live_gate_status !== "deferred").length,
      deferred: db.catalogStaging.filter((item) => item.go_live_gate_status === "deferred").length,
    },
    ready_to_publish: db.catalogStaging.filter((item) => item.publish_flag && item.review_status === "approved" && item.fiscal_pending_fields.length === 0)
      .length,
    publication_blockers: db.catalogStaging.filter((item) => item.go_live_gate_status !== "deferred" && getCatalogPublicationIssues(db, item).length > 0).length,
    by_category: byCategory,
    by_family: byFamily,
    pending_fields: pendingFields,
  };
}

export function getSoftLaunchDeferredGateReport(db: DatabaseShape) {
  const expected = new Set<string>(SOFT_LAUNCH_DEFERRED_SKUS);
  const trackedItems = db.catalogStaging.filter((item) => item.sku_base && expected.has(item.sku_base));
  const trackedBySku = new Map(trackedItems.map((item) => [item.sku_base, item]));
  const missingFromStaging = SOFT_LAUNCH_DEFERRED_SKUS.filter((sku) => !trackedBySku.has(sku));
  const incorrectlyRequired = trackedItems
    .filter((item) => item.go_live_gate_status !== "deferred")
    .map((item) => ({
      id: item.id,
      sku: item.sku_base,
      produto: item.normalized_name || item.source_name,
      categoria: item.category_name,
      gate_status: item.go_live_gate_status,
      publish_flag: item.publish_flag,
      blockers: getCatalogPublicationIssues(db, item)
        .filter((issue) => issue.severity === "blocker")
        .map((issue) => ({
          field: issue.field,
          responsible: issue.responsible,
          detail: issue.detail,
        })),
    }));

  return {
    ok: missingFromStaging.length === 0 && incorrectlyRequired.length === 0,
    expected_deferred: SOFT_LAUNCH_DEFERRED_SKUS.length,
    tracked_in_staging: trackedItems.length,
    correctly_deferred: trackedItems.filter((item) => item.go_live_gate_status === "deferred").length,
    missing_from_staging: missingFromStaging,
    incorrectly_required: incorrectlyRequired,
    next_steps:
      incorrectlyRequired.length === 0 && missingFromStaging.length === 0
        ? ["Manter os SKUs diferidos fora do primeiro corte ate saneamento de imagem, fiscal e dados comerciais."]
        : [
            "Executar npm run catalog:go-live:defer-blocked para retirar itens incompletos do gate.",
            "Equipe de catalogo deve validar imagem real, SKU, unidade, preco e estoque antes de recolocar o item.",
            "Contador deve validar NCM e classificacao fiscal antes de recolocar o item.",
          ],
  };
}

export function setCatalogStagingGoLiveGate(
  db: DatabaseShape,
  itemIds: string[],
  gateStatus: "required" | "deferred",
  note: string | null,
) {
  const targetIds = new Set(itemIds);
  let changed = 0;

  db.catalogStaging = db.catalogStaging.map((item) => {
    if (!targetIds.has(item.id)) return item;
    if (item.go_live_gate_status === gateStatus && (item.go_live_gate_note ?? null) === (note ?? null)) return item;
    changed += 1;
    return {
      ...item,
      go_live_gate_status: gateStatus,
      go_live_gate_note: note ?? null,
    };
  });

  return { changed };
}

export function alignCatalogStagingGoLiveGateToLaunchBatch(db: DatabaseShape, limit = 24) {
  const launchBatch = getCatalogLaunchBatch(db, limit);
  const requiredIds = new Set(launchBatch.shortlist.map((item) => item.id));
  let changed = 0;

  db.catalogStaging = db.catalogStaging.map((item) => {
    const shouldStayRequired = requiredIds.has(item.id);
    const nextStatus: "required" | "deferred" = shouldStayRequired ? "required" : "deferred";
    const nextNote = shouldStayRequired ? null : "Item fora do lote inicial do go-live controlado.";

    if (item.go_live_gate_status === nextStatus && (item.go_live_gate_note ?? null) === nextNote) {
      return item;
    }

    changed += 1;
    return {
      ...item,
      go_live_gate_status: nextStatus,
      go_live_gate_note: nextNote,
    };
  });

  return {
    changed,
    required: launchBatch.shortlist.length,
    deferred: Math.max(0, db.catalogStaging.length - launchBatch.shortlist.length),
    launch_batch: launchBatch,
  };
}

type CatalogCutCandidate = {
  id: string;
  source_name: string;
  sku_base: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  suggested_family: string | null;
  suggested_price: number | null;
  estimated_stock: number | null;
  mapped_product_id: string | null;
  publish_flag: boolean;
  review_status: DbCatalogStagingItem["review_status"];
  score: number;
  recommended_action: "corte-inicial" | "revisao-comercial" | "fora-do-corte";
  reasons: string[];
};

function scoreCatalogCutCandidate(item: DbCatalogStagingItem): CatalogCutCandidate {
  let score = 0;
  const reasons: string[] = [];
  const normalizedCategory = slugifyCatalogText(item.category_name || "");
  const family = item.suggested_family || "sem-familia";

  if (item.publish_flag) {
    score += 25;
    reasons.push("marcado para importar");
  }
  if ((item.estimated_stock ?? 0) > 0) {
    score += 20;
    reasons.push("estoque de referencia positivo");
  }
  if ((item.suggested_price ?? 0) > 0) {
    score += 20;
    reasons.push("preco sugerido preenchido");
  }
  if (item.mapped_product_id) {
    score += 15;
    reasons.push("ja possui produto relacionado");
  }
  if (item.enrichment_confidence === "high") {
    score += 10;
    reasons.push("familia comercial sugerida com alta confianca");
  } else if (item.enrichment_confidence === "medium") {
    score += 6;
    reasons.push("familia comercial sugerida com media confianca");
  }

  if (
    family !== "sem-familia" ||
    ["forros-pvc", "acamentos", "acessorios", "ripados", "chapas", "pisos-vinilicos", "tetos-laminados"].some((entry) => normalizedCategory.includes(entry))
  ) {
    score += 10;
    reasons.push("categoria ou familia aderente ao ecommerce principal");
  }

  if ((item.category_name || "").toLowerCase() === "outros") {
    score -= 15;
    reasons.push("categoria generica demais");
  }
  if ((item.subcategory_name || "").toLowerCase() === "revisar") {
    score -= 20;
    reasons.push("subcategoria marcada para revisar");
  }

  const recommended_action: CatalogCutCandidate["recommended_action"] =
    score >= 45 && item.publish_flag
      ? "corte-inicial"
      : score >= 25
        ? "revisao-comercial"
        : "fora-do-corte";

  return {
    id: item.id,
    source_name: item.source_name,
    sku_base: item.sku_base,
    category_name: item.category_name,
    subcategory_name: item.subcategory_name,
    suggested_family: item.suggested_family,
    suggested_price: item.suggested_price,
    estimated_stock: item.estimated_stock,
    mapped_product_id: item.mapped_product_id,
    publish_flag: item.publish_flag,
    review_status: item.review_status,
    score,
    recommended_action,
    reasons,
  };
}

export function getCatalogStagingWorkboard(db: DatabaseShape) {
  const scored = db.catalogStaging.map(scoreCatalogCutCandidate).sort((a, b) => b.score - a.score || a.source_name.localeCompare(b.source_name));

  const grouped = {
    corte_inicial: scored.filter((item) => item.recommended_action === "corte-inicial"),
    revisao_comercial: scored.filter((item) => item.recommended_action === "revisao-comercial"),
    fora_do_corte: scored.filter((item) => item.recommended_action === "fora-do-corte"),
  };

  const byCategory = Object.entries(
    grouped.corte_inicial.reduce<Record<string, number>>((acc, item) => {
      const key = item.category_name || "Sem categoria";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

  const byFamily = Object.entries(
    grouped.corte_inicial.reduce<Record<string, number>>((acc, item) => {
      const key = item.suggested_family || "sem-familia";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([family, count]) => ({ family, count }));

  return {
    total: scored.length,
    lanes: {
      corte_inicial: grouped.corte_inicial.length,
      revisao_comercial: grouped.revisao_comercial.length,
      fora_do_corte: grouped.fora_do_corte.length,
    },
    first_cut_candidates: grouped.corte_inicial.slice(0, 24),
    commercial_review_candidates: grouped.revisao_comercial.slice(0, 24),
    hold_candidates: grouped.fora_do_corte.slice(0, 24),
    first_cut_by_category: byCategory,
    first_cut_by_family: byFamily,
    next_steps: [
      grouped.corte_inicial.length > 0 ? `Selecionar os ${Math.min(grouped.corte_inicial.length, 24)} itens mais fortes do corte inicial para saneamento fiscal/comercial.` : null,
      grouped.revisao_comercial.length > 0 ? "Reclassificar os itens de revisao comercial antes de ampliar o mix." : null,
      grouped.fora_do_corte.length > 0 ? "Manter fora do corte os itens genericos, sem familia ou com baixa aderencia comercial." : null,
    ].filter(Boolean),
  };
}

export function getCatalogLaunchBatch(db: DatabaseShape, limit = 12) {
  const workboard = getCatalogStagingWorkboard(db);
  const shortlisted = workboard.first_cut_candidates.slice(0, Math.max(1, limit)).map((candidate, index) => {
    const source = db.catalogStaging.find((item) => item.id === candidate.id);
    return {
      rank: index + 1,
      id: candidate.id,
      source_name: candidate.source_name,
      sku_base: candidate.sku_base,
      category_name: candidate.category_name,
      subcategory_name: candidate.subcategory_name,
      suggested_family: candidate.suggested_family,
      suggested_price: candidate.suggested_price,
      estimated_stock: candidate.estimated_stock,
      mapped_product_id: candidate.mapped_product_id,
      review_status: candidate.review_status,
      score: candidate.score,
      fiscal_pending_fields: source?.fiscal_pending_fields ?? [],
      publication_issues: source ? getCatalogPublicationIssues(db, source) : [],
      enrichment_confidence: source?.enrichment_confidence ?? null,
      enrichment_notes: source?.enrichment_notes ?? null,
      import_notes: source?.import_notes ?? null,
      publish_flag: candidate.publish_flag,
      reasons: candidate.reasons,
    };
  });

  const pendingFieldFrequency = Object.entries(
    shortlisted.reduce<Record<string, number>>((acc, item) => {
      item.fiscal_pending_fields.forEach((field) => {
        acc[field] = (acc[field] ?? 0) + 1;
      });
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => ({ field, count }));

  return {
    generated_at: new Date().toISOString(),
    requested_limit: limit,
    selected: shortlisted.length,
    shortlist: shortlisted,
    pending_field_frequency: pendingFieldFrequency,
    next_steps: [
      shortlisted.length > 0 ? "Fechar primeiro NCM, origem fiscal, grupo fiscal, peso e dimensoes dos itens melhor pontuados." : null,
      shortlisted.length > 0 ? "Publicar o lote inicial apenas apos fiscal/comercial liberar os campos obrigatorios." : null,
      shortlisted.some((item) => !item.mapped_product_id) ? "Criar produto origem para os itens ainda sem mapeamento antes da publicacao." : null,
    ].filter(Boolean),
  };
}
