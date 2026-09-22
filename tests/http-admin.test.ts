import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer, getDbModule } from "./http-server.ts";

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

async function seedSellableProduct(suffix: string, quantity = 3) {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const templateProduct =
    db.products.find((product) => product.is_active !== false && product.status_product !== "draft") ??
    db.products.find((product) => product.status_product !== "draft") ??
    db.products[0];
  assert.ok(templateProduct);

  const id = `${suffix}-${Date.now()}`;
  db.products.unshift({
    ...templateProduct,
    id,
    sku: `QA-${suffix.toUpperCase()}-${Date.now()}`,
    slug: `qa-${suffix}-${Date.now()}`,
    name: `Produto QA ${suffix}`,
    stock: quantity,
    is_active: true,
    status_product: "active",
    availability: "disponivel",
    });
  db.inventoryLots.unshift({
    id: `lot-${suffix}-${Date.now()}`,
    product_id: id,
    establishment_id: "est-comercial",
    source_type: "compra_nacional",
    source_reference: `seed-${suffix}`,
    source_document_number: suffix.toUpperCase(),
    quantity_in: quantity,
    quantity_available: quantity,
    unit_cost: 50,
    landed_cost_unit: 50,
    currency: "BRL",
    created_at: new Date().toISOString(),
  });
  writeDb(db);
  return id;
}

async function getSellableTemplateProduct() {
  const { readDb } = await getDbModule();
  const db = readDb();
  return (
    db.products.find((product) => product.is_active !== false && product.status_product !== "draft") ??
    db.products.find((product) => product.status_product !== "draft") ??
    db.products[0] ??
    null
  );
}

test("admin can create delivery zone with csrf-protected session", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/delivery-zones`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      neighborhood: "Boa Vista QA",
      city: "Garanhuns",
      state: "PE",
      delivery_fee: 19.9,
      estimated_days: 2,
      notes: "Criado por teste HTTP",
    }),
  });

  assert.equal(response.status, 201);
  const payload = (await response.json()) as { id: string; neighborhood: string; city: string; state: string };
  assert.ok(payload.id);
  assert.equal(payload.neighborhood, "Boa Vista QA");
  assert.equal(payload.city, "Garanhuns");
  assert.equal(payload.state, "PE");
});

test("admin can create, list and deactivate freight carrier", async () => {
  const admin = await createAdminSession(baseUrl);
  const code = `QA-CARRIER-${Date.now()}`;
  const createResponse = await fetch(`${baseUrl}/api/admin/freight-carriers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      name: "Transportadora QA Nacional",
      code,
      service_types: ["Rodoviario", "Carga fracionada"],
      coverage_states: ["BR"],
      max_weight_kg: 250,
      max_length_cm: 350,
      max_cubic_meters: 2.5,
      supports_heavy: true,
      supports_bulky: true,
      tracking_url_template: "https://qa.example/rastreio/{tracking_code}",
      notes: "Cadastro homologado por teste.",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { id: string; code: string; supports_heavy: boolean; coverage_states: string[] };
  assert.ok(created.id);
  assert.equal(created.code, code);
  assert.equal(created.supports_heavy, true);
  assert.deepEqual(created.coverage_states, ["BR"]);

  const listResponse = await fetch(`${baseUrl}/api/admin/freight-carriers`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(listResponse.status, 200);
  const carriers = (await listResponse.json()) as Array<{ id: string; code: string; is_active: boolean }>;
  assert.ok(carriers.some((carrier) => carrier.id === created.id && carrier.code === code));

  const deactivateResponse = await fetch(`${baseUrl}/api/admin/freight-carriers/${created.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(deactivateResponse.status, 200);
  const deactivated = (await deactivateResponse.json()) as { id: string; is_active: boolean };
  assert.equal(deactivated.id, created.id);
  assert.equal(deactivated.is_active, false);
});

test("admin freight profile recommends eligible carriers for delivery order", async () => {
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
      "idempotency-key": `admin-order-freight-profile-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Perfil Frete QA",
      customerEmail: "perfil.frete.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "delivery",
      paymentMethod: "pix",
      shippingCost: 99,
      shippingAddress: {
        street: "Rua Transportadora",
        number: "300",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
        zipCode: "01001000",
      },
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string } };

  const admin = await createAdminSession(baseUrl);
  const profileResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/freight-profile`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(profileResponse.status, 200);
  const profile = (await profileResponse.json()) as {
    destination_state: string;
    total_weight_kg: number;
    total_cubic_meters: number;
    max_length_cm: number;
    recommendations: Array<{ carrier: { name: string }; eligible: boolean; reasons: string[] }>;
  };
  assert.equal(profile.destination_state, "SP");
  assert.equal(typeof profile.total_weight_kg, "number");
  assert.equal(typeof profile.total_cubic_meters, "number");
  assert.equal(typeof profile.max_length_cm, "number");
  assert.ok(profile.recommendations.length > 0);
  assert.ok(profile.recommendations.some((entry) => entry.eligible || entry.reasons.length > 0));
});

test("admin can create and update brand through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/admin/brands`, {
    method: "POST",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Marca QA Enterprise", is_active: true }),
  });

  assert.equal(createResponse.status, 201);
  const createdBrand = await createResponse.json();
  assert.equal(createdBrand.name, "Marca QA Enterprise");

  const updateResponse = await fetch(`${baseUrl}/api/admin/brands/${createdBrand.id}`, {
    method: "PATCH",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Marca QA Enterprise Atualizada", is_active: false }),
  });

  assert.equal(updateResponse.status, 200);
  const updatedBrand = await updateResponse.json();
  assert.equal(updatedBrand.name, "Marca QA Enterprise Atualizada");
  assert.equal(updatedBrand.is_active, false);
});

test("admin can create and update category through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);
  const stamp = Date.now();

  const createResponse = await fetch(`${baseUrl}/api/admin/categories`, {
    method: "POST",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: `Categoria QA ${stamp}`,
      description: "Categoria criada em teste para validar gestao de catalogo.",
      image_url: "/categoria-qa.jpg",
      icon: "QA",
    }),
  });

  assert.equal(createResponse.status, 201);
  const createdCategory = await createResponse.json() as { id: string; name: string; slug: string; is_active: boolean };
  assert.equal(createdCategory.name, `Categoria QA ${stamp}`);
  assert.equal(createdCategory.slug, `categoria-qa-${stamp}`);

  const updateResponse = await fetch(`${baseUrl}/api/admin/categories/${createdCategory.id}`, {
    method: "PATCH",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: `Categoria QA Atualizada ${stamp}`,
      slug: `categoria-qa-atualizada-${stamp}`,
      description: "Descricao atualizada para SEO e navegacao.",
      is_active: false,
    }),
  });

  assert.equal(updateResponse.status, 200);
  const updatedCategory = await updateResponse.json() as { name: string; slug: string; description: string; is_active: boolean };
  assert.equal(updatedCategory.name, `Categoria QA Atualizada ${stamp}`);
  assert.equal(updatedCategory.slug, `categoria-qa-atualizada-${stamp}`);
  assert.equal(updatedCategory.description, "Descricao atualizada para SEO e navegacao.");
  assert.equal(updatedCategory.is_active, false);

  const duplicateResponse = await fetch(`${baseUrl}/api/admin/categories/${createdCategory.id}`, {
    method: "PATCH",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ slug: "forros-pvc" }),
  });
  assert.equal(duplicateResponse.status, 409);
});

test("admin can update commercial settings through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/settings/commercial`, {
    method: "PUT",
    headers: {
      cookie: admin.cookieHeader,
      "x-csrf-token": admin.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      minimum_free_shipping_amount: 450,
      pickup_discount_percentage: 3,
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.minimum_free_shipping_amount, 450);
  assert.equal(payload.pickup_discount_percentage, 3);
});

test("admin can create and update lead through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);
  const createResponse = await fetch(`${baseUrl}/api/admin/leads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      name: "Lead QA Operacional",
      email: "lead.qa@lojaopvc.com.br",
      phone: "(87) 99999-0000",
      source: "web",
      channel: "manual",
      notes: "Lead criado por teste HTTP",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { id: string; name: string; email: string | null; phone: string | null; stage: string };
  assert.ok(created.id);
  assert.equal(created.name, "Lead QA Operacional");
  assert.equal(created.email, "lead.qa@lojaopvc.com.br");
  assert.equal(created.phone, "87999990000");
  assert.equal(created.stage, "new");

  const updateResponse = await fetch(`${baseUrl}/api/admin/leads/${created.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      stage: "qualified",
      notes: "Lead qualificado no teste",
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()) as { id: string; stage: string; notes: string | null };
  assert.equal(updated.id, created.id);
  assert.equal(updated.stage, "qualified");
  assert.equal(updated.notes, "Lead qualificado no teste");
});

test("admin can update site content through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/admin/products`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const response = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      hero_title: "Titulo QA Operacional",
      featured_category_ids: ["cat-forros-pvc"],
      go_live_product_ids: [products[0].id],
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    hero_title: string;
    featured_category_ids: string[];
    go_live_product_ids: string[];
  };
  assert.equal(payload.hero_title, "Titulo QA Operacional");
  assert.deepEqual(payload.featured_category_ids, ["cat-forros-pvc"]);
  assert.deepEqual(payload.go_live_product_ids, [products[0].id]);
});

test("minimal fiscal readiness uses explicit go-live product scope when configured", async () => {
  const admin = await createAdminSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/admin/products`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length >= 2);

  const updateContentResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      go_live_product_ids: [products[0].id],
    }),
  });
  assert.equal(updateContentResponse.status, 200);

  const readinessResponse = await fetch(`${baseUrl}/api/admin/fiscal/readiness?scope=minimal-go-live`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(readinessResponse.status, 200);
  const readinessPayload = (await readinessResponse.json()) as {
    scope: string;
    metrics: { scoped_products: number };
  };
  assert.equal(readinessPayload.scope, "minimal-go-live");
  assert.equal(readinessPayload.metrics.scoped_products, 1);
});

test("minimal fiscal workboard ignores deferred catalog staging items from the go-live gate", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();

  db.siteContent.go_live_product_ids = ["1"];
  db.catalogStaging.unshift({
    id: `catalog-staging-deferred-${stamp}`,
    source_batch: "qa-deferred-workboard",
    sku_base: `SKU-DEFERRED-${stamp}`,
    normalized_name: "Item Deferido Workboard",
    category_name: "Forros PVC",
    subcategory_name: null,
    brand_name: null,
    size: "6,00 m",
    cost_price: null,
    suggested_price: null,
    estimated_stock: 3,
    review_status: "review",
    review_reason: "Deferido fora do corte minimo.",
    mapped_product_id: "1",
    suggested_family: "forros-pvc-e-acabamentos",
    suggested_category_slug: "forros-pvc",
    suggested_origin_code: "0",
    suggested_ncm: null,
    suggested_dimensions: "6,00 m",
    suggested_weight: null,
    enrichment_confidence: "medium",
    enrichment_notes: null,
    import_notes: null,
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "tax_code"],
    go_live_gate_status: "deferred",
    go_live_gate_note: "Fora do corte minimo do teste.",
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/fiscal/workboard?scope=minimal-go-live`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    metrics: { pending_catalog_items: number };
    staging: { samples: Array<{ id: string }> };
  };
  assert.equal(payload.metrics.pending_catalog_items, 0);
  assert.ok(!payload.staging.samples.some((entry) => entry.id === `catalog-staging-deferred-${stamp}`));
});

test("admin can update product fiscal fields through serialized admin flow", async () => {
  const admin = await createAdminSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/admin/products`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const response = await fetch(`${baseUrl}/api/admin/products/${products[0].id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      ncm: "39181000",
      cest: "10.012.00",
      origin_code: "0",
      fiscal_group: "revestimentos",
      tax_classification_status: "review",
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ncm: string | null;
    cest: string | null;
    origin_code: string | null;
    fiscal_group: string | null;
    tax_classification_status: string | null;
  };
  assert.equal(payload.ncm, "39181000");
  assert.equal(payload.cest, "10.012.00");
  assert.equal(payload.origin_code, "0");
  assert.equal(payload.fiscal_group, "revestimentos");
  assert.equal(payload.tax_classification_status, "review");
});

test("admin can update product commercial publication fields without duplicate slug", async () => {
  const admin = await createAdminSession(baseUrl);

  const productsResponse = await fetch(`${baseUrl}/api/admin/products`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string; slug: string; category_id: string | null; brand_id: string | null }>;
  assert.ok(products.length >= 2);
  const categoryId = products[0].category_id ?? products[1].category_id;
  const brandId = products[0].brand_id ?? products[1].brand_id;
  assert.ok(categoryId);
  assert.ok(brandId);

  const slug = `produto-comercial-${Date.now()}`;
  const response = await fetch(`${baseUrl}/api/admin/products/${products[0].id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      slug,
      category_id: categoryId,
      brand_id: brandId,
      unit_measure: "un",
      unit: "un",
      material: "PVC",
      related_product_ids: [products[1].id],
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    slug: string;
    category_id: string;
    brand_id: string;
    unit_measure: string;
    material: string;
    related_product_ids: string[];
  };
  assert.equal(payload.slug, slug);
  assert.equal(payload.category_id, categoryId);
  assert.equal(payload.brand_id, brandId);
  assert.equal(payload.unit_measure, "un");
  assert.equal(payload.material, "PVC");
  assert.deepEqual(payload.related_product_ids, [products[1].id]);

  const duplicateResponse = await fetch(`${baseUrl}/api/admin/products/${products[1].id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ slug }),
  });
  assert.equal(duplicateResponse.status, 409);
});

test("admin updating slug alongside commercial fields persists all fields after reload (regression for 61ea169)", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const templateProduct = await getSellableTemplateProduct();
  assert.ok(templateProduct);

  const stamp = Date.now();
  const productId = `regressao-slug-${stamp}`;
  db.products.unshift({
    ...templateProduct,
    id: productId,
    sku: `QA-REGRESSAO-${stamp}`,
    slug: `qa-regressao-origem-${stamp}`,
    name: `Produto QA Regressao ${stamp}`,
    is_active: true,
    image_url: "/assets/brand/logo-gamel.svg",
    images: ["/assets/brand/logo-gamel.svg"],
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const slug = `produto-slug-regressao-${stamp}`;
  const shortDescription = `Descricao curta de regressao ${stamp}`;
  const price = 1234.56;
  const stock = 77;

  const patchResponse = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      slug,
      short_description: shortDescription,
      price,
      stock,
    }),
  });
  assert.equal(patchResponse.status, 200);

  // Bug 61ea169: this handler could report 200 with all fields "updated" in the
  // response body while silently persisting only the slug. Never trust the PATCH
  // response alone here - reload via a separate GET (full list) to prove real persistence.
  const reloadResponse = await fetch(`${baseUrl}/api/admin/products`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(reloadResponse.status, 200);
  const reloadedProducts = (await reloadResponse.json()) as Array<{
    id: string;
    slug: string;
    short_description: string | null;
    price: number;
    stock: number;
  }>;
  const reloaded = reloadedProducts.find((item) => item.id === productId);
  assert.ok(reloaded);
  assert.equal(reloaded.slug, slug);
  assert.equal(reloaded.short_description, shortDescription);
  assert.equal(reloaded.price, price);
  assert.equal(reloaded.stock, stock);
});

test("admin cannot activate product with placeholder image", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const templateProduct = await getSellableTemplateProduct();
  assert.ok(templateProduct);

  const productId = `catalog-placeholder-activation-${stamp}`;
  db.products.unshift({
    ...templateProduct,
    id: productId,
    sku: `QA-PLACEHOLDER-${stamp}`,
    name: `Produto Placeholder ${stamp}`,
    slug: `produto-placeholder-${stamp}`,
    image_url: "/placeholder.svg",
    images: ["/placeholder.svg"],
    is_active: false,
    image_review_status: "missing",
    image_review_notes: "QA placeholder guard",
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      is_active: true,
    }),
  });

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /imagem real/i);
});

test("admin can apply catalog staging suggestions to mapped product and refresh fiscal backlog", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const productId = `product-staging-suggestions-${stamp}`;
  const profileId = `fiscal-profile-staging-suggestions-${stamp}`;
  const stagingId = `catalog-staging-suggestions-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: productId,
    name: "Produto Staging Sugestoes",
    slug: `produto-staging-sugestoes-${stamp}`,
    sku: `SKU-STAGING-${stamp}`,
    ncm: null,
    cest: null,
    origin_code: null,
    fiscal_group: null,
    dimensions: null,
    measures: null,
    weight: null,
    tax_classification_status: "pending",
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
    tax_rule_status: "pending",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  db.catalogStaging.unshift({
    id: stagingId,
    source_batch: "qa-staging-suggestions",
    sku_base: `SKU-STAGING-${stamp}`,
    normalized_name: "Produto Staging Sugestoes",
    category_name: "Acabamentos",
    subcategory_name: null,
    brand_name: baseProduct.brand_id,
    size: "2,00 x 0,50 m",
    cost_price: null,
    suggested_price: null,
    estimated_stock: 3,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: productId,
    suggested_family: "acabamentos-pvc",
    suggested_category_slug: null,
    suggested_origin_code: "0",
    suggested_ncm: "39181000",
    suggested_dimensions: "2,00 x 0,50 m",
    suggested_weight: 8.5,
    enrichment_confidence: "high",
    enrichment_notes: "Sugestoes sinteticas para QA",
    import_notes: null,
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"],
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/catalog-staging/${stagingId}/apply-suggestions`, {
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
    ok: boolean;
    applied_fields: string[];
    staging_item: {
      review_status: string;
      fiscal_pending_fields: string[];
    };
  };
  assert.equal(payload.ok, true);
  assert.ok(payload.applied_fields.length >= 4);
  assert.deepEqual(payload.staging_item.fiscal_pending_fields, []);
  assert.equal(payload.staging_item.review_status, "approved");

  const nextDb = readDb();
  const nextProduct = nextDb.products.find((entry) => entry.id === productId);
  const nextProfile = nextDb.fiscalProfiles.find((entry) => entry.id === profileId);
  const nextStaging = nextDb.catalogStaging.find((entry) => entry.id === stagingId);

  assert.equal(nextProduct?.ncm, "39181000");
  assert.equal(nextProduct?.origin_code, "0");
  assert.ok(nextProduct?.fiscal_group);
  assert.ok(nextProduct?.dimensions);
  assert.ok(nextProduct?.measures);
  assert.ok(typeof nextProduct?.weight === "number" && nextProduct.weight > 0);
  assert.equal(nextProduct?.tax_classification_status, "review");
  assert.equal(nextProfile?.ncm, "39181000");
  assert.equal(nextProfile?.origin_code, "0");
  assert.equal(nextProfile?.tax_rule_status, "review");
  assert.deepEqual(nextStaging?.fiscal_pending_fields, []);
  assert.equal(nextStaging?.review_status, "approved");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "catalog_staging.suggestions_applied"));
});

test("admin can apply catalog staging suggestions in batch for mapped items", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const productId = `product-staging-batch-${stamp}`;
  const profileId = `fiscal-profile-staging-batch-${stamp}`;
  const stagingId = `catalog-staging-batch-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: productId,
    name: "Produto Staging Lote",
    slug: `produto-staging-lote-${stamp}`,
    sku: `SKU-STAGING-LOTE-${stamp}`,
    ncm: null,
    origin_code: null,
    fiscal_group: null,
    dimensions: null,
    measures: null,
    weight: null,
    tax_classification_status: "pending",
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
    tax_rule_status: "pending",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  db.catalogStaging.unshift({
    id: stagingId,
    source_batch: "qa-staging-batch",
    sku_base: `SKU-STAGING-LOTE-${stamp}`,
    normalized_name: "Produto Staging Lote",
    category_name: "Acabamentos",
    subcategory_name: null,
    brand_name: baseProduct.brand_id,
    size: "2,50 x 0,50 m",
    cost_price: null,
    suggested_price: null,
    estimated_stock: 4,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: productId,
    suggested_family: "acabamentos-pvc",
    suggested_category_slug: null,
    suggested_origin_code: "0",
    suggested_ncm: "39181000",
    suggested_dimensions: "2,50 x 0,50 m",
    suggested_weight: 9.4,
    enrichment_confidence: "high",
    enrichment_notes: "Sugestoes sinteticas para QA em lote",
    import_notes: null,
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"],
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/catalog-staging/actions/apply-suggestions`, {
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
    ok: boolean;
    processed: number;
    changed: number;
    unchanged: number;
    failures: Array<{ item_id: string; reason: string }>;
    items: Array<{ item_id: string; mapped_product_id: string; applied_fields: string[] }>;
  };
  assert.equal(payload.ok, true);
  assert.ok(payload.processed >= 1);
  assert.ok(payload.changed >= 1);
  assert.deepEqual(payload.failures, []);
  assert.ok(payload.items.some((entry) => entry.item_id === stagingId && entry.mapped_product_id === productId && entry.applied_fields.length >= 4));

  const nextDb = readDb();
  const nextProduct = nextDb.products.find((entry) => entry.id === productId);
  const nextProfile = nextDb.fiscalProfiles.find((entry) => entry.id === profileId);
  const nextStaging = nextDb.catalogStaging.find((entry) => entry.id === stagingId);

  assert.equal(nextProduct?.ncm, "39181000");
  assert.equal(nextProduct?.origin_code, "0");
  assert.equal(nextProfile?.ncm, "39181000");
  assert.equal(nextProfile?.origin_code, "0");
  assert.deepEqual(nextStaging?.fiscal_pending_fields, []);
  assert.equal(nextStaging?.review_status, "approved");
});

test("admin can materialize the catalog launch batch into draft origin products", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();

  const category = db.categories.find((entry) => entry.name === "Forros PVC") ?? db.categories[0];
  assert.ok(category);

  db.catalogStaging.unshift({
    id: `catalog-launch-a-${stamp}`,
    source_batch: "qa-launch-batch",
    sku_base: `SKU-LAUNCH-A-${stamp}`,
    normalized_name: `Produto Launch A ${stamp}`,
    category_name: category.name,
    subcategory_name: "Forros",
    brand_name: null,
    size: "6,00 m",
    cost_price: 10,
    suggested_price: 22.9,
    estimated_stock: 15,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: null,
    suggested_family: "forros-pvc-e-acabamentos",
    suggested_category_slug: category.slug,
    suggested_origin_code: "0",
    suggested_ncm: "39181000",
    suggested_dimensions: "6,00 m",
    suggested_weight: 2.4,
    enrichment_confidence: "high",
    enrichment_notes: "QA launch batch",
    import_notes: "Item QA para materializacao do lote inicial",
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"],
    created_at: new Date().toISOString(),
  });

  db.catalogStaging.unshift({
    id: `catalog-launch-b-${stamp}`,
    source_batch: "qa-launch-batch",
    sku_base: `SKU-LAUNCH-B-${stamp}`,
    normalized_name: `Produto Launch B ${stamp}`,
    category_name: category.name,
    subcategory_name: "Forros",
    brand_name: null,
    size: "5,00 m",
    cost_price: 11,
    suggested_price: 19.9,
    estimated_stock: 11,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: null,
    suggested_family: "forros-pvc-e-acabamentos",
    suggested_category_slug: category.slug,
    suggested_origin_code: "0",
    suggested_ncm: "39181000",
    suggested_dimensions: "5,00 m",
    suggested_weight: 2.1,
    enrichment_confidence: "high",
    enrichment_notes: "QA launch batch",
    import_notes: "Item QA para materializacao do lote inicial",
    publish_flag: true,
    fiscal_pending_fields: ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"],
    created_at: new Date().toISOString(),
  });

  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/catalog-staging/actions/materialize-launch-batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ limit: 2, staging_ids: [`catalog-launch-a-${stamp}`, `catalog-launch-b-${stamp}`] }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    selected: number;
    materialized: number;
    items: Array<{ staging_item_id: string; mapped_product_id: string }>;
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.selected, 2);
  assert.equal(payload.materialized, 2);
  assert.equal(payload.items.length, 2);

  const nextDb = readDb();
  for (const item of payload.items) {
    const staging = nextDb.catalogStaging.find((entry) => entry.id === item.staging_item_id);
    const product = nextDb.products.find((entry) => entry.id === item.mapped_product_id);
    const profile = nextDb.fiscalProfiles.find((entry) => entry.product_id === item.mapped_product_id && entry.establishment_id === "est-comercial");

    assert.ok(staging?.mapped_product_id);
    assert.equal(staging?.review_status, "review");
    assert.ok(product);
    assert.equal(product?.status_product, "draft");
    assert.equal(product?.tax_classification_status, "review");
    assert.ok(profile);
  }

  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "catalog_staging.launch_batch_materialized"));
});

test("admin cannot publish catalog staging item with incomplete publication quality", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const templateProduct = await getSellableTemplateProduct();
  assert.ok(templateProduct);
  const category = db.categories.find((entry) => entry.id === templateProduct.category_id) ?? db.categories[0];
  assert.ok(category);

  const productId = `catalog-quality-product-${stamp}`;
  db.products.unshift({
    ...templateProduct,
    id: productId,
    sku: `QA-CATALOG-QUALITY-${stamp}`,
    name: `Produto Catalogo Sem Imagem ${stamp}`,
    slug: `produto-catalogo-sem-imagem-${stamp}`,
    category_id: category.id,
    price: 42.9,
    stock: 5,
    ncm: "39181000",
    tax_classification_status: "ready",
    image_url: "/placeholder.svg",
    images: ["/placeholder.svg"],
    is_active: false,
    status_product: "draft",
  });

  db.catalogStaging.unshift({
    id: `catalog-quality-staging-${stamp}`,
    source_batch: "qa-quality",
    source_sheet: "Importar_Site",
    sku_base: `QA-CATALOG-QUALITY-${stamp}`,
    source_name: `Produto Catalogo Sem Imagem ${stamp}`,
    normalized_name: `Produto Catalogo Sem Imagem ${stamp}`,
    category_name: category.name,
    subcategory_name: "QA",
    brand_name: null,
    color: null,
    size: "1 un",
    cost_price: 10,
    suggested_price: 42.9,
    estimated_stock: 5,
    publish_flag: true,
    review_status: "approved",
    review_reason: null,
    mapped_product_id: productId,
    fiscal_pending_fields: [],
    suggested_family: "qa",
    suggested_category_slug: category.slug,
    suggested_origin_code: "0",
    suggested_ncm: "39181000",
    suggested_dimensions: "1 un",
    suggested_weight: 1,
    enrichment_confidence: "high",
    enrichment_notes: "QA qualidade de publicacao",
    import_notes: "Item QA sem imagem real para bloquear publicacao",
    go_live_gate_status: "required",
    go_live_gate_note: null,
    created_at: new Date().toISOString(),
  });

  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/catalog-staging/catalog-quality-staging-${stamp}/publish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error: string };
  assert.match(payload.error, /image\(catalogo\)/i);
});

test("admin can align catalog staging go-live gate to the launch batch", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const category = db.categories.find((entry) => entry.slug === "forros-pvc") ?? db.categories[0];
  assert.ok(category);

  db.catalogStaging.unshift({
    id: `catalog-gate-a-${stamp}`,
    source_batch: `xlsx-${stamp}`,
    source_sheet: "Importar_Site",
    sku_base: `SKU-GATE-A-${stamp}`,
    source_name: "Forro PVC Gate A",
    normalized_name: "Forro PVC Gate A",
    category_name: category.name,
    subcategory_name: "Forros",
    brand_name: "PVC",
    color: null,
    size: "5,00 m",
    cost_price: 10,
    suggested_price: 29.9,
    estimated_stock: 12,
    publish_flag: true,
    review_status: "review",
    review_reason: "Cadastro fiscal incompleto para publicacao automatica.",
    mapped_product_id: null,
    fiscal_pending_fields: ["ncm", "weight"],
    suggested_family: "forros-pvc-e-acabamentos",
    suggested_category_slug: category.slug,
    suggested_origin_code: "0",
    suggested_ncm: null,
    suggested_dimensions: "5,00 m",
    suggested_weight: null,
    enrichment_confidence: "high",
    enrichment_notes: "QA gate required",
    import_notes: "Item QA para gate required",
    go_live_gate_status: "required",
    go_live_gate_note: null,
    created_at: new Date().toISOString(),
  });

  db.catalogStaging.unshift({
    id: `catalog-gate-b-${stamp}`,
    source_batch: `xlsx-${stamp}`,
    source_sheet: "Importar_Site",
    sku_base: `SKU-GATE-B-${stamp}`,
    source_name: "Item Generico Gate B",
    normalized_name: "Item Generico Gate B",
    category_name: "Outros",
    subcategory_name: "Revisar",
    brand_name: null,
    color: null,
    size: null,
    cost_price: 4,
    suggested_price: 9.9,
    estimated_stock: 2,
    publish_flag: false,
    review_status: "review",
    review_reason: "Revisar comercialmente antes de publicar.",
    mapped_product_id: null,
    fiscal_pending_fields: ["ncm", "origin_code", "fiscal_group", "weight", "dimensions"],
    suggested_family: null,
    suggested_category_slug: null,
    suggested_origin_code: null,
    suggested_ncm: null,
    suggested_dimensions: null,
    suggested_weight: null,
    enrichment_confidence: "low",
    enrichment_notes: "QA gate deferred",
    import_notes: "Item QA para gate deferred",
    go_live_gate_status: "required",
    go_live_gate_note: null,
    created_at: new Date().toISOString(),
  });

  writeDb(db);

  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/catalog-staging/actions/align-go-live-gate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ limit: 1 }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    changed: number;
    required: number;
    deferred: number;
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.required, 1);

  const nextDb = readDb();
  const deferredItem = nextDb.catalogStaging.find((entry) => entry.id === `catalog-gate-b-${stamp}`);
  assert.equal(deferredItem?.go_live_gate_status, "deferred");
  assert.equal(nextDb.catalogStaging.filter((entry) => entry.go_live_gate_status === "required").length >= 1, true);
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "catalog_staging.go_live_gate_aligned"));
});

test("admin can sync fiscal profiles, promote ready-eligible profiles and authorize ready fiscal documents in batch", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const productId = `product-fiscal-batch-${stamp}`;
  const profileId = `profile-fiscal-batch-${stamp}`;
  const readyProductId = `product-fiscal-ready-batch-${stamp}`;
  const readyProfileId = `profile-fiscal-ready-batch-${stamp}`;
  const documentId = `document-fiscal-batch-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: productId,
    name: "Produto Fiscal Batch",
    slug: `produto-fiscal-batch-${stamp}`,
    sku: `SKU-FISCAL-BATCH-${stamp}`,
    ncm: "39181000",
    cest: "10.012.00",
    origin_code: "0",
    tax_classification_status: "review",
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
    tax_rule_status: "pending",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  db.products.unshift({
    ...baseProduct,
    id: readyProductId,
    name: "Produto Fiscal Pronto Batch",
    slug: `produto-fiscal-pronto-batch-${stamp}`,
    sku: `SKU-FISCAL-READY-${stamp}`,
    ncm: "39181000",
    cest: "10.012.00",
    origin_code: "0",
    dimensions: "2,00 x 0,50 m",
    measures: "2,00 x 0,50 m",
    weight: 4.2,
    tax_classification_status: "review",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.fiscalProfiles.unshift({
    id: readyProfileId,
    product_id: readyProductId,
    establishment_id: "est-comercial",
    ncm: "39181000",
    cest: "10.012.00",
    cfop_internal_default: "5102",
    cfop_interstate_default: "6102",
    origin_code: "0",
    cst_icms_default: "00",
    csosn_default: null,
    requires_difal: false,
    requires_fcp: false,
    tax_rule_status: "review",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  db.fiscalDocuments.unshift({
    id: documentId,
    establishment_id: "est-comercial",
    order_id: null,
    document_type: "nfe_saida",
    number: "999123",
    series: "2",
    access_key: "35260412345678000123550010000099991234567890",
    cfop_summary: "5102",
    status_sefaz: "pending",
    provider: "manual",
    message: "Documento pronto para autorizacao em lote.",
    issued_at: null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);

  const syncResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/actions/sync-from-products`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(syncResponse.status, 200);
  const syncPayload = (await syncResponse.json()) as {
    ok: boolean;
    processed: number;
    changed: number;
    items: Array<{ profile_id: string; product_id: string; applied_fields: string[] }>;
  };
  assert.equal(syncPayload.ok, true);
  assert.ok(syncPayload.processed >= 1);
  assert.ok(syncPayload.changed >= 1);
  assert.ok(syncPayload.items.some((entry) => entry.profile_id === profileId && entry.product_id === productId && entry.applied_fields.includes("ncm")));

  const markReadyResponse = await fetch(`${baseUrl}/api/admin/fiscal/profiles/actions/mark-ready-eligible`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(markReadyResponse.status, 200);
  const markReadyPayload = (await markReadyResponse.json()) as {
    ok: boolean;
    processed: number;
    changed: number;
    items: Array<{ profile_id: string; product_id: string }>;
  };
  assert.equal(markReadyPayload.ok, true);
  assert.ok(markReadyPayload.processed >= 1);
  assert.ok(markReadyPayload.changed >= 1);
  assert.ok(markReadyPayload.items.some((entry) => entry.profile_id === readyProfileId && entry.product_id === readyProductId));

  const authorizeResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/actions/authorize-ready`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(authorizeResponse.status, 200);
  const authorizePayload = (await authorizeResponse.json()) as {
    ok: boolean;
    processed: number;
    changed: number;
    items: Array<{ document_id: string; number: string | null }>;
  };
  assert.equal(authorizePayload.ok, true);
  assert.ok(authorizePayload.processed >= 1);
  assert.ok(authorizePayload.changed >= 1);
  assert.ok(authorizePayload.items.some((entry) => entry.document_id === documentId && entry.number === "999123"));

  const nextDb = readDb();
  const nextProfile = nextDb.fiscalProfiles.find((entry) => entry.id === profileId);
  const nextReadyProfile = nextDb.fiscalProfiles.find((entry) => entry.id === readyProfileId);
  const nextDocument = nextDb.fiscalDocuments.find((entry) => entry.id === documentId);

  assert.equal(nextProfile?.ncm, "39181000");
  assert.equal(nextProfile?.cest, "10.012.00");
  assert.equal(nextProfile?.origin_code, "0");
  assert.equal(nextProfile?.tax_rule_status, "ready");
  assert.equal(nextReadyProfile?.tax_rule_status, "ready");
  assert.equal(nextDocument?.status_sefaz, "authorized");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.profile_synced_from_product_batch" && entry.actor_id === "user-admin"));
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.profile_marked_ready_batch" && entry.actor_id === "user-admin"));
});

test("admin can apply a fiscal profile as template to similar pending profiles", async () => {
  const { readDb, writeDb } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const sourceProductId = `product-fiscal-template-source-${stamp}`;
  const sourceProfileId = `profile-fiscal-template-source-${stamp}`;
  const targetProductId = `product-fiscal-template-target-${stamp}`;
  const targetProfileId = `profile-fiscal-template-target-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: sourceProductId,
    name: "Produto Modelo Fiscal",
    slug: `produto-modelo-fiscal-${stamp}`,
    sku: `SKU-MODELO-FISCAL-${stamp}`,
    fiscal_group: "piso-vinilico",
    subcategory: "piso-vinilico",
    ncm: "39181000",
    cest: "10.012.00",
    origin_code: "0",
    dimensions: "2,00 x 0,50 m",
    measures: "2,00 x 0,50 m",
    weight: 4.5,
    tax_classification_status: "ready",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.fiscalProfiles.unshift({
    id: sourceProfileId,
    product_id: sourceProductId,
    establishment_id: "est-comercial",
    ncm: "39181000",
    cest: "10.012.00",
    cfop_internal_default: "5102",
    cfop_interstate_default: "6102",
    origin_code: "0",
    cst_icms_default: "00",
    csosn_default: null,
    requires_difal: false,
    requires_fcp: false,
    tax_rule_status: "ready",
    notes: "Perfil fiscal validado para usar como modelo.",
    updated_at: new Date().toISOString(),
  });

  db.products.unshift({
    ...baseProduct,
    id: targetProductId,
    name: "Produto Alvo Modelo Fiscal",
    slug: `produto-alvo-modelo-fiscal-${stamp}`,
    sku: `SKU-ALVO-FISCAL-${stamp}`,
    fiscal_group: "piso-vinilico",
    subcategory: "piso-vinilico",
    ncm: null,
    cest: null,
    origin_code: null,
    tax_classification_status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.fiscalProfiles.unshift({
    id: targetProfileId,
    product_id: targetProductId,
    establishment_id: "est-comercial",
    ncm: null,
    cest: null,
    cfop_internal_default: null,
    cfop_interstate_default: null,
    origin_code: null,
    cst_icms_default: null,
    csosn_default: null,
    requires_difal: true,
    requires_fcp: true,
    tax_rule_status: "pending",
    notes: null,
    updated_at: new Date().toISOString(),
  });

  writeDb(db);
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/fiscal/profiles/${sourceProfileId}/apply-template`, {
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
    ok: boolean;
    processed: number;
    changed: number;
    items: Array<{ profile_id: string; product_id: string; applied_fields: string[] }>;
  };
  assert.equal(payload.ok, true);
  assert.ok(payload.processed >= 1);
  assert.ok(payload.changed >= 1);
  assert.ok(payload.items.some((entry) => entry.profile_id === targetProfileId && entry.product_id === targetProductId && entry.applied_fields.includes("cst_icms_default")));

  const nextDb = readDb();
  const nextTargetProfile = nextDb.fiscalProfiles.find((entry) => entry.id === targetProfileId);
  const nextTargetProduct = nextDb.products.find((entry) => entry.id === targetProductId);

  assert.equal(nextTargetProfile?.ncm, "39181000");
  assert.equal(nextTargetProfile?.cest, "10.012.00");
  assert.equal(nextTargetProfile?.origin_code, "0");
  assert.equal(nextTargetProfile?.cfop_internal_default, "5102");
  assert.equal(nextTargetProfile?.cfop_interstate_default, "6102");
  assert.equal(nextTargetProfile?.cst_icms_default, "00");
  assert.equal(nextTargetProfile?.tax_rule_status, "review");
  assert.equal(nextTargetProduct?.ncm, "39181000");
  assert.equal(nextTargetProduct?.tax_classification_status, "review");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.profile_template_applied_batch" && entry.actor_id === "user-admin"));
});

test("admin can defer a pending fiscal document from the first go-live cut", async () => {
  const { readDb, writeDb, createId } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const productId = `product-go-live-cut-${stamp}`;
  const orderId = `order-go-live-cut-${stamp}`;
  const documentId = `document-go-live-cut-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: productId,
    name: "Produto Corte Go-Live",
    slug: `produto-corte-go-live-${stamp}`,
    sku: `SKU-CORTE-${stamp}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  db.siteContent.go_live_product_ids = [productId];

  db.orders.unshift({
    id: orderId,
    order_number: `PVC-CUT-${stamp}`,
    tracking_token: createId(),
    user_id: null,
    customer_name: "Cliente Corte",
    customer_email: "corte@lojaopvc.com.br",
    customer_phone: null,
    customer_cpf: null,
    delivery_type: "pickup",
    payment_method: "pix",
    payment_status: "approved",
    payment_reference: null,
    payment_approved_at: new Date().toISOString(),
    shipping_address: null,
    shipping_cost: 0,
    discount: 0,
    subtotal: 99.9,
    total: 99.9,
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
    correlation_id: createId(),
    idempotency_key: null,
    coupon_id: null,
    coupon_code: null,
    inventory_locked: false,
    event_log: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.orderItems.unshift({
    id: createId(),
    order_id: orderId,
    product_id: productId,
    product_name: "Produto Corte Go-Live",
    product_sku: `SKU-CORTE-${stamp}`,
    quantity: 1,
    unit_price: 99.9,
    total_price: 99.9,
  });

  db.fiscalDocuments.unshift({
    id: documentId,
    establishment_id: "est-comercial",
    order_id: orderId,
    document_type: "nfe_saida",
    number: null,
    series: "1",
    access_key: null,
    cfop_summary: "5102",
    xml_url: null,
    status_sefaz: "pending",
    go_live_gate_status: "required",
    go_live_gate_note: null,
    provider: "manual",
    message: "Documento fora do primeiro corte.",
    issued_at: null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);

  const deferResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/actions/go-live-gate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      document_ids: [documentId],
      gate_status: "deferred",
      note: "Documento historico retirado do primeiro corte.",
    }),
  });
  assert.equal(deferResponse.status, 200);
  const deferPayload = (await deferResponse.json()) as {
    ok: boolean;
    changed: number;
    readiness: { metrics: { pending_fiscal_documents: number; deferred_fiscal_documents: number } };
    workboard: { metrics: { pending_fiscal_documents: number; deferred_fiscal_documents: number }; deferred_documents: Array<{ id: string; go_live_gate_status: string }> };
  };
  assert.equal(deferPayload.ok, true);
  assert.equal(deferPayload.changed, 1);
  assert.equal(deferPayload.readiness.metrics.pending_fiscal_documents, 0);
  assert.equal(deferPayload.readiness.metrics.deferred_fiscal_documents, 1);
  assert.equal(deferPayload.workboard.metrics.pending_fiscal_documents, 0);
  assert.equal(deferPayload.workboard.metrics.deferred_fiscal_documents, 1);
  assert.ok(deferPayload.workboard.deferred_documents.some((entry) => entry.id === documentId && entry.go_live_gate_status === "deferred"));

  const nextDb = readDb();
  const nextDocument = nextDb.fiscalDocuments.find((entry) => entry.id === documentId);
  assert.equal(nextDocument?.go_live_gate_status, "deferred");
  assert.equal(nextDocument?.go_live_gate_note, "Documento historico retirado do primeiro corte.");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.document_go_live_deferred" && entry.actor_id === "user-admin"));
});

test("admin fiscal document remediation defers pending documents from cancelled orders", async () => {
  const { readDb, writeDb, createId } = await getDbModule();
  const db = readDb();
  const stamp = Date.now();
  const baseProduct = await getSellableTemplateProduct();
  assert.ok(baseProduct);

  const productId = `product-cancelled-doc-${stamp}`;
  const orderId = `order-cancelled-doc-${stamp}`;
  const documentId = `document-cancelled-doc-${stamp}`;

  db.products.unshift({
    ...baseProduct,
    id: productId,
    name: "Produto Documento Cancelado",
    slug: `produto-documento-cancelado-${stamp}`,
    sku: `SKU-CANCEL-${stamp}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  db.siteContent.go_live_product_ids = [productId];

  db.orders.unshift({
    id: orderId,
    order_number: `PVC-CANCEL-${stamp}`,
    tracking_token: createId(),
    user_id: null,
    customer_name: "Cliente Cancelado",
    customer_email: "cancelado@lojaopvc.com.br",
    customer_phone: null,
    customer_cpf: null,
    delivery_type: "pickup",
    payment_method: "pix",
    payment_status: "approved",
    payment_reference: null,
    payment_approved_at: new Date().toISOString(),
    shipping_address: null,
    shipping_cost: 0,
    discount: 0,
    subtotal: 79.9,
    total: 79.9,
    notes: null,
    status: "cancelled",
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
    payment_metadata: null,
    quote_id: null,
    correlation_id: createId(),
    idempotency_key: null,
    coupon_id: null,
    coupon_code: null,
    inventory_locked: false,
    event_log: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.orderItems.unshift({
    id: createId(),
    order_id: orderId,
    product_id: productId,
    product_name: "Produto Documento Cancelado",
    product_sku: `SKU-CANCEL-${stamp}`,
    quantity: 1,
    unit_price: 79.9,
    total_price: 79.9,
  });

  db.fiscalDocuments.unshift({
    id: documentId,
    establishment_id: "est-comercial",
    order_id: orderId,
    document_type: "nfe_saida",
    number: null,
    series: "1",
    access_key: null,
    cfop_summary: "5102",
    xml_url: null,
    status_sefaz: "pending",
    go_live_gate_status: "required",
    go_live_gate_note: null,
    provider: "manual",
    message: "Documento de pedido cancelado aguardando tratativa.",
    issued_at: null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  const admin = await createAdminSession(baseUrl);

  const previewResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/remediation`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(previewResponse.status, 200);
  const previewPayload = (await previewResponse.json()) as {
    remediation: { actions: Array<{ reference_id: string }>; metrics: { cancelled_documents_deferred: number } };
    readiness: { metrics: { pending_fiscal_documents: number } };
    workboard: { metrics: { cancelled_pending_fiscal_documents: number } };
  };
  assert.ok(previewPayload.remediation.actions.some((entry) => entry.reference_id === documentId));
  assert.equal(previewPayload.remediation.metrics.cancelled_documents_deferred >= 1, true);
  assert.equal(previewPayload.readiness.metrics.pending_fiscal_documents >= 1, true);
  assert.equal(previewPayload.workboard.metrics.cancelled_pending_fiscal_documents >= 1, true);

  const applyResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/remediation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({}),
  });
  assert.equal(applyResponse.status, 200);
  const applyPayload = (await applyResponse.json()) as {
    remediation: { changed: boolean; metrics: { cancelled_documents_deferred: number } };
    readiness: { metrics: { pending_fiscal_documents: number; deferred_fiscal_documents: number } };
  };
  assert.equal(applyPayload.remediation.changed, true);
  assert.equal(applyPayload.remediation.metrics.cancelled_documents_deferred >= 1, true);
  assert.equal(applyPayload.readiness.metrics.deferred_fiscal_documents >= 1, true);

  const nextDb = readDb();
  const nextDocument = nextDb.fiscalDocuments.find((entry) => entry.id === documentId);
  assert.equal(nextDocument?.go_live_gate_status, "deferred");
  assert.equal(nextDocument?.go_live_gate_note, "Documento de pedido cancelado retirado automaticamente do gate do primeiro corte.");
  assert.ok(nextDb.auditLogs.some((entry) => entry.event_type === "fiscal.document_go_live_deferred" && entry.actor_id === "user-admin"));
});

test("admin can create quote and convert it into assisted order", async () => {
  const admin = await createAdminSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string; name: string }>;
  assert.ok(products.length > 0);

  const quoteResponse = await fetch(`${baseUrl}/api/quotes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      customerName: "Cliente QA",
      customerEmail: "cliente.qa@lojaopvc.com.br",
      items: [{ productId: products[0].id, quantity: 2 }],
    }),
  });
  assert.equal(quoteResponse.status, 200);
  const quotePayload = (await quoteResponse.json()) as { quote: { id: string; status: string; converted_order_id: string | null } };
  assert.ok(quotePayload.quote.id);
  assert.equal(quotePayload.quote.status, "draft");

  const convertResponse = await fetch(`${baseUrl}/api/admin/quotes/${quotePayload.quote.id}/convert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(convertResponse.status, 200);
  const convertPayload = (await convertResponse.json()) as {
    order: { id: string; order_type: string; payment_method: string };
    quote: { status: string; converted_order_id: string | null };
  };
  assert.ok(convertPayload.order.id);
  assert.equal(convertPayload.order.order_type, "assisted");
  assert.equal(convertPayload.order.payment_method, "payment_link");
  assert.equal(convertPayload.quote.status, "converted");
  assert.equal(convertPayload.quote.converted_order_id, convertPayload.order.id);

  const secondConvertResponse = await fetch(`${baseUrl}/api/admin/quotes/${quotePayload.quote.id}/convert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(secondConvertResponse.status, 200);
  const secondConvertPayload = (await secondConvertResponse.json()) as {
    order: { id: string };
    quote: { status: string; converted_order_id: string | null };
  };
  assert.equal(secondConvertPayload.order.id, convertPayload.order.id);
  assert.equal(secondConvertPayload.quote.status, "converted");
  assert.equal(secondConvertPayload.quote.converted_order_id, convertPayload.order.id);
});

test("admin can register manual action and cancel an order with audit trail", async () => {
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
      "idempotency-key": `admin-order-ops-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Operacao QA",
      customerEmail: "operacao.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; status: string } };
  assert.ok(created.order.id);

  const admin = await createAdminSession(baseUrl);

  const manualActionResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/manual-action`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      actionLabel: "Contato com cliente",
      note: "Cliente avisado sobre o prazo de retirada.",
    }),
  });
  assert.equal(manualActionResponse.status, 200);

  const cancelResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "cancelled",
    }),
  });
  assert.equal(cancelResponse.status, 200);
  const cancelled = (await cancelResponse.json()) as { id: string; status: string };
  assert.equal(cancelled.id, created.order.id);
  assert.equal(cancelled.status, "cancelled");

  const auditResponse = await fetch(`${baseUrl}/api/audit/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(auditResponse.status, 200);
  const auditEvents = (await auditResponse.json()) as Array<{ event_type: string; payload?: { action_label?: string } }>;
  assert.ok(auditEvents.some((entry) => entry.event_type === "order.manual_action" && entry.payload?.action_label === "Contato com cliente"));
  assert.ok(auditEvents.some((entry) => entry.event_type === "order.cancelled"));
});

test("admin can save shipment data and expose it on public order tracking", async () => {
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
      "idempotency-key": `admin-order-shipment-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Rastreio QA",
      customerEmail: "rastreio.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "delivery",
      paymentMethod: "pix",
      shippingCost: 89.9,
      shippingAddress: {
        street: "Rua Nacional",
        number: "100",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
        zipCode: "01001000",
      },
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const admin = await createAdminSession(baseUrl);
  const shipmentResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/shipment`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      carrier: "Jadlog",
      service: "Rodoviario",
      trackingCode: "JD123456789BR",
      trackingUrl: "https://www.jadlog.com.br/tracking",
      estimatedDeliveryAt: "2026-05-05",
      dispatchedAt: "2026-04-29",
      notes: "Despacho nacional homologado em QA.",
    }),
  });
  assert.equal(shipmentResponse.status, 200);
  const shipmentOrder = (await shipmentResponse.json()) as { shipment: { carrier: string; tracking_code: string; tracking_url: string } };
  assert.equal(shipmentOrder.shipment.carrier, "Jadlog");
  assert.equal(shipmentOrder.shipment.tracking_code, "JD123456789BR");

  const trackedResponse = await fetch(`${baseUrl}/api/orders/track/${created.order.tracking_token}`);
  assert.equal(trackedResponse.status, 200);
  const tracked = (await trackedResponse.json()) as { order: { shipment: { carrier: string; tracking_code: string; tracking_url: string } } };
  assert.equal(tracked.order.shipment.carrier, "Jadlog");
  assert.equal(tracked.order.shipment.tracking_code, "JD123456789BR");
  assert.equal(tracked.order.shipment.tracking_url, "https://www.jadlog.com.br/tracking");
});

test("shipment dispatch auto-advances expedition order to shipped with audit trail", async () => {
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
      "idempotency-key": `admin-order-auto-ship-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Auto Envio QA",
      customerEmail: "auto.envio.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "delivery",
      paymentMethod: "pix",
      shippingCost: 120,
      shippingAddress: {
        street: "Avenida Brasil",
        number: "200",
        neighborhood: "Centro",
        city: "Rio de Janeiro",
        state: "RJ",
        zipCode: "20040002",
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
  for (const status of ["confirmed", "processing", "in_separation", "in_expedition"]) {
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

  const shipmentResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/shipment`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      carrier: "Braspress",
      service: "Carga fracionada",
      trackingCode: "BRP-987654",
      dispatchedAt: "2026-04-29",
    }),
  });
  assert.equal(shipmentResponse.status, 200);
  const shipmentOrder = (await shipmentResponse.json()) as { status: string; shipment: { carrier: string; tracking_code: string } };
  assert.equal(shipmentOrder.status, "shipped");
  assert.equal(shipmentOrder.shipment.carrier, "Braspress");
  assert.equal(shipmentOrder.shipment.tracking_code, "BRP-987654");

  const auditResponse = await fetch(`${baseUrl}/api/audit/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(auditResponse.status, 200);
  const auditEvents = (await auditResponse.json()) as Array<{ event_type: string; new_value?: { status?: string } }>;
  assert.ok(auditEvents.some((entry) => entry.event_type === "order.status_updated" && entry.new_value?.status === "shipped"));
  assert.ok(auditEvents.some((entry) => entry.event_type === "order.shipment_updated"));
});

test("approved payment plus operational status generates fiscal document and inventory settlement", async () => {
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
      "idempotency-key": `admin-order-lifecycle-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Lifecycle QA",
      customerEmail: "lifecycle.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };
  assert.ok(created.order.id);

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
  const statusResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "processing",
    }),
  });
  assert.equal(statusResponse.status, 200);
  const updatedOrder = (await statusResponse.json()) as { id: string; status: string };
  assert.equal(updatedOrder.id, created.order.id);
  assert.equal(updatedOrder.status, "processing");

  const fiscalDocumentsResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(fiscalDocumentsResponse.status, 200);
  const fiscalDocuments = (await fiscalDocumentsResponse.json()) as Array<{
    id: string;
    order_id: string | null;
    status_sefaz: string;
  }>;
  const fiscalDocument = fiscalDocuments.find((entry) => entry.order_id === created.order.id);
  assert.ok(fiscalDocument);
  assert.equal(fiscalDocument?.status_sefaz, "authorized");

  const inventoryMovementsResponse = await fetch(`${baseUrl}/api/admin/inventory/movements`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(inventoryMovementsResponse.status, 200);
  const inventoryMovements = (await inventoryMovementsResponse.json()) as Array<{
    order_id: string | null;
    movement_type: string;
    fiscal_document_id: string | null;
  }>;
  const baixaMovement = inventoryMovements.find((entry) => entry.order_id === created.order.id && entry.movement_type === "baixa");
  assert.ok(baixaMovement);
  assert.equal(baixaMovement?.fiscal_document_id, fiscalDocument?.id ?? null);
});

test("admin can complete fiscal document fields while authorizing manually", async () => {
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
      "idempotency-key": `admin-fiscal-manual-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Fiscal Manual QA",
      customerEmail: "fiscal.manual.qa@lojaopvc.com.br",
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
  const processingResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ status: "processing" }),
  });
  assert.equal(processingResponse.status, 200);

  const fiscalDocumentsResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(fiscalDocumentsResponse.status, 200);
  const fiscalDocuments = (await fiscalDocumentsResponse.json()) as Array<{
    id: string;
    order_id: string | null;
    status_sefaz: string;
  }>;
  const fiscalDocument = fiscalDocuments.find((entry) => entry.order_id === created.order.id);
  assert.ok(fiscalDocument);

  const backToPendingResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/${fiscalDocument!.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "pending",
      number: "",
      series: "",
      access_key: "",
      cfop_summary: "",
    }),
  });
  assert.equal(backToPendingResponse.status, 200);

  const authorizeResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/${fiscalDocument!.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "authorized",
      number: "999123",
      series: "2",
      access_key: "35260412345678000123550010000099991234567890",
      cfop_summary: "5102",
    }),
  });
  assert.equal(authorizeResponse.status, 200);
  const authorized = (await authorizeResponse.json()) as {
    status_sefaz: string;
    number: string | null;
    series: string | null;
    access_key: string | null;
    cfop_summary: string | null;
  };
  assert.equal(authorized.status_sefaz, "authorized");
  assert.equal(authorized.number, "999123");
  assert.equal(authorized.series, "2");
  assert.equal(authorized.access_key, "35260412345678000123550010000099991234567890");
  assert.equal(authorized.cfop_summary, "5102");
});

test("admin cannot skip order lifecycle with invalid status transition", async () => {
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
      "idempotency-key": `admin-order-invalid-transition-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Fluxo QA",
      customerEmail: "fluxo.qa@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; status: string } };
  assert.equal(created.order.status, "awaiting_payment");

  const admin = await createAdminSession(baseUrl);
  const statusResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "delivered",
    }),
  });
  assert.equal(statusResponse.status, 400);
  const payload = (await statusResponse.json()) as { error: string };
  assert.match(payload.error, /Transicao invalida/i);
});

test("cancelling an authorized fiscal document cancels the order and restores inventory", async () => {
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
      "idempotency-key": `admin-fiscal-cancel-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Fiscal QA",
      customerEmail: "fiscal.qa@lojaopvc.com.br",
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
  const advanceResponse = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "processing",
    }),
  });
  assert.equal(advanceResponse.status, 200);

  const fiscalDocumentsResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(fiscalDocumentsResponse.status, 200);
  const fiscalDocuments = (await fiscalDocumentsResponse.json()) as Array<{
    id: string;
    order_id: string | null;
    status_sefaz: string;
  }>;
  const fiscalDocument = fiscalDocuments.find((entry) => entry.order_id === created.order.id);
  assert.ok(fiscalDocument);
  assert.equal(fiscalDocument?.status_sefaz, "authorized");

  const cancelFiscalResponse = await fetch(`${baseUrl}/api/admin/fiscal/documents/${fiscalDocument!.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "cancelled",
      message: "Cancelado em homologacao",
    }),
  });
  assert.equal(cancelFiscalResponse.status, 200);
  const cancelledFiscal = (await cancelFiscalResponse.json()) as { status_sefaz: string; message: string | null };
  assert.equal(cancelledFiscal.status_sefaz, "cancelled");

  const trackedOrderResponse = await fetch(`${baseUrl}/api/orders/track/${created.order.tracking_token}`);
  assert.equal(trackedOrderResponse.status, 200);
  const trackedOrder = (await trackedOrderResponse.json()) as { order: { status: string } };
  assert.equal(trackedOrder.order.status, "cancelled");

  const inventoryMovementsResponse = await fetch(`${baseUrl}/api/admin/inventory/movements`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(inventoryMovementsResponse.status, 200);
  const inventoryMovements = (await inventoryMovementsResponse.json()) as Array<{
    order_id: string | null;
    movement_type: string;
  }>;
  assert.ok(inventoryMovements.some((entry) => entry.order_id === created.order.id && entry.movement_type === "estorno"));
});

test("admin can create inventory transfer between establishments", async () => {
  const admin = await createAdminSession(baseUrl);

  const establishmentsResponse = await fetch(`${baseUrl}/api/admin/establishments`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(establishmentsResponse.status, 200);
  const establishments = (await establishmentsResponse.json()) as Array<{
    id: string;
    can_sell: boolean;
  }>;
  assert.ok(establishments.length >= 2);
  const source = establishments.find((entry) => entry.id === "est-comercial") ?? establishments.find((entry) => entry.can_sell) ?? establishments[0];
  const target = establishments.find((entry) => entry.id === "est-importadora" && entry.id !== source.id) ?? establishments.find((entry) => entry.id !== source.id) ?? establishments[1];
  assert.ok(source);
  assert.ok(target);

  const productId = await seedSellableProduct("transfer", 2);

  const transferResponse = await fetch(`${baseUrl}/api/admin/inventory/transfers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      product_id: productId,
      quantity: 1,
      source_establishment_id: source.id,
      target_establishment_id: target.id,
      notes: "Transferencia de homologacao",
    }),
  });
  assert.equal(transferResponse.status, 201);
  const transferPayload = (await transferResponse.json()) as {
    ok: boolean;
    transfer_document: { id: string; document_type: string; status_sefaz: string };
    target_lot: { id: string; establishment_id: string; quantity_available: number };
  };
  assert.equal(transferPayload.ok, true);
  assert.equal(transferPayload.transfer_document.document_type, "nfe_transferencia");
  assert.equal(transferPayload.transfer_document.status_sefaz, "pending");
  assert.equal(transferPayload.target_lot.establishment_id, target.id);
  assert.equal(transferPayload.target_lot.quantity_available, 1);
});

test("admin can reconcile full delivered lifecycle without issues", async () => {
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
      "idempotency-key": `admin-order-reconciliation-ok-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Conciliacao OK",
      customerEmail: "conciliacao.ok@lojaopvc.com.br",
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
  for (const status of ["confirmed", "processing", "in_separation", "in_expedition", "shipped", "out_for_delivery", "delivered"]) {
    const response = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ status }),
    });
    assert.equal(response.status, 200);
  }

  const reconciliationResponse = await fetch(`${baseUrl}/api/admin/reconciliation/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(reconciliationResponse.status, 200);
  const reconciliation = (await reconciliationResponse.json()) as {
    overall_status: string;
    reconciled: boolean;
    issues: Array<{ code: string }>;
    movement_types: string[];
    fiscal_statuses: string[];
    status: string;
  };
  assert.equal(reconciliation.status, "delivered");
  assert.equal(reconciliation.overall_status, "ok");
  assert.equal(reconciliation.reconciled, true);
  assert.deepEqual(reconciliation.issues, []);
  assert.ok(reconciliation.movement_types.includes("baixa"));
  assert.ok(reconciliation.fiscal_statuses.includes("authorized"));
});

test("admin reconciliation flags payment-approved order pending operational settlement", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const productId = await seedSellableProduct("reconciliation-attention", 2);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
      "idempotency-key": `admin-order-reconciliation-attention-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Conciliacao Pendente",
      customerEmail: "conciliacao.pendente@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId, quantity: 1, areaDesiredM2: 1 }],
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
  const reconciliationResponse = await fetch(`${baseUrl}/api/admin/reconciliation/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(reconciliationResponse.status, 200);
  const reconciliation = (await reconciliationResponse.json()) as {
    overall_status: string;
    reconciled: boolean;
    issues: Array<{ code: string }>;
    fiscal_statuses: string[];
    status: string;
  };
  assert.equal(reconciliation.status, "payment_approved");
  assert.equal(reconciliation.overall_status, "attention");
  assert.equal(reconciliation.reconciled, false);
  assert.ok(reconciliation.issues.some((entry) => entry.code === "operation_pending_after_payment"));
  assert.ok(reconciliation.fiscal_statuses.includes("pending"));

  const summaryResponse = await fetch(`${baseUrl}/api/admin/reconciliation/summary`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()) as {
    metrics: { attention: number };
    items: Array<{ order_id: string; overall_status: string }>;
  };
  assert.ok(summary.metrics.attention >= 1);
  assert.ok(summary.items.some((entry) => entry.order_id === created.order.id && entry.overall_status === "attention"));
});

test("admin reconciliation exposes daily operational report", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const productId = await seedSellableProduct("reconciliation-daily", 2);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
      "idempotency-key": `admin-order-reconciliation-daily-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Relatorio Diario",
      customerEmail: "relatorio.diario@lojaopvc.com.br",
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string; order_number: string } };

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
  const reportResponse = await fetch(`${baseUrl}/api/admin/reconciliation/daily-report?days=1`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(reportResponse.status, 200);
  const report = (await reportResponse.json()) as {
    metrics: { orders: number; attention: number; unreconciled_value: number; approved_payments: number };
    action_queue: Array<{ order_id: string; overall_status: string; recommended_action: string }>;
    csv_rows: string[][];
  };

  assert.ok(report.metrics.orders >= 1);
  assert.ok(report.metrics.attention >= 1);
  assert.ok(report.metrics.unreconciled_value > 0);
  assert.ok(report.metrics.approved_payments >= 1);
  assert.ok(report.action_queue.some((entry) => entry.order_id === created.order.id && entry.overall_status === "attention"));
  assert.ok(report.action_queue.every((entry) => entry.recommended_action.length > 0));
  assert.deepEqual(report.csv_rows[0], [
    "pedido",
    "cliente",
    "status_conciliacao",
    "status_pedido",
    "status_pagamento",
    "total",
    "acao_recomendada",
    "atualizado_em",
  ]);
});

test("admin can operate return request lifecycle and register refund completion", async () => {
  const admin = await createAdminSession(baseUrl);
  const customerCsrf = await createCsrfSession(baseUrl);
  const email = `return.ops.${Date.now()}@lojaopvc.com.br`;
  const password = "cliente123";

  const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: customerCsrf.cookieHeader,
    },
    body: JSON.stringify({
      email,
      password,
      fullName: "Cliente Devolucao QA",
    }),
  });
  assert.equal(signupResponse.status, 200);
  const sessionToken = signupResponse.headers.get("set-cookie");
  assert.ok(sessionToken);
  const productId = await seedSellableProduct("return-flow", 2);

  const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: `lojao_csrf=${customerCsrf.csrfToken}; ${sessionToken}`,
      "idempotency-key": `admin-return-order-${Date.now()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Devolucao QA",
      customerEmail: email,
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createOrderResponse.status, 200);
  const created = (await createOrderResponse.json()) as { order: { id: string; tracking_token: string } };

  const approvePaymentResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: `lojao_csrf=${customerCsrf.csrfToken}; ${sessionToken}`,
    },
    body: JSON.stringify({
      action: "approve",
      trackingToken: created.order.tracking_token,
    }),
  });
  assert.equal(approvePaymentResponse.status, 200);

  for (const status of ["confirmed", "processing", "in_separation", "in_expedition", "shipped", "out_for_delivery", "delivered"]) {
    const response = await fetch(`${baseUrl}/api/admin/orders/${created.order.id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ status }),
    });
    assert.equal(response.status, 200);
  }

  const profileResponse = await fetch(`${baseUrl}/api/customer-center/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: `lojao_csrf=${customerCsrf.csrfToken}; ${sessionToken}`,
    },
    body: JSON.stringify({
      fullName: "Cliente Devolucao QA",
      email,
      phone: "87999990000",
      cpfCnpj: "12345678901",
      customerType: "retail",
      customerOrigin: "web",
      preferredChannel: "whatsapp",
      allowPromotions: false,
      addresses: [],
      savedCarts: [],
      favorites: [],
      lists: [],
      tickets: [],
      returns: [
        {
          id: "return-qa-1",
          orderId: created.order.id,
          orderNumber: "RETURN-QA",
          reason: "Produto divergente",
          note: "Solicitacao de teste",
          method: "refund",
          status: "open",
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  });
  assert.equal(profileResponse.status, 200);

  const updateReturnResponse = await fetch(`${baseUrl}/api/admin/customer-center/returns/return-qa-1`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "completed",
    }),
  });
  assert.equal(updateReturnResponse.status, 200);
  const updatedReturn = (await updateReturnResponse.json()) as { status: string; method: string };
  assert.equal(updatedReturn.status, "completed");
  assert.equal(updatedReturn.method, "refund");

  const returnsResponse = await fetch(`${baseUrl}/api/admin/customer-center/returns`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(returnsResponse.status, 200);
  const returns = (await returnsResponse.json()) as Array<{ id: string; status: string }>;
  assert.ok(returns.some((entry) => entry.id === "return-qa-1" && entry.status === "completed"));

  const paymentsResponse = await fetch(`${baseUrl}/api/admin/payments`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(paymentsResponse.status, 200);
  const payments = (await paymentsResponse.json()) as Array<{ order_id: string; status: string }>;
  assert.ok(payments.some((entry) => entry.order_id === created.order.id && entry.status === "refunded"));

  const auditResponse = await fetch(`${baseUrl}/api/audit/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(auditResponse.status, 200);
  const auditEvents = (await auditResponse.json()) as Array<{
    event_type: string;
    actor_id: string | null;
    payload?: { return_id?: string };
  }>;
  assert.ok(
    auditEvents.some(
      (entry) =>
        entry.event_type === "customer.return_status_updated" &&
        entry.actor_id === "user-admin" &&
        entry.payload?.return_id === "return-qa-1",
    ),
  );
  assert.ok(
    auditEvents.some(
      (entry) =>
        entry.event_type === "payment.refunded" &&
        entry.actor_id === "user-admin" &&
        entry.payload?.return_id === "return-qa-1",
    ),
  );

  const invalidReopenResponse = await fetch(`${baseUrl}/api/admin/customer-center/returns/return-qa-1`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "review",
    }),
  });
  assert.equal(invalidReopenResponse.status, 400);

  const reconciliationResponse = await fetch(`${baseUrl}/api/admin/reconciliation/orders/${created.order.id}`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(reconciliationResponse.status, 200);
  const reconciliation = (await reconciliationResponse.json()) as { issues: Array<{ code: string }> };
  assert.ok(!reconciliation.issues.some((entry) => entry.code === "refund_pending"));
});

test("admin can move customer support ticket through operational lifecycle", async () => {
  const admin = await createAdminSession(baseUrl);
  const customerCsrf = await createCsrfSession(baseUrl);
  const email = `ticket.${Date.now()}@lojaopvc.com.br`;
  const password = "cliente123";

  const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: customerCsrf.cookieHeader,
    },
    body: JSON.stringify({
      email,
      password,
      fullName: "Cliente Ticket QA",
    }),
  });
  assert.equal(signupResponse.status, 200);
  const sessionToken = signupResponse.headers.get("set-cookie");
  assert.ok(sessionToken);

  const profileResponse = await fetch(`${baseUrl}/api/customer-center/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: `lojao_csrf=${customerCsrf.csrfToken}; ${sessionToken}`,
    },
    body: JSON.stringify({
      fullName: "Cliente Ticket QA",
      email,
      phone: "87999990000",
      cpfCnpj: "12345678901",
      customerType: "retail",
      customerOrigin: "web",
      preferredChannel: "whatsapp",
      allowPromotions: false,
      addresses: [],
      savedCarts: [],
      favorites: [],
      lists: [],
      returns: [],
      tickets: [
        {
          id: "ticket-qa-1",
          subject: "Preciso antecipar retirada",
          channel: "whatsapp",
          message: "Conseguem liberar hoje?",
          status: "open",
          createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        },
      ],
    }),
  });
  assert.equal(profileResponse.status, 200);

  const initialOverviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(initialOverviewResponse.status, 200);
  const initialOverview = (await initialOverviewResponse.json()) as {
    customerCenter: { ticketsOpen: number; ticketsInProgress: number; ticketsStale: number; ticketsAttention: number };
    operationalAlerts: {
      customerTicketsStale: Array<{ id: string }>;
      customerTicketsAttention: Array<{ id: string; recommended_action: string }>;
    };
  };
  assert.equal(initialOverview.customerCenter.ticketsOpen, 1);
  assert.equal(initialOverview.customerCenter.ticketsInProgress, 0);
  assert.equal(initialOverview.customerCenter.ticketsStale, 1);
  assert.equal(initialOverview.customerCenter.ticketsAttention, 1);
  assert.ok(initialOverview.operationalAlerts.customerTicketsStale.some((entry) => entry.id === "ticket-qa-1"));
  assert.ok(initialOverview.operationalAlerts.customerTicketsAttention.some((entry) => entry.id === "ticket-qa-1" && entry.recommended_action.length > 0));

  const inProgressResponse = await fetch(`${baseUrl}/api/admin/customer-center/tickets/ticket-qa-1`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ status: "in_progress" }),
  });
  assert.equal(inProgressResponse.status, 200);
  const inProgressTicket = (await inProgressResponse.json()) as { status: string };
  assert.equal(inProgressTicket.status, "in_progress");

  const resolvedResponse = await fetch(`${baseUrl}/api/admin/customer-center/tickets/ticket-qa-1`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ status: "resolved" }),
  });
  assert.equal(resolvedResponse.status, 200);

  const invalidReopenResponse = await fetch(`${baseUrl}/api/admin/customer-center/tickets/ticket-qa-1`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ status: "open" }),
  });
  assert.equal(invalidReopenResponse.status, 400);

  const ticketsResponse = await fetch(`${baseUrl}/api/admin/customer-center/tickets`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(ticketsResponse.status, 200);
  const tickets = (await ticketsResponse.json()) as Array<{ id: string; status: string }>;
  assert.ok(tickets.some((entry) => entry.id === "ticket-qa-1" && entry.status === "resolved"));

  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()) as {
    customerCenter: { ticketsOpen: number; ticketsInProgress: number; ticketsStale: number; ticketsAttention: number };
    operationalAlerts: {
      customerTicketsStale: Array<{ id: string }>;
      customerTicketsAttention: Array<{ id: string; recommended_action: string }>;
    };
  };
  assert.equal(overview.customerCenter.ticketsOpen, 0);
  assert.equal(overview.customerCenter.ticketsInProgress, 0);
  assert.equal(overview.customerCenter.ticketsStale, 0);
  assert.equal(overview.customerCenter.ticketsAttention, 0);
  assert.ok(!overview.operationalAlerts.customerTicketsStale.some((entry) => entry.id === "ticket-qa-1"));
  assert.ok(!overview.operationalAlerts.customerTicketsAttention.some((entry) => entry.id === "ticket-qa-1"));
});

test("admin overview flags stale return requests and refund pending backlog", async () => {
  const admin = await createAdminSession(baseUrl);
  const customerCsrf = await createCsrfSession(baseUrl);
  const email = `return.alert.${Date.now()}@lojaopvc.com.br`;
  const password = "cliente123";

  const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: customerCsrf.cookieHeader,
    },
    body: JSON.stringify({
      email,
      password,
      fullName: "Cliente Alertas Devolucao",
    }),
  });
  assert.equal(signupResponse.status, 200);
  const sessionToken = signupResponse.headers.get("set-cookie");
  assert.ok(sessionToken);

  const oldDate = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
  const profileResponse = await fetch(`${baseUrl}/api/customer-center/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": customerCsrf.csrfToken,
      cookie: `lojao_csrf=${customerCsrf.csrfToken}; ${sessionToken}`,
    },
    body: JSON.stringify({
      fullName: "Cliente Alertas Devolucao",
      email,
      phone: "87999990000",
      cpfCnpj: "12345678901",
      customerType: "retail",
      customerOrigin: "web",
      preferredChannel: "whatsapp",
      allowPromotions: false,
      addresses: [],
      savedCarts: [],
      favorites: [],
      lists: [],
      tickets: [],
      returns: [
        {
          id: "return-alert-qa-1",
          orderId: "order-alert-qa",
          orderNumber: "RETURN-ALERT-QA",
          reason: "Aguardando tratativa",
          note: "Solicitacao antiga",
          method: "refund",
          status: "review",
          createdAt: oldDate,
        },
      ],
    }),
  });
  assert.equal(profileResponse.status, 200);

  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: {
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overview = (await overviewResponse.json()) as {
    operationalAlerts: {
      returnsRefundPending: Array<{ id: string }>;
      returnsStale: Array<{ id: string }>;
      returnsAttention: Array<{ id: string; recommended_action: string }>;
    };
    customerCenter: { returnsStale: number; returnsAttention: number };
  };
  assert.ok(overview.operationalAlerts.returnsRefundPending.some((entry) => entry.id === "return-alert-qa-1"));
  assert.ok(overview.operationalAlerts.returnsStale.some((entry) => entry.id === "return-alert-qa-1"));
  assert.ok(overview.operationalAlerts.returnsAttention.some((entry) => entry.id === "return-alert-qa-1" && entry.recommended_action.length > 0));
  assert.equal(overview.customerCenter.returnsStale, 1);
  assert.equal(overview.customerCenter.returnsAttention, 1);
});
