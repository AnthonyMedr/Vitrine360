import { Badge } from "@/components/ui/badge";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { CatalogImageAuditResponse } from "./types";

export function CategoryPlanSection({
  categorySummary,
  onSelectCategory,
}: {
  categorySummary: CatalogImageAuditResponse["category_summary"];
  onSelectCategory: (categoryName: string) => void;
}) {
  return (
    <WorkspaceSection
      title="Plano operacional por categoria"
      action={<Badge variant="outline">curadoria orientada por familia comercial</Badge>}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categorySummary.slice(0, 12).map((category) => (
          <button
            key={category.category_name}
            type="button"
            onClick={() => onSelectCategory(category.category_name)}
            className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{category.category_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {category.active} ativo(s), {category.inactive} inativo(s), {category.total} no backlog visual
                </p>
              </div>
              <Badge variant={category.critical > 0 ? "destructive" : category.suspect > 0 ? "outline" : "secondary"}>
                {category.critical > 0 ? "critico" : category.suspect > 0 ? "suspeito" : "revisão"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="rounded-md border bg-muted/20 px-2 py-2">Criticos: <span className="font-semibold text-foreground">{category.critical}</span></div>
              <div className="rounded-md border bg-muted/20 px-2 py-2">Suspeitos: <span className="font-semibold text-foreground">{category.suspect}</span></div>
              <div className="rounded-md border bg-muted/20 px-2 py-2">Genericos: <span className="font-semibold text-foreground">{category.generic_image}</span></div>
              <div className="rounded-md border bg-muted/20 px-2 py-2">Duplicados: <span className="font-semibold text-foreground">{category.duplicate_image}</span></div>
              <div className="rounded-md border bg-muted/20 px-2 py-2">Overrides: <span className="font-semibold text-foreground">{category.human_override_total}</span></div>
              <div className="rounded-md border bg-muted/20 px-2 py-2">Metadado OK: <span className="font-semibold text-foreground">{category.metadata_override}</span></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Próxima acao: revisar visualmente a familia, confirmar foto-base valida e reabrir itens que ainda não podem ir para campanha.
            </p>
          </button>
        ))}
      </div>
      {categorySummary.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem backlog visual agrupado por categoria neste momento.</p>
      ) : null}
    </WorkspaceSection>
  );
}
