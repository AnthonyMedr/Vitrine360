import { initializeDb, readDb } from "../server/db.ts";
import { getMarketingReadiness } from "../server/marketing-operations.ts";

async function main() {
  try {
    await initializeDb();
    const report = getMarketingReadiness(readDb());
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
                item: "marketing_readiness",
                detail: error instanceof Error ? error.message : "Falha ao validar readiness de marketing.",
              },
            ],
          },
          next_steps: ["Corrigir a inicializacao do banco e repetir npm run marketing:check."],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
