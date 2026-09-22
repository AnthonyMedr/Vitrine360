const { chromium } = require("playwright");

const baseUrl = process.env.ADMIN_BROWSER_BASE_URL || "http://127.0.0.1:8082";
const email = process.env.ADMIN_EMAIL || "admin@gamelmetal.com";
const password = process.env.ADMIN_PASSWORD || "Gamel@2026Admin!";

const routes = [
  "/admin",
  "/admin/produtos",
  "/admin/catalogo",
  "/admin/midia",
  "/admin/banners-vitrines",
  "/admin/operacao",
  "/admin/usuarios",
  "/admin/go-live",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  const results = [];

  page.on("pageerror", (error) => {
    errors.push({ type: "pageerror", message: error.message, stack: error.stack });
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      errors.push({ type: `console:${message.type()}`, message: message.text() });
    }
  });

  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar agora/i }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });

  for (const route of routes) {
    errors.length = 0;
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const hasFallback = await page.getByText("Essa pagina encontrou um erro inesperado").count();
    const title = await page.locator("h1").first().textContent().catch(() => null);
    const blockingErrors = errors.filter((entry) => entry.type === "pageerror" || entry.type === "console:error");
    results.push({
      route,
      ok: hasFallback === 0 && blockingErrors.length === 0,
      title,
      hasFallback: hasFallback > 0,
      errors: errors.slice(),
    });
  }

  await browser.close();
  console.log(JSON.stringify({ ok: results.every((result) => result.ok), baseUrl, results }, null, 2));
  if (results.some((result) => !result.ok)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
