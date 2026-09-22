import test from "node:test";
import assert from "node:assert/strict";

import { getAdminHomologationEvidenceStatus } from "../server/admin-homologation-evidence";

test("admin homologation evidence status exposes internal validation without approving real execution", () => {
  const status = getAdminHomologationEvidenceStatus("docs/reports/homologation-evidence-pack-latest.csv");

  assert.equal(status.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(status.source_exists, false);
  assert.equal(status.internal_ready, false);
  assert.equal(status.rows, 0);
  assert.equal(status.completed_rows, 0);
  assert.equal(status.pending_rows, 0);
  assert.equal(status.completion_percent, 0);
  assert.equal(status.real_execution_required, true);
  assert.match(status.issues[0]?.message ?? "", /nao encontrado/i);
});
