import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type AdoptionItem = {
  id: string;
  title: string;
  owner: string;
  route: string;
  evidence: string;
  status: "ready_to_execute" | "requires_real_execution" | "blocked_external" | "monitor";
  cadence: string;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

const items: AdoptionItem[] = [
  {
    id: "daily-admin-routine",
    title: "Abrir /admin/hoje como primeira tela da operacao",
    owner: "Gerente Ecommerce",
    route: "/admin/hoje",
    evidence: "Registro diario das prioridades revisadas e tarefas atualizadas.",
    status: "ready_to_execute",
    cadence: "Diaria",
  },
  {
    id: "task-accountability",
    title: "Usar /admin/tarefas como fonte oficial de pendencias",
    owner: "Gerente Ecommerce",
    route: "/admin/tarefas",
    evidence: "Todas as pendencias relevantes com responsavel, prazo, status e evidencia.",
    status: "ready_to_execute",
    cadence: "Diaria",
  },
  {
    id: "assisted-team-training",
    title: "Executar treinamento assistido com a equipe",
    owner: "Gerente Ecommerce",
    route: "/admin/documentacao",
    evidence: "Lista de presenca, roteiro executado, duvidas e aceite operacional.",
    status: "requires_real_execution",
    cadence: "Uma vez antes do soft launch e reciclagem mensal",
  },
  {
    id: "real-operational-homologation",
    title: "Executar homologacao operacional real",
    owner: "Admin Master / Gerente Ecommerce",
    route: "/admin/go-live",
    evidence: "Pedido, pagamento, separacao, entrega/cancelamento, fiscal e atendimento validados.",
    status: "requires_real_execution",
    cadence: "Antes de soft launch e antes de producao aberta",
  },
  {
    id: "weekly-management-review",
    title: "Revisao semanal com relatorio gerencial",
    owner: "Direcao / Gerente Ecommerce",
    route: "/admin/relatorios-gerenciais",
    evidence: "Relatorio Markdown exportado, decisoes registradas e tarefas atualizadas.",
    status: "ready_to_execute",
    cadence: "Semanal",
  },
  {
    id: "external-gates",
    title: "Resolver fiscal, pagamento, webhook e frete reais",
    owner: "Direcao / Contador / DevOps",
    route: "/admin/integracoes",
    evidence: "Credenciais reais, validacao fiscal, testes de conexao e comprovantes de homologacao.",
    status: "blocked_external",
    cadence: "Ate conclusao dos fornecedores e contador",
  },
  {
    id: "production-performance-observation",
    title: "Monitorar performance com dados reais",
    owner: "Admin Master / DevOps",
    route: "/admin/score-gerencial",
    evidence: "Budget, Core Web Vitals e relatorio de uso real revisados.",
    status: "monitor",
    cadence: "Semanal apos ambiente real",
  },
];

function renderMarkdown(generatedAt: string) {
  const lines = [
    "# Pacote de Adocao Operacional - Central Admin",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "## Objetivo",
    "",
    "Transformar a Central Admin em rotina real de gestao, sem declarar como pronta nenhuma etapa que dependa de execucao da equipe, contador, gateway, webhook, frete ou evidencias reais.",
    "",
    "## Itens De Execucao",
    "",
    "| Item | Responsavel | Cadencia | Status | Rota | Evidencia |",
    "| --- | --- | --- | --- | --- | --- |",
    ...items.map((item) => `| ${item.title} | ${item.owner} | ${item.cadence} | ${item.status} | \`${item.route}\` | ${item.evidence} |`),
    "",
    "## Roteiro Da Primeira Semana",
    "",
    "1. Dia 1: abrir `/admin/hoje`, revisar prioridades e atribuir responsaveis.",
    "2. Dia 1: converter alertas criticos em tarefas quando ainda nao houver tarefa existente.",
    "3. Dia 2: executar treinamento assistido com a equipe e registrar evidencia.",
    "4. Dia 3: rodar homologacao operacional com pedido, separacao, atendimento e cancelamento.",
    "5. Dia 4: revisar integracoes/fiscal/frete e anexar bloqueios externos com evidencias.",
    "6. Dia 5: exportar relatorio gerencial Markdown e validar score com a direcao.",
    "",
    "## Guardrail",
    "",
    "Producao aberta permanece `BLOQUEADO_EXTERNO` ate a conclusao real de fiscal, pagamento, webhook, frete, treinamento e evidencias operacionais.",
  ];
  return `${lines.join("\n")}\n`;
}

function renderCsv() {
  const rows = [
    ["id", "title", "owner", "route", "status", "cadence", "evidence"],
    ...items.map((item) => [item.id, item.title, item.owner, item.route, item.status, item.cadence, item.evidence]),
  ];
  return `${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")}\n`;
}

const generatedAt = new Date().toISOString();
const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-operational-adoption-pack-latest").replace(/\.(json|md|csv)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;
const report = {
  generated_at: generatedAt,
  ok: true,
  production_open: "BLOQUEADO_EXTERNO",
  programmable_pending: 0,
  real_execution_required: items.filter((item) => item.status === "requires_real_execution").length,
  external_blockers: items.filter((item) => item.status === "blocked_external").length,
  items,
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(generatedAt), "utf8");
writeFileSync(csvPath, renderCsv(), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      production_open: report.production_open,
      programmable_pending: report.programmable_pending,
      real_execution_required: report.real_execution_required,
      external_blockers: report.external_blockers,
      jsonPath,
      mdPath,
      csvPath,
    },
    null,
    2,
  ),
);
