/**
 * OmniGrow Adapter
 * Integration with OmniGrow CRM as the SSOT for catalog
 * Uses edge function proxy to avoid exposing API keys in the browser
 * Falls back to cache/read-model when OmniGrow is unavailable
 */

import type { CatalogAdapter, CatalogQueryOptions, CatalogCategory } from './types';
import type { DomainProduct, CatalogMeta } from '@/domain/types';
import {
  getCachedProducts,
  setCachedProducts,
  getCachedCategories,
  setCachedCategories,
  getCachedMeta,
  setCachedMeta,
} from './catalogCache';

// Environment flags
const OMNIGROW_ENABLED = import.meta.env.VITE_OMNIGROW_ENABLED === 'true';
const OMNIGROW_CATALOG_URL = import.meta.env.VITE_OMNIGROW_CATALOG_URL || '';

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function createOmnigrowAdapter(): CatalogAdapter {
  const name = 'omnigrowAdapter';

  const isConfigured = (): boolean => {
    return OMNIGROW_ENABLED && !!OMNIGROW_CATALOG_URL;
  };

  const getProducts = async (options?: CatalogQueryOptions): Promise<DomainProduct[]> => {
    // Try cache first
    const cacheKey = options ? `catalog_cache_products_${JSON.stringify(options)}` : undefined;
    const cached = getCachedProducts(cacheKey);
    
    if (!isConfigured()) {
      if (cached) {
        console.info('[OmnigrowAdapter] Returning cached products (not configured)');
        return cached;
      }
      console.warn('[OmnigrowAdapter] Not configured and no cache available');
      return [];
    }

    try {
      const params = new URLSearchParams();
      if (options?.categorySlug) params.set('category', options.categorySlug);
      if (options?.search) params.set('search', options.search);
      if (options?.featured) params.set('featured', 'true');
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const url = `${OMNIGROW_CATALOG_URL}/products?${params.toString()}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const products: DomainProduct[] = data.products || data;

      // Update cache
      setCachedProducts(products, 'omnigrow', cacheKey);
      console.info(`[OmnigrowAdapter] Fetched ${products.length} products from OmniGrow`);
      return products;
    } catch (error) {
      console.warn('[OmnigrowAdapter] Fetch failed, falling back to cache:', error);
      return cached || [];
    }
  };

  const getProduct = async (slug: string): Promise<DomainProduct | null> => {
    if (!isConfigured()) {
      // Try to find in cached products
      const cached = getCachedProducts();
      return cached?.find((p) => p.slug === slug) ?? null;
    }

    try {
      const response = await fetchWithTimeout(`${OMNIGROW_CATALOG_URL}/products/${slug}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      const product: DomainProduct = await response.json();
      return product;
    } catch (error) {
      console.warn('[OmnigrowAdapter] Product fetch failed:', error);
      const cached = getCachedProducts();
      return cached?.find((p) => p.slug === slug) ?? null;
    }
  };

  const getProductBySku = async (sku: string): Promise<DomainProduct | null> => {
    if (!isConfigured()) {
      const cached = getCachedProducts();
      return cached?.find((p) => p.sku === sku) ?? null;
    }

    try {
      const response = await fetchWithTimeout(`${OMNIGROW_CATALOG_URL}/products/sku/${sku}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('[OmnigrowAdapter] SKU fetch failed:', error);
      const cached = getCachedProducts();
      return cached?.find((p) => p.sku === sku) ?? null;
    }
  };

  const getCategories = async (): Promise<CatalogCategory[]> => {
    const cached = getCachedCategories();

    if (!isConfigured()) {
      return cached || [];
    }

    try {
      const response = await fetchWithTimeout(`${OMNIGROW_CATALOG_URL}/categories`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const categories: CatalogCategory[] = await response.json();
      setCachedCategories(categories, 'omnigrow');
      return categories;
    } catch (error) {
      console.warn('[OmnigrowAdapter] Categories fetch failed:', error);
      return cached || [];
    }
  };

  const getMeta = async (): Promise<CatalogMeta> => {
    const cached = getCachedMeta();

    if (!isConfigured()) {
      return cached || {
        version: '0.0.0',
        updated_at: new Date().toISOString(),
        source: 'omnigrow',
        product_count: 0,
      };
    }

    try {
      const response = await fetchWithTimeout(`${OMNIGROW_CATALOG_URL}/meta`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const meta: CatalogMeta = await response.json();
      setCachedMeta(meta, 'omnigrow');
      return meta;
    } catch {
      return cached || {
        version: '0.0.0',
        updated_at: new Date().toISOString(),
        source: 'omnigrow',
        product_count: 0,
      };
    }
  };

  return {
    name,
    getProducts,
    getProduct,
    getProductBySku,
    getCategories,
    getMeta,
  };
}
