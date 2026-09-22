import type { DatabaseShape } from "./db";
import { createAuditEvent } from "./order-domain";

export type FiscalClosePackEditableRow = {
  fiscal_profile_id: string;
  product_id: string;
  manual_fill_template?: {
    ncm?: string;
    cst_icms_default?: string;
    csosn_default?: string;
    weight?: string;
    tax_rule_status?: "review" | "pending" | "ready";
    note?: string;
  };
};

export type FiscalClosePackApplyReport = {
  changed: boolean;
  metrics: {
    applied: number;
    skipped: number;
    invalid: number;
  };
  applied_rows: Array<{
    fiscal_profile_id: string;
    product_id: string;
    applied_fields: string[];
  }>;
  skipped_rows: Array<{
    fiscal_profile_id: string;
    product_id: string;
    reason: string;
  }>;
  invalid_rows: Array<{
    fiscal_profile_id: string;
    product_id: string;
    reason: string;
  }>;
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePositiveNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function markAppliedFiscalAiSuggestion(
  db: DatabaseShape,
  row: FiscalClosePackEditableRow,
  input: {
    actorId?: string | null;
    actorName: string;
    correlationId: string;
  },
) {
  const template = row.manual_fill_template ?? {};
  const ncm = normalizeString(template.ncm);
  const cst = normalizeString(template.cst_icms_default);
  const csosn = normalizeString(template.csosn_default);
  const weight = normalizePositiveNumber(template.weight);
  const suggestion = db.fiscalAiSuggestions.find((entry) => {
    if (entry.fiscal_profile_id !== row.fiscal_profile_id || entry.product_id !== row.product_id) return false;
    if (entry.status !== "exported" && entry.status !== "approved") return false;
    const approved = entry.approved_fill_template;
    if (!approved) return false;
    const approvedNcm = normalizeString(approved.ncm);
    const approvedCst = normalizeString(approved.cst_icms_default);
    const approvedCsosn = normalizeString(approved.csosn_default);
    const approvedWeight = normalizePositiveNumber(approved.weight);
    return approvedNcm === ncm && approvedCst === cst && approvedCsosn === csosn && approvedWeight === weight;
  });

  if (!suggestion) return;

  const previousValue = {
    status: suggestion.status,
    applied_at: suggestion.applied_at,
  };
  const now = new Date().toISOString();
  suggestion.status = "applied";
  suggestion.applied_at = now;
  suggestion.updated_at = now;

  createAuditEvent(db, {
    eventType: "fiscal.ai_suggestion_applied",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: {
      status: suggestion.status,
      applied_at: suggestion.applied_at,
    },
    payload: {
      suggestion_id: suggestion.id,
      fiscal_profile_id: suggestion.fiscal_profile_id,
      product_id: suggestion.product_id,
    },
  });
}

export function applyFiscalClosePack(
  db: DatabaseShape,
  rows: FiscalClosePackEditableRow[],
  input: {
    actorId?: string | null;
    actorName: string;
    correlationId: string;
  },
): FiscalClosePackApplyReport {
  const applied_rows: FiscalClosePackApplyReport["applied_rows"] = [];
  const skipped_rows: FiscalClosePackApplyReport["skipped_rows"] = [];
  const invalid_rows: FiscalClosePackApplyReport["invalid_rows"] = [];

  for (const row of rows) {
    const profile = db.fiscalProfiles.find((entry) => entry.id === row.fiscal_profile_id && entry.product_id === row.product_id);
    const product = db.products.find((entry) => entry.id === row.product_id) ?? null;

    if (!profile || !product) {
      invalid_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "Perfil fiscal ou produto nao encontrado.",
      });
      continue;
    }

    const template = row.manual_fill_template ?? {};
    const ncm = normalizeString(template.ncm);
    const cst = normalizeString(template.cst_icms_default);
    const csosn = normalizeString(template.csosn_default);
    const weight = normalizePositiveNumber(template.weight);

    if (!ncm && !cst && !csosn && !weight) {
      skipped_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "Linha sem preenchimento manual; nada para aplicar.",
      });
      continue;
    }

    if (!ncm) {
      invalid_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "NCM obrigatorio para aplicar o close pack.",
      });
      continue;
    }

    if ((cst && csosn) || (!cst && !csosn)) {
      invalid_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "Preencha exatamente um entre CST ICMS e CSOSN.",
      });
      continue;
    }

    if (!weight) {
      invalid_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "Peso positivo obrigatorio para aplicar o close pack.",
      });
      continue;
    }

    const applied_fields: string[] = [];
    const previousValue = {
      profile: {
        ncm: profile.ncm,
        cst_icms_default: profile.cst_icms_default,
        csosn_default: profile.csosn_default,
        tax_rule_status: profile.tax_rule_status,
      },
      product: {
        ncm: product.ncm,
        weight: product.weight,
        tax_classification_status: product.tax_classification_status,
      },
    };

    if (profile.ncm !== ncm) {
      profile.ncm = ncm;
      applied_fields.push("profile.ncm");
    }
    if (product.ncm !== ncm) {
      product.ncm = ncm;
      applied_fields.push("product.ncm");
    }

    if (cst) {
      if (profile.cst_icms_default !== cst) {
        profile.cst_icms_default = cst;
        applied_fields.push("profile.cst_icms_default");
      }
      if (profile.csosn_default !== null) {
        profile.csosn_default = null;
        applied_fields.push("profile.csosn_default");
      }
    } else if (csosn) {
      if (profile.csosn_default !== csosn) {
        profile.csosn_default = csosn;
        applied_fields.push("profile.csosn_default");
      }
      if (profile.cst_icms_default !== null) {
        profile.cst_icms_default = null;
        applied_fields.push("profile.cst_icms_default");
      }
    }

    if (product.weight !== weight) {
      product.weight = weight;
      applied_fields.push("product.weight");
    }

    const nextTaxRuleStatus = template.tax_rule_status === "pending" ? "pending" : "review";
    if (profile.tax_rule_status !== nextTaxRuleStatus) {
      profile.tax_rule_status = nextTaxRuleStatus;
      applied_fields.push("profile.tax_rule_status");
    }
    if (product.tax_classification_status !== "review") {
      product.tax_classification_status = "review";
      applied_fields.push("product.tax_classification_status");
    }

    profile.updated_at = new Date().toISOString();

    if (applied_fields.length === 0) {
      skipped_rows.push({
        fiscal_profile_id: row.fiscal_profile_id,
        product_id: row.product_id,
        reason: "Linha valida, mas sem mudanca efetiva.",
      });
      continue;
    }

    createAuditEvent(db, {
      eventType: "fiscal.close_pack_applied",
      correlationId: input.correlationId,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      sourceChannel: "integration",
      previousValue,
      newValue: {
        profile: {
          ncm: profile.ncm,
          cst_icms_default: profile.cst_icms_default,
          csosn_default: profile.csosn_default,
          tax_rule_status: profile.tax_rule_status,
        },
        product: {
          ncm: product.ncm,
          weight: product.weight,
          tax_classification_status: product.tax_classification_status,
        },
      },
      payload: {
        fiscal_profile_id: profile.id,
        product_id: product.id,
        applied_fields,
        note: normalizeString(template.note),
      },
    });

    markAppliedFiscalAiSuggestion(db, row, input);

    applied_rows.push({
      fiscal_profile_id: profile.id,
      product_id: product.id,
      applied_fields,
    });
  }

  return {
    changed: applied_rows.length > 0,
    metrics: {
      applied: applied_rows.length,
      skipped: skipped_rows.length,
      invalid: invalid_rows.length,
    },
    applied_rows,
    skipped_rows,
    invalid_rows,
  };
}
