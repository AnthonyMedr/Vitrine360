const fallbackSiteUrl = "http://localhost:3000";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function readPublicSiteUrl() {
  const fromVite = import.meta.env?.VITE_PUBLIC_SITE_URL;
  const fromProcess = process.env.VITE_PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;
  return normalizeSiteUrl(fromVite || fromProcess || fallbackSiteUrl);
}

export const brandConfig = {
  productName: "Vitrine360 - Central Comercial Digital",
  companyName: "InfiniTI Labs",
  signature: "Desenvolvido por InfiniTI Labs.",
  defaultStoreName: "Gamel Distribuidora",
  defaultStoreLegalName: "Garanhuns Metal LTDA",
  defaultStoreCnpj: "64.156.323/0001-51",
  defaultStoreEmail: "gameldistribuidora@hotmail.com",
  defaultStorePhoneNumber: "558781390957",
  defaultStorePhoneLabel: "(87) 8139-0957",
  defaultStoreAddress:
    "Rua Vereador Paulo Francisco Gomes, SN, Lot. Serra Branca, Quadra II, Lote 7 - Magano, Garanhuns/PE - CEP 55294-770",
  defaultStoreOpeningHours: "Seg a Sex: 08h-12h e 13h30-17h30 | Sab: 08h-12h",
  defaultStoreInstitutionalText:
    "Gamel Distribuidora, nome fantasia da Garanhuns Metal LTDA, atua com materiais de construcao, ferragens, ferramentas, vidros, acabamentos e solucoes para obras em Garanhuns/PE.",
  defaultInstagramHandle: "",
  defaultInstagramUrl: "",
  defaultLogoUrl: "/brands/gamel-logo.png",
  defaultBrandColor: "#232323",
  defaultActionColor: "#FF944D",
  defaultHighlightColor: "#666666",
  defaultBackgroundColor: "#050505",
  publicSiteUrl: readPublicSiteUrl(),
  defaultSeoTitle: "Vitrine360 - Central Comercial Digital",
  defaultSeoDescription:
    "Catalogo digital da Gamel Distribuidora para materiais de construcao, acabamentos, campanhas, WhatsApp, totem e vitrine em TV.",
} as const;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${brandConfig.publicSiteUrl}${normalizedPath}`;
}

export function withStoreTitle(storeName?: string) {
  return storeName ? `${brandConfig.productName} | ${storeName}` : brandConfig.defaultSeoTitle;
}
