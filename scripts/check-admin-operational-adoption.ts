import { existsSync, readFileSync } from "node:fs";

type Check = {
  id: string;
  ok: boolean;
  detail: string;
};

function read(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const management = read("server/admin-management.ts");
const plan = read("docs/admin/PLANO_ADOCAO_OPERACIONAL_ADMIN.md");
const gerencialPlan = read("docs/admin/PLANO_ACAO_EVOLUCAO_GERENCIAL_ADMIN.md");
const pkg = read("package.json");
const adoptionPack = read("scripts/export-admin-operational-adoption-pack.ts");

const checks: Check[] = [
  {
    id: "adoption_pack_script",
    ok: adoptionPack.includes("Pacote de Adocao Operacional") && adoptionPack.includes("production_open") && adoptionPack.includes("BLOQUEADO_EXTERNO"),
    detail: "Pacote de adocao operacional precisa existir e preservar bloqueio produtivo externo.",
  },
  {
    id: "adoption_scripts_registered",
    ok: pkg.includes('"admin:adoption:pack"') && pkg.includes('"admin:adoption:check"'),
    detail: "Scripts de pacote e check de adocao precisam estar registrados.",
  },
  {
    id: "management_training_tasks",
    ok: management.includes("management-assisted-training") && management.includes("management-operational-homologation"),
    detail: "Recomendacoes de treinamento e homologacao precisam aparecer como tarefas gerenciais derivadas.",
  },
  {
    id: "adoption_doc_exists",
    ok: plan.includes("Rotina Diaria") && plan.includes("Treinamento Assistido") && plan.includes("Homologacao Operacional") && plan.includes("BLOQUEADO_EXTERNO"),
    detail: "Documento de adocao precisa orientar rotina, treinamento, homologacao e guardrails.",
  },
  {
    id: "management_plan_records_final_adoption",
    ok: gerencialPlan.includes("Adocao Operacional Executavel") && gerencialPlan.includes("admin:adoption:pack"),
    detail: "Plano gerencial precisa registrar a execucao das recomendacoes.",
  },
];

const failed = checks.filter((check) => !check.ok);
const report = {
  generated_at: new Date().toISOString(),
  ok: failed.length === 0,
  production_open: "BLOQUEADO_EXTERNO",
  programmable_pending: failed.length,
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
