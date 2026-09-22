import { Link, Navigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useAdminPersistentState } from "@/hooks/useAdminPersistentState";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric } from "@/components/admin/AdminWorkspaceShell";
import { buildAuditDirective } from "@/lib/catalogImageAudit";
import type { LocalProduct } from "@/lib/localCommerce";
import type { AdminUserOption, CatalogImageAuditResponse, PimReadinessResponse } from "./admin-products/types";
import {
  appendAuditOverride,
  buildQuarantineNote,
  getProductIssues,
  isDeferredSku,
  isProductReadyForCampaign,
  isProductReadyForPublication,
  isProductReadyForQuote,
  isVisualQuarantineProduct,
  getQueuePriority,
  queuePriorityWeight,
  removeAuditOverrides,
  type BatchMode,
  type QueuePriorityFilter,
  type QueueSlaFilter,
  type RiskFilter,
} from "./admin-products/productWorkspaceHelpers";
import { PimQualitySection } from "./admin-products/PimQualitySection";
import { CatalogModelSection } from "./admin-products/CatalogModelSection";
import { SearchSection } from "./admin-products/SearchSection";
import { QualityIndicatorsSection } from "./admin-products/QualityIndicatorsSection";
import { CurationProgressSection } from "./admin-products/CurationProgressSection";
import { ReviewQueueSection } from "./admin-products/ReviewQueueSection";
import { CategoryPlanSection } from "./admin-products/CategoryPlanSection";
import { CriticalPlaceholdersSection } from "./admin-products/CriticalPlaceholdersSection";
import { BulkEditSection } from "./admin-products/BulkEditSection";
import { RiskProductsSection } from "./admin-products/RiskProductsSection";

const EMPTY_AUDIT_SUMMARY = {
  total: 0,
  ok: 0,
  manual_review: 0,
  suspect: 0,
  critical: 0,
  missing_image: 0,
  missing_alt_text: 0,
  duplicate_image: 0,
  generic_image: 0,
  metadata_mismatch: 0,
  duplicate_override: 0,
  generic_override: 0,
  metadata_override: 0,
  human_override_total: 0,
};

const EMPTY_IMAGE_AUDIT: CatalogImageAuditResponse = {
  summary: EMPTY_AUDIT_SUMMARY,
  active_summary: EMPTY_AUDIT_SUMMARY,
  inactive_summary: EMPTY_AUDIT_SUMMARY,
  category_summary: [],
  assignment_summary: {
    assigned_total: 0,
    unassigned_total: 0,
    overdue_total: 0,
    due_soon_total: 0,
    scheduled_total: 0,
    assignees: [],
  },
  items: [],
};

const EMPTY_PIM_READINESS: PimReadinessResponse = {
  totals: {
    products: 0,
    publishable: 0,
    ready_for_campaign: 0,
    ready_for_home: 0,
    ready_for_traffic: 0,
    assisted_operation_ready: 0,
    blocked_by_image: 0,
    blocked_by_fiscal: 0,
    missing_seo: 0,
    missing_application: 0,
    missing_category: 0,
    missing_material: 0,
    missing_measure: 0,
    low_score: 0,
    near_ready: 0,
  },
  category_summary: [],
  lowest_scores: [],
};

export default function AdminProductsWorkspace() {
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const products = useAdminResource<LocalProduct[]>(isAdmin ? "/api/admin/products" : null, []);
  const categoriesResource = useAdminResource<Array<{ id: string; name: string; is_active: boolean }>>(isAdmin ? "/api/admin/categories" : null, []);
  const imageAudit = useAdminResource<CatalogImageAuditResponse>(isAdmin ? "/api/admin/catalog/image-audit" : null, EMPTY_IMAGE_AUDIT);
  const pimReadiness = useAdminResource<PimReadinessResponse>(isAdmin ? "/api/admin/catalog/pim-readiness" : null, EMPTY_PIM_READINESS);
  const adminUsers = useAdminResource<AdminUserOption[]>(isAdmin ? "/api/admin/users" : null, []);
  const [riskFilter, setRiskFilter, resetRiskFilter] = useAdminPersistentState<RiskFilter>("admin:products:risk-filter", "all");
  const [query, setQuery, resetQuery] = useAdminPersistentState("admin:products:query", "");
  const [quarantineProductId, setQuarantineProductId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState<null | BatchMode>(null);
  const [queuePriorityFilter, setQueuePriorityFilter, resetQueuePriorityFilter] = useAdminPersistentState<QueuePriorityFilter>("admin:products:queue-priority-filter", "all");
  const [queueCategoryFilter, setQueueCategoryFilter, resetQueueCategoryFilter] = useAdminPersistentState("admin:products:queue-category-filter", "all");
  const [queueAssigneeFilter, setQueueAssigneeFilter, resetQueueAssigneeFilter] = useAdminPersistentState("admin:products:queue-assignee-filter", "all");
  const [queueSlaFilter, setQueueSlaFilter, resetQueueSlaFilter] = useAdminPersistentState<QueueSlaFilter>("admin:products:queue-sla-filter", "all");
  const [batchAssignee, setBatchAssignee] = useState("");
  const [batchDueDate, setBatchDueDate] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [bulkEditQuery, setBulkEditQuery] = useState("");
  const [bulkEditSelectedIds, setBulkEditSelectedIds] = useState<string[]>([]);
  const [bulkEditCategoryId, setBulkEditCategoryId] = useState<string>("__keep__");
  const [bulkEditStatus, setBulkEditStatus] = useState<string>("__keep__");
  const [bulkEditActive, setBulkEditActive] = useState<string>("__keep__");
  const [bulkEditApplying, setBulkEditApplying] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const imageAuditMap = useMemo(() => new Map(imageAudit.data.items.map((item) => [item.product_id, item])), [imageAudit.data.items]);
  const productMap = useMemo(() => new Map(products.data.map((product) => [product.id, product])), [products.data]);
  const searchableProducts = useMemo(() => {
    if (!normalizedQuery) return products.data;
    return products.data.filter((product) =>
      [
        product.name,
        product.sku,
        product.slug,
        product.category?.name,
        product.brand?.name,
        product.application,
        product.material,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, products.data]);

  const active = searchableProducts.filter((product) => product.is_active);
  const inactive = searchableProducts.filter((product) => !product.is_active);
  const withoutImage = searchableProducts.filter((product) => !product.image_url && product.images.length === 0);
  const withoutStock = searchableProducts.filter((product) => Number(product.stock) <= 0);
  const lowStock = searchableProducts.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= 5);
  const withoutFiscal = searchableProducts.filter((product) => !product.ncm || product.tax_classification_status !== "ready");
  const withoutLogistics = searchableProducts.filter((product) => !product.weight && !product.weight_per_unit && !product.weight_per_package);
  const suspiciousImages = searchableProducts.filter((product) => {
    const audit = imageAuditMap.get(product.id);
    return audit?.audit_status === "suspect" || audit?.audit_status === "critical";
  });
  const manualReviewImages = searchableProducts.filter((product) => imageAuditMap.get(product.id)?.audit_status === "manual_review");
  const missingAltText = searchableProducts.filter((product) => imageAuditMap.get(product.id)?.issues.some((issue) => issue.code === "missing_alt_text"));
  const visualQuarantine = searchableProducts.filter((product) => isVisualQuarantineProduct(product));
  const criticalPlaceholders = searchableProducts.filter((product) => {
    const audit = imageAuditMap.get(product.id);
    return product.is_active && Boolean(audit?.issues.some((issue) => issue.code === "placeholder_image" || issue.code === "missing_image"));
  });
  const publicationReady = searchableProducts.filter(isProductReadyForPublication);
  const campaignReady = searchableProducts.filter((product) => isProductReadyForCampaign(product, imageAuditMap.get(product.id)));
  const quoteReady = searchableProducts.filter(isProductReadyForQuote);
  const riskProducts = searchableProducts
    .map((product) => {
      const audit = imageAuditMap.get(product.id);
      return { product, issues: getProductIssues(product, audit), audit };
    })
    .filter((entry) => entry.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length);
  const reviewQueueItems = useMemo(
    () =>
      imageAudit.data.items
        .slice()
        .sort((a, b) => {
          const severityDiff = queuePriorityWeight(getQueuePriority(a)) - queuePriorityWeight(getQueuePriority(b));
          if (severityDiff !== 0) return severityDiff;
          const activeRank = Number(b.is_active) - Number(a.is_active);
          if (activeRank !== 0) return activeRank;
          return a.product_name.localeCompare(b.product_name);
        }),
    [imageAudit.data.items],
  );
  const queueCategories = useMemo(
    () =>
      Array.from(
        new Set(
          reviewQueueItems
            .map((item) => item.category_name?.trim())
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reviewQueueItems],
  );
  const queueAssignees = useMemo(
    () =>
      Array.from(
        new Set([
          ...reviewQueueItems.map((item) => item.review_assignee).filter(Boolean),
          ...adminUsers.data.map((user) => user.user_metadata?.full_name?.trim()).filter(Boolean),
        ]),
      ).sort((a, b) => String(a).localeCompare(String(b))) as string[],
    [adminUsers.data, reviewQueueItems],
  );
  const filteredReviewQueueItems = useMemo(
    () =>
      reviewQueueItems.filter((item) => {
        if (queuePriorityFilter !== "all" && getQueuePriority(item) !== queuePriorityFilter) return false;
        if (queueCategoryFilter !== "all" && (item.category_name || "Sem categoria") !== queueCategoryFilter) return false;
        if (queueAssigneeFilter !== "all" && (item.review_assignee || "Sem responsável") !== queueAssigneeFilter) return false;
        if (queueSlaFilter !== "all" && item.review_sla_status !== queueSlaFilter) return false;
        return true;
      }),
    [queueAssigneeFilter, queueCategoryFilter, queuePriorityFilter, queueSlaFilter, reviewQueueItems],
  );
  const visibleQueueItems = useMemo(() => filteredReviewQueueItems.slice(0, 12), [filteredReviewQueueItems]);
  const selectedProducts = useMemo(
    () => selectedProductIds.map((id) => productMap.get(id)).filter(Boolean) as LocalProduct[],
    [productMap, selectedProductIds],
  );
  const selectedQueueCount = selectedProductIds.length;
  const queuePrioritySummary = useMemo(
    () => ({
      critica: reviewQueueItems.filter((item) => getQueuePriority(item) === "critica").length,
      alta: reviewQueueItems.filter((item) => getQueuePriority(item) === "alta").length,
      media: reviewQueueItems.filter((item) => getQueuePriority(item) === "media").length,
    }),
    [reviewQueueItems],
  );
  const filteredRiskProducts = useMemo(() => {
    return riskProducts.filter(({ product, issues, audit }) => {
      if (riskFilter === "all") return true;
      if (riskFilter === "campaign-ready") return isProductReadyForCampaign(product, audit);
      if (riskFilter === "visual-quarantine") return isVisualQuarantineProduct(product);
      if (riskFilter === "placeholder-critical") return product.is_active && Boolean(audit?.issues.some((issue) => issue.code === "placeholder_image" || issue.code === "missing_image"));
      if (riskFilter === "soft-launch") return product.is_active && !issues.includes("sem imagem") && !issues.includes("disponibilidade pendente");
      if (riskFilter === "fiscal") return issues.includes("revisão técnica pendente");
      if (riskFilter === "image") return issues.includes("sem imagem");
      if (riskFilter === "image-suspect") return audit?.audit_status === "suspect" || audit?.audit_status === "critical";
      if (riskFilter === "image-inactive") return !product.is_active && (audit?.audit_status === "suspect" || audit?.audit_status === "critical");
      if (riskFilter === "alt") return audit?.issues.some((issue) => issue.code === "missing_alt_text");
      if (riskFilter === "stock") return issues.includes("disponibilidade pendente") || issues.includes("disponibilidade baixa");
      if (riskFilter === "logistics") return issues.includes("sem medidas") || issues.includes("produto volumoso");
      if (riskFilter === "deferred") return isDeferredSku(product.sku);
      return true;
    });
  }, [riskFilter, riskProducts]);

  const bulkEditFilteredProducts = useMemo(() => {
    const normalized = bulkEditQuery.trim().toLowerCase();
    if (!normalized) return products.data;
    return products.data.filter((product) =>
      product.name.toLowerCase().includes(normalized) || (product.sku || "").toLowerCase().includes(normalized),
    );
  }, [products.data, bulkEditQuery]);

  function toggleBulkEditSelection(productId: string, checked: boolean) {
    setBulkEditSelectedIds((current) => (checked ? Array.from(new Set([...current, productId])) : current.filter((id) => id !== productId)));
  }

  async function applyBulkEdit() {
    if (bulkEditSelectedIds.length === 0) return;
    const patch: Record<string, unknown> = {};
    if (bulkEditCategoryId !== "__keep__") patch.category_id = bulkEditCategoryId;
    if (bulkEditStatus !== "__keep__") patch.status_product = bulkEditStatus;
    if (bulkEditActive !== "__keep__") patch.is_active = bulkEditActive === "true";
    if (Object.keys(patch).length === 0) {
      toast({ title: "Nada para aplicar", description: "Escolha ao menos um campo para alterar em lote.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Aplicar essa alteração a ${bulkEditSelectedIds.length} produto(s) selecionado(s)?`)) return;
    setBulkEditApplying(true);
    try {
      const result = await apiFetch<{ updated_count: number; skipped_ids: string[] }>("/api/admin/products/batch", {
        method: "PATCH",
        body: JSON.stringify({ ids: bulkEditSelectedIds, patch }),
      });
      await products.reload();
      setBulkEditSelectedIds([]);
      setBulkEditCategoryId("__keep__");
      setBulkEditStatus("__keep__");
      setBulkEditActive("__keep__");
      toast({
        title: `${result.updated_count} produto(s) atualizado(s)`,
        description: result.skipped_ids.length > 0 ? `${result.skipped_ids.length} produto(s) ignorado(s) (ex.: ativação sem imagem real).` : undefined,
      });
    } catch (error) {
      toast({ title: "Falha ao aplicar edição em lote", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBulkEditApplying(false);
    }
  }

  const resetSavedFilters = () => {
    resetQuery();
    resetRiskFilter();
    resetQueuePriorityFilter();
    resetQueueCategoryFilter();
    resetQueueAssigneeFilter();
    resetQueueSlaFilter();
  };

  if (loading) return <AdminLoadingState label="Carregando produtos..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  async function quarantineProduct(product: LocalProduct, audit?: import("@/lib/catalogImageAudit").CatalogImageAuditItem) {
    if (!window.confirm(`Retirar "${product.name}" de publicação? O produto sai do catálogo até revisão manual.`)) {
      return;
    }
    setQuarantineProductId(product.id);
    try {
      await apiFetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: false,
          is_featured: false,
          status_product: "draft",
          availability: "sob_consulta",
          image_review_status: audit?.audit_status === "suspect" ? "suspect" : "manual_review",
          image_review_notes: buildQuarantineNote(product, audit),
        }),
      });
      toast({
        title: "Produto retirado de publicação",
        description: `${product.name} foi movido para revisão manual no catálogo.`,
      });
      await products.reload();
      await imageAudit.reload();
    } catch (error) {
      toast({
        title: "Falha ao retirar produto",
        description: error instanceof Error ? error.message : "Revise permissao, imagem e estado do cadastro.",
        variant: "destructive",
      });
    } finally {
      setQuarantineProductId(null);
    }
  }

  function toggleSelection(productId: string, checked: boolean) {
    setSelectedProductIds((current) => (checked ? [...new Set([...current, productId])] : current.filter((id) => id !== productId)));
  }

  function toggleVisibleQueueSelection(checked: boolean) {
    const visibleIds = visibleQueueItems.map((item) => item.product_id);
    setSelectedProductIds((current) => {
      if (checked) return [...new Set([...current, ...visibleIds])];
      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  async function batchUpdateSelected(mode: BatchMode) {
    if (selectedProducts.length === 0) {
      toast({ title: "Nenhum produto selecionado", description: "Selecione ao menos um item da fila visual." });
      return;
    }
    if (mode === "assign" && !batchAssignee.trim() && !batchDueDate.trim()) {
      toast({
        title: "Defina responsável ou prazo",
        description: "Informe ao menos um responsável ou prazo para registrar a atribuicao da fila.",
      });
      return;
    }
    if (mode === "quarantine" && !window.confirm(`Retirar ${selectedProducts.length} produto(s) de publicação? Todos saem do catálogo até revisão manual.`)) {
      return;
    }
    setBatchLoading(mode);
    const noteSuffix = batchNote.trim() ? ` Observacao: ${batchNote.trim()}` : "";
    try {
      for (const product of selectedProducts) {
        const audit = imageAuditMap.get(product.id);
        if (mode === "quarantine") {
          await apiFetch(`/api/admin/products/${product.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              is_active: false,
              is_featured: false,
              status_product: "draft",
              availability: "sob_consulta",
              image_review_status: audit?.audit_status === "suspect" ? "suspect" : "manual_review",
              image_review_notes: `${buildQuarantineNote(product, audit)}${noteSuffix}`,
            }),
          });
          continue;
        }
        if (mode === "assign") {
          const assignedNotes = buildAuditDirective(
            buildAuditDirective(`${product.image_review_notes || ""}${noteSuffix}`.trim(), "assignee", batchAssignee.trim() || null),
            "due",
            batchDueDate.trim() || null,
          );
          await apiFetch(`/api/admin/products/${product.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              image_review_status: audit?.audit_status === "critical" ? "suspect" : product.image_review_status || "manual_review",
              image_review_notes: assignedNotes,
            }),
          });
          continue;
        }
        const baseNotes =
          mode === "approve"
            ? `Aprovado manualmente no workspace de produtos em ${new Date().toISOString()}. Permanecer monitorando coerencia visual por familia, cor e acabamento.${noteSuffix}`
            : mode === "reopen"
              ? `Reaberto para revisão manual no workspace de produtos em ${new Date().toISOString()}. Revisar novamente imagem, alt text e coerencia com a descrição antes de nova campanha.${noteSuffix}`
              : mode === "approve_duplicate"
                ? appendAuditOverride(`Duplicidade aprovada manualmente no workspace de produtos em ${new Date().toISOString()}. Reutilizacao visual validada para a familia comercial.${noteSuffix}`, "[duplicate-ok]")
                : mode === "approve_generic"
                  ? appendAuditOverride(`Imagem generica aprovada manualmente no workspace de produtos em ${new Date().toISOString()}. Uso comercial aceito para este SKU/familia.${noteSuffix}`, "[generic-ok]")
                  : mode === "approve_metadata"
                    ? appendAuditOverride(`Divergencia de metadados aprovada manualmente no workspace de produtos em ${new Date().toISOString()}. Revisão humana concluiu que a imagem segue valida.${noteSuffix}`, "[metadata-ok]")
                    : mode === "clear_overrides"
                      ? removeAuditOverrides(`${product.image_review_notes || ""} ${batchNote.trim()}`.trim())
                      : `Mantido em revisão manual no workspace de produtos em ${new Date().toISOString()}. Validar imagem, alt text e coerencia com a descrição antes de nova campanha.${noteSuffix}`;
        await apiFetch(`/api/admin/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            image_review_status:
              mode === "approve" || mode === "approve_duplicate" || mode === "approve_generic" || mode === "approve_metadata"
                ? "approved"
                : "manual_review",
            image_review_notes: baseNotes,
          }),
        });
      }
      toast({
        title: "Fila visual atualizada",
        description:
          mode === "assign"
            ? `${selectedProducts.length} item(ns) com responsável/prazo atualizado(s).`
            : mode === "approve"
            ? `${selectedProducts.length} item(ns) marcado(s) como aprovados.`
            : mode === "approve_duplicate"
              ? `${selectedProducts.length} item(ns) com duplicidade aprovada manualmente.`
              : mode === "approve_generic"
                ? `${selectedProducts.length} item(ns) com imagem generica aprovada manualmente.`
                : mode === "approve_metadata"
                  ? `${selectedProducts.length} item(ns) com metadado divergente aprovado manualmente.`
                  : mode === "clear_overrides"
                    ? `${selectedProducts.length} item(ns) com overrides removidos.`
            : mode === "manual_review"
              ? `${selectedProducts.length} item(ns) mantido(s) em revisão manual.`
              : mode === "reopen"
                ? `${selectedProducts.length} item(ns) reaberto(s) para revisão manual.`
              : `${selectedProducts.length} item(ns) retirado(s) de publicação.`,
      });
      setSelectedProductIds([]);
      setBatchAssignee("");
      setBatchDueDate("");
      setBatchNote("");
      await products.reload();
      await imageAudit.reload();
    } catch (error) {
      toast({
        title: "Falha na atualização em lote",
        description: error instanceof Error ? error.message : "Revise permissao, selecao e estado dos produtos.",
        variant: "destructive",
      });
    } finally {
      setBatchLoading(null);
    }
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Produtos"
      title="Gestao de produtos, cadastro e coerencia visual"
      description="Workspace para criar, revisar, publicar e arquivar produtos do catálogo inteligente, com foco em nome, slug, categoria, descrição, medidas, imagem e CTA de orçamento."
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => {
              void products.reload();
              void imageAudit.reload();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button asChild>
            <Link to="/admin/produto/novo">Novo produto</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Produtos ativos" value={active.length} detail={`${inactive.length} inativos`} />
          <WorkspaceMetric label="Sem imagem" value={withoutImage.length} tone={withoutImage.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Imagem suspeita" value={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical} detail={`${manualReviewImages.length} em revisão manual`} tone={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Revisão técnica" value={withoutFiscal.length} tone={withoutFiscal.length > 0 ? "warn" : "ok"} />
        </div>

        <PimQualitySection pimReadiness={pimReadiness.data} />

        <CatalogModelSection />

        <SearchSection
          query={query}
          onQueryChange={setQuery}
          onResetSavedFilters={resetSavedFilters}
          searchableCount={searchableProducts.length}
          totalCount={products.data.length}
          publicationReadyCount={publicationReady.length}
          campaignReadyCount={campaignReady.length}
          quoteReadyCount={quoteReady.length}
        />

        <QualityIndicatorsSection
          lowStockCount={lowStock.length}
          withoutLogisticsCount={withoutLogistics.length}
          missingAltTextCount={missingAltText.length}
          riskProductsCount={riskProducts.length}
          duplicateImageCount={imageAudit.data.summary.duplicate_image}
        />

        <CurationProgressSection imageAudit={imageAudit.data} />

        <ReviewQueueSection
          imageAudit={imageAudit.data}
          criticalPlaceholdersCount={criticalPlaceholders.length}
          visualQuarantineCount={visualQuarantine.length}
          selectedQueueCount={selectedQueueCount}
          filteredReviewQueueItems={filteredReviewQueueItems}
          visibleQueueItems={visibleQueueItems}
          queuePrioritySummary={queuePrioritySummary}
          queuePriorityFilter={queuePriorityFilter}
          onQueuePriorityFilterChange={setQueuePriorityFilter}
          queueCategories={queueCategories}
          queueCategoryFilter={queueCategoryFilter}
          onQueueCategoryFilterChange={setQueueCategoryFilter}
          queueAssignees={queueAssignees}
          queueAssigneeFilter={queueAssigneeFilter}
          onQueueAssigneeFilterChange={setQueueAssigneeFilter}
          queueSlaFilter={queueSlaFilter}
          onQueueSlaFilterChange={setQueueSlaFilter}
          selectedProductIds={selectedProductIds}
          onToggleSelection={toggleSelection}
          onToggleVisibleQueueSelection={toggleVisibleQueueSelection}
          batchAssignee={batchAssignee}
          onBatchAssigneeChange={setBatchAssignee}
          batchDueDate={batchDueDate}
          onBatchDueDateChange={setBatchDueDate}
          batchNote={batchNote}
          onBatchNoteChange={setBatchNote}
          batchLoading={batchLoading}
          onBatchUpdateSelected={(mode) => void batchUpdateSelected(mode)}
          onClearQueueFilters={() => {
            setQueuePriorityFilter("all");
            setQueueCategoryFilter("all");
            setQueueAssigneeFilter("all");
            setQueueSlaFilter("all");
          }}
        />

        <CategoryPlanSection
          categorySummary={imageAudit.data.category_summary}
          onSelectCategory={(categoryName) => {
            setRiskFilter("image-suspect");
            setQueueCategoryFilter(categoryName);
          }}
        />

        <CriticalPlaceholdersSection
          products={criticalPlaceholders}
          imageAuditMap={imageAuditMap}
          quarantineProductId={quarantineProductId}
          onQuarantineProduct={(product, audit) => void quarantineProduct(product, audit)}
        />

        <BulkEditSection
          bulkEditQuery={bulkEditQuery}
          onBulkEditQueryChange={setBulkEditQuery}
          filteredProducts={bulkEditFilteredProducts}
          selectedIds={bulkEditSelectedIds}
          onToggleSelection={toggleBulkEditSelection}
          onSelectAll={(checked) => setBulkEditSelectedIds(checked ? bulkEditFilteredProducts.map((product) => product.id) : [])}
          categories={categoriesResource.data}
          categoryId={bulkEditCategoryId}
          onCategoryIdChange={setBulkEditCategoryId}
          status={bulkEditStatus}
          onStatusChange={setBulkEditStatus}
          active={bulkEditActive}
          onActiveChange={setBulkEditActive}
          applying={bulkEditApplying}
          onApply={() => void applyBulkEdit()}
        />

        <RiskProductsSection
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          filteredRiskProducts={filteredRiskProducts}
          quarantineProductId={quarantineProductId}
          onQuarantineProduct={(product, audit) => void quarantineProduct(product, audit)}
        />
      </div>
    </AdminWorkspaceShell>
  );
}
