import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";
import type { LocalProduct } from "@/lib/localCommerce";

export type RiskFilter =
  | "all"
  | "campaign-ready"
  | "visual-quarantine"
  | "placeholder-critical"
  | "soft-launch"
  | "fiscal"
  | "image"
  | "image-suspect"
  | "image-inactive"
  | "alt"
  | "stock"
  | "logistics"
  | "deferred";

export type QueuePriorityFilter = "all" | "critica" | "alta" | "media";
export type QueueSlaFilter = "all" | "overdue" | "due_soon" | "scheduled" | "unassigned";
export type BatchMode =
  | "assign"
  | "approve"
  | "manual_review"
  | "reopen"
  | "quarantine"
  | "approve_duplicate"
  | "approve_generic"
  | "approve_metadata"
  | "clear_overrides";

export function getProductIssues(product: LocalProduct, audit?: CatalogImageAuditItem) {
  return Array.from(new Set([
    Number(product.price || 0) <= 0 ? "sob consulta" : null,
    Number(product.stock || 0) <= 0 ? "disponibilidade pendente" : null,
    Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5 ? "disponibilidade baixa" : null,
    !product.category_id ? "sem categoria" : null,
    !product.image_url && product.images.length === 0 ? "sem imagem" : null,
    !product.slug ? "sem slug" : null,
    !product.short_description && !product.description ? "sem descrição" : null,
    !product.application ? "sem aplicação" : null,
    !product.unit ? "sem unidade" : null,
    !product.ncm || product.tax_classification_status !== "ready" ? "revisão técnica pendente" : null,
    !product.weight && !product.weight_per_unit && !product.weight_per_package ? "sem medidas" : null,
    product.is_heavy || product.is_bulky ? "produto volumoso" : null,
    audit?.audit_status === "critical" ? "imagem critica" : null,
    audit?.audit_status === "suspect" ? "imagem suspeita" : null,
    audit?.issues.some((issue) => issue.code === "missing_alt_text") ? "alt pendente" : null,
    product.availability === "sob_consulta" ? "sob consulta" : null,
    !product.is_active ? "inativo" : null,
  ].filter(Boolean) as string[]));
}

export function isProductReadyForPublication(product: LocalProduct) {
  return (
    product.is_active &&
    Boolean(product.name) &&
    Boolean(product.slug) &&
    Boolean(product.sku) &&
    Boolean(product.category_id) &&
    hasRealProductImage(product) &&
    Boolean(product.short_description || product.description) &&
    Boolean(product.application) &&
    Boolean(product.unit)
  );
}

export function isProductReadyForQuote(product: LocalProduct) {
  return (
    product.is_active &&
    Boolean(product.name) &&
    Boolean(product.slug) &&
    Boolean(product.category_id) &&
    hasRealProductImage(product) &&
    Boolean(product.short_description || product.description) &&
    (Number(product.price || 0) > 0 || product.availability === "sob_consulta")
  );
}

export function isProductReadyForCampaign(product: LocalProduct, audit?: CatalogImageAuditItem) {
  return (
    product.is_active &&
    Boolean(product.name) &&
    Boolean(product.slug) &&
    Boolean(product.category_id) &&
    hasRealProductImage(product) &&
    Boolean(product.short_description || product.description) &&
    Boolean(product.application || product.material) &&
    audit?.audit_status !== "critical"
  );
}

const deferredSoftLaunchSkus = new Set([
  "411-FORRO-PVC-600M",
  "1079-FORRO-PVC-1200M",
  "232-FORRO-PVC-400M",
  "234-FORRO-PVC-500M",
  "798-FORRO-PVC-600M",
  "408-FORRO-PVC-600M",
  "797-FORRO-PVC-600M",
  "410-FORRO-PVC-600M",
  "1158-FORRO-PVC-600M",
  "413-FORRO-PVC",
  "409-FORRO-PVC",
  "412-FORRO-PVC",
]);

export function isDeferredSku(sku?: string | null) {
  return Boolean(sku && deferredSoftLaunchSkus.has(sku));
}

export function getResponsibleArea(issues: string[]) {
  if (issues.includes("revisão técnica pendente")) return "catálogo/conteúdo";
  if (issues.includes("sem imagem") || issues.includes("imagem critica") || issues.includes("imagem suspeita") || issues.includes("alt pendente") || issues.includes("sem categoria")) return "catálogo/conteúdo";
  if (issues.includes("disponibilidade pendente") || issues.includes("disponibilidade baixa")) return "comercial";
  if (issues.includes("sob consulta")) return "comercial";
  if (issues.includes("sem medidas") || issues.includes("produto volumoso")) return "catálogo/conteúdo";
  return "administrador";
}

export function getNextAction(issues: string[]) {
  if (issues.includes("revisão técnica pendente")) return "revisar especificações técnicas antes de publicar";
  if (issues.includes("sem imagem")) return "anexar imagem real e revisar alt/SEO";
  if (issues.includes("imagem critica")) return "corrigir imagem quebrada ou placeholder antes de campanha";
  if (issues.includes("imagem suspeita")) return "validar coerencia entre produto, categoria, cor e imagem";
  if (issues.includes("alt pendente")) return "preencher alt text coerente e revisar SEO";
  if (issues.includes("disponibilidade pendente")) return "confirmar disponibilidade antes de destacar";
  if (issues.includes("disponibilidade baixa")) return "confirmar disponibilidade antes de vitrine";
  if (issues.includes("sob consulta")) return "manter CTA de orçamento";
  if (issues.includes("sem medidas")) return "preencher medidas e unidade comercial";
  return "revisar cadastro antes do primeiro corte";
}

export function getQueuePriority(item: CatalogImageAuditItem): QueuePriorityFilter {
  if (item.is_active && item.audit_status === "critical") return "critica";
  if (item.is_active && (item.audit_status === "suspect" || item.audit_status === "manual_review")) return "alta";
  return "media";
}

export function queuePriorityWeight(priority: QueuePriorityFilter) {
  switch (priority) {
    case "critica":
      return 0;
    case "alta":
      return 1;
    case "media":
      return 2;
    default:
      return 3;
  }
}

export function buildReviewQueueLink(item: CatalogImageAuditItem, priority: QueuePriorityFilter, category: string) {
  const search = new URLSearchParams();
  search.set("queue", "visual");
  if (priority !== "all") search.set("queuePriority", priority);
  if (category !== "all") search.set("queueCategory", category);
  return `/admin/produto/${item.product_id}?${search.toString()}`;
}

export function appendAuditOverride(notes: string, tag: "[duplicate-ok]" | "[generic-ok]" | "[metadata-ok]") {
  const normalized = notes.trim();
  if (normalized.includes(tag)) return normalized;
  return normalized.length > 0 ? `${normalized} ${tag}` : tag;
}

export function removeAuditOverrides(notes: string) {
  return notes
    .replace(/\[duplicate-ok\]/g, "")
    .replace(/\[generic-ok\]/g, "")
    .replace(/\[metadata-ok\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function formatSlaLabel(status: QueueSlaFilter, dueDate: string | null) {
  switch (status) {
    case "overdue":
      return dueDate ? `vencido em ${dueDate}` : "vencido";
    case "due_soon":
      return dueDate ? `vence em ${dueDate}` : "vence em 48h";
    case "scheduled":
      return dueDate ? `no prazo até ${dueDate}` : "sem data final";
    case "unassigned":
      return "sem responsável";
    default:
      return dueDate || "sem prazo";
  }
}

export function hasRealProductImage(product: LocalProduct) {
  const imageCandidates = [product.image_url, ...(product.images ?? [])].filter(Boolean).map((entry) => String(entry));
  return imageCandidates.some((image) => !isPlaceholderProductImage(image));
}

export function isPlaceholderProductImage(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "/" || normalized.includes("placeholder.svg") || normalized.includes("placeholder");
}

export function buildQuarantineNote(product: LocalProduct, audit?: CatalogImageAuditItem) {
  const issueSummary = audit?.issues.slice(0, 3).map((issue) => issue.label).join(", ") || "imagem principal sem validação objetiva";
  return `Retirado de publicação pelo workspace de produtos em ${new Date().toISOString()} por risco visual/comercial. Motivo: ${issueSummary}. Manter revisão humana antes de reativar ${product.sku || product.id}.`;
}

export function isVisualQuarantineProduct(product: LocalProduct) {
  const note = String(product.image_review_notes || "");
  return !product.is_active && (note.includes("Retirado de publicação") || note.includes("Retirado de publicação"));
}
