import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { PimReadiness } from "./types";

export function PimReadinessSection({ pim }: { pim: PimReadiness }) {
  return (
    <WorkspaceSection title="PIM / readiness do catálogo">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <WorkspaceMetric label="Publicaveis" value={pim.totals.publishable} />
        <WorkspaceMetric label="Prontos campanha" value={pim.totals.ready_for_campaign} />
        <WorkspaceMetric label="Bloqueados imagem" value={pim.totals.blocked_by_image} tone={pim.totals.blocked_by_image > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Revisão técnica" value={pim.totals.blocked_by_fiscal} tone={pim.totals.blocked_by_fiscal > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Score baixo" value={pim.totals.low_score} tone={pim.totals.low_score > 0 ? "warn" : "ok"} />
      </div>
      <div className="mt-4 space-y-2">
        {pim.category_summary.slice(0, 8).map((item) => (
          <div key={item.category_name} className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between">
            <span className="font-medium">{item.category_name}</span>
            <span className="text-muted-foreground">
              {item.ready_for_campaign} prontos vitrine | {item.blocked_by_image} imagem | {item.blocked_by_fiscal} revisao tecnica | {item.low_score} score baixo
            </span>
          </div>
        ))}
      </div>
    </WorkspaceSection>
  );
}
