export const CATALOG_ROUTES = {
  allProducts: "/produtos",
  search: "/busca",
  offers: "/produtos?destaques=true",
  bestSellers: "/produtos?sort=popular",
} as const;

export function buildCategoryPath(slug: string) {
  return `/categoria/${slug}`;
}

export function buildCatalogSearchPath(query: string) {
  const normalized = query.trim();
  if (!normalized) {
    return CATALOG_ROUTES.allProducts;
  }

  return `${CATALOG_ROUTES.search}?q=${encodeURIComponent(normalized)}`;
}
