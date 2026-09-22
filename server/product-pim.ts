import { computeProductQualityScore } from "../src/lib/productQuality";
import type { DatabaseShape } from "./db";
import { withRelations } from "./db";
import { getAdminCatalogImageAudit } from "./catalog-image-audit";

export function getAdminProductQualityScore(db: DatabaseShape, productId: string) {
  const product = db.products.find((entry) => entry.id === productId);
  if (!product) return null;
  const audit = getAdminCatalogImageAudit(db, { productId }).items[0] ?? null;
  return computeProductQualityScore(withRelations(db, product), audit);
}

export function getAdminCatalogPimReadiness(db: DatabaseShape) {
  const auditMap = new Map(getAdminCatalogImageAudit(db).items.map((item) => [item.product_id, item]));
  const scores = db.products.map((product) =>
    computeProductQualityScore(withRelations(db, product), auditMap.get(product.id) ?? null),
  );

  const categorySummary = Array.from(
    db.products.reduce((acc, product) => {
      const key = withRelations(db, product).category?.name || "Sem categoria";
      const score = scores.find((entry) => entry.product_id === product.id);
      const current = acc.get(key) ?? {
        category_name: key,
        total: 0,
        low_score: 0,
        blocked_by_image: 0,
        blocked_by_fiscal: 0,
        ready_for_campaign: 0,
      };
      current.total += 1;
      if ((score?.product_completeness_score ?? 0) < 70) current.low_score += 1;
      if (score && !score.ready_for_campaign) current.ready_for_campaign += 0;
      if (score?.dimensions.visual.blockers.length) current.blocked_by_image += 1;
      if (score?.dimensions.fiscal.blockers.length) current.blocked_by_fiscal += 1;
      if (score?.ready_for_campaign) current.ready_for_campaign += 1;
      acc.set(key, current);
      return acc;
    }, new Map<string, {
      category_name: string;
      total: number;
      low_score: number;
      blocked_by_image: number;
      blocked_by_fiscal: number;
      ready_for_campaign: number;
    }>()).values(),
  ).sort((a, b) => b.low_score - a.low_score || b.blocked_by_image - a.blocked_by_image || a.category_name.localeCompare(b.category_name));

  return {
    generated_at: new Date().toISOString(),
    totals: {
      products: scores.length,
      publishable: scores.filter((item) => item.ready_for_publication).length,
      ready_for_campaign: scores.filter((item) => item.ready_for_campaign).length,
      ready_for_home: scores.filter((item) => item.ready_for_home).length,
      ready_for_traffic: scores.filter((item) => item.ready_for_traffic).length,
      assisted_operation_ready: scores.filter((item) => item.ready_for_assisted_operation).length,
      blocked_by_image: scores.filter((item) => item.dimensions.visual.blockers.length > 0).length,
      blocked_by_fiscal: scores.filter((item) => item.dimensions.fiscal.blockers.length > 0).length,
      missing_seo: scores.filter((item) => item.dimensions.seo.blockers.length > 0).length,
      missing_application: db.products.filter((item) => !item.application).length,
      missing_category: db.products.filter((item) => !item.category_id).length,
      missing_material: db.products.filter((item) => !item.material).length,
      missing_measure: db.products.filter((item) => !item.dimensions && item.width == null && item.height == null && item.length == null).length,
      low_score: scores.filter((item) => item.product_completeness_score < 70).length,
      near_ready: scores.filter((item) => item.product_completeness_score >= 70 && item.product_completeness_score < 85).length,
    },
    category_summary: categorySummary.slice(0, 12),
    lowest_scores: scores
      .map((item) => ({
        ...item,
        product_name: db.products.find((product) => product.id === item.product_id)?.name ?? item.product_id,
      }))
      .sort((a, b) => a.product_completeness_score - b.product_completeness_score)
      .slice(0, 20),
  };
}
