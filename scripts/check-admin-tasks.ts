import { readFileSync } from "node:fs";

type Check = { id: string; ok: boolean; detail: string };

function read(path: string) {
  return readFileSync(path, "utf8");
}

const server = read("server/index.ts");
const db = read("server/db.ts");
const model = read("server/admin-management.ts");
const page = read("src/pages/AdminManagementTasks.tsx");
const executive = read("src/pages/AdminExecutive.tsx");

const checks: Check[] = [
  {
    id: "task_mutation_endpoints",
    ok: server.includes('app.post("/api/admin/management/tasks"') && server.includes('app.patch("/api/admin/management/tasks/:id"') && server.includes('app.get("/api/admin/management/tasks/:id/events"'),
    detail: "Tarefas precisam ter criacao, edicao e historico.",
  },
  {
    id: "task_persistence_collections",
    ok: db.includes("adminManagementTaskOverrides") && db.includes("adminManagementTaskEvents"),
    detail: "Banco precisa persistir overrides e eventos de tarefas.",
  },
  {
    id: "task_audit",
    ok: model.includes("createAuditEvent") && model.includes("admin.management_task."),
    detail: "Mudancas de tarefas precisam gerar auditoria.",
  },
  {
    id: "task_ui_operable",
    ok: page.includes("Nova tarefa") && page.includes("Salvar") && page.includes("apiFetch") && page.includes("PATCH") && page.includes("evidence_url"),
    detail: "Tela de tarefas precisa permitir operacao diaria.",
  },
  {
    id: "task_evidence_link",
    ok: model.includes("evidence_url") && db.includes("evidence_url"),
    detail: "Tarefas precisam aceitar link/documento de evidencia.",
  },
  {
    id: "external_evidence_guard",
    ok: model.includes("Bloqueio externo exige evidencia antes de concluir"),
    detail: "Bloqueio externo exige evidencia para conclusao operacional.",
  },
  {
    id: "executive_alert_to_task",
    ok: executive.includes("convertAlertToTask") && executive.includes("Criar tarefa") && executive.includes("/api/admin/management/tasks"),
    detail: "Alertas executivos criticos precisam virar tarefa gerencial acionavel.",
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
