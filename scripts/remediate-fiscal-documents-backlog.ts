import { initializeDb, readDb, writeDb } from "../server/db";
import { applyFiscalDocumentAutoRemediation } from "../server/fiscal-document-remediation";

const shouldApply = process.argv.includes("--apply");

await initializeDb();

const db = readDb();
const report = applyFiscalDocumentAutoRemediation(db, {
  dryRun: !shouldApply,
  actorId: "script-fiscal-document-remediation",
  actorName: "Fiscal Document Remediation Script",
  fallbackCorrelationId: "fiscal-document-remediation-script",
});

if (shouldApply && report.changed) {
  writeDb(db);
}

console.log(JSON.stringify(report, null, 2));

if (report.actions.length > 0 && !shouldApply) {
  process.exitCode = 1;
}
