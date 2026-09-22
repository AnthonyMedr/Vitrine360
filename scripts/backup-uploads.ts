import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../server/db";

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function sha256File(filePath: string) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function listFilesRecursive(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(fullPath, base);
    return [path.relative(base, fullPath)];
  });
}

function main() {
  const uploadsSource = path.join(dataDir, "uploads");
  if (!fs.existsSync(uploadsSource)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "uploads_dir_not_found", source: uploadsSource }, null, 2));
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.resolve(
    getArgValue("out") ?? path.join("docs", "reports", "runtime-backups", `uploads-backup-${stamp}`),
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const relativeFiles = listFilesRecursive(uploadsSource);
  const manifest: { path: string; sha256: string; bytes: number }[] = [];

  for (const relativePath of relativeFiles) {
    const sourcePath = path.join(uploadsSource, relativePath);
    const destPath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    manifest.push({
      path: relativePath.replace(/\\/g, "/"),
      sha256: sha256File(sourcePath),
      bytes: fs.statSync(sourcePath).size,
    });
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  const totalBytes = manifest.reduce((sum, entry) => sum + entry.bytes, 0);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ generated_at: new Date().toISOString(), source: uploadsSource, file_count: manifest.length, total_bytes: totalBytes, files: manifest }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      { ok: true, output_dir: outputDir, manifest: manifestPath, file_count: manifest.length, total_bytes: totalBytes },
      null,
      2,
    ),
  );
}

main();
