import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import {
  buildHomologationEvidencePack,
  renderHomologationEvidenceCsv,
  renderHomologationEvidenceMarkdown,
} from "../server/homologation-evidence.ts";
import { buildHomologationScenarioReport } from "../server/homologation-scenarios.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/homologation-evidence-pack-latest").replace(/\.(json|md|csv)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;

try {
  await initializeDb();
  const scenarioReport = buildHomologationScenarioReport(readDb());
  const pack = buildHomologationEvidencePack(scenarioReport);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${renderHomologationEvidenceMarkdown(pack)}\n`, "utf8");
  writeFileSync(csvPath, renderHomologationEvidenceCsv(pack), "utf8");
  console.log(JSON.stringify({
    ok: pack.ok,
    scenarios_total: pack.scenarios_total,
    evidence_items_total: pack.evidence_items_total,
    pending_items: pack.pending_items,
    jsonPath,
    mdPath,
    csvPath,
  }, null, 2));
  if (!pack.ok) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
