import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { getOperationReadinessReport } from "../server/operation-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

try {
  await initializeDb();
  const operations = getOperationReadinessReport(readDb());
  const report = {
    generated_at: new Date().toISOString(),
    SMOKE_OPERATIONAL_READY: operations.ready,
    PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
    blockers: operations.blockers,
    warnings: operations.warnings,
    metrics: operations.metrics,
    note: "Smoke operacional valida backlog interno; nao substitui homologacao com pagamento/frete reais.",
  };

  console.log(JSON.stringify(report, null, 2));

  if (!operations.ready) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
