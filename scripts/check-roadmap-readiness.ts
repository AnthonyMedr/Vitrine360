import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";
import { buildOfficialRoadmapStatus } from "../server/roadmap-status.ts";

try {
  await initializeDb();
  const report = await buildOfficialRoadmapStatus(readDb());
  console.log(JSON.stringify(report, null, 2));

  if (!report.ROADMAP_READY) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
