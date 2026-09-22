export type ProductImageReviewStatus =
  | "approved"
  | "manual_review"
  | "suspect"
  | "missing"
  | "duplicate"
  | "broken"
  | "rejected";

export type CatalogImageAuditSeverity = "ok" | "manual_review" | "suspect" | "critical";

export type CatalogImageAuditCode =
  | "missing_image"
  | "placeholder_image"
  | "missing_alt_text"
  | "duplicate_image"
  | "generic_image"
  | "metadata_mismatch"
  | "review_override";

export type CatalogImageAuditOverride = "duplicate_ok" | "generic_ok" | "metadata_ok";
export type CatalogImageAuditSlaStatus = "unassigned" | "scheduled" | "due_soon" | "overdue";

export interface CatalogImageAuditProductInput {
  id: string;
  is_active?: boolean | null;
  availability?: string | null;
  status_product?: string | null;
  sku?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  short_description?: string | null;
  category_id?: string | null;
  category?: { id?: string | null; name?: string | null; slug?: string | null } | null;
  subcategory?: string | null;
  material?: string | null;
  application?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  image_alt_text?: string | null;
  image_review_status?: ProductImageReviewStatus | null;
  image_review_notes?: string | null;
}

export interface CatalogImageAuditIssue {
  code: CatalogImageAuditCode;
  severity: CatalogImageAuditSeverity;
  label: string;
  detail: string;
}

export interface CatalogImageAuditItem {
  product_id: string;
  is_active: boolean;
  sku: string | null;
  product_name: string;
  slug: string | null;
  category_name: string | null;
  primary_image: string | null;
  image_alt_text: string | null;
  suggested_alt_text: string;
  review_status: ProductImageReviewStatus | null;
  audit_status: CatalogImageAuditSeverity;
  duplicate_count: number;
  family: string | null;
  issues: CatalogImageAuditIssue[];
  expected_keywords: string[];
  matched_keywords: string[];
  human_overrides: CatalogImageAuditOverride[];
  review_assignee: string | null;
  review_due_date: string | null;
  review_sla_status: CatalogImageAuditSlaStatus;
  recommended_action: string;
}

export interface CatalogImageAuditSummary {
  total: number;
  ok: number;
  manual_review: number;
  suspect: number;
  critical: number;
  missing_image: number;
  missing_alt_text: number;
  duplicate_image: number;
  generic_image: number;
  metadata_mismatch: number;
  duplicate_override: number;
  generic_override: number;
  metadata_override: number;
  human_override_total: number;
}

export interface CatalogImageAuditAssignmentSummary {
  assigned_total: number;
  unassigned_total: number;
  overdue_total: number;
  due_soon_total: number;
  scheduled_total: number;
  assignees: Array<{
    name: string;
    total: number;
    overdue: number;
    due_soon: number;
    scheduled: number;
  }>;
}

function createSummary(): CatalogImageAuditSummary {
  return {
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
}

export function summarizeCatalogImageAudit(items: CatalogImageAuditItem[]) {
  return items.reduce<CatalogImageAuditSummary>((acc, item) => {
    acc.total += 1;
    acc[item.audit_status] += 1;
    if (item.issues.some((issue) => issue.code === "missing_image" || issue.code === "placeholder_image")) acc.missing_image += 1;
    if (item.issues.some((issue) => issue.code === "missing_alt_text")) acc.missing_alt_text += 1;
    if (item.issues.some((issue) => issue.code === "duplicate_image")) acc.duplicate_image += 1;
    if (item.issues.some((issue) => issue.code === "generic_image")) acc.generic_image += 1;
    if (item.issues.some((issue) => issue.code === "metadata_mismatch")) acc.metadata_mismatch += 1;
    if (item.human_overrides.includes("duplicate_ok")) acc.duplicate_override += 1;
    if (item.human_overrides.includes("generic_ok")) acc.generic_override += 1;
    if (item.human_overrides.includes("metadata_ok")) acc.metadata_override += 1;
    if (item.human_overrides.length > 0) acc.human_override_total += 1;
    return acc;
  }, createSummary());
}

export function summarizeCatalogImageAuditAssignments(items: CatalogImageAuditItem[]) {
  const assigneeMap = new Map<string, { name: string; total: number; overdue: number; due_soon: number; scheduled: number }>();
  const summary: CatalogImageAuditAssignmentSummary = {
    assigned_total: 0,
    unassigned_total: 0,
    overdue_total: 0,
    due_soon_total: 0,
    scheduled_total: 0,
    assignees: [],
  };

  for (const item of items) {
    if (item.audit_status === "ok") continue;
    if (item.review_assignee) {
      summary.assigned_total += 1;
      const current = assigneeMap.get(item.review_assignee) ?? {
        name: item.review_assignee,
        total: 0,
        overdue: 0,
        due_soon: 0,
        scheduled: 0,
      };
      current.total += 1;
      if (item.review_sla_status === "overdue") {
        summary.overdue_total += 1;
        current.overdue += 1;
      } else if (item.review_sla_status === "due_soon") {
        summary.due_soon_total += 1;
        current.due_soon += 1;
      } else if (item.review_sla_status === "scheduled") {
        summary.scheduled_total += 1;
        current.scheduled += 1;
      }
      assigneeMap.set(item.review_assignee, current);
      continue;
    }

    summary.unassigned_total += 1;
  }

  summary.assignees = Array.from(assigneeMap.values()).sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));
  return summary;
}

const GENERIC_IMAGE_PATTERNS = [
  "images.unsplash.com/photo-1513694203232-719a280e022f",
  "images.unsplash.com/photo-1484154218962-a197022b5858",
  "banner-1",
  "banner-2",
  "banner-3",
  "hero",
  "storefront",
  "brand-logo",
];

const PLACEHOLDER_PATTERNS = ["/placeholder.svg", "placeholder"];

const FAMILY_RULES: Array<{ id: string; match: string[]; expected: string[] }> = [
  { id: "chapa_uv", match: ["chapa uv", "placa uv", "uv", "calacata", "nero", "cremo", "travertino", "marmorizada", "marmore"], expected: ["uv", "chapa", "placa", "calacata", "nero", "cremo", "travertino", "marmore"] },
  { id: "forro_teto_pvc", match: ["forro", "teto", "laminado", "pvc amadeirado", "alto brilho", "cedro", "freijo", "nogueira", "carvalho"], expected: ["forro", "teto", "pvc", "laminado", "amadeirado", "cedro", "freijo", "nogueira", "carvalho"] },
  { id: "telhas", match: ["telha", "fibrocimento", "colonial", "plan"], expected: ["telha", "cobertura", "fibrocimento", "colonial", "plan", "pvc"] },
  { id: "policarbonato", match: ["policarbonato", "alveolar", "compacto", "translucido", "transparente"], expected: ["policarbonato", "alveolar", "compacto", "translucido", "transparente", "cobertura"] },
  { id: "drywall", match: ["drywall", "guia", "montante", "tabica", "pendural", "f530", "parafuso drywall"], expected: ["drywall", "guia", "montante", "tabica", "pendural", "f530", "parafuso"] },
  { id: "ripado", match: ["ripado", "wpc", "painel ripado"], expected: ["ripado", "wpc", "painel"] },
  { id: "piso_vinilico", match: ["piso", "vinilico"], expected: ["piso", "vinilico"] },
  { id: "puxador", match: ["puxador"], expected: ["puxador", "porta", "alca"] },
  { id: "motor_portao", match: ["motor de portao", "automatizador", "portao"], expected: ["motor", "portao", "automatizador"] },
  { id: "bota", match: ["bota", "bota de segurança"], expected: ["bota", "segurança", "epi"] },
  { id: "perfil_aluminio", match: ["perfil de aluminio", "aluminio", "esquadria"], expected: ["perfil", "aluminio", "esquadria"] },
];

function normalize(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseAuditOverrides(notes: string | null | undefined) {
  const normalized = normalize(notes);
  const overrides = new Set<CatalogImageAuditOverride>();
  if (normalized.includes("[duplicate-ok]")) overrides.add("duplicate_ok");
  if (normalized.includes("[generic-ok]")) overrides.add("generic_ok");
  if (normalized.includes("[metadata-ok]")) overrides.add("metadata_ok");
  return overrides;
}

export function parseAuditAssignee(notes: string | null | undefined) {
  const match = String(notes || "").match(/\[assignee:([^\]]+)\]/i);
  return match?.[1]?.trim() || null;
}

export function parseAuditDueDate(notes: string | null | undefined) {
  const match = String(notes || "").match(/\[due:(\d{4}-\d{2}-\d{2})\]/i);
  return match?.[1] || null;
}

export function buildAuditDirective(notes: string | null | undefined, directive: "assignee" | "due", value: string | null) {
  const input = String(notes || "").trim();
  const pattern = directive === "assignee" ? /\[assignee:[^\]]+\]/gi : /\[due:\d{4}-\d{2}-\d{2}\]/gi;
  const cleaned = input.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
  if (!value?.trim()) return cleaned;
  const tag = directive === "assignee" ? `[assignee:${value.trim()}]` : `[due:${value.trim()}]`;
  return cleaned.length > 0 ? `${cleaned} ${tag}` : tag;
}

function compact(values: Array<string | null | undefined>) {
  return values.map((entry) => normalize(entry)).filter(Boolean);
}

function buildProductText(product: CatalogImageAuditProductInput) {
  return compact([
    product.name,
    product.slug,
    product.category?.name,
    product.category?.slug,
    product.subcategory,
    product.material,
    product.application,
    product.description,
    product.short_description,
  ]).join(" ");
}

function buildImageText(product: CatalogImageAuditProductInput, primaryImage: string | null) {
  return compact([primaryImage, ...(product.images ?? []), product.image_alt_text, product.image_review_notes]).join(" ");
}

function findFamily(productText: string) {
  for (const rule of FAMILY_RULES) {
    if (rule.match.some((term) => productText.includes(normalize(term)))) {
      return rule;
    }
  }
  return null;
}

function collectMatchedKeywords(expected: string[], imageText: string) {
  return expected.filter((keyword) => imageText.includes(normalize(keyword)));
}

function primaryImageOf(product: CatalogImageAuditProductInput) {
  if (product.image_url && product.image_url.trim()) return product.image_url.trim();
  const fallback = (product.images ?? []).find((entry) => typeof entry === "string" && entry.trim().length > 0);
  return fallback?.trim() ?? null;
}

function isGenericImage(image: string | null) {
  const normalized = normalize(image);
  return GENERIC_IMAGE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isPlaceholderImage(image: string | null) {
  const normalized = normalize(image);
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function suggestedAltText(product: CatalogImageAuditProductInput) {
  const category = product.category?.name?.trim();
  return category ? `${product.name} - ${category}` : product.name;
}

function buildIssue(code: CatalogImageAuditCode, severity: CatalogImageAuditSeverity, label: string, detail: string): CatalogImageAuditIssue {
  return { code, severity, label, detail };
}

function classifyStatus(issues: CatalogImageAuditIssue[]) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical" as const;
  if (issues.some((issue) => issue.severity === "suspect")) return "suspect" as const;
  if (issues.some((issue) => issue.severity === "manual_review")) return "manual_review" as const;
  return "ok" as const;
}

function buildRecommendedAction(status: CatalogImageAuditSeverity, issues: CatalogImageAuditIssue[]) {
  if (status === "critical") return "Corrigir imagem principal antes de publicar ou impulsionar o produto.";
  if (issues.some((issue) => issue.code === "metadata_mismatch")) return "Revisar manualmente se a imagem representa a linha, cor e acabamento do produto.";
  if (issues.some((issue) => issue.code === "duplicate_image")) return "Validar se a mesma imagem pode ser reutilizada em SKUs diferentes ou substituir por foto especifica.";
  if (issues.some((issue) => issue.code === "generic_image")) return "Trocar imagem generica por foto técnica ou comercial da familia correta.";
  if (issues.some((issue) => issue.code === "missing_alt_text")) return "Preencher alt text coerente e aprovar manualmente.";
  return "Sem acao critica. Manter revisão humana antes de campanha.";
}

function classifySlaStatus(reviewAssignee: string | null, reviewDueDate: string | null, now = new Date()) {
  if (!reviewAssignee) return "unassigned" as const;
  if (!reviewDueDate) return "scheduled" as const;
  const dueAt = new Date(`${reviewDueDate}T23:59:59.999Z`);
  const diffMs = dueAt.getTime() - now.getTime();
  if (Number.isNaN(dueAt.getTime())) return "scheduled" as const;
  if (diffMs < 0) return "overdue" as const;
  if (diffMs <= 48 * 60 * 60 * 1000) return "due_soon" as const;
  return "scheduled" as const;
}

export function auditCatalogImages(products: CatalogImageAuditProductInput[]) {
  const duplicates = new Map<string, number>();
  for (const product of products) {
    const primaryImage = primaryImageOf(product);
    if (!primaryImage) continue;
    duplicates.set(primaryImage, (duplicates.get(primaryImage) ?? 0) + 1);
  }

  const items: CatalogImageAuditItem[] = products.map((product) => {
    const primaryImage = primaryImageOf(product);
    const productText = buildProductText(product);
    const imageText = buildImageText(product, primaryImage);
    const family = findFamily(productText);
    const expectedKeywords = family?.expected ?? [];
    const matchedKeywords = collectMatchedKeywords(expectedKeywords, imageText);
    const duplicateCount = primaryImage ? duplicates.get(primaryImage) ?? 0 : 0;
    const issues: CatalogImageAuditIssue[] = [];
    const overrides = parseAuditOverrides(product.image_review_notes);
    const reviewAssignee = parseAuditAssignee(product.image_review_notes);
    const reviewDueDate = parseAuditDueDate(product.image_review_notes);
    const inactiveBacklog =
      !product.is_active &&
      (product.status_product === "draft" || product.availability === "sob_consulta" || product.image_review_status === "manual_review" || product.image_review_status === "missing");
    const missingImageSeverity: CatalogImageAuditSeverity = inactiveBacklog ? "manual_review" : "critical";

    if (!primaryImage) {
      issues.push(
        buildIssue(
          "missing_image",
          missingImageSeverity,
          inactiveBacklog ? "Sem imagem em backlog inativo" : "Sem imagem",
          inactiveBacklog
            ? "Produto sem imagem principal, mas ja esta fora de publicação e segue como backlog de revisão humana."
            : "Produto sem imagem principal ou galeria cadastrada.",
        ),
      );
    } else if (isPlaceholderImage(primaryImage)) {
      issues.push(
        buildIssue(
          "placeholder_image",
          missingImageSeverity,
          inactiveBacklog ? "Imagem placeholder em backlog inativo" : "Imagem placeholder",
          inactiveBacklog
            ? "A imagem atual ainda e placeholder, mas o item ja esta fora de publicação e deve seguir em revisão humana."
            : "A imagem atual e um placeholder e não deve ser exibida como foto definitiva do produto.",
        ),
      );
    }

    if (!product.image_alt_text?.trim()) {
      issues.push(buildIssue("missing_alt_text", "manual_review", "Alt text ausente", "Preencha um alt text coerente para SEO e acessibilidade."));
    }

    if (primaryImage && duplicateCount > 1 && !overrides.has("duplicate_ok")) {
      issues.push(buildIssue("duplicate_image", "suspect", "Imagem duplicada", `A mesma imagem aparece em ${duplicateCount} produto(s); revisar se o compartilhamento e realmente valido.`));
    }

    if (primaryImage && isGenericImage(primaryImage) && !overrides.has("generic_ok")) {
      issues.push(buildIssue("generic_image", "suspect", "Imagem generica", "A imagem atual parece asset generico, banner ou foto de apoio e não evidencia claramente o item comercial."));
    }

    if (family && primaryImage && matchedKeywords.length === 0 && !overrides.has("metadata_ok")) {
      issues.push(buildIssue("metadata_mismatch", "suspect", "Metadados divergentes", `Nome, categoria e atributos sugerem a familia ${family.id}, mas URL/alt/notas da imagem não trazem termos coerentes.`));
    }

    if (product.image_review_status === "manual_review" || product.image_review_status === "suspect" || product.image_review_status === "duplicate" || product.image_review_status === "broken" || product.image_review_status === "missing" || product.image_review_status === "rejected") {
      issues.push(buildIssue("review_override", product.image_review_status === "manual_review" ? "manual_review" : "suspect", "Revisão administrativa pendente", "A equipe administrativa marcou esta imagem para revisão antes da aprovacao final."));
    }

    const auditStatus = classifyStatus(issues);
    return {
      product_id: product.id,
      is_active: Boolean(product.is_active),
      sku: product.sku ?? null,
      product_name: product.name,
      slug: product.slug ?? null,
      category_name: product.category?.name?.trim() || null,
      primary_image: primaryImage,
      image_alt_text: product.image_alt_text?.trim() || null,
      suggested_alt_text: suggestedAltText(product),
      review_status: product.image_review_status ?? null,
      audit_status: auditStatus,
      duplicate_count: duplicateCount,
      family: family?.id ?? null,
      issues,
      expected_keywords: expectedKeywords,
      matched_keywords: matchedKeywords,
      human_overrides: Array.from(overrides),
      review_assignee: reviewAssignee,
      review_due_date: reviewDueDate,
      review_sla_status: classifySlaStatus(reviewAssignee, reviewDueDate),
      recommended_action: buildRecommendedAction(auditStatus, issues),
    };
  });

  const summary = summarizeCatalogImageAudit(items);

  return {
    summary,
    items: items.sort((a, b) => severityWeight(b.audit_status) - severityWeight(a.audit_status) || b.duplicate_count - a.duplicate_count || a.product_name.localeCompare(b.product_name)),
  };
}

function severityWeight(status: CatalogImageAuditSeverity) {
  switch (status) {
    case "critical":
      return 4;
    case "suspect":
      return 3;
    case "manual_review":
      return 2;
    default:
      return 1;
  }
}
