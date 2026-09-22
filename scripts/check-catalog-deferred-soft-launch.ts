import { readDb } from "../server/db";
import { getSoftLaunchDeferredGateReport } from "../server/catalog-staging";

const report = getSoftLaunchDeferredGateReport(readDb());

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
