import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSession, createTestServer, getDbModule } from "./http-server.ts";

process.env.PAYMENT_PROVIDER = "fake";
process.env.FREIGHT_PROVIDER = "fake";
process.env.FAKE_FREIGHT_PRICE = "42.5";
process.env.FAKE_FREIGHT_ESTIMATED_DAYS = "4";

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

async function createPickupOrder() {
  const csrf = await createCsrfSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      customerName: "Fake Provider QA",
      customerEmail: `fake-provider-${Date.now()}@lojaopvc.com.br`,
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    order: { id: string; tracking_token: string; payment_status: string; status: string };
  };
  return { csrf, order: payload.order };
}

async function initiatePayment(status: "approved" | "rejected" | "pending" | "unavailable") {
  const { appConfig } = await import("../server/config.ts");
  appConfig.fakePayment.status = status;
  const { csrf, order } = await createPickupOrder();

  const response = await fetch(`${baseUrl}/api/orders/${order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      action: "initiate",
      trackingToken: order.tracking_token,
    }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as {
    order: { id: string; payment_status: string; status: string };
    paymentIntent: { provider: string; status: string; checkoutUrl?: string };
  };
}

test("fake freight returns a fixed national quote without external provider", async () => {
  const { appConfig } = await import("../server/config.ts");
  appConfig.fakeFreight.fail = false;
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);
  const items = encodeURIComponent(JSON.stringify([{ productId: products[0].id, quantity: 1 }]));

  const response = await fetch(`${baseUrl}/api/shipping/quote?cep=01001000&subtotal=300&items=${items}`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    underAnalysis: boolean;
    options: Array<{ id: string; price: number; estimatedDays: string; provider?: string; coverage?: string }>;
    nationalCoverage?: { requested: boolean; ready: boolean; provider: string; mode: string; missing: string[] };
  };

  assert.equal(payload.underAnalysis, false);
  assert.equal(payload.nationalCoverage?.requested, true);
  assert.equal(payload.nationalCoverage?.ready, true);
  assert.equal(payload.nationalCoverage?.provider, "fake");
  assert.equal(payload.nationalCoverage?.mode, "automatic");
  assert.deepEqual(payload.nationalCoverage?.missing, []);
  assert.ok(payload.options.some((option) => option.id === "fake-standard" && option.price === 42.5 && option.estimatedDays === "4" && option.coverage === "national"));
});

test("fake freight failure degrades to pickup and clear national coverage state", async () => {
  const { appConfig } = await import("../server/config.ts");
  appConfig.fakeFreight.fail = true;
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  const items = encodeURIComponent(JSON.stringify([{ productId: products[0].id, quantity: 1 }]));

  const response = await fetch(`${baseUrl}/api/shipping/quote?cep=01001000&subtotal=300&items=${items}`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    underAnalysis: boolean;
    options: Array<{ deliveryType: string; coverage?: string }>;
    nationalCoverage?: { requested: boolean; ready: boolean; provider: string; mode: string };
  };

  assert.equal(payload.underAnalysis, true);
  assert.equal(payload.nationalCoverage?.requested, true);
  assert.equal(payload.nationalCoverage?.ready, false);
  assert.equal(payload.nationalCoverage?.provider, "fake");
  assert.equal(payload.nationalCoverage?.mode, "provider_required");
  assert.equal(payload.options.some((option) => option.deliveryType === "delivery"), false);
  assert.ok(payload.options.some((option) => option.deliveryType === "pickup" && option.coverage === "pickup"));
  appConfig.fakeFreight.fail = false;
});

test("fake payment can approve an order and create fiscal pending document", async () => {
  const payload = await initiatePayment("approved");
  assert.equal(payload.paymentIntent.provider, "fake");
  assert.equal(payload.paymentIntent.status, "approved");
  assert.equal(payload.order.payment_status, "approved");
  assert.equal(payload.order.status, "payment_approved");

  const { readDb } = await getDbModule();
  const db = readDb();
  assert.ok(db.fiscalDocuments.some((document) => document.order_id === payload.order.id && document.status_sefaz === "pending"));
});

test("fake payment can reject an order without crashing checkout", async () => {
  const payload = await initiatePayment("rejected");
  assert.equal(payload.paymentIntent.provider, "fake");
  assert.equal(payload.paymentIntent.status, "rejected");
  assert.equal(payload.order.payment_status, "failed");
  assert.equal(payload.order.status, "awaiting_payment");
});

test("fake payment can leave an order pending", async () => {
  const payload = await initiatePayment("pending");
  assert.equal(payload.paymentIntent.provider, "fake");
  assert.equal(payload.paymentIntent.status, "pending");
  assert.equal(payload.order.payment_status, "initiated");
  assert.equal(payload.order.status, "awaiting_payment");
  assert.ok(payload.paymentIntent.checkoutUrl);
});

test("fake payment unavailable fails payment without throwing server error", async () => {
  const payload = await initiatePayment("unavailable");
  assert.equal(payload.paymentIntent.provider, "fake");
  assert.equal(payload.paymentIntent.status, "failed");
  assert.equal(payload.order.payment_status, "failed");
  assert.equal(payload.order.status, "awaiting_payment");
});
