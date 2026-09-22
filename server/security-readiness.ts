import { appConfig, isProductionLike } from "./config";
import { hasUnsafeInlineScriptCsp } from "./security";
import { isRedisConfigured } from "./redis";

export type SecurityReadinessReport = {
  ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
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

export function getSecurityReadinessReport(): SecurityReadinessReport {
  const checks = {
    ok: [] as Array<{ item: string; detail: string }>,
    warnings: [] as Array<{ item: string; detail: string }>,
    blockers: [] as Array<{ item: string; detail: string }>,
  };

  if (usingDefaultCsrfSecret()) {
    checks.blockers.push({
      item: "csrf_secret",
      detail: "AUTH_CSRF_SECRET continua no valor padrao inseguro.",
    });
  } else {
    checks.ok.push({
      item: "csrf_secret",
      detail: "AUTH_CSRF_SECRET customizado.",
    });
  }

  const localPublicUrl = isLocalPublicUrl();

  if (!appConfig.secureCookies && isProductionLike()) {
    checks.blockers.push({
      item: "secure_cookies",
      detail: "SECURE_COOKIES desativado em ambiente production-like.",
    });
  } else if (!appConfig.secureCookies && !localPublicUrl) {
    checks.warnings.push({
      item: "secure_cookies",
      detail: "SECURE_COOKIES desativado fora de URL local; ativar antes de staging/producao com HTTPS.",
    });
  } else if (!appConfig.secureCookies) {
    checks.ok.push({
      item: "secure_cookies",
      detail: "SECURE_COOKIES desativado apenas em URL local de desenvolvimento.",
    });
  } else {
    checks.ok.push({
      item: "secure_cookies",
      detail: "SECURE_COOKIES ativo.",
    });
  }

  if (hasUnsafeInlineScriptCsp()) {
    checks.warnings.push({
      item: "csp_unsafe_inline",
      detail: "Content-Security-Policy ainda permite 'unsafe-inline' em script-src e precisa hardening antes de producao final.",
    });
  } else {
    checks.ok.push({
      item: "csp_unsafe_inline",
      detail: "Content-Security-Policy sem 'unsafe-inline' em script-src.",
    });
  }

  if (isRedisConfigured()) {
    checks.ok.push({
      item: "distributed_rate_limit",
      detail: "Redis configurado para suportar rate limit distribuido.",
    });
  } else if (isProductionLike()) {
    checks.blockers.push({
      item: "distributed_rate_limit",
      detail: "REDIS_URL ausente em producao; rate limit distribuido nao pode depender de memoria local.",
    });
  } else {
    checks.warnings.push({
      item: "distributed_rate_limit",
      detail: "Rate limit ainda depende de fallback local sem REDIS_URL configurada.",
    });
  }

  if (appConfig.trustProxy) {
    checks.ok.push({
      item: "trust_proxy",
      detail: "TRUST_PROXY ativo para operar atras de proxy reverso.",
    });
  } else if (isProductionLike()) {
    checks.blockers.push({
      item: "trust_proxy",
      detail: "TRUST_PROXY desativado em producao; cookies seguros, IP real e rate limit podem ficar incorretos atras de proxy/CDN.",
    });
  } else {
    checks.warnings.push({
      item: "trust_proxy",
      detail: "TRUST_PROXY ainda desativado; revisar antes de publicar atras de proxy/CDN.",
    });
  }

  if (isProductionLike() && localPublicUrl) {
    checks.blockers.push({
      item: "app_base_url",
      detail: "APP_BASE_URL ainda aponta para localhost/127.0.0.1 em producao.",
    });
  } else {
    checks.ok.push({
      item: "app_base_url",
      detail: `APP_BASE_URL configurado como ${appConfig.appBaseUrl}.`,
    });
  }

  return {
    ready: checks.blockers.length === 0,
    blockers: checks.blockers.length,
    warnings: checks.warnings.length,
    checks,
    next_steps:
      checks.blockers.length > 0
        ? [
            "Remover blocker de segredo e cookies seguros",
            "Reexecutar security:check antes da homologacao final",
          ]
        : checks.warnings.length > 0
          ? [
              "Resolver warnings de CSP, cookies ou fallback local antes do go-live final",
              "Reexecutar security:check e go-live:check depois do hardening de ambiente",
            ]
          : ["Manter security:check no fechamento de cada fase e revalidar com variaveis reais de staging/producao."],
  };
}
