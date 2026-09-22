import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LocalProduct } from "@/lib/localCommerce";

export type Product = LocalProduct;
export interface PaginatedProductsResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useProducts(options?: {
  categorySlug?: string;
  brandSlug?: string;
  featured?: boolean;
  readyForCampaign?: boolean;
  search?: string;
  availability?: string;
  deliveryType?: string;
  application?: string;
  saleType?: string;
  unitMeasure?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["products", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.categorySlug) params.set("categorySlug", options.categorySlug);
      if (options?.brandSlug) params.set("brandSlug", options.brandSlug);
      if (options?.featured) params.set("featured", "true");
      if (options?.readyForCampaign) params.set("readyForCampaign", "true");
      if (options?.search) params.set("search", options.search);
      if (options?.availability) params.set("availability", options.availability);
      if (options?.deliveryType) params.set("deliveryType", options.deliveryType);
      if (options?.application) params.set("application", options.application);
      if (options?.saleType) params.set("saleType", options.saleType);
      if (options?.unitMeasure) params.set("unitMeasure", options.unitMeasure);
      if (options?.limit) params.set("limit", String(options.limit));
      const query = params.toString();
      return apiFetch<Product[]>(`/api/products${query ? `?${query}` : ""}`);
    },
  });
}

export function useProductsPaged(options?: {
  categorySlug?: string;
  brandSlug?: string;
  category?: string[];
  brand?: string[];
  featured?: boolean;
  readyForCampaign?: boolean;
  search?: string;
  availability?: string[];
  deliveryType?: string[];
  application?: string;
  saleType?: string[];
  unitMeasure?: string[];
  subcategory?: string[];
  diameter?: string[];
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["products-paged", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.categorySlug) params.set("categorySlug", options.categorySlug);
      if (options?.brandSlug) params.set("brandSlug", options.brandSlug);
      if (options?.category?.length) params.set("category", options.category.join(","));
      if (options?.brand?.length) params.set("brand", options.brand.join(","));
      if (options?.featured) params.set("featured", "true");
      if (options?.readyForCampaign) params.set("readyForCampaign", "true");
      if (options?.search) params.set("search", options.search);
      if (options?.availability?.length) params.set("availability", options.availability.join(","));
      if (options?.deliveryType?.length) params.set("deliveryType", options.deliveryType.join(","));
      if (options?.application) params.set("application", options.application);
      if (options?.saleType?.length) params.set("saleType", options.saleType.join(","));
      if (options?.unitMeasure?.length) params.set("unitMeasure", options.unitMeasure.join(","));
      if (options?.subcategory?.length) params.set("subcategory", options.subcategory.join(","));
      if (options?.diameter?.length) params.set("diameter", options.diameter.join(","));
      if (options?.sort) params.set("sort", options.sort);
      params.set("paged", "true");
      params.set("page", String(options?.page || 1));
      params.set("pageSize", String(options?.pageSize || 20));
      return apiFetch<PaginatedProductsResponse>(`/api/products?${params.toString()}`);
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => apiFetch<Product>(`/api/products/${slug}`),
    enabled: !!slug,
  });
}

export function useFeaturedProducts(limit = 8, readyForCampaign = false) {
  return useProducts({ featured: true, limit, readyForCampaign });
}
