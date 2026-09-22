import type { DatabaseShape, DbFreightCarrier, DbOrder, DbOrderItem, DbProduct } from "./db";

export interface FreightCarrierRecommendation {
  carrier: DbFreightCarrier;
  eligible: boolean;
  reasons: string[];
}

export interface OrderFreightProfile {
  order_id: string;
  destination_state: string | null;
  total_weight_kg: number;
  total_cubic_meters: number;
  max_length_cm: number;
  has_heavy: boolean;
  has_bulky: boolean;
  items_count: number;
  recommendations: FreightCarrierRecommendation[];
}

function toCm(value: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 0;
  const numeric = Number(value);
  return numeric <= 10 ? numeric * 100 : numeric;
}

function getItemQuantity(item: DbOrderItem) {
  return Math.max(Number(item.quantity_final ?? item.quantity ?? 1), 1);
}

function getProductWeightKg(product: DbProduct | null, item: DbOrderItem) {
  const itemWeight = Number(item.total_weight_kg || 0);
  if (itemWeight > 0) return itemWeight;
  const quantity = getItemQuantity(item);
  const productWeight = Number(product?.weight_per_unit || product?.weight || 0);
  if (productWeight > 0) return productWeight * quantity;
  const packageWeight = Number(product?.weight_per_package || 0);
  if (packageWeight > 0) return packageWeight * Math.max(Number(item.calculated_packages || item.calculated_boxes || 1), 1);
  return 0;
}

function getProductCubicMeters(product: DbProduct | null, item: DbOrderItem) {
  const itemCubic = Number(item.total_cubic_meters || 0);
  if (itemCubic > 0) return itemCubic;
  const quantity = getItemQuantity(item);
  const productVolume = Number(product?.volume_per_unit || product?.volume_per_package || 0);
  if (productVolume > 0) return productVolume * quantity;
  const width = Number(product?.width || 0);
  const height = Number(product?.height || 0);
  const length = Number(product?.length || 0);
  if (width > 0 && height > 0 && length > 0) return width * height * length * quantity;
  return 0;
}

function getProductMaxLengthCm(product: DbProduct | null) {
  return Math.max(toCm(product?.length), toCm(product?.height), toCm(product?.width));
}

export function buildOrderFreightProfile(db: DatabaseShape, order: DbOrder): OrderFreightProfile {
  const items = db.orderItems.filter((item) => item.order_id === order.id);
  const itemProfiles = items.map((item) => {
    const product = db.products.find((entry) => entry.id === item.product_id) ?? null;
    return {
      item,
      product,
      weightKg: getProductWeightKg(product, item),
      cubicMeters: getProductCubicMeters(product, item),
      maxLengthCm: getProductMaxLengthCm(product),
      isHeavy: Boolean(product?.is_heavy),
      isBulky: Boolean(product?.is_bulky),
    };
  });

  const profile = {
    order_id: order.id,
    destination_state: order.shipping_address?.state?.toUpperCase() || null,
    total_weight_kg: Number(itemProfiles.reduce((sum, item) => sum + item.weightKg, 0).toFixed(3)),
    total_cubic_meters: Number(itemProfiles.reduce((sum, item) => sum + item.cubicMeters, 0).toFixed(4)),
    max_length_cm: Number(Math.max(0, ...itemProfiles.map((item) => item.maxLengthCm)).toFixed(1)),
    has_heavy: itemProfiles.some((item) => item.isHeavy),
    has_bulky: itemProfiles.some((item) => item.isBulky),
    items_count: items.length,
    recommendations: [] as FreightCarrierRecommendation[],
  };

  profile.recommendations = db.freightCarriers
    .filter((carrier) => carrier.is_active)
    .map((carrier) => {
      const reasons: string[] = [];
      const coverage = carrier.coverage_states.map((state) => state.toUpperCase());
      if (profile.destination_state && !coverage.includes("BR") && !coverage.includes(profile.destination_state)) {
        reasons.push(`Nao atende ${profile.destination_state}`);
      }
      if (carrier.max_weight_kg && profile.total_weight_kg > carrier.max_weight_kg) {
        reasons.push(`Peso acima de ${carrier.max_weight_kg} kg`);
      }
      if (carrier.max_length_cm && profile.max_length_cm > carrier.max_length_cm) {
        reasons.push(`Comprimento acima de ${carrier.max_length_cm} cm`);
      }
      if (carrier.max_cubic_meters && profile.total_cubic_meters > carrier.max_cubic_meters) {
        reasons.push(`Cubagem acima de ${carrier.max_cubic_meters} m3`);
      }
      if (profile.has_heavy && !carrier.supports_heavy) {
        reasons.push("Nao aceita item pesado");
      }
      if (profile.has_bulky && !carrier.supports_bulky) {
        reasons.push("Nao aceita item volumoso");
      }
      return {
        carrier,
        eligible: reasons.length === 0,
        reasons: reasons.length ? reasons : ["Elegivel para cotacao operacional"],
      };
    })
    .sort((left, right) => Number(right.eligible) - Number(left.eligible) || (left.carrier.max_weight_kg || 999999) - (right.carrier.max_weight_kg || 999999));

  return profile;
}
