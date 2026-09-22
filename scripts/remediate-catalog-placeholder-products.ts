import { createId, initializeDb, readDb, writeDb, type DbAuditLog } from "../server/db";

function isPlaceholderProductImage(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.length === 0 || normalized === "/" || normalized.includes("placeholder.svg") || normalized.includes("placeholder");
}

async function main() {
  await initializeDb();
  const db = readDb();
  const now = new Date().toISOString();
  const correlationId = createId();

  const remediated = db.products
    .filter((product) => {
      const hasOnlyPlaceholder =
        isPlaceholderProductImage(product.image_url) &&
        (!Array.isArray(product.images) || product.images.length === 0 || product.images.every((image) => isPlaceholderProductImage(image)));
      return product.is_active && hasOnlyPlaceholder;
    })
    .map((product) => {
      const previous = {
        is_active: product.is_active,
        availability: product.availability ?? null,
        image_url: product.image_url ?? null,
        image_review_status: product.image_review_status ?? null,
        image_review_notes: product.image_review_notes ?? null,
      };

      product.is_active = false;
      product.availability = "sob_consulta";
      product.image_review_status = "missing";
      product.image_review_notes = "Remediacao automatica: produto retirado da vitrine porque ainda usa placeholder. Exige imagem real e aprovacao humana antes de reativar.";

      const auditEntry: DbAuditLog = {
        event_id: createId(),
        event_type: "catalog.placeholder_image_auto_hold",
        occurred_at: now,
        correlation_id: correlationId,
        actor_id: null,
        actor_name: "script:catalog:images:remediate-placeholders",
        source_channel: "integration",
        order_id: null,
        previous_value: previous,
        new_value: {
          is_active: product.is_active,
          availability: product.availability ?? null,
          image_url: product.image_url ?? null,
          image_review_status: product.image_review_status ?? null,
          image_review_notes: product.image_review_notes ?? null,
        },
        payload: {
          product_id: product.id,
          sku: product.sku ?? null,
          product_name: product.name,
          reason: "placeholder_image",
        },
      };
      db.auditLogs.unshift(auditEntry);

      return {
        product_id: product.id,
        sku: product.sku ?? null,
        product_name: product.name,
      };
    });

  writeDb(db);

  console.log(
    JSON.stringify(
      {
        ok: true,
        remediated: remediated.length,
        products: remediated,
        next_steps:
          remediated.length > 0
            ? [
                "Substituir placeholder por imagem real no admin.",
                "Preencher alt text e observacao de revisao.",
                "Reativar manualmente apenas apos aprovacao humana.",
              ]
            : ["Nenhum produto ativo com placeholder restante no runtime atual."],
      },
      null,
      2,
    ),
  );
}

await main();
