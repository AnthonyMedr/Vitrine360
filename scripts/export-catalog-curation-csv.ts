import fs from "node:fs";
import path from "node:path";
import { initializeDb, readDb } from "../server/db.ts";
import { getAdminCatalogImageAudit } from "../server/catalog-image-audit.ts";

function resolveDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

await initializeDb();
const audit = getAdminCatalogImageAudit(readDb());
const date = resolveDate();
const reportsDir = path.join(process.cwd(), "docs", "reports");
const outputPath = path.join(reportsDir, `catalog-curation-queue-${date}.csv`);
fs.mkdirSync(reportsDir, { recursive: true });

const headers = [
  "product_id",
  "sku",
  "product_name",
  "category_name",
  "is_active",
  "review_status",
  "audit_status",
  "priority",
  "primary_image",
  "duplicate_count",
  "issues",
  "recommended_action",
  "decision",
  "decision_notes",
];

const rows = audit.items
  .filter((item) => item.audit_status !== "ok")
  .sort((a, b) => {
    const activeRank = Number(b.is_active) - Number(a.is_active);
    if (activeRank !== 0) return activeRank;
    return a.category_name.localeCompare(b.category_name) || a.product_name.localeCompare(b.product_name);
  })
  .map((item) => [
    item.product_id,
    item.sku || "",
    item.product_name,
    item.category_name || "Sem categoria",
    item.is_active ? "true" : "false",
    item.review_status,
    item.audit_status,
    item.is_active && item.audit_status === "critical" ? "critica" : item.is_active ? "alta" : "media",
    item.primary_image || "",
    item.duplicate_count,
    item.issues.map((issue) => issue.label).join(" | "),
    item.recommended_action,
    "",
    "",
  ]);

const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
fs.writeFileSync(outputPath, csv, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      output: path.relative(process.cwd(), outputPath),
      rows: rows.length,
    },
    null,
    2,
  ),
);
