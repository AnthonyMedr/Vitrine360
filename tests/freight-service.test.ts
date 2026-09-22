import test from "node:test";
import assert from "node:assert/strict";
import { appConfig } from "../server/config.ts";
import { readDb, writeDb } from "../server/db.ts";
import { freightService } from "../server/freight-service.ts";

const originalFetch = globalThis.fetch;
const originalCepBaseUrl = process.env.CEPCERTO_CEP_BASE_URL;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function resetFreightState() {
  const db = readDb();
  db.freightQuoteCache = [];
  db.freightQuoteHistory = [];
  db.freightErrorLogs = [];
  writeDb(db);
  appConfig.freightProvider = "melhor-envio";
  appConfig.melhorEnvio.token = "melhor-token";
  appConfig.melhorEnvio.originZipCode = "55290000";
  appConfig.correios.token = "correios-token";
  appConfig.correios.originZipCode = "55290000";
  appConfig.correios.services = [{ code: "03220", name: "SEDEX" }];
  appConfig.cepCerto.token = "cepcerto-token";
  process.env.CEPCERTO_CEP_BASE_URL = "https://cepcerto.test/cep";
}

function quoteInput() {
  const db = readDb();
  const product = db.products.find((item) => item.is_active) ?? db.products[0];
  assert.ok(product);
  return {
    cep: "01001000",
    subtotal: 300,
    items: [{ product, quantity: 1 }],
  };
}

test.beforeEach(() => {
  resetFreightState();
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCepBaseUrl === undefined) {
    delete process.env.CEPCERTO_CEP_BASE_URL;
  } else {
    process.env.CEPCERTO_CEP_BASE_URL = originalCepBaseUrl;
  }
});

test("freight service blocks invalid CEP before provider calls", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({});
  }) as typeof fetch;

  const result = await freightService.quote({ ...quoteInput(), cep: "123" });

  assert.equal(result.ok, false);
  assert.equal(result.message, "CEP invalido.");
  assert.equal(calls, 0);
});

test("freight service returns Melhor Envio quote when primary provider works", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("cepcerto.test")) {
      return jsonResponse({ cidade: "Sao Paulo", uf: "SP" });
    }
    if (url.includes("melhorenvio")) {
      return jsonResponse([
        {
          id: 1,
          name: "PAC",
          price: "31.90",
          delivery_time: 5,
          company: { name: "Correios via Melhor Envio" },
        },
      ]);
    }
    return jsonResponse({});
  }) as typeof fetch;

  const result = await freightService.quote(quoteInput());

  assert.equal(result.ok, true);
  assert.equal(result.provider, "melhor-envio");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.options[0].price, 31.9);
  assert.ok(urls.some((url) => url.includes("melhorenvio")));
});

test("freight service falls back to Correios when Melhor Envio returns provider error", async () => {
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("cepcerto.test")) {
      return jsonResponse({ cidade: "Sao Paulo", uf: "SP" });
    }
    if (url.includes("melhorenvio")) {
      return jsonResponse({ message: "provider down" }, 500);
    }
    if (url.includes("/preco/")) {
      return jsonResponse({ coProduto: "03220", pcFinal: "27,40", psCobrado: "800" });
    }
    if (url.includes("/prazo/")) {
      return jsonResponse({ coProduto: "03220", prazoEntrega: 3 });
    }
    return jsonResponse({});
  }) as typeof fetch;

  const result = await freightService.quote(quoteInput());

  assert.equal(result.ok, true);
  assert.equal(result.provider, "correios");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.options[0].name, "SEDEX");
  assert.equal(result.options[0].price, 27.4);
  assert.equal(result.options[0].estimatedDays, "3");
});

test("freight service handles network error and still returns Correios fallback", async () => {
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("cepcerto.test")) {
      return jsonResponse({ cidade: "Sao Paulo", uf: "SP" });
    }
    if (url.includes("melhorenvio")) {
      throw new Error("timeout:10");
    }
    if (url.includes("/preco/")) {
      return jsonResponse({ coProduto: "03220", pcFinal: "29,99" });
    }
    if (url.includes("/prazo/")) {
      return jsonResponse({ coProduto: "03220", prazoEntrega: 4 });
    }
    return jsonResponse({});
  }) as typeof fetch;

  const result = await freightService.quote(quoteInput());

  assert.equal(result.ok, true);
  assert.equal(result.provider, "correios");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.options[0].isCheapest, true);
  assert.equal(result.options[0].isFastest, true);
});

test("freight service persists history and serves repeated quote from cache", async () => {
  let providerCalls = 0;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("cepcerto.test")) {
      return jsonResponse({ cidade: "Sao Paulo", uf: "SP" });
    }
    if (url.includes("melhorenvio")) {
      providerCalls += 1;
      return jsonResponse([
        {
          id: 2,
          name: "SEDEX",
          price: "41.00",
          delivery_time: 2,
          company: { name: "Correios via Melhor Envio" },
        },
      ]);
    }
    return jsonResponse({});
  }) as typeof fetch;

  const first = await freightService.quote(quoteInput());
  const second = await freightService.quote(quoteInput());
  const db = readDb();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.cacheHit, true);
  assert.equal(providerCalls, 1);
  assert.ok(db.freightQuoteCache.length > 0);
  assert.ok(db.freightQuoteHistory.some((entry) => entry.provider === "melhor-envio" && entry.status === "success"));
});
