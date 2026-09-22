import { apiFetch } from "@/lib/api";

export function trackMarketingEvent(input: {
  event_type: string;
  campaign_id?: string | null;
  banner_id?: string | null;
  showcase_id?: string | null;
  product_id?: string | null;
  source_path?: string;
}) {
  return apiFetch("/api/public/marketing-events", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      source_path: input.source_path || window.location.pathname,
    }),
  }).catch(() => undefined);
}
