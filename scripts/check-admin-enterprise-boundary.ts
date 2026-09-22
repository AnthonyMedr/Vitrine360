import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type BoundaryCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function readText(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function hasForbiddenProductionReleaseClaim(text: string) {
  const forbiddenPatterns = [
    /PRODUCAO_ABERTA\s*=\s*(LIBERAD[AO]|PRONT[AO]|APTO)/i,
    /producao aberta\s+(liberada|pronta|apta)/i,
    /apto para producao aberta/i,
  ];
  const guardrailPatterns = [
    /\bnao\b/i,
    /indevid/i,
    /sem resolver/i,
    /falha se/i,
    /bloquead/i,
    /depende/i,
    /somente apos/i,
  ];

  return text
    .split(/\r?\n/)
    .some((line) => forbiddenPatterns.some((pattern) => pattern.test(line)) && !guardrailPatterns.some((pattern) => pattern.test(line)));
}

function buildMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Boundary Check - Central Admin Enterprise");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- OK: \`${report.ok}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Resultado | Detalhe |");
  lines.push("| --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "ok" : "falhou"} | ${check.detail.replace(/\|/g, "/")} |`);
  }
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(report.ok ? "Limites de governanca preservados." : "Ha risco de comunicacao indevida de prontidao produtiva.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildReport() {
  const indexPath = "docs/reports/admin-enterprise-index-latest.json";
  const completePath = "docs/reports/admin-enterprise-complete-latest.json";
  const finalPath = "docs/reports/admin-enterprise-final-latest.json";
  const handoffPath = "docs/reports/admin-enterprise-external-handoff-latest.json";
  const planPath = "docs/admin/PLANO_EXECUCAO_CENTRAL_ADMIN_ENTERPRISE.md";
  const phaseDocPath = "docs/admin/EXECUCAO_FASE_A_FASE_CENTRAL_ADMIN.md";
  const evolutionPath = "docs/admin/RELATORIO_EVOLUCAO_CENTRAL_ADMIN_ENTERPRISE.md";
  const goLivePath = "docs/admin/PRONTIDAO_GO_LIVE_ADMIN.md";

  const index = readJson(indexPath);
  const complete = readJson(completePath);
  const final = readJson(finalPath);
  const handoff = readJson(handoffPath);
  const docs = [
    { path: planPath, text: readText(planPath) },
    { path: phaseDocPath, text: readText(phaseDocPath) },
    { path: evolutionPath, text: readText(evolutionPath) },
    { path: goLivePath, text: readText(goLivePath) },
  ];
  const allDocText = docs.map((doc) => doc.text).join("\n\n");
  const handoffSummary = handoff?.summary as Record<string, unknown> | undefined;
  const indexSignals = index?.signals as Record<string, unknown> | undefined;
  const checks: BoundaryCheck[] = [
    {
      id: "index-production-blocked",
      label: "Indice preserva producao bloqueada",
      ok: index?.production_open === "BLOQUEADO_EXTERNO",
      detail: `${indexPath}: production_open=${String(index?.production_open ?? "ausente")}`,
    },
    {
      id: "complete-ok",
      label: "Conclusao oficial passou",
      ok: complete?.ok === true || final?.ok === true,
      detail: `${completePath}: ok=${String(complete?.ok ?? "ausente")}; ${finalPath}: ok=${String(final?.ok ?? "ausente")}`,
    },
    {
      id: "handoff-external-blockers",
      label: "Handoff externo mantem blockers reais",
      ok: Number(handoffSummary?.blocked_external ?? 0) >= 3,
      detail: `${handoffPath}: blocked_external=${String(handoffSummary?.blocked_external ?? "ausente")}`,
    },
    {
      id: "training-not-faked",
      label: "Treinamento real nao foi simulado",
      ok: String(indexSignals?.training_executed ?? "") === "false",
      detail: `${indexPath}: training_executed=${String(indexSignals?.training_executed ?? "ausente")}`,
    },
    {
      id: "docs-mention-blocked",
      label: "Documentos principais citam BLOQUEADO_EXTERNO",
      ok: docs.every((doc) => doc.text.includes("BLOQUEADO_EXTERNO")),
      detail: docs.filter((doc) => !doc.text.includes("BLOQUEADO_EXTERNO")).map((doc) => doc.path).join(", ") || "Todos citam o bloqueio externo.",
    },
    {
      id: "no-forbidden-production-release-claim",
      label: "Sem claim indevido de producao aberta liberada",
      ok: !hasForbiddenProductionReleaseClaim(allDocText),
      detail: "Busca negativa por liberacao produtiva indevida em docs/admin principais.",
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    ok: checks.every((check) => check.ok),
    production_open: "BLOQUEADO_EXTERNO",
    checks,
    guarded_files: docs.map((doc) => doc.path),
  };
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-boundary-latest").replace(/\.(json|md)$/i, "");
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
      production_open: report.production_open,
      failed_checks: report.checks.filter((check) => !check.ok).map((check) => check.id),
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
