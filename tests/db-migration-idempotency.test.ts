import assert from "node:assert/strict";
import test from "node:test";
import { emptyDb, migrateDb, seedDb } from "../server/db";

test("migrateDb is idempotent: running it twice over the same state changes nothing further", () => {
  const seeded = seedDb();
  const first = migrateDb(seeded);

  const second = migrateDb(first.db);
  assert.equal(second.changed, false, "second migrateDb() run over already-migrated state must report no changes");
  assert.deepEqual(second.db, first.db, "second migrateDb() run must not mutate any field");
});

test("migrateDb never overwrites an explicit is_active value already present (regression guard for SEC-DB-01)", () => {
  const seeded = seedDb();
  const migrated = migrateDb(seeded).db;

  const category = migrated.categories[0];
  assert.ok(category, "seed data must include at least one category to exercise this guard");

  const editedByAdmin = {
    ...migrated,
    categories: migrated.categories.map((entry) =>
      entry.id === category.id ? { ...entry, is_active: !category.is_active } : entry,
    ),
  };

  const reMigrated = migrateDb(editedByAdmin);
  const persistedCategory = reMigrated.db.categories.find((entry) => entry.id === category.id);

  assert.equal(
    persistedCategory?.is_active,
    !category.is_active,
    "migrateDb must preserve an admin-edited is_active value instead of resetting it to the seed value",
  );
});

test("migrateDb preserves catalog edits and does not recreate deleted seed products", () => {
  const seeded = migrateDb(seedDb()).db;
  const editedProduct = seeded.products[0];
  const deletedProduct = seeded.products[1];
  assert.ok(editedProduct);
  assert.ok(deletedProduct);

  editedProduct.name = "Nome definido pelo administrador";
  editedProduct.description = "Descricao persistida no banco como fonte unica.";
  seeded.products = seeded.products.filter((product) => product.id !== deletedProduct.id);

  const migrated = migrateDb(seeded).db;
  assert.equal(migrated.products.find((product) => product.id === editedProduct.id)?.name, "Nome definido pelo administrador");
  assert.equal(migrated.products.find((product) => product.id === editedProduct.id)?.description, "Descricao persistida no banco como fonte unica.");
  assert.equal(migrated.products.some((product) => product.id === deletedProduct.id), false);
});

test("emptyDb starts without automatic catalog records", () => {
  const empty = migrateDb(emptyDb()).db;
  assert.equal(empty.categories.length, 0);
  assert.equal(empty.brands.length, 0);
  assert.equal(empty.products.length, 0);
  assert.equal(empty.fiscalProfiles.length, 0);
  assert.equal(empty.inventoryLots.length, 0);
});
