import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";

export type CatalogImageAuditResponse = {
  summary: {
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
  };
  active_summary: {
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
  };
  inactive_summary: {
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
  };
  category_summary: Array<{
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
  }>;
  assignment_summary: {
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
  };
  items: CatalogImageAuditItem[];
};

export type AdminUserOption = {
  id: string;
  user_metadata?: {
    full_name?: string | null;
  } | null;
};

export type ProductQualityScore = {
  product_id: string;
  product_name?: string;
  product_completeness_score: number;
  commercial_score: number;
  visual_score: number;
  seo_score: number;
  fiscal_score: number;
  operational_score: number;
  campaign_score: number;
  ready_for_campaign: boolean;
  ready_for_home: boolean;
  ready_for_traffic: boolean;
};

export type PimReadinessResponse = {
  totals: {
    products: number;
    publishable: number;
    ready_for_campaign: number;
    ready_for_home: number;
    ready_for_traffic: number;
    assisted_operation_ready: number;
    blocked_by_image: number;
    blocked_by_fiscal: number;
    missing_seo: number;
    missing_application: number;
    missing_category: number;
    missing_material: number;
    missing_measure: number;
    low_score: number;
    near_ready: number;
  };
  category_summary: Array<{
    category_name: string;
    total: number;
    low_score: number;
    blocked_by_image: number;
    blocked_by_fiscal: number;
    ready_for_campaign: number;
  }>;
  lowest_scores: ProductQualityScore[];
};
