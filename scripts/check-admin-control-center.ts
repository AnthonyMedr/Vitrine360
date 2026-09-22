import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildAdminControlCenter, renderAdminControlCenterMarkdown } from "../server/admin-control-center";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-control-center-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const report = buildAdminControlCenter();

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderAdminControlCenterMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  internal_management_ready: report.internal_management_ready,
  production_open: report.production_open,
  pending_real_execution: report.summary.pending_real_execution,
  blocked_external: report.summary.blocked_external,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
