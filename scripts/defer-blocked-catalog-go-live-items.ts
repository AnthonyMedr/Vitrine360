import { readDb, writeDb } from "../server/db";
import { getCatalogPublicationIssues, SOFT_LAUNCH_DEFERRED_SKU_SET } from "../server/catalog-staging";

const reason =
  "Item retirado do soft launch regional controlado por bloqueio de publicacao; requer saneamento de catalogo/contador antes de voltar ao gate.";

const db = readDb();
const blockedItems = db.catalogStaging.filter((item) => {
  const isKnownDeferredSku = Boolean(item.sku_base && SOFT_LAUNCH_DEFERRED_SKU_SET.has(item.sku_base));
  const hasPublicationBlocker = getCatalogPublicationIssues(db, item).some((issue) => issue.severity === "blocker");
  return item.go_live_gate_status !== "deferred" && (isKnownDeferredSku || hasPublicationBlocker);
});

for (const item of blockedItems) {
  item.go_live_gate_status = "deferred";
  item.go_live_gate_note = reason;
}

if (blockedItems.length > 0) {
  writeDb(db);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      changed: blockedItems.length,
      deferred_blocked_items: blockedItems.map((item) => ({
        id: item.id,
        sku: item.sku_base,
        produto: item.normalized_name || item.source_name,
        categoria: item.category_name,
      })),
      note: reason,
      next_steps:
        blockedItems.length === 0
          ? ["Nenhum item bloqueado estava exigido no gate do soft launch."]
          : [
              "Reexecutar npm run catalog:publication:check.",
              "Equipe de catalogo deve preencher imagens reais antes de recolocar itens no gate.",
              "Contador deve preencher dados fiscais reais antes de recolocar itens no gate.",
            ],
    },
    null,
    2,
  ),
);
