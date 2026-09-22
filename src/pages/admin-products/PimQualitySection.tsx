import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { PimReadinessResponse } from "./types";

export function PimQualitySection({ pimReadiness }: { pimReadiness: PimReadinessResponse }) {
  return (
    <WorkspaceSection title="PIM e qualidade do produto" action={<Button asChild variant="outline"><Link to="/admin/catalogo">Readiness PIM</Link></Button>}>
      <div className="grid gap-4 xl:grid-cols-5">
        <WorkspaceMetric label="Publicaveis" value={pimReadiness.totals.publishable} tone={pimReadiness.totals.publishable > 0 ? "ok" : "warn"} />
        <WorkspaceMetric label="Prontos campanha" value={pimReadiness.totals.ready_for_campaign} />
        <WorkspaceMetric label="Prontos home" value={pimReadiness.totals.ready_for_home} />
        <WorkspaceMetric label="Score baixo" value={pimReadiness.totals.low_score} tone={pimReadiness.totals.low_score > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Quase prontos" value={pimReadiness.totals.near_ready} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="font-semibold">Categorias mais criticas</p>
          <div className="mt-3 space-y-2">
            {pimReadiness.category_summary.slice(0, 6).map((item) => (
              <div key={item.category_name} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.category_name}</span>
                <span className="text-muted-foreground">
                  {item.low_score} score baixo | {item.blocked_by_image} imagem | {item.blocked_by_fiscal} revisao tecnica
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <p className="font-semibold">Fila de menor score</p>
          <div className="mt-3 space-y-2">
            {pimReadiness.lowest_scores.slice(0, 6).map((item) => (
              <div key={item.product_id} className="flex items-center justify-between gap-3 text-sm">
                <Link className="font-medium text-primary hover:underline" to={`/admin/produto/${item.product_id}`}>{item.product_name || "Produto sem nome"}</Link>
                <span className="text-muted-foreground">score {item.product_completeness_score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceSection>
  );
}
