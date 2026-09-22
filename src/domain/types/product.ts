import type { SaleType, UnitMeasure } from "@/lib/commercial-calculation";

/**
 * Domain types for Product entity
 * Aligned with OmniGrow CRM integration contracts
 */

export interface DomainProduct {
  id?: string;
  sku: string;
  name: string;
  subcategory?: string | null;
  category_id: string | null;
  category_slug?: string;
  category_name?: string;
  brand_id?: string | null;
  brand_name?: string;
  unit: string;
  sales_unit?: string;
  price: number;
  original_price?: number | null;
  image_url?: string | null;
  images?: string[];
  description?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  application?: string | null;
  sale_type?: SaleType;
  unit_measure?: UnitMeasure;
  display_unit?: UnitMeasure | string | null;
  base_price?: number;
  promotional_price?: number | null;
  measures?: string | null;
  dimensions?: string | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  thickness?: number | null;
  linear_measure?: number | null;
  square_measure?: number | null;
  area_per_piece?: number | null;
  area_per_box?: number | null;
  area_per_package?: number | null;
  meters_per_piece?: number | null;
  pieces_per_box?: number | null;
  meters_per_box?: number | null;
  meters_per_package?: number | null;
  volume_per_unit?: number | null;
  volume_per_package?: number | null;
  weight_per_unit?: number | null;
  weight_per_package?: number | null;
  pieces_per_package?: number | null;
  packaging_closed?: boolean | null;
  open_package_allowed?: boolean | null;
  minimum_sale_quantity?: number | null;
  sale_multiple?: number | null;
  fractional_sale_allowed?: boolean | null;
  default_loss_margin?: number | null;
  loss_margin?: number | null;
  specs?: ProductSpecs;
  stock?: number;
  stock_minimum?: number;
  availability?: "disponivel" | "sob_consulta" | "indisponivel" | "retirada_loja" | "entrega_sob_analise";
  delivery_type?: "pickup" | "delivery" | "pickup_or_delivery" | "quote";
  is_on_request?: boolean;
  is_heavy?: boolean;
  is_bulky?: boolean;
  top_seller?: boolean;
  variations?: Array<{ id: string; label: string; value: string }>;
  related_product_ids?: string[];
  is_active: boolean;
  is_featured?: boolean;
  rating?: number;
  review_count?: number;
  slug: string;
}

export interface ProductSpecs {
  material?: string;
  diameter?: string;
  weight?: number;
  [key: string]: string | number | undefined;
}

export interface CatalogMeta {
  version: string;
  updated_at: string;
  source: 'local' | 'omnigrow';
  product_count: number;
}
