import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ManifestArtifact = {
  id: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  sha256: string;
};

type ManifestReport = {
  generated_at: string;
  ok: boolean;
  production_open: string;
  artifacts: ManifestArtifact[];
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function hashFile(path: string) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readManifest(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as ManifestReport;
}

const manifestPath = resolve(getArg("--manifest") ?? "docs/reports/admin-enterprise-manifest-latest.json");
const manifest = readManifest(manifestPath);

const checks = manifest.artifacts.map((artifact) => {
  const currentHash = hashFile(artifact.path);
  const exists = currentHash !== null;
  const hash_matches = exists && currentHash === artifact.sha256;
  return {
    id: artifact.id,
    path: artifact.path,
    exists,
    expected_sha256: artifact.sha256,
    current_sha256: currentHash ?? "",
    hash_matches,
  };
});

const report = {
  generated_at: new Date().toISOString(),
  manifest: manifestPath,
  manifest_generated_at: manifest.generated_at,
  ok:
    manifest.ok === true &&
    manifest.production_open === "BLOQUEADO_EXTERNO" &&
    checks.every((check) => check.exists && check.hash_matches),
  production_open: manifest.production_open,
  checked_artifacts: checks.length,
  drifted_artifacts: checks.filter((check) => !check.hash_matches).map((check) => check.path),
  missing_artifacts: checks.filter((check) => !check.exists).map((check) => check.path),
  checks,
};

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      production_open: report.production_open,
      checked_artifacts: report.checked_artifacts,
      drifted_artifacts: report.drifted_artifacts.length,
      missing_artifacts: report.missing_artifacts.length,
    },
    null,
    2,
  ),
);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
