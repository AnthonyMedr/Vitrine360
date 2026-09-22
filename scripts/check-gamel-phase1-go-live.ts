import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Issue = {
  id: string;
  severity: "blocker" | "warning";
  detail: string;
};

function readText(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function parseEnv(source: string) {
  const values = new Map<string, string>();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    values.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
  }
  return values;
}

function requireMatch(issues: Issue[], id: string, source: string, pattern: RegExp, detail: string, severity: Issue["severity"] = "blocker") {
  if (!pattern.test(source)) {
    issues.push({ id, severity, detail });
  }
}

function requireNoMatch(issues: Issue[], id: string, source: string, pattern: RegExp, detail: string, severity: Issue["severity"] = "blocker") {
  if (pattern.test(source)) {
    issues.push({ id, severity, detail });
  }
}

const files = {
  app: readText("src/App.tsx"),
  header: readText("src/components/layout/Header.tsx"),
  footer: readText("src/components/layout/Footer.tsx"),
  home: readText("src/pages/Index.tsx"),
  products: readText("src/pages/Products.tsx"),
  productDetail: readText("src/pages/ProductDetail.tsx"),
  quote: readText("src/pages/Quote.tsx"),
  admin: readText("src/pages/AdminQuoteRequests.tsx"),
  featureFlags: readText("src/config/featureFlags.ts"),
  indexHtml: readText("index.html"),
  sitemap: readText("public/sitemap.xml"),
  robots: readText("public/robots.txt"),
  productionEnv: existsSync(path.resolve(process.cwd(), ".env.production.local"))
    ? readText(".env.production.local")
    : readText(".env.production.example"),
};

const env = parseEnv(files.productionEnv);
const issues: Issue[] = [];

requireMatch(issues, "brand.index", files.indexHtml, /GAMEL Metal|GAMEL Distribuidora/, "Metadados principais precisam usar a marca GAMEL.");
requireMatch(issues, "brand.home", files.home, /\bGAMEL\b/, "Home precisa comunicar a marca GAMEL.");
requireMatch(issues, "domain.index", files.indexHtml, /https:\/\/www\.gamelmetal\.com\//, "HTML principal precisa apontar para www.gamelmetal.com.");
requireMatch(issues, "schema.local_business", files.indexHtml, /"LocalBusiness"/, "Schema LocalBusiness precisa estar presente.");

// "/aplicacoes" foi consolidada em "/produtos" (redirect em App.tsx) e nao aparece mais
// como item de navegacao proprio - isso e uma mudanca intencional, nao uma regressao.
for (const route of ["/produtos", "/sobre", "/orcamento", "/contato"]) {
  requireMatch(issues, `nav.${route}`, files.header, new RegExp(route.replace("/", "\\/")), `Header precisa expor a rota ${route}.`);
}

for (const route of ["/", "/produtos", "/aplicacoes", "/orcamento", "/contato"]) {
  requireMatch(
    issues,
    `sitemap.${route}`,
    files.sitemap,
    new RegExp(`https:\\/\\/www\\.gamelmetal\\.com${route === "/" ? "\\/" : route.replace("/", "\\/")}`),
    `Sitemap precisa publicar ${route}.`,
  );
}

requireMatch(issues, "robots.sitemap", files.robots, /Sitemap:\s*https:\/\/www\.gamelmetal\.com\/sitemap\.xml/i, "Robots precisa apontar para o sitemap GAMEL.");
requireNoMatch(issues, "public.ecommerce_words", `${files.header}\n${files.footer}\n${files.home}\n${files.products}\n${files.productDetail}`, /Carrinho|Checkout|Comprar agora|Minha conta|Meus pedidos|Rastrear pedido/i, "Superficies publicas Fase 1 nao podem expor e-commerce completo.");
requireNoMatch(issues, "sitemap.ecommerce_routes", files.sitemap, /\/(?:carrinho|checkout|conta|meus-pedidos|rastrear)(?:[/?<]|$)/i, "Sitemap nao pode publicar rotas de e-commerce futuro.");
requireMatch(issues, "future.routes.placeholder", files.app, /FutureEcommerce/, "Rotas futuras precisam cair no placeholder de stand by.");
requireMatch(issues, "future.flags.checkout", files.featureFlags, /checkout:\s*import\.meta\.env\.VITE_CHECKOUT_ENABLED\s*===\s*"true"/, "Checkout precisa continuar protegido por feature flag.");
requireMatch(issues, "future.flags.cart", files.featureFlags, /cart:\s*import\.meta\.env\.VITE_CART_ENABLED\s*===\s*"true"/, "Carrinho precisa continuar protegido por feature flag.");

requireMatch(issues, "quote.api", files.quote, /\/api\/quote-requests/, "Orcamento online precisa persistir lead via API.");
requireMatch(issues, "quote.whatsapp", files.quote, /wa\.me|WhatsApp/i, "Orcamento online precisa gerar acionamento por WhatsApp.");
requireMatch(issues, "admin.quote_requests", files.admin, /\/api\/admin\/quote-requests/, "Admin Fase 1 precisa listar orcamentos/leads.");

const expectedEnv: Record<string, string> = {
  APP_ENV: "production",
  APP_BASE_URL: "https://www.gamelmetal.com",
  VITE_SITE_MODE: "quote",
  VITE_ECOMMERCE_ENABLED: "false",
  VITE_CART_ENABLED: "false",
  VITE_CHECKOUT_ENABLED: "false",
  VITE_PAYMENTS_ENABLED: "false",
  VITE_ORDER_TRACKING_ENABLED: "false",
  VITE_CUSTOMER_ACCOUNT_ENABLED: "false",
  VITE_QUOTE_ENABLED: "true",
  PAYMENT_PROVIDER: "manual",
  FREIGHT_PROVIDER: "local-rules",
};

for (const [key, expected] of Object.entries(expectedEnv)) {
  const actual = env.get(key);
  if (actual !== expected) {
    issues.push({ id: `env.${key}`, severity: "blocker", detail: `${key} esperado=${expected} atual=${actual ?? "<ausente>"}.` });
  }
}

for (const [key, owner] of [
  ["DATABASE_URL", "DevOps"],
  ["REDIS_URL", "DevOps"],
  ["APP_SECRET", "DevOps"],
  ["AUTH_CSRF_SECRET", "DevOps"],
  ["RESEND_API_KEY", "Marketing/DevOps"],
  ["GA4_MEASUREMENT_ID", "Marketing"],
  ["STORAGE_BUCKET", "DevOps"],
  ["FISCAL_COMPANY_CNPJ", "GAMEL/Contabilidade"],
] as const) {
  if (!env.has(key)) {
    issues.push({ id: `env.required.${key}`, severity: "blocker", detail: `${key} ausente no baseline de producao.` });
  } else if (/^__SET_(?:IN_PRODUCTION|REAL_.*)__$/i.test(env.get(key) ?? "")) {
    issues.push({ id: `env.pending.${key}`, severity: "warning", detail: `${key} precisa de valor real antes do deploy. Responsavel: ${owner}.` });
  }
}

const blockerCount = issues.filter((issue) => issue.severity === "blocker").length;
const report = {
  ok: blockerCount === 0,
  scope: "GAMEL Fase 1 - institucional, catalogo, orcamento online e admin",
  ecommerce_future: "stand_by",
  blockers: blockerCount,
  warnings: issues.filter((issue) => issue.severity === "warning").length,
  issues,
  next_steps:
    blockerCount === 0
      ? [
          "Preencher secrets e dados reais marcados como warning no ambiente de producao.",
          "Rodar npm run gamel:phase1:go-live:check, npm run seo:check, npm run build e npm run smoke:release no servidor.",
        ]
      : ["Corrigir blockers antes de apresentar o site como pronto para publicacao."],
};

writeFileSync(path.resolve(process.cwd(), "docs/reports/gamel-phase1-go-live-readiness.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (blockerCount > 0) {
  process.exitCode = 1;
}
