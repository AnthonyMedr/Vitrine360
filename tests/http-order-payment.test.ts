import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer, getDbModule } from "./http-server.ts";

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

async function seedUnitProduct(input: { suffix: string; price: number; stock: number; active?: boolean }) {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const template = db.products[0];
  assert.ok(template);
  const id = `qa-unit-${input.suffix}-${Date.now()}`;
  db.products.unshift({
    ...template,
    id,
    sku: `QA-UNIT-${input.suffix.toUpperCase()}-${Date.now()}`,
    name: `Produto Unidade QA ${input.suffix}`,
    slug: `produto-unidade-qa-${input.suffix}-${Date.now()}`,
    sale_type: "unidade",
    unit_measure: "un",
    display_unit: "un",
    price: input.price,
    base_price: input.price,
    stock: input.stock,
    is_active: input.active ?? true,
    status_product: input.active === false ? "inactive" : "active",
    availability: input.active === false ? "indisponivel" : "disponivel",
  });
  db.inventoryLots.unshift({
    id: `lot-${id}`,
    product_id: id,
    establishment_id: "est-comercial",
    source_type: "compra_nacional",
    source_reference: `seed-${id}`,
    source_document_number: id.toUpperCase(),
    quantity_in: input.stock,
    quantity_available: input.stock,
    unit_cost: input.price,
    landed_cost_unit: input.price,
    currency: "BRL",
    created_at: new Date().toISOString(),
  });
  writeDb(db);
  return id;
}

test("guest checkout creates order, respects idempotency and initiates payment", async () => {
  const csrf = await createCsrfSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const orderPayload = {
    customerName: "Cliente Checkout QA",
    customerEmail: "checkout.qa@lojaopvc.com.br",
    customerPhone: "87999990000",
    customerCpf: "12345678901",
    deliveryType: "pickup",
    paymentMethod: "pix",
    items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
  };

  const idempotencyKey = `qa-order-flow-idempotency-${Date.now()}`;

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      "idempotency-key": idempotencyKey,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify(orderPayload),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as {
    duplicated: boolean;
    order: { id: string; tracking_token: string; payment_status: string; status: string };
    orderItems: Array<{ product_id: string }>;
  };
  assert.equal(created.duplicated, false);
  assert.ok(created.order.id);
  assert.equal(created.orderItems.length, 1);

  const duplicatedResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      "idempotency-key": idempotencyKey,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify(orderPayload),
  });
  assert.equal(duplicatedResponse.status, 200);
  const duplicated = (await duplicatedResponse.json()) as {
    duplicated: boolean;
    order: { id: string };
  };
  assert.equal(duplicated.duplicated, true);
  assert.equal(duplicated.order.id, created.order.id);

  const paymentResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      action: "initiate",
      trackingToken: created.order.tracking_token,
    }),
  });
  assert.equal(paymentResponse.status, 200);
  const paymentPayload = (await paymentResponse.json()) as {
    order: { id: string; payment_status: string; status: string };
    paymentIntent: { status: string; checkoutUrl?: string | null };
  };
  assert.equal(paymentPayload.order.id, created.order.id);
  assert.equal(paymentPayload.order.payment_status, "initiated");
  assert.equal(paymentPayload.order.status, "awaiting_payment");
  assert.ok(paymentPayload.paymentIntent.status);

  const trackResponse = await fetch(`${baseUrl}/api/orders/track/${created.order.tracking_token}`);
  assert.equal(trackResponse.status, 200);
  const tracked = (await trackResponse.json()) as {
    order: { id: string };
    items: Array<{ product_id: string }>;
  };
  assert.equal(tracked.order.id, created.order.id);
  assert.equal(tracked.items.length, 1);
  assert.equal(tracked.items[0].product_id, products[0].id);
});

test("admin finance endpoint confirms manual payment with audit trail", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const admin = await createAdminSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      "idempotency-key": `qa-admin-payment-${Date.now()}`,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      customerName: "Cliente Financeiro QA",
      customerEmail: "financeiro.qa@lojaopvc.com.br",
      customerPhone: "87999990001",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as {
    order: { id: string };
  };

  const approveResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      action: "approve",
      paymentReference: "QA-MANUAL-APPROVAL",
    }),
  });
  assert.equal(approveResponse.status, 200);
  const payload = (await approveResponse.json()) as {
    order: { payment_status: string; status: string; payment_reference: string };
  };
  assert.equal(payload.order.payment_status, "approved");
  assert.equal(payload.order.status, "payment_approved");
  assert.equal(payload.order.payment_reference, "QA-MANUAL-APPROVAL");
});

test("checkout recalculates price on backend and rejects inactive products", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const activeProductId = await seedUnitProduct({ suffix: "price-recalc", price: 123.45, stock: 4 });
  const inactiveProductId = await seedUnitProduct({ suffix: "inactive", price: 10, stock: 4, active: false });

  const validOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      "idempotency-key": `qa-price-recalc-${Date.now()}`,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      customerName: "Cliente Recalculo QA",
      customerEmail: "recalculo.qa@lojaopvc.com.br",
      customerPhone: "87999990002",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: activeProductId, quantity: 1, unitPrice: 0.01, totalPrice: 0.01 }],
    }),
  });

  assert.equal(validOrderResponse.status, 200);
  const created = (await validOrderResponse.json()) as { order: { subtotal: number; total: number } };
  assert.equal(created.order.subtotal, 123.45);
  assert.equal(created.order.total, 123.45);

  const inactiveOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      "idempotency-key": `qa-inactive-product-${Date.now()}`,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      customerName: "Cliente Produto Inativo QA",
      customerEmail: "inativo.qa@lojaopvc.com.br",
      customerPhone: "87999990003",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: inactiveProductId, quantity: 1 }],
    }),
  });

  assert.equal(inactiveOrderResponse.status, 400);
  const payload = (await inactiveOrderResponse.json()) as { error: string };
  assert.match(payload.error, /produtos nao estao disponiveis/i);
});
