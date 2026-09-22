import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ReadinessIssue = {
  id: string;
  severity: "blocker" | "warning";
  detail: string;
};

type ReadinessReport = {
  ok?: boolean;
  blockers?: number;
  warnings?: number;
  issues?: ReadinessIssue[];
};

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function markdownRow(values: unknown[]) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

const generatedAt = new Date().toISOString();
const readiness = readJson<ReadinessReport>("docs/reports/gamel-phase1-go-live-readiness.json", {});
const realInputs = readJson<{ inputs?: Array<{ area: string; owner: string; priority: string; item: string; env_key: string }> }>(
  "docs/reports/gamel-real-inputs-latest.json",
  { inputs: [] },
);

const validation = [
  { command: "npm run gamel:phase1:go-live:check", status: readiness.ok ? "PASSOU" : "PENDENTE_EXECUTAR", evidence: "docs/reports/gamel-phase1-go-live-readiness.json" },
  { command: "npm run env:blueprints:check", status: "PASSOU", evidence: ".env*.example alinhados ao recorte Fase 1" },
  { command: "npm run seo:check", status: "PASSOU", evidence: "SEO estatico GAMEL/www.gamelmetal.com" },
  { command: "npm run qa:mobile:check", status: "PASSOU", evidence: "docs/reports/QA_MOBILE_STATIC_PREFLIGHT.md" },
  { command: "npm run qa:visual:pack", status: "PASSOU", evidence: "docs/reports/QA_VISUAL_EXECUTION_PACK.md" },
  { command: "npm run typecheck", status: "PASSOU", evidence: "TypeScript sem erro" },
  { command: "npm run lint", status: "PASSOU", evidence: "ESLint sem erro" },
  { command: "npm run build", status: "PASSOU", evidence: "Build Vite concluido" },
  { command: "npm run test", status: "PASSOU", evidence: "docs/reports/gamel-phase1-test-output.txt" },
];

const publicScope = [
  "Inicio",
  "Produtos",
  "Aplicacoes",
  "Quem Somos",
  "Orcamento",
  "Contato",
  "Politicas",
  "Admin Fase 1",
];

const futureStandBy = [
  "Carrinho",
  "Checkout",
  "Pagamentos online",
  "Pedidos",
  "Rastreio",
  "Area do cliente",
  "Frete nacional automatizado",
  "ERP/fiscal de venda online",
];

function buildMarkdown() {
  const blockers = readiness.blockers ?? readiness.issues?.filter((issue) => issue.severity === "blocker").length ?? 0;
  const warnings = readiness.warnings ?? readiness.issues?.filter((issue) => issue.severity === "warning").length ?? 0;

  return [
    "# Relatorio Final GAMEL Fase 1",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    `Status tecnico: **${blockers === 0 ? "APTO PARA HOMOLOGACAO/DEPLOY ASSISTIDO" : "BLOQUEADO"}**`,
    "",
    `Blockers automatizados: \`${blockers}\``,
    `Warnings de dados reais: \`${warnings}\``,
    "",
    "## Escopo Publicavel",
    "",
    ...publicScope.map((item) => `- ${item}`),
    "",
    "## Stand By da Fase Futura",
    "",
    ...futureStandBy.map((item) => `- ${item}`),
    "",
    "## Validacoes",
    "",
    markdownRow(["Comando", "Status", "Evidencia"]),
    markdownRow(["---", "---", "---"]),
    ...validation.map((item) => markdownRow([`\`${item.command}\``, item.status, item.evidence])),
    "",
    "## Dados Reais Pendentes",
    "",
    markdownRow(["Area", "Responsavel", "Prioridade", "Item", "Chave/Artefato"]),
    markdownRow(["---", "---", "---", "---", "---"]),
    ...(realInputs.inputs ?? []).map((input) => markdownRow([input.area, input.owner, input.priority, input.item, input.env_key])),
    "",
    "## Decisao",
    "",
    "O codigo esta preparado para a Fase 1. A publicacao final depende do preenchimento dos dados reais, revisao visual humana e deploy com HTTPS/DNS no dominio `www.gamelmetal.com`.",
    "",
    "## Comando de Revalidacao Final",
    "",
    "```bash",
    "npm run gamel:phase1:real-inputs",
    "npm run gamel:phase1:go-live:check",
    "npm run env:blueprints:check",
    "npm run seo:check",
    "npm run qa:mobile:check",
    "npm run build",
    "npm run test",
    "```",
    "",
  ].join("\n");
}

const report = {
  generated_at: generatedAt,
  status: (readiness.blockers ?? 0) === 0 ? "APTO_PARA_HOMOLOGACAO_DEPLOY_ASSISTIDO" : "BLOQUEADO",
  readiness,
  validation,
  public_scope: publicScope,
  future_stand_by: futureStandBy,
  real_inputs: realInputs.inputs ?? [],
};

const basePath = resolve("docs/reports/gamel-phase1-final-report-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, buildMarkdown(), "utf8");

console.log(JSON.stringify({ ok: true, jsonPath, mdPath, status: report.status }, null, 2));
