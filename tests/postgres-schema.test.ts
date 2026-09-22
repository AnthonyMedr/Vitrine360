import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const schema = fs.readFileSync(path.resolve(process.cwd(), "prisma", "schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.resolve(process.cwd(), "prisma", "migrations", "20260921000000_runtime_storage_foundation", "migration.sql"),
  "utf8",
);
const syncScript = fs.readFileSync(path.resolve(process.cwd(), "scripts", "sync-postgres.ts"), "utf8");

test("Prisma owns runtime state and stored object metadata in PostgreSQL", () => {
  assert.match(schema, /model RuntimeRecord/);
  assert.match(schema, /model RuntimeMeta/);
  assert.match(schema, /model StoredObject/);
  assert.match(schema, /checksumSha256/);
  assert.match(migration, /CREATE TABLE "runtime_records"/);
  assert.match(migration, /CREATE TABLE "stored_objects"/);
});

test("legacy PostgreSQL collections are imported and sync runs through Prisma", () => {
  assert.match(migration, /'freightCarriers'/);
  assert.match(migration, /to_regclass/);
  assert.match(syncScript, /importPostgresSnapshot/);
  assert.match(syncScript, /--if-empty/);
  assert.match(syncScript, /orm: "prisma"/);
});
