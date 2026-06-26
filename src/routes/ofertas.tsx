import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { WifiOff } from "lucide-react";
import { CampaignStrip } from "@/components/tabloide/CampaignStrip";
import { CategoryTabs } from "@/components/tabloide/CategoryTabs";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { HeroCampaign } from "@/components/tabloide/HeroCampaign";
import { InstitutionalSection } from "@/components/tabloide/InstitutionalSection";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { absoluteUrl, brandConfig, withStoreTitle } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { type Category } from "@/data/categories";
import { type Product } from "@/data/products";
import { useIdleReset } from "@/hooks/use-idle-reset";
import { useOfflineStatus } from "@/hooks/use-offline";
import { trackEvent } from "@/lib/analytics";
import { type PublicSection } from "@/lib/commercial-data.server";
import { getPublicStorefront } from "@/lib/commercial.functions";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildJsonLdScripts,
  buildSpecialAnnouncementJsonLd,
} from "@/lib/seo-structured-data";

const AnalyticsPanel = lazy(() =>
  import("@/components/tabloide/AnalyticsPanel").then((module) => ({
    default: module.AnalyticsPanel,
  })),
);
const AttractScreen = lazy(() =>
  import("@/components/tabloide/AttractScreen").then((module) => ({
    default: module.AttractScreen,
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

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_SECTIONS: PublicSection[] = [];

export const Route = createFileRoute("/ofertas")({
  loader: () => getPublicStorefront({}),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `Ofertas | ${withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName)}`,
      },
      {
        name: "description",
        content: loaderData?.campaigns?.some((item) => item.status === "publicado")
          ? "Ofertas, campanhas e destaques comerciais ativos no Vitrine360."
          : "Ofertas, campanhas e destaques comerciais publicados no Vitrine360 - Central Comercial Digital.",
      },
      { property: "og:title", content: `${brandConfig.productName} | Ofertas` },
      {
        property: "og:description",
        content: "Ofertas, destaques e campanhas em um encarte digital interativo.",
      },
      { property: "og:url", content: absoluteUrl("/ofertas") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/ofertas") }],
    scripts: buildJsonLdScripts([
      buildBreadcrumbJsonLd([
        { name: "Inicio", path: "/" },
        { name: "Ofertas", path: "/ofertas" },
      ]),
      buildCollectionPageJsonLd({
        name: `Ofertas | ${withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName)}`,
        description: loaderData?.campaigns?.some((item) => item.status === "publicado")
          ? "Ofertas, campanhas e destaques comerciais ativos no Vitrine360."
          : "Ofertas, campanhas e destaques comerciais publicados no Vitrine360.",
        path: "/ofertas",
        items: loaderData?.products?.filter((item) => item.featured).slice(0, 12),
      }),
      loaderData?.campaigns?.[0] ? buildSpecialAnnouncementJsonLd(loaderData.campaigns[0]) : null,
    ]),
  }),
  component: OfertasPage,
});

function OfertasPage() {
  const initialStorefront = Route.useLoaderData();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const { settings } = useSettings();
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const { online } = useOfflineStatus(settings.offlineMode);
  const categories = storefrontQuery.data?.categories ?? EMPTY_CATEGORIES;
  const products = storefrontQuery.data?.products ?? EMPTY_PRODUCTS;
  const sections = storefrontQuery.data?.sections ?? EMPTY_SECTIONS;

  const featured = useMemo(() => products.filter((product) => product.featured), [products]);

  const handleCategory = (id: string) => {
    setActive(id);
    if (id !== "all") {
      const category = categories.find((item) => item.id === id);
      trackEvent("category_filter", {
        categoryId: id,
        categoryName: category?.name ?? id,
      });
    }
  };

  const searchTimer = useRef<number | null>(null);
  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (value.trim().length >= 3) {
      searchTimer.current = window.setTimeout(() => {
        trackEvent("search", { label: value.trim().toLowerCase() });
      }, 800);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sections
      .map((section) => {
        const items = products.filter((product) => {
          if (product.sectionId !== section.id) return false;
          if (active !== "all" && product.categoryId !== active) return false;
          if (normalizedQuery) {
            const haystack =
              `${product.name} ${product.categoryName} ${product.description}`.toLowerCase();
            if (!haystack.includes(normalizedQuery)) return false;
          }
          return true;
        });
        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);
  }, [active, products, query, sections]);

  const { idle, wake } = useIdleReset({
    timeoutMs: settings.idleTimeoutSec * 1000,
    enabled: settings.kioskMode,
    onIdle: () => {
      setOpen(null);
      setActive("all");
      setQuery("");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      {!online && (
        <div className="bg-foreground text-background text-[11px] sm:text-xs font-bold uppercase tracking-wider">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
            <WifiOff className="size-3.5" />
            Sem internet: o catalogo continua funcionando com o cache local do totem.
          </div>
        </div>
      )}
      <CampaignStrip campaigns={storefrontQuery.data?.campaigns} />
      <GlobalHeader onSearch={handleSearch} />
      <main>
        <HeroCampaign campaigns={storefrontQuery.data?.campaigns} />
        <CategoryTabs active={active} onChange={handleCategory} categories={categories} />

        <div className="md:hidden max-w-7xl mx-auto px-4 pt-4">
          <input
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-surface px-4 py-2.5 rounded-full text-sm border border-border focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <section id="ofertas" className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-action">
                Catalogo - Destaques
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                Destaques da quinzena
              </h2>
              <div className="h-1 w-12 bg-action mt-2" />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {featured.length} ofertas selecionadas
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} onOpen={setOpen} variant="featured" />
            ))}
          </div>
        </section>

        {filteredSections.map((section) => (
          <section key={section.id} className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
                <div className="h-1 w-10 bg-brand mt-2" />
              </div>
              <span className="text-xs text-muted-foreground">{section.items.length} produtos</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {section.items.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpen} />
              ))}
            </div>
          </section>
        ))}

        {filteredSections.length === 0 && (
          <div className="max-w-7xl mx-auto px-4 py-16 text-center">
            <p className="font-display text-2xl font-bold mb-2">Nenhum produto encontrado</p>
            <p className="text-muted-foreground">
              Tente outra categoria ou termo de busca, ou fale com a gente no WhatsApp.
            </p>
          </div>
        )}

        <InstitutionalSection />
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
      {idle ? (
        <Suspense fallback={null}>
          <AttractScreen onWake={wake} />
        </Suspense>
      ) : null}
    </div>
  );
}
