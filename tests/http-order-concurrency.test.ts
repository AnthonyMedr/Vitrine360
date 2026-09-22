import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSession, createTestServer } from "./http-server.ts";

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

test("parallel checkout requests with the same idempotency key resolve to a single order", async () => {
  const csrf = await createCsrfSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const payload = {
    customerName: "Cliente Concorrencia QA",
    customerEmail: "concorrencia.qa@lojaopvc.com.br",
    customerPhone: "87999990000",
    customerCpf: "12345678901",
    deliveryType: "pickup",
    paymentMethod: "pix",
    items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
  };

  const idempotencyKey = `parallel-order-${Date.now()}`;
  const headers = {
    "content-type": "application/json",
    "x-csrf-token": csrf.csrfToken,
    "idempotency-key": idempotencyKey,
    cookie: csrf.cookieHeader,
  };

  const [firstResponse, secondResponse] = await Promise.all([
    fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
    fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
  ]);

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const firstPayload = (await firstResponse.json()) as { duplicated: boolean; order: { id: string } };
  const secondPayload = (await secondResponse.json()) as { duplicated: boolean; order: { id: string } };

  assert.equal(firstPayload.order.id, secondPayload.order.id);
  assert.equal(Number(firstPayload.duplicated) + Number(secondPayload.duplicated), 1);
});
