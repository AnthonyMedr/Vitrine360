import test from "node:test";
import assert from "node:assert/strict";
import { seedDb } from "../server/db.ts";
import {
  approveIntegrationProductionActivation,
  createMarketingCampaign,
  createOrUpdateMarketingAsset,
  createOrUpdateMarketingCoupon,
  getCampaignPublicationReadiness,
  getMarketingOverview,
  getMarketingReadiness,
  getMarketingReports,
  getPublicMarketingState,
  requestIntegrationProductionActivation,
  saveIntegrationSecret,
  setMarketingCampaignStatus,
  normalizeCampaignType,
} from "../server/marketing-operations.ts";

test("marketing seed provides default theme and annual campaign structure", () => {
  const db = seedDb();
  const readiness = getMarketingReadiness(db);
  assert.equal(readiness.ready, true);
  assert.ok(db.ecommerceThemes.some((theme) => theme.type === "default" && theme.status === "active"));
  assert.ok(db.marketingCampaigns.length >= 12);
  assert.ok(db.campaignLandingPages.some((page) => page.slug === "mes-das-maes"));
  const juneCampaign = db.marketingCampaigns.find((campaign) => campaign.slug === "sao-joao-da-reforma");
  assert.equal(juneCampaign?.name, "Junho da Reforma: Copa e Sao Joao");
  assert.equal(juneCampaign?.rules_json?.campaign_context_2026, "copa_do_mundo_mais_festas_juninas");
});

test("campaign type aliases normalize portuguese operational labels", () => {
  assert.equal(normalizeCampaignType("quinzenal"), "fortnightly");
  assert.equal(normalizeCampaignType("produto"), "product");
  assert.equal(normalizeCampaignType("B2B"), "b2b");
  assert.equal(normalizeCampaignType("empresas"), "b2b");
  assert.equal(normalizeCampaignType("mensal"), "monthly");
});

test("active public marketing state resolves highest priority active campaign", () => {
  const db = seedDb();
  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Ativa",
    status: "active",
    priority: 500,
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    products_json: [],
    categories_json: [],
  });
  const state = getPublicMarketingState(db);
  assert.equal(state.campaigns[0]?.id, campaign.id);
  assert.equal(state.top_bar?.text, campaign.headline);
});

test("scheduled campaign starts shaping the site automatically when its period arrives", () => {
  const db = seedDb();
  const now = new Date("2026-06-10T12:00:00.000Z");
  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Agendada Junho",
    status: "scheduled",
    priority: 950,
    starts_at: "2026-06-01T00:00:00.000Z",
    ends_at: "2026-06-30T23:59:59.000Z",
    headline: "Junho automatico no ar",
    cta_label: "Ver Junho",
    cta_url: "/campanhas/qa-junho",
    products_json: [],
    categories_json: [],
  });
  const future = getPublicMarketingState(db, now);
  assert.equal(future.site_experience.mode, "campaign");
  assert.equal(future.site_experience.active_campaign?.id, campaign.id);
  assert.equal(future.site_experience.publication.live_state, "live");

  const before = getPublicMarketingState(db, new Date("2026-05-10T12:00:00.000Z"));
  assert.notEqual(before.site_experience.active_campaign?.id, campaign.id);
});

test("marketing overview reports scheduled campaign conflicts on unique surfaces", () => {
  const db = seedDb();
  const base = {
    status: "scheduled" as const,
    starts_at: "2026-06-01T00:00:00.000Z",
    ends_at: "2026-06-30T23:59:59.000Z",
    cta_label: "Ver campanha",
    cta_url: "/campanhas/conflito",
    products_json: [],
    categories_json: [],
    rules_json: {
      top_bar_enabled: true,
      hero_enabled: true,
      home_showcases_enabled: false,
      landing_enabled: false,
      whatsapp_enabled: false,
    },
  };
  const first = createMarketingCampaign(db, {
    ...base,
    name: "Campanha QA Conflito A",
    priority: 100,
    headline: "Conflito A",
  });
  const second = createMarketingCampaign(db, {
    ...base,
    name: "Campanha QA Conflito B",
    priority: 100,
    headline: "Conflito B",
    cta_url: "/campanhas/conflito-b",
  });

  const overview = getMarketingOverview(db, new Date("2026-06-10T12:00:00.000Z"));
  const conflict = overview.conflicts.find((item) => item.type === "campaign_surface_schedule_conflict");
  assert.ok(conflict);
  assert.deepEqual(new Set(conflict.item_ids as string[]), new Set([first.id, second.id]));
  assert.equal(conflict.severity, "warning");
  assert.match(String(conflict.recommendation), /prioridade diferente/i);
});

test("public marketing state exposes site experience that can shape the home around the active campaign", () => {
  const db = seedDb();
  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Home",
    status: "active",
    priority: 800,
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    headline: "Semana QA de campanha",
    subheadline: "A home deve seguir a campanha ativa",
    cta_label: "Ver campanha",
    cta_url: "/campanhas/qa-home",
    whatsapp_message: "Quero falar sobre a campanha QA",
    products_json: [],
    categories_json: [],
    landing_page_id: db.campaignLandingPages[0]?.id ?? null,
  });
  const showcase = db.productShowcases[0];
  showcase.status = "active";
  showcase.campaign_id = campaign.id;
  showcase.title = "Faixa principal da campanha";
  showcase.subtitle = "Selecao prioritaria para a home";
  const state = getPublicMarketingState(db);
  assert.equal(state.site_experience.mode, "campaign");
  assert.equal(state.site_experience.publication.live_state, "live");
  assert.equal(state.site_experience.publication.affects_site_now, true);
  assert.equal(state.site_experience.active_campaign?.id, campaign.id);
  assert.ok(state.site_experience.configured_surfaces.includes("top_bar"));
  assert.ok(state.site_experience.configured_surfaces.includes("home_showcases"));
  assert.ok(state.site_experience.home_slots.length >= 1);
  assert.equal(state.site_experience.home_slots[0]?.title, "Faixa principal da campanha");
});

test("public marketing state prioritizes manual campaign order before landing showcase order for home slots", () => {
  const db = seedDb();
  const firstCategoryId = db.categories[0]?.id;
  const secondCategoryId = db.categories[1]?.id;
  assert.ok(firstCategoryId);
  assert.ok(secondCategoryId);

  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Ordenacao",
    status: "active",
    priority: 900,
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    categories_json: [secondCategoryId, firstCategoryId],
    products_json: [],
    landing_page_id: db.campaignLandingPages[0]?.id ?? null,
  });

  const showcaseA = db.productShowcases[0];
  const showcaseB = {
    ...db.productShowcases[0],
    id: "showcase-home-campaign-secondary-qa",
    slug: "showcase-home-campaign-secondary-qa",
    name: "Showcase Home Campaign Secondary QA",
    title: "Faixa secundaria QA",
  };
  db.productShowcases.push(showcaseB);
  assert.ok(showcaseA);
  assert.ok(showcaseB);
  showcaseA.status = "active";
  showcaseB.status = "active";
  showcaseA.placement = "home";
  showcaseB.placement = "home";
  showcaseA.campaign_id = campaign.id;
  showcaseB.campaign_id = campaign.id;
  showcaseA.priority = 10;
  showcaseB.priority = 1;
  campaign.rules_json = {
    ...(campaign.rules_json ?? {}),
    home_showcase_order: [showcaseB.slug, showcaseA.slug],
  };

  const landing = db.campaignLandingPages.find((page) => page.id === campaign.landing_page_id);
  assert.ok(landing);
  landing.showcase_ids_json = [showcaseB.id, showcaseA.id];

  const state = getPublicMarketingState(db);
  assert.equal(state.site_experience.category_focus.enabled, true);
  assert.deepEqual(state.site_experience.category_focus.ids, [secondCategoryId, firstCategoryId]);
  assert.equal(state.site_experience.home_slots[0]?.showcase_id, showcaseB.id);
});

test("public marketing state respects explicit campaign surface toggles", () => {
  const db = seedDb();
  const categoryA = db.categories[0]?.id;
  const categoryB = db.categories[1]?.id;
  assert.ok(categoryA);
  assert.ok(categoryB);

  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Superficies",
    status: "active",
    priority: 920,
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    headline: "Hero e top bar nao devem entrar",
    subheadline: "A campanha vai usar apenas landing e cupom",
    cta_label: "Ver landing",
    cta_url: "/campanhas/qa-superficies",
    whatsapp_message: "WhatsApp desligado nesta campanha",
    banner_desktop: "/assets/qa-superficies-desktop.jpg",
    banner_mobile: "/assets/qa-superficies-mobile.jpg",
    categories_json: [categoryA, categoryB],
    landing_page_id: db.campaignLandingPages[0]?.id ?? null,
    coupon_id: db.coupons[0]?.id ?? null,
    rules_json: {
      top_bar_enabled: false,
      hero_enabled: false,
      home_showcases_enabled: false,
      category_focus_enabled: false,
      landing_enabled: true,
      whatsapp_enabled: false,
      coupon_enabled: true,
    },
  });

  const showcase = db.productShowcases[0];
  assert.ok(showcase);
  showcase.status = "active";
  showcase.placement = "home";
  showcase.campaign_id = campaign.id;

  const state = getPublicMarketingState(db);
  assert.equal(state.top_bar, null);
  assert.equal(state.site_experience.surface_controls.top_bar, false);
  assert.equal(state.site_experience.surface_controls.hero, false);
  assert.equal(state.site_experience.surface_controls.home_showcases, false);
  assert.equal(state.site_experience.surface_controls.category_focus, false);
  assert.equal(state.site_experience.surface_controls.whatsapp, false);
  assert.deepEqual(state.site_experience.category_focus.ids, []);
  assert.equal(state.site_experience.home_slots.length, 0);
  assert.equal(state.site_experience.hero.title, null);
  assert.equal(state.site_experience.landing_page?.id, campaign.landing_page_id);
  assert.equal(state.site_experience.coupon?.id, campaign.coupon_id);
});


test("integration secrets are encrypted and sanitized before leaving backend", () => {
  const db = seedDb();
  const safeSecret = saveIntegrationSecret(db, {
    providerKey: "mercadopago",
    secretKey: "MERCADOPAGO_ACCESS_TOKEN",
    value: "TEST-1234567890SECRET",
    environment: "sandbox",
    actorId: "qa-admin",
  });
  assert.equal("encrypted_value" in safeSecret, false);
  assert.match(safeSecret.masked_value, /\*+CRET$/);
  assert.ok(db.integrationSecrets[0].encrypted_value.includes(":"));
});

test("production integration activation requires a second approver", () => {
  const db = seedDb();
  saveIntegrationSecret(db, {
    providerKey: "mercadopago",
    secretKey: "MERCADOPAGO_ACCESS_TOKEN",
    value: "TEST-1234567890SECRET",
    environment: "production",
    actorId: "admin-a",
  });
  saveIntegrationSecret(db, {
    providerKey: "mercadopago",
    secretKey: "MERCADOPAGO_WEBHOOK_SECRET",
    value: "WEBHOOK-1234567890SECRET",
    environment: "production",
    actorId: "admin-a",
  });

  const providerBeforeRequest = db.integrationProviders.find((provider) => provider.key === "mercadopago");
  assert.equal(providerBeforeRequest?.status, "sandbox");

  const requested = requestIntegrationProductionActivation(db, {
    providerKey: "mercadopago",
    publicConfig: {
      success_url: "https://lojaopvc.example/sucesso",
      failure_url: "https://lojaopvc.example/falha",
      pending_url: "https://lojaopvc.example/pendente",
      webhook_url: "https://lojaopvc.example/api/payments/webhook/mercadopago",
    },
    reason: "Homologacao sandbox validada pelo financeiro",
    actorId: "admin-a",
    actorName: "Admin A",
  });

  assert.equal(requested.status, "sandbox");
  assert.equal(requested.public_config_json.production_activation_pending, "true");
  assert.throws(
    () => approveIntegrationProductionActivation(db, { providerKey: "mercadopago", actorId: "admin-a", actorName: "Admin A" }),
    /segundo usuario/,
  );

  const approved = approveIntegrationProductionActivation(db, { providerKey: "mercadopago", actorId: "admin-b", actorName: "Admin B" });
  assert.equal(approved.status, "production");
  assert.equal(approved.public_config_json.production_activation_pending, "false");
  assert.ok(db.auditLogs.some((entry) => entry.event_type === "integration.production_activation_requested"));
  assert.ok(db.auditLogs.some((entry) => entry.event_type === "integration.production_activation_approved"));
});

test("fake payment provider cannot be promoted to production", () => {
  const db = seedDb();
  assert.throws(
    () =>
      requestIntegrationProductionActivation(db, {
        providerKey: "fake-payment",
        publicConfig: { allowed_environment: "test" },
        reason: "Tentativa de ativacao fake em producao",
        actorId: "admin-a",
      }),
    /fake\/local/,
  );
});

test("campaign lifecycle actions generate status changes", () => {
  const db = seedDb();
  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Ciclo",
    status: "draft",
    cta_label: "Ver campanha",
    cta_url: "/campanhas/qa-ciclo",
    banner_desktop: "/assets/qa-ciclo-desktop.jpg",
  });
  const showcase = db.productShowcases[0];
  assert.ok(showcase);
  showcase.status = "active";
  showcase.placement = "home";
  showcase.campaign_id = campaign.id;
  setMarketingCampaignStatus(db, campaign.id, "active");
  assert.equal(campaign.status, "active");
  assert.ok(campaign.published_at);
  setMarketingCampaignStatus(db, campaign.id, "paused");
  assert.equal(campaign.status, "paused");
});

test("marketing readiness warns about active incomplete campaigns", () => {
  const db = seedDb();
  createMarketingCampaign(db, {
    name: "Campanha QA Incompleta",
    status: "active",
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    cta_label: "",
    cta_url: "",
    whatsapp_message: "",
    products_json: [],
    categories_json: [],
  });
  const readiness = getMarketingReadiness(db);
  assert.equal(readiness.ready, true);
  assert.ok(readiness.warnings >= 3);
});

test("campaign publication readiness blocks activation when linked active product has critical commercial or visual blocker", () => {
  const db = seedDb();
  const product = db.products.find((entry) => entry.is_active && entry.status_product !== "inactive");
  assert.ok(product);
  product.image_url = "/placeholder.svg";
  product.images = ["/placeholder.svg"];
  product.image_review_status = "missing";

  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Bloqueada",
    status: "draft",
    products_json: [product.id],
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
  });

  const readiness = getCampaignPublicationReadiness(db);
  const row = readiness.campaigns.find((item) => item.id === campaign.id);
  assert.equal(row?.ready_for_activation, false);
  assert.ok((row?.blockers ?? 0) > 0);
  assert.throws(() => setMarketingCampaignStatus(db, campaign.id, "active"), /Campanha bloqueada para ativacao/i);
});

test("campaign publication readiness blocks live campaign without CTA, hero or home slots", () => {
  const db = seedDb();
  const product = db.products.find((entry) => entry.is_active && entry.status_product !== "inactive" && entry.stock > 0);
  assert.ok(product);

  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Sem Hero",
    status: "draft",
    products_json: [product.id],
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    cta_label: "",
    cta_url: "",
    banner_desktop: null,
    banner_mobile: null,
  });

  const readiness = getCampaignPublicationReadiness(db);
  const row = readiness.campaigns.find((item) => item.id === campaign.id);
  assert.equal(row?.ready_for_activation, false);
  assert.ok((row?.top_issues ?? []).some((issue) => issue.includes("CTA principal")));
});

test("campaign publication readiness ignores disabled hero and home surfaces when validating activation", () => {
  const db = seedDb();
  const product = db.products.find((entry) => entry.is_active && entry.status_product !== "inactive" && entry.stock > 0);
  assert.ok(product);
  product.ncm = product.ncm || "39259000";
  product.tax_code = product.tax_code || "PVC-STD";
  product.tax_classification_status = "ready";
  product.price = Math.max(Number(product.price || 0), 199.9);
  product.category_id = product.category_id || db.categories[0]?.id || null;
  product.image_review_status = "approved";
  product.image_url = product.image_url && !product.image_url.includes("placeholder") ? product.image_url : "/uploads/catalog/qa-surface-gate.jpg";
  product.images = [product.image_url];

  const campaign = createMarketingCampaign(db, {
    name: "Campanha QA Surface Gate",
    status: "draft",
    products_json: [product.id],
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    cta_label: "Ver campanha",
    cta_url: "/campanhas/qa-surface-gate",
    banner_desktop: null,
    banner_mobile: null,
    rules_json: {
      hero_enabled: false,
      home_showcases_enabled: false,
      landing_enabled: false,
      whatsapp_enabled: false,
    },
  });

  const readiness = getCampaignPublicationReadiness(db);
  const row = readiness.campaigns.find((item) => item.id === campaign.id);
  assert.equal(row?.ready_for_activation, true);
  assert.equal(row?.blockers, 0);
});

test("campaign publication readiness exposes blocked showcase and landing when no eligible campaign mix exists", () => {
  const db = seedDb();
  const product = db.products.find((entry) => entry.is_active && entry.status_product !== "inactive");
  assert.ok(product);
  product.image_url = "/placeholder.svg";
  product.images = ["/placeholder.svg"];
  product.image_review_status = "missing";

  const showcase = db.productShowcases[0];
  showcase.status = "active";
  showcase.type = "manual";
  showcase.product_ids_json = [product.id];

  const landing = db.campaignLandingPages[0];
  landing.status = "active";
  landing.showcase_ids_json = [showcase.id];
  landing.hero_desktop_image = null;
  landing.hero_mobile_image = null;

  const readiness = getCampaignPublicationReadiness(db);
  const showcaseRow = readiness.showcases.find((item) => item.id === showcase.id);
  const landingRow = readiness.landing_pages.find((item) => item.id === landing.id);
  assert.equal(showcaseRow?.ready_for_activation, false);
  assert.equal(landingRow?.ready_for_activation, false);
  assert.ok((showcaseRow?.blockers ?? 0) > 0);
  assert.ok((landingRow?.blockers ?? 0) > 0);
});

test("marketing assets and coupons are persisted with validation", () => {
  const db = seedDb();
  const asset = createOrUpdateMarketingAsset(db, {
    name: "Banner QA",
    url: "/assets/banner-qa.jpg",
    type: "image",
    usage: "banner_desktop",
    status: "active",
    alt_text: "Banner QA",
  });
  const coupon = createOrUpdateMarketingCoupon(db, {
    code: "QA10",
    discount_type: "percentage",
    discount_value: 10,
    min_order_value: 100,
    is_active: true,
  });
  assert.equal(asset.name, "Banner QA");
  assert.equal(coupon.code, "QA10");
  assert.throws(() => createOrUpdateMarketingCoupon(db, { code: "QA999", discount_type: "percentage", discount_value: 120 }), /100%/);
});

test("marketing reports aggregate event counters", () => {
  const db = seedDb();
  const campaign = createMarketingCampaign(db, { name: "Campanha QA Relatorio", status: "active" });
  db.marketingEvents.push(
    { id: "event-1", event_type: "campaign_view", campaign_id: campaign.id, theme_id: null, banner_id: null, showcase_id: null, product_id: null, source_path: "/campanhas/qa", metadata_json: {}, created_at: new Date().toISOString() },
    { id: "event-2", event_type: "whatsapp_click", campaign_id: campaign.id, theme_id: null, banner_id: null, showcase_id: null, product_id: null, source_path: "/campanhas/qa", metadata_json: {}, created_at: new Date().toISOString() },
  );
  const report = getMarketingReports(db);
  const row = report.campaigns.find((item) => item.campaign_id === campaign.id);
  assert.equal(row?.views, 1);
  assert.equal(row?.whatsapp_clicks, 1);
});
