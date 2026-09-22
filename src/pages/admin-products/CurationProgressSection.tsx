import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { CatalogImageAuditResponse } from "./types";

export function CurationProgressSection({ imageAudit }: { imageAudit: CatalogImageAuditResponse }) {
  return (
    <WorkspaceSection title="Progresso da curadoria visual">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <WorkspaceMetric
          label="Pendentes ativos"
          value={imageAudit.active_summary.critical + imageAudit.active_summary.suspect + imageAudit.active_summary.manual_review}
          detail={`${imageAudit.summary.total} SKU(s) auditado(s)`}
          tone={imageAudit.active_summary.critical + imageAudit.active_summary.suspect > 0 ? "warn" : "ok"}
        />
        <WorkspaceMetric
          label="Excecoes aprovadas"
          value={imageAudit.summary.human_override_total}
          detail="Liberadas por aprovacao humana auditavel"
          tone={imageAudit.summary.human_override_total > 0 ? "ok" : "neutral"}
        />
        <WorkspaceMetric
          label="Duplicidade aprovada"
          value={imageAudit.summary.duplicate_override}
          detail={`${imageAudit.summary.generic_override} generica(s), ${imageAudit.summary.metadata_override} metadado(s)`}
          tone={imageAudit.summary.duplicate_override > 0 ? "ok" : "neutral"}
        />
        <WorkspaceMetric
          label="Categorias com backlog"
          value={imageAudit.category_summary.filter((category) => category.suspect > 0 || category.critical > 0 || category.manual_review > 0).length}
          detail="Familias com fila de curadoria"
          tone={imageAudit.category_summary.some((category) => category.suspect > 0 || category.critical > 0) ? "warn" : "ok"}
        />
        <WorkspaceMetric
          label="Responsáveis definidos"
          value={imageAudit.assignment_summary.assigned_total}
          detail={`${imageAudit.assignment_summary.unassigned_total} sem responsável`}
          tone={imageAudit.assignment_summary.unassigned_total > 0 ? "warn" : "ok"}
        />
        <WorkspaceMetric
          label="SLA vencido"
          value={imageAudit.assignment_summary.overdue_total}
          detail={`${imageAudit.assignment_summary.due_soon_total} vencendo em 48h`}
          tone={imageAudit.assignment_summary.overdue_total > 0 ? "danger" : imageAudit.assignment_summary.due_soon_total > 0 ? "warn" : "ok"}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {imageAudit.assignment_summary.assignees.slice(0, 4).map((assignee) => (
          <div key={assignee.name} className="rounded-lg border p-3">
            <p className="font-semibold">{assignee.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {assignee.total} item(ns) - {assignee.overdue} vencido(s) - {assignee.due_soon} vencendo
            </p>
          </div>
        ))}
        {imageAudit.assignment_summary.assignees.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum responsável definido na fila visual.</p> : null}
      </div>
    </WorkspaceSection>
  );
}
