import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

export function TaxonomyMetricsSection({
  activeCategoriesCount,
  totalCategoriesCount,
  activeBrandsCount,
  totalBrandsCount,
  withoutImageCount,
  withoutStockCount,
  inReviewCount,
  emptyCategoriesCount,
}: {
  activeCategoriesCount: number;
  totalCategoriesCount: number;
  activeBrandsCount: number;
  totalBrandsCount: number;
  withoutImageCount: number;
  withoutStockCount: number;
  inReviewCount: number;
  emptyCategoriesCount: number;
}) {
  return (
    <WorkspaceSection title="Categorias, marcas e base comercial">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <WorkspaceMetric label="Categorias ativas" value={activeCategoriesCount} detail={`${totalCategoriesCount} totais`} />
        <WorkspaceMetric label="Marcas ativas" value={activeBrandsCount} detail={`${totalBrandsCount} totais`} />
        <WorkspaceMetric label="Sem imagem" value={withoutImageCount} tone={withoutImageCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Disponibilidade a confirmar" value={withoutStockCount} tone={withoutStockCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Produtos em revisão" value={inReviewCount} />
        <WorkspaceMetric label="Categorias vazias" value={emptyCategoriesCount} tone={emptyCategoriesCount > 0 ? "warn" : "ok"} />
      </div>
    </WorkspaceSection>
  );
}
