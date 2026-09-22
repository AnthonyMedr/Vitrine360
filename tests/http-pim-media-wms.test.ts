import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer } from "./http-server.ts";

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

async function createApprovedOrder() {
  const csrf = await createCsrfSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const createResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
      "idempotency-key": `wms-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente WMS",
      customerEmail: `wms-${Date.now()}@lojaopvc.com.br`,
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createResponse.status, 200);
  const created = (await createResponse.json()) as { order: { id: string; tracking_token: string } };

  const approveResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      action: "approve",
      trackingToken: created.order.tracking_token,
    }),
  });
  assert.equal(approveResponse.status, 200);
  return created.order.id;
}

test("pim readiness and product quality score expose enterprise quality read models", async () => {
  const admin = await createAdminSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/admin/products`, { headers: { cookie: admin.cookieHeader } });
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const qualityResponse = await fetch(`${baseUrl}/api/admin/products/${products[0].id}/quality-score`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(qualityResponse.status, 200);
  const quality = (await qualityResponse.json()) as { product_completeness_score: number; dimensions: Record<string, { blockers: string[] }> };
  assert.equal(typeof quality.product_completeness_score, "number");
  assert.ok(quality.dimensions.commercial);

  const pimResponse = await fetch(`${baseUrl}/api/admin/catalog/pim-readiness`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(pimResponse.status, 200);
  const pim = (await pimResponse.json()) as { totals: { products: number; blocked_by_image: number } };
  assert.ok(pim.totals.products > 0);
  assert.ok(typeof pim.totals.blocked_by_image === "number");
});

test("media library exposes usage map and supports audited review updates", async () => {
  const admin = await createAdminSession(baseUrl);
  const libraryResponse = await fetch(`${baseUrl}/api/admin/media-library`, { headers: { cookie: admin.cookieHeader } });
  assert.equal(libraryResponse.status, 200);
  const library = (await libraryResponse.json()) as Array<{ id: string; audit_status: string }>;
  assert.ok(library.length > 0);

  const usageResponse = await fetch(`${baseUrl}/api/admin/media-library/usage-map`, { headers: { cookie: admin.cookieHeader } });
  assert.equal(usageResponse.status, 200);
  const usage = (await usageResponse.json()) as Array<{ image_id: string; pdp_using: boolean }>;
  assert.ok(usage.length > 0);

  const reviewResponse = await fetch(`${baseUrl}/api/admin/media-library/${encodeURIComponent(library[0].id)}/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ decision: "manual_review", note: "QA reabriu a revisao visual." }),
  });
  assert.equal(reviewResponse.status, 200);
});

test("wms picking lifecycle creates, starts, confirms and completes tasks", async () => {
  const admin = await createAdminSession(baseUrl);
  const orderId = await createApprovedOrder();

  const createResponse = await fetch(`${baseUrl}/api/admin/wms/picking-tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ orderId }),
  });
  assert.ok([200, 201].includes(createResponse.status));
  const created = (await createResponse.json()) as { task: { id: string } };
  const taskId = created.task.id;

  const queueResponse = await fetch(`${baseUrl}/api/admin/wms/picking-queue`, { headers: { cookie: admin.cookieHeader } });
  assert.equal(queueResponse.status, 200);
  const queue = (await queueResponse.json()) as Array<{ id: string; items: Array<{ id: string; quantity_required: number }> }>;
  const task = queue.find((entry) => entry.id === taskId);
  assert.ok(task);

  const assignResponse = await fetch(`${baseUrl}/api/admin/wms/picking-tasks/${taskId}/assign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ userId: "user-admin" }),
  });
  assert.equal(assignResponse.status, 200);

  const startResponse = await fetch(`${baseUrl}/api/admin/wms/picking-tasks/${taskId}/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(startResponse.status, 200);

  const item = task.items[0];
  const confirmResponse = await fetch(`${baseUrl}/api/admin/wms/picking-tasks/${taskId}/confirm-item`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ itemId: item.id, quantityPicked: item.quantity_required }),
  });
  assert.equal(confirmResponse.status, 200);

  const completeResponse = await fetch(`${baseUrl}/api/admin/wms/picking-tasks/${taskId}/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(completeResponse.status, 200);

  const summaryResponse = await fetch(`${baseUrl}/api/admin/wms/summary`, { headers: { cookie: admin.cookieHeader } });
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()) as { metrics: { open_picking_tasks: number } };
  assert.ok(typeof summary.metrics.open_picking_tasks === "number");
});
