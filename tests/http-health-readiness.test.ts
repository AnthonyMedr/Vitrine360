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

test("health endpoints expose readiness and provider details", async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = (await healthResponse.json()) as {
    ok: boolean;
    database_ready: boolean;
    database_runtime: { initialized: boolean; pendingFlushes: number; provider: string };
    integrations: { payment_provider: string };
  };
  assert.equal(health.ok, true);
  assert.equal(typeof health.database_ready, "boolean");
  assert.equal(typeof health.database_runtime.initialized, "boolean");
  assert.equal(typeof health.database_runtime.pendingFlushes, "number");
  assert.ok(health.integrations.payment_provider);

  const detailedResponse = await fetch(`${baseUrl}/api/health/detailed`);
  assert.equal(detailedResponse.status, 200);
  const detailed = (await detailedResponse.json()) as {
    providers: { database: { provider: string; ready: boolean }; database_runtime: { initialized: boolean; pendingFlushes: number } };
    metrics_enabled: boolean;
  };
  assert.ok(detailed.providers.database.provider);
  assert.equal(typeof detailed.providers.database.ready, "boolean");
  assert.equal(typeof detailed.providers.database_runtime.initialized, "boolean");
  assert.equal(detailed.metrics_enabled, true);

  const readinessResponse = await fetch(`${baseUrl}/api/health/readiness`);
  assert.equal(readinessResponse.status, 200);
  const readiness = (await readinessResponse.json()) as {
    ok: boolean;
    failures: string[];
    checks: Record<string, boolean>;
    providers: { redis: { required: boolean } };
  };
  assert.equal(readiness.ok, true);
  assert.deepEqual(readiness.failures, []);
  assert.equal(readiness.checks.database, true);
  assert.equal(typeof readiness.providers.redis.required, "boolean");
});

test("metrics endpoint exposes request and business counters", async () => {
  await fetch(`${baseUrl}/api/health`);
  const admin = await createAdminSession(baseUrl);
  await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      hero_title: "Metrica QA",
    }),
  });
  await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  const response = await fetch(`${baseUrl}/api/metrics`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    runtime: { database: { initialized: boolean; pendingFlushes: number } };
    metrics: {
      http: Array<{ route: string; count: number }>;
      business: Record<string, number>;
      security: Record<string, number>;
    };
  };
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.runtime.database.initialized, "boolean");
  assert.ok(payload.metrics.http.some((entry) => entry.route === "GET /api/health" && entry.count >= 1));
  assert.ok((payload.metrics.business["content.updated"] || 0) >= 1);

  const prometheusResponse = await fetch(`${baseUrl}/api/metrics?format=prometheus`);
  assert.equal(prometheusResponse.status, 200);
  const prometheus = await prometheusResponse.text();
  assert.match(prometheus, /gamel_http_requests_total/);
  assert.match(prometheus, /gamel_business_events_total{name="content.updated"}/);
});

test("provider status endpoints expose payment and freight readiness details", async () => {
  const paymentResponse = await fetch(`${baseUrl}/api/payment-provider/status`);
  assert.equal(paymentResponse.status, 200);
  const payment = (await paymentResponse.json()) as {
    provider: string;
    mode: string;
    ready: boolean;
    webhook_ready: boolean;
    sandbox: boolean;
    request_timeout_ms: number;
    missing: string[];
  };
  assert.ok(payment.provider);
  assert.equal(typeof payment.ready, "boolean");
  assert.equal(typeof payment.webhook_ready, "boolean");
  assert.equal(typeof payment.sandbox, "boolean");
  assert.equal(typeof payment.request_timeout_ms, "number");
  assert.ok(Array.isArray(payment.missing));

  const freightResponse = await fetch(`${baseUrl}/api/freight-provider/status`);
  assert.equal(freightResponse.status, 200);
  const freight = (await freightResponse.json()) as {
    provider: string;
    mode: string;
    ready: boolean;
    sandbox: boolean;
    request_timeout_ms: number;
    origin_zip_configured: boolean;
    missing: string[];
  };
  assert.ok(freight.provider);
  assert.equal(typeof freight.ready, "boolean");
  assert.equal(typeof freight.sandbox, "boolean");
  assert.equal(typeof freight.request_timeout_ms, "number");
  assert.equal(typeof freight.origin_zip_configured, "boolean");
  assert.ok(Array.isArray(freight.missing));
});

test("admin freight catalog readiness exposes national shipping blockers", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/freight/catalog-readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    national_freight_ready: boolean;
    scope: string;
    summary: {
      total_active_products: number;
      ready_products: number;
      blocked_products: number;
      warning_products: number;
      missing_weight: number;
      missing_dimensions: number;
      quote_only: number;
    };
    blockers: Array<{ id: string; missing: string[]; recommended_action: string }>;
    warnings: Array<{ id: string; warnings: string[]; recommended_action: string }>;
    next_steps: string[];
  };

  assert.equal(typeof payload.national_freight_ready, "boolean");
  assert.equal(payload.scope, "active_catalog");
  assert.equal(typeof payload.summary.total_active_products, "number");
  assert.equal(typeof payload.summary.ready_products, "number");
  assert.equal(typeof payload.summary.blocked_products, "number");
  assert.equal(typeof payload.summary.warning_products, "number");
  assert.equal(typeof payload.summary.missing_weight, "number");
  assert.equal(typeof payload.summary.missing_dimensions, "number");
  assert.equal(typeof payload.summary.quote_only, "number");
  assert.ok(Array.isArray(payload.blockers));
  assert.ok(Array.isArray(payload.warnings));
  assert.ok(Array.isArray(payload.next_steps));
});

test("admin freight observability exposes quote cache, history and errors", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const now = new Date().toISOString();
  db.freightQuoteCache = [
    {
      id: "freight-cache-test",
      cache_key: "cache-test",
      cep: "01001000",
      subtotal: 300,
      strategy: "cheapest",
      options: [{ id: "sedex", name: "SEDEX", price: 40 }],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: now,
      updated_at: now,
    },
  ];
  db.freightQuoteHistory = [
    {
      id: "freight-history-test",
      cep: "01001000",
      provider: "correios",
      fallback_used: true,
      strategy: "cheapest",
      options_count: 1,
      response_time_ms: 250,
      cache_hit: false,
      status: "degraded",
      message: "Fallback acionado.",
      created_at: now,
    },
  ];
  db.freightErrorLogs = [
    {
      id: "freight-error-test",
      provider: "melhor-envio",
      cep: "01001000",
      error_type: "provider",
      message: "Provider indisponivel.",
      response_time_ms: 500,
      created_at: now,
    },
  ];
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/freight/observability`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    summary: {
      cache_entries: number;
      cache_valid: number;
      quotes_24h: number;
      errors_24h: number;
      fallback_24h: number;
      avg_response_time_ms: number;
    };
    providers: Record<string, number>;
    recent_quotes: Array<{ provider: string; fallback_used: boolean }>;
    recent_errors: Array<{ provider: string; message: string }>;
  };

  assert.equal(payload.summary.cache_entries, 1);
  assert.equal(payload.summary.cache_valid, 1);
  assert.equal(payload.summary.quotes_24h, 1);
  assert.equal(payload.summary.errors_24h, 1);
  assert.equal(payload.summary.fallback_24h, 1);
  assert.equal(payload.providers.correios, 1);
  assert.equal(payload.recent_quotes[0].fallback_used, true);
  assert.equal(payload.recent_errors[0].provider, "melhor-envio");
});

test("admin system status exposes consolidated readiness and provider state", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/system-status`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    providers: {
      payment: { provider: string; ready: boolean };
      freight: { provider: string; ready: boolean };
      fiscal: { provider: string; ready: boolean; missing: string[] };
      erp: { provider: string; ready: boolean; missing: string[] };
    };
    readiness: {
      phase1: { summary: { blockers: number } };
      fiscal_minimal: { summary: { blockers: number } };
      go_live: { summary: { blockers: number } };
    };
    summary: { blockers: number; warnings: number };
  };
  assert.equal(typeof payload.ok, "boolean");
  assert.ok(payload.providers.payment.provider.length > 0);
  assert.ok(payload.providers.freight.provider.length > 0);
  assert.ok(payload.providers.fiscal.provider.length > 0);
  assert.ok(payload.providers.erp.provider.length > 0);
  assert.ok(Array.isArray(payload.providers.fiscal.missing));
  assert.ok(Array.isArray(payload.providers.erp.missing));
  assert.equal(typeof payload.readiness.phase1.summary.blockers, "number");
  assert.equal(typeof payload.readiness.fiscal_minimal.summary.blockers, "number");
  assert.equal(typeof payload.readiness.go_live.summary.blockers, "number");
  assert.equal(typeof payload.summary.blockers, "number");
  assert.equal(typeof payload.summary.warnings, "number");
});

test("admin overview exposes command center sales and order metrics", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    orders: {
      total: number;
      today: number;
      week: number;
      month: number;
      revenueToday: number;
      revenueWeek: number;
      revenueMonth: number;
      averageTicket: number;
      byStatus: Record<string, number>;
      byDeliveryType: Record<string, number>;
    };
  };

  assert.equal(typeof payload.orders.today, "number");
  assert.equal(typeof payload.orders.week, "number");
  assert.equal(typeof payload.orders.month, "number");
  assert.equal(typeof payload.orders.revenueToday, "number");
  assert.equal(typeof payload.orders.revenueWeek, "number");
  assert.equal(typeof payload.orders.revenueMonth, "number");
  assert.equal(typeof payload.orders.averageTicket, "number");
  assert.equal(typeof payload.orders.byStatus.awaiting_payment, "number");
  assert.equal(typeof payload.orders.byStatus.in_separation, "number");
  assert.equal(typeof payload.orders.byStatus.ready_for_pickup, "number");
  assert.equal(typeof payload.orders.byStatus.error, "number");
  assert.equal(typeof payload.orders.byDeliveryType, "object");
});

test("admin overview exposes expedition backlog and stale expedition alerts", async () => {
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
      "idempotency-key": `overview-expedition-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Expedicao QA",
      customerEmail: "expedicao.qa@gamelmetal.com",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const approvePaymentResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
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
  assert.equal(approvePaymentResponse.status, 200);

  const admin = await createAdminSession(baseUrl);
  for (const status of ["confirmed", "processing", "in_separation"] as const) {
    const statusResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ status }),
    });
    assert.equal(statusResponse.status, 200);
  }

  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()) as {
    operationalAlerts: {
      expeditionBacklog: Array<{ id: string }>;
      expeditionStale: Array<{ id: string }>;
    };
  };
  assert.ok(overview.operationalAlerts.expeditionBacklog.some((entry) => entry.id === created.order.id));
  assert.ok(Array.isArray(overview.operationalAlerts.expeditionStale));
});

test("admin overview exposes expedition attention with recommended action for delayed orders", async () => {
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
      "idempotency-key": `overview-expedition-attention-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Expedicao Critica QA",
      customerEmail: "expedicao.critica.qa@gamelmetal.com",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "delivery",
      paymentMethod: "pix",
      shippingAddress: {
        street: "Rua QA",
        number: "100",
        neighborhood: "Centro",
        city: "Garanhuns",
        state: "PE",
        zipCode: "55290000",
      },
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const approvePaymentResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
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
  assert.equal(approvePaymentResponse.status, 200);

  const admin = await createAdminSession(baseUrl);
  for (const status of ["confirmed", "processing", "in_separation", "in_expedition", "shipped", "out_for_delivery"] as const) {
    const statusResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ status }),
    });
    assert.equal(statusResponse.status, 200);
  }

  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const order = db.orders.find((entry) => entry.id === created.order.id);
  assert.ok(order);
  order.updated_at = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  writeDb(db);

  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()) as {
    operationalAlerts: {
      expeditionAttention: Array<{ id: string; status: string; recommended_action: string }>;
      expeditionStale: Array<{ id: string }>;
    };
  };

  assert.ok(overview.operationalAlerts.expeditionStale.some((entry) => entry.id === created.order.id));
  assert.ok(
    overview.operationalAlerts.expeditionAttention.some(
      (entry) => entry.id === created.order.id && entry.status === "out_for_delivery" && entry.recommended_action.length > 0,
    ),
  );
});

test("admin overview exposes payment-approved backlog awaiting operational action", async () => {
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
      "idempotency-key": `overview-payment-action-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Pagamento QA",
      customerEmail: "pagamento.qa@gamelmetal.com",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const approvePaymentResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
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
  assert.equal(approvePaymentResponse.status, 200);

  const admin = await createAdminSession(baseUrl);
  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()) as {
    operationalAlerts: {
      paymentActionRequired: Array<{ order_id: string; payment_status: string; status: string }>;
    };
  };
  assert.ok(overview.operationalAlerts.paymentActionRequired.some((entry) => entry.order_id === created.order.id && entry.payment_status === "approved" && entry.status === "payment_approved"));
});
