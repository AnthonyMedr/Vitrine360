import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCatalogCurationRows } from "../server/catalog-curation-apply.ts";
import type { DatabaseShape } from "../server/db.ts";

function buildDb(): Pick<DatabaseShape, "products" | "auditLogs"> {
  return {
    products: [
      {
        id: "prod-1",
        sku: "SKU-1",
        name: "Produto 1",
        slug: "produto-1",
        description: null,
        short_description: null,
        price: 10,
        original_price: null,
        category_id: null,
        brand_id: null,
        material: null,
        diameter: null,
        unit: "un",
        stock: 5,
        is_active: true,
        is_featured: true,
        rating: 0,
        review_count: 0,
        image_url: "/img.jpg",
        images: ["/img.jpg"],
        image_review_status: "manual_review",
        image_review_notes: "pendente",
        created_at: new Date().toISOString(),
      },
    ],
    auditLogs: [],
  };
}

test("catalog curation apply supports dry-run without mutating db", () => {
  const db = buildDb();
  const result = applyCatalogCurationRows(
    db,
    [{ product_id: "prod-1", decision: "approve_duplicate", decision_notes: "validado em lote" }],
    { actorName: "test", apply: false },
  );

  assert.equal(result.changed, false);
  assert.equal(result.changes.length, 1);
  assert.equal(db.products[0].image_review_status, "manual_review");
  assert.equal(db.auditLogs.length, 0);
});

test("catalog curation apply persists approved override with audit when apply=true", () => {
  const db = buildDb();
  const result = applyCatalogCurationRows(
    db,
    [{ product_id: "prod-1", decision: "approve_duplicate", decision_notes: "validado em lote" }],
    { actorName: "test", apply: true },
  );

  assert.equal(result.changed, true);
  assert.equal(result.applied, 1);
  assert.equal(db.products[0].image_review_status, "approved");
  assert.match(db.products[0].image_review_notes || "", /\[duplicate-ok\]/);
  assert.equal(db.auditLogs.length, 1);
  assert.equal(db.auditLogs[0]?.event_type, "catalog.image_curation_import_applied");
});
