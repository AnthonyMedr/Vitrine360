import { initializeDb, readDb } from "../server/db";
import { writeInternalScaleReadinessReport } from "../server/internal-scale-readiness";

await initializeDb();

const { report, markdownPath, jsonPath } = writeInternalScaleReadinessReport(readDb());

console.log(
  JSON.stringify(
    {
      internal_ready: report.internal_ready,
      blockers: report.blockers,
      warnings: report.warnings,
      external_warnings: report.external_warnings,
      markdown_path: markdownPath,
      json_path: jsonPath,
      next_steps: report.next_steps,
    },
    null,
    2,
  ),
);

if (!report.internal_ready) {
  process.exitCode = 1;
}
