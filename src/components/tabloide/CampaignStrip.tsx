import { Megaphone, CalendarClock } from "lucide-react";
import type { Campaign } from "@/data/campaigns";
import { useSettings } from "@/context/SettingsContext";
import { resolvePrimaryCampaign } from "@/lib/public-campaign";

const toneClass: Record<string, string> = {
  action: "bg-action text-action-foreground",
  highlight: "bg-highlight text-highlight-foreground",
  brand: "bg-brand text-brand-foreground",
  dark: "bg-foreground text-background",
  whatsapp: "bg-whatsapp text-whatsapp-foreground",
};

function formatRange(start: string, end: string) {
  try {
    const s = new Date(start + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    const e = new Date(end + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    return `${s} – ${e}`;
  } catch {
    return "";
  }
}

export function CampaignStrip({ campaigns }: { campaigns?: Campaign[] | null }) {
  const { activeCampaign } = useSettings();
  const primaryCampaign = resolvePrimaryCampaign(campaigns);

  if (activeCampaign) {
    return (
      <div
        className={`${toneClass[activeCampaign.tone] ?? toneClass.highlight} text-[11px] font-bold uppercase tracking-[0.2em] sm:text-xs`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-center">
          <Megaphone className="size-3.5 shrink-0" />
          <span className="truncate">{activeCampaign.message}</span>
          <span className="inline-flex items-center gap-1 opacity-90">
            <CalendarClock className="size-3" />
            {formatRange(activeCampaign.startDate, activeCampaign.endDate)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-action text-action-foreground text-[11px] font-bold uppercase tracking-[0.2em] sm:text-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center">
        <Megaphone className="size-3.5 shrink-0" />
        <span className="truncate">{primaryCampaign.validity}</span>
      </div>
    </div>
  );
}
