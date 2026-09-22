import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { FiscalClosePackEditableRow } from "../server/fiscal-close-pack-apply";

type CsvClosePackRow = {
  fiscal_profile_id?: string;
  product_id?: string;
  product_name?: string;
  manual_fill_ncm?: string;
  manual_fill_cst_icms_default?: string;
  manual_fill_csosn_default?: string;
  manual_fill_weight?: string;
  manual_fill_tax_rule_status?: "review" | "pending" | "ready";
  manual_fill_note?: string;
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTaxRuleStatus(value: unknown): "review" | "pending" | "ready" | undefined {
  if (value === "review" || value === "pending" || value === "ready") return value;
  return undefined;
}

function mapCsvRowToEditableRow(row: CsvClosePackRow): FiscalClosePackEditableRow | null {
  const fiscal_profile_id = normalizeString(row.fiscal_profile_id);
  const product_id = normalizeString(row.product_id);
  if (!fiscal_profile_id || !product_id) return null;

  return {
    fiscal_profile_id,
    product_id,
    manual_fill_template: {
      ncm: normalizeString(row.manual_fill_ncm),
      cst_icms_default: normalizeString(row.manual_fill_cst_icms_default),
      csosn_default: normalizeString(row.manual_fill_csosn_default),
      weight: normalizeString(row.manual_fill_weight),
      tax_rule_status: normalizeTaxRuleStatus(row.manual_fill_tax_rule_status) ?? "review",
      note: normalizeString(row.manual_fill_note),
    },
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((entry, header, index) => {
      entry[header] = values[index] ?? "";
      return entry;
    }, {});
  });
}

export function loadFiscalClosePackRows(fileInput: string): {
  filePath: string;
  rows: FiscalClosePackEditableRow[];
  format: "json" | "csv";
} {
  const filePath = resolve(fileInput);
  const extension = extname(filePath).toLowerCase();

  if (extension === ".csv") {
    const csvRows = parseCsv(readFileSync(filePath, "utf8")) as CsvClosePackRow[];
    return {
      filePath,
      format: "csv",
      rows: csvRows.map(mapCsvRowToEditableRow).filter((row): row is FiscalClosePackEditableRow => Boolean(row)),
    };
  }

  if (extension === ".xlsx" || extension === ".xls") {
    throw new Error("XLSX fiscal close pack import is disabled for security. Use CSV or JSON instead.");
  }

  const payload = JSON.parse(readFileSync(filePath, "utf8")) as { rows?: FiscalClosePackEditableRow[] };
  return {
    filePath,
    format: "json",
    rows: Array.isArray(payload.rows) ? payload.rows : [],
  };
}
