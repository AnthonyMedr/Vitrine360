import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

function runSecurityCheck(envOverrides: Record<string, string>) {
  const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCliPath, "scripts/check-security-readiness.ts"], {
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

test("security check blocks production-like environment with local fallback settings", () => {
  const result = runSecurityCheck({
    APP_ENV: "production",
    APP_BASE_URL: "http://127.0.0.1:5173",
    AUTH_CSRF_SECRET: "strong-production-secret",
    SECURE_COOKIES: "true",
    TRUST_PROXY: "false",
    REDIS_URL: "",
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.output) as {
    ready: boolean;
    checks: { blockers: Array<{ item: string }> };
  };

  assert.equal(payload.ready, false);
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "distributed_rate_limit"));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "trust_proxy"));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "app_base_url"));
});

test("security check accepts production-like hardening prerequisites", () => {
  const result = runSecurityCheck({
    APP_ENV: "production",
    APP_BASE_URL: "https://lojaopvc.com.br",
    AUTH_CSRF_SECRET: "strong-production-secret",
    SECURE_COOKIES: "true",
    TRUST_PROXY: "true",
    REDIS_URL: "redis://localhost:6379",
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.output) as {
    ready: boolean;
    blockers: number;
  };

  assert.equal(payload.ready, true);
  assert.equal(payload.blockers, 0);
});
