import { readFileSync } from "node:fs";

type Check = { id: string; ok: boolean; detail: string };

function read(path: string) {
  return readFileSync(path, "utf8");
}

const model = read("server/admin-management.ts");
const server = read("server/index.ts");
const page = read("src/pages/AdminManagementReports.tsx");

const forbiddenSecretPatterns = [/ACCESS_TOKEN/i, /SECRET_KEY/i, /PRIVATE_KEY/i, /password_hash/i];

const checks: Check[] = [
  {
    id: "reports_endpoint",
    ok: server.includes('app.get("/api/admin/management/reports"') && server.includes("buildAdminManagementReports"),
    detail: "Relatorios gerenciais precisam ter endpoint dedicado.",
  },
  {
    id: "reports_markdown_export",
    ok: server.includes("format === \"md\"") && server.includes("renderAdminManagementReportMarkdown") && page.includes("Relatorio MD"),
    detail: "Relatorio semanal precisa exportar Markdown.",
  },
  {
    id: "reports_no_secret_terms",
    ok: !forbiddenSecretPatterns.some((pattern) => pattern.test(model.slice(model.indexOf("export function buildAdminManagementReports")))),
    detail: "Relatorios gerenciais nao devem expor secrets.",
  },
  {
    id: "reports_preserve_external_boundary",
    ok: model.includes("BLOQUEADO_EXTERNO") && model.includes("external_blockers"),
    detail: "Relatorios precisam manter bloqueios externos visiveis.",
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
