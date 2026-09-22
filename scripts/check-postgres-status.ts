import { appConfig } from "../server/config.ts";
import { checkPostgresHealth, closePostgresPool, isPostgresConfigured } from "../server/postgres.ts";

async function main() {
  try {
    const configured = appConfig.dbProvider === "postgres" && isPostgresConfigured();
    const health = configured
      ? await checkPostgresHealth()
      : {
          provider: "postgres" as const,
          configured: isPostgresConfigured(),
          ready: false,
          latencyMs: null,
          error:
            appConfig.dbProvider !== "postgres"
              ? "DB_PROVIDER ainda nao esta configurado como postgres."
              : "DATABASE_URL nao configurada.",
        };

    const report = {
      ok: configured && health.ready,
      provider: appConfig.dbProvider,
      expectedProvider: "postgres",
      configured: health.configured,
      ready: health.ready,
      latencyMs: health.latencyMs,
      error: health.error,
    };

    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await closePostgresPool();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        provider: appConfig.dbProvider,
        expectedProvider: "postgres",
        error: error instanceof Error ? error.message : "postgres_status_failed",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
