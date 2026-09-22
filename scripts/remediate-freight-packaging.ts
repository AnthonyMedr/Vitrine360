import { createId, initializeDb, readDb, waitForPendingDbWrites, writeDb } from "../server/db";
import { analyzeFreightCatalogProduct, getFreightCatalogReadinessReport, hasFreightDimensions, hasFreightWeight } from "../server/freight-catalog-readiness";

const shouldApply = process.argv.includes("--apply");

await initializeDb();

const db = readDb();
const now = new Date().toISOString();
const candidates = db.products.filter((product) => {
  if (!product.is_active || product.status_product === "inactive") return false;
  if (product.packaging_closed !== false) return false;
  if (!hasFreightWeight(product)) return false;
  const dimensions = hasFreightDimensions(product);
  return dimensions.width && dimensions.lengthOrDepth && dimensions.heightOrThickness;
});

const before = getFreightCatalogReadinessReport(db);

if (shouldApply) {
  for (const product of candidates) {
    const previous = {
      packaging_closed: product.packaging_closed,
      pieces_per_package: product.pieces_per_package ?? null,
      sale_multiple: product.sale_multiple ?? null,
    };

    product.packaging_closed = true;
    if (!product.pieces_per_package || product.pieces_per_package <= 0) {
      product.pieces_per_package = 1;
    }
    if (!product.sale_multiple || product.sale_multiple <= 0) {
      product.sale_multiple = 1;
    }

    db.auditLogs.unshift({
      event_id: createId(),
      event_type: "freight.packaging_profile_closed",
      occurred_at: now,
      correlation_id: createId(),
      actor_id: "user-admin",
      actor_name: "admin@gamelmetal.com",
      source_channel: "integration",
      order_id: null,
      previous_value: previous,
      new_value: {
        product_id: product.id,
        sku: product.sku,
        packaging_closed: product.packaging_closed,
        pieces_per_package: product.pieces_per_package,
        sale_multiple: product.sale_multiple,
      },
      payload: {
        script: "scripts/remediate-freight-packaging.ts",
        reason: "national_freight_packaging_profile",
      },
    });
  }

  writeDb(db);
  await waitForPendingDbWrites();
}

const after = shouldApply ? getFreightCatalogReadinessReport(readDb()) : before;
const remainingWarnings = after.warnings.map((item) => ({
  sku: item.sku,
  name: item.name,
  warnings: item.warnings,
  recommended_action: item.recommended_action,
}));

console.log(
  JSON.stringify(
    {
      applied: shouldApply,
      candidates: candidates.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        current_warnings: analyzeFreightCatalogProduct(product).warnings,
      })),
      before: before.summary,
      after: after.summary,
      remaining_warnings: remainingWarnings,
      next_steps:
        after.summary.warning_products === 0
          ? ["Homologar cotacao nacional com provider real e carrinhos volumosos."]
          : ["Validar limites de transportadora para produtos pesados ou volumosos restantes."],
    },
    null,
    2,
  ),
);
