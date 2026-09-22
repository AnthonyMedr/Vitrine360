import { initializeDb, readDb, waitForPendingDbWrites, writeDb } from "../server/db";
import { getOperationReadinessReport } from "../server/operation-readiness";
import { applyOperationAutoRemediation } from "../server/operation-remediation";

function printSection(title: string) {
  console.log(`\n[${title}]`);
}

async function main() {
  await initializeDb();

  const shouldApply = process.argv.includes("--apply");
  const db = readDb();
  const before = getOperationReadinessReport(db);
  const report = applyOperationAutoRemediation(db, {
    dryRun: !shouldApply,
    actorName: shouldApply ? "operations-remediation-script" : "operations-remediation-dry-run",
  });

  if (shouldApply && report.changed) {
    writeDb(db);
    await waitForPendingDbWrites();
  }

  const after = getOperationReadinessReport(shouldApply ? readDb() : db);

  printSection("operations-remediation");
  console.log(`mode: ${shouldApply ? "apply" : "dry-run"}`);
  console.log(`actions: ${report.actions.length}`);
  console.log(`payment_records_backfilled: ${report.metrics.payment_records_backfilled}`);
  console.log(`fiscal_documents_prepared: ${report.metrics.fiscal_documents_prepared}`);
  console.log(`orders_confirmed_after_payment: ${report.metrics.orders_confirmed_after_payment}`);
  console.log(`confirmed_orders_settled: ${report.metrics.confirmed_orders_settled}`);

  printSection("before");
  console.log(`reconciliationCritical: ${before.metrics.reconciliationCritical}`);
  console.log(`paymentActionRequired: ${before.metrics.paymentActionRequired}`);

  printSection("after");
  console.log(`reconciliationCritical: ${after.metrics.reconciliationCritical}`);
  console.log(`paymentActionRequired: ${after.metrics.paymentActionRequired}`);

  if (report.actions.length > 0) {
    printSection("actions");
    for (const action of report.actions.slice(0, 20)) {
      console.log(`- ${action.type} | ${action.order_number} | ${action.detail}`);
    }
    if (report.actions.length > 20) {
      console.log(`- ... ${report.actions.length - 20} acoes adicionais`);
    }
  }

  printSection("next-steps");
  for (const step of report.next_steps) {
    console.log(`- ${step}`);
  }
}

void main().catch((error) => {
  console.error("[operations-remediation] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
