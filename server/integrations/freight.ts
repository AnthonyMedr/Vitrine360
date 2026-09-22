import crypto from "node:crypto";
import { appConfig } from "../config";
import type { DbOrderAddress, DbProduct } from "../db";
import { fetchWithTimeout } from "./http";

export type FreightQuoteOption = {
  id: string;
  name: string;
  price: number;
  estimatedDays: string;
  description: string;
  deliveryType: "pickup" | "delivery";
  zoneId?: string | null;
  provider?: string;
  isCheapest?: boolean;
  isFastest?: boolean;
};

type FreightItem = {
  product: DbProduct;
  quantity: number;
};

function estimatePackageDimensions(items: FreightItem[]) {
  const estimateItemWeight = (item: FreightItem) => {
    const product = item.product;
    if (Number(product.weight) > 0) return Number(product.weight);
    if (Number(product.weight_per_unit) > 0) return Number(product.weight_per_unit);
    if (Number(product.weight_per_package) > 0 && Number(product.pieces_per_package) > 0) {
      return Number(product.weight_per_package) / Number(product.pieces_per_package);
    }
    if (Number(product.weight_per_package) > 0) return Number(product.weight_per_package);
    return 0.8;
  };
  const width = Math.max(20, Math.ceil(items.reduce((max, item) => Math.max(max, Number(item.product.width || 0) * 100), 0)));
  const height = Math.max(
    4,
    Math.ceil(items.reduce((sum, item) => sum + Math.max(Number(item.product.thickness || item.product.height || 0) * 100, 0.4) * item.quantity, 0)),
  );
  const length = Math.max(20, Math.ceil(items.reduce((max, item) => Math.max(max, Number(item.product.length || item.product.height || 0) * 100), 0)));
  const weight = Math.max(0.3, Number(items.reduce((sum, item) => sum + estimateItemWeight(item) * item.quantity, 0).toFixed(2)));
  return { width, height, length, weight };
}

function getMelhorEnvioBaseUrl() {
  return appConfig.melhorEnvio.sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
}

function parseCorreiosPrice(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function getNumberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseCorreiosPrice(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function getStringField(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function productDimensionCm(value: unknown, fallback: number) {
  const numeric = Number(value || 0);
  if (numeric > 0) return Math.max(1, Math.ceil(numeric * 100));
  return fallback;
}

function productWeightKg(product: DbProduct) {
  if (Number(product.weight) > 0) return Number(product.weight);
  if (Number(product.weight_per_unit) > 0) return Number(product.weight_per_unit);
  if (Number(product.weight_per_package) > 0 && Number(product.pieces_per_package) > 0) {
    return Number(product.weight_per_package) / Number(product.pieces_per_package);
  }
  if (Number(product.weight_per_package) > 0) return Number(product.weight_per_package);
  return 0.8;
}

function buildCorreiosUrl(baseUrl: string, serviceCode: string, params: Record<string, string | number>) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/nacional/${encodeURIComponent(serviceCode)}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function quoteFrenetFreight(input: {
  to: DbOrderAddress;
  items: FreightItem[];
  declaredValue: number;
}) {
  if (!appConfig.frenet.token || !appConfig.frenet.originZipCode) {
    return { ok: false, provider: "frenet", options: [] as FreightQuoteOption[] };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      appConfig.frenet.quoteUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          token: appConfig.frenet.token,
        },
        body: JSON.stringify({
          SellerCEP: appConfig.frenet.originZipCode,
          RecipientCEP: input.to.zipCode.replace(/\D/g, ""),
          ShipmentInvoiceValue: Number(input.declaredValue.toFixed(2)),
          ShippingServiceCode: null,
          RecipientCountry: "BR",
          ShippingItemArray: input.items.map((item) => ({
            Height: productDimensionCm(item.product.thickness || item.product.height, 2),
            Length: productDimensionCm(item.product.length || item.product.height, 20),
            Quantity: item.quantity,
            Weight: Number(productWeightKg(item.product).toFixed(3)),
            Width: productDimensionCm(item.product.width, 20),
            SKU: item.product.sku || item.product.id,
            Category: "acabamento",
          })),
        }),
      },
      appConfig.frenet.requestTimeoutMs,
    );
  } catch {
    return { ok: false, provider: "frenet", options: [] as FreightQuoteOption[] };
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !data) return { ok: false, provider: "frenet", options: [] as FreightQuoteOption[] };
  const services = (data.ShippingSevicesArray || data.ShippingServicesArray || []) as unknown;
  const entries = Array.isArray(services) ? services : [];
  const options = entries
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .filter((entry) => !entry.Error)
    .map((entry) => {
      const code = getStringField(entry, ["ServiceCode", "CarrierCode"], crypto.randomUUID());
      const carrier = getStringField(entry, ["Carrier"], "Frenet");
      const service = getStringField(entry, ["ServiceDescription", "Service"], "Frete Frenet");
      return {
        id: `frenet-${code}`,
        name: service,
        price: getNumberField(entry, ["ShippingPrice", "OriginalShippingPrice", "price"]),
        estimatedDays: getStringField(entry, ["DeliveryTime", "OriginalDeliveryTime"], "-"),
        description: carrier,
        deliveryType: "delivery" as const,
        zoneId: null,
        provider: "frenet",
      };
    })
    .filter((option) => option.price > 0);

  return { ok: options.length > 0, provider: "frenet", options };
}

async function quoteFreteBaratoFreight(input: {
  to: DbOrderAddress;
  items: FreightItem[];
  declaredValue: number;
}) {
  if (!appConfig.freteBarato.token || !appConfig.freteBarato.customerId) {
    return { ok: false, provider: "frete-barato", options: [] as FreightQuoteOption[] };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${appConfig.freteBarato.baseUrl.replace(/\/$/, "")}/${appConfig.freteBarato.platform}/price/v1/json/${encodeURIComponent(appConfig.freteBarato.customerId)}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${appConfig.freteBarato.token}`,
          "User-Agent": appConfig.melhorEnvio.appName,
        },
        body: JSON.stringify({
          zipcode: input.to.zipCode.replace(/\D/g, ""),
          amount: Number(input.declaredValue.toFixed(2)),
          skus: input.items.map((item) => ({
            sku: item.product.sku || item.product.id,
            price: Number(item.product.price || 0),
            quantity: item.quantity,
            length: productDimensionCm(item.product.length || item.product.height, 20),
            width: productDimensionCm(item.product.width, 20),
            height: productDimensionCm(item.product.thickness || item.product.height, 2),
            weight: Number(productWeightKg(item.product).toFixed(3)),
          })),
        }),
      },
      appConfig.freteBarato.requestTimeoutMs,
    );
  } catch {
    return { ok: false, provider: "frete-barato", options: [] as FreightQuoteOption[] };
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
  if (!response.ok || quotes.length === 0) return { ok: false, provider: "frete-barato", options: [] as FreightQuoteOption[] };

  const options = quotes
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const name = getStringField(entry, ["service", "name"], "Frete Barato");
      return {
        id: `frete-barato-${getStringField(entry, ["quote_id", "service", "name"], crypto.randomUUID())}`,
        name,
        price: getNumberField(entry, ["price"]),
        estimatedDays: getStringField(entry, ["days"], "-"),
        description: getStringField(entry, ["name"], "Frete Barato"),
        deliveryType: "delivery" as const,
        zoneId: null,
        provider: "frete-barato",
      };
    })
    .filter((option) => option.price > 0);

  return { ok: options.length > 0, provider: "frete-barato", options };
}

function collectCepCertoEntries(data: unknown) {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return [];
  const candidates = [record.frete, record.fretes, record.services, record.servicos, record.options, record.opcoes, record.resultado];
  const arrayCandidate = candidates.find(Array.isArray);
  if (Array.isArray(arrayCandidate)) return arrayCandidate;
  return Object.entries(record)
    .filter(([, value]) => asRecord(value))
    .map(([key, value]) => ({ ...(value as Record<string, unknown>), service: key }));
}

async function quoteCepCertoFreight(input: {
  to: DbOrderAddress;
  items: FreightItem[];
  declaredValue: number;
}) {
  if (!appConfig.cepCerto.token || !appConfig.cepCerto.originZipCode) {
    return { ok: false, provider: "cepcerto", options: [] as FreightQuoteOption[] };
  }

  const dimensions = estimatePackageDimensions(input.items);
  const url = [
    appConfig.cepCerto.baseUrl.replace(/\/$/, ""),
    appConfig.cepCerto.originZipCode,
    input.to.zipCode.replace(/\D/g, ""),
    Math.max(300, Math.ceil(dimensions.weight * 1000)),
    Math.max(1, dimensions.height),
    Math.max(11, dimensions.width),
    Math.max(13, dimensions.length),
    Math.max(26, Number(input.declaredValue.toFixed(2))),
    0,
    0,
    encodeURIComponent(appConfig.cepCerto.token),
  ].join("/");

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, appConfig.cepCerto.requestTimeoutMs);
  } catch {
    return { ok: false, provider: "cepcerto", options: [] as FreightQuoteOption[] };
  }

  const data = await response.json().catch(() => null);
  const options = collectCepCertoEntries(data)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const name = getStringField(entry, ["service", "servico", "nome", "name", "tipo"], "CepCerto");
      return {
        id: `cepcerto-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || crypto.randomUUID()}`,
        name,
        price: getNumberField(entry, ["valor", "preco", "price", "frete", "custo"]),
        estimatedDays: getStringField(entry, ["prazo", "days", "entrega", "delivery_time"], "-"),
        description: "CepCerto",
        deliveryType: "delivery" as const,
        zoneId: null,
        provider: "cepcerto",
      };
    })
    .filter((option) => option.price > 0);

  return { ok: response.ok && options.length > 0, provider: "cepcerto", options };
}

async function quoteCorreiosFreight(input: {
  to: DbOrderAddress;
  items: FreightItem[];
  declaredValue: number;
}) {
  if (!appConfig.correios.token || !appConfig.correios.originZipCode || appConfig.correios.services.length === 0) {
    return { ok: false, provider: "correios", options: [] as FreightQuoteOption[] };
  }

  const dimensions = estimatePackageDimensions(input.items);
  const commonParams = {
    cepOrigem: appConfig.correios.originZipCode,
    cepDestino: input.to.zipCode.replace(/\D/g, ""),
  };
  const packageParams = {
    ...commonParams,
    psObjeto: Math.max(300, Math.ceil(dimensions.weight * 1000)),
    tpObjeto: "2",
    comprimento: Math.max(16, dimensions.length),
    largura: Math.max(11, dimensions.width),
    altura: Math.max(2, dimensions.height),
  };

  const options: FreightQuoteOption[] = [];
  for (const service of appConfig.correios.services) {
    let priceResponse: Response;
    let prazoResponse: Response | null = null;
    try {
      priceResponse = await fetchWithTimeout(
        buildCorreiosUrl(appConfig.correios.precoBaseUrl, service.code, packageParams),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${appConfig.correios.token}`,
          },
        },
        appConfig.correios.requestTimeoutMs,
      );
      prazoResponse = await fetchWithTimeout(
        buildCorreiosUrl(appConfig.correios.prazoBaseUrl, service.code, commonParams),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${appConfig.correios.token}`,
          },
        },
        appConfig.correios.requestTimeoutMs,
      );
    } catch {
      continue;
    }

    const priceData = (await priceResponse.json().catch(() => null)) as Record<string, unknown> | null;
    const prazoData = (await prazoResponse?.json().catch(() => null)) as Record<string, unknown> | null;
    if (!priceResponse.ok || !priceData || priceData.txErro) continue;

    const price = parseCorreiosPrice(priceData.pcFinal || priceData.precoFinal || priceData.valor);
    if (price <= 0) continue;

    const prazoEntrega = prazoResponse?.ok && prazoData && !prazoData.txErro ? Number(prazoData.prazoEntrega || 0) : 0;
    options.push({
      id: `correios-${service.code}`,
      name: service.name,
      price,
      estimatedDays: prazoEntrega > 0 ? `${prazoEntrega}` : "-",
      description: `Correios ${service.name}`,
      deliveryType: "delivery",
      zoneId: null,
      provider: "correios",
    });
  }

  return { ok: options.length > 0, provider: "correios", options };
}

export async function quoteExternalFreight(input: {
  to: DbOrderAddress;
  items: FreightItem[];
  declaredValue: number;
}) {
  if (appConfig.freightProvider === "fake") {
    if (appConfig.fakeFreight.fail) {
      return { ok: false, provider: "fake", options: [] as FreightQuoteOption[] };
    }

    return {
      ok: true,
      provider: "fake",
      options: [
        {
          id: "fake-standard",
          name: "Frete homologacao",
          price: Math.max(0, appConfig.fakeFreight.price),
          estimatedDays: appConfig.fakeFreight.estimatedDays,
          description: "Cotacao fixa para teste interno sem transportadora real.",
          deliveryType: "delivery" as const,
          zoneId: null,
          provider: "fake",
        },
      ],
    };
  }

  if (appConfig.freightProvider === "correios") {
    return quoteCorreiosFreight(input);
  }

  if (appConfig.freightProvider === "frenet") {
    return quoteFrenetFreight(input);
  }

  if (appConfig.freightProvider === "frete-barato" || appConfig.freightProvider === "fretebarato") {
    return quoteFreteBaratoFreight(input);
  }

  if (appConfig.freightProvider === "cepcerto") {
    return quoteCepCertoFreight(input);
  }

  if (appConfig.freightProvider !== "melhor-envio" || !appConfig.melhorEnvio.token || !appConfig.melhorEnvio.originZipCode) {
    return { ok: false, provider: appConfig.freightProvider, options: [] as FreightQuoteOption[] };
  }

  const dimensions = estimatePackageDimensions(input.items);
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${getMelhorEnvioBaseUrl()}/api/v2/me/shipment/calculate`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${appConfig.melhorEnvio.token}`,
          "User-Agent": `${appConfig.melhorEnvio.appName} (${appConfig.melhorEnvio.contactEmail})`,
        },
        body: JSON.stringify({
          from: {
            postal_code: appConfig.melhorEnvio.originZipCode,
          },
          to: {
            postal_code: input.to.zipCode.replace(/\D/g, ""),
          },
          products: input.items.map((item, index) => ({
            id: item.product.id || String(index + 1),
            width: dimensions.width,
            height: Math.max(1, Math.ceil(dimensions.height / Math.max(input.items.length, 1))),
            length: dimensions.length,
            weight: Math.max(0.1, Number((dimensions.weight / Math.max(input.items.length, 1)).toFixed(2))),
            insurance_value: Number(((item.product.price || 0) * item.quantity).toFixed(2)),
            quantity: item.quantity,
          })),
          options: {
            receipt: false,
            own_hand: false,
          },
        }),
      },
      appConfig.melhorEnvio.requestTimeoutMs,
    );
  } catch {
    return quoteCorreiosFreight(input);
  }

  const data = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  if (!response.ok || !Array.isArray(data)) {
    return quoteCorreiosFreight(input);
  }

  const options = data
    .filter((entry) => !entry.error)
    .map((entry) => {
      const company = typeof entry.company === "object" && entry.company ? (entry.company as { name?: string }) : null;
      return {
      id: `melhor-envio-${String(entry.id || entry.name || crypto.randomUUID())}`,
      name: String(entry.name || "Frete externo"),
      price: Number(entry.custom_price || entry.price || 0),
      estimatedDays: `${entry.custom_delivery_time || entry.delivery_time || "-"}`,
      description: String(company?.name || "Cotacao externa"),
      deliveryType: "delivery" as const,
      zoneId: null,
      provider: "melhor-envio",
      };
    });

  if (options.length === 0) {
    return quoteCorreiosFreight(input);
  }

  return { ok: true, provider: "melhor-envio", options };
}
