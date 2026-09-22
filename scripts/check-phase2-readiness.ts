import { getPhase2ReadinessReport } from "../server/phase2-readiness.ts";

const report = getPhase2ReadinessReport();
console.log(JSON.stringify(report, null, 2));

if (!report.phase2_ready) {
  process.exitCode = 1;
}
