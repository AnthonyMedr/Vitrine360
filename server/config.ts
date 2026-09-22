import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile();

function parseBoolean(value: string | undefined, fallback = false) {
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeConfigValue(value: string | undefined) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^__SET_IN_[A-Z0-9_]+__$/.test(trimmed)) return "";
  if (trimmed === "..." || /^[a-z][a-z0-9+.-]*:\/\/\.{3}(?:$|\/)/i.test(trimmed)) return "";
  if (/^troque-/i.test(trimmed)) return "";
  return trimmed;
}

function parseList(value: string | undefined, fallback: string[] = []) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function appendOriginVariants(target: Set<string>, value: string | undefined) {
  const normalized = normalizeOrigin(value);
  if (!normalized) return;
  target.add(normalized);

  const url = new URL(normalized);
  const isIpHost = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (url.hostname === "localhost" || isIpHost) return;

  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
    target.add(url.origin.toLowerCase());
    return;
  }

  url.hostname = `www.${url.hostname}`;
  target.add(url.origin.toLowerCase());
}

function buildCorsOrigins() {
  const origins = new Set<string>([
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:8081",
    "http://localhost:8081",
    "http://127.0.0.1:8082",
    "http://localhost:8082",
    "http://127.0.0.1:8083",
    "http://localhost:8083",
  ]);

  appendOriginVariants(origins, process.env.APP_BASE_URL);
  parseList(process.env.CORS_ALLOWED_ORIGINS).forEach((origin) => appendOriginVariants(origins, origin));

  return [...origins];
}

export const appConfig = {
  env: process.env.APP_ENV || process.env.NODE_ENV || "development",
  homologationOnly: parseBoolean(process.env.HOMOLOGATION_ONLY, false),
  apiPort: Number(process.env.API_PORT || 3001),
  appBaseUrl: normalizeConfigValue(process.env.APP_BASE_URL) || "http://127.0.0.1:5173",
  apiBaseUrl: normalizeConfigValue(process.env.API_BASE_URL) || normalizeConfigValue(process.env.APP_BASE_URL) || "http://127.0.0.1:3001",
  dataDir: process.env.DATA_DIR || "",
  corsOrigins: buildCorsOrigins(),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  secureCookies: parseBoolean(process.env.SECURE_COOKIES, false),
  securityHeadersEnabled: parseBoolean(process.env.ENABLE_SECURITY_HEADERS, true),
  dbProvider: process.env.DB_PROVIDER || "sqlite",
  databaseUrl: normalizeConfigValue(process.env.DATABASE_URL),
  paymentProvider: process.env.PAYMENT_PROVIDER || "manual",
  freightProvider: process.env.FREIGHT_PROVIDER || "local-rules",
  fiscalProvider: process.env.FISCAL_PROVIDER || "manual",
  erpProvider: process.env.ERP_PROVIDER || "none",
  emailProvider: process.env.EMAIL_PROVIDER || "log",
  analyticsProvider: process.env.ANALYTICS_PROVIDER || "none",
  storageProvider: process.env.STORAGE_PROVIDER || "local",
  metricsToken: normalizeConfigValue(process.env.METRICS_TOKEN),
  queueProvider: process.env.QUEUE_PROVIDER || "auto",
  ai: {
    enabled: parseBoolean(process.env.AI_ENABLED, false),
    maxDailyCalls: Number(process.env.AI_MAX_DAILY_CALLS || 200),
    maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS || 6000),
    cacheTtlDays: Number(process.env.AI_CACHE_TTL_DAYS || 30),
    batchMaxItems: Number(process.env.AI_BATCH_MAX_ITEMS || 12),
  },
  openai: {
    apiKey: normalizeConfigValue(process.env.OPENAI_API_KEY),
    fiscalModel: normalizeConfigValue(process.env.OPENAI_FISCAL_MODEL) || "gpt-5.2",
    baseUrl: normalizeConfigValue(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
    requestTimeoutMs: Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 20_000),
  },
  auth: {
    otpMinutes: Number(process.env.AUTH_OTP_TTL_MINUTES || 10),
    sessionDays: Number(process.env.AUTH_SESSION_DAYS || 7),
    passwordMinLength: Number(process.env.AUTH_PASSWORD_MIN_LENGTH || 8),
    rateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 1000 * 60 * 10),
    rateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
    csrfCookieName: process.env.AUTH_CSRF_COOKIE_NAME || "gamel_csrf",
    csrfHeaderName: process.env.AUTH_CSRF_HEADER_NAME || "x-csrf-token",
    csrfSecret: normalizeConfigValue(process.env.AUTH_CSRF_SECRET) || normalizeConfigValue(process.env.APP_SECRET) || "gamel-dev-csrf-secret",
    publicSignupEnabled: parseBoolean(process.env.AUTH_PUBLIC_SIGNUP_ENABLED, false),
  },
  rateLimit: {
    enabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    publicCatalogWindowMs: Number(process.env.PUBLIC_CATALOG_RATE_LIMIT_WINDOW_MS || 60_000),
    publicCatalogMax: Number(process.env.PUBLIC_CATALOG_RATE_LIMIT_MAX || 240),
    quoteWindowMs: Number(process.env.QUOTE_RATE_LIMIT_WINDOW_MS || 60_000),
    quoteMax: Number(process.env.QUOTE_RATE_LIMIT_MAX || 12),
    adminWindowMs: Number(process.env.ADMIN_API_RATE_LIMIT_WINDOW_MS || 60_000),
    adminMax: Number(process.env.ADMIN_API_RATE_LIMIT_MAX || 600),
    quoteDedupeWindowMs: Number(process.env.QUOTE_DEDUPE_WINDOW_MS || 5 * 60_000),
  },
  mercadopago: {
    accessToken: normalizeConfigValue(process.env.MERCADOPAGO_ACCESS_TOKEN),
    webhookSecret: normalizeConfigValue(process.env.MERCADOPAGO_WEBHOOK_SECRET),
    checkoutBaseUrl: process.env.MERCADOPAGO_CHECKOUT_BASE_URL || "https://api.mercadopago.com",
    requestTimeoutMs: Number(process.env.MERCADOPAGO_REQUEST_TIMEOUT_MS || 12_000),
    successUrl: normalizeConfigValue(process.env.PAYMENT_SUCCESS_URL),
    failureUrl: normalizeConfigValue(process.env.PAYMENT_FAILURE_URL),
    pendingUrl: normalizeConfigValue(process.env.PAYMENT_PENDING_URL),
  },
  fakePayment: {
    status: normalizeConfigValue(process.env.FAKE_PAYMENT_STATUS) || "pending",
    latencyMs: Number(process.env.FAKE_PAYMENT_LATENCY_MS || 0),
  },
  melhorEnvio: {
    token: normalizeConfigValue(process.env.MELHOR_ENVIO_TOKEN),
    originZipCode: normalizeConfigValue(process.env.MELHOR_ENVIO_ORIGIN_ZIP).replace(/\D/g, ""),
    env: (normalizeConfigValue(process.env.MELHOR_ENVIO_ENV) || (parseBoolean(process.env.MELHOR_ENVIO_SANDBOX, true) ? "sandbox" : "production")).toLowerCase(),
    sandbox: (normalizeConfigValue(process.env.MELHOR_ENVIO_ENV) || "").toLowerCase()
      ? (normalizeConfigValue(process.env.MELHOR_ENVIO_ENV) || "").toLowerCase() !== "production"
      : parseBoolean(process.env.MELHOR_ENVIO_SANDBOX, true),
    appName: process.env.MELHOR_ENVIO_APP_NAME || "GamelMetal",
    contactEmail: process.env.MELHOR_ENVIO_CONTACT_EMAIL || "contato@gamelmetal.com",
    requestTimeoutMs: Number(process.env.MELHOR_ENVIO_REQUEST_TIMEOUT_MS || 12_000),
  },
  frenet: {
    token: normalizeConfigValue(process.env.FRENET_TOKEN),
    originZipCode: normalizeConfigValue(process.env.FRENET_ORIGIN_ZIP).replace(/\D/g, ""),
    quoteUrl: normalizeConfigValue(process.env.FRENET_QUOTE_URL) || "https://api.frenet.com.br/shipping/quote",
    requestTimeoutMs: Number(process.env.FRENET_REQUEST_TIMEOUT_MS || 12_000),
  },
  freteBarato: {
    token: normalizeConfigValue(process.env.FRETE_BARATO_TOKEN),
    customerId: normalizeConfigValue(process.env.FRETE_BARATO_CUSTOMER_ID),
    platform: normalizeConfigValue(process.env.FRETE_BARATO_PLATFORM) || "lojaintegrada",
    baseUrl: normalizeConfigValue(process.env.FRETE_BARATO_BASE_URL) || "https://admin.fretebarato.com",
    requestTimeoutMs: Number(process.env.FRETE_BARATO_REQUEST_TIMEOUT_MS || 12_000),
  },
  cepCerto: {
    token: normalizeConfigValue(process.env.CEPCERTO_TOKEN || process.env.CEPCERTO_KEY),
    originZipCode: normalizeConfigValue(process.env.CEPCERTO_ORIGIN_ZIP).replace(/\D/g, ""),
    baseUrl: normalizeConfigValue(process.env.CEPCERTO_BASE_URL) || "https://cepcerto.com/ws/json-frete-opcional",
    requestTimeoutMs: Number(process.env.CEPCERTO_REQUEST_TIMEOUT_MS || 12_000),
  },
  correios: {
    token: normalizeConfigValue(process.env.CORREIOS_TOKEN || process.env.CORREIOS_ACCESS_TOKEN),
    originZipCode: normalizeConfigValue(process.env.CORREIOS_ORIGIN_ZIP).replace(/\D/g, ""),
    env: (normalizeConfigValue(process.env.CORREIOS_ENV) || "sandbox").toLowerCase(),
    services: parseList(process.env.CORREIOS_SERVICES, ["03220:SEDEX", "03298:PAC"]).map((entry) => {
      const [code, name] = entry.split(":").map((part) => part.trim());
      return { code, name: name || code };
    }).filter((service) => service.code),
    precoBaseUrl:
      normalizeConfigValue(process.env.CORREIOS_PRECO_BASE_URL)
      || ((normalizeConfigValue(process.env.CORREIOS_ENV) || "sandbox").toLowerCase() === "production"
        ? "https://api.correios.com.br/preco/v1"
        : "https://apihom.correios.com.br/preco/v1"),
    prazoBaseUrl:
      normalizeConfigValue(process.env.CORREIOS_PRAZO_BASE_URL)
      || ((normalizeConfigValue(process.env.CORREIOS_ENV) || "sandbox").toLowerCase() === "production"
        ? "https://api.correios.com.br/prazo/v1"
        : "https://apihom.correios.com.br/prazo/v1"),
    requestTimeoutMs: Number(process.env.CORREIOS_REQUEST_TIMEOUT_MS || 12_000),
  },
  fakeFreight: {
    price: Number(process.env.FAKE_FREIGHT_PRICE || 29.9),
    estimatedDays: normalizeConfigValue(process.env.FAKE_FREIGHT_ESTIMATED_DAYS) || "3",
    fail: parseBoolean(process.env.FAKE_FREIGHT_FAIL, false),
  },
  fiscal: {
    apiUrl: normalizeConfigValue(process.env.FISCAL_API_URL),
    apiToken: normalizeConfigValue(process.env.FISCAL_API_TOKEN),
    companyCnpj: cleanDigits(normalizeConfigValue(process.env.FISCAL_COMPANY_CNPJ)),
    env: normalizeConfigValue(process.env.FISCAL_ENV) || "sandbox",
    requestTimeoutMs: Number(process.env.FISCAL_REQUEST_TIMEOUT_MS || 12_000),
  },
  erp: {
    apiUrl: normalizeConfigValue(process.env.ERP_API_URL),
    apiToken: normalizeConfigValue(process.env.ERP_API_TOKEN),
    syncEnabled: parseBoolean(process.env.ERP_SYNC_ENABLED, false),
    requestTimeoutMs: Number(process.env.ERP_REQUEST_TIMEOUT_MS || 12_000),
  },
  resend: {
    apiKey: normalizeConfigValue(process.env.RESEND_API_KEY),
    from: process.env.RESEND_FROM || "GAMEL Metal <nao-responda@gamelmetal.com>",
    replyTo: process.env.RESEND_REPLY_TO || "contato@gamelmetal.com",
    baseUrl: process.env.RESEND_BASE_URL || "https://api.resend.com",
  },
  ga4: {
    measurementId: normalizeConfigValue(process.env.GA4_MEASUREMENT_ID),
    apiSecret: normalizeConfigValue(process.env.GA4_API_SECRET),
    endpoint: process.env.GA4_ENDPOINT || "https://www.google-analytics.com/mp/collect",
  },
  storage: {
    publicBaseUrl: normalizeConfigValue(process.env.STORAGE_PUBLIC_BASE_URL),
    bucket: normalizeConfigValue(process.env.STORAGE_BUCKET),
    region: normalizeConfigValue(process.env.STORAGE_REGION) || "us-east-1",
    endpoint: normalizeConfigValue(process.env.STORAGE_ENDPOINT || process.env.S3_ENDPOINT),
    accessKeyId: normalizeConfigValue(process.env.STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: normalizeConfigValue(process.env.STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY),
    forcePathStyle: parseBoolean(process.env.STORAGE_FORCE_PATH_STYLE || process.env.S3_FORCE_PATH_STYLE, false),
    autoCreateBucket: parseBoolean(process.env.STORAGE_AUTO_CREATE_BUCKET, false),
    uploadMaxBytes: Number(process.env.STORAGE_UPLOAD_MAX_BYTES || 5 * 1024 * 1024),
  },
  postgres: {
    ssl: process.env.POSTGRES_SSL
      ? parseBoolean(process.env.POSTGRES_SSL, false)
      : (process.env.APP_ENV || process.env.NODE_ENV) === "production",
    sslRejectUnauthorized: parseBoolean(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED, true),
    maxConnections: Number(process.env.POSTGRES_MAX_CONNECTIONS || 10),
    idleTimeoutMs: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 10_000),
    connectionTimeoutMs: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 5_000),
    transactionMaxWaitMs: Number(process.env.POSTGRES_TRANSACTION_MAX_WAIT_MS || 10_000),
    transactionTimeoutMs: Number(process.env.POSTGRES_TRANSACTION_TIMEOUT_MS || 60_000),
  },
  redis: {
    url: normalizeConfigValue(process.env.REDIS_URL) || normalizeConfigValue(process.env.RATE_LIMIT_REDIS_URL),
    rateLimitPrefix: process.env.REDIS_RATE_LIMIT_PREFIX || "gamel:rate-limit",
    queuePrefix: process.env.REDIS_QUEUE_PREFIX || "gamel:queue",
  },
};

export function isProductionLike() {
  return appConfig.env === "production";
}

function hasValidServiceUrl(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function getProductionConfigurationIssues() {
  if (!isProductionLike()) return [];
  const issues: string[] = [];
  if (appConfig.dbProvider !== "postgres") issues.push("DB_PROVIDER deve ser postgres");
  if (!hasValidServiceUrl(appConfig.databaseUrl, ["postgres:", "postgresql:"])) issues.push("DATABASE_URL deve ser uma URL PostgreSQL valida");
  if (appConfig.queueProvider !== "redis") issues.push("QUEUE_PROVIDER deve ser redis");
  if (!hasValidServiceUrl(appConfig.redis.url, ["redis:", "rediss:"])) issues.push("REDIS_URL deve ser uma URL Redis valida");
  if (!appConfig.secureCookies && appConfig.appBaseUrl.startsWith("https://")) issues.push("SECURE_COOKIES deve ser true sob HTTPS");

  const appSecret = normalizeConfigValue(process.env.APP_SECRET);
  const csrfSecret = normalizeConfigValue(process.env.AUTH_CSRF_SECRET);
  const integrationSecretsKey = normalizeConfigValue(process.env.INTEGRATION_SECRETS_KEY);
  if (appSecret.length < 32) issues.push("APP_SECRET deve ter pelo menos 32 caracteres");
  if (csrfSecret.length < 32) issues.push("AUTH_CSRF_SECRET deve ter pelo menos 32 caracteres");
  if (integrationSecretsKey.length < 32) issues.push("INTEGRATION_SECRETS_KEY deve ter pelo menos 32 caracteres");

  if (!['s3', 'minio'].includes(appConfig.storageProvider)) issues.push("STORAGE_PROVIDER deve ser s3 ou minio");
  if (!appConfig.storage.bucket) issues.push("STORAGE_BUCKET e obrigatorio");
  if (appConfig.storageProvider === "minio" && !appConfig.storage.endpoint) issues.push("STORAGE_ENDPOINT e obrigatorio para MinIO");
  if (appConfig.storageProvider === "minio" && (!appConfig.storage.accessKeyId || !appConfig.storage.secretAccessKey)) {
    issues.push("Credenciais STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY sao obrigatorias para MinIO");
  }
  return issues;
}

export function assertProductionConfiguration() {
  if (process.argv.includes("--test")) return;
  const issues = getProductionConfigurationIssues();
  if (issues.length > 0) {
    throw new Error(`Configuracao de producao invalida:\n- ${issues.join("\n- ")}`);
  }
}

export function resolvePublicUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${appConfig.appBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}
