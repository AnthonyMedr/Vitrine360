import { Link } from "react-router-dom";
import { CheckCircle2, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdminEmptyState } from "@/components/admin/AdminPrimitives";
import { WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";
import type { CatalogImageAuditResponse } from "./types";
import { buildReviewQueueLink, formatSlaLabel, getQueuePriority, type BatchMode, type QueuePriorityFilter, type QueueSlaFilter } from "./productWorkspaceHelpers";

export function ReviewQueueSection({
  imageAudit,
  criticalPlaceholdersCount,
  visualQuarantineCount,
  selectedQueueCount,
  filteredReviewQueueItems,
  visibleQueueItems,
  queuePrioritySummary,
  queuePriorityFilter,
  onQueuePriorityFilterChange,
  queueCategories,
  queueCategoryFilter,
  onQueueCategoryFilterChange,
  queueAssignees,
  queueAssigneeFilter,
  onQueueAssigneeFilterChange,
  queueSlaFilter,
  onQueueSlaFilterChange,
  selectedProductIds,
  onToggleSelection,
  onToggleVisibleQueueSelection,
  batchAssignee,
  onBatchAssigneeChange,
  batchDueDate,
  onBatchDueDateChange,
  batchNote,
  onBatchNoteChange,
  batchLoading,
  onBatchUpdateSelected,
  onClearQueueFilters,
}: {
  imageAudit: CatalogImageAuditResponse;
  criticalPlaceholdersCount: number;
  visualQuarantineCount: number;
  selectedQueueCount: number;
  filteredReviewQueueItems: CatalogImageAuditItem[];
  visibleQueueItems: CatalogImageAuditItem[];
  queuePrioritySummary: { critica: number; alta: number; media: number };
  queuePriorityFilter: QueuePriorityFilter;
  onQueuePriorityFilterChange: (value: QueuePriorityFilter) => void;
  queueCategories: string[];
  queueCategoryFilter: string;
  onQueueCategoryFilterChange: (value: string) => void;
  queueAssignees: string[];
  queueAssigneeFilter: string;
  onQueueAssigneeFilterChange: (value: string) => void;
  queueSlaFilter: QueueSlaFilter;
  onQueueSlaFilterChange: (value: QueueSlaFilter) => void;
  selectedProductIds: string[];
  onToggleSelection: (productId: string, checked: boolean) => void;
  onToggleVisibleQueueSelection: (checked: boolean) => void;
  batchAssignee: string;
  onBatchAssigneeChange: (value: string) => void;
  batchDueDate: string;
  onBatchDueDateChange: (value: string) => void;
  batchNote: string;
  onBatchNoteChange: (value: string) => void;
  batchLoading: null | BatchMode;
  onBatchUpdateSelected: (mode: BatchMode) => void;
  onClearQueueFilters: () => void;
}) {
  return (
    <WorkspaceSection
      title="Fila de revisão de imagens do catálogo"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">A IA sugere. O humano aprova. O sistema audita.</Badge>
          <Badge variant="secondary">{selectedQueueCount} selecionado(s)</Badge>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <WorkspaceMetric label="Critico ativo" value={imageAudit.active_summary.critical} detail={`${imageAudit.summary.critical} total`} tone={imageAudit.active_summary.critical > 0 ? "danger" : "ok"} />
        <WorkspaceMetric label="Placeholders criticos" value={criticalPlaceholdersCount} detail="Ativos com imagem invalida" tone={criticalPlaceholdersCount > 0 ? "danger" : "ok"} />
        <WorkspaceMetric label="Suspeito ativo" value={imageAudit.active_summary.suspect} detail={`${imageAudit.summary.suspect} total`} tone={imageAudit.active_summary.suspect > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Quarentena visual" value={visualQuarantineCount} detail="Retirados de publicação" tone={visualQuarantineCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Backlog inativo" value={imageAudit.inactive_summary.critical + imageAudit.inactive_summary.suspect} detail={`${imageAudit.inactive_summary.critical} critico(s)`} tone={imageAudit.inactive_summary.critical > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Revisão manual" value={imageAudit.summary.manual_review} tone={imageAudit.summary.manual_review > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Sem alt text ativo" value={imageAudit.active_summary.missing_alt_text} detail={`${imageAudit.summary.missing_alt_text} total`} tone={imageAudit.active_summary.missing_alt_text > 0 ? "warn" : "ok"} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        <div className="rounded-lg border bg-muted/25 p-3">
          <p className="text-sm font-semibold">Fila operacional por prioridade</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["all", "Todas", filteredReviewQueueItems.length],
              ["critica", "Critica", queuePrioritySummary.critica],
              ["alta", "Alta", queuePrioritySummary.alta],
              ["media", "Media", queuePrioritySummary.media],
            ].map(([value, label, count]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={queuePriorityFilter === value ? "default" : "outline"}
                onClick={() => onQueuePriorityFilterChange(value as QueuePriorityFilter)}
              >
                {label} ({count})
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/25 p-3">
          <p className="text-sm font-semibold">Fila por categoria</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={queueCategoryFilter === "all" ? "default" : "outline"} onClick={() => onQueueCategoryFilterChange("all")}>
              Todas
            </Button>
            {queueCategories.slice(0, 8).map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={queueCategoryFilter === category ? "default" : "outline"}
                onClick={() => onQueueCategoryFilterChange(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/25 p-3">
          <p className="text-sm font-semibold">Fila por responsável</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={queueAssigneeFilter === "all" ? "default" : "outline"} onClick={() => onQueueAssigneeFilterChange("all")}>
              Todos
            </Button>
            <Button type="button" size="sm" variant={queueAssigneeFilter === "Sem responsável" ? "default" : "outline"} onClick={() => onQueueAssigneeFilterChange("Sem responsável")}>
              Sem responsável
            </Button>
            {queueAssignees.slice(0, 6).map((assignee) => (
              <Button key={assignee} type="button" size="sm" variant={queueAssigneeFilter === assignee ? "default" : "outline"} onClick={() => onQueueAssigneeFilterChange(assignee)}>
                {assignee}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/25 p-3">
          <p className="text-sm font-semibold">SLA da fila</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["all", "Todos"],
              ["overdue", "Vencido"],
              ["due_soon", "Vence em 48h"],
              ["scheduled", "No prazo"],
              ["unassigned", "Sem responsável"],
            ].map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={queueSlaFilter === value ? "default" : "outline"} onClick={() => onQueueSlaFilterChange(value as QueueSlaFilter)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/25 p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={visibleQueueItems.every((item) => selectedProductIds.includes(item.product_id)) && visibleQueueItems.length > 0}
            onCheckedChange={(checked) => onToggleVisibleQueueSelection(Boolean(checked))}
          />
          <span className="text-sm font-medium">Selecionar fila visivel</span>
        </div>
        <Input
          value={batchAssignee}
          onChange={(event) => onBatchAssigneeChange(event.target.value)}
          placeholder="Responsável da fila"
          className="h-9 min-w-[180px]"
        />
        <Input
          value={batchDueDate}
          onChange={(event) => onBatchDueDateChange(event.target.value)}
          placeholder="Prazo AAAA-MM-DD"
          className="h-9 min-w-[160px]"
        />
        <Input
          value={batchNote}
          onChange={(event) => onBatchNoteChange(event.target.value)}
          placeholder="Observacao em lote para auditoria"
          className="h-9 min-w-[240px] flex-1"
        />
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("assign")}>
          {batchLoading === "assign" ? "Aplicando..." : "Atribuir responsável e prazo"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("manual_review")}>
          {batchLoading === "manual_review" ? "Aplicando..." : "Manter em revisão"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("approve")}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {batchLoading === "approve" ? "Aplicando..." : "Aprovar com observacao"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("approve_duplicate")}>
          {batchLoading === "approve_duplicate" ? "Aplicando..." : "Aprovar duplicidade"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("approve_generic")}>
          {batchLoading === "approve_generic" ? "Aplicando..." : "Aprovar imagem generica"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("approve_metadata")}>
          {batchLoading === "approve_metadata" ? "Aplicando..." : "Aprovar metadado"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("clear_overrides")}>
          {batchLoading === "clear_overrides" ? "Aplicando..." : "Limpar overrides"}
        </Button>
        <Button size="sm" variant="outline" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("reopen")}>
          {batchLoading === "reopen" ? "Aplicando..." : "Reabrir revisão"}
        </Button>
        <Button size="sm" variant="destructive" disabled={selectedQueueCount === 0 || batchLoading !== null} onClick={() => onBatchUpdateSelected("quarantine")}>
          <PauseCircle className="mr-2 h-4 w-4" />
          {batchLoading === "quarantine" ? "Aplicando..." : "Retirar de publicação"}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {visibleQueueItems.map((item) => (
          <div key={item.product_id} className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Checkbox checked={selectedProductIds.includes(item.product_id)} onCheckedChange={(checked) => onToggleSelection(item.product_id, Boolean(checked))} />
              <Link to={buildReviewQueueLink(item, queuePriorityFilter, queueCategoryFilter)} className="min-w-0">
                <p className="font-semibold">{item.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  SKU {item.sku || "-"} - {item.category_name || "Sem categoria"} - {item.is_active ? "ativo" : "inativo"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.recommended_action}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Responsável: {item.review_assignee || "Sem responsável"} - SLA: {formatSlaLabel(item.review_sla_status, item.review_due_date)}
                </p>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getQueuePriority(item) === "critica" ? "destructive" : getQueuePriority(item) === "alta" ? "outline" : "secondary"}>
                prioridade {getQueuePriority(item)}
              </Badge>
              <Badge variant={item.is_active ? "default" : "secondary"}>
                {item.is_active ? "ativo" : "backlog inativo"}
              </Badge>
              <Badge variant={item.audit_status === "critical" ? "destructive" : item.audit_status === "suspect" ? "outline" : item.audit_status === "manual_review" ? "secondary" : "default"}>
                {item.audit_status}
              </Badge>
              {item.issues.slice(0, 3).map((issue) => (
                <Badge key={`${item.product_id}-${issue.code}`} variant="outline">
                  {issue.label}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {filteredReviewQueueItems.length === 0 ? (
          <AdminEmptyState
            title="Sem item na fila para este recorte de prioridade/categoria."
            description="Ajuste prioridade, categoria, responsável ou SLA para encontrar outros itens de curadoria visual."
            action={<Button type="button" variant="outline" onClick={onClearQueueFilters}>Limpar filtros da fila</Button>}
          />
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
