import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { Server } from "node:http";

if (process.env.APP_ENV === "production" && !process.argv.includes("--allow-production")) {
  console.error("load-smoke bloqueado em producao. Use apenas ambiente local/homologacao isolada.");
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gamel-load-smoke-"));
process.env.DATA_DIR = dataDir;
process.env.DB_PROVIDER = "sqlite";
process.env.QUEUE_PROVIDER = "auto";
process.env.DATABASE_URL = "";
process.env.REDIS_URL = "";
process.env.APP_ENV = process.env.APP_ENV || "test";

const { startServer, stopServer } = await import("../server/index.ts");

function getSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function getCookieValue(setCookieHeaders: string[], cookieName: string) {
  const cookieHeader = setCookieHeaders.find((entry) => entry.startsWith(`${cookieName}=`));
  return cookieHeader?.split(";")[0]?.slice(cookieName.length + 1) ?? null;
}

async function timeRequest(label: string, fn: () => Promise<Response>) {
  const startedAt = performance.now();
  const response = await fn();
  const durationMs = Math.round(performance.now() - startedAt);
  return { label, status: response.status, ok: response.ok, durationMs };
}

const server = (await startServer(0)) as Server;
if (!server.listening) await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Porta local nao resolvida");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const catalog = await fetch(`${baseUrl}/api/products?limit=3`);
  const products = (await catalog.json()) as Array<{ slug: string; name: string; category?: { name?: string | null; slug?: string | null } | null }>;
  const firstProduct = products[0];
  if (!firstProduct?.slug) throw new Error("Catalogo nao retornou produto para teste");
  const categoryPath = firstProduct.category?.slug ? `/categoria/${firstProduct.category.slug}` : "/categorias";

  const routeChecks = await Promise.all([
    timeRequest("home", () => fetch(`${baseUrl}/`)),
    timeRequest("catalogo", () => fetch(`${baseUrl}/produtos`)),
    timeRequest("categoria", () => fetch(`${baseUrl}${categoryPath}`)),
    timeRequest("produto_publico", () => fetch(`${baseUrl}/produto/${firstProduct.slug}`)),
    timeRequest("orcamento", () => fetch(`${baseUrl}/orcamento?produto=${encodeURIComponent(firstProduct.slug)}`)),
    timeRequest("quem_somos", () => fetch(`${baseUrl}/sobre`)),
    timeRequest("contato", () => fetch(`${baseUrl}/contato`)),
    timeRequest("politicas", () => fetch(`${baseUrl}/politicas`)),
    timeRequest("fallback_publico_controlado", () => fetch(`${baseUrl}/rota-inexistente-gamel-smoke`)),
    timeRequest("api_products", () => fetch(`${baseUrl}/api/products?paged=true&page=1&pageSize=12`)),
    timeRequest("api_product_detail", () => fetch(`${baseUrl}/api/products/${firstProduct.slug}`)),
    timeRequest("api_categories", () => fetch(`${baseUrl}/api/categories`)),
  ]);

  const quoteChecks = [];
  for (let index = 0; index < 3; index += 1) {
    const csrfBootstrap = await fetch(`${baseUrl}/api/health`);
    const csrf = getCookieValue(getSetCookieHeaders(csrfBootstrap), "lojao_csrf");
    if (!csrf) throw new Error("CSRF nao retornado no teste de carga");
    quoteChecks.push(await timeRequest(`quote_${index + 1}`, () => fetch(`${baseUrl}/api/quote-requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf,
        cookie: `lojao_csrf=${csrf}`,
      },
      body: JSON.stringify({
        customer: {
          name: `Teste Carga GAMEL ${index + 1}`,
          whatsapp: `87981818${String(700 + index).padStart(3, "0")}`,
          cnpj: "12345678000199",
          city: "Garanhuns",
          state: "PE",
        },
        items: [
          {
            productId: firstProduct.slug,
            productSlug: firstProduct.slug,
            quantity: 1,
          },
        ],
        message: "Teste local de carga leve da Fase 1.",
        preference: "whatsapp",
        pageOrigin: `/produto/${firstProduct.slug}`,
        utm: { source: "load-smoke" },
        consent: true,
        idempotencyKey: `load-smoke-${Date.now()}-${index}`,
      }),
    })));
  }

  // Concurrency check: fires N requests at once instead of sequentially, to catch issues
  // that only show up under simultaneous access (single-instance server, in-memory db state).
  const concurrentReadCount = 20;
  const concurrentReadStartedAt = performance.now();
  const concurrentReads = await Promise.all(
    Array.from({ length: concurrentReadCount }, (_, index) =>
      timeRequest(`concurrent_read_${index + 1}`, () => fetch(`${baseUrl}/api/products?limit=3`)),
    ),
  );
  const concurrentReadTotalMs = Math.round(performance.now() - concurrentReadStartedAt);

  const concurrentQuoteCount = 5;
  const concurrentQuoteStartedAt = performance.now();
  const concurrentQuoteCsrfBootstrap = await fetch(`${baseUrl}/api/health`);
  const concurrentQuoteCsrf = getCookieValue(getSetCookieHeaders(concurrentQuoteCsrfBootstrap), "lojao_csrf");
  if (!concurrentQuoteCsrf) throw new Error("CSRF nao retornado no teste de concorrencia");
  const concurrentQuotes = await Promise.all(
    Array.from({ length: concurrentQuoteCount }, (_, index) =>
      timeRequest(`concurrent_quote_${index + 1}`, () => fetch(`${baseUrl}/api/quote-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": concurrentQuoteCsrf,
          cookie: `lojao_csrf=${concurrentQuoteCsrf}`,
        },
        body: JSON.stringify({
          customer: {
            name: `Teste Concorrencia GAMEL ${index + 1}`,
            whatsapp: `87981819${String(700 + index).padStart(3, "0")}`,
            cnpj: "12345678000199",
            city: "Garanhuns",
            state: "PE",
          },
          items: [{ productId: firstProduct.slug, productSlug: firstProduct.slug, quantity: 1 }],
          message: "Teste local de concorrencia da Fase 1.",
          preference: "whatsapp",
          pageOrigin: `/produto/${firstProduct.slug}`,
          consent: true,
          idempotencyKey: `load-smoke-concurrent-${Date.now()}-${index}`,
        }),
      })),
    ),
  );
  const concurrentQuoteTotalMs = Math.round(performance.now() - concurrentQuoteStartedAt);

  const results = [...routeChecks, ...quoteChecks, ...concurrentReads, ...concurrentQuotes];
  const failures = results.filter((entry) => !entry.ok);
  const report = {
    ok: failures.length === 0,
    baseUrl,
    generated_at: new Date().toISOString(),
    scope: "GAMEL Fase 1 load smoke local (sequencial + concorrencia leve, nao substitui teste de carga com ferramenta dedicada)",
    requests: results.length,
    max_duration_ms: Math.max(...results.map((entry) => entry.durationMs)),
    concurrency: {
      concurrent_reads: concurrentReadCount,
      concurrent_reads_total_ms: concurrentReadTotalMs,
      concurrent_quotes: concurrentQuoteCount,
      concurrent_quotes_total_ms: concurrentQuoteTotalMs,
    },
    failures,
    results,
  };

  const reportsDir = path.resolve(process.cwd(), "docs", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, "gamel-phase1-load-smoke-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await stopServer(server);
  fs.rmSync(dataDir, { recursive: true, force: true });
}
