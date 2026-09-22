import type { DatabaseShape, DbProduct } from "./db";

export type FreightCatalogReadinessIssue =
  | "weight"
  | "width"
  | "length_or_depth"
  | "height_or_thickness"
  | "quote_only"
  | "delivery_under_analysis";

export type FreightCatalogReadinessWarning =
  | "heavy_or_bulky"
  | "dimensions_text_only"
  | "packaging_not_closed"
  | "fractional_sale";

export type FreightCatalogReadinessItem = {
  id: string;
  sku: string | null;
  name: string;
  category_id: string | null;
  availability: DbProduct["availability"] | null;
  delivery_type: DbProduct["delivery_type"] | null;
  ready_for_national_freight: boolean;
  missing: FreightCatalogReadinessIssue[];
  warnings: FreightCatalogReadinessWarning[];
  recommended_action: string;
};

export type FreightCatalogReadinessReport = {
  national_freight_ready: boolean;
  scope: "active_catalog";
  generated_at: string;
  summary: {
    total_active_products: number;
    ready_products: number;
    blocked_products: number;
    warning_products: number;
    missing_weight: number;
    missing_dimensions: number;
    quote_only: number;
  };
  blockers: FreightCatalogReadinessItem[];
  warnings: FreightCatalogReadinessItem[];
  next_steps: string[];
};

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function hasFreightWeight(product: Pick<DbProduct, "weight" | "weight_per_unit" | "weight_per_package">) {
  return isPositiveNumber(product.weight) || isPositiveNumber(product.weight_per_unit) || isPositiveNumber(product.weight_per_package);
}

export function hasFreightDimensions(product: Pick<DbProduct, "width" | "height" | "length" | "thickness">) {
  return {
    width: isPositiveNumber(product.width),
    lengthOrDepth: isPositiveNumber(product.length) || isPositiveNumber(product.height),
    heightOrThickness: isPositiveNumber(product.height) || isPositiveNumber(product.thickness),
  };
}

function buildRecommendedAction(missing: FreightCatalogReadinessIssue[], warnings: FreightCatalogReadinessWarning[]) {
  if (missing.includes("quote_only") || missing.includes("delivery_under_analysis")) {
    return "Definir politica de entrega nacional automatica ou manter o item fora do checkout nacional.";
  }
  if (missing.includes("weight") && missing.some((issue) => issue === "width" || issue === "length_or_depth" || issue === "height_or_thickness")) {
    return "Cadastrar peso e dimensoes numericas antes de liberar cotacao nacional.";
  }
  if (missing.includes("weight")) {
    return "Cadastrar peso unitario, peso do produto ou peso por embalagem.";
  }
  if (missing.length > 0) {
    return "Cadastrar largura, comprimento/profundidade e altura/espessura numericas.";
  }
  if (warnings.includes("heavy_or_bulky")) {
    return "Validar limites da transportadora e regra de despacho para produto pesado ou volumoso.";
  }
  if (warnings.includes("packaging_not_closed")) {
    return "Confirmar embalagem de despacho e multiplo de venda para evitar divergencia de cubagem.";
  }
  return "Produto pronto para cotacao nacional automatica.";
}

export function analyzeFreightCatalogProduct(product: DbProduct): FreightCatalogReadinessItem {
  const dimensions = hasFreightDimensions(product);
  const missing: FreightCatalogReadinessIssue[] = [];
  const warnings: FreightCatalogReadinessWarning[] = [];

  if (!hasFreightWeight(product)) missing.push("weight");
  if (!dimensions.width) missing.push("width");
  if (!dimensions.lengthOrDepth) missing.push("length_or_depth");
  if (!dimensions.heightOrThickness) missing.push("height_or_thickness");
  if (product.delivery_type === "quote") missing.push("quote_only");
  if (product.availability === "entrega_sob_analise") missing.push("delivery_under_analysis");

  if (product.is_heavy || product.is_bulky) warnings.push("heavy_or_bulky");
  if (product.dimensions && (!dimensions.width || !dimensions.lengthOrDepth || !dimensions.heightOrThickness)) warnings.push("dimensions_text_only");
  if (product.packaging_closed === false) warnings.push("packaging_not_closed");
  if (product.fractional_sale_allowed) warnings.push("fractional_sale");

  const ready = missing.length === 0;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category_id: product.category_id,
    availability: product.availability ?? null,
    delivery_type: product.delivery_type ?? null,
    ready_for_national_freight: ready,
    missing,
    warnings,
    recommended_action: buildRecommendedAction(missing, warnings),
  };
}

export function getFreightCatalogReadinessReport(db: DatabaseShape): FreightCatalogReadinessReport {
  const activeProducts = db.products.filter((product) => product.is_active && product.status_product !== "inactive");
  const analyzed = activeProducts.map(analyzeFreightCatalogProduct);
  const blockers = analyzed.filter((item) => !item.ready_for_national_freight);
  const warnings = analyzed.filter((item) => item.ready_for_national_freight && item.warnings.length > 0);

  return {
    national_freight_ready: blockers.length === 0,
    scope: "active_catalog",
    generated_at: new Date().toISOString(),
    summary: {
      total_active_products: activeProducts.length,
      ready_products: analyzed.filter((item) => item.ready_for_national_freight).length,
      blocked_products: blockers.length,
      warning_products: warnings.length,
      missing_weight: analyzed.filter((item) => item.missing.includes("weight")).length,
      missing_dimensions: analyzed.filter((item) =>
        item.missing.some((issue) => issue === "width" || issue === "length_or_depth" || issue === "height_or_thickness"),
      ).length,
      quote_only: analyzed.filter((item) => item.missing.includes("quote_only") || item.missing.includes("delivery_under_analysis")).length,
    },
    blockers,
    warnings,
    next_steps:
      blockers.length === 0
        ? [
            "Homologar cotacao Melhor Envio com carrinho real de alto volume",
            "Validar limite de cubagem por transportadora antes do go-live nacional",
          ]
        : [
            "Completar peso e dimensoes numericas dos produtos bloqueados",
            "Separar itens quote-only da venda nacional automatica",
            "Reexecutar npm run freight:catalog:check antes da homologacao de frete",
          ],
  };
}
