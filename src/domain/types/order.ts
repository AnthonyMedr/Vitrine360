/**
 * Domain types for Order entity
 * Aligned with OmniGrow CRM integration contracts
 */

export interface DomainOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DomainOrder {
  order_id: string;
  order_number: string;
  customer: {
    phone?: string;
    name: string;
    email: string;
    document?: string;
  };
  items: DomainOrderItem[];
  subtotal: number;
  shipping_cost: number;
  discount?: number;
  total: number;
  delivery_type: 'pickup' | 'delivery';
  shipping_address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
  };
  payment_method: 'credit_card' | 'boleto' | 'pix' | 'cash';
  status: 'draft' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'awaiting_payment' | 'payment_approved' | 'in_separation' | 'in_expedition' | 'out_for_delivery';
  order_type: 'normal' | 'assisted' | 'pickup';
  order_origin: 'ecommerce' | 'showroom' | 'whatsapp' | 'marketplace';
  is_assisted_sale: boolean;
  seller_id?: string;
  seller_name?: string;
  showroom_store_id?: string;
  showroom_store_name?: string;
  delivery_required: boolean;
  assisted_sale_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
