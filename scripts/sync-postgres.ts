import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../server/config.ts";
import {
  closeDbResources,
  importPostgresSnapshot,
  type DatabaseShape,
} from "../server/db.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { hasPrismaRuntimeData } from "../server/prisma.ts";

async function main() {
  if (appConfig.dbProvider !== "postgres") {
    throw new Error("Defina DB_PROVIDER=postgres antes de sincronizar.");
  }
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  const snapshotPath = path.resolve(process.cwd(), "server", "data", "db.json");
  if (!fs.existsSync(snapshotPath)) {
    if (process.argv.includes("--if-empty")) {
      console.log(JSON.stringify({ ok: true, skipped: true, reason: "snapshot_not_found", source: snapshotPath }));
      return;
    }
    throw new Error(`Snapshot nao encontrado: ${snapshotPath}`);
  }

  if (process.argv.includes("--if-empty") && await hasPrismaRuntimeData()) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "postgres_already_initialized" }));
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as DatabaseShape;
  await importPostgresSnapshot(snapshot);
  console.log(JSON.stringify({ ok: true, provider: "postgres", orm: "prisma", source: snapshotPath }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    closeDbResources();
    await closePostgresPool();
  });
