export type Product = { id: string; name: string; sku?: string | null; stock: number; is_active: boolean; image_url?: string | null; images?: string[]; category_id?: string | null; category?: { id?: string; name: string } | null; brand_id?: string | null; tax_classification_status?: string | null };
export type Category = { id: string; name: string; slug: string; description?: string | null; image_url?: string | null; icon?: string | null; sort_order?: number; is_active: boolean };
export type Brand = { id: string; name: string; slug: string; is_active: boolean };
export type StagingSummary = { total?: number; approved?: number; review?: number; rejected?: number; required?: number; deferred?: number };
export type StagingWorkboard = { metrics?: Record<string, number>; queues?: Record<string, Array<{ id: string; source_name?: string; normalized_name?: string; review_reason?: string | null }>> };
export type CatalogReadinessIssue = { item?: string; detail?: string; id?: string; name?: string; recommended_action?: string; missing?: string[]; warnings?: string[] };
export type FreightReadiness = {
  ready?: boolean;
  blockers?: number | CatalogReadinessIssue[];
  warnings?: number | CatalogReadinessIssue[];
  metrics?: Record<string, number>;
  checks?: { blockers?: CatalogReadinessIssue[]; warnings?: CatalogReadinessIssue[] };
};
export type PimReadiness = {
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
};

export type CategoryHealth = Category & {
  productCount: number;
  activeProductCount: number;
  productsWithoutImage: number;
  empty: boolean;
};

export type CategoryDraft = { name: string; description: string; image_url: string; icon: string; is_active: boolean };
