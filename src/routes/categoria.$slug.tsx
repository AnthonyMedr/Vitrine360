import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { ProductModal } from "@/components/tabloide/ProductModal";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { AIRecommender } from "@/components/vitrine360/AIRecommender";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { type Product } from "@/data/products";
import { getPublicCategory, getPublicStorefront } from "@/lib/commercial.functions";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildJsonLdScripts,
} from "@/lib/seo-structured-data";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => ({
    storefront: await getPublicStorefront({}),
    category: await getPublicCategory({ data: { slug: params.slug } }),
  }),
  head: ({ params, loaderData }) => {
    const url = absoluteUrl(`/categoria/${params.slug}`);
    return {
      meta: [
        {
          title: loaderData?.category
            ? `${loaderData.category.name} | ${brandConfig.productName}`
            : `Categoria | ${brandConfig.productName}`,
        },
        {
          name: "description",
          content: loaderData?.category
            ? `Categoria ${loaderData.category.name} no catalogo comercial digital da InfiniTI.`
            : "Categoria de produtos no Vitrine360 com dados dinamicos e catalogo comercial.",
        },
        {
          property: "og:title",
          content: loaderData?.category
            ? `${loaderData.category.name} | Vitrine360`
            : "Categoria | Vitrine360",
        },
        {
          property: "og:description",
          content: loaderData?.category
            ? `Produtos da categoria ${loaderData.category.name}.`
            : "Categoria de produtos no Vitrine360.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: buildJsonLdScripts([
        buildBreadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Catalogo", path: "/catalogo" },
          {
            name: loaderData?.category?.name ?? "Categoria",
            path: `/categoria/${params.slug}`,
          },
        ]),
        buildCollectionPageJsonLd({
          name: loaderData?.category?.name ?? "Categoria",
          description: loaderData?.category
            ? `Produtos da categoria ${loaderData.category.name}.`
            : "Categoria de produtos no Vitrine360.",
          path: `/categoria/${params.slug}`,
          items: loaderData?.storefront?.products?.filter(
            (item) => item.categoryId === loaderData?.category?.id,
          ),
        }),
      ]),
    };
  },
  component: CategoriaPage,
});

function CategoriaPage() {
  const initialData = Route.useLoaderData();
  const slug = Route.useParams().slug;
  const storefrontFn = useServerFn(getPublicStorefront);
  const categoryFn = useServerFn(getPublicCategory);
  const [open, setOpen] = useState<Product | null>(null);

  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialData.storefront,
  });
  const categoryQuery = useQuery({
    queryKey: ["public-category", slug],
    queryFn: () => categoryFn({ data: { slug } }),
    initialData: initialData.category,
  });

  const categories = storefrontQuery.data?.categories ?? [];
  const products = storefrontQuery.data?.products ?? [];
  const category = categoryQuery.data;
  const items = category ? products.filter((product) => product.categoryId === category.id) : [];

  if (!categoryQuery.isLoading && !category) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Categoria nao encontrada</h1>
          <Link to="/catalogo" className="mt-6 inline-block font-bold text-action">
            Ver catalogo completo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      <GlobalHeader />
      <main>
        <section className="bg-foreground py-12 text-background">
          <div className="mx-auto max-w-7xl px-4">
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-background/70 hover:text-highlight"
            >
              <ArrowLeft className="size-3" /> Catalogo
            </Link>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {category?.name ?? "Categoria"}
            </h1>
            <p className="mt-2 max-w-2xl text-background/70">
              {items.length} {items.length === 1 ? "produto" : "produtos"} disponiveis.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10">
          {items.length === 0 ? (
            <p className="text-muted-foreground">Nenhum produto cadastrado nesta categoria.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpen} />
              ))}
            </div>
          )}
        </section>

        {category && (
          <AIRecommender
            defaultCategory={category.id}
            categories={categories}
            products={products}
            storeName={storefrontQuery.data?.store.storeName}
          />
        )}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
    </div>
  );
}
