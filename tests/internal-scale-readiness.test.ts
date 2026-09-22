import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { initializeDb, readDb } from "../server/db";
import { getInternalScaleReadiness } from "../server/internal-scale-readiness";

test("internal scale readiness separates internal blockers from external context", async () => {
  await initializeDb();
  const report = getInternalScaleReadiness(readDb());

  assert.equal(report.internal_ready, true);
  assert.equal(report.blockers, 0);
  assert.ok(report.external_warnings >= 1);
  assert.ok(report.checks.some((check) => check.area === "external" && check.item === "fiscal_minimal"));
  assert.ok(report.checks.some((check) => check.area === "admin" && check.item === "central_command" && check.status === "ok"));
  assert.ok(report.checks.some((check) => check.area === "orders" && check.item === "order_spool" && check.status === "ok"));
  assert.ok(report.checks.some((check) => check.area === "rbac" && check.item === "official_profiles" && check.status === "ok"));
  assert.ok(report.checks.some((check) => check.area === "mobile" && check.item === "static_mobile_preflight" && check.status === "ok"));
});

test("package exposes scale internal check command", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  assert.equal(pkg.scripts?.["scale:internal:check"], "tsx scripts/check-internal-scale-readiness.ts");
});

test("admin action plan separates expansion backlog from internal pending work", () => {
  const source = readFileSync("scripts/export-admin-action-plan.ts", "utf8");

  assert.match(source, /BACKLOG_ESCALA/);
  assert.match(source, /backlog_escala/);
  assert.match(source, /Backlog operacional de escala - nao bloqueia recorte atual/);
  assert.match(source, /tipo !== "BACKLOG_ESCALA"/);
});
