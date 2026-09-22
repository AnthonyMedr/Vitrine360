import { fetchWithTimeout } from "./http";
import { getPublicApiCache, publicApiConfig, setPublicApiCache } from "../public-api-runtime";

export type CompanyLookupResult = {
  ok: boolean;
  provider: "brasilapi" | "none";
  source: "public-api" | "none";
  cnpj: string;
  legalName: string;
  tradeName: string;
  status: string;
  openedAt: string;
  mainActivity: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  email: string;
  message: string;
};

type Fetcher = typeof fetchWithTimeout;

function cleanCnpj(value: string) {
  return value.replace(/\D/g, "");
}

function emptyResult(cnpj: string, message: string): CompanyLookupResult {
  return {
    ok: false,
    provider: "none",
    source: "none",
    cnpj,
    legalName: "",
    tradeName: "",
    status: "",
    openedAt: "",
    mainActivity: "",
    address: {
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
    },
    phone: "",
    email: "",
    message,
  };
}

function normalizeBrasilApiCompany(cnpj: string, data: Record<string, unknown>): CompanyLookupResult | null {
  const legalName = String(data.razao_social || "").trim();
  if (!legalName) return null;

  return {
    ok: true,
    provider: "brasilapi",
    source: "public-api",
    cnpj,
    legalName,
    tradeName: String(data.nome_fantasia || "").trim(),
    status: String(data.descricao_situacao_cadastral || data.situacao_cadastral || "").trim(),
    openedAt: String(data.data_inicio_atividade || "").trim(),
    mainActivity: String(data.cnae_fiscal_descricao || "").trim(),
    address: {
      street: String(data.logradouro || "").trim(),
      number: String(data.numero || "").trim(),
      complement: String(data.complemento || "").trim(),
      neighborhood: String(data.bairro || "").trim(),
      city: String(data.municipio || "").trim(),
      state: String(data.uf || "").trim().toUpperCase(),
      zipCode: String(data.cep || "").replace(/\D/g, ""),
    },
    phone: [data.ddd_telefone_1, data.ddd_telefone_2].map((item) => String(item || "").trim()).filter(Boolean)[0] || "",
    email: String(data.email || "").trim().toLowerCase(),
    message: "Empresa localizada por CNPJ.",
  };
}

async function fetchJson(fetcher: Fetcher, url: string, timeoutMs: number) {
  const response = await fetcher(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "GAMEL-Digital-360 national company lookup",
      },
    },
    timeoutMs,
  );
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return data && typeof data === "object" ? data : null;
}

export async function lookupBrazilianCompanyByCnpj(
  inputCnpj: string,
  options: {
    timeoutMs?: number;
    fetcher?: Fetcher;
  } = {},
) {
  const cnpj = cleanCnpj(inputCnpj);
  if (cnpj.length !== 14) {
    return emptyResult(cnpj, "CNPJ invalido.");
  }

  const cacheKey = `company:${cnpj}`;
  const cached = getPublicApiCache<CompanyLookupResult>(cacheKey);
  if (cached) return { ...cached, message: `${cached.message} Resultado em cache.` };

  const timeoutMs = options.timeoutMs ?? publicApiConfig.requestTimeoutMs;
  const fetcher = options.fetcher ?? fetchWithTimeout;

  try {
    const data = await fetchJson(fetcher, `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, timeoutMs);
    const normalized = data ? normalizeBrasilApiCompany(cnpj, data) : null;
    if (normalized) {
      setPublicApiCache(cacheKey, normalized, publicApiConfig.companyCacheTtlMs);
      return normalized;
    }
  } catch {
    // Handled by empty result.
  }

  return emptyResult(cnpj, "CNPJ nao localizado na API publica configurada.");
}
