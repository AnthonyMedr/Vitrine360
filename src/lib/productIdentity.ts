type ProductIdentity = {
  id?: string | null;
  slug?: string | null;
  sku?: string | null;
  name?: string | null;
};

export type ProductSelectionSource = "api" | "fallback" | "none";

export type ProductSelection<TProduct extends ProductIdentity> = {
  product: TProduct | null;
  source: ProductSelectionSource;
  rejectedApiProduct: TProduct | null;
};

export function normalizeProductSlug(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isProductSlugMatch(product: ProductIdentity | null | undefined, slug: string | null | undefined) {
  const expectedSlug = normalizeProductSlug(slug);
  return Boolean(expectedSlug && normalizeProductSlug(product?.slug) === expectedSlug);
}

export function selectProductForSlug<TProduct extends ProductIdentity>(input: {
  slug: string | null | undefined;
  apiProduct?: TProduct | null;
  fallbackProduct?: TProduct | null;
}): ProductSelection<TProduct> {
  const { slug, apiProduct = null, fallbackProduct = null } = input;

  if (apiProduct && isProductSlugMatch(apiProduct, slug)) {
    return { product: apiProduct, source: "api", rejectedApiProduct: null };
  }

  const fallbackMatch = fallbackProduct && isProductSlugMatch(fallbackProduct, slug) ? fallbackProduct : null;
  if (apiProduct && !isProductSlugMatch(apiProduct, slug)) {
    return { product: fallbackMatch, source: fallbackMatch ? "fallback" : "none", rejectedApiProduct: apiProduct };
  }

  if (fallbackMatch) {
    return { product: fallbackMatch, source: "fallback", rejectedApiProduct: null };
  }

  return { product: null, source: "none", rejectedApiProduct: null };
}

export function getProductIdentityWarning(input: {
  slug: string | null | undefined;
  apiProduct?: ProductIdentity | null;
  fallbackProduct?: ProductIdentity | null;
}) {
  const { slug, apiProduct, fallbackProduct } = input;
  if (apiProduct && !isProductSlugMatch(apiProduct, slug)) {
    return {
      type: "api_slug_mismatch" as const,
      expectedSlug: normalizeProductSlug(slug),
      apiProduct: summarizeProductIdentity(apiProduct),
      fallbackProduct: summarizeProductIdentity(fallbackProduct),
    };
  }

  if (apiProduct && fallbackProduct && isProductSlugMatch(apiProduct, slug) && isProductSlugMatch(fallbackProduct, slug)) {
    const differences = {
      id: apiProduct.id !== fallbackProduct.id,
      sku: Boolean(apiProduct.sku && fallbackProduct.sku && apiProduct.sku !== fallbackProduct.sku),
      name: Boolean(apiProduct.name && fallbackProduct.name && apiProduct.name !== fallbackProduct.name),
    };
    if (differences.id || differences.sku || differences.name) {
      return {
        type: "api_fallback_identity_drift" as const,
        expectedSlug: normalizeProductSlug(slug),
        differences,
        apiProduct: summarizeProductIdentity(apiProduct),
        fallbackProduct: summarizeProductIdentity(fallbackProduct),
      };
    }
  }

  return null;
}

function summarizeProductIdentity(product: ProductIdentity | null | undefined) {
  if (!product) return null;
  return {
    id: product.id ?? null,
    slug: product.slug ?? null,
    sku: product.sku ?? null,
    name: product.name ?? null,
  };
}
