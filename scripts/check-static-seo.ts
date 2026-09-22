import { readFileSync } from "node:fs";

type SitemapUrl = {
  loc?: string;
  changefreq?: string;
  priority?: string;
};

function readText(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function getMetaContent(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  return source.match(regex)?.[1]?.trim() ?? "";
}

function getSitemapUrls(source: string): SitemapUrl[] {
  return [...source.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1] ?? "";
    return {
      loc: block.match(/<loc>(.*?)<\/loc>/)?.[1],
      changefreq: block.match(/<changefreq>(.*?)<\/changefreq>/)?.[1],
      priority: block.match(/<priority>(.*?)<\/priority>/)?.[1],
    };
  });
}

const indexHtml = readText("../index.html");
const sitemap = readText("../public/sitemap.xml");
const robots = readText("../public/robots.txt");
const urls = getSitemapUrls(sitemap);

const issues: Array<{ item: string; severity: "blocker" | "warning"; detail: string }> = [];

if (!/<title>[^<]{20,80}<\/title>/i.test(indexHtml)) {
  issues.push({ item: "title", severity: "blocker", detail: "Title deve existir e ter tamanho operacional entre 20 e 80 caracteres." });
}

const description = getMetaContent(indexHtml, "description");
if (description.length < 70 || description.length > 180) {
  issues.push({ item: "meta.description", severity: "blocker", detail: "Meta description deve ter entre 70 e 180 caracteres." });
}

for (const property of ["og:title", "og:description", "og:url", "og:type", "twitter:card", "twitter:title", "twitter:description"]) {
  if (!getMetaContent(indexHtml, property)) {
    issues.push({ item: property, severity: "blocker", detail: `Meta ${property} ausente.` });
  }
}

for (const schemaType of ["LocalBusiness", "HardwareStore"]) {
  if (!indexHtml.includes(`"${schemaType}"`)) {
    issues.push({ item: `schema.${schemaType}`, severity: "blocker", detail: `Schema ${schemaType} ausente no HTML principal.` });
  }
}

if (!urls.some((entry) => entry.loc === "https://www.gamelmetal.com/")) {
  issues.push({ item: "sitemap.home", severity: "blocker", detail: "Sitemap sem home canonica." });
}

for (const path of [
  "/produtos",
  "/orcamento",
  "/vendas-para-empresas",
  "/aplicacoes",
  "/categoria/forros-em-pvc",
  "/categoria/ripados-internos",
  "/categoria/ripados-externos",
  "/categoria/chapas-uv",
  "/categoria/chapas-de-policarbonato",
  "/categoria/pisos-vinilicos",
  "/categoria/tetos-vinilicos",
  "/contato",
]) {
  if (!urls.some((entry) => entry.loc === `https://www.gamelmetal.com${path}`)) {
    issues.push({ item: `sitemap.${path}`, severity: "warning", detail: `Rota ${path} nao consta no sitemap.` });
  }
}

if (!/Sitemap:\s*https:\/\/www\.gamelmetal\.com\/sitemap\.xml/i.test(robots)) {
  issues.push({ item: "robots.sitemap", severity: "blocker", detail: "robots.txt deve apontar para sitemap canonico." });
}

console.log(
  JSON.stringify(
    {
      ok: issues.filter((issue) => issue.severity === "blocker").length === 0,
      sitemap_urls: urls.length,
      issues,
      next_steps:
        issues.length === 0
          ? ["Manter este check junto do build antes do go-live."]
          : ["Corrigir metadados/sitemap/robots antes de publicar o dominio final."],
    },
    null,
    2,
  ),
);

if (issues.some((issue) => issue.severity === "blocker")) {
  process.exitCode = 1;
}
