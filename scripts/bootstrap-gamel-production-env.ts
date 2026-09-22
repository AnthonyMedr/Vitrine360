import crypto from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

function secret(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

const target = path.resolve(process.cwd(), ".env.production.local");
const force = process.argv.includes("--force");

if (existsSync(target) && !force) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    path: target,
    detail: "Arquivo ja existe. Use --force para regenerar.",
  }, null, 2));
  process.exit(0);
}

const content = `# GAMEL Metal Digital - producao local/servidor
# Gerado automaticamente. Este arquivo e ignorado pelo git.
# Preencha os campos __SET_REAL_* no cofre/ambiente do provedor antes do deploy definitivo.

APP_ENV=production
HOMOLOGATION_ONLY=false

APP_BASE_URL=https://www.gamelmetal.com
API_BASE_URL=https://www.gamelmetal.com
API_PORT=3001
CORS_ALLOWED_ORIGINS=https://www.gamelmetal.com,https://gamelmetal.com

VITE_API_BASE_URL=
VITE_SITE_MODE=quote
VITE_ECOMMERCE_ENABLED=false
VITE_CART_ENABLED=false
VITE_CHECKOUT_ENABLED=false
VITE_PAYMENTS_ENABLED=false
VITE_STRIPE_ENABLED=false
VITE_ORDER_TRACKING_ENABLED=false
VITE_CUSTOMER_ACCOUNT_ENABLED=false
VITE_QUOTE_ENABLED=true
VITE_WHATSAPP_ENABLED=true
VITE_ADMIN_ENABLED=true
VITE_CATALOG_SOURCE=api
VITE_EVENTS_ENABLED=true
VITE_WEBHOOK_ENABLED=false

TRUST_PROXY=true
SECURE_COOKIES=true
APP_SECRET=${secret()}
AUTH_CSRF_COOKIE_NAME=gamel_csrf
AUTH_CSRF_HEADER_NAME=x-csrf-token
AUTH_CSRF_SECRET=${secret()}
METRICS_TOKEN=${secret(32)}
INTEGRATION_SECRETS_KEY=${secret(32)}

DB_PROVIDER=postgres
DATABASE_URL=__SET_REAL_POSTGRES_URL__
POSTGRES_SSL=true

QUEUE_PROVIDER=redis
REDIS_URL=__SET_REAL_REDIS_URL__
REDIS_RATE_LIMIT_PREFIX=gamel:rate-limit
REDIS_QUEUE_PREFIX=gamel:queue

PAYMENT_PROVIDER=manual
SHIPPING_PROVIDER=local-rules
FREIGHT_PROVIDER=local-rules
FISCAL_PROVIDER=manual
FISCAL_COMPANY_CNPJ=64156323000151
ERP_PROVIDER=none
ERP_SYNC_ENABLED=false

EMAIL_PROVIDER=resend
EMAIL_FROM="GAMEL Metal <nao-responda@gamelmetal.com>"
EMAIL_API_KEY=__SET_REAL_RESEND_API_KEY__
RESEND_API_KEY=__SET_REAL_RESEND_API_KEY__
RESEND_FROM="GAMEL Metal <nao-responda@gamelmetal.com>"
RESEND_REPLY_TO=comercial@gamelmetal.com

ANALYTICS_PROVIDER=ga4
ANALYTICS_ID=__SET_REAL_GA4_MEASUREMENT_ID__
GA4_MEASUREMENT_ID=__SET_REAL_GA4_MEASUREMENT_ID__
GA4_API_SECRET=__SET_REAL_GA4_API_SECRET_OPTIONAL__

STORAGE_PROVIDER=minio
STORAGE_PUBLIC_BASE_URL=https://cdn.gamelmetal.com
STORAGE_BUCKET=__SET_REAL_STORAGE_BUCKET__
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=__SET_REAL_STORAGE_ENDPOINT__
STORAGE_ACCESS_KEY_ID=__SET_REAL_STORAGE_ACCESS_KEY_ID__
STORAGE_SECRET_ACCESS_KEY=__SET_REAL_STORAGE_SECRET_ACCESS_KEY__
STORAGE_FORCE_PATH_STYLE=true
STORAGE_AUTO_CREATE_BUCKET=false
CDN_BASE_URL=https://cdn.gamelmetal.com

AI_ENABLED=false
OPENAI_API_KEY=
`;

writeFileSync(target, content);

console.log(JSON.stringify({
  ok: true,
  path: target,
  generatedSecrets: ["APP_SECRET", "AUTH_CSRF_SECRET", "METRICS_TOKEN", "INTEGRATION_SECRETS_KEY"],
  pendingRealServices: ["DATABASE_URL", "REDIS_URL", "RESEND_API_KEY", "GA4_MEASUREMENT_ID", "STORAGE_BUCKET"],
}, null, 2));
