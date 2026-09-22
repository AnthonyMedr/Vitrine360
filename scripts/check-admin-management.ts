import { readFileSync } from "node:fs";

type Check = { id: string; ok: boolean; detail: string };

function read(path: string) {
  return readFileSync(path, "utf8");
}

const app = read("src/App.tsx");
const shell = read("src/components/admin/AdminWorkspaceShell.tsx");
const server = read("server/index.ts");
const management = read("server/admin-management.ts");
const plan = read("docs/admin/PLANO_ACAO_EVOLUCAO_GERENCIAL_ADMIN.md");
const pkg = read("package.json");

const requiredRoutes = [
  "/admin/hoje",
  "/admin/tarefas",
  "/admin/kanban",
  "/admin/cockpit",
  "/admin/score-gerencial",
  "/admin/relatorios-gerenciais",
];

const requiredEndpoints = [
  "/api/admin/management/daily",
  "/api/admin/management/tasks",
  "/api/admin/management/tasks/:id",
  "/api/admin/management/tasks/:id/events",
  "/api/admin/management/kanban",
  "/api/admin/management/cockpit",
  "/api/admin/management/score",
  "/api/admin/management/reports",
];

const checks: Check[] = [
  {
    id: "routes_exist",
    ok: requiredRoutes.every((route) => app.includes(`path="${route}"`)),
    detail: "Rotas gerenciais precisam existir no App.",
  },
  {
    id: "menu_entries_exist",
    ok: requiredRoutes.every((route) => shell.includes(`href: "${route}"`)),
    detail: "Menu Admin precisa expor as rotas gerenciais.",
  },
  {
    id: "endpoints_exist",
    ok: requiredEndpoints.every((endpoint) => server.includes(endpoint)),
    detail: "APIs de gestao precisam existir no backend.",
  },
  {
    id: "tasks_have_management_fields",
    ok: ["owner", "due_at", "status", "evidence_required", "external_blocker", "recommended_action", "source", "note"].every((field) => management.includes(field)),
    detail: "Tarefas gerenciais precisam ter responsavel, prazo, status, evidencia, bloqueio externo e acao.",
  },
  {
    id: "tasks_are_persistent_and_audited",
    ok:
      management.includes("upsertAdminManagementTask") &&
      management.includes("getAdminManagementTaskEvents") &&
      management.includes("createAuditEvent") &&
      server.includes('app.post("/api/admin/management/tasks"') &&
      server.includes('app.patch("/api/admin/management/tasks/:id"') &&
      server.includes('app.get("/api/admin/management/tasks/:id/events"'),
    detail: "Tarefas gerenciais precisam permitir criacao, edicao, historico e auditoria.",
  },
  {
    id: "score_preserves_external_blocker",
    ok: management.includes('production_open: "BLOQUEADO_EXTERNO"') && management.includes("external_blocker"),
    detail: "Score gerencial nao pode liberar producao aberta indevidamente.",
  },
  {
    id: "plan_documents_management_phase",
    ok: plan.includes("Central de Rotina Diaria") && plan.includes("Gestao de Tarefas Internas") && plan.includes("Score Gerencial"),
    detail: "Plano de acao gerencial precisa documentar a fase executada.",
  },
  {
    id: "dedicated_checks_exist",
    ok: ["admin:tasks:check", "admin:score:check", "admin:reports:check"].every((script) => pkg.includes(`"${script}"`)),
    detail: "Plano gerencial exige checks dedicados para tarefas, score e relatorios.",
  },
];

const failed = checks.filter((check) => !check.ok);
const report = {
  generated_at: new Date().toISOString(),
  ok: failed.length === 0,
  production_open: "BLOQUEADO_EXTERNO",
  routes: requiredRoutes.length,
  endpoints: requiredEndpoints.length,
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
