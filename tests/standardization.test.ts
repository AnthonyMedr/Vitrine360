import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { categories, products } from "../src/data/products";
import { calculateCommercialLine } from "../src/lib/commercial-calculation";

test("seed catalog keeps GAMEL phase 1 departments and products", () => {
  assert.deepEqual(categories.map((category) => category.slug), [
    "forros-em-pvc",
    "tetos-vinilicos",
    "pisos-vinilicos",
    "ripados-internos",
    "ripados-externos",
    "chapas-uv",
    "chapas-de-policarbonato",
  ]);
  assert.equal(products.length, 43);
  assert.equal(products.filter((product) => product.category === "Ripados Internos").length, 6);
  assert.equal(products.filter((product) => product.category === "Tetos Vinílicos").length, 19);
  for (const category of categories) {
    assert.ok(products.some((product) => product.category === category.name), `categoria sem produto: ${category.name}`);
  }
});

test("products expose base commercial fields without requiring online sale", () => {
  for (const product of products) {
    assert.ok(product.id);
    assert.ok(product.name);
    assert.ok(product.slug);
    assert.ok(product.category);
    assert.ok(product.brand);
    assert.ok(product.price >= 0);
    assert.ok(Array.isArray(product.images));
  }
});

test("commercial engine still supports future metered sale models", () => {
  // Seed catalog products (src/data/products.ts, auto-generated) currently only ship
  // saleType "unidade", but calculateCommercialLine must keep supporting the other
  // sale models for when future imports use them.
  const areaFixture = {
    name: "Piso vinilico fixture",
    price: 100,
    sale_type: "metro_quadrado" as const,
    unit_measure: "m2",
    area_per_piece: 0.5,
    default_loss_margin: 0.1,
    packaging_closed: false,
    fractional_sale_allowed: true,
  };
  const result = calculateCommercialLine(areaFixture, { areaDesiredM2: 20, lossMargin: 0.1 });
  assert.ok((result.quantityCalculatedSystem || 0) >= 1);

  assert.ok(products.every((product) => product.saleType === "unidade"));
});

test("product detail exposes quote-first structured SEO data", () => {
  const source = readFileSync(new URL("../src/pages/ProductDetail.tsx", import.meta.url), "utf8");
  assert.match(source, /application\/ld\+json/);
  assert.match(source, /"@type": "Product"/);
  assert.match(source, /"@type": "BreadcrumbList"/);
  assert.match(source, /Adicionar ao orçamento/);
  assert.doesNotMatch(source, /addToCart|Comprar agora|priceCurrency/);
});

test("static SEO document uses GAMEL domain and LocalBusiness schema", () => {
  const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /GAMEL Metal/);
  assert.match(source, /https:\/\/www\.gamelmetal\.com\//);
  assert.match(source, /"LocalBusiness"/);
  assert.match(source, /"HardwareStore"/);
  assert.match(source, /"areaServed"/);
  assert.doesNotMatch(source, /lojaopvc|Lojao|Lojão/i);
});

test("sitemap publishes only phase 1 public routes", () => {
  const source = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.match(source, /https:\/\/www\.gamelmetal\.com\//);
  assert.match(source, /https:\/\/www\.gamelmetal\.com\/produtos/);
  assert.match(source, /https:\/\/www\.gamelmetal\.com\/aplicacoes/);
  assert.match(source, /https:\/\/www\.gamelmetal\.com\/orcamento/);
  assert.match(source, /https:\/\/www\.gamelmetal\.com\/contato/);
  assert.doesNotMatch(source, /\/(carrinho|checkout|conta|meus-pedidos)(<|\/|\?|$)|lojaopvc/i);
});

test("public header exposes the GAMEL quote navigation only", () => {
  const header = readFileSync(new URL("../src/components/layout/Header.tsx", import.meta.url), "utf8");

  assert.match(header, /STORE_INFO\.name/);
  assert.match(header, /\/vendas-para-empresas/);
  assert.match(header, /\/orcamento/);
  assert.doesNotMatch(header, /Minha conta|Checkout|Rastrear/);
});

test("phase 1 quote flow persists quote requests through API with quote cart storage", () => {
  const quotePage = readFileSync(new URL("../src/pages/Quote.tsx", import.meta.url), "utf8");
  const quoteCart = readFileSync(new URL("../src/contexts/QuoteCartContext.tsx", import.meta.url), "utf8");
  const adminPage = readFileSync(new URL("../src/pages/AdminQuoteRequests.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");

  assert.match(quotePage, /\/api\/quote-requests/);
  assert.match(quoteCart, /gamel_quote_cart_v1/);
  assert.match(adminPage, /\/api\/admin\/quote-requests/);
  assert.match(server, /app\.post\("\/api\/quote-requests"/);
  assert.match(server, /app\.get\("\/api\/admin\/quote-requests"/);
  assert.match(server, /quote\.public_created/);
});

test("future ecommerce routes stay routed to the feature-flag placeholder", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /FutureEcommerce/);
  assert.match(app, /path="\/carrinho"/);
  assert.match(app, /path="\/checkout"/);
  assert.match(app, /path="\/checkout\/confirmação"/);
  assert.match(app, /path="\/conta"/);
  assert.match(app, /path="\/conta\/pedidos"/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\("\.\/pages\/Cart"\)\)/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\("\.\/pages\/Checkout"\)\)/);
  assert.doesNotMatch(app, /lazy\(\(\) => import\("\.\/pages\/MyOrders"\)\)/);
});

test("GAMEL phase 1 go-live contract keeps ecommerce future on stand by", () => {
  const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const script = readFileSync(new URL("../scripts/check-gamel-phase1-go-live.ts", import.meta.url), "utf8");
  const productionEnv = readFileSync(new URL("../.env.production.example", import.meta.url), "utf8");
  const runbookUrl = new URL("../docs/gamel_phase1_go_live_runbook.md", import.meta.url);

  assert.match(pkg, /"gamel:phase1:go-live:check": "tsx scripts\/check-gamel-phase1-go-live\.ts"/);
  assert.match(pkg, /"gamel:phase1:real-inputs": "tsx scripts\/export-gamel-real-inputs\.ts"/);
  assert.match(pkg, /"gamel:phase1:final-report": "npm run gamel:phase1:real-inputs && npm run gamel:phase1:go-live:check && tsx scripts\/export-gamel-phase1-final-report\.ts"/);
  assert.match(script, /GAMEL Fase 1/);
  assert.match(script, /VITE_ECOMMERCE_ENABLED/);
  assert.match(script, /docs\/reports\/gamel-phase1-go-live-readiness\.json/);
  assert.match(productionEnv, /APP_BASE_URL=https:\/\/www\.gamelmetal\.com/);
  assert.match(productionEnv, /VITE_SITE_MODE=quote/);
  assert.match(productionEnv, /VITE_CHECKOUT_ENABLED=false/);
  assert.match(productionEnv, /PAYMENT_PROVIDER=manual/);
  assert.match(productionEnv, /FREIGHT_PROVIDER=local-rules/);
  assert.equal(existsSync(runbookUrl), false, "documentacao antiga deve permanecer removida ate ser refeita");
});

test("GAMEL phase 1 reporting scripts expose real input handoff", () => {
  const realInputs = readFileSync(new URL("../scripts/export-gamel-real-inputs.ts", import.meta.url), "utf8");
  const finalReport = readFileSync(new URL("../scripts/export-gamel-phase1-final-report.ts", import.meta.url), "utf8");

  assert.match(realInputs, /Dados Reais Necessarios - GAMEL Fase 1/);
  assert.match(realInputs, /DATABASE_URL/);
  assert.match(realInputs, /STORE_WHATSAPP/);
  assert.match(realInputs, /CATALOG_APPROVAL/);
  assert.match(finalReport, /Relatorio Final GAMEL Fase 1/);
  assert.match(finalReport, /future_stand_by/);
  assert.match(finalReport, /gamel-phase1-final-report-latest/);
});
