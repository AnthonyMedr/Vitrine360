import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateRuntimeBackupPayload, type RuntimeBackupPayload } from "../server/backup-operations";

const fileArg = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);

if (!fileArg) {
  console.error("Uso: npm run backup:restore:simulate -- caminho/do/backup.json");
  process.exitCode = 1;
} else {
  const filePath = path.resolve(fileArg);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as RuntimeBackupPayload;
  const validation = validateRuntimeBackupPayload(payload);
  if (!validation.ok) {
    console.log(JSON.stringify({ ok: false, file: filePath, validation }, null, 2));
    process.exitCode = 1;
  } else {
    const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-restore-sim-"));
    const restoredPath = path.join(restoreDir, "db.json");
    fs.writeFileSync(restoredPath, `${JSON.stringify(payload.data, null, 2)}\n`, "utf8");

    const roundTripPayload: RuntimeBackupPayload = {
      ...payload,
      data: JSON.parse(fs.readFileSync(restoredPath, "utf8")) as RuntimeBackupPayload["data"],
    };
    const roundTripValidation = validateRuntimeBackupPayload(roundTripPayload);

    console.log(
      JSON.stringify(
        {
          ok: roundTripValidation.ok,
          file: filePath,
          restoredPath,
          checksum_matches: roundTripValidation.checksum_matches,
          counts: roundTripValidation.counts,
          blockers: roundTripValidation.blockers,
          warnings: roundTripValidation.warnings,
        },
        null,
        2,
      ),
    );

    fs.rmSync(restoreDir, { recursive: true, force: true });
    if (!roundTripValidation.ok) process.exitCode = 1;
  }
}
