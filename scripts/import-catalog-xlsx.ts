import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { products as catalogProducts } from "../src/data/products";

type CellValue = ExcelJS.CellValue;

function text(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return text(value.result as CellValue);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return String(value).trim();
}

const yes = (value: CellValue) => text(value).toLocaleLowerCase("pt-BR") === "sim";
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const source = process.argv[2];
if (!source) throw new Error("Uso: npm run catalog:import:xlsx -- <arquivo.xlsx>");

const workbook = new ExcelJS.Workbook();
const sourcePath = path.resolve(source);
try {
  await workbook.xlsx.readFile(sourcePath);
} catch (error) {
  const archive = await JSZip.loadAsync(await readFile(sourcePath));
  const manifestFile = archive.file("[Content_Types].xml");
  if (!manifestFile) throw error;
  const manifest = await manifestFile.async("string");
  const malformedDefault = /<Default Extension="xml" ContentType="application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml"\s*\/>/;
  if (!malformedDefault.test(manifest)) throw error;
  archive.file(
    "[Content_Types].xml",
    manifest.replace(
      malformedDefault,
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />',
    ),
  );
  for (const entryName of Object.keys(archive.files).filter((name) => name.startsWith("xl/") && name.endsWith(".xml"))) {
    const xmlFile = archive.file(entryName);
    if (!xmlFile) continue;
    const xml = await xmlFile.async("string");
    if (!xml.includes('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) continue;
    let normalizedXml = xml
        .replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
        .replace(/<(\/?)x:/g, "<$1");
    if (entryName.startsWith("xl/worksheets/")) normalizedXml = normalizedXml.replace(/<tableParts[\s\S]*?<\/tableParts>/g, "");
    archive.file(entryName, normalizedXml);
  }
  await workbook.xlsx.load(await archive.generateAsync({ type: "nodebuffer" }));
  console.warn("Manifesto XLSX inválido corrigido apenas em memória para leitura segura.");
}
const categoriesSheet = workbook.getWorksheet("01_Categorias");
const productsSheet = workbook.getWorksheet("02_Produtos");
const variationsSheet = workbook.getWorksheet("03_Variacoes_SKUs");
const specsSheet = workbook.getWorksheet("04_Especificacoes");
const imagesSheet = workbook.getWorksheet("05_Imagens");
const relatedSheet = workbook.getWorksheet("07_Relacionados");
if (!categoriesSheet || !productsSheet || !variationsSheet || !specsSheet || !imagesSheet || !relatedSheet) throw new Error("Planilha incompatível: abas obrigatórias ausentes.");

const categoryImages: Record<string, string> = {
  "CAT-001": "/images/gamel/categorias/categoria-forros-pvc-4x3.png",
  "CAT-002": "/images/gamel/categorias/v4/categoria-pisos-vinilicos-horizontal.png",
  "CAT-003": "/images/gamel/categorias/v4/categoria-ripados-internos-horizontal.png",
  "CAT-004": "/images/gamel/categorias/v4/categoria-chapas-uv-horizontal.png",
  "CAT-005": "/images/gamel/categorias/v4/categoria-chapas-policarbonato-horizontal.png",
  "CAT-006": "/images/gamel/categorias/v4/categoria-forros-em-pvc-horizontal.png",
  "CAT-007": "/images/gamel/categorias/v4/categoria-tetos-vinilicos-horizontal.png",
  "CAT-008": "/images/gamel/categorias/v4/categoria-ripados-externos-horizontal.png",
};

// Mantém as imagens aprovadas do catálogo principal e impede que uma nova
// importação recupere os ativos removidos dos lotes legados.
const officialProductImages: Record<string, string[]> = Object.fromEntries(
  catalogProducts
    .filter((product) => product.imageApproved && product.images.length > 0)
    .map((product) => [product.id, product.images]),
);

const categoryPresentation: Record<string, { name: string; description: string; order: number }> = {
  "CAT-006": { name: "Forros em PVC", description: "Forros em PVC lisos, frisados, canelados e com junta seca para tetos residenciais e comerciais.", order: 1 },
  "CAT-007": { name: "Tetos Vinílicos", description: "Tetos vinílicos decorativos em acabamentos amadeirados e contemporâneos para ambientes internos.", order: 2 },
  "CAT-002": { name: "Pisos Vinílicos", description: "Pisos vinílicos para ambientes residenciais e comerciais, com instalação prática e acabamento amadeirado.", order: 3 },
  "CAT-003": { name: "Ripados Internos", description: "Painéis e perfis ripados para paredes, tetos e projetos decorativos em ambientes internos.", order: 4 },
  "CAT-008": { name: "Ripados Externos", description: "Painéis ripados desenvolvidos para fachadas, áreas externas e ambientes sujeitos à umidade.", order: 5 },
  "CAT-004": { name: "Chapas UV", description: "Chapas decorativas em PVC-UV para revestimentos, painéis e projetos de acabamento interno.", order: 6 },
  "CAT-005": { name: "Chapas de Policarbonato", description: "Chapas de policarbonato para coberturas, fechamentos e projetos com iluminação natural.", order: 7 },
};

const categoryRows: Array<Record<string, unknown>> = [];
categoriesSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value)) return;
  const id = text(row.getCell(1).value);
  const presentation = categoryPresentation[id];
  if (!presentation) return;
  const { name, description, order } = presentation;
  categoryRows.push({ id, name, slug: slugify(name), icon: name.charAt(0).toUpperCase(), description, productCount: 0, image: categoryImages[id] ?? "/placeholder.svg", order });
});
categoryRows.sort((a, b) => Number(a.order) - Number(b.order));
const categoriesById = new Map(categoryRows.map((category) => [String(category.id), category]));

const variationsByProduct = new Map<string, Array<{ id: string; label: string; value: string }>>();
variationsSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value)) return;
  const productId = text(row.getCell(2).value);
  const details = [["Modelo", 6], ["Cor", 7], ["Acabamento", 8], ["Comprimento", 9], ["Largura", 10], ["Espessura", 11], ["Diâmetro", 12]] as const;
  const summary = details.map(([label, column]) => {
    const value = text(row.getCell(column).value);
    const unit = column >= 9 ? text(row.getCell(13).value) : "";
    return value ? `${label}: ${value}${unit ? ` ${unit}` : ""}` : "";
  }).filter(Boolean);
  const item = { id: text(row.getCell(1).value), label: text(row.getCell(4).value) || text(row.getCell(3).value), value: [text(row.getCell(3).value), ...summary].filter(Boolean).join(" | ") };
  variationsByProduct.set(productId, [...(variationsByProduct.get(productId) ?? []), item]);
});

const specsByProduct = new Map<string, string[]>();
specsSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value) || !yes(row.getCell(7).value)) return;
  const productId = text(row.getCell(1).value);
  const spec = `${text(row.getCell(4).value)}: ${text(row.getCell(5).value)}${text(row.getCell(6).value) ? ` ${text(row.getCell(6).value)}` : ""}`;
  specsByProduct.set(productId, [...(specsByProduct.get(productId) ?? []), spec]);
});

const imagesByProduct = new Map<string, string[]>();
imagesSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value) || !yes(row.getCell(9).value)) return;
  const productId = text(row.getCell(1).value);
  const imagePath = text(row.getCell(7).value);
  if (imagePath && !imagePath.toLowerCase().includes("arquivo anexo")) imagesByProduct.set(productId, [...(imagesByProduct.get(productId) ?? []), imagePath]);
});

const relatedByProduct = new Map<string, string[]>();
relatedSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value) || !yes(row.getCell(5).value)) return;
  const productId = text(row.getCell(1).value);
  relatedByProduct.set(productId, [...(relatedByProduct.get(productId) ?? []), text(row.getCell(2).value)]);
});

const products: Array<Record<string, unknown>> = [];
productsSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5 || !text(row.getCell(1).value)) return;
  const id = text(row.getCell(1).value);
  const category = categoriesById.get(text(row.getCell(4).value));
  if (!category) throw new Error(`Categoria não encontrada para ${id}.`);
  category.productCount = Number(category.productCount) + 1;
  const approvedImages = imagesByProduct.get(id) ?? officialProductImages[id] ?? [];
  products.push({
    id, sku: text(row.getCell(2).value), name: text(row.getCell(24).value) || text(row.getCell(3).value), slug: text(row.getCell(35).value) || slugify(text(row.getCell(3).value)),
    description: text(row.getCell(27).value) || text(row.getCell(8).value), shortDescription: text(row.getCell(26).value) || text(row.getCell(7).value),
    application: text(row.getCell(29).value) || text(row.getCell(9).value), benefits: text(row.getCell(28).value) || text(row.getCell(10).value),
    technicalSpecs: specsByProduct.get(id) ?? text(row.getCell(30).value).split("|").map((item) => item.trim()).filter(Boolean), price: 0,
    category: String(category.name), subcategory: text(row.getCell(6).value) || String(category.name), brand: text(row.getCell(5).value) || "GAMEL", material: text(row.getCell(11).value) || "Sob consulta",
    diameter: text(row.getCell(14).value) || undefined, saleType: "unidade", unitMeasure: "un", displayUnit: text(row.getCell(13).value) || "Unidade", stock: 0,
    images: approvedImages, imageApproved: approvedImages.length > 0, rating: 0, reviews: 0, featured: yes(row.getCell(19).value), quoteAvailable: yes(row.getCell(20).value),
    variations: variationsByProduct.get(id) ?? [], relatedProductIds: relatedByProduct.get(id) ?? [], seoTitle: text(row.getCell(33).value), seoDescription: text(row.getCell(34).value),
  });
});

const brands = [...new Set(products.map((product) => String(product.brand)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
const generated = `/* AUTO-GENERATED by scripts/import-catalog-xlsx.ts. Do not edit manually. */\n\nexport interface Product {\n  id: string; sku: string; name: string; slug: string; description: string; shortDescription: string; application: string; benefits: string;\n  technicalSpecs: string[]; price: number; originalPrice?: number; category: string; subcategory: string; brand: string; material: string; diameter?: string;\n  saleType: "unidade"; unitMeasure: "un"; displayUnit: string; stock: number; images: string[]; imageApproved: boolean; rating: number; reviews: number;\n  width?: number; height?: number; length?: number; thickness?: number; linearMeasure?: number; squareMeasure?: number; areaPerPiece?: number; areaPerBox?: number;\n  areaPerPackage?: number; metersPerPiece?: number; piecesPerBox?: number; metersPerBox?: number; metersPerPackage?: number; volumePerUnit?: number; volumePerPackage?: number;\n  weightPerUnit?: number; weightPerPackage?: number; piecesPerPackage?: number; packagingClosed?: boolean; openPackageAllowed?: boolean; minimumSaleQuantity?: number;\n  saleMultiple?: number; fractionalSaleAllowed?: boolean; defaultLossMargin?: number; lossMargin?: number; featured?: boolean; bestseller?: boolean; quoteAvailable: boolean;\n  variations: Array<{ id: string; label: string; value: string }>; relatedProductIds: string[]; seoTitle: string; seoDescription: string;\n}\n\nexport interface Category {\n  id: string; name: string; slug: string; icon: string; description: string; productCount: number; image: string; order: number;\n}\n\nexport const categories: Category[] = ${JSON.stringify(categoryRows, null, 2)};\n\nexport const products: Product[] = ${JSON.stringify(products, null, 2)};\n\nexport const brands = ${JSON.stringify(brands, null, 2)};\n`;
await writeFile(path.resolve("src/data/products.ts"), generated, "utf8");

const imagePlanSheet = workbook.getWorksheet("11_Plano_Imagens");
const assetManifestSheet = workbook.getWorksheet("12_Manifesto_Assets");
const categoryCoversSheet = workbook.getWorksheet("13_Capas_Categorias");
const optionalPackagesSheet = workbook.getWorksheet("14_Embalagens_Opcionais");
if (imagePlanSheet && assetManifestSheet && categoryCoversSheet && optionalPackagesSheet) {
  const imagePlan: Array<Record<string, unknown>> = [];
  imagePlanSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 5 || !text(row.getCell(1).value)) return;
    imagePlan.push({ productId: text(row.getCell(1).value), category: text(row.getCell(2).value), product: text(row.getCell(3).value), slug: text(row.getCell(4).value), variationCount: Number(text(row.getCell(5).value) || 0), variations: text(row.getCell(6).value), requiredAssets: Number(text(row.getCell(7).value) || 0), recommendedEnvironment: text(row.getCell(8).value), technicalDetails: text(row.getCell(9).value), status: text(row.getCell(10).value) });
  });
  const assets: Array<Record<string, unknown>> = [];
  assetManifestSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 5 || !text(row.getCell(1).value)) return;
    const rawProductId = text(row.getCell(2).value);
    assets.push({ id: text(row.getCell(1).value), productId: rawProductId.startsWith("PROD-") ? rawProductId : null, category: text(row.getCell(3).value), product: text(row.getCell(4).value), slug: text(row.getCell(5).value), assetClass: text(row.getCell(6).value), type: text(row.getCell(7).value), galleryOrder: Number(text(row.getCell(8).value) || 0), variation: text(row.getCell(9).value) || null, fileName: text(row.getCell(10).value), minimumSize: text(row.getCell(11).value), allowedSource: text(row.getCell(12).value), approved: yes(row.getCell(13).value), status: text(row.getCell(14).value), notes: text(row.getCell(15).value) });
  });
  const categoryCovers: Array<Record<string, unknown>> = [];
  categoryCoversSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 5 || !text(row.getCell(1).value)) return;
    categoryCovers.push({ category: text(row.getCell(1).value), format: text(row.getCell(2).value), fileName: text(row.getCell(3).value), minimumSize: text(row.getCell(4).value), visualDirection: text(row.getCell(5).value), allowedSource: text(row.getCell(6).value), status: text(row.getCell(7).value), rules: text(row.getCell(8).value) });
  });
  const optionalPackages: Array<Record<string, unknown>> = [];
  optionalPackagesSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 5 || !text(row.getCell(1).value)) return;
    optionalPackages.push({ productId: text(row.getCell(1).value), category: text(row.getCell(2).value), product: text(row.getCell(3).value), slug: text(row.getCell(4).value), fileName: text(row.getCell(5).value), minimumSize: text(row.getCell(6).value), allowedSource: text(row.getCell(7).value), status: text(row.getCell(8).value), notes: text(row.getCell(9).value) });
  });
  const imagePlanModule = `/* AUTO-GENERATED by scripts/import-catalog-xlsx.ts. Do not edit manually. */\nexport type CatalogImagePlanItem = { productId: string; category: string; product: string; slug: string; variationCount: number; variations: string; requiredAssets: number; recommendedEnvironment: string; technicalDetails: string; status: string };\nexport type CatalogPlannedAsset = { id: string; productId: string | null; category: string; product: string; slug: string; assetClass: string; type: string; galleryOrder: number; variation: string | null; fileName: string; minimumSize: string; allowedSource: string; approved: boolean; status: string; notes: string };\nexport type CatalogCategoryCover = { category: string; format: string; fileName: string; minimumSize: string; visualDirection: string; allowedSource: string; status: string; rules: string };\nexport type CatalogOptionalPackage = { productId: string; category: string; product: string; slug: string; fileName: string; minimumSize: string; allowedSource: string; status: string; notes: string };\nexport const catalogImagePlan: CatalogImagePlanItem[] = ${JSON.stringify(imagePlan, null, 2)};\nexport const catalogPlannedAssets: CatalogPlannedAsset[] = ${JSON.stringify(assets, null, 2)};\nexport const catalogCategoryCovers: CatalogCategoryCover[] = ${JSON.stringify(categoryCovers, null, 2)};\nexport const catalogOptionalPackages: CatalogOptionalPackage[] = ${JSON.stringify(optionalPackages, null, 2)};\n`;
  await writeFile(path.resolve("src/data/catalogImagePlan.ts"), imagePlanModule, "utf8");
  console.log(`Plano de imagens importado: ${assets.length} assets obrigatórios, ${categoryCovers.length} capas e ${optionalPackages.length} embalagens opcionais.`);
}
console.log(`Catálogo importado: ${categoryRows.length} categorias, ${products.length} produtos, ${variationsByProduct.size} grupos de variações.`);
