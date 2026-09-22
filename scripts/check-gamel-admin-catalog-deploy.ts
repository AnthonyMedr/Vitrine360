import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { categories, products } from "../src/data/products";

type Issue = {
  id: string;
  severity: "blocker" | "warning";
  detail: string;
};

const issues: Issue[] = [];

function addIssue(severity: Issue["severity"], id: string, detail: string) {
  issues.push({ severity, id, detail });
}

function assetExists(assetPath: string) {
  if (!assetPath.startsWith("/assets/")) return true;
  return existsSync(path.join(process.cwd(), "public", assetPath.replace(/^\//, "")));
}

const expectedCategories = [
  "ripados-internos-externos",
  "chapas-uv",
  "chapas-policarbonato",
  "tetos-laminados-vinilicos",
  "pisos-vinilicos",
  "forros-pvc",
  "telha-fibrocimento",
  "telha-pvc",
  "acm",
  "perfil-aluminio",
  "drywall-acessorios",
];

const categorySlugs = categories.map((category) => category.slug);
for (const slug of expectedCategories) {
  if (!categorySlugs.includes(slug)) {
    addIssue("blocker", `category.missing.${slug}`, `Categoria obrigatoria ausente: ${slug}.`);
  }
}

if (products.length < 48) {
  addIssue("blocker", "catalog.product_count", `Catalogo deveria ter pelo menos 48 produtos; encontrado ${products.length}.`);
}

const ripados = products.filter((product) => product.category === "Ripados internos e externos");
const tetos = products.filter((product) => product.category === "Tetos Laminados Vinilicos");
if (ripados.length < 13) addIssue("blocker", "catalog.ripados_count", `Ripados abaixo do esperado: ${ripados.length}/13.`);
if (tetos.length < 17) addIssue("blocker", "catalog.tetos_count", `Tetos Laminados abaixo do esperado: ${tetos.length}/17.`);

for (const category of categories) {
  if (!assetExists(category.image)) {
    addIssue("blocker", `category.image_missing.${category.slug}`, `Imagem de categoria nao encontrada: ${category.image}.`);
  }
}

for (const product of products) {
  if (!product.images.length) {
    addIssue("blocker", `product.no_image.${product.slug}`, `Produto sem imagem: ${product.name}.`);
    continue;
  }
  for (const image of product.images) {
    if (!assetExists(image)) {
      addIssue("blocker", `product.image_missing.${product.slug}`, `Imagem de produto nao encontrada: ${image}.`);
    }
  }
  if (product.price < 0) {
    addIssue("blocker", `product.invalid_price.${product.slug}`, `Preco negativo em ${product.name}.`);
  }
}

if (process.env.VITE_ECOMMERCE_ENABLED === "true") {
  addIssue("blocker", "feature.ecommerce_enabled", "FEATURE_FLAGS.ecommerce precisa ficar false na Fase 1.");
}

const featureFlagsSource = readFileSync(path.join(process.cwd(), "src/config/featureFlags.ts"), "utf8");
if (!/ecommerce:\s*import\.meta\.env\.VITE_ECOMMERCE_ENABLED\s*===\s*"true"/.test(featureFlagsSource)) {
  addIssue("warning", "feature.ecommerce_contract", "Contrato da flag VITE_ECOMMERCE_ENABLED mudou; revisar Fase 1.");
}

const adminShell = readFileSync(path.join(process.cwd(), "src/components/admin/AdminWorkspaceShell.tsx"), "utf8");
if (/PVC<\/div>|Central Admin/.test(adminShell)) {
  addIssue("blocker", "admin.legacy_brand", "Admin ainda contem marca visual legada PVC/Central Admin.");
}
if (!adminShell.includes("futureEcommerce")) {
  addIssue("warning", "admin.future_ecommerce_marker", "Marcadores futureEcommerce nao foram encontrados na navegacao admin.");
}

const publicCatalog = readFileSync(path.join(process.cwd(), "src/pages/Products.tsx"), "utf8");
if (/Comprar agora|Adicionar ao carrinho|checkout|pagamento online/i.test(publicCatalog)) {
  addIssue("blocker", "public_catalog.ecommerce_copy", "Catalogo publico contem copy de e-commerce completo.");
}

const report = {
  ok: issues.every((issue) => issue.severity !== "blocker"),
  scope: "GAMEL Admin + Catalogo Fase 1",
  ecommerce_future: "stand_by",
  metrics: {
    categories: categories.length,
    products: products.length,
    ripados: ripados.length,
    tetos_laminados: tetos.length,
    blockers: issues.filter((issue) => issue.severity === "blocker").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  },
  issues,
};

const outDir = path.join(process.cwd(), "docs/reports");
writeFileSync(path.join(outDir, "gamel-admin-catalog-deploy-check-latest.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(
  path.join(outDir, "gamel-admin-catalog-deploy-check-latest.md"),
  [
    "# GAMEL Admin + Catalogo - Deploy Check",
    "",
    `Status: ${report.ok ? "OK" : "BLOQUEADO"}`,
    "",
    `- Categorias: ${report.metrics.categories}`,
    `- Produtos: ${report.metrics.products}`,
    `- Ripados: ${report.metrics.ripados}`,
    `- Tetos Laminados: ${report.metrics.tetos_laminados}`,
    `- Blockers: ${report.metrics.blockers}`,
    `- Warnings: ${report.metrics.warnings}`,
    "",
    "## Issues",
    "",
    ...issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.id}: ${issue.detail}`),
    issues.length ? "" : "- Nenhuma issue encontrada.",
  ].join("\n"),
);

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
