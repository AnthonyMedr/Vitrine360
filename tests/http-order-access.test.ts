import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSession, createTestServer, getCookieValue, getSetCookieHeaders } from "./http-server.ts";

process.env.AUTH_PUBLIC_SIGNUP_ENABLED = "true";

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

async function createCustomerSession() {
  const csrf = await createCsrfSession(baseUrl);
  const email = `cliente.${Date.now()}@lojaopvc.com.br`;
  const password = "cliente123";

  const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      email,
      password,
      fullName: "Cliente Access QA",
    }),
  });

  assert.equal(signupResponse.status, 200);
  const sessionToken = getCookieValue(getSetCookieHeaders(signupResponse), "gamel_session");
  assert.ok(sessionToken);

  return {
    csrfToken: csrf.csrfToken,
    sessionToken,
    cookieHeader: `lojao_csrf=${csrf.csrfToken}; gamel_session=${sessionToken}`,
    email,
    password,
  };
}

test("order items require tracking token or authorized session", async () => {
  const csrf = await createCsrfSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
      "idempotency-key": `order-access-items-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Access QA",
      customerEmail: "access.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const forbiddenResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/items`);
  assert.equal(forbiddenResponse.status, 403);

  const allowedResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/items?trackingToken=${created.order.tracking_token}`);
  assert.equal(allowedResponse.status, 200);
  const items = (await allowedResponse.json()) as Array<{ product_id: string }>;
  assert.equal(items.length, 1);
  assert.equal(items[0].product_id, products[0].id);
});

test("authenticated customer cannot read payments from another order", async () => {
  const guestCsrf = await createCsrfSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": guestCsrf.csrfToken,
      cookie: guestCsrf.cookieHeader,
      "idempotency-key": `order-access-payments-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Payments QA",
      customerEmail: "payments.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string } };

  const customerSession = await createCustomerSession();
  const unauthorizedPaymentsResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payments`, {
    headers: {
      cookie: customerSession.cookieHeader,
    },
  });

  assert.equal(unauthorizedPaymentsResponse.status, 403);
});
