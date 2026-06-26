/* eslint-disable @typescript-eslint/no-explicit-any */
import { brandConfig } from "@/config/brand";
import { campaigns as localCampaigns, type Campaign } from "@/data/campaigns";
import { categories as localCategories, type Category } from "@/data/categories";
import { products as localProducts, type Product } from "@/data/products";
import { databaseAdmin } from "@/integrations/postgres/client.server";
import { hasDatabaseAdminAccess } from "@/lib/dev-admin.server";

export type PublicStoreSettings = {
  storeId: string;
  storeName: string;
  whatsappNumber: string;
  address: string;
  openingHours: string;
  instagramUrl: string;
  facebookUrl: string;
  websiteUrl: string;
  institutionalText: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  heroBannerUrl: string | null;
};

export type PublicTotemSettings = {
  welcomeMessage: string;
  introTitle: string;
  introSubtitle: string;
  idleResetSeconds: number;
  primaryQrTarget: string | null;
  heroMediaUrl: string | null;
  showFeaturedProducts: boolean;
  showCampaigns: boolean;
  showCategories: boolean;
  categorySlugs: string[];
  featuredProductSlugs: string[];
  campaignSlugs: string[];
  bannerSlugs: string[];
  status: string;
};

export type PublicVitrineSettings = {
  slideDurationSeconds: number;
  orientation: "paisagem" | "retrato";
  status: string;
  showCampaigns: boolean;
  showFeaturedProducts: boolean;
  showQrCodes: boolean;
  heroMediaUrl: string | null;
  layoutMode: "automatico" | "campanhas" | "produtos" | "misto";
  campaignSlugs: string[];
  productSlugs: string[];
  bannerSlugs: string[];
};

export type PublicBanner = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  ctaLabel: string;
  targetUrl: string | null;
  linkedProductSlug?: string;
  linkedCampaignSlug?: string;
  showOnHome: boolean;
  showOnTotem: boolean;
  showOnVitrine: boolean;
  sortOrder: number;
};

export type PublicSection = {
  id: string;
  title: string;
  subtitle: string;
};

export type PublicCatalogData = {
  store: PublicStoreSettings;
  totem: PublicTotemSettings;
  vitrine: PublicVitrineSettings;
  categories: Category[];
  products: Product[];
  campaigns: Campaign[];
  banners: PublicBanner[];
  sections: PublicSection[];
};

const SECTION_LABELS: Record<string, { title: string; subtitle: string }> = {
  ripados: {
    title: "Ripados",
    subtitle: "Linhas internas e externas para paredes e fachadas",
  },
  "forros-pvc": {
    title: "Forros PVC",
    subtitle: "Leveza, praticidade e leitura comercial limpa",
  },
  "tetos-laminados": {
    title: "Tetos Laminados",
    subtitle: "Acabamento premium para projetos internos",
  },
  "pisos-vinilicos": {
    title: "Pisos Vinilicos",
    subtitle: "Conforto visual e instalacao eficiente",
  },
  "chapas-uv": {
    title: "Chapas UV",
    subtitle: "Superficies sofisticadas para paineis e paredes",
  },
  "perfil-aluminio": {
    title: "Perfil de Aluminio",
    subtitle: "Estrutura, acabamento e composicao tecnica",
  },
  acm: {
    title: "ACM",
    subtitle: "Fachadas, marquises e paineis com presenca premium",
  },
  geral: {
    title: "Catalogo Comercial",
    subtitle: "Produtos e solucoes para operacao comercial digital",
  },
};

const fallbackStore: PublicStoreSettings = {
  storeId: "fallback-store",
  storeName: brandConfig.defaultStoreName,
  whatsappNumber: "5500000000000",
  address: "Av. Principal, 1234 - Centro, Sua Cidade",
  openingHours: "Seg a Sex: 08h-12h e 13h30-17h30 | Sab: 08h-12h",
  instagramUrl: "",
  facebookUrl: "",
  websiteUrl: "",
  institutionalText:
    "Especialistas em ripados, forros PVC, tetos laminados, pisos vinilicos, chapas UV, aluminio e ACM.",
  primaryColor: "#1f2329",
  secondaryColor: "#F26B1F",
  logoUrl: null,
  heroBannerUrl: null,
};

const fallbackTotem: PublicTotemSettings = {
  welcomeMessage: "Toque na categoria para comecar.",
  introTitle: "Totem Interativo",
  introSubtitle: "Explore categorias, campanhas e produtos publicados.",
  idleResetSeconds: 60,
  primaryQrTarget: null,
  heroMediaUrl: null,
  showFeaturedProducts: true,
  showCampaigns: true,
  showCategories: true,
  categorySlugs: [],
  featuredProductSlugs: [],
  campaignSlugs: [],
  bannerSlugs: [],
  status: "ativo",
};

const fallbackVitrine: PublicVitrineSettings = {
  slideDurationSeconds: 8,
  orientation: "paisagem",
  status: "ativo",
  showCampaigns: true,
  showFeaturedProducts: true,
  showQrCodes: true,
  heroMediaUrl: null,
  layoutMode: "automatico",
  campaignSlugs: [],
  productSlugs: [],
  bannerSlugs: [],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapSpecs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { label?: unknown; value?: unknown };
      if (typeof row.label !== "string" || typeof row.value !== "string") return null;
      return { label: row.label, value: row.value };
    })
    .filter(Boolean) as { label: string; value: string }[];
}

function mapEnvironments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { title?: unknown; image?: unknown; description?: unknown };
      if (typeof row.title !== "string" || typeof row.image !== "string") return null;
      return {
        title: row.title,
        image: row.image,
        description: typeof row.description === "string" ? row.description : undefined,
      };
    })
    .filter(Boolean) as { title: string; image: string; description?: string }[];
}

function localFallback(): PublicCatalogData {
  const sections = deriveSections(localProducts);
  return {
    store: fallbackStore,
    totem: fallbackTotem,
    vitrine: fallbackVitrine,
    categories: localCategories,
    products: localProducts,
    campaigns: localCampaigns,
    banners: [],
    sections,
  };
}

function deriveSections(products: Product[]): PublicSection[] {
  const seen = new Set<string>();
  const sections: PublicSection[] = [];
  for (const product of products) {
    const key = product.sectionId || "geral";
    if (seen.has(key)) continue;
    seen.add(key);
    const label = SECTION_LABELS[key] ?? {
      title: key
        .split("-")
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(" "),
      subtitle: "Secao dinamica do catalogo comercial",
    };
    sections.push({ id: key, title: label.title, subtitle: label.subtitle });
  }
  return sections;
}

async function loadDefaultStore() {
  const { data } = await (databaseAdmin as any)
    .from("stores")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

async function loadStoreSettings(storeId: string): Promise<PublicStoreSettings> {
  const { data } = await (databaseAdmin as any)
    .from("store_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  const mediaIds = [data?.logo_media_id, data?.hero_banner_media_id].filter(Boolean);
  const { data: mediaRows } =
    mediaIds.length > 0
      ? await (databaseAdmin as any).from("media_assets").select("*").in("id", mediaIds)
      : { data: [] };
  const mediaById = new Map((mediaRows ?? []).map((row: any) => [row.id, row]));

  return {
    storeId,
    storeName: data?.store_name ?? brandConfig.defaultStoreName,
    whatsappNumber: data?.whatsapp_number ?? fallbackStore.whatsappNumber,
    address: data?.address ?? fallbackStore.address,
    openingHours: data?.opening_hours ?? fallbackStore.openingHours,
    instagramUrl: data?.instagram_url ?? "",
    facebookUrl: data?.facebook_url ?? "",
    websiteUrl: data?.website_url ?? "",
    institutionalText: data?.institutional_text ?? fallbackStore.institutionalText,
    primaryColor: data?.primary_color ?? fallbackStore.primaryColor,
    secondaryColor: data?.secondary_color ?? fallbackStore.secondaryColor,
    logoUrl: data?.logo_media_id ? (mediaById.get(data.logo_media_id)?.file_url ?? null) : null,
    heroBannerUrl: data?.hero_banner_media_id
      ? (mediaById.get(data.hero_banner_media_id)?.file_url ?? null)
      : null,
  };
}

async function loadTotemSettings(storeId: string): Promise<PublicTotemSettings> {
  const { data } = await (databaseAdmin as any)
    .from("totem_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  const { data: heroMedia } = data?.hero_media_id
    ? await (databaseAdmin as any)
        .from("media_assets")
        .select("file_url")
        .eq("id", data.hero_media_id)
        .maybeSingle()
    : { data: null };

  return {
    welcomeMessage: data?.welcome_message ?? fallbackTotem.welcomeMessage,
    introTitle: data?.intro_title ?? fallbackTotem.introTitle,
    introSubtitle: data?.intro_subtitle ?? fallbackTotem.introSubtitle,
    idleResetSeconds: data?.idle_reset_seconds ?? fallbackTotem.idleResetSeconds,
    primaryQrTarget: data?.primary_qr_target ?? fallbackTotem.primaryQrTarget,
    heroMediaUrl: heroMedia?.file_url ?? fallbackTotem.heroMediaUrl,
    showFeaturedProducts: data?.show_featured_products ?? fallbackTotem.showFeaturedProducts,
    showCampaigns: data?.show_campaigns ?? fallbackTotem.showCampaigns,
    showCategories: data?.show_categories ?? fallbackTotem.showCategories,
    categorySlugs: asStringArray(data?.category_slugs),
    featuredProductSlugs: asStringArray(data?.featured_product_slugs),
    campaignSlugs: asStringArray(data?.campaign_slugs),
    bannerSlugs: asStringArray(data?.banner_slugs),
    status: data?.status ?? fallbackTotem.status,
  };
}

async function loadVitrineSettings(storeId: string): Promise<PublicVitrineSettings> {
  const { data } = await (databaseAdmin as any)
    .from("vitrine_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  const { data: heroMedia } = data?.hero_media_id
    ? await (databaseAdmin as any)
        .from("media_assets")
        .select("file_url")
        .eq("id", data.hero_media_id)
        .maybeSingle()
    : { data: null };

  return {
    slideDurationSeconds: data?.slide_duration_seconds ?? fallbackVitrine.slideDurationSeconds,
    orientation: data?.orientation === "retrato" ? "retrato" : "paisagem",
    status: data?.status ?? fallbackVitrine.status,
    showCampaigns: data?.show_campaigns ?? fallbackVitrine.showCampaigns,
    showFeaturedProducts: data?.show_featured_products ?? fallbackVitrine.showFeaturedProducts,
    showQrCodes: data?.show_qr_codes ?? fallbackVitrine.showQrCodes,
    heroMediaUrl: heroMedia?.file_url ?? fallbackVitrine.heroMediaUrl,
    layoutMode:
      data?.layout_mode === "campanhas" ||
      data?.layout_mode === "produtos" ||
      data?.layout_mode === "misto"
        ? data.layout_mode
        : "automatico",
    campaignSlugs: asStringArray(data?.campaign_slugs),
    productSlugs: asStringArray(data?.product_slugs),
    bannerSlugs: asStringArray(data?.banner_slugs),
  };
}

async function loadPublishedBanners(storeId: string): Promise<PublicBanner[]> {
  const { data } = await (databaseAdmin as any)
    .from("banners")
    .select(
      `
      *,
      media_assets:media_asset_id ( file_url )
    `,
    )
    .eq("store_id", storeId)
    .eq("status", "publicado")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
    image: row.media_assets?.file_url ?? "",
    ctaLabel: row.cta_label ?? "",
    targetUrl: row.target_url ?? null,
    linkedProductSlug: row.linked_product_slug ?? undefined,
    linkedCampaignSlug: row.linked_campaign_slug ?? undefined,
    showOnHome: row.show_on_home ?? true,
    showOnTotem: row.show_on_totem ?? false,
    showOnVitrine: row.show_on_vitrine ?? false,
    sortOrder: row.sort_order ?? 0,
  }));
}

async function loadPublishedCategories(storeId: string): Promise<Category[]> {
  const { data } = await (databaseAdmin as any)
    .from("categories")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "publicada")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const mapped = (data ?? []).map((row: any) => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    short: row.short_name || row.name,
  })) as Category[];

  return mapped.length > 0
    ? [{ id: "all", slug: "todos", name: "Todos", short: "Todos" }, ...mapped]
    : [];
}

async function loadPublishedProducts(storeId: string, categories: Category[]): Promise<Product[]> {
  const { data } = await (databaseAdmin as any)
    .from("products")
    .select(
      `
      *,
      categories:category_id ( id, name, slug, short_name ),
      media_assets:primary_media_id ( file_url ),
      product_images (
        image_role,
        sort_order,
        is_primary,
        media_assets:media_asset_id ( file_url, alt_text, title )
      )
    `,
    )
    .eq("store_id", storeId)
    .eq("status", "publicado")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const categoryBySlug = new Map(categories.map((item) => [item.slug, item]));

  return (data ?? []).map((row: any) => {
    const relationCategory = row.categories;
    const categorySlug = relationCategory?.slug ?? "all";
    const categoryName = relationCategory?.name ?? "Sem categoria";
    const relationRows = [...(row.product_images ?? [])].sort(
      (left: any, right: any) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
    );
    const primaryRelation = relationRows.find(
      (item: any) => item.is_primary || item.image_role === "principal",
    );
    const galleryRows = relationRows
      .filter((item: any) => item.image_role !== "tecnica")
      .map((item: any) => item.media_assets?.file_url)
      .filter(Boolean);
    const environmentRows = relationRows
      .filter((item: any) => item.image_role === "ambientacao")
      .map((item: any) => ({
        title: item.media_assets?.title ?? row.name,
        image: item.media_assets?.file_url,
        description: item.media_assets?.alt_text ?? undefined,
      }))
      .filter((item: any) => item.image);
    const primaryImage =
      primaryRelation?.media_assets?.file_url ?? row.media_assets?.file_url ?? galleryRows[0] ?? "";

    return {
      id: row.slug,
      name: row.name,
      categoryId: categoryBySlug.get(categorySlug)?.id ?? categorySlug,
      categoryName,
      description: row.short_description ?? "",
      longDescription: row.description ?? row.short_description ?? "",
      benefits: asStringArray(row.benefits).length > 0 ? asStringArray(row.benefits) : [],
      applications:
        asStringArray(row.applications).length > 0 ? asStringArray(row.applications) : [],
      environments:
        mapEnvironments(row.environments).length > 0
          ? mapEnvironments(row.environments)
          : environmentRows,
      specs: mapSpecs(row.technical_specs).length > 0 ? mapSpecs(row.technical_specs) : [],
      related: [],
      tip: undefined,
      unit: row.unit ?? undefined,
      price: row.price_label ?? "Sob consulta",
      badge: undefined,
      image: primaryImage,
      gallery: galleryRows.length > 0 ? galleryRows : primaryImage ? [primaryImage] : [],
      featured: Boolean(row.is_featured),
      sectionId: row.section_key ?? relationCategory?.slug ?? "geral",
    } satisfies Product;
  }) as Product[];
}

async function loadPublishedCampaigns(storeId: string): Promise<Campaign[]> {
  const { data } = await (databaseAdmin as any)
    .from("campaigns")
    .select(
      `
      *,
      media_assets:banner_media_id ( file_url ),
      campaign_products (
        product_id,
        products:product_id ( slug )
      )
    `,
    )
    .eq("store_id", storeId)
    .in("status", ["publicada", "encerrada"])
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => {
    return {
      slug: row.slug,
      name: row.title,
      tagline: row.subtitle ?? "",
      description: row.description ?? "",
      period:
        row.start_date && row.end_date
          ? `${new Date(row.start_date).toLocaleDateString("pt-BR")} - ${new Date(
              row.end_date,
            ).toLocaleDateString("pt-BR")}`
          : "Vigente",
      banner: row.media_assets?.file_url ?? "",
      status:
        row.status === "publicada"
          ? "publicado"
          : row.status === "encerrada"
            ? "encerrado"
            : "rascunho",
      productIds: (row.campaign_products ?? [])
        .map((item: any) => item.products?.slug)
        .filter(Boolean),
      accent: "action",
      showOnHome: row.show_on_home ?? true,
      showOnTotem: row.show_on_totem ?? true,
      showOnVitrine: row.show_on_vitrine ?? true,
    } satisfies Campaign;
  }) as Campaign[];
}

export async function getResolvedCatalogData(): Promise<PublicCatalogData> {
  if (!hasDatabaseAdminAccess()) return localFallback();

  try {
    const store = await loadDefaultStore();
    if (!store?.id) return localFallback();

    const [storeSettings, totemSettings, vitrineSettings, categories] = await Promise.all([
      loadStoreSettings(store.id),
      loadTotemSettings(store.id),
      loadVitrineSettings(store.id),
      loadPublishedCategories(store.id),
    ]);

    if (categories.length === 0) return localFallback();

    const [products, campaigns, banners] = await Promise.all([
      loadPublishedProducts(store.id, categories),
      loadPublishedCampaigns(store.id),
      loadPublishedBanners(store.id),
    ]);

    return {
      store: storeSettings,
      totem: totemSettings,
      vitrine: vitrineSettings,
      categories,
      products,
      campaigns,
      banners,
      sections: deriveSections(products),
    };
  } catch (error) {
    console.warn("[commercial-data] fallback local ativado:", error);
    return localFallback();
  }
}

export async function getResolvedProductBySlug(slug: string) {
  const data = await getResolvedCatalogData();
  return data.products.find((item) => item.id === slug) ?? null;
}

export async function getResolvedCategoryBySlug(slug: string) {
  const data = await getResolvedCatalogData();
  return data.categories.find((item) => item.slug === slug && item.id !== "all") ?? null;
}

export async function getResolvedCampaignBySlug(slug: string) {
  const data = await getResolvedCatalogData();
  return data.campaigns.find((item) => item.slug === slug) ?? null;
}
