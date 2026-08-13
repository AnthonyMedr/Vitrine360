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
  productName: "GAMEL Digital",
  companyName: "GAMEL Metal",
  signature: "Desenvolvido por InfiniTI Labs.",
  defaultStoreName: "Gamel Distribuidora",
  defaultStoreLegalName: "Garanhuns Metal LTDA",
  defaultStoreCnpj: "64.156.323/0001-51",
  defaultStoreEmail: "comercial@gamelmetal.com",
  defaultStorePhoneNumber: "5587981818752",
  defaultStorePhoneLabel: "(87) 98181-8752",
  defaultStoreAddress:
    "Rua Vereador Paulo Francisco Gomes, SN, Lot. Serra Branca, Quadra II, Lote 7 - Magano, Garanhuns/PE - CEP 55294-770",
  defaultStoreOpeningHours: "Seg a Sex: 8h as 18h | Sabado: 8h as 12h",
  defaultStoreInstitutionalText:
    "Gamel Distribuidora, nome fantasia da Garanhuns Metal LTDA, atua com materiais de construcao, ferragens, ferramentas, vidros, acabamentos e solucoes para obras em Garanhuns/PE.",
  defaultInstagramHandle: "@GAMELMETAL",
  defaultInstagramUrl: "",
  defaultLogoUrl: "/assets/brand/gamel-icon-512.png",
  defaultBrandColor: "#050505",
  defaultActionColor: "#FF7A1A",
  defaultHighlightColor: "#F7B32B",
  defaultBackgroundColor: "#050505",
  publicSiteUrl: readPublicSiteUrl(),
  defaultSeoTitle: "GAMEL Digital - Catalogo e Orcamento Online",
  defaultSeoDescription:
    "Catalogo digital da GAMEL Metal com produtos, carrinho de orcamento e painel administrativo para gestao comercial.",
} as const;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${brandConfig.publicSiteUrl}${normalizedPath}`;
}

export function withStoreTitle(storeName?: string) {
  return storeName ? `${brandConfig.productName} | ${storeName}` : brandConfig.defaultSeoTitle;
}
