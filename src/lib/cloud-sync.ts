import type { AppSettings } from "@/context/SettingsContext";
import type { Product } from "@/data/products";

const LEADS_QUEUE_KEY = "vitrine360.pending.leads";
const EVENTS_QUEUE_KEY = "vitrine360.pending.events";

function sessionId() {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem("vitrine360-sid");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("vitrine360-sid", id);
  }
  return id;
}

function readQueue(key: string) {
  if (typeof window === "undefined") return [] as Record<string, unknown>[];

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(key: string, items: Record<string, unknown>[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function appendLocalQueue(key: string, payload: Record<string, unknown>, limit: number) {
  const current = readQueue(key);
  current.push(payload);
  writeQueue(key, current.slice(limit * -1));
}

async function postBatch(url: string, items: Record<string, unknown>[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
    keepalive: true,
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar telemetria para ${url}.`);
  }
}

async function syncPayload(
  key: string,
  url: string,
  payload: Record<string, unknown>,
  limit: number,
) {
  const pending = readQueue(key);
  const batch = [...pending, payload].slice(limit * -1);

  try {
    await postBatch(url, batch);
    writeQueue(key, []);
  } catch {
    appendLocalQueue(key, payload, limit);
  }
}

export async function recordLead(input: {
  product?: Product | null;
  settings: AppSettings;
  source?: "whatsapp" | "form" | "qr" | "totem";
  message?: string;
  contactName?: string;
  contactPhone?: string;
}) {
  try {
    await syncPayload(
      LEADS_QUEUE_KEY,
      "/api/public/telemetry/leads",
      {
        product_id: input.product?.id ?? null,
        product_name: input.product?.name ?? null,
        category: input.product?.categoryName ?? null,
        source: input.source ?? "whatsapp",
        message: input.message?.slice(0, 2000) ?? null,
        contact_name: input.contactName ?? null,
        contact_phone: input.contactPhone ?? null,
        store_unit: input.settings.address?.slice(0, 200) ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
        created_at: new Date().toISOString(),
      },
      200,
    );
  } catch {
    /* ignore */
  }
}

export async function recordEvent(input: {
  type: string;
  productId?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await syncPayload(
      EVENTS_QUEUE_KEY,
      "/api/public/telemetry/events",
      {
        event_type: input.type.slice(0, 60),
        product_id: input.productId ?? null,
        category: input.category ?? null,
        metadata: input.metadata ?? null,
        session_id: sessionId(),
        created_at: new Date().toISOString(),
      },
      500,
    );
  } catch {
    /* ignore */
  }
}
