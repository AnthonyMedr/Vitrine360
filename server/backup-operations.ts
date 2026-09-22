import crypto from "node:crypto";
import type { DatabaseShape } from "./db";
import { appConfig } from "./config";

const REQUIRED_ARRAY_TABLES = [
  "users",
  "brands",
  "categories",
  "products",
  "orders",
  "orderItems",
  "auditLogs",
  "coupons",
  "stores",
  "sellers",
  "payments",
  "quotes",
  "quoteItems",
  "customerProfiles",
  "leads",
  "deliveryZones",
  "authOtps",
  "establishments",
  "fiscalProfiles",
  "inventoryLots",
  "inventoryMovements",
  "fiscalDocuments",
  "catalogStaging",
  "freightQuoteCache",
  "freightQuoteHistory",
  "freightErrorLogs",
  "fiscalAiSuggestions",
  "fiscalNcmCache",
  "aiSettings",
  "aiUsageLogs",
] as const;

const REQUIRED_OBJECT_TABLES = ["siteContent", "commercialSettings"] as const;

type RequiredArrayTable = (typeof REQUIRED_ARRAY_TABLES)[number];
type RequiredObjectTable = (typeof REQUIRED_OBJECT_TABLES)[number];

export type RuntimeBackupPayload = {
  schema_version: 1;
  generated_at: string;
  source: {
    app_env: string;
    db_provider: string;
  };
  redaction?: {
    sensitive_fields_redacted: boolean;
    fields: string[];
  };
  counts: Record<RequiredArrayTable, number>;
  checksum: {
    algorithm: "sha256";
    value: string;
  };
  data: DatabaseShape;
};

export type RuntimeBackupValidation = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  counts: Partial<Record<RequiredArrayTable, number>>;
  checksum_matches: boolean;
};

function hashBackupData(data: DatabaseShape) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

const SENSITIVE_BACKUP_FIELDS = [
  "password",
  "password_hash",
  "password_salt",
  "code_hash",
  "encrypted_value",
  "encryptedValue",
  "access_token",
  "refresh_token",
  "webhook_secret",
  "secret",
  "token",
  "session_token",
  "tracking_token",
  "csrf_token",
  "csrfToken",
] as const;

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_BACKUP_FIELDS.some((field) => normalized === field || normalized.endsWith(`_${field}`));
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, shouldRedactKey(key) && entry != null ? "[REDACTED]" : redactSensitiveValue(entry)]),
    );
  }
  return value;
}

function buildCounts(db: DatabaseShape) {
  return Object.fromEntries(REQUIRED_ARRAY_TABLES.map((key) => [key, Array.isArray(db[key]) ? db[key].length : 0])) as Record<
    RequiredArrayTable,
    number
  >;
}

export function createRuntimeBackupPayload(
  db: DatabaseShape,
  generatedAt = new Date().toISOString(),
  options: { redactSensitive?: boolean } = {},
): RuntimeBackupPayload {
  const data = (options.redactSensitive ? redactSensitiveValue(db) : db) as DatabaseShape;
  return {
    schema_version: 1,
    generated_at: generatedAt,
    source: {
      app_env: appConfig.env,
      db_provider: appConfig.dbProvider,
    },
    ...(options.redactSensitive
      ? {
          redaction: {
            sensitive_fields_redacted: true,
            fields: [...SENSITIVE_BACKUP_FIELDS],
          },
        }
      : {}),
    counts: buildCounts(data),
    checksum: {
      algorithm: "sha256",
      value: hashBackupData(data),
    },
    data,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRuntimeBackupPayload(payload: unknown): RuntimeBackupValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const counts: Partial<Record<RequiredArrayTable, number>> = {};

  if (!isObjectRecord(payload)) {
    return {
      ok: false,
      blockers: ["payload_invalid"],
      warnings,
      counts,
      checksum_matches: false,
    };
  }

  if (payload.schema_version !== 1) blockers.push("schema_version_invalid");
  if (typeof payload.generated_at !== "string" || Number.isNaN(Date.parse(payload.generated_at))) {
    blockers.push("generated_at_invalid");
  }
  const redaction = isObjectRecord(payload.redaction) ? payload.redaction : null;
  if (redaction?.sensitive_fields_redacted === true) {
    warnings.push("sensitive_fields_redacted");
  }

  const data = payload.data;
  if (!isObjectRecord(data)) {
    blockers.push("data_invalid");
  } else {
    for (const table of REQUIRED_ARRAY_TABLES) {
      if (!Array.isArray(data[table])) {
        blockers.push(`${table}_missing`);
      } else {
        counts[table] = data[table].length;
      }
    }

    for (const table of REQUIRED_OBJECT_TABLES) {
      if (!isObjectRecord(data[table])) blockers.push(`${table}_missing`);
    }

    if (Array.isArray(data.products) && data.products.length === 0) warnings.push("products_empty");
    if (Array.isArray(data.categories) && data.categories.length === 0) warnings.push("categories_empty");
  }

  const checksum = isObjectRecord(payload.checksum) ? payload.checksum : null;
  const expectedChecksum = isObjectRecord(data) ? hashBackupData(data as unknown as DatabaseShape) : "";
  const checksumMatches = checksum?.algorithm === "sha256" && checksum.value === expectedChecksum;
  if (!checksumMatches) blockers.push("checksum_mismatch");

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    counts,
    checksum_matches: checksumMatches,
  };
}
