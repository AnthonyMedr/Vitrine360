import { appConfig } from "../server/config.ts";
import { getFreightProviderStatus } from "../server/runtime-overview.ts";
import { checkPostgresHealth, closePostgresPool } from "../server/postgres.ts";
import { checkRedisHealth, closeRedisClient, isRedisConfigured } from "../server/redis.ts";

async function main() {
  const database = appConfig.dbProvider === "postgres"
    ? await checkPostgresHealth()
    : { provider: appConfig.dbProvider, configured: true, ready: true, latencyMs: 0, error: null };
  const redis = isRedisConfigured()
    ? await checkRedisHealth()
    : { provider: "redis", configured: false, ready: false, latencyMs: null, error: "REDIS_URL nao configurada" };
  const redisRequired = appConfig.queueProvider === "redis";

  const checks = {
    database: database.ready,
    redis: redisRequired ? redis.ready : isRedisConfigured() ? redis.ready : true,
    payment: appConfig.paymentProvider === "manual" || Boolean(appConfig.mercadopago.accessToken),
    freight: appConfig.freightProvider === "local-rules" || appConfig.freightProvider === "fake" || getFreightProviderStatus().ready,
    email: appConfig.emailProvider === "log" || Boolean(appConfig.resend.apiKey),
    analytics: appConfig.analyticsProvider === "none" || Boolean(appConfig.ga4.apiSecret),
    storage: appConfig.storageProvider === "local" || Boolean(appConfig.storage.bucket),
  };

  const failures = Object.entries(checks)
    .filter(([, ready]) => !ready)
    .map(([name]) => name);

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        env: appConfig.env,
        homologation_only: appConfig.homologationOnly,
        checks,
        failures,
        database,
        redis: {
          ...redis,
          required: redisRequired,
        },
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

void main().finally(async () => {
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
});
