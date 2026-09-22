import { initializeDb, readDb } from "../server/db.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";
import { getReleaseReadinessReport } from "../server/release-readiness.ts";

async function main() {
  try {
    await initializeDb();
    const report = await getReleaseReadinessReport(readDb());
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ready: false,
          blockers: 1,
          warnings: 0,
          sections: {},
          next_steps: ["Corrigir a inicializacao do banco antes de validar a readiness consolidada."],
          error: error instanceof Error ? error.message : "Falha ao validar a readiness consolidada.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
  }
}

void main();
