import fs from "node:fs";
import path from "node:path";
import { validateRuntimeBackupPayload } from "../server/backup-operations";

const fileArg = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);

if (!fileArg) {
  console.error("Uso: npm run backup:validate -- caminho/do/backup.json");
  process.exitCode = 1;
} else {
  const filePath = path.resolve(fileArg);
  const raw = fs.readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw) as unknown;
  const validation = validateRuntimeBackupPayload(payload);
  console.log(
    JSON.stringify(
      {
        file: filePath,
        ...validation,
      },
      null,
      2,
    ),
  );
  if (!validation.ok) process.exitCode = 1;
}
