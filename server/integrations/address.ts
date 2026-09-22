import { fetchWithTimeout } from "./http";
import { getPublicApiCache, publicApiConfig, setPublicApiCache } from "../public-api-runtime";

export type AddressLookupResult = {
  ok: boolean;
  provider: "viacep" | "brasilapi" | "none";
  source: "public-api" | "none";
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
  ddd: string;
  message: string;
};

type Fetcher = typeof fetchWithTimeout;

function cleanCep(value: string) {
  return value.replace(/\D/g, "");
}

function emptyResult(cep: string, message: string): AddressLookupResult {
  return {
    ok: false,
    provider: "none",
    source: "none",
    cep,
    street: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    ibge: "",
    ddd: "",
    message,
  };
}

function normalizeViaCep(cep: string, data: Record<string, unknown>): AddressLookupResult | null {
  if (data.erro === true) return null;
  const city = String(data.localidade || "").trim();
  const state = String(data.uf || "").trim().toUpperCase();
  if (!city || !state) return null;

  return {
    ok: true,
    provider: "viacep",
    source: "public-api",
    cep,
    street: String(data.logradouro || "").trim(),
    complement: String(data.complemento || "").trim(),
    neighborhood: String(data.bairro || "").trim(),
    city,
    state,
    ibge: String(data.ibge || "").trim(),
    ddd: String(data.ddd || "").trim(),
    message: "Endereco localizado por CEP.",
  };
}

function normalizeBrasilApi(cep: string, data: Record<string, unknown>): AddressLookupResult | null {
  const city = String(data.city || "").trim();
  const state = String(data.state || "").trim().toUpperCase();
  if (!city || !state) return null;

  return {
    ok: true,
    provider: "brasilapi",
    source: "public-api",
    cep,
    street: String(data.street || "").trim(),
    complement: "",
    neighborhood: String(data.neighborhood || "").trim(),
    city,
    state,
    ibge: "",
    ddd: "",
    message: "Endereco localizado por CEP.",
  };
}

async function fetchJson(fetcher: Fetcher, url: string, timeoutMs: number) {
  const response = await fetcher(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "GAMEL-Digital-360 national address lookup",
      },
    },
    timeoutMs,
  );
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return data && typeof data === "object" ? data : null;
}

export async function lookupBrazilianAddressByCep(
  inputCep: string,
  options: {
    timeoutMs?: number;
    fetcher?: Fetcher;
  } = {},
) {
  const cep = cleanCep(inputCep);
  if (cep.length !== 8) {
    return emptyResult(cep, "CEP invalido.");
  }

  const cacheKey = `address:${cep}`;
  const cached = getPublicApiCache<AddressLookupResult>(cacheKey);
  if (cached) return { ...cached, message: `${cached.message} Resultado em cache.` };

  const timeoutMs = options.timeoutMs ?? publicApiConfig.requestTimeoutMs;
  const fetcher = options.fetcher ?? fetchWithTimeout;

  try {
    const viaCep = await fetchJson(fetcher, `https://viacep.com.br/ws/${cep}/json/`, timeoutMs);
    const normalized = viaCep ? normalizeViaCep(cep, viaCep) : null;
    if (normalized) {
      setPublicApiCache(cacheKey, normalized, publicApiConfig.addressCacheTtlMs);
      return normalized;
    }
  } catch {
    // Fallback below.
  }

  try {
    const brasilApi = await fetchJson(fetcher, `https://brasilapi.com.br/api/cep/v2/${cep}`, timeoutMs);
    const normalized = brasilApi ? normalizeBrasilApi(cep, brasilApi) : null;
    if (normalized) {
      setPublicApiCache(cacheKey, normalized, publicApiConfig.addressCacheTtlMs);
      return normalized;
    }
  } catch {
    // Handled by empty result.
  }

  return emptyResult(cep, "CEP nao localizado nas APIs publicas configuradas.");
}
