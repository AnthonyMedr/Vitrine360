import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { QRCode } from "@/components/tabloide/QRCode";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { brandConfig } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { buildProductMessage, whatsappUrl } from "@/lib/whatsapp";
import { getPublicStorefront } from "@/lib/commercial.functions";

export const Route = createFileRoute("/vitrine")({
  loader: () => getPublicStorefront({}),
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Vitrine Digital` },
      {
        name: "description",
        content:
          "Apresentacao automatica do Vitrine360 para TVs, monitores corporativos e exibicao comercial assistida.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VitrinePage,
});

type Slide =
  | { kind: "campanha"; id: string; title: string; subtitle: string; image: string }
  | { kind: "produto"; id: string; title: string; subtitle: string; image: string; wa: string };

function VitrinePage() {
  const initialStorefront = Route.useLoaderData();
  const { settings } = useSettings();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const [index, setIndex] = useState(0);
  const vitrineSettings = storefrontQuery.data?.vitrine;

  const slides: Slide[] = useMemo(() => {
    const campaigns = storefrontQuery.data?.campaigns ?? [];
    const products = storefrontQuery.data?.products ?? [];
    const banners = storefrontQuery.data?.banners ?? [];
    const selectedCampaigns = vitrineSettings?.campaignSlugs?.length
      ? campaigns.filter((campaign) => vitrineSettings.campaignSlugs.includes(campaign.slug))
      : campaigns.filter((campaign) => campaign.showOnVitrine ?? true);
    const selectedProducts = vitrineSettings?.productSlugs?.length
      ? products.filter((product) => vitrineSettings.productSlugs.includes(product.id))
      : products.filter((product) => product.featured);
    const selectedBanners = vitrineSettings?.bannerSlugs?.length
      ? banners.filter((banner) => vitrineSettings.bannerSlugs.includes(banner.slug))
      : banners.filter((banner) => banner.showOnVitrine);
    const fromCampaigns: Slide[] = selectedCampaigns
      .filter(
        (campaign) => campaign.status === "publicado" && (vitrineSettings?.showCampaigns ?? true),
      )
      .map((campaign) => ({
        kind: "campanha",
        id: campaign.slug,
        title: campaign.name,
        subtitle: campaign.tagline,
        image: campaign.banner,
      }));
    const fromProducts: Slide[] = selectedProducts
      .filter((product) => vitrineSettings?.showFeaturedProducts ?? true)
      .map((product) => ({
        kind: "produto",
        id: product.id,
        title: product.name,
        subtitle: product.description,
        image: product.image,
        wa: whatsappUrl(buildProductMessage(product, settings), settings.whatsappNumber),
      }));
    const fromBanners: Slide[] = selectedBanners.map((banner) => ({
      kind: "campanha",
      id: `banner-${banner.slug}`,
      title: banner.title,
      subtitle: banner.subtitle || banner.description,
      image: banner.image,
    }));

    switch (vitrineSettings?.layoutMode) {
      case "campanhas":
        return [...fromBanners, ...fromCampaigns];
      case "produtos":
        return fromProducts;
      case "misto":
        return [...fromBanners, ...fromCampaigns, ...fromProducts];
      default:
        return [...fromCampaigns, ...fromProducts, ...fromBanners];
    }
  }, [settings, storefrontQuery.data, vitrineSettings]);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = window.setInterval(
      () => {
        setIndex((current) => (current + 1) % slides.length);
      },
      (vitrineSettings?.slideDurationSeconds ?? 8) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length, vitrineSettings?.slideDurationSeconds]);

  if (vitrineSettings?.status === "pausado") {
    return (
      <div className="grid min-h-screen place-items-center bg-foreground px-6 text-center text-background">
        <StorefrontSettingsSync storefront={storefrontQuery.data} />
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Vitrine pausada</h1>
          <p className="mt-3 text-background/70">
            A exibicao da vitrine foi pausada no painel administrativo.
          </p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-foreground text-background">
        <StorefrontSettingsSync storefront={storefrontQuery.data} />
        <p>Nenhum slide configurado.</p>
      </div>
    );
  }

  const slide = slides[index];

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-background text-foreground ${
        vitrineSettings?.orientation === "retrato" ? "portrait" : ""
      }`}
    >
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      <Link
        to="/"
        className="absolute right-4 top-4 z-50 grid size-12 place-items-center border border-white/10 bg-black/55 text-white backdrop-blur hover:bg-black/70"
        aria-label="Sair da vitrine"
      >
        <X className="size-6" />
      </Link>

      <div key={`${slide.kind}-${slide.id}`} className="absolute inset-0 animate-reveal">
        <img
          src={
            slide.image ||
            vitrineSettings?.heroMediaUrl ||
            storefrontQuery.data?.store.heroBannerUrl ||
            ""
          }
          alt={slide.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/74 to-black/18" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.08)_44%,rgba(255,106,0,0.5)_44.5%,rgba(255,106,0,0.18)_47%,transparent_47.5%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(102,102,102,0.22),transparent_34%)]" />

        <div className="relative flex h-full min-h-0 flex-col justify-between p-6 lg:p-10 xl:p-12">
          <div className="flex items-start justify-between gap-4">
            <div className="inline-flex items-center gap-3 border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
              <div className="border border-white/10 bg-white/5 p-2">
                <StoreLogo
                  brand={settings.brand}
                  logoUrl={settings.logoUrl}
                  className="size-12 rounded-lg"
                  imageClassName="size-12"
                  fallbackClassName="size-12 bg-action/15 text-action"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                  Vitrine Digital
                </p>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
                  {settings.brand}
                </h1>
              </div>
            </div>
            <div className="hidden border border-white/10 bg-black/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white/55 md:block">
              Identidade Gamel
            </div>
          </div>

          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="max-w-5xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.84),rgba(35,39,43,0.82))] p-6 shadow-pop backdrop-blur-md lg:p-8">
              <span className="mb-4 inline-block bg-action px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-action-foreground">
                {slide.kind === "campanha" ? "Campanha" : "Em destaque"}
              </span>
              <h2 className="max-w-4xl text-balance font-display text-4xl font-extrabold leading-[0.92] tracking-tighter text-white sm:text-6xl lg:text-7xl xl:text-[6.5rem]">
                {slide.title}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/78 sm:text-lg lg:text-xl">
                {slide.subtitle}
              </p>
            </div>
            {slide.kind === "produto" && (vitrineSettings?.showQrCodes ?? true) && (
              <div className="shrink-0 self-end border border-white/10 bg-white p-4 text-foreground shadow-pop">
                <QRCode data={slide.wa} size={128} label="Falar no WhatsApp" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border border-white/10 bg-black/46 px-4 py-3 backdrop-blur-md">
            {slides.map((_, currentIndex) => (
              <span
                key={currentIndex}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === index ? "w-12 bg-action" : "w-2 bg-white/25"
                }`}
              />
            ))}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.22em] text-white/55 sm:text-xs">
              {settings.brand} | Central Comercial Digital
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
