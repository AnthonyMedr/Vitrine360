import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calendar, MessageCircle } from "lucide-react";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { ProductModal } from "@/components/tabloide/ProductModal";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { type Product } from "@/data/products";
import { buildGenericMessage, whatsappUrl } from "@/lib/whatsapp";
import { getPublicCampaign, getPublicStorefront } from "@/lib/commercial.functions";
import {
  buildBreadcrumbJsonLd,
  buildCampaignJsonLd,
  buildJsonLdScripts,
} from "@/lib/seo-structured-data";

const accentClass: Record<string, string> = {
  action: "bg-action text-action-foreground",
  highlight: "bg-highlight text-highlight-foreground",
  brand: "bg-brand text-brand-foreground",
  dark: "bg-foreground text-background",
};

export const Route = createFileRoute("/campanha/$slug")({
  loader: async ({ params }) => ({
    storefront: await getPublicStorefront({}),
    campaign: await getPublicCampaign({ data: { slug: params.slug } }),
  }),
  head: ({ params, loaderData }) => ({
    meta: [
      {
        title: loaderData?.campaign
          ? `${loaderData.campaign.name} | ${brandConfig.productName}`
          : "Campanha | Vitrine360 - Central Comercial Digital",
      },
      {
        name: "description",
        content: loaderData?.campaign?.description || "Campanha promocional no Vitrine360.",
      },
      {
        property: "og:title",
        content: loaderData?.campaign?.name || "Campanha | Vitrine360",
      },
      {
        property: "og:description",
        content: loaderData?.campaign?.description || "Campanha promocional no Vitrine360.",
      },
      { property: "og:url", content: absoluteUrl(`/campanha/${params.slug}`) },
      ...(loaderData?.campaign?.banner
        ? [{ property: "og:image", content: loaderData.campaign.banner }]
        : []),
    ],
    links: [{ rel: "canonical", href: absoluteUrl(`/campanha/${params.slug}`) }],
    scripts: buildJsonLdScripts([
      buildBreadcrumbJsonLd([
        { name: "Inicio", path: "/" },
        { name: "Ofertas", path: "/ofertas" },
        {
          name: loaderData?.campaign?.name || "Campanha",
          path: `/campanha/${params.slug}`,
        },
      ]),
      loaderData?.campaign
        ? buildCampaignJsonLd({
            slug: loaderData.campaign.slug,
            name: loaderData.campaign.name,
            description: loaderData.campaign.description,
            banner: loaderData.campaign.banner,
            period: loaderData.campaign.period,
            path: `/campanha/${params.slug}`,
          })
        : null,
    ]),
  }),
  component: CampanhaPage,
});

function CampanhaPage() {
  const initialData = Route.useLoaderData();
  const slug = Route.useParams().slug;
  const { settings } = useSettings();
  const storefrontFn = useServerFn(getPublicStorefront);
  const campaignFn = useServerFn(getPublicCampaign);
  const [open, setOpen] = useState<Product | null>(null);

  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialData.storefront,
  });
  const campaignQuery = useQuery({
    queryKey: ["public-campaign", slug],
    queryFn: () => campaignFn({ data: { slug } }),
    initialData: initialData.campaign,
  });

  const campaign = campaignQuery.data;

  if (!campaignQuery.isLoading && !campaign) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Campanha nao encontrada</h1>
          <p className="mt-2 text-muted-foreground">Talvez ela ja tenha encerrado.</p>
          <Link to="/" className="mt-6 inline-block font-bold text-action">
            Ver campanhas ativas
          </Link>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const items = (storefrontQuery.data?.products ?? []).filter((product) =>
    campaign.productIds.includes(product.id),
  );
  const wa = whatsappUrl(buildGenericMessage(settings), settings.whatsappNumber);
  const accent = accentClass[campaign.accent ?? "action"];
  const other = (storefrontQuery.data?.campaigns ?? [])
    .filter((item) => item.slug !== campaign.slug && item.status === "publicado")
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      <GlobalHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={campaign.banner} alt={campaign.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/80 to-foreground/30" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-16 text-background sm:py-24">
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-background/70 hover:text-highlight"
            >
              <ArrowLeft className="size-3" /> Inicio
            </Link>
            <span
              className={`mb-5 inline-block rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${accent}`}
            >
              Campanha
            </span>
            <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[0.95] tracking-tighter sm:text-6xl">
              {campaign.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-background/80 sm:text-xl">
              {campaign.tagline}
            </p>
            <p className="mt-4 max-w-2xl text-background/70">{campaign.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-action px-6 py-3.5 font-bold text-action-foreground shadow-pop transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="size-4" /> Pedir orcamento
              </a>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-background/70">
                <Calendar className="size-3.5" /> {campaign.period}
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <h2 className="mb-6 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Produtos da campanha
          </h2>
          {items.length === 0 ? (
            <p className="text-muted-foreground">Em breve, novos produtos.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpen} />
              ))}
            </div>
          )}
        </section>

        {other.length > 0 && (
          <section className="mx-auto max-w-7xl border-t border-border px-4 py-12">
            <h2 className="mb-5 font-display text-xl font-extrabold tracking-tight">
              Outras campanhas
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {other.map((item) => (
                <Link
                  key={item.slug}
                  to="/campanha/$slug"
                  params={{ slug: item.slug }}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-card"
                >
                  <img
                    src={item.banner}
                    alt={item.name}
                    className="aspect-[16/9] w-full object-cover"
                  />
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-action">
                      {item.period}
                    </p>
                    <p className="mt-1 font-display text-base font-extrabold">{item.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
    </div>
  );
}
