import crypto from "node:crypto";
import { appConfig } from "./config";
import { createId, type DatabaseShape, type DbAiSettings, type DbAiUsageLog } from "./db";

export type AiModule = DbAiUsageLog["module"];
export type AiTaskStatus = DbAiUsageLog["status"];

export function estimateTokensFromChars(chars: number) {
  return Math.ceil(Math.max(0, chars) / 4);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
}

export function stableContextHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

export function getAiSettings(db: DatabaseShape): DbAiSettings {
  const stored = db.aiSettings.find((entry) => entry.id === "default");
  const now = new Date().toISOString();
  return {
    id: "default",
    enabled: appConfig.ai.enabled || stored?.enabled === true,
    provider: "openai",
    max_daily_calls: Number.isFinite(appConfig.ai.maxDailyCalls) ? appConfig.ai.maxDailyCalls : stored?.max_daily_calls ?? 200,
    max_input_chars: Number.isFinite(appConfig.ai.maxInputChars) ? appConfig.ai.maxInputChars : stored?.max_input_chars ?? 6000,
    cache_ttl_days: Number.isFinite(appConfig.ai.cacheTtlDays) ? appConfig.ai.cacheTtlDays : stored?.cache_ttl_days ?? 30,
    batch_max_items: Number.isFinite(appConfig.ai.batchMaxItems) ? appConfig.ai.batchMaxItems : stored?.batch_max_items ?? 12,
    fiscal_prompt_version: stored?.fiscal_prompt_version ?? "fiscal_v2_compact",
    created_at: stored?.created_at ?? now,
    updated_at: stored?.updated_at ?? now,
  };
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

export function evaluateAiPolicy(db: DatabaseShape, input: {
  module: AiModule;
  task: string;
  inputChars: number;
  contextHash?: string | null;
}) {
  const settings = getAiSettings(db);
  if (!settings.enabled) return { allowed: false, reason: "ai_disabled", settings };
  if (!appConfig.openai.apiKey) return { allowed: false, reason: "missing_openai_api_key", settings };
  if (input.inputChars > settings.max_input_chars) return { allowed: false, reason: "input_too_large", settings };
  const today = todayPrefix();
  const callsToday = db.aiUsageLogs.filter((entry) => (
    entry.provider === "openai" &&
    entry.status === "success" &&
    entry.created_at.startsWith(today)
  )).length;
  if (callsToday >= settings.max_daily_calls) return { allowed: false, reason: "daily_call_limit_reached", settings };
  return { allowed: true, reason: "allowed", settings };
}

export function logAiUsage(db: DatabaseShape, input: {
  module: AiModule;
  task: string;
  provider: "openai" | "local";
  model?: string | null;
  status: AiTaskStatus;
  reason: string;
  contextHash?: string | null;
  promptVersion?: string | null;
  inputChars?: number;
  outputChars?: number;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const inputChars = input.inputChars ?? 0;
  const outputChars = input.outputChars ?? 0;
  const log: DbAiUsageLog = {
    id: createId(),
    module: input.module,
    task: input.task,
    provider: input.provider,
    model: input.model ?? null,
    status: input.status,
    reason: input.reason,
    context_hash: input.contextHash ?? null,
    prompt_version: input.promptVersion ?? null,
    input_chars: inputChars,
    output_chars: outputChars,
    estimated_input_tokens: estimateTokensFromChars(inputChars),
    estimated_output_tokens: estimateTokensFromChars(outputChars),
    cache_hit: input.cacheHit === true,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };
  db.aiUsageLogs.unshift(log);
  db.aiUsageLogs = db.aiUsageLogs.slice(0, 5000);
  return log;
}

export function getAiUsageOverview(db: DatabaseShape) {
  const settings = getAiSettings(db);
  const logs = db.aiUsageLogs;
  const totals = logs.reduce(
    (acc, log) => {
      acc.calls += log.provider === "openai" && log.status === "success" ? 1 : 0;
      acc.cache_hits += log.cache_hit ? 1 : 0;
      acc.skipped += log.status === "skipped" ? 1 : 0;
      acc.errors += log.status === "error" ? 1 : 0;
      acc.estimated_input_tokens += log.estimated_input_tokens;
      acc.estimated_output_tokens += log.estimated_output_tokens;
      return acc;
    },
    { calls: 0, cache_hits: 0, skipped: 0, errors: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
  );
  return {
    settings,
    totals,
    cache_hit_ratio: logs.length > 0 ? totals.cache_hits / logs.length : 0,
    latest: logs.slice(0, 50),
  };
}
