import { appConfig } from "./config";
import { checkPostgresHealth, isPostgresConfigured } from "./postgres";
import { getPrismaClient } from "./prisma";
import { checkRedisHealth, isRedisConfigured } from "./redis";

export type Phase1ReadinessCheck = {
  status: "ok" | "warning" | "blocker";
  key: string;
  message: string;
  details?: Record<string, unknown>;
};

export type Phase1ReadinessReport = {
  ok: boolean;
  phase: "phase1_cutover";
  blockers: number;
  warnings: number;
  checks: Phase1ReadinessCheck[];
};

function missingEnvDetails(env: string, currentValue: unknown, nextAction: string) {
  return {
    required_env: env,
    current_value: currentValue || "nao_configurado",
    next_action: nextAction,
  };
}

async function inspectPostgresData() {
  const prisma = getPrismaClient();
  const [users, orders] = await Promise.all([
    prisma.runtimeRecord.count({ where: { collection: "users" } }),
    prisma.runtimeRecord.count({ where: { collection: "orders" } }),
  ]);
  return {
    users,
    orders,
  };
}

export async function getPhase1ReadinessReport(): Promise<Phase1ReadinessReport> {
  const checks: Phase1ReadinessCheck[] = [];
  const push = (
    status: Phase1ReadinessCheck["status"],
    key: string,
    message: string,
    details?: Record<string, unknown>,
  ) => {
    checks.push({ status, key, message, details });
  };

  if (appConfig.dbProvider !== "postgres") {
    push(
      "blocker",
      "database_provider",
      "DB_PROVIDER ainda nao esta configurado como postgres.",
      missingEnvDetails("DB_PROVIDER=postgres", appConfig.dbProvider, "Configurar Postgres antes do cutover de producao."),
    );
  } else {
    push("ok", "database_provider", "DB_PROVIDER configurado para postgres.");
  }

  if (!isPostgresConfigured()) {
    push(
      "blocker",
      "database_url",
      "DATABASE_URL nao configurada.",
      missingEnvDetails("DATABASE_URL", "vazio", "Informar a string de conexao Postgres do ambiente real."),
    );
  } else {
    const postgres = await checkPostgresHealth();
    if (!postgres.ready) {
      push("blocker", "database_health", "PostgreSQL configurado, mas ainda nao responde corretamente.", {
        error: postgres.error,
        latencyMs: postgres.latencyMs,
      });
    } else {
      push("ok", "database_health", "PostgreSQL respondeu ao healthcheck.", {
        latencyMs: postgres.latencyMs,
      });
      const counts = await inspectPostgresData();
      if (counts.users === 0) {
        push("warning", "database_seed", "PostgreSQL esta vazio ou sem sincronizacao operacional.", counts);
      } else {
        push("ok", "database_seed", "PostgreSQL contem dados operacionais sincronizados.", counts);
      }
    }
  }

  if (appConfig.queueProvider !== "redis") {
    push(
      "blocker",
      "queue_provider",
      "QUEUE_PROVIDER ainda nao esta configurado como redis.",
      missingEnvDetails("QUEUE_PROVIDER=redis", appConfig.queueProvider, "Ativar Redis para filas e rate limit distribuido."),
    );
  } else {
    push("ok", "queue_provider", "QUEUE_PROVIDER configurado para redis.");
  }

  if (!isRedisConfigured()) {
    push(
      "blocker",
      "redis_url",
      "REDIS_URL nao configurada.",
      missingEnvDetails("REDIS_URL", "vazio", "Informar a URL Redis do ambiente real."),
    );
  } else {
    const redis = await checkRedisHealth();
    if (!redis.ready) {
      push("blocker", "redis_health", "Redis configurado, mas ainda nao responde corretamente.", {
        error: redis.error,
        latencyMs: redis.latencyMs,
      });
    } else {
      push("ok", "redis_health", "Redis respondeu ao healthcheck.", {
        latencyMs: redis.latencyMs,
      });
    }
  }

  const blockers = checks.filter((entry) => entry.status === "blocker").length;
  const warnings = checks.filter((entry) => entry.status === "warning").length;

  return {
    ok: blockers === 0,
    phase: "phase1_cutover",
    blockers,
    warnings,
    checks,
  };
}
