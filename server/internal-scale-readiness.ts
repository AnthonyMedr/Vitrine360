import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getCatalogPublicationIssues } from "./catalog-staging";
import type { DatabaseShape } from "./db";
import { getPermissionProfiles } from "./admin-permissions";
import { getMobileQaReadiness } from "./mobile-qa-readiness";
import { getOperationReadinessReport } from "./operation-readiness";
import { getAdminFiscalReadiness } from "./read-models";

type InternalScaleSeverity = "blocker" | "warning" | "ok";
type InternalScaleArea =
  | "admin"
  | "rbac"
  | "orders"
  | "catalog"
  | "mobile"
  | "qa_visual"
  | "docs"
  | "security"
  | "operations"
  | "external";

type InternalScaleCheck = {
  area: InternalScaleArea;
  item: string;
  status: InternalScaleSeverity;
  detail: string;
  evidence?: string;
  next_action?: string;
};

const requiredScreenshots = [
  "home-mobile.png",
  "products-mobile.png",
  "product-mobile.png",
  "cart-mobile.png",
  "checkout-mobile.png",
  "order-confirmed-mobile.png",
  "tracking-mobile.png",
  "contact-mobile.png",
  "admin-dashboard-desktop.png",
  "admin-readiness-tablet.png",
];

const requiredDocs = [
  "docs/QA_TESTING_GUIDE.md",
  "docs/OPERATIONS_RUNBOOK.md",
  "docs/ECOMMERCE_FLOWS_MAP.md",
  "docs/ADMIN_GUIDE.md",
  "docs/PERFORMANCE_GUIDE.md",
  "docs/SECURITY_GUIDE.md",
  "docs/reports/RELATORIO_FINAL_EVOLUCAO_ECOMMERCE_LOJAO_DO_PVC.md",
];

function readText(filePath: string) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function ok(area: InternalScaleArea, item: string, detail: string, evidence?: string): InternalScaleCheck {
  return { area, item, status: "ok", detail, evidence };
}

function warning(area: InternalScaleArea, item: string, detail: string, next_action?: string): InternalScaleCheck {
  return { area, item, status: "warning", detail, next_action };
}

function blocker(area: InternalScaleArea, item: string, detail: string, next_action?: string): InternalScaleCheck {
  return { area, item, status: "blocker", detail, next_action };
}

function hasAllMarkers(source: string, markers: string[]) {
  return markers.every((marker) => source.includes(marker));
}

function checkAdminCommandCenter(projectRoot: string): InternalScaleCheck[] {
  const executive = readText(path.join(projectRoot, "src/pages/AdminExecutive.tsx"));
  const orders = readText(path.join(projectRoot, "src/pages/AdminOrdersWorkspace.tsx"));
  const users = readText(path.join(projectRoot, "src/pages/AdminUsers.tsx"));
  const shell = readText(path.join(projectRoot, "src/components/admin/AdminWorkspaceShell.tsx"));

  const checks: InternalScaleCheck[] = [];

  const executiveMarkers = [
    "Central de comando",
    "Vendas, pedidos e operacao",
    "Integracoes, seguranca e go-live",
    "Painel de decisao 24h",
    "Centro de acoes",
    "Matriz de responsaveis",
  ];
  checks.push(
    hasAllMarkers(executive, executiveMarkers)
      ? ok("admin", "central_command", "Central de Comando cobre vendas, operacao, integracoes, go-live, acoes e responsaveis.", "src/pages/AdminExecutive.tsx")
      : blocker("admin", "central_command", "Central de Comando perdeu secoes executivas obrigatorias.", "Repor secoes de vendas, operacao, integracoes, painel 24h, centro de acoes e matriz de responsaveis."),
  );

  const orderMarkers = ["Spool operacional: separacao, conferencia e faturamento", "SLA vencido", "Faturamento local", "Separacao e expedicao"];
  checks.push(
    hasAllMarkers(orders, orderMarkers)
      ? ok("orders", "order_spool", "Spool de pedidos cobre separacao, conferencia, faturamento local e SLA.", "src/pages/AdminOrdersWorkspace.tsx")
      : blocker("orders", "order_spool", "Spool operacional nao apresenta todas as etapas necessarias.", "Repor etapas de faturamento local, separacao, expedicao e SLA no workspace de pedidos."),
  );

  const userMarkers = ["Usuarios, perfis e hierarquia", "Matriz operacional por perfil", "users.manage", "Hash/salt nunca retornam ao frontend"];
  checks.push(
    hasAllMarkers(users, userMarkers)
      ? ok("rbac", "users_profiles_ui", "Tela de usuarios/perfis mostra hierarquia, matriz operacional e seguranca de credenciais.", "src/pages/AdminUsers.tsx")
      : blocker("rbac", "users_profiles_ui", "Tela de usuarios/perfis perdeu controles essenciais.", "Repor criacao de usuarios, matriz por perfil, RBAC e avisos de hash/salt."),
  );

  checks.push(
    shell.includes("Navegacao administrativa") && shell.includes("Carregando permissoes do perfil")
      ? ok("admin", "shared_sidebar", "Sidebar administrativa compartilhada permanece aplicada aos modulos.", "src/components/admin/AdminWorkspaceShell.tsx")
      : blocker("admin", "shared_sidebar", "Sidebar administrativa compartilhada esta incompleta.", "Restaurar AdminWorkspaceShell com navegacao e carregamento de permissoes."),
  );

  return checks;
}

function checkRbacProfiles(): InternalScaleCheck[] {
  const profiles = getPermissionProfiles();
  const requiredProfiles = [
    "admin_master",
    "gerente_ecommerce",
    "gestor_comercial",
    "operador_pedidos",
    "fiscal_contador",
    "supervisor_loja",
    "caixa_financeiro",
    "separacao_expedicao",
    "catalogo_conteudo",
    "atendimento_suporte",
  ];

  const missing = requiredProfiles.filter((slug) => !profiles.some((profile) => profile.slug === slug && profile.isActive));
  const checks: InternalScaleCheck[] = [];
  checks.push(
    missing.length === 0
      ? ok("rbac", "official_profiles", "Perfis oficiais de operacao estao ativos.", `${profiles.length} perfis cadastrados`)
      : blocker("rbac", "official_profiles", `Perfis oficiais ausentes ou inativos: ${missing.join(", ")}.`, "Reativar/criar perfis oficiais antes da homologacao operacional."),
  );

  const adminMaster = profiles.find((profile) => profile.permissions.includes("*"));
  checks.push(
    adminMaster
      ? ok("rbac", "admin_master_full", "Admin Master possui permissao total.")
      : blocker("rbac", "admin_master_full", "Admin Master nao possui permissao total.", "Restaurar permissao `*` no perfil admin_master."),
  );

  const sensitiveProfiles = profiles.filter((profile) => ["separacao_expedicao", "atendimento_suporte", "catalogo_conteudo"].includes(profile.slug));
  const unsafeSecretAccess = sensitiveProfiles.filter((profile) =>
    profile.modules.some((module) => module.key === "integrations" && module.access === "full"),
  );
  checks.push(
    unsafeSecretAccess.length === 0
      ? ok("rbac", "no_secret_access_for_operations", "Perfis operacionais nao possuem acesso full a integracoes/secrets.")
      : blocker("rbac", "no_secret_access_for_operations", `Perfis operacionais com acesso full indevido: ${unsafeSecretAccess.map((profile) => profile.slug).join(", ")}.`, "Remover acesso full a integracoes para perfis operacionais."),
  );

  return checks;
}

function checkCatalog(db: DatabaseShape): InternalScaleCheck[] {
  const scopedItems = db.catalogStaging.filter((item) => item.go_live_gate_status !== "deferred");
  const publicationBlockers = scopedItems.filter((item) =>
    getCatalogPublicationIssues(db, item).some((issue) => issue.severity === "blocker"),
  );

  return [
    publicationBlockers.length === 0
      ? ok("catalog", "publication_quality", "Catalogo staging do recorte atual nao possui blocker interno de publicacao.", `${scopedItems.length} itens no recorte`)
      : blocker("catalog", "publication_quality", `${publicationBlockers.length} itens do catalogo staging possuem blocker interno de publicacao.`, "Rodar npm run catalog:publication:check e corrigir cadastro/preco/imagem/estoque antes de campanha."),
  ];
}

function checkMobileAndVisual(projectRoot: string): InternalScaleCheck[] {
  const mobile = getMobileQaReadiness(projectRoot);
  const screenshotDir = path.join(projectRoot, "docs/reports/qa-visual-screenshots");
  const missingScreenshots = requiredScreenshots.filter((fileName) => !existsSync(path.join(screenshotDir, fileName)));

  const checks: InternalScaleCheck[] = [];
  checks.push(
    mobile.ok
      ? ok("mobile", "static_mobile_preflight", `QA mobile estatico passou em ${mobile.summary.ok}/${mobile.summary.flows} fluxos.`, "npm run qa:mobile:check")
      : blocker("mobile", "static_mobile_preflight", `QA mobile estatico tem ${mobile.summary.blockers} blocker(s).`, "Corrigir rotas/fontes responsivas e reexecutar npm run qa:mobile:check."),
  );

  checks.push(
    missingScreenshots.length === 0
      ? ok("qa_visual", "visual_screenshot_pack", "Pacote de screenshots visuais existe para fluxos publicos e admin.", "docs/reports/qa-visual-screenshots")
      : warning("qa_visual", "visual_screenshot_pack", `Faltam screenshots: ${missingScreenshots.join(", ")}.`, "Executar npm run qa:visual:screenshots com app rodando e revisar PNGs antes de trafego pago."),
  );

  return checks;
}

function checkDocs(projectRoot: string): InternalScaleCheck[] {
  const missingDocs = requiredDocs.filter((filePath) => !existsSync(path.join(projectRoot, filePath)));
  const flowMap = readText(path.join(projectRoot, "docs/ECOMMERCE_FLOWS_MAP.md"));
  const qaGuide = readText(path.join(projectRoot, "docs/QA_TESTING_GUIDE.md"));

  const checks: InternalScaleCheck[] = [];
  checks.push(
    missingDocs.length === 0
      ? ok("docs", "required_docs", "Documentos essenciais de operacao, QA, admin, seguranca e relatorio final existem.")
      : blocker("docs", "required_docs", `Documentos essenciais ausentes: ${missingDocs.join(", ")}.`, "Criar/atualizar documentos antes da homologacao."),
  );

  checks.push(
    flowMap.includes("Fluxo de go-live") && flowMap.includes("Fluxo administrativo e RBAC")
      ? ok("docs", "flow_map", "Mapa de fluxos cobre go-live, RBAC, cliente, catalogo, pedido, fiscal e integracoes.", "docs/ECOMMERCE_FLOWS_MAP.md")
      : blocker("docs", "flow_map", "Mapa de fluxos nao cobre go-live/RBAC de forma suficiente.", "Atualizar docs/ECOMMERCE_FLOWS_MAP.md."),
  );

  checks.push(
    qaGuide.includes("Checklist manual do Admin") && qaGuide.includes("qa:visual:screenshots")
      ? ok("docs", "qa_manual_script", "Guia de QA possui checklist manual do admin e pacote visual.", "docs/QA_TESTING_GUIDE.md")
      : warning("docs", "qa_manual_script", "Guia de QA precisa reforcar checklist manual ou screenshots.", "Atualizar docs/QA_TESTING_GUIDE.md."),
  );

  return checks;
}

function checkOperations(db: DatabaseShape): InternalScaleCheck[] {
  const operations = getOperationReadinessReport(db);
  if (operations.blockers > 0) {
    return [
      blocker("operations", "operation_readiness", `${operations.blockers} blocker(s) operacionais ativos.`, "Tratar no painel e reexecutar npm run operations:check."),
    ];
  }
  if (operations.warnings > 0) {
    return [
      warning("operations", "operation_readiness", `${operations.warnings} warning(s) operacionais ativos.`, "Tratar antes de campanha forte ou venda real."),
    ];
  }
  return [ok("operations", "operation_readiness", "Operacao local sem blockers ou warnings.", "npm run operations:check")];
}

function checkExternalContext(db: DatabaseShape): InternalScaleCheck[] {
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const checks: InternalScaleCheck[] = [];
  checks.push(
    fiscal.ready
      ? ok("external", "fiscal_minimal", "Fiscal minimo nao bloqueia o recorte atual.")
      : warning("external", "fiscal_minimal", `${fiscal.metrics.pending_fiscal_profiles} perfis fiscais dependem de NCM/tax_code do contador.`, "BLOQUEADO EXTERNO - CONTADOR/DADOS FISCAIS."),
  );
  return checks;
}

export function getInternalScaleReadiness(db: DatabaseShape, projectRoot = process.cwd()) {
  const checks = [
    ...checkAdminCommandCenter(projectRoot),
    ...checkRbacProfiles(),
    ...checkCatalog(db),
    ...checkMobileAndVisual(projectRoot),
    ...checkDocs(projectRoot),
    ...checkOperations(db),
    ...checkExternalContext(db),
  ];

  const internalChecks = checks.filter((check) => check.area !== "external");
  const blockers = internalChecks.filter((check) => check.status === "blocker");
  const warnings = internalChecks.filter((check) => check.status === "warning");
  const externalWarnings = checks.filter((check) => check.area === "external" && check.status !== "ok");

  return {
    generated_at: new Date().toISOString(),
    internal_ready: blockers.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
    external_warnings: externalWarnings.length,
    checks,
    next_steps:
      blockers.length === 0
        ? [
            "Manter scale:internal:check no pacote de homologacao.",
            "Executar QA visual humano antes de campanha forte.",
            "Resolver bloqueios externos para avancar para soft launch regional.",
          ]
        : [
            "Corrigir blockers internos listados.",
            "Reexecutar npm run scale:internal:check.",
            "Somente depois seguir para release/go-live.",
          ],
  };
}

function row(values: Array<string | number | boolean | null | undefined>) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function renderInternalScaleReadinessMarkdown(report: ReturnType<typeof getInternalScaleReadiness>) {
  return [
    "# Readiness Interna de Escala",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `Status interno: **${report.internal_ready ? "PASSOU" : "FALHOU"}**`,
    "",
    "Este gate avalia somente pendencias internas de produto, Admin, RBAC, catalogo, operacao, mobile, QA visual e documentacao. Bloqueios de contador, credenciais, Postgres, Redis, dominio/SSL e providers externos aparecem como contexto, mas nao contam como pendencia programavel interna.",
    "",
    row(["Area", "Item", "Status", "Detalhe", "Proxima acao"]),
    row(["---", "---", "---", "---", "---"]),
    ...report.checks.map((check) => row([check.area, check.item, check.status.toUpperCase(), check.detail, check.next_action ?? check.evidence ?? "-"])),
    "",
    "## Resumo",
    "",
    `- Blockers internos: ${report.blockers}`,
    `- Warnings internos: ${report.warnings}`,
    `- Avisos externos/contexto: ${report.external_warnings}`,
    "",
    "## Proximos passos",
    "",
    ...report.next_steps.map((step) => `- ${step}`),
    "",
  ].join("\n");
}

export function writeInternalScaleReadinessReport(db: DatabaseShape, projectRoot = process.cwd()) {
  const report = getInternalScaleReadiness(db, projectRoot);
  const reportsDir = path.join(projectRoot, "docs", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const markdownPath = path.join(reportsDir, "INTERNAL_SCALE_READINESS.md");
  const jsonPath = path.join(reportsDir, "internal-scale-readiness.json");
  writeFileSync(markdownPath, renderInternalScaleReadinessMarkdown(report), "utf8");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, markdownPath, jsonPath };
}
