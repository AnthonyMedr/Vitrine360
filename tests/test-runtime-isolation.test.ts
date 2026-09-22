import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("test runner uses isolated DATA_DIR and test env", () => {
  const source = readFileSync("scripts/run-tests-isolated.ts", "utf8");

  assert.match(source, /DATA_DIR: tempDataDir/);
  assert.match(source, /NODE_ENV: "test"/);
  assert.match(source, /APP_ENV: "test"/);
  assert.match(source, /--test-concurrency=1/);
});

test("db runtime auto-isolates when tests run without explicit DATA_DIR", () => {
  const source = readFileSync("server/db.ts", "utf8");

  assert.match(source, /function isTestRuntime\(\)/);
  assert.match(source, /process\.argv\.includes\("--test"\)/);
  assert.match(source, /mkdtempSync\(path\.join\(os\.tmpdir\(\), "gamel-db-test-"\)\)/);
  assert.match(source, /isolatedForTests: true/);
  assert.match(source, /dataDir,/);
});
