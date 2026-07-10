/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { brandConfig } from "@/config/brand";
import { campaigns as seedCampaigns } from "@/data/campaigns";
import { categories as seedCategories } from "@/data/categories";
import { products as seedProducts } from "@/data/products";

type Row = Record<string, any>;
type TableName = keyof ReturnType<typeof createInitialState>;

type Filter =
  | { type: "eq"; column: string; value: any }
  | { type: "neq"; column: string; value: any }
  | { type: "in"; column: string; value: any[] }
  | { type: "ilike"; column: string; value: string }
  | { type: "gte"; column: string; value: any }
  | { type: "lte"; column: string; value: any };

function nowIso() {
  return new Date().toISOString();
}

function slugStoragePath(kind: string, slug: string) {
  return `seed/${kind}/${slug}.jpg`;
}

function createInitialState() {
  const storeId = "default-store";
  const categoryRows = seedCategories
    .filter((category) => category.id !== "all")
    .map((category, index) => ({
      id: `category-${category.slug}`,
      store_id: storeId,
      name: category.name,
      slug: category.slug,
      short_name: category.short,
      description: null,
      image_media_id: null,
      seo_title: category.name,
      seo_description: null,
      status: "publicada",
      sort_order: index,
      created_by: "system",
      updated_by: "system",
      created_at: nowIso(),
      updated_at: nowIso(),
    }));

  const mediaRows: Row[] = [];
  const productRows = seedProducts.map((product, index) => {
    const mediaId = `media-product-${product.id}`;
    mediaRows.push({
      id: mediaId,
      store_id: storeId,
      file_name: `${product.id}.jpg`,
      original_file_name: `${product.id}.jpg`,
      file_url: product.image,
      storage_path: slugStoragePath("produto", product.id),
      mime_type: "image/jpeg",
      size: 0,
      width: null,
      height: null,
      type: "produto",
      title: product.name,
      alt_text: product.name,
      description: product.description,
      tags: [],
      status: "publicado",
      created_by: "system",
      updated_by: "system",
      created_at: nowIso(),
      updated_at: nowIso(),
      archived_at: null,
    });

    return {
      id: `product-${product.id}`,
      store_id: storeId,
      category_id: `category-${product.categoryId}`,
      primary_media_id: mediaId,
      name: product.name,
      slug: product.id,
      short_description: product.description,
      description: product.longDescription,
      technical_specs: product.specs ?? [],
      benefits: product.benefits ?? [],
      applications: product.applications ?? [],
      environments: product.environments ?? [],
      tags: [],
      whatsapp_message: `Ola! Tenho interesse em ${product.name}.`,
      seo_title: product.name,
      seo_description: product.description,
      status: "publicado",
      is_featured: Boolean(product.featured),
      sort_order: index,
      unit: product.unit ?? null,
      price_label: product.price ?? "Sob consulta",
      section_key: product.sectionId ?? null,
      created_by: "system",
      updated_by: "system",
      created_at: nowIso(),
      updated_at: nowIso(),
      published_at: nowIso(),
      archived_at: null,
    };
  });

  const campaignRows = seedCampaigns.map((campaign, index) => {
    const mediaId = `media-campaign-${campaign.slug}`;
    mediaRows.push({
      id: mediaId,
      store_id: storeId,
      file_name: `${campaign.slug}.jpg`,
      original_file_name: `${campaign.slug}.jpg`,
      file_url: campaign.banner,
      storage_path: slugStoragePath("campanha", campaign.slug),
      mime_type: "image/jpeg",
      size: 0,
      width: null,
      height: null,
      type: "campanha",
      title: campaign.name,
      alt_text: campaign.name,
      description: campaign.description,
      tags: [],
      status: "publicado",
      created_by: "system",
      updated_by: "system",
      created_at: nowIso(),
      updated_at: nowIso(),
      archived_at: null,
    });

    return {
      id: `campaign-${campaign.slug}`,
      store_id: storeId,
      title: campaign.name,
      slug: campaign.slug,
      subtitle: campaign.tagline,
      description: campaign.description,
      banner_media_id: mediaId,
      cta_label: "Ver campanha",
      whatsapp_message: `Ola! Quero saber mais sobre ${campaign.name}.`,
      start_date: null,
      end_date: null,
      status: campaign.status === "encerrado" ? "encerrada" : "publicada",
      is_featured: true,
      show_on_home: true,
      show_on_totem: true,
      show_on_vitrine: true,
      seo_title: campaign.name,
      seo_description: campaign.description,
      gallery_media_ids: [],
      totem_media_id: mediaId,
      vitrine_media_id: mediaId,
      sort_order: index,
      created_by: "system",
      updated_by: "system",
      created_at: nowIso(),
      updated_at: nowIso(),
      published_at: nowIso(),
      archived_at: null,
    };
  });

  return {
    stores: [
      {
        id: storeId,
        code: "gamel-distribuidora",
        name: brandConfig.defaultStoreName,
        status: "active",
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    auth_users: [
      {
        id: "bootstrap-admin",
        email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@infinitilabs.com.br",
        created_at: nowIso(),
      },
    ],
    user_roles: [] as Row[],
    leads: [] as Row[],
    analytics_events: [] as Row[],
    qrcodes: [] as Row[],
    seo_audits: [] as Row[],
    seo_audit_schedules: [] as Row[],
    content_items: [] as Row[],
    media_assets: mediaRows,
    categories: categoryRows,
    products: productRows,
    product_images: [] as Row[],
    campaigns: campaignRows,
    campaign_products: seedCampaigns.flatMap((campaign) =>
      campaign.productIds.map((productId, index) => ({
        id: `campaign-product-${campaign.slug}-${productId}`,
        campaign_id: `campaign-${campaign.slug}`,
        product_id: `product-${productId}`,
        sort_order: index,
        created_at: nowIso(),
      })),
    ),
    banners: [] as Row[],
    store_settings: [
      {
        store_id: storeId,
        store_name: brandConfig.defaultStoreName,
        logo_media_id: null,
        whatsapp_number: brandConfig.defaultStorePhoneNumber,
        address: brandConfig.defaultStoreAddress,
        opening_hours: brandConfig.defaultStoreOpeningHours,
        instagram_url: brandConfig.defaultInstagramUrl,
        facebook_url: "",
        website_url: null,
        institutional_text: brandConfig.defaultStoreInstitutionalText,
        primary_color: "#1f2329",
        secondary_color: "#F26B1F",
        seo_title: brandConfig.defaultSeoTitle,
        seo_description: brandConfig.defaultSeoDescription,
        hero_banner_media_id: null,
        updated_by: "system",
        updated_at: nowIso(),
      },
    ],
    totem_settings: [
      {
        id: "totem-default-store",
        store_id: storeId,
        welcome_message: "Toque na categoria para comecar.",
        intro_title: "Totem Interativo",
        intro_subtitle: "Explore categorias, campanhas e produtos publicados.",
        idle_reset_seconds: 60,
        primary_qr_target: null,
        hero_media_id: null,
        show_featured_products: true,
        show_campaigns: true,
        show_categories: true,
        category_slugs: [],
        featured_product_slugs: [],
        campaign_slugs: [],
        banner_slugs: [],
        status: "ativo",
        last_seen_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    vitrine_settings: [
      {
        id: "vitrine-default-store",
        store_id: storeId,
        slide_duration_seconds: 8,
        orientation: "paisagem",
        status: "ativo",
        hero_media_id: null,
        show_campaigns: true,
        show_featured_products: true,
        show_qr_codes: true,
        layout_mode: "automatico",
        campaign_slugs: [],
        product_slugs: [],
        banner_slugs: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    audit_logs: [] as Row[],
  };
}

const memoryState = createInitialState();
let pool: Pool | null = null;
let databaseReady: boolean | null = null;

function quoteIdent(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Identificador SQL invalido: ${value}`);
  }
  return `"${value}"`;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalizeValue(item),
      ]),
    );
  }
  return value;
}

function normalizeRow(row: Row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
  );
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl:
        connectionString.includes("sslmode=require") ||
        process.env.DATABASE_SSL === "1" ||
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
  return pool;
}

async function isDatabaseReady() {
  if (databaseReady !== null) return databaseReady;
  const currentPool = getPool();
  if (!currentPool) {
    databaseReady = false;
    return false;
  }
  try {
    await currentPool.query("select 1");
    databaseReady = true;
    return true;
  } catch (error) {
    console.warn("[postgres] fallback em memoria ativado:", (error as Error).message);
    databaseReady = false;
    return false;
  }
}

function applyFilters(rows: Row[], filters: Filter[]) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column];
      switch (filter.type) {
        case "eq":
          return value === filter.value;
        case "neq":
          return value !== filter.value;
        case "in":
          return filter.value.includes(value);
        case "ilike":
          return String(value ?? "")
            .toLowerCase()
            .includes(filter.value.replace(/%/g, "").toLowerCase());
        case "gte":
          return value >= filter.value;
        case "lte":
          return value <= filter.value;
        default:
          return true;
      }
    }),
  );
}

function applyOrders(rows: Row[], orders: Array<{ column: string; ascending: boolean }>) {
  if (orders.length === 0) return rows;
  return [...rows].sort((left, right) => {
    for (const order of orders) {
      const a = left[order.column];
      const b = right[order.column];
      if (a === b) continue;
      if (a == null) return order.ascending ? 1 : -1;
      if (b == null) return order.ascending ? -1 : 1;
      return a > b ? (order.ascending ? 1 : -1) : order.ascending ? -1 : 1;
    }
    return 0;
  });
}

async function loadRelatedRows(table: string, rows: Row[], executor: QueryExecutor) {
  if (rows.length === 0) return rows;

  if (table === "products") {
    const categoryIds = unique(rows.map((row) => row.category_id).filter(Boolean));
    const mediaIds = unique(rows.map((row) => row.primary_media_id).filter(Boolean));
    const productIds = rows.map((row) => row.id);

    const [categories, mediaAssets, productImages] = await Promise.all([
      categoryIds.length > 0
        ? executor("select * from categories where id = any($1::text[])", [categoryIds])
        : Promise.resolve([]),
      mediaIds.length > 0
        ? executor("select * from media_assets where id = any($1::text[])", [mediaIds])
        : Promise.resolve([]),
      executor("select * from product_images where product_id = any($1::text[])", [productIds]),
    ]);

    const imageMediaIds = unique(productImages.map((item) => item.media_asset_id).filter(Boolean));
    const imageAssets =
      imageMediaIds.length > 0
        ? await executor("select * from media_assets where id = any($1::text[])", [imageMediaIds])
        : [];

    const categoryMap = toMap(categories);
    const mediaMap = toMap(mediaAssets);
    const imageMediaMap = toMap(imageAssets);
    const imagesByProduct = groupBy(productImages, "product_id");

    return rows.map((row) => ({
      ...row,
      categories: row.category_id ? (categoryMap.get(row.category_id) ?? null) : null,
      media_assets: row.primary_media_id ? (mediaMap.get(row.primary_media_id) ?? null) : null,
      product_images: (imagesByProduct.get(row.id) ?? []).map((item) => ({
        ...item,
        media_assets: item.media_asset_id ? (imageMediaMap.get(item.media_asset_id) ?? null) : null,
      })),
    }));
  }

  if (table === "categories") {
    const mediaIds = unique(rows.map((row) => row.image_media_id).filter(Boolean));
    const categoryIds = rows.map((row) => row.id);
    const [mediaAssets, products] = await Promise.all([
      mediaIds.length > 0
        ? executor("select * from media_assets where id = any($1::text[])", [mediaIds])
        : Promise.resolve([]),
      executor("select * from products where category_id = any($1::text[])", [categoryIds]),
    ]);

    const mediaMap = toMap(mediaAssets);
    const productsByCategory = groupBy(products, "category_id");

    return rows.map((row) => ({
      ...row,
      media_assets: row.image_media_id ? (mediaMap.get(row.image_media_id) ?? null) : null,
      products: productsByCategory.get(row.id) ?? [],
    }));
  }

  if (table === "campaigns") {
    const mediaIds = unique(rows.map((row) => row.banner_media_id).filter(Boolean));
    const campaignIds = rows.map((row) => row.id);
    const [mediaAssets, campaignProducts] = await Promise.all([
      mediaIds.length > 0
        ? executor("select * from media_assets where id = any($1::text[])", [mediaIds])
        : Promise.resolve([]),
      executor("select * from campaign_products where campaign_id = any($1::text[])", [
        campaignIds,
      ]),
    ]);

    const productIds = unique(campaignProducts.map((row) => row.product_id).filter(Boolean));
    const products =
      productIds.length > 0
        ? await executor("select * from products where id = any($1::text[])", [productIds])
        : [];

    const mediaMap = toMap(mediaAssets);
    const productsMap = toMap(products);
    const campaignProductsByCampaign = groupBy(campaignProducts, "campaign_id");

    return rows.map((row) => ({
      ...row,
      media_assets: row.banner_media_id ? (mediaMap.get(row.banner_media_id) ?? null) : null,
      campaign_products: (campaignProductsByCampaign.get(row.id) ?? []).map((item) => ({
        ...item,
        products: item.product_id ? (productsMap.get(item.product_id) ?? null) : null,
      })),
    }));
  }

  return rows;
}

function attachRelationsMemory(table: string, row: Row) {
  if (table === "products") {
    return {
      ...row,
      categories: memoryState.categories.find((item) => item.id === row.category_id) ?? null,
      media_assets:
        memoryState.media_assets.find((item) => item.id === row.primary_media_id) ?? null,
      product_images: memoryState.product_images
        .filter((item) => item.product_id === row.id)
        .map((item) => ({
          ...item,
          media_assets:
            memoryState.media_assets.find((media) => media.id === item.media_asset_id) ?? null,
        })),
    };
  }

  if (table === "categories") {
    return {
      ...row,
      media_assets: memoryState.media_assets.find((item) => item.id === row.image_media_id) ?? null,
      products: memoryState.products.filter((product) => product.category_id === row.id),
    };
  }

  if (table === "campaigns") {
    return {
      ...row,
      media_assets:
        memoryState.media_assets.find((item) => item.id === row.banner_media_id) ?? null,
      campaign_products: memoryState.campaign_products
        .filter((item) => item.campaign_id === row.id)
        .map((item) => ({
          ...item,
          products: memoryState.products.find((product) => product.id === item.product_id) ?? null,
        })),
    };
  }

  return row;
}

function unique(values: any[]) {
  return [...new Set(values)];
}

function toMap(rows: Row[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function groupBy(rows: Row[], key: string) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const value = String(row[key] ?? "");
    const current = map.get(value) ?? [];
    current.push(row);
    map.set(value, current);
  }
  return map;
}

type QueryExecutor = (sql: string, params?: any[]) => Promise<Row[]>;

class TableBuilder implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitValue: number | null = null;
  private mutation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row[] = [];
  private countMode: boolean;
  private headMode: boolean;
  private onConflict: string | undefined;

  constructor(
    private readonly table: TableName,
    options?: { count?: "exact"; head?: boolean },
  ) {
    this.countMode = options?.count === "exact";
    this.headMode = Boolean(options?.head);
  }

  select(_columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (options?.count === "exact") this.countMode = true;
    if (options?.head) this.headMode = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ type: "in", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mutation = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: Row) {
    this.mutation = "update";
    this.payload = [payload];
    return this;
  }

  delete() {
    this.mutation = "delete";
    return this;
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.mutation = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    this.onConflict = options?.onConflict;
    return this;
  }

  async single() {
    const result = await this.execute();
    const row = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    if (!row) {
      return { data: null, error: { message: "No rows found" } };
    }
    return { data: row, error: null };
  }

  async maybeSingle() {
    const result = await this.execute();
    const row = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return { data: row, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (await isDatabaseReady()) {
      return this.executePostgres();
    }
    return this.executeMemory();
  }

  private async executeMemory() {
    const rows = memoryState[this.table] as Row[];
    const filtered = applyOrders(applyFilters(rows, this.filters), this.orders);
    const limited = this.limitValue == null ? filtered : filtered.slice(0, this.limitValue);

    if (this.mutation === "select") {
      return {
        data: this.headMode ? null : limited.map((row) => attachRelationsMemory(this.table, row)),
        error: null,
        count: this.countMode ? filtered.length : null,
      };
    }

    if (this.mutation === "insert") {
      const inserted = this.payload.map((item) => ({
        id: item.id ?? randomUUID(),
        created_at: item.created_at ?? nowIso(),
        updated_at: item.updated_at ?? nowIso(),
        ...item,
      }));
      rows.push(...inserted);
      return {
        data: inserted.map((row) => attachRelationsMemory(this.table, row)),
        error: null,
      };
    }

    if (this.mutation === "upsert") {
      const nextRows = this.payload.map((item) => {
        const identity =
          item.id != null
            ? rows.find((row) => row.id === item.id)
            : rows.find((row) => this.matchesConflictRow(item, row));
        if (identity) {
          Object.assign(identity, item, { updated_at: nowIso() });
          return identity;
        }
        const created = {
          id: item.id ?? randomUUID(),
          created_at: item.created_at ?? nowIso(),
          updated_at: item.updated_at ?? nowIso(),
          ...item,
        };
        rows.push(created);
        return created;
      });
      return {
        data: nextRows.map((row) => attachRelationsMemory(this.table, row)),
        error: null,
      };
    }

    if (this.mutation === "update") {
      const updated = limited.map((row) =>
        Object.assign(row, this.payload[0], { updated_at: nowIso() }),
      );
      return { data: updated.map((row) => attachRelationsMemory(this.table, row)), error: null };
    }

    if (this.mutation === "delete") {
      const removed = new Set(limited.map((row) => row.id));
      memoryState[this.table] = rows.filter((row) => !removed.has(row.id)) as never;
      return { data: limited, error: null };
    }

    return { data: null, error: null };
  }

  private matchesConflictRow(payload: Row, row: Row) {
    if (!this.onConflict) return false;
    return this.onConflict
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .every((column) => row[column] === payload[column]);
  }

  private buildWhere(startIndex = 1) {
    const params: any[] = [];
    const parts: string[] = [];
    let index = startIndex;

    for (const filter of this.filters) {
      const column = quoteIdent(filter.column);
      switch (filter.type) {
        case "eq":
          parts.push(`${column} = $${index++}`);
          params.push(filter.value);
          break;
        case "neq":
          parts.push(`${column} <> $${index++}`);
          params.push(filter.value);
          break;
        case "in":
          if (!filter.value.length) {
            parts.push("1 = 0");
          } else {
            parts.push(`${column} = ANY($${index++})`);
            params.push(filter.value);
          }
          break;
        case "ilike":
          parts.push(`${column} ILIKE $${index++}`);
          params.push(filter.value);
          break;
        case "gte":
          parts.push(`${column} >= $${index++}`);
          params.push(filter.value);
          break;
        case "lte":
          parts.push(`${column} <= $${index++}`);
          params.push(filter.value);
          break;
      }
    }

    return {
      clause: parts.length > 0 ? ` WHERE ${parts.join(" AND ")}` : "",
      params,
      nextIndex: index,
    };
  }

  private async executePostgres() {
    const currentPool = getPool();
    if (!currentPool) {
      return this.executeMemory();
    }

    const table = quoteIdent(this.table);
    const queryRows: QueryExecutor = async (sql, params = []) => {
      const result = await currentPool.query(sql, params);
      return result.rows.map((row) => normalizeRow(row) as Row);
    };

    const { clause, params } = this.buildWhere();
    const orderClause =
      this.orders.length > 0
        ? ` ORDER BY ${this.orders
            .map((order) => `${quoteIdent(order.column)} ${order.ascending ? "ASC" : "DESC"}`)
            .join(", ")}`
        : "";
    const limitClause = this.limitValue != null ? ` LIMIT ${Number(this.limitValue)}` : "";

    if (this.mutation === "select") {
      const count = this.countMode
        ? Number(
            (
              await currentPool.query(
                `SELECT COUNT(*)::int AS count FROM ${table}${clause}`,
                params,
              )
            ).rows[0]?.count ?? 0,
          )
        : null;

      if (this.headMode) {
        return { data: null, error: null, count };
      }

      const rows = await queryRows(
        `SELECT * FROM ${table}${clause}${orderClause}${limitClause}`,
        params,
      );
      return {
        data: await loadRelatedRows(this.table, rows, queryRows),
        error: null,
        count,
      };
    }

    if (this.mutation === "insert") {
      const rows = this.withMutationDefaults(this.payload);
      const columns = unique(rows.flatMap((row) => Object.keys(row)));
      const values = rows.map((row) => columns.map((column) => row[column] ?? null));
      const flatValues = values.flat();
      const valuesClause = values
        .map((items, rowIndex) => {
          const start = rowIndex * columns.length;
          return `(${items.map((_, index) => `$${start + index + 1}`).join(", ")})`;
        })
        .join(", ");

      const resultRows = await queryRows(
        `INSERT INTO ${table} (${columns.map((column) => quoteIdent(column)).join(", ")}) VALUES ${valuesClause} RETURNING *`,
        flatValues,
      );
      return { data: await loadRelatedRows(this.table, resultRows, queryRows), error: null };
    }

    if (this.mutation === "upsert") {
      const rows = this.withMutationDefaults(this.payload);
      const columns = unique(rows.flatMap((row) => Object.keys(row)));
      const values = rows.map((row) => columns.map((column) => row[column] ?? null));
      const flatValues = values.flat();
      const valuesClause = values
        .map((items, rowIndex) => {
          const start = rowIndex * columns.length;
          return `(${items.map((_, index) => `$${start + index + 1}`).join(", ")})`;
        })
        .join(", ");
      const conflictColumns = (this.onConflict ?? "id")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const updateColumns = columns.filter((column) => !conflictColumns.includes(column));

      const resultRows = await queryRows(
        `INSERT INTO ${table} (${columns.map((column) => quoteIdent(column)).join(", ")}) VALUES ${valuesClause}
         ON CONFLICT (${conflictColumns.map((column) => quoteIdent(column)).join(", ")})
         DO UPDATE SET ${updateColumns
           .map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`)
           .join(", ")}
         RETURNING *`,
        flatValues,
      );
      return { data: await loadRelatedRows(this.table, resultRows, queryRows), error: null };
    }

    if (this.mutation === "update") {
      const payload = this.withMutationDefaults(this.payload, false)[0];
      const entries = Object.entries(payload).filter(([key]) => key !== "id");
      const assignments = entries.map(([column], index) => `${quoteIdent(column)} = $${index + 1}`);
      const values = entries.map(([, value]) => value);
      const nextWhere = this.buildWhere(entries.length + 1);
      const resultRows = await queryRows(
        `UPDATE ${table} SET ${assignments.join(", ")}${nextWhere.clause} RETURNING *`,
        [...values, ...nextWhere.params],
      );
      return { data: await loadRelatedRows(this.table, resultRows, queryRows), error: null };
    }

    if (this.mutation === "delete") {
      const selectedRows = await queryRows(
        `SELECT * FROM ${table}${clause}${orderClause}${limitClause}`,
        params,
      );
      await currentPool.query(`DELETE FROM ${table}${clause}`, params);
      return { data: selectedRows, error: null };
    }

    return { data: null, error: null };
  }

  private withMutationDefaults(rows: Row[], includeCreatedAt = true) {
    return rows.map((row) => ({
      ...(row.id ? { id: row.id } : { id: randomUUID() }),
      ...(includeCreatedAt ? { created_at: row.created_at ?? nowIso() } : {}),
      updated_at: row.updated_at ?? nowIso(),
      ...row,
    }));
  }
}

export const databaseAdmin = {
  from(table: TableName) {
    return new TableBuilder(table);
  },
  auth: {
    admin: {
      async listUsers() {
        if (await isDatabaseReady()) {
          const currentPool = getPool();
          const result = await currentPool!.query(
            "select * from auth_users order by created_at asc",
          );
          return {
            data: {
              users: result.rows.map((row) => normalizeRow(row)),
            },
            error: null,
          };
        }
        return { data: { users: memoryState.auth_users }, error: null };
      },
    },
  },
};

export function hasDatabaseAccess() {
  return Boolean(process.env.DATABASE_URL);
}
