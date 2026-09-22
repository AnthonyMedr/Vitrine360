import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initializeDb, readDb } from "../server/db.ts";
import { getAdminCatalogImageAudit } from "../server/catalog-image-audit.ts";

type AuditMode = "images" | "consistency";

function resolveMode(argv: string[]): AuditMode {
  const modeArg = argv.find((entry) => entry.startsWith("--mode="));
  const mode = modeArg?.split("=")[1];
  return mode === "consistency" ? "consistency" : "images";
}

function reportPaths(mode: AuditMode) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const baseName = mode === "images" ? `catalog-image-audit-${date}` : `catalog-consistency-audit-${date}`;
  const reportsDir = path.join(process.cwd(), "docs", "reports");
  return {
    reportsDir,
    markdown: path.join(reportsDir, `${baseName}.md`),
    json: path.join(reportsDir, `${baseName}.json`),
    latest: path.join(reportsDir, mode === "images" ? "catalog-image-audit-latest.json" : "catalog-consistency-audit-latest.json"),
  };
}

function shouldFail(mode: AuditMode, audit: ReturnType<typeof getAdminCatalogImageAudit>) {
  if (mode === "images") return audit.summary.critical > 0;
  return audit.summary.critical > 0 || audit.summary.suspect > 0;
}

function buildMarkdown(mode: AuditMode, audit: ReturnType<typeof getAdminCatalogImageAudit>) {
  const title = mode === "images" ? "Catalog image audit" : "Catalog consistency audit";
  const topItems = audit.items.slice(0, 30);
  return [
    `# ${title}`,
    "",
    `Data: ${audit.generated_at}`,
    "",
    "## Resumo",
    "",
    `- Total analisado: ${audit.summary.total}`,
    `- OK: ${audit.summary.ok}`,
    `- Revisao manual: ${audit.summary.manual_review}`,
    `- Suspeito: ${audit.summary.suspect}`,
    `- Critico: ${audit.summary.critical}`,
    `- Sem imagem: ${audit.summary.missing_image}`,
    `- Sem alt text: ${audit.summary.missing_alt_text}`,
    `- Duplicidade suspeita: ${audit.summary.duplicate_image}`,
    `- Imagem generica: ${audit.summary.generic_image}`,
    `- Metadados divergentes: ${audit.summary.metadata_mismatch}`,
    "",
    "## Itens prioritarios",
    "",
    ...topItems.flatMap((item) => [
      `### ${item.product_name}`,
      `- SKU: ${item.sku || "-"}`,
      `- Categoria: ${item.category_name || "Sem categoria"}`,
      `- Status: ${item.audit_status}`,
      `- Imagem: ${item.primary_image || "Sem imagem"}`,
      `- Alt text: ${item.image_alt_text || "Ausente"}`,
      `- Acao recomendada: ${item.recommended_action}`,
      ...item.issues.map((issue) => `- ${issue.label}: ${issue.detail}`),
      "",
    ]),
  ].join("\n");
}

export async function runCatalogImageAudit(mode: AuditMode) {
  await initializeDb();
  const audit = getAdminCatalogImageAudit(readDb());
  const paths = reportPaths(mode);
  fs.mkdirSync(paths.reportsDir, { recursive: true });
  fs.writeFileSync(paths.json, JSON.stringify(audit, null, 2));
  fs.writeFileSync(paths.latest, JSON.stringify(audit, null, 2));
  fs.writeFileSync(paths.markdown, buildMarkdown(mode, audit));

  console.log(
    JSON.stringify(
      {
        ok: !shouldFail(mode, audit),
        mode,
        report_markdown: path.relative(process.cwd(), paths.markdown),
        report_json: path.relative(process.cwd(), paths.json),
        summary: audit.summary,
        review_required: audit.review_required,
        sample: audit.items.slice(0, 15).map((item) => ({
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          audit_status: item.audit_status,
          issues: item.issues.map((issue) => issue.label),
          recommended_action: item.recommended_action,
        })),
      },
      null,
      2,
    ),
  );

  if (shouldFail(mode, audit)) {
    process.exitCode = 1;
  }
}

function isEntrypoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isEntrypoint()) {
  await runCatalogImageAudit(resolveMode(process.argv.slice(2)));
}
