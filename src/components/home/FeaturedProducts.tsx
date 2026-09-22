import { Link } from "react-router-dom";
import { useMemo } from "react";
import { ArrowRight, Sparkles, Tag } from "lucide-react";
import { useFeaturedProducts, useProducts, type Product } from "@/hooks/useProducts";
import { usePublicMarketingState } from "@/hooks/useMarketing";
import { ProductCard } from "@/components/products/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATALOG_ROUTES } from "@/lib/catalogRoutes";

function ProductGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {[...Array(count)].map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border bg-card">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function uniqueProducts(groups: Array<Product[] | undefined>, limit: number) {
  const seen = new Set<string>();
  const result: Product[] = [];

  for (const group of groups) {
    for (const product of group || []) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      result.push(product);
      if (result.length >= limit) return result;
    }
  }

  return result;
}

function SectionHeader({
  eyebrow,
  title,
  description,
  linkTo = CATALOG_ROUTES.allProducts,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  linkTo?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <Button asChild variant="outline" className="h-10 w-full rounded-lg md:w-auto">
        <Link to={linkTo}>
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function useHomeProductGroups() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedProducts(8, true);
  const { data: allProducts, isLoading: allLoading } = useProducts({ limit: 24, readyForCampaign: true });
  const { data: marketingState } = usePublicMarketingState();

  const bestSellers = useMemo(() => uniqueProducts([featured, allProducts], 5), [featured, allProducts]);
  const launches = useMemo(() => uniqueProducts([
    allProducts?.filter((product) => !bestSellers.some((item) => item.id === product.id)),
  ], 5), [allProducts, bestSellers]);
  const promotions = useMemo(() => uniqueProducts([
    allProducts?.filter((product) => product.original_price && Number(product.original_price) > Number(product.price)),
    allProducts?.filter((product) => !bestSellers.some((item) => item.id === product.id) && !launches.some((item) => item.id === product.id)),
  ], 5), [allProducts, bestSellers, launches]);
  const campaignSlots = useMemo(() => {
    const slots = marketingState?.site_experience.home_slots ?? [];
    const showcases = marketingState?.showcases ?? [];
    return slots.map((slot) => ({
      ...slot,
      showcase: showcases.find((entry) => entry.id === slot.showcase_id) ?? null,
    }));
  }, [marketingState]);

  return { bestSellers, launches, promotions, featuredLoading, allLoading, marketingState, campaignSlots };
}

export function BestSellersSection() {
  const { bestSellers, featuredLoading, marketingState, campaignSlots } = useHomeProductGroups();
  const primarySlot = campaignSlots[0];
  const campaignProducts = primarySlot?.showcase?.products?.map((product) => ({
    ...product,
    image_url: product.image,
    original_price: product.promotional_price ? product.price : null,
    price: product.promotional_price ?? product.price,
  })) ?? [];
  const products = campaignProducts.length ? campaignProducts : bestSellers;
  const isCampaignMode = marketingState?.site_experience.mode === "campaign" && campaignProducts.length > 0;

  return (
    <section className="pb-6">
      <div className="shell-home">
        <div className="rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
          <SectionHeader
            eyebrow={isCampaignMode ? "Campanha em destaque" : "Mais vendidos"}
            title={isCampaignMode ? primarySlot?.title || "Selecao principal da campanha" : "Produtos campeoes para comprar sem perder tempo"}
            description={isCampaignMode ? primarySlot?.subtitle || "A home ja está destacando a vitrine principal da campanha ativa." : "Itens com maior apelo comercial, destaque visual e melhor caminho para conversão rapida."}
            linkTo={isCampaignMode ? primarySlot?.cta_url || `/campanhas/${marketingState?.site_experience.landing_page?.slug ?? ""}` : CATALOG_ROUTES.offers}
          />
          {featuredLoading && !products.length ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {products.map((product) => <ProductCard key={product.id} product={product as Product} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function PremiumProductsSection() {
  const { launches, promotions, allLoading, marketingState, campaignSlots } = useHomeProductGroups();
  const secondarySlot = campaignSlots[1];
  const tertiarySlot = campaignSlots[2];
  const secondaryProducts = secondarySlot?.showcase?.products?.map((product) => ({
    ...product,
    image_url: product.image,
    original_price: product.promotional_price ? product.price : null,
    price: product.promotional_price ?? product.price,
  })) ?? [];
  const tertiaryProducts = tertiarySlot?.showcase?.products?.map((product) => ({
    ...product,
    image_url: product.image,
    original_price: product.promotional_price ? product.price : null,
    price: product.promotional_price ?? product.price,
  })) ?? [];
  const launchProducts = secondaryProducts.length ? secondaryProducts : launches;
  const promotionProducts = tertiaryProducts.length ? tertiaryProducts : promotions;
  const isCampaignMode = marketingState?.site_experience.mode === "campaign";

  return (
    <div className="pb-6">

      <section className="pb-6">
        <div className="shell-home">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
              <SectionHeader
                eyebrow={secondaryProducts.length ? "Vitrine secundaria da campanha" : "Lancamentos e linhas premium"}
                title={secondaryProducts.length ? secondarySlot?.title || "Selecao complementar da campanha" : "Acabamentos para elevar o padrao do projeto"}
                description={secondaryProducts.length ? secondarySlot?.subtitle || "A segunda faixa da home está puxando a vitrine complementar da campanha ativa." : "Selecao enxuta para quem procura visual moderno, durabilidade e compra com suporte humano."}
                linkTo={secondaryProducts.length ? secondarySlot?.cta_url || "/produtos" : CATALOG_ROUTES.allProducts}
              />
              {allLoading && !launchProducts.length ? (
                <ProductGridSkeleton />
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {launchProducts.map((product) => <ProductCard key={product.id} product={product as Product} compact />)}
                </div>
              )}
            </div>

            <aside className="rounded-lg bg-secondary p-5 text-secondary-foreground shadow-sm">
              <Sparkles className="h-7 w-7 text-accent" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/60">{isCampaignMode ? "Modo campanha" : "Ticket medio"}</p>
              <h3 className="mt-2 font-display text-3xl font-bold text-white">
                {isCampaignMode ? marketingState?.site_experience.active_campaign?.headline || "A campanha ativa está moldando a home." : "Combine piso, teto laminado e revestimento no mesmo pedido."}
              </h3>
              <p className="mt-3 text-sm leading-6 text-secondary-foreground/72">
                {isCampaignMode
                  ? marketingState?.site_experience.active_campaign?.subheadline || "A gestao comercial pode trocar headline, vitrines, landing e CTA sem depender de alteracao manual em codigo."
                  : "Aumente previsibilidade de prazo, reduza idas a loja e consolide a compra da obra em um unico carrinho."}
              </p>
              <Button asChild variant="hero" size="lg" className="mt-6 w-full rounded-lg">
                <Link to={marketingState?.site_experience.active_campaign?.cta_url || `${CATALOG_ROUTES.allProducts}?readyForCampaign=true`}>
                  Montar pedido
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </aside>
          </div>
        </div>
      </section>

      <section>
        <div className="shell-home rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">{tertiaryProducts.length ? "Campanha e ofertas" : "Promoções estrategicas"}</p>
              <h2 className="section-title">{tertiaryProducts.length ? tertiarySlot?.title || "Ultima faixa da campanha" : "Oportunidades para fechar melhor"}</h2>
            </div>
          </div>
          {tertiarySlot?.subtitle ? <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">{tertiarySlot.subtitle}</p> : null}
          {allLoading && !promotionProducts.length ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {promotionProducts.map((product) => <ProductCard key={product.id} product={product as Product} compact />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function FeaturedProducts() {
  return (
    <>
      <BestSellersSection />
      <PremiumProductsSection />
    </>
  );
}
