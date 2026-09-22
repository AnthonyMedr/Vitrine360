import type { CatalogReadinessIssue } from "./types";

export function countReadinessIssues(value?: number | CatalogReadinessIssue[], fallback?: CatalogReadinessIssue[]) {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.length;
  return fallback?.length ?? 0;
}

export function listReadinessIssues(primary?: CatalogReadinessIssue[], secondary?: number | CatalogReadinessIssue[]) {
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(secondary)) return secondary;
  return [];
}

export function formatReadinessIssue(check: CatalogReadinessIssue) {
  if (check.detail) return check.detail;
  if (check.recommended_action) return check.recommended_action;
  const parts = [
    check.missing?.length ? `Campos pendentes: ${check.missing.join(", ")}` : "",
    check.warnings?.length ? `Alertas: ${check.warnings.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ") || "Revisar este item antes da homologacao.";
}
