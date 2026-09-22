import crypto from "node:crypto";
import { appConfig } from "./config";
import { type DatabaseShape, type DbFreightQuoteCache, type DbProduct, readDb, writeDb } from "./db";
import { cepService, type CepValidationResult } from "./cep-service";
import { quoteExternalFreight, type FreightQuoteOption } from "./integrations/freight";
import { logInfo, logWarn } from "./logger";
import { incrementBusinessMetric } from "./observability";

export type FreightStrategy = "cheapest" | "fastest";

export type FreightServiceInput = {
  cep: string;
  subtotal: number;
  items: Array<{ product: DbProduct; quantity: number }>;
  strategy?: FreightStrategy;
};

export type FreightServiceResult = {
  ok: boolean;
  cep: CepValidationResult;
  options: FreightQuoteOption[];
  cacheHit: boolean;
  provider: string;
  fallbackUsed: boolean;
  responseTimeMs: number;
  message: string;
};

function cleanCep(value: string) {
  return value.replace(/\D/g, "");
}

function optionDays(option: FreightQuoteOption) {
  const parsed = Number(String(option.estimatedDays).match(/\d+/)?.[0] || 9999);
  return Number.isFinite(parsed) ? parsed : 9999;
}

function cacheKey(input: FreightServiceInput, cep: string, strategy: FreightStrategy) {
  const itemKey = input.items
    .map((item) => `${item.product.id}:${item.quantity}`)
    .sort()
    .join("|");
  return crypto
    .createHash("sha256")
    .update(`${appConfig.freightProvider}:${appConfig.fakeFreight.fail ? "fake-fail" : "ok"}:${cep}:${input.subtotal.toFixed(2)}:${strategy}:${itemKey}`)
    .digest("hex");
}

function markHighlights(options: FreightQuoteOption[]) {
  const cheapest = Math.min(...options.map((option) => option.price));
  const fastest = Math.min(...options.map(optionDays));
  return options.map((option) => ({
    ...option,
    isCheapest: option.price === cheapest,
    isFastest: optionDays(option) === fastest,
  }));
}

function sortOptions(options: FreightQuoteOption[], strategy: FreightStrategy) {
  const highlighted = markHighlights(options);
  return highlighted.sort((a, b) => {
    if (strategy === "fastest") {
      return optionDays(a) - optionDays(b) || a.price - b.price;
    }
    return a.price - b.price || optionDays(a) - optionDays(b);
  });
}

function readValidCache(db: DatabaseShape, key: string) {
  const now = Date.now();
  return db.freightQuoteCache.find((entry) => entry.cache_key === key && new Date(entry.expires_at).getTime() > now) ?? null;
}

function persistQuote(db: DatabaseShape, input: {
  cep: string;
  subtotal: number;
  strategy: FreightStrategy;
  key: string;
  options: FreightQuoteOption[];
  provider: string;
  fallbackUsed: boolean;
  responseTimeMs: number;
  cacheHit: boolean;
  status: "success" | "failed" | "degraded";
  message: string;
}) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Number(process.env.FREIGHT_CACHE_TTL_MS || 1000 * 60 * 20)).toISOString();
  const cacheEntry: DbFreightQuoteCache = {
    id: `freight-cache-${input.key}`,
    cache_key: input.key,
    cep: input.cep,
    subtotal: input.subtotal,
    strategy: input.strategy,
    options: input.options as unknown as Array<Record<string, unknown>>,
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  };

  db.freightQuoteCache = [cacheEntry, ...db.freightQuoteCache.filter((entry) => entry.cache_key !== input.key)].slice(0, 500);
  db.freightQuoteHistory = [
    {
      id: crypto.randomUUID(),
      cep: input.cep,
      provider: input.provider,
      fallback_used: input.fallbackUsed,
      strategy: input.strategy,
      options_count: input.options.length,
      response_time_ms: input.responseTimeMs,
      cache_hit: input.cacheHit,
      status: input.status,
      message: input.message,
      created_at: now,
    },
    ...db.freightQuoteHistory,
  ].slice(0, 1000);
}

function persistError(db: DatabaseShape, input: {
  provider: string;
  cep: string;
  message: string;
  responseTimeMs: number | null;
}) {
  db.freightErrorLogs = [
    {
      id: crypto.randomUUID(),
      provider: input.provider,
      cep: input.cep,
      error_type: (input.message.includes("timeout") ? "timeout" : "provider") as "timeout" | "provider",
      message: input.message,
      response_time_ms: input.responseTimeMs,
      created_at: new Date().toISOString(),
    },
    ...db.freightErrorLogs,
  ].slice(0, 1000);
}

export class FreightService {
  async quote(input: FreightServiceInput): Promise<FreightServiceResult> {
    const startedAt = Date.now();
    const strategy = input.strategy ?? (process.env.FREIGHT_SORT_STRATEGY === "fastest" ? "fastest" : "cheapest");
    const cep = cleanCep(input.cep);
    const validation = await cepService.validate(cep);
    if (!validation.ok) {
      return {
        ok: false,
        cep: validation,
        options: [],
        cacheHit: false,
        provider: "none",
        fallbackUsed: false,
        responseTimeMs: Date.now() - startedAt,
        message: validation.message,
      };
    }

    const db = readDb();
    const key = cacheKey(input, cep, strategy);
    const cached = readValidCache(db, key);
    if (cached) {
      const options = sortOptions(cached.options as unknown as FreightQuoteOption[], strategy);
      incrementBusinessMetric("freight_quote_cache_hit");
      return {
        ok: options.length > 0,
        cep: validation,
        options,
        cacheHit: true,
        provider: "cache",
        fallbackUsed: false,
        responseTimeMs: Date.now() - startedAt,
        message: "Frete carregado do cache.",
      };
    }

    const quoted = await quoteExternalFreight({
      to: { street: "", number: "", neighborhood: "", city: validation.city, state: validation.state, zipCode: cep },
      items: input.items,
      declaredValue: input.subtotal,
    });
    const responseTimeMs = Date.now() - startedAt;
    const options = sortOptions(quoted.options, strategy);
    const fallbackUsed = appConfig.freightProvider === "melhor-envio" && quoted.provider === "correios";
    const ok = quoted.ok && options.length > 0;
    const message = ok
      ? fallbackUsed
        ? "Melhor Envio indisponivel; cotacao retornada pelo fallback Correios."
        : "Frete calculado com sucesso."
      : "Nao foi possivel cotar frete automatico para este CEP.";

    persistQuote(db, {
      cep,
      subtotal: input.subtotal,
      strategy,
      key,
      options,
      provider: quoted.provider,
      fallbackUsed,
      responseTimeMs,
      cacheHit: false,
      status: ok ? (fallbackUsed ? "degraded" : "success") : "failed",
      message,
    });
    if (!ok) {
      incrementBusinessMetric("freight_quote_failed");
      persistError(db, { provider: quoted.provider, cep, message, responseTimeMs });
    }
    writeDb(db);

    if (fallbackUsed) {
      incrementBusinessMetric("freight_quote_fallback");
      logWarn({ event: "freight.fallback_used", module: "freight", data: { from: "melhor-envio", to: "correios", cep, responseTimeMs } });
    } else {
      incrementBusinessMetric("freight_quote_success");
      logInfo({ event: "freight.quote_completed", module: "freight", data: { provider: quoted.provider, cep, responseTimeMs, options: options.length } });
    }

    return {
      ok,
      cep: validation,
      options,
      cacheHit: false,
      provider: quoted.provider,
      fallbackUsed,
      responseTimeMs,
      message,
    };
  }
}

export const freightService = new FreightService();
