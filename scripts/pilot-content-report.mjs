import { writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL nao definida.");
  process.exit(1);
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

function bulletList(items) {
  if (items.length === 0) return "- nenhum item encontrado";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function boolLabel(value) {
  return value ? "sim" : "nao";
}

async function main() {
  const [
    { rows: storeRows },
    { rows: categoryRows },
    { rows: productRows },
    { rows: campaignRows },
  ] = await Promise.all([
    pool.query(`
        select
          s.name as store_name,
          ss.whatsapp_number,
          ss.address,
          ss.opening_hours,
          ss.instagram_url,
          ss.institutional_text,
          ss.website_url
        from stores s
        left join store_settings ss on ss.store_id = s.id
        order by s.created_at asc
        limit 1
      `),
    pool.query(`
        select name, slug, status
        from categories
        order by sort_order asc, name asc
      `),
    pool.query(`
        select
          p.name,
          p.slug,
          p.status,
          p.is_featured,
          c.name as category_name,
          p.price_label
        from products p
        left join categories c on c.id = p.category_id
        order by p.sort_order asc, p.name asc
      `),
    pool.query(`
        select
          title,
          slug,
          status,
          is_featured,
          show_on_home,
          show_on_totem,
          show_on_vitrine
        from campaigns
        order by sort_order asc, title asc
      `),
  ]);

  const store = storeRows[0] ?? {};
  const generatedAt = new Date().toISOString();
  const output = `# Snapshot Atual do Conteudo do Piloto - Vitrine360

Gerado automaticamente em: \`${generatedAt}\`

## Loja

- nome: \`${store.store_name ?? "nao definido"}\`
- WhatsApp: \`${store.whatsapp_number ?? "nao definido"}\`
- endereco: \`${store.address ?? "nao definido"}\`
- horario: \`${store.opening_hours ?? "nao definido"}\`
- Instagram: \`${store.instagram_url ?? "nao definido"}\`
- website: \`${store.website_url || "nao definido"}\`

## Texto institucional

${store.institutional_text ?? "nao definido"}

## Categorias (${categoryRows.length})

${bulletList(categoryRows.map((row) => `${row.name} | slug: ${row.slug} | status: ${row.status}`))}

## Produtos (${productRows.length})

${bulletList(
  productRows.map(
    (row) =>
      `${row.name} | slug: ${row.slug} | categoria: ${row.category_name ?? "sem categoria"} | status: ${row.status} | destaque: ${boolLabel(row.is_featured)} | preco: ${row.price_label ?? "nao definido"}`,
  ),
)}

## Campanhas (${campaignRows.length})

${bulletList(
  campaignRows.map(
    (row) =>
      `${row.title} | slug: ${row.slug} | status: ${row.status} | destaque: ${boolLabel(row.is_featured)} | home: ${boolLabel(row.show_on_home)} | totem: ${boolLabel(row.show_on_totem)} | vitrine: ${boolLabel(row.show_on_vitrine)}`,
  ),
)}

## Como usar este snapshot

1. Conferir com o cliente piloto o que permanece, o que deve mudar e o que deve ser arquivado.
2. Atualizar \`PILOTO-CONTENT-REVIEW.md\` com os itens aprovados.
3. So depois promover esse conteudo para o ambiente oficial.
`;

  const outputPath = path.resolve(process.cwd(), "PILOTO-CONTENT-SNAPSHOT.md");
  await writeFile(outputPath, output, "utf8");
  console.log(`Snapshot gerado em ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(`Falha ao gerar snapshot do piloto: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
