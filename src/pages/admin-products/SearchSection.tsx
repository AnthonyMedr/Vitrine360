import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminOperationalToolbar } from "@/components/admin/AdminPrimitives";
import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

const CHECKLIST_ITEMS = [
  "nome, slug, SKU e categoria",
  "status: rascunho, em revisão, publicado ou arquivado",
  "imagem principal coerente com a familia",
  "alt text SEO e acessivel",
  "descrição, aplicação e unidade",
  "status da imagem: pendente, aprovada, suspeita ou reprovada",
  "medidas, unidades, aplicações e especificações",
  "CTA de orçamento e WhatsApp validado",
];

export function SearchSection({
  query,
  onQueryChange,
  onResetSavedFilters,
  searchableCount,
  totalCount,
  publicationReadyCount,
  campaignReadyCount,
  quoteReadyCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onResetSavedFilters: () => void;
  searchableCount: number;
  totalCount: number;
  publicationReadyCount: number;
  campaignReadyCount: number;
  quoteReadyCount: number;
}) {
  return (
    <WorkspaceSection
      title="Busca e criterio minimo de publicação"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Filtros salvos neste navegador</Badge>
          <Button type="button" variant="outline" onClick={onResetSavedFilters}>Limpar filtros salvos</Button>
          <Button asChild variant="outline">
            <Link to="/admin/catálogo">Abrir catálogo</Link>
          </Button>
        </div>
      }
    >
      <AdminOperationalToolbar
        title="Consulta operacional de produtos"
        description="Localize produtos por familia, SKU, marca ou criterio comercial antes de publicar, revisar imagem ou liberar para campanha."
        resultLabel={`${searchableCount} produto(s) no recorte atual`}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            Buscar por nome, SKU, slug, categoria, marca, aplicação ou material
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                className="h-11 pl-9"
                placeholder="Ex.: forro, chapa UV, PVC-0001, Garanhuns..."
              />
            </div>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <WorkspaceMetric label="Resultado" value={searchableCount} detail={`${totalCount} no total`} />
            <WorkspaceMetric label="Publicaveis" value={publicationReadyCount} tone={publicationReadyCount > 0 ? "ok" : "warn"} />
            <WorkspaceMetric label="Prontos campanha" value={campaignReadyCount} tone={campaignReadyCount > 0 ? "ok" : "warn"} />
            <WorkspaceMetric label="Aptos orçamento" value={quoteReadyCount} tone={quoteReadyCount > 0 ? "ok" : "warn"} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/25 p-4">
          <p className="text-sm font-semibold">Checklist minimo antes de publicar produto</p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item} className="rounded-md border bg-background px-3 py-2">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Produto com imagem suspeita não deve entrar em vitrine ou campanha até revisão humana. Na Fase 1, o fechamento comercial acontece fora do site.
          </p>
        </div>
      </div>
    </WorkspaceSection>
  );
}
