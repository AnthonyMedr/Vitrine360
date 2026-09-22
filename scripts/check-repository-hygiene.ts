import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkSensitiveRuntimeBackupArtifacts } from "../server/sensitive-artifacts";

type HygieneItem = {
  path: string;
  category: "source" | "test" | "docs" | "generated" | "runtime-data" | "local-log" | "config" | "unknown";
  action: "keep" | "ignore" | "archive" | "review";
  reason: string;
  sizeKb: number;
};

const projectRoot = process.cwd();
const reportDir = path.join(projectRoot, "docs", "reports");
const markdownPath = path.join(reportDir, "REPOSITORY_HYGIENE_AUDIT.md");
const jsonPath = path.join(reportDir, "repository-hygiene-audit.json");

const ignoredDirs = new Set([".git", "node_modules", "dist", ".vite"]);
const keepRootFiles = new Set([
  ".markdownlint.json",
  ".env.example",
  ".env.homologation.example",
  ".env.phase1.example",
  ".env.phase2.example",
  ".env.staging.example",
  ".env.production.example",
  ".gitattributes",
  ".gitignore",
  "components.json",
  "docker-compose.phase1.yml",
  "eslint.config.js",
  "index.html",
  "LICENSE",
  "package-lock.json",
  "package.json",
  "postcss.config.js",
  "PRODUCTION_READINESS_AUDIT.md",
  "README.md",
  "tailwind.config.ts",
  "tsconfig.app.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.server.json",
  "vite.config.ts",
]);

function toPosix(relativePath: string) {
  return relativePath.replace(/\\/g, "/");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const relative = toPosix(path.relative(projectRoot, filePath));
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      if (ignoredDirs.has(entry)) return [];
      return listFiles(filePath);
    }
    return [relative];
  });
}

function sizeKb(relativePath: string) {
  return Number((statSync(path.join(projectRoot, relativePath)).size / 1024).toFixed(2));
}

function classify(relativePath: string): HygieneItem {
  const normalized = toPosix(relativePath);
  const rootName = normalized.split("/")[0];
  const ext = path.extname(normalized).toLowerCase();

  if (normalized.startsWith("docs/reports/dev-server-logs/")) {
    return { path: normalized, category: "local-log", action: "ignore", reason: "Log ou PID local do servidor de desenvolvimento; fica fora do versionamento.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized.endsWith(".log") || normalized.startsWith(".codex-logs/")) {
    return { path: normalized, category: "local-log", action: "archive", reason: "Log local de execucao; deve ficar fora do versionamento.", sizeKb: sizeKb(relativePath) };
  }

  if (/^tmp[-_].+\.(json|log)$/i.test(normalized) || /^tmp_.+\.(json|log)$/i.test(normalized)) {
    return {
      path: normalized,
      category: "generated",
      action: "archive",
      reason: "Artefato temporario local gerado para diagnostico; deve ficar fora do corpo principal do repositorio.",
      sizeKb: sizeKb(relativePath),
    };
  }

  if (normalized.startsWith("server/data/")) {
    return {
      path: normalized,
      category: "runtime-data",
      action: "ignore",
      reason: "Banco/snapshot local gerado em dev; seed interno recria a base quando necessario.",
      sizeKb: sizeKb(relativePath),
    };
  }

  if (normalized.startsWith("docs/reports/runtime-backups/") && ext === ".json") {
    return {
      path: normalized,
      category: "generated",
      action: "archive",
      reason: "Backup runtime gerado; manter redigido e fora do versionamento comum.",
      sizeKb: sizeKb(relativePath),
    };
  }

  if (normalized.startsWith("docs/reports/qa-visual-screenshots/")) {
    return {
      path: normalized,
      category: "generated",
      action: "archive",
      reason: "Evidencia visual gerada por QA; util para auditoria, mas nao e codigo fonte.",
      sizeKb: sizeKb(relativePath),
    };
  }

  if (normalized.startsWith("src/") || normalized.startsWith("server/") || normalized.startsWith("scripts/")) {
    return { path: normalized, category: "source", action: "keep", reason: "Codigo de produto, API ou automacao em uso.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized.startsWith("tests/")) {
    return { path: normalized, category: "test", action: "keep", reason: "Cobertura automatizada do ecommerce.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized.startsWith("docs/")) {
    return { path: normalized, category: "docs", action: "keep", reason: "Documentacao tecnica, operacional ou relatorio historico.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized.startsWith("public/") || normalized.startsWith("infra/") || normalized.startsWith(".github/") || keepRootFiles.has(normalized)) {
    return { path: normalized, category: "config", action: "keep", reason: "Configuracao, asset publico ou infraestrutura versionavel.", sizeKb: sizeKb(relativePath) };
  }

  if (rootName.startsWith(".env") && rootName !== ".env.example" && !rootName.endsWith(".example")) {
    return { path: normalized, category: "config", action: "ignore", reason: "Arquivo de ambiente local nao deve entrar no versionamento.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized === ".vscode/extensions.json") {
    return { path: normalized, category: "config", action: "keep", reason: "Recomendacoes de extensoes do workspace.", sizeKb: sizeKb(relativePath) };
  }

  if (normalized.startsWith(".vscode/")) {
    return { path: normalized, category: "config", action: "ignore", reason: "Configuracao local de IDE; pode conter prompts ou conectores locais.", sizeKb: sizeKb(relativePath) };
  }

  return { path: normalized, category: "unknown", action: "review", reason: "Arquivo nao classificado automaticamente; revisar manualmente antes de remover.", sizeKb: sizeKb(relativePath) };
}

function countBy<T extends string>(items: HygieneItem[], key: (item: HygieneItem) => T) {
  return items.reduce<Record<T, number>>(
    (acc, item) => {
      const value = key(item);
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

function markdownTable(items: HygieneItem[]) {
  if (items.length === 0) return "Nenhum item nesta categoria.\n";
  const rows = items
    .slice(0, 80)
    .map((item) => `| \`${item.path}\` | ${item.category} | ${item.action} | ${item.sizeKb} | ${item.reason} |`);
  return ["| Arquivo | Categoria | Acao | KB | Motivo |", "| --- | --- | --- | ---: | --- |", ...rows].join("\n");
}

const files = listFiles(projectRoot);
const items = files.map(classify).sort((a, b) => {
  const actionOrder = { review: 0, archive: 1, ignore: 2, keep: 3 };
  return actionOrder[a.action] - actionOrder[b.action] || b.sizeKb - a.sizeKb || a.path.localeCompare(b.path);
});
const sensitiveArtifacts = checkSensitiveRuntimeBackupArtifacts(projectRoot);
const actionable = items.filter((item) => item.action !== "keep");
const report = {
  generated_at: new Date().toISOString(),
  ok: items.every((item) => item.action !== "review") && sensitiveArtifacts.ok,
  total_files: items.length,
  by_action: countBy(items, (item) => item.action),
  by_category: countBy(items, (item) => item.category),
  sensitive_artifacts: sensitiveArtifacts,
  actionable,
  largest_files: [...items].sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 20),
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const markdown = `# Auditoria de Higiene do Repositorio

Gerado em: ${report.generated_at}

## Veredito

- Status: **${report.ok ? "PASSOU" : "REVISAO NECESSARIA"}**
- Arquivos analisados: ${report.total_files}
- Artefatos sensiveis em backups: ${sensitiveArtifacts.ok ? "0" : sensitiveArtifacts.findings.length}

## Contagem por acao

${Object.entries(report.by_action)
  .map(([action, count]) => `- ${action}: ${count}`)
  .join("\n")}

## Contagem por categoria

${Object.entries(report.by_category)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join("\n")}

## Itens que nao sao codigo fonte

${markdownTable(actionable)}

## Maiores arquivos

${markdownTable(report.largest_files)}

## Politica recomendada

- Manter 'src', 'server', 'scripts', 'tests', 'public', 'infra', '.github' e documentacao principal.
- Manter logs, bancos locais, WAL/SHM, backups runtime e screenshots de QA fora do versionamento normal.
- Sanitizar backups runtime antes de compartilhar ou anexar em relatorios.
- Nao apagar 'server/data' automaticamente: ele representa estado local de homologacao e pode ser necessario para reproduzir bugs.
- Para limpeza fisica, arquivar logs locais e backups antigos depois de validar que 'npm test', 'npm run build', 'npm run operations:check' e 'npm run scale:internal:check' continuam passando.
`;

writeFileSync(markdownPath, markdown, "utf8");
console.log(JSON.stringify({ ok: report.ok, total_files: report.total_files, by_action: report.by_action, markdown_path: markdownPath, json_path: jsonPath }, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
