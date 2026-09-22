import type { DatabaseShape } from "./db";
import { getAdminFiscalWorkboard, type AdminFiscalScope } from "./read-models";

export type FiscalClosePackRow = {
  fiscal_profile_id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string;
  establishment_id: string;
  category: string | null;
  subcategory: string | null;
  material: string | null;
  fiscal_group: string | null;
  current_origin_code: string | null;
  current_ncm: string | null;
  current_cst_icms_default: string | null;
  current_csosn_default: string | null;
  current_cfop_internal_default: string | null;
  current_cfop_interstate_default: string | null;
  current_weight: number | null;
  current_weight_per_unit: number | null;
  current_weight_per_package: number | null;
  current_dimensions: string | null;
  current_measures: string | null;
  width: number | null;
  height: number | null;
  length: number | null;
  missing_fields: string[];
  criticality: "critical" | "high";
  responsible: "contador";
  go_live_impact: string;
  completion_status: "pending_fill" | "ready_for_apply";
  recommended_action: string;
  manual_fill_template: {
    ncm: string;
    cst_icms_default: string;
    csosn_default: string;
    weight: string;
    tax_rule_status: "review";
    note: string;
  };
};

export type FiscalClosePack = {
  scope: AdminFiscalScope;
  generated_at: string;
  metrics: {
    pending_fiscal_profiles: number;
    ready_eligible_fiscal_profiles: number;
    pending_catalog_items: number;
    pending_fiscal_documents: number;
  };
  rows: FiscalClosePackRow[];
  next_steps: string[];
};

export function buildFiscalClosePack(db: DatabaseShape, options?: { scope?: AdminFiscalScope }): FiscalClosePack {
  const scope = options?.scope ?? "minimal-go-live";
  const workboard = getAdminFiscalWorkboard(db, { scope });

  const rows = workboard.profiles.map((profile) => {
    const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
    const fiscalProfile = db.fiscalProfiles.find((entry) => entry.id === profile.id) ?? null;
    const category = product?.category_id ? db.categories.find((entry) => entry.id === product.category_id) ?? null : null;

    return {
      fiscal_profile_id: profile.id,
      product_id: profile.product_id,
      product_sku: product?.sku ?? null,
      product_name: profile.product_name,
      establishment_id: profile.establishment_id,
      category: category?.name ?? null,
      subcategory: product?.subcategory ?? null,
      material: product?.material ?? null,
      fiscal_group: product?.fiscal_group ?? null,
      current_origin_code: fiscalProfile?.origin_code ?? product?.origin_code ?? null,
      current_ncm: fiscalProfile?.ncm ?? product?.ncm ?? null,
      current_cst_icms_default: fiscalProfile?.cst_icms_default ?? null,
      current_csosn_default: fiscalProfile?.csosn_default ?? null,
      current_cfop_internal_default: fiscalProfile?.cfop_internal_default ?? null,
      current_cfop_interstate_default: fiscalProfile?.cfop_interstate_default ?? null,
      current_weight: product?.weight ?? null,
      current_weight_per_unit: product?.weight_per_unit ?? null,
      current_weight_per_package: product?.weight_per_package ?? null,
      current_dimensions: product?.dimensions ?? null,
      current_measures: product?.measures ?? null,
      width: typeof product?.width === "number" ? product.width : null,
      height: typeof product?.height === "number" ? product.height : null,
      length: typeof product?.length === "number" ? product.length : null,
      missing_fields: profile.missing_fields,
      criticality: (scope === "minimal-go-live" ? "critical" : "high") as "critical" | "high",
      responsible: "contador" as const,
      go_live_impact:
        scope === "minimal-go-live"
          ? "Bloqueia o soft launch regional do mix minimo ate fechamento fiscal validado."
          : "Bloqueia publicacao ampla e escala estadual/nacional ate saneamento fiscal.",
      completion_status: "pending_fill" as const,
      recommended_action: profile.recommended_action,
      // Keep the manual payload explicit so the final tax inputs can be filled without guessing.
      manual_fill_template: {
        ncm: "",
        cst_icms_default: "",
        csosn_default: "",
        weight: "",
        tax_rule_status: "review" as const,
        note: "Preencher apenas com validacao fiscal/contabil. Nao inferir tributacao automaticamente.",
      },
    };
  });

  return {
    scope,
    generated_at: new Date().toISOString(),
    metrics: {
      pending_fiscal_profiles: workboard.metrics.pending_fiscal_profiles,
      ready_eligible_fiscal_profiles: workboard.metrics.ready_eligible_fiscal_profiles,
      pending_catalog_items: workboard.metrics.pending_catalog_items,
      pending_fiscal_documents: workboard.metrics.pending_fiscal_documents,
    },
    rows,
    next_steps: [
      "Preencher NCM e CST/CSOSN somente com validacao fiscal/contabil.",
      "Atualizar peso quando houver dado fisico confiavel do item ou embalagem.",
      "Reexecutar npm run fiscal:check:minimal apos salvar os perfis.",
    ],
  };
}
