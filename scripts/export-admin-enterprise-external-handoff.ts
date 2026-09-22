import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type HandoffStatus = "BLOQUEADO_EXTERNO" | "PENDENTE_EXECUCAO_REAL" | "MONITORAR";

type HandoffItem = {
  id: string;
  area: string;
  owner: string;
  status: HandoffStatus;
  severity: "critical" | "high" | "medium";
  admin_route: string;
  required_input: string;
  evidence_needed: string;
  validation_command: string;
  guardrail: string;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function readJsonIfExists<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function buildMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Handoff Externo - Central Admin Enterprise");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- Resultado interno: \`${report.internal_admin_ready ? "PRONTO" : "REVISAR"}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- Bloqueios externos: \`${report.summary.blocked_external}\``);
  lines.push(`- Pendencias de execucao real: \`${report.summary.pending_real_execution}\``);
  lines.push("");
  lines.push("## Itens de Handoff");
  lines.push("");
  lines.push("| Area | Responsavel | Status | Severidade | Rota Admin | Insumo necessario | Evidencia | Validacao |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const item of report.items) {
    lines.push(
      `| ${item.area} | ${item.owner} | \`${item.status}\` | ${item.severity} | \`${item.admin_route}\` | ${item.required_input.replace(/\|/g, "\\|")} | ${item.evidence_needed.replace(/\|/g, "\\|")} | \`${item.validation_command}\` |`,
    );
  }
  lines.push("");
  lines.push("## Sequencia De Revalidacao");
  lines.push("");
  for (const command of report.revalidation_commands) lines.push(`- \`${command}\``);
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  for (const item of report.items) lines.push(`- ${item.area}: ${item.guardrail}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(report.verdict);
  lines.push("");
  return lines.join("\n");
}

function buildReport() {
  const phaseReport = readJsonIfExists<{
    ok?: boolean;
    failed_internal_checks?: unknown[];
    external_blockers?: unknown[];
  }>(resolve("docs", "reports", "admin-enterprise-phases-latest.json"));
  const controlCenter = readJsonIfExists<{
    ok?: boolean;
    production_open?: string;
    internal_management_ready?: boolean;
    evidence?: { completion_percent?: number };
    training?: { training_executed?: boolean };
  }>(resolve("docs", "reports", "admin-control-center-latest.json"));

  const internalAdminReady =
    phaseReport?.ok === true &&
    (phaseReport.failed_internal_checks?.length ?? 0) === 0 &&
    controlCenter?.ok === true &&
    controlCenter.internal_management_ready === true;

  const items: HandoffItem[] = [
    {
      id: "fiscal-contador",
      area: "Fiscal",
      owner: "Contador / Fiscal",
      status: "BLOQUEADO_EXTERNO",
      severity: "critical",
      admin_route: "/admin/fiscal-financeiro",
      required_input: "NCM, tax_code, regras fiscais, CFOP/CSOSN quando aplicavel e aprovacao formal do contador.",
      evidence_needed: "Close pack fiscal aprovado, com responsavel, data e observacao de validacao.",
      validation_command: "npm run fiscal:handoff && npm run go-live:check",
      guardrail: "Nao inferir classificacao fiscal por codigo e nao liberar produto fiscalmente incompleto.",
    },
    {
      id: "pagamento-mercado-pago",
      area: "Pagamentos",
      owner: "DevOps / Provedor de pagamento",
      status: "BLOQUEADO_EXTERNO",
      severity: "critical",
      admin_route: "/admin/pagamentos",
      required_input: "Credenciais reais do Mercado Pago, ambiente definido, webhook produtivo e teste de pagamento homologado.",
      evidence_needed: "Comprovante de transacao homologada, webhook recebido e reconciliacao do pedido no Admin.",
      validation_command: "npm run integrations:check && npm run go-live:check",
      guardrail: "Nao expor secrets, nao aceitar provider manual/fake como pagamento produtivo.",
    },
    {
      id: "frete-homologado",
      area: "Frete e entrega",
      owner: "Logistica / Provedor de frete",
      status: "BLOQUEADO_EXTERNO",
      severity: "critical",
      admin_route: "/admin/frete-entrega",
      required_input: "Provider de frete real homologado, zonas atendidas, politicas de retirada/entrega e cotacao real validada.",
      evidence_needed: "Cotacoes reais por CEP, pedido teste com frete calculado e regra operacional aprovada.",
      validation_command: "npm run freight:catalog:check && npm run go-live:check",
      guardrail: "Nao promover fallback local como frete produtivo.",
    },
    {
      id: "homologacao-operacional",
      area: "Operacao",
      owner: "Operacao / QA",
      status: "PENDENTE_EXECUCAO_REAL",
      severity: "high",
      admin_route: "/admin/governanca",
      required_input: "Execucao real dos cenarios de homologacao com equipe usando o painel.",
      evidence_needed: "CSV/prints/observacoes com PASS por cenario, responsavel e data.",
      validation_command: "npm run homologation:evidence:validate && npm run admin:control-center:check",
      guardrail: "Nao marcar evidencia como PASS sem execucao real observada.",
    },
    {
      id: "treinamento-equipe",
      area: "Treinamento",
      owner: "Admin Master / Gestao",
      status: "PENDENTE_EXECUCAO_REAL",
      severity: "high",
      admin_route: "/admin/documentacao",
      required_input: "Treinamento assistido por perfil: pedidos, catalogo, fiscal/financeiro, atendimento, marketing e gestao.",
      evidence_needed: "Lista de participantes, cargos, data, topicos executados e aceite de prontidao.",
      validation_command: "npm run training:check && npm run admin:control-center:check",
      guardrail: "Nao considerar equipe pronta apenas por documentacao criada.",
    },
    {
      id: "rotina-executiva",
      area: "Gestao",
      owner: "Direcao / Gerencia Ecommerce",
      status: "MONITORAR",
      severity: "medium",
      admin_route: "/admin",
      required_input: "Rotina diaria de revisao de alertas, pedidos, catalogo, integracoes, go-live e relatorios.",
      evidence_needed: "Ata executiva, decisoes registradas e pendencias atualizadas.",
      validation_command: "npm run admin:enterprise:final",
      guardrail: "Nao abrir escala sem decisao executiva baseada nos gates reais.",
    },
  ];

  const summary = {
    total: items.length,
    blocked_external: items.filter((item) => item.status === "BLOQUEADO_EXTERNO").length,
    pending_real_execution: items.filter((item) => item.status === "PENDENTE_EXECUCAO_REAL").length,
    monitor: items.filter((item) => item.status === "MONITORAR").length,
    control_center_evidence_percent: controlCenter?.evidence?.completion_percent ?? null,
    training_executed: controlCenter?.training?.training_executed ?? null,
  };

  return {
    generated_at: new Date().toISOString(),
    ok: internalAdminReady,
    internal_admin_ready: internalAdminReady,
    production_open: "BLOQUEADO_EXTERNO",
    source_reports: {
      phases: "docs/reports/admin-enterprise-phases-latest.json",
      control_center: "docs/reports/admin-control-center-latest.json",
      phases_ok: phaseReport?.ok ?? null,
      control_center_ok: controlCenter?.ok ?? null,
      control_center_production_open: controlCenter?.production_open ?? null,
    },
    summary,
    items,
    revalidation_commands: [
      "npm run admin:enterprise:external-handoff",
      "npm run admin:enterprise:final",
      "npm run fiscal:handoff",
      "npm run integrations:check",
      "npm run freight:catalog:check",
      "npm run homologation:evidence:validate",
      "npm run training:check",
      "npm run go-live:check",
    ],
    verdict:
      "Central Admin pronta para gestao interna. Soft launch e producao aberta seguem bloqueados ate fiscal, pagamento, frete, homologacao e treinamento reais serem evidenciados.",
  };
}

const outArg = getArg("--out");
const defaultBase = resolve("docs", "reports", "admin-enterprise-external-handoff-latest");
const basePath = resolve(outArg ?? defaultBase).replace(/\.(json|md|csv)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;

const report = buildReport();
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${buildMarkdown(report)}\n`, "utf8");
writeFileSync(
  csvPath,
  [
    csvRow(["id", "area", "owner", "status", "severity", "admin_route", "required_input", "evidence_needed", "validation_command", "guardrail"]),
    ...report.items.map((item) =>
      csvRow([
        item.id,
        item.area,
        item.owner,
        item.status,
        item.severity,
        item.admin_route,
        item.required_input,
        item.evidence_needed,
        item.validation_command,
        item.guardrail,
      ]),
    ),
  ].join("\n") + "\n",
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      jsonPath,
      mdPath,
      csvPath,
      production_open: report.production_open,
      summary: report.summary,
    },
    null,
    2,
  ),
);
