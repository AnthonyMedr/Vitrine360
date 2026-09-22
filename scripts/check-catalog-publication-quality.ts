import { closeDbResources, initializeDb, readDb } from "../server/db";
import { getCatalogPublicationIssues } from "../server/catalog-staging";

function parseLimit(argv: string[]) {
  const flagIndex = argv.findIndex((entry) => entry === "--limit");
  const firstNumeric = argv.find((entry) => Number.isFinite(Number(entry)) && Number(entry) > 0);
  const raw = flagIndex === -1 ? Number(firstNumeric || 50) : Number(argv[flagIndex + 1] || firstNumeric || 50);
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.min(Math.floor(raw), 250);
}

async function main() {
  await initializeDb();
  const db = readDb();
  const limit = parseLimit(process.argv.slice(2));

  const scopedItems = db.catalogStaging.filter((item) => item.go_live_gate_status !== "deferred");
  const blockers = scopedItems
    .map((item) => {
      const seen = new Set<string>();
      const issues = getCatalogPublicationIssues(db, item)
        .filter((issue) => issue.severity === "blocker")
        .filter((issue) => {
          const key = `${issue.field}:${issue.responsible}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return {
        id: item.id,
        produto: item.normalized_name || item.source_name,
        sku: item.sku_base,
        categoria: item.category_name,
        status_revisao: item.review_status,
        publicar: item.publish_flag,
        responsaveis: [...new Set(issues.map((issue) => issue.responsible))],
        campos: issues.map((issue) => ({
          campo: issue.field,
          responsavel: issue.responsible,
          criticidade: issue.severity,
          pendencia: issue.detail,
        })),
        impacto_go_live: issues.length > 0 ? "Bloqueia publicacao no catalogo principal." : "Sem bloqueio.",
      };
    })
    .filter((item) => item.campos.length > 0);

  const byResponsible = blockers.reduce<Record<string, number>>((acc, item) => {
    item.responsaveis.forEach((responsible) => {
      acc[responsible] = (acc[responsible] ?? 0) + 1;
    });
    return acc;
  }, {});

  const byField = blockers.reduce<Record<string, number>>((acc, item) => {
    item.campos.forEach((field) => {
      acc[field.campo] = (acc[field.campo] ?? 0) + 1;
    });
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        ok: blockers.length === 0,
        total_staging: db.catalogStaging.length,
        scoped_required_items: scopedItems.length,
        publication_blockers: blockers.length,
        by_responsible: byResponsible,
        by_field: byField,
        sample: blockers.slice(0, limit),
        next_steps:
          blockers.length === 0
            ? ["Manter o check antes de publicar qualquer lote de staging."]
            : [
                "Catalogo: preencher SKU, nome, categoria e imagem real dos itens listados.",
                "Comercial: validar preco e unidade de medida dos itens listados.",
                "Estoque: validar disponibilidade positiva antes da publicacao.",
                "Contador: liberar NCM e classificacao fiscal dos itens com pendencia fiscal.",
              ],
      },
      null,
      2,
    ),
  );

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

void main().finally(() => {
  closeDbResources();
});
