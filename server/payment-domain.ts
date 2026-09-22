import crypto from "node:crypto";
import type express from "express";
import type { PaymentIntentResult } from "./integrations/payment";
import { appConfig } from "./config";
import { createId, type DatabaseShape, type DbFiscalDocument, type DbOrder, type DbPaymentRecord, type PaymentMethod } from "./db";
import { createAuditEvent, createPaymentRecord } from "./order-domain";

const validPaymentMethods: PaymentMethod[] = ["credit_card", "boleto", "pix", "cash", "payment_link", "store_pos"];

export type GenericPaymentWebhookInput = {
  eventType?: "payment_succeeded" | "payment_failed" | "payment_refunded";
  orderId?: string;
  externalReference?: string;
  amount?: number;
  idempotencyKey?: string;
  provider?: DbPaymentRecord["provider"];
};

export function validateMercadoPagoWebhookSignature(req: express.Request) {
  if (!appConfig.mercadopago.webhookSecret) return false;
  const signatureHeader = req.header("x-signature");
  const requestId = req.header("x-request-id");
  const paymentId = String(req.query["data.id"] || (req.body as { data?: { id?: string } })?.data?.id || "").toLowerCase();
  if (!signatureHeader || !requestId || !paymentId) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const ts = parts.find((part) => part.startsWith("ts="))?.slice(3) || "";
  const v1 = parts.find((part) => part.startsWith("v1="))?.slice(3) || "";
  const template = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", appConfig.mercadopago.webhookSecret).update(template).digest("hex");
  return expected === v1;
}

export function validateGenericWebhookSignature(req: express.Request) {
  const secret = appConfig.mercadopago.webhookSecret || appConfig.auth.csrfSecret;
  const signature = req.header("x-webhook-signature");
  const rawBody = (req as express.Request & { rawBody?: string }).rawBody || "";
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function ensureFiscalDocumentForOrder(db: DatabaseShape, order: DbOrder, actorName: string | null, status: "pending" | "authorized" = "pending") {
  const now = new Date().toISOString();
  const existing = db.fiscalDocuments.find((entry) => entry.order_id === order.id && entry.document_type === "nfe_saida");
  if (existing) {
    existing.status_sefaz = status;
    existing.message = status === "authorized" ? "Documento autorizado em modo local." : "Documento fiscal preparado aguardando emissao real.";
    existing.issued_at = status === "authorized" ? now : existing.issued_at;
    return existing;
  }

  const cfops = [...new Set(db.orderItems.filter((item) => item.order_id === order.id).map((item) => item.cfop).filter(Boolean))];
  const document: DbFiscalDocument = {
    id: createId(),
    establishment_id: order.seller_establishment_id ?? "est-comercial",
    order_id: order.id,
    document_type: "nfe_saida",
    number: null,
    series: "1",
    access_key: null,
    cfop_summary: cfops.join(", ") || "5102",
    xml_url: null,
    status_sefaz: status,
    provider: "manual",
    message: status === "authorized" ? "Documento autorizado em modo local." : "Documento fiscal preparado aguardando emissao real.",
    issued_at: status === "authorized" ? now : null,
    created_at: now,
  };
  db.fiscalDocuments.unshift(document);
  createAuditEvent(db, {
    eventType: status === "authorized" ? "fiscal.document_authorized" : "fiscal.document_prepared",
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: null,
    actorName: actorName ?? "system",
    sourceChannel: order.source_channel,
    newValue: { fiscal_document_id: document.id, status_sefaz: document.status_sefaz, establishment_id: document.establishment_id },
    occurredAt: now,
  });
  return document;
}

export function applyOrderPaymentAction(input: {
  db: DatabaseShape;
  order: DbOrder;
  action: "initiate" | "approve" | "fail";
  paymentMethod?: PaymentMethod;
  paymentReference?: string | null;
  paymentIntent?: PaymentIntentResult;
  actorId?: string | null;
  actorName: string;
}) {
  const { db, order, action, paymentIntent } = input;
  const previousValue = { payment_status: order.payment_status, payment_method: order.payment_method, status: order.status };

  if (input.paymentMethod && validPaymentMethods.includes(input.paymentMethod)) order.payment_method = input.paymentMethod;
  if (typeof input.paymentReference === "string") order.payment_reference = input.paymentReference;

  if (action === "initiate" && paymentIntent) {
    order.payment_status = "initiated";
    if (order.status === "draft" || order.status === "pending") order.status = "awaiting_payment";
    if (paymentIntent.reference && !order.payment_reference) {
      order.payment_reference = paymentIntent.reference;
    }
    createPaymentRecord(db, {
      order,
      provider: paymentIntent.provider === "mercadopago" ? "payment_link" : "manual",
      method: order.payment_method,
      status: "initiated",
      amount: order.total,
      externalReference: paymentIntent.reference,
      occurredAt: new Date().toISOString(),
    });
    createAuditEvent(db, {
      eventType: "payment.initiated",
      orderId: order.id,
      correlationId: order.correlation_id,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      sourceChannel: order.source_channel,
      previousValue,
      newValue: {
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        status: order.status,
        provider: paymentIntent.provider,
      },
    });
  }

  if (action === "approve" && order.payment_status !== "approved") {
    order.payment_status = "approved";
    order.payment_approved_at = new Date().toISOString();
    order.status = "payment_approved";
    createPaymentRecord(db, {
      order,
      provider: "manual",
      method: order.payment_method,
      status: "approved",
      amount: order.total,
      externalReference: order.payment_reference,
      occurredAt: order.payment_approved_at,
    });
    createAuditEvent(db, {
      eventType: "payment.approved",
      orderId: order.id,
      correlationId: order.correlation_id,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      sourceChannel: order.source_channel,
      previousValue,
      newValue: {
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        status: order.status,
        amount: order.total,
        confirmed_at: order.payment_approved_at,
      },
    });
    ensureFiscalDocumentForOrder(db, order, input.actorName, "pending");
  }

  if (action === "fail") {
    order.payment_status = "failed";
    if (order.status === "payment_approved") order.status = "awaiting_payment";
    createPaymentRecord(db, {
      order,
      provider: "manual",
      method: order.payment_method,
      status: "failed",
      amount: order.total,
      externalReference: order.payment_reference,
      occurredAt: new Date().toISOString(),
    });
    createAuditEvent(db, {
      eventType: "payment.failed",
      orderId: order.id,
      correlationId: order.correlation_id,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      sourceChannel: order.source_channel,
      previousValue,
      newValue: { payment_status: order.payment_status, status: order.status },
    });
  }

  order.payment_linked_to_order = true;
  order.updated_at = new Date().toISOString();
  return { order, paymentIntent };
}

export function applyMercadoPagoWebhookMutation(input: {
  db: DatabaseShape;
  paymentId: string;
  externalReference: string;
  mappedStatus: "approved" | "failed" | "refunded" | "pending";
  transactionAmount: number;
  webhookKey: string;
  topic: string;
}) {
  const { db, externalReference, mappedStatus, paymentId, transactionAmount, webhookKey, topic } = input;
  const order = db.orders.find((item) => item.payment_reference === externalReference || item.order_number === externalReference);
  if (!order) {
    return { changed: false, response: { ignored: true } };
  }

  const existing = db.payments.find((item) => item.webhook_idempotency_key === webhookKey);
  if (existing) {
    return { changed: false, response: { ok: true, duplicated: true } };
  }

  const now = new Date().toISOString();
  createPaymentRecord(db, {
    order,
    provider: "payment_link",
    method: order.payment_method,
    status: mappedStatus,
    amount: transactionAmount,
    externalReference: externalReference || paymentId,
    webhookIdempotencyKey: webhookKey,
    occurredAt: now,
  });

  const previousStatus = order.payment_status;
  if (mappedStatus === "approved") {
    order.payment_status = "approved";
    order.payment_approved_at = now;
    order.status = "payment_approved";
    ensureFiscalDocumentForOrder(db, order, "mercadopago-webhook", "pending");
  } else if (mappedStatus === "failed") {
    order.payment_status = "failed";
    order.status = "awaiting_payment";
  }
  order.payment_reference = externalReference || order.payment_reference;
  order.updated_at = now;

  createAuditEvent(db, {
    eventType: `payment.${mappedStatus}`,
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: null,
    actorName: "mercadopago-webhook",
    sourceChannel: order.source_channel,
    previousValue: { payment_status: previousStatus },
    newValue: { payment_status: order.payment_status, provider_payment_id: paymentId, status: order.status },
    payload: { topic, payment_id: paymentId },
    occurredAt: now,
  });

  return { changed: true, response: { ok: true } };
}

export function applyGenericPaymentWebhookMutation(input: {
  db: DatabaseShape;
  body: GenericPaymentWebhookInput;
}) {
  const { db, body } = input;
  const order = db.orders.find((item) => item.id === body.orderId);
  if (!order) {
    return { changed: false, response: { status: 404, payload: { error: "Pedido nao encontrado" } } };
  }

  const existing = db.payments.find((item) => item.webhook_idempotency_key === body.idempotencyKey);
  if (existing) {
    return { changed: false, response: { status: 200, payload: { ok: true, payment: existing, order } } };
  }

  const now = new Date().toISOString();
  const nextStatus =
    body.eventType === "payment_succeeded" ? "approved" : body.eventType === "payment_refunded" ? "refunded" : "failed";

  createPaymentRecord(db, {
    order,
    provider: body.provider || "manual",
    method: order.payment_method,
    status: nextStatus,
    amount: Number(body.amount || order.total),
    externalReference: body.externalReference || null,
    webhookIdempotencyKey: body.idempotencyKey,
    occurredAt: now,
  });

  const previousStatus = order.payment_status;
  if (nextStatus === "approved") {
    order.payment_status = "approved";
    order.payment_reference = body.externalReference || order.payment_reference;
    order.payment_approved_at = now;
    order.status = "payment_approved";
    ensureFiscalDocumentForOrder(db, order, "gateway-webhook", "pending");
  } else if (nextStatus === "failed") {
    order.payment_status = "failed";
    order.status = "awaiting_payment";
  }

  createAuditEvent(db, {
    eventType: `payment.${nextStatus}`,
    orderId: order.id,
    correlationId: order.correlation_id,
    actorId: null,
    actorName: "generic-webhook",
    sourceChannel: order.source_channel,
    previousValue: { payment_status: previousStatus },
    newValue: { payment_status: order.payment_status, status: order.status },
    payload: { event_type: body.eventType, provider: body.provider || "manual" },
    occurredAt: now,
  });

  order.updated_at = now;
  return { changed: true, response: { status: 200, payload: { ok: true, order } } };
}
