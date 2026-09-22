import { Link, Navigate } from "react-router-dom";
import { FormEvent, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { Brand, Category, CategoryDraft, CategoryHealth, FreightReadiness, PimReadiness, Product, StagingSummary, StagingWorkboard } from "./admin-catalog/types";
import { countReadinessIssues, listReadinessIssues } from "./admin-catalog/catalogHelpers";
import { TaxonomyMetricsSection } from "./admin-catalog/TaxonomyMetricsSection";
import { PimReadinessSection } from "./admin-catalog/PimReadinessSection";
import { CategoryForm } from "./admin-catalog/CategoryForm";
import { CategoryList } from "./admin-catalog/CategoryList";
import { StagingAndReviewSection } from "./admin-catalog/StagingAndReviewSection";
import { CatalogReadinessSection } from "./admin-catalog/CatalogReadinessSection";
import { RoutineSection } from "./admin-catalog/RoutineSection";

const EMPTY_PIM_READINESS: PimReadiness = {
  totals: {
    products: 0,
    publishable: 0,
    ready_for_campaign: 0,
    ready_for_home: 0,
    ready_for_traffic: 0,
    assisted_operation_ready: 0,
    blocked_by_image: 0,
    blocked_by_fiscal: 0,
    missing_seo: 0,
    missing_application: 0,
    missing_category: 0,
    missing_material: 0,
    missing_measure: 0,
    low_score: 0,
    near_ready: 0,
  },
  category_summary: [],
};

export default function AdminCatalogWorkspace() {
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const products = useAdminResource<Product[]>(isAdmin ? "/api/admin/products" : null, []);
  const categories = useAdminResource<Category[]>(isAdmin ? "/api/admin/categories" : null, []);
  const brands = useAdminResource<Brand[]>(isAdmin ? "/api/admin/brands" : null, []);
  const staging = useAdminResource<StagingSummary>(isAdmin ? "/api/admin/catalog-staging/summary" : null, {});
  const workboard = useAdminResource<StagingWorkboard>(isAdmin ? "/api/admin/catalog-staging/workboard" : null, {});
  const freight = useAdminResource<FreightReadiness>(isAdmin ? "/api/admin/freight/catalog-readiness" : null, {});
  const pim = useAdminResource<PimReadiness>(isAdmin ? "/api/admin/catalog/pim-readiness" : null, EMPTY_PIM_READINESS);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({ name: "", description: "", image_url: "", icon: "", is_active: true });
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);

  const lowStock = products.data.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= 5);
  const withoutImage = products.data.filter((product) => !product.image_url && (product.images ?? []).length === 0);
  const withoutStock = products.data.filter((product) => Number(product.stock) <= 0);
  const inactive = products.data.filter((product) => !product.is_active);
  const fiscalPending = products.data.filter((product) => product.tax_classification_status && product.tax_classification_status !== "ready");
  const categoryHealth: CategoryHealth[] = useMemo(() => categories.data
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.name.localeCompare(b.name))
    .map((category) => {
      const categoryProducts = products.data.filter((product) => product.category_id === category.id || product.category?.id === category.id || product.category?.name === category.name);
      const activeProducts = categoryProducts.filter((product) => product.is_active);
      const productsWithoutImage = activeProducts.filter((product) => !product.image_url && (product.images ?? []).length === 0);
      return {
        ...category,
        productCount: categoryProducts.length,
        activeProductCount: activeProducts.length,
        productsWithoutImage: productsWithoutImage.length,
        empty: categoryProducts.length === 0,
      };
    }), [categories.data, products.data]);
  const catalogBlockers = countReadinessIssues(freight.data.blockers, freight.data.checks?.blockers);
  const catalogWarnings = countReadinessIssues(freight.data.warnings, freight.data.checks?.warnings);
  const catalogReadinessIssues = listReadinessIssues(freight.data.checks?.blockers, freight.data.blockers)
    .concat(listReadinessIssues(freight.data.checks?.warnings, freight.data.warnings));

  if (loading) return <AdminLoadingState label="Carregando gestao de catálogo..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const reloadAll = () => {
    void products.reload();
    void categories.reload();
    void brands.reload();
    void staging.reload();
    void workboard.reload();
    void freight.reload();
    void pim.reload();
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (categoryDraft.name.trim().length < 3) {
      toast({ title: "Nome muito curto", description: "Informe ao menos 3 caracteres para o nome da categoria.", variant: "destructive" });
      return;
    }
    setSavingTaxonomy(true);
    try {
      await apiFetch("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(categoryDraft),
      });
      setCategoryDraft({ name: "", description: "", image_url: "", icon: "", is_active: true });
      await categories.reload();
      toast({ title: "Categoria criada", description: "Categoria disponível para vinculacao no cadastro de produtos." });
    } catch (error) {
      toast({ title: "Falha ao criar categoria", description: error instanceof Error ? error.message : "Revise permissao e campos.", variant: "destructive" });
    } finally {
      setSavingTaxonomy(false);
    }
  };

  const moveCategory = async (category: CategoryHealth, direction: "up" | "down") => {
    const ordered = categoryHealth;
    const index = ordered.findIndex((entry) => entry.id === category.id);
    const swapWith = direction === "up" ? ordered[index - 1] : ordered[index + 1];
    if (!swapWith) return;
    setSavingTaxonomy(true);
    try {
      const currentOrder = Number(category.sort_order ?? index);
      const swapOrder = Number(swapWith.sort_order ?? index);
      await Promise.all([
        apiFetch(`/api/admin/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: swapOrder }) }),
        apiFetch(`/api/admin/categories/${swapWith.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: currentOrder }) }),
      ]);
      await categories.reload();
    } catch (error) {
      toast({ title: "Falha ao reordenar categoria", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingTaxonomy(false);
    }
  };

  const toggleCategory = async (category: Category) => {
    if (category.is_active && !window.confirm(`Desativar "${category.name}"? Ela some do site público e dos filtros do catálogo.`)) {
      return;
    }
    setSavingTaxonomy(true);
    try {
      await apiFetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !category.is_active }),
      });
      await categories.reload();
      toast({ title: "Categoria atualizada" });
    } catch (error) {
      toast({ title: "Falha ao atualizar categoria", description: error instanceof Error ? error.message : "Revise permissao.", variant: "destructive" });
    } finally {
      setSavingTaxonomy(false);
    }
  };

  return (
    <AdminWorkspaceShell
      eyebrow="Gestao de catálogo"
      title="Categorias e catálogo GAMEL"
      description="Workspace da Fase 1 para revisar categorias oficiais, produtos vinculados, capa, ordem de exibicao, descrição e status do catálogo inteligente."
      actions={<><Button variant="outline" onClick={reloadAll}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button asChild><Link to="/admin/produtos">Produtos</Link></Button></>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Produtos" value={products.data.length} detail={`${inactive.length} inativos`} />
          <WorkspaceMetric label="Disponibilidade a confirmar" value={lowStock.length + withoutStock.length} tone={lowStock.length + withoutStock.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Revisão técnica" value={fiscalPending.length} tone={fiscalPending.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Pendencias de catálogo" value={catalogBlockers + catalogWarnings} detail="pontos a validar" tone={catalogBlockers + catalogWarnings > 0 ? "warn" : "ok"} />
        </div>

        <TaxonomyMetricsSection
          activeCategoriesCount={categories.data.filter((item) => item.is_active).length}
          totalCategoriesCount={categories.data.length}
          activeBrandsCount={brands.data.filter((item) => item.is_active).length}
          totalBrandsCount={brands.data.length}
          withoutImageCount={withoutImage.length}
          withoutStockCount={withoutStock.length}
          inReviewCount={inactive.length + withoutImage.length + withoutStock.length}
          emptyCategoriesCount={categoryHealth.filter((item) => item.empty).length}
        />

        <PimReadinessSection pim={pim.data} />

        <WorkspaceSection title="Gestao de categorias oficiais">
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="space-y-5">
              <CategoryForm
                categoryDraft={categoryDraft}
                onCategoryDraftChange={setCategoryDraft}
                saving={savingTaxonomy}
                onSubmit={(event) => void createCategory(event)}
              />
            </div>

            <div className="grid gap-4">
              <CategoryList
                categoryHealth={categoryHealth}
                saving={savingTaxonomy}
                onMoveCategory={(category, direction) => void moveCategory(category, direction)}
                onToggleCategory={(category) => void toggleCategory(category)}
              />
            </div>
          </div>
        </WorkspaceSection>

        <StagingAndReviewSection staging={staging.data} workboard={workboard.data} reviewProducts={[...lowStock, ...withoutStock]} />

        <CatalogReadinessSection issues={catalogReadinessIssues} hasBlockersOrWarnings={catalogBlockers > 0 || catalogWarnings > 0} />

        <RoutineSection />
      </div>
    </AdminWorkspaceShell>
  );
}
