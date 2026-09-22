import path from "node:path";
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

const folderArg = getArg("--folder") ?? getPositionalArg() ?? path.join("docs", "reports", "catalog-curation-packs-2026-05-20");
const resolvedFolder = path.resolve(process.cwd(), folderArg);
const files = listCsvFiles(resolvedFolder);

const summary = files.map((filePath) => {
  const rows = loadCatalogCurationRows(filePath);
  const actionable = rows.filter((row) => String(row.decision || "").trim().length > 0);
  const blank = rows.length - actionable.length;
  return {
    file: path.basename(filePath),
    totalRows: rows.length,
    actionableRows: actionable.length,
    blankRows: blank,
  };
});

console.log(
  JSON.stringify(
    {
      ok: true,
      folder: path.relative(process.cwd(), resolvedFolder),
      files: summary.length,
      totalRows: summary.reduce((acc, item) => acc + item.totalRows, 0),
      actionableRows: summary.reduce((acc, item) => acc + item.actionableRows, 0),
      blankRows: summary.reduce((acc, item) => acc + item.blankRows, 0),
      summary,
    },
    null,
    2,
  ),
);
