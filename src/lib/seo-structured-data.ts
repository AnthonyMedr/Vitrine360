import { absoluteUrl, brandConfig } from "@/config/brand";

type JsonLd = Record<string, unknown>;

type BreadcrumbItem = {
  name: string;
  path: string;
};

type ProductLike = {
  id: string;
  name: string;
  description?: string;
  categoryName?: string;
  image?: string;
  price?: string;
  unit?: string;
};

type CampaignLike = {
  slug: string;
  name: string;
  description?: string;
  banner?: string;
  period?: string;
};

function asAbsoluteUrl(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return absoluteUrl(value.startsWith("/") ? value : `/${value.replace(/^\/+/, "")}`);
}

function sanitizeText(value?: string | null) {
  return value?.trim() || undefined;
}

export function buildJsonLdScripts(items: Array<JsonLd | null | undefined>) {
  return items.filter(Boolean).map((item) => ({
    type: "application/ld+json",
    children: JSON.stringify(item),
  }));
}

export function buildOrganizationJsonLd(input?: {
  storeName?: string;
  description?: string;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: input?.storeName || brandConfig.companyName,
    alternateName: brandConfig.productName,
    url: absoluteUrl("/"),
    description: sanitizeText(input?.description) || brandConfig.defaultSeoDescription,
    ...(input?.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };
}

export function buildWebsiteJsonLd(input?: { description?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: brandConfig.productName,
    url: absoluteUrl("/"),
    description: sanitizeText(input?.description) || brandConfig.defaultSeoDescription,
    publisher: {
      "@id": `${absoluteUrl("/")}#organization`,
    },
    inLanguage: "pt-BR",
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description?: string;
  path: string;
  items?: Array<ProductLike | CampaignLike>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: sanitizeText(input.description) || brandConfig.defaultSeoDescription,
    url: absoluteUrl(input.path),
    isPartOf: {
      "@id": `${absoluteUrl("/")}#website`,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items?.length ?? 0,
      itemListElement: (input.items ?? []).slice(0, 12).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url:
          "id" in item ? absoluteUrl(`/produto/${item.id}`) : absoluteUrl(`/campanha/${item.slug}`),
        name: item.name,
      })),
    },
  };
}

export function buildProductJsonLd(input: ProductLike & { path: string }) {
  const image = asAbsoluteUrl(input.image);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: sanitizeText(input.description) || brandConfig.defaultSeoDescription,
    image: image ? [image] : undefined,
    category: sanitizeText(input.categoryName),
    sku: input.id,
    url: absoluteUrl(input.path),
    brand: {
      "@type": "Brand",
      name: brandConfig.productName,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(input.path),
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "BRL",
        valueAddedTaxIncluded: false,
        ...(sanitizeText(input.price)
          ? { description: input.price }
          : { description: "Sob consulta" }),
        ...(sanitizeText(input.unit) ? { unitText: input.unit } : {}),
      },
    },
  };
}

export function buildCampaignJsonLd(input: CampaignLike & { path: string }) {
  const image = asAbsoluteUrl(input.banner);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: sanitizeText(input.description) || "Campanha comercial do Vitrine360.",
    url: absoluteUrl(input.path),
    image,
    isPartOf: {
      "@id": `${absoluteUrl("/")}#website`,
    },
    about: {
      "@type": "Thing",
      name: input.period || "Campanha comercial",
    },
  };
}

export function buildSpecialAnnouncementJsonLd(input: CampaignLike) {
  if (!input.name) return null;

  return {
    "@context": "https://schema.org",
    "@type": "SpecialAnnouncement",
    name: input.name,
    text: sanitizeText(input.description) || input.name,
    category: "https://schema.org/Announcement",
    url: absoluteUrl(`/campanha/${input.slug}`),
    ...(input.banner ? { image: asAbsoluteUrl(input.banner) } : {}),
  };
}
