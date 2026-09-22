/**
 * Local Store Adapter
 * Reads catalog from the local API to keep the frontend on a single source of truth.
 */

import type { CatalogAdapter, CatalogCategory, CatalogQueryOptions } from "./types";
import type { CatalogMeta, DomainProduct } from "@/domain/types";
import { apiFetch } from "@/lib/api";
import type { LocalCategory, LocalProduct } from "@/lib/localCommerce";

function mapToDomainProduct(row: LocalProduct): DomainProduct {
  return {
    sku: row.sku || row.id,
    name: row.name,
    category_id: row.category_id,
    category_slug: row.category?.slug,
    category_name: row.category?.name,
    brand_id: row.brand_id,
    brand_name: row.brand?.name,
    unit: row.unit || "un",
    price: Number(row.price),
    original_price: row.original_price ? Number(row.original_price) : null,
    image_url: row.image_url,
    images: row.images,
    description: row.description,
    short_description: row.short_description,
    specs: {
      material: row.material || undefined,
      diameter: row.diameter || undefined,
      weight: row.weight || undefined,
    },
    stock: row.stock,
    is_active: row.is_active,
    is_featured: row.is_featured,
    rating: row.rating,
    review_count: row.review_count,
    slug: row.slug,
  };
}

export function createLocalStoreAdapter(): CatalogAdapter {
  const name = "localStoreAdapter";

  const getProductsFromAdapter = async (options?: CatalogQueryOptions): Promise<DomainProduct[]> => {
    const params = new URLSearchParams();
    if (options?.categorySlug) params.set("categorySlug", options.categorySlug);
    if (options?.brandSlug) params.set("brandSlug", options.brandSlug);
    if (options?.featured) params.set("featured", "true");
    if (options?.search) params.set("search", options.search);
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    const products = await apiFetch<LocalProduct[]>(`/api/products${query ? `?${query}` : ""}`);
    return products.map(mapToDomainProduct);
  };

  const getProduct = async (slug: string): Promise<DomainProduct | null> => {
    const product = await apiFetch<LocalProduct>(`/api/products/${slug}`).catch(() => null);
    return product ? mapToDomainProduct(product) : null;
  };

  const getProductBySku = async (sku: string): Promise<DomainProduct | null> => {
    const products = await apiFetch<LocalProduct[]>("/api/products");
    const product = products.find((item) => item.sku === sku) ?? null;
    return product ? mapToDomainProduct(product) : null;
  };

  const getCategoriesFromAdapter = async (): Promise<CatalogCategory[]> =>
    (await apiFetch<LocalCategory[]>("/api/categories")).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      image_url: row.image_url,
      parent_id: null,
    }));

  const getMeta = async (): Promise<CatalogMeta> => ({
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    source: "local",
    product_count: (await apiFetch<LocalProduct[]>("/api/products")).length,
  });

  return {
    name,
    getProducts: getProductsFromAdapter,
    getProduct,
    getProductBySku,
    getCategories: getCategoriesFromAdapter,
    getMeta,
  };
}
