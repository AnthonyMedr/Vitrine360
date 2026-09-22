import {
  createId,
  hashPassword,
  type DatabaseShape,
  type DbBrand,
  type DbCategory,
  type DbCommercialSettings,
  type DbDeliveryZone,
  type DbFreightCarrier,
  type DbSeller,
  type DbStore,
  type DbUser,
} from "./db";
import { appConfig } from "./config";
import { createAuditEvent } from "./order-domain";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function attachSellerMetadata(user: DbUser, seller: DbSeller, store: DbStore | null) {
  user.user_metadata.store_id = store?.id ?? null;
  user.user_metadata.store_name = store?.name ?? null;
  user.user_metadata.can_start_assisted_sale = true;
  (user.user_metadata as Record<string, unknown>).allowed_stores = seller.allowed_store_ids;
}

export function buildSellerView(db: DatabaseShape, seller: DbSeller) {
  const user = db.users.find((item) => item.id === seller.user_id) ?? null;
  const store = seller.primary_store_id ? db.stores.find((item) => item.id === seller.primary_store_id) ?? null : null;
  return {
    ...seller,
    email: user?.email ?? null,
    full_name: user?.user_metadata?.full_name ?? seller.display_name,
    user: user
      ? {
          email: user.email,
          role: user.role,
          full_name: user.user_metadata?.full_name ?? seller.display_name,
        }
      : null,
    store_name: store?.name ?? null,
    allowed_stores: db.stores.filter((item) => seller.allowed_store_ids.includes(item.id)),
  };
}

export function createAdminBrand(input: {
  db: DatabaseShape;
  body: Partial<DbBrand>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  if (!isNonEmptyString(body.name || "")) {
    return { ok: false as const, status: 400, message: "Informe o nome da marca" };
  }

  const name = String(body.name).trim();
  const slug = slugify(name);
  if (db.brands.some((item) => item.slug === slug)) {
    return { ok: false as const, status: 409, message: "Ja existe uma marca com este nome" };
  }

  const brand: DbBrand = {
    id: createId(),
    name,
    slug,
    is_active: body.is_active ?? true,
  };
  db.brands.push(brand);
  createAuditEvent(db, {
    eventType: "catalog.brand_created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { brand_id: brand.id, brand_name: brand.name, is_active: brand.is_active },
  });
  return { ok: true as const, status: 201, payload: brand };
}

export function updateAdminBrand(input: {
  db: DatabaseShape;
  brandId: string;
  body: Partial<DbBrand>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, brandId, body, actorId, actorName, correlationId } = input;
  const brand = db.brands.find((item) => item.id === brandId);
  if (!brand) {
    return { ok: false as const, status: 404, message: "Marca nao encontrada" };
  }

  const previousValue = { name: brand.name, slug: brand.slug, is_active: brand.is_active };
  if (typeof body.name === "string" && body.name.trim()) {
    const nextName = body.name.trim();
    const nextSlug = slugify(nextName);
    if (db.brands.some((item) => item.slug === nextSlug && item.id !== brand.id)) {
      return { ok: false as const, status: 409, message: "Ja existe uma marca com este nome" };
    }
    brand.name = nextName;
    brand.slug = nextSlug;
  }
  if (typeof body.is_active !== "undefined") brand.is_active = Boolean(body.is_active);

  createAuditEvent(db, {
    eventType: "catalog.brand_updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: { name: brand.name, slug: brand.slug, is_active: brand.is_active },
    payload: { brand_id: brand.id },
  });
  return { ok: true as const, status: 200, payload: brand };
}

export function updateAdminCategory(input: {
  db: DatabaseShape;
  categoryId: string;
  body: Partial<DbCategory>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, categoryId, body, actorId, actorName, correlationId } = input;
  const category = db.categories.find((item) => item.id === categoryId);
  if (!category) {
    return { ok: false as const, status: 404, message: "Categoria nao encontrada" };
  }

  const previousValue = {
    name: category.name,
    slug: category.slug,
    description: category.description,
    image_url: category.image_url,
    sort_order: category.sort_order,
    is_active: category.is_active,
  };

  if (typeof body.name === "string" && body.name.trim()) {
    const nextName = body.name.trim();
    const nextSlug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(nextName);
    if (!nextSlug) {
      return { ok: false as const, status: 400, message: "Informe um slug valido para a categoria" };
    }
    if (db.categories.some((item) => item.id !== category.id && item.slug === nextSlug)) {
      return { ok: false as const, status: 409, message: "Ja existe uma categoria com este slug" };
    }
    category.name = nextName;
    category.slug = nextSlug;
  } else if (typeof body.slug === "string" && body.slug.trim()) {
    const nextSlug = slugify(body.slug);
    if (!nextSlug) {
      return { ok: false as const, status: 400, message: "Informe um slug valido para a categoria" };
    }
    if (db.categories.some((item) => item.id !== category.id && item.slug === nextSlug)) {
      return { ok: false as const, status: 409, message: "Ja existe uma categoria com este slug" };
    }
    category.slug = nextSlug;
  }
  if (typeof body.description !== "undefined") category.description = body.description?.toString().trim() || null;
  if (typeof body.image_url !== "undefined") category.image_url = body.image_url?.toString().trim() || null;
  if (typeof body.icon !== "undefined") category.icon = body.icon?.toString().trim() || undefined;
  if (typeof body.sort_order !== "undefined" && Number.isFinite(Number(body.sort_order))) category.sort_order = Math.max(0, Number(body.sort_order));
  if (typeof body.is_active !== "undefined") category.is_active = Boolean(body.is_active);

  createAuditEvent(db, {
    eventType: "catalog.category_updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: {
      name: category.name,
      slug: category.slug,
      description: category.description,
      image_url: category.image_url,
      sort_order: category.sort_order,
      is_active: category.is_active,
    },
    payload: { category_id: category.id },
  });
  return { ok: true as const, status: 200, payload: category };
}

export function updateCommercialSettings(input: {
  db: DatabaseShape;
  body: Partial<DbCommercialSettings>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  const previousValue = { ...db.commercialSettings };
  db.commercialSettings = {
    ...db.commercialSettings,
    ...body,
  };
  createAuditEvent(db, {
    eventType: "admin.commercial_settings_updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: db.commercialSettings as unknown as Record<string, unknown>,
  });
  return { status: 200, payload: db.commercialSettings };
}

export function createDeliveryZone(input: {
  db: DatabaseShape;
  body: Partial<DbDeliveryZone>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  if (!isNonEmptyString(body.neighborhood || "") || !isNonEmptyString(body.city || "") || !isNonEmptyString(body.state || "")) {
    return { ok: false as const, status: 400, message: "Informe bairro, cidade e UF" };
  }

  const zone: DbDeliveryZone = {
    id: createId(),
    neighborhood: body.neighborhood.trim(),
    city: body.city.trim(),
    state: body.state.trim().toUpperCase(),
    zip_code: body.zip_code?.trim() || null,
    delivery_fee: Number.isFinite(Number(body.delivery_fee)) ? Number(body.delivery_fee) : 0,
    estimated_days: Number.isFinite(Number(body.estimated_days)) ? Math.max(Number(body.estimated_days), 1) : 1,
    notes: body.notes?.trim() || null,
    is_active: body.is_active ?? true,
    allows_pickup: body.allows_pickup ?? true,
    delivery_enabled: body.delivery_enabled ?? true,
  };
  db.deliveryZones.push(zone);
  createAuditEvent(db, {
    eventType: "delivery_zone.created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { delivery_zone_id: zone.id, city: zone.city, neighborhood: zone.neighborhood, state: zone.state },
  });
  return { ok: true as const, status: 201, payload: zone };
}

export function updateDeliveryZone(input: {
  db: DatabaseShape;
  deliveryZoneId: string;
  body: Partial<DbDeliveryZone>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, deliveryZoneId, body, actorId, actorName, correlationId } = input;
  const zone = db.deliveryZones.find((item) => item.id === deliveryZoneId);
  if (!zone) {
    return { ok: false as const, status: 404, message: "Zona de entrega nao encontrada" };
  }

  const previousValue = {
    neighborhood: zone.neighborhood,
    city: zone.city,
    state: zone.state,
    delivery_fee: zone.delivery_fee,
    estimated_days: zone.estimated_days,
    is_active: zone.is_active,
  };
  if (typeof body.neighborhood === "string" && body.neighborhood.trim()) zone.neighborhood = body.neighborhood.trim();
  if (typeof body.city === "string" && body.city.trim()) zone.city = body.city.trim();
  if (typeof body.state === "string" && body.state.trim()) zone.state = body.state.trim().toUpperCase();
  if (typeof body.zip_code !== "undefined") zone.zip_code = body.zip_code?.trim() || null;
  if (typeof body.delivery_fee !== "undefined" && Number.isFinite(Number(body.delivery_fee))) zone.delivery_fee = Number(body.delivery_fee);
  if (typeof body.estimated_days !== "undefined" && Number.isFinite(Number(body.estimated_days))) zone.estimated_days = Math.max(Number(body.estimated_days), 1);
  if (typeof body.notes !== "undefined") zone.notes = body.notes?.trim() || null;
  if (typeof body.is_active !== "undefined") zone.is_active = Boolean(body.is_active);
  if (typeof body.allows_pickup !== "undefined") zone.allows_pickup = Boolean(body.allows_pickup);
  if (typeof body.delivery_enabled !== "undefined") zone.delivery_enabled = Boolean(body.delivery_enabled);

  createAuditEvent(db, {
    eventType: "delivery_zone.updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: {
      neighborhood: zone.neighborhood,
      city: zone.city,
      state: zone.state,
      delivery_fee: zone.delivery_fee,
      estimated_days: zone.estimated_days,
      is_active: zone.is_active,
    },
    payload: { delivery_zone_id: zone.id },
  });
  return { ok: true as const, status: 200, payload: zone };
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function createFreightCarrier(input: {
  db: DatabaseShape;
  body: Partial<DbFreightCarrier>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  if (!isNonEmptyString(body.name || "") || !isNonEmptyString(body.code || "")) {
    return { ok: false as const, status: 400, message: "Informe nome e codigo da transportadora" };
  }
  const code = String(body.code).trim().toUpperCase();
  if (db.freightCarriers.some((item) => item.code === code)) {
    return { ok: false as const, status: 409, message: "Ja existe transportadora com este codigo" };
  }
  const now = new Date().toISOString();
  const carrier: DbFreightCarrier = {
    id: createId(),
    name: String(body.name).trim(),
    code,
    service_types: normalizeList(body.service_types),
    coverage_states: normalizeList(body.coverage_states).map((state) => state.toUpperCase()),
    max_weight_kg: Number.isFinite(Number(body.max_weight_kg)) ? Number(body.max_weight_kg) : null,
    max_length_cm: Number.isFinite(Number(body.max_length_cm)) ? Number(body.max_length_cm) : null,
    max_cubic_meters: Number.isFinite(Number(body.max_cubic_meters)) ? Number(body.max_cubic_meters) : null,
    supports_heavy: Boolean(body.supports_heavy),
    supports_bulky: Boolean(body.supports_bulky),
    tracking_url_template: body.tracking_url_template?.trim() || null,
    notes: body.notes?.trim() || null,
    is_active: body.is_active ?? true,
    created_at: now,
    updated_at: now,
  };
  if (carrier.coverage_states.length === 0) carrier.coverage_states = ["BR"];
  db.freightCarriers.push(carrier);
  createAuditEvent(db, {
    eventType: "freight.carrier_created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { carrier_id: carrier.id, code: carrier.code, name: carrier.name },
  });
  return { ok: true as const, status: 201, payload: carrier };
}

export function updateFreightCarrier(input: {
  db: DatabaseShape;
  carrierId: string;
  body: Partial<DbFreightCarrier>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, carrierId, body, actorId, actorName, correlationId } = input;
  const carrier = db.freightCarriers.find((item) => item.id === carrierId);
  if (!carrier) {
    return { ok: false as const, status: 404, message: "Transportadora nao encontrada" };
  }
  const previousValue = { ...carrier };
  if (typeof body.name === "string" && body.name.trim()) carrier.name = body.name.trim();
  if (typeof body.code === "string" && body.code.trim()) {
    const nextCode = body.code.trim().toUpperCase();
    if (db.freightCarriers.some((item) => item.code === nextCode && item.id !== carrier.id)) {
      return { ok: false as const, status: 409, message: "Ja existe transportadora com este codigo" };
    }
    carrier.code = nextCode;
  }
  if (typeof body.service_types !== "undefined") carrier.service_types = normalizeList(body.service_types);
  if (typeof body.coverage_states !== "undefined") {
    const states = normalizeList(body.coverage_states).map((state) => state.toUpperCase());
    carrier.coverage_states = states.length ? states : ["BR"];
  }
  if (typeof body.max_weight_kg !== "undefined") carrier.max_weight_kg = Number.isFinite(Number(body.max_weight_kg)) ? Number(body.max_weight_kg) : null;
  if (typeof body.max_length_cm !== "undefined") carrier.max_length_cm = Number.isFinite(Number(body.max_length_cm)) ? Number(body.max_length_cm) : null;
  if (typeof body.max_cubic_meters !== "undefined") carrier.max_cubic_meters = Number.isFinite(Number(body.max_cubic_meters)) ? Number(body.max_cubic_meters) : null;
  if (typeof body.supports_heavy !== "undefined") carrier.supports_heavy = Boolean(body.supports_heavy);
  if (typeof body.supports_bulky !== "undefined") carrier.supports_bulky = Boolean(body.supports_bulky);
  if (typeof body.tracking_url_template !== "undefined") carrier.tracking_url_template = body.tracking_url_template?.trim() || null;
  if (typeof body.notes !== "undefined") carrier.notes = body.notes?.trim() || null;
  if (typeof body.is_active !== "undefined") carrier.is_active = Boolean(body.is_active);
  carrier.updated_at = new Date().toISOString();

  createAuditEvent(db, {
    eventType: "freight.carrier_updated",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    previousValue,
    newValue: carrier as unknown as Record<string, unknown>,
    payload: { carrier_id: carrier.id, code: carrier.code },
  });
  return { ok: true as const, status: 200, payload: carrier };
}

export function createStore(input: {
  db: DatabaseShape;
  body: Partial<DbStore>;
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  if (!isNonEmptyString(body.name || "") || !isNonEmptyString(body.code || "")) {
    return { ok: false as const, status: 400, message: "Informe nome e codigo da loja" };
  }

  const normalizedCode = body.code.trim().toUpperCase();
  if (db.stores.some((item) => item.code === normalizedCode)) {
    return { ok: false as const, status: 409, message: "Ja existe uma loja com este codigo" };
  }

  const store: DbStore = {
    id: createId(),
    name: body.name.trim(),
    code: normalizedCode,
    type: body.type || "store",
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    city: body.city?.trim() || "Garanhuns",
    state: body.state?.trim() || "PE",
    is_active: body.is_active ?? true,
    supports_pickup: body.supports_pickup ?? true,
    supports_assisted_sale: body.supports_assisted_sale ?? true,
    delivery_radius_km: typeof body.delivery_radius_km === "number" ? body.delivery_radius_km : null,
    created_at: new Date().toISOString(),
  };
  db.stores.push(store);
  createAuditEvent(db, {
    eventType: "store.created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { store_id: store.id, store_code: store.code, store_name: store.name },
  });
  return { ok: true as const, status: 201, payload: store };
}

export function createSeller(input: {
  db: DatabaseShape;
  body: {
    email?: string;
    password?: string;
    fullName?: string;
    sellerCode?: string;
    roleLabel?: DbSeller["role_label"];
    primaryStoreId?: string | null;
    allowedStoreIds?: string[];
  };
  actorId: string;
  actorName: string;
  correlationId: string;
}) {
  const { db, body, actorId, actorName, correlationId } = input;
  if (!isNonEmptyString(body.email || "") || !isValidEmail(body.email || "")) {
    return { ok: false as const, status: 400, message: "Informe um e-mail valido" };
  }
  if (!isNonEmptyString(body.password || "") || body.password!.trim().length < appConfig.auth.passwordMinLength) {
    return { ok: false as const, status: 400, message: `Informe uma senha com pelo menos ${appConfig.auth.passwordMinLength} caracteres` };
  }
  if (!isNonEmptyString(body.fullName || "")) {
    return { ok: false as const, status: 400, message: "Informe o nome do vendedor" };
  }
  if (db.users.some((item) => item.email.toLowerCase() === normalizeEmail(body.email!))) {
    return { ok: false as const, status: 400, message: "Este e-mail ja esta em uso" };
  }

  const primaryStore = body.primaryStoreId ? db.stores.find((item) => item.id === body.primaryStoreId) ?? null : db.stores[0] ?? null;
  const hashed = hashPassword(body.password!.trim());
  const user: DbUser = {
    id: createId(),
    email: normalizeEmail(body.email!),
    password_hash: hashed.hash,
    password_salt: hashed.salt,
    role: "seller",
    user_metadata: {
      full_name: body.fullName!.trim(),
      store_id: primaryStore?.id ?? null,
      store_name: primaryStore?.name ?? null,
      can_start_assisted_sale: true,
    },
    session_token: null,
    session_expires_at: null,
    is_active: true,
  };
  const seller: DbSeller = {
    id: createId(),
    user_id: user.id,
    seller_code: body.sellerCode?.trim() || `SELLER-${Date.now().toString().slice(-4)}`,
    display_name: body.fullName!.trim(),
    role_label: body.roleLabel || "seller",
    is_active: true,
    primary_store_id: primaryStore?.id ?? null,
    allowed_store_ids: body.allowedStoreIds?.length ? body.allowedStoreIds : primaryStore ? [primaryStore.id] : [],
    created_at: new Date().toISOString(),
  };
  attachSellerMetadata(user, seller, primaryStore);
  db.users.push(user);
  db.sellers.push(seller);
  createAuditEvent(db, {
    eventType: "seller.created",
    correlationId,
    actorId,
    actorName,
    sourceChannel: "integration",
    payload: { seller_id: seller.id, seller_code: seller.seller_code, seller_name: seller.display_name, user_id: user.id },
  });
  return { ok: true as const, status: 201, payload: seller };
}
