import { Link } from "react-router-dom";
import { PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";
import type { LocalProduct } from "@/lib/localCommerce";
import { getNextAction, getResponsibleArea, isDeferredSku, type RiskFilter } from "./productWorkspaceHelpers";

const RISK_FILTER_OPTIONS: Array<[RiskFilter, string]> = [
  ["all", "Todos"],
  ["campaign-ready", "Prontos campanha"],
  ["visual-quarantine", "Quarentena visual"],
  ["placeholder-critical", "Placeholder critico"],
  ["soft-launch", "Aptos soft launch"],
  ["fiscal", "Revisão técnica"],
  ["image", "Sem imagem"],
  ["image-suspect", "Imagem suspeita"],
  ["image-inactive", "Backlog inativo"],
  ["alt", "Alt text"],
  ["stock", "Disponibilidade"],
  ["logistics", "Medidas"],
  ["deferred", "Diferidos"],
];

export function RiskProductsSection({
  riskFilter,
  onRiskFilterChange,
  filteredRiskProducts,
  quarantineProductId,
  onQuarantineProduct,
}: {
  riskFilter: RiskFilter;
  onRiskFilterChange: (value: RiskFilter) => void;
  filteredRiskProducts: Array<{ product: LocalProduct; issues: string[]; audit?: CatalogImageAuditItem }>;
  quarantineProductId: string | null;
  onQuarantineProduct: (product: LocalProduct, audit?: CatalogImageAuditItem) => void;
}) {
  return (
    <WorkspaceSection
      title="Produtos com maior risco operacional"
      action={
        <div className="flex flex-wrap gap-2">
          {RISK_FILTER_OPTIONS.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={riskFilter === value ? "default" : "outline"}
              onClick={() => onRiskFilterChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        {filteredRiskProducts.slice(0, 18).map(({ product, issues, audit }) => {
          const canQuarantine = product.is_active && (issues.includes("imagem critica") || issues.includes("sem imagem"));
          const isQuarantining = quarantineProductId === product.id;
          return (
            <div key={product.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <Link to={`/admin/produto/${product.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU {product.sku || "-"} - {product.category?.name || "Sem categoria"} - disponibilidade {product.stock}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Responsável: {getResponsibleArea(issues)}
                    {" - "}
                    Próxima acao: {getNextAction(issues)}
                  </p>
                </Link>
                <div className="flex flex-wrap gap-2">
                  {issues.map((issue) => (
                    <Badge key={issue} variant={issue === "revisão técnica pendente" || issue === "imagem critica" ? "destructive" : "outline"}>
                      {issue}
                    </Badge>
                  ))}
                  {audit ? (
                    <Badge variant={audit.audit_status === "critical" ? "destructive" : audit.audit_status === "suspect" ? "outline" : "secondary"}>
                      {audit.audit_status}
                    </Badge>
                  ) : null}
                  {isDeferredSku(product.sku) ? <Badge variant="secondary">diferido</Badge> : null}
                </div>
              </div>
              {canQuarantine ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={isQuarantining} onClick={() => onQuarantineProduct(product, audit)}>
                    <PauseCircle className="mr-2 h-4 w-4" />
                    {isQuarantining ? "Retirando..." : "Retirar de publicação"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/produto/${product.id}`}>Abrir editor</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        {filteredRiskProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sem produto nesta fila de filtro.</p> : null}
      </div>
    </WorkspaceSection>
  );
}
