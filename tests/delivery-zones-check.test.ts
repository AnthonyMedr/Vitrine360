import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function runDeliveryZonesCheck(args: string[] = []) {
  const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-delivery-zones-"));
  const result = spawnSync(process.execPath, [tsxCliPath, "scripts/check-delivery-zones.ts", ...args], {
    cwd: path.resolve(process.cwd()),
    env: {
      ...process.env,
      DATA_DIR: dataDir,
    },
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}`.trim() || `${result.stderr || ""}`.trim();
  return {
    status: result.status ?? 1,
    output,
  };
}

test("delivery zones check reports actionable issue payload", () => {
  const result = runDeliveryZonesCheck(["--apply"]);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.output) as {
    applied: boolean;
    issues_count: number;
    active_enabled_zones: number;
  };
  assert.equal(payload.applied, true);
  assert.ok(payload.issues_count >= 0);
  assert.ok(payload.active_enabled_zones >= 0);
});
