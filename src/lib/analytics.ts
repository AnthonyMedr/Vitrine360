import type { AppSettings } from "@/context/SettingsContext";
import type { Product } from "@/data/products";
import { recordEvent, recordLead } from "@/lib/cloud-sync";
import { buildProductMessage } from "@/lib/whatsapp";

export type AnalyticsEventType =
  | "product_view"
  | "product_whatsapp"
  | "product_qr"
  | "environment_view"
  | "campaign_cta"
  | "category_filter"
  | "search"
  | "ai_recommend"
  | "room_simulator";

export type AnalyticsEvent = {
  id: string;
  type: AnalyticsEventType;
  ts: number;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
  label?: string;
};

export const ANALYTICS_STORAGE_KEY = "vitrine360-analytics-v2";
export const ANALYTICS_UPDATE_EVENT = "vitrine360-analytics-update";

const MAX_EVENTS = 2000;

function read(): AnalyticsEvent[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);

    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: AnalyticsEvent[]) {
  if (typeof localStorage === "undefined") return;

  try {
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(ANALYTICS_UPDATE_EVENT));
  } catch {
    // noop
  }
}

export function trackEvent(type: AnalyticsEventType, data: Partial<AnalyticsEvent> = {}) {
  const event: AnalyticsEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    ts: Date.now(),
    ...data,
  };

  const events = read();
  events.push(event);
  write(events);

  void recordEvent({
    type,
    productId: data.productId,
    category: data.categoryName ?? data.categoryId,
    metadata: { label: data.label, productName: data.productName },
  });
}

export function trackWhatsApp(product: Product, settings: AppSettings) {
  trackEvent("product_whatsapp", {
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
  });

  void recordLead({
    product,
    settings,
    source: "whatsapp",
    message: buildProductMessage(product, settings),
  });
}

export function getEvents(): AnalyticsEvent[] {
  return read();
}

export function clearEvents() {
  write([]);
}

export type AnalyticsSummary = {
  total: number;
  byType: Record<AnalyticsEventType, number>;
  topProducts: {
    id: string;
    name: string;
    views: number;
    whatsapp: number;
    qr: number;
    score: number;
  }[];
  topCategories: { id: string; name: string; count: number }[];
  last7Days: { day: string; count: number }[];
  conversionRate: number;
};

export function summarize(events: AnalyticsEvent[]): AnalyticsSummary {
  const byType = {
    product_view: 0,
    product_whatsapp: 0,
    product_qr: 0,
    environment_view: 0,
    campaign_cta: 0,
    category_filter: 0,
    search: 0,
    ai_recommend: 0,
    room_simulator: 0,
  } as Record<AnalyticsEventType, number>;

  const productsMap = new Map<
    string,
    { id: string; name: string; views: number; whatsapp: number; qr: number }
  >();
  const categoriesMap = new Map<string, { id: string; name: string; count: number }>();
  const days = new Map<string, number>();
  const now = new Date();

  for (let index = 6; index >= 0; index--) {
    const day = new Date(now);
    day.setDate(day.getDate() - index);
    days.set(day.toISOString().slice(0, 10), 0);
  }

  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;

    if (event.productId) {
      const product = productsMap.get(event.productId) ?? {
        id: event.productId,
        name: event.productName ?? event.productId,
        views: 0,
        whatsapp: 0,
        qr: 0,
      };

      if (event.type === "product_view") product.views++;
      if (event.type === "product_whatsapp") product.whatsapp++;
      if (event.type === "product_qr") product.qr++;

      productsMap.set(event.productId, product);
    }

    if (event.categoryId && event.type === "category_filter") {
      const category = categoriesMap.get(event.categoryId) ?? {
        id: event.categoryId,
        name: event.categoryName ?? event.categoryId,
        count: 0,
      };

      category.count++;
      categoriesMap.set(event.categoryId, category);
    }

    const dayKey = new Date(event.ts).toISOString().slice(0, 10);
    if (days.has(dayKey)) {
      days.set(dayKey, (days.get(dayKey) ?? 0) + 1);
    }
  }

  const topProducts = Array.from(productsMap.values())
    .map((product) => ({
      ...product,
      score: product.views + product.whatsapp * 3 + product.qr * 2,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const topCategories = Array.from(categoriesMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const last7Days = Array.from(days.entries()).map(([day, count]) => ({ day, count }));
  const conversionRate =
    byType.product_view > 0 ? byType.product_whatsapp / byType.product_view : 0;

  return {
    total: events.length,
    byType,
    topProducts,
    topCategories,
    last7Days,
    conversionRate,
  };
}

export function exportCsv(events: AnalyticsEvent[]): string {
  const header = "id,type,ts,iso,productId,productName,categoryId,categoryName,label";
  const rows = events.map((event) =>
    [
      event.id,
      event.type,
      event.ts,
      new Date(event.ts).toISOString(),
      event.productId ?? "",
      JSON.stringify(event.productName ?? ""),
      event.categoryId ?? "",
      JSON.stringify(event.categoryName ?? ""),
      JSON.stringify(event.label ?? ""),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}
