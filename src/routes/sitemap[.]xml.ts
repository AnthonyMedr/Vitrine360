import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/config/brand";
import { getResolvedCatalogData } from "@/lib/commercial-data.server";

function renderUrl(url: string, priority: string, changefreq: string) {
  return [
    "<url>",
    `<loc>${url}</loc>`,
    `<changefreq>${changefreq}</changefreq>`,
    `<priority>${priority}</priority>`,
    "</url>",
  ].join("");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const dataPromise = getResolvedCatalogData();
        return dataPromise.then((data) => {
          const urls = [
            renderUrl(absoluteUrl("/"), "1.0", "daily"),
            renderUrl(absoluteUrl("/catalogo"), "0.9", "daily"),
            renderUrl(absoluteUrl("/ofertas"), "0.9", "daily"),
            ...data.categories
              .filter((category) => category.id !== "all")
              .map((category) =>
                renderUrl(absoluteUrl(`/categoria/${category.slug}`), "0.8", "weekly"),
              ),
            ...data.products.map((product) =>
              renderUrl(absoluteUrl(`/produto/${product.id}`), "0.7", "weekly"),
            ),
            ...data.campaigns
              .filter(
                (campaign) => campaign.status === "publicado" && campaign.showOnHome !== false,
              )
              .map((campaign) =>
                renderUrl(absoluteUrl(`/campanha/${campaign.slug}`), "0.8", "weekly"),
              ),
          ];

          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
            {
              headers: {
                "content-type": "application/xml; charset=utf-8",
              },
            },
          );
        });
      },
    },
  },
});
