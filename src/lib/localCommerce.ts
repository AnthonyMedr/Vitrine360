import { brands as seedBrands, categories as seedCategories, products as seedProducts } from "@/data/products";
import type { SaleType, UnitMeasure } from "@/lib/commercial-calculation";

export type PaymentMethod = "credit_card" | "boleto" | "pix" | "cash" | "payment_link" | "store_pos";
export type DeliveryType = "pickup" | "delivery";
export type PaymentStatus = "pending" | "initiated" | "approved" | "failed" | "cancelled";
export type OrderType = "normal" | "assisted" | "pickup";
export type OrderOrigin = "ecommerce" | "showroom" | "whatsapp" | "instagram" | "marketplace" | "integration";
export type SourceChannel = "web" | "store" | "whatsapp" | "instagram" | "integration";
export type SourceActor = "human" | "bot" | "system";
export type OrderStatus =
  | "draft"
  | "pending"
  | "awaiting_payment"
  | "payment_approved"
  | "confirmed"
  | "processing"
  | "in_separation"
  | "in_expedition"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderOperationStage =
  | "awaiting_payment"
  | "payment_review"
  | "payment_approved"
  | "fiscal_review"
  | "confirmed"
  | "processing"
  | "stock_check"
  | "in_separation"
  | "ready_for_pickup"
  | "in_expedition"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "blocked"
  | "waiting_customer"
  | "waiting_provider";

export type OrderOperationPriority = "critical" | "high" | "medium" | "low";

export interface LocalBrand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface LocalCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
}

export interface LocalProduct {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  ncm?: string | null;
  cest?: string | null;
  origin_code?: string | null;
  product_origin?: "importado" | "nacional";
  fiscal_group?: string | null;
  tax_classification_status?: "pending" | "ready" | "review";
  cost_price?: number | null;
  margin_target?: number | null;
  subcategory?: string | null;
  description: string | null;
  short_description: string | null;
  long_description?: string | null;
  application?: string | null;
  sale_type?: SaleType;
  unit_measure?: UnitMeasure;
  display_unit?: UnitMeasure | string | null;
  base_price?: number;
  promotional_price?: number | null;
  price: number;
  original_price: number | null;
  category_id: string | null;
  brand_id: string | null;
  sales_unit?: string;
  measures?: string | null;
  material: string | null;
  diameter: string | null;
  weight: number | null;
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
  stock_minimum?: number;
  unit: string;
  stock: number;
  status_product?: "active" | "inactive" | "draft" | "archived";
  availability?: "disponivel" | "sob_consulta" | "indisponivel" | "retirada_loja" | "entrega_sob_analise";
  delivery_type?: "pickup" | "delivery" | "pickup_or_delivery" | "quote";
  is_on_request?: boolean;
  is_heavy?: boolean;
  is_bulky?: boolean;
  top_seller?: boolean;
  related_product_ids?: string[];
  variations?: Array<{ id: string; label: string; value: string }>;
  is_active: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  image_url: string | null;
  images: string[];
  image_alt_text?: string | null;
  image_review_status?: "approved" | "manual_review" | "suspect" | "missing" | "duplicate" | "broken" | "rejected" | null;
  image_review_notes?: string | null;
  created_at: string;
  category?: LocalCategory | null;
  brand?: LocalBrand | null;
}

export interface LocalUser {
  id: string;
  email: string;
  password: string;
  role: "admin" | "seller" | "customer";
  is_active?: boolean;
  user_metadata: {
    full_name: string;
    store_id?: string | null;
    store_name?: string | null;
    can_start_assisted_sale?: boolean;
    permission_profile_id?: string | null;
    job_title?: string | null;
  };
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export interface LocalSession {
  user: LocalUser;
}

export interface LocalOrderAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface LocalOrderShipment {
  carrier: string | null;
  service: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  estimated_delivery_at: string | null;
  dispatched_at: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface LocalOrder {
  id: string;
  order_number: string;
  tracking_token: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_reference?: string | null;
  payment_approved_at?: string | null;
  shipping_address: LocalOrderAddress | null;
  shipping_cost: number;
  shipment?: LocalOrderShipment | null;
  discount: number;
  subtotal: number;
  total: number;
  notes?: string | null;
  status: OrderStatus;
  order_type?: OrderType;
  order_origin?: OrderOrigin;
  source_channel?: SourceChannel;
  source_actor?: SourceActor;
  assisted_sale?: boolean;
  seller_id?: string | null;
  seller_name?: string | null;
  seller_establishment_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  delivery_required?: boolean;
  pickup_allowed?: boolean;
  assisted_sale_notes?: string | null;
  payment_linked_to_order?: boolean;
  correlation_id?: string;
  idempotency_key?: string | null;
  event_log?: string[];
  operation_state?: LocalOrderOperation | null;
  created_at: string;
  updated_at: string;
}

export interface LocalOrderOperation {
  id: string;
  order_id: string;
  current_stage: OrderOperationStage;
  current_owner_user_id: string | null;
  current_owner_role: string | null;
  current_owner_name?: string | null;
  stage_started_at: string;
  stage_sla_minutes: number;
  is_stuck: boolean;
  stuck_reason: string | null;
  stuck_since: string | null;
  next_action: string | null;
  priority: OrderOperationPriority;
  waiting_on: "internal" | "customer" | "provider" | "accountant" | null;
  internal_notes: string | null;
  last_human_action_at: string | null;
  last_system_action_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  sla_due_at?: string | null;
  is_overdue?: boolean;
  age_minutes?: number;
  waiting_badge?: string | null;
}

export interface LocalOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  sale_type?: SaleType;
  unit_measure?: UnitMeasure;
  display_unit?: UnitMeasure | string | null;
  commercial_rule_applied?: string | null;
  quantity_original?: number | null;
  quantity_final?: number | null;
  quantity_informed?: number | null;
  requested_measurement?: number | null;
  area_desired_m2?: number | null;
  total_area_m2?: number | null;
  weight_desired_kg?: number | null;
  total_weight_kg?: number | null;
  volume_desired_l?: number | null;
  total_volume_l?: number | null;
  cubic_meters_desired?: number | null;
  total_cubic_meters?: number | null;
  calculated_boxes?: number | null;
  calculated_pieces?: number | null;
  calculated_packages?: number | null;
  packaging_closed?: boolean | null;
  open_package_allowed?: boolean | null;
  loss_margin_applied?: number | null;
  client_notes?: string | null;
  operational_notes?: string | null;
  calculation_origin?: string | null;
  seller_establishment_id?: string | null;
  allocated_lot_id?: string | null;
  ncm?: string | null;
  cest?: string | null;
  origin_code?: string | null;
  cfop?: string | null;
  cst_csosn?: string | null;
  requires_difal?: boolean | null;
  requires_fcp?: boolean | null;
  fiscal_profile_status?: "pending" | "ready" | "review" | null;
}

export interface LocalAuditLogEntry {
  event_id: string;
  order_id: string | null;
  event_type: string;
  occurred_at: string;
  correlation_id: string;
  actor_id: string | null;
  actor_name: string | null;
  source_channel: SourceChannel;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
}

export interface LocalCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  description: string | null;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
}

export interface LocalStore {
  id: string;
  name: string;
  code: string;
  type: "store" | "showroom" | "distribution_center";
  phone: string | null;
  email: string | null;
  city: string;
  state: string;
  is_active: boolean;
  supports_pickup: boolean;
  supports_assisted_sale: boolean;
  delivery_radius_km: number | null;
  created_at: string;
}

export interface LocalSeller {
  id: string;
  user_id: string;
  seller_code: string;
  display_name: string;
  role_label: "seller" | "operator" | "manager";
  is_active: boolean;
  primary_store_id: string | null;
  allowed_store_ids: string[];
  created_at: string;
}

export interface LocalPaymentRecord {
  id: string;
  order_id: string;
  provider: "manual" | "pix" | "credit_card" | "payment_link";
  method: PaymentMethod;
  status: PaymentStatus | "refunded";
  amount: number;
  correlation_id: string;
  external_reference: string | null;
  webhook_idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalQuote {
  id: string;
  quote_number: string;
  status: "draft" | "sent" | "approved" | "converted" | "cancelled";
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  seller_id: string | null;
  seller_name: string | null;
  store_id: string | null;
  store_name: string | null;
  correlation_id: string;
  converted_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: "ecommerce" | "showroom" | "whatsapp" | "instagram" | "marketplace" | "integration" | "web" | "form";
  channel: "whatsapp" | "form" | "checkout" | "manual" | "showroom";
  product_interest: string | null;
  page_origin: string | null;
  stage: "new" | "contacted" | "qualified" | "converted" | "lost";
  responsible_id: string | null;
  responsible_name: string | null;
  linked_customer_id: string | null;
  linked_order_id: string | null;
  linked_quote_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSiteBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface LocalInstitutionalPage {
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  updated_at: string;
}

export interface LocalSiteContent {
  banners: LocalSiteBanner[];
  featured_category_ids: string[];
  go_live_product_ids: string[];
  trust_badges: string[];
  operational_messages: {
    pickup_message: string;
    delivery_message: string;
    human_support_message: string;
  };
  pages: LocalInstitutionalPage[];
}

export interface LocalCommercialSettings {
  pickup_enabled: boolean;
  local_delivery_enabled: boolean;
  quote_enabled: boolean;
  assisted_sale_enabled: boolean;
  manual_approval_enabled: boolean;
  price_visibility_enabled: boolean;
  default_product_consultation_mode: boolean;
  pickup_message: string;
  delivery_message: string;
  availability_message: string;
}

export interface LocalDeliveryZone {
  id: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string | null;
  delivery_fee: number;
  estimated_days: number;
  notes: string | null;
  is_active: boolean;
  allows_pickup: boolean;
  delivery_enabled: boolean;
}

export interface LocalFreightCarrier {
  id: string;
  name: string;
  code: string;
  service_types: string[];
  coverage_states: string[];
  max_weight_kg: number | null;
  max_length_cm: number | null;
  max_cubic_meters: number | null;
  supports_heavy: boolean;
  supports_bulky: boolean;
  tracking_url_template: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalShippingQuoteOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: string;
  description: string;
  deliveryType: "pickup" | "delivery";
  zoneId?: string | null;
  provider?: string;
  coverage?: "pickup" | "local" | "national";
  isCheapest?: boolean;
  isFastest?: boolean;
}

export interface LocalShippingQuoteResponse {
  options: LocalShippingQuoteOption[];
  regionLabel: string;
  underAnalysis: boolean;
  message: string;
  nationalCoverage?: {
    requested: boolean;
    ready: boolean;
    provider: string;
    mode: "automatic" | "provider_required" | "local";
    missing: string[];
    message: string;
  };
}

export interface LocalAddressLookupResponse {
  ok: boolean;
  provider: "viacep" | "brasilapi" | "none";
  source: "public-api" | "none";
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge: string;
  ddd: string;
  message: string;
}

export interface LocalCompanyLookupResponse {
  ok: boolean;
  provider: "brasilapi" | "none";
  source: "public-api" | "none";
  cnpj: string;
  legalName: string;
  tradeName: string;
  status: string;
  openedAt: string;
  mainActivity: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  email: string;
  message: string;
}

export interface LocalPublicApiRuntimeStatus {
  ok: boolean;
  env: string;
  providers: {
    cep: string[];
    cnpj: string[];
  };
  cache: {
    active_entries: number;
    expired_entries: number;
    address_ttl_ms: number;
    company_ttl_ms: number;
  };
  request_timeout_ms: number;
  usage_policy: string;
}

export interface LocalPermissionProfile {
  id: string;
  slug?: string;
  name: string;
  description: string;
  level?: number;
  isSystem?: boolean;
  isActive?: boolean;
  permissions?: string[];
  aliases?: string[];
  modules: Array<{
    key: string;
    label: string;
    access: "full" | "limited" | "view" | "none";
  }>;
}

export interface LocalIntegrationOverview {
  items: Array<{
    key: string;
    label: string;
    connected: boolean;
    mode: "real" | "structural" | "manual" | "local";
    status: string;
    fallback_ready: boolean;
    last_error: string | null;
  }>;
  runtime?: {
    payment?: {
      provider: string;
      mode: string;
      ready: boolean;
      webhook_ready: boolean;
      sandbox: boolean;
      request_timeout_ms: number;
      missing: string[];
    };
    freight?: {
      provider: string;
      mode: string;
      ready: boolean;
      sandbox: boolean;
      request_timeout_ms: number;
      origin_zip_configured: boolean;
      missing: string[];
    };
  };
}

const STORAGE_KEYS = {
  users: "local-commerce-users",
  currentUserId: "local-commerce-current-user-id",
  products: "local-commerce-products",
  categories: "local-commerce-categories",
  brands: "local-commerce-brands",
  orders: "local-commerce-orders",
  orderItems: "local-commerce-order-items",
  auditLogs: "local-commerce-audit-logs",
  coupons: "local-commerce-coupons",
} as const;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function seedCategoriesData(): LocalCategory[] {
  return seedCategories.map((category, index) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    image_url: category.image,
    sort_order: index + 1,
    is_active: true,
  }));
}

function seedBrandsData(): LocalBrand[] {
  return seedBrands.map((brand, index) => ({
    id: `brand-${index + 1}`,
    name: brand,
    slug: slugify(brand),
    is_active: true,
  }));
}

function seedProductsData(categories: LocalCategory[], brands: LocalBrand[]): LocalProduct[] {
  return seedProducts.map((product, index) => {
    const categoryNameMap: Record<string, string> = {
      "Ripados internos e externos": "Ripados internos e externos",
      "Chapas UV": "Chapas UV",
      "Chapas Policarbonato": "Chapas Policarbonato",
      "Tetos Laminados Vinilicos": "Tetos Laminados Vinilicos",
      "Pisos Vinilicos": "Pisos Vinilicos",
      "Forros PVC": "Forros PVC",
      "Telha de Fibrocimento": "Telha de Fibrocimento",
      "Telha de PVC": "Telha de PVC",
      ACM: "ACM",
      "Perfil de Aluminio": "Perfil de Aluminio",
      "Drywall e Acessórios": "Drywall e Acessórios",
    };
    const normalizedCategoryName = categoryNameMap[product.category] || product.category;
    const category = categories.find((item) => item.name === normalizedCategoryName) || null;
    const brand = brands.find((item) => item.name === product.brand) || null;
    const createdAt = new Date(Date.now() - index * 86_400_000).toISOString();

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      subcategory: product.subcategory,
      description: product.description,
      short_description: product.shortDescription,
      long_description: product.description,
      application: product.application,
      sale_type: product.saleType ?? "unidade",
      unit_measure: product.unitMeasure ?? "un",
      display_unit: product.displayUnit ?? product.unitMeasure ?? "un",
      base_price: product.price,
      promotional_price: product.originalPrice ?? null,
      price: product.price,
      original_price: product.originalPrice ?? null,
      category_id: category?.id ?? null,
      brand_id: brand?.id ?? null,
      sales_unit: "un",
      measures: product.diameter ?? null,
      material: product.material,
      diameter: product.diameter ?? null,
      weight: null,
      dimensions: null,
      width: product.width ?? null,
      height: product.height ?? null,
      length: product.length ?? null,
      thickness: product.thickness ?? null,
      linear_measure: product.linearMeasure ?? null,
      square_measure: product.squareMeasure ?? null,
      area_per_piece: product.areaPerPiece ?? null,
      area_per_box: product.areaPerBox ?? null,
      area_per_package: product.areaPerPackage ?? null,
      meters_per_piece: product.metersPerPiece ?? null,
      pieces_per_box: product.piecesPerBox ?? null,
      meters_per_box: product.metersPerBox ?? null,
      meters_per_package: product.metersPerPackage ?? null,
      volume_per_unit: product.volumePerUnit ?? null,
      volume_per_package: product.volumePerPackage ?? null,
      weight_per_unit: product.weightPerUnit ?? null,
      weight_per_package: product.weightPerPackage ?? null,
      pieces_per_package: product.piecesPerPackage ?? null,
      packaging_closed: product.packagingClosed ?? null,
      open_package_allowed: product.openPackageAllowed ?? null,
      minimum_sale_quantity: product.minimumSaleQuantity ?? null,
      sale_multiple: product.saleMultiple ?? null,
      fractional_sale_allowed: product.fractionalSaleAllowed ?? null,
      default_loss_margin: product.defaultLossMargin ?? product.lossMargin ?? null,
      loss_margin: product.lossMargin ?? null,
      stock_minimum: 5,
      unit: "un",
      stock: product.stock,
      status_product: "active",
      availability: product.quoteAvailable ? "sob_consulta" : "indisponivel",
      delivery_type: "quote",
      is_on_request: true,
      is_heavy: false,
      is_bulky: product.category === "Chapas UV" || product.category === "Ripados internos e externos" || product.category === "Chapas Policarbonato",
      top_seller: Boolean(product.bestseller),
      related_product_ids: product.relatedProductIds,
      variations: product.variations,
      is_active: true,
      is_featured: Boolean(product.featured),
      rating: product.rating,
      review_count: product.reviews,
      image_url: product.images[0] ?? null,
      images: product.images,
      image_alt_text: `${product.name} - ${normalizedCategoryName}`,
      image_review_status: product.imageApproved ? "approved" : "manual_review",
      image_review_notes: product.imageApproved
        ? "Imagem aprovada na planilha-mestre do catálogo."
        : "A planilha-mestre ainda não contém imagem aprovada para publicação.",
      created_at: createdAt,
    };
  });
}

function seedUsersData(): LocalUser[] {
  return [
    {
      id: "user-admin",
      email: "admin@gamelmetal.com",
      password: "admin123",
      role: "admin",
      user_metadata: {
        full_name: "Administrador GAMEL Metal",
        permission_profile_id: "admin_master",
      },
    },
  ];
}

function seedCouponsData(): LocalCoupon[] {
  return [
    {
      id: "coupon-bemvindo",
      code: "BEMVINDO10",
      discount_type: "percentage",
      discount_value: 10,
      min_order_value: 100,
      description: "10% de desconto na primeira compra",
      is_active: true,
      expires_at: null,
      max_uses: null,
      used_count: 0,
    },
    {
      id: "coupon-frete",
      code: "PVC20",
      discount_type: "fixed",
      discount_value: 20,
      min_order_value: 200,
      description: "R$ 20 de desconto em compras acima de R$ 200",
      is_active: true,
      expires_at: null,
      max_uses: null,
      used_count: 0,
    },
  ];
}

export function ensureLocalCommerceSeed() {
  if (!isBrowser()) return;

  const categories = readStorage<LocalCategory[]>(STORAGE_KEYS.categories, []);
  const brands = readStorage<LocalBrand[]>(STORAGE_KEYS.brands, []);
  const products = readStorage<LocalProduct[]>(STORAGE_KEYS.products, []);
  const users = readStorage<LocalUser[]>(STORAGE_KEYS.users, []);
  const coupons = readStorage<LocalCoupon[]>(STORAGE_KEYS.coupons, []);

  const nextCategories = categories.length > 0 ? categories : seedCategoriesData();
  const nextBrands = brands.length > 0 ? brands : seedBrandsData();
  const nextProducts = products.length > 0 ? products : seedProductsData(nextCategories, nextBrands);

  if (categories.length === 0) writeStorage(STORAGE_KEYS.categories, nextCategories);
  if (brands.length === 0) writeStorage(STORAGE_KEYS.brands, nextBrands);
  if (products.length === 0) writeStorage(STORAGE_KEYS.products, nextProducts);
  if (users.length === 0) writeStorage(STORAGE_KEYS.users, seedUsersData());
  if (coupons.length === 0) writeStorage(STORAGE_KEYS.coupons, seedCouponsData());
  if (!localStorage.getItem(STORAGE_KEYS.orders)) writeStorage(STORAGE_KEYS.orders, []);
  if (!localStorage.getItem(STORAGE_KEYS.orderItems)) writeStorage(STORAGE_KEYS.orderItems, []);
  if (!localStorage.getItem(STORAGE_KEYS.auditLogs)) writeStorage(STORAGE_KEYS.auditLogs, []);
}

function getBaseProducts() {
  ensureLocalCommerceSeed();
  return readStorage<LocalProduct[]>(STORAGE_KEYS.products, []);
}

export function getCategories(): LocalCategory[] {
  ensureLocalCommerceSeed();
  return readStorage<LocalCategory[]>(STORAGE_KEYS.categories, []).filter((item) => item.is_active);
}

export function getBrands(): LocalBrand[] {
  ensureLocalCommerceSeed();
  return readStorage<LocalBrand[]>(STORAGE_KEYS.brands, []).filter((item) => item.is_active);
}

export function getProducts(): LocalProduct[] {
  const categories = getCategories();
  const brands = getBrands();
  return getBaseProducts()
    .filter((item) => item.is_active)
    .map((product) => ({
      ...product,
      category: categories.find((item) => item.id === product.category_id) ?? null,
      brand: brands.find((item) => item.id === product.brand_id) ?? null,
    }));
}

export function findProductBySlug(slug: string) {
  return getProducts().find((item) => item.slug === slug) ?? null;
}

export function findProductById(id: string) {
  return getProducts().find((item) => item.id === id) ?? null;
}

export function filterProducts(options?: {
  categorySlug?: string;
  brandSlug?: string;
  featured?: boolean;
  search?: string;
  limit?: number;
}) {
  let data = getProducts();

  if (options?.featured) {
    data = data.filter((item) => item.is_featured);
  }

  if (options?.categorySlug) {
    data = data.filter((item) => item.category?.slug === options.categorySlug);
  }

  if (options?.brandSlug) {
    data = data.filter((item) => item.brand?.slug === options.brandSlug);
  }

  if (options?.search) {
    const search = options.search.toLowerCase();
    data = data.filter((item) =>
      item.name.toLowerCase().includes(search) ||
      item.brand?.name.toLowerCase().includes(search) ||
      item.category?.name.toLowerCase().includes(search),
    );
  }

  data = data.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (options?.limit) {
    data = data.slice(0, options.limit);
  }

  return data;
}

export function getCurrentUser(): LocalUser | null {
  ensureLocalCommerceSeed();
  const currentUserId = isBrowser() ? localStorage.getItem(STORAGE_KEYS.currentUserId) : null;
  if (!currentUserId) return null;
  return readStorage<LocalUser[]>(STORAGE_KEYS.users, []).find((item) => item.id === currentUserId) ?? null;
}

export function signUpLocal(email: string, password: string, fullName: string) {
  ensureLocalCommerceSeed();
  const users = readStorage<LocalUser[]>(STORAGE_KEYS.users, []);
  const normalizedEmail = email.trim().toLowerCase();

  if (users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
    return {
      data: null,
      error: { message: "already registered" },
    };
  }

  const user: LocalUser = {
    id: createId(),
    email: normalizedEmail,
    password,
    role: "customer",
    user_metadata: {
      full_name: fullName,
    },
  };

  writeStorage(STORAGE_KEYS.users, [...users, user]);
  localStorage.setItem(STORAGE_KEYS.currentUserId, user.id);

  return {
    data: { user },
    error: null,
  };
}

export function signInLocal(email: string, password: string) {
  ensureLocalCommerceSeed();
  const normalizedEmail = email.trim().toLowerCase();
  const user = readStorage<LocalUser[]>(STORAGE_KEYS.users, []).find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  );

  if (!user) {
    return {
      data: null,
      error: { message: "Invalid login credentials" },
    };
  }

  localStorage.setItem(STORAGE_KEYS.currentUserId, user.id);

  return {
    data: { user },
    error: null,
  };
}

export function signOutLocal() {
  if (isBrowser()) {
    localStorage.removeItem(STORAGE_KEYS.currentUserId);
  }
  return { error: null };
}

export function getSessionLocal(): LocalSession | null {
  const user = getCurrentUser();
  return user ? { user } : null;
}

function getOrdersStorage() {
  ensureLocalCommerceSeed();
  return readStorage<LocalOrder[]>(STORAGE_KEYS.orders, []);
}

function setOrdersStorage(value: LocalOrder[]) {
  writeStorage(STORAGE_KEYS.orders, value);
}

function getOrderItemsStorage() {
  ensureLocalCommerceSeed();
  return readStorage<LocalOrderItem[]>(STORAGE_KEYS.orderItems, []);
}

function setOrderItemsStorage(value: LocalOrderItem[]) {
  writeStorage(STORAGE_KEYS.orderItems, value);
}

export function getOrders() {
  return getOrdersStorage().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getOrdersByUser(userId: string) {
  return getOrders().filter((item) => item.user_id === userId);
}

export function getOrderByTrackingToken(token: string) {
  return getOrders().find((item) => item.tracking_token === token) ?? null;
}

export function getOrderItems(orderId: string) {
  return getOrderItemsStorage().filter((item) => item.order_id === orderId);
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
  const nextOrders = getOrdersStorage().map((item) =>
    item.id === orderId ? { ...item, status, updated_at: new Date().toISOString() } : item,
  );
  setOrdersStorage(nextOrders);
  return nextOrders.find((item) => item.id === orderId) ?? null;
}

export function createOrderLocal(input: {
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  shippingAddress?: LocalOrderAddress;
  shippingCost: number;
  discount?: number;
  notes?: string;
  items: Array<{
    product: {
      id: string;
      name: string;
      price: number;
      sku?: string | null;
    };
    quantity: number;
  }>;
  status?: OrderStatus;
  orderType?: "normal" | "assisted" | "pickup";
  orderOrigin?: "ecommerce" | "showroom" | "whatsapp" | "marketplace";
  isAssistedSale?: boolean;
  sellerId?: string | null;
  sellerName?: string | null;
  showroomStoreId?: string | null;
  showroomStoreName?: string | null;
  deliveryRequired?: boolean;
  assistedSaleNotes?: string | null;
}) {
  const now = new Date().toISOString();
  const subtotal = input.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal + input.shippingCost - (input.discount || 0);
  const id = createId();
  const orderNumber = `PVC${Date.now().toString().slice(-8)}`;

  const order: LocalOrder = {
    id,
    order_number: orderNumber,
    tracking_token: createId(),
    user_id: input.userId ?? null,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    customer_phone: input.customerPhone,
    customer_cpf: input.customerCpf,
    delivery_type: input.deliveryType,
    payment_method: input.paymentMethod,
    shipping_address: input.shippingAddress ?? null,
    shipping_cost: input.shippingCost,
    discount: input.discount || 0,
    subtotal,
    total,
    notes: input.notes ?? null,
    status: input.status ?? "pending",
    order_type: input.orderType ?? "normal",
    order_origin: input.orderOrigin ?? "ecommerce",
    assisted_sale: input.isAssistedSale ?? false,
    seller_id: input.sellerId ?? null,
    seller_name: input.sellerName ?? null,
    store_id: input.showroomStoreId ?? null,
    store_name: input.showroomStoreName ?? null,
    delivery_required: input.deliveryRequired ?? input.deliveryType === "delivery",
    assisted_sale_notes: input.assistedSaleNotes ?? null,
    created_at: now,
    updated_at: now,
  };

  const orderItems = input.items.map((item) => ({
    id: createId(),
    order_id: id,
    product_id: item.product.id,
    product_name: item.product.name,
    product_sku: item.product.sku ?? null,
    quantity: item.quantity,
    unit_price: item.product.price,
    total_price: item.product.price * item.quantity,
  }));

  setOrdersStorage([order, ...getOrdersStorage()]);
  setOrderItemsStorage([...getOrderItemsStorage(), ...orderItems]);

  return { order, orderItems };
}

export function getCoupons() {
  ensureLocalCommerceSeed();
  return readStorage<LocalCoupon[]>(STORAGE_KEYS.coupons, []);
}

export function markCouponUsed(couponId: string) {
  const nextCoupons = getCoupons().map((item) =>
    item.id === couponId ? { ...item, used_count: item.used_count + 1 } : item,
  );
  writeStorage(STORAGE_KEYS.coupons, nextCoupons);
}

export function createAuditLog(entry: Omit<LocalAuditLogEntry, "event_id" | "occurred_at">) {
  const nextEntry: LocalAuditLogEntry = {
    event_id: createId(),
    occurred_at: new Date().toISOString(),
    ...entry,
  };
  const current = readStorage<LocalAuditLogEntry[]>(STORAGE_KEYS.auditLogs, []);
  writeStorage(STORAGE_KEYS.auditLogs, [nextEntry, ...current]);
  return nextEntry;
}

export function getOrderAuditLogs(orderId: string) {
  return readStorage<LocalAuditLogEntry[]>(STORAGE_KEYS.auditLogs, []).filter((item) => item.order_id === orderId);
}
