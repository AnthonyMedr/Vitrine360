import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { closeDbResources, initializeDb, readDb } from "../server/db";
import { buildFiscalClosePack } from "../server/fiscal-close-pack";
import { closePostgresPool } from "../server/postgres";
import { closeRedisClient } from "../server/redis";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function toMarkdown(pack: ReturnType<typeof buildFiscalClosePack>) {
  const lines: string[] = [];
  lines.push("# Fiscal Close Pack");
  lines.push("");
  lines.push(`- Scope: \`${pack.scope}\``);
  lines.push(`- Generated at: \`${pack.generated_at}\``);
  lines.push(`- Pending fiscal profiles: \`${pack.metrics.pending_fiscal_profiles}\``);
  lines.push(`- Pending catalog items: \`${pack.metrics.pending_catalog_items}\``);
  lines.push(`- Pending fiscal documents: \`${pack.metrics.pending_fiscal_documents}\``);
  lines.push("");
  lines.push("## Rows");
  lines.push("");

  if (pack.rows.length === 0) {
    lines.push("No pending fiscal profiles found for the selected scope.");
    lines.push("");
  }

  for (const row of pack.rows) {
    lines.push(`### ${row.product_name}`);
    lines.push("");
    lines.push(`- SKU: \`${row.product_sku ?? "-"}\``);
    lines.push(`- Product ID: \`${row.product_id}\``);
    lines.push(`- Fiscal profile ID: \`${row.fiscal_profile_id}\``);
    lines.push(`- Category: \`${row.category ?? "-"}\``);
    lines.push(`- Subcategory: \`${row.subcategory ?? "-"}\``);
    lines.push(`- Material: \`${row.material ?? "-"}\``);
    lines.push(`- Fiscal group: \`${row.fiscal_group ?? "-"}\``);
    lines.push(`- Missing fields: \`${row.missing_fields.join(", ") || "-"}\``);
    lines.push(`- Criticality: \`${row.criticality}\``);
    lines.push(`- Responsible: \`${row.responsible}\``);
    lines.push(`- Go-live impact: ${row.go_live_impact}`);
    lines.push(`- Completion status: \`${row.completion_status}\``);
    lines.push(`- Origin code: \`${row.current_origin_code ?? "-"}\``);
    lines.push(`- Current NCM: \`${row.current_ncm ?? "-"}\``);
    lines.push(`- Current CST: \`${row.current_cst_icms_default ?? "-"}\``);
    lines.push(`- Current CSOSN: \`${row.current_csosn_default ?? "-"}\``);
    lines.push(`- Current weight: \`${row.current_weight ?? row.current_weight_per_unit ?? row.current_weight_per_package ?? "-"}\``);
    lines.push(`- Measures: \`${row.current_measures ?? row.current_dimensions ?? "-"}\``);
    lines.push(`- Dimensions: width=\`${row.width ?? "-"}\`, height=\`${row.height ?? "-"}\`, length=\`${row.length ?? "-"}\``);
    lines.push(`- Recommended action: ${row.recommended_action}`);
    lines.push("");
  }

  lines.push("## Next steps");
  lines.push("");
  for (const step of pack.next_steps) lines.push(`- ${step}`);
  lines.push("");
  return lines.join("\n");
}

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function toCsv(pack: ReturnType<typeof buildFiscalClosePack>) {
  const headers = [
    "fiscal_profile_id",
    "product_id",
    "product_sku",
    "product_name",
    "category",
    "subcategory",
    "material",
    "fiscal_group",
    "current_origin_code",
    "current_ncm",
    "current_cst_icms_default",
    "current_csosn_default",
    "current_weight",
    "current_measures",
    "width",
    "height",
    "length",
    "missing_fields",
    "criticality",
    "responsible",
    "go_live_impact",
    "completion_status",
    "manual_fill_ncm",
    "manual_fill_cst_icms_default",
    "manual_fill_csosn_default",
    "manual_fill_weight",
    "manual_fill_tax_rule_status",
    "manual_fill_note",
  ];

  const rows = pack.rows.map((row) =>
    [
      row.fiscal_profile_id,
      row.product_id,
      row.product_sku,
      row.product_name,
      row.category,
      row.subcategory,
      row.material,
      row.fiscal_group,
      row.current_origin_code,
      row.current_ncm,
      row.current_cst_icms_default,
      row.current_csosn_default,
      row.current_weight ?? row.current_weight_per_unit ?? row.current_weight_per_package ?? null,
      row.current_measures ?? row.current_dimensions,
      row.width,
      row.height,
      row.length,
      row.missing_fields.join("|"),
      row.criticality,
      row.responsible,
      row.go_live_impact,
      row.completion_status,
      row.manual_fill_template.ncm,
      row.manual_fill_template.cst_icms_default,
      row.manual_fill_template.csosn_default,
      row.manual_fill_template.weight,
      row.manual_fill_template.tax_rule_status,
      row.manual_fill_template.note,
    ].map(escapeCsv).join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

try {
  await initializeDb();

  const scopeArg = getArg("--scope");
  const scope = scopeArg === "global" ? "global" : "minimal-go-live";
  const outArg = getArg("--out");
  const defaultBase = resolve("docs", "reports", scope === "global" ? "fiscal-close-pack-global" : "fiscal-close-pack-minimal");
  const basePath = resolve(outArg ?? defaultBase);
  const jsonPath = basePath.endsWith(".json") || basePath.endsWith(".md") ? basePath.replace(/\.(json|md)$/i, "") + ".json" : `${basePath}.json`;
  const mdPath = basePath.endsWith(".json") || basePath.endsWith(".md") ? basePath.replace(/\.(json|md)$/i, "") + ".md" : `${basePath}.md`;
  const csvPath = basePath.endsWith(".json") || basePath.endsWith(".md") || basePath.endsWith(".csv")
    ? basePath.replace(/\.(json|md|csv)$/i, "") + ".csv"
    : `${basePath}.csv`;

  const pack = buildFiscalClosePack(readDb(), { scope });
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${toMarkdown(pack)}\n`, "utf8");
  writeFileSync(csvPath, `${toCsv(pack)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope,
        jsonPath,
        mdPath,
        csvPath,
        rows: pack.rows.length,
        metrics: pack.metrics,
      },
      null,
      2,
    ),
  );
} finally {
  closeDbResources();
  await closeRedisClient();
  await closePostgresPool();
}
