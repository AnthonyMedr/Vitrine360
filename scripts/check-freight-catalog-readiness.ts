import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { getFreightCatalogReadinessReport } from "../server/freight-catalog-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

try {
  await initializeDb();
  const report = getFreightCatalogReadinessReport(readDb());
  console.log(JSON.stringify(report, null, 2));

  if (!report.national_freight_ready) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
