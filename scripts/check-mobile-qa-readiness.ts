import { writeMobileQaReadinessReport } from "../server/mobile-qa-readiness";

const { report, markdownPath } = writeMobileQaReadinessReport();

console.log(
  JSON.stringify(
    {
      ...report,
      markdown_path: markdownPath,
    },
    null,
    2,
  ),
);

if (!report.ok) {
  process.exitCode = 1;
}
