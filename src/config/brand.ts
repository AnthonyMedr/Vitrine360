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
  defaultStoreName: "Gamel Metal",
  defaultInstagramHandle: "@gamel",
  defaultInstagramUrl: "",
  defaultLogoUrl: "/brands/gamel-logo.png",
  defaultBrandColor: "#232323",
  defaultActionColor: "#FF944D",
  defaultHighlightColor: "#666666",
  defaultBackgroundColor: "#050505",
  publicSiteUrl: readPublicSiteUrl(),
  defaultSeoTitle: "Vitrine360 - Central Comercial Digital",
  defaultSeoDescription:
    "Central Comercial Digital desenvolvida pela InfiniTI Labs para catalogo, campanhas, WhatsApp, IA, totem, vitrine em TV, SEO e analytics.",
} as const;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${brandConfig.publicSiteUrl}${normalizedPath}`;
}

export function withStoreTitle(storeName?: string) {
  return storeName ? `${brandConfig.productName} | ${storeName}` : brandConfig.defaultSeoTitle;
}
