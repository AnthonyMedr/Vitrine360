import { appConfig } from "../config";

export type ErpProviderStatus = {
  provider: string;
  mode: "local" | "provider";
  ready: boolean;
  sync_enabled: boolean;
  request_timeout_ms: number;
  missing: string[];
};

export function getErpProviderStatus(): ErpProviderStatus {
  const missing: string[] = [];

  if (appConfig.erpProvider !== "none") {
    if (!appConfig.erp.apiUrl) missing.push("ERP_API_URL");
    if (!appConfig.erp.apiToken) missing.push("ERP_API_TOKEN");
  }

  return {
    provider: appConfig.erpProvider,
    mode: appConfig.erpProvider === "none" ? "local" : "provider",
    ready: appConfig.erpProvider === "none" || missing.length === 0,
    sync_enabled: appConfig.erp.syncEnabled,
    request_timeout_ms: appConfig.erp.requestTimeoutMs,
    missing,
  };
}
