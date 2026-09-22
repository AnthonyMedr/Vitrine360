import { appConfig } from "./config";
import { lookupBrazilianAddressByCep } from "./integrations/address";
import { fetchWithTimeout } from "./integrations/http";

export type CepValidationResult = {
  ok: boolean;
  provider: "cepcerto" | "public-fallback" | "none";
  cep: string;
  city: string;
  state: string;
  message: string;
};

function cleanCep(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCepCertoResponse(cep: string, data: Record<string, unknown>): CepValidationResult | null {
  const status = String(data.status || data.situacao || data.ok || "").toLowerCase();
  if (status === "false" || status === "erro" || status === "invalid") return null;

  const city = String(data.cidade || data.city || data.localidade || "").trim();
  const state = String(data.uf || data.state || "").trim().toUpperCase();
  if (!city || !state) return null;

  return {
    ok: true,
    provider: "cepcerto",
    cep,
    city,
    state,
    message: "CEP validado pela CepCerto.",
  };
}

export class CepService {
  async validate(cepInput: string): Promise<CepValidationResult> {
    const cep = cleanCep(cepInput);
    if (cep.length !== 8) {
      return { ok: false, provider: "none", cep, city: "", state: "", message: "CEP invalido." };
    }

    if (appConfig.cepCerto.token && process.env.CEPCERTO_CEP_BASE_URL) {
      try {
        const url = `${process.env.CEPCERTO_CEP_BASE_URL.replace(/\/$/, "")}/${cep}/${encodeURIComponent(appConfig.cepCerto.token)}`;
        const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, appConfig.cepCerto.requestTimeoutMs);
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        const normalized = response.ok && data ? normalizeCepCertoResponse(cep, data) : null;
        if (normalized) return normalized;
      } catch {
        // Falls back to public CEP lookup below so checkout does not stall.
      }
    }

    const publicResult = await lookupBrazilianAddressByCep(cep);
    if (!publicResult.ok) {
      return { ok: false, provider: "public-fallback", cep, city: "", state: "", message: "CEP nao localizado." };
    }

    return {
      ok: true,
      provider: appConfig.cepCerto.token ? "cepcerto" : "public-fallback",
      cep,
      city: publicResult.city,
      state: publicResult.state,
      message: appConfig.cepCerto.token ? "CEP validado com fallback publico." : "CEP validado por fallback publico.",
    };
  }
}

export const cepService = new CepService();
