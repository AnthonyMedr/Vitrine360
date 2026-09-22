import test from "node:test";
import assert from "node:assert/strict";

import { initializeDb, readDb } from "../server/db";
import { buildFiscalEnterprisePlan } from "../server/fiscal-enterprise-plan";

test("buildFiscalEnterprisePlan blocks fiscal rollout without accountant-approved minimum fiscal data", async () => {
  await initializeDb();
  const db = readDb();

  const plan = buildFiscalEnterprisePlan(db);

  assert.equal(plan.verdict.regional_soft_launch, "blocked_by_fiscal");
  assert.equal(plan.verdict.national_operation, "not_ready");
  assert.equal(plan.verdict.marketplace, "not_ready");
  assert.equal(plan.verdict.black_friday, "not_ready");
  assert.equal(plan.metrics.minimal_pending_profiles, 6);
  assert.ok(plan.metrics.global_pending_profiles >= plan.metrics.minimal_pending_profiles);
  assert.ok(plan.metrics.global_pending_profiles > 0);
  assert.ok(plan.scores.overall < 50);

  const phase0 = plan.phases.find((phase) => phase.id === "fase-0");
  assert.ok(phase0);
  assert.equal(phase0?.status, "blocked");
  assert.ok(phase0?.blockers.some((entry) => /perfil\(is\) fiscais minimos/i.test(entry)));
  assert.ok(phase0?.dependencies.some((entry) => entry.type === "contador"));
});

test("buildFiscalEnterprisePlan exposes all resolution phases from immediate fiscal gate to Black Friday", async () => {
  await initializeDb();
  const db = readDb();

  const plan = buildFiscalEnterprisePlan(db);

  assert.deepEqual(
    plan.phases.map((phase) => phase.id),
    ["fase-0", "fase-1", "fase-2", "fase-3", "fase-4", "fase-5", "fase-6", "fase-7"],
  );
  assert.ok(plan.phases.find((phase) => phase.id === "fase-3")?.blockers.some((entry) => /emissor fiscal/i.test(entry)));
  assert.ok(plan.phases.find((phase) => phase.id === "fase-7")?.blockers.some((entry) => /fila fiscal/i.test(entry)));
  assert.ok(plan.next_actions.some((entry) => /contador/i.test(entry)));
});
