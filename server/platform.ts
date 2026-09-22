export type PlatformModuleKey = "PLATFORM" | "P1" | "P2" | "P3" | "M1" | "CORE" | "M2" | "M3";

export type PlatformModuleStatus = "active" | "homologation" | "planned" | "disabled";

export type PlatformModuleRegistryEntry = {
  key: PlatformModuleKey;
  name: string;
  version: string;
  status: PlatformModuleStatus;
  profile: string | null;
  requiredDependencies: PlatformModuleKey[];
  optionalDependencies: PlatformModuleKey[];
  public: boolean;
  capabilities?: string[];
};

export const activeModuleRegistry: { schemaVersion: number; platform: string; modules: PlatformModuleRegistryEntry[] } = {
  schemaVersion: 1,
  platform: "GAMEL Digital",
  modules: [
    { key: "PLATFORM", name: "Nucleo Tecnico Compartilhado", version: "1.0.0", status: "active", profile: "base", requiredDependencies: [], optionalDependencies: [], public: false },
    { key: "P1", name: "Site Institucional", version: "1.0.0", status: "active", profile: "release-1", requiredDependencies: ["PLATFORM"], optionalDependencies: [], public: true },
    { key: "P2", name: "Catalogo Inteligente", version: "1.0.0", status: "active", profile: "public-no-price", requiredDependencies: ["PLATFORM"], optionalDependencies: [], public: true },
    { key: "P3", name: "Painel Administrativo", version: "1.0.0", status: "active", profile: "simple", requiredDependencies: ["PLATFORM", "P1", "P2"], optionalDependencies: ["M1"], public: false },
    {
      key: "M1",
      name: "Carrinho de Orcamento Essencial",
      version: "1.0.0",
      status: process.env.MODULE_M1_ENABLED === "false" ? "disabled" : "homologation",
      profile: process.env.MODULE_M1_PROFILE || "essential",
      requiredDependencies: ["PLATFORM", "P2", "P3"],
      optionalDependencies: ["CORE", "M2", "M3"],
      public: true,
      capabilities: [
        "quote_cart.create_local",
        "quote_cart.item.manage",
        "quote_request.submit_public",
        "quote_request.protocol.read",
        "quote_request.manage_admin",
        "quote_request.status.update",
        "quote_request.responsible.assign",
        "quote_request.whatsapp_handoff",
      ],
    },
    { key: "CORE", name: "Fundacao Comercial B2B", version: "0.0.0", status: "planned", profile: null, requiredDependencies: ["PLATFORM", "P2", "P3"], optionalDependencies: [], public: false },
  ],
};

export function isModuleEnabled(key: PlatformModuleKey) {
  if (key === "CORE" || key === "M2" || key === "M3") return false;
  if (key === "M1") return process.env.MODULE_M1_ENABLED !== "false";
  const envValue = process.env[`MODULE_${key}_ENABLED`];
  return envValue !== "false";
}

export function getM1Profile() {
  return process.env.MODULE_M1_PROFILE || "essential";
}
