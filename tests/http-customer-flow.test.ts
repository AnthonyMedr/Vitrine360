import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createTestServer, getCookieValue, getSetCookieHeaders } from "./http-server.ts";

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

test("authenticated customer profile update is persisted", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/customer-center/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      fullName: "Administrador QA",
      phone: "87999990000",
      customerType: "business",
      preferredChannel: "whatsapp",
      allowPromotions: true,
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    fullName: string;
    phone: string;
    customerType: string;
    preferredChannel: string;
    allowPromotions: boolean;
  };
  assert.equal(payload.fullName, "Administrador QA");
  assert.equal(payload.phone, "87999990000");
  assert.equal(payload.customerType, "business");
  assert.equal(payload.preferredChannel, "whatsapp");
  assert.equal(payload.allowPromotions, true);
});

test("authenticated active cart is persisted in customer center profile", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/customer-center/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      activeCart: {
        updatedAt: "2026-05-17T00:00:00.000Z",
        items: [
          {
            product: { id: "1", name: "Forro PVC Amadeirado Cedro", sku: "PVC-0001", price: 79.9 },
            quantity: 2,
          },
        ],
      },
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    activeCart?: { items: Array<{ quantity: number; product: { id: string } }>; updatedAt: string };
  };
  assert.equal(payload.activeCart?.items.length, 1);
  assert.equal(payload.activeCart?.items[0]?.product.id, "1");
  assert.equal(payload.activeCart?.items[0]?.quantity, 2);

  const readResponse = await fetch(`${baseUrl}/api/customer-center/profile`, {
    headers: {
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(readResponse.status, 200);
  const readPayload = (await readResponse.json()) as typeof payload;
  assert.equal(readPayload.activeCart?.items[0]?.product.id, "1");
});

test("public cart abandonment lead is created", async () => {
  const bootstrapResponse = await fetch(`${baseUrl}/api/health`);
  const csrfToken = getCookieValue(getSetCookieHeaders(bootstrapResponse), "lojao_csrf");
  assert.ok(csrfToken);

  const response = await fetch(`${baseUrl}/api/leads/cart-abandonment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: `lojao_csrf=${csrfToken}`,
    },
    body: JSON.stringify({
      items: [{ name: "Forro PVC Branco", quantity: 3 }],
      totalEstimated: 249.9,
      pageOrigin: "/checkout",
      correlationId: "qa-cart-abandonment",
    }),
  });

  assert.equal(response.status, 201);
  const payload = (await response.json()) as {
    id: string;
    name: string;
    channel: string;
    page_origin: string;
    notes: string;
  };
  assert.ok(payload.id);
  assert.equal(payload.name, "Carrinho abandonado");
  assert.equal(payload.channel, "checkout");
  assert.equal(payload.page_origin, "/checkout");
  assert.match(payload.notes, /249\.90/);
});
