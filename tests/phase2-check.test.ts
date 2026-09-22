import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

function runPhase2Check(envOverrides: Record<string, string>) {
  const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsxCliPath, "scripts/check-phase2-readiness.ts"], {
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

test("phase2 check reports blockers when phase 1 and providers are not configured", () => {
  const result = runPhase2Check({
    DB_PROVIDER: "sqlite",
    DATABASE_URL: "",
    QUEUE_PROVIDER: "auto",
    REDIS_URL: "",
    PAYMENT_PROVIDER: "manual",
    MERCADOPAGO_ACCESS_TOKEN: "",
    MERCADOPAGO_WEBHOOK_SECRET: "",
    FREIGHT_PROVIDER: "local-rules",
    MELHOR_ENVIO_TOKEN: "",
    MELHOR_ENVIO_ORIGIN_ZIP: "",
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.output) as {
    phase2_ready: boolean;
    checks: { blockers: Array<{ item: string }> };
  };

  assert.equal(payload.phase2_ready, false);
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "phase1_database_provider"));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "payment_provider"));
  assert.ok(payload.checks.blockers.some((entry) => entry.item === "freight_provider"));
});

test("phase2 check passes when infrastructure and provider secrets are configured", () => {
  const result = runPhase2Check({
    DB_PROVIDER: "postgres",
    DATABASE_URL: "postgres://user:pass@localhost:5432/lojao",
    QUEUE_PROVIDER: "redis",
    REDIS_URL: "redis://localhost:6379",
    PAYMENT_PROVIDER: "mercadopago",
    MERCADOPAGO_ACCESS_TOKEN: "mp-access-token",
    MERCADOPAGO_WEBHOOK_SECRET: "mp-webhook-secret",
    PAYMENT_SUCCESS_URL: "https://lojaopvc.com.br/pedido/sucesso",
    PAYMENT_FAILURE_URL: "https://lojaopvc.com.br/pedido/falha",
    PAYMENT_PENDING_URL: "https://lojaopvc.com.br/pedido/pendente",
    FREIGHT_PROVIDER: "melhor-envio",
    MELHOR_ENVIO_TOKEN: "me-token",
    MELHOR_ENVIO_ORIGIN_ZIP: "55290000",
    MELHOR_ENVIO_ENV: "sandbox",
    APP_BASE_URL: "https://lojaopvc.com.br",
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.output) as {
    phase2_ready: boolean;
    blockers: number;
  };

  assert.equal(payload.phase2_ready, true);
  assert.equal(payload.blockers, 0);
});
