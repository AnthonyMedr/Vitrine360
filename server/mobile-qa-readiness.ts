import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type MobileQaFlow = {
  area: string;
  route: string;
  source: string;
  requiredEvidence: string[];
};

export type MobileQaFlowResult = MobileQaFlow & {
  status: "ok" | "warning" | "blocker";
  evidence: string[];
  issues: string[];
};

export const MOBILE_QA_FLOWS: MobileQaFlow[] = [
  { area: "Home", route: "/", source: "src/pages/Index.tsx", requiredEvidence: ["md:", "shell-home"] },
  { area: "Categoria/listagem", route: "/produtos", source: "src/pages/Products.tsx", requiredEvidence: ["grid", "md:", "lg:"] },
  { area: "Produto", route: "/produto/:slug", source: "src/pages/ProductDetail.tsx", requiredEvidence: ["grid", "md:", "ProductCard"] },
  { area: "Aplicacoes", route: "/aplicacoes", source: "src/pages/Applications.tsx", requiredEvidence: ["grid", "md:", "orcamento"] },
  { area: "Orcamento online", route: "/orcamento", source: "src/pages/Quote.tsx", requiredEvidence: ["grid", "md:", "form"] },
  { area: "CTA WhatsApp", route: "/contato", source: "src/pages/Contact.tsx", requiredEvidence: ["whatsapp", "WhatsApp"] },
  { area: "Quem Somos", route: "/sobre", source: "src/pages/About.tsx", requiredEvidence: ["grid", "md:", "GAMEL"] },
  { area: "E-commerce futuro em stand by", route: "/carrinho", source: "src/pages/FutureEcommerce.tsx", requiredEvidence: ["Fase futura", "orcamento"] },
  { area: "Admin equipe", route: "/admin", source: "src/pages/AdminTeamHome.tsx", requiredEvidence: ["grid", "md:", "Prioridades"] },
];

function readTextIfExists(filePath: string) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
}

function routeExists(appSource: string, route: string) {
  if (route.includes(":")) {
    const routePrefix = route.split("/:")[0];
    return appSource.includes(`path="${route}"`) || appSource.includes(`path="${routePrefix}/:`);
  }
  return appSource.includes(`path="${route}"`);
}

export function getMobileQaReadiness(projectRoot = process.cwd()) {
  const appPath = path.join(projectRoot, "src", "App.tsx");
  const appSource = readTextIfExists(appPath) ?? "";

  const results: MobileQaFlowResult[] = MOBILE_QA_FLOWS.map((flow) => {
    const sourcePath = path.join(projectRoot, flow.source);
    const sourceText = readTextIfExists(sourcePath);
    const issues: string[] = [];
    const evidence: string[] = [];

    if (!routeExists(appSource, flow.route)) {
      issues.push(`Rota ${flow.route} nao encontrada em src/App.tsx.`);
    } else {
      evidence.push("rota registrada");
    }

    if (!sourceText) {
      issues.push(`Fonte ${flow.source} nao encontrado.`);
    } else {
      evidence.push("fonte encontrado");
      for (const marker of flow.requiredEvidence) {
        if (sourceText.toLowerCase().includes(marker.toLowerCase())) {
          evidence.push(`evidencia responsiva/conteudo: ${marker}`);
        }
      }
    }

    const missingEvidenceCount = Math.max(0, flow.requiredEvidence.length - evidence.filter((item) => item.startsWith("evidencia")).length);
    if (sourceText && missingEvidenceCount > 0) {
      issues.push(`${missingEvidenceCount} evidencias responsivas/conteudo nao encontradas automaticamente.`);
    }

    const status = issues.some((issue) => issue.startsWith("Rota ") || issue.startsWith("Fonte "))
      ? "blocker"
      : issues.length > 0
        ? "warning"
        : "ok";

    return {
      ...flow,
      status,
      evidence,
      issues,
    };
  });

  const blockers = results.filter((result) => result.status === "blocker");
  const warnings = results.filter((result) => result.status === "warning");

  return {
    ok: blockers.length === 0,
    generated_at: new Date().toISOString(),
    manual_visual_required: true,
    summary: {
      flows: results.length,
      ok: results.filter((result) => result.status === "ok").length,
      warnings: warnings.length,
      blockers: blockers.length,
    },
    results,
    next_steps: [
      "Usar este preflight para garantir que rotas e fontes criticas existem antes do QA visual.",
      "Executar npm run qa:visual:screenshots com frontend/API rodando para gerar evidencias reais.",
      "Revisar os PNGs gerados antes de trafego pago ou campanha forte.",
      "Bloquear campanha forte se houver blocker neste preflight ou quebra visual confirmada nos screenshots.",
    ],
  };
}

export function renderMobileQaReadinessMarkdown(report: ReturnType<typeof getMobileQaReadiness>) {
  const rows = report.results
    .map((result) => {
      const issues = result.issues.length > 0 ? result.issues.join("; ") : "Sem pendencia automatica.";
      return `| ${result.area} | \`${result.route}\` | ${result.status.toUpperCase()} | ${issues} |`;
    })
    .join("\n");

  return `# QA Mobile Static Preflight

Data: ${report.generated_at}

Status: **${report.ok ? "PASSOU" : "FALHOU"}**

Este preflight nao substitui screenshot real. Ele valida programaticamente se as rotas e fontes dos fluxos criticos existem e se ha evidencias basicas de responsividade/conteudo. Gere as capturas com \`npm run qa:visual:screenshots\` e revise os PNGs antes de trafego pago ou producao aberta.

| Fluxo | Rota | Status | Observacao |
|---|---|---|---|
${rows}

## Resumo

- Fluxos avaliados: ${report.summary.flows}
- OK: ${report.summary.ok}
- Warnings: ${report.summary.warnings}
- Blockers: ${report.summary.blockers}
- QA visual real ainda obrigatorio: ${report.manual_visual_required ? "sim" : "nao"}

## Proximos passos

${report.next_steps.map((step) => `- ${step}`).join("\n")}
`;
}

export function writeMobileQaReadinessReport(projectRoot = process.cwd()) {
  const report = getMobileQaReadiness(projectRoot);
  const reportsDir = path.join(projectRoot, "docs", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const markdownPath = path.join(reportsDir, "QA_MOBILE_STATIC_PREFLIGHT.md");
  writeFileSync(markdownPath, renderMobileQaReadinessMarkdown(report), "utf8");
  return { report, markdownPath };
}
