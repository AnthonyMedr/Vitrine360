import { checkSensitiveRuntimeBackupArtifacts } from "../server/sensitive-artifacts";

const report = checkSensitiveRuntimeBackupArtifacts();

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
