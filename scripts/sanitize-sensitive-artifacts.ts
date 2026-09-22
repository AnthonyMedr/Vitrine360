import { sanitizeRuntimeBackupArtifacts } from "../server/sensitive-artifacts";

const report = sanitizeRuntimeBackupArtifacts();

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
