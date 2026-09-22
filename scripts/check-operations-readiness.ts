import { initializeDb, readDb } from "../server/db.ts";
import { getOperationReadinessReport } from "../server/operation-readiness.ts";

async function main() {
  try {
    await initializeDb();
    const report = getOperationReadinessReport(readDb());
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
                detail: error instanceof Error ? error.message : "Falha ao inicializar o banco para readiness operacional.",
              },
            ],
          },
          next_steps: ["Corrigir a inicializacao do banco antes de validar a readiness operacional."],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
