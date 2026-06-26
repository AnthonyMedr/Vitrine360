import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "..", "database", "migrations");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL nao definida.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("sslmode=require") ||
    process.env.DATABASE_SSL === "1" ||
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vitrine_schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query("SELECT id FROM vitrine_schema_migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function main() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    console.log("Nenhuma migration encontrada.");
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Ja aplicada: ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando: ${file}`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO vitrine_schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Migracoes concluidas.");
}

main()
  .catch((error) => {
    console.error("Falha ao aplicar migrations:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
