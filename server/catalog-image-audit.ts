import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseShape } from "./db";
import { withRelations } from "./db";
import { auditCatalogImages, summarizeCatalogImageAudit, summarizeCatalogImageAuditAssignments, type CatalogImageAuditItem } from "../src/lib/catalogImageAudit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function localAssetExists(image: string | null) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return null;
  const sanitized = image.split("?")[0].replace(/^\/+/, "");
  if (!sanitized) return false;

  const candidates = [
    path.join(projectRoot, sanitized),
    path.join(projectRoot, "public", sanitized),
    path.join(projectRoot, "src", sanitized),
    path.join(projectRoot, "src", "assets", path.basename(sanitized)),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

function enrichItemWithAssetCheck(item: CatalogImageAuditItem): CatalogImageAuditItem {
  const exists = localAssetExists(item.primary_image);
  if (exists === false) {
    return {
      ...item,
      audit_status: item.audit_status === "critical" ? "critical" : "suspect",
      issues: [
        ...item.issues,
        {
          code: "metadata_mismatch" as const,
          severity: "suspect" as const,
          label: "Arquivo local nao encontrado",
          detail: "O caminho da imagem aponta para um arquivo local que nao foi localizado no projeto.",
        },
      ],
      recommended_action: "Ajustar o caminho da imagem ou anexar um asset real antes de aprovar o produto.",
    };
  }
  return item;
}

export function getAdminCatalogImageAudit(db: DatabaseShape, options?: { productId?: string | null }) {
  const products = db.products
    .filter((product) => !options?.productId || product.id === options.productId)
    .map((product) => withRelations(db, product));
  const base = auditCatalogImages(products);
  const items = base.items.map(enrichItemWithAssetCheck);
  const summary = summarizeCatalogImageAudit(items);
  const activeItems = items.filter((item) => item.is_active);
  const inactiveItems = items.filter((item) => !item.is_active);
  const categorySummary = Array.from(
    items.reduce((acc, item) => {
      const key = item.category_name?.trim() || "Sem categoria";
      const current = acc.get(key) ?? {
        category_name: key,
        total: 0,
        active: 0,
        inactive: 0,
        critical: 0,
        suspect: 0,
        manual_review: 0,
        duplicate_image: 0,
        generic_image: 0,
        missing_image: 0,
        metadata_mismatch: 0,
        duplicate_override: 0,
        generic_override: 0,
        metadata_override: 0,
        human_override_total: 0,
      };
      current.total += 1;
      if (item.is_active) current.active += 1;
      else current.inactive += 1;
      if (item.audit_status === "critical") current.critical += 1;
      if (item.audit_status === "suspect") current.suspect += 1;
      if (item.audit_status === "manual_review") current.manual_review += 1;
      if (item.issues.some((issue) => issue.code === "duplicate_image")) current.duplicate_image += 1;
      if (item.issues.some((issue) => issue.code === "generic_image")) current.generic_image += 1;
      if (item.issues.some((issue) => issue.code === "missing_image" || issue.code === "placeholder_image")) current.missing_image += 1;
      if (item.issues.some((issue) => issue.code === "metadata_mismatch")) current.metadata_mismatch += 1;
      if (item.human_overrides.includes("duplicate_ok")) current.duplicate_override += 1;
      if (item.human_overrides.includes("generic_ok")) current.generic_override += 1;
      if (item.human_overrides.includes("metadata_ok")) current.metadata_override += 1;
      if (item.human_overrides.length > 0) current.human_override_total += 1;
      acc.set(key, current);
      return acc;
    }, new Map<string, {
      category_name: string;
      total: number;
      active: number;
      inactive: number;
      critical: number;
      suspect: number;
      manual_review: number;
      duplicate_image: number;
      generic_image: number;
      missing_image: number;
      metadata_mismatch: number;
      duplicate_override: number;
      generic_override: number;
      metadata_override: number;
      human_override_total: number;
    }>()).values(),
  ).sort((a, b) => (b.critical - a.critical) || (b.suspect - a.suspect) || (b.active - a.active) || a.category_name.localeCompare(b.category_name));

  return {
    generated_at: new Date().toISOString(),
    summary,
    active_summary: summarizeCatalogImageAudit(activeItems),
    inactive_summary: summarizeCatalogImageAudit(inactiveItems),
    assignment_summary: summarizeCatalogImageAuditAssignments(items),
    category_summary: categorySummary,
    items,
    review_required: items.filter((item) => item.audit_status !== "ok").length,
    review_required_active: activeItems.filter((item) => item.audit_status !== "ok").length,
    duplicates: items.filter((item) => item.duplicate_count > 1).length,
  };
}
