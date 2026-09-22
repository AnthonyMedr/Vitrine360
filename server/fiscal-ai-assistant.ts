import { z } from "zod";
import {
  createId,
  type DatabaseShape,
  type DbFiscalAiEvidence,
  type DbFiscalAiSuggestion,
  type DbFiscalNcmCacheEntry,
  type DbFiscalProfile,
  type DbProduct,
} from "./db";
import { appConfig } from "./config";
import { createAuditEvent } from "./order-domain";
import { getAdminFiscalWorkboard, type AdminFiscalScope } from "./read-models";
import { estimateTokensFromChars, evaluateAiPolicy, getAiSettings, logAiUsage, stableContextHash } from "./ai-governance";

const NCM_PUBLIC_JSON_URL = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";

const openAiSuggestionSchema = z.object({
  suggested_ncm: z.string().nullable().optional(),
  suggested_tax_code: z.string().nullable().optional(),
  suggested_tax_code_type: z.enum(["cst_icms_default", "csosn_default"]).nullable().optional(),
  suggested_cest: z.string().nullable().optional(),
  suggested_origin_code: z.string().nullable().optional(),
  suggested_weight: z.number().positive().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(1),
  evidence: z.array(z.object({
    type: z.enum(["similar_product", "ncm_table", "manual_rule", "catalog_context", "openai"]),
    reference: z.string(),
    detail: z.string(),
  })).default([]),
});

type OpenAiSuggestionPayload = z.infer<typeof openAiSuggestionSchema>;

export type FiscalAiCompressedContext = {
  promptVersion: string;
  contextHash: string;
  inputChars: number;
  estimatedInputTokens: number;
  categoryName: string | null;
  similar: ReturnType<typeof findSimilarClassifiedProducts>;
  ncmMatches: DbFiscalNcmCacheEntry[];
  payload: {
    profile_id: string;
    product_id: string;
    scope: AdminFiscalScope;
    missing_fields: string[];
    product: {
      sku: string | null;
      name: string | null;
      category: string | null;
      subcategory: string | null;
      material: string | null;
      fiscal_group: string | null;
      weight: number | null;
      dimensions: string | null;
    } | null;
    current_fiscal: {
      ncm: string | null;
      cst_icms_default: string | null;
      csosn_default: string | null;
      cest: string | null;
      origin_code: string | null;
      tax_rule_status: string | null;
    };
    similar_approved: Array<{
      sku: string | null;
      ncm: string | null;
      tax_code_type: "cst_icms_default" | "csosn_default" | null;
      tax_code: string | null;
      cest: string | null;
      origin_code: string | null;
    }>;
    ncm_candidates: Array<{
      code: string;
      description: string;
      version: string;
    }>;
    instruction: "suggest_candidates_only_or_manual_required";
  };
};

function normalizeNcm(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function productCategoryName(db: DatabaseShape, product: DbProduct | null) {
  if (!product) return null;
  return product.category_id ? db.categories.find((entry) => entry.id === product.category_id)?.name ?? null : null;
}

function getTaxCode(profile: DbFiscalProfile) {
  if (profile.cst_icms_default) {
    return { value: profile.cst_icms_default, type: "cst_icms_default" as const };
  }
  if (profile.csosn_default) {
    return { value: profile.csosn_default, type: "csosn_default" as const };
  }
  return { value: null, type: null };
}

function isSimilarProduct(source: DbProduct | null, candidate: DbProduct | null) {
  if (!source || !candidate || source.id === candidate.id) return false;
  const sameFiscalGroup =
    Boolean(source.fiscal_group && candidate.fiscal_group) &&
    source.fiscal_group?.trim().toLowerCase() === candidate.fiscal_group?.trim().toLowerCase();
  const sameCategory = Boolean(source.category_id && candidate.category_id && source.category_id === candidate.category_id);
  const sameSubcategory =
    Boolean(source.subcategory && candidate.subcategory) &&
    source.subcategory?.trim().toLowerCase() === candidate.subcategory?.trim().toLowerCase();
  return Boolean(sameFiscalGroup || sameCategory || sameSubcategory);
}

function findSimilarClassifiedProducts(db: DatabaseShape, product: DbProduct | null, limit = 5) {
  return db.fiscalProfiles
    .map((profile) => {
      const candidateProduct = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const taxCode = getTaxCode(profile);
      return { profile, product: candidateProduct, taxCode };
    })
    .filter((entry) => {
      return (
        entry.product &&
        isSimilarProduct(product, entry.product) &&
        Boolean(entry.profile.ncm && entry.taxCode.value && entry.profile.tax_rule_status !== "pending")
      );
    })
    .slice(0, limit);
}

function searchNcmCache(db: DatabaseShape, product: DbProduct | null, categoryName: string | null, limit = 5) {
  if (!product) return [];
  const terms = [product.name, product.subcategory, product.material, product.fiscal_group, categoryName]
    .filter((item): item is string => Boolean(item))
    .flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length >= 3);
  const uniqueTerms = [...new Set(terms)];
  return db.fiscalNcmCache
    .map((entry) => {
      const description = entry.description.toLowerCase();
      const score = uniqueTerms.reduce((total, term) => total + (description.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function buildFiscalAiCompressedContext(db: DatabaseShape, profile: DbFiscalProfile, scope: AdminFiscalScope): FiscalAiCompressedContext {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  const categoryName = productCategoryName(db, product);
  const similar = findSimilarClassifiedProducts(db, product, 3);
  const ncmMatches = searchNcmCache(db, product, categoryName, 3);
  const settings = getAiSettings(db);
  const payload: FiscalAiCompressedContext["payload"] = {
    profile_id: profile.id,
    product_id: profile.product_id,
    scope,
    missing_fields: [
      !profile.ncm && !product?.ncm ? "ncm" : null,
      !profile.cst_icms_default && !profile.csosn_default ? "tax_code" : null,
    ].filter((entry): entry is string => Boolean(entry)),
    product: product
      ? {
          sku: product.sku,
          name: product.name,
          category: categoryName,
          subcategory: product.subcategory,
          material: product.material,
          fiscal_group: product.fiscal_group,
          weight: product.weight ?? product.weight_per_unit ?? product.weight_per_package ?? null,
          dimensions: product.dimensions ?? product.measures ?? null,
        }
      : null,
    current_fiscal: {
      ncm: profile.ncm ?? product?.ncm ?? null,
      cst_icms_default: profile.cst_icms_default,
      csosn_default: profile.csosn_default,
      cest: profile.cest,
      origin_code: profile.origin_code ?? product?.origin_code ?? null,
      tax_rule_status: profile.tax_rule_status,
    },
    similar_approved: similar.map((entry) => ({
      sku: entry.product?.sku ?? null,
      ncm: entry.profile.ncm,
      tax_code_type: entry.taxCode.type,
      tax_code: entry.taxCode.value,
      cest: entry.profile.cest,
      origin_code: entry.profile.origin_code,
    })),
    ncm_candidates: ncmMatches.map((entry) => ({
      code: entry.code,
      description: truncate(entry.description, 160),
      version: entry.version,
    })),
    instruction: "suggest_candidates_only_or_manual_required",
  };
  const inputChars = JSON.stringify(payload).length;
  return {
    promptVersion: settings.fiscal_prompt_version,
    contextHash: stableContextHash({
      promptVersion: settings.fiscal_prompt_version,
      payload,
      ncmCacheVersion: ncmMatches[0]?.version ?? null,
    }),
    inputChars,
    estimatedInputTokens: estimateTokensFromChars(inputChars),
    categoryName,
    similar,
    ncmMatches,
    payload,
  };
}

function buildHeuristicSuggestion(db: DatabaseShape, profile: DbFiscalProfile, scope: AdminFiscalScope): Omit<DbFiscalAiSuggestion, "id" | "created_at" | "updated_at"> {
  const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
  const categoryName = productCategoryName(db, product);
  const similar = findSimilarClassifiedProducts(db, product);
  const ncmMatches = searchNcmCache(db, product, categoryName);
  const firstSimilar = similar[0] ?? null;
  const taxCode = firstSimilar ? firstSimilar.taxCode : { value: null, type: null };
  const ncm = normalizeNcm(profile.ncm) ?? normalizeNcm(product?.ncm ?? null) ?? normalizeNcm(firstSimilar?.profile.ncm ?? null);
  const suggestedWeight = product?.weight ?? product?.weight_per_unit ?? product?.weight_per_package ?? null;
  const evidence: DbFiscalAiEvidence[] = [
    {
      type: "catalog_context",
      reference: product?.sku ?? profile.product_id,
      detail: `Produto ${product?.name ?? profile.product_id}; categoria ${categoryName ?? "sem categoria"}; grupo fiscal ${product?.fiscal_group ?? "nao informado"}.`,
    },
  ];

  similar.forEach((entry) => {
    evidence.push({
      type: "similar_product",
      reference: entry.product?.sku ?? entry.product?.id ?? entry.profile.id,
      detail: `Similar classificado com NCM ${entry.profile.ncm ?? "-"} e codigo tributario ${entry.taxCode.value ?? "-"}.`,
    });
  });
  ncmMatches.forEach((entry) => {
    evidence.push({
      type: "ncm_table",
      reference: entry.code,
      detail: `${entry.description} (${entry.source}, versao ${entry.version}).`,
    });
  });

  const hasTaxCode = Boolean(taxCode.value && taxCode.type);
  const confidence: DbFiscalAiSuggestion["confidence"] = ncm && hasTaxCode && similar.length >= 2 ? "high" : ncm && hasTaxCode ? "medium" : "low";

  return {
    fiscal_profile_id: profile.id,
    product_id: profile.product_id,
    establishment_id: profile.establishment_id,
    scope,
    suggested_ncm: ncm,
    suggested_tax_code: taxCode.value,
    suggested_tax_code_type: taxCode.type,
    suggested_cest: firstSimilar?.profile.cest ?? null,
    suggested_origin_code: profile.origin_code ?? product?.origin_code ?? firstSimilar?.profile.origin_code ?? "0",
    suggested_weight: suggestedWeight,
    confidence,
    evidence,
    rationale:
      confidence === "low"
        ? "Nao ha evidencia suficiente para sugerir classificacao fiscal com seguranca. Encaminhar para preenchimento manual pelo contador."
        : "Sugestao baseada em produtos similares, contexto de catalogo e cache NCM. Deve ser revisada e aprovada pelo contador antes de qualquer aplicacao.",
    status: "pending_review",
    source: "heuristic",
    openai_model: null,
    openai_response_id: null,
    openai_error: null,
    ncm_cache_version: ncmMatches[0]?.version ?? null,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    approved_fill_template: null,
    exported_at: null,
    applied_at: null,
  };
}

function parseOpenAiOutput(payload: unknown): OpenAiSuggestionPayload {
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; output_text?: string; id?: string };
  const text =
    typeof response.output_text === "string"
      ? response.output_text
      : response.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text" && typeof item.text === "string")?.text;
  if (!text) throw new Error("Resposta OpenAI sem texto estruturado.");
  return openAiSuggestionSchema.parse(JSON.parse(text));
}

async function callOpenAiFiscalSuggestion(input: {
  context: FiscalAiCompressedContext;
}) {
  if (!appConfig.openai.apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.openai.requestTimeoutMs);
  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["suggested_ncm", "suggested_tax_code", "suggested_tax_code_type", "suggested_cest", "suggested_origin_code", "suggested_weight", "confidence", "rationale", "evidence"],
      properties: {
        suggested_ncm: { anyOf: [{ type: "string", pattern: "^\\d{8}$" }, { type: "null" }] },
        suggested_tax_code: { anyOf: [{ type: "string" }, { type: "null" }] },
        suggested_tax_code_type: { anyOf: [{ type: "string", enum: ["cst_icms_default", "csosn_default"] }, { type: "null" }] },
        suggested_cest: { anyOf: [{ type: "string" }, { type: "null" }] },
        suggested_origin_code: { anyOf: [{ type: "string" }, { type: "null" }] },
        suggested_weight: { anyOf: [{ type: "number" }, { type: "null" }] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        rationale: { type: "string" },
        evidence: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "reference", "detail"],
            properties: {
              type: { type: "string", enum: ["similar_product", "ncm_table", "manual_rule", "catalog_context", "openai"] },
              reference: { type: "string" },
              detail: { type: "string" },
            },
          },
        },
      },
    };

    const response = await fetch(`${appConfig.openai.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${appConfig.openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: appConfig.openai.fiscalModel,
        input: [
          {
            role: "system",
            content:
              "Assistente fiscal BR. Retorne JSON. Gere candidatos apenas com evidencia. Se evidencia for insuficiente, confidence=low e campos fiscais nulos. Contador decide.",
          },
          {
            role: "user",
            content: JSON.stringify(input.context.payload),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "fiscal_ai_suggestion",
            strict: true,
            schema,
          },
        },
        store: false,
      }),
    });

    const responsePayload = (await response.json().catch(() => null)) as { error?: { message?: string }; id?: string } | null;
    if (!response.ok) {
      throw new Error(responsePayload?.error?.message || `OpenAI retornou ${response.status}`);
    }
    return {
      responseId: typeof responsePayload?.id === "string" ? responsePayload.id : null,
      parsed: parseOpenAiOutput(responsePayload),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mergeOpenAiSuggestion(base: Omit<DbFiscalAiSuggestion, "id" | "created_at" | "updated_at">, ai: OpenAiSuggestionPayload, responseId: string | null): Omit<DbFiscalAiSuggestion, "id" | "created_at" | "updated_at"> {
  const normalizedNcm = normalizeNcm(ai.suggested_ncm) ?? base.suggested_ncm;
  const taxCode = normalizeString(ai.suggested_tax_code) ?? base.suggested_tax_code;
  const taxCodeType = ai.suggested_tax_code_type ?? base.suggested_tax_code_type;
  const hasValidTaxPair = Boolean(taxCode && taxCodeType);
  const confidence = normalizedNcm && hasValidTaxPair ? ai.confidence : "low";
  return {
    ...base,
    suggested_ncm: normalizedNcm,
    suggested_tax_code: hasValidTaxPair ? taxCode : null,
    suggested_tax_code_type: hasValidTaxPair ? taxCodeType : null,
    suggested_cest: normalizeString(ai.suggested_cest) ?? base.suggested_cest,
    suggested_origin_code: normalizeString(ai.suggested_origin_code) ?? base.suggested_origin_code,
    suggested_weight: typeof ai.suggested_weight === "number" && ai.suggested_weight > 0 ? ai.suggested_weight : base.suggested_weight,
    confidence,
    rationale: `${ai.rationale} Revisao e aprovacao do contador continuam obrigatorias.`,
    evidence: [...base.evidence, ...ai.evidence] as DbFiscalAiEvidence[],
    source: "hybrid",
    openai_model: appConfig.openai.fiscalModel,
    openai_response_id: responseId,
    openai_error: null,
  };
}

export function getFiscalAiQueue(db: DatabaseShape, options?: { scope?: AdminFiscalScope }) {
  const scope = options?.scope ?? "minimal-go-live";
  const workboard = getAdminFiscalWorkboard(db, { scope });
  return {
    scope,
    generated_at: new Date().toISOString(),
    metrics: {
      pending_profiles: workboard.profiles.length,
      approved_suggestions: db.fiscalAiSuggestions.filter((entry) => entry.scope === scope && entry.status === "approved").length,
      exported_suggestions: db.fiscalAiSuggestions.filter((entry) => entry.scope === scope && entry.status === "exported").length,
    },
    items: workboard.profiles.map((profile) => {
      const product = db.products.find((entry) => entry.id === profile.product_id) ?? null;
      const latestSuggestion = db.fiscalAiSuggestions
        .filter((entry) => entry.fiscal_profile_id === profile.id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
      return {
        profile,
        product: product
          ? {
              id: product.id,
              sku: product.sku,
              name: product.name,
              category: productCategoryName(db, product),
              subcategory: product.subcategory,
              material: product.material,
              fiscal_group: product.fiscal_group,
            }
          : null,
        latest_suggestion: latestSuggestion,
      };
    }),
  };
}

export async function generateFiscalAiSuggestion(db: DatabaseShape, input: {
  fiscalProfileId: string;
  scope?: AdminFiscalScope;
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const scope = input.scope ?? "minimal-go-live";
  const profile = db.fiscalProfiles.find((entry) => entry.id === input.fiscalProfileId) ?? null;
  if (!profile) return { ok: false as const, error: "Perfil fiscal nao encontrado." };
  const context = buildFiscalAiCompressedContext(db, profile, scope);
  const cachedSuggestion = db.fiscalAiSuggestions.find((entry) => (
    entry.fiscal_profile_id === profile.id &&
    entry.ai_context_hash === context.contextHash &&
    entry.status !== "rejected"
  ));
  if (cachedSuggestion) {
    logAiUsage(db, {
      module: "fiscal",
      task: "fiscal_suggestion",
      provider: "local",
      status: "cache_hit",
      reason: "same_context_hash",
      contextHash: context.contextHash,
      promptVersion: context.promptVersion,
      inputChars: context.inputChars,
      cacheHit: true,
      metadata: { fiscal_profile_id: profile.id, product_id: profile.product_id },
    });
    return { ok: true as const, suggestion: cachedSuggestion, cacheHit: true as const };
  }
  let suggestion = buildHeuristicSuggestion(db, profile, scope);

  const aiPolicy = evaluateAiPolicy(db, {
    module: "fiscal",
    task: "fiscal_suggestion",
    inputChars: context.inputChars,
    contextHash: context.contextHash,
  });

  if (!aiPolicy.allowed) {
    suggestion.evidence.push({
      type: "provider_unavailable",
      reference: aiPolicy.reason,
      detail:
        aiPolicy.reason === "missing_openai_api_key"
          ? "Chave OpenAI ausente; sugestao gerada apenas com heuristica local e revisao manual obrigatoria."
          : `IA nao chamada por politica de governanca: ${aiPolicy.reason}.`,
    });
    suggestion.openai_error = aiPolicy.reason === "missing_openai_api_key" ? "OPENAI_API_KEY ausente." : aiPolicy.reason;
    logAiUsage(db, {
      module: "fiscal",
      task: "fiscal_suggestion",
      provider: "local",
      status: "skipped",
      reason: aiPolicy.reason,
      contextHash: context.contextHash,
      promptVersion: context.promptVersion,
      inputChars: context.inputChars,
      metadata: { fiscal_profile_id: profile.id, product_id: profile.product_id },
    });
  } else {
    try {
      const ai = await callOpenAiFiscalSuggestion({ context });
      if (ai) {
        suggestion = mergeOpenAiSuggestion(suggestion, ai.parsed, ai.responseId);
        logAiUsage(db, {
          module: "fiscal",
          task: "fiscal_suggestion",
          provider: "openai",
          model: appConfig.openai.fiscalModel,
          status: "success",
          reason: "structured_output_validated",
          contextHash: context.contextHash,
          promptVersion: context.promptVersion,
          inputChars: context.inputChars,
          outputChars: JSON.stringify(ai.parsed).length,
          metadata: { fiscal_profile_id: profile.id, product_id: profile.product_id, response_id: ai.responseId },
        });
      }
    } catch (error) {
      suggestion.evidence.push({
        type: "provider_unavailable",
        reference: "openai.responses",
        detail: error instanceof Error ? error.message : "Falha ao chamar OpenAI.",
      });
      suggestion.openai_model = appConfig.openai.fiscalModel;
      suggestion.openai_error = error instanceof Error ? error.message : "Falha ao chamar OpenAI.";
      logAiUsage(db, {
        module: "fiscal",
        task: "fiscal_suggestion",
        provider: "openai",
        model: appConfig.openai.fiscalModel,
        status: "error",
        reason: suggestion.openai_error,
        contextHash: context.contextHash,
        promptVersion: context.promptVersion,
        inputChars: context.inputChars,
        metadata: { fiscal_profile_id: profile.id, product_id: profile.product_id },
      });
    }
  }

  const now = new Date().toISOString();
  const record: DbFiscalAiSuggestion = {
    id: createId(),
    ...suggestion,
    ai_context_hash: context.contextHash,
    ai_prompt_version: context.promptVersion,
    ai_input_chars: context.inputChars,
    ai_estimated_input_tokens: context.estimatedInputTokens,
    ai_call_policy: aiPolicy.allowed && !suggestion.openai_error ? "called" : "skipped",
    created_at: now,
    updated_at: now,
  };
  db.fiscalAiSuggestions.unshift(record);
  createAuditEvent(db, {
    eventType: "fiscal.ai_suggestion_generated",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    payload: {
      suggestion_id: record.id,
      fiscal_profile_id: record.fiscal_profile_id,
      product_id: record.product_id,
      confidence: record.confidence,
      source: record.source,
      openai_model: record.openai_model,
      openai_error: record.openai_error,
    },
  });
  return { ok: true as const, suggestion: record };
}

export function approveFiscalAiSuggestion(db: DatabaseShape, input: {
  suggestionId: string;
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
  notes?: string | null;
  fillTemplate?: Partial<NonNullable<DbFiscalAiSuggestion["approved_fill_template"]>>;
}) {
  const suggestion = db.fiscalAiSuggestions.find((entry) => entry.id === input.suggestionId) ?? null;
  if (!suggestion) return { ok: false as const, error: "Sugestao fiscal nao encontrada." };
  if (suggestion.confidence === "low") return { ok: false as const, error: "Sugestao de baixa confianca deve ser revisada manualmente e nao pode entrar no close pack aprovado." };

  const ncm = normalizeNcm(input.fillTemplate?.ncm ?? suggestion.suggested_ncm);
  const taxCode = normalizeString(input.fillTemplate?.cst_icms_default ?? input.fillTemplate?.csosn_default ?? suggestion.suggested_tax_code);
  const taxCodeType = input.fillTemplate?.cst_icms_default
    ? "cst_icms_default"
    : input.fillTemplate?.csosn_default
      ? "csosn_default"
      : suggestion.suggested_tax_code_type;
  const weight = Number(input.fillTemplate?.weight ?? suggestion.suggested_weight);

  if (!ncm) return { ok: false as const, error: "NCM aprovado deve conter 8 digitos." };
  if (!taxCode || !taxCodeType) return { ok: false as const, error: "Aprovacao exige exatamente um codigo entre CST ICMS e CSOSN." };
  if (!Number.isFinite(weight) || weight <= 0) return { ok: false as const, error: "Peso positivo e obrigatorio para exportar close pack." };

  const previousValue = { status: suggestion.status, approved_fill_template: suggestion.approved_fill_template };
  const now = new Date().toISOString();
  suggestion.status = "approved";
  suggestion.reviewed_by = input.actorId ?? input.actorName ?? "fiscal";
  suggestion.reviewed_at = now;
  suggestion.review_notes = normalizeString(input.notes ?? null);
  suggestion.approved_fill_template = {
    ncm,
    ...(taxCodeType === "cst_icms_default" ? { cst_icms_default: taxCode } : { csosn_default: taxCode }),
    weight: String(weight),
    tax_rule_status: "review",
    note: input.notes?.trim() || "Sugestao aprovada por revisao fiscal humana. Aplicacao ainda depende do close pack.",
  };
  suggestion.updated_at = now;

  createAuditEvent(db, {
    eventType: "fiscal.ai_suggestion_approved",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: { status: suggestion.status, approved_fill_template: suggestion.approved_fill_template },
    payload: { suggestion_id: suggestion.id, fiscal_profile_id: suggestion.fiscal_profile_id, product_id: suggestion.product_id },
  });
  return { ok: true as const, suggestion };
}

export function rejectFiscalAiSuggestion(db: DatabaseShape, input: {
  suggestionId: string;
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
  reason: string;
}) {
  const suggestion = db.fiscalAiSuggestions.find((entry) => entry.id === input.suggestionId) ?? null;
  if (!suggestion) return { ok: false as const, error: "Sugestao fiscal nao encontrada." };
  const reason = normalizeString(input.reason);
  if (!reason) return { ok: false as const, error: "Informe o motivo da rejeicao." };
  const previousValue = { status: suggestion.status, review_notes: suggestion.review_notes };
  const now = new Date().toISOString();
  suggestion.status = "rejected";
  suggestion.reviewed_by = input.actorId ?? input.actorName ?? "fiscal";
  suggestion.reviewed_at = now;
  suggestion.review_notes = reason;
  suggestion.updated_at = now;
  createAuditEvent(db, {
    eventType: "fiscal.ai_suggestion_rejected",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: { status: suggestion.status, review_notes: suggestion.review_notes },
    payload: { suggestion_id: suggestion.id, fiscal_profile_id: suggestion.fiscal_profile_id, product_id: suggestion.product_id },
  });
  return { ok: true as const, suggestion };
}

export function exportApprovedFiscalAiClosePack(db: DatabaseShape, input: {
  scope?: AdminFiscalScope;
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const scope = input.scope ?? "minimal-go-live";
  const now = new Date().toISOString();
  const suggestions = db.fiscalAiSuggestions.filter((entry) => entry.scope === scope && entry.status === "approved" && entry.approved_fill_template);
  const rows = suggestions.map((suggestion) => {
    suggestion.status = "exported";
    suggestion.exported_at = now;
    suggestion.updated_at = now;
    return {
      fiscal_profile_id: suggestion.fiscal_profile_id,
      product_id: suggestion.product_id,
      manual_fill_template: suggestion.approved_fill_template!,
    };
  });
  createAuditEvent(db, {
    eventType: "fiscal.ai_close_pack_exported",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    payload: { scope, rows: rows.length, suggestion_ids: suggestions.map((entry) => entry.id) },
  });
  return {
    scope,
    generated_at: now,
    metrics: { exported: rows.length },
    rows,
    next_steps: [
      "Salvar o payload em CSV ou JSON conforme processo fiscal.",
      "Executar fiscal:close-pack:validate antes de aplicar.",
      "Aplicar somente apos validacao do contador.",
    ],
  };
}

function collectNcmEntries(payload: unknown, sourceUrl: string, version: string): DbFiscalNcmCacheEntry[] {
  const entries: DbFiscalNcmCacheEntry[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const code = normalizeNcm(record.Codigo ?? record.codigo ?? record.code ?? record.ncm ?? record.co_ncm);
    const description = normalizeString(record.Descricao ?? record.descricao ?? record.description ?? record.no_ncm ?? record.nome);
    if (code && description) {
      entries.push({
        id: `ncm-${code}`,
        code,
        description,
        source: "siscomex_public",
        source_url: sourceUrl,
        version,
        effective_from: normalizeString(record.Data_Inicio ?? record.dataInicio ?? record.effective_from ?? null),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(payload);
  return [...new Map(entries.map((entry) => [entry.code, entry])).values()];
}

export async function refreshFiscalNcmCache(db: DatabaseShape, input: {
  actorId?: string | null;
  actorName: string | null;
  correlationId: string;
}) {
  const response = await fetch(NCM_PUBLIC_JSON_URL);
  if (!response.ok) throw new Error(`Falha ao baixar tabela NCM publica: ${response.status}`);
  const payload = await response.json();
  const version = new Date().toISOString().slice(0, 10);
  const entries = collectNcmEntries(payload, NCM_PUBLIC_JSON_URL, version);
  if (entries.length === 0) throw new Error("Tabela NCM publica sem entradas reconhecidas.");
  const previousCount = db.fiscalNcmCache.length;
  const existingManual = db.fiscalNcmCache.filter((entry) => entry.source !== "siscomex_public");
  db.fiscalNcmCache = [...existingManual, ...entries];
  createAuditEvent(db, {
    eventType: "fiscal.ncm_cache_refreshed",
    correlationId: input.correlationId,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    sourceChannel: "integration",
    previousValue: { count: previousCount },
    newValue: { count: db.fiscalNcmCache.length, version },
    payload: { source_url: NCM_PUBLIC_JSON_URL },
  });
  return { ok: true, version, imported: entries.length, total: db.fiscalNcmCache.length };
}
