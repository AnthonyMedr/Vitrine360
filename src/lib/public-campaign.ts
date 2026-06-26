import { campaign as fallbackCampaign } from "@/data/campaign";
import { brandConfig } from "@/config/brand";
import type { Campaign } from "@/data/campaigns";

export type PublicCampaignHero = {
  badge: string;
  title: string;
  subtitle: string;
  validity: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
};

export function resolvePrimaryCampaign(
  campaigns: Campaign[] | null | undefined,
): PublicCampaignHero {
  const activeCampaign =
    campaigns?.find(
      (campaign) => campaign.status === "publicado" && campaign.showOnHome !== false,
    ) ??
    campaigns?.find((campaign) => campaign.status === "publicado") ??
    null;

  if (!activeCampaign) {
    return {
      badge: "Central Comercial Digital",
      title: `Ofertas e campanhas de ${brandConfig.defaultStoreName}`,
      subtitle: brandConfig.defaultSeoDescription,
      validity: "Consulte a vigencia comercial diretamente com a loja.",
      ctaLabel: fallbackCampaign.cta.label,
      ctaHref: fallbackCampaign.cta.href,
      image: fallbackCampaign.heroImage,
    };
  }

  return {
    badge: `Campanha ativa | ${activeCampaign.name}`,
    title: activeCampaign.name,
    subtitle: activeCampaign.description || activeCampaign.tagline,
    validity: activeCampaign.period,
    ctaLabel: "Ver campanha",
    ctaHref: `/campanha/${activeCampaign.slug}`,
    image: activeCampaign.banner || fallbackCampaign.heroImage,
  };
}
