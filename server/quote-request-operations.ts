import { createAuditEvent } from "./order-domain";
import {
  createId,
  type DatabaseShape,
  type DbProduct,
  type DbQuote,
  type DbQuoteItem,
  type DbQuoteRequest,
  type DbQuoteRequestItem,
  type DbQuoteRequestNote,
  type DbQuoteRequestStatusHistory,
  type QuoteRequestStatus,
} from "./db";

export type { QuoteRequestStatus } from "./db";

export const quoteRequestStatuses: QuoteRequestStatus[] = ["new", "triage", "contacted", "waiting_customer", "negotiating", "converted", "lost", "archived"];

const quoteRequestTransitions: Record<QuoteRequestStatus, QuoteRequestStatus[]> = {
  new: ["triage", "contacted", "archived"],
  triage: ["contacted", "waiting_customer", "negotiating", "lost", "archived"],
  contacted: ["waiting_customer", "negotiating", "converted", "lost", "archived"],
  waiting_customer: ["contacted", "negotiating", "lost", "archived"],
  negotiating: ["contacted", "converted", "lost", "archived"],
  converted: ["archived"],
  lost: ["triage", "archived"],
  archived: ["triage"],
};

type QuoteRequestItemInput = {
  productId?: string;
  productSlug?: string;
  productVariantId?: string | null;
  quantity?: number;
  unit?: string | null;
  notes?: string | null;
  calculation?: Record<string, unknown> | null;
};

type QuoteRequestInput = {
  customer?: {
    name?: string;
    whatsapp?: string;
    email?: string | null;
    company?: string | null;
    cnpj?: string | null;
    segment?: string | null;
    city?: string;
    state?: string | null;
  };
  items?: QuoteRequestItemInput[];
  message?: string | null;
  preference?: "whatsapp" | "phone" | "email" | string;
  pageOrigin?: string;
  utm?: Record<string, string | null | undefined>;
  privacyPolicyVersion?: string | null;
  consent?: boolean;
  marketingConsent?: boolean;
  idempotencyKey?: string;
  legacy?: {
    name?: string;
    whatsapp?: string;
    email?: string;
    city?: string;
    product?: string;
    productSlug?: string;
    category?: string;
    quantity?: string;
    message?: string;
    preference?: string;
    pageOrigin?: string;
    utm?: Record<string, string | null | undefined>;
  };
};

function normalizeQuoteRequestStatus(value: unknown): QuoteRequestStatus {
  if (value === "qualified") return "negotiating";
  return quoteRequestStatuses.includes(value as QuoteRequestStatus) ? value as QuoteRequestStatus : "new";
}

function stripControlChars(value: string) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? " " : char;
  }).join("");
}

function sanitizeText(value: unknown, maxLength: number) {
  return stripControlChars(String(value ?? ""))
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeEmail(value: unknown) {
  return sanitizeText(value, 160).toLowerCase();
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeComparableSlug(value: string | null | undefined) {
  return slugify(String(value || "")).replace(/-/g, "");
}

function sanitizePageOrigin(value: unknown) {
  const text = sanitizeText(value, 300);
  if (!text) return "/orcamento";
  if (text.startsWith("/")) return text;
  try {
    const url = new URL(text);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/orcamento";
  }
}

function sanitizeUtm(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedKeys = ["source", "medium", "campaign", "term", "content"];
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, sanitizeText((value as Record<string, unknown>)[key], 120) || null] as const)
      .filter(([, entry]) => entry),
  ) as Record<string, string | null>;
}

export function hasUnsafeQuoteRequestPayload(value: unknown) {
  const text = JSON.stringify(value ?? "").toLowerCase();
  return /<\s*script|javascript:|data:text\/html|onerror\s*=|onload\s*=|\bunion\s+select\b|\bdrop\s+table\b/.test(text);
}

function parseQuantity(value: unknown) {
  if (typeof value === "number") return value;
  const match = String(value ?? "").replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 1;
}

function buildLegacyInput(body: Record<string, unknown>): QuoteRequestInput {
  return {
    customer: {
      name: sanitizeText(body.name, 120),
      whatsapp: cleanDigits(body.whatsapp),
      email: sanitizeText(body.email, 160),
      city: sanitizeText(body.city, 100),
      state: null,
    },
    items: [
      {
        productSlug: slugify(sanitizeText(body.productSlug, 180)),
        productId: slugify(sanitizeText(body.productSlug, 180)) || undefined,
        quantity: parseQuantity(body.quantity),
        unit: sanitizeText(body.quantity, 80) || null,
        notes: sanitizeText(body.category, 120) || null,
      },
    ],
    message: sanitizeText(body.message, 1000),
    preference: sanitizeText(body.preference || "whatsapp", 40),
    pageOrigin: sanitizePageOrigin(body.pageOrigin),
    utm: sanitizeUtm(body.utm),
    privacyPolicyVersion: null,
    consent: Boolean(body.consent),
    idempotencyKey: [
      "legacy",
      cleanDigits(body.whatsapp),
      sanitizePageOrigin(body.pageOrigin),
      slugify(sanitizeText(body.productSlug || body.product, 180)),
    ].join(":"),
    legacy: {
      product: sanitizeText(body.product, 180),
      productSlug: slugify(sanitizeText(body.productSlug, 180)),
      category: sanitizeText(body.category, 120),
      quantity: sanitizeText(body.quantity, 80),
    },
  };
}

export function normalizeQuoteRequestInput(body: Record<string, unknown>): QuoteRequestInput {
  if (body.customer && Array.isArray(body.items)) {
    const rawCustomer = body.customer as Record<string, unknown>;
    return {
      customer: {
        name: sanitizeText(rawCustomer.name, 120),
        whatsapp: cleanDigits(rawCustomer.whatsapp),
        email: normalizeEmail(rawCustomer.email),
        company: sanitizeText(rawCustomer.company, 160) || null,
        cnpj: cleanDigits(rawCustomer.cnpj) || null,
        segment: sanitizeText(rawCustomer.segment, 80) || null,
        city: sanitizeText(rawCustomer.city, 100),
        state: sanitizeText(rawCustomer.state, 2).toUpperCase() || null,
      },
      items: (body.items as Record<string, unknown>[]).slice(0, 30).map((item) => ({
        productId: sanitizeText(item.productId, 100),
        productVariantId: sanitizeText(item.productVariantId, 100) || null,
        quantity: parseQuantity(item.quantity),
        unit: sanitizeText(item.unit, 20) || null,
        notes: sanitizeText(item.notes, 500) || null,
        calculation: item.calculation && typeof item.calculation === "object" && !Array.isArray(item.calculation) ? item.calculation as Record<string, unknown> : null,
      })),
      message: sanitizeText(body.message, 1000) || null,
      preference: sanitizeText(body.preference || "whatsapp", 40),
      pageOrigin: sanitizePageOrigin(body.pageOrigin),
      utm: sanitizeUtm(body.utm),
      privacyPolicyVersion: sanitizeText(body.privacyPolicyVersion, 40) || null,
      consent: Boolean(body.consent),
      marketingConsent: Boolean(body.marketingConsent),
      idempotencyKey: sanitizeText(body.idempotencyKey, 100),
    };
  }

  return buildLegacyInput(body);
}

function findProduct(db: DatabaseShape, item: QuoteRequestItemInput, legacy?: QuoteRequestInput["legacy"]) {
  const id = sanitizeText(item.productId, 100);
  const slug = slugify(sanitizeText(item.productSlug || item.productId, 180));
  const legacyName = legacy?.product ?? "";
  return (
    db.products.find((product) => product.id === id && isProductRequestable(product)) ??
    db.products.find((product) => product.slug === slug && isProductRequestable(product)) ??
    db.products.find((product) => normalizeComparableSlug(product.slug) === normalizeComparableSlug(slug) && isProductRequestable(product)) ??
    db.products.find((product) => normalizeSearchText(product.name) === normalizeSearchText(legacyName) && isProductRequestable(product)) ??
    null
  );
}

function isProductRequestable(product: DbProduct) {
  return product.is_active && product.status_product !== "draft" && product.status_product !== "inactive";
}

function getVariant(product: DbProduct, variantId: string | null | undefined) {
  if (!variantId) return null;
  return (product.variations ?? []).find((variant) => variant.id === variantId) ?? null;
}

function isValidUnitForProduct(product: DbProduct, unit: string | null | undefined) {
  const cleanUnit = sanitizeText(unit, 20);
  if (!cleanUnit) return true;
  const allowed = [product.display_unit, product.unit_measure, product.unit, product.sales_unit].filter(Boolean).map((entry) => String(entry).toLowerCase());
  return allowed.length === 0 || allowed.includes(cleanUnit.toLowerCase());
}

function nextProtocol(db: DatabaseShape) {
  const max = db.quoteRequests.reduce((current, request) => {
    const match = request.protocol.match(/GML-(\d+)/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `GML-${String(max + 1).padStart(8, "0")}`;
}

export function createPublicQuoteRequest(db: DatabaseShape, input: QuoteRequestInput, correlationId: string) {
  const customer = input.customer ?? {};
  const name = sanitizeText(customer.name, 120);
  const phone = cleanDigits(customer.whatsapp);
  const email = normalizeEmail(customer.email);
  const city = sanitizeText(customer.city, 100);
  const state = sanitizeText(customer.state, 2).toUpperCase();
  const cnpj = cleanDigits(customer.cnpj);
  const preference = input.preference === "phone" || input.preference === "email" ? input.preference : "whatsapp";
  const idempotencyKey = sanitizeText(input.idempotencyKey, 100);

  if (name.length < 2) return { ok: false as const, status: 400, error: "Informe seu nome" };
  if (phone.length < 10 || phone.length > 13) return { ok: false as const, status: 400, error: "Informe um WhatsApp para atendimento" };
  if (email && !isValidEmail(email)) return { ok: false as const, status: 400, error: "Informe um e-mail valido" };
  if (city.length < 2) return { ok: false as const, status: 400, error: "Informe a cidade" };
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false as const, status: 400, error: "Informe a UF" };
  if (cnpj.length !== 14) return { ok: false as const, status: 400, error: "Informe o CNPJ da empresa" };
  if (!input.consent) return { ok: false as const, status: 400, error: "Confirme o consentimento para contato comercial" };
  if (!idempotencyKey || idempotencyKey.length < 8) return { ok: false as const, status: 400, error: "Informe uma chave de idempotencia" };
  if (!input.items?.length) return { ok: false as const, status: 400, error: "Informe ao menos um produto" };

  const duplicate = db.quoteRequests.find((request) => request.idempotency_key === idempotencyKey);
  if (duplicate) {
    const items = db.quoteRequestItems.filter((item) => item.quote_request_id === duplicate.id);
    return { ok: true as const, status: 200, duplicate: true, request: duplicate, items };
  }

  const now = new Date().toISOString();
  const request: DbQuoteRequest = {
    id: createId(),
    protocol: nextProtocol(db),
    access_token: createId(),
    status: "new",
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    company_name: sanitizeText(customer.company, 160) || null,
    cnpj,
    segment: sanitizeText(customer.segment, 80) || null,
    city,
    state,
    contact_preference: preference,
    message: sanitizeText(input.message, 1000) || null,
    page_origin: sanitizePageOrigin(input.pageOrigin),
    utm_json: sanitizeUtm(input.utm),
    responsible_user_id: null,
    responsible_name: null,
    next_action: "Realizar triagem e primeiro contato comercial.",
    next_action_due_at: null,
    lost_reason: null,
    archived_at: null,
    privacy_policy_version: sanitizeText(input.privacyPolicyVersion, 40) || null,
    consent_recorded_at: now,
    marketing_consent: Boolean(input.marketingConsent),
    marketing_consent_recorded_at: input.marketingConsent ? now : null,
    idempotency_key: idempotencyKey,
    correlation_id: correlationId,
    lead_id: null,
    company_id: null,
    commercial_quote_id: null,
    legacy_quote_id: null,
    converted_at: null,
    created_at: now,
    updated_at: now,
  };

  const items: DbQuoteRequestItem[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = findProduct(db, item, input.legacy);
    if (!product && !input.legacy?.product) return { ok: false as const, status: 400, error: "Um dos produtos nao esta disponivel para solicitacao" };
    const requestedVariantId = sanitizeText(item.productVariantId, 100);
    const variant = product ? getVariant(product, requestedVariantId) : null;
    if (product && requestedVariantId && !variant) return { ok: false as const, status: 400, error: "Uma das variacoes selecionadas nao esta disponivel" };
    const quantity = parseQuantity(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99999) return { ok: false as const, status: 400, error: "Informe uma quantidade valida" };
    if (product && !isValidUnitForProduct(product, item.unit)) return { ok: false as const, status: 400, error: "Unidade invalida para um dos produtos" };
    items.push({
      id: createId(),
      quote_request_id: request.id,
      product_id: product?.id ?? "sob-consulta",
      product_variant_id: variant?.id ?? null,
      product_slug_snapshot: product?.slug ?? input.legacy?.productSlug ?? "sob-consulta",
      product_name_snapshot: product?.name ?? input.legacy?.product ?? "Produto sob consulta",
      sku_snapshot: product?.sku ?? null,
      variant_label_snapshot: variant?.label ?? null,
      image_url_snapshot: product?.image_url ?? null,
      quantity,
      unit: product ? sanitizeText(product.display_unit || product.unit_measure || product.unit, 20) || null : sanitizeText(item.unit, 20) || null,
      notes: sanitizeText(item.notes, 500) || null,
      calculation_snapshot_json: item.calculation ?? null,
      sort_order: index,
      created_at: now,
    });
  }

  const history: DbQuoteRequestStatusHistory = {
    id: createId(),
    quote_request_id: request.id,
    from_status: null,
    to_status: "new",
    note: "Solicitacao publica recebida.",
    actor_id: null,
    actor_name: "public",
    created_at: now,
  };

  db.quoteRequests.unshift(request);
  db.quoteRequestItems.push(...items);
  db.quoteRequestStatusHistory.push(history);
  createAuditEvent(db, {
    eventType: "quote_request.submitted",
    correlationId,
    actorId: null,
    actorName: name,
    sourceChannel: "web",
    payload: {
      quote_request_id: request.id,
      protocol: request.protocol,
      item_count: items.length,
      origin: request.page_origin,
      city: request.city,
      state: request.state,
    },
    occurredAt: now,
  });

  return { ok: true as const, status: 201, duplicate: false, request, items };
}

export function serializeQuoteRequest(request: DbQuoteRequest, items: DbQuoteRequestItem[], duplicate = false) {
  const productSummary = items.map((item) => `${item.quantity} ${item.unit || "un"} - ${item.product_name_snapshot}`).join("; ");
  return {
    request: {
      id: request.id,
      protocol: request.protocol,
      status: request.status,
      createdAt: request.created_at,
      accessToken: request.access_token,
      marketingConsent: request.marketing_consent,
    },
    itemsAccepted: items.length,
    duplicate,
    whatsappHandoff: {
      enabled: true,
      message: [
        "Ola, vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.",
        `Protocolo: ${request.protocol}`,
        `Nome: ${request.customer_name}`,
        `Cidade: ${request.city}${request.state ? `/${request.state}` : ""}`,
        `Itens: ${productSummary}`,
        request.message ? `Mensagem: ${request.message}` : null,
      ].filter(Boolean).join("\n"),
    },
    lead_ref: request.protocol,
    quote: {
      id: request.id,
      quote_number: request.protocol,
      created_at: request.created_at,
    },
  };
}

function legacyQuoteToRequest(db: DatabaseShape, quote: DbQuote) {
  const existing = db.quoteRequests.find((request) => request.legacy_quote_id === quote.id || request.commercial_quote_id === quote.id);
  if (existing) return existing;
  const lead = db.leads.find((entry) => entry.linked_quote_id === quote.id) ?? null;
  const request: DbQuoteRequest = {
    id: `qr-${quote.id}`,
    protocol: quote.quote_number,
    access_token: `legacy-${quote.id}`,
    status: quote.status === "converted" ? "converted" : lead?.stage === "qualified" ? "negotiating" : lead?.stage === "contacted" ? "contacted" : lead?.stage === "lost" ? "lost" : "new",
    customer_name: quote.customer_name,
    customer_phone: quote.customer_phone ?? "",
    customer_email: quote.customer_email,
    company_name: null,
    cnpj: null,
    segment: null,
    city: extractNoteValue(quote.notes, "Cidade") || "",
    state: null,
    contact_preference: "whatsapp",
    message: extractNoteValue(quote.notes, "Mensagem") || quote.notes,
    page_origin: lead?.page_origin || "/orcamento",
    utm_json: {},
    responsible_user_id: lead?.responsible_id ?? quote.seller_id,
    responsible_name: lead?.responsible_name ?? quote.seller_name,
    next_action: null,
    next_action_due_at: null,
    lost_reason: lead?.stage === "lost" ? lead.notes : null,
    archived_at: null,
    privacy_policy_version: null,
    consent_recorded_at: quote.created_at,
    marketing_consent: false,
    marketing_consent_recorded_at: null,
    idempotency_key: `legacy:${quote.id}`,
    correlation_id: quote.correlation_id,
    lead_id: lead?.id ?? null,
    company_id: null,
    commercial_quote_id: null,
    legacy_quote_id: quote.id,
    converted_at: quote.converted_order_id ? quote.updated_at : null,
    created_at: quote.created_at,
    updated_at: quote.updated_at,
  };
  return request;
}

function legacyQuoteItemsToRequestItems(quote: DbQuote, items: DbQuoteItem[]) {
  return items.map((item, index): DbQuoteRequestItem => ({
    id: `qri-${item.id}`,
    quote_request_id: `qr-${quote.id}`,
    product_id: item.product_id,
    product_variant_id: null,
    product_slug_snapshot: item.product_id,
    product_name_snapshot: item.product_name,
    sku_snapshot: null,
    variant_label_snapshot: null,
    image_url_snapshot: null,
    quantity: item.quantity,
    unit: null,
    notes: null,
    calculation_snapshot_json: null,
    sort_order: index,
    created_at: quote.created_at,
  }));
}

function extractNoteValue(notes: string | null, key: string) {
  const line = String(notes || "").split("\n").find((entry) => entry.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line?.split(":").slice(1).join(":").trim() || null;
}

export function listQuoteRequestAdminRows(db: DatabaseShape) {
  const modern = db.quoteRequests.map((request) => ({
    request,
    quote: {
      id: request.id,
      quote_number: request.protocol,
      status: request.status,
      customer_name: request.customer_name,
      customer_phone: request.customer_phone,
      customer_email: request.customer_email,
      notes: [
        request.message ? `Mensagem: ${request.message}` : null,
        request.city ? `Cidade: ${request.city}` : null,
        request.state ? `UF: ${request.state}` : null,
        request.contact_preference ? `Preferencia: ${request.contact_preference}` : null,
      ].filter(Boolean).join("\n") || null,
      total: 0,
      created_at: request.created_at,
    },
    lead: request.lead_id ? db.leads.find((lead) => lead.id === request.lead_id) ?? null : null,
    items: db.quoteRequestItems
      .filter((item) => item.quote_request_id === request.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({ ...item, product_name: item.product_name_snapshot })),
    history: db.quoteRequestStatusHistory.filter((entry) => entry.quote_request_id === request.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    notes: db.quoteRequestNotes.filter((note) => note.quote_request_id === request.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    source: "quote_request_v2" as const,
  }));

  const modernLegacyIds = new Set(db.quoteRequests.map((request) => request.legacy_quote_id).filter(Boolean));
  const legacy = db.quotes
    .filter((quote) => quote.correlation_id.startsWith("gamel-web-") && !modernLegacyIds.has(quote.id))
    .map((quote) => {
      const request = legacyQuoteToRequest(db, quote);
      return {
        request,
        quote,
        lead: db.leads.find((lead) => lead.linked_quote_id === quote.id) ?? null,
        items: legacyQuoteItemsToRequestItems(quote, db.quoteItems.filter((item) => item.quote_id === quote.id)),
        history: [],
        notes: [],
        source: "legacy_quote" as const,
      };
    });

  return [...modern, ...legacy].sort((a, b) => b.request.created_at.localeCompare(a.request.created_at));
}

export function getQuoteRequestAdminDetail(db: DatabaseShape, id: string) {
  return listQuoteRequestAdminRows(db).find((row) => row.request.id === id || row.request.protocol === id || row.quote.id === id) ?? null;
}

export function updateQuoteRequestStatus(db: DatabaseShape, id: string, nextStatus: QuoteRequestStatus, actor: { actorId: string | null; actorName: string }, note?: string | null) {
  nextStatus = normalizeQuoteRequestStatus(nextStatus);
  if (!quoteRequestStatuses.includes(nextStatus)) return { ok: false as const, status: 400, error: "Status invalido" };
  const request = db.quoteRequests.find((entry) => entry.id === id);
  if (!request) return { ok: false as const, status: 404, error: "Solicitacao nao encontrada" };
  request.status = normalizeQuoteRequestStatus(request.status);
  if (!quoteRequestTransitions[request.status].includes(nextStatus) && request.status !== nextStatus) {
    return { ok: false as const, status: 400, error: "Transicao de status nao permitida" };
  }
  const now = new Date().toISOString();
  const previous = request.status;
  request.status = nextStatus;
  request.updated_at = now;
  if (nextStatus === "converted" && !request.converted_at) request.converted_at = now;
  if (nextStatus === "lost") request.lost_reason = sanitizeText(note, 500) || request.lost_reason;
  if (nextStatus === "archived" && !request.archived_at) request.archived_at = now;
  db.quoteRequestStatusHistory.push({
    id: createId(),
    quote_request_id: request.id,
    from_status: previous,
    to_status: nextStatus,
    note: sanitizeText(note, 500) || null,
    actor_id: actor.actorId,
    actor_name: actor.actorName,
    created_at: now,
  });
  return { ok: true as const, status: 200, request };
}

export function updateQuoteRequestNextAction(
  db: DatabaseShape,
  id: string,
  input: { nextAction?: string | null; dueAt?: string | null },
  actor: { actorId: string | null; actorName: string },
) {
  const request = db.quoteRequests.find((entry) => entry.id === id);
  if (!request) return { ok: false as const, status: 404, error: "Solicitacao nao encontrada" };
  const previousAction = request.next_action;
  const previousDue = request.next_action_due_at;
  const nextAction = sanitizeText(input.nextAction, 240);
  const dueAt = sanitizeText(input.dueAt, 30);
  if (!nextAction) return { ok: false as const, status: 400, error: "Informe a proxima acao" };
  if (dueAt && Number.isNaN(Date.parse(dueAt))) return { ok: false as const, status: 400, error: "Data da proxima acao invalida" };
  const now = new Date().toISOString();
  request.next_action = nextAction;
  request.next_action_due_at = dueAt || null;
  request.updated_at = now;
  db.quoteRequestStatusHistory.push({
    id: createId(),
    quote_request_id: request.id,
    from_status: request.status,
    to_status: request.status,
    note: `Proxima acao atualizada: ${previousAction || "-"}${previousDue ? ` (${previousDue})` : ""} -> ${request.next_action}${request.next_action_due_at ? ` (${request.next_action_due_at})` : ""}.`,
    actor_id: actor.actorId,
    actor_name: actor.actorName,
    created_at: now,
  });
  return { ok: true as const, status: 200, request };
}

export function assignQuoteRequestResponsible(db: DatabaseShape, id: string, responsible: { userId?: string | null; name?: string | null }, actor: { actorId: string | null; actorName: string }) {
  const request = db.quoteRequests.find((entry) => entry.id === id);
  if (!request) return { ok: false as const, status: 404, error: "Solicitacao nao encontrada" };
  const now = new Date().toISOString();
  request.responsible_user_id = sanitizeText(responsible.userId, 120) || null;
  request.responsible_name = sanitizeText(responsible.name, 120) || null;
  request.updated_at = now;
  db.quoteRequestStatusHistory.push({
    id: createId(),
    quote_request_id: request.id,
    from_status: request.status,
    to_status: request.status,
    note: `Responsavel atualizado para ${request.responsible_name || "sem responsavel"}.`,
    actor_id: actor.actorId,
    actor_name: actor.actorName,
    created_at: now,
  });
  return { ok: true as const, status: 200, request };
}

export function createQuoteRequestNote(db: DatabaseShape, id: string, note: string, actor: { actorId: string | null; actorName: string }) {
  const request = db.quoteRequests.find((entry) => entry.id === id);
  if (!request) return { ok: false as const, status: 404, error: "Solicitacao nao encontrada" };
  const cleanNote = sanitizeText(note, 1000);
  if (!cleanNote) return { ok: false as const, status: 400, error: "Informe uma nota" };
  const record: DbQuoteRequestNote = {
    id: createId(),
    quote_request_id: request.id,
    note: cleanNote,
    actor_id: actor.actorId,
    actor_name: actor.actorName,
    created_at: new Date().toISOString(),
  };
  db.quoteRequestNotes.unshift(record);
  request.updated_at = record.created_at;
  return { ok: true as const, status: 201, note: record };
}
