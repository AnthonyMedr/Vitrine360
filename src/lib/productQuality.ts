import type { CatalogImageAuditItem } from "./catalogImageAudit";

type ProductQualityInput = {
  id: string;
  name?: string | null;
  slug?: string | null;
  sku?: string | null;
  category_id?: string | null;
  price?: number | null;
  stock?: number | null;
  short_description?: string | null;
  description?: string | null;
  application?: string | null;
  material?: string | null;
  unit?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  image_alt_text?: string | null;
  image_review_notes?: string | null;
  ncm?: string | null;
  origin_code?: string | null;
  tax_classification_status?: string | null;
  weight?: number | null;
  weight_per_unit?: number | null;
  weight_per_package?: number | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  dimensions?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  availability?: string | null;
};

export type ProductQualityDimension =
  | "commercial"
  | "visual"
  | "seo"
  | "fiscal"
  | "operational"
  | "campaign";

export type ProductQualityDetail = {
  label: string;
  score: number;
  blockers: string[];
  warnings: string[];
};

export type ProductQualityScore = {
  product_id: string;
  product_completeness_score: number;
  commercial_score: number;
  visual_score: number;
  seo_score: number;
  fiscal_score: number;
  operational_score: number;
  campaign_score: number;
  dimensions: Record<ProductQualityDimension, ProductQualityDetail>;
  ready_for_publication: boolean;
  ready_for_campaign: boolean;
  ready_for_home: boolean;
  ready_for_traffic: boolean;
  ready_for_assisted_operation: boolean;
  ready_for_open_go_live: boolean;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasRealProductImage(input: Pick<ProductQualityInput, "image_url" | "images">) {
  const images = [input.image_url, ...(input.images ?? [])]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (images.length === 0) return false;
  return images.some((image) => !image.toLowerCase().includes("placeholder"));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isVisualQuarantineNote(notes: string | null | undefined) {
  const note = String(notes || "");
  return note.includes("Retirado de publicação") || normalizeText(note).includes("retirado de publicação");
}

function buildDetail(label: string, checks: Array<{ ok: boolean; message: string; warning?: boolean }>) {
  const blockers = checks.filter((item) => !item.ok && !item.warning).map((item) => item.message);
  const warnings = checks.filter((item) => !item.ok && item.warning).map((item) => item.message);
  const penalty = blockers.length * 20 + warnings.length * 8;
  return {
    label,
    score: clampScore(100 - penalty),
    blockers,
    warnings,
  };
}

export function computeProductQualityScore(product: ProductQualityInput, audit?: CatalogImageAuditItem | null): ProductQualityScore {
  const commercial = buildDetail("Comercial", [
    { ok: Boolean(product.name), message: "nome comercial ausente" },
    { ok: Boolean(product.slug), message: "slug ausente" },
    { ok: Boolean(product.sku), message: "sku ausente" },
    { ok: Boolean(product.category_id), message: "categoria ausente" },
    { ok: Number(product.price ?? 0) > 0, message: "preço ausente" },
    { ok: Boolean(product.short_description || product.description), message: "descrição comercial ausente" },
    { ok: Boolean(product.application || product.material), message: "aplicação/material ausente", warning: true },
  ]);

  const visual = buildDetail("Visual", [
    { ok: hasRealProductImage(product), message: "imagem principal ausente" },
    { ok: Boolean(String(product.image_alt_text || "").trim()), message: "alt text ausente", warning: true },
    { ok: audit?.audit_status !== "critical", message: "imagem critica" },
    { ok: audit?.audit_status !== "suspect", message: "imagem suspeita", warning: true },
    { ok: !isVisualQuarantineNote(product.image_review_notes), message: "produto em quarentena visual" },
  ]);

  const seo = buildDetail("SEO", [
    { ok: Boolean(product.slug), message: "slug ausente" },
    { ok: Boolean(product.short_description || product.description), message: "descrição seo ausente" },
    { ok: Boolean(String(product.image_alt_text || "").trim()), message: "alt text ausente", warning: true },
  ]);

  const fiscal = buildDetail("Fiscal", [
    { ok: Boolean(product.ncm), message: "ncm ausente" },
    { ok: Boolean(product.origin_code), message: "origem fiscal ausente", warning: true },
    { ok: product.tax_classification_status === "ready", message: "classificacao fiscal não pronta" },
  ]);

  const operational = buildDetail("Operacional", [
    { ok: Boolean(product.unit), message: "unidade de venda ausente" },
    { ok: Number(product.stock ?? 0) >= 0, message: "estoque invalido" },
    {
      ok:
        typeof product.weight === "number" ||
        typeof product.weight_per_unit === "number" ||
        typeof product.weight_per_package === "number",
      message: "peso ausente",
      warning: true,
    },
    {
      ok:
        Boolean(product.dimensions) ||
        typeof product.width === "number" ||
        typeof product.height === "number" ||
        typeof product.length === "number",
      message: "dimensoes ausentes",
      warning: true,
    },
  ]);

  const readyForPublication =
    Boolean(product.is_active) &&
    commercial.blockers.length === 0 &&
    visual.blockers.length === 0 &&
    fiscal.blockers.length === 0 &&
    Number(product.stock ?? 0) > 0;

  const readyForCampaign =
    readyForPublication &&
    visual.warnings.length === 0 &&
    commercial.warnings.length === 0 &&
    Boolean(product.application || product.material);

  const readyForHome = readyForCampaign && Boolean(product.is_featured);
  const readyForTraffic = readyForCampaign && seo.blockers.length === 0;
  const readyForAssistedOperation =
    Boolean(product.is_active) &&
    hasRealProductImage(product) &&
    commercial.blockers.filter((item) => item !== "preço ausente").length === 0;

  const campaign = buildDetail("Campanha", [
    { ok: readyForCampaign, message: "produto não esta pronto para campanha" },
    { ok: readyForHome || !product.is_featured, message: "produto em destaque sem prontidao de home", warning: true },
    { ok: readyForTraffic, message: "produto ainda não esta pronto para trafego", warning: true },
  ]);

  const average =
    (commercial.score + visual.score + seo.score + fiscal.score + operational.score + campaign.score) / 6;

  return {
    product_id: product.id,
    product_completeness_score: clampScore(average),
    commercial_score: commercial.score,
    visual_score: visual.score,
    seo_score: seo.score,
    fiscal_score: fiscal.score,
    operational_score: operational.score,
    campaign_score: campaign.score,
    dimensions: {
      commercial,
      visual,
      seo,
      fiscal,
      operational,
      campaign,
    },
    ready_for_publication: readyForPublication,
    ready_for_campaign: readyForCampaign,
    ready_for_home: readyForHome,
    ready_for_traffic: readyForTraffic,
    ready_for_assisted_operation: readyForAssistedOperation,
    ready_for_open_go_live: readyForPublication && fiscal.blockers.length === 0,
  };
}
