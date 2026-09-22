import fs from "node:fs";
import path from "node:path";
import { closeDbResources, initializeDb, readDb, waitForPendingDbWrites } from "../server/db";
import { createRuntimeBackupPayload, validateRuntimeBackupPayload } from "../server/backup-operations";

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? process.env[`npm_config_${name}`] ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`) || process.env[`npm_config_${name}`] === "true";
}

function defaultOutputPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "docs", "reports", "runtime-backups", `runtime-backup-${stamp}.json`);
}

async function main() {
  await initializeDb();
  await waitForPendingDbWrites();

  const outputPath = path.resolve(getArgValue("out") ?? defaultOutputPath());
  const includeSensitive = hasFlag("include-sensitive");
  const allowSensitiveReport = hasFlag("allow-sensitive-report");
  const isReportPath = outputPath.includes(`${path.sep}docs${path.sep}reports${path.sep}`);

  if (includeSensitive && isReportPath && !allowSensitiveReport) {
    throw new Error("Backups completos com campos sensiveis nao devem ser gravados em docs/reports. Use outro destino ou --allow-sensitive-report conscientemente.");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const payload = createRuntimeBackupPayload(readDb(), new Date().toISOString(), { redactSensitive: !includeSensitive });
  const validation = validateRuntimeBackupPayload(payload);
  if (!validation.ok) {
    throw new Error(`Backup local invalido antes da gravacao: ${validation.blockers.join(", ")}`);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        file: outputPath,
        generated_at: payload.generated_at,
        checksum: payload.checksum.value,
        counts: payload.counts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDbResources();
  });
