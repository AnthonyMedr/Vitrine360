import { appConfig } from "./config";
import type { DatabaseShape } from "./db";
import { getFreightCatalogReadinessReport } from "./freight-catalog-readiness";
import { getGoLiveReadinessReport } from "./go-live-readiness";
import { getOperationReadinessReport } from "./operation-readiness";
import { getPhase1ReadinessReport } from "./phase1-readiness";
import { getPhase2ReadinessReport } from "./phase2-readiness";
import { getAdminFiscalReadiness } from "./read-models";
import { getReleaseReadinessReport } from "./release-readiness";
import { getSecurityReadinessReport } from "./security-readiness";

export type HomologationEnvRequirement = {
  phase: "infra" | "payments" | "freight" | "security" | "fiscal" | "ops";
  key: string;
  requiredFor: string;
  configured: boolean;
};

function configured(value: string | boolean | number | null | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}

export function getHomologationEnvRequirements(): HomologationEnvRequirement[] {
  return [
    {
      phase: "infra",
      key: "DB_PROVIDER=postgres",
      requiredFor: "Banco transacional de producao",
      configured: appConfig.dbProvider === "postgres",
    },
    {
      phase: "infra",
      key: "DATABASE_URL",
      requiredFor: "Conexao com Postgres",
      configured: configured(appConfig.databaseUrl),
    },
    {
      phase: "infra",
      key: "QUEUE_PROVIDER=redis",
      requiredFor: "Filas, rate limit distribuido e workers",
      configured: appConfig.queueProvider === "redis",
    },
    {
      phase: "infra",
      key: "REDIS_URL",
      requiredFor: "Conexao com Redis",
      configured: configured(appConfig.redis.url),
    },
    {
      phase: "payments",
      key: "PAYMENT_PROVIDER=mercadopago",
      requiredFor: "Checkout real e conciliacao",
      configured: appConfig.paymentProvider === "mercadopago",
    },
    {
      phase: "payments",
      key: "MERCADOPAGO_ACCESS_TOKEN",
      requiredFor: "Criacao de pagamento",
      configured: configured(appConfig.mercadopago.accessToken),
    },
    {
      phase: "payments",
      key: "MERCADOPAGO_WEBHOOK_SECRET",
      requiredFor: "Validacao de webhook assinado",
      configured: configured(appConfig.mercadopago.webhookSecret),
    },
    {
      phase: "freight",
      key: "FREIGHT_PROVIDER=melhor-envio",
      requiredFor: "Cotacao nacional real",
      configured: appConfig.freightProvider === "melhor-envio",
    },
    {
      phase: "freight",
      key: "MELHOR_ENVIO_TOKEN",
      requiredFor: "Autenticacao Melhor Envio",
      configured: configured(appConfig.melhorEnvio.token),
    },
    {
      phase: "freight",
      key: "MELHOR_ENVIO_ORIGIN_ZIP",
      requiredFor: "Origem logistico-fiscal",
      configured: configured(appConfig.melhorEnvio.originZipCode),
    },
    {
      phase: "security",
      key: "SECURE_COOKIES=true",
      requiredFor: "Sessao segura em HTTPS",
      configured: appConfig.secureCookies,
    },
    {
      phase: "security",
      key: "TRUST_PROXY=true",
      requiredFor: "Proxy reverso/CDN",
      configured: appConfig.trustProxy,
    },
    {
      phase: "security",
      key: "AUTH_CSRF_SECRET",
      requiredFor: "CSRF customizado",
      configured: appConfig.auth.csrfSecret !== "gamel-dev-csrf-secret",
    },
    {
      phase: "security",
      key: "METRICS_TOKEN",
      requiredFor: "Protecao de metricas",
      configured: configured(appConfig.metricsToken),
    },
    {
      phase: "fiscal",
      key: "FISCAL_COMPANY_CNPJ",
      requiredFor: "Fechamento fiscal e emissao",
      configured: configured(appConfig.fiscal.companyCnpj),
    },
    {
      phase: "ops",
      key: "EMAIL_PROVIDER=resend",
      requiredFor: "E-mails transacionais reais",
      configured: appConfig.emailProvider === "resend",
    },
  ];
}

export async function buildHomologationPack(db: DatabaseShape) {
  const phase1 = await getPhase1ReadinessReport();
  const release = await getReleaseReadinessReport(db);
  const phase2 = getPhase2ReadinessReport();
  const goLive = getGoLiveReadinessReport();
  const security = getSecurityReadinessReport();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operations = getOperationReadinessReport(db);
  const freightCatalog = getFreightCatalogReadinessReport(db);
  const env = getHomologationEnvRequirements();

  const commandSequence = [
    "npm run env:bootstrap:production",
    "npm run security:bootstrap",
    "npm run phase1:check",
    "npm run db:sync:postgres",
    "npm run phase2:check",
    "npm run smoke:phase2",
    "npm run fiscal:close-pack:minimal",
    "npm run fiscal:close-pack:validate",
    "npm run fiscal:check:minimal",
    "npm run backup:export:latest",
    "npm run backup:validate -- docs/reports/runtime-backups/runtime-backup-latest.json",
    "npm run release:check",
    "npm run go-live:check",
    "npm run smoke:release",
  ];

  return {
    generated_at: new Date().toISOString(),
    decision: {
      local_base_ready: freightCatalog.national_freight_ready && operations.ready && security.ready,
      homologation_ready: phase1.ok && phase2.phase2_ready && fiscal.ready,
      go_live_ready: release.ready && goLive.go_live_ready,
    },
    environment: {
      app_env: appConfig.env,
      app_base_url: appConfig.appBaseUrl,
      api_base_url: appConfig.apiBaseUrl,
      homologation_only: appConfig.homologationOnly,
      db_provider: appConfig.dbProvider,
      queue_provider: appConfig.queueProvider,
      payment_provider: appConfig.paymentProvider,
      freight_provider: appConfig.freightProvider,
    },
    gates: {
      phase1,
      phase2,
      security,
      fiscal,
      operations,
      freight_catalog: freightCatalog,
      release,
      go_live: goLive,
    },
    env_requirements: env,
    missing_env: env.filter((item) => !item.configured),
    command_sequence: commandSequence,
  };
}

export type HomologationPack = Awaited<ReturnType<typeof buildHomologationPack>>;
