import { Link } from "react-router-dom";
import { usePublicMarketingState } from "@/hooks/useMarketing";
import { trackMarketingEvent } from "@/lib/marketingTracking";

export function CampaignTopBar() {
  const { data, isError } = usePublicMarketingState();
  const topBar = data?.top_bar;

  if (isError || !data?.site_experience.surface_controls.top_bar || !topBar?.text) return null;

  return (
    <div className="border-b border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-2 text-center text-sm font-semibold sm:flex-row sm:text-left">
        <span>{topBar.text}</span>
        {topBar.cta_url && (
          <Link
            className="rounded-md bg-white/15 px-3 py-1 text-xs uppercase tracking-wide hover:bg-white/25"
            to={topBar.cta_url}
            onClick={() => void trackMarketingEvent({ event_type: "campaign_topbar_click", campaign_id: topBar.campaign_id })}
          >
            {topBar.cta_label || "Ver campanha"}
          </Link>
        )}
      </div>
    </div>
  );
}
