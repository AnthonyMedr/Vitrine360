import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const requiredTables = [
  "stores",
  "auth_users",
  "products",
  "categories",
  "campaigns",
  "media_assets",
  "leads",
  "analytics_events",
  "audit_logs",
  "store_settings",
  "totem_settings",
  "vitrine_settings",
];

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
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

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function looksLocalUrl(value) {
  return /localhost|127\.0\.0\.1/i.test(value || "");
}

function looksPlaceholder(value) {
  return /definir-|usuario:senha|host-producao|example\.com|exemplo\.com|admin@2026|vitrine360-local-admin-token/i.test(
    value || "",
  );
}

function normalizeUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

async function validateStorage() {
  const mediaRoot = path.resolve(process.cwd(), "storage", "media");
  await mkdir(mediaRoot, { recursive: true });
  await access(mediaRoot);
  ok(`storage local disponivel em ${mediaRoot}`);
}

async function validateDatabase(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 10_000,
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
    const now = await pool.query("select current_database() as db, now() as now");
    ok(`conectado ao PostgreSQL (${now.rows[0].db})`);

    for (const table of requiredTables) {
      const result = await pool.query("select to_regclass($1) as table_name", [`public.${table}`]);
      if (result.rows[0]?.table_name) {
        ok(`tabela encontrada: ${table}`);
      } else {
        fail(`tabela obrigatoria ausente: ${table}`);
      }
    }

    const counts = await pool.query(`
      select
        (select count(*) from stores) as stores,
        (select count(*) from auth_users) as auth_users,
        (select count(*) from products) as products,
        (select count(*) from categories) as categories,
        (select count(*) from campaigns) as campaigns,
        (select count(*) from media_assets) as media_assets
    `);

    const row = counts.rows[0];
    ok(
      `contagens atuais - stores:${row.stores} users:${row.auth_users} products:${row.products} categories:${row.categories} campaigns:${row.campaigns} media:${row.media_assets}`,
    );

    if (Number(row.stores) === 0) warn("nenhuma loja cadastrada no banco.");
    if (Number(row.auth_users) === 0) warn("nenhum usuario administrativo cadastrado no banco.");
    if (Number(row.products) === 0) warn("nenhum produto publicado/cadastrado no banco.");
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("== Vitrine360 production readiness check ==");
  const checkMode = process.env.PRODUCTION_CHECK_MODE === "local" ? "local" : "production";

  const errors = [];
  const warnings = [];

  const databaseUrl = process.env.DATABASE_URL || "";
  const appBaseUrl = process.env.APP_BASE_URL || "";
  const publicSiteUrl = process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || "";
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "";
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN || "";
  const aiProvider = process.env.AI_PROVIDER || "";
  const aiApiKey = process.env.AI_API_KEY || "";
  const devBypass = process.env.VITE_ENABLE_DEV_ADMIN_BYPASS || "0";
  let shouldValidateDatabase = true;

  if (!databaseUrl) {
    errors.push("DATABASE_URL nao definido.");
    shouldValidateDatabase = false;
  } else if (looksLocalUrl(databaseUrl) && checkMode !== "local") {
    warnings.push("DATABASE_URL aponta para localhost/127.0.0.1; confirme se isso e intencional.");
  } else if (looksPlaceholder(databaseUrl)) {
    errors.push("DATABASE_URL ainda contem valor placeholder/template.");
    shouldValidateDatabase = false;
  } else {
    ok("DATABASE_URL definido.");
  }

  if (!appBaseUrl) {
    errors.push("APP_BASE_URL nao definido.");
  } else if (looksLocalUrl(appBaseUrl) && checkMode !== "local") {
    warnings.push("APP_BASE_URL ainda aponta para ambiente local.");
  } else if (looksPlaceholder(appBaseUrl)) {
    errors.push("APP_BASE_URL ainda contem valor placeholder/template.");
  } else {
    ok(
      checkMode === "local"
        ? `APP_BASE_URL definido para ambiente local (${appBaseUrl}).`
        : "APP_BASE_URL definido para ambiente nao local.",
    );
  }

  if (!publicSiteUrl) {
    errors.push("VITE_PUBLIC_SITE_URL nao definido.");
  } else if (looksLocalUrl(publicSiteUrl) && checkMode !== "local") {
    warnings.push("VITE_PUBLIC_SITE_URL ainda aponta para ambiente local.");
  } else if (looksPlaceholder(publicSiteUrl)) {
    errors.push("VITE_PUBLIC_SITE_URL ainda contem valor placeholder/template.");
  } else {
    ok(
      checkMode === "local"
        ? `VITE_PUBLIC_SITE_URL definido para ambiente local (${publicSiteUrl}).`
        : "VITE_PUBLIC_SITE_URL definido para dominio publico.",
    );
  }

  if (appBaseUrl && publicSiteUrl) {
    const normalizedAppBaseUrl = normalizeUrl(appBaseUrl);
    const normalizedPublicSiteUrl = normalizeUrl(publicSiteUrl);
    if (
      normalizedAppBaseUrl &&
      normalizedPublicSiteUrl &&
      normalizedAppBaseUrl !== normalizedPublicSiteUrl
    ) {
      warnings.push(
        `APP_BASE_URL (${normalizedAppBaseUrl}) e VITE_PUBLIC_SITE_URL (${normalizedPublicSiteUrl}) apontam para origens diferentes.`,
      );
    }
  }

  if (devBypass === "1") {
    warnings.push("VITE_ENABLE_DEV_ADMIN_BYPASS esta habilitado; desative em producao.");
  } else {
    ok("VITE_ENABLE_DEV_ADMIN_BYPASS desabilitado.");
  }

  if (!bootstrapEmail) warnings.push("ADMIN_BOOTSTRAP_EMAIL ausente.");
  else if (/example\.com|exemplo\.com/i.test(bootstrapEmail)) {
    warnings.push("ADMIN_BOOTSTRAP_EMAIL parece ser apenas exemplo/template.");
  }

  if (checkMode !== "local" && bootstrapPassword && looksPlaceholder(bootstrapPassword)) {
    warnings.push("ADMIN_BOOTSTRAP_PASSWORD ainda parece placeholder/template.");
  }

  if (checkMode !== "local" && bootstrapToken && looksPlaceholder(bootstrapToken)) {
    warnings.push("ADMIN_BOOTSTRAP_TOKEN ainda parece placeholder/template.");
  }

  if (!bootstrapPassword && !bootstrapToken) {
    warnings.push(
      "Nenhuma credencial de bootstrap informada. Se o primeiro admin ja existir, ignore; caso contrario, prepare a criacao inicial.",
    );
  }

  if (!aiProvider) {
    warnings.push("AI_PROVIDER nao definido.");
  } else {
    ok(`AI_PROVIDER definido (${aiProvider}).`);
    if (aiProvider !== "mock" && !aiApiKey) {
      warnings.push("AI_API_KEY ausente para provedor de IA real.");
    } else if (aiApiKey && looksPlaceholder(aiApiKey)) {
      warnings.push("AI_API_KEY ainda parece placeholder/template.");
    }
  }

  for (const message of errors) fail(message);
  for (const message of warnings) warn(message);

  if (databaseUrl && shouldValidateDatabase) {
    try {
      await validateDatabase(databaseUrl);
    } catch (error) {
      const formattedError = formatError(error);
      fail(`falha ao validar PostgreSQL: ${formattedError}`);
      if (looksLocalUrl(databaseUrl)) {
        warn(
          "O banco local parece indisponivel. Confirme se o PostgreSQL/Docker Desktop esta em execucao e se a porta configurada esta acessivel.",
        );
      }
      errors.push("falha na validacao do banco.");
    }
  }

  try {
    await validateStorage();
  } catch (error) {
    fail(`falha ao validar storage local: ${error.message}`);
    errors.push("falha na validacao do storage.");
  }

  if (errors.length > 0) {
    console.error(`\nResultado: ${errors.length} erro(s) critico(s) encontrados.`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`\nResultado: sem erros criticos, mas com ${warnings.length} alerta(s).`);
    process.exit(0);
  }

  console.log("\nResultado: ambiente pronto para validacao assistida.");
}

main().catch((error) => {
  console.error(`[FAIL] erro inesperado: ${error.message}`);
  process.exit(1);
});
