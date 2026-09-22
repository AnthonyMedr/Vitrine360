import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAdminControlCenter, renderAdminControlCenterCsv, renderAdminControlCenterMarkdown } from "../server/admin-control-center";

test("admin control center consolidates governance without opening production", () => {
  const control = buildAdminControlCenter("docs/reports/continuity-validation-latest.json");

  assert.equal(control.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(control.internal_management_ready, false);
  assert.equal(control.continuity.source_exists, false);
  assert.equal(control.continuity.ok, false);
  assert.equal(control.continuity.internal_ready, false);
  assert.equal(control.evidence.rows, 0);
  assert.equal(control.evidence.real_execution_required, true);
  assert.equal(control.training.training_executed, false);
  assert.ok(control.summary.blocked_external >= 2);
  assert.ok(control.owners.some((owner) => owner.owner === "Contador" && owner.blocked_external === 1));
  assert.ok(control.owners.some((owner) => owner.highest_priority === "critical"));
  assert.ok(control.actions.some((action) => action.id === "daily-executive-routine" && action.route === "/admin"));
  assert.ok(control.actions.some((action) => action.status === "pending_real_execution"));
});

test("admin control center exports markdown and csv for management handoff", () => {
  const control = buildAdminControlCenter("docs/reports/continuity-validation-latest.json");
  const markdown = renderAdminControlCenterMarkdown(control);
  const csv = renderAdminControlCenterCsv(control);

  assert.match(markdown, /Central De Controle Administrativo/);
  assert.match(markdown, /BLOQUEADO_EXTERNO/);
  assert.match(markdown, /Responsaveis/);
  assert.match(markdown, /Contador/);
  assert.match(markdown, /Fila Gerenciavel/);
  assert.match(csv, /^"id","label","status","priority","owner","route","evidence","note"/);
  assert.match(csv, /"fiscal-provider","Validar fiscal minimo com contador","blocked_external","critical"/);
});

test("programmable completion script preserves final internal guardrails", () => {
  const source = readFileSync("scripts/check-programmable-completion.ts", "utf8");

  assert.match(source, /programmable_scope_complete/);
  assert.match(source, /BLOQUEADO_EXTERNO/);
  assert.match(source, /Central alinhada a validacao/);
  assert.match(source, /Matriz por responsavel/);
  assert.match(source, /completion:programmable:check|programmatic-completion-latest/);
});
