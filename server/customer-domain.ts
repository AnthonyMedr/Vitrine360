import { createId, type DatabaseShape, type DbCustomerProfile, type DbLead } from "./db";
import { createAuditEvent } from "./order-domain";

type CustomerLikeUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; store_id?: string | null; store_name?: string | null };
};

export function buildDefaultCustomerProfile(user: CustomerLikeUser): DbCustomerProfile {
  return {
    user_id: user.id,
    fullName: user.user_metadata?.full_name || "",
    email: user.email,
    phone: "",
    cpfCnpj: "",
    customerType: "retail",
    customerOrigin: "web",
    preferredChannel: "whatsapp",
    allowPromotions: false,
    preferredStoreId: user.user_metadata?.store_id ?? null,
    preferredStoreName: user.user_metadata?.store_name ?? null,
    firstAssistedBy: null,
    addresses: [],
    activeCart: null,
    savedCarts: [],
    favorites: [],
    lists: [],
    returns: [],
    tickets: [],
    updated_at: new Date().toISOString(),
  };
}

export function getOrCreateCustomerProfile(db: DatabaseShape, user: CustomerLikeUser) {
  let profile = db.customerProfiles.find((entry) => entry.user_id === user.id);
  if (!profile) {
    profile = buildDefaultCustomerProfile(user);
    db.customerProfiles.push(profile);
  }
  return profile;
}

export function applyCustomerProfileUpdate(input: {
  db: DatabaseShape;
  user: CustomerLikeUser;
  body: Partial<DbCustomerProfile>;
  actorId: string;
  actorName: string;
  correlationId: string;
  normalizeEmail: (value: string) => string;
  isValidEmail: (value: string) => boolean;
}) {
  const { db, user, body, actorId, actorName, correlationId, normalizeEmail, isValidEmail } = input;
  const current = getOrCreateCustomerProfile(db, user);
  const next: DbCustomerProfile = {
    ...current,
    ...body,
    user_id: current.user_id,
    email: body.email && isValidEmail(body.email) ? normalizeEmail(body.email) : current.email,
    fullName: typeof body.fullName === "string" ? body.fullName.trim() : current.fullName,
    phone: typeof body.phone === "string" ? body.phone.trim() : current.phone,
    cpfCnpj: typeof body.cpfCnpj === "string" ? body.cpfCnpj.trim() : current.cpfCnpj,
    companyName: typeof body.companyName === "string" ? body.companyName.trim() : current.companyName,
    stateRegistration: typeof body.stateRegistration === "string" ? body.stateRegistration.trim() : current.stateRegistration,
    birthDate: typeof body.birthDate === "string" ? body.birthDate : current.birthDate,
    customerType: body.customerType || current.customerType,
    customerOrigin: body.customerOrigin || current.customerOrigin,
    preferredChannel: body.preferredChannel || current.preferredChannel,
    allowPromotions: typeof body.allowPromotions === "boolean" ? body.allowPromotions : current.allowPromotions,
    preferredStoreId: typeof body.preferredStoreId !== "undefined" ? body.preferredStoreId ?? null : current.preferredStoreId,
    preferredStoreName: typeof body.preferredStoreName !== "undefined" ? body.preferredStoreName ?? null : current.preferredStoreName,
    firstAssistedBy: typeof body.firstAssistedBy !== "undefined" ? body.firstAssistedBy ?? null : current.firstAssistedBy,
    addresses: Array.isArray(body.addresses) ? body.addresses : current.addresses,
    activeCart:
      body.activeCart && Array.isArray(body.activeCart.items)
        ? {
            items: body.activeCart.items,
            updatedAt: typeof body.activeCart.updatedAt === "string" ? body.activeCart.updatedAt : new Date().toISOString(),
          }
        : body.activeCart === null
          ? null
          : current.activeCart ?? null,
    savedCarts: Array.isArray(body.savedCarts) ? body.savedCarts : current.savedCarts,
    favorites: Array.isArray(body.favorites) ? body.favorites.map((item) => String(item)) : current.favorites,
    lists: Array.isArray(body.lists) ? body.lists : current.lists,
    returns: Array.isArray(body.returns) ? body.returns : current.returns,
    tickets: Array.isArray(body.tickets) ? body.tickets : current.tickets,
    updated_at: new Date().toISOString(),
  };
  const index = db.customerProfiles.findIndex((entry) => entry.user_id === current.user_id);
  db.customerProfiles[index] = next;
  createAuditEvent(db, {
    eventType: "customer.profile_updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "web",
    previousValue: {
      fullName: current.fullName,
      phone: current.phone,
      customerType: current.customerType,
      preferredChannel: current.preferredChannel,
      allowPromotions: current.allowPromotions,
    },
    newValue: {
      fullName: next.fullName,
      phone: next.phone,
      customerType: next.customerType,
      preferredChannel: next.preferredChannel,
      allowPromotions: next.allowPromotions,
    },
    payload: { user_id: current.user_id },
    occurredAt: next.updated_at,
  });
  return next;
}

export function createCartAbandonmentLead(input: {
  db: DatabaseShape;
  items?: Array<{ name?: string; sku?: string; quantity?: number }>;
  totalEstimated?: number;
  pageOrigin?: string;
  correlationId: string;
}) {
  const { db, items, totalEstimated, pageOrigin, correlationId } = input;
  const now = new Date().toISOString();
  const lead: DbLead = {
    id: createId(),
    name: "Carrinho abandonado",
    email: null,
    phone: null,
    source: "web",
    channel: "checkout",
    product_interest: Array.isArray(items) && items.length > 0 ? items.map((item) => item.name || item.sku || "item").slice(0, 3).join(", ") : null,
    page_origin: pageOrigin || "/carrinho",
    stage: "new",
    responsible_id: null,
    responsible_name: null,
    linked_customer_id: null,
    linked_order_id: null,
    linked_quote_id: null,
    notes: `Carrinho abandonado. Total estimado: R$ ${Number(totalEstimated || 0).toFixed(2)}. Correlation: ${correlationId || "n/a"}`,
    created_at: now,
    updated_at: now,
  };
  db.leads.unshift(lead);
  createAuditEvent(db, {
    eventType: "lead.cart_abandonment_created",
    orderId: null,
    correlationId,
    actorId: null,
    actorName: null,
    sourceChannel: "web",
    payload: { lead_id: lead.id, total_estimated: Number(totalEstimated || 0), page_origin: lead.page_origin },
    occurredAt: now,
  });
  return lead;
}
