import {
  createId,
  type DatabaseShape,
  type DbAuditLog,
  type DbOrder,
  type DbPaymentRecord,
  type DeliveryType,
  type OrderOrigin,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type SourceActor,
  type SourceChannel,
} from "./db";
import { appConfig } from "./config";

const validOrderTypes: OrderType[] = ["normal", "assisted", "pickup"];
const validOrderOrigins: OrderOrigin[] = ["ecommerce", "showroom", "whatsapp", "instagram", "marketplace", "integration"];
const validSourceChannels: SourceChannel[] = ["web", "store", "whatsapp", "instagram", "integration"];
const validSourceActors: SourceActor[] = ["human", "bot", "system"];
const validPaymentMethods: PaymentMethod[] = ["credit_card", "boleto", "pix", "cash", "payment_link", "store_pos"];

export function createAuditEvent(
  db: DatabaseShape,
  input: {
    eventType: string;
    correlationId: string;
    orderId?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    sourceChannel: SourceChannel;
    previousValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    payload?: Record<string, unknown> | null;
    occurredAt?: string;
  },
) {
  const event: DbAuditLog = {
    event_id: createId(),
    event_type: input.eventType,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    correlation_id: input.correlationId,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    source_channel: input.sourceChannel,
    order_id: input.orderId ?? null,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    payload: input.payload ?? null,
  };
  db.auditLogs.unshift(event);
  if (event.order_id) {
    const order = db.orders.find((item) => item.id === event.order_id);
    if (order) {
      order.event_log.unshift(event.event_id);
      order.updated_at = event.occurred_at;
    }
  }
  return event;
}

export function createPaymentRecord(
  db: DatabaseShape,
  input: {
    order: DbOrder;
    provider: DbPaymentRecord["provider"];
    method: PaymentMethod;
    status: DbPaymentRecord["status"];
    amount: number;
    externalReference?: string | null;
    webhookIdempotencyKey?: string | null;
    occurredAt?: string;
  },
) {
  const now = input.occurredAt ?? new Date().toISOString();
  const payment: DbPaymentRecord = {
    id: createId(),
    order_id: input.order.id,
    provider: input.provider,
    method: input.method,
    status: input.status,
    amount: Number(input.amount),
    correlation_id: input.order.correlation_id,
    external_reference: input.externalReference ?? null,
    webhook_idempotency_key: input.webhookIdempotencyKey ?? null,
    created_at: now,
    updated_at: now,
  };
  db.payments.unshift(payment);
  return payment;
}

export function buildPaymentIntent(order: DbOrder) {
  const configuredPaymentProvider = appConfig.paymentProvider;
  const reference = order.payment_reference || `${String(order.payment_method).toUpperCase()}-${order.order_number}`;
  const base = {
    provider: configuredPaymentProvider,
    reference,
    amount: order.total,
    status: order.payment_status,
  };

  if (order.payment_method === "pix") {
    return {
      ...base,
      mode: configuredPaymentProvider === "manual" ? "manual" : "provider",
      qrCodeText: `PIX|${reference}|${order.total.toFixed(2)}`,
      instructions: "Use o codigo PIX para concluir o pagamento. Em producao, conecte o gateway configurado.",
    };
  }

  if (order.payment_method === "boleto") {
    return {
      ...base,
      mode: configuredPaymentProvider === "manual" ? "manual" : "provider",
      boletoUrl: `/api/orders/${order.id}/payment-slip`,
      instructions: "Boleto gerado em modo local. Em producao, substitua pelo provedor configurado.",
    };
  }

  if (order.payment_method === "credit_card" || order.payment_method === "payment_link") {
    return {
      ...base,
      mode: configuredPaymentProvider === "manual" ? "manual" : "provider",
      checkoutUrl: `/pedido-confirmado?order=${order.id}&payment=${order.payment_method}`,
      instructions: "Fluxo pronto para plugar gateway real mantendo fallback manual.",
    };
  }

  return {
    ...base,
    mode: "manual",
    instructions: "Pagamento operacional tratado manualmente.",
  };
}

export function resolveOrderClassification(body: {
  orderType?: OrderType;
  orderOrigin?: OrderOrigin;
  sourceChannel?: SourceChannel;
  sourceActor?: SourceActor;
  assistedSale?: boolean;
  deliveryRequired?: boolean;
  pickupAllowed?: boolean;
}) {
  const orderType = body.orderType ?? "normal";
  const assistedSale = body.assistedSale ?? orderType === "assisted";
  const orderOrigin = body.orderOrigin ?? (assistedSale ? "showroom" : "ecommerce");
  const sourceChannel = body.sourceChannel ?? (assistedSale ? "store" : "web");
  const sourceActor = body.sourceActor ?? (assistedSale ? "human" : "system");
  const deliveryRequired = body.deliveryRequired ?? assistedSale;
  const pickupAllowed = body.pickupAllowed ?? !assistedSale;
  return { orderType, orderOrigin, sourceChannel, sourceActor, assistedSale, deliveryRequired, pickupAllowed };
}

export function validateClassification(
  deliveryType: DeliveryType,
  paymentMethod: PaymentMethod,
  classification: ReturnType<typeof resolveOrderClassification>,
  sellerName?: string | null,
  storeName?: string | null,
) {
  if (!validOrderTypes.includes(classification.orderType)) return "Tipo de pedido invalido";
  if (!validOrderOrigins.includes(classification.orderOrigin)) return "Origem do pedido invalida";
  if (!validSourceChannels.includes(classification.sourceChannel)) return "Canal de origem invalido";
  if (!validSourceActors.includes(classification.sourceActor)) return "Ator de origem invalido";
  if (!validPaymentMethods.includes(paymentMethod)) return "Forma de pagamento invalida";

  if (classification.assistedSale) {
    if (deliveryType !== "delivery") return "Compra assistida exige entrega em domicilio";
    if (!classification.deliveryRequired) return "Compra assistida precisa exigir entrega";
    if (classification.pickupAllowed) return "Compra assistida nao pode permitir retirada";
    if (classification.orderOrigin !== "showroom") return "Compra assistida precisa ter origem showroom";
    if (classification.sourceChannel !== "store") return "Compra assistida precisa ter canal store";
    if (classification.sourceActor !== "human") return "Compra assistida precisa ter ator humano";
    if (!sellerName?.trim()) return "Informe o vendedor responsavel";
    if (!storeName?.trim()) return "Informe a loja de origem";
  }

  if (classification.orderType === "pickup" && deliveryType !== "pickup") {
    return "Pedido presencial/retirada deve usar retirada";
  }

  return null;
}

export function inferPaymentStatus(status: OrderStatus, paymentMethod: PaymentMethod): PaymentStatus {
  if (
    status === "payment_approved" ||
    status === "confirmed" ||
    status === "processing" ||
    status === "in_separation" ||
    status === "in_expedition" ||
    status === "shipped" ||
    status === "out_for_delivery" ||
    status === "delivered"
  ) {
    return "approved";
  }
  return paymentMethod === "cash" ? "initiated" : "pending";
}

export function getOrderPaymentView(db: DatabaseShape, orderId: string) {
  return db.payments
    .filter((item) => item.order_id === orderId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
