import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseShape, DbProduct } from "../server/db.ts";
import { analyzeFreightCatalogProduct, getFreightCatalogReadinessReport } from "../server/freight-catalog-readiness.ts";

function product(overrides: Partial<DbProduct>): DbProduct {
  return {
    id: "prod-1",
    sku: "SKU-1",
    name: "Produto QA",
    slug: "produto-qa",
    description: null,
    short_description: null,
    price: 100,
    original_price: null,
    category_id: "cat-1",
    brand_id: null,
    material: null,
    diameter: null,
    weight: null,
    unit: "un",
    stock: 10,
    is_active: true,
    is_featured: false,
    rating: 5,
    review_count: 0,
    image_url: null,
    images: [],
    created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

test("freight catalog readiness blocks active products without logistic dimensions", () => {
  const report = getFreightCatalogReadinessReport({
    products: [
      product({
        id: "missing-logistics",
        weight: null,
        width: null,
        height: null,
        length: null,
        thickness: null,
      }),
    ],
  } as unknown as DatabaseShape);

  assert.equal(report.national_freight_ready, false);
  assert.equal(report.summary.total_active_products, 1);
  assert.equal(report.summary.blocked_products, 1);
  assert.deepEqual(report.blockers[0]?.missing, ["weight", "width", "length_or_depth", "height_or_thickness"]);
});

test("freight catalog readiness accepts products with weight and numeric dimensions", () => {
  const analyzed = analyzeFreightCatalogProduct(
    product({
      weight_per_unit: 1.2,
      width: 0.2,
      length: 1.2,
      thickness: 0.01,
      delivery_type: "delivery",
      availability: "disponivel",
    }),
  );

  assert.equal(analyzed.ready_for_national_freight, true);
  assert.deepEqual(analyzed.missing, []);
});

test("freight catalog readiness treats quote-only products as national checkout blockers", () => {
  const analyzed = analyzeFreightCatalogProduct(
    product({
      weight: 1,
      width: 0.2,
      length: 1,
      height: 0.1,
      delivery_type: "quote",
      availability: "disponivel",
    }),
  );

  assert.equal(analyzed.ready_for_national_freight, false);
  assert.ok(analyzed.missing.includes("quote_only"));
});
