import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/useCategories";
import { usePublicMarketingState } from "@/hooks/useMarketing";
import { buildCategoryPath, CATALOG_ROUTES } from "@/lib/catalogRoutes";

export function CategoriesSection() {
  const { data: categories, isLoading } = useCategories();
  const { data: marketingState } = usePublicMarketingState();

  const cards = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description || "",
    image: category.image_url || "/placeholder.svg",
    link: buildCategoryPath(category.slug),
  })).sort((a, b) => {
    const focusIds = new Set(marketingState?.site_experience.category_focus.ids ?? []);
    const aFocused = focusIds.has(a.id);
    const bFocused = focusIds.has(b.id);
    if (aFocused !== bFocused) return aFocused ? -1 : 1;
    return 0;
  });

  const campaignCategoryFocus = marketingState?.site_experience.category_focus.names ?? [];
  const isCampaignCategoryMode = marketingState?.site_experience.mode === "campaign" && campaignCategoryFocus.length > 0;

  return (
    <section className="pb-6">
      <div className="shell-home">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">{isCampaignCategoryMode ? "Categorias da campanha" : "Categorias"}</p>
            <h2 className="section-title">{isCampaignCategoryMode ? "Linhas em destaque nesta campanha" : "Encontre a linha ideal para seu projeto"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isCampaignCategoryMode
                ? `Foco atual: ${campaignCategoryFocus.join(", ")}. As demais categorias continuam disponíveis no catálogo.`
                : "Navegue pelas seis linhas comercializadas pela GAMEL e solicite orientação para escolher o produto adequado."}
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 w-full rounded-lg md:w-auto">
            <Link to={CATALOG_ROUTES.allProducts}>
              Ver catálogo completo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-44 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((category) => (
              <Link
                key={category.id}
                to={category.link}
                className="group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img src={category.image} alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-10 font-display text-xl leading-none text-secondary">{category.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{category.description}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Ver produtos
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
