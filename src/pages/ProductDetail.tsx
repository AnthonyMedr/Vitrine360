import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronRight, MessageCircle, Ruler, ShieldCheck, ShoppingCart } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/products/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { STORE_INFO, WHATSAPP_MESSAGES, getProductWhatsAppUrl } from "@/constants/store";
import { setMetaContent } from "@/lib/seoMeta";
import { categories as seedCategories, products as seedProducts, type Category as SeedCategory, type Product as SeedProduct } from "@/data/products";
import { emit } from "@/data/events/eventBus";
import { addToOutbox } from "@/data/events/outbox";
import { getPageContext } from "@/data/events/utmTracking";
import type { ProductViewedPayload } from "@/domain/types";
import { useProduct, useProducts } from "@/hooks/useProducts";
import type { Product } from "@/hooks/useProducts";
import { buildCategoryPath, CATALOG_ROUTES } from "@/lib/catalogRoutes";
import { getProductIdentityWarning, selectProductForSlug } from "@/lib/productIdentity";

const mediaReviewStatuses = new Set(["manual_review", "suspect", "duplicate", "broken", "missing"]);

function fallbackCategory(category: SeedCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    image_url: category.image,
    sort_order: category.order,
    is_active: true,
  };
}

function fallbackProduct(product: SeedProduct): Product {
  const category = seedCategories.find((item) => item.name === product.category) ?? seedCategories[0];
  const isNamedGamelProduct = Number(product.id) >= 23;
  const isRipado = product.category === "Ripados internos e externos";
  const skuPrefix = isNamedGamelProduct ? (isRipado ? "GML-RIP" : "GML-TLV") : "GML";

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.shortDescription,
    long_description: product.description,
    application: product.application,
    price: product.price,
    original_price: product.originalPrice ?? null,
    category_id: category?.id ?? null,
    brand_id: null,
    material: product.material,
    diameter: product.diameter ?? null,
    measures: product.diameter ?? product.technicalSpecs[0] ?? null,
    dimensions: product.diameter ?? null,
    weight: product.weightPerUnit ?? null,
    unit: product.unitMeasure ?? "un",
    sale_type: product.saleType ?? "unidade",
    unit_measure: product.unitMeasure ?? "un",
    display_unit: product.displayUnit ?? product.unitMeasure ?? "un",
    stock: product.stock,
    availability: product.quoteAvailable ? "sob_consulta" : "indisponivel",
    delivery_type: "quote",
    is_on_request: true,
    is_active: true,
    is_featured: Boolean(product.featured),
    rating: product.rating,
    review_count: product.reviews,
    image_url: product.images[0] ?? null,
    images: product.images,
    image_alt_text: product.name,
    image_review_status: product.imageApproved ? "approved" : "manual_review",
    image_review_notes: product.imageApproved ? "Imagem aprovada na planilha-mestre." : "Imagem aguardando aprovação.",
    created_at: new Date(Date.now() - Number(product.id.replace(/\D/g, "")) * 60_000).toISOString(),
    category: category ? fallbackCategory(category) : null,
    brand: { id: "gamel-curadoria", name: product.brand, slug: "gamel-curadoria", is_active: true },
  };
}

function splitProductHints(value: string | null | undefined) {
  return String(value || "")
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export default function ProductDetail() {
  const { slug } = useParams();
  const currentSlug = slug || "";
  const { data: apiProduct, isLoading, error } = useProduct(currentSlug);
  const { data: allProducts } = useProducts({ limit: 20 });
  const [selectedImage, setSelectedImage] = useState(0);
  const quoteCart = useQuoteCart();
  const { toast } = useToast();
  const fallbackProducts = useMemo(() => seedProducts.map(fallbackProduct), []);
  const fallbackProductMatch = useMemo(() => fallbackProducts.find((item) => item.slug === currentSlug) ?? null, [currentSlug, fallbackProducts]);
  const productSelection = useMemo(
    () => selectProductForSlug({ slug: currentSlug, apiProduct, fallbackProduct: fallbackProductMatch }),
    [apiProduct, currentSlug, fallbackProductMatch],
  );
  const product = productSelection.product;
  const relatedPool = allProducts?.length ? allProducts : fallbackProducts;

  const relatedProducts = useMemo(
    () => relatedPool.filter((item) => item.category_id === product?.category_id && item.id !== product?.id).slice(0, 6) || [],
    [relatedPool, product?.category_id, product?.id],
  );

  useEffect(() => {
    if (!product || !FEATURE_FLAGS.events) return;
    const pageContext = getPageContext();
    const payload: ProductViewedPayload = {
      product_sku: product.sku || product.id,
      product_name: product.name,
      product_price: 0,
      category_slug: product.category?.slug,
      category_name: product.category?.name,
      page_url: pageContext.page_url,
      referrer: pageContext.referrer,
    };
    addToOutbox(emit("product.viewed", payload));
  }, [product]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const warning = getProductIdentityWarning({ slug: currentSlug, apiProduct, fallbackProduct: fallbackProductMatch });
    if (!warning) return;
    console.warn("[GAMEL product identity]", warning);
  }, [apiProduct, currentSlug, fallbackProductMatch]);

  useEffect(() => setSelectedImage(0), [product?.id]);

  useEffect(() => {
    if (!product) return;
    const underReview = mediaReviewStatuses.has(String(product.image_review_status || "").trim().toLowerCase());
    const primaryImage = underReview ? null : product.image_url || product.images?.[0];
    if (!primaryImage) return;
    const absoluteUrl = primaryImage.startsWith("http") ? primaryImage : `${STORE_INFO.baseUrl}${primaryImage.startsWith("/") ? primaryImage : `/${primaryImage}`}`;
    setMetaContent('meta[property="og:image"]', absoluteUrl, "property");
    setMetaContent('meta[name="twitter:image"]', absoluteUrl);
  }, [product]);

  if (isLoading && !fallbackProductMatch) {
    return (
      <Layout>
        <main className="container py-6">
          <Skeleton className="mb-4 h-4 w-64" />
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </main>
      </Layout>
    );
  }

  if ((error && !fallbackProductMatch) || !product) {
    return (
      <Layout>
        <main className="container py-16 text-center">
          <h1 className="font-display text-4xl font-bold">Produto não encontrado</h1>
          <Button asChild className="mt-4">
            <Link to={CATALOG_ROUTES.allProducts}>Ver todos os produtos</Link>
          </Button>
        </main>
      </Layout>
    );
  }

  const mediaUnderReview = mediaReviewStatuses.has(String(product.image_review_status || "").trim().toLowerCase());
  const allImages = mediaUnderReview ? ["/placeholder.svg"] : Array.from(new Set([product.image_url, ...(product.images || [])].filter(Boolean) as string[]));
  if (allImages.length === 0) allImages.push("/placeholder.svg");
  const categoryName = product.category?.name || "";
  const applicationHints = splitProductHints(product.application || product.subcategory || categoryName);
  const requestChecklist = [
    product.measures ? `Conferir medida comercial: ${product.measures}` : null,
    product.display_unit ? `Confirmar unidade de atendimento: ${product.display_unit}` : null,
    "Informar quantidade estimada e observacoes da obra.",
    "Validar preço, prazo e disponibilidade com o comercial.",
  ].filter(Boolean) as string[];
  const quoteUrl = `/orcamento?produto=${encodeURIComponent(product.slug)}&nome=${encodeURIComponent(product.name)}&categoria=${encodeURIComponent(categoryName)}`;
  const alreadySelected = quoteCart.hasProduct(product.id);
  const technicalRows = [
    product.sku ? { label: "Codigo/SKU", value: product.sku } : null,
    categoryName ? { label: "Categoria", value: categoryName } : null,
    product.brand?.name ? { label: "Marca", value: product.brand.name } : null,
    product.material ? { label: "Material", value: product.material } : null,
    product.measures ? { label: "Medidas comerciais", value: product.measures } : null,
    product.dimensions ? { label: "Dimensões", value: product.dimensions } : null,
    product.diameter ? { label: "Referencia", value: product.diameter } : null,
    product.sale_type ? { label: "Tipo comercial", value: product.sale_type.replace(/_/g, " ") } : null,
    product.display_unit ? { label: "Unidade", value: String(product.display_unit) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const productUrl = `${STORE_INFO.baseUrl}/produto/${product.slug}`;
  const productStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: product.long_description || product.description || product.short_description || product.name,
    sku: product.sku || product.id,
    brand: product.brand?.name ? { "@type": "Brand", name: product.brand.name } : undefined,
    category: categoryName,
    image: mediaUnderReview ? undefined : allImages.map((image) => (image.startsWith("http") ? image : `${STORE_INFO.baseUrl}${image.startsWith("/") ? image : `/${image}`}`)),
  };
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: STORE_INFO.baseUrl },
      { "@type": "ListItem", position: 2, name: "Produtos", item: `${STORE_INFO.baseUrl}${CATALOG_ROUTES.allProducts}` },
      product.category?.name
        ? { "@type": "ListItem", position: 3, name: product.category.name, item: `${STORE_INFO.baseUrl}${buildCategoryPath(product.category.slug)}` }
        : null,
      { "@type": "ListItem", position: product.category?.name ? 4 : 3, name: product.name, item: productUrl },
    ].filter(Boolean),
  };

  return (
    <Layout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData).replace(/</g, "\\u003c") }} />
      <main className="container py-5">
        <nav className="mb-4 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary hover:underline">Inicio</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link to={CATALOG_ROUTES.allProducts} className="hover:text-primary hover:underline">Produtos</Link>
          {product.category?.name ? (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link to={buildCategoryPath(product.category.slug)} className="hover:text-primary hover:underline">{product.category.name}</Link>
            </>
          ) : null}
        </nav>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
              {mediaUnderReview ? (
                <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm leading-7 text-muted-foreground">
                  Imagem em revisão. O cadastro técnico e comercial deste produto continua disponivel para orcamento.
                </div>
              ) : (
                <img src={allImages[selectedImage]} alt={product.name} className="h-full w-full object-contain p-4" loading="eager" decoding="async" />
              )}
              {product.is_featured ? <Badge className="absolute right-3 top-3 border-0 bg-primary text-primary-foreground">Destaque</Badge> : null}
            </div>
            {allImages.length > 1 && !mediaUnderReview ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((image, index) => (
                  <button key={image} type="button" onClick={() => setSelectedImage(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 bg-card ${selectedImage === index ? "border-primary" : "border-border"}`}>
                    <img src={image} alt="" className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/80 bg-white p-5 shadow-sm">
              {product.brand?.name ? <p className="text-sm font-semibold text-primary">{product.brand.name}</p> : null}
              <h1 className="mt-2 font-display text-4xl leading-none text-secondary md:text-6xl">{product.name}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {categoryName ? <Badge variant="outline">{categoryName}</Badge> : null}
                {product.sku ? <Badge variant="secondary">SKU {product.sku}</Badge> : null}
                <Badge className="bg-primary text-primary-foreground">Orcamento sob consulta</Badge>
              </div>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {product.long_description || product.description || product.short_description || "Produto preparado para atendimento comercial e orçamento online."}
              </p>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
              <p className="font-semibold text-foreground">Consulta comercial</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Preço, disponibilidade, estoque, frete e prazo devem ser confirmados pela equipe da GAMEL antes de qualquer fechamento.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button type="button" className="h-11 rounded-md" onClick={() => {
                  if (!FEATURE_FLAGS.quoteCart) {
                    window.location.href = quoteUrl;
                    return;
                  }
                  quoteCart.addProduct(product);
                  toast({
                    title: alreadySelected ? "Quantidade atualizada" : "Produto adicionado ao seu orçamento.",
                    description: "Continue no catálogo ou revise sua solicitação quando quiser.",
                  });
                }}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {alreadySelected ? "Adicionar mais uma unidade" : "Adicionar ao orçamento"}
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-md">
                  {alreadySelected ? (
                    <Link to="/orcamento">
                      Revisar orcamento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  ) : (
                    <a href={getProductWhatsAppUrl(product.name)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar no WhatsApp
                    </a>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Como este produto ajuda no projeto</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(applicationHints.length ? applicationHints : ["Obras", "Acabamentos", "Projetos comerciais"]).map((hint) => (
                  <span key={hint} className="rounded-md border border-border/80 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground">{hint}</span>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {requestChecklist.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Atendimento especializado", text: "Validação comercial antes do fechamento." },
                { icon: Ruler, title: "Medidas e aplicação", text: "Apoio para confirmar quantidade aproximada." },
                { icon: MessageCircle, title: "WhatsApp", text: WHATSAPP_MESSAGES.quote },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-border/80 bg-white p-4 shadow-sm">
                    <Icon className="h-5 w-5 text-primary" />
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="aplicações" className="mt-6 rounded-lg border border-border/80 bg-white p-5 shadow-sm">
          <Tabs defaultValue="description">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="description">Descrição</TabsTrigger>
              <TabsTrigger value="specs">Especificacoes</TabsTrigger>
              <TabsTrigger value="applications">Aplicacoes</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-5 text-sm leading-7 text-muted-foreground">
              {product.long_description || product.description || "Produto cadastrado para consulta e orçamento comercial."}
            </TabsContent>
            <TabsContent value="specs" className="mt-5">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {technicalRows.map((row) => (
                      <tr key={row.label} className="border-b last:border-b-0">
                        <td className="w-1/3 bg-muted/50 px-3 py-3 font-medium text-muted-foreground">{row.label}</td>
                        <td className="px-3 py-3">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="applications" className="mt-5 text-sm leading-7 text-muted-foreground">
              {product.application || "Uso em obra, reforma, acabamento, manutencao ou projeto comercial, conforme validação da equipe GAMEL."}
            </TabsContent>
          </Tabs>
        </section>

        {relatedProducts.length > 0 ? (
          <section className="mt-6 rounded-lg border border-border/80 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Relacionados</p>
                <h2 className="font-display text-3xl">Produtos destá linha</h2>
              </div>
              <Link to={CATALOG_ROUTES.allProducts} className="text-sm font-medium text-primary hover:underline">Ver catalogo</Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {relatedProducts.map((relatedProduct) => <ProductCard key={relatedProduct.id} product={relatedProduct} compact />)}
            </div>
          </section>
        ) : null}
      </main>
    </Layout>
  );
}
