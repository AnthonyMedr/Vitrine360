import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

export function QualityIndicatorsSection({
  lowStockCount,
  withoutLogisticsCount,
  missingAltTextCount,
  riskProductsCount,
  duplicateImageCount,
}: {
  lowStockCount: number;
  withoutLogisticsCount: number;
  missingAltTextCount: number;
  riskProductsCount: number;
  duplicateImageCount: number;
}) {
  return (
    <WorkspaceSection title="Indicadores de qualidade">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceMetric label="Disponibilidade baixa" value={lowStockCount} tone={lowStockCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Sem medidas" value={withoutLogisticsCount} tone={withoutLogisticsCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Alt text ausente" value={missingAltTextCount} tone={missingAltTextCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Riscos totais" value={riskProductsCount} detail={`${duplicateImageCount} duplicidade(s) suspeita(s)`} tone={riskProductsCount > 0 ? "warn" : "ok"} />
      </div>
    </WorkspaceSection>
  );
}
