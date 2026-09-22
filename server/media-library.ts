import type { CatalogImageAuditSeverity } from "../src/lib/catalogImageAudit";
import type { DatabaseShape, DbProduct } from "./db";
import { withRelations } from "./db";
import { getAdminCatalogImageAudit } from "./catalog-image-audit";

type MediaReviewDecision = "approved" | "manual_review" | "suspect" | "rejected" | "reopen";

type MediaLibraryItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  image_url: string;
  media_role: "primary" | "gallery";
  category_name: string | null;
  audit_status: CatalogImageAuditSeverity;
  review_status: string | null;
  review_notes: string | null;
  approved_for_public_use: boolean;
  used_in_home: boolean;
  used_in_campaigns: string[];
  used_in_landings: string[];
  used_in_pdp: boolean;
  risk: "low" | "medium" | "high";
};

function buildMediaItemId(productId: string, mediaRole: "primary" | "gallery", imageUrl: string) {
  return `${productId}::${mediaRole}::${imageUrl}`;
}

function parseMediaItemId(value: string) {
  const [productId, mediaRole, ...rest] = value.split("::");
  return {
    productId,
    mediaRole: mediaRole === "gallery" ? "gallery" : "primary",
    imageUrl: rest.join("::"),
  };
}

function getCampaignUsage(db: DatabaseShape, product: DbProduct) {
  const campaigns = db.marketingCampaigns
    .filter((entry) => entry.products_json.includes(product.id))
    .map((entry) => entry.name);
  const showcases = db.productShowcases
    .filter((entry) => entry.product_ids_json.includes(product.id))
    .map((entry) => entry.title);
  const landings = db.campaignLandingPages
    .filter((entry) => entry.showcase_ids_json.some((showcaseId) => db.productShowcases.find((showcase) => showcase.id === showcaseId)?.product_ids_json.includes(product.id)))
    .map((entry) => entry.title);

  return {
    campaigns,
    showcases,
    landings,
  };
}

export function getAdminMediaLibrary(db: DatabaseShape) {
  const auditMap = new Map(getAdminCatalogImageAudit(db).items.map((item) => [item.product_id, item]));
  const items: MediaLibraryItem[] = [];

  for (const product of db.products) {
    const hydrated = withRelations(db, product);
    const audit = auditMap.get(product.id) ?? null;
    const usage = getCampaignUsage(db, product);
    const allImages = [product.image_url, ...(product.images ?? [])]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const uniqueImages = Array.from(new Set(allImages));

    uniqueImages.forEach((imageUrl, index) => {
      const mediaRole = index === 0 && product.image_url === imageUrl ? "primary" : "gallery";
      const approvedForPublicUse = audit?.audit_status === "ok" && product.image_review_status === "approved";
      items.push({
        id: buildMediaItemId(product.id, mediaRole, imageUrl),
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        image_url: imageUrl,
        media_role: mediaRole,
        category_name: hydrated.category?.name ?? null,
        audit_status: audit?.audit_status ?? "manual_review",
        review_status: product.image_review_status ?? null,
        review_notes: product.image_review_notes ?? null,
        approved_for_public_use: approvedForPublicUse,
        used_in_home: product.is_featured,
        used_in_campaigns: [...usage.campaigns, ...usage.showcases],
        used_in_landings: usage.landings,
        used_in_pdp: product.is_active,
        risk: audit?.audit_status === "critical" ? "high" : audit?.audit_status === "suspect" || audit?.audit_status === "manual_review" ? "medium" : "low",
      });
    });
  }

  return items.sort((a, b) => {
    const riskWeight = (value: MediaLibraryItem["risk"]) => (value === "high" ? 0 : value === "medium" ? 1 : 2);
    return riskWeight(a.risk) - riskWeight(b.risk) || a.product_name.localeCompare(b.product_name) || a.image_url.localeCompare(b.image_url);
  });
}

export function getAdminMediaUsageMap(db: DatabaseShape) {
  return getAdminMediaLibrary(db).map((item) => ({
    image_id: item.id,
    image_url: item.image_url,
    product_id: item.product_id,
    product_name: item.product_name,
    campaigns_using: item.used_in_campaigns,
    landing_pages_using: item.used_in_landings,
    home_using: item.used_in_home,
    pdp_using: item.used_in_pdp,
    approval_status: item.review_status,
    risk: item.risk,
  }));
}

export function applyMediaLibraryReview(
  db: DatabaseShape,
  input: {
    mediaId: string;
    decision: MediaReviewDecision;
    note?: string | null;
  },
) {
  const parsed = parseMediaItemId(input.mediaId);
  const product = db.products.find((entry) => entry.id === parsed.productId);
  if (!product) return { ok: false as const, error: "Midia nao encontrada no catalogo." };

  const notePrefix =
    input.decision === "approved"
      ? "Imagem aprovada na Central de Midia."
      : input.decision === "suspect"
        ? "Imagem marcada como suspeita na Central de Midia."
        : input.decision === "rejected"
          ? "Imagem reprovada na Central de Midia."
          : input.decision === "reopen"
            ? "Revisao de imagem reaberta na Central de Midia."
            : "Imagem mantida em revisao manual na Central de Midia.";
  const note = [notePrefix, input.note?.trim()].filter(Boolean).join(" ");

  product.image_review_status =
    input.decision === "approved"
      ? "approved"
      : input.decision === "suspect"
        ? "suspect"
        : input.decision === "rejected"
          ? "rejected"
          : "manual_review";
  product.image_review_notes = note;
  return { ok: true as const, product };
}
