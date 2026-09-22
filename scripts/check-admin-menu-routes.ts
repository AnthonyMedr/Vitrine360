import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type MenuRouteCheck = {
  href: string;
  hasRoute: boolean;
  isRedirect: boolean;
  element: string | null;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function extractMenuHrefs(shellSource: string) {
  return unique(Array.from(shellSource.matchAll(/href:\s*"([^"]+)"/g))
    .map((match) => match[1])
    .filter((href) => href.startsWith("/admin")));
}

function extractRoutes(appSource: string) {
  const routes = new Map<string, string>();
  for (const match of appSource.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^}]*)\}\s*\/>/g)) {
    routes.set(match[1], match[2]);
  }
  return routes;
}

function renderMarkdown(report: {
  ok: boolean;
  generated_at: string;
  total_menu_routes: number;
  missing_routes: string[];
  redirect_routes: string[];
  checks: MenuRouteCheck[];
}) {
  const lines = [
    "# Auditoria De Rotas Do Menu Admin",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `OK: ${report.ok}`,
    `Total de itens de menu Admin: ${report.total_menu_routes}`,
    `Rotas ausentes: ${report.missing_routes.length}`,
    `Itens apontando para redirecionamento: ${report.redirect_routes.length}`,
    "",
    "## Resultado Por Menu",
    "",
    "| Menu | Rota existe | Redireciona | Elemento |",
    "| --- | --- | --- | --- |",
    ...report.checks.map((check) => `| \`${check.href}\` | ${check.hasRoute ? "sim" : "nao"} | ${check.isRedirect ? "sim" : "nao"} | \`${check.element ?? "-"}\` |`),
  ];

  if (report.missing_routes.length > 0) {
    lines.push("", "## Rotas Ausentes", "", ...report.missing_routes.map((href) => `- \`${href}\``));
  }

  if (report.redirect_routes.length > 0) {
    lines.push("", "## Menus Com Redirecionamento", "", ...report.redirect_routes.map((href) => `- \`${href}\``));
  }

  return `${lines.join("\n")}\n`;
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/admin-menu-routes-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const shellSource = readFileSync("src/components/admin/AdminWorkspaceShell.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const menuHrefs = extractMenuHrefs(shellSource);
const routes = extractRoutes(appSource);

const checks: MenuRouteCheck[] = menuHrefs.map((href) => {
  const element = routes.get(href) ?? null;
  return {
    href,
    hasRoute: element !== null,
    isRedirect: Boolean(element?.includes("<Navigate")),
    element,
  };
});

const missingRoutes = checks.filter((check) => !check.hasRoute).map((check) => check.href);
const redirectRoutes = checks.filter((check) => check.isRedirect).map((check) => check.href);
const report = {
  ok: missingRoutes.length === 0 && redirectRoutes.length === 0,
  generated_at: new Date().toISOString(),
  total_menu_routes: checks.length,
  missing_routes: missingRoutes,
  redirect_routes: redirectRoutes,
  checks,
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  total_menu_routes: report.total_menu_routes,
  missing_routes: report.missing_routes,
  redirect_routes: report.redirect_routes,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
