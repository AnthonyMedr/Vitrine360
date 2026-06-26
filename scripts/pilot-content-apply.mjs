import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL nao definida.");
  process.exit(1);
}

const approvalFilePath = path.resolve(process.cwd(), "PILOTO-CONTENT-APPROVED.json");
if (!existsSync(approvalFilePath)) {
  console.error(`[FAIL] Arquivo nao encontrado: ${approvalFilePath}`);
  console.error("[INFO] Rode `npm run pilot:content:init` e preencha os dados aprovados.");
  process.exit(1);
}

const approval = JSON.parse(readFileSync(approvalFilePath, "utf8"));

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("sslmode=require") ||
    process.env.DATABASE_SSL === "1" ||
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

function normalizeBoolean(value) {
  return value === true;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const storeResult = await client.query("select id from stores order by created_at asc limit 1");
    const storeId = storeResult.rows[0]?.id;
    if (!storeId) {
      throw new Error("Nenhuma loja encontrada para aplicar homologacao.");
    }

    if (approval.store) {
      await client.query(
        `
          update store_settings
          set
            store_name = coalesce($2, store_name),
            whatsapp_number = coalesce($3, whatsapp_number),
            address = coalesce($4, address),
            opening_hours = coalesce($5, opening_hours),
            instagram_url = coalesce($6, instagram_url),
            website_url = coalesce($7, website_url),
            institutional_text = coalesce($8, institutional_text),
            updated_by = 'pilot-content-apply',
            updated_at = now()
          where store_id = $1
        `,
        [
          storeId,
          approval.store.storeName ?? null,
          approval.store.whatsappNumber ?? null,
          approval.store.address ?? null,
          approval.store.openingHours ?? null,
          approval.store.instagramUrl ?? null,
          approval.store.websiteUrl ?? null,
          approval.store.institutionalText ?? null,
        ],
      );

      await client.query(
        `
          update stores
          set name = coalesce($2, name), updated_at = now()
          where id = $1
        `,
        [storeId, approval.store.storeName ?? null],
      );
    }

    for (const category of approval.categories ?? []) {
      await client.query(
        `
          update categories
          set
            status = coalesce($3, status),
            updated_by = 'pilot-content-apply',
            updated_at = now()
          where store_id = $1 and slug = $2
        `,
        [storeId, category.slug, category.status ?? null],
      );
    }

    for (const product of approval.products ?? []) {
      await client.query(
        `
          update products
          set
            status = coalesce($3, status),
            is_featured = coalesce($4, is_featured),
            price_label = coalesce($5, price_label),
            updated_by = 'pilot-content-apply',
            updated_at = now()
          where store_id = $1 and slug = $2
        `,
        [
          storeId,
          product.slug,
          product.status ?? null,
          typeof product.isFeatured === "boolean" ? normalizeBoolean(product.isFeatured) : null,
          product.priceLabel ?? null,
        ],
      );
    }

    for (const campaign of approval.campaigns ?? []) {
      await client.query(
        `
          update campaigns
          set
            status = coalesce($3, status),
            is_featured = coalesce($4, is_featured),
            show_on_home = coalesce($5, show_on_home),
            show_on_totem = coalesce($6, show_on_totem),
            show_on_vitrine = coalesce($7, show_on_vitrine),
            updated_by = 'pilot-content-apply',
            updated_at = now()
          where store_id = $1 and slug = $2
        `,
        [
          storeId,
          campaign.slug,
          campaign.status ?? null,
          typeof campaign.isFeatured === "boolean" ? normalizeBoolean(campaign.isFeatured) : null,
          typeof campaign.showOnHome === "boolean" ? normalizeBoolean(campaign.showOnHome) : null,
          typeof campaign.showOnTotem === "boolean" ? normalizeBoolean(campaign.showOnTotem) : null,
          typeof campaign.showOnVitrine === "boolean"
            ? normalizeBoolean(campaign.showOnVitrine)
            : null,
        ],
      );
    }

    await client.query("COMMIT");
    console.log("Homologacao do piloto aplicada com sucesso no banco local.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Falha ao aplicar homologacao do piloto: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main().finally(async () => {
  await pool.end();
});
