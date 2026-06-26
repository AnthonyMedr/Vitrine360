import { createServerFn } from "@tanstack/react-start";
import { absoluteUrl } from "@/config/brand";
import { campaigns } from "@/data/campaigns";
import { categories } from "@/data/categories";
import { products } from "@/data/products";

type PageType = "static" | "campaign" | "category" | "product";

type PageCheck = {
  url: string;
  path: string;
  type: PageType;
  checks: {
    title: boolean;
    description: boolean;
    ogImage: boolean;
    canonical: boolean;
    jsonLd: boolean;
    inSitemap: boolean;
  };
};

async function fetchSitemapUrls() {
  try {
    const response = await fetch(absoluteUrl("/sitemap.xml"), {
      headers: { "user-agent": "vitrine360-audit" },
    });
    if (!response.ok) return new Set<string>();
    const xml = await response.text();
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1].trim());
    return new Set(urls);
  } catch {
    return new Set<string>();
  }
}

async function checkPage(url: string, type: PageType, sitemap: Set<string>): Promise<PageCheck> {
  const path = url.replace(absoluteUrl(""), "") || "/";
  const result: PageCheck = {
    url,
    path,
    type,
    checks: {
      title: false,
      description: false,
      ogImage: false,
      canonical: false,
      jsonLd: false,
      inSitemap: sitemap.has(url),
    },
  };

  try {
    const response = await fetch(url, { headers: { "user-agent": "vitrine360-audit" } });
    if (!response.ok) return result;
    const html = await response.text();
    const head = html.split("</head>")[0] ?? html;
    result.checks.title = /<title>[^<]{5,}<\/title>/i.test(head);
    result.checks.description =
      /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(head);
    result.checks.ogImage = /<meta[^>]+property=["']og:image["']/i.test(head);
    result.checks.canonical = /<link[^>]+rel=["']canonical["']/i.test(head);
    result.checks.jsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(head);
  } catch {
    return result;
  }

  return result;
}

export const auditSeo = createServerFn({ method: "POST" })
  .validator((input: { scope?: "all" | "campaigns" | "categories" | "products" } | undefined) => ({
    scope: input?.scope ?? "all",
  }))
  .handler(async ({ data }) => {
    const sitemap = await fetchSitemapUrls();
    const targets: { url: string; type: PageType }[] = [];

    if (data.scope === "all") {
      targets.push({ url: absoluteUrl("/"), type: "static" });
      targets.push({ url: absoluteUrl("/catalogo"), type: "static" });
      targets.push({ url: absoluteUrl("/ofertas"), type: "static" });
    }

    if (data.scope === "all" || data.scope === "campaigns") {
      for (const campaign of campaigns.filter((item) => item.status === "publicado").slice(0, 8)) {
        targets.push({ url: absoluteUrl(`/campanha/${campaign.slug}`), type: "campaign" });
      }
    }

    if (data.scope === "all" || data.scope === "categories") {
      for (const category of categories.filter((item) => item.id !== "all").slice(0, 8)) {
        targets.push({ url: absoluteUrl(`/categoria/${category.slug}`), type: "category" });
      }
    }

    if (data.scope === "all" || data.scope === "products") {
      for (const product of products.slice(0, 12)) {
        targets.push({ url: absoluteUrl(`/produto/${product.id}`), type: "product" });
      }
    }

    const pages = await Promise.all(
      targets.map((target) => checkPage(target.url, target.type, sitemap)),
    );
    const ok = pages.filter((page) => Object.values(page.checks).every(Boolean)).length;
    const warn = pages.length - ok;

    return {
      summary: { total: pages.length, ok, warn, sitemapUrls: sitemap.size },
      pages,
    };
  });
