import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const removableExactFiles = [
  "tmp_active_products.json",
  "tmp-http-marketing.log",
  ".codex-logs/dev-server.out.log",
  ".codex-logs/dev-server.err.log",
  "docs/reports/dev-server-2026-05-19.out.log",
  "docs/reports/dev-server-2026-05-19.err.log",
  "docs/reports/dev-server-logs/full-dev.log",
  "docs/reports/dev-server-logs/full-dev.err.log",
  "docs/reports/dev-server-logs/vite-web.log",
  "docs/reports/dev-server-logs/vite-web.err.log",
];

const removableDirectories = [
  ".codex-logs/archive/2026-05-17",
];

function removeRelative(relativePath: string) {
  const fullPath = path.join(projectRoot, relativePath);
  if (!existsSync(fullPath)) return null;
  const stats = statSync(fullPath);
  rmSync(fullPath, { recursive: true, force: true });
  return {
    path: relativePath.replace(/\\/g, "/"),
    type: stats.isDirectory() ? "directory" : "file",
    sizeKb: Number((stats.size / 1024).toFixed(2)),
  };
}

const removed = [
  ...removableExactFiles.map(removeRelative),
  ...removableDirectories.map(removeRelative),
].filter(Boolean);

const tmpCandidates = readdirSync(projectRoot)
  .filter((entry) => /^tmp[-_].+\.(json|log)$/i.test(entry) || /^tmp_.+\.(json|log)$/i.test(entry))
  .filter((entry) => !removableExactFiles.includes(entry))
  .map((entry) => removeRelative(entry))
  .filter(Boolean);

removed.push(...tmpCandidates);

console.log(
  JSON.stringify(
    {
      ok: true,
      removed_count: removed.length,
      removed,
      next_steps: [
        "Reexecutar npm run repo:hygiene:check para confirmar que nao restam itens de revisao interna.",
      ],
    },
    null,
    2,
  ),
);
