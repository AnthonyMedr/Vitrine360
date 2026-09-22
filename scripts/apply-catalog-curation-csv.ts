import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { initializeDb, readDb, writeDb } from "../server/db";
import { applyCatalogCurationRows, type CatalogCurationRow } from "../server/catalog-curation-apply";
import { loadCatalogCurationRows } from "./catalog-curation-csv";

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

const fileArg = getArg("--file") ?? getPositionalArg() ?? path.join("docs", "reports", "catalog-curation-queue-2026-05-19.csv");
const actorName = getArg("--actor-name") ?? "Catalog Curation CSV Apply";
const actorId = getArg("--actor-id");
const apply = process.argv.includes("--apply");
const resolvedPath = path.resolve(process.cwd(), fileArg);
const rows: CatalogCurationRow[] = loadCatalogCurationRows(resolvedPath);
const actionableRows = rows.filter((row) => String(row.decision || "").trim().length > 0);
const db = readDb();
const result = applyCatalogCurationRows(db, actionableRows, {
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
      ok: true,
      filePath: path.relative(process.cwd(), resolvedPath),
      dryRun: !apply,
      totalRows: rows.length,
      actionableRows: actionableRows.length,
      ...result,
    },
    null,
    2,
  ),
);
