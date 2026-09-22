import { createId, type DatabaseShape, type DbOrder, type DbOrderItem, type DbQuote, type DbQuoteItem, type DbEstablishment, type DbProduct, type DbLead } from "./db";
import { createAuditEvent } from "./order-domain";

export function createQuoteWithLead(input: {
  db: DatabaseShape;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  correlationId: string;
  items: Array<{ product: DbProduct; quantity: number }>;
}) {
  const { db, customerName, customerEmail, customerPhone, notes, sellerId, sellerName, storeId, storeName, correlationId, items } = input;
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const now = new Date().toISOString();
  const quote: DbQuote = {
    id: createId(),
    quote_number: `Q${Date.now().toString().slice(-8)}`,
    status: "draft",
    customer_name: customerName.trim(),
    customer_email: customerEmail?.trim() || null,
    customer_phone: customerPhone?.trim() || null,
    notes: notes?.trim() || null,
    subtotal,
    total: subtotal,
    seller_id: sellerId ?? null,
    seller_name: sellerName ?? null,
    store_id: storeId ?? null,
    store_name: storeName ?? null,
    correlation_id: correlationId,
    converted_order_id: null,
    created_at: now,
    updated_at: now,
  };

  const quoteItems: DbQuoteItem[] = items.map((item) => ({
    id: createId(),
    quote_id: quote.id,
    product_id: item.product.id,
    product_name: item.product.name,
    quantity: item.quantity,
    unit_price: Number(item.product.price),
    total_price: Number(item.product.price) * item.quantity,
  }));

  const lead: DbLead = {
    id: createId(),
    name: quote.customer_name,
    email: quote.customer_email,
    phone: quote.customer_phone,
    source: "showroom",
    channel: "showroom",
    product_interest: quoteItems.map((item) => item.product_name).join(", "),
    page_origin: "/admin/venda-assistida",
    stage: "qualified",
    responsible_id: quote.seller_id,
    responsible_name: quote.seller_name,
    linked_customer_id: null,
    linked_order_id: null,
    linked_quote_id: quote.id,
    notes: quote.notes,
    created_at: now,
    updated_at: now,
  };

  db.quotes.unshift(quote);
  db.quoteItems.push(...quoteItems);
  db.leads.unshift(lead);

  createAuditEvent(db, {
    eventType: "quote.created",
    correlationId: quote.correlation_id,
    actorId: sellerId ?? null,
    actorName: sellerName ?? "system",
    sourceChannel: "store",
    payload: {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      customer_name: quote.customer_name,
      total: quote.total,
      items: quoteItems.length,
    },
    occurredAt: now,
  });

  return { quote, quoteItems, lead };
}

export function convertQuoteToAssistedOrder(input: {
  db: DatabaseShape;
  quote: DbQuote;
  actorId?: string | null;
  actorName: string | null;
  defaultSellerEstablishment: DbEstablishment;
  buildItemFiscalSnapshot: (productId: string, establishmentId: string) => {
    ncm?: string | null;
    cest?: string | null;
    origin_code?: string | null;
    cfop?: string | null;
    cst_csosn?: string | null;
    requires_difal?: boolean;
    requires_fcp?: boolean;
    fiscal_profile_status?: "pending" | "ready" | "review";
  } | null;
}) {
  const { db, quote, actorId, actorName, defaultSellerEstablishment, buildItemFiscalSnapshot } = input;
  if (quote.converted_order_id) {
    const existing = db.orders.find((item) => item.id === quote.converted_order_id) ?? null;
    return { ok: true as const, order: existing, quote };
  }

  const quoteItems = db.quoteItems.filter((item) => item.quote_id === quote.id);
  if (quoteItems.length === 0) {
    return { ok: false as const, error: "O orcamento nao possui itens" };
  }

  const now = new Date().toISOString();
  const order: DbOrder = {
    id: createId(),
    order_number: `PVC${Date.now().toString().slice(-8)}`,
    tracking_token: createId(),
    user_id: null,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email || "sem-email@gamelmetal.com",
    customer_phone: quote.customer_phone || null,
    customer_cpf: null,
    delivery_type: "delivery",
    payment_method: "payment_link",
    payment_status: "pending",
    payment_reference: null,
    payment_approved_at: null,
    shipping_address: null,
    shipping_cost: 0,
    discount: 0,
    subtotal: quote.subtotal,
    total: quote.total,
    notes: quote.notes,
    status: "draft",
    order_type: "assisted",
    order_origin: "showroom",
    source_channel: "store",
    source_actor: "human",
    assisted_sale: true,
    seller_id: quote.seller_id,
    seller_name: quote.seller_name,
    seller_establishment_id: defaultSellerEstablishment.id,
    store_id: quote.store_id,
    store_name: quote.store_name,
    delivery_required: true,
    pickup_allowed: false,
    assisted_sale_notes: quote.notes,
    payment_linked_to_order: true,
    correlation_id: quote.correlation_id,
    idempotency_key: null,
    coupon_id: null,
    coupon_code: null,
    inventory_locked: false,
    event_log: [],
    created_at: now,
    updated_at: now,
  };

  const orderItems: DbOrderItem[] = quoteItems.map((item) => {
    const product = db.products.find((entry) => entry.id === item.product_id) ?? null;
    const fiscalSnapshot = product ? buildItemFiscalSnapshot(item.product_id, order.seller_establishment_id ?? defaultSellerEstablishment.id) : null;
    return {
      id: createId(),
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: product?.sku ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      sale_type: product?.sale_type,
      unit_measure: product?.unit_measure,
      display_unit: product?.display_unit ?? product?.unit_measure ?? null,
      seller_establishment_id: order.seller_establishment_id,
      allocated_lot_id: null,
      ncm: fiscalSnapshot?.ncm ?? product?.ncm ?? null,
      cest: fiscalSnapshot?.cest ?? product?.cest ?? null,
      origin_code: fiscalSnapshot?.origin_code ?? product?.origin_code ?? null,
      cfop: fiscalSnapshot?.cfop ?? "5102",
      cst_csosn: fiscalSnapshot?.cst_csosn ?? null,
      requires_difal: fiscalSnapshot?.requires_difal ?? true,
      requires_fcp: fiscalSnapshot?.requires_fcp ?? true,
      fiscal_profile_status: fiscalSnapshot?.fiscal_profile_status ?? product?.tax_classification_status ?? "pending",
    };
  });

  db.orders.unshift(order);
  db.orderItems.push(...orderItems);
  quote.converted_order_id = order.id;
  quote.status = "converted";
  quote.updated_at = now;

  createAuditEvent(db, {
    eventType: "quote.converted",
    orderId: order.id,
    correlationId: quote.correlation_id,
    actorId: actorId ?? null,
    actorName,
    sourceChannel: "store",
    payload: { quote_id: quote.id, quote_number: quote.quote_number, order_number: order.order_number },
    occurredAt: now,
  });

  return { ok: true as const, order, quote };
}
