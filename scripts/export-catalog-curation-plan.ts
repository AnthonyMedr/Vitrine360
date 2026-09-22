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
  const lines: string[] = [];
  lines.push("# Plano operacional de curadoria visual do catalogo");
  lines.push("");
  lines.push(`Data: ${audit.generated_at}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(`- Itens em revisao: ${audit.review_required}`);
  lines.push(`- Itens ativos em revisao: ${audit.review_required_active}`);
  lines.push(`- Criticos: ${audit.summary.critical}`);
  lines.push(`- Suspeitos: ${audit.summary.suspect}`);
  lines.push(`- Genericos: ${audit.summary.generic_image}`);
  lines.push(`- Duplicidades suspeitas: ${audit.summary.duplicate_image}`);
  lines.push(`- Divergencias de metadados: ${audit.summary.metadata_mismatch}`);
  lines.push("");
  lines.push("## Prioridade por categoria");
  lines.push("");

  for (const category of audit.category_summary) {
    lines.push(`### ${category.category_name}`);
    lines.push(`- Total: ${category.total}`);
    lines.push(`- Ativos: ${category.active}`);
    lines.push(`- Inativos: ${category.inactive}`);
    lines.push(`- Criticos: ${category.critical}`);
    lines.push(`- Suspeitos: ${category.suspect}`);
    lines.push(`- Genericos: ${category.generic_image}`);
    lines.push(`- Duplicados: ${category.duplicate_image}`);
    lines.push(`- Sem imagem: ${category.missing_image}`);
    lines.push(`- Metadados divergentes: ${category.metadata_mismatch}`);
    lines.push("- Acao sugerida: revisar a familia comercial inteira, definir referencia visual valida e so entao aprovar os SKUs.");
    lines.push("");

    const sample = audit.items
      .filter((item) => (item.category_name || "Sem categoria") === category.category_name)
      .slice(0, 5);
    if (sample.length > 0) {
      lines.push("Itens iniciais para revisao:");
      for (const item of sample) {
        lines.push(`- ${item.product_name} (${item.sku || "-"}) - ${item.audit_status} - ${item.issues.map((issue) => issue.label).join(", ")}`);
      }
      lines.push("");
    }
  }

  lines.push("## Regra operacional");
  lines.push("");
  lines.push("- Nao aprovar em lote sem validacao visual humana.");
  lines.push("- Priorizar categorias com itens ativos e suspeitos.");
  lines.push("- Manter placeholder e imagem generica fora de campanha.");
  lines.push("- Reabrir revisao quando a foto nao representar com clareza a familia, a cor ou o acabamento.");
  lines.push("");
  return lines.join("\n");
}

await initializeDb();
const audit = getAdminCatalogImageAudit(readDb());
const date = resolveDate();
const reportsDir = path.join(process.cwd(), "docs", "reports");
const outputPath = path.join(reportsDir, `plano-curadoria-catalogo-${date}.md`);
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(outputPath, buildMarkdown(audit));

console.log(
  JSON.stringify(
    {
      ok: true,
      output: path.relative(process.cwd(), outputPath),
      categories: audit.category_summary.length,
      review_required: audit.review_required,
      review_required_active: audit.review_required_active,
    },
    null,
    2,
  ),
);
