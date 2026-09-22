import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function readReport(path: string) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) {
    return { exists: false, path, data: null as JsonRecord | null };
  }
  return { exists: true, path, data: JSON.parse(readFileSync(fullPath, "utf8")) as JsonRecord };
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function buildMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Indice Consolidado - Central Admin Enterprise");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- OK interno: \`${report.ok}\``);
  lines.push(`- Veredito: \`${report.verdict}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push("");
  lines.push("## Sinais Consolidados");
  lines.push("");
  lines.push("| Sinal | Valor |");
  lines.push("| --- | --- |");
  for (const [key, value] of Object.entries(report.signals)) lines.push(`| ${key} | \`${String(value)}\` |`);
  lines.push("");
  lines.push("## Artefatos");
  lines.push("");
  lines.push("| Artefato | Existe | Status | Caminho |");
  lines.push("| --- | --- | --- | --- |");
  for (const artifact of report.artifacts) {
    lines.push(`| ${artifact.id} | \`${artifact.exists}\` | \`${artifact.status}\` | \`${artifact.path}\` |`);
  }
  lines.push("");
  lines.push("## Rotas Admin");
  lines.push("");
  lines.push(`- Total de rotas no menu: \`${report.routes.total_menu_routes}\``);
  lines.push(`- Rotas faltantes: \`${report.routes.missing_routes}\``);
  lines.push(`- Rotas redirecionadas: \`${report.routes.redirect_routes}\``);
  lines.push("");
  lines.push("## Bloqueios Externos");
  lines.push("");
  if (report.external_items.length === 0) {
    lines.push("Nenhum bloqueio externo catalogado.");
  } else {
    lines.push("| Area | Responsavel | Status | Rota | Validacao |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const item of report.external_items) {
      lines.push(`| ${item.area} | ${item.owner} | \`${item.status}\` | \`${item.admin_route}\` | \`${item.validation_command}\` |`);
    }
  }
  lines.push("");
  lines.push("## Comandos De Revalidacao");
  lines.push("");
  for (const command of report.revalidation_commands) lines.push(`- \`${command}\``);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildReport() {
  const artifacts = [
    { id: "phases", path: "docs/reports/admin-enterprise-phases-latest.json" },
    { id: "menu-routes", path: "docs/reports/admin-menu-routes-latest.json" },
    { id: "control-center", path: "docs/reports/admin-control-center-latest.json" },
    { id: "external-handoff", path: "docs/reports/admin-enterprise-external-handoff-latest.json" },
    { id: "adoption-pack", path: "docs/reports/admin-operational-adoption-pack-latest.json" },
    { id: "final", path: "docs/reports/admin-enterprise-final-latest.json" },
    { id: "boundary", path: "docs/reports/admin-enterprise-boundary-latest.json" },
    { id: "programmable-completion", path: "docs/reports/programmatic-completion-latest.json" },
  ].map((entry) => {
    const report = readReport(entry.path);
    return {
      id: entry.id,
      path: entry.path,
      exists: report.exists,
      status: report.data?.ok === true ? "ok" : report.exists ? "revisar" : "ausente",
      data: report.data,
    };
  });

  const byId = Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact]));
  const phases = asRecord(byId.phases?.data);
  const menu = asRecord(byId["menu-routes"]?.data);
  const controlCenter = asRecord(byId["control-center"]?.data);
  const externalHandoff = asRecord(byId["external-handoff"]?.data);
  const adoptionPack = asRecord(byId["adoption-pack"]?.data);
  const final = asRecord(byId.final?.data);
  const boundary = asRecord(byId.boundary?.data);
  const programmable = asRecord(byId["programmable-completion"]?.data);
  const handoffSummary = asRecord(externalHandoff.summary);
  const requiredArtifacts = artifacts.filter((artifact) => artifact.id !== "boundary");

  const internalOk =
    requiredArtifacts.every((artifact) => artifact.exists) &&
    phases.ok === true &&
    menu.ok === true &&
    controlCenter.ok === true &&
    externalHandoff.ok === true &&
    final.ok === true &&
    programmable.ok === true &&
    programmable.programmable_scope_complete === true &&
    asArray(phases.failed_internal_checks).length === 0 &&
    asArray(menu.missing_routes).length === 0 &&
    asArray(menu.redirect_routes).length === 0;

  const externalItems = asArray(externalHandoff.items).map((item) => {
    const record = asRecord(item);
    return {
      area: String(record.area ?? ""),
      owner: String(record.owner ?? ""),
      status: String(record.status ?? ""),
      admin_route: String(record.admin_route ?? ""),
      validation_command: String(record.validation_command ?? ""),
    };
  });

  return {
    generated_at: new Date().toISOString(),
    ok: internalOk,
    verdict: internalOk ? "ADMIN_ENTERPRISE_PROGRAMAVEL_CONCLUIDO" : "ADMIN_ENTERPRISE_REVISAR_ARTEFATOS",
    production_open: "BLOQUEADO_EXTERNO",
    signals: {
      internal_management_ready: String(controlCenter.internal_management_ready ?? false),
      programmable_scope_complete: String(programmable.programmable_scope_complete ?? false),
      total_menu_routes: String(menu.total_menu_routes ?? 0),
      missing_routes: String(asArray(menu.missing_routes).length),
      redirect_routes: String(asArray(menu.redirect_routes).length),
      final_steps: String(asArray(final.steps).length),
      boundary_ok: String(boundary.ok ?? false),
      external_blockers: String(handoffSummary.blocked_external ?? 0),
      pending_real_execution: String(handoffSummary.pending_real_execution ?? 0),
      training_executed: String(handoffSummary.training_executed ?? false),
      adoption_real_execution_required: String(adoptionPack.real_execution_required ?? 0),
      adoption_external_blockers: String(adoptionPack.external_blockers ?? 0),
    },
    routes: {
      total_menu_routes: Number(menu.total_menu_routes ?? 0),
      missing_routes: asArray(menu.missing_routes).length,
      redirect_routes: asArray(menu.redirect_routes).length,
    },
    artifacts: artifacts.map(({ data: _data, ...artifact }) => artifact),
    external_items: externalItems,
    revalidation_commands: [
      "npm run admin:enterprise:index",
      "npm run admin:enterprise:boundary",
      "npm run admin:enterprise:final",
      "npm run admin:enterprise:external-handoff",
      "npm run admin:adoption:pack",
      "npm run admin:adoption:check",
      "npm run admin:menu-routes:check",
      "npm run admin:enterprise:check",
    ],
  };
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-index-latest").replace(/\.(json|md)$/i, "");
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
      verdict: report.verdict,
      production_open: report.production_open,
      artifacts: report.artifacts.length,
      total_menu_routes: report.routes.total_menu_routes,
      missing_routes: report.routes.missing_routes,
      redirect_routes: report.routes.redirect_routes,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
