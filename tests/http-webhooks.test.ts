import crypto from "node:crypto";
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

test("generic webhook rejects invalid signatures", async () => {
  const response = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      eventType: "payment_succeeded",
      orderId: "nao-importa",
      idempotencyKey: "webhook-sem-assinatura",
    }),
  });

  assert.equal(response.status, 401);
  const payload = (await response.json()) as { error?: string };
  assert.match(payload.error || "", /webhook/i);
});

test("generic webhook accepts valid HMAC signature and updates payment state", async () => {
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
      "idempotency-key": `webhook-order-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Webhook QA",
      customerEmail: "webhook.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; payment_status: string; status: string } };
  assert.equal(created.order.payment_status, "pending");

  const webhookBody = JSON.stringify({
    eventType: "payment_succeeded",
    orderId: created.order.id,
    externalReference: `qa-payment-${Date.now()}`,
    amount: 149.9,
    idempotencyKey: `webhook-paid-${Date.now()}`,
    provider: "manual",
  });
  const { appConfig } = await import("../server/config.ts");
  const webhookSecret = appConfig.mercadopago.webhookSecret || appConfig.auth.csrfSecret;
  const signature = crypto.createHmac("sha256", webhookSecret).update(webhookBody).digest("hex");

  const webhookResponse = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body: webhookBody,
  });
  assert.equal(webhookResponse.status, 200);
  const webhookPayload = (await webhookResponse.json()) as { ok: boolean; order: { payment_status: string; status: string } };
  assert.equal(webhookPayload.ok, true);
  assert.equal(webhookPayload.order.payment_status, "approved");
  assert.equal(webhookPayload.order.status, "payment_approved");

  const duplicateWebhookResponse = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
    body: webhookBody,
  });
  assert.equal(duplicateWebhookResponse.status, 200);
  const duplicatePayload = (await duplicateWebhookResponse.json()) as {
    ok: boolean;
    payment?: { webhook_idempotency_key: string };
    order: { payment_status: string; status: string };
  };
  assert.equal(duplicatePayload.ok, true);
  assert.equal(duplicatePayload.payment?.webhook_idempotency_key, JSON.parse(webhookBody).idempotencyKey);
  assert.equal(duplicatePayload.order.payment_status, "approved");
  assert.equal(duplicatePayload.order.status, "payment_approved");
});
