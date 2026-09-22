import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initializeDb, readDb, writeDb } from "../server/db.ts";
import { exportApprovedFiscalAiClosePack } from "../server/fiscal-ai-assistant.ts";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function getScope() {
  const entry = process.argv.find((arg) => arg.startsWith("--scope="));
  return entry?.split("=")[1] === "global" ? "global" : "minimal-go-live";
}

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function toCsv(pack: ReturnType<typeof exportApprovedFiscalAiClosePack>) {
  const headers = [
    "fiscal_profile_id",
    "product_id",
    "manual_fill_ncm",
    "manual_fill_cst_icms_default",
    "manual_fill_csosn_default",
    "manual_fill_weight",
    "manual_fill_tax_rule_status",
    "manual_fill_note",
  ];
  const rows = pack.rows.map((row) => {
    const template = row.manual_fill_template;
    return [
      row.fiscal_profile_id,
      row.product_id,
      template.ncm,
      template.cst_icms_default,
      template.csosn_default,
      template.weight,
      template.tax_rule_status,
      template.note,
    ].map(escapeCsv).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

async function main() {
  await initializeDb();
  const db = readDb();
  const apply = hasFlag("--apply");
  const scope = getScope();
  const pack = exportApprovedFiscalAiClosePack(db, {
    scope,
    actorId: "script-fiscal-ai-export",
    actorName: "Fiscal AI Close Pack Export Script",
    correlationId: `fiscal-ai-export-${Date.now()}`,
  });

  const outArg = getArg("--out");
  const defaultBase = resolve("docs", "reports", scope === "global" ? "fiscal-ai-close-pack-global" : "fiscal-ai-close-pack-minimal");
  const basePath = resolve(outArg ?? defaultBase);
  const jsonPath = basePath.endsWith(".json") || basePath.endsWith(".csv") ? basePath.replace(/\.(json|csv)$/i, "") + ".json" : `${basePath}.json`;
  const csvPath = basePath.endsWith(".json") || basePath.endsWith(".csv") ? basePath.replace(/\.(json|csv)$/i, "") + ".csv" : `${basePath}.csv`;

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  writeFileSync(csvPath, `${toCsv(pack)}\n`, "utf8");

  if (apply) writeDb(db);
  console.log(JSON.stringify({ ...pack, dry_run: !apply, jsonPath, csvPath }, null, 2));
}

void main();
