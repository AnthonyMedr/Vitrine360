/**
 * Catalog adapter interfaces
 * Allows swapping between local and OmniGrow data sources
 */

import type { DomainProduct, CatalogMeta } from '@/domain/types';

export interface CatalogAdapter {
  name: string;
  
  // Fetch products
  getProducts(options?: CatalogQueryOptions): Promise<DomainProduct[]>;
  getProduct(slug: string): Promise<DomainProduct | null>;
  getProductBySku(sku: string): Promise<DomainProduct | null>;
  
  // Fetch categories
  getCategories(): Promise<CatalogCategory[]>;
  
  // Metadata
  getMeta(): Promise<CatalogMeta>;
}

export interface CatalogQueryOptions {
  categorySlug?: string;
  brandSlug?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image_url?: string;
  parent_id?: string | null;
  product_count?: number;
}

export interface CatalogState {
  products: DomainProduct[];
  categories: CatalogCategory[];
  meta: CatalogMeta | null;
  isLoading: boolean;
  error: Error | null;
  lastSync: string | null;
}
