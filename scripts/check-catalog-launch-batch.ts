import { readDb } from "../server/db";
import { getCatalogLaunchBatch } from "../server/catalog-staging";

function parseLimit(argv: string[]) {
  const flagIndex = argv.findIndex((entry) => entry === "--limit");
  if (flagIndex === -1) return 24;
  const raw = Number(argv[flagIndex + 1] || 24);
  if (!Number.isFinite(raw) || raw <= 0) return 24;
  return Math.min(Math.floor(raw), 60);
}

const limit = parseLimit(process.argv.slice(2));
const db = readDb();
const batch = getCatalogLaunchBatch(db, limit);

console.log(JSON.stringify(batch, null, 2));
