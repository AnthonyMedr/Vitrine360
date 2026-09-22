import { initializeDb, readDb } from "../server/db.ts";
import { getAdminFiscalReadiness } from "../server/read-models.ts";

async function main() {
  try {
    await initializeDb();
    const scopeArgIndex = process.argv.findIndex((entry) => entry === "--scope" || entry.startsWith("--scope="));
    const scopeArgValue =
      scopeArgIndex === -1
        ? undefined
        : process.argv[scopeArgIndex].startsWith("--scope=")
          ? process.argv[scopeArgIndex].split("=")[1]
          : process.argv[scopeArgIndex + 1];
    const scope = scopeArgValue === "minimal-go-live" ? "minimal-go-live" : "global";
    const report = getAdminFiscalReadiness(readDb(), { scope });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ready: false,
          blockers: 1,
          warnings: 0,
          checks: {
            ok: [],
            warnings: [],
            blockers: [
              {
                item: "database_init",
                detail: error instanceof Error ? error.message : "Falha ao inicializar o banco para readiness fiscal.",
              },
            ],
          },
          next_steps: ["Corrigir a inicializacao do banco antes de validar a readiness fiscal."],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
