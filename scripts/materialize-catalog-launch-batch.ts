import { readDb, writeDb } from "../server/db";
import { getCatalogLaunchBatch, refreshCatalogStagingItem } from "../server/catalog-staging";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseLimit(argv: string[]) {
  const raw = Number(argv[0] || 12);
  if (!Number.isFinite(raw) || raw <= 0) return 12;
  return Math.min(Math.floor(raw), 60);
}

function parseStagingIds(argv: string[]) {
  const flagIndex = argv.findIndex((entry) => entry === "--ids");
  if (flagIndex === -1) return [];
  return String(argv[flagIndex + 1] || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSourceBatch(argv: string[]) {
  const flagIndex = argv.findIndex((entry) => entry === "--source-batch");
  if (flagIndex === -1) return null;
  const raw = String(argv[flagIndex + 1] || "").trim();
  return raw || null;
}

const args = process.argv.slice(2);
const limit = parseLimit(args);
const stagingIds = parseStagingIds(args);
const sourceBatch = parseSourceBatch(args);
const db = readDb();
const batch = getCatalogLaunchBatch(db, limit);
const candidates =
  stagingIds.length > 0
    ? stagingIds.map((id) => db.catalogStaging.find((entry) => entry.id === id)).filter(Boolean)
    : sourceBatch
      ? batch.shortlist
          .map((entry) => db.catalogStaging.find((item) => item.id === entry.id))
          .filter((item) => item && item.source_batch === sourceBatch)
          .slice(0, limit)
      : batch.shortlist.map((entry) => db.catalogStaging.find((item) => item.id === entry.id)).filter(Boolean);
const materialized: Array<{ staging_item_id: string; mapped_product_id: string }> = [];
const now = new Date().toISOString();

for (const item of candidates) {
  if (!item) continue;

  const currentMappedProduct = item.mapped_product_id ? db.products.find((entry) => entry.id === item.mapped_product_id) ?? null : null;
  const reusableDraftProduct =
    currentMappedProduct && currentMappedProduct.status_product === "draft" && currentMappedProduct.is_active === false ? currentMappedProduct : null;

  if (!reusableDraftProduct) {
    const category = db.categories.find((entry) => entry.name === item.category_name) ?? null;
    const brand = db.brands.find((entry) => entry.name === item.brand_name) ?? null;
    const productId = createId();
    const slugBase = slugify(item.normalized_name);
    const slug = db.products.some((entry) => entry.slug === slugBase) ? `${slugBase}-${Date.now().toString().slice(-4)}` : slugBase;

    db.products.unshift({
      id: productId,
      sku: item.sku_base ? `${item.sku_base}-ORIGEM` : `GML-${Date.now().toString().slice(-6)}`,
      name: item.normalized_name,
      slug,
      ncm: item.suggested_ncm || null,
      cest: null,
      origin_code: item.suggested_origin_code || "0",
      product_origin: "nacional",
      fiscal_group: item.suggested_family || item.category_name,
      tax_classification_status: "review",
      cost_price: item.cost_price,
      margin_target: 0.35,
      subcategory: item.subcategory_name,
      description: item.import_notes,
      short_description: item.import_notes,
      long_description: item.import_notes,
      application: item.subcategory_name,
      sale_type: "unidade",
      unit_measure: "un",
      display_unit: "un",
      base_price: item.suggested_price ?? 0,
      promotional_price: null,
      price: item.suggested_price ?? 0,
      original_price: null,
      category_id: category?.id ?? null,
      brand_id: brand?.id ?? null,
      sales_unit: "un",
      measures: item.size,
      material: item.category_name,
      diameter: item.size,
      weight: item.suggested_weight ?? null,
      dimensions: item.suggested_dimensions ?? null,
      width: null,
      height: null,
      length: null,
      thickness: null,
      linear_measure: null,
      square_measure: null,
      area_per_piece: null,
      area_per_box: null,
      area_per_package: null,
      meters_per_piece: null,
      pieces_per_box: null,
      meters_per_box: null,
      meters_per_package: null,
      volume_per_unit: null,
      volume_per_package: null,
      weight_per_unit: null,
      weight_per_package: null,
      pieces_per_package: null,
      packaging_closed: null,
      open_package_allowed: null,
      minimum_sale_quantity: null,
      sale_multiple: null,
      fractional_sale_allowed: null,
      default_loss_margin: null,
      loss_margin: null,
      stock_minimum: 1,
      unit: "un",
      stock: item.estimated_stock ?? 0,
      status_product: "draft",
      availability: "sob_consulta",
      delivery_type: "pickup_or_delivery",
      is_on_request: true,
      is_heavy: false,
      is_bulky: false,
      top_seller: false,
      related_product_ids: [],
      variations: [],
      is_active: false,
      is_featured: false,
      rating: 0,
      review_count: 0,
      image_url: "/placeholder.svg",
      images: ["/placeholder.svg"],
      created_at: now,
    });

    db.fiscalProfiles.push({
      id: createId(),
      product_id: productId,
      establishment_id: "est-comercial",
      ncm: item.suggested_ncm || null,
      cest: null,
      cfop_internal_default: "5102",
      cfop_interstate_default: "6102",
      origin_code: item.suggested_origin_code || "0",
      cst_icms_default: null,
      csosn_default: null,
      requires_difal: true,
      requires_fcp: true,
      tax_rule_status: "pending",
      notes: "Produto origem criado a partir do lote inicial do staging; validar com contabilidade.",
      updated_at: now,
    });

    item.mapped_product_id = productId;
  } else {
    reusableDraftProduct.name = item.normalized_name;
    reusableDraftProduct.slug = slugify(item.normalized_name);
    reusableDraftProduct.cost_price = item.cost_price ?? reusableDraftProduct.cost_price ?? null;
    reusableDraftProduct.base_price = item.suggested_price ?? reusableDraftProduct.base_price ?? reusableDraftProduct.price;
    reusableDraftProduct.price = item.suggested_price ?? reusableDraftProduct.price;
    reusableDraftProduct.stock = item.estimated_stock ?? reusableDraftProduct.stock;
    reusableDraftProduct.tax_classification_status = "review";
    reusableDraftProduct.status_product = "draft";
    reusableDraftProduct.availability = "sob_consulta";
    reusableDraftProduct.is_on_request = true;
    reusableDraftProduct.is_active = false;
    reusableDraftProduct.is_featured = false;
    item.mapped_product_id = reusableDraftProduct.id;
  }

  refreshCatalogStagingItem(db, item);
  item.review_status = "review";
  item.review_reason = "Produto origem draft preparado para saneamento e aprovacao manual.";
  materialized.push({ staging_item_id: item.id, mapped_product_id: item.mapped_product_id! });
}

writeDb(db);
console.log(
  JSON.stringify(
    {
      ok: true,
      requested_limit: limit,
      requested_ids: stagingIds,
      requested_source_batch: sourceBatch,
      selected: candidates.length,
      materialized: materialized.length,
      items: materialized,
    },
    null,
    2,
  ),
);
