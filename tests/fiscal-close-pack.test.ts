import test from "node:test";
import assert from "node:assert/strict";
import { initializeDb, readDb, seedDb } from "../server/db";
import { applyFiscalClosePack } from "../server/fiscal-close-pack-apply";
import { buildFiscalClosePack } from "../server/fiscal-close-pack";
import { getAdminFiscalReadiness } from "../server/read-models";

test("applyFiscalClosePack updates profile, product and audit trail when the row is valid", async () => {
  await initializeDb();
  const db = readDb();

  const report = applyFiscalClosePack(
    db,
    [
      {
        fiscal_profile_id: "fiscal-1",
        product_id: "1",
        manual_fill_template: {
          ncm: "39181000",
          cst_icms_default: "00",
          weight: "2.5",
          tax_rule_status: "review",
          note: "Preenchido em teste",
        },
      },
    ],
    {
      actorId: "test-user",
      actorName: "QA",
      correlationId: "corr-close-pack-1",
    },
  );

  assert.equal(report.changed, true);
  assert.equal(report.metrics.applied, 1);
  assert.equal(report.metrics.invalid, 0);

  const profile = db.fiscalProfiles.find((entry) => entry.id === "fiscal-1");
  const product = db.products.find((entry) => entry.id === "1");
  assert.equal(profile?.ncm, "39181000");
  assert.equal(profile?.cst_icms_default, "00");
  assert.equal(profile?.csosn_default, null);
  assert.equal(profile?.tax_rule_status, "review");
  assert.equal(product?.ncm, "39181000");
  assert.equal(product?.weight, 2.5);
  assert.equal(product?.tax_classification_status, "review");
  assert.ok(db.auditLogs.some((entry) => entry.event_type === "fiscal.close_pack_applied" && entry.payload?.fiscal_profile_id === "fiscal-1"));
});

test("applyFiscalClosePack rejects invalid tax code combinations", async () => {
  await initializeDb();
  const db = readDb();

  const report = applyFiscalClosePack(
    db,
    [
      {
        fiscal_profile_id: "fiscal-3",
        product_id: "3",
        manual_fill_template: {
          ncm: "39181000",
          cst_icms_default: "00",
          csosn_default: "102",
          weight: "2.1",
        },
      },
    ],
    {
      actorName: "QA",
      correlationId: "corr-close-pack-2",
    },
  );

  assert.equal(report.changed, false);
  assert.equal(report.metrics.applied, 0);
  assert.equal(report.metrics.invalid, 1);
  assert.match(report.invalid_rows[0]?.reason ?? "", /exatamente um entre CST ICMS e CSOSN/i);
});

test("applyFiscalClosePack marks matching fiscal AI suggestion as applied", () => {
  const db = seedDb();
  db.fiscalAiSuggestions.unshift({
    id: "suggestion-exported-close-pack",
    fiscal_profile_id: "fiscal-1",
    product_id: "1",
    establishment_id: "est-comercial",
    scope: "minimal-go-live",
    suggested_ncm: "39181000",
    suggested_tax_code: "00",
    suggested_tax_code_type: "cst_icms_default",
    suggested_cest: null,
    suggested_origin_code: "0",
    suggested_weight: 2.5,
    confidence: "high",
    evidence: [{ type: "similar_product", reference: "PVC-OK", detail: "Produto similar validado." }],
    rationale: "Sugestao aprovada em teste.",
    status: "exported",
    source: "heuristic",
    openai_model: null,
    openai_response_id: null,
    openai_error: null,
    ncm_cache_version: null,
    reviewed_by: "contador",
    reviewed_at: new Date().toISOString(),
    review_notes: "Aprovado",
    approved_fill_template: {
      ncm: "39181000",
      cst_icms_default: "00",
      weight: "2.5",
      tax_rule_status: "review",
      note: "Aprovado por contador.",
    },
    exported_at: new Date().toISOString(),
    applied_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const report = applyFiscalClosePack(
    db,
    [
      {
        fiscal_profile_id: "fiscal-1",
        product_id: "1",
        manual_fill_template: {
          ncm: "39181000",
          cst_icms_default: "00",
          weight: "2.5",
          tax_rule_status: "review",
          note: "Aprovado por contador.",
        },
      },
    ],
    {
      actorId: "test-user",
      actorName: "QA",
      correlationId: "corr-close-pack-ai-applied",
    },
  );

  assert.equal(report.changed, true);
  assert.equal(db.fiscalAiSuggestions[0].status, "applied");
  assert.ok(db.fiscalAiSuggestions[0].applied_at);
  assert.ok(db.auditLogs.some((entry) => entry.event_type === "fiscal.ai_suggestion_applied" && entry.payload?.suggestion_id === "suggestion-exported-close-pack"));
});

test("buildFiscalClosePack marks pending rows with explicit completion status", async () => {
  await initializeDb();
  const db = readDb();

  const pack = buildFiscalClosePack(db, { scope: "minimal-go-live" });
  const row = pack.rows.find((entry) => entry.fiscal_profile_id === "fiscal-1");

  assert.ok(row);
  assert.equal(row?.completion_status, "pending_fill");
  assert.deepEqual(row?.missing_fields, ["ncm", "tax_code"]);
  assert.equal(row?.product_sku, "PVC-0001");
  assert.equal(row?.responsible, "contador");
  assert.equal(row?.criticality, "critical");
  assert.match(row?.go_live_impact ?? "", /soft launch regional/i);
});

test("fiscal readiness exposes actionable pending profile details without leaking raw rows into metrics", async () => {
  await initializeDb();
  const db = readDb();

  const report = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const firstPending = report.details.pending_fiscal_profiles.find((entry) => entry.fiscal_profile_id === "fiscal-1");

  assert.ok(firstPending);
  assert.equal(firstPending?.sku, "PVC-0001");
  assert.equal(firstPending?.responsible, "contador");
  assert.deepEqual(firstPending?.missing_fields, ["ncm", "tax_code"]);
  assert.equal("pendingProfileRows" in report.metrics, false);
});
