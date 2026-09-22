import { appConfig } from "./config";

type PublicApiCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, PublicApiCacheEntry<unknown>>();

export const publicApiConfig = {
  addressCacheTtlMs: Number(process.env.PUBLIC_API_ADDRESS_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 7),
  companyCacheTtlMs: Number(process.env.PUBLIC_API_COMPANY_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 30),
  requestTimeoutMs: Number(process.env.PUBLIC_API_REQUEST_TIMEOUT_MS || 5_000),
};

export function getPublicApiCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setPublicApiCache<T>(key: string, value: T, ttlMs: number) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 0),
  });
}

export function clearPublicApiCache() {
  cacheStore.clear();
}

export function getPublicApiRuntimeStatus() {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;
  for (const entry of cacheStore.values()) {
    if (entry.expiresAt > now) {
      activeEntries += 1;
    } else {
      expiredEntries += 1;
    }
  }

  return {
    ok: true,
    env: appConfig.env,
    providers: {
      cep: ["viacep", "brasilapi"],
      cnpj: ["brasilapi"],
    },
    cache: {
      active_entries: activeEntries,
      expired_entries: expiredEntries,
      address_ttl_ms: publicApiConfig.addressCacheTtlMs,
      company_ttl_ms: publicApiConfig.companyCacheTtlMs,
    },
    request_timeout_ms: publicApiConfig.requestTimeoutMs,
    usage_policy: "Consulta sob demanda com cache; nao usar para varredura massiva de CEP/CNPJ.",
  };
}
