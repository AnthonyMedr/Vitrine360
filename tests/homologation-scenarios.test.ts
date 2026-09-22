import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PROVIDER = "sqlite";
process.env.QUEUE_PROVIDER = "auto";
process.env.DATABASE_URL = "";
process.env.REDIS_URL = "";

import { initializeDb, readDb, writeDb } from "../server/db";
import { buildHomologationScenarioReport } from "../server/homologation-scenarios";

// The live GAMEL catalog is quote-only (price/stock/weight all zero) since the business
// operates B2B via orcamento, not direct online sale. The dormant e-commerce homologation
// scenarios below (payment/freight/stock/order) still need one sellable-shaped product to
// dry-run against, so we seed a throwaway fixture with the fields those scenarios check.
function seedSellableFixtureProduct() {
  const db = readDb();
  const template = db.products.find((product) => product.is_active) ?? db.products[0];
  const id = `homologation-fixture-${Date.now()}`;
  db.products.unshift({
    ...template,
    id,
    sku: `QA-HOMOLOG-${Date.now()}`,
    slug: `qa-homolog-fixture-${Date.now()}`,
    is_active: true,
    is_featured: true,
    status_product: "active",
    price: 199,
    stock: 10,
    weight: 1.5,
    delivery_type: "delivery",
    is_on_request: false,
    availability: "disponivel",
  });
  db.fiscalProfiles.unshift({
    id: `fiscal-fixture-${Date.now()}`,
    product_id: id,
    establishment_id: "est-comercial",
    ncm: null,
    cest: null,
    cfop_internal_default: null,
    cfop_interstate_default: null,
    origin_code: null,
    cst_icms_default: null,
    csosn_default: null,
    requires_difal: false,
    requires_fcp: false,
    tax_rule_status: "pending",
    notes: null,
    updated_at: new Date().toISOString(),
  });
  // go_live_product_ids is fixed at seed time; append the fixture explicitly so it
  // falls inside the minimal-go-live fiscal scope regardless of pre-seeded entries.
  db.siteContent.go_live_product_ids = [...(db.siteContent.go_live_product_ids ?? []), id];
  writeDb(db);
}

test("homologation scenarios provide dry-run training without opening production", async () => {
  await initializeDb();
  seedSellableFixtureProduct();
  const report = buildHomologationScenarioReport(readDb());

  assert.equal(report.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(report.mode, "dry_run_training");
  assert.equal(report.scenarios.length, 6);
  assert.equal(report.scenarios_blocked, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.id),
    ["payment-approved", "payment-rejected", "freight-unavailable", "stock-shortage", "order-cancelled", "fiscal-blocked"],
  );
  assert.ok(report.scenarios.every((scenario) => scenario.production_gate === "unchanged"));
});

test("fiscal blocked scenario keeps accountant dependency explicit", async () => {
  await initializeDb();
  seedSellableFixtureProduct();
  const report = buildHomologationScenarioReport(readDb());
  const fiscal = report.scenarios.find((scenario) => scenario.id === "fiscal-blocked");

  assert.ok(fiscal);
  assert.equal(fiscal?.status, "ready");
  assert.match(fiscal?.expected_result ?? "", /pacote fiscal/i);
  assert.ok(fiscal?.preconditions.some((entry) => /perfil fiscal pendente/i.test(entry)));
  assert.ok(fiscal?.steps.some((entry) => /close pack validado/i.test(entry)));
});
