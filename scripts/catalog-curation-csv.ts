import fs from "node:fs";
import path from "node:path";
import type { CatalogCurationRow } from "../server/catalog-curation-apply";

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ";" && !quoted) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => String(cell || "").trim().length > 0));
}

export function loadCatalogCurationRows(filePath: string): CatalogCurationRow[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const [headerRow, ...dataRows] = parseCsv(raw);
  const headers = headerRow.map((entry) => String(entry || "").trim());
  return dataRows.map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    return {
      product_id: String(record.product_id || "").trim(),
      sku: String(record.sku || "").trim(),
      product_name: String(record.product_name || "").trim(),
      decision: String(record.decision || "").trim(),
      decision_notes: String(record.decision_notes || "").trim(),
    };
  });
}

export function listCsvFiles(folderPath: string) {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(folderPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}
