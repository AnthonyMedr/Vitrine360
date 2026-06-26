import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function section(title) {
  console.log(`\n== ${title} ==`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function runNodeScript(args) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function printOutput(output) {
  const trimmed = (output || "").trim();
  if (trimmed) console.log(trimmed);
}

function main() {
  console.log("== Vitrine360 Go-Live preflight ==");

  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const productionEnvPath = path.join(root, ".env.production");
  const productionExamplePath = path.join(root, ".env.production.example");

  let hasBlockingError = false;

  section("Arquivos de ambiente");
  if (existsSync(envPath)) ok(".env encontrado.");
  else {
    fail(".env ausente.");
    hasBlockingError = true;
  }

  if (existsSync(productionExamplePath)) ok(".env.production.example encontrado.");
  else {
    fail(".env.production.example ausente.");
    hasBlockingError = true;
  }

  if (existsSync(productionEnvPath)) {
    ok(".env.production encontrado.");
  } else {
    warn(".env.production ausente. Rode `npm run production:env:init` antes da validacao oficial.");
  }

  section("Diagnostico local de banco");
  if (existsSync(envPath)) {
    const localStatus = runNodeScript([
      path.join("scripts", "run-with-env.mjs"),
      ".env",
      path.join("scripts", "db-status.mjs"),
    ]);
    printOutput(localStatus.stdout);
    if (localStatus.status !== 0) {
      console.error((localStatus.stderr || "").trim());
      hasBlockingError = true;
    }
  }

  section("Readiness local");
  if (existsSync(envPath)) {
    const localReadiness = runNodeScript([
      path.join("scripts", "run-with-env.mjs"),
      ".env",
      path.join("scripts", "production-readiness.mjs"),
      "PRODUCTION_CHECK_MODE=local",
    ]);
    printOutput(localReadiness.stdout);
    if (localReadiness.status !== 0) {
      console.error((localReadiness.stderr || "").trim());
      hasBlockingError = true;
    }
  }

  section("Readiness oficial");
  if (existsSync(productionEnvPath)) {
    const productionReadiness = runNodeScript([
      path.join("scripts", "run-with-env.mjs"),
      ".env.production",
      path.join("scripts", "production-readiness.mjs"),
    ]);
    printOutput(productionReadiness.stdout);
    if (productionReadiness.status !== 0) {
      console.error((productionReadiness.stderr || "").trim());
      hasBlockingError = true;
    }
  } else {
    warn("Readiness oficial pulado porque .env.production ainda nao existe.");
  }

  section("Resumo");
  if (hasBlockingError) {
    fail("Preflight encontrou bloqueios operacionais. Revise os erros acima antes do Go-Live.");
    process.exit(1);
  }

  ok("Preflight concluido sem bloqueios criticos.");
}

main();
