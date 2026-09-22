import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { formatReadinessIssue } from "./catalogHelpers";
import type { CatalogReadinessIssue } from "./types";

export function CatalogReadinessSection({
  issues,
  hasBlockersOrWarnings,
}: {
  issues: CatalogReadinessIssue[];
  hasBlockersOrWarnings: boolean;
}) {
  return (
    <WorkspaceSection title="Prontidao do catálogo assistido">
      <div className="space-y-3">
        {issues.slice(0, 8).map((check, index) => (
          <div key={`${check.item || check.id || check.name || "item"}-${index}`} className="rounded-lg border p-3">
            <p className="font-semibold">{check.item || check.name || check.id || "Pendencia de catálogo"}</p>
            <p className="text-sm text-muted-foreground">{formatReadinessIssue(check)}</p>
          </div>
        ))}
        {!hasBlockersOrWarnings ? <p className="text-sm text-muted-foreground">Catalogo sem bloqueios reportados para atendimento assistido.</p> : null}
      </div>
    </WorkspaceSection>
  );
}
