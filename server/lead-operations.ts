import { createId, type DatabaseShape, type DbLead } from "./db";
import { createAuditEvent } from "./order-domain";

export function createAdminLead(input: {
  db: DatabaseShape;
  body: Partial<DbLead>;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  const now = new Date().toISOString();
  const lead: DbLead = {
    id: createId(),
    name: String(body.name).trim(),
    email: body.email || null,
    phone: body.phone || null,
    source: body.source || "web",
    channel: body.channel || "manual",
    product_interest: body.product_interest || null,
    page_origin: body.page_origin || null,
    stage: body.stage || "new",
    responsible_id: body.responsible_id || actorId,
    responsible_name: body.responsible_name || actorName,
    linked_customer_id: body.linked_customer_id || null,
    linked_order_id: body.linked_order_id || null,
    linked_quote_id: body.linked_quote_id || null,
    notes: body.notes || null,
    created_at: now,
    updated_at: now,
  };
  db.leads.unshift(lead);
  createAuditEvent(db, {
    eventType: "lead.created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { lead_id: lead.id, lead_name: lead.name, source: lead.source, stage: lead.stage },
  });
  return lead;
}

export function updateAdminLead(input: {
  db: DatabaseShape;
  lead: DbLead;
  body: Partial<DbLead>;
  actorId: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const { db, lead, body, actorId, actorName, correlationId } = input;
  const previousValue = {
    stage: lead.stage,
    notes: lead.notes,
    responsible_id: lead.responsible_id,
    responsible_name: lead.responsible_name,
  };
  lead.stage = body.stage || lead.stage;
  lead.notes = typeof body.notes === "string" ? body.notes.trim() : lead.notes;
  lead.responsible_id = body.responsible_id ?? lead.responsible_id;
  lead.responsible_name = body.responsible_name ?? lead.responsible_name;
  lead.updated_at = new Date().toISOString();
  createAuditEvent(db, {
    eventType: "lead.updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: {
      stage: lead.stage,
      notes: lead.notes,
      responsible_id: lead.responsible_id,
      responsible_name: lead.responsible_name,
    },
    payload: { lead_id: lead.id },
  });
  return lead;
}
