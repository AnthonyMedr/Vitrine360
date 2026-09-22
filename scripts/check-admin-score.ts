import { readFileSync } from "node:fs";

type Check = { id: string; ok: boolean; detail: string };

function read(path: string) {
  return readFileSync(path, "utf8");
}

const model = read("server/admin-management.ts");
const page = read("src/pages/AdminManagementScore.tsx");
const server = read("server/index.ts");

const checks: Check[] = [
  {
    id: "score_endpoint",
    ok: server.includes('app.get("/api/admin/management/score"'),
    detail: "Score gerencial precisa ter endpoint dedicado.",
  },
  {
    id: "score_preserves_external_blocker",
    ok: model.includes('production_open: "BLOQUEADO_EXTERNO"') && model.includes("external_blocker"),
    detail: "Score nao pode liberar producao aberta.",
  },
  {
    id: "score_has_area_justification",
    ok: model.includes("justification") && model.includes("action") && model.includes("trend"),
    detail: "Score precisa explicar nota, tendencia e acao.",
  },
  {
    id: "score_ui_exists",
    ok: page.includes("/api/admin/management/score") && page.includes("WorkspaceMetric"),
    detail: "Tela do score precisa consumir o endpoint gerencial.",
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
