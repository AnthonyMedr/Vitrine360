import { getPhase1ReadinessReport } from "../server/phase1-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

async function main() {
  try {
    const report = await getPhase1ReadinessReport();
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
  }
}

void main();
