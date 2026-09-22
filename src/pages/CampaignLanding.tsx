import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { trackMarketingEvent } from "@/lib/marketingTracking";
import type { MarketingBanner, MarketingCampaign, MarketingTheme, ProductShowcase } from "@/hooks/useMarketing";

type CampaignPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  hero_desktop_image: string | null;
  hero_mobile_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  campaign: MarketingCampaign | null;
  theme: MarketingTheme | null;
  banners: MarketingBanner[];
  showcases: ProductShowcase[];
};

function upsertMeta(name: string, content: string) {
  let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

const CampaignLanding = () => {
  const { slug } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaign-landing", slug],
    queryFn: () => apiFetch<CampaignPage>(`/api/public/campaigns/${slug}`),
    enabled: Boolean(slug),
    retry: 0,
  });

  useEffect(() => {
    if (!data) return;
    document.title = data.seo_title || `${data.title} | GAMEL`;
    if (data.seo_description) upsertMeta("description", data.seo_description);
    void trackMarketingEvent({
      event_type: "campaign_view",
      campaign_id: data.campaign?.id ?? null,
      source_path: window.location.pathname,
    });
  }, [data]);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Badge variant="outline">Campanha indisponivel</Badge>
          <h1 className="mt-4 font-display text-3xl font-bold">Está campanha não está ativa no momento</h1>
          <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : "Você ainda pode consultar nossos produtos e pedir orçamento pelo WhatsApp."}</p>
          <Button asChild className="mt-6">
            <Link to="/produtos">Ver produtos</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const heroImage = data.hero_desktop_image || data.campaign?.banner_desktop || data.banners[0]?.desktop_image;
  const whatsappMessage = data.campaign?.whatsapp_message || `Ola, vim pelo site e quero saber mais sobre a campanha ${data.title}.`;

  return (
    <Layout>
      <section
        className="border-b"
        style={{
          backgroundColor: data.theme?.background_color || undefined,
          color: data.theme?.text_color || undefined,
        }}
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <Badge className="bg-primary text-primary-foreground">{data.campaign?.type || "campanha"}</Badge>
            <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">{data.title}</h1>
            {data.subtitle && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{data.subtitle}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={data.campaign?.cta_url || "/produtos"}>{data.campaign?.cta_label || "Ver produtos"}</Link>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    void trackMarketingEvent({
                      event_type: "whatsapp_click",
                      campaign_id: data.campaign?.id ?? null,
                      source_path: window.location.pathname,
                    })
                  }
                >
                  Pedir orcamento
                </a>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            {heroImage ? (
              <img className="h-72 w-full object-cover md:h-96" src={heroImage} alt={data.banners[0]?.alt_text || data.title} />
            ) : (
              <div className="flex h-72 items-center justify-center bg-primary/10 px-8 text-center font-display text-3xl font-bold text-primary md:h-96">{data.title}</div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {data.showcases.slice(0, 3).map((showcase) => (
            <Card key={showcase.id} className="md:col-span-3">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vitrine</p>
                <h2 className="mt-2 text-xl font-semibold">{showcase.title || showcase.name}</h2>
                {showcase.subtitle && <p className="mt-2 text-sm text-muted-foreground">{showcase.subtitle}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(showcase.products ?? []).map((product) => (
                    <Link
                      to={`/produto/${product.slug}`}
                      key={product.id}
                      className="rounded-lg border bg-background p-3 transition hover:border-primary"
                      onClick={() =>
                        void trackMarketingEvent({
                          event_type: "product_click_from_campaign",
                          campaign_id: data.campaign?.id ?? null,
                          showcase_id: showcase.id,
                          product_id: product.id,
                          source_path: window.location.pathname,
                        })
                      }
                    >
                      {product.image ? <img className="h-28 w-full rounded-md object-cover" src={product.image} alt={product.name} loading="lazy" /> : <div className="h-28 rounded-md bg-muted" />}
                      <p className="mt-2 line-clamp-2 text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-primary">R$ {(product.promotional_price ?? product.price).toFixed(2).replace(".", ",")}</p>
                    </Link>
                  ))}
                  {(showcase.products ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto disponivel para está vitrine agora.</p>}
                </div>
              </CardContent>
            </Card>
          ))}
          {data.showcases.length === 0 && (
            <Card className="md:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">Produtos e vitrines destá campanha serao exibidos aqui quando forem vinculados pelo painel administrativo.</CardContent>
            </Card>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default CampaignLanding;
