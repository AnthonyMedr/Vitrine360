import { readDb, writeDb } from "../server/db";
import { alignCatalogStagingGoLiveGateToLaunchBatch } from "../server/catalog-staging";

function parseLimit(argv: string[]) {
  const flagIndex = argv.findIndex((entry) => entry === "--limit");
  const rawValue = flagIndex >= 0 ? argv[flagIndex + 1] : argv[0];
  const parsed = Number(rawValue || 12);
  if (!Number.isFinite(parsed) || parsed <= 0) return 12;
  return Math.min(Math.floor(parsed), 60);
}

const limit = parseLimit(process.argv.slice(2));
const db = readDb();
const result = alignCatalogStagingGoLiveGateToLaunchBatch(db, limit);

writeDb(db);

console.log(
  JSON.stringify(
    {
      ok: true,
      requested_limit: limit,
      changed: result.changed,
      required: result.required,
      deferred: result.deferred,
      selected: result.launch_batch.selected,
    },
    null,
    2,
  ),
);
