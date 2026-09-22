/**
 * Catalog Cache / Read-Model
 * In-memory + localStorage cache for catalog data
 * Provides fast reads and reconciliation support for OmniGrow integration
 */

import type { DomainProduct, CatalogMeta } from '@/domain/types';
import type { CatalogCategory } from './types';

const CACHE_KEY_PRODUCTS = 'catalog_cache_products';
const CACHE_KEY_CATEGORIES = 'catalog_cache_categories';
const CACHE_KEY_META = 'catalog_cache_meta';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  data: T;
  cached_at: string;
  source: 'local' | 'omnigrow';
  version?: string;
}

// In-memory cache for hot reads
const memoryCache = new Map<string, CacheEntry<unknown>>();

function isFresh(entry: CacheEntry<unknown>): boolean {
  return Date.now() - new Date(entry.cached_at).getTime() < CACHE_TTL_MS;
}

function getFromStorage<T>(key: string): CacheEntry<T> | null {
  // Check memory first
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem && isFresh(mem)) return mem;

  // Fall back to localStorage
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const entry = JSON.parse(stored) as CacheEntry<T>;
    if (!isFresh(entry)) {
      localStorage.removeItem(key);
      return null;
    }
    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function saveToStorage<T>(key: string, data: T, source: 'local' | 'omnigrow', version?: string): void {
  const entry: CacheEntry<T> = {
    data,
    cached_at: new Date().toISOString(),
    source,
    version,
  };
  memoryCache.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full — memory cache still works
  }
}

// ========== Products Cache ==========

export function getCachedProducts(cacheKey?: string): DomainProduct[] | null {
  const entry = getFromStorage<DomainProduct[]>(cacheKey || CACHE_KEY_PRODUCTS);
  return entry?.data ?? null;
}

export function setCachedProducts(products: DomainProduct[], source: 'local' | 'omnigrow', cacheKey?: string): void {
  saveToStorage(cacheKey || CACHE_KEY_PRODUCTS, products, source);
}

// ========== Categories Cache ==========

export function getCachedCategories(): CatalogCategory[] | null {
  const entry = getFromStorage<CatalogCategory[]>(CACHE_KEY_CATEGORIES);
  return entry?.data ?? null;
}

export function setCachedCategories(categories: CatalogCategory[], source: 'local' | 'omnigrow'): void {
  saveToStorage(CACHE_KEY_CATEGORIES, categories, source);
}

// ========== Meta Cache ==========

export function getCachedMeta(): CatalogMeta | null {
  const entry = getFromStorage<CatalogMeta>(CACHE_KEY_META);
  return entry?.data ?? null;
}

export function setCachedMeta(meta: CatalogMeta, source: 'local' | 'omnigrow'): void {
  saveToStorage(CACHE_KEY_META, meta, source);
}

// ========== Reconciliation ==========

/**
 * Apply a product update event from OmniGrow
 * Used for real-time catalog sync via webhooks
 */
export function applyProductUpdate(updatedProduct: Partial<DomainProduct> & { sku: string }): void {
  const products = getCachedProducts();
  if (!products) return;

  const index = products.findIndex((p) => p.sku === updatedProduct.sku);
  if (index !== -1) {
    products[index] = { ...products[index], ...updatedProduct };
    setCachedProducts(products, 'omnigrow');
    console.info(`[CatalogCache] Product updated: ${updatedProduct.sku}`);
  }
}

/**
 * Apply a price update event from OmniGrow
 */
export function applyPriceUpdate(sku: string, price: number, originalPrice?: number): void {
  const products = getCachedProducts();
  if (!products) return;

  const index = products.findIndex((p) => p.sku === sku);
  if (index !== -1) {
    products[index].price = price;
    if (originalPrice !== undefined) products[index].original_price = originalPrice;
    setCachedProducts(products, 'omnigrow');
    console.info(`[CatalogCache] Price updated: ${sku} → R$ ${price}`);
  }
}

/**
 * Apply a stock update event from OmniGrow
 */
export function applyStockUpdate(sku: string, stock: number): void {
  const products = getCachedProducts();
  if (!products) return;

  const index = products.findIndex((p) => p.sku === sku);
  if (index !== -1) {
    products[index].stock = stock;
    setCachedProducts(products, 'omnigrow');
    console.info(`[CatalogCache] Stock updated: ${sku} → ${stock}`);
  }
}

/**
 * Invalidate all cache
 */
export function invalidateCache(): void {
  memoryCache.clear();
  localStorage.removeItem(CACHE_KEY_PRODUCTS);
  localStorage.removeItem(CACHE_KEY_CATEGORIES);
  localStorage.removeItem(CACHE_KEY_META);
  console.info('[CatalogCache] Cache invalidated');
}

/**
 * Get cache stats for admin/debugging
 */
export function getCacheStats(): {
  products: { cached: boolean; count: number; source: string | null };
  categories: { cached: boolean; count: number };
  meta: { cached: boolean; source: string | null };
} {
  const products = getFromStorage<DomainProduct[]>(CACHE_KEY_PRODUCTS);
  const categories = getFromStorage<CatalogCategory[]>(CACHE_KEY_CATEGORIES);
  const meta = getFromStorage<CatalogMeta>(CACHE_KEY_META);

  return {
    products: {
      cached: !!products,
      count: products?.data.length ?? 0,
      source: products?.source ?? null,
    },
    categories: {
      cached: !!categories,
      count: categories?.data.length ?? 0,
    },
    meta: {
      cached: !!meta,
      source: meta?.source ?? null,
    },
  };
}
