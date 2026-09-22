import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { closeRedisClient } from "../server/redis.ts";
import { buildOfficialRoadmapStatus, type OfficialRoadmapStatus } from "../server/roadmap-status.ts";

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(report: OfficialRoadmapStatus) {
  const lines: string[] = [];
  lines.push("# Relatorio Roadmap Oficial Das Proximas Fases");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Decisao Final");
  lines.push("");
  lines.push(`- DECISAO_FINAL=${report.FINAL_DECISION}`);
  lines.push(`- FASE_ATUAL=${report.CURRENT_PHASE}_GOVERNANCA`);
  lines.push(`- PROXIMA_FASE=${report.NEXT_PHASE}_FISCAL_INTEGRACOES`);
  lines.push(`- PRODUCAO_ABERTA=${report.PRODUCTION_OPEN}`);
  lines.push(`- MAIN_BLOCKER=${report.MAIN_BLOCKER}`);
  lines.push("");
  lines.push("## Roadmap Final");
  lines.push("");
  lines.push(row(["Fase", "Titulo", "Status", "Responsavel", "Documento"]));
  lines.push(row(["---", "---", "---", "---", "---"]));
  for (const phase of report.phases) {
    lines.push(row([phase.phase, phase.title, phase.status, phase.owner, phase.document]));
  }
  lines.push("");
  lines.push("## Status Por Fase");
  lines.push("");
  lines.push("- Fase 1: CONCLUIDA");
  lines.push("- Fase 1.5: EXECUTAR_AGORA / fase atual de governanca");
  lines.push("- Fase 2: PROXIMA_FASE_CRITICA");
  lines.push("- Fase 3: AGUARDANDO_FISCAL_PAGAMENTO_FRETE");
  lines.push("- Fase 4: BLOQUEADA_ATE_HOMOLOGACAO");
  lines.push("- Fase 5: BLOQUEADA");
  lines.push("- Fases 6, 7, 8 e 9: FUTURAS");
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  if (report.blockers.length === 0) lines.push("Nenhum blocker interno no roadmap documental.");
  else report.blockers.forEach((blocker) => lines.push(`- ${blocker}`));
  lines.push("");
  lines.push("## Warnings");
  lines.push("");
  report.warnings.forEach((warning) => lines.push(`- ${warning}`));
  lines.push("");
  lines.push("## Dependencias Externas");
  lines.push("");
  lines.push("- Contador validar NCM/tax_code do mix minimo.");
  lines.push("- Mercado Pago real e webhook homologados.");
  lines.push("- Provider real de frete e cotacao validada.");
  lines.push("- HTTPS, metricas, email, analytics e storage/CDN produtivos.");
  lines.push("");
  lines.push("## Documentos Criados Ou Consolidados");
  lines.push("");
  report.required_documents.forEach((doc) => {
    lines.push(`- ${doc.exists ? "OK" : "AUSENTE"} ${doc.path}`);
  });
  lines.push("");
  lines.push("## Scripts Criados Ou Ajustados");
  lines.push("");
  lines.push("- npm run roadmap:check");
  lines.push("- npm run roadmap:report");
  lines.push("- npm run phase:status");
  lines.push("- npm run go-live:roadmap");
  lines.push("");
  lines.push("## Riscos");
  lines.push("");
  lines.push("- Liberar producao sem NCM/tax_code validados pelo contador.");
  lines.push("- Considerar Mercado Pago ou frete prontos sem credenciais reais e homologacao.");
  lines.push("- Publicar catalogo staging em massa antes do soft launch.");
  lines.push("- Evoluir Mini ERP, CRM, IA ou omnichannel antes de estabilizar a venda regional.");
  lines.push("");
  lines.push("## Proximos Passos Recomendados");
  lines.push("");
  lines.push("1. Enviar pacote fiscal ao contador.");
  lines.push("2. Configurar Mercado Pago real/sandbox e webhook assinado.");
  lines.push("3. Definir provider real de frete e regras para produtos volumosos.");
  lines.push("4. Configurar email, metricas, analytics, HTTPS e storage/CDN quando aplicavel.");
  lines.push("5. Rodar homologacao operacional ponta a ponta.");
  lines.push("6. Iniciar soft launch regional assistido somente apos gates aprovados.");
  lines.push("");
  lines.push("## Recomendacao Para Gestao");
  lines.push("");
  lines.push("Nao pular da Fase 1 para go-live aberto. A ordem correta e Fase 1.5, Fase 2, Fase 3, Fase 4 e so entao Fase 5.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const basePath = resolve("docs/reports/roadmap-official-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

try {
  await initializeDb();
  const report = await buildOfficialRoadmapStatus(readDb());
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderMarkdown(report), "utf8");
  writeFileSync("docs/reports/RELATORIO_ROADMAP_OFICIAL_PROXIMAS_FASES.md", renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, production_open: report.PRODUCTION_OPEN, current_phase: report.CURRENT_PHASE }, null, 2));
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
