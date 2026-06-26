import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type Campaign } from "@/data/campaigns";

const EMPTY_CAMPAIGNS: Campaign[] = [];

export function CampaignsShowcase({ items = EMPTY_CAMPAIGNS }: { items?: Campaign[] }) {
  const published = items
    .filter((campaign) => campaign.status === "publicado" && campaign.showOnHome !== false)
    .slice(0, 4);
  return (
    <section className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
      <div className="mb-8">
        <span className="text-xs uppercase tracking-widest font-bold text-action">
          Campanhas no ar
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
          Landing pages promocionais
        </h2>
        <div className="h-1 w-12 bg-action mt-3" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {published.map((campaign) => (
          <Link
            key={campaign.slug}
            to="/campanha/$slug"
            params={{ slug: campaign.slug }}
            className="group relative overflow-hidden rounded-3xl border border-border bg-card hover:shadow-pop hover:-translate-y-0.5 transition-all"
          >
            <div className="aspect-[16/9] overflow-hidden">
              <img
                src={campaign.banner}
                alt={campaign.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-5">
              <span className="text-[11px] uppercase tracking-widest font-bold text-action">
                {campaign.period}
              </span>
              <h3 className="font-display text-xl font-extrabold tracking-tight mt-1">
                {campaign.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{campaign.tagline}</p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-action mt-3">
                Ver campanha{" "}
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
