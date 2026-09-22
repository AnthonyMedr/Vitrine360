import path from "node:path";
import { randomUUID } from "node:crypto";
import { initializeDb, readDb, writeDb } from "../server/db";
import { applyCatalogCurationRows, type CatalogCurationRow } from "../server/catalog-curation-apply";
import { listCsvFiles, loadCatalogCurationRows } from "./catalog-curation-csv";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function getPositionalArg() {
  return process.argv.slice(2).find((entry) => !entry.startsWith("-")) ?? null;
}

await initializeDb();

const folderArg = getArg("--folder") ?? getPositionalArg() ?? path.join("docs", "reports", "catalog-curation-packs-2026-05-20");
const actorName = getArg("--actor-name") ?? "Catalog Curation Folder Apply";
const actorId = getArg("--actor-id");
const apply = process.argv.includes("--apply");
const resolvedFolder = path.resolve(process.cwd(), folderArg);
const files = listCsvFiles(resolvedFolder);

const seen = new Set<string>();
const duplicateProducts: Array<{ product_id: string; file: string }> = [];
const combinedRows: CatalogCurationRow[] = [];
const fileSummary: Array<{ file: string; totalRows: number; actionableRows: number }> = [];

for (const filePath of files) {
  const rows = loadCatalogCurationRows(filePath);
  const actionable = rows.filter((row) => String(row.decision || "").trim().length > 0);
  fileSummary.push({ file: path.basename(filePath), totalRows: rows.length, actionableRows: actionable.length });
  for (const row of actionable) {
    if (seen.has(row.product_id)) {
      duplicateProducts.push({ product_id: row.product_id, file: path.basename(filePath) });
      continue;
    }
    seen.add(row.product_id);
    combinedRows.push(row);
  }
}

const db = readDb();
const result = applyCatalogCurationRows(db, combinedRows, {
  actorName,
  actorId,
  correlationId: randomUUID(),
  apply,
});

if (apply && result.changed) {
  writeDb(db);
}

console.log(
  JSON.stringify(
    {
      ok: duplicateProducts.length === 0,
      folder: path.relative(process.cwd(), resolvedFolder),
      dryRun: !apply,
      files: fileSummary.length,
      fileSummary,
      duplicateProducts,
      ...result,
    },
    null,
    2,
  ),
);

if (duplicateProducts.length > 0) {
  process.exitCode = 1;
}
