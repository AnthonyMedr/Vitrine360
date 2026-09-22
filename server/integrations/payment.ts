import { appConfig, resolvePublicUrl } from "../config";
import { fetchWithTimeout } from "./http";
import type { DbOrder, DbOrderItem, PaymentMethod } from "../db";

export type PaymentIntentResult = {
  provider: string;
  mode: "manual" | "provider";
  reference: string;
  status: string;
  checkoutUrl?: string;
  qrCodeText?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  providerPaymentId?: string;
  raw?: Record<string, unknown> | null;
};

function getMercadoPagoApiBase() {
  return appConfig.mercadopago.checkoutBaseUrl.replace(/\/$/, "");
}

function resolvePaymentReturnUrl(type: "success" | "failure" | "pending", orderId: string) {
  if (type === "success") {
    return appConfig.mercadopago.successUrl || resolvePublicUrl(`/pedido-confirmado?order=${encodeURIComponent(orderId)}`);
  }
  if (type === "pending") {
    return appConfig.mercadopago.pendingUrl || resolvePublicUrl(`/pedido-confirmado?order=${encodeURIComponent(orderId)}`);
  }
  return appConfig.mercadopago.failureUrl || resolvePublicUrl(`/checkout?payment=failed&order=${encodeURIComponent(orderId)}`);
}

function mapExcludedPaymentTypes(paymentMethod: PaymentMethod) {
  if (paymentMethod === "pix") {
    return [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }];
  }
  if (paymentMethod === "boleto") {
    return [{ id: "credit_card" }, { id: "debit_card" }, { id: "bank_transfer" }];
  }
  if (paymentMethod === "credit_card") {
    return [{ id: "ticket" }, { id: "bank_transfer" }];
  }
  return [];
}

function normalizeFakePaymentStatus(status: string) {
  if (status === "approved" || status === "rejected" || status === "pending" || status === "unavailable") return status;
  return "pending";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createProviderPaymentIntent(input: {
  order: DbOrder;
  items: DbOrderItem[];
}): Promise<PaymentIntentResult> {
  if (appConfig.paymentProvider === "fake") {
    if (appConfig.fakePayment.latencyMs > 0) {
      await sleep(appConfig.fakePayment.latencyMs);
    }

    const reference = input.order.payment_reference || `FAKE-${input.order.order_number}`;
    const fakeStatus = normalizeFakePaymentStatus(appConfig.fakePayment.status);
    if (fakeStatus === "unavailable") {
      return {
        provider: "fake",
        mode: "provider",
        reference,
        status: "failed",
        providerPaymentId: `fake-${input.order.id}`,
        raw: { error: "fake_payment_provider_unavailable" },
      };
    }

    return {
      provider: "fake",
      mode: "provider",
      reference,
      status: fakeStatus,
      checkoutUrl: resolvePublicUrl(`/pedido-confirmado?order=${encodeURIComponent(input.order.id)}&payment=fake-${fakeStatus}`),
      providerPaymentId: `fake-${input.order.id}`,
      raw: { fake: true, status: fakeStatus },
    };
  }

  if (appConfig.paymentProvider !== "mercadopago" || !appConfig.mercadopago.accessToken) {
    const reference = input.order.payment_reference || `${String(input.order.payment_method).toUpperCase()}-${input.order.order_number}`;
    return {
      provider: "manual",
      mode: "manual",
      reference,
      status: input.order.payment_status,
    };
  }

  const reference = input.order.payment_reference || `ORDER-${input.order.order_number}`;
  const payload = {
    items: input.items.map((item) => ({
      id: item.product_id,
      title: item.product_name,
      description: item.product_name,
      quantity: item.quantity,
      currency_id: "BRL",
      unit_price: Number(item.unit_price),
    })),
    payer: {
      name: input.order.customer_name.split(" ")[0] || input.order.customer_name,
      surname: input.order.customer_name.split(" ").slice(1).join(" ") || undefined,
      email: input.order.customer_email,
      identification: input.order.customer_cpf
        ? {
            type: "CPF",
            number: input.order.customer_cpf.replace(/\D/g, ""),
          }
        : undefined,
      address: input.order.shipping_address
        ? {
            zip_code: input.order.shipping_address.zipCode.replace(/\D/g, ""),
            street_name: input.order.shipping_address.street,
            street_number: Number(input.order.shipping_address.number.replace(/\D/g, "") || "0"),
          }
        : undefined,
    },
    payment_methods: {
      excluded_payment_types: mapExcludedPaymentTypes(input.order.payment_method),
      installments: input.order.payment_method === "credit_card" ? 12 : 1,
      default_installments: input.order.payment_method === "credit_card" ? 1 : 1,
    },
    shipments: {
      cost: Number(input.order.shipping_cost || 0),
      mode: "not_specified",
      local_pickup: input.order.delivery_type === "pickup",
    },
    external_reference: reference,
    notification_url: `${resolvePublicUrl("/api/payments/webhook/mercadopago")}?source_news=webhooks`,
    back_urls: {
      success: resolvePaymentReturnUrl("success", input.order.id),
      pending: resolvePaymentReturnUrl("pending", input.order.id),
      failure: resolvePaymentReturnUrl("failure", input.order.id),
    },
    auto_return: "approved",
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${getMercadoPagoApiBase()}/checkout/preferences`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appConfig.mercadopago.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      appConfig.mercadopago.requestTimeoutMs,
    );
  } catch (error) {
    return {
      provider: "mercadopago",
      mode: "provider",
      reference,
      status: "failed",
      raw: {
        error: error instanceof Error ? error.message : "provider_request_failed",
      },
    };
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !data) {
    return {
      provider: "mercadopago",
      mode: "provider",
      reference,
      status: "failed",
      raw: data,
    };
  }

  return {
    provider: "mercadopago",
    mode: "provider",
    reference,
    status: "pending",
    checkoutUrl: String(data.init_point || data.sandbox_init_point || ""),
    providerPaymentId: typeof data.id === "string" ? data.id : undefined,
    raw: data,
  };
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  try {
    const response = await fetchWithTimeout(
      `${getMercadoPagoApiBase()}/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${appConfig.mercadopago.accessToken}`,
          "Content-Type": "application/json",
        },
      },
      appConfig.mercadopago.requestTimeoutMs,
    );
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

export function mapMercadoPagoStatus(status: string | undefined) {
  if (status === "approved") return "approved";
  if (status === "rejected" || status === "cancelled") return "failed";
  if (status === "refunded") return "refunded";
  return "pending";
}
