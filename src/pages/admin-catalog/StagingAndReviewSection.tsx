import { Badge } from "@/components/ui/badge";
import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { Product, StagingSummary, StagingWorkboard } from "./types";

export function StagingAndReviewSection({
  staging,
  workboard,
  reviewProducts,
}: {
  staging: StagingSummary;
  workboard: StagingWorkboard;
  reviewProducts: Product[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <WorkspaceSection title="Staging de publicação">
        <div className="grid gap-3 md:grid-cols-3">
          <WorkspaceMetric label="Total staging" value={staging.total ?? workboard.metrics?.total ?? 0} />
          <WorkspaceMetric label="Em revisão" value={staging.review ?? workboard.metrics?.review ?? 0} tone="warn" />
          <WorkspaceMetric label="Diferidos" value={staging.deferred ?? workboard.metrics?.deferred ?? 0} />
        </div>
        <div className="mt-4 space-y-2">
          {(workboard.queues?.review ?? []).slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="font-semibold">{item.normalized_name || item.source_name || item.id}</p>
              {item.review_reason ? <p className="text-sm text-muted-foreground">{item.review_reason}</p> : null}
            </div>
          ))}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Produtos para conferencia comercial">
        <div className="space-y-3">
          {reviewProducts.slice(0, 6).map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="text-sm text-muted-foreground">SKU {product.sku || "-"} · {product.category?.name || "Sem categoria"}</p>
              </div>
              <Badge variant="outline">{product.stock} un.</Badge>
            </div>
          ))}
          {reviewProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sem produto com alerta de disponibilidade no momento.</p> : null}
        </div>
      </WorkspaceSection>
    </div>
  );
}
