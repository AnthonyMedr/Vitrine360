import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseShape, DbCatalogStagingItem, DbProduct } from "../server/db";
import {
  getCatalogPublicationIssues,
  getProductPublicationIssues,
  getSoftLaunchDeferredGateReport,
  SOFT_LAUNCH_DEFERRED_SKUS,
} from "../server/catalog-staging";

test("catalog publication gate blocks incomplete product data by responsible area", () => {
  const product = {
    id: "product-incomplete",
    sku: "",
    name: "Produto sem saneamento",
    category_id: null,
    unit: "",
    unit_measure: null,
    price: 0,
    stock: 0,
    image_url: "/placeholder.svg",
    images: [],
    ncm: null,
    tax_classification_status: "pending",
  } as unknown as DbProduct;

  const issues = getProductPublicationIssues(product);
  const fields = new Set(issues.map((issue) => issue.field));
  const responsibles = new Set(issues.map((issue) => issue.responsible));

  assert.ok(fields.has("sku"));
  assert.ok(fields.has("category"));
  assert.ok(fields.has("price"));
  assert.ok(fields.has("stock"));
  assert.ok(fields.has("image"));
  assert.ok(fields.has("fiscal"));
  assert.ok(responsibles.has("catalogo"));
  assert.ok(responsibles.has("comercial"));
  assert.ok(responsibles.has("estoque"));
  assert.ok(responsibles.has("contador"));
});

test("catalog publication gate accepts a complete staged item with mapped ready product", () => {
  const product = {
    id: "product-ready",
    sku: "SKU-READY",
    name: "Produto pronto",
    category_id: "cat-ready",
    unit: "un",
    unit_measure: "un",
    price: 99.9,
    stock: 12,
    image_url: "/products/ready.jpg",
    images: ["/products/ready.jpg"],
    ncm: "00000000",
    tax_classification_status: "ready",
  } as unknown as DbProduct;
  const item = {
    id: "staging-ready",
    normalized_name: "Produto pronto",
    source_name: "Produto pronto",
    sku_base: "SKU-READY",
    category_name: "Categoria pronta",
    suggested_price: 99.9,
    estimated_stock: 12,
    mapped_product_id: product.id,
    fiscal_pending_fields: [],
  } as unknown as DbCatalogStagingItem;
  const db = { products: [product], fiscalProfiles: [] } as unknown as DatabaseShape;

  assert.deepEqual(getCatalogPublicationIssues(db, item), []);
});

test("soft launch deferred gate reports known SKUs that return to required scope", () => {
  const deferredItem = {
    id: "deferred-ready",
    sku_base: SOFT_LAUNCH_DEFERRED_SKUS[0],
    normalized_name: "Forro PVC diferido",
    source_name: "Forro PVC diferido",
    category_name: "Forros PVC",
    go_live_gate_status: "deferred",
    publish_flag: false,
  } as unknown as DbCatalogStagingItem;
  const requiredItem = {
    id: "deferred-regression",
    sku_base: SOFT_LAUNCH_DEFERRED_SKUS[1],
    normalized_name: "Forro PVC voltou ao gate",
    source_name: "Forro PVC voltou ao gate",
    category_name: "Forros PVC",
    go_live_gate_status: "required",
    publish_flag: true,
    suggested_price: 0,
    estimated_stock: 0,
    mapped_product_id: null,
    fiscal_pending_fields: ["ncm"],
  } as unknown as DbCatalogStagingItem;
  const db = { catalogStaging: [deferredItem, requiredItem], products: [], fiscalProfiles: [] } as unknown as DatabaseShape;

  const report = getSoftLaunchDeferredGateReport(db);

  assert.equal(report.ok, false);
  assert.equal(report.incorrectly_required.length, 1);
  assert.equal(report.incorrectly_required[0].sku, SOFT_LAUNCH_DEFERRED_SKUS[1]);
  assert.ok(report.incorrectly_required[0].blockers.length > 0);
});
