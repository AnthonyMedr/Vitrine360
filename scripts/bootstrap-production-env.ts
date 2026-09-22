import crypto from "node:crypto";

function makeSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

const appSecret = makeSecret(48);
const csrfSecret = makeSecret(48);
const metricsToken = makeSecret(32);
const integrationSecretsKey = makeSecret(32);

const lines = [
  "# GAMEL Metal Digital - production bootstrap Fase 1",
  "APP_ENV=production",
  "HOMOLOGATION_ONLY=false",
  "",
  "APP_BASE_URL=https://www.gamelmetal.com",
  "API_BASE_URL=https://www.gamelmetal.com",
  "API_PORT=3001",
  "CORS_ALLOWED_ORIGINS=https://www.gamelmetal.com,https://gamelmetal.com",
  "",
  "VITE_SITE_MODE=quote",
  "VITE_ECOMMERCE_ENABLED=false",
  "VITE_CART_ENABLED=false",
  "VITE_CHECKOUT_ENABLED=false",
  "VITE_PAYMENTS_ENABLED=false",
  "VITE_ORDER_TRACKING_ENABLED=false",
  "VITE_CUSTOMER_ACCOUNT_ENABLED=false",
  "VITE_QUOTE_ENABLED=true",
  "VITE_WHATSAPP_ENABLED=true",
  "VITE_ADMIN_ENABLED=true",
  "",
  "TRUST_PROXY=true",
  "SECURE_COOKIES=true",
  `APP_SECRET=${appSecret}`,
  "AUTH_CSRF_COOKIE_NAME=gamel_csrf",
  "AUTH_CSRF_HEADER_NAME=x-csrf-token",
  `AUTH_CSRF_SECRET=${csrfSecret}`,
  `METRICS_TOKEN=${metricsToken}`,
  `INTEGRATION_SECRETS_KEY=${integrationSecretsKey}`,
  "",
  "DB_PROVIDER=postgres",
  "DATABASE_URL=__SET_IN_PRODUCTION__",
  "POSTGRES_SSL=true",
  "",
  "QUEUE_PROVIDER=redis",
  "REDIS_URL=__SET_IN_PRODUCTION__",
  "REDIS_RATE_LIMIT_PREFIX=gamel:rate-limit",
  "REDIS_QUEUE_PREFIX=gamel:queue",
  "",
  "# Fase 1: venda online em stand by.",
  "PAYMENT_PROVIDER=manual",
  "FREIGHT_PROVIDER=local-rules",
  "",
  "EMAIL_PROVIDER=resend",
  "RESEND_API_KEY=__SET_IN_PRODUCTION__",
  'RESEND_FROM="GAMEL Metal <nao-responda@gamelmetal.com>"',
  "RESEND_REPLY_TO=comercial@gamelmetal.com",
  "",
  "ANALYTICS_PROVIDER=ga4",
  "GA4_MEASUREMENT_ID=__SET_IN_PRODUCTION__",
  "GA4_API_SECRET=__SET_IN_PRODUCTION__",
  "",
  "STORAGE_PROVIDER=minio",
  "STORAGE_PUBLIC_BASE_URL=https://cdn.gamelmetal.com",
  "STORAGE_BUCKET=__SET_IN_PRODUCTION__",
  "STORAGE_REGION=us-east-1",
  "STORAGE_ENDPOINT=__SET_IN_PRODUCTION__",
  "STORAGE_ACCESS_KEY_ID=__SET_IN_PRODUCTION__",
  "STORAGE_SECRET_ACCESS_KEY=__SET_IN_PRODUCTION__",
  "STORAGE_FORCE_PATH_STYLE=true",
  "STORAGE_AUTO_CREATE_BUCKET=false",
  "",
  "FISCAL_PROVIDER=manual",
  "FISCAL_COMPANY_CNPJ=64156323000151",
];

console.log(lines.join("\n"));
