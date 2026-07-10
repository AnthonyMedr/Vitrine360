import { Suspense, lazy, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { CategoryTabs } from "@/components/tabloide/CategoryTabs";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { AIRecommender } from "@/components/vitrine360/AIRecommender";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { RoomSimulator } from "@/components/vitrine360/RoomSimulator";
import { absoluteUrl, brandConfig, withStoreTitle } from "@/config/brand";
import { type Category } from "@/data/categories";
import { type Product } from "@/data/products";
import { trackEvent } from "@/lib/analytics";
import { getPublicStorefront } from "@/lib/commercial.functions";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildJsonLdScripts,
} from "@/lib/seo-structured-data";

const ProductModal = lazy(() =>
  import("@/components/tabloide/ProductModal").then((module) => ({
    default: module.ProductModal,
  })),
);
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_PRODUCTS: Product[] = [];

export const Route = createFileRoute("/catalogo")({
  loader: () => getPublicStorefront({}),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `Catalogo | ${withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName)}`,
      },
      {
        name: "description",
        content:
          loaderData?.store.institutionalText ||
          "Explore o catalogo completo do Vitrine360 - Central Comercial Digital com categorias, produtos, campanhas e apoio comercial.",
      },
      { property: "og:title", content: `${brandConfig.productName} | Catalogo` },
      {
        property: "og:description",
        content: "Catalogo completo com busca, filtros e apoio comercial digital.",
      },
      { property: "og:url", content: absoluteUrl("/catalogo") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/catalogo") }],
    scripts: buildJsonLdScripts([
      buildBreadcrumbJsonLd([
        { name: "Inicio", path: "/" },
        { name: "Catalogo", path: "/catalogo" },
      ]),
      buildCollectionPageJsonLd({
        name: `Catalogo | ${withStoreTitle(loaderData?.store.storeName ?? brandConfig.defaultStoreName)}`,
        description:
          loaderData?.store.institutionalText ||
          "Explore o catalogo completo do Vitrine360 com categorias, produtos e apoio comercial.",
        path: "/catalogo",
        items: loaderData?.products,
      }),
    ]),
  }),
  component: CatalogoPage,
});

function CatalogoPage() {
  const initialStorefront = Route.useLoaderData();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const storefront = storefrontQuery.data;
  const categories = storefront?.categories ?? EMPTY_CATEGORIES;
  const products = storefront?.products ?? EMPTY_PRODUCTS;
  const storeName = storefront?.store.storeName ?? brandConfig.defaultStoreName;

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      if (active !== "all" && product.categoryId !== active) return false;
      if (normalizedQuery) {
        const haystack = [
          product.name,
          product.categoryName,
          product.description,
          product.applications.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [active, products, query]);

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

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefront} />
      <GlobalHeader />
      <main>
        <section className="bg-brand py-12 text-brand-foreground sm:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <span className="text-xs font-bold uppercase tracking-[0.26em] text-action">
              Catalogo digital completo
            </span>
            <h1 className="mt-2 font-display text-5xl sm:text-7xl">
              Solucoes visuais para acabamento e estrutura.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-brand-foreground/76 sm:text-base">
              Navegue por categorias, busque por aplicacao e consulte as linhas comerciais da{" "}
              {storeName} com linguagem clara, tecnica e objetiva.
            </p>
            <div className="relative mt-6 max-w-xl">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand/70" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, categoria ou ambiente..."
                className="w-full rounded-full border border-white/10 bg-white px-12 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-action focus:outline-none"
              />
            </div>
          </div>
        </section>

        <CategoryTabs active={active} onChange={handleCategory} categories={categories} />

        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-4xl">
                {filtered.length} {filtered.length === 1 ? "produto" : "produtos"}
              </h2>
              <div className="h-1 w-10 bg-action mt-2" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="mb-2 font-display text-4xl">Nada por aqui</p>
              <p className="text-muted-foreground">Tente outra categoria ou termo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpen} />
              ))}
            </div>
          )}
        </section>

        <AIRecommender
          defaultCategory={active}
          categories={categories}
          products={products}
          storeName={storeName}
        />
        <RoomSimulator products={products} />

        <section className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="mb-4 font-display text-3xl">Navegue por categoria</h2>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((category) => category.id !== "all")
              .map((category) => (
                <Link
                  key={category.id}
                  to="/categoria/$slug"
                  params={{ slug: category.slug }}
                  className="px-4 py-2 rounded-full bg-card border border-border text-sm font-bold hover:border-action hover:text-action transition-colors"
                >
                  {category.name}
                </Link>
              ))}
          </div>
        </section>
      </main>
      <Footer />
      <FloatingWhatsApp />
      {open ? (
        <Suspense fallback={null}>
          <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
        </Suspense>
      ) : null}
    </div>
  );
}
