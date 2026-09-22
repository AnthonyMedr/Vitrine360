import fs from "node:fs";
import path from "node:path";
import { closeDbResources, dataDir, initializeDb, waitForPendingDbWrites, writeDb } from "../server/db";
import { validateRuntimeBackupPayload, type RuntimeBackupPayload } from "../server/backup-operations";

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const fileArg = process.argv.find((arg, index) => index >= 2 && !arg.startsWith("--"));
  if (!fileArg) {
    console.error("Uso: npm run backup:restore -- caminho/do/backup.json --confirm");
    process.exitCode = 1;
    return;
  }

  const confirmed = hasFlag("confirm");
  if (!confirmed) {
    console.error(
      "RESTAURACAO REAL BLOQUEADA: este comando SOBRESCREVE o banco atual em uso. " +
        "Rode novamente com --confirm somente apos confirmar que quer substituir os dados atuais " +
        "(um snapshot de seguranca do estado atual sera salvo automaticamente antes de sobrescrever).",
    );
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(getArgValue("file") ?? fileArg);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as RuntimeBackupPayload;
  const validation = validateRuntimeBackupPayload(payload);

  if (!validation.ok) {
    console.error(JSON.stringify({ ok: false, file: filePath, validation }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (payload.redaction?.sensitive_fields_redacted) {
    console.error(
      "RESTAURACAO BLOQUEADA: este backup tem campos sensiveis redigidos ([REDACTED]) " +
        "e restaura-lo sobrescreveria senhas/tokens reais com placeholders. " +
        "Use um backup gerado com --include-sensitive para restore real.",
    );
    process.exitCode = 1;
    return;
  }

  // Snapshot de segurança do estado atual antes de sobrescrever, para permitir desfazer o restore.
  await initializeDb();
  await waitForPendingDbWrites();
  const currentDbPath = path.join(dataDir, "db.json");
  if (fs.existsSync(currentDbPath)) {
    const safetyStamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safetyPath = path.join(dataDir, `pre-restore-safety-${safetyStamp}.json`);
    fs.copyFileSync(currentDbPath, safetyPath);
    console.log(`Snapshot de seguranca do estado atual salvo em: ${safetyPath}`);
  }

  writeDb(payload.data);
  await waitForPendingDbWrites();

  console.log(
    JSON.stringify(
      {
        ok: true,
        restored_from: filePath,
        backup_generated_at: payload.generated_at,
        counts: validation.counts,
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
