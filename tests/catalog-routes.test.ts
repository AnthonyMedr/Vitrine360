import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogSearchPath, buildCategoryPath, CATALOG_ROUTES } from "../src/lib/catalogRoutes";

test("catalog route helpers build stable search and category URLs", () => {
  assert.equal(buildCatalogSearchPath("forro pvc"), "/busca?q=forro%20pvc");
  assert.equal(buildCatalogSearchPath("  "), CATALOG_ROUTES.allProducts);
  assert.equal(buildCategoryPath("forros-pvc"), "/categoria/forros-pvc");
});
