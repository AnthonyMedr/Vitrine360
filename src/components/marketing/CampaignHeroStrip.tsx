import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePublicMarketingState } from "@/hooks/useMarketing";
import { trackMarketingEvent } from "@/lib/marketingTracking";

export function CampaignHeroStrip() {
  const { data, isLoading, isError } = usePublicMarketingState();
  const banner = data?.banners.find((item) => item.placement === "home_hero") ?? data?.banners[0];
  const campaign = data?.campaigns[0];
  const experienceHero = data?.site_experience.hero;
  const heroEnabled = data?.site_experience.surface_controls.hero ?? false;
  const bannerId = banner?.id ?? null;
  const campaignId = campaign?.id ?? null;
  const hasBanner = Boolean(banner);

  useEffect(() => {
    if (!bannerId && !campaignId) return;
    void trackMarketingEvent({
      event_type: hasBanner ? "banner_view" : "campaign_view",
      campaign_id: campaignId,
      banner_id: bannerId,
    });
  }, [bannerId, campaignId, hasBanner]);

  if (isLoading || isError || !heroEnabled || (!banner && !campaign && !experienceHero?.title)) return null;

  const image = experienceHero?.desktop_image || banner?.desktop_image || campaign?.banner_desktop;
  const title = experienceHero?.title || banner?.title || campaign?.headline || campaign?.name;
  const subtitle = experienceHero?.subtitle || banner?.subtitle || campaign?.subheadline;
  const ctaUrl = experienceHero?.cta_url || banner?.cta_url || campaign?.cta_url || "/produtos";
  const ctaLabel = experienceHero?.cta_label || banner?.cta_label || campaign?.cta_label || "Ver produtos";

  return (
    <section className="border-y bg-muted/35">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campanha ativa</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
          <Button
            asChild
            className="mt-4"
            onClick={() =>
              void trackMarketingEvent({
                event_type: banner ? "banner_click" : "campaign_view",
                campaign_id: campaign?.id ?? null,
                banner_id: banner?.id ?? null,
              })
            }
          >
            <Link to={ctaUrl}>{ctaLabel}</Link>
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          {image ? (
            <img className="h-44 w-full object-cover md:h-56" src={image} alt={banner?.alt_text || title || "Campanha GAMEL Metal"} loading="lazy" />
          ) : (
            <div className="flex h-44 items-center justify-center bg-primary/10 px-6 text-center font-semibold text-primary md:h-56">{title}</div>
          )}
        </div>
      </div>
    </section>
  );
}
