/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/integrations/auth/auth-middleware";
import { databaseAdmin } from "@/integrations/postgres/client.server";
import {
  getResolvedCampaignBySlug,
  getResolvedCatalogData,
  getResolvedCategoryBySlug,
  getResolvedProductBySlug,
} from "@/lib/commercial-data.server";
import { campaigns as localCampaigns } from "@/data/campaigns";
import { categories as localCategories } from "@/data/categories";
import { products as localProducts } from "@/data/products";

function slugify(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function cleanText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function ensureStoreCapability(
  userId: string,
  requestedStoreId: string | null | undefined,
  capability:
    | "view_dashboard"
    | "manage_products"
    | "manage_categories"
    | "manage_campaigns"
    | "manage_banners"
    | "manage_media"
    | "manage_store"
    | "manage_totem"
    | "manage_vitrine"
    | "manage_users"
    | "view_reports"
    | "manage_technical",
) {
  const { assertCapability, resolveStoreScope } = await import("@/lib/admin-access.server");
  const storeId = await resolveStoreScope(userId, requestedStoreId);
  if (!storeId) throw new Error("Nenhuma loja configurada.");
  await assertCapability(userId, capability, storeId);
  return storeId;
}

function cleanRole(value: unknown) {
  const role = cleanText(value, 60);
  if (
    ["admin", "infiniti_master", "store_admin", "commercial_operator", "editor", "viewer"].includes(
      role,
    )
  ) {
    return role;
  }
  return "viewer";
}

async function getDefaultStoreIdSafe() {
  const { getDefaultStoreId } = await import("@/lib/admin-access.server");
  return getDefaultStoreId();
}

async function writeAuditLogSafe(input: {
  storeId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/lib/admin-access.server");
  return writeAuditLog(input);
}

async function getUserCapabilitiesSafe(userId: string, storeId?: string | null) {
  const { getUserCapabilities } = await import("@/lib/admin-access.server");
  return getUserCapabilities(userId, storeId);
}

async function getRoleCapabilityMapSafe() {
  const { getRoleCapabilityMap } = await import("@/lib/admin-access.server");
  return getRoleCapabilityMap();
}

async function assertCapabilitySafe(
  userId: string,
  capability:
    | "view_dashboard"
    | "manage_products"
    | "manage_categories"
    | "manage_campaigns"
    | "manage_banners"
    | "manage_media"
    | "manage_store"
    | "manage_totem"
    | "manage_vitrine"
    | "manage_users"
    | "view_reports"
    | "manage_technical",
) {
  const { assertCapability } = await import("@/lib/admin-access.server");
  return assertCapability(userId, capability);
}

async function assertRoleSafe(userId: string, roles: readonly string[]) {
  const { assertRole } = await import("@/lib/admin-access.server");
  return assertRole(userId, roles);
}

export const getPublicStorefront = createServerFn({ method: "GET" }).handler(async () => {
  return getResolvedCatalogData();
});

export const getPublicProduct = createServerFn({ method: "POST" })
  .validator((input: { slug: string }) => ({ slug: cleanText(input.slug, 200) }))
  .handler(async ({ data }) => {
    return getResolvedProductBySlug(data.slug);
  });

export const getPublicCategory = createServerFn({ method: "POST" })
  .validator((input: { slug: string }) => ({ slug: cleanText(input.slug, 200) }))
  .handler(async ({ data }) => {
    return getResolvedCategoryBySlug(data.slug);
  });

export const getPublicCampaign = createServerFn({ method: "POST" })
  .validator((input: { slug: string }) => ({ slug: cleanText(input.slug, 200) }))
  .handler(async ({ data }) => {
    return getResolvedCampaignBySlug(data.slug);
  });

export const listCategoriesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null; includeArchived?: boolean } | undefined) => ({
    storeId: input?.storeId ?? null,
    includeArchived: Boolean(input?.includeArchived),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    let query = (databaseAdmin as any)
      .from("categories")
      .select(
        `
        *,
        media_assets:image_media_id ( file_url ),
        products:products(count)
      `,
      )
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!data.includeArchived) {
      query = query.neq("status", "arquivada");
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], storeId };
  });

export const saveCategoryAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    id: input?.id ? String(input.id) : undefined,
    storeId: input?.storeId ?? null,
    name: cleanText(input?.name, 200),
    slug: cleanText(input?.slug, 200),
    description: cleanText(input?.description, 2000),
    imageMediaId: input?.imageMediaId ? String(input.imageMediaId) : null,
    seoTitle: cleanText(input?.seoTitle, 200),
    seoDescription: cleanText(input?.seoDescription, 500),
    status: ["publicada", "inativa", "arquivada"].includes(input?.status)
      ? input.status
      : "publicada",
    sortOrder: Number.isFinite(input?.sortOrder) ? Number(input.sortOrder) : 0,
    shortName: cleanText(input?.shortName, 80),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_categories");
    const payload = {
      store_id: storeId,
      name: data.name,
      slug: data.slug || slugify(data.name),
      short_name: data.shortName || data.name,
      description: data.description || null,
      image_media_id: data.imageMediaId,
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      status: data.status,
      sort_order: data.sortOrder,
      created_by: context.userId,
      updated_by: context.userId,
    };

    const query = data.id
      ? (databaseAdmin as any).from("categories").update(payload).eq("id", data.id)
      : (databaseAdmin as any).from("categories").insert(payload);
    const { data: row, error } = await query.select().single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: data.id ? "category.updated" : "category.created",
      entityType: "category",
      entityId: row.id,
      metadata: { slug: row.slug, status: row.status },
    });
    return row;
  });

export const listProductsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    (
      input:
        | { storeId?: string | null; status?: string | null; includeArchived?: boolean }
        | undefined,
    ) => ({
      storeId: input?.storeId ?? null,
      status: input?.status ?? null,
      includeArchived: Boolean(input?.includeArchived),
    }),
  )
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    let query = (databaseAdmin as any)
      .from("products")
      .select(
        `
        *,
        categories:category_id ( id, name, slug ),
        media_assets:primary_media_id ( file_url ),
        product_images (
          media_asset_id,
          image_role,
          sort_order,
          is_primary
        )
      `,
      )
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!data.includeArchived) {
      query = query.neq("status", "arquivado");
    }
    if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], storeId };
  });

export const saveProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    id: input?.id ? String(input.id) : undefined,
    storeId: input?.storeId ?? null,
    categoryId: input?.categoryId ? String(input.categoryId) : null,
    primaryMediaId: input?.primaryMediaId ? String(input.primaryMediaId) : null,
    name: cleanText(input?.name, 200),
    slug: cleanText(input?.slug, 200),
    shortDescription: cleanText(input?.shortDescription, 300),
    description: cleanText(input?.description, 5000),
    technicalSpecs: Array.isArray(input?.technicalSpecs) ? input.technicalSpecs.slice(0, 30) : [],
    benefits: cleanStringArray(input?.benefits),
    applications: cleanStringArray(input?.applications),
    environments: Array.isArray(input?.environments) ? input.environments.slice(0, 20) : [],
    tags: cleanStringArray(input?.tags),
    whatsappMessage: cleanText(input?.whatsappMessage, 1000),
    seoTitle: cleanText(input?.seoTitle, 200),
    seoDescription: cleanText(input?.seoDescription, 500),
    status: ["rascunho", "publicado", "inativo", "arquivado"].includes(input?.status)
      ? input.status
      : "rascunho",
    isFeatured: Boolean(input?.isFeatured),
    sortOrder: Number.isFinite(input?.sortOrder) ? Number(input.sortOrder) : 0,
    unit: cleanText(input?.unit, 20),
    priceLabel: cleanText(input?.priceLabel, 60),
    sectionKey: cleanText(input?.sectionKey, 60),
    mediaRelations: Array.isArray(input?.mediaRelations)
      ? input.mediaRelations
          .map((item: any, index: number) => ({
            mediaAssetId: item?.mediaAssetId ? String(item.mediaAssetId) : "",
            imageRole: cleanText(item?.imageRole, 40) || "galeria",
            sortOrder: Number.isFinite(item?.sortOrder) ? Number(item.sortOrder) : index,
            isPrimary: Boolean(item?.isPrimary),
          }))
          .filter((item: any) => item.mediaAssetId)
      : [],
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_products");
    const payload = {
      store_id: storeId,
      category_id: data.categoryId,
      primary_media_id: data.primaryMediaId,
      name: data.name,
      slug: data.slug || slugify(data.name),
      short_description: data.shortDescription || null,
      description: data.description || null,
      technical_specs: data.technicalSpecs ?? [],
      benefits: data.benefits,
      applications: data.applications,
      environments: data.environments ?? [],
      tags: data.tags,
      whatsapp_message: data.whatsappMessage || null,
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      status: data.status,
      is_featured: data.isFeatured,
      sort_order: data.sortOrder,
      unit: data.unit || null,
      price_label: data.priceLabel || null,
      section_key: data.sectionKey || null,
      created_by: context.userId,
      updated_by: context.userId,
      published_at: data.status === "publicado" ? new Date().toISOString() : null,
      archived_at: data.status === "arquivado" ? new Date().toISOString() : null,
    };

    const query = data.id
      ? (databaseAdmin as any).from("products").update(payload).eq("id", data.id)
      : (databaseAdmin as any).from("products").insert(payload);

    const { data: row, error } = await query.select().single();
    if (error) throw new Error(error.message);

    await (databaseAdmin as any).from("product_images").delete().eq("product_id", row.id);
    const relationRows = data.mediaRelations
      .filter((item: any) =>
        ["principal", "galeria", "ambientacao", "tecnica", "totem", "vitrine"].includes(
          item.imageRole,
        ),
      )
      .map((item: any, index: number) => ({
        product_id: row.id,
        media_asset_id: item.mediaAssetId,
        image_role: item.imageRole,
        sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
        is_primary: Boolean(item.isPrimary || item.imageRole === "principal"),
      }));
    if (relationRows.length > 0) {
      await (databaseAdmin as any).from("product_images").insert(relationRows);
    }

    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: data.id ? "product.updated" : "product.created",
      entityType: "product",
      entityId: row.id,
      metadata: {
        slug: row.slug,
        status: row.status,
        mediaRelations: relationRows.length,
      },
    });

    return row;
  });

export const listCampaignsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null; includeArchived?: boolean } | undefined) => ({
    storeId: input?.storeId ?? null,
    includeArchived: Boolean(input?.includeArchived),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    let query = (databaseAdmin as any)
      .from("campaigns")
      .select(
        `
        *,
        media_assets:banner_media_id ( file_url ),
        campaign_products (
          product_id,
          products:product_id ( slug, name )
        )
      `,
      )
      .eq("store_id", storeId)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!data.includeArchived) {
      query = query.neq("status", "arquivada");
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], storeId };
  });

export const saveCampaignAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    id: input?.id ? String(input.id) : undefined,
    storeId: input?.storeId ?? null,
    title: cleanText(input?.title, 200),
    slug: cleanText(input?.slug, 200),
    subtitle: cleanText(input?.subtitle, 300),
    description: cleanText(input?.description, 5000),
    bannerMediaId: input?.bannerMediaId ? String(input.bannerMediaId) : null,
    ctaLabel: cleanText(input?.ctaLabel, 80),
    whatsappMessage: cleanText(input?.whatsappMessage, 1000),
    startDate: input?.startDate ? String(input.startDate) : null,
    endDate: input?.endDate ? String(input.endDate) : null,
    status: ["rascunho", "agendada", "publicada", "encerrada", "arquivada"].includes(input?.status)
      ? input.status
      : "rascunho",
    isFeatured: Boolean(input?.isFeatured),
    showOnHome: Boolean(input?.showOnHome),
    showOnTotem: Boolean(input?.showOnTotem),
    showOnVitrine: Boolean(input?.showOnVitrine),
    seoTitle: cleanText(input?.seoTitle, 200),
    seoDescription: cleanText(input?.seoDescription, 500),
    productIds: cleanStringArray(input?.productIds),
    galleryMediaIds: cleanStringArray(input?.galleryMediaIds),
    totemMediaId: input?.totemMediaId ? String(input.totemMediaId) : null,
    vitrineMediaId: input?.vitrineMediaId ? String(input.vitrineMediaId) : null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_campaigns");
    const payload = {
      store_id: storeId,
      title: data.title,
      slug: data.slug || slugify(data.title),
      subtitle: data.subtitle || null,
      description: data.description || null,
      banner_media_id: data.bannerMediaId,
      cta_label: data.ctaLabel || null,
      whatsapp_message: data.whatsappMessage || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      status: data.status,
      is_featured: data.isFeatured,
      show_on_home: data.showOnHome,
      show_on_totem: data.showOnTotem,
      show_on_vitrine: data.showOnVitrine,
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      gallery_media_ids: data.galleryMediaIds,
      totem_media_id: data.totemMediaId,
      vitrine_media_id: data.vitrineMediaId,
      created_by: context.userId,
      updated_by: context.userId,
      published_at: data.status === "publicada" ? new Date().toISOString() : null,
      archived_at: data.status === "arquivada" ? new Date().toISOString() : null,
    };

    const query = data.id
      ? (databaseAdmin as any).from("campaigns").update(payload).eq("id", data.id)
      : (databaseAdmin as any).from("campaigns").insert(payload);
    const { data: row, error } = await query.select().single();
    if (error) throw new Error(error.message);

    await (databaseAdmin as any).from("campaign_products").delete().eq("campaign_id", row.id);
    if (data.productIds.length > 0) {
      const productRows = await (databaseAdmin as any)
        .from("products")
        .select("id, slug")
        .eq("store_id", storeId)
        .in("slug", data.productIds);
      const rows = (productRows.data ?? []).map((item: any, index: number) => ({
        campaign_id: row.id,
        product_id: item.id,
        sort_order: index,
      }));
      if (rows.length > 0) {
        await (databaseAdmin as any).from("campaign_products").insert(rows);
      }
    }

    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: data.id ? "campaign.updated" : "campaign.created",
      entityType: "campaign",
      entityId: row.id,
      metadata: {
        slug: row.slug,
        status: row.status,
        linkedProducts: data.productIds.length,
        galleryMedia: data.galleryMediaIds.length,
      },
    });

    return row;
  });

export const listMediaAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    (
      input: { storeId?: string | null; type?: string | null; status?: string | null } | undefined,
    ) => ({
      storeId: input?.storeId ?? null,
      type: input?.type ?? null,
      status: input?.status ?? null,
    }),
  )
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    let query = (databaseAdmin as any)
      .from("media_assets")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (data.type) query = query.eq("type", data.type);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const mediaIds = (rows ?? []).map((item: any) => item.id);
    const [
      productsResult,
      productImagesResult,
      campaignsResult,
      bannersResult,
      storeSettingsResult,
    ] =
      mediaIds.length > 0
        ? await Promise.all([
            (databaseAdmin as any)
              .from("products")
              .select("id, name, slug, primary_media_id")
              .eq("store_id", storeId),
            (databaseAdmin as any)
              .from("product_images")
              .select("product_id, media_asset_id, image_role, sort_order"),
            (databaseAdmin as any)
              .from("campaigns")
              .select(
                "id, title, slug, banner_media_id, totem_media_id, vitrine_media_id, gallery_media_ids",
              )
              .eq("store_id", storeId),
            (databaseAdmin as any)
              .from("banners")
              .select("id, title, slug, media_asset_id")
              .eq("store_id", storeId),
            (databaseAdmin as any)
              .from("store_settings")
              .select("logo_media_id, hero_banner_media_id")
              .eq("store_id", storeId)
              .maybeSingle(),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: null }];

    const productById = new Map((productsResult.data ?? []).map((item: any) => [item.id, item]));
    const usageByMediaId = new Map<string, string[]>();
    const addUsage = (mediaId: string | null | undefined, label: string) => {
      if (!mediaId) return;
      const current = usageByMediaId.get(mediaId) ?? [];
      current.push(label);
      usageByMediaId.set(mediaId, current);
    };

    for (const product of productsResult.data ?? []) {
      addUsage(product.primary_media_id, `Produto principal: ${product.name}`);
    }
    for (const relation of productImagesResult.data ?? []) {
      const product = productById.get(relation.product_id);
      addUsage(
        relation.media_asset_id,
        `Produto ${relation.image_role ?? "galeria"}: ${product?.name ?? relation.product_id}`,
      );
    }
    for (const campaign of campaignsResult.data ?? []) {
      addUsage(campaign.banner_media_id, `Campanha banner: ${campaign.title}`);
      addUsage(campaign.totem_media_id, `Campanha totem: ${campaign.title}`);
      addUsage(campaign.vitrine_media_id, `Campanha vitrine: ${campaign.title}`);
      for (const mediaId of campaign.gallery_media_ids ?? []) {
        addUsage(mediaId, `Campanha galeria: ${campaign.title}`);
      }
    }
    for (const banner of bannersResult.data ?? []) {
      addUsage(banner.media_asset_id, `Banner: ${banner.title}`);
    }
    addUsage(storeSettingsResult.data?.logo_media_id, "Logo da loja");
    addUsage(storeSettingsResult.data?.hero_banner_media_id, "Hero institucional");

    return {
      items: (rows ?? []).map((item: any) => ({
        ...item,
        usages: usageByMediaId.get(item.id) ?? [],
      })),
      storeId,
    };
  });

export const saveMediaMetadataAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    id: input?.id ? String(input.id) : undefined,
    storeId: input?.storeId ?? null,
    fileName: cleanText(input?.fileName, 255),
    originalFileName: cleanText(input?.originalFileName, 255),
    fileUrl: cleanText(input?.fileUrl, 2000),
    storagePath: cleanText(input?.storagePath, 500),
    mimeType: cleanText(input?.mimeType, 120),
    size: Number.isFinite(input?.size) ? Number(input.size) : 0,
    width: Number.isFinite(input?.width) ? Number(input.width) : null,
    height: Number.isFinite(input?.height) ? Number(input.height) : null,
    type: cleanText(input?.type, 60),
    title: cleanText(input?.title, 200),
    altText: cleanText(input?.altText, 200),
    description: cleanText(input?.description, 1000),
    tags: cleanStringArray(input?.tags),
    status: ["rascunho", "publicado", "arquivado"].includes(input?.status)
      ? input.status
      : "rascunho",
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_media");
    const payload = {
      store_id: storeId,
      file_name: data.fileName,
      original_file_name: data.originalFileName || data.fileName,
      file_url: data.fileUrl,
      storage_path: data.storagePath,
      mime_type: data.mimeType,
      size: data.size,
      width: data.width,
      height: data.height,
      type: data.type,
      title: data.title || null,
      alt_text: data.altText || null,
      description: data.description || null,
      tags: data.tags,
      status: data.status,
      created_by: context.userId,
      updated_by: context.userId,
      archived_at: data.status === "arquivado" ? new Date().toISOString() : null,
    };
    const query = data.id
      ? (databaseAdmin as any).from("media_assets").update(payload).eq("id", data.id)
      : (databaseAdmin as any).from("media_assets").insert(payload);
    const { data: row, error } = await query.select().single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: data.id ? "media.updated" : "media.uploaded",
      entityType: "media_asset",
      entityId: row.id,
      metadata: { storagePath: row.storage_path, type: row.type, status: row.status },
    });
    return row;
  });

export const getStoreSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    const { data: row, error } = await (databaseAdmin as any)
      .from("store_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: row, storeId };
  });

export const saveStoreSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    storeId: input?.storeId ?? null,
    storeName: cleanText(input?.storeName, 200),
    logoMediaId: input?.logoMediaId ? String(input.logoMediaId) : null,
    whatsappNumber: cleanText(input?.whatsappNumber, 40),
    address: cleanText(input?.address, 500),
    openingHours: cleanText(input?.openingHours, 500),
    instagramUrl: cleanText(input?.instagramUrl, 300),
    facebookUrl: cleanText(input?.facebookUrl, 300),
    websiteUrl: cleanText(input?.websiteUrl, 300),
    institutionalText: cleanText(input?.institutionalText, 3000),
    primaryColor: cleanText(input?.primaryColor, 20),
    secondaryColor: cleanText(input?.secondaryColor, 20),
    seoTitle: cleanText(input?.seoTitle, 200),
    seoDescription: cleanText(input?.seoDescription, 500),
    heroBannerMediaId: input?.heroBannerMediaId ? String(input.heroBannerMediaId) : null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_store");
    await (databaseAdmin as any).from("stores").update({ name: data.storeName }).eq("id", storeId);
    const payload = {
      store_id: storeId,
      store_name: data.storeName,
      logo_media_id: data.logoMediaId,
      whatsapp_number: data.whatsappNumber || null,
      address: data.address || null,
      opening_hours: data.openingHours || null,
      instagram_url: data.instagramUrl || null,
      facebook_url: data.facebookUrl || null,
      website_url: data.websiteUrl || null,
      institutional_text: data.institutionalText || null,
      primary_color: data.primaryColor || null,
      secondary_color: data.secondaryColor || null,
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      hero_banner_media_id: data.heroBannerMediaId,
      updated_by: context.userId,
    };
    const { data: row, error } = await (databaseAdmin as any)
      .from("store_settings")
      .upsert(payload, { onConflict: "store_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: "store_settings.updated",
      entityType: "store_settings",
      entityId: storeId,
    });
    return row;
  });

export const getTotemSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    const { data: row, error } = await (databaseAdmin as any)
      .from("totem_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: row, storeId };
  });

export const saveTotemSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    storeId: input?.storeId ?? null,
    welcomeMessage: cleanText(input?.welcomeMessage, 500),
    introTitle: cleanText(input?.introTitle, 120),
    introSubtitle: cleanText(input?.introSubtitle, 240),
    idleResetSeconds: Number.isFinite(input?.idleResetSeconds)
      ? Number(input.idleResetSeconds)
      : 60,
    primaryQrTarget: cleanText(input?.primaryQrTarget, 1000),
    heroMediaId: input?.heroMediaId ? String(input.heroMediaId) : null,
    showFeaturedProducts: Boolean(input?.showFeaturedProducts),
    showCampaigns: Boolean(input?.showCampaigns),
    showCategories: Boolean(input?.showCategories),
    categorySlugs: cleanStringArray(input?.categorySlugs),
    featuredProductSlugs: cleanStringArray(input?.featuredProductSlugs),
    campaignSlugs: cleanStringArray(input?.campaignSlugs),
    bannerSlugs: cleanStringArray(input?.bannerSlugs),
    status: cleanText(input?.status, 40) || "ativo",
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_totem");
    const payload = {
      store_id: storeId,
      welcome_message: data.welcomeMessage || null,
      intro_title: data.introTitle || null,
      intro_subtitle: data.introSubtitle || null,
      idle_reset_seconds: Math.max(30, Math.min(600, data.idleResetSeconds)),
      primary_qr_target: data.primaryQrTarget || null,
      hero_media_id: data.heroMediaId,
      show_featured_products: data.showFeaturedProducts,
      show_campaigns: data.showCampaigns,
      show_categories: data.showCategories,
      category_slugs: data.categorySlugs,
      featured_product_slugs: data.featuredProductSlugs,
      campaign_slugs: data.campaignSlugs,
      banner_slugs: data.bannerSlugs,
      status: data.status,
    };
    const { data: row, error } = await (databaseAdmin as any)
      .from("totem_settings")
      .upsert(payload, { onConflict: "store_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: "totem_settings.updated",
      entityType: "totem_settings",
      entityId: row.id,
    });
    return row;
  });

export const getVitrineSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    const { data: row, error } = await (databaseAdmin as any)
      .from("vitrine_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { item: row, storeId };
  });

export const saveVitrineSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    storeId: input?.storeId ?? null,
    slideDurationSeconds: Number.isFinite(input?.slideDurationSeconds)
      ? Number(input.slideDurationSeconds)
      : 8,
    orientation: ["paisagem", "retrato"].includes(input?.orientation)
      ? input.orientation
      : "paisagem",
    status: cleanText(input?.status, 40) || "ativo",
    showCampaigns: Boolean(input?.showCampaigns),
    showFeaturedProducts: Boolean(input?.showFeaturedProducts),
    showQrCodes: Boolean(input?.showQrCodes),
    heroMediaId: input?.heroMediaId ? String(input.heroMediaId) : null,
    layoutMode: ["automatico", "campanhas", "produtos", "misto"].includes(input?.layoutMode)
      ? input.layoutMode
      : "automatico",
    campaignSlugs: cleanStringArray(input?.campaignSlugs),
    productSlugs: cleanStringArray(input?.productSlugs),
    bannerSlugs: cleanStringArray(input?.bannerSlugs),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_vitrine");
    const payload = {
      store_id: storeId,
      slide_duration_seconds: Math.max(4, Math.min(60, data.slideDurationSeconds)),
      orientation: data.orientation,
      status: data.status,
      show_campaigns: data.showCampaigns,
      show_featured_products: data.showFeaturedProducts,
      show_qr_codes: data.showQrCodes,
      hero_media_id: data.heroMediaId,
      layout_mode: data.layoutMode,
      campaign_slugs: data.campaignSlugs,
      product_slugs: data.productSlugs,
      banner_slugs: data.bannerSlugs,
    };
    const { data: row, error } = await (databaseAdmin as any)
      .from("vitrine_settings")
      .upsert(payload, { onConflict: "store_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: "vitrine_settings.updated",
      entityType: "vitrine_settings",
      entityId: row.id,
    });
    return row;
  });

export const listUsersAndRolesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_users");

    const usersResponse = await (databaseAdmin as any).auth.admin.listUsers();
    const users = usersResponse.data?.users ?? [];
    const { data: roles, error } = await (databaseAdmin as any)
      .from("user_roles")
      .select("id, user_id, role, store_id, created_at");
    if (error) throw new Error(error.message);

    return {
      items: users.map((user: any) => ({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        roles: (roles ?? []).filter((role: any) => role.user_id === user.id),
      })),
      profile: await getUserCapabilitiesSafe(context.userId, storeId),
      capabilityMatrix: await getRoleCapabilityMapSafe(),
      storeId,
    };
  });

export const getAdminProfileAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    const profile = await getUserCapabilitiesSafe(context.userId, storeId);

    return {
      email: context.claims?.email ?? null,
      userId: context.userId,
      storeId,
      roles: profile.roles,
      capabilities: profile.capabilities,
    };
  });

export const assignUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    storeId: input?.storeId ?? null,
    userId: cleanText(input?.userId, 120),
    role: cleanRole(input?.role),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_users");
    const payload = {
      user_id: data.userId,
      role: data.role,
      store_id: storeId,
      created_by: context.userId,
    };
    const { data: row, error } = await (databaseAdmin as any)
      .from("user_roles")
      .upsert(payload, { onConflict: "user_id,role,store_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: "user_role.assigned",
      entityType: "user_role",
      entityId: row.id,
      metadata: { targetUserId: data.userId, role: data.role },
    });
    return row;
  });

export const listBannersAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null; includeArchived?: boolean } | undefined) => ({
    storeId: input?.storeId ?? null,
    includeArchived: Boolean(input?.includeArchived),
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "view_dashboard");
    let query = (databaseAdmin as any)
      .from("banners")
      .select(
        `
        *,
        media_assets:media_asset_id ( file_url, alt_text, title )
      `,
      )
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });

    if (!data.includeArchived) {
      query = query.neq("status", "arquivado");
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], storeId };
  });

export const saveBannerAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: any) => ({
    id: input?.id ? String(input.id) : undefined,
    storeId: input?.storeId ?? null,
    title: cleanText(input?.title, 200),
    slug: cleanText(input?.slug, 200),
    subtitle: cleanText(input?.subtitle, 240),
    description: cleanText(input?.description, 2000),
    mediaAssetId: input?.mediaAssetId ? String(input.mediaAssetId) : null,
    ctaLabel: cleanText(input?.ctaLabel, 80),
    targetUrl: cleanText(input?.targetUrl, 600),
    linkedProductSlug: cleanText(input?.linkedProductSlug, 200),
    linkedCampaignSlug: cleanText(input?.linkedCampaignSlug, 200),
    showOnHome: Boolean(input?.showOnHome),
    showOnTotem: Boolean(input?.showOnTotem),
    showOnVitrine: Boolean(input?.showOnVitrine),
    startsAt: input?.startsAt ? String(input.startsAt) : null,
    endsAt: input?.endsAt ? String(input.endsAt) : null,
    status: ["rascunho", "publicado", "arquivado"].includes(input?.status)
      ? input.status
      : "rascunho",
    sortOrder: Number.isFinite(input?.sortOrder) ? Number(input.sortOrder) : 0,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await ensureStoreCapability(context.userId, data.storeId, "manage_banners");
    const payload = {
      store_id: storeId,
      title: data.title,
      slug: data.slug || slugify(data.title),
      subtitle: data.subtitle || null,
      description: data.description || null,
      media_asset_id: data.mediaAssetId,
      cta_label: data.ctaLabel || null,
      target_url: data.targetUrl || null,
      linked_product_slug: data.linkedProductSlug || null,
      linked_campaign_slug: data.linkedCampaignSlug || null,
      show_on_home: data.showOnHome,
      show_on_totem: data.showOnTotem,
      show_on_vitrine: data.showOnVitrine,
      starts_at: data.startsAt || null,
      ends_at: data.endsAt || null,
      placement: data.showOnVitrine ? "vitrine" : data.showOnTotem ? "totem" : "home",
      status: data.status,
      sort_order: data.sortOrder,
      created_by: context.userId,
      updated_by: context.userId,
      archived_at: data.status === "arquivado" ? new Date().toISOString() : null,
    };

    const query = data.id
      ? (databaseAdmin as any).from("banners").update(payload).eq("id", data.id)
      : (databaseAdmin as any).from("banners").insert(payload);
    const { data: row, error } = await query.select().single();
    if (error) throw new Error(error.message);

    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: data.id ? "banner.updated" : "banner.created",
      entityType: "banner",
      entityId: row.id,
      metadata: {
        slug: row.slug,
        status: row.status,
        showOnHome: row.show_on_home,
        showOnTotem: row.show_on_totem,
        showOnVitrine: row.show_on_vitrine,
      },
    });

    return row;
  });

export const getAdminProfile = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: { storeId?: string | null } | undefined) => ({
    storeId: input?.storeId ?? null,
  }))
  .handler(async ({ context, data }) => {
    const storeId = await resolveStoreScope(context.userId, data.storeId);
    return getUserCapabilitiesSafe(context.userId, storeId);
  });

export const getTechnicalOverviewAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    await assertCapabilitySafe(context.userId, "manage_technical");
    const storeId = await getDefaultStoreIdSafe();
    const [stores, mediaAssets, products, categories, campaigns] = await Promise.all([
      (databaseAdmin as any).from("stores").select("id", { count: "exact", head: true }),
      (databaseAdmin as any).from("media_assets").select("id", { count: "exact", head: true }),
      (databaseAdmin as any).from("products").select("id", { count: "exact", head: true }),
      (databaseAdmin as any).from("categories").select("id", { count: "exact", head: true }),
      (databaseAdmin as any).from("campaigns").select("id", { count: "exact", head: true }),
    ]);
    return {
      storeId,
      env: {
        databaseUrl: Boolean(process.env.DATABASE_URL),
        appBaseUrl: Boolean(process.env.APP_BASE_URL),
        adminBootstrapEmail: Boolean(process.env.ADMIN_BOOTSTRAP_EMAIL),
        publicSiteUrl: Boolean(process.env.VITE_PUBLIC_SITE_URL),
        aiProvider: Boolean(process.env.AI_PROVIDER),
        aiApiKey: Boolean(process.env.AI_API_KEY),
      },
      counts: {
        stores: stores.count ?? 0,
        mediaAssets: mediaAssets.count ?? 0,
        products: products.count ?? 0,
        categories: categories.count ?? 0,
        campaigns: campaigns.count ?? 0,
      },
    };
  });

export const listRecentAuditLogsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    await assertCapabilitySafe(context.userId, "manage_technical");
    const { data, error } = await (databaseAdmin as any)
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, user_id, store_id")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const seedCommercialDataAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    await assertRoleSafe(context.userId, ["admin", "infiniti_master", "store_admin"]);
    const storeId = await getDefaultStoreIdSafe();

    const mediaByUrl = new Map<string, string>();
    const categoryIdBySlug = new Map<string, string>();
    const productIdBySlug = new Map<string, string>();

    async function ensureMediaAsset(input: {
      fileUrl: string;
      title: string;
      type:
        | "produto"
        | "galeria"
        | "ambientacao"
        | "tecnica"
        | "campanha"
        | "categoria"
        | "banner"
        | "totem"
        | "vitrine"
        | "institucional";
      altText?: string;
    }) {
      if (!input.fileUrl) return null;
      if (mediaByUrl.has(input.fileUrl)) return mediaByUrl.get(input.fileUrl) ?? null;

      const fallbackName =
        input.fileUrl
          .split("/")
          .pop()
          ?.split("?")[0]
          ?.replace(/[^a-zA-Z0-9._-]+/g, "-") || `${slugify(input.title)}.jpg`;
      const storagePath = `seed/${input.type}/${fallbackName}`;

      const { data: existing } = await (databaseAdmin as any)
        .from("media_assets")
        .select("id, file_url")
        .eq("store_id", storeId)
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (existing?.id) {
        mediaByUrl.set(input.fileUrl, existing.id);
        return existing.id as string;
      }

      const { data: row, error } = await (databaseAdmin as any)
        .from("media_assets")
        .insert({
          store_id: storeId,
          file_name: fallbackName,
          original_file_name: fallbackName,
          file_url: input.fileUrl,
          storage_path: storagePath,
          mime_type: "image/jpeg",
          size: 0,
          type: input.type,
          title: input.title,
          alt_text: input.altText ?? input.title,
          status: "publicado",
          created_by: context.userId,
          updated_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      mediaByUrl.set(input.fileUrl, row.id);
      return row.id as string;
    }

    for (const [index, category] of localCategories.filter((item) => item.id !== "all").entries()) {
      const { data: row, error } = await (databaseAdmin as any)
        .from("categories")
        .upsert(
          {
            store_id: storeId,
            name: category.name,
            slug: category.slug,
            short_name: category.short || category.name,
            status: "publicada",
            sort_order: index,
            created_by: context.userId,
            updated_by: context.userId,
          },
          { onConflict: "store_id,slug" },
        )
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      categoryIdBySlug.set(category.slug, row.id);
    }

    for (const [index, product] of localProducts.entries()) {
      const primaryMediaId = await ensureMediaAsset({
        fileUrl: product.image,
        title: product.name,
        type: "produto",
        altText: product.name,
      });

      const { data: row, error } = await (databaseAdmin as any)
        .from("products")
        .upsert(
          {
            store_id: storeId,
            category_id: categoryIdBySlug.get(product.categoryId) ?? null,
            primary_media_id: primaryMediaId,
            name: product.name,
            slug: product.id,
            short_description: product.description,
            description: product.longDescription,
            technical_specs: product.specs ?? [],
            benefits: product.benefits ?? [],
            applications: product.applications ?? [],
            environments: product.environments ?? [],
            tags: [],
            whatsapp_message: `Ola! Tenho interesse em ${product.name}.`,
            seo_title: product.name,
            seo_description: product.description,
            status: "publicado",
            is_featured: Boolean(product.featured),
            sort_order: index,
            unit: product.unit ?? null,
            price_label: product.price ?? "Sob consulta",
            section_key: product.sectionId ?? null,
            created_by: context.userId,
            updated_by: context.userId,
            published_at: new Date().toISOString(),
          },
          { onConflict: "store_id,slug" },
        )
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      productIdBySlug.set(product.id, row.id);

      await (databaseAdmin as any).from("product_images").delete().eq("product_id", row.id);
      const galleryEntries = Array.from(new Set([product.image, ...(product.gallery ?? [])]));
      for (const [galleryIndex, fileUrl] of galleryEntries.entries()) {
        const mediaId = await ensureMediaAsset({
          fileUrl,
          title: product.name,
          type:
            galleryIndex === 0
              ? "produto"
              : product.environments?.some((environment) => environment.image === fileUrl)
                ? "ambientacao"
                : "galeria",
          altText: product.name,
        });
        if (!mediaId) continue;
        await (databaseAdmin as any).from("product_images").upsert(
          {
            product_id: row.id,
            media_asset_id: mediaId,
            image_role: galleryIndex === 0 ? "principal" : "galeria",
            sort_order: galleryIndex,
            is_primary: galleryIndex === 0,
          },
          { onConflict: "product_id,media_asset_id" },
        );
      }
    }

    for (const campaign of localCampaigns) {
      const bannerMediaId = await ensureMediaAsset({
        fileUrl: campaign.banner,
        title: campaign.name,
        type: "campanha",
        altText: campaign.name,
      });

      const { data: row, error } = await (databaseAdmin as any)
        .from("campaigns")
        .upsert(
          {
            store_id: storeId,
            title: campaign.name,
            slug: campaign.slug,
            subtitle: campaign.tagline,
            description: campaign.description,
            banner_media_id: bannerMediaId,
            cta_label: "Ver campanha",
            whatsapp_message: `Ola! Quero saber mais sobre a campanha ${campaign.name}.`,
            status: campaign.status === "encerrado" ? "encerrada" : "publicada",
            is_featured: true,
            show_on_home: true,
            show_on_totem: true,
            show_on_vitrine: true,
            seo_title: campaign.name,
            seo_description: campaign.description,
            created_by: context.userId,
            updated_by: context.userId,
            published_at: new Date().toISOString(),
          },
          { onConflict: "store_id,slug" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await (databaseAdmin as any).from("campaign_products").delete().eq("campaign_id", row.id);
      const campaignProducts = campaign.productIds
        .map((slug, index) => ({
          campaign_id: row.id,
          product_id: productIdBySlug.get(slug),
          sort_order: index,
        }))
        .filter((item) => Boolean(item.product_id));
      if (campaignProducts.length > 0) {
        const { error: campaignProductsError } = await (databaseAdmin as any)
          .from("campaign_products")
          .insert(campaignProducts);
        if (campaignProductsError) throw new Error(campaignProductsError.message);
      }
    }

    await writeAuditLogSafe({
      storeId,
      userId: context.userId,
      action: "seed.commercial_data",
      entityType: "store",
      entityId: storeId,
      metadata: {
        categories: categoryIdBySlug.size,
        products: productIdBySlug.size,
        campaigns: localCampaigns.length,
      },
    });

    return {
      ok: true,
      storeId,
      categories: categoryIdBySlug.size,
      products: productIdBySlug.size,
      campaigns: localCampaigns.length,
    };
  });
