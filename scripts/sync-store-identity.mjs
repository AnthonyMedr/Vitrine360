import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const identity = {
  storeId: "default-store",
  code: "gamel-distribuidora",
  storeName: "Gamel Distribuidora",
  whatsappNumber: "558781390957",
  address:
    "Rua Vereador Paulo Francisco Gomes, SN, Lot. Serra Branca, Quadra II, Lote 7 - Magano, Garanhuns/PE - CEP 55294-770",
  openingHours: "Seg a Sex: 08h-12h e 13h30-17h30 | Sab: 08h-12h",
  instagramUrl: "",
  facebookUrl: "",
  websiteUrl: "",
  institutionalText:
    "Gamel Distribuidora, nome fantasia da Garanhuns Metal LTDA, atua com materiais de construcao, ferragens, ferramentas, vidros, acabamentos e solucoes para obras em Garanhuns/PE.",
  primaryColor: "#1f2329",
  secondaryColor: "#F26B1F",
  seoTitle: "Gamel Distribuidora | Vitrine360",
  seoDescription:
    "Catalogo, campanhas, vitrine TV e totem comercial assistido pela InfiniTI.",
};

if (process.env.SYNC_STORE_IDENTITY_ON_START === "0") {
  console.log("[sync-store-identity] sincronizacao desativada por ambiente.");
  process.exit(0);
}

if (!connectionString) {
  console.log("[sync-store-identity] DATABASE_URL nao definido; usando fallback local do app.");
  process.exit(0);
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("sslmode=require") ||
    process.env.DATABASE_SSL === "1" ||
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const storeResult = await client.query(
      `
        insert into stores (id, code, name, status)
        values ($1, $2, $3, 'active')
        on conflict (id)
        do update set
          code = excluded.code,
          name = excluded.name,
          status = excluded.status,
          updated_at = now()
        returning id
      `,
      [identity.storeId, identity.code, identity.storeName],
    );

    const storeId = storeResult.rows[0]?.id || identity.storeId;

    await client.query(
      `
        insert into store_settings (
          store_id, store_name, whatsapp_number, address, opening_hours, instagram_url,
          facebook_url, website_url, institutional_text, primary_color, secondary_color,
          seo_title, seo_description, updated_by
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'sync-store-identity')
        on conflict (store_id)
        do update set
          store_name = excluded.store_name,
          whatsapp_number = excluded.whatsapp_number,
          address = excluded.address,
          opening_hours = excluded.opening_hours,
          instagram_url = excluded.instagram_url,
          facebook_url = excluded.facebook_url,
          website_url = excluded.website_url,
          institutional_text = excluded.institutional_text,
          primary_color = excluded.primary_color,
          secondary_color = excluded.secondary_color,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          updated_by = excluded.updated_by,
          updated_at = now()
      `,
      [
        storeId,
        identity.storeName,
        identity.whatsappNumber,
        identity.address,
        identity.openingHours,
        identity.instagramUrl,
        identity.facebookUrl,
        identity.websiteUrl,
        identity.institutionalText,
        identity.primaryColor,
        identity.secondaryColor,
        identity.seoTitle,
        identity.seoDescription,
      ],
    );

    await client.query("COMMIT");
    console.log(`[sync-store-identity] identidade atualizada: ${identity.storeName}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.warn(`[sync-store-identity] nao foi possivel sincronizar: ${error.message}`);
  } finally {
    client.release();
  }
}

await main();
await pool.end();

