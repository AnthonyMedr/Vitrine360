import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseShape } from "../server/db";
import { createRuntimeBackupPayload, validateRuntimeBackupPayload } from "../server/backup-operations";

function buildDb(): DatabaseShape {
  return {
    users: [],
    brands: [{ id: "brand-1", name: "Marca", slug: "marca", is_active: true }],
    categories: [{ id: "cat-1", name: "Categoria", slug: "categoria", sort_order: 1, is_active: true }],
    products: [
      {
        id: "product-1",
        sku: "SKU-1",
        name: "Produto",
        slug: "produto",
        description: null,
        short_description: null,
        price: 10,
        original_price: null,
        category_id: "cat-1",
        brand_id: "brand-1",
        material: null,
        diameter: null,
        weight: 1,
        unit: "un",
        stock: 1,
        is_active: true,
        is_featured: false,
        rating: 0,
        review_count: 0,
        image_url: null,
        images: [],
        created_at: "2026-04-27T00:00:00.000Z",
      },
    ],
    orders: [],
    orderItems: [],
    auditLogs: [],
    coupons: [],
    stores: [],
    sellers: [],
    payments: [],
    quotes: [],
    quoteItems: [],
    customerProfiles: [],
    leads: [],
    deliveryZones: [],
    authOtps: [],
    establishments: [],
    fiscalProfiles: [],
    inventoryLots: [],
    inventoryMovements: [],
    fiscalDocuments: [],
    catalogStaging: [],
    freightQuoteCache: [],
    freightQuoteHistory: [],
    freightErrorLogs: [],
    fiscalAiSuggestions: [],
    fiscalNcmCache: [],
    aiSettings: [],
    aiUsageLogs: [],
    siteContent: {
      banners: [],
      featured_category_ids: [],
      go_live_product_ids: [],
      trust_badges: [],
      operational_messages: {
        pickup_message: "",
        delivery_message: "",
        human_support_message: "",
      },
      pages: [],
    },
    commercialSettings: {
      pickup_enabled: true,
      local_delivery_enabled: true,
      quote_enabled: true,
      assisted_sale_enabled: true,
      manual_approval_enabled: true,
      price_visibility_enabled: true,
      default_product_consultation_mode: false,
      pickup_message: "",
      delivery_message: "",
      availability_message: "",
    },
  };
}

test("runtime backup payload validates with checksum and table counts", () => {
  const payload = createRuntimeBackupPayload(buildDb(), "2026-04-27T00:00:00.000Z");
  const validation = validateRuntimeBackupPayload(payload);

  assert.equal(validation.ok, true);
  assert.equal(validation.checksum_matches, true);
  assert.equal(validation.counts.products, 1);
  assert.equal(payload.counts.categories, 1);
  assert.equal(payload.counts.freightQuoteCache, 0);
});

test("runtime backup payload redacts sensitive user credentials when requested", () => {
  const db = buildDb();
  db.users.push({
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    token: "session-token",
    session_token: "active-session-token",
    password_hash: "hash-value",
    password_salt: "salt-value",
    created_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z",
  } as never);
  db.orders.push({
    id: "order-1",
    order_number: "PVC-1",
    customer_id: null,
    customer_name: "Cliente",
    customer_email: "cliente@example.com",
    customer_phone: "87999999999",
    customer_document: null,
    status: "pending",
    payment_status: "pending",
    delivery_type: "pickup",
    delivery_address: null,
    subtotal: 10,
    discount: 0,
    shipping_cost: 0,
    total: 10,
    coupon_code: null,
    notes: null,
    tracking_token: "order-tracking-token",
    idempotency_key: null,
    created_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z",
  } as never);

  const payload = createRuntimeBackupPayload(db, "2026-04-27T00:00:00.000Z", { redactSensitive: true });
  const validation = validateRuntimeBackupPayload(payload);

  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.includes("sensitive_fields_redacted"));
  assert.equal(payload.redaction?.sensitive_fields_redacted, true);
  assert.equal(payload.data.users[0].password_hash, "[REDACTED]");
  assert.equal(payload.data.users[0].password_salt, "[REDACTED]");
  assert.equal(payload.data.users[0].token, "[REDACTED]");
  assert.equal(payload.data.users[0].session_token, "[REDACTED]");
  assert.equal(payload.data.orders[0].tracking_token, "[REDACTED]");
});

test("runtime backup validation rejects corrupted payload data", () => {
  const payload = createRuntimeBackupPayload(buildDb(), "2026-04-27T00:00:00.000Z");
  payload.data.products[0].name = "Produto alterado depois do backup";

  const validation = validateRuntimeBackupPayload(payload);

  assert.equal(validation.ok, false);
  assert.equal(validation.checksum_matches, false);
  assert.ok(validation.blockers.includes("checksum_mismatch"));
});

test("runtime backup validation rejects missing required tables", () => {
  const payload = createRuntimeBackupPayload(buildDb(), "2026-04-27T00:00:00.000Z") as unknown as {
    data: Record<string, unknown>;
  };
  delete payload.data.orders;

  const validation = validateRuntimeBackupPayload(payload);

  assert.equal(validation.ok, false);
  assert.ok(validation.blockers.includes("orders_missing"));
});
