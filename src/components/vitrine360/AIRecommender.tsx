import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { ProductModal } from "@/components/tabloide/ProductModal";
import { brandConfig } from "@/config/brand";
import { categories as defaultCategories, type Category } from "@/data/categories";
import { products as defaultProducts, type Product } from "@/data/products";
import { recommendProducts } from "@/lib/ai.functions";
import { trackEvent } from "@/lib/analytics";

const examples = [
  "Vou reformar o banheiro de uma casa de praia",
  "Forrar o teto de uma sala comercial 30m2",
  "Fachada moderna em ripado para um restaurante",
  "Cobertura de garagem com protecao UV",
];

export function AIRecommender({
  defaultCategory,
  categories = defaultCategories,
  products = defaultProducts,
  storeName = brandConfig.defaultStoreName,
}: {
  defaultCategory?: string;
  categories?: Category[];
  products?: Product[];
  storeName?: string;
}) {
  const [categoryId, setCategoryId] = useState<string>(defaultCategory ?? "all");
  const [scenario, setScenario] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const recommendProductsFn = useServerFn(recommendProducts);
  const mutation = useMutation({
    mutationFn: (input: { categoryId: string; scenario: string }) =>
      recommendProductsFn({ data: input }),
  });

  const submit = () => {
    if (!scenario.trim()) return;
    trackEvent("ai_recommend", { categoryId, label: scenario.slice(0, 80) });
    mutation.mutate({ categoryId, scenario });
  };

  const recommendations = mutation.data?.recommendations ?? [];
  const found = recommendations
    .map((recommendation) => ({
      product: products.find((item) => item.id === recommendation.id),
      reason: recommendation.reason,
    }))
    .filter((item): item is { product: Product; reason: string } => Boolean(item.product));

  return (
    <section
      data-testid="ai-recommender-section"
      className="border-y border-border bg-gradient-to-br from-brand/10 via-background to-action/10"
    >
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-action">
          <Sparkles className="size-4" /> IA Comercial Vitrine360
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tighter sm:text-4xl">
          Diga seu cenario, receba a recomendacao certa.
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Nosso assistente analisa seu uso e indica os melhores produtos do catalogo {storeName}.
        </p>

        <div className="mt-6 grid gap-3 lg:grid-cols-[200px_1fr_auto]">
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submit()}
            placeholder="Ex: reforma de cozinha rustica com painel ripado..."
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-action focus:outline-none"
          />

          <button
            onClick={submit}
            disabled={mutation.isPending || !scenario.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-action px-6 py-3 font-black text-action-foreground shadow-card disabled:opacity-60 hover:brightness-110"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Recomendar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              aria-label={example}
              onClick={() => setScenario(example)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-action"
            >
              {example}
            </button>
          ))}
        </div>

        {mutation.error && (
          <p className="mt-4 text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}

        {mutation.data && (
          <div className="mt-8">
            {mutation.data.summary && (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm">
                <span className="mr-2 font-bold">Analise:</span>
                {mutation.data.summary}
              </p>
            )}

            {found.length === 0 ? (
              <p className="mt-4 text-muted-foreground">
                Sem recomendacoes para este cenario. Tente outra descricao.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {found.map(({ product, reason }) => (
                  <div key={product.id} className="space-y-2">
                    <ProductCard product={product} onOpen={setOpen} />
                    <p className="px-1 text-xs text-muted-foreground">
                      <span className="mr-1 font-bold text-action">Por que?</span>
                      {reason}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5" />
              Clique em um produto para abrir e pedir orcamento.
            </div>
          </div>
        )}
      </div>

      <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
    </section>
  );
}
