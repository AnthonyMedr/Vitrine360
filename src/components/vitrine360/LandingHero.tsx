import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Zap } from "lucide-react";
import type { Campaign } from "@/data/campaigns";
import { useSettings } from "@/context/SettingsContext";
import { resolvePrimaryCampaign } from "@/lib/public-campaign";
import { buildGenericMessage, whatsappUrl } from "@/lib/whatsapp";

export function LandingHero({
  heroImageUrl,
  storeName,
  campaigns,
}: {
  heroImageUrl?: string | null;
  storeName?: string;
  campaigns?: Campaign[] | null;
}) {
  const { settings } = useSettings();
  const wa = whatsappUrl(buildGenericMessage(settings), settings.whatsappNumber);
  const campaign = resolvePrimaryCampaign(campaigns);

  return (
    <section className="relative overflow-hidden bg-brand text-brand-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.26),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(180,182,189,0.16),transparent_38%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-24">
        <div className="animate-reveal">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-foreground">
            <Zap className="size-3" /> Central Comercial Digital
          </span>
          <h1 className="mb-5 font-display text-5xl leading-[0.92] sm:text-6xl lg:text-8xl">
            Sua loja,{" "}
            <span className="inline-block rounded-2xl bg-action px-3 py-1 text-action-foreground shadow-[0_18px_40px_-18px_rgba(255,106,0,0.88)]">
              digital
            </span>
            , em qualquer tela.
          </h1>
          <p className="mb-8 max-w-xl text-base text-brand-foreground/78 sm:text-lg">
            Catalogo, vitrine, totem e campanhas promocionais com linguagem industrial premium para{" "}
            {storeName || settings.brand}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-2 rounded-xl bg-action px-6 py-3.5 font-bold text-action-foreground shadow-pop transition-transform hover:scale-[1.02]"
            >
              Explorar catalogo <ArrowRight className="size-4" />
            </Link>
            <Link
              to={campaign.ctaHref.startsWith("/campanha/") ? "/campanha/$slug" : "/ofertas"}
              params={
                campaign.ctaHref.startsWith("/campanha/")
                  ? { slug: campaign.ctaHref.replace("/campanha/", "") }
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-6 py-3.5 font-bold text-brand-foreground shadow-card transition-transform hover:scale-[1.02] hover:bg-white/10"
            >
              {campaign.ctaLabel}
            </Link>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-foreground/20 px-6 py-3.5 font-bold transition-colors hover:bg-brand-foreground/10"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </div>
        </div>

        <div className="relative animate-reveal [animation-delay:120ms]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 ring-1 ring-white/10 shadow-pop">
            <img
              src={heroImageUrl || campaign.image}
              alt={`Showroom ${storeName || settings.brand}`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-brand/54 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
