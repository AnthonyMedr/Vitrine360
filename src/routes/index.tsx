import { Suspense, lazy, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CampaignStrip } from "@/components/tabloide/CampaignStrip";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { InstitutionalSection } from "@/components/tabloide/InstitutionalSection";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { LandingHero } from "@/components/vitrine360/LandingHero";
import { absoluteUrl, brandConfig, withStoreTitle } from "@/config/brand";
import { type Product } from "@/data/products";
import { getPublicStorefront } from "@/lib/commercial.functions";
import {
  buildCollectionPageJsonLd,
  buildJsonLdScripts,
  buildOrganizationJsonLd,
  buildSpecialAnnouncementJsonLd,
  buildWebsiteJsonLd,
} from "@/lib/seo-structured-data";

const AnalyticsPanel = lazy(() =>
  import("@/components/tabloide/AnalyticsPanel").then((module) => ({
    default: module.AnalyticsPanel,
  })),
);
const ProductModal = lazy(() =>
  import("@/components/tabloide/ProductModal").then((module) => ({
    default: module.ProductModal,
  })),
);
const SettingsPanel = lazy(() =>
  import("@/components/tabloide/SettingsPanel").then((module) => ({
    default: module.SettingsPanel,
  })),
);
const CampaignsShowcase = lazy(() =>
  import("@/components/vitrine360/CampaignsShowcase").then((module) => ({
    default: module.CampaignsShowcase,
  })),
);
const ModuleCards = lazy(() =>
  import("@/components/vitrine360/ModuleCards").then((module) => ({
    default: module.ModuleCards,
  })),
);

const EMPTY_PRODUCTS: Product[] = [];

export const Route = createFileRoute("/")({
  loader: () => getPublicStorefront({}),
  head: ({ loaderData }) => ({
    meta: [
      { title: withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName) },
      {
        name: "description",
        content: loaderData?.store.institutionalText || brandConfig.defaultSeoDescription,
      },
      {
        property: "og:title",
        content: withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName),
      },
      {
        property: "og:description",
        content: loaderData?.store.institutionalText || brandConfig.defaultSeoDescription,
      },
      { property: "og:url", content: absoluteUrl("/") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    scripts: [
      ...buildJsonLdScripts([
        buildOrganizationJsonLd({
          storeName: loaderData?.store.storeName ?? brandConfig.defaultStoreName,
          description: loaderData?.store.institutionalText,
          sameAs: brandConfig.defaultInstagramUrl ? [brandConfig.defaultInstagramUrl] : [],
        }),
        buildWebsiteJsonLd({
          description: loaderData?.store.institutionalText,
        }),
        buildCollectionPageJsonLd({
          name: withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName),
          description: loaderData?.store.institutionalText || brandConfig.defaultSeoDescription,
          path: "/",
          items: loaderData?.products?.filter((item) => item.featured).slice(0, 8),
        }),
        loaderData?.campaigns?.[0] ? buildSpecialAnnouncementJsonLd(loaderData.campaigns[0]) : null,
      ]),
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const initialStorefront = Route.useLoaderData();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront-home"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const [open, setOpen] = useState<Product | null>(null);
  const storefront = storefrontQuery.data;
  const featured = (storefront?.products ?? EMPTY_PRODUCTS)
    .filter((product) => product.featured)
    .slice(0, 6);
  const campaigns = storefront?.campaigns;

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefront} />
      <CampaignStrip campaigns={campaigns} />
      <GlobalHeader />
      <main>
        <LandingHero
          heroImageUrl={storefront?.store.heroBannerUrl}
          storeName={storefront?.store.storeName}
          campaigns={campaigns}
        />
        <Suspense fallback={null}>
          <ModuleCards />
        </Suspense>

        <section className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-action">
              Destaques
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
              Produtos em destaque
            </h2>
            <div className="h-1 w-12 bg-action mt-3" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} onOpen={setOpen} variant="featured" />
            ))}
          </div>
        </section>

        <Suspense fallback={null}>
          <CampaignsShowcase items={campaigns} />
        </Suspense>
        <InstitutionalSection
          title={`Tudo para acabamento, construcao e reforma${storefront?.store.storeName ? ` com ${storefront.store.storeName}` : ""}.`}
          description={storefront?.store.institutionalText}
        />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <Suspense fallback={null}>
        <SettingsPanel />
        <AnalyticsPanel />
      </Suspense>
      {open ? (
        <Suspense fallback={null}>
          <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
        </Suspense>
      ) : null}
    </div>
  );
}
