import { createAuditEvent, createPaymentRecord } from "./order-domain";
import type { DatabaseShape, DbCustomerProfile, DbCustomerReturnRequest, DbCustomerSupportTicket } from "./db";

export const validReturnStatuses: DbCustomerReturnRequest["status"][] = [
  "open",
  "review",
  "approved",
  "awaiting_shipment",
  "received",
  "completed",
  "rejected",
];

export const validTicketStatuses: DbCustomerSupportTicket["status"][] = ["open", "in_progress", "resolved"];

const returnStatusTransitions: Record<DbCustomerReturnRequest["status"], DbCustomerReturnRequest["status"][]> = {
  open: ["open", "review", "approved", "completed", "rejected"],
  review: ["review", "approved", "awaiting_shipment", "rejected"],
  approved: ["approved", "awaiting_shipment", "received", "completed"],
  awaiting_shipment: ["awaiting_shipment", "received", "rejected"],
  received: ["received", "completed", "rejected"],
  completed: ["completed"],
  rejected: ["rejected"],
};

const ticketStatusTransitions: Record<DbCustomerSupportTicket["status"], DbCustomerSupportTicket["status"][]> = {
  open: ["open", "in_progress", "resolved"],
  in_progress: ["in_progress", "resolved"],
  resolved: ["resolved"],
};

function enrichReturn(profile: DbCustomerProfile, request: DbCustomerReturnRequest) {
  return {
    ...request,
    customer_name: profile.fullName || profile.email,
    customer_email: profile.email,
  };
}

function enrichTicket(profile: DbCustomerProfile, ticket: DbCustomerSupportTicket) {
  return {
    ...ticket,
    customer_name: profile.fullName || profile.email,
    customer_email: profile.email,
  };
}

export function listAdminReturnRequests(db: DatabaseShape) {
  return db.customerProfiles
    .flatMap((profile) => profile.returns.map((entry) => enrichReturn(profile, entry)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAdminSupportTickets(db: DatabaseShape) {
  return db.customerProfiles
    .flatMap((profile) => profile.tickets.map((entry) => enrichTicket(profile, entry)))
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export function applyAdminReturnStatusUpdate(input: {
  db: DatabaseShape;
  returnId: string;
  nextStatus: DbCustomerReturnRequest["status"];
  actorId?: string | null;
  actorName: string | null;
}) {
  const { db, returnId, nextStatus, actorId, actorName } = input;
  if (!validReturnStatuses.includes(nextStatus)) {
    return { ok: false as const, error: "Status de devolucao invalido" };
  }

  const profile = db.customerProfiles.find((entry) => entry.returns.some((request) => request.id === returnId)) ?? null;
  if (!profile) {
    return { ok: false as const, error: "Solicitacao de devolucao nao encontrada" };
  }

  const request = profile.returns.find((entry) => entry.id === returnId)!;
  const previousStatus = request.status;
  if (!returnStatusTransitions[request.status].includes(nextStatus)) {
    return { ok: false as const, error: `Transicao invalida de ${request.status} para ${nextStatus}` };
  }
  request.status = nextStatus;
  profile.updated_at = new Date().toISOString();

  const order = db.orders.find((entry) => entry.id === request.orderId) ?? null;
  if (order) {
    createAuditEvent(db, {
      eventType: "customer.return_status_updated",
      orderId: order.id,
      correlationId: order.correlation_id,
      actorId: actorId ?? null,
      actorName,
      sourceChannel: order.source_channel,
      previousValue: { return_status: previousStatus },
      newValue: { return_status: nextStatus, return_method: request.method },
      payload: { return_id: request.id, customer_email: profile.email },
      occurredAt: profile.updated_at,
    });

    const shouldRegisterRefund =
      request.method === "refund" &&
      nextStatus === "completed" &&
      order.payment_status === "approved" &&
      !db.payments.some((entry) => entry.order_id === order.id && entry.status === "refunded");

    if (shouldRegisterRefund) {
      createPaymentRecord(db, {
        order,
        provider: "manual",
        method: order.payment_method,
        status: "refunded",
        amount: order.total,
        externalReference: order.payment_reference,
        occurredAt: profile.updated_at,
      });

      createAuditEvent(db, {
        eventType: "payment.refunded",
        orderId: order.id,
        correlationId: order.correlation_id,
        actorId: actorId ?? null,
        actorName,
        sourceChannel: order.source_channel,
        previousValue: { payment_status: order.payment_status },
        newValue: { payment_status: order.payment_status, refund_registered: true },
        payload: { return_id: request.id, refund_method: request.method },
        occurredAt: profile.updated_at,
      });
    }
  }

  return { ok: true as const, request: enrichReturn(profile, request) };
}

export function applyAdminTicketStatusUpdate(input: {
  db: DatabaseShape;
  ticketId: string;
  nextStatus: DbCustomerSupportTicket["status"];
  actorId?: string | null;
  actorName: string | null;
}) {
  const { db, ticketId, nextStatus, actorId, actorName } = input;
  if (!validTicketStatuses.includes(nextStatus)) {
    return { ok: false as const, error: "Status de ticket invalido" };
  }

  const profile = db.customerProfiles.find((entry) => entry.tickets.some((ticket) => ticket.id === ticketId)) ?? null;
  if (!profile) {
    return { ok: false as const, error: "Ticket nao encontrado" };
  }

  const ticket = profile.tickets.find((entry) => entry.id === ticketId)!;
  const previousStatus = ticket.status;
  if (!ticketStatusTransitions[ticket.status].includes(nextStatus)) {
    return { ok: false as const, error: `Transicao invalida de ${ticket.status} para ${nextStatus}` };
  }
  ticket.status = nextStatus;
  ticket.updatedAt = new Date().toISOString();
  profile.updated_at = ticket.updatedAt;

  const order = ticket.orderId ? db.orders.find((entry) => entry.id === ticket.orderId) ?? null : null;
  if (order) {
    createAuditEvent(db, {
      eventType: "customer.ticket_status_updated",
      orderId: order.id,
      correlationId: order.correlation_id,
      actorId: actorId ?? null,
      actorName,
      sourceChannel: order.source_channel,
      previousValue: { ticket_status: previousStatus },
      newValue: { ticket_status: nextStatus, ticket_subject: ticket.subject },
      payload: { ticket_id: ticket.id, customer_email: profile.email },
      occurredAt: ticket.updatedAt,
    });
  }

  return { ok: true as const, ticket: enrichTicket(profile, ticket) };
}
