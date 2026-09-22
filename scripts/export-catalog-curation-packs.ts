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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sem-categoria";
}

function buildPriority(item: ReturnType<typeof getAdminCatalogImageAudit>["items"][number]) {
  if (item.is_active && item.audit_status === "critical") return "critica";
  if (item.is_active) return "alta";
  return "media";
}

await initializeDb();
const audit = getAdminCatalogImageAudit(readDb());
const date = resolveDate();
const reportsDir = path.join(process.cwd(), "docs", "reports");
const packsDir = path.join(reportsDir, `catalog-curation-packs-${date}`);
fs.mkdirSync(packsDir, { recursive: true });

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
  "human_overrides",
  "issues",
  "recommended_action",
  "decision",
  "decision_notes",
];

const categoryFiles: Array<{ category: string; file: string; rows: number }> = [];

for (const category of audit.category_summary.filter((entry) => entry.suspect > 0 || entry.critical > 0 || entry.manual_review > 0)) {
  const items = audit.items
    .filter((item) => (item.category_name || "Sem categoria") === category.category_name)
    .filter((item) => item.audit_status !== "ok")
    .sort((a, b) => {
      const activeRank = Number(b.is_active) - Number(a.is_active);
      if (activeRank !== 0) return activeRank;
      return a.product_name.localeCompare(b.product_name);
    });

  const rows = items.map((item) => [
    item.product_id,
    item.sku || "",
    item.product_name,
    item.category_name || "Sem categoria",
    item.is_active ? "true" : "false",
    item.review_status,
    item.audit_status,
    buildPriority(item),
    item.primary_image || "",
    item.duplicate_count,
    item.human_overrides.join(" | "),
    item.issues.map((issue) => issue.label).join(" | "),
    item.recommended_action,
    "",
    "",
  ]);

  const fileName = `${slugify(category.category_name)}.csv`;
  const outputPath = path.join(packsDir, fileName);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
  fs.writeFileSync(outputPath, csv, "utf8");
  categoryFiles.push({ category: category.category_name, file: fileName, rows: rows.length });
}

const indexLines = [
  "# Packs operacionais de curadoria visual",
  "",
  `Data: ${audit.generated_at}`,
  "",
  "## Resumo",
  "",
  `- Categorias exportadas: ${categoryFiles.length}`,
  `- Itens em revisao: ${audit.review_required}`,
  `- Itens ativos em revisao: ${audit.review_required_active}`,
  "",
  "## Arquivos por categoria",
  "",
  ...categoryFiles.flatMap((entry) => [`- ${entry.category}: ${entry.file} (${entry.rows} item(ns))`]),
  "",
  "## Regra operacional",
  "",
  "- Distribuir cada CSV apenas para quem revisa aquela familia comercial.",
  "- Aplicar override humano somente com validacao visual real.",
  "- Reexecutar `npm run catalog:consistency:check` apos cada rodada de curadoria.",
];

fs.writeFileSync(path.join(packsDir, "README.md"), indexLines.join("\n"), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      output: path.relative(process.cwd(), packsDir),
      categories: categoryFiles.length,
      files: categoryFiles.slice(0, 10),
    },
    null,
    2,
  ),
);
