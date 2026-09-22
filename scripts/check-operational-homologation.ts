import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { getAdminFiscalReadiness } from "../server/read-models.ts";
import { getFreightCatalogReadinessReport } from "../server/freight-catalog-readiness.ts";
import { getGoLiveReadinessReport } from "../server/go-live-readiness.ts";
import { getOperationReadinessReport } from "../server/operation-readiness.ts";
import { getPhase2ReadinessReport } from "../server/phase2-readiness.ts";
import { getSecurityReadinessReport } from "../server/security-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";

try {
  await initializeDb();
  const db = readDb();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const phase2 = getPhase2ReadinessReport();
  const freightCatalog = getFreightCatalogReadinessReport(db);
  const operations = getOperationReadinessReport(db);
  const security = getSecurityReadinessReport();
  const goLive = getGoLiveReadinessReport();

  const blockers = [
    ...(fiscal.ready ? [] : ["fiscal_minimo_contador"]),
    ...(phase2.phase2_ready ? [] : ["integracoes_reais"]),
    ...(freightCatalog.national_freight_ready ? [] : ["catalogo_frete"]),
    ...(operations.ready ? [] : ["operacao"]),
    ...(security.ready ? [] : ["seguranca"]),
    ...(goLive.go_live_ready ? [] : ["go_live"]),
  ];

  const report = {
    generated_at: new Date().toISOString(),
    HOMOLOGATION_READY: blockers.length === 0,
    PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
    blockers,
    gates: {
      fiscal_minimal: { ready: fiscal.ready, blockers: fiscal.blockers, warnings: fiscal.warnings },
      phase2: { ready: phase2.phase2_ready, blockers: phase2.blockers, warnings: phase2.warnings },
      freight_catalog: {
        ready: freightCatalog.national_freight_ready,
        blockers: freightCatalog.summary.blocked_products,
        warnings: freightCatalog.summary.warning_products,
      },
      operations: { ready: operations.ready, blockers: operations.blockers, warnings: operations.warnings },
      security: { ready: security.ready, blockers: security.blockers, warnings: security.warnings },
      go_live: { ready: goLive.go_live_ready, blockers: goLive.blockers, warnings: goLive.warnings },
    },
    next_step:
      blockers.length === 0
        ? "EXECUTAR_SMOKE_OPERACIONAL_E_PREPARAR_SOFT_LAUNCH"
        : "FISCAL_CONTADOR+INTEGRACOES_REAIS",
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.HOMOLOGATION_READY) {
    process.exitCode = 1;
  }
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
