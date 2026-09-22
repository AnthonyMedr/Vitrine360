import { readFileSync } from "node:fs";

type Check = {
  id: string;
  ok: boolean;
  detail: string;
};

function read(path: string) {
  return readFileSync(path, "utf8");
}

const shell = read("src/components/admin/AdminWorkspaceShell.tsx");
const app = read("src/App.tsx");
const auth = read("src/pages/Auth.tsx");
const serverConfig = read("server/config.ts");
const serverIndex = read("server/index.ts");
const home = read("src/pages/AdminTeamHome.tsx");
const doc = read("docs/gamel/ADMIN_PHASE1.md");
const pkg = read("package.json");

const checks: Check[] = [
  {
    id: "simple_advanced_mode",
    ok: shell.includes('type AdminNavigationMode = "simple" | "advanced"') && shell.includes("Modo simples") && shell.includes("Modo avancado"),
    detail: "Admin precisa ter Modo Simples e Modo Avancado.",
  },
  {
    id: "simple_mode_is_default",
    ok: shell.includes('useState<AdminNavigationMode>("simple")') && shell.includes('return value === "advanced" ? "advanced" : "simple"'),
    detail: "Modo Simples precisa ser o padrao para reduzir confusao.",
  },
  {
    id: "technical_items_are_advanced",
    ok:
      shell.includes('label: "Produtos"') &&
      shell.includes('label: "Categorias / Catalogo"') &&
      shell.includes('label: "Midia / Imagens"') &&
      shell.includes('label: "Orcamentos"') &&
      shell.includes('label: "Hoje"') &&
      shell.includes('label: "Tarefas"') &&
      shell.includes('label: "Relatorios gerenciais"') &&
      (shell.match(/advanced: true/g)?.length ?? 0) >= 6 &&
      shell.includes('label: "Go-live / Homologacao"') &&
      !shell.includes("Pedidos pagos") &&
      !shell.includes("Checkout") &&
      !shell.includes("WMS") &&
      !shell.includes("Fiscal"),
    detail: "Modo simples precisa expor somente os modulos comerciais da GAMEL Fase 1.",
  },
  {
    id: "quick_starts_exist",
    ok: shell.includes("Comecos rapidos") && shell.includes("Use como rotina diaria") && shell.includes("Comece por Hoje"),
    detail: "Modo Simples precisa orientar onde comecar.",
  },
  {
    id: "simple_home_route",
    ok:
      app.includes('lazy(() => import("./pages/AdminTeamHome"))') &&
      app.includes('path="/admin" element={<AdminTeamHome />}') &&
      app.includes('path="/admin/executivo" element={<AdminExecutive />}'),
    detail: "A entrada /admin precisa ser simples e o dashboard executivo deve ficar em /admin/executivo.",
  },
  {
    id: "simple_home_content",
    ok:
      home.includes("Inicio da equipe") &&
      home.includes("O que fazer agora") &&
      home.includes("Prioridades de hoje") &&
      home.includes("Quando chamar o Administrador"),
    detail: "Tela inicial simples precisa guiar a equipe com prioridades, atalhos e escalonamento.",
  },
  {
    id: "simple_ux_doc_exists",
    ok: doc.includes("Painel administrativo da Fase 1") && doc.includes("Modulos ativos") && doc.includes("Perfis oficiais") && doc.includes("Modulos preservados fora da operacao"),
    detail: "Documento oficial precisa explicar a experiencia administrativa da GAMEL Fase 1.",
  },
  {
    id: "public_signup_disabled",
    ok:
      !auth.includes("Criar conta") &&
      auth.includes("Usuarios sao criados pelo super admin") &&
      serverConfig.includes("publicSignupEnabled") &&
      serverIndex.includes("Cadastro publico desativado"),
    detail: "Acesso administrativo nao pode exibir criacao publica de conta; usuarios devem ser criados pelo super admin.",
  },
  {
    id: "script_registered",
    ok: pkg.includes('"admin:simple-ux:check"'),
    detail: "Check de simplificacao precisa estar registrado no package.json.",
  },
];

const failed = checks.filter((check) => !check.ok);
const report = {
  generated_at: new Date().toISOString(),
  ok: failed.length === 0,
  production_open: "BLOQUEADO_EXTERNO",
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
