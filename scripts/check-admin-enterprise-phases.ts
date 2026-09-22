import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type PhaseStatus = "complete" | "blocked_external" | "failed";

type PhaseCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  external?: boolean;
};

type Phase = {
  id: string;
  title: string;
  status: PhaseStatus;
  checks: PhaseCheck[];
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function fileCheck(path: string, label: string): PhaseCheck {
  const ok = existsSync(path);
  return { id: `file:${path}`, label, ok, detail: ok ? path : `Arquivo ausente: ${path}` };
}

function sourceCheck(id: string, label: string, source: string, pattern: RegExp, detail: string): PhaseCheck {
  const ok = pattern.test(source);
  return { id, label, ok, detail };
}

function routeCheck(route: string, component: string, appSource: string): PhaseCheck {
  const pattern = new RegExp(`path="${escapeRegExp(route)}" element=\\{<${component} \\/>\\}`);
  const ok = pattern.test(appSource);
  return {
    id: `route:${route}`,
    label: `${route} -> ${component}`,
    ok,
    detail: ok ? "Rota dedicada registrada." : `Rota dedicada ausente ou diferente para ${route}.`,
  };
}

function phaseStatus(checks: PhaseCheck[]): PhaseStatus {
  const failedInternal = checks.some((check) => !check.ok && !check.external);
  if (failedInternal) return "failed";
  const hasExternalBlock = checks.some((check) => check.external && !check.ok);
  return hasExternalBlock ? "blocked_external" : "complete";
}

function buildPhase(id: string, title: string, checks: PhaseCheck[]): Phase {
  return { id, title, status: phaseStatus(checks), checks };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMarkdown(report: {
  ok: boolean;
  generated_at: string;
  phases: Phase[];
  failed_internal_checks: string[];
  external_blockers: string[];
}) {
  const lines = [
    "# Check Fase A Fase - Central Admin Enterprise",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `OK interno: ${report.ok}`,
    `Fases avaliadas: ${report.phases.length}`,
    `Falhas internas: ${report.failed_internal_checks.length}`,
    `Bloqueios externos preservados: ${report.external_blockers.length}`,
    "",
    "## Fases",
    "",
  ];

  for (const phase of report.phases) {
    lines.push(`### ${phase.title}`, "", `Status: ${phase.status}`, "", "| Check | Resultado | Detalhe |", "| --- | --- | --- |");
    for (const check of phase.checks) {
      lines.push(`| ${check.label} | ${check.ok ? "ok" : check.external ? "bloqueado externo" : "falhou"} | ${check.detail.replace(/\|/g, "/")} |`);
    }
    lines.push("");
  }

  if (report.external_blockers.length > 0) {
    lines.push("## Bloqueios Externos", "", ...report.external_blockers.map((item) => `- ${item}`), "");
  }

  return `${lines.join("\n")}\n`;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-enterprise-phases-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const appSource = readFileSync("src/App.tsx", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const reportSource = readFileSync("docs/admin/RELATORIO_EVOLUCAO_CENTRAL_ADMIN_ENTERPRISE.md", "utf8");
const planSource = readFileSync("docs/admin/PLANO_EXECUCAO_CENTRAL_ADMIN_ENTERPRISE.md", "utf8");

const phases = [
  buildPhase("phase-1-architecture", "Fase 1 - Arquitetura e rotas dedicadas", [
    fileCheck("src/components/admin/AdminWorkspaceShell.tsx", "Shell administrativo compartilhado"),
    fileCheck("src/components/admin/AdminModuleWorkspace.tsx", "Workspace modular compartilhado"),
    routeCheck("/admin/go-live", "AdminGoLiveReadiness", appSource),
    routeCheck("/admin/relatorios", "AdminReports", appSource),
    routeCheck("/admin/documentacao", "AdminDocumentation", appSource),
    routeCheck("/admin/rbac-simulador", "AdminRbacSimulator", appSource),
  ]),
  buildPhase("phase-2-focused-modules", "Fase 2 - Menus e workspaces focados", [
    routeCheck("/admin/campanhas", "AdminCampaigns", appSource),
    routeCheck("/admin/temas", "AdminThemes", appSource),
    routeCheck("/admin/banners-vitrines", "AdminBannersShowcases", appSource),
    routeCheck("/admin/cupons-promocoes", "AdminCouponsPromotions", appSource),
    routeCheck("/admin/frete-entrega", "AdminFreightDelivery", appSource),
    routeCheck("/admin/pagamentos", "AdminPayments", appSource),
    routeCheck("/admin/financeiro", "AdminFinance", appSource),
    routeCheck("/admin/seguranca", "AdminSecurity", appSource),
    routeCheck("/admin/configuracoes", "AdminSettings", appSource),
  ]),
  buildPhase("phase-3-security-rbac", "Fase 3 - Seguranca, RBAC e auditoria", [
    fileCheck("src/pages/AdminRbacSimulator.tsx", "Simulador RBAC"),
    sourceCheck("rbac-readonly", "Simulador RBAC somente leitura", readFileSync("src/pages/AdminRbacSimulator.tsx", "utf8"), /Nenhuma alteracao e enviada ao backend/, "Nao altera permissoes reais."),
    sourceCheck("secrets", "Secrets mascaradas", reportSource, /Secrets seguem mascaradas/, "Relatorio preserva regra de nao expor credenciais."),
    sourceCheck("production-blocked", "Producao aberta bloqueada", reportSource, /PRODUCAO_ABERTA=BLOQUEADO_EXTERNO|Producao aberta segue `BLOQUEADO_EXTERNO`/, "Gates externos continuam bloqueados."),
  ]),
  buildPhase("phase-4-usability-operations", "Fase 4 - Usabilidade operacional", [
    fileCheck("src/hooks/useAdminPersistentState.ts", "Persistencia local de filtros"),
    sourceCheck("product-filters", "Produtos lembram filtros operacionais", readFileSync("src/pages/AdminProductsWorkspace.tsx", "utf8"), /admin:products:query/, "Busca/filtros principais persistem no navegador."),
    fileCheck("src/pages/AdminMyWorkspace.tsx", "Meu Workspace por perfil"),
    fileCheck("src/pages/AdminGoLiveReadiness.tsx", "Prontidao de Go-Live dedicada"),
  ]),
  buildPhase("phase-5-automation-docs", "Fase 5 - Automacao, testes e documentacao", [
    sourceCheck("script-menu-routes", "Script de rotas do menu", packageSource, /"admin:menu-routes:check": "tsx scripts\/check-admin-menu-routes\.ts"/, "Script npm registrado."),
    sourceCheck("script-phase-check", "Script fase-a-fase", packageSource, /"admin:enterprise:check": "tsx scripts\/check-admin-enterprise-phases\.ts"/, "Script npm registrado."),
    fileCheck("docs/admin/PLANO_EXECUCAO_CENTRAL_ADMIN_ENTERPRISE.md", "Plano de execucao"),
    fileCheck("docs/admin/RELATORIO_EVOLUCAO_CENTRAL_ADMIN_ENTERPRISE.md", "Relatorio de evolucao"),
    sourceCheck("validation-sequence", "Sequencia de validacoes", planSource, /admin:menu-routes:check[\s\S]*validate:continuity/, "Plano lista validacoes oficiais."),
  ]),
  buildPhase("phase-6-external-gates", "Fase 6 - Gates externos preservados", [
    { id: "external:fiscal", label: "Fiscal validado pelo contador", ok: false, external: true, detail: "Depende de contador e dados fiscais reais." },
    { id: "external:payment", label: "Mercado Pago e webhook reais", ok: false, external: true, detail: "Depende de credenciais e homologacao real." },
    { id: "external:freight", label: "Frete real homologado", ok: false, external: true, detail: "Depende de transportadora/gateway real." },
    { id: "external:evidence", label: "Evidencias operacionais reais", ok: false, external: true, detail: "Depende de execucao com equipe real." },
  ]),
];

const failedInternalChecks = phases.flatMap((phase) => phase.checks.filter((check) => !check.ok && !check.external).map((check) => `${phase.id}:${check.id}`));
const externalBlockers = phases.flatMap((phase) => phase.checks.filter((check) => !check.ok && check.external).map((check) => `${check.label}: ${check.detail}`));
const report = {
  ok: failedInternalChecks.length === 0,
  generated_at: new Date().toISOString(),
  phases,
  failed_internal_checks: failedInternalChecks,
  external_blockers: externalBlockers,
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  phases: report.phases.map((phase) => ({ id: phase.id, status: phase.status })),
  failed_internal_checks: report.failed_internal_checks,
  external_blockers: report.external_blockers.length,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
