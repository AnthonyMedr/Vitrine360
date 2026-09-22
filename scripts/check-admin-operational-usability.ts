import { existsSync, readFileSync } from "node:fs";

const requiredDocs = [
  "docs/gamel/README.md",
  "docs/gamel/ADMIN_PHASE1.md",
  "docs/gamel/GO_LIVE_HOMOLOGATION_CHECKLIST.md",
];

const requiredSources = [
  "src/pages/AdminTeamHome.tsx",
  "src/pages/AdminProductsWorkspace.tsx",
  "src/pages/AdminCatalogWorkspace.tsx",
  "src/pages/AdminMediaLibrary.tsx",
  "src/pages/AdminBannersShowcases.tsx",
  "src/pages/AdminOperations.tsx",
  "src/pages/AdminUsers.tsx",
  "src/pages/AdminGoLiveReadiness.tsx",
  "src/components/admin/AdminWorkspaceShell.tsx",
  "src/components/admin/AdminPrimitives.tsx",
];

const missingDocs = requiredDocs.filter((path) => !existsSync(path));
const missingSources = requiredSources.filter((path) => !existsSync(path));

function read(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const home = read("src/pages/AdminTeamHome.tsx");
const products = read("src/pages/AdminProductsWorkspace.tsx");
const catalog = read("src/pages/AdminCatalogWorkspace.tsx");
const media = read("src/pages/AdminMediaLibrary.tsx");
const banners = read("src/pages/AdminBannersShowcases.tsx");
const operations = read("src/pages/AdminOperations.tsx");
const users = read("src/pages/AdminUsers.tsx");
const goLive = read("src/pages/AdminGoLiveReadiness.tsx");
const shell = read("src/components/admin/AdminWorkspaceShell.tsx");
const readme = read("docs/gamel/README.md");
const adminDoc = read("docs/gamel/ADMIN_PHASE1.md");
const goLiveDoc = read("docs/gamel/GO_LIVE_HOMOLOGATION_CHECKLIST.md");

const checks = [
  { key: "dashboard_fase1", ok: home.includes("Inicio da equipe") && home.includes("Produtos ativos") && home.includes("Orcamentos novos") && home.includes("Imagens suspeitas") },
  { key: "produtos_fase1", ok: products.includes("rascunho") && products.includes("em revisao") && products.includes("publicado") && products.includes("arquivado") },
  { key: "catalogo_fase1", ok: catalog.includes("Ripados internos e externos") && catalog.includes("Drywall e Acessórios") },
  { key: "midia_fase1", ok: media.includes("Midia e revisao visual") && media.includes("Fila de revisao visual") && media.includes("duplicadas") && media.includes("sem imagem") },
  { key: "banners_fase1", ok: banners.includes("Ver produtos") && banners.includes("Pedir orcamento") && banners.includes("Falar no WhatsApp") },
  { key: "orcamentos_leads", ok: operations.includes("/api/admin/quote-requests") && operations.includes("Solicitacoes recebidas pelo site") && operations.includes("Novo, Em atendimento, Respondido") },
  { key: "perfis_fase1", ok: users.includes("Administrador") && users.includes("Comercial") && users.includes("Catalogo e conteudo") && users.includes("Marketing") && users.includes("Visualizacao/Diretoria") },
  { key: "golive_fase1", ok: goLive.includes("Orcamento online") && goLive.includes("WhatsApp") && goLive.includes("Registro no admin") },
  { key: "sidebar_fase1", ok: shell.includes('label: "Produtos"') && shell.includes('label: "Midia / Imagens"') && shell.includes('label: "Orcamentos"') && shell.includes('label: "Go-live / Homologacao"') },
  { key: "docs_fase1", ok: readme.includes("Fase 1") && adminDoc.includes("Modulos ativos") && goLiveDoc.includes("Home -> Catalogo -> Produto -> Orcamento -> WhatsApp -> Admin") },
];

const blockers = [
  ...missingDocs.map((path) => `documento_ausente:${path}`),
  ...missingSources.map((path) => `fonte_ausente:${path}`),
  ...checks.filter((check) => !check.ok).map((check) => `check_ausente:${check.key}`),
];

const output = {
  ADMIN_OPERATIONAL_USABILITY_READY: blockers.length === 0,
  ADMIN_OPERATIONAL_ROUTINE_DOCUMENTED: missingDocs.length === 0,
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  CURRENT_PHASE: "GAMEL_FASE_1",
  NEXT_PHASE: "FUTURE_ECOMMERCE_ARCHIVED",
  checks,
  blockers,
  warnings: [
    "treinamento_operacional_precisa_validacao_com_equipe",
    "credenciais_reais_de_producao_seguem_bloqueios_externos",
  ],
  next_step: "HOMOLOGACAO_VISUAL+TESTE_ORCAMENTO_WHATSAPP+TREINAMENTO_OPERACIONAL",
};

console.log(JSON.stringify(output, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
