import { randomUUID } from "node:crypto";
import { initializeDb, readDb, writeDb } from "../server/db";
import { applyFiscalClosePack } from "../server/fiscal-close-pack-apply";
import { loadFiscalClosePackRows } from "./fiscal-close-pack-file";

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

const fileArg = getArg("--file") ?? getPositionalArg();
const actorName = getArg("--actor-name") ?? "Fiscal Close Pack Apply";
const actorId = getArg("--actor-id");
const { filePath, rows, format } = loadFiscalClosePackRows(fileArg ?? "docs/reports/fiscal-close-pack-minimal.json");
const db = readDb();
const report = applyFiscalClosePack(db, rows, {
  actorId,
  actorName,
  correlationId: randomUUID(),
});

if (report.changed) {
  writeDb(db);
}

console.log(JSON.stringify({ ok: true, filePath, format, ...report }, null, 2));
