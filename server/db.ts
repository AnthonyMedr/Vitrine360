import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { brands as seedBrandNames, categories as seedCategories, products as seedProducts } from "../src/data/products";
import type { SaleType, UnitMeasure } from "../src/lib/commercial-calculation";
import { appConfig } from "./config";
import { hasPrismaRuntimeData, readPrismaRuntimeState, replacePrismaRuntimeState } from "./prisma";

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

export interface DbBrand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface DbProduct {
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
}

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: "admin" | "seller" | "customer";
  is_active: boolean;
  user_metadata: {
    full_name: string;
    store_id?: string | null;
    store_name?: string | null;
    can_start_assisted_sale?: boolean;
    permission_profile_id?: string | null;
    job_title?: string | null;
  };
  session_token?: string | null;
  session_expires_at?: string | null;
  session_persistent?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export interface DbOtpChallenge {
  id: string;
  email: string;
  code: string;
  purpose: "signin" | "reauth" | "reset_password";
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface DbOrderAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface DbOrderShipment {
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

export interface DbOrder {
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
  payment_status: PaymentStatus;
  payment_reference: string | null;
  payment_approved_at: string | null;
  shipping_address: DbOrderAddress | null;
  shipping_cost: number;
  shipment?: DbOrderShipment | null;
  discount: number;
  subtotal: number;
  total: number;
  notes?: string | null;
  status: OrderStatus;
  order_type: OrderType;
  order_origin: OrderOrigin;
  source_channel: SourceChannel;
  source_actor: SourceActor;
  assisted_sale: boolean;
  seller_id: string | null;
  seller_name: string | null;
  seller_establishment_id: string | null;
  store_id: string | null;
  store_name: string | null;
  delivery_required: boolean;
  pickup_allowed: boolean;
  assisted_sale_notes: string | null;
  payment_linked_to_order: boolean;
  correlation_id: string;
  idempotency_key: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  inventory_locked: boolean;
  event_log: string[];
  created_at: string;
  updated_at: string;
}

export interface DbOrderOperation {
  id: string;
  order_id: string;
  current_stage: OrderOperationStage;
  current_owner_user_id: string | null;
  current_owner_role: string | null;
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
}

export interface DbOrderItem {
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

export interface DbAuditLog {
  event_id: string;
  event_type: string;
  occurred_at: string;
  correlation_id: string;
  actor_id: string | null;
  actor_name: string | null;
  source_channel: SourceChannel;
  order_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
}

export interface DbCoupon {
  id: string;
  code: string;
  name?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  max_discount_value?: number | null;
  description: string | null;
  is_active: boolean;
  starts_at?: string | null;
  expires_at: string | null;
  max_uses: number | null;
  usage_limit_per_customer?: number | null;
  used_count: number;
  campaign_id?: string | null;
  allowed_product_ids_json?: string[];
  allowed_category_ids_json?: string[];
  region_scope?: "local" | "regional" | "state" | "national" | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbStore {
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

export interface DbSeller {
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

export interface DbPaymentRecord {
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

export interface DbQuote {
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

export interface DbQuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type QuoteRequestStatus = "new" | "triage" | "contacted" | "waiting_customer" | "negotiating" | "converted" | "lost" | "archived";

export interface DbQuoteRequest {
  id: string;
  protocol: string;
  access_token: string;
  status: QuoteRequestStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  company_name: string | null;
  cnpj: string | null;
  segment: string | null;
  city: string;
  state: string | null;
  contact_preference: "whatsapp" | "phone" | "email";
  message: string | null;
  page_origin: string;
  utm_json: Record<string, string | null>;
  responsible_user_id: string | null;
  responsible_name: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  lost_reason: string | null;
  archived_at: string | null;
  privacy_policy_version: string | null;
  consent_recorded_at: string | null;
  marketing_consent: boolean;
  marketing_consent_recorded_at: string | null;
  idempotency_key: string;
  correlation_id: string;
  lead_id: string | null;
  company_id: string | null;
  commercial_quote_id: string | null;
  legacy_quote_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbQuoteRequestItem {
  id: string;
  quote_request_id: string;
  product_id: string;
  product_variant_id: string | null;
  product_slug_snapshot: string;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  variant_label_snapshot: string | null;
  image_url_snapshot: string | null;
  quantity: number;
  unit: string | null;
  notes: string | null;
  calculation_snapshot_json: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
}

export interface DbQuoteRequestStatusHistory {
  id: string;
  quote_request_id: string;
  from_status: QuoteRequestStatus | null;
  to_status: QuoteRequestStatus;
  note: string | null;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}

export interface DbQuoteRequestNote {
  id: string;
  quote_request_id: string;
  note: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}

export interface DbCustomerAddressBookEntry {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  type: "delivery" | "billing";
  isDefault?: boolean;
}

export interface DbCustomerSupportTicket {
  id: string;
  orderId?: string;
  subject: string;
  channel: "whatsapp" | "email";
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface DbCustomerReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  itemId?: string;
  itemName?: string;
  reason: string;
  note: string;
  attachmentUrl?: string;
  method: "exchange" | "credit" | "refund";
  status: "open" | "review" | "approved" | "awaiting_shipment" | "received" | "completed" | "rejected";
  createdAt: string;
}

export interface DbSavedCartRecord {
  id: string;
  name: string;
  items: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface DbFavoriteList {
  id: string;
  name: string;
  productIds: string[];
  createdAt: string;
}

export interface DbActiveCartRecord {
  items: unknown[];
  updatedAt: string;
}

export interface DbCustomerProfile {
  user_id: string;
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  companyName?: string;
  stateRegistration?: string;
  birthDate?: string;
  customerType: "retail" | "pro" | "business";
  customerOrigin: "web" | "whatsapp" | "instagram" | "showroom" | "store" | "integration";
  preferredChannel: "whatsapp" | "email";
  allowPromotions: boolean;
  preferredStoreId?: string | null;
  preferredStoreName?: string | null;
  firstAssistedBy?: string | null;
  addresses: DbCustomerAddressBookEntry[];
  activeCart?: DbActiveCartRecord | null;
  savedCarts: DbSavedCartRecord[];
  favorites: string[];
  lists: DbFavoriteList[];
  returns: DbCustomerReturnRequest[];
  tickets: DbCustomerSupportTicket[];
  updated_at: string;
}

export interface DbLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: OrderOrigin | "web" | "form";
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

export interface DbSiteBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface DbInstitutionalPage {
  slug:
    | "quem_somos"
    | "politica_entrega"
    | "politica_troca_devolucao"
    | "politica_privacidade"
    | "termos_uso"
    | "atendimento"
    | "rastreio"
    | "formas_pagamento"
    | "contato"
    | "faq";
  title: string;
  content: string;
  is_published: boolean;
  updated_at: string;
}

export interface DbSiteContent {
  banners: DbSiteBanner[];
  featured_category_ids: string[];
  go_live_product_ids: string[];
  trust_badges: string[];
  operational_messages: {
    pickup_message: string;
    delivery_message: string;
    human_support_message: string;
  };
  pages: DbInstitutionalPage[];
}

export type MarketingLifecycleStatus = "draft" | "review" | "scheduled" | "active" | "paused" | "ended" | "archived";
export type MarketingThemeType = "default" | "monthly" | "weekly" | "seasonal" | "category" | "flash" | "institutional";
export type MarketingCampaignType =
  | "monthly"
  | "fortnightly"
  | "weekly"
  | "commemorative"
  | "flash"
  | "clearance"
  | "launch"
  | "institutional"
  | "regional"
  | "product"
  | "category"
  | "b2b"
  | "cart_recovery"
  | "whatsapp";
export type MarketingRegionScope = "local" | "regional" | "state" | "national";

export interface DbEcommerceTheme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: MarketingThemeType;
  status: MarketingLifecycleStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  background_color: string | null;
  text_color: string | null;
  button_style: string | null;
  badge_style: string | null;
  desktop_hero_image: string | null;
  mobile_hero_image: string | null;
  background_image: string | null;
  logo_variant: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  whatsapp_message: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMarketingCampaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  objective: string | null;
  target_audience: string | null;
  type: MarketingCampaignType;
  status: MarketingLifecycleStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  theme_id: string | null;
  landing_page_id: string | null;
  coupon_id: string | null;
  region_scope: MarketingRegionScope;
  region_description: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  whatsapp_message: string | null;
  banner_desktop: string | null;
  banner_mobile: string | null;
  rules_json: Record<string, unknown>;
  products_json: string[];
  categories_json: string[];
  metrics_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMarketingBanner {
  id: string;
  name: string;
  slug: string;
  placement: string;
  status: MarketingLifecycleStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  desktop_image: string | null;
  mobile_image: string | null;
  alt_text: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
  campaign_id: string | null;
  theme_id: string | null;
  product_id: string | null;
  category_id: string | null;
  open_in_new_tab: boolean;
  tracking_key: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMarketingCard {
  id: string;
  name: string;
  placement: string;
  status: MarketingLifecycleStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  image: string | null;
  icon: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
  campaign_id: string | null;
  theme_id: string | null;
  product_id: string | null;
  category_id: string | null;
  background_color: string | null;
  text_color: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProductShowcase {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "manual" | "automatic";
  status: MarketingLifecycleStatus;
  placement: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  campaign_id: string | null;
  theme_id: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
  rule_type: "best_sellers" | "promotion" | "category" | "stock_high" | "newest" | "manual" | "campaign_products" | "related";
  rules_json: Record<string, unknown>;
  product_ids_json: string[];
  category_ids_json: string[];
  max_items: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCampaignLandingPage {
  id: string;
  campaign_id: string | null;
  theme_id: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  hero_desktop_image: string | null;
  hero_mobile_image: string | null;
  body_json: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  faq_json: Array<Record<string, unknown>>;
  showcase_ids_json: string[];
  banner_ids_json: string[];
  status: MarketingLifecycleStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbContentSnippet {
  id: string;
  key: string;
  name: string;
  type: "headline" | "subheadline" | "cta" | "whatsapp" | "seo" | "faq" | "institutional" | "campaign_text";
  content: string;
  status: MarketingLifecycleStatus;
  campaign_id: string | null;
  theme_id: string | null;
  product_id: string | null;
  category_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMarketingAsset {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "icon" | "other";
  url: string;
  alt_text: string | null;
  usage: "banner_desktop" | "banner_mobile" | "hero" | "card" | "landing" | "product" | "institutional" | "other";
  status: MarketingLifecycleStatus;
  campaign_id: string | null;
  theme_id: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbIntegrationProvider {
  id: string;
  key: string;
  name: string;
  category: "payment" | "freight" | "cep" | "whatsapp" | "email" | "analytics" | "pixel" | "storage" | "fiscal" | "webhook" | "other";
  status: "disabled" | "sandbox" | "production" | "error" | "pending";
  is_configured: boolean;
  is_required_for_production: boolean;
  last_checked_at: string | null;
  last_status_message: string | null;
  public_config_json: Record<string, unknown>;
  masked_secrets_json: Record<string, string>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbIntegrationSecret {
  id: string;
  provider_key: string;
  secret_key: string;
  encrypted_value: string;
  masked_value: string;
  environment: "development" | "sandbox" | "production";
  status: "active" | "rotated" | "revoked";
  rotated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMarketingEvent {
  id: string;
  event_type: string;
  campaign_id: string | null;
  theme_id: string | null;
  banner_id: string | null;
  showcase_id: string | null;
  product_id: string | null;
  source_path: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

const institutionalPlaceholders = new Set([
  "Regras de entrega local e regional para linhas de acabamento, alem da retirada em loja.",
  "Processo de trocas e devolucoes.",
  "Tratamento de dados e privacidade.",
  "Termos gerais do ecommerce.",
]);

function buildDefaultInstitutionalPages(now: string): DbInstitutionalPage[] {
  const company = [
    "Fornecedor: Garanhuns Metal Ltda.",
    "Nome fantasia: GAMEL Distribuidora",
    "CNPJ: 64.156.323/0001-51",
    "Inscricao estadual: 0000000-00",
    "Endereco: Rua Vereador Paulo Francisco Gomes, s/n, Lote Serra Branca, Quadra II, Lote 7, Magano, Garanhuns/PE, CEP 55294-770",
    "E-mail: comercial@gamelmetal.com",
    "Telefone: (87) 98139-0957",
    "WhatsApp: (87) 98139-0957",
  ].join("\n");

  return [
    {
      slug: "quem_somos",
      title: "Quem somos",
      content: [
        "Loja especializada em materiais de acabamento para obra, reforma e manutencao, com foco em forros PVC, tetos laminados, chapas UV, pisos vinilicos, ripados WPC e itens complementares.",
        "",
        "O ecommerce combina catalogo online, compra assistida, retirada em loja, entrega local/regional e envio nacional quando houver cotacao homologada.",
        "",
        company,
      ].join("\n"),
      is_published: true,
      updated_at: now,
    },
    {
      slug: "politica_entrega",
      title: "Politica de entrega e retirada",
      content: [
        "Modalidades: retirada em loja apos confirmacao operacional, entrega local/regional por rota e entrega nacional por transportadora ou Correios quando houver cotacao homologada.",
        "",
        "O prazo comeca apos confirmacao de pagamento, validacao cadastral quando aplicavel e liberacao operacional do pedido. Produtos sob consulta, volumosos, pesados, fracionados ou com corte/medida podem exigir confirmacao manual.",
        "",
        "Frete, prazo, modalidade e restricoes devem ser informados antes da conclusao da compra. Se o provedor externo de frete estiver indisponivel, o pedido deve ser bloqueado ou enviado para analise assistida.",
      ].join("\n"),
      is_published: true,
      updated_at: now,
    },
    {
      slug: "politica_troca_devolucao",
      title: "Politica de trocas e devolucoes",
      content: [
        "Compras feitas fora da loja fisica podem ser canceladas em ate 7 dias corridos contados do recebimento, conforme direito de arrependimento.",
        "",
        "Produtos duraveis contam com prazo legal de reclamacao de 90 dias para vicios aparentes ou de facil constatacao, observadas as condicoes de uso, instalacao e conservacao.",
        "",
        "Produtos cortados, instalados, usados, sob medida, com sinais de mau uso, armazenamento inadequado ou instalacao incorreta podem exigir analise tecnica antes de qualquer decisao.",
      ].join("\n"),
      is_published: true,
      updated_at: now,
    },
    {
      slug: "politica_privacidade",
      title: "Politica de privacidade",
      content: [
        "Dados pessoais sao tratados conforme a LGPD para cadastro, compra, pagamento, entrega, atendimento, seguranca, prevencao a fraude, obrigacoes fiscais e melhoria da experiencia.",
        "",
        "Podem ser coletados nome, CPF/CNPJ, telefone, e-mail, endereco, dados de pedido, historico de atendimento, cookies, IP e informacoes tecnicas do dispositivo.",
        "",
        "O titular pode solicitar confirmacao de tratamento, acesso, correcao, anonimizacao, bloqueio, eliminacao quando cabivel, informacao sobre compartilhamento e demais direitos previstos na LGPD pelo e-mail comercial@gamelmetal.com.",
      ].join("\n"),
      is_published: true,
      updated_at: now,
    },
    {
      slug: "termos_uso",
      title: "Termos de uso",
      content: [
        "Ao acessar ou comprar pelo site, o usuario concorda com estes termos, politicas institucionais e condicoes da oferta exibidas antes da conclusao do pedido.",
        "",
        "Pedidos com dados inconsistentes, suspeita de fraude, erro evidente de preco, indisponibilidade de estoque, bloqueio fiscal, restricao logistica ou falha de pagamento podem ser cancelados ou enviados para atendimento assistido.",
        "",
        company,
      ].join("\n"),
      is_published: true,
      updated_at: now,
    },
    {
      slug: "atendimento",
      title: "Atendimento",
      content: "Atendimento por WhatsApp, telefone, e-mail e loja fisica para duvidas, pedido, pagamento, entrega, retirada, troca, devolucao e pos-venda.",
      is_published: true,
      updated_at: now,
    },
    {
      slug: "rastreio",
      title: "Rastreio de pedido",
      content: "O pedido pode ser acompanhado pela pagina /rastrear com token de rastreamento. O status informa etapa operacional, itens, entrega, retirada e transportadora quando houver expedicao externa.",
      is_published: true,
      updated_at: now,
    },
    { slug: "formas_pagamento", title: "Formas de pagamento", content: "PIX, cartao, boleto e negociacao comercial para pedidos de acabamento.", is_published: true, updated_at: now },
    { slug: "contato", title: "Contato", content: "Canais de atendimento para showroom, WhatsApp, listas de material e suporte comercial.", is_published: true, updated_at: now },
    { slug: "faq", title: "FAQ", content: "Perguntas frequentes sobre medidas, aplicacao, entrega, retirada e compra assistida.", is_published: true, updated_at: now },
  ];
}

function normalizeInstitutionalPages(pages: unknown, seededPages: DbInstitutionalPage[]) {
  const existingPages = Array.isArray(pages) ? (pages as DbInstitutionalPage[]) : [];
  const bySlug = new Map(existingPages.map((page) => [page.slug, page]));

  return seededPages.map((seededPage) => {
    const existingPage = bySlug.get(seededPage.slug);
    if (!existingPage) return seededPage;
    const content = typeof existingPage.content === "string" ? existingPage.content.trim() : "";
    if (!content || institutionalPlaceholders.has(content)) return seededPage;
    return {
      ...seededPage,
      ...existingPage,
      title: existingPage.title || seededPage.title,
      content: existingPage.content,
      is_published: typeof existingPage.is_published === "boolean" ? existingPage.is_published : seededPage.is_published,
      updated_at: existingPage.updated_at || seededPage.updated_at,
    };
  });
}

type CalendarMonthSeed = {
  month: number;
  slug: string;
  name: string;
  concept: string;
  headline: string;
  products: string[];
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  weeks: Array<{ title: string; focus: string }>;
};

const annualMarketingCalendar: CalendarMonthSeed[] = [
  {
    month: 1,
    slug: "ano-novo-casa-nova",
    name: "Ano Novo, Casa Nova",
    concept: "Renovacao, planejamento de reforma e casa nova.",
    headline: "Comece o ano renovando sua casa com beleza, praticidade e economia.",
    products: ["chapas UV", "ripados", "pisos vinilicos", "forros", "telhas", "drywall"],
    colors: { primary: "#2563eb", secondary: "#f8fafc", accent: "#94a3b8", background: "#eff6ff", text: "#0f172a" },
    weeks: [
      { title: "Ano Novo, Casa Nova", focus: "inspiracao e renovacao" },
      { title: "Planeje sua Reforma", focus: "produtos por ambiente" },
      { title: "Proteja sua Casa no Verao", focus: "telhas, coberturas e areas externas" },
      { title: "Ofertas para Comecar o Ano", focus: "produtos com giro e estoque" },
    ],
  },
  {
    month: 2,
    slug: "verao-casa-pronta",
    name: "Verao, Carnaval e Casa Pronta para Receber",
    concept: "Casa bonita, visitas, areas sociais e praticidade.",
    headline: "Deixe sua casa mais bonita, pratica e pronta para receber.",
    products: ["chapas UV", "ripados", "telhas PVC", "policarbonato", "pisos vinilicos"],
    colors: { primary: "#f97316", secondary: "#fef3c7", accent: "#22c55e", background: "#fff7ed", text: "#111827" },
    weeks: [
      { title: "Esquenta da Reforma", focus: "produtos para renovar rapido" },
      { title: "Casa Bonita para Receber", focus: "salas e areas gourmet" },
      { title: "Pos-Carnaval da Obra", focus: "retomada de reforma" },
      { title: "Ofertas de Verao", focus: "coberturas e acabamentos" },
    ],
  },
  {
    month: 3,
    slug: "mes-do-consumidor",
    name: "Mes do Consumidor",
    concept: "Ofertas, confianca, preco competitivo e mais vendidos.",
    headline: "Mes do Consumidor na GAMEL.",
    products: ["mais vendidos", "telhas", "chapas UV", "ripados", "drywall", "pisos"],
    colors: { primary: "#dc2626", secondary: "#facc15", accent: "#111827", background: "#f9fafb", text: "#111827" },
    weeks: [
      { title: "Esquenta Mes do Consumidor", focus: "expectativa e vitrine" },
      { title: "Semana do Consumidor", focus: "ofertas principais" },
      { title: "Mais Vendidos GAMEL", focus: "prova social e autoridade" },
      { title: "Ultima Chance do Consumidor", focus: "urgencia e conversao" },
    ],
  },
  {
    month: 4,
    slug: "mes-da-reforma-acabamento",
    name: "Mes da Reforma e Acabamento",
    concept: "Transformacao, acabamento, design e solucoes modernas.",
    headline: "Transforme sua obra com acabamentos modernos, praticos e elegantes.",
    products: ["chapas UV", "ripados internos", "ripados externos", "teto laminado", "drywall"],
    colors: { primary: "#111827", secondary: "#e5e7eb", accent: "#a16207", background: "#f8fafc", text: "#111827" },
    weeks: [
      { title: "Semana das Chapas UV", focus: "paredes, cozinhas e escritorios" },
      { title: "Semana dos Ripados", focus: "design e textura" },
      { title: "Semana do Drywall e Forros", focus: "obra limpa e acabamento" },
      { title: "Reforma Inteligente", focus: "solucoes praticas" },
    ],
  },
  {
    month: 5,
    slug: "mes-das-maes",
    name: "Mes das Maes",
    concept: "Lar, carinho, familia, casa bonita e conforto.",
    headline: "Renove o lar de quem sempre cuidou de voce.",
    products: ["chapas UV", "ripados", "pisos vinilicos", "teto laminado", "forros", "puxadores"],
    colors: { primary: "#be185d", secondary: "#fce7f3", accent: "#d97706", background: "#fff1f2", text: "#3f1725" },
    weeks: [
      { title: "Casa com Carinho", focus: "emocao e inspiracao" },
      { title: "Semana das Maes", focus: "campanha principal" },
      { title: "Ambientes para Encantar", focus: "salas, cozinhas e quartos" },
      { title: "Renove com Economia", focus: "fechamento comercial" },
    ],
  },
  {
    month: 6,
    slug: "sao-joao-da-reforma",
    name: "Junho da Reforma: Copa e Sao Joao",
    concept: "Campanha regional de Junho 2026 unindo Copa do Mundo, festas juninas, casa pronta para receber e ofertas para ambientes de convivencia.",
    headline: "Prepare sua casa para torcer, receber e viver o Sao Joao com acabamento bonito e pratico.",
    products: ["telhas", "forros", "chapas UV", "ripados", "pisos vinilicos", "policarbonato"],
    colors: { primary: "#15803d", secondary: "#facc15", accent: "#ea580c", background: "#fff7ed", text: "#14532d" },
    weeks: [
      { title: "Esquenta Junho", focus: "calendario comercial Copa + Sao Joao e produtos para receber" },
      { title: "Casa Pronta para Torcer", focus: "salas, areas gourmet, TV e convivencia" },
      { title: "Arraia de Ofertas", focus: "kits regionais, retirada e atendimento assistido" },
      { title: "Ultima Chamada Junina", focus: "urgencia, prazo, retirada e fechamento" },
    ],
  },
  {
    month: 7,
    slug: "ferias-da-reforma",
    name: "Ferias da Reforma",
    concept: "Pequenas reformas, melhorias internas e casa nas ferias.",
    headline: "Aproveite as ferias para renovar sua casa com praticidade.",
    products: ["pisos vinilicos", "chapas UV", "ripados", "drywall", "forros", "puxadores"],
    colors: { primary: "#0ea5e9", secondary: "#e0f2fe", accent: "#16a34a", background: "#f0f9ff", text: "#082f49" },
    weeks: [
      { title: "Ferias da Reforma", focus: "inicio da campanha" },
      { title: "Pequenas Mudancas, Grande Resultado", focus: "rapida transformacao" },
      { title: "Casa Mais Bonita nas Ferias", focus: "ambientes internos" },
      { title: "Ofertas de Meio de Ano", focus: "promocoes e giro" },
    ],
  },
  {
    month: 8,
    slug: "mes-dos-pais-obra-segura",
    name: "Mes dos Pais e Obra Segura",
    concept: "Obra, seguranca, produtos tecnicos e protecao.",
    headline: "Para quem constroi, protege e cuida: solucoes para uma casa melhor.",
    products: ["telhas", "botas", "ferragens", "drywall", "motores de portao", "perfis"],
    colors: { primary: "#1e3a8a", secondary: "#e5e7eb", accent: "#facc15", background: "#f8fafc", text: "#111827" },
    weeks: [
      { title: "Mes dos Pais", focus: "emocional e institucional" },
      { title: "Semana da Obra Segura", focus: "botas, telhas e ferragens" },
      { title: "Solucoes para Construir Melhor", focus: "produtos tecnicos" },
      { title: "Ofertas para Pais e Profissionais", focus: "conversao e kits" },
    ],
  },
  {
    month: 9,
    slug: "mes-do-cliente",
    name: "Mes do Cliente",
    concept: "Fidelizacao, ofertas, cupons e relacionamento.",
    headline: "Mes do Cliente na GAMEL: ofertas, vantagens e atendimento de verdade.",
    products: ["mais vendidos", "kits", "combos", "alto giro"],
    colors: { primary: "#dc2626", secondary: "#facc15", accent: "#111827", background: "#fefce8", text: "#111827" },
    weeks: [
      { title: "Obrigado, Cliente", focus: "relacionamento e confianca" },
      { title: "Semana de Ofertas Especiais", focus: "promocoes principais" },
      { title: "Cliente GAMEL Tem Vantagem", focus: "cupons e combos" },
      { title: "Ultima Semana do Cliente", focus: "urgencia e fechamento" },
    ],
  },
  {
    month: 10,
    slug: "primavera-casa-moderna",
    name: "Primavera da Casa Moderna",
    concept: "Design, decoracao, renovacao visual e preparacao para fim de ano.",
    headline: "Renove sua casa com acabamentos modernos e cheios de estilo.",
    products: ["chapas UV", "ripados", "pisos vinilicos", "puxadores", "forros"],
    colors: { primary: "#16a34a", secondary: "#dcfce7", accent: "#a16207", background: "#f7fee7", text: "#14532d" },
    weeks: [
      { title: "Primavera da Renovacao", focus: "inspiracao visual" },
      { title: "Ambientes Modernos", focus: "chapas UV e ripados" },
      { title: "Detalhes que Transformam", focus: "puxadores e perfis" },
      { title: "Prepare sua Casa para o Fim de Ano", focus: "antecipacao" },
    ],
  },
  {
    month: 11,
    slug: "black-friday",
    name: "Black November / Black Friday",
    concept: "Ofertas agressivas, estoque, preco real e conversao.",
    headline: "Black Friday GAMEL: ofertas reais para reformar, construir e renovar.",
    products: ["alto giro", "kits", "combos", "telhas", "chapas UV", "ripados"],
    colors: { primary: "#111827", secondary: "#facc15", accent: "#dc2626", background: "#030712", text: "#f9fafb" },
    weeks: [
      { title: "Esquenta Black", focus: "captacao de interesse" },
      { title: "Pre-Black", focus: "primeiras ofertas" },
      { title: "Semana Black", focus: "ofertas principais" },
      { title: "Black Friday / Ultima Chance", focus: "urgencia maxima" },
      { title: "Pos-Black / Cyber Monday", focus: "extensao estrategica" },
    ],
  },
  {
    month: 12,
    slug: "natal-casa-pronta",
    name: "Natal e Casa Pronta para Receber",
    concept: "Familia, confraternizacao, casa bonita e fim de ano.",
    headline: "Deixe sua casa pronta para receber quem voce ama.",
    products: ["chapas UV", "ripados", "pisos vinilicos", "forros", "teto laminado", "puxadores"],
    colors: { primary: "#166534", secondary: "#fee2e2", accent: "#b45309", background: "#fef2f2", text: "#14532d" },
    weeks: [
      { title: "Casa Pronta para o Natal", focus: "inspiracao" },
      { title: "Renove Antes das Festas", focus: "rapida transformacao" },
      { title: "Ultima Chamada de Natal", focus: "prazos e retirada" },
      { title: "Retrospectiva e Ano Novo", focus: "institucional e janeiro" },
    ],
  },
];

function buildMarketingSeeds(now: string) {
  const defaultHeroImage = seedCategories[0]?.image ?? "/placeholder.svg";
  const campaignCategoryIds = (products: string[]) => {
    const normalizedProducts = products.map((product) => slugify(product));
    const matches = seedCategories
      .filter((category) => {
        const categorySlug = slugify(category.name);
        return normalizedProducts.some((productSlug) => categorySlug.includes(productSlug) || productSlug.includes(categorySlug));
      })
      .map((category) => category.id);
    return matches.length > 0 ? matches : seedCategories.slice(0, 3).map((category) => category.id);
  };

  const defaultTheme: DbEcommerceTheme = {
    id: "theme-default-gamel",
    name: "Tema Padrao${month.name} | GAMEL",
    slug: "padrao-gamel",
    description: "Visual base para quando nao houver campanha ativa.",
    type: "default",
    status: "active",
    priority: 1,
    starts_at: null,
    ends_at: null,
    timezone: "America/Fortaleza",
    color_primary: "#f97316",
    color_secondary: "#111827",
    color_accent: "#16a34a",
    background_color: "#fff7ed",
    text_color: "#111827",
    button_style: "solid",
    badge_style: "rounded",
    desktop_hero_image: defaultHeroImage,
    mobile_hero_image: defaultHeroImage,
    background_image: null,
    logo_variant: "default",
    headline: "GAMEL: acabamento moderno com atendimento regional em Garanhuns/PE.",
    subheadline: "Forros PVC, chapas UV, ripados, pisos vinilicos, telhas e itens para obra.",
    cta_label: "Ver catalogo",
    cta_url: "/produtos",
    whatsapp_message: "Ola, vim pelo site e quero ajuda para escolher produtos da GAMEL.",
    seo_title: "GAMEL | Acabamentos em Garanhuns|GAMEL | Acabamentos em Garanhuns",
    seo_description: "Catalogo regional de acabamentos com retirada, entrega local e atendimento comercial.",
    seo_keywords: ["forros pvc", "acabamentos", "garanhuns", "chapas uv", "ripados"],
    metadata_json: { fallback: true },
    created_by: "system",
    updated_by: "system",
    approved_by: "system",
    published_at: now,
    created_at: now,
    updated_at: now,
  };

  const ecommerceThemes: DbEcommerceTheme[] = [
    defaultTheme,
    ...annualMarketingCalendar.map((month) => ({
      id: `theme-${month.slug}`,
      name: month.name,
      slug: month.slug,
      description: month.concept,
      type: "monthly" as const,
      status: "draft" as const,
      priority: month.month === 11 ? 80 : month.month === 12 ? 70 : 40,
      starts_at: null,
      ends_at: null,
      timezone: "America/Fortaleza",
      color_primary: month.colors.primary,
      color_secondary: month.colors.secondary,
      color_accent: month.colors.accent,
      background_color: month.colors.background,
      text_color: month.colors.text,
      button_style: "solid",
      badge_style: "seasonal",
      desktop_hero_image: defaultHeroImage,
      mobile_hero_image: defaultHeroImage,
      background_image: null,
      logo_variant: "default",
      headline: month.headline,
      subheadline: month.concept,
      cta_label: "Pedir orcamento",
      cta_url: `/campanhas/${month.slug}`,
      whatsapp_message: `Ola, vim pelo site e quero orcamento dos produtos da campanha ${month.name}.`,
      seo_title: `${month.name} | GAMEL|${month.name} | GAMEL`,
      seo_description: month.headline,
      seo_keywords: month.products,
      metadata_json: { month: month.month, weeks: month.weeks },
      created_by: "system",
      updated_by: "system",
      approved_by: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    })),
  ];

  const marketingCampaigns: DbMarketingCampaign[] = annualMarketingCalendar.map((month) => ({
    id: `campaign-${month.slug}`,
    name: month.name,
    slug: month.slug,
    description: month.concept,
    objective: "Planejamento comercial sazonal e regional.",
    target_audience: "Clientes residenciais, profissionais de obra e lojistas regionais.",
    type: month.month === 11 ? "commemorative" : month.month === 12 ? "commemorative" : "monthly",
    status: "draft",
    priority: month.month === 11 ? 90 : month.month === 12 ? 80 : 45,
    starts_at: null,
    ends_at: null,
    timezone: "America/Fortaleza",
    theme_id: `theme-${month.slug}`,
    landing_page_id: `landing-${month.slug}`,
    coupon_id: null,
    region_scope: "regional",
    region_description: "Garanhuns e regiao, com preparo para ampliacao estadual/nacional.",
    headline: month.headline,
    subheadline: month.concept,
    cta_label: "Pedir orcamento",
    cta_url: `/campanhas/${month.slug}`,
    whatsapp_message: `Ola, vim pelo site e quero orcamento dos produtos da campanha ${month.name}.`,
    banner_desktop: defaultHeroImage,
    banner_mobile: defaultHeroImage,
    rules_json: {
      weekly_plan: month.weeks,
      products_focus: month.products,
      ...(month.month === 6 ? { campaign_context_2026: "copa_do_mundo_mais_festas_juninas" } : {}),
    },
    products_json: [],
    categories_json: campaignCategoryIds(month.products),
    metrics_json: {},
    created_by: "system",
    updated_by: "system",
    approved_by: null,
    published_at: null,
    created_at: now,
    updated_at: now,
  }));

  const marketingBanners: DbMarketingBanner[] = [
    {
      id: "banner-home-default",
      name: "Banner principal padrao",
      slug: "home-principal-padrao",
      placement: "home_hero",
      status: "active",
      priority: 1,
      starts_at: null,
      ends_at: null,
      desktop_image: defaultHeroImage,
      mobile_image: defaultHeroImage,
      alt_text: "GAMEL | Acabamentos em Garanhunsem Garanhuns com catalogo de acabamentos.",
      title: "Acabamento moderno para sua obra",
      subtitle: "Atendimento regional, retirada na loja e entrega local.",
      cta_label: "Ver produtos",
      cta_url: "/produtos",
      campaign_id: null,
      theme_id: "theme-default-gamel",
      product_id: null,
      category_id: null,
      open_in_new_tab: false,
      tracking_key: "home_default_hero",
      created_by: "system",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
  ];

  const marketingCards: DbMarketingCard[] = [
    {
      id: "card-whatsapp-default",
      name: "Card WhatsApp padrao",
      placement: "home_support",
      status: "active",
      priority: 1,
      starts_at: null,
      ends_at: null,
      image: null,
      icon: "message-circle",
      title: "Fale com o atendimento",
      subtitle: "Receba apoio para escolher medidas, produtos e entrega.",
      cta_label: "Chamar no WhatsApp",
      cta_url: "https://wa.me/5587981818752",
      campaign_id: null,
      theme_id: "theme-default-gamel",
      product_id: null,
      category_id: null,
      background_color: "#fff7ed",
      text_color: "#111827",
      metadata_json: { kind: "whatsapp" },
      created_by: "system",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
  ];

  const productShowcases: DbProductShowcase[] = [
    {
      id: "showcase-home-featured",
      name: "Vitrine principal da home",
      slug: "home-destaques",
      description: "Produtos destacados do mix regional controlado.",
      type: "automatic",
      status: "active",
      placement: "home",
      priority: 1,
      starts_at: null,
      ends_at: null,
      campaign_id: null,
      theme_id: "theme-default-gamel",
      title: "Produtos em destaque",
      subtitle: "Acabamentos selecionados para compra regional assistida.",
      cta_label: "Ver catalogo",
      cta_url: "/produtos",
      rule_type: "best_sellers",
      rules_json: { featured: true, hide_out_of_stock: true },
      product_ids_json: [],
      category_ids_json: [],
      max_items: 8,
      created_by: "system",
      updated_by: "system",
      created_at: now,
      updated_at: now,
    },
  ];

  const campaignLandingPages: DbCampaignLandingPage[] = annualMarketingCalendar.map((month) => ({
    id: `landing-${month.slug}`,
    campaign_id: `campaign-${month.slug}`,
    theme_id: `theme-${month.slug}`,
    slug: month.slug,
    title: month.name,
    subtitle: month.headline,
    hero_desktop_image: defaultHeroImage,
    hero_mobile_image: defaultHeroImage,
    body_json: { concept: month.concept, products: month.products, weeks: month.weeks },
    seo_title: `${month.name} | GAMEL|${month.name} | GAMEL`,
    seo_description: month.headline,
    seo_keywords: month.products,
    faq_json: [
      { question: "Como participar da campanha?", answer: "Consulte os produtos participantes e confirme disponibilidade pelo atendimento." },
      { question: "A campanha vale para entrega?", answer: "Entrega depende da rota regional, estoque, volume e validacao operacional." },
    ],
    showcase_ids_json: ["showcase-home-featured"],
    banner_ids_json: [],
    status: "draft",
    starts_at: null,
    ends_at: null,
    created_by: "system",
    updated_by: "system",
    created_at: now,
    updated_at: now,
  }));

  const contentSnippets: DbContentSnippet[] = [
    "Transforme seu ambiente com praticidade.",
    "Acabamentos modernos para valorizar sua casa.",
    "Sua obra merece produtos de qualidade.",
    "Renove sem complicacao.",
    "Oferta por tempo limitado.",
    "Produtos selecionados para sua reforma.",
    "Enquanto durar o estoque.",
    "Aproveite a campanha do mes.",
  ].map((content, index) => ({
    id: `snippet-${index + 1}`,
    key: `marketing.snippet.${index + 1}`,
    name: `Frase comercial ${index + 1}`,
    type: index < 4 ? "campaign_text" : "cta",
    content,
    status: "active",
    campaign_id: null,
    theme_id: null,
    product_id: null,
    category_id: null,
    created_by: "system",
    updated_by: "system",
    created_at: now,
    updated_at: now,
  }));

  const integrationProviders: DbIntegrationProvider[] = [
    ["manual-payment", "Pagamento Manual/Assistido", "payment", "sandbox", true, true],
    ["fake-payment", "Pagamento Fake/Local", "payment", "sandbox", true, false],
    ["mercadopago", "Mercado Pago", "payment", "pending", false, true],
    ["pickup", "Retirada em loja", "freight", "sandbox", true, true],
    ["local-delivery", "Entrega local", "freight", "sandbox", true, true],
    ["melhor-envio", "Melhor Envio", "freight", "pending", false, true],
    ["correios", "Correios", "freight", "pending", false, false],
    ["frenet", "Frenet", "freight", "pending", false, false],
    ["frete-barato", "Frete Barato", "freight", "pending", false, false],
    ["cepcerto", "CepCerto", "cep", "pending", false, false],
    ["cep", "Consulta CEP", "cep", "sandbox", true, false],
    ["whatsapp", "WhatsApp", "whatsapp", "pending", false, false],
    ["email", "Email transacional", "email", "pending", false, false],
    ["ga4", "Google Analytics 4", "analytics", "pending", false, false],
    ["gtm", "Google Tag Manager", "analytics", "pending", false, false],
    ["search-console", "Search Console", "analytics", "pending", false, false],
    ["meta-pixel", "Meta Pixel", "pixel", "pending", false, false],
    ["storage-cdn", "Storage/CDN", "storage", "pending", false, false],
    ["webhook-mercadopago", "Webhook Mercado Pago", "webhook", "pending", false, true],
    ["webhook-freight", "Webhook Frete", "webhook", "pending", false, false],
    ["webhook-fiscal-erp", "Webhook Fiscal/ERP futuro", "webhook", "pending", false, false],
    ["observability", "Observabilidade e Metrics", "other", "pending", false, true],
    ["fiscal-future", "Fiscal futuro", "fiscal", "pending", false, true],
  ].map(([key, name, category, status, configured, required]) => ({
    id: `integration-${key}`,
    key: String(key),
    name: String(name),
    category: category as DbIntegrationProvider["category"],
    status: status as DbIntegrationProvider["status"],
    is_configured: Boolean(configured),
    is_required_for_production: Boolean(required),
    last_checked_at: null,
    last_status_message: configured ? "Configuracao local/fallback disponivel." : "Pendente configuracao segura.",
    public_config_json: {},
    masked_secrets_json: {},
    created_by: "system",
    updated_by: "system",
    created_at: now,
    updated_at: now,
  }));

  return {
    ecommerceThemes,
    marketingCampaigns,
    marketingBanners,
    marketingCards,
    productShowcases,
    campaignLandingPages,
    contentSnippets,
    marketingAssets: [] as DbMarketingAsset[],
    integrationProviders,
    integrationSecrets: [] as DbIntegrationSecret[],
    marketingEvents: [] as DbMarketingEvent[],
  };
}

export interface DbCommercialSettings {
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

export interface DbDeliveryZone {
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

export interface DbFreightCarrier {
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

export interface DbEstablishment {
  id: string;
  code: string;
  cnpj: string;
  legal_name: string;
  trade_name: string;
  type: "importadora" | "comercial" | "servicos";
  role: "supplier" | "seller" | "service";
  state_registration: string | null;
  tax_regime: "simples" | "lucro_presumido" | "lucro_real";
  city: string;
  state: string;
  is_active: boolean;
  can_purchase: boolean;
  can_sell: boolean;
  can_issue_nfe: boolean;
  is_default_seller: boolean;
  created_at: string;
}

export interface DbFiscalProfile {
  id: string;
  product_id: string;
  establishment_id: string;
  ncm: string | null;
  cest: string | null;
  cfop_internal_default: string | null;
  cfop_interstate_default: string | null;
  origin_code: string | null;
  cst_icms_default: string | null;
  csosn_default: string | null;
  requires_difal: boolean;
  requires_fcp: boolean;
  tax_rule_status: "pending" | "ready" | "review";
  notes: string | null;
  updated_at: string;
}

export interface DbInventoryLot {
  id: string;
  product_id: string;
  establishment_id: string;
  source_type: "importacao" | "compra_nacional" | "transferencia";
  source_reference: string | null;
  source_document_number: string | null;
  quantity_in: number;
  quantity_available: number;
  unit_cost: number;
  landed_cost_unit: number | null;
  currency: string;
  created_at: string;
}

export interface DbInventoryMovement {
  id: string;
  product_id: string;
  lot_id: string | null;
  establishment_id: string;
  movement_type: "entrada" | "reserva" | "baixa" | "estorno" | "transferencia_out" | "transferencia_in" | "ajuste";
  quantity: number;
  order_id: string | null;
  fiscal_document_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface DbStockLocation {
  id: string;
  name: string;
  type: "loja" | "deposito" | "avaria" | "conferencia" | "transito";
  active: boolean;
}

export interface DbStockAddress {
  id: string;
  location_id: string;
  aisle: string | null;
  shelf: string | null;
  bin: string | null;
  label: string;
  active: boolean;
}

export interface DbPickingTask {
  id: string;
  order_id: string;
  assigned_to: string | null;
  assigned_role: string | null;
  status: "queued" | "assigned" | "in_progress" | "blocked" | "completed";
  priority: "critical" | "high" | "medium" | "low";
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPickingTaskItem {
  id: string;
  picking_task_id: string;
  product_id: string;
  product_name: string;
  quantity_required: number;
  quantity_picked: number;
  status: "pending" | "picked" | "divergent";
  divergence_reason: string | null;
  confirmed_at: string | null;
}

export interface DbFiscalDocument {
  id: string;
  establishment_id: string;
  order_id: string | null;
  document_type: "nfe_saida" | "nfe_transferencia" | "nfe_entrada";
  number: string | null;
  series: string | null;
  access_key: string | null;
  cfop_summary: string | null;
  xml_url: string | null;
  status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
  go_live_gate_status?: "required" | "deferred";
  go_live_gate_note?: string | null;
  provider: "manual" | "nfeio" | "tecnospeed" | "erp";
  message: string | null;
  issued_at: string | null;
  created_at: string;
}

export interface DbCatalogStagingItem {
  id: string;
  source_batch: string;
  source_sheet: string;
  sku_base: string | null;
  source_name: string;
  normalized_name: string;
  category_name: string | null;
  subcategory_name: string | null;
  brand_name: string | null;
  color: string | null;
  size: string | null;
  cost_price: number | null;
  suggested_price: number | null;
  estimated_stock: number | null;
  publish_flag: boolean;
  review_status: "approved" | "review" | "rejected";
  review_reason: string | null;
  mapped_product_id: string | null;
  fiscal_pending_fields: string[];
  suggested_family: string | null;
  suggested_category_slug: string | null;
  suggested_origin_code: string | null;
  suggested_ncm: string | null;
  suggested_dimensions: string | null;
  suggested_weight: number | null;
  enrichment_confidence: "high" | "medium" | "low" | null;
  enrichment_notes: string | null;
  import_notes: string | null;
  go_live_gate_status: "required" | "deferred";
  go_live_gate_note: string | null;
  created_at: string;
}

export interface DbFreightQuoteCache {
  id: string;
  cache_key: string;
  cep: string;
  subtotal: number;
  strategy: "cheapest" | "fastest";
  options: Array<Record<string, unknown>>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbFreightQuoteHistory {
  id: string;
  cep: string;
  provider: string;
  fallback_used: boolean;
  strategy: "cheapest" | "fastest";
  options_count: number;
  response_time_ms: number;
  cache_hit: boolean;
  status: "success" | "failed" | "degraded";
  message: string;
  created_at: string;
}

export interface DbFreightErrorLog {
  id: string;
  provider: string;
  cep: string;
  error_type: "timeout" | "network" | "provider" | "validation" | "unknown";
  message: string;
  response_time_ms: number | null;
  created_at: string;
}

export interface DbFiscalAiEvidence {
  type: "similar_product" | "ncm_table" | "manual_rule" | "catalog_context" | "openai" | "provider_unavailable";
  reference: string;
  detail: string;
}

export interface DbFiscalAiSuggestion {
  id: string;
  fiscal_profile_id: string;
  product_id: string;
  establishment_id: string;
  scope: "minimal-go-live" | "global";
  suggested_ncm: string | null;
  suggested_tax_code: string | null;
  suggested_tax_code_type: "cst_icms_default" | "csosn_default" | null;
  suggested_cest: string | null;
  suggested_origin_code: string | null;
  suggested_weight: number | null;
  confidence: "low" | "medium" | "high";
  evidence: DbFiscalAiEvidence[];
  rationale: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "exported" | "applied";
  source: "heuristic" | "openai" | "hybrid";
  openai_model: string | null;
  openai_response_id: string | null;
  openai_error: string | null;
  ncm_cache_version: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_fill_template: {
    ncm: string;
    cst_icms_default?: string;
    csosn_default?: string;
    weight: string;
    tax_rule_status: "review";
    note: string;
  } | null;
  exported_at: string | null;
  applied_at: string | null;
  ai_context_hash?: string | null;
  ai_prompt_version?: string | null;
  ai_input_chars?: number;
  ai_estimated_input_tokens?: number;
  ai_call_policy?: "skipped" | "called" | "cache_hit";
  created_at: string;
  updated_at: string;
}

export interface DbFiscalNcmCacheEntry {
  id: string;
  code: string;
  description: string;
  source: "manual_seed" | "siscomex_public" | "classif_reference";
  source_url: string | null;
  version: string;
  effective_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAiSettings {
  id: "default";
  enabled: boolean;
  provider: "openai";
  max_daily_calls: number;
  max_input_chars: number;
  cache_ttl_days: number;
  batch_max_items: number;
  fiscal_prompt_version: string;
  created_at: string;
  updated_at: string;
}

export interface DbAiUsageLog {
  id: string;
  module: "fiscal" | "catalog" | "marketing" | "support" | "operations";
  task: string;
  provider: "openai" | "local";
  model: string | null;
  status: "skipped" | "cache_hit" | "success" | "error";
  reason: string;
  context_hash: string | null;
  prompt_version: string | null;
  input_chars: number;
  output_chars: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  cache_hit: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbAdminManagementTaskOverride {
  id: string;
  task_id: string;
  source: "derived" | "manual";
  title: string | null;
  description: string | null;
  area: string | null;
  source_module: string | null;
  source_id: string | null;
  severity: string | null;
  owner: string | null;
  due_at: string | null;
  status: string | null;
  route: string | null;
  evidence_required: boolean | null;
  evidence: string | null;
  evidence_url: string | null;
  recommended_action: string | null;
  external_blocker: boolean | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAdminManagementTaskEvent {
  id: string;
  task_id: string;
  event_type: "created" | "updated" | "status_changed" | "evidence_added" | "assigned";
  actor_id: string | null;
  actor_name: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  evidence_url: string | null;
  created_at: string;
}

export interface DatabaseShape {
  users: DbUser[];
  brands: DbBrand[];
  categories: DbCategory[];
  products: DbProduct[];
  orders: DbOrder[];
  orderOperations: DbOrderOperation[];
  orderItems: DbOrderItem[];
  auditLogs: DbAuditLog[];
  coupons: DbCoupon[];
  stores: DbStore[];
  sellers: DbSeller[];
  payments: DbPaymentRecord[];
  quotes: DbQuote[];
  quoteItems: DbQuoteItem[];
  quoteRequests: DbQuoteRequest[];
  quoteRequestItems: DbQuoteRequestItem[];
  quoteRequestStatusHistory: DbQuoteRequestStatusHistory[];
  quoteRequestNotes: DbQuoteRequestNote[];
  customerProfiles: DbCustomerProfile[];
  leads: DbLead[];
  siteContent: DbSiteContent;
  commercialSettings: DbCommercialSettings;
  deliveryZones: DbDeliveryZone[];
  freightCarriers: DbFreightCarrier[];
  authOtps: DbOtpChallenge[];
  establishments: DbEstablishment[];
  fiscalProfiles: DbFiscalProfile[];
  inventoryLots: DbInventoryLot[];
  inventoryMovements: DbInventoryMovement[];
  stockLocations: DbStockLocation[];
  stockAddresses: DbStockAddress[];
  pickingTasks: DbPickingTask[];
  pickingTaskItems: DbPickingTaskItem[];
  fiscalDocuments: DbFiscalDocument[];
  catalogStaging: DbCatalogStagingItem[];
  freightQuoteCache: DbFreightQuoteCache[];
  freightQuoteHistory: DbFreightQuoteHistory[];
  freightErrorLogs: DbFreightErrorLog[];
  fiscalAiSuggestions: DbFiscalAiSuggestion[];
  fiscalNcmCache: DbFiscalNcmCacheEntry[];
  aiSettings: DbAiSettings[];
  aiUsageLogs: DbAiUsageLog[];
  ecommerceThemes: DbEcommerceTheme[];
  marketingCampaigns: DbMarketingCampaign[];
  marketingBanners: DbMarketingBanner[];
  marketingCards: DbMarketingCard[];
  productShowcases: DbProductShowcase[];
  campaignLandingPages: DbCampaignLandingPage[];
  contentSnippets: DbContentSnippet[];
  marketingAssets: DbMarketingAsset[];
  integrationProviders: DbIntegrationProvider[];
  integrationSecrets: DbIntegrationSecret[];
  marketingEvents: DbMarketingEvent[];
  adminManagementTaskOverrides: DbAdminManagementTaskOverride[];
  adminManagementTaskEvents: DbAdminManagementTaskEvent[];
}

let autoIsolatedTestDataDir: string | null = null;
let autoIsolatedTestDataDirRegistered = false;

function isTestRuntime() {
  return process.env.NODE_ENV === "test" || process.env.APP_ENV === "test" || process.argv.includes("--test");
}

function registerAutoIsolatedTestDataDirCleanup(targetDir: string) {
  if (autoIsolatedTestDataDirRegistered) return;
  autoIsolatedTestDataDirRegistered = true;

  const cleanup = () => {
    if (!autoIsolatedTestDataDir || !fs.existsSync(autoIsolatedTestDataDir)) return;
    try {
      fs.rmSync(autoIsolatedTestDataDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  };

  process.once("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  autoIsolatedTestDataDir = targetDir;
}

function resolveDbDataDir() {
  const explicitDataDir = process.env.DATA_DIR?.trim();
  if (explicitDataDir) {
    return {
      dataDir: path.resolve(explicitDataDir),
      isolatedForTests: false,
    };
  }

  if (isTestRuntime()) {
    const targetDir = autoIsolatedTestDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "gamel-db-test-"));
    registerAutoIsolatedTestDataDirCleanup(targetDir);
    process.env.DATA_DIR = targetDir;
    return {
      dataDir: path.resolve(targetDir),
      isolatedForTests: true,
    };
  }

  return {
    dataDir: path.resolve(process.cwd(), "server", "data"),
    isolatedForTests: false,
  };
}

const dbStorage = resolveDbDataDir();
export const dataDir = dbStorage.dataDir;
const dbPath = path.join(dataDir, "db.json");
const sqlitePath = path.join(dataDir, "app.sqlite");
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * Number(process.env.AUTH_SESSION_DAYS || 7);
const SQLITE_COLLECTION_TABLES = [
  "users",
  "brands",
  "categories",
  "products",
  "orders",
  "orderOperations",
  "orderItems",
  "auditLogs",
  "coupons",
  "stores",
  "sellers",
  "payments",
  "quotes",
  "quoteItems",
  "quoteRequests",
  "quoteRequestItems",
  "quoteRequestStatusHistory",
  "quoteRequestNotes",
  "customerProfiles",
  "leads",
  "deliveryZones",
  "freightCarriers",
  "authOtps",
  "establishments",
  "fiscalProfiles",
  "inventoryLots",
  "inventoryMovements",
  "stockLocations",
  "stockAddresses",
  "pickingTasks",
  "pickingTaskItems",
  "fiscalDocuments",
  "catalogStaging",
  "freightQuoteCache",
  "freightQuoteHistory",
  "freightErrorLogs",
  "fiscalAiSuggestions",
  "fiscalNcmCache",
  "aiSettings",
  "aiUsageLogs",
  "ecommerceThemes",
  "marketingCampaigns",
  "marketingBanners",
  "marketingCards",
  "productShowcases",
  "campaignLandingPages",
  "contentSnippets",
  "marketingAssets",
  "integrationProviders",
  "integrationSecrets",
  "marketingEvents",
  "adminManagementTaskOverrides",
  "adminManagementTaskEvents",
] as const;
const SQLITE_KEY_TABLES = ["siteContent", "commercialSettings"] as const;
type SqliteCollectionTable = (typeof SQLITE_COLLECTION_TABLES)[number];
type SqliteKeyTable = (typeof SQLITE_KEY_TABLES)[number];

const SQLITE_ID_KEYS: Record<SqliteCollectionTable, string> = {
  users: "id",
  brands: "id",
  categories: "id",
  products: "id",
  orders: "id",
  orderOperations: "id",
  orderItems: "id",
  auditLogs: "event_id",
  coupons: "id",
  stores: "id",
  sellers: "id",
  payments: "id",
  quotes: "id",
  quoteItems: "id",
  quoteRequests: "id",
  quoteRequestItems: "id",
  quoteRequestStatusHistory: "id",
  quoteRequestNotes: "id",
  customerProfiles: "user_id",
  leads: "id",
  deliveryZones: "id",
  freightCarriers: "id",
  authOtps: "id",
  establishments: "id",
  fiscalProfiles: "id",
  inventoryLots: "id",
  inventoryMovements: "id",
  stockLocations: "id",
  stockAddresses: "id",
  pickingTasks: "id",
  pickingTaskItems: "id",
  fiscalDocuments: "id",
  catalogStaging: "id",
  freightQuoteCache: "id",
  freightQuoteHistory: "id",
  freightErrorLogs: "id",
  fiscalAiSuggestions: "id",
  fiscalNcmCache: "id",
  aiSettings: "id",
  aiUsageLogs: "id",
  ecommerceThemes: "id",
  marketingCampaigns: "id",
  marketingBanners: "id",
  marketingCards: "id",
  productShowcases: "id",
  campaignLandingPages: "id",
  contentSnippets: "id",
  marketingAssets: "id",
  integrationProviders: "id",
  integrationSecrets: "id",
  marketingEvents: "id",
  adminManagementTaskOverrides: "id",
  adminManagementTaskEvents: "id",
};

let dbState: DatabaseShape | null = null;
let dbInitPromise: Promise<DatabaseShape> | null = null;
let dbFlushTail = Promise.resolve();
let lastDbFlushError: Error | null = null;
let pendingDbFlushes = 0;

function cloneDb<T>(value: T): T {
  return structuredClone(value);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

let sqliteDb: DatabaseSync | null = null;

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = new DatabaseSync(sqlitePath);
    sqliteDb.exec("PRAGMA journal_mode = WAL;");
    sqliteDb.exec("PRAGMA busy_timeout = 5000;");
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS meta_state (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );
    `);
    SQLITE_COLLECTION_TABLES.forEach((tableName) => {
      sqliteDb?.exec(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
      `);
    });
  }
  return sqliteDb;
}

function hasSqliteData() {
  const db = getSqliteDb();
  const row = db.prepare("SELECT COUNT(*) as total FROM users").get() as { total: number };
  return Number(row.total) > 0;
}

function writeSnapshotJson(db: DatabaseShape) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function writeSqlite(db: DatabaseShape) {
  const sqlite = getSqliteDb();
  try {
    sqlite.exec("BEGIN");
    SQLITE_COLLECTION_TABLES.forEach((tableName) => {
      sqlite.prepare(`DELETE FROM ${tableName}`).run();
      const idKey = SQLITE_ID_KEYS[tableName];
      const insert = sqlite.prepare(`INSERT INTO ${tableName} (id, payload) VALUES (?, ?)`);
      const rows = db[tableName] as unknown as Array<Record<string, unknown>>;
      const uniqueRows = new Map<string, Record<string, unknown>>();
      rows.forEach((item) => uniqueRows.set(String(item[idKey]), item));
      for (const item of uniqueRows.values()) {
        insert.run(String(item[idKey]), JSON.stringify(item));
      }
    });

    const upsertMeta = sqlite.prepare(`
      INSERT INTO meta_state (key, payload)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET payload = excluded.payload
    `);

    SQLITE_KEY_TABLES.forEach((key) => {
      upsertMeta.run(key, JSON.stringify(db[key]));
    });
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function readSqlite(): DatabaseShape {
  const sqlite = getSqliteDb();
  const readCollection = <T>(tableName: SqliteCollectionTable) => {
    const rows = sqlite.prepare(`SELECT payload FROM ${tableName}`).all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as T);
  };
  const readMeta = <T>(key: SqliteKeyTable, fallback: T) => {
    const row = sqlite.prepare("SELECT payload FROM meta_state WHERE key = ?").get(key) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as T) : fallback;
  };

  return {
    users: readCollection<DbUser>("users"),
    brands: readCollection<DbBrand>("brands"),
    categories: readCollection<DbCategory>("categories"),
    products: readCollection<DbProduct>("products"),
    orders: readCollection<DbOrder>("orders"),
    orderOperations: readCollection<DbOrderOperation>("orderOperations"),
    orderItems: readCollection<DbOrderItem>("orderItems"),
    auditLogs: readCollection<DbAuditLog>("auditLogs"),
    coupons: readCollection<DbCoupon>("coupons"),
    stores: readCollection<DbStore>("stores"),
    sellers: readCollection<DbSeller>("sellers"),
    payments: readCollection<DbPaymentRecord>("payments"),
    quotes: readCollection<DbQuote>("quotes"),
    quoteItems: readCollection<DbQuoteItem>("quoteItems"),
    quoteRequests: readCollection<DbQuoteRequest>("quoteRequests"),
    quoteRequestItems: readCollection<DbQuoteRequestItem>("quoteRequestItems"),
    quoteRequestStatusHistory: readCollection<DbQuoteRequestStatusHistory>("quoteRequestStatusHistory"),
    quoteRequestNotes: readCollection<DbQuoteRequestNote>("quoteRequestNotes"),
    customerProfiles: readCollection<DbCustomerProfile>("customerProfiles"),
    leads: readCollection<DbLead>("leads"),
    siteContent: readMeta<DbSiteContent>("siteContent", seedDb().siteContent),
    commercialSettings: readMeta<DbCommercialSettings>("commercialSettings", seedDb().commercialSettings),
    deliveryZones: readCollection<DbDeliveryZone>("deliveryZones"),
    freightCarriers: readCollection<DbFreightCarrier>("freightCarriers"),
    authOtps: readCollection<DbOtpChallenge>("authOtps"),
    establishments: readCollection<DbEstablishment>("establishments"),
    fiscalProfiles: readCollection<DbFiscalProfile>("fiscalProfiles"),
    inventoryLots: readCollection<DbInventoryLot>("inventoryLots"),
    inventoryMovements: readCollection<DbInventoryMovement>("inventoryMovements"),
    stockLocations: readCollection<DbStockLocation>("stockLocations"),
    stockAddresses: readCollection<DbStockAddress>("stockAddresses"),
    pickingTasks: readCollection<DbPickingTask>("pickingTasks"),
    pickingTaskItems: readCollection<DbPickingTaskItem>("pickingTaskItems"),
    fiscalDocuments: readCollection<DbFiscalDocument>("fiscalDocuments"),
    catalogStaging: readCollection<DbCatalogStagingItem>("catalogStaging"),
    freightQuoteCache: readCollection<DbFreightQuoteCache>("freightQuoteCache"),
    freightQuoteHistory: readCollection<DbFreightQuoteHistory>("freightQuoteHistory"),
    freightErrorLogs: readCollection<DbFreightErrorLog>("freightErrorLogs"),
    fiscalAiSuggestions: readCollection<DbFiscalAiSuggestion>("fiscalAiSuggestions"),
    fiscalNcmCache: readCollection<DbFiscalNcmCacheEntry>("fiscalNcmCache"),
    aiSettings: readCollection<DbAiSettings>("aiSettings"),
    aiUsageLogs: readCollection<DbAiUsageLog>("aiUsageLogs"),
    ecommerceThemes: readCollection<DbEcommerceTheme>("ecommerceThemes"),
    marketingCampaigns: readCollection<DbMarketingCampaign>("marketingCampaigns"),
    marketingBanners: readCollection<DbMarketingBanner>("marketingBanners"),
    marketingCards: readCollection<DbMarketingCard>("marketingCards"),
    productShowcases: readCollection<DbProductShowcase>("productShowcases"),
    campaignLandingPages: readCollection<DbCampaignLandingPage>("campaignLandingPages"),
    contentSnippets: readCollection<DbContentSnippet>("contentSnippets"),
    marketingAssets: readCollection<DbMarketingAsset>("marketingAssets"),
    integrationProviders: readCollection<DbIntegrationProvider>("integrationProviders"),
    integrationSecrets: readCollection<DbIntegrationSecret>("integrationSecrets"),
    marketingEvents: readCollection<DbMarketingEvent>("marketingEvents"),
    adminManagementTaskOverrides: readCollection<DbAdminManagementTaskOverride>("adminManagementTaskOverrides"),
    adminManagementTaskEvents: readCollection<DbAdminManagementTaskEvent>("adminManagementTaskEvents"),
  };
}

async function ensurePostgresSchema() {
  // Prisma Migrate owns the schema. Touching the model here makes startup fail
  // explicitly when `prisma migrate deploy` was not executed.
  await readPrismaRuntimeState();
}

async function hasPostgresData() {
  return hasPrismaRuntimeData();
}

async function readPostgres(): Promise<DatabaseShape> {
  const state = await readPrismaRuntimeState();
  const recordsByCollection = new Map<string, unknown[]>();
  for (const row of state.records) {
    const current = recordsByCollection.get(row.collection) ?? [];
    current.push(row.payload);
    recordsByCollection.set(row.collection, current);
  }
  const metaByKey = new Map(state.meta.map((row) => [row.key, row.payload]));
  const readCollection = async <T>(tableName: SqliteCollectionTable) => {
    return (recordsByCollection.get(tableName) ?? []) as T[];
  };
  const readMeta = async <T>(key: SqliteKeyTable, fallback: T) => {
    return (metaByKey.get(key) as T | undefined) ?? fallback;
  };

  const seed = seedDb();
  return {
    users: await readCollection<DbUser>("users"),
    brands: await readCollection<DbBrand>("brands"),
    categories: await readCollection<DbCategory>("categories"),
    products: await readCollection<DbProduct>("products"),
    orders: await readCollection<DbOrder>("orders"),
    orderOperations: await readCollection<DbOrderOperation>("orderOperations"),
    orderItems: await readCollection<DbOrderItem>("orderItems"),
    auditLogs: await readCollection<DbAuditLog>("auditLogs"),
    coupons: await readCollection<DbCoupon>("coupons"),
    stores: await readCollection<DbStore>("stores"),
    sellers: await readCollection<DbSeller>("sellers"),
    payments: await readCollection<DbPaymentRecord>("payments"),
    quotes: await readCollection<DbQuote>("quotes"),
    quoteItems: await readCollection<DbQuoteItem>("quoteItems"),
    quoteRequests: await readCollection<DbQuoteRequest>("quoteRequests"),
    quoteRequestItems: await readCollection<DbQuoteRequestItem>("quoteRequestItems"),
    quoteRequestStatusHistory: await readCollection<DbQuoteRequestStatusHistory>("quoteRequestStatusHistory"),
    quoteRequestNotes: await readCollection<DbQuoteRequestNote>("quoteRequestNotes"),
    customerProfiles: await readCollection<DbCustomerProfile>("customerProfiles"),
    leads: await readCollection<DbLead>("leads"),
    siteContent: await readMeta<DbSiteContent>("siteContent", seed.siteContent),
    commercialSettings: await readMeta<DbCommercialSettings>("commercialSettings", seed.commercialSettings),
    deliveryZones: await readCollection<DbDeliveryZone>("deliveryZones"),
    freightCarriers: await readCollection<DbFreightCarrier>("freightCarriers"),
    authOtps: await readCollection<DbOtpChallenge>("authOtps"),
    establishments: await readCollection<DbEstablishment>("establishments"),
    fiscalProfiles: await readCollection<DbFiscalProfile>("fiscalProfiles"),
    inventoryLots: await readCollection<DbInventoryLot>("inventoryLots"),
    inventoryMovements: await readCollection<DbInventoryMovement>("inventoryMovements"),
    stockLocations: await readCollection<DbStockLocation>("stockLocations"),
    stockAddresses: await readCollection<DbStockAddress>("stockAddresses"),
    pickingTasks: await readCollection<DbPickingTask>("pickingTasks"),
    pickingTaskItems: await readCollection<DbPickingTaskItem>("pickingTaskItems"),
    fiscalDocuments: await readCollection<DbFiscalDocument>("fiscalDocuments"),
    catalogStaging: await readCollection<DbCatalogStagingItem>("catalogStaging"),
    freightQuoteCache: await readCollection<DbFreightQuoteCache>("freightQuoteCache"),
    freightQuoteHistory: await readCollection<DbFreightQuoteHistory>("freightQuoteHistory"),
    freightErrorLogs: await readCollection<DbFreightErrorLog>("freightErrorLogs"),
    fiscalAiSuggestions: await readCollection<DbFiscalAiSuggestion>("fiscalAiSuggestions"),
    fiscalNcmCache: await readCollection<DbFiscalNcmCacheEntry>("fiscalNcmCache"),
    aiSettings: await readCollection<DbAiSettings>("aiSettings"),
    aiUsageLogs: await readCollection<DbAiUsageLog>("aiUsageLogs"),
    ecommerceThemes: await readCollection<DbEcommerceTheme>("ecommerceThemes"),
    marketingCampaigns: await readCollection<DbMarketingCampaign>("marketingCampaigns"),
    marketingBanners: await readCollection<DbMarketingBanner>("marketingBanners"),
    marketingCards: await readCollection<DbMarketingCard>("marketingCards"),
    productShowcases: await readCollection<DbProductShowcase>("productShowcases"),
    campaignLandingPages: await readCollection<DbCampaignLandingPage>("campaignLandingPages"),
    contentSnippets: await readCollection<DbContentSnippet>("contentSnippets"),
    marketingAssets: await readCollection<DbMarketingAsset>("marketingAssets"),
    integrationProviders: await readCollection<DbIntegrationProvider>("integrationProviders"),
    integrationSecrets: await readCollection<DbIntegrationSecret>("integrationSecrets"),
    marketingEvents: await readCollection<DbMarketingEvent>("marketingEvents"),
    adminManagementTaskOverrides: await readCollection<DbAdminManagementTaskOverride>("adminManagementTaskOverrides"),
    adminManagementTaskEvents: await readCollection<DbAdminManagementTaskEvent>("adminManagementTaskEvents"),
  };
}

async function writePostgres(db: DatabaseShape) {
  await replacePrismaRuntimeState(
    SQLITE_COLLECTION_TABLES.map((tableName) => {
      const idKey = SQLITE_ID_KEYS[tableName];
      const uniqueRows = new Map<string, Record<string, unknown>>();
      for (const item of db[tableName] as unknown as Array<Record<string, unknown>>) {
        uniqueRows.set(String(item[idKey]), item);
      }
      return {
        name: tableName,
        rows: [...uniqueRows.entries()].map(([id, payload]) => ({ id, payload })),
      };
    }),
    SQLITE_KEY_TABLES.map((key) => ({ key, payload: db[key] })),
  );
}

export function createId() {
  return randomUUID();
}

export function hashPassword(password: string, salt = randomUUID()) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, user: Pick<DbUser, "password_hash" | "password_salt">) {
  const expected = Buffer.from(user.password_hash, "hex");
  const actual = scryptSync(password, user.password_salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken() {
  return randomUUID();
}

export function getSessionExpiry() {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

function buildSeedDbTemplate(): DatabaseShape {
  const categories: DbCategory[] = seedCategories.map((category, index) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    image_url: category.image,
    sort_order: index + 1,
    is_active: true,
  }));

  const brands: DbBrand[] = seedBrandNames.map((name, index) => ({
    id: `brand-${index + 1}`,
    name,
    slug: slugify(name),
    is_active: true,
  }));

  const categoryNameMap: Record<string, string> = {
    "Forros em PVC": "Forros em PVC",
    "Tetos Vinílicos": "Tetos Vinílicos",
    "Pisos Vinílicos": "Pisos Vinílicos",
    "Ripados Internos": "Ripados Internos",
    "Ripados Externos": "Ripados Externos",
    "Chapas de Policarbonato": "Chapas de Policarbonato",
/* legacy category aliases retained only to migrate prior local data */
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
  const phase1AcceptedFamilyImageIds = new Set(["6", "7", "8"]);

  const products: DbProduct[] = seedProducts.map((product, index) => {
    const normalizedCategoryName = categoryNameMap[product.category] ?? product.category;
    const usesGamelProductPhoto = product.images.some((image) =>
      image.startsWith("/images/gamel/produtos/")
    );
    const isGamelNamedRipado = usesGamelProductPhoto && ["Ripados Internos", "Ripados Externos"].includes(product.category);
    const isGamelNamedTeto = usesGamelProductPhoto && product.category === "Tetos Vinílicos";
    const isGamelNamedProduct = isGamelNamedRipado || isGamelNamedTeto;
    const usesAcceptedPhase1FamilyImage = phase1AcceptedFamilyImageIds.has(product.id);
    const imageApprovedForPhase1 = usesGamelProductPhoto || usesAcceptedPhase1FamilyImage;
    const skuPrefix = isGamelNamedRipado ? "GML-RIP" : isGamelNamedTeto ? "GML-TLV" : "PVC";
    const skuNumber = isGamelNamedProduct ? product.id.padStart(3, "0") : product.id.padStart(4, "0");

    return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    ncm: null,
    cest: null,
    origin_code: "0",
    product_origin: "nacional",
    fiscal_group: normalizedCategoryName,
    tax_classification_status: "pending",
    cost_price: Number((product.price * 0.62).toFixed(2)),
    margin_target: 0.35,
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
    category_id: categories.find((item) => item.name === normalizedCategoryName)?.id ?? null,
    brand_id: brands.find((item) => item.name === product.brand)?.id ?? null,
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
    is_bulky: ["Chapas UV", "Chapas Policarbonato", "ACM", "Telha de Fibrocimento", "Telha de PVC"].includes(product.category),
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
    created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
    };
  });

  const adminPassword = hashPassword("admin123");
  const now = new Date().toISOString();
  const establishments: DbEstablishment[] = [
    {
      id: "est-importadora",
      code: "IMP",
      cnpj: "00.000.000/0001-11",
      legal_name: "GAMEL | Acabamentos em GaranhunsImportadora Ltda",
      trade_name: "GAMEL | Acabamentos em GaranhunsImportadora",
      type: "importadora",
      role: "supplier",
      state_registration: "ISENTO",
      tax_regime: "lucro_presumido",
      city: "Garanhuns",
      state: "PE",
      is_active: true,
      can_purchase: true,
      can_sell: false,
      can_issue_nfe: true,
      is_default_seller: false,
      created_at: now,
    },
    {
      id: "est-comercial",
      code: "COM",
      cnpj: "00.000.000/0001-22",
      legal_name: "GAMEL | Acabamentos em GaranhunsComercial Ltda",
      trade_name: "GAMEL",
      type: "comercial",
      role: "seller",
      state_registration: "000000000",
      tax_regime: "lucro_presumido",
      city: "Garanhuns",
      state: "PE",
      is_active: true,
      can_purchase: true,
      can_sell: true,
      can_issue_nfe: true,
      is_default_seller: true,
      created_at: now,
    },
    {
      id: "est-servicos",
      code: "SRV",
      cnpj: "00.000.000/0001-33",
      legal_name: "GAMEL | Acabamentos em GaranhunsServicos Ltda",
      trade_name: "GAMEL | Acabamentos em GaranhunsServicos",
      type: "servicos",
      role: "service",
      state_registration: null,
      tax_regime: "lucro_presumido",
      city: "Garanhuns",
      state: "PE",
      is_active: true,
      can_purchase: false,
      can_sell: false,
      can_issue_nfe: false,
      is_default_seller: false,
      created_at: now,
    },
  ];
  const fiscalProfiles: DbFiscalProfile[] = products.map((product) => ({
    id: `fiscal-${product.id}`,
    product_id: product.id,
    establishment_id: "est-comercial",
    ncm: product.ncm ?? null,
    cest: product.cest ?? null,
    cfop_internal_default: "5102",
    cfop_interstate_default: "6102",
    origin_code: product.origin_code ?? (product.product_origin === "importado" ? "1" : "0"),
    cst_icms_default: null,
    csosn_default: null,
    requires_difal: true,
    requires_fcp: true,
    tax_rule_status: "pending",
    notes: "Validar com contabilidade antes da publicacao fiscal.",
    updated_at: now,
  }));
  const inventoryLots: DbInventoryLot[] = products.map((product) => ({
    id: `lot-commercial-${product.id}`,
    product_id: product.id,
    establishment_id: "est-comercial",
    source_type: "transferencia",
    source_reference: "seed-transfer",
    source_document_number: null,
    quantity_in: Math.max(product.stock, 0),
    quantity_available: Math.max(product.stock, 0),
    unit_cost: Number(product.cost_price ?? product.price * 0.62),
    landed_cost_unit: Number(product.cost_price ?? product.price * 0.62),
    currency: "BRL",
    created_at: product.created_at,
  }));
  const stockLocations: DbStockLocation[] = [
    { id: "stock-location-store", name: "Estoque loja", type: "loja", active: true },
    { id: "stock-location-depot", name: "Deposito principal", type: "deposito", active: true },
    { id: "stock-location-conference", name: "Conferencia", type: "conferencia", active: true },
    { id: "stock-location-damaged", name: "Avaria", type: "avaria", active: true },
  ];
  const stockAddresses: DbStockAddress[] = [
    { id: "addr-store-a1", location_id: "stock-location-store", aisle: "A", shelf: "1", bin: "01", label: "A-1-01", active: true },
    { id: "addr-depot-b1", location_id: "stock-location-depot", aisle: "B", shelf: "1", bin: "01", label: "B-1-01", active: true },
  ];
  const marketingSeeds = buildMarketingSeeds(new Date().toISOString());

  return {
    users: [
      {
        id: "user-admin",
        email: "admin@gamelmetal.com",
        password_hash: adminPassword.hash,
        password_salt: adminPassword.salt,
        role: "admin",
        is_active: true,
        user_metadata: {
          full_name: "Administrador GAMEL",
          store_id: "garanhuns",
          store_name: "Showroom Garanhuns",
          can_start_assisted_sale: true,
          permission_profile_id: "admin_master",
          job_title: "Admin Master",
        },
        session_token: null,
        session_expires_at: null,
        session_persistent: true,
        created_at: now,
        updated_at: now,
        last_login_at: null,
      },
    ],
    brands,
    categories,
    products,
    orders: [],
    orderOperations: [],
    orderItems: [],
    auditLogs: [],
    coupons: [
      {
        id: "coupon-bemvindo",
        code: "BEMVINDO10",
        name: "Boas-vindas",
        discount_type: "percentage",
        discount_value: 10,
        min_order_value: 100,
        max_discount_value: null,
        description: "10% de desconto na primeira compra",
        is_active: true,
        starts_at: null,
        expires_at: null,
        max_uses: null,
        usage_limit_per_customer: null,
        used_count: 0,
        campaign_id: null,
        allowed_product_ids_json: [],
        allowed_category_ids_json: [],
        region_scope: "regional",
        created_by: "system",
        updated_by: "system",
        created_at: now,
        updated_at: now,
      },
      {
        id: "coupon-pvc20",
        code: "PVC20",
        name: "Desconto acabamentos",
        discount_type: "fixed",
        discount_value: 20,
        min_order_value: 300,
        max_discount_value: null,
        description: "R$ 20 de desconto em compras acima de R$ 300 em acabamentos",
        is_active: true,
        starts_at: null,
        expires_at: null,
        max_uses: null,
        usage_limit_per_customer: null,
        used_count: 0,
        campaign_id: null,
        allowed_product_ids_json: [],
        allowed_category_ids_json: [],
        region_scope: "regional",
        created_by: "system",
        updated_by: "system",
        created_at: now,
        updated_at: now,
      },
    ],
    stores: [
      {
        id: "store-garanhuns",
        name: "Showroom Garanhuns",
        code: "GAR-SHOW",
        type: "showroom",
        phone: "(87) 3761-0000",
        email: "garanhuns@gamelmetal.com",
        city: "Garanhuns",
        state: "PE",
        is_active: true,
        supports_pickup: true,
        supports_assisted_sale: true,
        delivery_radius_km: 40,
        created_at: new Date().toISOString(),
      },
    ],
    sellers: [
      {
        id: "seller-admin",
        user_id: "user-admin",
        seller_code: "SELLER-ADMIN",
        display_name: "Administrador GAMEL",
        role_label: "manager",
        is_active: true,
        primary_store_id: "store-garanhuns",
        allowed_store_ids: ["store-garanhuns"],
        created_at: new Date().toISOString(),
      },
    ],
    payments: [],
    quotes: [],
    quoteItems: [],
    quoteRequests: [],
    quoteRequestItems: [],
    quoteRequestStatusHistory: [],
    quoteRequestNotes: [],
    customerProfiles: [],
    leads: [],
    siteContent: {
      banners: [
        {
          id: "banner-1",
          title: "Forros PVC, tetos laminados, chapas UV, pisos vinilicos e ripados WPC",
          subtitle: "Catalogo focado em acabamento, retirada na loja, entrega local e apoio comercial por WhatsApp.",
          image_url: null,
          cta_label: "Ver catalogo",
          cta_link: "/produtos",
          is_active: true,
          sort_order: 1,
        },
      ],
      featured_category_ids: categories.slice(0, 5).map((category) => category.id),
      go_live_product_ids: products.filter((product) => product.is_featured).slice(0, 6).map((product) => product.id),
      trust_badges: ["Retirada na loja", "Entrega local", "Compra assistida", "Atendimento humano"],
      operational_messages: {
        pickup_message: "Retire na loja com confirmacao do pedido.",
        delivery_message: "Entrega local e regional conforme rota, volume e disponibilidade operacional.",
        human_support_message: "Conte com apoio do time comercial para obras, listas de material e compra assistida.",
      },
      pages: buildDefaultInstitutionalPages(now),
    },
    commercialSettings: {
      pickup_enabled: true,
      local_delivery_enabled: true,
      quote_enabled: true,
      assisted_sale_enabled: true,
      manual_approval_enabled: true,
      price_visibility_enabled: true,
      default_product_consultation_mode: false,
      pickup_message: "Retirada na loja disponivel para forros, pisos vinilicos, placas, laminados e ripados com confirmacao previa.",
      delivery_message: "Entrega local e regional sujeita a validacao operacional, rota e volume do pedido.",
      availability_message: "Disponibilidade exibida conforme estoque, medidas comerciais e politica da loja.",
    },
    deliveryZones: [
      {
        id: "zone-garanhuns-centro",
        neighborhood: "Centro",
        city: "Garanhuns",
        state: "PE",
        zip_code: "55295",
        delivery_fee: 18,
        estimated_days: 1,
        notes: "Entrega local prioritaria para regiao central.",
        is_active: true,
        allows_pickup: true,
        delivery_enabled: true,
      },
      {
        id: "zone-garanhuns-helio",
        neighborhood: "Heliopolis",
        city: "Garanhuns",
        state: "PE",
        zip_code: "55296",
        delivery_fee: 24,
        estimated_days: 2,
        notes: "Entrega local mediante agenda operacional.",
        is_active: true,
        allows_pickup: true,
        delivery_enabled: true,
      },
    ],
    freightCarriers: [
      {
        id: "carrier-correios",
        name: "Correios",
        code: "CORREIOS",
        service_types: ["PAC", "SEDEX"],
        coverage_states: ["BR"],
        max_weight_kg: 30,
        max_length_cm: 105,
        max_cubic_meters: 0.25,
        supports_heavy: false,
        supports_bulky: false,
        tracking_url_template: "https://rastreamento.correios.com.br/app/index.php?objeto={tracking_code}",
        notes: "Usar para volumes leves e medidas dentro do limite postal.",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "carrier-jadlog",
        name: "Jadlog",
        code: "JADLOG",
        service_types: ["Rodoviario", "Expresso"],
        coverage_states: ["BR"],
        max_weight_kg: 120,
        max_length_cm: 300,
        max_cubic_meters: 1.2,
        supports_heavy: true,
        supports_bulky: true,
        tracking_url_template: "https://www.jadlog.com.br/tracking?cte={tracking_code}",
        notes: "Opcao nacional para carga fracionada e volumes medios.",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: "carrier-braspress",
        name: "Braspress",
        code: "BRASPRESS",
        service_types: ["Carga fracionada", "Rodoviario"],
        coverage_states: ["BR"],
        max_weight_kg: 500,
        max_length_cm: 400,
        max_cubic_meters: 4,
        supports_heavy: true,
        supports_bulky: true,
        tracking_url_template: "https://www.braspress.com/rastreamento",
        notes: "Usar para cargas pesadas, volumosas ou paletizadas sob cotacao.",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    authOtps: [],
    establishments,
    fiscalProfiles,
    inventoryLots,
    inventoryMovements: [],
    stockLocations,
    stockAddresses,
    pickingTasks: [],
    pickingTaskItems: [],
    fiscalDocuments: [],
    catalogStaging: [],
    freightQuoteCache: [],
    freightQuoteHistory: [],
    freightErrorLogs: [],
    fiscalAiSuggestions: [],
    fiscalNcmCache: [],
    aiSettings: [
      {
        id: "default",
        enabled: false,
        provider: "openai",
        max_daily_calls: 200,
        max_input_chars: 6000,
        cache_ttl_days: 30,
        batch_max_items: 12,
        fiscal_prompt_version: "fiscal_v2_compact",
        created_at: now,
        updated_at: now,
      },
    ],
    aiUsageLogs: [],
    ecommerceThemes: marketingSeeds.ecommerceThemes,
    marketingCampaigns: marketingSeeds.marketingCampaigns,
    marketingBanners: marketingSeeds.marketingBanners,
    marketingCards: marketingSeeds.marketingCards,
    productShowcases: marketingSeeds.productShowcases,
    campaignLandingPages: marketingSeeds.campaignLandingPages,
    contentSnippets: marketingSeeds.contentSnippets,
    marketingAssets: marketingSeeds.marketingAssets,
    integrationProviders: marketingSeeds.integrationProviders,
    integrationSecrets: marketingSeeds.integrationSecrets,
    marketingEvents: marketingSeeds.marketingEvents,
    adminManagementTaskOverrides: [],
    adminManagementTaskEvents: [],
  };
}

let seedDbTemplateCache: DatabaseShape | null = null;

// seedDb() is called repeatedly on every write (migrateDb() alone calls it 3 times) to get a
// reference for merging defaults into existing data. Its output never depends on any argument
// and is only ever read, never mutated in place by callers — so building it once and handing
// out a cheap clone on every subsequent call avoids redoing the same expensive work (~70ms)
// on every single database write. Measured to cut migrateDb() from ~220ms to a few ms per call.
export function seedDb(): DatabaseShape {
  if (!seedDbTemplateCache) {
    seedDbTemplateCache = buildSeedDbTemplate();
  }
  return cloneDb(seedDbTemplateCache);
}

function normalizeOrderType(order: Record<string, unknown>): OrderType {
  if (order.order_type === "assisted" || order.is_assisted_sale === true) return "assisted";
  if (order.order_type === "pickup" || order.delivery_type === "pickup") return "pickup";
  return "normal";
}

function normalizeOrderOrigin(order: Record<string, unknown>, orderType: OrderType): OrderOrigin {
  if (order.order_origin === "showroom" || orderType === "assisted") return "showroom";
  if (order.order_origin === "whatsapp") return "whatsapp";
  if (order.order_origin === "instagram") return "instagram";
  if (order.order_origin === "marketplace") return "marketplace";
  if (order.order_origin === "integration") return "integration";
  return "ecommerce";
}

function normalizeSourceChannel(orderOrigin: OrderOrigin): SourceChannel {
  if (orderOrigin === "showroom") return "store";
  if (orderOrigin === "whatsapp") return "whatsapp";
  if (orderOrigin === "instagram") return "instagram";
  if (orderOrigin === "integration" || orderOrigin === "marketplace") return "integration";
  return "web";
}

function normalizeSourceActor(orderType: OrderType, orderOrigin: OrderOrigin): SourceActor {
  if (orderType === "assisted" || orderOrigin === "showroom" || orderOrigin === "whatsapp" || orderOrigin === "instagram") return "human";
  return "system";
}

export function migrateDb(db: DatabaseShape | Record<string, unknown>) {
  let changed = false;
  const seeded = seedDb();
  const nextDb = db as DatabaseShape & {
    users: Array<DbUser & { password?: string }>;
    orders: Array<Record<string, unknown>>;
    orderOperations?: Array<Record<string, unknown>>;
    auditLogs: Array<Record<string, unknown>>;
    stores?: Array<Record<string, unknown>>;
    sellers?: Array<Record<string, unknown>>;
    payments?: Array<Record<string, unknown>>;
    quotes?: Array<Record<string, unknown>>;
    quoteItems?: Array<Record<string, unknown>>;
    customerProfiles?: Array<Record<string, unknown>>;
    leads?: Array<Record<string, unknown>>;
    siteContent?: Record<string, unknown>;
    commercialSettings?: Record<string, unknown>;
    deliveryZones?: Array<Record<string, unknown>>;
    freightCarriers?: Array<Record<string, unknown>>;
    authOtps?: Array<Record<string, unknown>>;
    freightQuoteCache?: Array<Record<string, unknown>>;
    freightQuoteHistory?: Array<Record<string, unknown>>;
    freightErrorLogs?: Array<Record<string, unknown>>;
    fiscalAiSuggestions?: Array<Record<string, unknown>>;
    fiscalNcmCache?: Array<Record<string, unknown>>;
    aiSettings?: Array<Record<string, unknown>>;
    aiUsageLogs?: Array<Record<string, unknown>>;
    ecommerceThemes?: Array<Record<string, unknown>>;
    marketingCampaigns?: Array<Record<string, unknown>>;
    marketingBanners?: Array<Record<string, unknown>>;
    marketingCards?: Array<Record<string, unknown>>;
    productShowcases?: Array<Record<string, unknown>>;
    campaignLandingPages?: Array<Record<string, unknown>>;
    contentSnippets?: Array<Record<string, unknown>>;
    marketingAssets?: Array<Record<string, unknown>>;
    integrationProviders?: Array<Record<string, unknown>>;
    integrationSecrets?: Array<Record<string, unknown>>;
    marketingEvents?: Array<Record<string, unknown>>;
    adminManagementTaskOverrides?: Array<Record<string, unknown>>;
    adminManagementTaskEvents?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(nextDb.stores)) {
    nextDb.stores = seeded.stores as unknown as typeof nextDb.stores;
    changed = true;
  }
  if (!Array.isArray(nextDb.sellers)) {
    nextDb.sellers = seeded.sellers as unknown as typeof nextDb.sellers;
    changed = true;
  }
  if (!Array.isArray(nextDb.payments)) {
    nextDb.payments = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.adminManagementTaskOverrides)) {
    nextDb.adminManagementTaskOverrides = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.adminManagementTaskEvents)) {
    nextDb.adminManagementTaskEvents = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.orderOperations)) {
    nextDb.orderOperations = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quotes)) {
    nextDb.quotes = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quoteItems)) {
    nextDb.quoteItems = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quoteRequests)) {
    nextDb.quoteRequests = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quoteRequestItems)) {
    nextDb.quoteRequestItems = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quoteRequestStatusHistory)) {
    nextDb.quoteRequestStatusHistory = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.quoteRequestNotes)) {
    nextDb.quoteRequestNotes = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.customerProfiles)) {
    nextDb.customerProfiles = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.leads)) {
    nextDb.leads = [];
    changed = true;
  }
  if (!nextDb.siteContent || typeof nextDb.siteContent !== "object") {
    nextDb.siteContent = seeded.siteContent as unknown as typeof nextDb.siteContent;
    changed = true;
  }
  if (!nextDb.commercialSettings || typeof nextDb.commercialSettings !== "object") {
    nextDb.commercialSettings = seeded.commercialSettings as unknown as typeof nextDb.commercialSettings;
    changed = true;
  }
  if (!Array.isArray(nextDb.deliveryZones)) {
    nextDb.deliveryZones = seeded.deliveryZones as unknown as typeof nextDb.deliveryZones;
    changed = true;
  }
  if (!Array.isArray(nextDb.freightCarriers)) {
    nextDb.freightCarriers = seeded.freightCarriers as unknown as typeof nextDb.freightCarriers;
    changed = true;
  }
  if (!Array.isArray(nextDb.authOtps)) {
    nextDb.authOtps = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.freightQuoteCache)) {
    nextDb.freightQuoteCache = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.freightQuoteHistory)) {
    nextDb.freightQuoteHistory = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.freightErrorLogs)) {
    nextDb.freightErrorLogs = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.fiscalAiSuggestions)) {
    nextDb.fiscalAiSuggestions = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.fiscalNcmCache)) {
    nextDb.fiscalNcmCache = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.aiSettings)) {
    nextDb.aiSettings = seeded.aiSettings as unknown as typeof nextDb.aiSettings;
    changed = true;
  }
  if (!Array.isArray(nextDb.aiUsageLogs)) {
    nextDb.aiUsageLogs = [];
    changed = true;
  }
  const marketingSeeds = buildMarketingSeeds(new Date().toISOString());
  if (!Array.isArray(nextDb.ecommerceThemes)) {
    nextDb.ecommerceThemes = marketingSeeds.ecommerceThemes as unknown as typeof nextDb.ecommerceThemes;
    changed = true;
  }
  if (!Array.isArray(nextDb.marketingCampaigns)) {
    nextDb.marketingCampaigns = marketingSeeds.marketingCampaigns as unknown as typeof nextDb.marketingCampaigns;
    changed = true;
  }
  if (!Array.isArray(nextDb.marketingBanners)) {
    nextDb.marketingBanners = marketingSeeds.marketingBanners as unknown as typeof nextDb.marketingBanners;
    changed = true;
  }
  if (!Array.isArray(nextDb.marketingCards)) {
    nextDb.marketingCards = marketingSeeds.marketingCards as unknown as typeof nextDb.marketingCards;
    changed = true;
  }
  if (!Array.isArray(nextDb.productShowcases)) {
    nextDb.productShowcases = marketingSeeds.productShowcases as unknown as typeof nextDb.productShowcases;
    changed = true;
  }
  if (!Array.isArray(nextDb.campaignLandingPages)) {
    nextDb.campaignLandingPages = marketingSeeds.campaignLandingPages as unknown as typeof nextDb.campaignLandingPages;
    changed = true;
  }
  if (!Array.isArray(nextDb.contentSnippets)) {
    nextDb.contentSnippets = marketingSeeds.contentSnippets as unknown as typeof nextDb.contentSnippets;
    changed = true;
  }
  if (!Array.isArray(nextDb.marketingAssets)) {
    nextDb.marketingAssets = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.integrationProviders)) {
    nextDb.integrationProviders = marketingSeeds.integrationProviders as unknown as typeof nextDb.integrationProviders;
    changed = true;
  }
  if (!Array.isArray(nextDb.integrationSecrets)) {
    nextDb.integrationSecrets = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.marketingEvents)) {
    nextDb.marketingEvents = [];
    changed = true;
  }
  for (const seededTheme of marketingSeeds.ecommerceThemes) {
    if (!nextDb.ecommerceThemes.some((entry) => entry.slug === seededTheme.slug)) {
      nextDb.ecommerceThemes.push(seededTheme);
      changed = true;
    }
  }
  for (const seededCampaign of marketingSeeds.marketingCampaigns) {
    if (!nextDb.marketingCampaigns.some((entry) => entry.slug === seededCampaign.slug)) {
      nextDb.marketingCampaigns.push(seededCampaign);
      changed = true;
    }
  }
  for (const seededLandingPage of marketingSeeds.campaignLandingPages) {
    if (!nextDb.campaignLandingPages.some((entry) => entry.slug === seededLandingPage.slug)) {
      nextDb.campaignLandingPages.push(seededLandingPage);
      changed = true;
    }
  }
  for (const seededProvider of marketingSeeds.integrationProviders) {
    if (!nextDb.integrationProviders.some((entry) => entry.key === seededProvider.key)) {
      nextDb.integrationProviders.push(seededProvider);
      changed = true;
    }
  }
  const seededBannersBySlug = new Map(marketingSeeds.marketingBanners.map((entry) => [entry.slug, entry]));
  const seededShowcasesBySlug = new Map(marketingSeeds.productShowcases.map((entry) => [entry.slug, entry]));
  const seededCardsById = new Map(marketingSeeds.marketingCards.map((entry) => [entry.id, entry]));
  const seededSnippetsByKey = new Map(marketingSeeds.contentSnippets.map((entry) => [entry.key, entry]));
  const seededThemesBySlug = new Map(marketingSeeds.ecommerceThemes.map((entry) => [entry.slug, entry]));
  const seededCampaignsBySlug = new Map(marketingSeeds.marketingCampaigns.map((entry) => [entry.slug, entry]));
  for (const seededBanner of seededBannersBySlug.values()) {
    if (!nextDb.marketingBanners.some((entry) => entry.slug === seededBanner.slug)) {
      nextDb.marketingBanners.push(seededBanner);
      changed = true;
    }
  }
  for (const seededShowcase of seededShowcasesBySlug.values()) {
    if (!nextDb.productShowcases.some((entry) => entry.slug === seededShowcase.slug)) {
      nextDb.productShowcases.push(seededShowcase);
      changed = true;
    }
  }
  for (const seededCard of seededCardsById.values()) {
    if (!nextDb.marketingCards.some((entry) => entry.id === seededCard.id)) {
      nextDb.marketingCards.push(seededCard);
      changed = true;
    }
  }
  for (const seededSnippet of seededSnippetsByKey.values()) {
    if (!nextDb.contentSnippets.some((entry) => entry.key === seededSnippet.key)) {
      nextDb.contentSnippets.push(seededSnippet);
      changed = true;
    }
  }
  nextDb.ecommerceThemes = nextDb.ecommerceThemes.map((entry) => {
    const theme = entry as DbEcommerceTheme;
    const seededTheme = seededThemesBySlug.get(theme.slug);
    if (!seededTheme) return entry;
    const nextTheme = { ...theme };
    if (!nextTheme.desktop_hero_image && seededTheme.desktop_hero_image) {
      nextTheme.desktop_hero_image = seededTheme.desktop_hero_image;
      changed = true;
    }
    if (!nextTheme.mobile_hero_image && seededTheme.mobile_hero_image) {
      nextTheme.mobile_hero_image = seededTheme.mobile_hero_image;
      changed = true;
    }
    return nextTheme;
  }) as unknown as typeof nextDb.ecommerceThemes;
  nextDb.marketingCampaigns = nextDb.marketingCampaigns.map((entry) => {
    const campaign = entry as DbMarketingCampaign;
    const seededCampaign = seededCampaignsBySlug.get(campaign.slug);
    if (!seededCampaign) return entry;
    const nextCampaign = { ...campaign };
    const canRefreshSystemCampaign = campaign.created_by === "system" && campaign.slug === "sao-joao-da-reforma";
    if (canRefreshSystemCampaign) {
      if (nextCampaign.name !== seededCampaign.name) {
        nextCampaign.name = seededCampaign.name;
        changed = true;
      }
      if (nextCampaign.description !== seededCampaign.description) {
        nextCampaign.description = seededCampaign.description;
        changed = true;
      }
      if (nextCampaign.headline !== seededCampaign.headline) {
        nextCampaign.headline = seededCampaign.headline;
        changed = true;
      }
      if (nextCampaign.subheadline !== seededCampaign.subheadline) {
        nextCampaign.subheadline = seededCampaign.subheadline;
        changed = true;
      }
      const nextRulesJson = {
        ...(nextCampaign.rules_json ?? {}),
        ...(seededCampaign.rules_json ?? {}),
        campaign_context_2026: "copa_do_mundo_mais_festas_juninas",
      };
      if (JSON.stringify(nextCampaign.rules_json ?? {}) !== JSON.stringify(nextRulesJson)) {
        nextCampaign.rules_json = nextRulesJson;
        changed = true;
      }
    }
    if (!nextCampaign.banner_desktop && seededCampaign.banner_desktop) {
      nextCampaign.banner_desktop = seededCampaign.banner_desktop;
      changed = true;
    }
    if (!nextCampaign.banner_mobile && seededCampaign.banner_mobile) {
      nextCampaign.banner_mobile = seededCampaign.banner_mobile;
      changed = true;
    }
    if ((!Array.isArray(nextCampaign.categories_json) || nextCampaign.categories_json.length === 0) && seededCampaign.categories_json.length > 0) {
      nextCampaign.categories_json = seededCampaign.categories_json;
      changed = true;
    }
    if (!nextCampaign.cta_label && seededCampaign.cta_label) {
      nextCampaign.cta_label = seededCampaign.cta_label;
      changed = true;
    }
    if (!nextCampaign.cta_url && seededCampaign.cta_url) {
      nextCampaign.cta_url = seededCampaign.cta_url;
      changed = true;
    }
    if (!nextCampaign.whatsapp_message && seededCampaign.whatsapp_message) {
      nextCampaign.whatsapp_message = seededCampaign.whatsapp_message;
      changed = true;
    }
    return nextCampaign;
  }) as unknown as typeof nextDb.marketingCampaigns;
  nextDb.campaignLandingPages = nextDb.campaignLandingPages.map((entry) => {
    const landingPage = entry as DbCampaignLandingPage;
    const seededLandingPage = marketingSeeds.campaignLandingPages.find((seededEntry) => seededEntry.slug === landingPage.slug);
    if (!seededLandingPage) return entry;
    const nextLandingPage = { ...landingPage };
    if (!nextLandingPage.hero_desktop_image && seededLandingPage.hero_desktop_image) {
      nextLandingPage.hero_desktop_image = seededLandingPage.hero_desktop_image;
      changed = true;
    }
    if (!nextLandingPage.hero_mobile_image && seededLandingPage.hero_mobile_image) {
      nextLandingPage.hero_mobile_image = seededLandingPage.hero_mobile_image;
      changed = true;
    }
    return nextLandingPage;
  }) as unknown as typeof nextDb.campaignLandingPages;

  nextDb.users = nextDb.users.map((user) => {
    const nextUser = { ...user } as typeof user & { password?: string };
    if (!nextUser.password_hash || !nextUser.password_salt) {
      const migrated = hashPassword(nextUser.password || "admin123");
      nextUser.password_hash = migrated.hash;
      nextUser.password_salt = migrated.salt;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(nextUser, "password")) {
      delete nextUser.password;
      changed = true;
    }
    if (typeof nextUser.session_token === "undefined") {
      nextUser.session_token = null;
      changed = true;
    }
    if (typeof nextUser.session_expires_at === "undefined") {
      nextUser.session_expires_at = null;
      changed = true;
    }
    if (typeof nextUser.session_persistent === "undefined") {
      nextUser.session_persistent = true;
      changed = true;
    }
    if (typeof nextUser.is_active === "undefined") {
      nextUser.is_active = true;
      changed = true;
    }
    if (typeof nextUser.created_at === "undefined") {
      nextUser.created_at = new Date().toISOString();
      changed = true;
    }
    if (typeof nextUser.updated_at === "undefined") {
      nextUser.updated_at = nextUser.created_at;
      changed = true;
    }
    if (typeof nextUser.last_login_at === "undefined") {
      nextUser.last_login_at = null;
      changed = true;
    }
    if (!nextUser.user_metadata || typeof nextUser.user_metadata !== "object") {
      nextUser.user_metadata = { full_name: nextUser.email };
      changed = true;
    }
    if (!nextUser.user_metadata.full_name) {
      nextUser.user_metadata.full_name = nextUser.email;
      changed = true;
    }
    if (typeof nextUser.user_metadata.store_id === "undefined") {
      nextUser.user_metadata.store_id = nextUser.role === "admin" || nextUser.role === "seller" ? "garanhuns" : null;
      changed = true;
    }
    if (typeof nextUser.user_metadata.store_name === "undefined") {
      nextUser.user_metadata.store_name = nextUser.role === "admin" || nextUser.role === "seller" ? "Showroom Garanhuns" : null;
      changed = true;
    }
    if (typeof nextUser.user_metadata.can_start_assisted_sale === "undefined") {
      nextUser.user_metadata.can_start_assisted_sale = nextUser.role === "admin" || nextUser.role === "seller";
      changed = true;
    }
    if (typeof nextUser.user_metadata.permission_profile_id === "undefined") {
      nextUser.user_metadata.permission_profile_id = nextUser.role === "admin" ? "administrador" : null;
      changed = true;
    }
    if (nextUser.user_metadata.permission_profile_id === "admin_master" || nextUser.user_metadata.permission_profile_id === "admin") {
      nextUser.user_metadata.permission_profile_id = "administrador";
      changed = true;
    }
    if (typeof nextUser.user_metadata.job_title === "undefined") {
      nextUser.user_metadata.job_title = nextUser.role === "admin" ? "Admin Master" : null;
      changed = true;
    }
    return nextUser;
  });

  if (!Array.isArray(nextDb.stockLocations)) {
    nextDb.stockLocations = [
      { id: "stock-location-store", name: "Estoque loja", type: "loja", active: true },
      { id: "stock-location-depot", name: "Deposito principal", type: "deposito", active: true },
      { id: "stock-location-conference", name: "Conferencia", type: "conferencia", active: true },
      { id: "stock-location-damaged", name: "Avaria", type: "avaria", active: true },
    ];
    changed = true;
  }
  if (!Array.isArray(nextDb.stockAddresses)) {
    nextDb.stockAddresses = [
      { id: "addr-store-a1", location_id: "stock-location-store", aisle: "A", shelf: "1", bin: "01", label: "A-1-01", active: true },
      { id: "addr-depot-b1", location_id: "stock-location-depot", aisle: "B", shelf: "1", bin: "01", label: "B-1-01", active: true },
    ];
    changed = true;
  }
  if (!Array.isArray(nextDb.pickingTasks)) {
    nextDb.pickingTasks = [];
    changed = true;
  }
  if (!Array.isArray(nextDb.pickingTaskItems)) {
    nextDb.pickingTaskItems = [];
    changed = true;
  }

  // Older local snapshots may contain category rows that were merged by slug
  // and later reintroduced with the same id. Keep one deterministic record so
  // the SQLite primary key is always valid during bootstrap.
  const categoryById = new Map<string, DbCategory>();
  nextDb.categories.forEach((category) => {
    const existing = categoryById.get(category.id);
    categoryById.set(category.id, existing ? { ...existing, ...category } : category);
  });
  if (categoryById.size !== nextDb.categories.length) {
    nextDb.categories = [...categoryById.values()];
    changed = true;
  }

  for (const seededCategory of seeded.categories) {
    const existingCategory = nextDb.categories.find((category) => category.id === seededCategory.id || category.slug === seededCategory.slug);
    if (existingCategory) {
      continue;
    }
    nextDb.categories.push(seededCategory);
    changed = true;
  }

  for (const seededBrand of seeded.brands) {
    const existingBrand = nextDb.brands.find((brand) => brand.id === seededBrand.id || brand.slug === seededBrand.slug);
    if (existingBrand) {
      const nextBrand = {
        ...existingBrand,
        ...seededBrand,
        is_active: typeof existingBrand.is_active === "boolean" ? existingBrand.is_active : true,
      };
      if (JSON.stringify(existingBrand) !== JSON.stringify(nextBrand)) {
        Object.assign(existingBrand, nextBrand);
        changed = true;
      }
      continue;
    }
    nextDb.brands.push(seededBrand);
    changed = true;
  }

  for (const seededProduct of seeded.products) {
    const existingProduct = nextDb.products.find((product) => product.id === seededProduct.id || product.slug === seededProduct.slug);
    if (existingProduct) {
      // As imagens oficiais do catálogo substituem as mídias legadas do snapshot.
      const hasOfficialSeededMedia = seededProduct.images.some((image) =>
        image.includes("/images/gamel/produtos/") && (image.endsWith(".webp") || image.includes("/oficiais/")),
      );
      const nextProduct = {
        ...seededProduct,
        ...existingProduct,
        sku: seededProduct.sku,
        name: seededProduct.name,
        slug: existingProduct.slug || seededProduct.slug,
        subcategory: seededProduct.subcategory,
        description: seededProduct.description,
        short_description: seededProduct.short_description,
        long_description: seededProduct.long_description,
        application: seededProduct.application,
        sale_type: seededProduct.sale_type,
        unit_measure: seededProduct.unit_measure,
        display_unit: seededProduct.display_unit,
        base_price: Number(existingProduct.base_price ?? 0) > 0 ? existingProduct.base_price : seededProduct.base_price,
        promotional_price: existingProduct.promotional_price ?? seededProduct.promotional_price,
        price: Number(existingProduct.price ?? 0) > 0 ? existingProduct.price : seededProduct.price,
        original_price: existingProduct.original_price ?? seededProduct.original_price,
        category_id: seededProduct.category_id,
        brand_id: seededProduct.brand_id,
        sales_unit: existingProduct.sales_unit ?? seededProduct.sales_unit,
        measures: seededProduct.measures,
        material: seededProduct.material,
        diameter: seededProduct.diameter,
        area_per_piece: seededProduct.area_per_piece,
        area_per_box: seededProduct.area_per_box,
        meters_per_piece: seededProduct.meters_per_piece,
        pieces_per_box: seededProduct.pieces_per_box,
        meters_per_box: seededProduct.meters_per_box,
        meters_per_package: seededProduct.meters_per_package,
        volume_per_unit: seededProduct.volume_per_unit,
        volume_per_package: seededProduct.volume_per_package,
        minimum_sale_quantity: seededProduct.minimum_sale_quantity,
        sale_multiple: seededProduct.sale_multiple,
        fractional_sale_allowed: seededProduct.fractional_sale_allowed,
        default_loss_margin: seededProduct.default_loss_margin,
        loss_margin: seededProduct.loss_margin,
        image_url: hasOfficialSeededMedia ? seededProduct.image_url : existingProduct.image_url ?? seededProduct.image_url,
        images: hasOfficialSeededMedia ? seededProduct.images : Array.isArray(existingProduct.images) && existingProduct.images.length > 0 ? existingProduct.images : seededProduct.images,
        image_alt_text: typeof existingProduct.image_alt_text === "string" && existingProduct.image_alt_text.trim().length > 0
          ? existingProduct.image_alt_text
          : seededProduct.image_alt_text ?? `${seededProduct.name} - ${seeded.categories.find((category) => category.id === seededProduct.category_id)?.name ?? "catalogo"}`,
        image_review_status:
          existingProduct.image_review_status === "approved" ||
          existingProduct.image_review_status === "manual_review" ||
          existingProduct.image_review_status === "suspect" ||
          existingProduct.image_review_status === "missing" ||
          existingProduct.image_review_status === "duplicate" ||
          existingProduct.image_review_status === "broken" ||
          existingProduct.image_review_status === "rejected"
            ? existingProduct.image_review_status
            : seededProduct.image_review_status ?? "manual_review",
        image_review_notes: typeof existingProduct.image_review_notes === "string"
          ? existingProduct.image_review_notes
          : seededProduct.image_review_notes ?? "Imagem seeded exige validacao humana por categoria, cor e acabamento antes da aprovacao final.",
        rating: typeof existingProduct.rating === "number" ? existingProduct.rating : seededProduct.rating,
        review_count: typeof existingProduct.review_count === "number" ? existingProduct.review_count : seededProduct.review_count,
        // Official catalog batches are part of the public home showcase.
        is_featured: hasOfficialSeededMedia || (typeof existingProduct.is_featured === "boolean" ? existingProduct.is_featured : seededProduct.is_featured),
        top_seller: typeof existingProduct.top_seller === "boolean" ? existingProduct.top_seller : seededProduct.top_seller,
        weight: existingProduct.weight ?? seededProduct.weight,
        width: existingProduct.width ?? seededProduct.width,
        height: existingProduct.height ?? seededProduct.height,
        length: existingProduct.length ?? seededProduct.length,
        thickness: existingProduct.thickness ?? seededProduct.thickness,
        dimensions: existingProduct.dimensions ?? seededProduct.dimensions,
        weight_per_unit: existingProduct.weight_per_unit ?? seededProduct.weight_per_unit,
        weight_per_package: existingProduct.weight_per_package ?? seededProduct.weight_per_package,
        pieces_per_package: existingProduct.pieces_per_package ?? seededProduct.pieces_per_package,
        packaging_closed: existingProduct.packaging_closed ?? seededProduct.packaging_closed,
        created_at: existingProduct.created_at || seededProduct.created_at,
        related_product_ids: Array.isArray(existingProduct.related_product_ids)
          ? existingProduct.related_product_ids
          : Array.isArray(seededProduct.related_product_ids)
            ? seededProduct.related_product_ids
            : [],
        variations: Array.isArray(existingProduct.variations)
          ? existingProduct.variations
          : Array.isArray(seededProduct.variations)
            ? seededProduct.variations
            : [],
      };
      if (JSON.stringify(existingProduct) !== JSON.stringify(nextProduct)) {
        Object.assign(existingProduct, nextProduct);
        changed = true;
      }
      continue;
    }
    nextDb.products.push(seededProduct);
    changed = true;
  }

  for (const seededZone of seeded.deliveryZones) {
    if (!nextDb.deliveryZones.some((zone) => zone.id === seededZone.id)) {
      nextDb.deliveryZones.push(seededZone);
      changed = true;
    }
  }

  nextDb.establishments = Array.isArray(nextDb.establishments) ? nextDb.establishments : [];
  for (const seededEstablishment of seeded.establishments) {
    if (!nextDb.establishments.some((entry) => entry.id === seededEstablishment.id)) {
      nextDb.establishments.push(seededEstablishment);
      changed = true;
    }
  }

  nextDb.establishments = nextDb.establishments.map((establishmentRecord) => ({
    id: String(establishmentRecord.id || createId()),
    code: String(establishmentRecord.code || "EST"),
    cnpj: String(establishmentRecord.cnpj || ""),
    legal_name: String(establishmentRecord.legal_name || establishmentRecord.trade_name || "Estabelecimento"),
    trade_name: String(establishmentRecord.trade_name || establishmentRecord.legal_name || "Estabelecimento"),
    type:
      establishmentRecord.type === "importadora" || establishmentRecord.type === "servicos"
        ? establishmentRecord.type
        : "comercial",
    role:
      establishmentRecord.role === "supplier" || establishmentRecord.role === "service"
        ? establishmentRecord.role
        : "seller",
    state_registration: typeof establishmentRecord.state_registration === "string" ? establishmentRecord.state_registration : null,
    tax_regime:
      establishmentRecord.tax_regime === "simples" || establishmentRecord.tax_regime === "lucro_real"
        ? establishmentRecord.tax_regime
        : "lucro_presumido",
    city: String(establishmentRecord.city || "Garanhuns"),
    state: String(establishmentRecord.state || "PE"),
    is_active: typeof establishmentRecord.is_active === "boolean" ? Boolean(establishmentRecord.is_active) : true,
    can_purchase: typeof establishmentRecord.can_purchase === "boolean" ? Boolean(establishmentRecord.can_purchase) : true,
    can_sell: typeof establishmentRecord.can_sell === "boolean" ? Boolean(establishmentRecord.can_sell) : false,
    can_issue_nfe: typeof establishmentRecord.can_issue_nfe === "boolean" ? Boolean(establishmentRecord.can_issue_nfe) : false,
    is_default_seller: typeof establishmentRecord.is_default_seller === "boolean" ? Boolean(establishmentRecord.is_default_seller) : false,
    created_at: String(establishmentRecord.created_at || new Date().toISOString()),
  }));

  const seededCategoryIds = new Set(seeded.categories.map((category) => category.id));
  const seededBrandIds = new Set(seeded.brands.map((brand) => brand.id));
  const seededProductIds = new Set(seeded.products.map((product) => product.id));
  const seededProductSlugs = new Set(seeded.products.map((product) => product.slug));

  nextDb.products = nextDb.products.map((productRecord) => {
    const product = productRecord as DbProduct & Record<string, unknown>;
    const category = nextDb.categories.find((item) => item.id === ((product.category_id as string | null) ?? null));
    const nextProduct = {
      ...product,
      sku: typeof product.sku === "string" ? product.sku : `PVC-${String(product.id).padStart(4, "0")}`,
      ncm: typeof product.ncm === "string" ? product.ncm : null,
      cest: typeof product.cest === "string" ? product.cest : null,
      origin_code: typeof product.origin_code === "string" ? product.origin_code : "0",
      product_origin: product.product_origin === "importado" ? "importado" : "nacional",
      fiscal_group: typeof product.fiscal_group === "string" ? product.fiscal_group : category?.name ?? null,
      tax_classification_status:
        product.tax_classification_status === "ready" || product.tax_classification_status === "review" ? product.tax_classification_status : "pending",
      cost_price: typeof product.cost_price === "number" ? product.cost_price : Number(Number(product.price || 0) * 0.62),
      margin_target: typeof product.margin_target === "number" ? product.margin_target : 0.35,
      subcategory: typeof product.subcategory === "string" ? product.subcategory : category?.name ?? null,
      long_description: typeof product.long_description === "string" ? product.long_description : (product.description as string | null) ?? null,
      application: typeof product.application === "string" ? product.application : (product.subcategory as string | null) ?? category?.name ?? null,
      sale_type: (product.sale_type as DbProduct["sale_type"]) || "unidade",
      unit_measure: (product.unit_measure as DbProduct["unit_measure"]) || "un",
      sales_unit: typeof product.sales_unit === "string" ? product.sales_unit : "un",
      measures: typeof product.measures === "string" ? product.measures : (product.diameter as string | null) ?? null,
      dimensions: typeof product.dimensions === "string" ? product.dimensions : null,
      width: typeof product.width === "number" ? product.width : null,
      height: typeof product.height === "number" ? product.height : null,
      length: typeof product.length === "number" ? product.length : null,
      linear_measure: typeof product.linear_measure === "number" ? product.linear_measure : null,
      square_measure: typeof product.square_measure === "number" ? product.square_measure : null,
      area_per_piece: typeof product.area_per_piece === "number" ? product.area_per_piece : null,
      area_per_box: typeof product.area_per_box === "number" ? product.area_per_box : null,
      pieces_per_box: typeof product.pieces_per_box === "number" ? product.pieces_per_box : null,
      meters_per_box: typeof product.meters_per_box === "number" ? product.meters_per_box : null,
      loss_margin: typeof product.loss_margin === "number" ? product.loss_margin : null,
      stock_minimum: typeof product.stock_minimum === "number" ? product.stock_minimum : 5,
      status_product: (product.status_product as DbProduct["status_product"]) || "active",
      availability:
        (product.availability as DbProduct["availability"]) ||
        (Number(product.stock || 0) > 0 ? "disponivel" : "indisponivel"),
      delivery_type: (product.delivery_type as DbProduct["delivery_type"]) || "pickup_or_delivery",
      is_on_request: typeof product.is_on_request === "boolean" ? product.is_on_request : false,
      is_heavy: typeof product.is_heavy === "boolean" ? product.is_heavy : false,
      is_bulky: typeof product.is_bulky === "boolean" ? product.is_bulky : false,
      top_seller: typeof product.top_seller === "boolean" ? product.top_seller : false,
      related_product_ids: Array.isArray(product.related_product_ids) ? product.related_product_ids.map((item) => String(item)) : [],
      variations: Array.isArray(product.variations) ? product.variations : [],
      image_alt_text: typeof product.image_alt_text === "string" && product.image_alt_text.trim().length > 0 ? product.image_alt_text.trim() : `${String(product.name || "Produto")} - ${category?.name ?? "catalogo"}`,
      image_review_status:
        product.image_review_status === "approved" ||
        product.image_review_status === "manual_review" ||
        product.image_review_status === "suspect" ||
        product.image_review_status === "missing" ||
        product.image_review_status === "duplicate" ||
        product.image_review_status === "broken" ||
        product.image_review_status === "rejected"
          ? product.image_review_status
          : "manual_review",
      image_review_notes: typeof product.image_review_notes === "string" ? product.image_review_notes : null,
    } satisfies DbProduct;
    const isSeededProduct = seededProductIds.has(nextProduct.id) || seededProductSlugs.has(nextProduct.slug);
    const belongsToSeededCategory = nextProduct.category_id ? seededCategoryIds.has(nextProduct.category_id) : false;
    if (!isSeededProduct && !belongsToSeededCategory && nextProduct.is_active) {
      nextProduct.is_active = false;
      changed = true;
    }
    return nextProduct;
  });

  const phase1AcceptedFamilyImageProductIds = new Set(["6", "7", "8"]);
  nextDb.products = nextDb.products.map((product) => {
    if (!phase1AcceptedFamilyImageProductIds.has(product.id)) return product;
    const note = "Imagem de familia correta aceita para catalogo Fase 1. Substituir por foto real GAMEL quando disponivel. [metadata-ok]";
    if (product.image_review_status !== "approved" || !String(product.image_review_notes || "").includes("Imagem de familia correta aceita")) {
      changed = true;
      return {
        ...product,
        image_review_status: "approved" as const,
        image_review_notes: note,
        image_alt_text: product.image_alt_text || `${product.name} - catalogo GAMEL`,
      };
    }
    return product;
  });

  const activeCategoryIds = new Set(nextDb.products.filter((product) => product.is_active).map((product) => product.category_id).filter(Boolean));
  nextDb.categories = nextDb.categories.map((category) => {
    if (typeof category.is_active === "boolean") return category;
    const shouldStayActive = seededCategoryIds.has(category.id) || activeCategoryIds.has(category.id);
    changed = true;
    return { ...category, is_active: shouldStayActive };
  });

  const activeBrandIds = new Set(nextDb.products.filter((product) => product.is_active).map((product) => product.brand_id).filter(Boolean));
  nextDb.brands = nextDb.brands.map((brand) => {
    const shouldStayActive = seededBrandIds.has(brand.id) || activeBrandIds.has(brand.id);
    if (brand.is_active !== shouldStayActive) changed = true;
    return { ...brand, is_active: shouldStayActive };
  });

  nextDb.stores = nextDb.stores.map((storeRecord) => ({
    id: String(storeRecord.id || createId()),
    name: String(storeRecord.name || "Loja"),
    code: String(storeRecord.code || `STORE-${Date.now().toString().slice(-4)}`),
    type: (storeRecord.type as DbStore["type"]) || "store",
    phone: (storeRecord.phone as string | null) ?? null,
    email: (storeRecord.email as string | null) ?? null,
    city: String(storeRecord.city || "Garanhuns"),
    state: String(storeRecord.state || "PE"),
    is_active: typeof storeRecord.is_active === "boolean" ? Boolean(storeRecord.is_active) : true,
    supports_pickup: typeof storeRecord.supports_pickup === "boolean" ? Boolean(storeRecord.supports_pickup) : true,
    supports_assisted_sale: typeof storeRecord.supports_assisted_sale === "boolean" ? Boolean(storeRecord.supports_assisted_sale) : true,
    delivery_radius_km: typeof storeRecord.delivery_radius_km === "number" ? Number(storeRecord.delivery_radius_km) : null,
    created_at: String(storeRecord.created_at || new Date().toISOString()),
  }));

  nextDb.sellers = nextDb.sellers.map((sellerRecord) => ({
    id: String(sellerRecord.id || createId()),
    user_id: String(sellerRecord.user_id || ""),
    seller_code: String(sellerRecord.seller_code || `SELLER-${Date.now().toString().slice(-4)}`),
    display_name: String(sellerRecord.display_name || (sellerRecord as unknown as Record<string, unknown>).seller_name || "Vendedor"),
    role_label: (sellerRecord.role_label as DbSeller["role_label"]) || "seller",
    is_active: typeof sellerRecord.is_active === "boolean" ? Boolean(sellerRecord.is_active) : true,
    primary_store_id: (sellerRecord.primary_store_id as string | null) ?? null,
    allowed_store_ids: Array.isArray(sellerRecord.allowed_store_ids) ? sellerRecord.allowed_store_ids.map((item) => String(item)) : [],
    created_at: String(sellerRecord.created_at || new Date().toISOString()),
  }));

  nextDb.deliveryZones = nextDb.deliveryZones.map((zoneRecord) => ({
    id: String(zoneRecord.id || createId()),
    neighborhood: String(zoneRecord.neighborhood || "Bairro"),
    city: String(zoneRecord.city || "Garanhuns"),
    state: String(zoneRecord.state || "PE"),
    zip_code:
      typeof zoneRecord.zip_code === "string"
        ? zoneRecord.zip_code
        : String(zoneRecord.id || "").includes("garanhuns")
          ? "55295"
          : null,
    delivery_fee: Number.isFinite(Number(zoneRecord.delivery_fee)) ? Number(zoneRecord.delivery_fee) : 0,
    estimated_days: Number.isFinite(Number(zoneRecord.estimated_days)) ? Math.max(Number(zoneRecord.estimated_days), 1) : 1,
    notes: typeof zoneRecord.notes === "string" ? zoneRecord.notes : null,
    is_active: typeof zoneRecord.is_active === "boolean" ? Boolean(zoneRecord.is_active) : true,
    allows_pickup: typeof zoneRecord.allows_pickup === "boolean" ? Boolean(zoneRecord.allows_pickup) : true,
    delivery_enabled: typeof zoneRecord.delivery_enabled === "boolean" ? Boolean(zoneRecord.delivery_enabled) : true,
  }));

  nextDb.payments = nextDb.payments.map((paymentRecord) => ({
    id: String(paymentRecord.id || createId()),
    order_id: String(paymentRecord.order_id || ""),
    provider: (paymentRecord.provider as DbPaymentRecord["provider"]) || "manual",
    method: (paymentRecord.method as PaymentMethod) || "pix",
    status: (paymentRecord.status as DbPaymentRecord["status"]) || "pending",
    amount: Number(paymentRecord.amount || 0),
    correlation_id: String(paymentRecord.correlation_id || createId()),
    external_reference: (paymentRecord.external_reference as string | null) ?? null,
    webhook_idempotency_key: (paymentRecord.webhook_idempotency_key as string | null) ?? null,
    created_at: String(paymentRecord.created_at || new Date().toISOString()),
    updated_at: String(paymentRecord.updated_at || paymentRecord.created_at || new Date().toISOString()),
  }));

  nextDb.quotes = nextDb.quotes.map((quoteRecord) => ({
    id: String(quoteRecord.id || createId()),
    quote_number: String(quoteRecord.quote_number || `Q${Date.now().toString().slice(-8)}`),
    status: (quoteRecord.status as DbQuote["status"]) || "draft",
    customer_name: String(quoteRecord.customer_name || ""),
    customer_email: (quoteRecord.customer_email as string | null) ?? null,
    customer_phone: (quoteRecord.customer_phone as string | null) ?? null,
    notes: (quoteRecord.notes as string | null) ?? null,
    subtotal: Number(quoteRecord.subtotal || 0),
    total: Number(quoteRecord.total || 0),
    seller_id: (quoteRecord.seller_id as string | null) ?? null,
    seller_name: (quoteRecord.seller_name as string | null) ?? null,
    store_id: (quoteRecord.store_id as string | null) ?? null,
    store_name: (quoteRecord.store_name as string | null) ?? null,
    correlation_id: String(quoteRecord.correlation_id || createId()),
    converted_order_id: (quoteRecord.converted_order_id as string | null) ?? null,
    created_at: String(quoteRecord.created_at || new Date().toISOString()),
    updated_at: String(quoteRecord.updated_at || quoteRecord.created_at || new Date().toISOString()),
  }));

  nextDb.quoteItems = nextDb.quoteItems.map((quoteItemRecord) => ({
    id: String(quoteItemRecord.id || createId()),
    quote_id: String(quoteItemRecord.quote_id || ""),
    product_id: String(quoteItemRecord.product_id || ""),
    product_name: String(quoteItemRecord.product_name || ""),
    quantity: Number(quoteItemRecord.quantity || 0),
    unit_price: Number(quoteItemRecord.unit_price || 0),
    total_price: Number(quoteItemRecord.total_price || 0),
  }));

  const normalizeQuoteRequestStatusValue = (value: unknown): QuoteRequestStatus => {
    if (value === "qualified") return "negotiating";
    return ["new", "triage", "contacted", "waiting_customer", "negotiating", "converted", "lost", "archived"].includes(String(value))
      ? value as QuoteRequestStatus
      : "new";
  };

  nextDb.quoteRequests = nextDb.quoteRequests.map((requestRecord) => ({
    id: String(requestRecord.id || createId()),
    protocol: String(requestRecord.protocol || `GML-${Date.now().toString().slice(-8)}`),
    access_token: String(requestRecord.access_token || createId()),
    status: normalizeQuoteRequestStatusValue(requestRecord.status),
    customer_name: String(requestRecord.customer_name || ""),
    customer_phone: String(requestRecord.customer_phone || ""),
    customer_email: (requestRecord.customer_email as string | null) ?? null,
    company_name: (requestRecord.company_name as string | null) ?? null,
    cnpj: (requestRecord.cnpj as string | null) ?? null,
    segment: (requestRecord.segment as string | null) ?? null,
    city: String(requestRecord.city || ""),
    state: (requestRecord.state as string | null) ?? null,
    contact_preference: (requestRecord.contact_preference as DbQuoteRequest["contact_preference"]) || "whatsapp",
    message: (requestRecord.message as string | null) ?? null,
    page_origin: String(requestRecord.page_origin || "/orcamento"),
    utm_json: requestRecord.utm_json && typeof requestRecord.utm_json === "object" && !Array.isArray(requestRecord.utm_json) ? requestRecord.utm_json : {},
    responsible_user_id: (requestRecord.responsible_user_id as string | null) ?? null,
    responsible_name: (requestRecord.responsible_name as string | null) ?? null,
    next_action: (requestRecord.next_action as string | null) ?? null,
    next_action_due_at: (requestRecord.next_action_due_at as string | null) ?? null,
    lost_reason: (requestRecord.lost_reason as string | null) ?? null,
    archived_at: (requestRecord.archived_at as string | null) ?? null,
    privacy_policy_version: (requestRecord.privacy_policy_version as string | null) ?? null,
    consent_recorded_at: (requestRecord.consent_recorded_at as string | null) ?? null,
    marketing_consent: Boolean(requestRecord.marketing_consent),
    marketing_consent_recorded_at: (requestRecord.marketing_consent_recorded_at as string | null) ?? null,
    idempotency_key: String(requestRecord.idempotency_key || createId()),
    correlation_id: String(requestRecord.correlation_id || createId()),
    lead_id: (requestRecord.lead_id as string | null) ?? null,
    company_id: (requestRecord.company_id as string | null) ?? null,
    commercial_quote_id: (requestRecord.commercial_quote_id as string | null) ?? null,
    legacy_quote_id: (requestRecord.legacy_quote_id as string | null) ?? null,
    converted_at: (requestRecord.converted_at as string | null) ?? null,
    created_at: String(requestRecord.created_at || new Date().toISOString()),
    updated_at: String(requestRecord.updated_at || requestRecord.created_at || new Date().toISOString()),
  }));

  nextDb.quoteRequestItems = nextDb.quoteRequestItems.map((itemRecord) => ({
    id: String(itemRecord.id || createId()),
    quote_request_id: String(itemRecord.quote_request_id || ""),
    product_id: String(itemRecord.product_id || ""),
    product_variant_id: (itemRecord.product_variant_id as string | null) ?? null,
    product_slug_snapshot: String(itemRecord.product_slug_snapshot || ""),
    product_name_snapshot: String(itemRecord.product_name_snapshot || ""),
    sku_snapshot: (itemRecord.sku_snapshot as string | null) ?? null,
    variant_label_snapshot: (itemRecord.variant_label_snapshot as string | null) ?? null,
    image_url_snapshot: (itemRecord.image_url_snapshot as string | null) ?? null,
    quantity: Number(itemRecord.quantity || 0),
    unit: (itemRecord.unit as string | null) ?? null,
    notes: (itemRecord.notes as string | null) ?? null,
    calculation_snapshot_json:
      itemRecord.calculation_snapshot_json && typeof itemRecord.calculation_snapshot_json === "object" && !Array.isArray(itemRecord.calculation_snapshot_json)
        ? itemRecord.calculation_snapshot_json
        : null,
    sort_order: Number(itemRecord.sort_order || 0),
    created_at: String(itemRecord.created_at || new Date().toISOString()),
  }));

  nextDb.quoteRequestStatusHistory = nextDb.quoteRequestStatusHistory.map((entryRecord) => ({
    id: String(entryRecord.id || createId()),
    quote_request_id: String(entryRecord.quote_request_id || ""),
    from_status: entryRecord.from_status ? normalizeQuoteRequestStatusValue(entryRecord.from_status) : null,
    to_status: normalizeQuoteRequestStatusValue(entryRecord.to_status),
    note: (entryRecord.note as string | null) ?? null,
    actor_id: (entryRecord.actor_id as string | null) ?? null,
    actor_name: String(entryRecord.actor_name || "system"),
    created_at: String(entryRecord.created_at || new Date().toISOString()),
  }));

  nextDb.quoteRequestNotes = nextDb.quoteRequestNotes.map((noteRecord) => ({
    id: String(noteRecord.id || createId()),
    quote_request_id: String(noteRecord.quote_request_id || ""),
    note: String(noteRecord.note || ""),
    actor_id: (noteRecord.actor_id as string | null) ?? null,
    actor_name: String(noteRecord.actor_name || "system"),
    created_at: String(noteRecord.created_at || new Date().toISOString()),
  }));

  nextDb.customerProfiles = nextDb.customerProfiles.map((profileRecord) => ({
    user_id: String(profileRecord.user_id || ""),
    fullName: String(profileRecord.fullName || ""),
    email: String(profileRecord.email || ""),
    phone: String(profileRecord.phone || ""),
    cpfCnpj: String(profileRecord.cpfCnpj || ""),
    companyName: (profileRecord.companyName as string | undefined) || undefined,
    stateRegistration: (profileRecord.stateRegistration as string | undefined) || undefined,
    birthDate: (profileRecord.birthDate as string | undefined) || undefined,
    customerType: (profileRecord.customerType as DbCustomerProfile["customerType"]) || "retail",
    customerOrigin: (profileRecord.customerOrigin as DbCustomerProfile["customerOrigin"]) || "web",
    preferredChannel: (profileRecord.preferredChannel as DbCustomerProfile["preferredChannel"]) || "whatsapp",
    allowPromotions: Boolean(profileRecord.allowPromotions),
    preferredStoreId: (profileRecord.preferredStoreId as string | null | undefined) ?? null,
    preferredStoreName: (profileRecord.preferredStoreName as string | null | undefined) ?? null,
    firstAssistedBy: (profileRecord.firstAssistedBy as string | null | undefined) ?? null,
    addresses: Array.isArray(profileRecord.addresses) ? (profileRecord.addresses as DbCustomerAddressBookEntry[]) : [],
    activeCart:
      profileRecord.activeCart &&
      typeof profileRecord.activeCart === "object" &&
      Array.isArray((profileRecord.activeCart as { items?: unknown }).items)
        ? {
            items: (profileRecord.activeCart as { items: unknown[] }).items,
            updatedAt:
              typeof (profileRecord.activeCart as { updatedAt?: unknown }).updatedAt === "string"
                ? String((profileRecord.activeCart as { updatedAt?: unknown }).updatedAt)
                : new Date().toISOString(),
          }
        : null,
    savedCarts: Array.isArray(profileRecord.savedCarts) ? (profileRecord.savedCarts as DbSavedCartRecord[]) : [],
    favorites: Array.isArray(profileRecord.favorites) ? profileRecord.favorites.map((item) => String(item)) : [],
    lists: Array.isArray(profileRecord.lists) ? (profileRecord.lists as DbFavoriteList[]) : [],
    returns: Array.isArray(profileRecord.returns) ? (profileRecord.returns as DbCustomerReturnRequest[]) : [],
    tickets: Array.isArray(profileRecord.tickets)
      ? (profileRecord.tickets as Array<Partial<DbCustomerSupportTicket>>).map((ticketRecord) => ({
          id: typeof ticketRecord.id === "string" ? ticketRecord.id : createId(),
          orderId: typeof ticketRecord.orderId === "string" ? ticketRecord.orderId : undefined,
          subject: typeof ticketRecord.subject === "string" ? ticketRecord.subject : "Atendimento",
          channel: ticketRecord.channel === "email" ? "email" : "whatsapp",
          message: typeof ticketRecord.message === "string" ? ticketRecord.message : "",
          status: ticketRecord.status === "in_progress" || ticketRecord.status === "resolved" ? ticketRecord.status : "open",
          createdAt: typeof ticketRecord.createdAt === "string" ? ticketRecord.createdAt : new Date().toISOString(),
          updatedAt:
            typeof ticketRecord.updatedAt === "string"
              ? ticketRecord.updatedAt
              : typeof ticketRecord.createdAt === "string"
                ? ticketRecord.createdAt
                : new Date().toISOString(),
        }))
      : [],
    updated_at: String(profileRecord.updated_at || new Date().toISOString()),
  })) as unknown as typeof nextDb.customerProfiles;

  nextDb.leads = nextDb.leads.map((leadRecord) => ({
    id: typeof leadRecord.id === "string" ? leadRecord.id : createId(),
    name: typeof leadRecord.name === "string" ? leadRecord.name : "Lead sem nome",
    email: typeof leadRecord.email === "string" ? leadRecord.email : null,
    phone: typeof leadRecord.phone === "string" ? leadRecord.phone : null,
    source: (leadRecord.source as DbLead["source"]) || "web",
    channel: (leadRecord.channel as DbLead["channel"]) || "manual",
    product_interest: typeof leadRecord.product_interest === "string" ? leadRecord.product_interest : null,
    page_origin: typeof leadRecord.page_origin === "string" ? leadRecord.page_origin : null,
    stage: (leadRecord.stage as DbLead["stage"]) || "new",
    responsible_id: typeof leadRecord.responsible_id === "string" ? leadRecord.responsible_id : null,
    responsible_name: typeof leadRecord.responsible_name === "string" ? leadRecord.responsible_name : null,
    linked_customer_id: typeof leadRecord.linked_customer_id === "string" ? leadRecord.linked_customer_id : null,
    linked_order_id: typeof leadRecord.linked_order_id === "string" ? leadRecord.linked_order_id : null,
    linked_quote_id: typeof leadRecord.linked_quote_id === "string" ? leadRecord.linked_quote_id : null,
    notes: typeof leadRecord.notes === "string" ? leadRecord.notes : null,
    created_at: typeof leadRecord.created_at === "string" ? leadRecord.created_at : new Date().toISOString(),
    updated_at: typeof leadRecord.updated_at === "string" ? leadRecord.updated_at : new Date().toISOString(),
  }));

  nextDb.authOtps = nextDb.authOtps.map((otpRecord) => ({
    id: typeof otpRecord.id === "string" ? otpRecord.id : createId(),
    email: typeof otpRecord.email === "string" ? otpRecord.email : "",
    code: typeof otpRecord.code === "string" ? otpRecord.code : "000000",
    purpose: otpRecord.purpose === "reauth" || otpRecord.purpose === "reset_password" ? otpRecord.purpose : "signin",
    expires_at: typeof otpRecord.expires_at === "string" ? otpRecord.expires_at : new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    consumed_at: typeof otpRecord.consumed_at === "string" ? otpRecord.consumed_at : null,
    created_at: typeof otpRecord.created_at === "string" ? otpRecord.created_at : new Date().toISOString(),
  })) as unknown as typeof nextDb.authOtps;

  nextDb.fiscalProfiles = Array.isArray(nextDb.fiscalProfiles) ? nextDb.fiscalProfiles : [];
  for (const seededProfile of seeded.fiscalProfiles) {
    if (!nextDb.fiscalProfiles.some((entry) => entry.id === seededProfile.id)) {
      nextDb.fiscalProfiles.push(seededProfile);
      changed = true;
    }
  }
  nextDb.fiscalProfiles = nextDb.fiscalProfiles.map((profileRecord) => ({
    id: String(profileRecord.id || createId()),
    product_id: String(profileRecord.product_id || ""),
    establishment_id: String(profileRecord.establishment_id || "est-comercial"),
    ncm: typeof profileRecord.ncm === "string" ? profileRecord.ncm : null,
    cest: typeof profileRecord.cest === "string" ? profileRecord.cest : null,
    cfop_internal_default: typeof profileRecord.cfop_internal_default === "string" ? profileRecord.cfop_internal_default : "5102",
    cfop_interstate_default: typeof profileRecord.cfop_interstate_default === "string" ? profileRecord.cfop_interstate_default : "6102",
    origin_code: typeof profileRecord.origin_code === "string" ? profileRecord.origin_code : "0",
    cst_icms_default: typeof profileRecord.cst_icms_default === "string" ? profileRecord.cst_icms_default : null,
    csosn_default: typeof profileRecord.csosn_default === "string" ? profileRecord.csosn_default : null,
    requires_difal: typeof profileRecord.requires_difal === "boolean" ? Boolean(profileRecord.requires_difal) : true,
    requires_fcp: typeof profileRecord.requires_fcp === "boolean" ? Boolean(profileRecord.requires_fcp) : true,
    tax_rule_status:
      profileRecord.tax_rule_status === "ready" || profileRecord.tax_rule_status === "review"
        ? profileRecord.tax_rule_status
        : "pending",
    notes: typeof profileRecord.notes === "string" ? profileRecord.notes : null,
    updated_at: String(profileRecord.updated_at || new Date().toISOString()),
  }));

  nextDb.inventoryLots = Array.isArray(nextDb.inventoryLots) ? nextDb.inventoryLots : [];
  for (const seededLot of seeded.inventoryLots) {
    if (!nextDb.inventoryLots.some((entry) => entry.id === seededLot.id)) {
      nextDb.inventoryLots.push(seededLot);
      changed = true;
    }
  }
  nextDb.inventoryLots = nextDb.inventoryLots.map((lotRecord) => ({
    id: String(lotRecord.id || createId()),
    product_id: String(lotRecord.product_id || ""),
    establishment_id: String(lotRecord.establishment_id || "est-comercial"),
    source_type:
      lotRecord.source_type === "importacao" || lotRecord.source_type === "compra_nacional" ? lotRecord.source_type : "transferencia",
    source_reference: typeof lotRecord.source_reference === "string" ? lotRecord.source_reference : null,
    source_document_number: typeof lotRecord.source_document_number === "string" ? lotRecord.source_document_number : null,
    quantity_in: Number.isFinite(Number(lotRecord.quantity_in)) ? Number(lotRecord.quantity_in) : 0,
    quantity_available: Number.isFinite(Number(lotRecord.quantity_available)) ? Number(lotRecord.quantity_available) : 0,
    unit_cost: Number.isFinite(Number(lotRecord.unit_cost)) ? Number(lotRecord.unit_cost) : 0,
    landed_cost_unit: Number.isFinite(Number(lotRecord.landed_cost_unit)) ? Number(lotRecord.landed_cost_unit) : null,
    currency: typeof lotRecord.currency === "string" ? lotRecord.currency : "BRL",
    created_at: String(lotRecord.created_at || new Date().toISOString()),
  }));

  nextDb.inventoryMovements = Array.isArray(nextDb.inventoryMovements) ? nextDb.inventoryMovements : [];
  nextDb.inventoryMovements = nextDb.inventoryMovements.map((movementRecord) => ({
    id: String(movementRecord.id || createId()),
    product_id: String(movementRecord.product_id || ""),
    lot_id: typeof movementRecord.lot_id === "string" ? movementRecord.lot_id : null,
    establishment_id: String(movementRecord.establishment_id || "est-comercial"),
    movement_type:
      movementRecord.movement_type === "entrada" ||
      movementRecord.movement_type === "reserva" ||
      movementRecord.movement_type === "baixa" ||
      movementRecord.movement_type === "estorno" ||
      movementRecord.movement_type === "transferencia_out" ||
      movementRecord.movement_type === "transferencia_in"
        ? movementRecord.movement_type
        : "ajuste",
    quantity: Number.isFinite(Number(movementRecord.quantity)) ? Number(movementRecord.quantity) : 0,
    order_id: typeof movementRecord.order_id === "string" ? movementRecord.order_id : null,
    fiscal_document_id: typeof movementRecord.fiscal_document_id === "string" ? movementRecord.fiscal_document_id : null,
    notes: typeof movementRecord.notes === "string" ? movementRecord.notes : null,
    created_at: String(movementRecord.created_at || new Date().toISOString()),
  }));

  nextDb.fiscalDocuments = Array.isArray(nextDb.fiscalDocuments) ? nextDb.fiscalDocuments : [];
  nextDb.fiscalDocuments = nextDb.fiscalDocuments.map((documentRecord) => ({
    id: String(documentRecord.id || createId()),
    establishment_id: String(documentRecord.establishment_id || "est-comercial"),
    order_id: typeof documentRecord.order_id === "string" ? documentRecord.order_id : null,
    document_type:
      documentRecord.document_type === "nfe_transferencia" || documentRecord.document_type === "nfe_entrada"
        ? documentRecord.document_type
        : "nfe_saida",
    number: typeof documentRecord.number === "string" ? documentRecord.number : null,
    series: typeof documentRecord.series === "string" ? documentRecord.series : null,
    access_key: typeof documentRecord.access_key === "string" ? documentRecord.access_key : null,
    cfop_summary: typeof documentRecord.cfop_summary === "string" ? documentRecord.cfop_summary : null,
    xml_url: typeof documentRecord.xml_url === "string" ? documentRecord.xml_url : null,
    status_sefaz:
      documentRecord.status_sefaz === "authorized" || documentRecord.status_sefaz === "rejected" || documentRecord.status_sefaz === "cancelled"
        ? documentRecord.status_sefaz
        : "pending",
    go_live_gate_status: documentRecord.go_live_gate_status === "deferred" ? "deferred" : "required",
    go_live_gate_note: typeof documentRecord.go_live_gate_note === "string" ? documentRecord.go_live_gate_note : null,
    provider:
      documentRecord.provider === "nfeio" || documentRecord.provider === "tecnospeed" || documentRecord.provider === "erp"
        ? documentRecord.provider
        : "manual",
    message: typeof documentRecord.message === "string" ? documentRecord.message : null,
    issued_at: typeof documentRecord.issued_at === "string" ? documentRecord.issued_at : null,
    created_at: String(documentRecord.created_at || new Date().toISOString()),
  }));

  nextDb.catalogStaging = Array.isArray(nextDb.catalogStaging) ? nextDb.catalogStaging : [];
  nextDb.catalogStaging = nextDb.catalogStaging.map((stagingRecord) => ({
    id: String(stagingRecord.id || createId()),
    source_batch: String(stagingRecord.source_batch || "legacy"),
    source_sheet: String(stagingRecord.source_sheet || "Importar_Site"),
    sku_base: typeof stagingRecord.sku_base === "string" ? stagingRecord.sku_base : null,
    source_name: String(stagingRecord.source_name || ""),
    normalized_name: String(stagingRecord.normalized_name || stagingRecord.source_name || ""),
    category_name: typeof stagingRecord.category_name === "string" ? stagingRecord.category_name : null,
    subcategory_name: typeof stagingRecord.subcategory_name === "string" ? stagingRecord.subcategory_name : null,
    brand_name: typeof stagingRecord.brand_name === "string" ? stagingRecord.brand_name : null,
    color: typeof stagingRecord.color === "string" ? stagingRecord.color : null,
    size: typeof stagingRecord.size === "string" ? stagingRecord.size : null,
    cost_price: Number.isFinite(Number(stagingRecord.cost_price)) ? Number(stagingRecord.cost_price) : null,
    suggested_price: Number.isFinite(Number(stagingRecord.suggested_price)) ? Number(stagingRecord.suggested_price) : null,
    estimated_stock: Number.isFinite(Number(stagingRecord.estimated_stock)) ? Number(stagingRecord.estimated_stock) : null,
    publish_flag: typeof stagingRecord.publish_flag === "boolean" ? Boolean(stagingRecord.publish_flag) : false,
    review_status:
      stagingRecord.review_status === "approved" || stagingRecord.review_status === "rejected" ? stagingRecord.review_status : "review",
    review_reason: typeof stagingRecord.review_reason === "string" ? stagingRecord.review_reason : null,
    mapped_product_id: typeof stagingRecord.mapped_product_id === "string" ? stagingRecord.mapped_product_id : null,
    fiscal_pending_fields: Array.isArray(stagingRecord.fiscal_pending_fields) ? stagingRecord.fiscal_pending_fields.map((item) => String(item)) : [],
    suggested_family: typeof stagingRecord.suggested_family === "string" ? stagingRecord.suggested_family : null,
    suggested_category_slug: typeof stagingRecord.suggested_category_slug === "string" ? stagingRecord.suggested_category_slug : null,
    suggested_origin_code: typeof stagingRecord.suggested_origin_code === "string" ? stagingRecord.suggested_origin_code : null,
    suggested_ncm: typeof stagingRecord.suggested_ncm === "string" ? stagingRecord.suggested_ncm : null,
    suggested_dimensions: typeof stagingRecord.suggested_dimensions === "string" ? stagingRecord.suggested_dimensions : null,
    suggested_weight: Number.isFinite(Number(stagingRecord.suggested_weight)) ? Number(stagingRecord.suggested_weight) : null,
    enrichment_confidence:
      stagingRecord.enrichment_confidence === "high" || stagingRecord.enrichment_confidence === "medium" || stagingRecord.enrichment_confidence === "low"
        ? stagingRecord.enrichment_confidence
        : null,
    enrichment_notes: typeof stagingRecord.enrichment_notes === "string" ? stagingRecord.enrichment_notes : null,
    import_notes: typeof stagingRecord.import_notes === "string" ? stagingRecord.import_notes : null,
    go_live_gate_status: stagingRecord.go_live_gate_status === "deferred" ? "deferred" : "required",
    go_live_gate_note: typeof stagingRecord.go_live_gate_note === "string" ? stagingRecord.go_live_gate_note : null,
    created_at: String(stagingRecord.created_at || new Date().toISOString()),
  }));

  nextDb.fiscalAiSuggestions = nextDb.fiscalAiSuggestions.map((suggestionRecord) => {
    const status =
      suggestionRecord.status === "pending_review" ||
      suggestionRecord.status === "approved" ||
      suggestionRecord.status === "rejected" ||
      suggestionRecord.status === "exported" ||
      suggestionRecord.status === "applied"
        ? suggestionRecord.status
        : "draft";
    const confidence =
      suggestionRecord.confidence === "high" || suggestionRecord.confidence === "medium" ? suggestionRecord.confidence : "low";
    const taxCodeType =
      suggestionRecord.suggested_tax_code_type === "cst_icms_default" || suggestionRecord.suggested_tax_code_type === "csosn_default"
        ? suggestionRecord.suggested_tax_code_type
        : null;
    const source =
      suggestionRecord.source === "openai" || suggestionRecord.source === "hybrid" ? suggestionRecord.source : "heuristic";
    const approvedTemplate =
      suggestionRecord.approved_fill_template && typeof suggestionRecord.approved_fill_template === "object"
        ? (suggestionRecord.approved_fill_template as Record<string, unknown>)
        : null;

    return {
      id: String(suggestionRecord.id || createId()),
      fiscal_profile_id: String(suggestionRecord.fiscal_profile_id || ""),
      product_id: String(suggestionRecord.product_id || ""),
      establishment_id: String(suggestionRecord.establishment_id || "est-comercial"),
      scope: suggestionRecord.scope === "global" ? "global" : "minimal-go-live",
      suggested_ncm: typeof suggestionRecord.suggested_ncm === "string" ? suggestionRecord.suggested_ncm : null,
      suggested_tax_code: typeof suggestionRecord.suggested_tax_code === "string" ? suggestionRecord.suggested_tax_code : null,
      suggested_tax_code_type: taxCodeType,
      suggested_cest: typeof suggestionRecord.suggested_cest === "string" ? suggestionRecord.suggested_cest : null,
      suggested_origin_code: typeof suggestionRecord.suggested_origin_code === "string" ? suggestionRecord.suggested_origin_code : null,
      suggested_weight: Number.isFinite(Number(suggestionRecord.suggested_weight)) ? Number(suggestionRecord.suggested_weight) : null,
      confidence,
      evidence: Array.isArray(suggestionRecord.evidence)
        ? suggestionRecord.evidence.map((item) => {
            const evidence = item as unknown as Record<string, unknown>;
            const type =
              evidence.type === "similar_product" ||
              evidence.type === "ncm_table" ||
              evidence.type === "manual_rule" ||
              evidence.type === "openai" ||
              evidence.type === "provider_unavailable"
                ? evidence.type
                : "catalog_context";
            return {
              type,
              reference: String(evidence.reference || ""),
              detail: String(evidence.detail || ""),
            };
          })
        : [],
      rationale: String(suggestionRecord.rationale || "Sugestao fiscal aguardando revisao humana."),
      status,
      source,
      openai_model: typeof suggestionRecord.openai_model === "string" ? suggestionRecord.openai_model : null,
      openai_response_id: typeof suggestionRecord.openai_response_id === "string" ? suggestionRecord.openai_response_id : null,
      openai_error: typeof suggestionRecord.openai_error === "string" ? suggestionRecord.openai_error : null,
      ncm_cache_version: typeof suggestionRecord.ncm_cache_version === "string" ? suggestionRecord.ncm_cache_version : null,
      reviewed_by: typeof suggestionRecord.reviewed_by === "string" ? suggestionRecord.reviewed_by : null,
      reviewed_at: typeof suggestionRecord.reviewed_at === "string" ? suggestionRecord.reviewed_at : null,
      review_notes: typeof suggestionRecord.review_notes === "string" ? suggestionRecord.review_notes : null,
      approved_fill_template: approvedTemplate
        ? {
            ncm: String(approvedTemplate.ncm || ""),
            cst_icms_default: typeof approvedTemplate.cst_icms_default === "string" ? approvedTemplate.cst_icms_default : undefined,
            csosn_default: typeof approvedTemplate.csosn_default === "string" ? approvedTemplate.csosn_default : undefined,
            weight: String(approvedTemplate.weight || ""),
            tax_rule_status: "review" as const,
            note: String(approvedTemplate.note || "Aprovado por revisao fiscal humana."),
          }
        : null,
      exported_at: typeof suggestionRecord.exported_at === "string" ? suggestionRecord.exported_at : null,
      applied_at: typeof suggestionRecord.applied_at === "string" ? suggestionRecord.applied_at : null,
      ai_context_hash: typeof suggestionRecord.ai_context_hash === "string" ? suggestionRecord.ai_context_hash : null,
      ai_prompt_version: typeof suggestionRecord.ai_prompt_version === "string" ? suggestionRecord.ai_prompt_version : null,
      ai_input_chars: Number.isFinite(Number(suggestionRecord.ai_input_chars)) ? Number(suggestionRecord.ai_input_chars) : 0,
      ai_estimated_input_tokens: Number.isFinite(Number(suggestionRecord.ai_estimated_input_tokens)) ? Number(suggestionRecord.ai_estimated_input_tokens) : 0,
      ai_call_policy:
        suggestionRecord.ai_call_policy === "called" || suggestionRecord.ai_call_policy === "cache_hit"
          ? suggestionRecord.ai_call_policy
          : "skipped",
      created_at: String(suggestionRecord.created_at || new Date().toISOString()),
      updated_at: String(suggestionRecord.updated_at || suggestionRecord.created_at || new Date().toISOString()),
    };
  }) as unknown as typeof nextDb.fiscalAiSuggestions;

  nextDb.fiscalNcmCache = nextDb.fiscalNcmCache.map((entryRecord) => ({
    id: String(entryRecord.id || createId()),
    code: String(entryRecord.code || "").replace(/\D/g, ""),
    description: String(entryRecord.description || ""),
    source:
      entryRecord.source === "siscomex_public" || entryRecord.source === "classif_reference"
        ? entryRecord.source
        : "manual_seed",
    source_url: typeof entryRecord.source_url === "string" ? entryRecord.source_url : null,
    version: String(entryRecord.version || "manual"),
    effective_from: typeof entryRecord.effective_from === "string" ? entryRecord.effective_from : null,
    created_at: String(entryRecord.created_at || new Date().toISOString()),
    updated_at: String(entryRecord.updated_at || entryRecord.created_at || new Date().toISOString()),
  })).filter((entry) => entry.code && entry.description) as unknown as typeof nextDb.fiscalNcmCache;

  const defaultAiSettings = seedDb().aiSettings[0];
  nextDb.aiSettings = nextDb.aiSettings.map((settingsRecord) => ({
    id: "default" as const,
    enabled: settingsRecord.enabled === true,
    provider: "openai" as const,
    max_daily_calls: Number.isFinite(Number(settingsRecord.max_daily_calls)) ? Number(settingsRecord.max_daily_calls) : defaultAiSettings.max_daily_calls,
    max_input_chars: Number.isFinite(Number(settingsRecord.max_input_chars)) ? Number(settingsRecord.max_input_chars) : defaultAiSettings.max_input_chars,
    cache_ttl_days: Number.isFinite(Number(settingsRecord.cache_ttl_days)) ? Number(settingsRecord.cache_ttl_days) : defaultAiSettings.cache_ttl_days,
    batch_max_items: Number.isFinite(Number(settingsRecord.batch_max_items)) ? Number(settingsRecord.batch_max_items) : defaultAiSettings.batch_max_items,
    fiscal_prompt_version: typeof settingsRecord.fiscal_prompt_version === "string" ? settingsRecord.fiscal_prompt_version : defaultAiSettings.fiscal_prompt_version,
    created_at: String(settingsRecord.created_at || new Date().toISOString()),
    updated_at: String(settingsRecord.updated_at || settingsRecord.created_at || new Date().toISOString()),
  }));
  if (!nextDb.aiSettings.some((entry) => entry.id === "default")) {
    nextDb.aiSettings.unshift(defaultAiSettings);
  }

  nextDb.aiUsageLogs = nextDb.aiUsageLogs.map((logRecord) => {
    const module =
      logRecord.module === "catalog" ||
      logRecord.module === "marketing" ||
      logRecord.module === "support" ||
      logRecord.module === "operations"
        ? logRecord.module
        : "fiscal";
    const provider = logRecord.provider === "openai" ? "openai" : "local";
    const status =
      logRecord.status === "cache_hit" || logRecord.status === "success" || logRecord.status === "error"
        ? logRecord.status
        : "skipped";
    return {
      id: String(logRecord.id || createId()),
      module,
      task: String(logRecord.task || "unknown"),
      provider,
      model: typeof logRecord.model === "string" ? logRecord.model : null,
      status,
      reason: String(logRecord.reason || status),
      context_hash: typeof logRecord.context_hash === "string" ? logRecord.context_hash : null,
      prompt_version: typeof logRecord.prompt_version === "string" ? logRecord.prompt_version : null,
      input_chars: Number.isFinite(Number(logRecord.input_chars)) ? Number(logRecord.input_chars) : 0,
      output_chars: Number.isFinite(Number(logRecord.output_chars)) ? Number(logRecord.output_chars) : 0,
      estimated_input_tokens: Number.isFinite(Number(logRecord.estimated_input_tokens)) ? Number(logRecord.estimated_input_tokens) : 0,
      estimated_output_tokens: Number.isFinite(Number(logRecord.estimated_output_tokens)) ? Number(logRecord.estimated_output_tokens) : 0,
      cache_hit: logRecord.cache_hit === true,
      metadata: logRecord.metadata && typeof logRecord.metadata === "object" ? (logRecord.metadata as Record<string, unknown>) : {},
      created_at: String(logRecord.created_at || new Date().toISOString()),
    };
  }) as unknown as typeof nextDb.aiUsageLogs;

  const seededSiteContent = seedDb().siteContent;
  nextDb.siteContent = {
    banners: Array.isArray((nextDb.siteContent as DbSiteContent).banners) ? (nextDb.siteContent as DbSiteContent).banners : seededSiteContent.banners,
    featured_category_ids: Array.isArray((nextDb.siteContent as DbSiteContent).featured_category_ids)
      ? (nextDb.siteContent as DbSiteContent).featured_category_ids
      : seededSiteContent.featured_category_ids,
    go_live_product_ids: Array.isArray((nextDb.siteContent as DbSiteContent).go_live_product_ids)
      ? (nextDb.siteContent as DbSiteContent).go_live_product_ids
      : seededSiteContent.go_live_product_ids,
    trust_badges: Array.isArray((nextDb.siteContent as DbSiteContent).trust_badges)
      ? (nextDb.siteContent as DbSiteContent).trust_badges
      : seededSiteContent.trust_badges,
    operational_messages: {
      pickup_message:
        typeof (nextDb.siteContent as DbSiteContent).operational_messages?.pickup_message === "string"
          ? (nextDb.siteContent as DbSiteContent).operational_messages.pickup_message
          : seededSiteContent.operational_messages.pickup_message,
      delivery_message:
        typeof (nextDb.siteContent as DbSiteContent).operational_messages?.delivery_message === "string"
          ? (nextDb.siteContent as DbSiteContent).operational_messages.delivery_message
          : seededSiteContent.operational_messages.delivery_message,
      human_support_message:
        typeof (nextDb.siteContent as DbSiteContent).operational_messages?.human_support_message === "string"
          ? (nextDb.siteContent as DbSiteContent).operational_messages.human_support_message
          : seededSiteContent.operational_messages.human_support_message,
    },
    pages: normalizeInstitutionalPages((nextDb.siteContent as DbSiteContent).pages, seededSiteContent.pages),
  };

  nextDb.commercialSettings = {
    ...seeded.commercialSettings,
    ...(nextDb.commercialSettings as DbCommercialSettings),
  };

  nextDb.freightCarriers = nextDb.freightCarriers.map((carrierRecord) => ({
    id: String(carrierRecord.id || createId()),
    name: String(carrierRecord.name || ""),
    code: String(carrierRecord.code || carrierRecord.name || "").trim().toUpperCase(),
    service_types: Array.isArray(carrierRecord.service_types) ? (carrierRecord.service_types as string[]).map(String) : [],
    coverage_states: Array.isArray(carrierRecord.coverage_states) ? (carrierRecord.coverage_states as string[]).map((state) => String(state).trim().toUpperCase()) : ["BR"],
    max_weight_kg: Number.isFinite(Number(carrierRecord.max_weight_kg)) ? Number(carrierRecord.max_weight_kg) : null,
    max_length_cm: Number.isFinite(Number(carrierRecord.max_length_cm)) ? Number(carrierRecord.max_length_cm) : null,
    max_cubic_meters: Number.isFinite(Number(carrierRecord.max_cubic_meters)) ? Number(carrierRecord.max_cubic_meters) : null,
    supports_heavy: Boolean(carrierRecord.supports_heavy),
    supports_bulky: Boolean(carrierRecord.supports_bulky),
    tracking_url_template: typeof carrierRecord.tracking_url_template === "string" ? carrierRecord.tracking_url_template : null,
    notes: typeof carrierRecord.notes === "string" ? carrierRecord.notes : null,
    is_active: typeof carrierRecord.is_active === "boolean" ? Boolean(carrierRecord.is_active) : true,
    created_at: String(carrierRecord.created_at || new Date().toISOString()),
    updated_at: String(carrierRecord.updated_at || carrierRecord.created_at || new Date().toISOString()),
  }));

  nextDb.orders = (nextDb.orders as unknown as Array<Record<string, unknown>>).map((orderRecord) => {
    const orderType = normalizeOrderType(orderRecord);
    const orderOrigin = normalizeOrderOrigin(orderRecord, orderType);
    const deliveryType = orderRecord.delivery_type === "pickup" ? "pickup" : "delivery";
    const paymentMethod = (orderRecord.payment_method as PaymentMethod) || "pix";
    const correlationId = typeof orderRecord.correlation_id === "string" ? orderRecord.correlation_id : createId();
    const nextOrder: DbOrder = {
      id: String(orderRecord.id),
      order_number: String(orderRecord.order_number),
      tracking_token: String(orderRecord.tracking_token),
      user_id: (orderRecord.user_id as string | null) ?? null,
      customer_name: String(orderRecord.customer_name || ""),
      customer_email: String(orderRecord.customer_email || ""),
      customer_phone: (orderRecord.customer_phone as string | null) ?? null,
      customer_cpf: (orderRecord.customer_cpf as string | null) ?? null,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      payment_status:
        (orderRecord.payment_status as PaymentStatus) ??
        ((orderRecord.status === "payment_approved" ||
          orderRecord.status === "confirmed" ||
          orderRecord.status === "processing" ||
          orderRecord.status === "in_separation" ||
          orderRecord.status === "in_expedition" ||
          orderRecord.status === "shipped" ||
          orderRecord.status === "out_for_delivery" ||
          orderRecord.status === "delivered")
          ? "approved"
          : "pending"),
      payment_reference: (orderRecord.payment_reference as string | null) ?? null,
      payment_approved_at: (orderRecord.payment_approved_at as string | null) ?? null,
      shipping_address: (orderRecord.shipping_address as DbOrderAddress | null) ?? null,
      shipping_cost: Number(orderRecord.shipping_cost || 0),
      shipment:
        typeof orderRecord.shipment === "object" && orderRecord.shipment
          ? {
              carrier: typeof (orderRecord.shipment as Record<string, unknown>).carrier === "string" ? String((orderRecord.shipment as Record<string, unknown>).carrier) : null,
              service: typeof (orderRecord.shipment as Record<string, unknown>).service === "string" ? String((orderRecord.shipment as Record<string, unknown>).service) : null,
              tracking_code: typeof (orderRecord.shipment as Record<string, unknown>).tracking_code === "string" ? String((orderRecord.shipment as Record<string, unknown>).tracking_code) : null,
              tracking_url: typeof (orderRecord.shipment as Record<string, unknown>).tracking_url === "string" ? String((orderRecord.shipment as Record<string, unknown>).tracking_url) : null,
              estimated_delivery_at:
                typeof (orderRecord.shipment as Record<string, unknown>).estimated_delivery_at === "string"
                  ? String((orderRecord.shipment as Record<string, unknown>).estimated_delivery_at)
                  : null,
              dispatched_at: typeof (orderRecord.shipment as Record<string, unknown>).dispatched_at === "string" ? String((orderRecord.shipment as Record<string, unknown>).dispatched_at) : null,
              notes: typeof (orderRecord.shipment as Record<string, unknown>).notes === "string" ? String((orderRecord.shipment as Record<string, unknown>).notes) : null,
              updated_at: typeof (orderRecord.shipment as Record<string, unknown>).updated_at === "string" ? String((orderRecord.shipment as Record<string, unknown>).updated_at) : null,
              updated_by: typeof (orderRecord.shipment as Record<string, unknown>).updated_by === "string" ? String((orderRecord.shipment as Record<string, unknown>).updated_by) : null,
            }
          : null,
      discount: Number(orderRecord.discount || 0),
      subtotal: Number(orderRecord.subtotal || 0),
      total: Number(orderRecord.total || 0),
      notes: (orderRecord.notes as string | null) ?? null,
      status: (orderRecord.status as OrderStatus) || "pending",
      order_type: orderType,
      order_origin: orderOrigin,
      source_channel: (orderRecord.source_channel as SourceChannel) ?? normalizeSourceChannel(orderOrigin),
      source_actor: (orderRecord.source_actor as SourceActor) ?? normalizeSourceActor(orderType, orderOrigin),
      assisted_sale:
        typeof orderRecord.assisted_sale === "boolean"
          ? orderRecord.assisted_sale
          : Boolean(orderRecord.is_assisted_sale || orderType === "assisted"),
      seller_id: (orderRecord.seller_id as string | null) ?? null,
      seller_name: (orderRecord.seller_name as string | null) ?? null,
      seller_establishment_id: (orderRecord.seller_establishment_id as string | null) ?? "est-comercial",
      store_id: (orderRecord.store_id as string | null) ?? (orderRecord.showroom_store_id as string | null) ?? null,
      store_name: (orderRecord.store_name as string | null) ?? (orderRecord.showroom_store_name as string | null) ?? null,
      delivery_required:
        typeof orderRecord.delivery_required === "boolean" ? Boolean(orderRecord.delivery_required) : deliveryType === "delivery",
      pickup_allowed:
        typeof orderRecord.pickup_allowed === "boolean" ? Boolean(orderRecord.pickup_allowed) : orderType !== "assisted",
      assisted_sale_notes:
        (orderRecord.assisted_sale_notes as string | null) ??
        (orderRecord.notes as string | null) ??
        null,
      payment_linked_to_order:
        typeof orderRecord.payment_linked_to_order === "boolean" ? Boolean(orderRecord.payment_linked_to_order) : true,
      correlation_id: correlationId,
      idempotency_key: (orderRecord.idempotency_key as string | null) ?? null,
      coupon_id: (orderRecord.coupon_id as string | null) ?? null,
      coupon_code: (orderRecord.coupon_code as string | null) ?? null,
      inventory_locked: typeof orderRecord.inventory_locked === "boolean" ? Boolean(orderRecord.inventory_locked) : false,
      event_log: Array.isArray(orderRecord.event_log) ? (orderRecord.event_log as string[]) : [],
      created_at: String(orderRecord.created_at || new Date().toISOString()),
      updated_at: String(orderRecord.updated_at || orderRecord.created_at || new Date().toISOString()),
    };
    changed = true;
    return nextOrder;
  }) as unknown as typeof nextDb.orders;

  nextDb.orderItems = nextDb.orderItems.map((orderItemRecord) => ({
    id: String(orderItemRecord.id || createId()),
    order_id: String(orderItemRecord.order_id || ""),
    product_id: String(orderItemRecord.product_id || ""),
    product_name: String(orderItemRecord.product_name || ""),
    product_sku: typeof orderItemRecord.product_sku === "string" ? orderItemRecord.product_sku : null,
    quantity: Number.isFinite(Number(orderItemRecord.quantity)) ? Number(orderItemRecord.quantity) : 0,
    unit_price: Number.isFinite(Number(orderItemRecord.unit_price)) ? Number(orderItemRecord.unit_price) : 0,
    total_price: Number.isFinite(Number(orderItemRecord.total_price)) ? Number(orderItemRecord.total_price) : 0,
    sale_type: orderItemRecord.sale_type as SaleType | undefined,
    unit_measure: orderItemRecord.unit_measure as UnitMeasure | undefined,
    display_unit: typeof orderItemRecord.display_unit === "string" ? orderItemRecord.display_unit : null,
    commercial_rule_applied: typeof orderItemRecord.commercial_rule_applied === "string" ? orderItemRecord.commercial_rule_applied : null,
    quantity_original: Number.isFinite(Number(orderItemRecord.quantity_original)) ? Number(orderItemRecord.quantity_original) : null,
    quantity_final: Number.isFinite(Number(orderItemRecord.quantity_final)) ? Number(orderItemRecord.quantity_final) : null,
    quantity_informed: Number.isFinite(Number(orderItemRecord.quantity_informed)) ? Number(orderItemRecord.quantity_informed) : null,
    requested_measurement: Number.isFinite(Number(orderItemRecord.requested_measurement)) ? Number(orderItemRecord.requested_measurement) : null,
    area_desired_m2: Number.isFinite(Number(orderItemRecord.area_desired_m2)) ? Number(orderItemRecord.area_desired_m2) : null,
    total_area_m2: Number.isFinite(Number(orderItemRecord.total_area_m2)) ? Number(orderItemRecord.total_area_m2) : null,
    weight_desired_kg: Number.isFinite(Number(orderItemRecord.weight_desired_kg)) ? Number(orderItemRecord.weight_desired_kg) : null,
    total_weight_kg: Number.isFinite(Number(orderItemRecord.total_weight_kg)) ? Number(orderItemRecord.total_weight_kg) : null,
    volume_desired_l: Number.isFinite(Number(orderItemRecord.volume_desired_l)) ? Number(orderItemRecord.volume_desired_l) : null,
    total_volume_l: Number.isFinite(Number(orderItemRecord.total_volume_l)) ? Number(orderItemRecord.total_volume_l) : null,
    cubic_meters_desired: Number.isFinite(Number(orderItemRecord.cubic_meters_desired)) ? Number(orderItemRecord.cubic_meters_desired) : null,
    total_cubic_meters: Number.isFinite(Number(orderItemRecord.total_cubic_meters)) ? Number(orderItemRecord.total_cubic_meters) : null,
    calculated_boxes: Number.isFinite(Number(orderItemRecord.calculated_boxes)) ? Number(orderItemRecord.calculated_boxes) : null,
    calculated_pieces: Number.isFinite(Number(orderItemRecord.calculated_pieces)) ? Number(orderItemRecord.calculated_pieces) : null,
    calculated_packages: Number.isFinite(Number(orderItemRecord.calculated_packages)) ? Number(orderItemRecord.calculated_packages) : null,
    packaging_closed: typeof orderItemRecord.packaging_closed === "boolean" ? Boolean(orderItemRecord.packaging_closed) : null,
    open_package_allowed: typeof orderItemRecord.open_package_allowed === "boolean" ? Boolean(orderItemRecord.open_package_allowed) : null,
    loss_margin_applied: Number.isFinite(Number(orderItemRecord.loss_margin_applied)) ? Number(orderItemRecord.loss_margin_applied) : null,
    client_notes: typeof orderItemRecord.client_notes === "string" ? orderItemRecord.client_notes : null,
    operational_notes: typeof orderItemRecord.operational_notes === "string" ? orderItemRecord.operational_notes : null,
    calculation_origin: typeof orderItemRecord.calculation_origin === "string" ? orderItemRecord.calculation_origin : null,
    seller_establishment_id: typeof orderItemRecord.seller_establishment_id === "string" ? orderItemRecord.seller_establishment_id : "est-comercial",
    allocated_lot_id: typeof orderItemRecord.allocated_lot_id === "string" ? orderItemRecord.allocated_lot_id : null,
    ncm: typeof orderItemRecord.ncm === "string" ? orderItemRecord.ncm : null,
    cest: typeof orderItemRecord.cest === "string" ? orderItemRecord.cest : null,
    origin_code: typeof orderItemRecord.origin_code === "string" ? orderItemRecord.origin_code : null,
    cfop: typeof orderItemRecord.cfop === "string" ? orderItemRecord.cfop : null,
    cst_csosn: typeof orderItemRecord.cst_csosn === "string" ? orderItemRecord.cst_csosn : null,
    requires_difal: typeof orderItemRecord.requires_difal === "boolean" ? Boolean(orderItemRecord.requires_difal) : null,
    requires_fcp: typeof orderItemRecord.requires_fcp === "boolean" ? Boolean(orderItemRecord.requires_fcp) : null,
    fiscal_profile_status:
      orderItemRecord.fiscal_profile_status === "ready" || orderItemRecord.fiscal_profile_status === "review"
        ? orderItemRecord.fiscal_profile_status
        : "pending",
  }));

  nextDb.auditLogs = (nextDb.auditLogs as unknown as Array<Record<string, unknown>>).map((entry) => {
    const order = nextDb.orders.find((item) => item.id === entry.order_id);
    const nextEntry: DbAuditLog = {
      event_id: String(entry.event_id || entry.id || createId()),
      event_type: String(entry.event_type || "legacy.event"),
      occurred_at: String(entry.occurred_at || entry.created_at || new Date().toISOString()),
      correlation_id: typeof entry.correlation_id === "string" ? entry.correlation_id : order?.correlation_id || createId(),
      actor_id: (entry.actor_id as string | null) ?? (entry.user_id as string | null) ?? null,
      actor_name: (entry.actor_name as string | null) ?? (entry.user_email as string | null) ?? null,
      source_channel: (entry.source_channel as SourceChannel) ?? order?.source_channel ?? "web",
      order_id: (entry.order_id as string | null) ?? null,
      previous_value: (entry.previous_value as Record<string, unknown> | null) ?? null,
      new_value: (entry.new_value as Record<string, unknown> | null) ?? null,
      payload: (entry.payload as Record<string, unknown> | null) ?? (entry.metadata as Record<string, unknown> | null) ?? null,
    };
    changed = true;
    return nextEntry;
  }) as unknown as typeof nextDb.auditLogs;

  const groupedEventIds = new Map<string, string[]>();
  nextDb.auditLogs.forEach((entry) => {
    if (!entry.order_id) return;
    const current = groupedEventIds.get(entry.order_id) ?? [];
    current.push(entry.event_id);
    groupedEventIds.set(entry.order_id, current);
  });
  nextDb.orders = nextDb.orders.map((order) => {
    if (order.event_log.length === 0) {
      order.event_log = groupedEventIds.get(order.id) ?? [];
      changed = true;
    }
    return order;
  }) as unknown as typeof nextDb.orders;

  return { db: nextDb as unknown as DatabaseShape, changed };
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function bootstrapSqliteState() {
  ensureDataDir();
  getSqliteDb();

  if (!hasSqliteData()) {
    let source = seedDb();
    if (fs.existsSync(dbPath)) {
      const raw = JSON.parse(fs.readFileSync(dbPath, "utf8")) as DatabaseShape;
      source = migrateDb(raw).db;
    }
    writeSqlite(source);
    writeSnapshotJson(source);
    return source;
  }

  const migrated = migrateDb(readSqlite());
  if (migrated.changed) {
    writeSqlite(migrated.db);
    writeSnapshotJson(migrated.db);
  } else if (!fs.existsSync(dbPath)) {
    writeSnapshotJson(migrated.db);
  }
  return migrated.db;
}

async function bootstrapPostgresState() {
  ensureDataDir();
  await ensurePostgresSchema();

  if (await hasPostgresData()) {
    const migrated = migrateDb(await readPostgres());
    if (migrated.changed) {
      await writePostgres(migrated.db);
    }
    return migrated.db;
  }

  let source: DatabaseShape;
  if (fs.existsSync(sqlitePath)) {
    try {
      source = migrateDb(readSqlite()).db;
    } catch {
      source = fs.existsSync(dbPath) ? migrateDb(JSON.parse(fs.readFileSync(dbPath, "utf8")) as DatabaseShape).db : seedDb();
    }
  } else if (fs.existsSync(dbPath)) {
    source = migrateDb(JSON.parse(fs.readFileSync(dbPath, "utf8")) as DatabaseShape).db;
  } else {
    source = seedDb();
  }

  await writePostgres(source);
  return source;
}

async function persistPostgresState(db: DatabaseShape) {
  await writePostgres(db);
}

export async function importPostgresSnapshot(snapshot: DatabaseShape | Record<string, unknown>) {
  if (appConfig.dbProvider !== "postgres") {
    throw new Error("DB_PROVIDER deve ser postgres para importar o snapshot.");
  }
  const migrated = migrateDb(snapshot).db;
  await writePostgres(migrated);
  dbState = cloneDb(migrated);
  return cloneDb(migrated);
}

function queueDbFlush(db: DatabaseShape) {
  const snapshot = cloneDb(db);
  pendingDbFlushes += 1;
  dbFlushTail = dbFlushTail
    .catch(() => undefined)
    .then(async () => {
      await persistPostgresState(snapshot);
      lastDbFlushError = null;
    })
    .catch((error) => {
      lastDbFlushError = error instanceof Error ? error : new Error("db_flush_failed");
      throw lastDbFlushError;
    })
    .finally(() => {
      pendingDbFlushes = Math.max(0, pendingDbFlushes - 1);
    });
  return dbFlushTail;
}

export async function initializeDb() {
  if (dbState) {
    return cloneDb(dbState);
  }

  if (dbInitPromise) {
    return cloneDb(await dbInitPromise);
  }

  dbInitPromise = (async () => {
    const nextState = appConfig.dbProvider === "postgres" ? await bootstrapPostgresState() : bootstrapSqliteState();
    dbState = cloneDb(nextState);
    return cloneDb(nextState);
  })();

  try {
    return cloneDb(await dbInitPromise);
  } finally {
    dbInitPromise = null;
  }
}

export function ensureDb() {
  if (dbState) {
    return;
  }

  if (appConfig.dbProvider === "postgres") {
    throw new Error("Banco ainda nao inicializado. Chame initializeDb() antes de usar o provider postgres.");
  }

  dbState = cloneDb(bootstrapSqliteState());
}

export function readDb(): DatabaseShape {
  ensureDb();
  if (!dbState) {
    throw new Error("Banco nao inicializado");
  }
  return cloneDb(dbState);
}

export function writeDb(db: DatabaseShape) {
  ensureDb();
  const migrated = migrateDb(db).db;
  dbState = cloneDb(migrated);
  if (appConfig.dbProvider === "postgres") {
    void queueDbFlush(dbState);
    return;
  }
  writeSqlite(dbState);
  writeSnapshotJson(dbState);
}

export async function waitForPendingDbWrites() {
  await dbFlushTail;
  if (lastDbFlushError) {
    throw lastDbFlushError;
  }
}

export function closeDbResources() {
  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch {
      // noop
    }
    sqliteDb = null;
  }

  dbState = null;
  dbInitPromise = null;
  dbFlushTail = Promise.resolve();
  lastDbFlushError = null;
  pendingDbFlushes = 0;
}

export function getDbRuntimeStatus() {
  return {
    provider: appConfig.dbProvider,
    initialized: Boolean(dbState),
    pendingFlushes: pendingDbFlushes,
    lastFlushError: lastDbFlushError?.message ?? null,
    isolatedForTests: dbStorage.isolatedForTests,
    dataDir,
  };
}

const relationsLookupCache = new WeakMap<DatabaseShape, { categoryById: Map<string, DbCategory>; brandById: Map<string, DbBrand> }>();

function getRelationsLookup(db: DatabaseShape) {
  let lookup = relationsLookupCache.get(db);
  if (!lookup) {
    lookup = {
      categoryById: new Map(db.categories.map((item) => [item.id, item])),
      brandById: new Map(db.brands.map((item) => [item.id, item])),
    };
    relationsLookupCache.set(db, lookup);
  }
  return lookup;
}

// Builds a Map keyed by id once per `db` snapshot (cached via WeakMap, so it clears itself
// automatically once that snapshot is garbage-collected) instead of doing a linear .find() over
// every category/brand for every single product — matters when this is called in a .map() over
// the whole catalog (public listing, catalog audits, PIM quality scoring), turning an
// O(products x categories) scan into O(products) with O(1) lookups after the first call.
export function withRelations(db: DatabaseShape, product: DbProduct) {
  const { categoryById, brandById } = getRelationsLookup(db);
  return {
    ...product,
    category: (product.category_id !== null ? categoryById.get(product.category_id) : undefined) ?? null,
    brand: (product.brand_id !== null ? brandById.get(product.brand_id) : undefined) ?? null,
  };
}
