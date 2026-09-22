/**
 * useCatalog Hook
 * React hook for accessing catalog data through the adapter abstraction
 */

import { useQuery } from '@tanstack/react-query';
import { useCatalogContext } from '@/data/catalog';
import type { CatalogQueryOptions } from '@/data/catalog';

/**
 * Hook to fetch products from the catalog
 */
export function useCatalog(options?: CatalogQueryOptions) {
  const { adapter, source } = useCatalogContext();

  return useQuery({
    queryKey: ['catalog', 'products', source, options],
    queryFn: () => adapter.getProducts(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single product by slug
 */
export function useCatalogProduct(slug: string) {
  const { adapter, source } = useCatalogContext();

  return useQuery({
    queryKey: ['catalog', 'product', source, slug],
    queryFn: () => adapter.getProduct(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single product by SKU
 */
export function useCatalogProductBySku(sku: string) {
  const { adapter, source } = useCatalogContext();

  return useQuery({
    queryKey: ['catalog', 'product-sku', source, sku],
    queryFn: () => adapter.getProductBySku(sku),
    enabled: !!sku,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch categories
 */
export function useCatalogCategories() {
  const { adapter, source } = useCatalogContext();

  return useQuery({
    queryKey: ['catalog', 'categories', source],
    queryFn: () => adapter.getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch catalog metadata
 */
export function useCatalogMeta() {
  const { adapter, source } = useCatalogContext();

  return useQuery({
    queryKey: ['catalog', 'meta', source],
    queryFn: () => adapter.getMeta(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get featured products
 */
export function useCatalogFeatured(limit = 8) {
  return useCatalog({ featured: true, limit });
}
