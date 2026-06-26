import { ArrowRight, Calendar, MessageCircle } from "lucide-react";
import type { Campaign } from "@/data/campaigns";
import { useSettings, whatsappLink } from "@/context/SettingsContext";
import { resolvePrimaryCampaign } from "@/lib/public-campaign";

export function HeroCampaign({ campaigns }: { campaigns?: Campaign[] | null }) {
  const { settings } = useSettings();
  const campaign = resolvePrimaryCampaign(campaigns);

  return (
    <section className="relative overflow-hidden bg-brand text-brand-foreground">
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className="animate-reveal">
          <span className="mb-6 inline-flex items-center gap-2 rounded bg-highlight px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-highlight-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-action" />
            {campaign.badge}
          </span>

          <h1 className="mb-5 text-balance font-display text-4xl font-extrabold leading-[0.92] tracking-tighter sm:text-5xl lg:text-7xl">
            Reforme com <span className="text-highlight">qualidade.</span>
          </h1>

          <p className="mb-8 max-w-lg text-base text-brand-foreground/80 sm:text-lg">
            {campaign.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={campaign.ctaHref}
              className="inline-flex items-center gap-2 rounded-xl bg-action px-6 py-3.5 font-bold text-action-foreground shadow-pop transition-transform hover:scale-[1.02]"
            >
              {campaign.ctaLabel}
              <ArrowRight className="size-4" />
            </a>

            <a
              href={whatsappLink(
                `Ola! Vi o Tabloide Digital do ${settings.brand} e gostaria de fazer um orcamento.`,
                settings.whatsappNumber,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-foreground/30 px-6 py-3.5 font-bold transition-colors hover:bg-brand-foreground/10"
            >
              <MessageCircle className="size-4" /> Pedir orcamento
            </a>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 text-xs text-brand-foreground/70">
            <Calendar className="size-3.5" />
            <span className="font-semibold uppercase tracking-wider">{campaign.validity}</span>
          </div>
        </div>

        <div className="relative animate-reveal [animation-delay:120ms]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-pop ring-1 ring-brand-foreground/10">
            <img
              src={campaign.image}
              alt={`Showroom de acabamentos ${settings.brand}`}
              width={1600}
              height={1200}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-brand/40 to-transparent" />
          </div>

          <div className="absolute -right-4 -top-4 flex size-28 rotate-[8deg] flex-col items-center justify-center rounded-full bg-action text-action-foreground shadow-pop ring-4 ring-background sm:-right-6 sm:-top-6 sm:size-36">
            <span className="text-[10px] font-bold uppercase">Campanha</span>
            <span className="font-display text-3xl font-black leading-none sm:text-4xl">do</span>
            <span className="font-display text-xl font-extrabold uppercase sm:text-2xl">
              Momento
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
