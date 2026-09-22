import test from "node:test";
import assert from "node:assert/strict";
import { products as seedProducts } from "../src/data/products.ts";
import { getProductIdentityWarning, selectProductForSlug } from "../src/lib/productIdentity.ts";

test("ProductDetail identity selection keeps URL slug as the source of truth", () => {
  const fallbackProduct = {
    id: "1",
    slug: "forro-pvc-branco",
    sku: "PVC-0001",
    name: "Forro PVC Branco",
  };
  const wrongApiProduct = {
    id: "2",
    slug: "chapa-uv-marmore",
    sku: "PVC-0002",
    name: "Chapa UV Marmore",
  };

  const selection = selectProductForSlug({
    slug: "forro-pvc-branco",
    apiProduct: wrongApiProduct,
    fallbackProduct,
  });

  assert.equal(selection.source, "fallback");
  assert.equal(selection.product?.slug, "forro-pvc-branco");
  assert.equal(selection.rejectedApiProduct?.slug, "chapa-uv-marmore");
});

test("ProductDetail identity selection rejects divergent API product without fallback", () => {
  const selection = selectProductForSlug({
    slug: "forro-pvc-branco",
    apiProduct: {
      id: "2",
      slug: "chapa-uv-marmore",
      sku: "PVC-0002",
      name: "Chapa UV Marmore",
    },
  });

  assert.equal(selection.source, "none");
  assert.equal(selection.product, null);
  assert.equal(selection.rejectedApiProduct?.id, "2");
});

test("ProductDetail identity selection reports same-slug API/fallback drift for development diagnostics", () => {
  const warning = getProductIdentityWarning({
    slug: "forro-pvc-branco",
    apiProduct: {
      id: "1",
      slug: "forro-pvc-branco",
      sku: "PVC-0001",
      name: "Forro PVC Branco Atualizado",
    },
    fallbackProduct: {
      id: "1",
      slug: "forro-pvc-branco",
      sku: "GML-0001",
      name: "Forro PVC Branco",
    },
  });

  assert.equal(warning?.type, "api_fallback_identity_drift");
});

test("seed product catalog has unique IDs and slugs for public routing", () => {
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const product of seedProducts) {
    assert.ok(product.id, `Produto sem ID: ${product.name}`);
    assert.ok(product.slug, `Produto sem slug: ${product.name}`);
    assert.equal(ids.has(product.id), false, `ID duplicado: ${product.id}`);
    assert.equal(slugs.has(product.slug), false, `Slug duplicado: ${product.slug}`);
    ids.add(product.id);
    slugs.add(product.slug);
  }
});
