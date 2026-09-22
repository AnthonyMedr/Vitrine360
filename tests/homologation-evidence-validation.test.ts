import test from "node:test";
import assert from "node:assert/strict";

import {
  parseHomologationEvidenceCsv,
  renderHomologationEvidenceValidationMarkdown,
  validateHomologationEvidenceCsv,
} from "../server/homologation-evidence-validation";

const header = '"scenario_id","scenario_title","domain","evidence_item","status","responsible","evidence_path","executed_at","notes","production_gate"';

test("homologation evidence csv validation accepts pending template without opening production", () => {
  const csv = `${header}\n"payment-approved","Pagamento manual aprovado","payment","Print","PENDING_EXECUTION","","","","","unchanged"\n`;
  const report = validateHomologationEvidenceCsv("inline.csv", csv);

  assert.equal(report.ok, true);
  assert.equal(report.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(report.rows, 1);
  assert.equal(report.pending_rows, 1);
  assert.equal(report.completed_rows, 0);
});

test("homologation evidence csv validation requires audit fields for pass and fail", () => {
  const csv = `${header}\n"payment-approved","Pagamento manual aprovado","payment","Print","PASS","","","","","unchanged"\n`;
  const report = validateHomologationEvidenceCsv("inline.csv", csv);

  assert.equal(report.ok, false);
  assert.equal(report.issues.length, 4);
  assert.ok(report.issues.every((issue) => issue.scenario_id === "payment-approved"));
});

test("homologation evidence csv parser handles quoted commas", () => {
  const csv = `${header}\n"stock-shortage","Ruptura, estoque","inventory","SKU, estoque","BLOCKED_EXTERNAL","","","2026-05-26","Fornecedor, externo","unchanged"\n`;
  const parsed = parseHomologationEvidenceCsv(csv);
  const report = validateHomologationEvidenceCsv("inline.csv", csv);
  const markdown = renderHomologationEvidenceValidationMarkdown(report);

  assert.equal(parsed.rows[0]?.scenario_title, "Ruptura, estoque");
  assert.equal(report.ok, true);
  assert.equal(report.blocked_external_rows, 1);
  assert.match(markdown, /BLOCKED_EXTERNAL: 1/);
});
