import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type CheckResult = {
  id: string;
  label: string;
  command: string;
  ok: boolean;
  exit_code: number | null;
  summary: string;
  parsed?: unknown;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function summarize(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return "sem resumo estruturado";
  const record = parsed as Record<string, unknown>;
  return [
    typeof record.ok === "undefined" ? null : `ok=${String(record.ok)}`,
    typeof record.total_js_kb === "undefined" ? null : `total_js_kb=${String(record.total_js_kb)}`,
    typeof record.total_files === "undefined" ? null : `total_files=${String(record.total_files)}`,
    typeof record.by_action === "undefined" ? null : `by_action=${JSON.stringify(record.by_action)}`,
  ].filter(Boolean).join("; ");
}

function runCheck(id: string, label: string, args: string[]): CheckResult {
  const child = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  const parsed = extractJson(child.stdout ?? "");
  return {
    id,
    label,
    command: `${npmCommand} ${args.join(" ")}`,
    ok: child.status === 0,
    exit_code: child.status,
    summary: child.error ? child.error.message : summarize(parsed),
    parsed: parsed ?? undefined,
  };
}

function readJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(report: {
  generated_at: string;
  ok: boolean;
  validation_ok: boolean;
  checks: CheckResult[];
  validation_source: string;
}) {
  const lines: string[] = [];
  lines.push("# Checkpoint Final De Continuidade");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status geral: **${report.ok ? "PASSOU" : "FALHOU"}**`);
  lines.push(`- Validacao de continuidade anterior: **${report.validation_ok ? "PASSOU" : "FALHOU/AUSENTE"}**`);
  lines.push(`- Fonte da validacao: \`${report.validation_source}\``);
  lines.push("");
  lines.push("## Checks finais");
  lines.push("");
  lines.push(row(["Check", "Resultado", "Comando", "Resumo"]));
  lines.push(row(["---", "---", "---", "---"]));
  for (const check of report.checks) {
    lines.push(row([check.label, check.ok ? "ok" : "falhou", check.command, check.summary]));
  }
  lines.push("");
  lines.push("## Diretriz");
  lines.push("");
  lines.push("- Checkpoint final confirma codigo, performance estatica, higiene e continuidade tecnica.");
  lines.push("- Producao aberta continua bloqueada por fiscal, pagamento e frete reais ate validacao externa.");
  lines.push("- Nao tratar warnings de performance como liberacao comercial; eles entram como monitoramento continuo.");
  lines.push("");
  return lines.join("\n");
}

const validationPath = resolve(getArg("--validation") ?? "docs/reports/continuity-validation-latest.json");
const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/final-continuity-checkpoint-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const validation = readJson(validationPath);
const checks = [
  runCheck("performance-budget", "Performance budget", ["run", "performance:budget"]),
  runCheck("repo-hygiene", "Higiene do repositorio", ["run", "repo:hygiene:check"]),
];

const report = {
  generated_at: new Date().toISOString(),
  ok: Boolean(validation?.ok) && checks.every((check) => check.ok),
  validation_ok: Boolean(validation?.ok),
  validation_source: validationPath,
  validation,
  checks,
  files: { json: jsonPath, markdown: mdPath },
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderMarkdown(report)}\n`, "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  validation_ok: report.validation_ok,
  checks_ok: checks.every((check) => check.ok),
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
