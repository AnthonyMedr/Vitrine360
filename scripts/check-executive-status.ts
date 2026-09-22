import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { buildExecutiveStatus } from "../server/executive-status.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

try {
  await initializeDb();
  const status = await buildExecutiveStatus(readDb());

  console.log(JSON.stringify(status, null, 2));
  if (status.decisions.production_open !== "PRONTO") {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
