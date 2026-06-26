import { spawnSync } from "node:child_process";
import { Pool } from "pg";

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function formatError(error) {
  if (!error) return "erro desconhecido";
  if (typeof error === "string") return error;

  const anyError = error;
  const parts = [];

  if (anyError.message) parts.push(anyError.message);
  if (anyError.code) parts.push(`code=${anyError.code}`);
  if (anyError.errno) parts.push(`errno=${anyError.errno}`);
  if (anyError.address) parts.push(`address=${anyError.address}`);
  if (anyError.port) parts.push(`port=${anyError.port}`);

  if (Array.isArray(anyError.errors) && anyError.errors.length > 0) {
    parts.push(
      `causas=${anyError.errors
        .map((cause) => formatError(cause))
        .filter(Boolean)
        .join(" | ")}`,
    );
  }

  return parts.join(" ; ") || JSON.stringify(anyError);
}

function checkDocker() {
  const result = spawnSync("docker", ["ps"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (result.error) {
    fail(`docker indisponivel: ${formatError(result.error)}`);
    warn("Confirme se o Docker Desktop esta instalado e em execucao.");
    return false;
  }

  if (result.status !== 0) {
    fail(`docker respondeu com erro: ${result.stderr.trim() || "sem detalhes"}`);
    warn("Confirme se o daemon do Docker Desktop esta ativo.");
    return false;
  }

  ok("docker acessivel.");
  return true;
}

async function checkPostgres(databaseUrl) {
  if (!databaseUrl) {
    fail("DATABASE_URL nao definida.");
    return false;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      databaseUrl.includes("sslmode=require") ||
      databaseUrl.includes("sslmode=verify-full") ||
      isTruthy(process.env.DATABASE_SSL) ||
      isTruthy(process.env.PGSSLMODE)
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    const result = await pool.query("select current_database() as db, now() as now");
    ok(`postgres acessivel (${result.rows[0].db})`);
    return true;
  } catch (error) {
    fail(`postgres indisponivel: ${formatError(error)}`);
    warn("Se este for o ambiente local, suba o banco com `npm run db:up`.");
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function main() {
  console.log("== Vitrine360 database status ==");

  const dockerOk = checkDocker();
  const postgresOk = await checkPostgres(process.env.DATABASE_URL || "");

  if (postgresOk) {
    if (!dockerOk) {
      warn("Docker indisponivel, mas o PostgreSQL esta acessivel por fora do Docker.");
    }
    console.log("\nResultado: stack local pronta para uso.");
    process.exit(0);
  }

  console.log("\nResultado: stack local com pendencias operacionais.");
  process.exit(1);
}

await main();
