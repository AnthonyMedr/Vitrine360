import { appConfig } from "../config";

export type FiscalProviderStatus = {
  provider: string;
  mode: "manual" | "provider";
  ready: boolean;
  env: string;
  request_timeout_ms: number;
  company_cnpj_configured: boolean;
  missing: string[];
};

export function getFiscalProviderStatus(): FiscalProviderStatus {
  const missing: string[] = [];

  if (appConfig.fiscalProvider !== "manual") {
    if (!appConfig.fiscal.apiUrl) missing.push("FISCAL_API_URL");
    if (!appConfig.fiscal.apiToken) missing.push("FISCAL_API_TOKEN");
    if (!appConfig.fiscal.companyCnpj) missing.push("FISCAL_COMPANY_CNPJ");
  }

  return {
    provider: appConfig.fiscalProvider,
    mode: appConfig.fiscalProvider === "manual" ? "manual" : "provider",
    ready: appConfig.fiscalProvider === "manual" || missing.length === 0,
    env: appConfig.fiscal.env,
    request_timeout_ms: appConfig.fiscal.requestTimeoutMs,
    company_cnpj_configured: Boolean(appConfig.fiscal.companyCnpj),
    missing,
  };
}
