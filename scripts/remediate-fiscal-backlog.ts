import { initializeDb, readDb, writeDb } from "../server/db";
import { applyFiscalAutoRemediation } from "../server/fiscal-remediation";

const shouldApply = process.argv.includes("--apply");

await initializeDb();

const db = readDb();
const report = applyFiscalAutoRemediation(db, {
  dryRun: !shouldApply,
  actorId: "script-fiscal-remediation",
  actorName: "Fiscal Remediation Script",
  fallbackCorrelationId: "fiscal-remediation-script",
});

if (shouldApply && report.changed) {
  writeDb(db);
}

console.log(JSON.stringify(report, null, 2));

if (report.actions.length > 0 && !shouldApply) {
  process.exitCode = 1;
}
