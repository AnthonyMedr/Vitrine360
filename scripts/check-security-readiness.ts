import { getSecurityReadinessReport } from "../server/security-readiness.ts";

const report = getSecurityReadinessReport();

console.log(JSON.stringify(report, null, 2));

if (!report.ready) {
  process.exitCode = 1;
}
