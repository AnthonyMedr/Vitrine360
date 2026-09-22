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

test("public marketing endpoints expose safe active state with fallback", async () => {
  const response = await fetch(`${baseUrl}/api/public/campaigns/active`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    theme: { slug: string } | null;
    campaigns: unknown[];
    banners: unknown[];
    fallback: boolean;
    site_experience: {
      mode: string;
      configured_surfaces: string[];
      home_slots: unknown[];
      publication: {
        live_state: string;
        affects_site_now: boolean;
      };
    };
  };
  assert.equal(payload.theme?.slug, "padrao-lojao-pvc");
  assert.ok(Array.isArray(payload.campaigns));
  assert.ok(Array.isArray(payload.banners));
  assert.ok(payload.site_experience);
  assert.ok(Array.isArray(payload.site_experience.configured_surfaces));
  assert.ok(Array.isArray(payload.site_experience.home_slots));
  assert.equal(typeof payload.site_experience.publication.live_state, "string");
  assert.equal(typeof payload.site_experience.publication.affects_site_now, "boolean");
});

test("admin marketing overview requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/admin/marketing/overview`);
  assert.equal(response.status, 401);
});

test("admin marketing preview simulates future campaign state", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/marketing/preview?at=2026-06-10T12%3A00%3A00.000Z`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    preview_at: string;
    state: { site_experience: { mode: string; configured_surfaces: string[] } };
    overview: { conflicts: unknown[] };
  };
  assert.equal(payload.preview_at, "2026-06-10T12:00:00.000Z");
  assert.equal(typeof payload.state.site_experience.mode, "string");
  assert.ok(Array.isArray(payload.state.site_experience.configured_surfaces));
  assert.ok(Array.isArray(payload.overview.conflicts));
});

test("admin can create, activate and pause a marketing campaign", async () => {
  const admin = await createAdminSession(baseUrl);
  const dbModule = await getDbModule();
  const createResponse = await fetch(`${baseUrl}/api/admin/marketing/campaigns`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      name: `Campanha HTTP QA ${Date.now()}`,
      status: "draft",
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      cta_label: "Ver campanha",
      cta_url: "/campanhas/http-qa",
      banner_desktop: "/assets/campaign-http-qa-desktop.jpg",
      banner_mobile: "/assets/campaign-http-qa-mobile.jpg",
    }),
  });
  assert.equal(createResponse.status, 201);
  const campaign = (await createResponse.json()) as { id: string; status: string };
  assert.equal(campaign.status, "draft");

  const db = dbModule.readDb();
  const showcase = db.productShowcases.find((entry: { placement: string }) => entry.placement === "home");
  assert.ok(showcase);
  showcase.status = "active";
  showcase.campaign_id = campaign.id;
  dbModule.writeDb(db);

  const publishResponse = await fetch(`${baseUrl}/api/admin/marketing/campaigns/${campaign.id}/publish`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(publishResponse.status, 200);
  const active = (await publishResponse.json()) as { status: string };
  assert.equal(active.status, "active");

  const pauseResponse = await fetch(`${baseUrl}/api/admin/marketing/campaigns/${campaign.id}/pause`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
  });
  assert.equal(pauseResponse.status, 200);
  const paused = (await pauseResponse.json()) as { status: string };
  assert.equal(paused.status, "paused");
});

test("admin cannot activate campaign when linked mix has critical publication blocker", async () => {
  const admin = await createAdminSession(baseUrl);
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const blockedProduct = db.products.find((product: { is_active: boolean; status_product?: string; image_url?: string | null; images?: string[] }) => product.is_active && product.status_product !== "inactive");
  assert.ok(blockedProduct);
  const previousImage = blockedProduct.image_url;
  const previousImages = Array.isArray(blockedProduct.images) ? [...blockedProduct.images] : blockedProduct.images;
  blockedProduct.image_url = "/placeholder.svg";
  blockedProduct.images = ["/placeholder.svg"];
  dbModule.writeDb(db);
  try {
    const createResponse = await fetch(`${baseUrl}/api/admin/marketing/campaigns`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        name: `Campanha HTTP QA Bloqueada ${Date.now()}`,
        status: "draft",
        starts_at: new Date(Date.now() - 60_000).toISOString(),
        ends_at: new Date(Date.now() + 86_400_000).toISOString(),
        products_json: [blockedProduct.id],
      }),
    });
    assert.equal(createResponse.status, 201);
    const campaign = (await createResponse.json()) as { id: string };

    const publishResponse = await fetch(`${baseUrl}/api/admin/marketing/campaigns/${campaign.id}/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(publishResponse.status, 400);
    const payload = (await publishResponse.json()) as { error: string };
    assert.match(payload.error, /bloqueada para ativacao/i);
  } finally {
    const resetDb = dbModule.readDb();
    const resetProduct = resetDb.products.find((product) => product.id === blockedProduct.id);
    if (resetProduct) {
      resetProduct.image_url = previousImage ?? null;
      resetProduct.images = Array.isArray(previousImages) ? [...previousImages] : previousImages ?? [];
    }
    dbModule.writeDb(resetDb);
    await dbModule.waitForPendingDbWrites();
  }
});

test("admin cannot activate showcase or landing page with blocked campaign mix", async () => {
  const admin = await createAdminSession(baseUrl);
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const blockedProduct = db.products.find((product: { is_active: boolean; status_product?: string; image_url?: string | null; images?: string[] }) => product.is_active && product.status_product !== "inactive");
  assert.ok(blockedProduct);
  const previousImage = blockedProduct.image_url;
  const previousImages = Array.isArray(blockedProduct.images) ? [...blockedProduct.images] : blockedProduct.images;
  blockedProduct.image_url = "/placeholder.svg";
  blockedProduct.images = ["/placeholder.svg"];
  dbModule.writeDb(db);
  try {
    const showcaseResponse = await fetch(`${baseUrl}/api/admin/marketing/showcases`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        name: `Showcase HTTP QA ${Date.now()}`,
        status: "active",
        type: "manual",
        product_ids_json: [blockedProduct.id],
        title: "Vitrine bloqueada",
      }),
    });
    assert.equal(showcaseResponse.status, 400);
    const showcasePayload = (await showcaseResponse.json()) as { error: string };
    assert.match(showcasePayload.error, /Vitrine bloqueada para ativacao/i);

    const landingResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        title: `Landing HTTP QA ${Date.now()}`,
        slug: `landing-http-qa-${Date.now()}`,
        status: "active",
        hero_desktop_image: null,
        hero_mobile_image: null,
        showcase_ids_json: [],
        banner_ids_json: [],
      }),
    });
    assert.equal(landingResponse.status, 400);
    const landingPayload = (await landingResponse.json()) as { error: string };
    assert.match(landingPayload.error, /Landing page bloqueada para ativacao/i);
  } finally {
    const resetDb = dbModule.readDb();
    const resetProduct = resetDb.products.find((product) => product.id === blockedProduct.id);
    if (resetProduct) {
      resetProduct.image_url = previousImage ?? null;
      resetProduct.images = Array.isArray(previousImages) ? [...previousImages] : previousImages ?? [];
    }
    dbModule.writeDb(resetDb);
    await dbModule.waitForPendingDbWrites();
  }
});

test("integration secret API never returns encrypted secret value", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/integrations/mercadopago/secrets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      secret_key: "MERCADOPAGO_ACCESS_TOKEN",
      value: "TEST-HTTP-SECRET-1234",
      environment: "sandbox",
    }),
  });
  assert.equal(response.status, 201);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.encrypted_value, undefined);
  assert.equal(payload.masked_value, "****************1234");

  const detailResponse = await fetch(`${baseUrl}/api/admin/integrations/mercadopago`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as {
    provider: {
      configuration_checklist: {
        missing_secrets: string[];
        missing_public_config: string[];
        required_secrets: string[];
      };
      masked_secrets_json: Record<string, string>;
    };
    secrets: Array<Record<string, unknown>>;
    logs: Array<{ event_type: string }>;
  };
  assert.ok(detail.provider.configuration_checklist.required_secrets.includes("MERCADOPAGO_WEBHOOK_SECRET"));
  assert.ok(!detail.provider.configuration_checklist.missing_secrets.includes("MERCADOPAGO_ACCESS_TOKEN"));
  assert.equal(detail.provider.masked_secrets_json.MERCADOPAGO_ACCESS_TOKEN, "****************1234");
  assert.equal(detail.secrets[0].encrypted_value, undefined);
  assert.ok(detail.logs.some((entry) => entry.event_type === "integration.secret_rotated"));

  const updateProviderResponse = await fetch(`${baseUrl}/api/admin/integrations/mercadopago`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "sandbox",
      public_config_json: {
        success_url: "https://lojaopvc.example/pagamento/sucesso",
        failure_url: "https://lojaopvc.example/pagamento/falha",
        pending_url: "https://lojaopvc.example/pagamento/pendente",
        webhook_url: "https://lojaopvc.example/api/payments/webhook",
      },
    }),
  });
  assert.equal(updateProviderResponse.status, 200);

  const configuredDetailResponse = await fetch(`${baseUrl}/api/admin/integrations/mercadopago`, {
    headers: { cookie: admin.cookieHeader },
  });
  const configuredDetail = (await configuredDetailResponse.json()) as typeof detail;
  assert.deepEqual(configuredDetail.provider.configuration_checklist.missing_public_config, []);
});

test("integration central lists ecommerce providers and keeps secrets masked", async () => {
  const admin = await createAdminSession(baseUrl);
  const listResponse = await fetch(`${baseUrl}/api/admin/integrations`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(listResponse.status, 200);
  const providers = (await listResponse.json()) as Array<{
    key: string;
    category: string;
    configuration_checklist: {
      required_secrets: string[];
      missing_secrets: string[];
      ready_for_production: boolean;
    };
    masked_secrets_json: Record<string, string>;
  }>;
  const providerKeys = new Set(providers.map((provider) => provider.key));
  [
    "mercadopago",
    "manual-payment",
    "fake-payment",
    "pickup",
    "local-delivery",
    "correios",
    "melhor-envio",
    "frenet",
    "frete-barato",
    "cepcerto",
    "email",
    "ga4",
    "gtm",
    "search-console",
    "meta-pixel",
    "storage-cdn",
    "webhook-mercadopago",
    "observability",
    "fiscal-future",
  ].forEach((key) => assert.ok(providerKeys.has(key), `provider ${key} ausente`));

  const mercadoPago = providers.find((provider) => provider.key === "mercadopago");
  assert.ok(mercadoPago);
  assert.ok(mercadoPago.configuration_checklist.required_secrets.includes("MERCADOPAGO_ACCESS_TOKEN"));
  assert.equal(typeof mercadoPago.configuration_checklist.ready_for_production, "boolean");
  assert.equal(Object.values(mercadoPago.masked_secrets_json).some((value) => value.includes("TEST-HTTP-SECRET")), false);
});

test("admin can create marketing asset, coupon and read reports", async () => {
  const admin = await createAdminSession(baseUrl);
  const assetResponse = await fetch(`${baseUrl}/api/admin/marketing/assets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      name: "Asset HTTP QA",
      url: "/assets/qa-marketing.jpg",
      alt_text: "Asset QA",
      usage: "banner_desktop",
      status: "active",
    }),
  });
  assert.equal(assetResponse.status, 201);
  const asset = (await assetResponse.json()) as { id: string; url: string };
  assert.ok(asset.id);
  assert.equal(asset.url, "/assets/qa-marketing.jpg");

  const couponResponse = await fetch(`${baseUrl}/api/admin/marketing/coupons`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      code: `QA${Date.now()}`,
      discount_type: "percentage",
      discount_value: 5,
      min_order_value: 100,
      is_active: true,
    }),
  });
  assert.equal(couponResponse.status, 201);

  const csrf = await createCsrfSession(baseUrl);
  await fetch(`${baseUrl}/api/public/marketing-events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken, cookie: csrf.cookieHeader },
    body: JSON.stringify({ event_type: "campaign_view", source_path: "/qa" }),
  });

  const reportsResponse = await fetch(`${baseUrl}/api/admin/marketing/reports`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(reportsResponse.status, 200);
  const report = (await reportsResponse.json()) as { totals: { events: number } };
  assert.ok(report.totals.events >= 1);
});

test("admin can create and update campaign landing pages and reusable snippets", async () => {
  const admin = await createAdminSession(baseUrl);
  const suffix = Date.now();
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const candidateProduct = db.products.find(
    (product: { is_active: boolean; status_product?: string; category_id?: string | null }) =>
      product.is_active && product.status_product !== "inactive" && Boolean(product.category_id),
  );
  assert.ok(candidateProduct);
  const originalSnapshot = {
    stock: candidateProduct.stock,
    price: candidateProduct.price,
    image_url: candidateProduct.image_url ?? null,
    images: Array.isArray(candidateProduct.images) ? [...candidateProduct.images] : [],
    image_alt_text: candidateProduct.image_alt_text ?? null,
    image_review_status: candidateProduct.image_review_status ?? null,
    ncm: candidateProduct.ncm ?? null,
    tax_classification_status: candidateProduct.tax_classification_status ?? null,
    unit_measure: candidateProduct.unit_measure ?? null,
    unit: candidateProduct.unit ?? null,
  };

  candidateProduct.stock = Math.max(Number(candidateProduct.stock) || 0, 10);
  candidateProduct.price = Math.max(Number(candidateProduct.price) || 0, 199.9);
  candidateProduct.unit_measure = candidateProduct.unit_measure || candidateProduct.unit || "un";
  candidateProduct.image_url = `/assets/${candidateProduct.slug || `produto-${candidateProduct.id}`}-qa-${suffix}.jpg`;
  candidateProduct.images = [candidateProduct.image_url];
  candidateProduct.image_alt_text = `Foto real ${candidateProduct.name}`;
  candidateProduct.image_review_status = "approved";
  candidateProduct.ncm = candidateProduct.ncm || "39189000";
  candidateProduct.tax_classification_status = "ready";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  try {
    const showcaseResponse = await fetch(`${baseUrl}/api/admin/marketing/showcases`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        name: `Showcase Landing QA ${suffix}`,
        status: "active",
        type: "manual",
        product_ids_json: [candidateProduct.id],
        title: "Vitrine valida para landing",
        cta_label: "Ver produtos",
        cta_url: "/produtos",
      }),
    });
    assert.equal(showcaseResponse.status, 201);
    const showcase = (await showcaseResponse.json()) as { id: string };

    const landingResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        title: `Landing QA ${suffix}`,
        slug: `landing-qa-${suffix}`,
        status: "draft",
        hero_desktop_image: "/assets/banner-qa-desktop.jpg",
        hero_mobile_image: "/assets/banner-qa-mobile.jpg",
        seo_description: "Landing criada pelo teste HTTP.",
        showcase_ids_json: [showcase.id],
      }),
    });
    assert.equal(landingResponse.status, 201);
    const landing = (await landingResponse.json()) as { id: string; slug: string; status: string };
    assert.ok(landing.id);

    const updateLandingResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages/${landing.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        title: `Landing QA Atualizada ${suffix}`,
        slug: landing.slug,
        status: "active",
        hero_desktop_image: "/assets/banner-qa-desktop.jpg",
        hero_mobile_image: "/assets/banner-qa-mobile.jpg",
        seo_description: "Landing atualizada pelo teste HTTP.",
        showcase_ids_json: [showcase.id],
      }),
    });
    assert.equal(updateLandingResponse.status, 200);
    const updatedLanding = (await updateLandingResponse.json()) as { status: string; title: string };
    assert.equal(updatedLanding.status, "active");

    const duplicateLandingResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages/${landing.id}/duplicate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(duplicateLandingResponse.status, 201);
    const duplicatedLanding = (await duplicateLandingResponse.json()) as { id: string; status: string; slug: string };
    assert.notEqual(duplicatedLanding.id, landing.id);
    assert.equal(duplicatedLanding.status, "draft");

    const snippetResponse = await fetch(`${baseUrl}/api/admin/marketing/snippets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        key: `headline-qa-${suffix}`,
        name: "Headline QA",
        type: "headline",
        content: "Texto reutilizavel de campanha.",
        status: "draft",
      }),
    });
    assert.equal(snippetResponse.status, 201);
    const snippet = (await snippetResponse.json()) as { id: string; content: string };
    assert.ok(snippet.id);

    const updateSnippetResponse = await fetch(`${baseUrl}/api/admin/marketing/snippets/${snippet.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        name: "Headline QA Atualizada",
        content: "Texto reutilizavel atualizado.",
        status: "active",
      }),
    });
    assert.equal(updateSnippetResponse.status, 200);
    const updatedSnippet = (await updateSnippetResponse.json()) as { status: string; content: string };
    assert.equal(updatedSnippet.status, "active");
    assert.equal(updatedSnippet.content, "Texto reutilizavel atualizado.");

    const duplicateSnippetResponse = await fetch(`${baseUrl}/api/admin/marketing/snippets/${snippet.id}/duplicate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
    });
    assert.equal(duplicateSnippetResponse.status, 201);
    const duplicatedSnippet = (await duplicateSnippetResponse.json()) as { id: string; status: string };
    assert.notEqual(duplicatedSnippet.id, snippet.id);
    assert.equal(duplicatedSnippet.status, "draft");
  } finally {
    const resetDb = dbModule.readDb();
    const resetProduct = resetDb.products.find((product) => product.id === candidateProduct.id);
    if (resetProduct) {
      resetProduct.stock = originalSnapshot.stock;
      resetProduct.price = originalSnapshot.price;
      resetProduct.image_url = originalSnapshot.image_url;
      resetProduct.images = [...originalSnapshot.images];
      resetProduct.image_alt_text = originalSnapshot.image_alt_text;
      resetProduct.image_review_status = originalSnapshot.image_review_status;
      resetProduct.ncm = originalSnapshot.ncm;
      resetProduct.tax_classification_status = originalSnapshot.tax_classification_status;
      resetProduct.unit_measure = originalSnapshot.unit_measure;
      resetProduct.unit = originalSnapshot.unit;
    }
    dbModule.writeDb(resetDb);
    await dbModule.waitForPendingDbWrites();
  }
});

test("admin can export marketing reports as CSV", async () => {
  const admin = await createAdminSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/admin/marketing/reports.csv`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
  const csv = await response.text();
  assert.ok(csv.includes('"campaign_id";"name"'));
});

test("updating a marketing snippet cannot mass-assign id/created_by/created_at via the request body", async () => {
  const admin = await createAdminSession(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/admin/marketing/snippets`, {
    method: "POST",
    headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
    body: JSON.stringify({ name: "Snippet Original", content: "Conteudo original" }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { id: string; created_at: string; created_by: string | null };

  const updateResponse = await fetch(`${baseUrl}/api/admin/marketing/snippets/${created.id}`, {
    method: "PUT",
    headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
    body: JSON.stringify({
      name: "Snippet Atualizado",
      id: "id-fabricado-hacker",
      created_by: "hacker-forjado",
      created_at: "1999-01-01T00:00:00.000Z",
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()) as { id: string; name: string; created_at: string; created_by: string | null };
  assert.equal(updated.id, created.id);
  assert.equal(updated.created_by, created.created_by);
  assert.equal(updated.created_at, created.created_at);
  assert.equal(updated.name, "Snippet Atualizado");
});

test("updating a marketing landing page cannot mass-assign id/created_by/created_at via the request body", async () => {
  const admin = await createAdminSession(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages`, {
    method: "POST",
    headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
    body: JSON.stringify({ title: "Landing Original" }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { id: string; created_at: string; created_by: string | null };

  const updateResponse = await fetch(`${baseUrl}/api/admin/marketing/landing-pages/${created.id}`, {
    method: "PUT",
    headers: { cookie: admin.cookieHeader, "content-type": "application/json", "x-csrf-token": admin.csrfToken },
    body: JSON.stringify({
      title: "Landing Atualizada",
      id: "id-fabricado-hacker",
      created_by: "hacker-forjado",
      created_at: "1999-01-01T00:00:00.000Z",
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()) as { id: string; title: string; created_at: string; created_by: string | null };
  assert.equal(updated.id, created.id);
  assert.equal(updated.created_by, created.created_by);
  assert.equal(updated.created_at, created.created_at);
  assert.equal(updated.title, "Landing Atualizada");
});
