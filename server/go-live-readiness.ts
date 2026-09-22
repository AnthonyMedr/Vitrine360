import { appConfig, isProductionLike } from "./config";

export type GoLiveCheckResult = {
  status: "ok" | "warning" | "blocker";
  item: string;
  detail: string;
};

export type GoLiveReadinessReport = {
  go_live_ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: GoLiveCheckResult[];
    warnings: GoLiveCheckResult[];
    blockers: GoLiveCheckResult[];
  };
  next_steps: string[];
};

function usingDefaultCsrfSecret() {
  return appConfig.auth.csrfSecret === "gamel-dev-csrf-secret";
}

function isLocalPublicUrl() {
  try {
    const url = new URL(appConfig.appBaseUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

export function getGoLiveReadinessReport(): GoLiveReadinessReport {
  const results: GoLiveCheckResult[] = [];
  const localPublicUrl = isLocalPublicUrl();

  const push = (status: GoLiveCheckResult["status"], item: string, detail: string) => {
    results.push({ status, item, detail });
  };

  if (appConfig.homologationOnly) {
    push("blocker", "homologation_only", "HOMOLOGATION_ONLY continua ativo e bloqueia venda publica.");
  }

  if (appConfig.dbProvider !== "postgres") {
    push("blocker", "database_provider", "DB_PROVIDER ainda nao esta configurado como postgres.");
  } else {
    push("ok", "database_provider", "DB_PROVIDER configurado para postgres.");
  }

  if (!appConfig.databaseUrl) {
    push("blocker", "database_url", "DATABASE_URL nao configurada.");
  } else {
    push("ok", "database_url", "DATABASE_URL configurada.");
  }

  if (appConfig.queueProvider !== "redis") {
    push("blocker", "queue_provider", "QUEUE_PROVIDER ainda nao esta configurado como redis.");
  } else {
    push("ok", "queue_provider", "QUEUE_PROVIDER configurado para redis.");
  }

  if (!appConfig.redis.url) {
    push("blocker", "redis_url", "REDIS_URL nao configurada.");
  } else {
    push("ok", "redis_url", "REDIS_URL configurada.");
  }

  if (appConfig.paymentProvider === "manual") {
    push("blocker", "payment_provider", "PAYMENT_PROVIDER ainda esta em modo manual.");
  } else {
    push("ok", "payment_provider", `PAYMENT_PROVIDER configurado como ${appConfig.paymentProvider}.`);
  }

  if (appConfig.freightProvider === "local-rules") {
    push("blocker", "freight_provider", "FREIGHT_PROVIDER ainda esta em fallback local.");
  } else {
    push("ok", "freight_provider", `FREIGHT_PROVIDER configurado como ${appConfig.freightProvider}.`);
  }

  if (appConfig.emailProvider === "log") {
    push("warning", "email_provider", "EMAIL_PROVIDER ainda esta em modo log.");
  } else {
    push("ok", "email_provider", `EMAIL_PROVIDER configurado como ${appConfig.emailProvider}.`);
  }

  if (appConfig.analyticsProvider === "none") {
    push("warning", "analytics_provider", "ANALYTICS_PROVIDER ainda esta desativado.");
  } else {
    push("ok", "analytics_provider", `ANALYTICS_PROVIDER configurado como ${appConfig.analyticsProvider}.`);
  }

  if (appConfig.storageProvider === "local") {
    push("warning", "storage_provider", "STORAGE_PROVIDER ainda esta local.");
  } else {
    push("ok", "storage_provider", `STORAGE_PROVIDER configurado como ${appConfig.storageProvider}.`);
  }

  if (!appConfig.secureCookies && isProductionLike()) {
    push("blocker", "secure_cookies", "SECURE_COOKIES desativado em ambiente production-like.");
  } else if (!appConfig.secureCookies && !localPublicUrl) {
    push("warning", "secure_cookies", "SECURE_COOKIES desativado fora de URL local; ativar antes de staging/producao com HTTPS.");
  } else if (!appConfig.secureCookies) {
    push("ok", "secure_cookies", "SECURE_COOKIES desativado apenas em URL local de desenvolvimento.");
  } else {
    push("ok", "secure_cookies", "SECURE_COOKIES ativo.");
  }

  if (usingDefaultCsrfSecret()) {
    push("blocker", "csrf_secret", "AUTH_CSRF_SECRET continua no valor padrao inseguro.");
  } else {
    push("ok", "csrf_secret", "AUTH_CSRF_SECRET customizado.");
  }

  if (!appConfig.metricsToken && isProductionLike()) {
    push("blocker", "metrics_token", "METRICS_TOKEN nao configurado em ambiente production-like.");
  } else if (!appConfig.metricsToken) {
    push("warning", "metrics_token", "METRICS_TOKEN nao configurado.");
  } else {
    push("ok", "metrics_token", "METRICS_TOKEN configurado.");
  }

  const blockers = results.filter((entry) => entry.status === "blocker");
  const warnings = results.filter((entry) => entry.status === "warning");
  const ok = results.filter((entry) => entry.status === "ok");

  return {
    go_live_ready: blockers.length === 0,
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
            "Rodar npm test",
            "Rodar npm run build",
            "Rodar npm run smoke:release",
            "Validar staging com providers reais",
          ]
        : [
            "Resolver todos os blockers listados",
            "Reexecutar npm run go-live:check",
            "Depois rodar npm run smoke:release e homologacao final",
          ],
  };
}
