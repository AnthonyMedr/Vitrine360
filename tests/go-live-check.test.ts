import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

function runGoLiveCheck(envOverrides: Record<string, string>) {
  const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCliPath, "scripts/check-go-live.ts"], {
    cwd: path.resolve(process.cwd()),
    env: {
      ...process.env,
      ...envOverrides,
    },
    encoding: "utf8",
  });

  const output = `${result.stdout || ""}`.trim() || `${result.stderr || ""}`.trim();
  return {
    status: result.status ?? 1,
    output,
  };
}

test("go-live check reports blockers with local default-like environment", () => {
  const result = runGoLiveCheck({
    HOMOLOGATION_ONLY: "true",
    DB_PROVIDER: "sqlite",
    DATABASE_URL: "",
    QUEUE_PROVIDER: "auto",
    REDIS_URL: "",
    PAYMENT_PROVIDER: "manual",
    FREIGHT_PROVIDER: "local-rules",
    AUTH_CSRF_SECRET: "gamel-dev-csrf-secret",
    SECURE_COOKIES: "false",
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.output) as {
    go_live_ready: boolean;
    blockers: number;
    checks: { blockers: Array<{ item: string }> };
  };

  assert.equal(payload.go_live_ready, false);
  assert.ok(payload.blockers > 0);
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "database_provider"));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "csrf_secret"));
});

test("go-live check passes when critical environment blockers are resolved", () => {
  const result = runGoLiveCheck({
    HOMOLOGATION_ONLY: "false",
    DB_PROVIDER: "postgres",
    DATABASE_URL: "postgres://user:pass@localhost:5432/gamel",
    QUEUE_PROVIDER: "redis",
    REDIS_URL: "redis://localhost:6379",
    PAYMENT_PROVIDER: "mercadopago",
    FREIGHT_PROVIDER: "melhor-envio",
    AUTH_CSRF_SECRET: "super-secret-go-live-token",
    SECURE_COOKIES: "true",
    EMAIL_PROVIDER: "resend",
    ANALYTICS_PROVIDER: "ga4",
    STORAGE_PROVIDER: "s3",
    METRICS_TOKEN: "metrics-token",
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.output) as {
    go_live_ready: boolean;
    blockers: number;
  };

  assert.equal(payload.go_live_ready, true);
  assert.equal(payload.blockers, 0);
});

test("go-live check blocks production-like environment without metrics token", () => {
  const result = runGoLiveCheck({
    APP_ENV: "production",
    HOMOLOGATION_ONLY: "false",
    DB_PROVIDER: "postgres",
    DATABASE_URL: "postgres://user:pass@localhost:5432/gamel",
    QUEUE_PROVIDER: "redis",
    REDIS_URL: "redis://localhost:6379",
    PAYMENT_PROVIDER: "mercadopago",
    FREIGHT_PROVIDER: "melhor-envio",
    AUTH_CSRF_SECRET: "super-secret-go-live-token",
    SECURE_COOKIES: "true",
    EMAIL_PROVIDER: "resend",
    ANALYTICS_PROVIDER: "ga4",
    STORAGE_PROVIDER: "s3",
    METRICS_TOKEN: "",
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.output) as {
    go_live_ready: boolean;
    checks: { blockers: Array<{ item: string }> };
  };

  assert.equal(payload.go_live_ready, false);
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "metrics_token"));
});
