import test from "node:test";
import assert from "node:assert/strict";

import { buildAssistedTrainingPlan } from "../server/admin-training-assistant";

test("assisted training plan guides admin execution without marking real training complete", () => {
  const plan = buildAssistedTrainingPlan();

  assert.equal(plan.ok, true);
  assert.equal(plan.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(plan.training_operation_ready, "PLANEJADO");
  assert.equal(plan.training_executed, false);
  assert.equal(plan.steps_total, 5);
  assert.ok(plan.real_execution_pending > 0);
  assert.ok(plan.steps.some((step) => step.admin_route === "/admin/governanca"));
  assert.ok(plan.steps.some((step) => step.status === "external_blocked" && step.blocker === "fiscal_minimo_contador"));
});
