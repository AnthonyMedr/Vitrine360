import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ManifestArtifact = {
  id: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  sha256: string;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function hashFile(path: string): ManifestArtifact {
  if (!existsSync(path)) {
    return { id: path.replace(/^docs\/reports\//, "").replace(/\.(json|md|csv)$/i, ""), path, exists: false, size_bytes: 0, sha256: "" };
  }

  const content = readFileSync(path);
  return {
    id: path.replace(/^docs\/reports\//, "").replace(/\.(json|md|csv)$/i, ""),
    path,
    exists: true,
    size_bytes: statSync(path).size,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function buildMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Manifesto de Integridade - Central Admin Enterprise");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- OK: \`${report.ok}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push("");
  lines.push("## Artefatos Assinados");
  lines.push("");
  lines.push("| Artefato | Existe | Tamanho | SHA-256 |");
  lines.push("| --- | --- | --- | --- |");
  for (const artifact of report.artifacts) {
    lines.push(`| \`${artifact.path}\` | \`${artifact.exists}\` | \`${artifact.size_bytes}\` | \`${artifact.sha256}\` |`);
  }
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  for (const check of report.checks) lines.push(`- ${check}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildReport() {
  const artifactPaths = [
    "docs/reports/admin-enterprise-phases-latest.json",
    "docs/reports/admin-menu-routes-latest.json",
    "docs/reports/admin-control-center-latest.json",
    "docs/reports/admin-enterprise-external-handoff-latest.json",
    "docs/reports/admin-operational-adoption-pack-latest.json",
    "docs/reports/admin-operational-adoption-pack-latest.md",
    "docs/reports/admin-operational-adoption-pack-latest.csv",
    "docs/reports/admin-enterprise-final-latest.json",
    "docs/reports/admin-enterprise-index-latest.json",
    "docs/reports/admin-enterprise-boundary-latest.json",
  ];
  const artifacts = artifactPaths.map(hashFile);
  const index = readJson("docs/reports/admin-enterprise-index-latest.json");
  const boundary = readJson("docs/reports/admin-enterprise-boundary-latest.json");
  const missing = artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.path);
  const checks = [
    `missing_artifacts=${missing.length}`,
    `index_ok=${String(index?.ok ?? false)}`,
    `index_production_open=${String(index?.production_open ?? "ausente")}`,
    `boundary_ok=${String(boundary?.ok ?? false)}`,
    `boundary_production_open=${String(boundary?.production_open ?? "ausente")}`,
  ];

  return {
    generated_at: new Date().toISOString(),
    ok: missing.length === 0 && index?.ok === true && index.production_open === "BLOQUEADO_EXTERNO" && boundary?.ok === true,
    production_open: "BLOQUEADO_EXTERNO",
    artifacts,
    checks,
  };
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-manifest-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const report = buildReport();

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, buildMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      artifacts: report.artifacts.length,
      production_open: report.production_open,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
