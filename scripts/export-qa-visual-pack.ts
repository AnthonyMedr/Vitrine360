import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const generatedAt = new Date().toISOString();

const flows = [
  {
    area: "Home",
    route: "/",
    viewports: "360x800;390x844;430x932",
    focus: "Hero, categorias, beneficios, CTA WhatsApp, produtos, ausencia de sobreposicao.",
  },
  {
    area: "Catalogo",
    route: "/produtos",
    viewports: "360x800;390x844",
    focus: "Busca, filtros, cards, categorias, CTAs de interesse/cotacao e ausencia de preco/compra online.",
  },
  {
    area: "Categoria",
    route: "/categoria/forros-pvc",
    viewports: "360x800;390x844",
    focus: "Filtro aplicado, breadcrumb, cards, CTA de orcamento e leitura mobile.",
  },
  {
    area: "Produto",
    route: "/produto/forro-pvc-amadeirado-cedro-200mm-6m",
    viewports: "360x800;390x844",
    focus: "Galeria, descricao, aplicacoes, especificacoes, CTA de orcamento e ausencia de carrinho.",
  },
  {
    area: "Aplicacoes",
    route: "/aplicacoes",
    viewports: "360x800;390x844",
    focus: "Segmentos, categorias indicadas, CTA de orcamento e leitura mobile.",
  },
  {
    area: "Orcamento online",
    route: "/orcamento",
    viewports: "360x800;390x844",
    focus: "Formulario, validacoes, produto pre-preenchido, referencia, WhatsApp e confirmacao visual.",
  },
  {
    area: "Contato/WhatsApp",
    route: "/contato",
    viewports: "360x800;390x844",
    focus: "Link WhatsApp, mensagem, telefone, origem/campanha e dados a confirmar.",
  },
  {
    area: "Quem Somos",
    route: "/sobre",
    viewports: "360x800;390x844",
    focus: "Historia, proposta comercial, diferenciais e CTA sem sobreposicao.",
  },
  {
    area: "E-commerce futuro em stand by",
    route: "/carrinho",
    viewports: "360x800;390x844",
    focus: "Mensagem clara de fase futura, CTA para orcamento e nenhuma jornada de compra ativa.",
  },
  {
    area: "Admin Fase 1",
    route: "/admin",
    viewports: "768x1024;1366x768",
    focus: "Produtos, categorias, campanhas, leads, orcamentos e leitura em tablet/desktop.",
  },
];

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function markdownRow(values: unknown[]) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function buildMarkdown() {
  return [
    "# Pacote de Execucao QA Visual GAMEL Fase 1",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "Este pacote organiza a validacao visual do site institucional, catalogo inteligente, orcamento online e painel admin. O preflight estatico `npm run qa:mobile:check` cobre existencia de rotas e evidencias responsivas; os screenshots podem ser capturados com `npm run qa:visual:screenshots` quando frontend e API estiverem rodando.",
    "",
    "## Como executar",
    "",
    "1. Rodar o frontend/backend local ou ambiente de homologacao.",
    "2. Executar `npm run qa:visual:screenshots` para capturar os fluxos padrao.",
    "3. Revisar os PNGs gerados em `docs/reports/qa-visual-screenshots/`.",
    "4. Registrar bug quando houver texto cortado, sobreposicao, rolagem horizontal, CTA escondido ou erro visual.",
    "5. Nao liberar apresentacao final ao cliente antes de concluir todos os fluxos criticos.",
    "",
    "## Fluxos",
    "",
    markdownRow(["Area", "Rota", "Viewports", "Foco", "Status"]),
    markdownRow(["---", "---", "---", "---", "---"]),
    ...flows.map((flow) => markdownRow([flow.area, flow.route, flow.viewports, flow.focus, "CAPTURAR_COM_QA_VISUAL_SCREENSHOTS"])),
    "",
    "## Criterios de bloqueio",
    "",
    "- Texto de botao principal cortado.",
    "- Layout com sobreposicao de cards, hero, formulario de orcamento ou menu.",
    "- Scroll horizontal no mobile.",
    "- Preco, carrinho, checkout, pagamento ou rastreio aparecendo como fluxo ativo.",
    "- Formulario de orcamento impossivel de preencher em mobile.",
    "- Admin sem leitura minima em tablet/desktop.",
    "",
  ].join("\n");
}

function buildCsv() {
  return [
    csvRow(["area", "route", "viewports", "focus", "status", "screenshot_path", "notes"]),
    ...flows.map((flow) => csvRow([flow.area, flow.route, flow.viewports, flow.focus, "CAPTURAR_COM_QA_VISUAL_SCREENSHOTS", "", ""])),
  ].join("\n") + "\n";
}

const outArg = process.argv.find((arg) => arg.startsWith("--out="));
const outPath = resolve(outArg?.split("=")[1] ?? "docs/reports/QA_VISUAL_EXECUTION_PACK.md");
const csvPath = outPath.replace(/\.md$/i, ".csv");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buildMarkdown(), "utf8");
writeFileSync(csvPath, buildCsv(), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      markdown_path: outPath,
      csv_path: csvPath,
      flows: flows.length,
      status: "requires_real_screenshots",
    },
    null,
    2,
  ),
);
