import fs from "node:fs";
import path from "node:path";
import { initializeDb, readDb } from "../server/db.ts";
import { getAdminCatalogImageAudit } from "../server/catalog-image-audit.ts";

function resolveDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildMarkdown(audit: ReturnType<typeof getAdminCatalogImageAudit>) {
  const backlogCategories = audit.category_summary.filter((category) => category.suspect > 0 || category.critical > 0 || category.manual_review > 0);
  return [
    "# Progresso da curadoria visual do catalogo",
    "",
    `Data: ${audit.generated_at}`,
    "",
    "## Resumo executivo",
    "",
    `- SKU(s) auditado(s): ${audit.summary.total}`,
    `- Pendentes ativos: ${audit.active_summary.critical + audit.active_summary.suspect + audit.active_summary.manual_review}`,
    `- Pendentes inativos: ${audit.inactive_summary.critical + audit.inactive_summary.suspect + audit.inactive_summary.manual_review}`,
    `- Excecoes aprovadas por humano: ${audit.summary.human_override_total}`,
    `- Duplicidade aprovada: ${audit.summary.duplicate_override}`,
    `- Imagem generica aprovada: ${audit.summary.generic_override}`,
    `- Metadado aprovado: ${audit.summary.metadata_override}`,
    `- Categorias com backlog: ${backlogCategories.length}`,
    "",
    "## Categorias prioritarias",
    "",
    ...backlogCategories.slice(0, 15).flatMap((category) => [
      `### ${category.category_name}`,
      `- Backlog total: ${category.total}`,
      `- Ativos: ${category.active}`,
      `- Suspeitos: ${category.suspect}`,
      `- Criticos: ${category.critical}`,
      `- Revisao manual: ${category.manual_review}`,
      `- Overrides aprovados: ${category.human_override_total}`,
      `- Proxima acao: revisar a familia visual inteira e usar override apenas com validacao humana real.`,
      "",
    ]),
  ].join("\n");
}

await initializeDb();
const audit = getAdminCatalogImageAudit(readDb());
const date = resolveDate();
const reportsDir = path.join(process.cwd(), "docs", "reports");
const outputPath = path.join(reportsDir, `progresso-curadoria-catalogo-${date}.md`);
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(outputPath, buildMarkdown(audit));

console.log(
  JSON.stringify(
    {
      ok: true,
      output: path.relative(process.cwd(), outputPath),
      total: audit.summary.total,
      active_pending: audit.active_summary.critical + audit.active_summary.suspect + audit.active_summary.manual_review,
      inactive_pending: audit.inactive_summary.critical + audit.inactive_summary.suspect + audit.inactive_summary.manual_review,
      human_override_total: audit.summary.human_override_total,
    },
    null,
    2,
  ),
);
