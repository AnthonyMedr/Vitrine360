import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  renderHomologationEvidenceValidationMarkdown,
  validateHomologationEvidenceCsv,
} from "../server/homologation-evidence-validation.ts";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

const inputPath = resolve(getArg("--input") ?? process.argv.find((arg) => arg.endsWith(".csv")) ?? "docs/reports/homologation-evidence-pack-latest.csv");
const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/homologation-evidence-validation-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const report = validateHomologationEvidenceCsv(inputPath);

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderHomologationEvidenceValidationMarkdown(report)}\n`, "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  rows: report.rows,
  completed_rows: report.completed_rows,
  pending_rows: report.pending_rows,
  blocked_external_rows: report.blocked_external_rows,
  failed_rows: report.failed_rows,
  issues: report.issues.length,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
