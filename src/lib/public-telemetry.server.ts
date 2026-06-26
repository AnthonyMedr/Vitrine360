import { getDefaultStoreId } from "@/lib/admin-access";
import { databaseAdmin } from "@/integrations/postgres/client.server";

type JsonRecord = Record<string, unknown>;

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .slice(0, 20)
      .map(([key, item]) => [
        key.slice(0, 60),
        typeof item === "string" ? item.slice(0, 300) : item,
      ]),
  );
}

export function normalizeEventPayload(input: unknown) {
  const source = input && typeof input === "object" ? (input as JsonRecord) : {};

  return {
    event_type: cleanText(source.event_type, 60) ?? "unknown",
    product_id: cleanText(source.product_id, 120),
    category: cleanText(source.category, 120),
    metadata: cleanMetadata(source.metadata),
    session_id: cleanText(source.session_id, 120),
    created_at: cleanText(source.created_at, 40) ?? new Date().toISOString(),
  };
}

export function normalizeLeadPayload(input: unknown, userAgent?: string | null) {
  const source = input && typeof input === "object" ? (input as JsonRecord) : {};

  return {
    product_id: cleanText(source.product_id, 120),
    product_name: cleanText(source.product_name, 200),
    category: cleanText(source.category, 120),
    source: cleanText(source.source, 40) ?? "whatsapp",
    message: cleanText(source.message, 2000),
    contact_name: cleanText(source.contact_name, 160),
    contact_phone: cleanText(source.contact_phone, 60),
    store_unit: cleanText(source.store_unit, 200),
    user_agent: cleanText(source.user_agent, 500) ?? cleanText(userAgent, 500),
    created_at: cleanText(source.created_at, 40) ?? new Date().toISOString(),
  };
}

export async function persistAnalyticsEvents(items: unknown[]) {
  const storeId = await getDefaultStoreId();
  if (!storeId) throw new Error("Loja padrao nao encontrada.");

  const rows = items.slice(0, 100).map((item) => ({
    store_id: storeId,
    ...normalizeEventPayload(item),
  }));

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await databaseAdmin.from("analytics_events").insert(rows);
  if (error) throw new Error(error.message);

  return { inserted: rows.length };
}

export async function persistLeads(items: unknown[], userAgent?: string | null) {
  const storeId = await getDefaultStoreId();
  if (!storeId) throw new Error("Loja padrao nao encontrada.");

  const rows = items.slice(0, 100).map((item) => ({
    store_id: storeId,
    ...normalizeLeadPayload(item, userAgent),
  }));

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await databaseAdmin.from("leads").insert(rows);
  if (error) throw new Error(error.message);

  return { inserted: rows.length };
}
