import { closeDbResources, initializeDb, readDb, seedDb, waitForPendingDbWrites, writeDb } from "../server/db";
import { closePrismaClient } from "../server/prisma";

const apply = process.argv.includes("--apply");

await initializeDb();

try {
  const db = readDb();
  const seed = seedDb();
  const existingCategoryIds = new Set(db.categories.map((item) => item.id));
  const existingCategorySlugs = new Set(db.categories.map((item) => item.slug));
  const existingBrandIds = new Set(db.brands.map((item) => item.id));
  const existingBrandSlugs = new Set(db.brands.map((item) => item.slug));
  const existingProductIds = new Set(db.products.map((item) => item.id));
  const existingProductSlugs = new Set(db.products.map((item) => item.slug));

  const categories = seed.categories.filter((item) => !existingCategoryIds.has(item.id) && !existingCategorySlugs.has(item.slug));
  const brands = seed.brands.filter((item) => !existingBrandIds.has(item.id) && !existingBrandSlugs.has(item.slug));
  const products = seed.products.filter((item) => !existingProductIds.has(item.id) && !existingProductSlugs.has(item.slug));

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    existing: { categories: db.categories.length, brands: db.brands.length, products: db.products.length },
    insert: { categories: categories.length, brands: brands.length, products: products.length },
  }, null, 2));

  if (!apply) {
    console.log("Nenhuma alteracao realizada. Use --apply para inserir apenas registros ausentes.");
  } else {
    db.categories.push(...categories);
    db.brands.push(...brands);
    db.products.push(...products);
    writeDb(db);
    await waitForPendingDbWrites();
    console.log("Seed explicito do catalogo concluido sem sobrescrever registros existentes.");
  }
} finally {
  closeDbResources();
  await closePrismaClient();
}
