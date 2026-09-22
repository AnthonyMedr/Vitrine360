/**
 * Event envelope and types for OmniGrow CRM integration
 * Standard event-driven architecture
 */

// ============================================
// Event Envelope (standard for all events)
// ============================================

export interface EventEnvelope<T = unknown> {
  event_id: string;
  event_type: EventType;
  occurred_at: string;
  source: 'gamel_web';
  correlation_id: string;
  payload: T;
}

export type EventType =
  | 'lead.created'
  | 'quote.created'
  | 'quote.started'
  | 'quote.submitted'
  | 'whatsapp.clicked'
  | 'catalog.searched'
  | 'category.viewed'
  | 'product.viewed'
  | 'commercial.simulated'
  | 'cart.updated'
  | 'cart.abandoned'
  | 'checkout.started'
  | 'order.created'
  | 'support.requested'
  | 'customer.origin_detected'
  | 'customer.created'
  | 'customer.updated'
  | 'error.tracked';

// ============================================
// Event Payloads
// ============================================

export interface LeadCreatedPayload {
  channel: 'whatsapp' | 'form' | 'chat';
  lead_origem?: string;
  lead_canal?: string;
  lead_produto_interesse?: string;
  lead_pagina_origem?: string;
  phone?: string;
  name?: string;
  email?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  context: {
    product_sku?: string;
    product_name?: string;
    cart_total?: number;
    cart_items?: Array<{
      sku: string;
      name: string;
      quantity: number;
      price: number;
      tipo_venda?: string;
      unidade_medida?: string;
    }>;
    page_url?: string;
    referrer?: string;
  };
}

export interface ProductViewedPayload {
  product_sku: string;
  product_name: string;
  product_price: number;
  category_slug?: string;
  category_name?: string;
  page_url: string;
  referrer?: string;
}

export interface CartUpdatedPayload {
  action: 'add' | 'remove' | 'update_quantity' | 'clear';
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    tipo_venda?: string;
    unidade_medida?: string;
    quantidade_informada?: number;
    quantidade_calculada?: number;
  }>;
  cart_total: number;
  item_count: number;
  changed_item?: {
    sku: string;
    name: string;
    quantity: number;
    previous_quantity?: number;
  };
}

export interface CartAbandonedPayload {
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    tipo_venda?: string;
    unidade_medida?: string;
  }>;
  total_estimated: number;
  last_seen_at: string;
  session_duration_ms: number;
}

export interface CheckoutStartedPayload {
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    tipo_venda?: string;
    unidade_medida?: string;
  }>;
  subtotal: number;
  shipping_option?: 'pickup' | 'delivery';
  estimated_total: number;
}

export interface OrderCreatedPayload {
  order_id: string;
  order_number: string;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    tipo_venda?: string;
    unidade_medida?: string;
    quantidade_informada?: number;
    quantidade_calculada?: number;
  }>;
  customer: {
    phone?: string;
    name: string;
    email: string;
  };
  delivery_type: 'pickup' | 'delivery';
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  discount?: number;
  total: number;
  page_url?: string;
}

export interface QuoteCreatedPayload {
  quote_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  lead_origem?: string;
  lead_canal?: string;
  lead_produto_interesse?: string;
  lead_pagina_origem?: string;
  total?: number;
}

export interface QuoteSubmittedPayload extends QuoteCreatedPayload {
  lead_ref: string;
  city?: string;
  category?: string;
  quantity?: string;
  message?: string;
  preference?: string;
}

export interface SupportRequestedPayload {
  channel: 'whatsapp' | 'email' | 'phone';
  origin: string;
  page_url?: string;
  order_number?: string;
  product_name?: string;
  tipo_venda?: string;
  unidade_medida?: string;
}

export interface CommercialSimulatedPayload {
  tipo_venda?: string;
  unidade_medida?: string;
  quantidade_informada?: number;
  quantidade_calculada?: number;
  produto_interesse?: string;
  pagina_origem?: string;
}

export interface CustomerOriginDetectedPayload {
  origin: 'web' | 'whatsapp' | 'instagram' | 'showroom' | 'store' | 'integration';
  channel?: string;
  customer_type?: 'retail' | 'pro' | 'business';
  preferred_store_id?: string;
  first_assisted_by?: string;
}

export interface CustomerCreatedPayload {
  phone: string;
  name?: string;
  email?: string;
  source: 'checkout' | 'signup' | 'lead';
}

export interface CustomerUpdatedPayload {
  phone: string;
  updated_fields: string[];
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
}

// ============================================
// Outbox Entry (for persistence)
// ============================================

export interface OutboxEntry {
  id: string;
  event: EventEnvelope;
  status: 'pending' | 'sent' | 'failed' | 'expired';
  attempts: number;
  max_attempts: number;
  created_at: string;
  last_attempt_at?: string;
  next_retry_at?: string;
  error?: string;
}
