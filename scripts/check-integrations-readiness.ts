import { appConfig, isProductionLike } from "../server/config.ts";

type Check = {
  status: "ok" | "warning" | "blocker";
  item: string;
  detail: string;
};

const checks: Check[] = [];

function push(status: Check["status"], item: string, detail: string) {
  checks.push({ status, item, detail });
}

function has(value: string | undefined) {
  return typeof value === "string" && value.trim() !== "" && !/^__SET_/i.test(value.trim());
}

const paymentReady =
  appConfig.paymentProvider === "mercadopago" &&
  has(process.env.MERCADOPAGO_ACCESS_TOKEN) &&
  has(process.env.MERCADOPAGO_WEBHOOK_SECRET) &&
  has(process.env.MERCADOPAGO_WEBHOOK_URL);

if (appConfig.paymentProvider !== "mercadopago") push("blocker", "payment_provider", "PAYMENT_PROVIDER ainda nao esta em mercadopago.");
else push("ok", "payment_provider", "PAYMENT_PROVIDER configurado para mercadopago.");

if (!has(process.env.MERCADOPAGO_ACCESS_TOKEN)) push("blocker", "mercadopago_access_token", "MERCADOPAGO_ACCESS_TOKEN ausente.");
else push("ok", "mercadopago_access_token", "MERCADOPAGO_ACCESS_TOKEN configurado.");

if (!has(process.env.MERCADOPAGO_WEBHOOK_SECRET)) push("blocker", "mercadopago_webhook_secret", "MERCADOPAGO_WEBHOOK_SECRET ausente.");
else push("ok", "mercadopago_webhook_secret", "MERCADOPAGO_WEBHOOK_SECRET configurado.");

if (!has(process.env.MERCADOPAGO_WEBHOOK_URL)) push("blocker", "mercadopago_webhook_url", "MERCADOPAGO_WEBHOOK_URL ausente.");
else push("ok", "mercadopago_webhook_url", "MERCADOPAGO_WEBHOOK_URL configurado.");

const realFreightProviders = new Set(["melhor-envio", "correios", "frenet", "frete-barato", "fretebarato", "cepcerto"]);
const freightProviderReal = realFreightProviders.has(appConfig.freightProvider);
const freightOrigin =
  has(process.env.FREIGHT_ORIGIN_CEP) ||
  has(process.env.MELHOR_ENVIO_ORIGIN_ZIP) ||
  has(process.env.CORREIOS_ORIGIN_ZIP) ||
  has(process.env.FRENET_ORIGIN_ZIP) ||
  has(process.env.CEPCERTO_ORIGIN_ZIP);
const freightToken =
  has(process.env.FREIGHT_API_KEY) ||
  has(process.env.MELHOR_ENVIO_TOKEN) ||
  has(process.env.CORREIOS_TOKEN) ||
  has(process.env.FRENET_TOKEN) ||
  has(process.env.FRETE_BARATO_TOKEN) ||
  has(process.env.CEPCERTO_TOKEN);
const freightReady = freightProviderReal && freightOrigin && freightToken;

if (!freightProviderReal) push("blocker", "freight_provider", "FREIGHT_PROVIDER ainda esta em fallback/local ou provider nao homologavel.");
else push("ok", "freight_provider", `FREIGHT_PROVIDER configurado para ${appConfig.freightProvider}.`);

if (!freightOrigin) push("blocker", "freight_origin", "Origem de frete ausente.");
else push("ok", "freight_origin", "Origem de frete configurada.");

if (!freightToken) push("blocker", "freight_token", "Token/API key de frete ausente.");
else push("ok", "freight_token", "Token/API key de frete configurado.");

const emailReady = appConfig.emailProvider !== "log" && (has(process.env.EMAIL_API_KEY) || has(process.env.RESEND_API_KEY) || has(process.env.EMAIL_SMTP_PASSWORD));
if (!emailReady) push("warning", "email_provider", "Email ainda em modo log ou sem credencial real.");
else push("ok", "email_provider", `EMAIL_PROVIDER configurado como ${appConfig.emailProvider}.`);

const analyticsReady = appConfig.analyticsProvider !== "none" && (has(process.env.ANALYTICS_ID) || has(process.env.GA4_MEASUREMENT_ID) || has(process.env.TAG_MANAGER_ID));
if (!analyticsReady) push("warning", "analytics_provider", "Analytics ausente ou desativado.");
else push("ok", "analytics_provider", `ANALYTICS_PROVIDER configurado como ${appConfig.analyticsProvider}.`);

const storageReady = appConfig.storageProvider !== "local" && has(process.env.STORAGE_BUCKET);
if (!storageReady) push("warning", "storage_provider", "Storage/CDN ainda local ou sem bucket.");
else push("ok", "storage_provider", `STORAGE_PROVIDER configurado como ${appConfig.storageProvider}.`);

if (!has(process.env.METRICS_TOKEN)) push(isProductionLike() ? "blocker" : "warning", "metrics_token", "METRICS_TOKEN ausente.");
else push("ok", "metrics_token", "METRICS_TOKEN configurado.");

if (!appConfig.secureCookies) push(isProductionLike() ? "blocker" : "warning", "secure_cookies", "SECURE_COOKIES desativado.");
else push("ok", "secure_cookies", "SECURE_COOKIES ativo.");

if (!appConfig.trustProxy) push(isProductionLike() ? "blocker" : "warning", "trust_proxy", "TRUST_PROXY desativado.");
else push("ok", "trust_proxy", "TRUST_PROXY ativo.");

if (isProductionLike() && !appConfig.appBaseUrl.startsWith("https://")) push("blocker", "https", "APP_BASE_URL produtivo precisa ser HTTPS.");
else if (!appConfig.appBaseUrl.startsWith("https://")) push("warning", "https", "APP_BASE_URL ainda nao esta em HTTPS.");
else push("ok", "https", "APP_BASE_URL em HTTPS.");

const blockers = checks.filter((check) => check.status === "blocker");
const warnings = checks.filter((check) => check.status === "warning");

const report = {
  generated_at: new Date().toISOString(),
  PHASE2_READY: blockers.length === 0,
  PAYMENT_READY: paymentReady,
  FREIGHT_READY: freightReady,
  EMAIL_READY: emailReady,
  ANALYTICS_READY: analyticsReady,
  STORAGE_READY: storageReady,
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  blockers: blockers.length,
  warnings: warnings.length,
  checks: {
    ok: checks.filter((check) => check.status === "ok"),
    warnings,
    blockers,
  },
};

console.log(JSON.stringify(report, null, 2));

if (!report.PHASE2_READY) {
  process.exitCode = 1;
}
