import type { DatabaseShape, DbCategory, DbProduct } from "./db";

type ProductWithRelations = DbProduct & {
  category?: DbCategory | null;
  brand?: { id: string; name: string; slug: string; is_active: boolean } | null;
};

export type PublicProductDTO = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  short_description: string | null;
  description: string | null;
  long_description?: string | null;
  subcategory?: string | null;
  category_id: string | null;
  brand_id: string | null;
  category: { id: string; slug: string; name: string } | null;
  brand: { id: string; slug: string; name: string } | null;
  image_url: string | null;
  images: string[];
  image_alt_text?: string | null;
  variations: Array<{ id: string; label: string; value: string }>;
  specifications: Array<{ label: string; value: string }>;
  application?: string | null;
  applications: string[];
  sale_type?: string;
  unit_measure?: string;
  display_unit?: string | null;
  unit: string;
  sales_unit?: string;
  measures?: string | null;
  material: string | null;
  diameter: string | null;
  dimensions?: string | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  thickness?: number | null;
  linear_measure?: number | null;
  square_measure?: number | null;
  area_per_piece?: number | null;
  meters_per_piece?: number | null;
  volume_per_unit?: number | null;
  weight_per_unit?: number | null;
  availability?: DbProduct["availability"];
  availabilityLabel: "Sob consulta";
  delivery_type?: DbProduct["delivery_type"];
  is_on_request?: boolean;
  is_heavy?: boolean;
  is_bulky?: boolean;
  top_seller?: boolean;
  related_product_ids?: string[];
  is_active: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  image_review_status?: DbProduct["image_review_status"];
  created_at: string;
};

function buildSpecifications(product: ProductWithRelations) {
  return [
    ["Medidas", product.measures],
    ["Material", product.material],
    ["Diametro", product.diameter],
    ["Dimensoes", product.dimensions],
    ["Unidade", product.display_unit ?? product.unit_measure ?? product.unit],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }));
}

function buildApplications(product: ProductWithRelations) {
  return String(product.application || "")
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toPublicProductDTO(product: ProductWithRelations): PublicProductDTO {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku ?? null,
    name: product.name,
    short_description: product.short_description ?? null,
    description: product.description ?? null,
    long_description: product.long_description ?? null,
    subcategory: product.subcategory ?? null,
    category_id: product.category_id ?? null,
    brand_id: product.brand_id ?? null,
    category: product.category ? { id: product.category.id, slug: product.category.slug, name: product.category.name } : null,
    brand: product.brand ? { id: product.brand.id, slug: product.brand.slug, name: product.brand.name } : null,
    image_url: product.image_url ?? null,
    images: product.images ?? [],
    image_alt_text: product.image_alt_text ?? null,
    variations: product.variations ?? [],
    specifications: buildSpecifications(product),
    application: product.application ?? null,
    applications: buildApplications(product),
    sale_type: product.sale_type,
    unit_measure: product.unit_measure,
    display_unit: product.display_unit ?? null,
    unit: product.unit,
    sales_unit: product.sales_unit,
    measures: product.measures ?? null,
    material: product.material,
    diameter: product.diameter,
    dimensions: product.dimensions ?? null,
    width: product.width ?? null,
    height: product.height ?? null,
    length: product.length ?? null,
    thickness: product.thickness ?? null,
    linear_measure: product.linear_measure ?? null,
    square_measure: product.square_measure ?? null,
    area_per_piece: product.area_per_piece ?? null,
    meters_per_piece: product.meters_per_piece ?? null,
    volume_per_unit: product.volume_per_unit ?? null,
    weight_per_unit: product.weight_per_unit ?? null,
    availability: product.availability,
    availabilityLabel: "Sob consulta",
    delivery_type: product.delivery_type,
    is_on_request: product.is_on_request,
    is_heavy: product.is_heavy,
    is_bulky: product.is_bulky,
    top_seller: product.top_seller,
    related_product_ids: product.related_product_ids ?? [],
    is_active: product.is_active,
    is_featured: product.is_featured,
    rating: product.rating,
    review_count: product.review_count,
    image_review_status: product.image_review_status,
    created_at: product.created_at,
  };
}

export function assertPublicProductHasNoSensitiveFields(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "price",
    "base_price",
    "promotional_price",
    "original_price",
    "cost_price",
    "margin_target",
    "stock",
    "stock_minimum",
    "ncm",
    "cest",
    "cfop",
    "cst",
    "csosn",
    "supplier",
    "privateCondition",
    "minimum_sale_quantity",
    "sale_multiple",
    "packaging_closed",
    "open_package_allowed",
    "fractional_sale_allowed",
    "default_loss_margin",
    "loss_margin",
  ];
  return forbidden.filter((field) => serialized.includes(`"${field}"`));
}

export function toPublicProductList(db: DatabaseShape, products: ProductWithRelations[]) {
  return products.map((product) => toPublicProductDTO(product));
}
