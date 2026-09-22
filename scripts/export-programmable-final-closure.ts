import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ClosureCommand = {
  id: string;
  label: string;
  command: string[];
  allowFailure: boolean;
};

type ClosureResult = ClosureCommand & {
  exit_code: number | null;
  ok: boolean;
  accepted: boolean;
  parsed: Record<string, unknown> | null;
  summary: string;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const commands: ClosureCommand[] = [
  { id: "admin_enterprise", label: "Central Admin Enterprise", command: ["run", "admin:enterprise:complete"], allowFailure: false },
  { id: "security", label: "Seguranca local/staging", command: ["run", "security:check"], allowFailure: false },
  { id: "performance", label: "Budget de performance", command: ["run", "performance:budget"], allowFailure: false },
  { id: "health", label: "Readiness tecnica", command: ["run", "health:readiness"], allowFailure: false },
  { id: "go_live", label: "Go-live real", command: ["run", "go-live:check"], allowFailure: true },
  { id: "integrations", label: "Integracoes reais", command: ["run", "integrations:check"], allowFailure: true },
];

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarize(parsed: Record<string, unknown> | null) {
  if (!parsed) return "sem_json";
  return [
    typeof parsed.ok !== "undefined" ? `ok=${String(parsed.ok)}` : null,
    typeof parsed.ready !== "undefined" ? `ready=${String(parsed.ready)}` : null,
    typeof parsed.go_live_ready !== "undefined" ? `go_live_ready=${String(parsed.go_live_ready)}` : null,
    typeof parsed.PHASE2_READY !== "undefined" ? `PHASE2_READY=${String(parsed.PHASE2_READY)}` : null,
    typeof parsed.blockers !== "undefined" ? `blockers=${String(parsed.blockers)}` : null,
    typeof parsed.warnings !== "undefined" ? `warnings=${String(parsed.warnings)}` : null,
    typeof parsed.production_open !== "undefined" ? `production_open=${String(parsed.production_open)}` : null,
    typeof parsed.PRODUCTION_OPEN !== "undefined" ? `PRODUCTION_OPEN=${String(parsed.PRODUCTION_OPEN)}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function runCommand(command: ClosureCommand): ClosureResult {
  const result = spawnSync(npmCommand, command.command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1" },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const parsed = extractJson(stdout);
  const ok = result.status === 0;

  if (!ok && !command.allowFailure) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  return {
    ...command,
    exit_code: result.status,
    ok,
    accepted: ok || command.allowFailure,
    parsed,
    summary: summarize(parsed),
  };
}

function collectExternalBlockers(results: ClosureResult[]) {
  const blockers: Array<{ source: string; item: string; detail: string }> = [];
  for (const result of results) {
    const checks = result.parsed?.checks as { blockers?: Array<{ item?: string; detail?: string }> } | undefined;
    for (const blocker of checks?.blockers ?? []) {
      blockers.push({
        source: result.id,
        item: String(blocker.item ?? "unknown"),
        detail: String(blocker.detail ?? ""),
      });
    }
  }
  return blockers;
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Fechamento Final Programavel");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- Escopo programavel: \`${report.programmable_scope}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- OK: \`${report.ok}\``);
  lines.push("");
  lines.push("## Comandos");
  lines.push("");
  lines.push("| Area | Aceito | Exit | Resumo |");
  lines.push("| --- | --- | --- | --- |");
  for (const result of report.results) {
    lines.push(`| ${result.label} | \`${result.accepted}\` | \`${result.exit_code}\` | ${result.summary.replace(/\|/g, "/")} |`);
  }
  lines.push("");
  lines.push("## Bloqueios Externos");
  lines.push("");
  if (report.external_blockers.length === 0) {
    lines.push("- Nenhum bloqueio externo detectado.");
  } else {
    for (const blocker of report.external_blockers) {
      lines.push(`- \`${blocker.source}:${blocker.item}\` - ${blocker.detail}`);
    }
  }
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push("Tudo que pode ser concluido por codigo esta fechado. Producao aberta permanece bloqueada ate credenciais, homologacoes e evidencias reais.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildReport(results: ClosureResult[]) {
  const externalBlockers = collectExternalBlockers(results);
  const failedInternal = results.filter((result) => !result.accepted);
  return {
    generated_at: new Date().toISOString(),
    ok: failedInternal.length === 0,
    programmable_scope: failedInternal.length === 0 ? "CONCLUIDO" : "FALHA_INTERNA",
    production_open: "BLOQUEADO_EXTERNO",
    failed_internal: failedInternal.map((result) => result.id),
    external_blockers: externalBlockers,
    results,
  };
}

const basePath = resolve("docs/reports/programmable-final-closure-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const results = commands.map(runCommand);
const report = buildReport(results);

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      programmable_scope: report.programmable_scope,
      production_open: report.production_open,
      external_blockers: report.external_blockers.length,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
