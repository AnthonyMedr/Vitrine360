import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const storageRoot = path.join(rootDir, "storage", "media");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL nao configurada.");
  process.exit(1);
}

const storeId = "default-store";
const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@infinitilabs.com.br";
const storeName = "Gamel Distribuidora";
const storeCode = "gamel-distribuidora";
const storeWhatsappNumber = "558781390957";
const storeAddress =
  "Rua Vereador Paulo Francisco Gomes, SN, Lot. Serra Branca, Quadra II, Lote 7 - Magano, Garanhuns/PE - CEP 55294-770";
const storeOpeningHours = "Seg a Sex: 08h-12h e 13h30-17h30 | Sab: 08h-12h";
const storeInstagramUrl = "";
const storeInstitutionalText =
  "Gamel Distribuidora, nome fantasia da Garanhuns Metal LTDA, atua com materiais de construcao, ferragens, ferramentas, vidros, acabamentos e solucoes para obras em Garanhuns/PE.";

const categories = [
  ["forros-pvc", "forros-pvc", "Forros PVC", "Forros PVC"],
  ["forros-amadeirados", "forros-amadeirados", "Forros Amadeirados", "Amadeirados"],
  ["chapas-uv", "chapas-uv", "Chapas UV", "Chapas UV"],
  ["ripados", "ripados", "Ripados", "Ripados"],
  ["drywall", "drywall", "Drywall", "Drywall"],
  ["telhas", "telhas", "Telhas", "Telhas"],
  ["policarbonato", "policarbonato", "Policarbonato", "Policarbonato"],
  ["aluminio", "aluminio", "Perfis de Aluminio", "Aluminio"],
  ["pisos-vinilicos", "pisos-vinilicos", "Pisos Vinilicos", "Pisos"],
];

const products = [
  {
    slug: "forro-hd-wood-marfim",
    categorySlug: "forros-amadeirados",
    name: "Forro HD Wood Marfim",
    shortDescription: "Acabamento amadeirado claro, elegante e moderno para tetos internos.",
    description:
      "Forro decorativo HD com textura amadeirada na cor Marfim, leve, resistente a umidade e com instalacao rapida.",
    image: "produto-forro-wood-marfim.jpg",
    priceLabel: "Sob consulta",
    unit: "m2",
    isFeatured: true,
    sectionKey: "forros",
  },
  {
    slug: "chapa-uv-nero-markina",
    categorySlug: "chapas-uv",
    name: "Chapa UV Nero Markina",
    shortDescription: "Marmore negro de alto brilho para revestimentos sofisticados.",
    description:
      "Chapa UV com efeito marmore Nero Markina, alto brilho e excelente resistencia para areas internas.",
    image: "produto-chapa-nero.jpg",
    priceLabel: "Sob consulta",
    unit: "chapa",
    isFeatured: true,
    sectionKey: "chapas-uv",
  },
  {
    slug: "chapa-uv-calacata-nero",
    categorySlug: "chapas-uv",
    name: "Chapa UV Calacata Nero",
    shortDescription: "Visual marcante com brilho e contraste para areas internas.",
    description:
      "Chapa UV Calacata Nero com acabamento de alta resolucao e brilho intenso para paredes e paineis.",
    image: "produto-chapa-calacata.jpg",
    priceLabel: "Sob consulta",
    unit: "chapa",
    isFeatured: true,
    sectionKey: "chapas-uv",
  },
  {
    slug: "ripado-wpc-interno",
    categorySlug: "ripados",
    name: "Ripado WPC Interno",
    shortDescription: "Beleza, praticidade e acabamento moderno para paredes.",
    description: "Painel ripado WPC para uso interno, com visual premium e excelente durabilidade.",
    image: "produto-ripado-wpc.jpg",
    priceLabel: "Sob consulta",
    unit: "m2",
    isFeatured: true,
    sectionKey: "ripados",
  },
  {
    slug: "telha-pvc",
    categorySlug: "telhas",
    name: "Telha PVC Branca",
    shortDescription: "Cobertura leve, resistente e pratica para sua obra.",
    description: "Telha de PVC trapezoidal branca, com bom isolamento termico e instalacao agil.",
    image: "produto-telha-pvc.jpg",
    priceLabel: "Sob consulta",
    unit: "m",
    isFeatured: true,
    sectionKey: "telhas",
  },
  {
    slug: "drywall-linha-completa",
    categorySlug: "drywall",
    name: "Linha Drywall Completa",
    shortDescription: "Chapas, guias, montantes, parafusos e acessorios.",
    description:
      "Linha completa de drywall para paredes, forros e divisorias com obra limpa e rapida.",
    image: "produto-drywall.jpg",
    priceLabel: "Sob consulta",
    unit: "kit",
    isFeatured: true,
    sectionKey: "drywall",
  },
  {
    slug: "policarbonato-alveolar",
    categorySlug: "policarbonato",
    name: "Policarbonato Alveolar",
    shortDescription: "Iluminacao natural com protecao UV.",
    description:
      "Chapa de policarbonato alveolar transparente, leve e resistente para coberturas iluminadas.",
    image: "produto-policarbonato.jpg",
    priceLabel: "Sob consulta",
    unit: "m2",
    isFeatured: false,
    sectionKey: "telhas",
  },
  {
    slug: "perfis-aluminio",
    categorySlug: "aluminio",
    name: "Perfis de Aluminio",
    shortDescription: "Perfis estruturais e de acabamento em aluminio.",
    description: "Linha completa de perfis de aluminio para estruturas, divisorias e acabamentos.",
    image: "produto-aluminio.jpg",
    priceLabel: "Sob consulta",
    unit: "barra",
    isFeatured: false,
    sectionKey: "aluminio",
  },
  {
    slug: "box-banheiro-aluminio",
    categorySlug: "aluminio",
    name: "Box de Banheiro em Aluminio",
    shortDescription: "Box completo com perfis e vidro temperado.",
    description:
      "Box de banheiro com estrutura em aluminio e vidro temperado, disponivel sob medida.",
    image: "produto-box-banheiro.jpg",
    priceLabel: "Sob consulta",
    unit: "kit",
    isFeatured: true,
    sectionKey: "aluminio",
  },
  {
    slug: "piso-vinilico-carvalho",
    categorySlug: "pisos-vinilicos",
    name: "Piso Vinilico Carvalho",
    shortDescription: "Piso vinilico click amadeirado, instalacao rapida.",
    description:
      "Reguas vinilicas no tom Carvalho com conforto acustico e visual amadeirado realista.",
    image: "produto-piso-vinilico.jpg",
    priceLabel: "Sob consulta",
    unit: "m2",
    isFeatured: false,
    sectionKey: "pisos",
  },
];

const campaigns = [
  {
    slug: "mes-da-construcao",
    title: "Mes da Construcao",
    subtitle: "Tudo para sua obra com condicoes especiais.",
    description: "Campanha comercial para drywall, telhas, perfis e chapas.",
    image: "hero-campaign.jpg",
    productSlugs: [
      "drywall-linha-completa",
      "telha-pvc",
      "policarbonato-alveolar",
      "perfis-aluminio",
    ],
  },
  {
    slug: "especial-chapas-uv",
    title: "Especial Chapas UV",
    subtitle: "Sofisticacao que substitui pedras naturais.",
    description: "Selecao de chapas UV com alto brilho e instalacao rapida.",
    image: "produto-chapa-nero.jpg",
    productSlugs: ["chapa-uv-nero-markina", "chapa-uv-calacata-nero"],
  },
  {
    slug: "semana-do-forro",
    title: "Semana do Forro",
    subtitle: "Tetos que transformam qualquer ambiente.",
    description: "Campanha para forros amadeirados, lisos e de alto brilho.",
    image: "produto-forro-wood-marfim.jpg",
    productSlugs: ["forro-hd-wood-marfim"],
  },
];

async function ensureStorageFile(sourceFileName, bucketType) {
  const source = path.join(rootDir, "src", "assets", sourceFileName);
  const storagePath = path.join(storeId, bucketType, sourceFileName);
  const destination = path.join(storageRoot, storagePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return {
    storagePath: `${storeId}/${bucketType}/${sourceFileName}`,
    fileUrl: `/api/public/media?path=${encodeURIComponent(`${storeId}/${bucketType}/${sourceFileName}`)}`,
  };
}

async function upsertMedia(client, input) {
  const copied = await ensureStorageFile(input.sourceFileName, input.type);
  const mediaId = `media-${input.type}-${path.basename(input.sourceFileName, path.extname(input.sourceFileName))}`;
  const result = await client.query(
    `
      insert into media_assets (
        id, store_id, file_name, original_file_name, file_url, storage_path, mime_type, size,
        type, title, alt_text, status, created_by, updated_by
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'publicado','bootstrap-admin','bootstrap-admin')
      on conflict (storage_path)
      do update set
        file_url = excluded.file_url,
        title = excluded.title,
        alt_text = excluded.alt_text,
        type = excluded.type,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning id
    `,
    [
      mediaId,
      storeId,
      input.sourceFileName,
      input.sourceFileName,
      copied.fileUrl,
      copied.storagePath,
      input.mimeType,
      0,
      input.type,
      input.title,
      input.altText || input.title,
    ],
  );
  return result.rows[0].id;
}

const client = new Client({ connectionString });

try {
  await client.connect();

  await client.query(
    `
      insert into stores (id, code, name, status)
      values ($1, $2, $3, 'active')
      on conflict (id) do update
      set code = excluded.code,
          name = excluded.name,
          updated_at = now()
    `,
    [storeId, storeCode, storeName],
  );

  await client.query(
    `
      insert into auth_users (id, email)
      values ('bootstrap-admin', $1)
      on conflict (id) do update set email = excluded.email
    `,
    [adminEmail],
  );

  await client.query(
    `
      insert into user_roles (id, user_id, role, store_id, created_by)
      values
        ('role-admin', 'bootstrap-admin', 'admin', $1, 'bootstrap-admin'),
        ('role-master', 'bootstrap-admin', 'infiniti_master', $1, 'bootstrap-admin'),
        ('role-store-admin', 'bootstrap-admin', 'store_admin', $1, 'bootstrap-admin')
      on conflict (user_id, role, store_id) do nothing
    `,
    [storeId],
  );

  const categoryIds = new Map();
  for (const [index, categoryId, slug, name, shortName] of categories.map((item, index) => [
    index,
    ...item,
  ])) {
    const result = await client.query(
      `
        insert into categories (
          id, store_id, name, slug, short_name, status, sort_order, created_by, updated_by
        )
        values ($1,$2,$3,$4,$5,'publicada',$6,'bootstrap-admin','bootstrap-admin')
        on conflict (store_id, slug)
        do update set
          name = excluded.name,
          short_name = excluded.short_name,
          sort_order = excluded.sort_order,
          updated_by = excluded.updated_by,
          updated_at = now()
        returning id
      `,
      [`category-${categoryId}`, storeId, name, slug, shortName, index],
    );
    categoryIds.set(categoryId, result.rows[0].id);
  }

  const productIds = new Map();
  for (const [index, product] of products.entries()) {
    const primaryMediaId = await upsertMedia(client, {
      sourceFileName: product.image,
      type: "produto",
      title: product.name,
      altText: product.name,
      mimeType: "image/jpeg",
    });

    const result = await client.query(
      `
        insert into products (
          id, store_id, category_id, primary_media_id, name, slug, short_description, description,
          technical_specs, benefits, applications, environments, tags, whatsapp_message,
          seo_title, seo_description, status, is_featured, sort_order, unit, price_label,
          section_key, created_by, updated_by, published_at
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
          $9,$10,$11,'publicado',$12,$13,$14,$15,$16,'bootstrap-admin','bootstrap-admin', now()
        )
        on conflict (store_id, slug)
        do update set
          category_id = excluded.category_id,
          primary_media_id = excluded.primary_media_id,
          name = excluded.name,
          short_description = excluded.short_description,
          description = excluded.description,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          is_featured = excluded.is_featured,
          sort_order = excluded.sort_order,
          unit = excluded.unit,
          price_label = excluded.price_label,
          section_key = excluded.section_key,
          updated_by = excluded.updated_by,
          updated_at = now()
        returning id
      `,
      [
        `product-${product.slug}`,
        storeId,
        categoryIds.get(product.categorySlug),
        primaryMediaId,
        product.name,
        product.slug,
        product.shortDescription,
        product.description,
        `Ola! Tenho interesse em ${product.name}.`,
        product.name,
        product.shortDescription,
        product.isFeatured,
        index,
        product.unit,
        product.priceLabel,
        product.sectionKey,
      ],
    );

    const productId = result.rows[0].id;
    productIds.set(product.slug, productId);

    await client.query("delete from product_images where product_id = $1", [productId]);
    await client.query(
      `
        insert into product_images (id, product_id, media_asset_id, image_role, sort_order, is_primary)
        values ($1, $2, $3, 'principal', 0, true)
        on conflict (product_id, media_asset_id)
        do update set image_role = excluded.image_role, sort_order = excluded.sort_order, is_primary = excluded.is_primary
      `,
      [`product-image-${product.slug}`, productId, primaryMediaId],
    );
  }

  for (const [index, campaign] of campaigns.entries()) {
    const bannerMediaId = await upsertMedia(client, {
      sourceFileName: campaign.image,
      type: "campanha",
      title: campaign.title,
      altText: campaign.title,
      mimeType: "image/jpeg",
    });

    const result = await client.query(
      `
        insert into campaigns (
          id, store_id, title, slug, subtitle, description, banner_media_id, cta_label,
          whatsapp_message, status, is_featured, show_on_home, show_on_totem, show_on_vitrine,
          seo_title, seo_description, sort_order, created_by, updated_by, published_at
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,'Ver campanha',$8,'publicada',true,true,true,true,$9,$10,$11,
          'bootstrap-admin','bootstrap-admin', now()
        )
        on conflict (store_id, slug)
        do update set
          title = excluded.title,
          subtitle = excluded.subtitle,
          description = excluded.description,
          banner_media_id = excluded.banner_media_id,
          whatsapp_message = excluded.whatsapp_message,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          sort_order = excluded.sort_order,
          updated_by = excluded.updated_by,
          updated_at = now()
        returning id
      `,
      [
        `campaign-${campaign.slug}`,
        storeId,
        campaign.title,
        campaign.slug,
        campaign.subtitle,
        campaign.description,
        bannerMediaId,
        `Ola! Quero saber mais sobre a campanha ${campaign.title}.`,
        campaign.title,
        campaign.description,
        index,
      ],
    );

    const campaignId = result.rows[0].id;
    await client.query("delete from campaign_products where campaign_id = $1", [campaignId]);
    for (const [productIndex, productSlug] of campaign.productSlugs.entries()) {
      const productId = productIds.get(productSlug);
      if (!productId) continue;
      await client.query(
        `
          insert into campaign_products (id, campaign_id, product_id, sort_order)
          values ($1, $2, $3, $4)
        `,
        [`campaign-product-${campaign.slug}-${productSlug}`, campaignId, productId, productIndex],
      );
    }
  }

  await client.query(
    `
      insert into store_settings (
        store_id, store_name, whatsapp_number, address, opening_hours, instagram_url,
        facebook_url, website_url, institutional_text, primary_color, secondary_color,
        seo_title, seo_description, updated_by
      )
      values (
        $1, $2, $3, $4,
        $5,
        $6,
        '', '', $7,
        '#1f2329', '#F26B1F', $8, $9,
        'bootstrap-admin'
      )
      on conflict (store_id)
      do update set
        store_name = excluded.store_name,
        whatsapp_number = excluded.whatsapp_number,
        address = excluded.address,
        opening_hours = excluded.opening_hours,
        instagram_url = excluded.instagram_url,
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
      storeName,
      storeWhatsappNumber,
      storeAddress,
      storeOpeningHours,
      storeInstagramUrl,
      storeInstitutionalText,
      `${storeName} | Vitrine360`,
      "Catalogo, campanhas, vitrine TV e totem comercial assistido pela InfiniTI.",
    ],
  );

  await client.query(
    `
      insert into totem_settings (
        id, store_id, welcome_message, idle_reset_seconds, primary_qr_target,
        show_featured_products, show_campaigns, show_categories, status
      )
      values ('totem-default-store', $1, 'Toque na categoria para comecar.', 60, null, true, true, true, 'ativo')
      on conflict (store_id)
      do update set
        welcome_message = excluded.welcome_message,
        idle_reset_seconds = excluded.idle_reset_seconds,
        show_featured_products = excluded.show_featured_products,
        show_campaigns = excluded.show_campaigns,
        show_categories = excluded.show_categories,
        status = excluded.status,
        updated_at = now()
    `,
    [storeId],
  );

  await client.query(
    `
      insert into vitrine_settings (
        id, store_id, slide_duration_seconds, orientation, status, show_campaigns, show_featured_products
      )
      values ('vitrine-default-store', $1, 8, 'paisagem', 'ativo', true, true)
      on conflict (store_id)
      do update set
        slide_duration_seconds = excluded.slide_duration_seconds,
        orientation = excluded.orientation,
        status = excluded.status,
        show_campaigns = excluded.show_campaigns,
        show_featured_products = excluded.show_featured_products,
        updated_at = now()
    `,
    [storeId],
  );

  console.log("Seed concluido com sucesso.");
  console.log(`Categorias: ${categories.length}`);
  console.log(`Produtos: ${products.length}`);
  console.log(`Campanhas: ${campaigns.length}`);
} catch (error) {
  console.error("Falha ao executar seed:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
