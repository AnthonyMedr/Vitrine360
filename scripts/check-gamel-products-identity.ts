import fs from "node:fs";
import path from "node:path";
import { initializeDb, readDb, type DatabaseShape } from "../server/db.ts";
import { getAdminCatalogImageAudit } from "../server/catalog-image-audit.ts";
import { categories as seedCategories, products as seedProducts } from "../src/data/products.ts";

type Issue = {
  code: string;
  severity: "blocker" | "warning";
  product_id?: string | null;
  detail: string;
};

function addDuplicateIssues<T>(issues: Issue[], items: T[], keyName: string, getKey: (item: T) => string | null, getLabel: (item: T) => string) {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = getKey(item)?.trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), getLabel(item)]);
  }
  for (const [key, labels] of groups) {
    if (labels.length <= 1) continue;
    issues.push({
      code: `duplicate.${keyName}`,
      severity: "blocker",
      detail: `${keyName} duplicado "${key}" em: ${labels.join(", ")}`,
    });
  }
}

function validateSeedCatalog(issues: Issue[]) {
  addDuplicateIssues(issues, seedProducts, "seed.id", (product) => product.id, (product) => `${product.id}/${product.slug}`);
  addDuplicateIssues(issues, seedProducts, "seed.slug", (product) => product.slug, (product) => `${product.id}/${product.name}`);

  const seedCategoryNames = new Set(seedCategories.map((category) => category.name));
  for (const product of seedProducts) {
    if (!product.id?.trim()) {
      issues.push({ code: "seed.missing_id", severity: "blocker", product_id: null, detail: `Produto seed sem ID: ${product.name || "<sem nome>"}` });
    }
    if (!product.slug?.trim()) {
      issues.push({ code: "seed.missing_slug", severity: "blocker", product_id: product.id, detail: `Produto seed sem slug: ${product.name || product.id}` });
    }
    if (!product.name?.trim()) {
      issues.push({ code: "seed.missing_name", severity: "blocker", product_id: product.id, detail: `Produto seed sem nome: ${product.id}` });
    }
    if (!seedCategoryNames.has(product.category)) {
      issues.push({
        code: "seed.category_missing",
        severity: "blocker",
        product_id: product.id,
        detail: `Produto seed "${product.name}" aponta para categoria inexistente: ${product.category}`,
      });
    }
    if (!product.images?.length) {
      issues.push({ code: "seed.image_missing", severity: "blocker", product_id: product.id, detail: `Produto seed sem imagem: ${product.name}` });
    }
  }
}

function validateRuntimeCatalog(db: DatabaseShape, issues: Issue[]) {
  addDuplicateIssues(issues, db.products, "db.id", (product) => product.id, (product) => `${product.id}/${product.slug}`);
  addDuplicateIssues(issues, db.products, "db.slug", (product) => product.slug, (product) => `${product.id}/${product.name}`);
  addDuplicateIssues(issues, db.products, "db.sku", (product) => product.sku ?? null, (product) => `${product.id}/${product.name}`);

  const categoryIds = new Set(db.categories.map((category) => category.id));
  for (const product of db.products) {
    if (!product.id?.trim()) {
      issues.push({ code: "db.missing_id", severity: "blocker", detail: `Produto persistido sem ID: ${product.name || "<sem nome>"}` });
    }
    if (!product.slug?.trim()) {
      issues.push({ code: "db.missing_slug", severity: "blocker", product_id: product.id, detail: `Produto persistido sem slug: ${product.name || product.id}` });
    }
    if (!product.name?.trim()) {
      issues.push({ code: "db.missing_name", severity: "blocker", product_id: product.id, detail: `Produto persistido sem nome: ${product.id}` });
    }
    if (product.is_active && (!product.category_id || !categoryIds.has(product.category_id))) {
      issues.push({
        code: "db.public_category_missing",
        severity: "blocker",
        product_id: product.id,
        detail: `Produto ativo sem categoria publica valida: ${product.name}`,
      });
    }
    const images = [product.image_url, ...(product.images ?? [])].filter(Boolean);
    if (product.is_active && images.length === 0) {
      issues.push({ code: "db.public_image_missing", severity: "blocker", product_id: product.id, detail: `Produto ativo sem imagem: ${product.name}` });
    }
    if (product.image_url && product.image_alt_text && !hasSharedToken(product.name, product.image_alt_text)) {
      issues.push({
        code: "db.image_alt_text_drift",
        severity: "warning",
        product_id: product.id,
        detail: `Alt text pode estar divergente do nome comercial: ${product.name}`,
      });
    }
  }
}

function validateImageAudit(db: DatabaseShape, issues: Issue[]) {
  const audit = getAdminCatalogImageAudit(db);
  if (audit.summary.critical > 0 || audit.summary.suspect > 0 || audit.summary.manual_review > 0) {
    issues.push({
      code: "images.audit_not_clean",
      severity: "blocker",
      detail: `Auditoria de imagens precisa estar limpa. OK=${audit.summary.ok}, suspeitas=${audit.summary.suspect}, criticas=${audit.summary.critical}, revisao_manual=${audit.summary.manual_review}.`,
    });
  }
  if (audit.summary.ok !== audit.summary.total) {
    issues.push({
      code: "images.audit_not_all_ok",
      severity: "blocker",
      detail: `Auditoria de imagens esperava todos os itens OK. OK=${audit.summary.ok}/${audit.summary.total}.`,
    });
  }
}

function hasSharedToken(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  return Array.from(leftTokens).some((token) => rightTokens.has(token));
}

function tokenize(value: string) {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
}

await initializeDb();
const db = readDb();
const issues: Issue[] = [];
validateSeedCatalog(issues);
validateRuntimeCatalog(db, issues);
validateImageAudit(db, issues);

const blockers = issues.filter((issue) => issue.severity === "blocker");
const warnings = issues.filter((issue) => issue.severity === "warning");
const report = {
  ok: blockers.length === 0,
  scope: "GAMEL Fase 1 - identidade de produtos, catalogo publico e Admin Produtos",
  totals: {
    seed_products: seedProducts.length,
    db_products: db.products.length,
    blockers: blockers.length,
    warnings: warnings.length,
  },
  issues,
};

const reportsDir = path.resolve(process.cwd(), "docs", "reports");
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, "gamel-products-identity-check.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
