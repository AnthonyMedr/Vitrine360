import { Link } from "react-router-dom";
import { PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";
import type { LocalProduct } from "@/lib/localCommerce";

export function CriticalPlaceholdersSection({
  products,
  imageAuditMap,
  quarantineProductId,
  onQuarantineProduct,
}: {
  products: LocalProduct[];
  imageAuditMap: Map<string, CatalogImageAuditItem>;
  quarantineProductId: string | null;
  onQuarantineProduct: (product: LocalProduct, audit?: CatalogImageAuditItem) => void;
}) {
  return (
    <WorkspaceSection
      title="Placeholders criticos ativos"
      action={<Badge variant="outline">corrigir ou retirar antes de campanha</Badge>}
    >
      <div className="space-y-3">
        {products.slice(0, 12).map((product) => {
          const audit = imageAuditMap.get(product.id);
          const isQuarantining = quarantineProductId === product.id;
          return (
            <div key={product.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU {product.sku || "-"} - {product.category?.name || "Sem categoria"} - disponibilidade {product.stock}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {(audit?.issues.filter((issue) => issue.code === "placeholder_image" || issue.code === "missing_image").map((issue) => issue.label).join(", ")) || "Imagem principal invalida para catálogo/vitrine."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={isQuarantining} onClick={() => onQuarantineProduct(product, audit)}>
                    <PauseCircle className="mr-2 h-4 w-4" />
                    {isQuarantining ? "Retirando..." : "Retirar de publicação"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/produto/${product.id}`}>Corrigir no editor</Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {products.length === 0 ? <p className="text-sm text-muted-foreground">Sem placeholder critico ativo nesta busca.</p> : null}
      </div>
    </WorkspaceSection>
  );
}
