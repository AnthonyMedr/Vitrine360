import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer, getDbModule } from "./http-server.ts";
import type { DbUser } from "../server/db.ts";

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

test("admin can create seller with csrf-protected session", async () => {
  const admin = await createAdminSession(baseUrl);
  const email = `seller.qa.${Date.now()}@lojaopvc.com.br`;

  const response = await fetch(`${baseUrl}/api/admin/sellers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      email,
      password: "seller123",
      fullName: "Vendedor QA HTTP",
      sellerCode: `SELLER-QA-${Date.now()}`,
    }),
  });

  assert.equal(response.status, 201);
  const payload = (await response.json()) as {
    id: string;
    display_name: string;
    user: { email: string; role: string };
  };
  assert.ok(payload.id);
  assert.equal(payload.display_name, "Vendedor QA HTTP");
  assert.equal(payload.user.email, email);
  assert.equal(payload.user.role, "seller");
});

test("admin commercial ERP cockpit exposes assisted selling queues and controls", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/commercial/erp-cockpit`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    metrics: {
      assisted_started: number;
      assisted_orders: number;
      commercial_orders: number;
      open_leads: number;
      open_quotes: number;
      awaiting_payment_orders: number;
      stale_queue_items: number;
    };
    queues: {
      action_required: Array<{ type: string; recommended_action: string; href: string }>;
    };
    seller_performance: Array<{ seller_name: string; orders: number; quotes: number; leads: number; revenue: number }>;
    controls: Array<{ key: string; status: string; href: string }>;
    role_model: { ai_policy: string; sale_authorization: string };
  };

  assert.equal(typeof payload.metrics.assisted_started, "number");
  assert.equal(typeof payload.metrics.assisted_orders, "number");
  assert.equal(typeof payload.metrics.commercial_orders, "number");
  assert.equal(typeof payload.metrics.open_leads, "number");
  assert.equal(typeof payload.metrics.open_quotes, "number");
  assert.equal(typeof payload.metrics.awaiting_payment_orders, "number");
  assert.equal(typeof payload.metrics.stale_queue_items, "number");
  assert.ok(Array.isArray(payload.queues.action_required));
  assert.ok(payload.queues.action_required.every((entry) => entry.recommended_action && entry.href.startsWith("/admin")));
  assert.ok(Array.isArray(payload.seller_performance));
  assert.ok(payload.controls.some((entry) => entry.key === "assisted_sale" && entry.status === "implemented" && entry.href === "/admin/venda-assistida"));
  assert.match(payload.role_model.sale_authorization, /auditoria/i);
  assert.match(payload.role_model.ai_policy, /nao aprova desconto/i);
});

test("admin integrations overview exposes database and queue runtime", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/integrations/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    items: Array<{ key: string; mode: string; connected: boolean }>;
    runtime: {
      database: { provider: string; initialized: boolean; pendingFlushes: number };
      redis: { configured: boolean; ready: boolean; required: boolean };
      payment: { provider: string; ready: boolean; missing: string[] };
      freight: { provider: string; ready: boolean; missing: string[] };
      queues: { provider: string };
    };
  };

  assert.ok(payload.items.some((entry) => entry.key === "database"));
  assert.ok(payload.items.some((entry) => entry.key === "queue"));
  assert.equal(typeof payload.runtime.database.initialized, "boolean");
  assert.equal(typeof payload.runtime.database.pendingFlushes, "number");
  assert.equal(typeof payload.runtime.redis.required, "boolean");
  assert.ok(payload.runtime.payment.provider);
  assert.equal(typeof payload.runtime.payment.ready, "boolean");
  assert.ok(Array.isArray(payload.runtime.payment.missing));
  assert.ok(payload.runtime.freight.provider);
  assert.equal(typeof payload.runtime.freight.ready, "boolean");
  assert.ok(Array.isArray(payload.runtime.freight.missing));
  assert.ok(payload.runtime.queues.provider);
});

test("admin go-live readiness endpoint exposes blocker summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/go-live/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    go_live_ready: boolean;
    blockers: number;
    warnings: number;
    checks: {
      blockers: Array<{ item: string; detail: string }>;
      warnings: Array<{ item: string; detail: string }>;
      ok: Array<{ item: string; detail: string }>;
    };
    next_steps: string[];
  };

  assert.equal(typeof payload.go_live_ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.ok(Array.isArray(payload.checks.blockers));
  assert.ok(Array.isArray(payload.checks.warnings));
  assert.ok(Array.isArray(payload.checks.ok));
  assert.ok(Array.isArray(payload.next_steps));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "database_provider"));
});

test("admin phase1 readiness endpoint exposes infra cutover summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/phase1/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    phase: string;
    blockers: number;
    warnings: number;
    checks: Array<{ status: string; key: string; message: string }>;
  };

  assert.equal(typeof payload.ok, "boolean");
  assert.equal(payload.phase, "phase1_cutover");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.ok(Array.isArray(payload.checks));
  assert.ok(payload.checks.some((entry) => entry.key === "database_provider"));
});

test("admin phase2 readiness endpoint exposes provider homologation summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/phase2/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    phase2_ready: boolean;
    blockers: number;
    warnings: number;
    checks: {
      blockers: Array<{ item: string; detail: string }>;
      warnings: Array<{ item: string; detail: string }>;
      ok: Array<{ item: string; detail: string }>;
    };
    next_steps: string[];
  };

  assert.equal(typeof payload.phase2_ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.ok(Array.isArray(payload.checks.blockers));
  assert.ok(Array.isArray(payload.checks.warnings));
  assert.ok(Array.isArray(payload.checks.ok));
  assert.ok(Array.isArray(payload.next_steps));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "payment_provider"));
});

test("admin fiscal readiness endpoint exposes operational fiscal backlog", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/fiscal/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ready: boolean;
    blockers: number;
    warnings: number;
    metrics: {
      pending_fiscal_profiles: number;
      pending_catalog_items: number;
      pending_fiscal_documents: number;
      deferred_fiscal_documents: number;
    };
    checks: {
      blockers: Array<{ item: string; detail: string }>;
      ok: Array<{ item: string; detail: string }>;
      warnings: Array<{ item: string; detail: string }>;
    };
    next_steps: string[];
  };

  assert.equal(typeof payload.ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.equal(typeof payload.metrics.pending_fiscal_profiles, "number");
  assert.equal(typeof payload.metrics.pending_catalog_items, "number");
  assert.equal(typeof payload.metrics.pending_fiscal_documents, "number");
  assert.equal(typeof payload.metrics.deferred_fiscal_documents, "number");
  assert.ok(Array.isArray(payload.checks.blockers));
  assert.ok(Array.isArray(payload.checks.ok));
  assert.ok(Array.isArray(payload.checks.warnings));
  assert.ok(Array.isArray(payload.next_steps));
});

test("admin fiscal readiness endpoint supports minimal go-live scope", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/fiscal/readiness?scope=minimal-go-live`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    scope: string;
    ready: boolean;
    metrics: { scoped_products: number; deferred_fiscal_documents: number };
    checks: { ok: Array<{ item: string }> };
  };

  assert.equal(payload.scope, "minimal-go-live");
  assert.equal(typeof payload.ready, "boolean");
  assert.equal(typeof payload.metrics.scoped_products, "number");
  assert.equal(typeof payload.metrics.deferred_fiscal_documents, "number");
  assert.ok(payload.checks.ok.some((entry) => entry.item === "scope_products"));
});

test("admin fiscal workboard endpoint exposes actionable backlog", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/fiscal/workboard`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    generated_at: string;
    metrics: {
      pending_fiscal_profiles: number;
      pending_catalog_items: number;
      pending_fiscal_documents: number;
      deferred_fiscal_documents: number;
      template_candidate_profiles: number;
    };
    profiles: Array<{ missing_fields: string[]; recommended_action: string }>;
    template_candidates: Array<{ template_fields: string[]; candidate_targets: number; recommended_action: string }>;
    staging: {
      pending_fields: Array<{ field: string; count: number }>;
      samples: Array<{ fiscal_pending_fields: string[]; recommended_action: string }>;
    };
    documents: Array<{ recommended_action: string }>;
    deferred_documents: Array<{ recommended_action: string; go_live_gate_status: string }>;
    next_steps: string[];
  };

  assert.equal(typeof payload.generated_at, "string");
  assert.equal(typeof payload.metrics.pending_fiscal_profiles, "number");
  assert.equal(typeof payload.metrics.pending_catalog_items, "number");
  assert.equal(typeof payload.metrics.pending_fiscal_documents, "number");
  assert.equal(typeof payload.metrics.deferred_fiscal_documents, "number");
  assert.equal(typeof payload.metrics.template_candidate_profiles, "number");
  assert.ok(Array.isArray(payload.profiles));
  assert.ok(Array.isArray(payload.template_candidates));
  assert.ok(Array.isArray(payload.staging.pending_fields));
  assert.ok(Array.isArray(payload.staging.samples));
  assert.ok(Array.isArray(payload.documents));
  assert.ok(Array.isArray(payload.deferred_documents));
  assert.ok(Array.isArray(payload.next_steps));
});

test("admin fiscal enterprise plan endpoint exposes phased blockers without changing fiscal data", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/fiscal/enterprise-plan`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    verdict: { regional_soft_launch: string; national_operation: string; marketplace: string; black_friday: string };
    scores: { overall: number };
    metrics: { minimal_pending_profiles: number; global_pending_profiles: number; staging_pending_items: number };
    phases: Array<{ id: string; status: string; blockers: string[]; commands: string[] }>;
  };

  assert.equal(payload.verdict.regional_soft_launch, "blocked_by_fiscal");
  assert.equal(payload.verdict.national_operation, "not_ready");
  assert.equal(payload.verdict.marketplace, "not_ready");
  assert.equal(payload.verdict.black_friday, "not_ready");
  assert.equal(typeof payload.scores.overall, "number");
  assert.equal(payload.metrics.minimal_pending_profiles, 6);
  assert.ok(payload.metrics.global_pending_profiles > 0);
  assert.equal(typeof payload.metrics.staging_pending_items, "number");
  assert.ok(payload.metrics.staging_pending_items >= 0);
  assert.equal(payload.phases.length, 8);
  assert.ok(payload.phases.find((phase) => phase.id === "fase-0")?.commands.some((command) => command.includes("fiscal:check:minimal")));
});

test("admin fiscal remediation endpoint syncs safe fiscal backlog automatically", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const productId = `product-fiscal-remediation-${stamp}`;
  const profileId = `fiscal-profile-remediation-${stamp}`;
  const stagingId = `staging-fiscal-remediation-${stamp}`;
  const documentId = `fiscal-document-remediation-${stamp}`;

  db.products.unshift({
    id: productId,
    name: "Produto Fiscal Remediacao",
    slug: `produto-fiscal-remediacao-${stamp}`,
    sku: `SKU-FISCAL-${stamp}`,
    description: "Produto sintetico para remediacao fiscal",
    image_url: null,
    images: [],
    price: 99.9,
    promotional_price: null,
    stock: 10,
    stock_unit: "un",
    category_id: db.categories[0]?.id ?? null,
    brand_id: db.brands[0]?.id ?? null,
    rating: 0,
    review_count: 0,
    is_active: true,
    is_featured: false,
    badge: null,
    application: null,
    material: null,
    color: null,
    line: null,
    dimensions: "1,00 x 1,00 m",
    measures: "1,00 x 1,00 m",
    weight: 2.5,
    width: null,
    height: null,
    length: null,
    thickness: null,
    linear_measure: null,
    square_measure: null,
    area_per_piece: null,
    area_per_box: null,
    area_per_package: null,
    meters_per_piece: null,
    pieces_per_box: null,
    meters_per_box: null,
    meters_per_package: null,
    volume_per_unit: null,
    volume_per_package: null,
    weight_per_unit: null,
    weight_per_package: null,
    pieces_per_package: null,
    packaging_closed: false,
    open_package_allowed: true,
    minimum_sale_quantity: 1,
    sale_multiple: 1,
    fractional_sale_allowed: false,
    default_loss_margin: 0,
    loss_margin: 0,
    is_on_request: false,
    is_heavy: false,
    is_bulky: false,
    top_seller: false,
    status_product: "published",
    price_per_square_meter: null,
    list_price: null,
    cost_price: null,
    markup_percent: null,
    supplier_name: null,
    catalog_batch: null,
    fiscal_group: "acabamentos",
    ncm: "39181000",
    cest: null,
    origin_code: "0",
    tax_classification_status: "review",
    delivery_type: "pickup_or_delivery",
    availability: "disponivel",
    sale_type: "unidade",
    unit_measure: "un",
    stock_by_store: {},
    related_product_ids: [],
    meta_title: null,
    meta_description: null,
    tags: [],
    faq: [],
    technical_specs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.fiscalProfiles.unshift({
    id: profileId,
    product_id: productId,
    establishment_id: "est-comercial",
    ncm: null,
    cest: null,
    cfop_internal_default: "5102",
    cfop_interstate_default: "6102",
    origin_code: null,
    cst_icms_default: "00",
    csosn_default: null,
    requires_difal: false,
    requires_fcp: false,
    tax_rule_status: "review",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  db.catalogStaging.unshift({
    id: stagingId,
    source_batch: "qa-fiscal",
    sku_base: `SKU-FISCAL-${stamp}`,
    normalized_name: "Produto Fiscal Remediacao",
    category_name: "Acabamentos",
    subcategory_name: null,
    brand_name: null,
    size: null,
    cost_price: null,
    suggested_price: null,
    estimated_stock: 10,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: productId,
    suggested_family: null,
    suggested_category_slug: null,
    suggested_origin_code: null,
    suggested_ncm: null,
    suggested_dimensions: null,
    suggested_weight: null,
    enrichment_confidence: null,
    enrichment_notes: null,
    import_notes: null,
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "origin_code"],
    created_at: new Date().toISOString(),
  });

  db.fiscalDocuments.unshift({
    id: documentId,
    establishment_id: "est-comercial",
    order_id: null,
    document_type: "nfe_saida",
    number: "12345",
    series: "1",
    access_key: "35260412345678000123550010000012341234567890",
    cfop_summary: "5102",
    status_sefaz: "pending",
    provider: "manual",
    message: "Documento aguardando autorizacao manual registrada.",
    issued_at: null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);

  const previewResponse = await fetch(`${baseUrl}/api/admin/fiscal/remediation`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(previewResponse.status, 200);
  const previewPayload = (await previewResponse.json()) as {
    remediation: {
      actions: Array<{ type: string; reference_id: string }>;
    };
  };
  assert.ok(previewPayload.remediation.actions.some((entry) => entry.type === "profile_synced_from_product" && entry.reference_id === profileId));
  assert.ok(previewPayload.remediation.actions.some((entry) => entry.type === "profile_marked_ready" && entry.reference_id === profileId));
  assert.ok(previewPayload.remediation.actions.some((entry) => entry.type === "staging_item_refreshed" && entry.reference_id === stagingId));
  assert.ok(previewPayload.remediation.actions.some((entry) => entry.type === "fiscal_document_authorized" && entry.reference_id === documentId));

  const applyResponse = await fetch(`${baseUrl}/api/admin/fiscal/remediation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(applyResponse.status, 200);

  const nextDb = readDb();
  const nextProfile = nextDb.fiscalProfiles.find((entry) => entry.id === profileId);
  const nextStaging = nextDb.catalogStaging.find((entry) => entry.id === stagingId);
  const nextDocument = nextDb.fiscalDocuments.find((entry) => entry.id === documentId);

  assert.equal(nextProfile?.ncm, "39181000");
  assert.equal(nextProfile?.origin_code, "0");
  assert.equal(nextProfile?.tax_rule_status, "ready");
  assert.equal(nextStaging?.review_status, "approved");
  assert.deepEqual(nextStaging?.fiscal_pending_fields, []);
  assert.equal(nextDocument?.status_sefaz, "authorized");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.profile_synced_from_product" && entry.actor_id === "user-admin"));
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.profile_auto_ready" && entry.actor_id === "user-admin"));
});

test("admin security readiness endpoint exposes hardening summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/security/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ready: boolean;
    blockers: number;
    warnings: number;
    checks: {
      blockers: Array<{ item: string }>;
      warnings: Array<{ item: string }>;
      ok: Array<{ item: string }>;
    };
    next_steps: string[];
  };

  assert.equal(typeof payload.ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.ok(Array.isArray(payload.checks.blockers));
  assert.ok(Array.isArray(payload.checks.warnings));
  assert.ok(Array.isArray(payload.checks.ok));
  assert.ok(Array.isArray(payload.next_steps));
  assert.ok(
    payload.checks.blockers.some((entry) => entry.item === "csrf_secret") ||
      payload.checks.ok.some((entry) => entry.item === "csrf_secret"),
  );
});

test("admin operation readiness endpoint exposes operational backlog summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/operations/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ready: boolean;
    blockers: number;
    warnings: number;
    metrics: {
      reconciliationCritical: number;
      paymentActionRequired: number;
      expeditionBacklog: number;
      expeditionAttention: number;
      ticketsStale: number;
      ticketsAttention: number;
      returnsStale: number;
      returnsAttention: number;
    };
    checks: {
      blockers: Array<{ item: string }>;
      warnings: Array<{ item: string }>;
      ok: Array<{ item: string }>;
    };
    next_steps: string[];
  };

  assert.equal(typeof payload.ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.equal(typeof payload.metrics.reconciliationCritical, "number");
  assert.equal(typeof payload.metrics.paymentActionRequired, "number");
  assert.equal(typeof payload.metrics.expeditionBacklog, "number");
  assert.equal(typeof payload.metrics.expeditionAttention, "number");
  assert.equal(typeof payload.metrics.ticketsStale, "number");
  assert.equal(typeof payload.metrics.ticketsAttention, "number");
  assert.equal(typeof payload.metrics.returnsStale, "number");
  assert.equal(typeof payload.metrics.returnsAttention, "number");
  assert.ok(Array.isArray(payload.checks.blockers));
  assert.ok(Array.isArray(payload.checks.warnings));
  assert.ok(Array.isArray(payload.checks.ok));
  assert.ok(Array.isArray(payload.next_steps));
});

test("admin operations remediation endpoint backfills missing payment records and fiscal documents", async () => {
  const { readDb, writeDb, createId } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const orderId = `order-remediate-${stamp}`;
  const orderNumber = `PVC-REMEDIATE-${stamp}`;
  const operationalOrderId = `order-payment-approved-${stamp}`;
  const operationalDocumentId = `document-payment-approved-${stamp}`;
  const productId = db.products[0]?.id;
  assert.ok(productId);
  const now = new Date().toISOString();

  db.orders.unshift({
    id: orderId,
    order_number: orderNumber,
    tracking_token: `track-${orderId}`,
    user_id: null,
    customer_name: "Cliente Remediacao",
    customer_email: "remediacao@lojaopvc.com.br",
    customer_phone: null,
    customer_cpf: null,
    delivery_type: "delivery",
    payment_method: "pix",
    payment_status: "approved",
    payment_reference: `PIX-${stamp}`,
    payment_approved_at: now,
    shipping_address: {
      street: "Rua da Remediacao",
      number: "123",
      neighborhood: "Centro",
      city: "Garanhuns",
      state: "PE",
      zipCode: "55290000",
    },
    shipping_cost: 25,
    discount: 0,
    subtotal: 199.9,
    total: 224.9,
    notes: null,
    status: "confirmed",
    order_type: "normal",
    order_origin: "ecommerce",
    source_channel: "web",
    source_actor: "human",
    assisted_sale: false,
    seller_id: null,
    seller_name: null,
    seller_establishment_id: "est-comercial",
    store_id: null,
    store_name: null,
    delivery_required: true,
    pickup_allowed: false,
    assisted_sale_notes: null,
    payment_linked_to_order: true,
    correlation_id: `corr-${stamp}`,
    idempotency_key: null,
    coupon_id: null,
    coupon_code: null,
    inventory_locked: false,
    event_log: [],
    created_at: now,
    updated_at: now,
  });

  db.orders.unshift({
    id: operationalOrderId,
    order_number: `PVC-OPS-${stamp}`,
    tracking_token: `track-${operationalOrderId}`,
    user_id: null,
    customer_name: "Cliente Fluxo Operacional",
    customer_email: "operacao@lojaopvc.com.br",
    customer_phone: null,
    customer_cpf: null,
    delivery_type: "pickup",
    payment_method: "pix",
    payment_status: "approved",
    payment_reference: `PIX-OPS-${stamp}`,
    payment_approved_at: now,
    shipping_address: null,
    shipping_cost: 0,
    discount: 0,
    subtotal: 89.9,
    total: 89.9,
    notes: null,
    status: "payment_approved",
    order_type: "normal",
    order_origin: "ecommerce",
    source_channel: "web",
    source_actor: "human",
    assisted_sale: false,
    seller_id: null,
    seller_name: null,
    seller_establishment_id: "est-comercial",
    store_id: null,
    store_name: null,
    delivery_required: false,
    pickup_allowed: true,
    assisted_sale_notes: null,
    payment_linked_to_order: true,
    correlation_id: `corr-ops-${stamp}`,
    idempotency_key: null,
    coupon_id: null,
    coupon_code: null,
    inventory_locked: true,
    event_log: [],
    created_at: now,
    updated_at: now,
  });

  db.orderItems.unshift({
    id: createId(),
    order_id: operationalOrderId,
    product_id: productId!,
    product_name: db.products[0]!.name,
    product_sku: db.products[0]!.sku,
    quantity: 1,
    unit_price: 89.9,
    total_price: 89.9,
    allocated_lot_id: null,
    seller_establishment_id: "est-comercial",
    cfop: "5102",
  });

  db.payments.unshift({
    id: createId(),
    order_id: operationalOrderId,
    provider: "manual",
    method: "pix",
    status: "approved",
    amount: 89.9,
    correlation_id: `pay-ops-${stamp}`,
    external_reference: `PIX-OPS-${stamp}`,
    webhook_idempotency_key: null,
    created_at: now,
    updated_at: now,
  });

  db.fiscalDocuments.unshift({
    id: operationalDocumentId,
    establishment_id: "est-comercial",
    order_id: operationalOrderId,
    document_type: "nfe_saida",
    number: null,
    series: "1",
    access_key: null,
    cfop_summary: "5102",
    xml_url: null,
    status_sefaz: "pending",
    provider: "manual",
    message: "Documento preparado aguardando andamento operacional.",
    issued_at: null,
    created_at: now,
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/operations/remediation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    remediation: {
      changed: boolean;
      metrics: {
        payment_records_backfilled: number;
        fiscal_documents_prepared: number;
        orders_confirmed_after_payment: number;
        confirmed_orders_settled: number;
      };
      actions: Array<{ order_id: string; type: string }>;
    };
  };

  assert.equal(payload.remediation.changed, true);
  assert.ok(payload.remediation.metrics.payment_records_backfilled >= 1);
  assert.ok(payload.remediation.metrics.fiscal_documents_prepared >= 1);
  assert.ok(payload.remediation.metrics.orders_confirmed_after_payment >= 1);
  assert.ok(payload.remediation.metrics.confirmed_orders_settled >= 1);
  assert.ok(payload.remediation.actions.some((entry) => entry.order_id === orderId && entry.type === "payment_record_backfill"));
  assert.ok(payload.remediation.actions.some((entry) => entry.order_id === orderId && entry.type === "fiscal_document_prepare"));
  assert.ok(payload.remediation.actions.some((entry) => entry.order_id === operationalOrderId && entry.type === "order_confirmed_after_payment"));

  const nextDb = readDb();
  assert.ok(nextDb.payments.some((entry) => entry.order_id === orderId && entry.status === "approved"));
  assert.ok(nextDb.fiscalDocuments.some((entry) => entry.order_id === orderId && entry.status_sefaz === "authorized"));
  assert.ok(nextDb.auditLogs.some((entry) => entry.order_id === orderId && entry.event_type === "operations.payment_record_backfilled" && entry.actor_id === "user-admin"));
  assert.equal(nextDb.orders.find((entry) => entry.id === operationalOrderId)?.status, "confirmed");
  assert.ok(nextDb.fiscalDocuments.some((entry) => entry.id === operationalDocumentId && entry.status_sefaz === "authorized"));
  assert.ok(nextDb.inventoryMovements.some((entry) => entry.order_id === operationalOrderId && entry.movement_type === "baixa"));
});

test("admin release readiness endpoint exposes consolidated phase summary", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/release/readiness`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ready: boolean;
    blockers: number;
    warnings: number;
    sections: Record<string, { ready: boolean; blockers: number; warnings: number; summary: string }>;
    next_steps: string[];
  };

  assert.equal(typeof payload.ready, "boolean");
  assert.equal(typeof payload.blockers, "number");
  assert.equal(typeof payload.warnings, "number");
  assert.equal(typeof payload.sections.infra.ready, "boolean");
  assert.equal(typeof payload.sections.security.summary, "string");
  assert.equal(typeof payload.sections.payment.blockers, "number");
  assert.equal(typeof payload.sections.freight.blockers, "number");
  assert.equal(typeof payload.sections.fiscal.blockers, "number");
  assert.equal(typeof payload.sections.operations.blockers, "number");
  assert.equal(typeof payload.sections.go_live.blockers, "number");
  assert.ok(Array.isArray(payload.next_steps));
});

test("admin homologation pack endpoint exposes operational go-live checklist", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/homologation/pack`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    generated_at: string;
    decision: { local_base_ready: boolean; homologation_ready: boolean; go_live_ready: boolean };
    environment: { db_provider: string; queue_provider: string; payment_provider: string; freight_provider: string };
    gates: {
      phase1: { ok: boolean; blockers: number };
      phase2: { phase2_ready: boolean; blockers: number };
      release: { ready: boolean; blockers: number };
      go_live: { go_live_ready: boolean; blockers: number };
    };
    env_requirements: Array<{ phase: string; key: string; requiredFor: string; configured: boolean }>;
    missing_env: Array<{ key: string; configured: boolean }>;
    command_sequence: string[];
  };

  assert.equal(typeof payload.generated_at, "string");
  assert.equal(typeof payload.decision.local_base_ready, "boolean");
  assert.equal(typeof payload.decision.homologation_ready, "boolean");
  assert.equal(typeof payload.decision.go_live_ready, "boolean");
  assert.ok(payload.environment.db_provider);
  assert.ok(payload.environment.queue_provider);
  assert.ok(payload.environment.payment_provider);
  assert.ok(payload.environment.freight_provider);
  assert.equal(typeof payload.gates.phase1.ok, "boolean");
  assert.equal(typeof payload.gates.phase2.phase2_ready, "boolean");
  assert.equal(typeof payload.gates.release.ready, "boolean");
  assert.equal(typeof payload.gates.go_live.go_live_ready, "boolean");
  assert.ok(payload.env_requirements.some((entry) => entry.key === "DATABASE_URL"));
  assert.ok(payload.missing_env.every((entry) => entry.configured === false));
  assert.ok(payload.command_sequence.includes("npm run phase1:check"));
  assert.ok(payload.command_sequence.includes("npm run go-live:check"));
});

test("admin permission profile blocks integrations while preserving catalog access", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";
  adminUser.user_metadata.permission_profile_id = "catalog_content";
  writeDb(db);

  try {
    const admin = await createAdminSession(baseUrl);

    const integrationsResponse = await fetch(`${baseUrl}/api/admin/integrations/overview`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(integrationsResponse.status, 403);

    const goLiveResponse = await fetch(`${baseUrl}/api/admin/go-live/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(goLiveResponse.status, 403);

    const phase1ReadinessResponse = await fetch(`${baseUrl}/api/admin/phase1/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(phase1ReadinessResponse.status, 403);

    const phase2ReadinessResponse = await fetch(`${baseUrl}/api/admin/phase2/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(phase2ReadinessResponse.status, 403);

    const fiscalReadinessResponse = await fetch(`${baseUrl}/api/admin/fiscal/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(fiscalReadinessResponse.status, 200);

    const fiscalWorkboardResponse = await fetch(`${baseUrl}/api/admin/fiscal/workboard`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(fiscalWorkboardResponse.status, 200);

    const fiscalRemediationPreviewResponse = await fetch(`${baseUrl}/api/admin/fiscal/remediation`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(fiscalRemediationPreviewResponse.status, 200);

    const fiscalRemediationApplyResponse = await fetch(`${baseUrl}/api/admin/fiscal/remediation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalRemediationApplyResponse.status, 403);

    const fiscalDocumentRemediationPreviewResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/remediation`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(fiscalDocumentRemediationPreviewResponse.status, 200);

    const fiscalDocumentRemediationApplyResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/remediation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalDocumentRemediationApplyResponse.status, 403);

    const fiscalProfileBatchSyncResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/actions/sync-from-products`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalProfileBatchSyncResponse.status, 403);

    const fiscalProfileBatchReadyResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/actions/mark-ready-eligible`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalProfileBatchReadyResponse.status, 403);

    const fiscalProfileTemplateApplyResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/perfil-qualquer/apply-template`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalProfileTemplateApplyResponse.status, 403);

    const catalogSuggestionApplyResponse = await fetch(`${baseUrl}/api/admin/catalog-staging/item-qualquer/apply-suggestions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(catalogSuggestionApplyResponse.status, 404);

    const catalogLaunchMaterializeResponse = await fetch(`${baseUrl}/api/admin/catalog-staging/actions/materialize-launch-batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ limit: 2 }),
    });
    assert.equal(catalogLaunchMaterializeResponse.status, 403);

    const securityReadinessResponse = await fetch(`${baseUrl}/api/admin/security/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(securityReadinessResponse.status, 403);

    const releaseReadinessResponse = await fetch(`${baseUrl}/api/admin/release/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(releaseReadinessResponse.status, 403);

    const homologationPackResponse = await fetch(`${baseUrl}/api/admin/homologation/pack`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(homologationPackResponse.status, 403);

    const operationReadinessResponse = await fetch(`${baseUrl}/api/admin/operations/readiness`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(operationReadinessResponse.status, 200);

    const fiscalDocumentBatchAuthorizeResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/actions/authorize-ready`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(fiscalDocumentBatchAuthorizeResponse.status, 403);

    const fiscalDocumentGoLiveGateResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/actions/go-live-gate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        document_ids: ["document-qualquer"],
        gate_status: "deferred",
      }),
    });
    assert.equal(fiscalDocumentGoLiveGateResponse.status, 403);

    const operationRemediationPreviewResponse = await fetch(`${baseUrl}/api/admin/operations/remediation`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(operationRemediationPreviewResponse.status, 200);

    const operationRemediationApplyResponse = await fetch(`${baseUrl}/api/admin/operations/remediation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(operationRemediationApplyResponse.status, 403);

    const permissionsResponse = await fetch(`${baseUrl}/api/admin/permissions/overview`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(permissionsResponse.status, 200);
    const permissionProfiles = (await permissionsResponse.json()) as Array<{
      id: string;
      modules: Array<{ key: string; access: string }>;
    }>;
    const fiscalProfile = permissionProfiles.find((entry) => entry.id === "fiscal_contador");
    const cashierProfile = permissionProfiles.find((entry) => entry.id === "caixa_financeiro");
    const separationProfile = permissionProfiles.find((entry) => entry.id === "separacao_expedicao");
    const ecommerceManagerProfile = permissionProfiles.find((entry) => entry.id === "gerente_ecommerce");

    assert.ok(fiscalProfile);
    assert.ok(cashierProfile);
    assert.ok(separationProfile);
    assert.ok(ecommerceManagerProfile);
    assert.equal(fiscalProfile.modules.find((entry) => entry.key === "fiscal")?.access, "full");
    assert.equal(fiscalProfile.modules.find((entry) => entry.key === "integrations")?.access, "view");
    assert.equal(cashierProfile.modules.find((entry) => entry.key === "finance")?.access, "full");
    assert.equal(cashierProfile.modules.find((entry) => entry.key === "orders")?.access, "limited");
    assert.equal(separationProfile.modules.find((entry) => entry.key === "delivery")?.access, "limited");
    assert.equal(separationProfile.modules.find((entry) => entry.key === "finance")?.access, "none");
    assert.equal(ecommerceManagerProfile.modules.find((entry) => entry.key === "orders")?.access, "full");

    const productsResponse = await fetch(`${baseUrl}/api/admin/products`, {
      headers: {
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(productsResponse.status, 200);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      writeDb(resetDb);
    }
  }
});

test("admin operational profiles enforce finance, fiscal and expedition boundaries", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";

  try {
    adminUser.user_metadata.permission_profile_id = "cashier_finance";
    writeDb(db);
    const cashier = await createAdminSession(baseUrl);

    const cashierPaymentsResponse = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { cookie: cashier.cookieHeader },
    });
    assert.equal(cashierPaymentsResponse.status, 200);

    const cashierReconciliationResponse = await fetch(`${baseUrl}/api/admin/reconciliation/daily-report`, {
      headers: { cookie: cashier.cookieHeader },
    });
    assert.equal(cashierReconciliationResponse.status, 200);

    const cashierFiscalReadinessResponse = await fetch(`${baseUrl}/api/admin/fiscal/readiness`, {
      headers: { cookie: cashier.cookieHeader },
    });
    assert.equal(cashierFiscalReadinessResponse.status, 200);

    const cashierFiscalWriteResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/actions/mark-ready-eligible`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": cashier.csrfToken,
        cookie: cashier.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(cashierFiscalWriteResponse.status, 403);

    const cashierInventoryTransferResponse = await fetch(`${baseUrl}/api/admin/inventory/transfers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": cashier.csrfToken,
        cookie: cashier.cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(cashierInventoryTransferResponse.status, 403);

    const separationDb = readDb();
    const separationAdmin = separationDb.users.find((entry) => entry.id === "user-admin");
    assert.ok(separationAdmin);
    separationAdmin.user_metadata.permission_profile_id = "separation_expedition";
    writeDb(separationDb);
    const separation = await createAdminSession(baseUrl);

    const separationPaymentsResponse = await fetch(`${baseUrl}/api/admin/payments`, {
      headers: { cookie: separation.cookieHeader },
    });
    assert.equal(separationPaymentsResponse.status, 403);

    const separationInventoryResponse = await fetch(`${baseUrl}/api/admin/inventory/lots`, {
      headers: { cookie: separation.cookieHeader },
    });
    assert.equal(separationInventoryResponse.status, 200);

    const separationFiscalDocumentsResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents`, {
      headers: { cookie: separation.cookieHeader },
    });
    assert.equal(separationFiscalDocumentsResponse.status, 403);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      writeDb(resetDb);
    }
  }
});

test("admin user with invalid permission profile is denied by default", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";

  try {
    adminUser.user_metadata.permission_profile_id = "perfil_inexistente";
    adminUser.is_active = true;
    writeDb(db);

    const csrf = await createCsrfSession(baseUrl);
    const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf.csrfToken,
        cookie: csrf.cookieHeader,
      },
      body: JSON.stringify({
        email: "admin@gamelmetal.com",
        password: "admin123",
      }),
    });
    assert.equal(signinResponse.status, 403);

    const rolesResponse = await fetch(`${baseUrl}/api/admin/roles`, {
      headers: { cookie: csrf.cookieHeader },
    });
    assert.equal(rolesResponse.status, 401);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      resetAdmin.is_active = true;
      writeDb(resetDb);
    }
  }
});

test("admin user without permission profile is denied by default", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";

  try {
    adminUser.user_metadata.permission_profile_id = null;
    adminUser.is_active = true;
    writeDb(db);

    const csrf = await createCsrfSession(baseUrl);
    const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf.csrfToken,
        cookie: csrf.cookieHeader,
      },
      body: JSON.stringify({
        email: "admin@gamelmetal.com",
        password: "admin123",
      }),
    });
    assert.equal(signinResponse.status, 403);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      resetAdmin.is_active = true;
      writeDb(resetDb);
    }
  }
});

test("admin master manages admin users with hierarchy and audit protection", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";
  const originalActive = adminUser.is_active;
  const email = `admin.rbac.${Date.now()}@lojaopvc.com.br`;

  try {
    adminUser.user_metadata.permission_profile_id = "admin_master";
    adminUser.is_active = true;
    writeDb(db);

    const admin = await createAdminSession(baseUrl);
    const rolesResponse = await fetch(`${baseUrl}/api/admin/roles`, {
      headers: { cookie: admin.cookieHeader },
    });
    assert.equal(rolesResponse.status, 200);
    const roles = (await rolesResponse.json()) as Array<{ slug: string; permissions: string[]; level: number }>;
    assert.equal(roles.length, 10);
    assert.ok(roles.some((entry) => entry.slug === "admin_master" && entry.permissions.includes("*") && entry.level === 100));

    const createResponse = await fetch(`${baseUrl}/api/admin/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        name: "Operador RBAC QA",
        email,
        password: "operador123",
        profileId: "operador_pedidos",
        jobTitle: "Operador de pedidos",
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { id: string; email: string; profileSlug: string; isActive: boolean };
    assert.equal(created.email, email);
    assert.equal(created.profileSlug, "operador_pedidos");
    assert.equal(created.isActive, true);

    const deactivateLastMasterResponse = await fetch(`${baseUrl}/api/admin/users/user-admin`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactivateLastMasterResponse.status, 400);

    const updateResponse = await fetch(`${baseUrl}/api/admin/users/${created.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ profileId: "atendimento_suporte", isActive: false }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()) as { profileSlug: string; isActive: boolean };
    assert.equal(updated.profileSlug, "atendimento_suporte");
    assert.equal(updated.isActive, false);

    const inactiveCsrf = await createCsrfSession(baseUrl);
    const inactiveSigninResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": inactiveCsrf.csrfToken,
        cookie: inactiveCsrf.cookieHeader,
      },
      body: JSON.stringify({ email, password: "operador123" }),
    });
    assert.equal(inactiveSigninResponse.status, 403);

    const deleteRoleResponse = await fetch(`${baseUrl}/api/admin/roles/admin_master`, {
      method: "DELETE",
      headers: {
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(deleteRoleResponse.status, 405);

    const deleteAuditResponse = await fetch(`${baseUrl}/api/admin/audit-logs/audit-log-qa`, {
      method: "DELETE",
      headers: {
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(deleteAuditResponse.status, 405);

    const auditResponse = await fetch(`${baseUrl}/api/admin/audit-logs?action=admin.user`, {
      headers: { cookie: admin.cookieHeader },
    });
    assert.equal(auditResponse.status, 200);
    const auditLogs = (await auditResponse.json()) as Array<{ event_type: string; payload?: { entity?: string } }>;
    assert.ok(auditLogs.some((entry) => entry.event_type === "admin.user_created" && entry.payload?.entity === "admin_user"));
    assert.ok(auditLogs.some((entry) => entry.event_type === "admin.user_updated" && entry.payload?.entity === "admin_user"));

    const nextDb = readDb();
    const createdUser = nextDb.users.find((entry) => entry.id === created.id);
    assert.ok(createdUser);
    createdUser.email = `removed.${email}`;
    createdUser.is_active = false;
    writeDb(nextDb);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      resetAdmin.is_active = originalActive;
      writeDb(resetDb);
    }
  }
});

test("administrador can self-edit and manage a peer administrador, while lower profiles stay blocked from users.manage", async () => {
  const { readDb, writeDb } = await getDbModule();
  const admin = await createAdminSession(baseUrl);

  let db = readDb();
  const originalProfile = db.users.find((entry) => entry.id === "user-admin")?.user_metadata.permission_profile_id ?? "administrador";
  const peerAdminId = `user-peer-admin-${Date.now()}`;
  const lowerUserId = `user-lower-${Date.now()}`;
  db.users.push(
    {
      id: peerAdminId,
      email: `peer-${Date.now()}@lojaopvc.com.br`,
      password_hash: "x",
      password_salt: "x",
      role: "admin",
      is_active: true,
      session_token: null,
      session_expires_at: null,
      user_metadata: { full_name: "Peer Admin", permission_profile_id: "administrador" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as DbUser,
    {
      id: lowerUserId,
      email: `lower-${Date.now()}@lojaopvc.com.br`,
      password_hash: "x",
      password_salt: "x",
      role: "admin",
      is_active: true,
      session_token: null,
      session_expires_at: null,
      user_metadata: { full_name: "Lower Comercial", permission_profile_id: "comercial" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as DbUser,
  );
  writeDb(db);

  try {
    const selfEditResponse = await fetch(`${baseUrl}/api/admin/users/user-admin`, {
      method: "PATCH",
      headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
      body: JSON.stringify({ jobTitle: "Self Edit Regression Test" }),
    });
    assert.equal(selfEditResponse.status, 200);

    const peerEditResponse = await fetch(`${baseUrl}/api/admin/users/${peerAdminId}`, {
      method: "PATCH",
      headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
      body: JSON.stringify({ jobTitle: "Peer Edit Regression Test" }),
    });
    assert.equal(peerEditResponse.status, 200);

    const lowerEditResponse = await fetch(`${baseUrl}/api/admin/users/${lowerUserId}`, {
      method: "PATCH",
      headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
      body: JSON.stringify({ jobTitle: "Lower Edit Regression Test" }),
    });
    assert.equal(lowerEditResponse.status, 200);

    db = readDb();
    const adminUser = db.users.find((entry) => entry.id === "user-admin");
    assert.ok(adminUser);
    adminUser.user_metadata.permission_profile_id = "comercial";
    writeDb(db);

    const comercialAttemptResponse = await fetch(`${baseUrl}/api/admin/users/${lowerUserId}`, {
      method: "PATCH",
      headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
      body: JSON.stringify({ jobTitle: "Should be denied" }),
    });
    assert.equal(comercialAttemptResponse.status, 403);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      writeDb(resetDb);
    }
  }
});
