import { appConfig } from "./config";
import { getDbRuntimeStatus } from "./db";
import { getQueueStats } from "./async-jobs";
import { checkPostgresHealth } from "./postgres";
import { checkRedisHealth, isRedisConfigured } from "./redis";
import { getFiscalProviderStatus } from "./integrations/fiscal";
import { getErpProviderStatus } from "./integrations/erp";
import { checkObjectStorageHealth, getObjectStorageConfigurationStatus } from "./object-storage";

export { getFiscalProviderStatus, getErpProviderStatus };

export function isPaymentProviderReady() {
  return appConfig.paymentProvider === "manual" || appConfig.paymentProvider === "fake" || getPaymentProviderStatus().ready;
}

export function isFreightProviderReady() {
  return appConfig.freightProvider === "local-rules" || appConfig.freightProvider === "fake" || getFreightProviderStatus().ready;
}

export function isEmailProviderReady() {
  return appConfig.emailProvider === "log" || Boolean(appConfig.resend.apiKey);
}

export function isAnalyticsProviderReady() {
  return appConfig.analyticsProvider === "none" || Boolean(appConfig.ga4.apiSecret);
}

export function isStorageProviderReady() {
  return getObjectStorageConfigurationStatus().configured;
}

export function isFiscalProviderReady() {
  return getFiscalProviderStatus().ready;
}

export function isErpProviderReady() {
  return getErpProviderStatus().ready;
}

export function getPaymentProviderStatus() {
  const missing: string[] = [];
  if (appConfig.paymentProvider === "mercadopago") {
    if (!appConfig.mercadopago.accessToken) missing.push("MERCADOPAGO_ACCESS_TOKEN");
    if (!appConfig.mercadopago.webhookSecret) missing.push("MERCADOPAGO_WEBHOOK_SECRET");
    if (!appConfig.mercadopago.successUrl) missing.push("PAYMENT_SUCCESS_URL");
    if (!appConfig.mercadopago.failureUrl) missing.push("PAYMENT_FAILURE_URL");
    if (!appConfig.mercadopago.pendingUrl) missing.push("PAYMENT_PENDING_URL");
  }

  return {
    provider: appConfig.paymentProvider,
    mode: appConfig.paymentProvider === "manual" ? "manual" : appConfig.paymentProvider === "fake" ? "fake" : "provider",
    ready: appConfig.paymentProvider === "manual" || appConfig.paymentProvider === "fake" || missing.length === 0,
    webhook_ready: appConfig.paymentProvider !== "mercadopago" || Boolean(appConfig.mercadopago.webhookSecret),
    return_urls_configured:
      appConfig.paymentProvider !== "mercadopago"
        || Boolean(appConfig.mercadopago.successUrl && appConfig.mercadopago.failureUrl && appConfig.mercadopago.pendingUrl),
    sandbox: false,
    request_timeout_ms: appConfig.mercadopago.requestTimeoutMs,
    missing,
  };
}

export function getFreightProviderStatus() {
  const missing: string[] = [];
  if (appConfig.freightProvider === "melhor-envio") {
    if (!appConfig.melhorEnvio.token) missing.push("MELHOR_ENVIO_TOKEN");
    if (!appConfig.melhorEnvio.originZipCode) missing.push("MELHOR_ENVIO_ORIGIN_ZIP");
    if (!["sandbox", "production"].includes(appConfig.melhorEnvio.env)) missing.push("MELHOR_ENVIO_ENV");
  }
  if (appConfig.freightProvider === "correios") {
    if (!appConfig.correios.token) missing.push("CORREIOS_TOKEN");
    if (!appConfig.correios.originZipCode) missing.push("CORREIOS_ORIGIN_ZIP");
    if (!["sandbox", "production"].includes(appConfig.correios.env)) missing.push("CORREIOS_ENV");
    if (appConfig.correios.services.length === 0) missing.push("CORREIOS_SERVICES");
  }
  if (appConfig.freightProvider === "frenet") {
    if (!appConfig.frenet.token) missing.push("FRENET_TOKEN");
    if (!appConfig.frenet.originZipCode) missing.push("FRENET_ORIGIN_ZIP");
  }
  if (appConfig.freightProvider === "frete-barato" || appConfig.freightProvider === "fretebarato") {
    if (!appConfig.freteBarato.token) missing.push("FRETE_BARATO_TOKEN");
    if (!appConfig.freteBarato.customerId) missing.push("FRETE_BARATO_CUSTOMER_ID");
  }
  if (appConfig.freightProvider === "cepcerto") {
    if (!appConfig.cepCerto.token) missing.push("CEPCERTO_TOKEN");
    if (!appConfig.cepCerto.originZipCode) missing.push("CEPCERTO_ORIGIN_ZIP");
  }

  return {
    provider: appConfig.freightProvider,
    mode: appConfig.freightProvider === "local-rules" ? "manual" : appConfig.freightProvider === "fake" ? "fake" : "provider",
    ready: appConfig.freightProvider === "local-rules" || appConfig.freightProvider === "fake" || missing.length === 0,
    sandbox:
      appConfig.freightProvider === "melhor-envio"
        ? appConfig.melhorEnvio.sandbox
        : appConfig.freightProvider === "correios"
          ? appConfig.correios.env !== "production"
          : false,
    env:
      appConfig.freightProvider === "melhor-envio"
        ? appConfig.melhorEnvio.env
        : appConfig.freightProvider === "correios"
          ? appConfig.correios.env
          : appConfig.freightProvider === "frenet" || appConfig.freightProvider === "frete-barato" || appConfig.freightProvider === "fretebarato" || appConfig.freightProvider === "cepcerto"
            ? "production"
          : "local",
    request_timeout_ms:
      appConfig.freightProvider === "correios"
        ? appConfig.correios.requestTimeoutMs
        : appConfig.freightProvider === "frenet"
          ? appConfig.frenet.requestTimeoutMs
          : appConfig.freightProvider === "frete-barato" || appConfig.freightProvider === "fretebarato"
            ? appConfig.freteBarato.requestTimeoutMs
            : appConfig.freightProvider === "cepcerto"
              ? appConfig.cepCerto.requestTimeoutMs
              : appConfig.melhorEnvio.requestTimeoutMs,
    origin_zip_configured: Boolean(
      appConfig.freightProvider === "correios"
        ? appConfig.correios.originZipCode
        : appConfig.freightProvider === "frenet"
          ? appConfig.frenet.originZipCode
          : appConfig.freightProvider === "cepcerto"
            ? appConfig.cepCerto.originZipCode
            : appConfig.melhorEnvio.originZipCode,
    ),
    missing,
  };
}

export async function getDatabaseProviderStatus() {
  if (appConfig.dbProvider === "postgres") {
    return checkPostgresHealth();
  }
  return {
    provider: appConfig.dbProvider,
    configured: true,
    ready: true,
    latencyMs: 0,
    error: null,
  };
}

export async function getRedisProviderStatus() {
  if (!isRedisConfigured()) {
    return {
      provider: "redis",
      configured: false,
      ready: false,
      latencyMs: null,
      error: "REDIS_URL nao configurada",
    };
  }
  return checkRedisHealth();
}

export async function getIntegrationOverview() {
  const paymentStatus = getPaymentProviderStatus();
  const freightStatus = getFreightProviderStatus();
  const fiscalStatus = getFiscalProviderStatus();
  const erpStatus = getErpProviderStatus();
  const emailReady = isEmailProviderReady();
  const analyticsReady = isAnalyticsProviderReady();
  const [database, redis, storage] = await Promise.all([
    getDatabaseProviderStatus(),
    getRedisProviderStatus(),
    checkObjectStorageHealth(),
  ]);
  const storageReady = storage.ready;
  const dbRuntime = getDbRuntimeStatus();
  const redisRequired = appConfig.queueProvider === "redis";

  return {
    items: [
      {
        key: "database",
        label: "Banco de dados",
        connected: database.ready,
        mode: appConfig.dbProvider === "sqlite" ? "local" : "real",
        status:
          appConfig.dbProvider === "sqlite"
            ? "Runtime local ativo com SQLite e snapshot operacional"
            : database.ready
              ? "PostgreSQL inicializado para operacao"
              : "Provider PostgreSQL selecionado, aguardando inicializacao valida",
        fallback_ready: true,
        last_error: dbRuntime.lastFlushError ?? database.error,
      },
      {
        key: "crm",
        label: "CRM",
        connected: false,
        mode: "structural",
        status: "Eventos locais prontos e fallback manual ativo",
        fallback_ready: true,
        last_error: null,
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        connected: true,
        mode: "real",
        status: "Links dinamicos e atendimento manual disponivel",
        fallback_ready: true,
        last_error: null,
      },
      {
        key: "queue",
        label: "Fila e rate limit",
        connected: redisRequired ? redis.ready : true,
        mode: redisRequired ? "real" : redis.configured ? "hybrid" : "local",
        status:
          redisRequired
            ? redis.ready
              ? "Redis ativo para fila distribuida e throttling"
              : "Redis exigido por configuracao e ainda indisponivel"
            : redis.configured
              ? "Redis configurado com fallback local disponivel"
              : "Fallback local ativo; Redis ainda nao configurado",
        fallback_ready: !redisRequired,
        last_error: redis.ready ? null : redis.error,
      },
      {
        key: "payment",
        label: "Pagamento",
        connected: paymentStatus.ready && appConfig.paymentProvider !== "manual",
        mode: appConfig.paymentProvider === "manual" ? "manual" : appConfig.paymentProvider === "fake" ? "fake" : "real",
        status:
          appConfig.paymentProvider === "manual"
            ? "Fluxo manual/controlado ativo; gateway real ainda nao conectado"
            : appConfig.paymentProvider === "fake"
              ? `Provider fake ativo para homologacao interna; status ${appConfig.fakePayment.status}`
            : paymentStatus.ready
              ? `Provider configurado: ${appConfig.paymentProvider}; webhook ${paymentStatus.webhook_ready ? "pronto" : "pendente"}`
              : `Provider ${appConfig.paymentProvider} selecionado, aguardando ${paymentStatus.missing.join(", ")}`,
        fallback_ready: true,
        last_error: paymentStatus.ready ? null : `Pendencias: ${paymentStatus.missing.join(", ")}`,
      },
      {
        key: "freight",
        label: "Frete",
        connected: freightStatus.ready && appConfig.freightProvider !== "local-rules",
        mode: appConfig.freightProvider === "local-rules" ? "manual" : appConfig.freightProvider === "fake" ? "fake" : "real",
        status:
          appConfig.freightProvider === "local-rules"
            ? "Regras locais e retirada em loja em operacao"
            : appConfig.freightProvider === "fake"
              ? "Frete fake ativo para homologacao interna sem transportadora real"
            : freightStatus.ready
              ? `Provider configurado: ${appConfig.freightProvider}; sandbox ${freightStatus.sandbox ? "ativo" : "desativado"}`
              : `Provider ${appConfig.freightProvider} selecionado, aguardando ${freightStatus.missing.join(", ")}`,
        fallback_ready: true,
        last_error: freightStatus.ready ? null : `Pendencias: ${freightStatus.missing.join(", ")}`,
      },
      {
        key: "fiscal",
        label: "Fiscal",
        connected: fiscalStatus.ready && appConfig.fiscalProvider !== "manual",
        mode: appConfig.fiscalProvider === "manual" ? "manual" : "real",
        status:
          appConfig.fiscalProvider === "manual"
            ? "Fluxo fiscal local/manual ativo; emissor real ainda nao conectado"
            : fiscalStatus.ready
              ? `Provider configurado: ${appConfig.fiscalProvider}; ambiente ${fiscalStatus.env}`
              : `Provider ${appConfig.fiscalProvider} selecionado, aguardando ${fiscalStatus.missing.join(", ")}`,
        fallback_ready: true,
        last_error: fiscalStatus.ready ? null : `Pendencias: ${fiscalStatus.missing.join(", ")}`,
      },
      {
        key: "erp",
        label: "ERP",
        connected: erpStatus.ready && appConfig.erpProvider !== "none" && erpStatus.sync_enabled,
        mode: appConfig.erpProvider === "none" ? "local" : "real",
        status:
          appConfig.erpProvider === "none"
            ? "Operacao local assistida ativa; ERP ainda nao conectado"
            : erpStatus.ready
              ? `Provider configurado: ${appConfig.erpProvider}; sincronizacao ${erpStatus.sync_enabled ? "habilitada" : "desabilitada"}`
              : `Provider ${appConfig.erpProvider} selecionado, aguardando ${erpStatus.missing.join(", ")}`,
        fallback_ready: true,
        last_error: erpStatus.ready ? null : `Pendencias: ${erpStatus.missing.join(", ")}`,
      },
      {
        key: "analytics",
        label: "Analytics",
        connected: analyticsReady && appConfig.analyticsProvider !== "none",
        mode: appConfig.analyticsProvider === "none" ? "structural" : "real",
        status:
          appConfig.analyticsProvider === "none"
            ? "Camada preparada, sem provider externo ativo"
            : analyticsReady
              ? `Provider configurado: ${appConfig.analyticsProvider}`
              : `Provider ${appConfig.analyticsProvider} selecionado, aguardando segredo`,
        fallback_ready: true,
        last_error: analyticsReady ? null : "Credenciais de analytics ausentes",
      },
      {
        key: "notifications",
        label: "Notificacoes",
        connected: emailReady && appConfig.emailProvider !== "log",
        mode: appConfig.emailProvider === "log" ? "manual" : "real",
        status:
          appConfig.emailProvider === "log"
            ? "Comunicacao depende de operacao interna, email logado e WhatsApp"
            : emailReady
              ? `Provider configurado: ${appConfig.emailProvider}`
              : `Provider ${appConfig.emailProvider} selecionado, aguardando chave`,
        fallback_ready: true,
        last_error: emailReady ? null : "Credenciais de notificacao ausentes",
      },
      {
        key: "storage",
        label: "Storage",
        connected: storageReady && appConfig.storageProvider !== "local",
        mode: appConfig.storageProvider === "local" ? "local" : "real",
        status:
          appConfig.storageProvider === "local"
            ? "Assets locais ativos; camada externa preparada para bucket publico"
            : storageReady
              ? `Provider ${appConfig.storageProvider} conectado ao bucket ${storage.bucket}`
              : `Provider ${appConfig.storageProvider} indisponivel`,
        fallback_ready: appConfig.storageProvider === "local",
        last_error: storage.error,
      },
    ],
    runtime: {
      database: dbRuntime,
      redis: {
        configured: redis.configured,
        ready: redis.ready,
        required: redisRequired,
      },
      payment: paymentStatus,
      freight: freightStatus,
      fiscal: fiscalStatus,
      erp: erpStatus,
      storage,
      queues: getQueueStats(),
    },
  };
}
