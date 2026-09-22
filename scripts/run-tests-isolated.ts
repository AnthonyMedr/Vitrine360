import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function resolveTsxEntrypoint() {
  const suite = getSuite();
  const cliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  return {
    command: process.execPath,
    args: ["--test", "--test-concurrency=1", ...resolveSuiteTestFiles(suite)],
    shell: false as const,
    cliPath,
  };
}

const phase1TestFiles = [
  "tests/address-lookup.test.ts",
  "tests/admin-control-center.test.ts",
  "tests/admin-homologation-evidence.test.ts",
  "tests/catalog-image-audit.test.ts",
  "tests/catalog-publication-quality.test.ts",
  "tests/catalog-routes.test.ts",
  "tests/db-migration-idempotency.test.ts",
  "tests/go-live-check.test.ts",
  "tests/homologation-evidence.test.ts",
  "tests/homologation-evidence-validation.test.ts",
  "tests/homologation-scenarios.test.ts",
  "tests/http-products.test.ts",
  "tests/http-error-handling.test.ts",
  "tests/http-public-apis.test.ts",
  "tests/http-quote-pdf.test.ts",
  "tests/http-upload-image-validation.test.ts",
  "tests/institutional-pages.test.ts",
  "tests/mobile-qa-readiness.test.ts",
  "tests/mutation.test.ts",
  "tests/product-identity.test.ts",
  "tests/security-readiness.test.ts",
  "tests/standardization.test.ts",
  "tests/test-runtime-isolation.test.ts",
  "tests/gamel-phase1-admin-flow.test.ts",
  "tests/http-auth-security.test.ts",
];

const futureTestFiles = [
  "tests/admin-training-assistant.test.ts",
  "tests/async-jobs.test.ts",
  "tests/backup-operations.test.ts",
  "tests/catalog-curation-apply.test.ts",
  "tests/catalog-curation-folder.test.ts",
  "tests/company-lookup.test.ts",
  "tests/customer-center-source.test.ts",
  "tests/delivery-zones-check.test.ts",
  "tests/fiscal-ai-assistant.test.ts",
  "tests/fiscal-close-pack.test.ts",
  "tests/fiscal-close-pack-file.test.ts",
  "tests/fiscal-enterprise-plan.test.ts",
  "tests/freight-catalog-readiness.test.ts",
  "tests/freight-service.test.ts",
  "tests/http-admin.test.ts",
  "tests/http-admin-management.test.ts",
  "tests/http-admin-sellers.test.ts",
  "tests/http-customer-flow.test.ts",
  "tests/http-enterprise-admin.test.ts",
  "tests/http-fake-providers.test.ts",
  "tests/http-fiscal-ai-assistant.test.ts",
  "tests/http-health-readiness.test.ts",
  "tests/http-marketing.test.ts",
  "tests/http-order-access.test.ts",
  "tests/http-order-concurrency.test.ts",
  "tests/http-order-payment.test.ts",
  "tests/http-pim-media-wms.test.ts",
  "tests/http-shipping-national.test.ts",
  "tests/http-webhooks.test.ts",
  "tests/internal-scale-readiness.test.ts",
  "tests/marketing-operations.test.ts",
  "tests/phase2-check.test.ts",
  "tests/postgres-schema.test.ts",
];

function getSuite() {
  const suiteArg = process.argv.find((arg) => arg.startsWith("--suite="));
  const suite = suiteArg?.split("=")[1]?.trim().toLowerCase();
  if (suite === "phase1" || suite === "future" || suite === "all") return suite;
  return "all";
}

function resolveSuiteTestFiles(suite: "phase1" | "future" | "all") {
  if (suite === "phase1") return phase1TestFiles;
  if (suite === "future") return futureTestFiles;
  return ["tests/**/*.test.ts"];
}

function main() {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-tests-runtime-"));
  const keepDataDir = process.argv.includes("--keep-data-dir");
  const extraArgs = process.argv.slice(2).filter((arg) => arg !== "--keep-data-dir" && !arg.startsWith("--suite="));
  const runtime = resolveTsxEntrypoint();
  const suite = getSuite();
  const childEnv = {
    ...process.env,
    DATA_DIR: tempDataDir,
    DB_PROVIDER: "sqlite",
    QUEUE_PROVIDER: "auto",
    DATABASE_URL: "",
    REDIS_URL: "",
    NODE_ENV: "test",
    APP_ENV: "test",
    NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1",
  };

  console.log(`[test-runner] suite=${suite} isolated DATA_DIR=${tempDataDir}`);
  const result = spawnSync(runtime.command, [runtime.cliPath, ...runtime.args, ...extraArgs], {
    stdio: "inherit",
    env: childEnv,
    shell: runtime.shell,
  });

  if (!keepDataDir) {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  } else {
    console.log(`[test-runner] keeping isolated DATA_DIR at ${tempDataDir}`);
  }

  if (typeof result.status === "number") {
    process.exitCode = result.status;
    return;
  }

  if (result.error) {
    throw result.error;
  }
}

main();
