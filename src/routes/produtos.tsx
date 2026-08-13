import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Filter, Search } from "lucide-react";
import { GamelPublicLayout, GamelPublicProductCard } from "@/components/public/GamelPublicLayout";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import type { Product } from "@/data/products";
import { gamelFeaturedCategories } from "@/data/gamel-site";
import { getPublicStorefront } from "@/lib/commercial.functions";

const EMPTY_PRODUCTS: Product[] = [];

export const Route = createFileRoute("/produtos")({
  validateSearch: (search: Record<string, unknown>) => ({
    busca: typeof search.busca === "string" ? search.busca : "",
    categoria: typeof search.categoria === "string" ? search.categoria : "todos",
  }),
  loader: () => getPublicStorefront({}),
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Produtos GAMEL` },
      {
        name: "description",
        content:
          "Catalogo institucional da GAMEL Metal com produtos para acabamentos, obras, comunicacao visual e orcamento assistido.",
      },
      { property: "og:url", content: absoluteUrl("/produtos") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/produtos") }],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const initialStorefront = Route.useLoaderData();
  const search = Route.useSearch();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront-products"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const [query, setQuery] = useState(search.busca);
  const [category, setCategory] = useState(search.categoria || "todos");
  const storefront = storefrontQuery.data;
  const products = storefront?.products ?? EMPTY_PRODUCTS;

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      if (
        category !== "todos" &&
        product.categoryId !== category &&
        product.sectionId !== category
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        product.name,
        product.categoryName,
        product.description,
        product.longDescription,
        product.applications.join(" "),
        product.benefits.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [category, products, query]);

  return (
    <GamelPublicLayout>
      <StorefrontSettingsSync storefront={storefront} />
      <div className="shell-home py-10">
        <section className="rounded-lg bg-brand p-6 text-white md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Catalogo GAMEL
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-none md:text-7xl">
            Produtos para obras, acabamentos e comunicacao visual.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/68">
            Consulte linhas, aplicacoes e especificacoes. Precos, estoque, disponibilidade e frete
            sao confirmados pela equipe comercial no atendimento assistido.
          </p>
          <div className="mt-6 flex max-w-3xl overflow-hidden rounded-md border border-white/14 bg-white/8 focus-within:border-action">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto, categoria ou aplicacao"
              className="h-12 flex-1 bg-transparent px-4 text-sm text-white placeholder:text-white/45 focus:outline-none"
            />
            <div className="flex h-12 w-12 items-center justify-center bg-action text-white">
              <Search className="h-5 w-5" />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border/80 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            Filtrar por linha
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("todos")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                category === "todos"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              Todos
            </button>
            {gamelFeaturedCategories.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setCategory(item.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  category === item.slug
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg bg-white px-5 py-8 shadow-sm ring-1 ring-border/80 md:px-7">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {filtered.length} produto(s)
              </p>
              <h2 className="font-display text-4xl">Produtos para consulta</h2>
            </div>
            <Button asChild className="rounded-md bg-action text-white hover:bg-accent">
              <Link to="/carrinho">
                Ver carrinho
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center">
              <h3 className="font-display text-3xl">Nenhum produto encontrado</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tente outra busca ou envie sua necessidade para a equipe comercial.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {filtered.map((product) => (
                <GamelPublicProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </GamelPublicLayout>
  );
}
