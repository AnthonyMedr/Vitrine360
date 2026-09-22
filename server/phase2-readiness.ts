import { appConfig } from "./config";

export type Phase2ReadinessCheck = {
  status: "ok" | "warning" | "blocker";
  item: string;
  detail: string;
};

export type Phase2ReadinessReport = {
  phase2_ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: Phase2ReadinessCheck[];
    warnings: Phase2ReadinessCheck[];
    blockers: Phase2ReadinessCheck[];
  };
  next_steps: string[];
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRealFreightProvider() {
  return ["melhor-envio", "correios", "frenet", "frete-barato", "fretebarato", "cepcerto"].includes(appConfig.freightProvider);
}

export function getPhase2ReadinessReport(): Phase2ReadinessReport {
  const results: Phase2ReadinessCheck[] = [];
  const push = (status: Phase2ReadinessCheck["status"], item: string, detail: string) => {
    results.push({ status, item, detail });
  };

  if (appConfig.dbProvider !== "postgres") {
    push("blocker", "phase1_database_provider", "Fase 1 ainda nao esta fechada com DB_PROVIDER=postgres.");
  } else {
    push("ok", "phase1_database_provider", "DB_PROVIDER configurado para postgres.");
  }

  if (appConfig.queueProvider !== "redis") {
    push("blocker", "phase1_queue_provider", "Fase 1 ainda nao esta fechada com QUEUE_PROVIDER=redis.");
  } else {
    push("ok", "phase1_queue_provider", "QUEUE_PROVIDER configurado para redis.");
  }

  if (!appConfig.databaseUrl) {
    push("blocker", "phase1_database_url", "DATABASE_URL nao configurada.");
  } else {
    push("ok", "phase1_database_url", "DATABASE_URL configurada.");
  }

  if (!appConfig.redis.url) {
    push("blocker", "phase1_redis_url", "REDIS_URL nao configurada.");
  } else {
    push("ok", "phase1_redis_url", "REDIS_URL configurada.");
  }

  if (appConfig.paymentProvider !== "mercadopago") {
    push("blocker", "payment_provider", "PAYMENT_PROVIDER ainda nao esta configurado como mercadopago.");
  } else {
    push("ok", "payment_provider", "PAYMENT_PROVIDER configurado para mercadopago.");
  }

  if (!appConfig.mercadopago.accessToken) {
    push("blocker", "mercadopago_access_token", "MERCADOPAGO_ACCESS_TOKEN nao configurado.");
  } else {
    push("ok", "mercadopago_access_token", "MERCADOPAGO_ACCESS_TOKEN configurado.");
  }

  if (!appConfig.mercadopago.webhookSecret) {
    push("blocker", "mercadopago_webhook_secret", "MERCADOPAGO_WEBHOOK_SECRET nao configurado.");
  } else {
    push("ok", "mercadopago_webhook_secret", "MERCADOPAGO_WEBHOOK_SECRET configurado.");
  }

  if (appConfig.paymentProvider === "mercadopago") {
    const returnUrls = [
      ["payment_success_url", "PAYMENT_SUCCESS_URL", appConfig.mercadopago.successUrl],
      ["payment_failure_url", "PAYMENT_FAILURE_URL", appConfig.mercadopago.failureUrl],
      ["payment_pending_url", "PAYMENT_PENDING_URL", appConfig.mercadopago.pendingUrl],
    ] as const;

    for (const [item, envName, value] of returnUrls) {
      if (!value) {
        push("blocker", item, `${envName} nao configurada para retorno do Mercado Pago.`);
      } else if (!isHttpUrl(value)) {
        push("blocker", item, `${envName} deve ser uma URL http/https valida.`);
      } else {
        push("ok", item, `${envName} configurada.`);
      }
    }
  }

  if (!isRealFreightProvider()) {
    push("blocker", "freight_provider", "FREIGHT_PROVIDER ainda nao esta configurado como provider real de frete.");
  } else {
    push("ok", "freight_provider", `FREIGHT_PROVIDER configurado para ${appConfig.freightProvider}.`);
  }

  if (appConfig.freightProvider === "melhor-envio" && !appConfig.melhorEnvio.token) {
    push("blocker", "melhor_envio_token", "MELHOR_ENVIO_TOKEN nao configurado.");
  } else if (appConfig.freightProvider === "melhor-envio") {
    push("ok", "melhor_envio_token", "MELHOR_ENVIO_TOKEN configurado.");
  }

  if (appConfig.freightProvider === "melhor-envio" && !appConfig.melhorEnvio.originZipCode) {
    push("blocker", "melhor_envio_origin_zip", "MELHOR_ENVIO_ORIGIN_ZIP nao configurado.");
  } else if (appConfig.freightProvider === "melhor-envio") {
    push("ok", "melhor_envio_origin_zip", "MELHOR_ENVIO_ORIGIN_ZIP configurado.");
  }

  if (appConfig.freightProvider === "melhor-envio") {
    if (!["sandbox", "production"].includes(appConfig.melhorEnvio.env)) {
      push("blocker", "melhor_envio_env", "MELHOR_ENVIO_ENV deve ser sandbox ou production.");
    } else {
      push("ok", "melhor_envio_env", `MELHOR_ENVIO_ENV configurado como ${appConfig.melhorEnvio.env}.`);
    }
  }

  if (appConfig.freightProvider === "correios") {
    if (!appConfig.correios.token) {
      push("blocker", "correios_token", "CORREIOS_TOKEN nao configurado.");
    } else {
      push("ok", "correios_token", "CORREIOS_TOKEN configurado.");
    }
    if (!appConfig.correios.originZipCode) {
      push("blocker", "correios_origin_zip", "CORREIOS_ORIGIN_ZIP nao configurado.");
    } else {
      push("ok", "correios_origin_zip", "CORREIOS_ORIGIN_ZIP configurado.");
    }
    if (!["sandbox", "production"].includes(appConfig.correios.env)) {
      push("blocker", "correios_env", "CORREIOS_ENV deve ser sandbox ou production.");
    } else {
      push("ok", "correios_env", `CORREIOS_ENV configurado como ${appConfig.correios.env}.`);
    }
    if (appConfig.correios.services.length === 0) {
      push("blocker", "correios_services", "CORREIOS_SERVICES precisa ter ao menos um servico.");
    } else {
      push("ok", "correios_services", `CORREIOS_SERVICES configurado com ${appConfig.correios.services.length} servico(s).`);
    }
  }

  if (!appConfig.appBaseUrl.startsWith("http")) {
    push("warning", "app_base_url", "APP_BASE_URL nao parece valido para callbacks e redirects.");
  } else {
    push("ok", "app_base_url", `APP_BASE_URL configurado: ${appConfig.appBaseUrl}`);
  }

  const blockers = results.filter((entry) => entry.status === "blocker");
  const warnings = results.filter((entry) => entry.status === "warning");
  const ok = results.filter((entry) => entry.status === "ok");

  return {
    phase2_ready: blockers.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
    checks: {
      ok,
      warnings,
      blockers,
    },
    next_steps:
      blockers.length === 0
        ? [
            "Homologar pagamento real com pedido de ponta a ponta",
            "Homologar frete real com cotacao externa",
            "Configurar webhook do Mercado Pago e validar retry/duplicidade",
          ]
        : [
            "Resolver os blockers de configuracao listados",
            "Reexecutar npm run phase2:check",
            "Depois rodar smoke e homologacao assistida dos providers reais",
          ],
  };
}
