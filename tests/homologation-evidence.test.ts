import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PROVIDER = "sqlite";
process.env.QUEUE_PROVIDER = "auto";
process.env.DATABASE_URL = "";
process.env.REDIS_URL = "";

import { initializeDb, readDb, writeDb } from "../server/db";
import {
  buildHomologationEvidencePack,
  renderHomologationEvidenceCsv,
  renderHomologationEvidenceMarkdown,
} from "../server/homologation-evidence";
import { buildHomologationScenarioReport } from "../server/homologation-scenarios";

// See tests/homologation-scenarios.test.ts: the live catalog is quote-only (no price/
// stock/weight), so a throwaway sellable-shaped fixture is needed for the dormant
// e-commerce dry-run scenarios to resolve as "ready" instead of blocked.
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

test("homologation evidence pack preserves scenarios as pending evidence without opening production", async () => {
  await initializeDb();
  seedSellableFixtureProduct();
  const scenarios = buildHomologationScenarioReport(readDb());
  const pack = buildHomologationEvidencePack(scenarios);

  assert.equal(pack.ok, true);
  assert.equal(pack.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(pack.mode, "evidence_collection");
  assert.equal(pack.scenarios_total, 6);
  assert.equal(pack.evidence_items_total, 21);
  assert.equal(pack.pending_items, 21);
  assert.ok(pack.rows.every((row) => row.status === "PENDING_EXECUTION"));
  assert.ok(pack.rows.every((row) => row.production_gate === "unchanged"));
});

test("homologation evidence renderers expose audit columns and external blocker warning", async () => {
  await initializeDb();
  const scenarios = buildHomologationScenarioReport(readDb());
  const pack = buildHomologationEvidencePack(scenarios);
  const csv = renderHomologationEvidenceCsv(pack);
  const markdown = renderHomologationEvidenceMarkdown(pack);

  assert.match(csv, /"scenario_id","scenario_title"/);
  assert.match(csv, /evidence_path/);
  assert.match(csv, /PENDING_EXECUTION/);
  assert.match(markdown, /Pacote De Evidencias De Homologacao Operacional/);
  assert.match(markdown, /nao substitui contador/i);
});
