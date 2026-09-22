import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type CaptureTarget = {
  name: string;
  route: string;
  viewport: string;
  auth?: "admin";
};

const baseUrl = getArg("base-url") ?? process.env.QA_VISUAL_BASE_URL ?? "http://127.0.0.1:8081";
const outDir = resolve(getArg("out-dir") ?? "docs/reports/qa-visual-screenshots");
const generatedAt = new Date().toISOString();

const publicStoragePath = join(tmpdir(), `gamel-public-storage-${Date.now()}.json`);
const adminStoragePath = join(tmpdir(), `gamel-admin-storage-${Date.now()}.json`);

const targets: CaptureTarget[] = [
  { name: "home-mobile", route: "/", viewport: "390,844" },
  { name: "products-mobile", route: "/produtos", viewport: "390,844" },
  { name: "category-mobile", route: "/categoria/forros-pvc", viewport: "390,844" },
  { name: "product-mobile", route: "/produto/forro-pvc-amadeirado-cedro-200mm-6m", viewport: "390,844" },
  { name: "applications-mobile", route: "/aplicacoes", viewport: "390,844" },
  { name: "quote-mobile", route: "/orcamento", viewport: "390,844" },
  { name: "contact-mobile", route: "/contato", viewport: "390,844" },
  { name: "about-mobile", route: "/sobre", viewport: "390,844" },
  { name: "future-ecommerce-standby-mobile", route: "/carrinho", viewport: "390,844" },
  { name: "admin-dashboard-desktop", route: "/admin", viewport: "1366,768", auth: "admin" },
  { name: "admin-phase1-tablet", route: "/admin", viewport: "768,1024", auth: "admin" },
];

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function writeStorageState(filePath: string, state: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

function buildPublicStorage() {
  writeStorageState(publicStoragePath, {
    cookies: [],
    origins: [
      {
        origin: baseUrl,
        localStorage: [
          {
            name: "lgpd_consent",
            value: JSON.stringify({ accepted: false, date: generatedAt }),
          },
        ],
      },
    ],
  });
}

function getSetCookieHeaders(response: Response) {
  const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function getCookieValue(headers: string[], name: string) {
  for (const header of headers) {
    const first = header.split(";")[0] ?? "";
    const [cookieName, ...valueParts] = first.split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return null;
}

async function buildAdminStorage() {
  let health: Response;
  try {
    health = await fetch(`${baseUrl}/api/health`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "falha de conexao";
    throw new Error(`Nao foi possivel acessar ${baseUrl}/api/health. Suba o app com "npm run dev" ou informe --base-url apontando para um frontend com API acessivel. Detalhe: ${detail}`);
  }
  if (!health.ok) throw new Error(`Falha ao acessar /api/health em ${baseUrl}: ${health.status}`);

  const csrf = getCookieValue(getSetCookieHeaders(health), "gamel_csrf") ?? getCookieValue(getSetCookieHeaders(health), "lojao_csrf");
  if (!csrf) throw new Error("Cookie CSRF nao retornado pelo backend.");

  const email = process.env.ADMIN_EMAIL || "admin@gamelmetal.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const signin = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      cookie: `gamel_csrf=${csrf}; lojao_csrf=${csrf}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) throw new Error(`Falha ao autenticar admin para screenshot: ${signin.status}`);

  const session = getCookieValue(getSetCookieHeaders(signin), "gamel_session");
  if (!session) throw new Error("Cookie de sessao admin nao retornado.");

  const expires = Math.floor(Date.now() / 1000) + 60 * 30;
  writeStorageState(adminStoragePath, {
    cookies: [
      { name: "lojao_csrf", value: csrf, domain: "127.0.0.1", path: "/", expires, httpOnly: false, secure: false, sameSite: "Lax" },
      { name: "gamel_csrf", value: csrf, domain: "127.0.0.1", path: "/", expires, httpOnly: false, secure: false, sameSite: "Lax" },
      { name: "gamel_session", value: session, domain: "127.0.0.1", path: "/", expires, httpOnly: true, secure: false, sameSite: "Lax" },
    ],
    origins: [
      {
        origin: baseUrl,
        localStorage: [
          {
            name: "lgpd_consent",
            value: JSON.stringify({ accepted: false, date: generatedAt }),
          },
        ],
      },
    ],
  });
}

function shellQuote(value: string) {
  if (process.platform === "win32") return `"${value.replace(/"/g, '\\"')}"`;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function runScreenshot(target: CaptureTarget) {
  const outputPath = resolve(outDir, `${target.name}.png`);
  const storagePath = target.auth === "admin" ? adminStoragePath : publicStoragePath;
  const command = [
    "npx",
    "playwright",
    "screenshot",
    `--load-storage=${shellQuote(storagePath)}`,
    `--viewport-size=${shellQuote(target.viewport)}`,
    "--wait-for-timeout=5000",
    shellQuote(`${baseUrl}${target.route}`),
    shellQuote(outputPath),
  ].join(" ");
  execSync(command, { stdio: "inherit" });
  if (!existsSync(outputPath)) throw new Error(`Screenshot nao gerado: ${outputPath}`);
  return outputPath;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  buildPublicStorage();
  await buildAdminStorage();

  const files = targets.map(runScreenshot);
  const evidencePath = resolve("docs/reports/QA_VISUAL_SCREENSHOTS_EVIDENCE.md");
  writeFileSync(
    evidencePath,
    [
      "# Evidencia de QA Visual com Screenshots",
      "",
      `Gerado em: ${generatedAt}`,
      "",
      `Ambiente local usado: ${baseUrl}`,
      "",
      "## Evidencias capturadas",
      "",
      "| Fluxo | Viewport | Arquivo |",
      "|---|---:|---|",
      ...targets.map((target) => `| ${target.name} | ${target.viewport.replace(",", "x")} | \`${outDir.replace(/\\/g, "/")}/${target.name}.png\` |`),
      "",
      "## Resultado",
      "",
      "Screenshots capturados por `npm run qa:visual:screenshots`. Nenhum arquivo de storage autenticado e mantido no repositorio.",
      "",
    ].join("\n"),
    "utf8",
  );

  rmSync(publicStoragePath, { force: true });
  rmSync(adminStoragePath, { force: true });
  console.log(JSON.stringify({ ok: true, files: files.length, outDir, evidencePath }, null, 2));
}

main().catch((error) => {
  rmSync(publicStoragePath, { force: true });
  rmSync(adminStoragePath, { force: true });
  console.error(error);
  process.exit(1);
});
