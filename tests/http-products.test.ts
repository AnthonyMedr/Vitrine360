import test from "node:test";
import assert from "node:assert/strict";
import { createTestServer, getDbModule } from "./http-server.ts";

let baseUrl = "";
let closeServer: (() => Promise<void>) | null = null;

test.before(async () => {
  const server = await createTestServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.after(async () => {
  await closeServer?.();
});

const forbiddenPublicProductFields = [
  "price",
  "base_price",
  "promotional_price",
  "original_price",
  "cost_price",
  "margin_target",
  "stock",
  "stock_minimum",
  "ncm",
  "cest",
  "origin_code",
  "fiscal_group",
  "tax_classification_status",
  "minimum_sale_quantity",
  "sale_multiple",
  "packaging_closed",
  "open_package_allowed",
  "fractional_sale_allowed",
  "default_loss_margin",
  "loss_margin",
];

function assertNoSensitiveProductFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of forbiddenPublicProductFields) {
    assert.equal(serialized.includes(`"${field}"`), false, `public product payload exposed ${field}`);
  }
}

test("products endpoint supports paged responses without sensitive commercial fields", async () => {
  const response = await fetch(`${baseUrl}/api/products?paged=true&page=1&pageSize=5&sort=name_asc`);
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    items: Array<{ id: string; name: string; is_active: boolean; availabilityLabel: string }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };

  assert.equal(payload.page, 1);
  assert.equal(payload.pageSize, 5);
  assert.ok(payload.total >= payload.items.length);
  assert.ok(payload.totalPages >= 1);
  assert.ok(payload.items.length <= 5);
  assert.ok(payload.items.every((item) => item.id && item.is_active));
  assert.ok(payload.items.every((item) => item.availabilityLabel === "Sob consulta"));
  assertNoSensitiveProductFields(payload);
});

test("products endpoint applies combined filters server-side", async () => {
  const publicRipados = await fetch(`${baseUrl}/api/products?category=Ripados Internos`).then((r) => r.json()) as Array<{ id: string }>;
  assert.ok(publicRipados.length > 0, "no publicly marketable product found in Ripados Internos to use as fixture template");

  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const category = db.categories.find((entry) => entry.name === "Ripados Internos");
  assert.ok(category);
  const template = db.products.find((product) => product.id === publicRipados[0].id);
  assert.ok(template);
  const fixtureId = `qa-filter-${Date.now()}`;
  db.products.unshift({
    ...template,
    id: fixtureId,
    sku: `QA-FILTER-${Date.now()}`,
    slug: `qa-ripado-disponivel-${Date.now()}`,
    name: "Ripado QA disponivel",
    category_id: category.id,
    is_active: true,
    status_product: "active",
    availability: "disponivel",
  });
  dbModule.writeDb(db);

  const response = await fetch(
    `${baseUrl}/api/products?paged=true&page=1&pageSize=12&category=Ripados Internos&availability=disponivel&search=ripado`,
  );
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    items: Array<{ name: string; availability?: string; category?: { name: string | null } | null }>;
  };

  assert.ok(payload.items.length > 0);
  assert.ok(payload.items.every((item) => [item.name, item.category?.name].filter(Boolean).join(" ").toLowerCase().includes("ripado")));
  assert.ok(payload.items.every((item) => item.availability === "disponivel"));
  assert.ok(payload.items.every((item) => item.category?.name === "Ripados Internos"));
});

test("products endpoint can restrict listing to campaign-ready public mix", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const candidate = db.products.find((item) => item.is_active && item.slug);
  assert.ok(candidate);
  candidate.category_id = candidate.category_id || db.categories.find((category) => category.is_active)?.id || null;
  candidate.price = Math.max(Number(candidate.price || 0), 199.9);
  candidate.stock = Math.max(Number(candidate.stock || 0), 8);
  candidate.ncm = candidate.ncm || "3925.90.90";
  candidate.tax_classification_status = "ready";
  candidate.short_description = candidate.short_description || "Produto apto para campanha.";
  candidate.description = candidate.description || "Descricao comercial completa.";
  candidate.application = candidate.application || "Uso residencial e comercial.";
  candidate.image_url = "/images/catalog/forro-pvc-campanha.jpg";
  candidate.images = ["/images/catalog/forro-pvc-campanha.jpg"];
  candidate.image_review_status = "approved";
  candidate.image_review_notes = null;
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  const response = await fetch(`${baseUrl}/api/products?paged=true&page=1&pageSize=20&readyForCampaign=true`);
  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    items: Array<{
      id: string;
      is_active: boolean;
      category_id?: string | null;
      image_url?: string | null;
      images?: string[];
      image_review_notes?: string | null;
      short_description?: string | null;
      description?: string | null;
      application?: string | null;
      material?: string | null;
    }>;
  };

  assert.ok(payload.items.length > 0);
  assert.ok(payload.items.some((item) => item.id === candidate.id));
  assertNoSensitiveProductFields(payload);
  assert.ok(
    payload.items.every((item) => {
      const images = [item.image_url, ...(item.images ?? [])].filter(Boolean).map((entry) => String(entry).toLowerCase());
      const hasRealImage = images.some((entry) => !entry.includes("placeholder"));
      const quarantined = String(item.image_review_notes || "").includes("Retirado de publicacao") || String(item.image_review_notes || "").includes("Retirado de publicação");
      return (
        item.is_active &&
        Boolean(item.category_id) &&
        Boolean(item.short_description || item.description) &&
        Boolean(item.application || item.material) &&
        hasRealImage &&
        !quarantined
      );
    }),
  );
});

test("public products sanitize media when image review is still pending", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const candidate = db.products.find((item) => item.is_active && item.slug);
  assert.ok(candidate);

  candidate.image_url = "https://images.example.com/catalog/forro-em-revisao.jpg";
  candidate.images = ["https://images.example.com/catalog/forro-em-revisao.jpg"];
  candidate.image_review_status = "manual_review";
  candidate.image_review_notes = "Revisao humana pendente";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  const listResponse = await fetch(`${baseUrl}/api/products?search=${encodeURIComponent(candidate.name)}`);
  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as Array<{
    id: string;
    image_url?: string | null;
    images?: string[];
    image_review_status?: string | null;
  }>;
  const listed = listPayload.find((item) => item.id === candidate.id);
  assert.ok(listed);
  assert.equal(listed.image_review_status, "manual_review");
  assert.equal(listed.image_url, null);
  assert.deepEqual(listed.images ?? [], []);

  const detailResponse = await fetch(`${baseUrl}/api/products/${candidate.slug}`);
  assert.equal(detailResponse.status, 200);
  const detailPayload = (await detailResponse.json()) as {
    id: string;
    image_url?: string | null;
    images?: string[];
    image_review_status?: string | null;
  };
  assert.equal(detailPayload.id, candidate.id);
  assert.equal(detailPayload.image_review_status, "manual_review");
  assert.equal(detailPayload.image_url, null);
  assert.deepEqual(detailPayload.images ?? [], []);
});

test("product detail endpoint returns only the exact requested slug", async () => {
  const response = await fetch(`${baseUrl}/api/products?limit=3`);
  assert.equal(response.status, 200);
  const products = (await response.json()) as Array<{ id: string; slug: string; name: string; sku?: string | null }>;
  const candidate = products.find((item) => item.slug);
  assert.ok(candidate);

  const detailResponse = await fetch(`${baseUrl}/api/products/${candidate.slug}`);
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as { id: string; slug: string; name: string; sku?: string | null };
  assertNoSensitiveProductFields(detail);

  assert.equal(detail.id, candidate.id);
  assert.equal(detail.slug, candidate.slug);
  assert.equal(detail.name, candidate.name);
  assert.equal(detail.sku ?? null, candidate.sku ?? null);

  const unknownResponse = await fetch(`${baseUrl}/api/products/${candidate.slug}-nao-existe`);
  assert.equal(unknownResponse.status, 404);
});

test("public products exclude inactive or draft products", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const candidate = db.products.find((item) => item.is_active && item.slug);
  assert.ok(candidate);
  const previous = { is_active: candidate.is_active, status_product: candidate.status_product };
  candidate.is_active = true;
  candidate.status_product = "draft";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  try {
    const listResponse = await fetch(`${baseUrl}/api/products?search=${encodeURIComponent(candidate.name)}`);
    assert.equal(listResponse.status, 200);
    const listPayload = await listResponse.json() as Array<{ id: string }>;
    assert.equal(listPayload.some((item) => item.id === candidate.id), false);

    const detailResponse = await fetch(`${baseUrl}/api/products/${candidate.slug}`);
    assert.equal(detailResponse.status, 404);
  } finally {
    const restoreDb = dbModule.readDb();
    const restoreCandidate = restoreDb.products.find((item) => item.id === candidate.id);
    assert.ok(restoreCandidate);
    restoreCandidate.is_active = previous.is_active;
    restoreCandidate.status_product = previous.status_product;
    dbModule.writeDb(restoreDb);
    await dbModule.waitForPendingDbWrites();
  }
});
