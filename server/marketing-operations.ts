import crypto from "node:crypto";
import { createAuditEvent } from "./order-domain";
import {
  createId,
  type DatabaseShape,
  type DbCampaignLandingPage,
  type DbContentSnippet,
  type DbEcommerceTheme,
  type DbIntegrationProvider,
  type DbIntegrationSecret,
  type DbCoupon,
  type DbMarketingBanner,
  type DbMarketingCampaign,
  type DbMarketingCard,
  type DbMarketingEvent,
  type DbMarketingAsset,
  type DbProductShowcase,
  type MarketingCampaignType,
  type MarketingLifecycleStatus,
  withRelations,
} from "./db";
import { getProductPublicationIssues } from "./catalog-staging";
import { auditCatalogImages } from "../src/lib/catalogImageAudit";

const lifecycleStatuses: MarketingLifecycleStatus[] = ["draft", "review", "scheduled", "active", "paused", "ended", "archived"];
export const campaignTypeAliases: Record<string, MarketingCampaignType> = {
  mensal: "monthly",
  monthly: "monthly",
  quinzenal: "fortnightly",
  fortnightly: "fortnightly",
  semanal: "weekly",
  weekly: "weekly",
  sazonal: "commemorative",
  seasonal: "commemorative",
  comemorativa: "commemorative",
  commemorative: "commemorative",
  produto: "product",
  product: "product",
  categoria: "category",
  category: "category",
  b2b: "b2b",
  empresas: "b2b",
  institucional: "institutional",
  institutional: "institutional",
  regional: "regional",
  relampago: "flash",
  flash: "flash",
  liquidacao: "clearance",
  clearance: "clearance",
  lancamento: "launch",
  launch: "launch",
  carrinho: "cart_recovery",
  cart_recovery: "cart_recovery",
  whatsapp: "whatsapp",
};
const secretEncryptionKey = crypto.createHash("sha256").update(process.env.INTEGRATION_SECRETS_KEY || "gamel-local-development-secret-key").digest();

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isNonEmpty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStatus(value: unknown, fallback: MarketingLifecycleStatus = "draft") {
  return lifecycleStatuses.includes(value as MarketingLifecycleStatus) ? (value as MarketingLifecycleStatus) : fallback;
}

export function normalizeCampaignType(value: unknown, fallback: MarketingCampaignType = "monthly") {
  const key = String(value ?? "").trim().toLowerCase();
  return campaignTypeAliases[key] ?? fallback;
}

function assertDateRange(startsAt: string | null, endsAt: string | null) {
  if (startsAt && Number.isNaN(Date.parse(startsAt))) return "Data inicial invalida.";
  if (endsAt && Number.isNaN(Date.parse(endsAt))) return "Data final invalida.";
  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) return "Data inicial deve ser menor que data final.";
  return null;
}

function isWithinPeriod(item: { starts_at: string | null; ends_at: string | null }, reference = new Date()) {
  const time = reference.getTime();
  if (item.starts_at && Date.parse(item.starts_at) > time) return false;
  if (item.ends_at && Date.parse(item.ends_at) < time) return false;
  return true;
}

export function isMarketingActive(item: { status: MarketingLifecycleStatus; starts_at: string | null; ends_at: string | null }, reference = new Date()) {
  return (item.status === "active" || item.status === "scheduled") && isWithinPeriod(item, reference);
}

function readSurfaceRule(rules: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = rules?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function getCampaignSurfaceControls(campaign: DbMarketingCampaign | null | undefined) {
  if (!campaign) {
    return {
      top_bar: false,
      hero: false,
      home_showcases: false,
      category_focus: false,
      landing: false,
      whatsapp: false,
      coupon: false,
    };
  }
  const rules = campaign?.rules_json ?? {};
  const hasHeroAsset = Boolean(campaign?.banner_desktop || campaign?.banner_mobile || campaign?.headline);
  return {
    top_bar: readSurfaceRule(rules, "top_bar_enabled", Boolean(campaign?.headline)),
    hero: readSurfaceRule(rules, "hero_enabled", hasHeroAsset),
    home_showcases: readSurfaceRule(rules, "home_showcases_enabled", true),
    category_focus: readSurfaceRule(rules, "category_focus_enabled", Boolean(campaign?.categories_json?.length)),
    landing: readSurfaceRule(rules, "landing_enabled", Boolean(campaign?.landing_page_id)),
    whatsapp: readSurfaceRule(rules, "whatsapp_enabled", Boolean(campaign?.whatsapp_message)),
    coupon: readSurfaceRule(rules, "coupon_enabled", Boolean(campaign?.coupon_id)),
  };
}

export function sanitizeIntegrationSecret(secret: DbIntegrationSecret) {
  const { encrypted_value: _encryptedValue, ...safe } = secret;
  return safe;
}

function maskSecret(value: string) {
  const normalized = String(value || "");
  if (normalized.length <= 4) return "****";
  return `${"*".repeat(Math.min(16, Math.max(8, normalized.length - 4)))}${normalized.slice(-4)}`;
}

const integrationRequirements: Record<
  string,
  {
    requiredSecrets: string[];
    requiredPublicConfig: string[];
    productionChecklist: string[];
    adminInstructions: string;
  }
> = {
  "manual-payment": {
    requiredSecrets: [],
    requiredPublicConfig: ["finance_contact", "manual_review_sla"],
    productionChecklist: ["Definir responsavel financeiro", "Validar conciliacao diaria", "Manter comprovantes auditaveis"],
    adminInstructions: "Pagamento assistido deve ser tratado pelo financeiro antes de liberar separacao.",
  },
  "fake-payment": {
    requiredSecrets: [],
    requiredPublicConfig: ["allowed_environment"],
    productionChecklist: ["Usar somente em desenvolvimento/homologacao", "Bloquear em producao", "Documentar status fake esperado"],
    adminInstructions: "Provider fake/local existe apenas para teste interno e nunca deve liberar venda real.",
  },
  mercadopago: {
    requiredSecrets: ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"],
    requiredPublicConfig: ["success_url", "failure_url", "pending_url", "webhook_url"],
    productionChecklist: ["Usar URLs HTTPS publicas", "Validar webhook assinado", "Rodar smoke phase2", "Conferir sandbox antes de producao"],
    adminInstructions: "Cadastre token e webhook secret reais apenas pelo Admin Master. O valor completo nao sera exibido depois de salvo.",
  },
  "melhor-envio": {
    requiredSecrets: ["MELHOR_ENVIO_TOKEN"],
    requiredPublicConfig: ["origin_zip", "environment", "services"],
    productionChecklist: ["Validar CEP origem", "Homologar produtos pesados", "Testar cotacao estadual/nacional", "Definir fallback operacional"],
    adminInstructions: "Configure token e CEP de origem para liberar cotacao nacional por transportadora.",
  },
  pickup: {
    requiredSecrets: [],
    requiredPublicConfig: ["store_address", "pickup_hours", "customer_instructions"],
    productionChecklist: ["Validar endereco da loja", "Definir horario de retirada", "Treinar atendimento"],
    adminInstructions: "Retirada em loja pode operar internamente, desde que endereco e horario estejam claros.",
  },
  "local-delivery": {
    requiredSecrets: [],
    requiredPublicConfig: ["zones_policy", "base_fee", "estimated_deadline"],
    productionChecklist: ["Validar zonas", "Definir taxa e prazo", "Treinar separacao/entrega"],
    adminInstructions: "Entrega local usa regra interna e deve ser revisada antes de campanha regional.",
  },
  correios: {
    requiredSecrets: ["CORREIOS_TOKEN"],
    requiredPublicConfig: ["origin_zip", "contract_code"],
    productionChecklist: ["Validar contrato", "Testar CEPs fora da area local", "Definir prazo e rastreio"],
    adminInstructions: "Use Correios como provider/fallback quando houver contrato e regra comercial validada.",
  },
  frenet: {
    requiredSecrets: ["FRENET_TOKEN"],
    requiredPublicConfig: ["origin_zip"],
    productionChecklist: ["Validar credencial", "Testar cotacao", "Definir fallback"],
    adminInstructions: "Frenet depende de credencial real/contrato e deve ser testado antes de liberar checkout nacional.",
  },
  "frete-barato": {
    requiredSecrets: ["FRETE_BARATO_TOKEN"],
    requiredPublicConfig: ["customer_id", "platform"],
    productionChecklist: ["Validar conta", "Testar cotacao", "Definir fallback"],
    adminInstructions: "Frete Barato depende de token e identificador do cliente.",
  },
  cepcerto: {
    requiredSecrets: ["CEPCERTO_TOKEN"],
    requiredPublicConfig: ["origin_zip"],
    productionChecklist: ["Validar consulta CEP", "Testar fallback", "Monitorar limites"],
    adminInstructions: "CepCerto depende de credencial real; fallback publico pode continuar para teste.",
  },
  cep: {
    requiredSecrets: [],
    requiredPublicConfig: ["providers", "cache_ttl_hours"],
    productionChecklist: ["Validar fallback ViaCEP/BrasilAPI", "Monitorar falhas de consulta"],
    adminInstructions: "Consulta de CEP pode operar sem secret usando provedores publicos com cache.",
  },
  whatsapp: {
    requiredSecrets: ["WHATSAPP_API_TOKEN"],
    requiredPublicConfig: ["business_phone", "default_message"],
    productionChecklist: ["Validar numero oficial", "Definir responsaveis de atendimento", "Testar links de campanha"],
    adminInstructions: "Configure numero publico e token somente se houver API oficial. Links wa.me podem funcionar sem token.",
  },
  email: {
    requiredSecrets: ["EMAIL_API_KEY"],
    requiredPublicConfig: ["from_email", "from_name", "provider"],
    productionChecklist: ["Autenticar dominio", "Testar entrega transacional", "Configurar SPF/DKIM/DMARC"],
    adminInstructions: "Troque o modo log por provider real antes de depender de emails de pedido.",
  },
  ga4: {
    requiredSecrets: [],
    requiredPublicConfig: ["measurement_id"],
    productionChecklist: ["Validar consentimento LGPD", "Testar eventos de checkout", "Conferir origem das campanhas"],
    adminInstructions: "Configure somente IDs publicos de analytics. Nao cadastre secrets desnecessarios.",
  },
  gtm: {
    requiredSecrets: [],
    requiredPublicConfig: ["container_id"],
    productionChecklist: ["Validar consentimento LGPD", "Publicar container revisado", "Testar eventos criticos"],
    adminInstructions: "GTM usa ID publico; nao cadastre secrets.",
  },
  "search-console": {
    requiredSecrets: [],
    requiredPublicConfig: ["property_url"],
    productionChecklist: ["Validar propriedade", "Enviar sitemap", "Monitorar indexacao"],
    adminInstructions: "Search Console depende de dominio real validado pela empresa.",
  },
  "meta-pixel": {
    requiredSecrets: [],
    requiredPublicConfig: ["pixel_id"],
    productionChecklist: ["Validar consentimento LGPD", "Testar eventos de campanha", "Conferir politicas de anuncios"],
    adminInstructions: "Pixel usa identificador publico; secrets ficam fora do frontend.",
  },
  "storage-cdn": {
    requiredSecrets: ["STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"],
    requiredPublicConfig: ["bucket", "public_base_url", "region"],
    productionChecklist: ["Definir bucket privado/publico", "Validar CDN", "Testar upload e rollback"],
    adminInstructions: "Use storage/CDN para imagens e assets de campanha em producao.",
  },
  "webhook-mercadopago": {
    requiredSecrets: ["MERCADOPAGO_WEBHOOK_SECRET"],
    requiredPublicConfig: ["webhook_url"],
    productionChecklist: ["Usar HTTPS publico", "Validar HMAC", "Testar evento duplicado"],
    adminInstructions: "Webhook Mercado Pago fica bloqueado sem dominio HTTPS e secret real.",
  },
  "webhook-freight": {
    requiredSecrets: ["FREIGHT_WEBHOOK_SECRET"],
    requiredPublicConfig: ["webhook_url", "provider"],
    productionChecklist: ["Usar HTTPS publico", "Validar assinatura quando houver", "Testar reentrega"],
    adminInstructions: "Webhook de frete depende do provider escolhido.",
  },
  "webhook-fiscal-erp": {
    requiredSecrets: ["ERP_WEBHOOK_SECRET"],
    requiredPublicConfig: ["webhook_url", "provider"],
    productionChecklist: ["Validar com contador/ERP", "Usar HTTPS publico", "Testar assinatura"],
    adminInstructions: "Webhook fiscal/ERP futuro depende de fornecedor e contador.",
  },
  observability: {
    requiredSecrets: ["METRICS_TOKEN"],
    requiredPublicConfig: ["dashboard_url", "alert_channel"],
    productionChecklist: ["Proteger /api/metrics", "Definir alertas", "Testar healthchecks"],
    adminInstructions: "Observabilidade de producao exige metrics token e canal de alerta.",
  },
  "fiscal-future": {
    requiredSecrets: ["FISCAL_API_TOKEN"],
    requiredPublicConfig: ["provider", "environment", "company_tax_id"],
    productionChecklist: ["Validar com contador", "Homologar emissao", "Testar cancelamento/correcao"],
    adminInstructions: "Integracao fiscal depende de decisao contabil. Nao preencha NCM/tributacao sem contador.",
  },
};

function getIntegrationRequirement(providerKey: string) {
  return (
    integrationRequirements[providerKey] ?? {
      requiredSecrets: [],
      requiredPublicConfig: [],
      productionChecklist: ["Definir responsavel", "Documentar credenciais", "Testar conexao em sandbox"],
      adminInstructions: "Configure e teste a integracao antes de usar em producao.",
    }
  );
}

function buildIntegrationChecklist(provider: DbIntegrationProvider, secrets: DbIntegrationSecret[]) {
  const requirement = getIntegrationRequirement(provider.key);
  const activeSecrets = secrets.filter((secret) => secret.provider_key === provider.key && secret.status === "active");
  const activeSecretKeys = new Set(activeSecrets.map((secret) => secret.secret_key));
  const missingSecrets = requirement.requiredSecrets.filter((key) => !activeSecretKeys.has(key));
  const missingPublicConfig = requirement.requiredPublicConfig.filter((key) => {
    const value = provider.public_config_json?.[key];
    return value === null || value === undefined || value === "";
  });
  const readyForAdminConfiguration = missingSecrets.length === 0 && missingPublicConfig.length === 0;
  const readyForProduction = provider.is_required_for_production
    ? provider.status === "production" && provider.is_configured && readyForAdminConfiguration
    : provider.status !== "error" && (provider.is_configured || readyForAdminConfiguration);

  return {
    required_secrets: requirement.requiredSecrets,
    required_public_config: requirement.requiredPublicConfig,
    missing_secrets: missingSecrets,
    missing_public_config: missingPublicConfig,
    production_checklist: requirement.productionChecklist,
    admin_instructions: requirement.adminInstructions,
    ready_for_admin_configuration: readyForAdminConfiguration,
    ready_for_production: readyForProduction,
    active_secret_count: activeSecrets.length,
  };
}

function sanitizeIntegrationProvider(provider: DbIntegrationProvider, secrets: DbIntegrationSecret[] = []) {
  return {
    ...provider,
    masked_secrets_json: provider.masked_secrets_json || {},
    configuration_checklist: buildIntegrationChecklist(provider, secrets),
  };
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function buildMutationContext(input: {
  actorId?: string | null;
  actorName?: string | null;
  correlationId?: string | null;
}) {
  return {
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    correlationId: input.correlationId || createId(),
  };
}

function auditMarketingMutation(
  db: DatabaseShape,
  input: {
    action: string;
    entity: string;
    entityId: string;
    previousValue?: Record<string, unknown> | null;
    nextValue?: Record<string, unknown> | null;
    actorId?: string | null;
    actorName?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const context = buildMutationContext(input);
  createAuditEvent(db, {
    eventType: input.action,
    correlationId: context.correlationId,
    actorId: context.actorId,
    actorName: context.actorName,
    sourceChannel: "integration",
    previousValue: input.previousValue ?? null,
    newValue: input.nextValue ?? null,
    payload: {
      entity: input.entity,
      entity_id: input.entityId,
      ...(input.metadata ?? {}),
    },
  });
}

export function getMarketingOverview(db: DatabaseShape, reference = new Date()) {
  const activeCampaigns = db.marketingCampaigns.filter((campaign) => isMarketingActive(campaign, reference));
  const activeThemes = db.ecommerceThemes.filter((theme) => isMarketingActive(theme, reference));
  const activeBanners = db.marketingBanners.filter((banner) => isMarketingActive(banner, reference));
  const activeShowcases = db.productShowcases.filter((showcase) => isMarketingActive(showcase, reference));
  const resolvedShowcases = activeShowcases.sort((a, b) => b.priority - a.priority).map((showcase) => resolveShowcaseProducts(db, showcase));
  const activeTheme = resolveActiveTheme(db, reference);
  const conflicts = findMarketingConflicts(db);
  return {
    generated_at: nowIso(),
    counts: {
      themes: db.ecommerceThemes.length,
      campaigns: db.marketingCampaigns.length,
      banners: db.marketingBanners.length,
      cards: db.marketingCards.length,
      showcases: db.productShowcases.length,
      landing_pages: db.campaignLandingPages.length,
      snippets: db.contentSnippets.length,
      assets: db.marketingAssets.length,
      integrations: db.integrationProviders.length,
      events: db.marketingEvents.length,
      coupons: db.coupons.length,
    },
    active: {
      theme: activeTheme,
      campaigns: activeCampaigns,
      banners: activeBanners,
      showcases: activeShowcases,
      themes: activeThemes,
    },
    site_experience: buildSiteExperience(db, {
      theme: activeTheme,
      campaigns: [...activeCampaigns].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)),
      banners: [...activeBanners].sort((a, b) => b.priority - a.priority),
      showcases: resolvedShowcases,
    }),
    warnings: getMarketingReadiness(db).checks.warnings,
    blockers: getMarketingReadiness(db).checks.blockers,
    conflicts,
  };
}

function countEvents(db: DatabaseShape, predicate: (event: DbMarketingEvent) => boolean) {
  return db.marketingEvents.filter(predicate).length;
}

export function getMarketingReports(db: DatabaseShape) {
  const campaigns = db.marketingCampaigns.map((campaign) => {
    const events = db.marketingEvents.filter((event) => event.campaign_id === campaign.id);
    return {
      campaign_id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      status: campaign.status,
      views: events.filter((event) => event.event_type === "campaign_view").length,
      banner_clicks: events.filter((event) => event.event_type === "banner_click").length,
      whatsapp_clicks: events.filter((event) => event.event_type === "whatsapp_click").length,
      product_clicks: events.filter((event) => event.event_type === "product_click_from_campaign").length,
      checkout_starts: events.filter((event) => event.event_type === "checkout_started_from_campaign").length,
      orders: events.filter((event) => event.event_type === "order_created_from_campaign").length,
      total_events: events.length,
    };
  });
  return {
    generated_at: nowIso(),
    totals: {
      events: db.marketingEvents.length,
      campaign_views: countEvents(db, (event) => event.event_type === "campaign_view"),
      banner_clicks: countEvents(db, (event) => event.event_type === "banner_click"),
      whatsapp_clicks: countEvents(db, (event) => event.event_type === "whatsapp_click"),
      coupon_apply: countEvents(db, (event) => event.event_type === "coupon_apply"),
    },
    campaigns: campaigns.sort((a, b) => b.total_events - a.total_events),
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function getMarketingReportsCsv(db: DatabaseShape) {
  const report = getMarketingReports(db);
  const rows = [
    ["campaign_id", "name", "slug", "status", "views", "banner_clicks", "whatsapp_clicks", "product_clicks", "checkout_starts", "orders", "total_events"],
    ...report.campaigns.map((campaign) => [
      campaign.campaign_id,
      campaign.name,
      campaign.slug,
      campaign.status,
      campaign.views,
      campaign.banner_clicks,
      campaign.whatsapp_clicks,
      campaign.product_clicks,
      campaign.checkout_starts,
      campaign.orders,
      campaign.total_events,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(";")).join("\n");
}

export function resolveActiveTheme(db: DatabaseShape, reference = new Date()) {
  const activeThemes = db.ecommerceThemes
    .filter((theme) => isMarketingActive(theme, reference))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  return activeThemes[0] ?? db.ecommerceThemes.find((theme) => theme.type === "default" && theme.status === "active") ?? null;
}

export function resolveActiveCampaigns(db: DatabaseShape, reference = new Date()) {
  return db.marketingCampaigns
    .filter((campaign) => isMarketingActive(campaign, reference))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

type ResolvedShowcase = ReturnType<typeof resolveShowcaseProducts>;

function orderCampaignHomeShowcases(
  db: DatabaseShape,
  campaign: DbMarketingCampaign | null,
  showcases: ResolvedShowcase[],
) {
  const landing = getCampaignLandingForExperience(db, campaign?.id ?? null, campaign?.landing_page_id ?? null);
  const orderedIds = new Map<string, number>();
  const manualOrder = Array.isArray(campaign?.rules_json?.home_showcase_order)
    ? (campaign?.rules_json?.home_showcase_order as unknown[]).map((value) => String(value).trim()).filter(Boolean)
    : [];
  manualOrder.forEach((value, index) => orderedIds.set(value, index));
  (landing?.showcase_ids_json ?? []).forEach((id, index) => orderedIds.set(id, index));

  return showcases
    .filter((showcase) => showcase.placement === "home")
    .sort((a, b) => {
      const orderedA = orderedIds.get(a.id) ?? orderedIds.get(a.slug);
      const orderedB = orderedIds.get(b.id) ?? orderedIds.get(b.slug);
      if (orderedA !== undefined && orderedB !== undefined) return orderedA - orderedB;
      if (orderedA !== undefined) return -1;
      if (orderedB !== undefined) return 1;
      const aMatchesCampaign = campaign ? a.campaign_id === campaign.id : false;
      const bMatchesCampaign = campaign ? b.campaign_id === campaign.id : false;
      if (aMatchesCampaign !== bMatchesCampaign) return aMatchesCampaign ? -1 : 1;
      return b.priority - a.priority || a.name.localeCompare(b.name);
    });
}

function getCampaignLandingForExperience(db: DatabaseShape, campaignId: string | null, landingPageId: string | null) {
  if (landingPageId) {
    const byId = db.campaignLandingPages.find((entry) => entry.id === landingPageId);
    if (byId) return byId;
  }
  if (!campaignId) return null;
  return db.campaignLandingPages.find((entry) => entry.campaign_id === campaignId) ?? null;
}

function buildSiteExperience(
  db: DatabaseShape,
    input: {
    theme: DbEcommerceTheme | null;
    campaigns: DbMarketingCampaign[];
    banners: DbMarketingBanner[];
    showcases: ResolvedShowcase[];
    reference?: Date;
  },
) {
  const reference = input.reference ?? new Date();
  const primaryCampaign = input.campaigns[0] ?? null;
  const surfaceControls = getCampaignSurfaceControls(primaryCampaign);
  const homeHeroBanner = input.banners.find((banner) => banner.placement === "home") ?? input.banners[0] ?? null;
  const linkedLanding = getCampaignLandingForExperience(db, primaryCampaign?.id ?? null, primaryCampaign?.landing_page_id ?? null);
  const landing = surfaceControls.landing ? linkedLanding : null;
  const linkedCoupon = primaryCampaign?.coupon_id ? db.coupons.find((entry) => entry.id === primaryCampaign.coupon_id) ?? null : null;
  const coupon = surfaceControls.coupon ? linkedCoupon : null;
  const homeShowcases = surfaceControls.home_showcases ? orderCampaignHomeShowcases(db, primaryCampaign, input.showcases).slice(0, 3) : [];
  const categoryFocusIds = surfaceControls.category_focus ? primaryCampaign?.categories_json ?? [] : [];
  const categoryFocusNames = categoryFocusIds
    .map((categoryId) => db.categories.find((entry) => entry.id === categoryId)?.name ?? null)
    .filter(Boolean) as string[];
  const homeSlots = homeShowcases.map((showcase, index) => ({
    slot: index === 0 ? "primary" : index === 1 ? "secondary" : "tertiary",
    showcase_id: showcase.id,
    showcase_slug: showcase.slug,
    showcase_name: showcase.name,
    title: showcase.title || showcase.name,
    subtitle: showcase.subtitle || null,
    product_count: showcase.products?.length ?? 0,
    cta_url: landing ? `/campanhas/${landing.slug}` : primaryCampaign?.cta_url || "/produtos",
    cta_label: index === 0 ? primaryCampaign?.cta_label || "Ver campanha" : "Ver vitrine",
  }));

  const configuredSurfaces = [
    surfaceControls.top_bar && primaryCampaign?.headline ? "top_bar" : null,
    surfaceControls.hero && (homeHeroBanner?.desktop_image || primaryCampaign?.banner_desktop || primaryCampaign?.headline) ? "hero" : null,
    surfaceControls.home_showcases && homeSlots.length > 0 ? "home_showcases" : null,
    surfaceControls.landing && landing ? "landing" : null,
    surfaceControls.whatsapp && primaryCampaign?.whatsapp_message ? "whatsapp" : null,
    surfaceControls.coupon && coupon ? "coupon" : null,
    input.theme ? "theme" : null,
  ].filter(Boolean) as string[];

  const moldLevel = !primaryCampaign
    ? "default"
    : configuredSurfaces.length >= 6
      ? "full"
      : configuredSurfaces.length >= 4
        ? "guided"
        : "light";

  const publication =
    !primaryCampaign
      ? {
          live_state: "institutional" as const,
          live_label: "Sem campanha ativa",
          affects_site_now: false,
        }
      : (primaryCampaign.status === "active" || primaryCampaign.status === "scheduled") && isWithinPeriod(primaryCampaign, reference)
        ? {
            live_state: "live" as const,
            live_label: "Campanha publicada e moldando o site agora",
            affects_site_now: true,
          }
        : primaryCampaign.status === "scheduled"
          ? {
              live_state: "scheduled" as const,
              live_label: "Campanha programada, ainda sem afetar o site",
              affects_site_now: false,
            }
          : {
              live_state: "draft" as const,
              live_label: "Campanha em rascunho/revisao, sem afetar o site",
              affects_site_now: false,
            };

  return {
    mode: primaryCampaign ? "campaign" : "default",
    mold_level: moldLevel,
    active_campaign: primaryCampaign
      ? {
          id: primaryCampaign.id,
          slug: primaryCampaign.slug,
          name: primaryCampaign.name,
          headline: primaryCampaign.headline,
          subheadline: primaryCampaign.subheadline,
          cta_label: primaryCampaign.cta_label,
          cta_url: primaryCampaign.cta_url,
          whatsapp_message: primaryCampaign.whatsapp_message,
        }
      : null,
    active_theme: input.theme
      ? {
          id: input.theme.id,
          name: input.theme.name,
          slug: input.theme.slug,
          color_primary: input.theme.color_primary,
          color_secondary: input.theme.color_secondary,
          background_color: input.theme.background_color,
          text_color: input.theme.text_color,
        }
      : null,
    hero: {
      source: !surfaceControls.hero
        ? "copy_only"
        : homeHeroBanner?.desktop_image
          ? "banner"
          : primaryCampaign?.banner_desktop
            ? "campaign"
            : "copy_only",
      title: surfaceControls.hero ? homeHeroBanner?.title || primaryCampaign?.headline || primaryCampaign?.name || null : null,
      subtitle: surfaceControls.hero ? homeHeroBanner?.subtitle || primaryCampaign?.subheadline || null : null,
      desktop_image: surfaceControls.hero ? homeHeroBanner?.desktop_image || primaryCampaign?.banner_desktop || null : null,
      mobile_image: surfaceControls.hero ? homeHeroBanner?.mobile_image || primaryCampaign?.banner_mobile || null : null,
      cta_label: surfaceControls.hero ? homeHeroBanner?.cta_label || primaryCampaign?.cta_label || "Ver campanha" : "Ver campanha",
      cta_url: surfaceControls.hero ? homeHeroBanner?.cta_url || primaryCampaign?.cta_url || "/produtos" : "/produtos",
    },
    category_focus: {
      ids: categoryFocusIds,
      names: categoryFocusNames,
      enabled: categoryFocusIds.length > 0,
    },
    surface_controls: surfaceControls,
    publication,
    top_bar: primaryCampaign
      ? {
          enabled: surfaceControls.top_bar && Boolean(primaryCampaign.headline),
          text: surfaceControls.top_bar ? primaryCampaign.headline || null : null,
          cta_label: surfaceControls.top_bar ? primaryCampaign.cta_label || null : null,
          cta_url: surfaceControls.top_bar ? primaryCampaign.cta_url || null : null,
        }
      : {
          enabled: false,
          text: null,
          cta_label: null,
          cta_url: null,
        },
    home_slots: homeSlots,
    landing_page: landing
      ? {
          id: landing.id,
          slug: landing.slug,
          title: landing.title,
          has_hero_desktop: Boolean(landing.hero_desktop_image),
          has_hero_mobile: Boolean(landing.hero_mobile_image),
          showcase_count: landing.showcase_ids_json.length,
        }
      : null,
    coupon: coupon
      ? {
          id: coupon.id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
        }
      : null,
    configured_surfaces: configuredSurfaces,
    home_showcase_count: homeSlots.length,
    next_steps: primaryCampaign
      ? [
          surfaceControls.home_showcases && homeSlots.length === 0 ? "Vincular pelo menos uma vitrine ativa para a home da campanha." : null,
          surfaceControls.landing && !landing ? "Vincular uma landing page oficial para a campanha." : null,
          surfaceControls.hero && !primaryCampaign.banner_mobile && !homeHeroBanner?.mobile_image ? "Adicionar banner mobile para a experiencia da campanha." : null,
          surfaceControls.whatsapp && !primaryCampaign.whatsapp_message ? "Definir mensagem de WhatsApp da campanha para o time comercial." : null,
        ].filter(Boolean)
      : ["Nenhuma campanha ativa. O site segue com experiencia institucional padrao."],
  };
}

function canAffectSite(status: MarketingLifecycleStatus) {
  return status === "active" || status === "scheduled";
}

function periodsOverlap(
  a: { starts_at: string | null; ends_at: string | null },
  b: { starts_at: string | null; ends_at: string | null },
) {
  const aStart = a.starts_at ? Date.parse(a.starts_at) : Number.NEGATIVE_INFINITY;
  const aEnd = a.ends_at ? Date.parse(a.ends_at) : Number.POSITIVE_INFINITY;
  const bStart = b.starts_at ? Date.parse(b.starts_at) : Number.NEGATIVE_INFINITY;
  const bEnd = b.ends_at ? Date.parse(b.ends_at) : Number.POSITIVE_INFINITY;
  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value))) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function resolveConflictWinner<T extends { id: string; priority: number; name?: string }>(items: T[]) {
  return [...items].sort((a, b) => b.priority - a.priority || String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)))[0] ?? null;
}

export function findMarketingConflicts(db: DatabaseShape) {
  const activeByPlacement = db.marketingBanners
    .filter((banner) => isMarketingActive(banner))
    .reduce<Record<string, DbMarketingBanner[]>>((acc, banner) => {
      acc[banner.placement] = [...(acc[banner.placement] ?? []), banner];
      return acc;
    }, {});
  const bannerConflicts = Object.entries(activeByPlacement)
    .filter(([, banners]) => banners.length > 1)
    .map(([placement, banners]) => ({
      type: "banner_placement_conflict",
      placement,
      winner_id: resolveConflictWinner(banners)?.id ?? null,
      item_ids: banners.map((banner) => banner.id),
      severity: "warning",
      recommendation: "Revisar prioridade dos banners ativos no mesmo placement ou pausar o item secundario.",
    }));

  const uniqueSurfaceKeys = ["top_bar", "hero"] as const;
  const campaignCandidates = db.marketingCampaigns.filter((campaign) => canAffectSite(campaign.status));
  const campaignConflicts: Array<Record<string, unknown>> = [];
  for (let index = 0; index < campaignCandidates.length; index += 1) {
    const current = campaignCandidates[index];
    const currentSurfaces = getCampaignSurfaceControls(current);
    for (let nextIndex = index + 1; nextIndex < campaignCandidates.length; nextIndex += 1) {
      const next = campaignCandidates[nextIndex];
      if (!periodsOverlap(current, next)) continue;
      const nextSurfaces = getCampaignSurfaceControls(next);
      const sharedSurfaces = uniqueSurfaceKeys.filter((surface) => currentSurfaces[surface] && nextSurfaces[surface]);
      if (sharedSurfaces.length === 0) continue;
      const winner = resolveConflictWinner([current, next]);
      campaignConflicts.push({
        type: "campaign_surface_schedule_conflict",
        surfaces: sharedSurfaces,
        winner_id: winner?.id ?? null,
        item_ids: [current.id, next.id],
        severity: current.priority === next.priority ? "warning" : "info",
        recommendation:
          current.priority === next.priority
            ? "Definir prioridade diferente ou pausar uma das campanhas antes do periodo."
            : "Maior prioridade vence; confirmar se a campanha secundaria deve manter superficies unicas ligadas.",
      });
    }
  }

  return [...bannerConflicts, ...campaignConflicts];
}

export function getPublicMarketingState(db: DatabaseShape, reference = new Date()) {
  const theme = resolveActiveTheme(db, reference);
  const campaigns = resolveActiveCampaigns(db, reference);
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const themeIds = new Set([theme?.id].filter(Boolean) as string[]);
  const banners = db.marketingBanners
    .filter((banner) => isMarketingActive(banner, reference) && (!banner.campaign_id || campaignIds.has(banner.campaign_id)) && (!banner.theme_id || themeIds.has(banner.theme_id) || !banner.campaign_id))
    .sort((a, b) => b.priority - a.priority);
  const cards = db.marketingCards.filter((card) => isMarketingActive(card, reference)).sort((a, b) => b.priority - a.priority);
  const showcases = db.productShowcases
    .filter((showcase) => isMarketingActive(showcase, reference))
    .sort((a, b) => b.priority - a.priority)
    .map((showcase) => resolveShowcaseProducts(db, showcase));
  const siteExperience = buildSiteExperience(db, { theme, campaigns, banners, showcases, reference });
  return {
    theme,
    campaigns,
    banners,
    cards,
    showcases,
    site_experience: siteExperience,
    top_bar: campaigns[0]
      ? siteExperience.top_bar.enabled
        ? {
            campaign_id: campaigns[0].id,
            text: siteExperience.top_bar.text,
            cta_label: siteExperience.top_bar.cta_label,
            cta_url: siteExperience.top_bar.cta_url,
          }
        : null
      : null,
    fallback: !theme,
  };
}

export function getCampaignLandingPageBySlug(db: DatabaseShape, slug: string) {
  const page = db.campaignLandingPages.find((entry) => entry.slug === slug);
  if (!page) return null;
  const campaign = page.campaign_id ? db.marketingCampaigns.find((entry) => entry.id === page.campaign_id) ?? null : null;
  const theme = page.theme_id ? db.ecommerceThemes.find((entry) => entry.id === page.theme_id) ?? null : null;
  const active = page.status === "active" && isWithinPeriod(page);
  return {
    ...page,
    is_active_now: active,
    campaign,
    theme,
    banners: db.marketingBanners.filter((banner) => page.banner_ids_json.includes(banner.id) || banner.campaign_id === page.campaign_id),
    showcases: db.productShowcases
      .filter((showcase) => page.showcase_ids_json.includes(showcase.id) || showcase.campaign_id === page.campaign_id)
      .map((showcase) => resolveShowcaseProducts(db, showcase)),
  };
}

export function resolveShowcaseProducts(db: DatabaseShape, showcase: DbProductShowcase) {
  const isAvailable = (product: { is_active: boolean; stock: number; status_product?: string }) => product.is_active && product.stock > 0 && product.status_product !== "draft";
  let products = db.products.filter(isAvailable);
  if (showcase.type === "manual" && showcase.product_ids_json.length > 0) {
    const productIds = new Set(showcase.product_ids_json);
    products = db.products.filter((product) => productIds.has(product.id) && isAvailable(product));
  } else if (showcase.rule_type === "category" && showcase.category_ids_json.length > 0) {
    const categoryIds = new Set(showcase.category_ids_json);
    products = products.filter((product) => categoryIds.has(product.category_id ?? ""));
  } else if (showcase.rule_type === "newest") {
    products = products.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } else if (showcase.rule_type === "stock_high") {
    products = products.sort((a, b) => b.stock - a.stock);
  } else {
    products = products.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.stock - a.stock);
  }
  return {
    ...showcase,
    products: products.slice(0, Math.max(1, showcase.max_items)).map((product) => ({
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      price: product.price,
      promotional_price: product.promotional_price ?? null,
      image: product.image_url ?? product.images?.[0] ?? null,
      stock: product.stock,
    })),
  };
}

export function createOrUpdateMarketingAsset(
  db: DatabaseShape,
  body: Partial<DbMarketingAsset>,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
  id?: string,
) {
  if (!id && !isNonEmpty(body.name)) throw new Error("Nome do asset e obrigatorio.");
  if (!id && !isNonEmpty(body.url)) throw new Error("URL do asset e obrigatoria.");
  return createOrUpdateMarketingEntity(db, db.marketingAssets, body, "asset", context, id);
}

export function createOrUpdateMarketingCoupon(
  db: DatabaseShape,
  body: Partial<DbCoupon>,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
  id?: string,
) {
  const now = nowIso();
  const code = String(body.code || "").trim().toUpperCase();
  if (!id && !code) throw new Error("Codigo do cupom e obrigatorio.");
  if (!id && db.coupons.some((coupon) => coupon.code === code)) throw new Error("Ja existe cupom com este codigo.");
  if (body.discount_type && !["percentage", "fixed"].includes(body.discount_type)) throw new Error("Tipo de desconto invalido.");
  if (typeof body.discount_value === "number" && body.discount_value < 0) throw new Error("Desconto nao pode ser negativo.");
  if (body.discount_type === "percentage" && Number(body.discount_value) > 100) throw new Error("Cupom percentual nao pode passar de 100%.");
  const existing = id ? db.coupons.find((coupon) => coupon.id === id) : null;
  if (id && !existing) throw new Error("Cupom nao encontrado.");
  const dateError = assertDateRange(body.starts_at ?? existing?.starts_at ?? null, body.expires_at ?? existing?.expires_at ?? null);
  if (dateError) throw new Error(dateError);

  if (existing) {
    const previous = { ...existing };
    Object.assign(existing, body, {
      code: body.code ? code : existing.code,
      updated_by: context.actorId ?? existing.updated_by ?? null,
      updated_at: now,
    });
    auditMarketingMutation(db, {
      action: "marketing.coupon_updated",
      entity: "coupon",
      entityId: existing.id,
      previousValue: previous as Record<string, unknown>,
      nextValue: existing as unknown as Record<string, unknown>,
      ...context,
    });
    return existing;
  }

  const coupon: DbCoupon = {
    id: createId(),
    code,
    name: body.name ?? code,
    discount_type: body.discount_type ?? "percentage",
    discount_value: Number(body.discount_value ?? 0),
    min_order_value: body.min_order_value ?? null,
    max_discount_value: body.max_discount_value ?? null,
    description: body.description ?? null,
    is_active: body.is_active ?? false,
    starts_at: body.starts_at ?? null,
    expires_at: body.expires_at ?? null,
    max_uses: body.max_uses ?? null,
    usage_limit_per_customer: body.usage_limit_per_customer ?? null,
    used_count: 0,
    campaign_id: body.campaign_id ?? null,
    allowed_product_ids_json: Array.isArray(body.allowed_product_ids_json) ? body.allowed_product_ids_json.map(String) : [],
    allowed_category_ids_json: Array.isArray(body.allowed_category_ids_json) ? body.allowed_category_ids_json.map(String) : [],
    region_scope: body.region_scope ?? "regional",
    created_by: context.actorId ?? null,
    updated_by: context.actorId ?? null,
    created_at: now,
    updated_at: now,
  };
  db.coupons.unshift(coupon);
  auditMarketingMutation(db, {
    action: "marketing.coupon_created",
    entity: "coupon",
    entityId: coupon.id,
    nextValue: coupon as unknown as Record<string, unknown>,
    ...context,
  });
  return coupon;
}

export function createMarketingCampaign(
  db: DatabaseShape,
  body: Partial<DbMarketingCampaign>,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
) {
  if (!isNonEmpty(body.name)) throw new Error("Nome da campanha e obrigatorio.");
  const slug = normalizeSlug(body.slug || body.name || "");
  if (!slug) throw new Error("Slug da campanha e obrigatorio.");
  if (db.marketingCampaigns.some((campaign) => campaign.slug === slug)) throw new Error("Ja existe campanha com este slug.");
  const dateError = assertDateRange(body.starts_at ?? null, body.ends_at ?? null);
  if (dateError) throw new Error(dateError);
  const now = nowIso();
  const campaign: DbMarketingCampaign = {
    id: createId(),
    name: body.name!.trim(),
    slug,
    description: body.description ?? null,
    objective: body.objective ?? null,
    target_audience: body.target_audience ?? null,
    type: normalizeCampaignType(body.type),
    status: normalizeStatus(body.status),
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 10,
    starts_at: body.starts_at ?? null,
    ends_at: body.ends_at ?? null,
    timezone: body.timezone || "America/Fortaleza",
    theme_id: body.theme_id ?? null,
    landing_page_id: body.landing_page_id ?? null,
    coupon_id: body.coupon_id ?? null,
    region_scope: body.region_scope ?? "regional",
    region_description: body.region_description ?? null,
    headline: body.headline ?? body.name!.trim(),
    subheadline: body.subheadline ?? null,
    cta_label: body.cta_label ?? "Ver campanha",
    cta_url: body.cta_url ?? `/campanhas/${slug}`,
    whatsapp_message: body.whatsapp_message ?? `Ola, vim pelo site e quero saber mais sobre a campanha ${body.name!.trim()}.`,
    banner_desktop: body.banner_desktop ?? null,
    banner_mobile: body.banner_mobile ?? null,
    rules_json: body.rules_json ?? {},
    products_json: Array.isArray(body.products_json) ? body.products_json.map(String) : [],
    categories_json: Array.isArray(body.categories_json) ? body.categories_json.map(String) : [],
    metrics_json: body.metrics_json ?? {},
    created_by: context.actorId ?? null,
    updated_by: context.actorId ?? null,
    approved_by: null,
    published_at: body.status === "active" ? now : null,
    created_at: now,
    updated_at: now,
  };
  db.marketingCampaigns.unshift(campaign);
  auditMarketingMutation(db, { action: "marketing.campaign_created", entity: "marketing_campaign", entityId: campaign.id, nextValue: campaign as unknown as Record<string, unknown>, ...context });
  return campaign;
}

export function updateMarketingCampaign(
  db: DatabaseShape,
  id: string,
  body: Partial<DbMarketingCampaign>,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
) {
  const campaign = db.marketingCampaigns.find((entry) => entry.id === id);
  if (!campaign) throw new Error("Campanha nao encontrada.");
  const previous = { ...campaign };
  const nextSlug = body.slug ? normalizeSlug(body.slug) : campaign.slug;
  if (nextSlug !== campaign.slug && db.marketingCampaigns.some((entry) => entry.slug === nextSlug)) throw new Error("Ja existe campanha com este slug.");
  const dateError = assertDateRange(body.starts_at ?? campaign.starts_at, body.ends_at ?? campaign.ends_at);
  if (dateError) throw new Error(dateError);
  Object.assign(campaign, {
    ...body,
    slug: nextSlug,
    type: body.type ? normalizeCampaignType(body.type, campaign.type) : campaign.type,
    status: body.status ? normalizeStatus(body.status, campaign.status) : campaign.status,
    products_json: Array.isArray(body.products_json) ? body.products_json.map(String) : campaign.products_json,
    categories_json: Array.isArray(body.categories_json) ? body.categories_json.map(String) : campaign.categories_json,
    rules_json: body.rules_json && typeof body.rules_json === "object" ? body.rules_json : campaign.rules_json,
    updated_by: context.actorId ?? campaign.updated_by,
    updated_at: nowIso(),
  });
  auditMarketingMutation(db, {
    action: "marketing.campaign_updated",
    entity: "marketing_campaign",
    entityId: campaign.id,
    previousValue: previous as unknown as Record<string, unknown>,
    nextValue: campaign as unknown as Record<string, unknown>,
    ...context,
  });
  return campaign;
}

export function setMarketingCampaignStatus(
  db: DatabaseShape,
  id: string,
  status: MarketingLifecycleStatus,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
) {
  const campaign = db.marketingCampaigns.find((entry) => entry.id === id);
  if (!campaign) throw new Error("Campanha nao encontrada.");
  if (status === "active") {
    const readiness = getCampaignPublicationReadiness(db);
    const current = readiness.campaigns.find((item) => item.id === id);
    if (current && current.blockers > 0) {
      throw new Error(`Campanha bloqueada para ativacao: ${current.top_issues[0] || "mix vinculado com bloqueios de publicacao."}`);
    }
  }
  const previous = { status: campaign.status, published_at: campaign.published_at };
  campaign.status = normalizeStatus(status, campaign.status);
  campaign.updated_by = context.actorId ?? campaign.updated_by;
  campaign.updated_at = nowIso();
  if (campaign.status === "active" && !campaign.published_at) campaign.published_at = campaign.updated_at;
  auditMarketingMutation(db, {
    action: `marketing.campaign_${campaign.status}`,
    entity: "marketing_campaign",
    entityId: campaign.id,
    previousValue: previous,
    nextValue: { status: campaign.status, published_at: campaign.published_at },
    ...context,
  });
  return campaign;
}

export function duplicateMarketingCampaign(
  db: DatabaseShape,
  id: string,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
) {
  const campaign = db.marketingCampaigns.find((entry) => entry.id === id);
  if (!campaign) throw new Error("Campanha nao encontrada.");
  return createMarketingCampaign(
    db,
    {
      ...campaign,
      id: undefined,
      name: `${campaign.name} - copia`,
      slug: `${campaign.slug}-copia-${Date.now()}`,
      status: "draft",
      starts_at: null,
      ends_at: null,
      published_at: null,
    } as Partial<DbMarketingCampaign>,
    context,
  );
}

export function createOrUpdateMarketingEntity<T extends { id: string; name?: string; slug?: string; updated_at: string; created_at: string }>(
  db: DatabaseShape,
  collection: T[],
  body: Partial<T>,
  entityName: string,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
  id?: string,
) {
  const now = nowIso();
  if (id) {
    const current = collection.find((entry) => entry.id === id);
    if (!current) throw new Error(`${entityName} nao encontrado.`);
    const previous = { ...current };
    Object.assign(current, body, { updated_at: now });
    auditMarketingMutation(db, {
      action: `marketing.${entityName}_updated`,
      entity: entityName,
      entityId: current.id,
      previousValue: previous as Record<string, unknown>,
      nextValue: current as Record<string, unknown>,
      ...context,
    });
    return current;
  }
  const item = {
    ...body,
    id: createId(),
    slug: body.slug || (body.name ? normalizeSlug(String(body.name)) : createId()),
    created_at: now,
    updated_at: now,
  } as T;
  collection.unshift(item);
  auditMarketingMutation(db, {
    action: `marketing.${entityName}_created`,
    entity: entityName,
    entityId: item.id,
    nextValue: item as Record<string, unknown>,
    ...context,
  });
  return item;
}

export function saveIntegrationSecret(
  db: DatabaseShape,
  input: {
    providerKey: string;
    secretKey: string;
    value: string;
    environment?: "development" | "sandbox" | "production";
    actorId?: string | null;
    actorName?: string | null;
    correlationId?: string | null;
  },
) {
  const provider = db.integrationProviders.find((entry) => entry.key === input.providerKey);
  if (!provider) throw new Error("Provider de integracao nao encontrado.");
  if (!isNonEmpty(input.secretKey) || !isNonEmpty(input.value)) throw new Error("Chave e valor do secret sao obrigatorios.");
  const now = nowIso();
  const existing = db.integrationSecrets.find(
    (entry) => entry.provider_key === input.providerKey && entry.secret_key === input.secretKey && entry.environment === (input.environment ?? "sandbox") && entry.status === "active",
  );
  if (existing) {
    existing.status = "rotated";
    existing.rotated_at = now;
    existing.updated_by = input.actorId ?? existing.updated_by;
    existing.updated_at = now;
  }
  const secret: DbIntegrationSecret = {
    id: createId(),
    provider_key: input.providerKey,
    secret_key: input.secretKey,
    encrypted_value: encryptSecret(input.value),
    masked_value: maskSecret(input.value),
    environment: input.environment ?? "sandbox",
    status: "active",
    rotated_at: now,
    created_by: input.actorId ?? null,
    updated_by: input.actorId ?? null,
    created_at: now,
    updated_at: now,
  };
  db.integrationSecrets.unshift(secret);
  provider.masked_secrets_json = {
    ...(provider.masked_secrets_json ?? {}),
    [input.secretKey]: secret.masked_value,
  };
  provider.is_configured = true;
  if (provider.status !== "production") {
    provider.status = input.environment === "production" ? "sandbox" : "sandbox";
  }
  provider.updated_by = input.actorId ?? provider.updated_by;
  provider.updated_at = now;
  auditMarketingMutation(db, {
    action: "integration.secret_rotated",
    entity: "integration_secret",
    entityId: secret.id,
    nextValue: { provider_key: secret.provider_key, secret_key: secret.secret_key, masked_value: secret.masked_value, environment: secret.environment },
    actorId: input.actorId,
    actorName: input.actorName,
    correlationId: input.correlationId,
  });
  return sanitizeIntegrationSecret(secret);
}

export function requestIntegrationProductionActivation(
  db: DatabaseShape,
  input: {
    providerKey: string;
    publicConfig?: Record<string, unknown>;
    reason: string;
    actorId?: string | null;
    actorName?: string | null;
    correlationId?: string | null;
  },
) {
  const provider = db.integrationProviders.find((entry) => entry.key === input.providerKey);
  if (!provider) throw new Error("Provider de integracao nao encontrado.");
  if (provider.key === "fake-payment") throw new Error("Provider fake/local nao pode ser ativado em producao.");
  if (!isNonEmpty(input.reason) || input.reason.trim().length < 12) throw new Error("Informe uma justificativa operacional para solicitar producao.");

  const previousValue = { ...provider, public_config_json: { ...provider.public_config_json } };
  provider.public_config_json = {
    ...(provider.public_config_json ?? {}),
    ...(input.publicConfig ?? {}),
  };

  const checklist = buildIntegrationChecklist(provider, db.integrationSecrets);
  if (!checklist.ready_for_admin_configuration) {
    throw new Error(`Provider ainda possui pendencias: ${[...checklist.missing_secrets, ...checklist.missing_public_config].join(", ")}`);
  }

  const requestedAt = nowIso();
  provider.public_config_json = {
    ...provider.public_config_json,
    production_activation_pending: "true",
    production_activation_requires_dual_approval: "true",
    production_activation_reason: input.reason.trim(),
    production_activation_requested_by: input.actorId ?? null,
    production_activation_requested_by_name: input.actorName ?? null,
    production_activation_requested_at: requestedAt,
    production_activation_approved_by: null,
    production_activation_approved_at: null,
  };
  provider.status = "sandbox";
  provider.is_configured = true;
  provider.last_checked_at = requestedAt;
  provider.last_status_message = "Ativacao produtiva solicitada; aguardando segunda aprovacao.";
  provider.updated_by = input.actorId ?? provider.updated_by;
  provider.updated_at = requestedAt;

  auditMarketingMutation(db, {
    action: "integration.production_activation_requested",
    entity: "integration_provider",
    entityId: provider.id,
    previousValue,
    nextValue: {
      key: provider.key,
      status: provider.status,
      production_activation_pending: true,
      production_activation_requested_by: input.actorId ?? null,
      production_activation_requested_at: requestedAt,
    },
    actorId: input.actorId,
    actorName: input.actorName,
    correlationId: input.correlationId,
    metadata: { key: provider.key },
  });

  return sanitizeIntegrationProvider(provider, db.integrationSecrets);
}

export function approveIntegrationProductionActivation(
  db: DatabaseShape,
  input: {
    providerKey: string;
    actorId?: string | null;
    actorName?: string | null;
    correlationId?: string | null;
  },
) {
  const provider = db.integrationProviders.find((entry) => entry.key === input.providerKey);
  if (!provider) throw new Error("Provider de integracao nao encontrado.");
  if (provider.key === "fake-payment") throw new Error("Provider fake/local nao pode ser ativado em producao.");
  const requestedBy = provider.public_config_json?.production_activation_requested_by;
  const isPending = provider.public_config_json?.production_activation_pending === "true";
  if (!isPending) throw new Error("Nao existe solicitacao de ativacao produtiva pendente para este provider.");
  if (requestedBy && input.actorId && requestedBy === input.actorId) throw new Error("Aprovacao produtiva exige um segundo usuario autorizado.");

  const checklist = buildIntegrationChecklist(provider, db.integrationSecrets);
  if (!checklist.ready_for_admin_configuration) {
    throw new Error(`Provider ainda possui pendencias: ${[...checklist.missing_secrets, ...checklist.missing_public_config].join(", ")}`);
  }

  const previousValue = { ...provider, public_config_json: { ...provider.public_config_json } };
  const approvedAt = nowIso();
  provider.status = "production";
  provider.is_configured = true;
  provider.public_config_json = {
    ...(provider.public_config_json ?? {}),
    production_activation_pending: "false",
    production_activation_approved_by: input.actorId ?? null,
    production_activation_approved_by_name: input.actorName ?? null,
    production_activation_approved_at: approvedAt,
  };
  provider.last_checked_at = approvedAt;
  provider.last_status_message = "Provider aprovado para producao por segundo usuario autorizado.";
  provider.updated_by = input.actorId ?? provider.updated_by;
  provider.updated_at = approvedAt;

  auditMarketingMutation(db, {
    action: "integration.production_activation_approved",
    entity: "integration_provider",
    entityId: provider.id,
    previousValue,
    nextValue: {
      key: provider.key,
      status: provider.status,
      production_activation_pending: false,
      production_activation_approved_by: input.actorId ?? null,
      production_activation_approved_at: approvedAt,
    },
    actorId: input.actorId,
    actorName: input.actorName,
    correlationId: input.correlationId,
    metadata: { key: provider.key },
  });

  return sanitizeIntegrationProvider(provider, db.integrationSecrets);
}

export function testIntegrationProvider(
  db: DatabaseShape,
  providerKey: string,
  context: { actorId?: string | null; actorName?: string | null; correlationId?: string | null } = {},
) {
  const provider = db.integrationProviders.find((entry) => entry.key === providerKey);
  if (!provider) throw new Error("Provider de integracao nao encontrado.");
  const activeSecrets = db.integrationSecrets.filter((secret) => secret.provider_key === providerKey && secret.status === "active");
  provider.last_checked_at = nowIso();
  provider.last_status_message = provider.is_configured || activeSecrets.length > 0 ? "Teste local/sandbox registrado com sucesso." : "Provider ainda sem credencial configurada.";
  if (!provider.is_configured && activeSecrets.length === 0) provider.status = "pending";
  auditMarketingMutation(db, {
    action: provider.is_configured || activeSecrets.length > 0 ? "integration.connection_tested" : "integration.connection_test_pending",
    entity: "integration_provider",
    entityId: provider.id,
    nextValue: {
      key: provider.key,
      status: provider.status,
      is_configured: provider.is_configured,
      last_checked_at: provider.last_checked_at,
      last_status_message: provider.last_status_message,
    },
    ...context,
  });
  return sanitizeIntegrationProvider(provider, db.integrationSecrets);
}

export function listIntegrationProviders(db: DatabaseShape) {
  return db.integrationProviders.map((provider) => sanitizeIntegrationProvider(provider, db.integrationSecrets));
}

export function getIntegrationProviderDetail(db: DatabaseShape, providerKey: string) {
  const provider = db.integrationProviders.find((entry) => entry.key === providerKey);
  if (!provider) return null;
  const logs = db.auditLogs
    .filter((entry) => {
      const payload = entry.payload ?? {};
      const nextValue = entry.new_value ?? {};
      return (
        entry.event_type.startsWith("integration.") &&
        (payload.key === providerKey || payload.provider_key === providerKey || nextValue.provider_key === providerKey)
      );
    })
    .slice(0, 100);

  return {
    provider: sanitizeIntegrationProvider(provider, db.integrationSecrets),
    secrets: db.integrationSecrets
      .filter((secret) => secret.provider_key === providerKey)
      .map(sanitizeIntegrationSecret)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    logs,
  };
}

export function getIntegrationReadiness(db: DatabaseShape) {
  const providers = listIntegrationProviders(db);
  const blockers = providers
    .filter((provider) => provider.is_required_for_production && !provider.configuration_checklist.ready_for_production)
    .map((provider) => ({
      item: provider.key,
      detail: `${provider.name}: pendente para producao (${[
        ...provider.configuration_checklist.missing_secrets,
        ...provider.configuration_checklist.missing_public_config,
      ].join(", ") || "status ainda nao esta em producao/configurado"}).`,
    }));
  const warnings = providers
    .filter((provider) => !provider.is_required_for_production && !provider.configuration_checklist.ready_for_admin_configuration)
    .map((provider) => ({
      item: provider.key,
      detail: `${provider.name}: opcional/recomendado com configuracao pendente.`,
    }));
  const ok = providers
    .filter((provider) => provider.configuration_checklist.ready_for_admin_configuration)
    .map((provider) => ({
      item: provider.key,
      detail: `${provider.name}: configuracao administrativa minima preenchida ou nao exigida.`,
    }));

  return {
    ready: blockers.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
    checks: { ok, warnings, blockers },
    providers: providers.map((provider) => ({
      key: provider.key,
      name: provider.name,
      category: provider.category,
      status: provider.status,
      is_required_for_production: provider.is_required_for_production,
      ready_for_admin_configuration: provider.configuration_checklist.ready_for_admin_configuration,
      ready_for_production: provider.configuration_checklist.ready_for_production,
      missing_secrets: provider.configuration_checklist.missing_secrets,
      missing_public_config: provider.configuration_checklist.missing_public_config,
    })),
    next_steps:
      blockers.length === 0
        ? ["Manter testes de conexao e auditoria antes do go-live."]
        : ["Resolver providers obrigatorios na Central de Integracoes antes do go-live."],
  };
}

export function getMarketingReadiness(db: DatabaseShape) {
  const blockers: Array<{ item: string; detail: string }> = [];
  const warnings: Array<{ item: string; detail: string }> = [];
  if (!db.ecommerceThemes.some((theme) => theme.type === "default" && theme.status === "active")) {
    blockers.push({ item: "default_theme", detail: "Tema padrao ativo ausente." });
  }
  db.marketingCampaigns
    .filter((campaign) => campaign.status === "active")
    .forEach((campaign) => {
      const dateError = assertDateRange(campaign.starts_at, campaign.ends_at);
      if (dateError) blockers.push({ item: `campaign:${campaign.slug}`, detail: dateError });
      if (campaign.ends_at && Date.parse(campaign.ends_at) < Date.now()) blockers.push({ item: `campaign:${campaign.slug}`, detail: "Campanha vencida continua ativa." });
      if (!campaign.banner_mobile) warnings.push({ item: `campaign:${campaign.slug}:mobile_banner`, detail: "Campanha ativa sem banner mobile." });
      if (!campaign.cta_label || !campaign.cta_url) warnings.push({ item: `campaign:${campaign.slug}:cta`, detail: "Campanha ativa sem CTA completo." });
      if (!campaign.whatsapp_message) warnings.push({ item: `campaign:${campaign.slug}:whatsapp`, detail: "Campanha ativa sem mensagem de WhatsApp." });
      if (campaign.products_json.length === 0 && campaign.categories_json.length === 0) warnings.push({ item: `campaign:${campaign.slug}:assortment`, detail: "Campanha sem produtos ou categorias vinculadas." });
      if (campaign.coupon_id) {
        const coupon = db.coupons.find((entry) => entry.id === campaign.coupon_id);
        if (!coupon || !coupon.is_active) warnings.push({ item: `campaign:${campaign.slug}:coupon`, detail: "Cupom vinculado ausente ou inativo." });
        if (coupon?.expires_at && Date.parse(coupon.expires_at) < Date.now()) blockers.push({ item: `campaign:${campaign.slug}:coupon_expired`, detail: "Campanha ativa usa cupom expirado." });
      }
    });
  db.marketingBanners
    .filter((banner) => banner.status === "active")
    .forEach((banner) => {
      if (!banner.desktop_image && !banner.mobile_image) warnings.push({ item: `banner:${banner.slug}:image`, detail: "Banner ativo sem imagem desktop/mobile." });
      if (!banner.alt_text) warnings.push({ item: `banner:${banner.slug}:alt`, detail: "Banner ativo sem alt text." });
    });
  db.productShowcases
    .filter((showcase) => showcase.status === "active")
    .forEach((showcase) => {
      if (showcase.type === "manual" && showcase.product_ids_json.length === 0) warnings.push({ item: `showcase:${showcase.slug}:products`, detail: "Vitrine manual ativa sem produtos." });
      if (showcase.type === "automatic" && !showcase.rule_type) warnings.push({ item: `showcase:${showcase.slug}:rule`, detail: "Vitrine automatica ativa sem regra." });
    });
  db.campaignLandingPages
    .filter((page) => page.status === "active")
    .forEach((page) => {
      if (!page.seo_title || !page.seo_description) warnings.push({ item: `landing:${page.slug}:seo`, detail: "Landing page ativa sem SEO completo." });
    });
  return {
    ready: blockers.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
    checks: {
      ok: blockers.length === 0 ? [{ item: "marketing_base", detail: "Tema padrao e estruturas de marketing disponiveis." }] : [],
      warnings,
      blockers,
    },
    next_steps:
      blockers.length === 0
        ? ["Manter campanhas ativas com periodo, banner mobile e produtos/categorias revisados."]
        : ["Resolver blockers de marketing antes do go-live comercial."],
  };
}

export type CampaignPublicationReadinessReport = {
  generated_at: string;
  ready: boolean;
  blockers: number;
  warnings: number;
  summary: {
    active_campaigns: number;
    active_campaigns_blocked: number;
    active_campaigns_with_warnings: number;
    active_showcases_blocked: number;
    active_landing_pages_blocked: number;
    active_products_blocked: number;
    active_products_suspect: number;
    inactive_catalog_backlog: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    slug: string;
    status: MarketingLifecycleStatus;
    ready_for_activation: boolean;
    blockers: number;
    warnings: number;
    active_linked_products: number;
    linked_products: number;
    top_issues: string[];
  }>;
  showcases: Array<{
    id: string;
    name: string;
    slug: string;
    status: MarketingLifecycleStatus;
    ready_for_activation: boolean;
    blockers: number;
    warnings: number;
    eligible_products: number;
    top_issues: string[];
  }>;
  landing_pages: Array<{
    id: string;
    title: string;
    slug: string;
    status: MarketingLifecycleStatus;
    ready_for_activation: boolean;
    blockers: number;
    warnings: number;
    top_issues: string[];
  }>;
  next_steps: string[];
};

function resolveCampaignProducts(db: DatabaseShape, campaign: DbMarketingCampaign) {
  const directIds = new Set((campaign.products_json ?? []).map(String));
  const categoryIds = new Set((campaign.categories_json ?? []).map(String));
  return db.products.filter((product) => {
    if (directIds.has(product.id)) return true;
    if (product.category_id && categoryIds.has(product.category_id)) return true;
    return false;
  });
}

function getCampaignProductAssessment(
  product: DatabaseShape["products"][number],
  auditMap: Map<string, ReturnType<typeof auditCatalogImages>["items"][number]>,
) {
  const blockers = getProductPublicationIssues(product)
    .filter((issue) => issue.severity === "blocker")
    .map((issue) => issue.detail);
  const warnings: string[] = [];
  const audit = auditMap.get(product.id);
  if (audit?.audit_status === "critical") blockers.push("imagem critica para campanha");
  if (audit?.audit_status === "suspect" || audit?.audit_status === "manual_review") warnings.push("imagem requer revisao humana");
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

function resolveShowcaseSourceProducts(db: DatabaseShape, showcase: DbProductShowcase) {
  if (showcase.type === "manual" && showcase.product_ids_json.length > 0) {
    const ids = new Set(showcase.product_ids_json.map(String));
    return db.products.filter((product) => ids.has(product.id));
  }
  if (showcase.rule_type === "category" && showcase.category_ids_json.length > 0) {
    const categoryIds = new Set(showcase.category_ids_json.map(String));
    return db.products.filter((product) => product.category_id && categoryIds.has(product.category_id));
  }
  return db.products.filter((product) => product.is_active && product.status_product !== "inactive");
}

export function getCampaignPublicationReadiness(db: DatabaseShape): CampaignPublicationReadinessReport {
  const auditedProducts = auditCatalogImages(db.products.map((product) => withRelations(db, product))).items;
  const auditMap = new Map(auditedProducts.map((item) => [item.product_id, item]));
  const activeCampaigns = db.marketingCampaigns.filter((campaign) => campaign.status === "active");
  const campaignsForReview = db.marketingCampaigns.filter((campaign) => ["draft", "review", "scheduled", "active", "paused"].includes(campaign.status));
  const campaignRows = campaignsForReview.map((campaign) => {
    const surfaceControls = getCampaignSurfaceControls(campaign);
    const linkedProducts = resolveCampaignProducts(db, campaign);
    const activeLinkedProducts = linkedProducts.filter((product) => product.is_active && product.status_product !== "inactive");
    const blockerDetails = new Set<string>();
    const warningDetails = new Set<string>();
    const campaignLanding = getCampaignLandingForExperience(db, campaign.id, campaign.landing_page_id ?? null);
    const campaignHomeBanner = db.marketingBanners.find(
      (banner) => isMarketingActive(banner) && banner.placement === "home" && banner.campaign_id === campaign.id,
    );
    const activeResolvedShowcases = db.productShowcases.filter((showcase) => isMarketingActive(showcase)).map((showcase) => resolveShowcaseProducts(db, showcase));
    const campaignHomeShowcases = orderCampaignHomeShowcases(db, campaign, activeResolvedShowcases).filter(
      (showcase) => showcase.campaign_id === campaign.id || (campaignLanding?.showcase_ids_json ?? []).includes(showcase.id),
    );

    if (activeLinkedProducts.length === 0) {
      warningDetails.add("Campanha ativa sem produto ativo elegivel vinculado.");
    }

    for (const product of activeLinkedProducts) {
      for (const issue of getProductPublicationIssues(product)) {
        if (issue.severity === "blocker") blockerDetails.add(`${product.sku || product.id}: ${issue.detail}`);
      }
      const audit = auditMap.get(product.id);
      if (audit?.audit_status === "critical") blockerDetails.add(`${product.sku || product.id}: imagem critica para campanha.`);
      if (audit?.audit_status === "suspect" || audit?.audit_status === "manual_review") {
        warningDetails.add(`${product.sku || product.id}: imagem requer revisao humana antes da campanha.`);
      }
    }

    if (!campaign.cta_label || !campaign.cta_url) blockerDetails.add("campanha sem CTA principal completo");
    if (surfaceControls.hero && !campaign.banner_desktop && !campaign.banner_mobile && !campaignHomeBanner) blockerDetails.add("campanha sem hero visual");
    if (surfaceControls.home_showcases && campaignHomeShowcases.length === 0) blockerDetails.add("campanha sem faixa ativa na home");
    if (surfaceControls.landing && !campaignLanding) blockerDetails.add("campanha sem landing conectada");
    if (surfaceControls.hero && !campaign.banner_mobile) warningDetails.add("Campanha ativa sem banner mobile.");
    if (surfaceControls.whatsapp && !campaign.whatsapp_message) warningDetails.add("Campanha ativa sem mensagem de WhatsApp.");

    return {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      status: campaign.status,
      ready_for_activation: blockerDetails.size === 0,
      blockers: blockerDetails.size,
      warnings: warningDetails.size,
      active_linked_products: activeLinkedProducts.length,
      linked_products: linkedProducts.length,
      top_issues: [...blockerDetails, ...warningDetails].slice(0, 4),
    };
  });

  const activeProducts = db.products.filter((product) => product.is_active && product.status_product !== "inactive");
  const activeProductsBlocked = activeProducts.filter((product) => getProductPublicationIssues(product).length > 0).length;
  const activeProductsSuspect = activeProducts.filter((product) => {
    const audit = auditMap.get(product.id);
    return audit?.audit_status === "suspect" || audit?.audit_status === "manual_review";
  }).length;
  const inactiveCatalogBacklog = auditedProducts.filter((item) => !item.is_active && item.audit_status !== "ok").length;
  const showcaseRows = db.productShowcases
    .filter((showcase) => ["draft", "review", "scheduled", "active", "paused"].includes(showcase.status))
    .map((showcase) => {
      const products = resolveShowcaseSourceProducts(db, showcase).filter((product) => product.is_active && product.status_product !== "inactive");
      const assessed = products.map((product) => ({ product, assessment: getCampaignProductAssessment(product, auditMap) }));
      const eligibleProducts = assessed.filter((entry) => entry.assessment.ready).length;
      const blockers = new Set<string>();
      const warnings = new Set<string>();
      if (eligibleProducts === 0) blockers.add("vitrine sem produto elegivel para campanha");
      if (!showcase.title?.trim()) blockers.add("vitrine sem titulo");
      if (!showcase.cta_label || !showcase.cta_url) warnings.add("vitrine sem CTA completo");
      assessed.filter((entry) => !entry.assessment.ready).slice(0, 3).forEach((entry) => blockers.add(`${entry.product.sku || entry.product.id}: produto bloqueado para campanha`));
      assessed.filter((entry) => entry.assessment.warnings.length > 0).slice(0, 3).forEach((entry) => warnings.add(`${entry.product.sku || entry.product.id}: imagem em revisao humana`));
      return {
        id: showcase.id,
        name: showcase.name,
        slug: showcase.slug,
        status: showcase.status,
        ready_for_activation: blockers.size === 0,
        blockers: blockers.size,
        warnings: warnings.size,
        eligible_products: eligibleProducts,
        top_issues: [...blockers, ...warnings].slice(0, 4),
      };
    });

  const showcaseMap = new Map(showcaseRows.map((row) => [row.id, row]));
  const landingRows = db.campaignLandingPages
    .filter((page) => ["draft", "review", "scheduled", "active", "paused"].includes(page.status))
    .map((page) => {
      const blockers = new Set<string>();
      const warnings = new Set<string>();
      if (!page.hero_desktop_image && !page.hero_mobile_image) blockers.add("landing sem hero desktop/mobile");
      if (!page.seo_title || !page.seo_description) warnings.add("landing sem SEO completo");
      if ((page.showcase_ids_json?.length ?? 0) === 0 && !page.campaign_id) blockers.add("landing sem showcase vinculado ou campanha relacionada");
      for (const showcaseId of page.showcase_ids_json ?? []) {
        const showcase = showcaseMap.get(showcaseId);
        if (showcase && !showcase.ready_for_activation) blockers.add(`showcase ${showcase.slug} bloqueado para ativacao`);
      }
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        ready_for_activation: blockers.size === 0,
        blockers: blockers.size,
        warnings: warnings.size,
        top_issues: [...blockers, ...warnings].slice(0, 4),
      };
    });

  const blockers = campaignRows.reduce((sum, item) => sum + item.blockers, 0) + showcaseRows.reduce((sum, item) => sum + item.blockers, 0) + landingRows.reduce((sum, item) => sum + item.blockers, 0);
  const warnings = campaignRows.reduce((sum, item) => sum + item.warnings, 0) + showcaseRows.reduce((sum, item) => sum + item.warnings, 0) + landingRows.reduce((sum, item) => sum + item.warnings, 0);

  return {
    generated_at: nowIso(),
    ready: blockers === 0,
    blockers,
    warnings,
    summary: {
      active_campaigns: activeCampaigns.length,
      active_campaigns_blocked: campaignRows.filter((item) => {
        const campaign = activeCampaigns.find((entry) => entry.id === item.id);
        return Boolean(campaign) && item.blockers > 0;
      }).length,
      active_campaigns_with_warnings: campaignRows.filter((item) => {
        const campaign = activeCampaigns.find((entry) => entry.id === item.id);
        return Boolean(campaign) && item.warnings > 0;
      }).length,
      active_showcases_blocked: showcaseRows.filter((item) => item.status === "active" && item.blockers > 0).length,
      active_landing_pages_blocked: landingRows.filter((item) => item.status === "active" && item.blockers > 0).length,
      active_products_blocked: activeProductsBlocked,
      active_products_suspect: activeProductsSuspect,
      inactive_catalog_backlog: inactiveCatalogBacklog,
    },
    campaigns: campaignRows,
    showcases: showcaseRows,
    landing_pages: landingRows,
    next_steps:
      blockers > 0
        ? [
            "Corrigir produtos ativos com bloqueio comercial ou visual antes de ativar campanha.",
            "Nao ativar showcases ou landing pages sem mix elegivel e hero/SEO minimo.",
            "Revisar imagens suspeitas do mix ativo e confirmar CTA/banner mobile.",
          ]
        : warnings > 0
          ? ["Tratar warnings de banner mobile, CTA e imagem suspeita antes da campanha de maior alcance."]
          : ["Campanhas ativas sem bloqueios objetivos no mix vinculado."],
  };
}

export function createMarketingEvent(db: DatabaseShape, body: Partial<DbMarketingEvent>) {
  const event: DbMarketingEvent = {
    id: createId(),
    event_type: String(body.event_type || "campaign_view"),
    campaign_id: body.campaign_id ?? null,
    theme_id: body.theme_id ?? null,
    banner_id: body.banner_id ?? null,
    showcase_id: body.showcase_id ?? null,
    product_id: body.product_id ?? null,
    source_path: body.source_path ?? null,
    metadata_json: body.metadata_json ?? {},
    created_at: nowIso(),
  };
  db.marketingEvents.unshift(event);
  return event;
}
