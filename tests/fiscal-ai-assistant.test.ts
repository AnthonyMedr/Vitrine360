import assert from "node:assert/strict";
import test from "node:test";
import { seedDb } from "../server/db";
import { approveFiscalAiSuggestion, buildFiscalAiCompressedContext, exportApprovedFiscalAiClosePack, generateFiscalAiSuggestion, getFiscalAiQueue, rejectFiscalAiSuggestion } from "../server/fiscal-ai-assistant";

test("fiscal AI queue exposes minimal pending profiles without applying data", () => {
  const db = seedDb();
  const queue = getFiscalAiQueue(db, { scope: "minimal-go-live" });
  assert.equal(queue.metrics.pending_profiles, 6);
  assert.ok(queue.items.some((item) => item.product?.sku === "PVC-0001"));
});

test("fiscal AI suggestion does not mutate product or fiscal profile", async () => {
  const db = seedDb();
  const profile = db.fiscalProfiles.find((entry) => entry.id === "fiscal-1");
  assert.ok(profile);
  const product = db.products.find((entry) => entry.id === profile.product_id);
  assert.ok(product);
  const beforeProfile = structuredClone(profile);
  const beforeProduct = structuredClone(product);

  const result = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: profile.id,
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(profile, beforeProfile);
  assert.deepEqual(product, beforeProduct);
  assert.equal(db.fiscalAiSuggestions.length, 1);
  assert.ok(result.suggestion.ai_context_hash);
  assert.equal(db.aiUsageLogs.length, 1);
  assert.equal(db.aiUsageLogs[0].status, "skipped");
});

test("fiscal AI context compressor keeps prompt payload compact", () => {
  const db = seedDb();
  const profile = db.fiscalProfiles.find((entry) => entry.id === "fiscal-1");
  assert.ok(profile);
  const context = buildFiscalAiCompressedContext(db, profile, "minimal-go-live");
  assert.equal(context.payload.profile_id, "fiscal-1");
  assert.ok(context.contextHash.length >= 32);
  assert.ok(context.inputChars < 2500);
  assert.equal("description" in (context.payload.product ?? {}), false);
});

test("fiscal AI generation reuses same context instead of creating duplicate AI work", async () => {
  const db = seedDb();
  const first = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: "fiscal-1",
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-cache-1",
  });
  const second = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: "fiscal-1",
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-cache-2",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.suggestion.id, first.suggestion.id);
  assert.equal(db.fiscalAiSuggestions.length, 1);
  assert.ok(db.aiUsageLogs.some((entry) => entry.status === "cache_hit"));
});

test("low confidence fiscal AI suggestion cannot be approved or exported", async () => {
  const db = seedDb();
  const result = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: "fiscal-1",
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-low",
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestion.confidence, "low");

  const approved = approveFiscalAiSuggestion(db, {
    suggestionId: result.suggestion.id,
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-low-approve",
    notes: "Tentativa sem evidencia suficiente",
  });
  assert.equal(approved.ok, false);

  const pack = exportApprovedFiscalAiClosePack(db, {
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-low-export",
  });
  assert.equal(pack.rows.length, 0);
});

test("NCM cache evidence alone does not become an automatic fiscal classification", async () => {
  const db = seedDb();
  db.fiscalNcmCache.push({
    id: "ncm-cache-forro",
    code: "65070000",
    description: "Ripados WPC para revestimentos decorativos internos e externos.",
    source: "siscomex_public",
    source_url: "https://example.test/ncm.json",
    version: "test",
    effective_from: "2026-01-01",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const result = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: "fiscal-1",
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-ncm-cache-only",
  });

  assert.equal(result.ok, true);
  assert.equal(result.suggestion.suggested_ncm, null);
  assert.equal(result.suggestion.confidence, "low");
  assert.ok(result.suggestion.evidence.some((entry) => entry.type === "ncm_table"));
});

test("approved fiscal AI suggestions are exported to close pack rows", () => {
  const db = seedDb();
  db.fiscalAiSuggestions.unshift({
    id: "suggestion-ready",
    fiscal_profile_id: "fiscal-1",
    product_id: "1",
    establishment_id: "est-comercial",
    scope: "minimal-go-live",
    suggested_ncm: "39162000",
    suggested_tax_code: "102",
    suggested_tax_code_type: "csosn_default",
    suggested_cest: null,
    suggested_origin_code: "0",
    suggested_weight: 1.5,
    confidence: "high",
    evidence: [{ type: "similar_product", reference: "PVC-OK", detail: "Produto similar validado." }],
    rationale: "Sugestao aprovada em teste.",
    status: "approved",
    source: "heuristic",
    openai_model: null,
    openai_response_id: null,
    openai_error: null,
    ncm_cache_version: null,
    reviewed_by: "contador",
    reviewed_at: new Date().toISOString(),
    review_notes: "Aprovado",
    approved_fill_template: {
      ncm: "39162000",
      csosn_default: "102",
      weight: "1.5",
      tax_rule_status: "review",
      note: "Aprovado por contador.",
    },
    exported_at: null,
    applied_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const pack = exportApprovedFiscalAiClosePack(db, {
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-export",
  });

  assert.equal(pack.rows.length, 1);
  assert.equal(pack.rows[0].manual_fill_template.ncm, "39162000");
  assert.equal(db.fiscalAiSuggestions[0].status, "exported");
});

test("fiscal AI suggestion rejection requires a reason and writes audit when valid", async () => {
  const db = seedDb();
  const result = await generateFiscalAiSuggestion(db, {
    fiscalProfileId: "fiscal-1",
    scope: "minimal-go-live",
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-reject",
  });
  assert.equal(result.ok, true);

  const invalid = rejectFiscalAiSuggestion(db, {
    suggestionId: result.suggestion.id,
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-reject-empty",
    reason: "",
  });
  assert.equal(invalid.ok, false);

  const rejected = rejectFiscalAiSuggestion(db, {
    suggestionId: result.suggestion.id,
    actorId: "test",
    actorName: "Test",
    correlationId: "test-fiscal-ai-reject-valid",
    reason: "NCM sem evidencia suficiente.",
  });
  assert.equal(rejected.ok, true);
  assert.ok(db.auditLogs.some((entry) => entry.event_type === "fiscal.ai_suggestion_rejected"));
});
