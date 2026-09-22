import { getGoLiveReadinessReport } from "../server/go-live-readiness.ts";

const report = getGoLiveReadinessReport();

console.log(JSON.stringify(report, null, 2));

if (report.blockers > 0) {
  process.exitCode = 1;
}
