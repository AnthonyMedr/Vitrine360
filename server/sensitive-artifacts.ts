import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRuntimeBackupPayload, validateRuntimeBackupPayload, type RuntimeBackupPayload } from "./backup-operations";

const SENSITIVE_JSON_KEYS = new Set([
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
]);

type Finding = {
  file: string;
  key: string;
  path: string;
};

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) return listJsonFiles(filePath);
    return entry.endsWith(".json") ? [filePath] : [];
  });
}

function scanValue(value: unknown, file: string, currentPath: string, findings: Finding[]) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValue(entry, file, `${currentPath}[${index}]`, findings));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (SENSITIVE_JSON_KEYS.has(key) && entry != null && entry !== "[REDACTED]") {
      findings.push({ file, key, path: nextPath });
    }
    scanValue(entry, file, nextPath, findings);
  }
}

function parseJsonFile(file: string) {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, SENSITIVE_JSON_KEYS.has(key) && entry != null ? "[REDACTED]" : redactJsonValue(entry)]),
  );
}

export function checkSensitiveRuntimeBackupArtifacts(projectRoot = process.cwd()) {
  const runtimeBackupDir = path.join(projectRoot, "docs", "reports", "runtime-backups");
  const files = listJsonFiles(runtimeBackupDir);
  const findings: Finding[] = [];

  for (const file of files) {
    const parsed = parseJsonFile(file);
    if (parsed) scanValue(parsed, file, "", findings);
  }

  return {
    ok: findings.length === 0,
    scanned_files: files.length,
    findings,
    next_steps:
      findings.length === 0
        ? ["Manter backups em docs/reports sempre redigidos."]
        : ["Executar npm run security:artifacts:sanitize para redigir backups em docs/reports/runtime-backups."],
  };
}

function isRuntimeBackupPayload(value: unknown): value is RuntimeBackupPayload {
  return Boolean(value && typeof value === "object" && (value as RuntimeBackupPayload).schema_version === 1 && (value as RuntimeBackupPayload).data);
}

export function sanitizeRuntimeBackupArtifacts(projectRoot = process.cwd()) {
  const runtimeBackupDir = path.join(projectRoot, "docs", "reports", "runtime-backups");
  const files = listJsonFiles(runtimeBackupDir);
  const changed: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const parsed = parseJsonFile(file);
    if (!isRuntimeBackupPayload(parsed)) {
      if (parsed) {
        writeFileSync(file, `${JSON.stringify(redactJsonValue(parsed), null, 2)}\n`, "utf8");
        changed.push(file);
      } else {
        skipped.push(file);
      }
      continue;
    }

    const sanitized = createRuntimeBackupPayload(parsed.data, parsed.generated_at, { redactSensitive: true });
    const validation = validateRuntimeBackupPayload(sanitized);
    if (!validation.ok) {
      writeFileSync(file, `${JSON.stringify(redactJsonValue(parsed), null, 2)}\n`, "utf8");
      changed.push(file);
      continue;
    }

    writeFileSync(file, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    changed.push(file);
  }

  const postCheck = checkSensitiveRuntimeBackupArtifacts(projectRoot);

  return {
    ok: postCheck.ok,
    scanned_files: files.length,
    changed,
    skipped,
    remaining_findings: postCheck.findings,
  };
}
