import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/products/ProductCard";
import { Button } from "@/components/ui/button";
import { categories as seedCategories, products as seedProducts, type Category as SeedCategory, type Product as SeedProduct } from "@/data/products";
import { useCategories } from "@/hooks/useCategories";
import { useFeaturedProducts, type Product } from "@/hooks/useProducts";
import { usePublicMarketingState } from "@/hooks/useMarketing";
import { buildCategoryPath } from "@/lib/catalogRoutes";
import { STORE_INFO, WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";

const commercialHighlights = [
  "Tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC",
  "Atendimento para clientes, profissionais, construtoras e empresas",
  "Retirada, entrega e disponibilidade confirmadas pela equipe comercial",
  "Orçamento assistido com produto, quantidade, cidade e contato",
];

const heroSlides = [
  {
    eyebrow: "Catálogo inteligente GAMEL",
    title: "Materiais para acabamento com orientação comercial especializada.",
    text: "Consulte tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC em um catálogo preparado para sua obra.",
    image: "/images/gamel/banners/v4/banner-catalogo-gamel-v4.webp",
    alt: "Showroom moderno de acabamentos e materiais GAMEL.",
    cta: "Ver produtos",
    href: "/produtos",
  },
  {
    eyebrow: "Orçamento online",
    title: "Envie sua lista de materiais e receba retorno da equipe GAMEL.",
    text: "O site organiza produto, quantidade, cidade e contato para acelerar a resposta comercial sem prometer preço automatico nesta fase.",
    image: "/images/gamel/banners/v4/banner-orcamento-gamel-v4.webp",
    alt: "Mesa de atendimento comercial com amostras de materiais e orçamento GAMEL.",
    cta: "Solicitar orçamento",
    href: "/orcamento",
  },
  {
    eyebrow: "GAMEL",
    title: "Soluções de acabamento para projetos residenciais e comerciais.",
    text: "Atendimento para clientes, profissionais e empresas que precisam validar produto, medida e disponibilidade com suporte humano.",
    image: "/images/gamel/banners/v4/banner-institucional-gamel-v4.webp",
    alt: "Materiais para obras e acabamentos organizados em showroom GAMEL.",
    cta: "Falar com a GAMEL",
    href: "/contato",
  },
];

const applicationHighlights = [
  "Tetos laminados vinílicos",
  "Pisos e paredes",
  "Ripados internos e externos",
  "Coberturas em policarbonato",
];

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
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.shortDescription,
    application: product.application,
    price: product.price,
    original_price: product.originalPrice ?? null,
    category_id: category?.id ?? null,
    brand_id: null,
    material: product.material,
    diameter: product.diameter ?? null,
    measures: product.diameter ?? product.technicalSpecs[0] ?? null,
    weight: product.weightPerUnit ?? null,
    unit: product.unitMeasure ?? "un",
    stock: product.stock,
    availability: product.quoteAvailable ? "sob_consulta" : "indisponivel",
    delivery_type: "quote",
    is_active: true,
    is_featured: Boolean(product.featured),
    rating: product.rating,
    review_count: product.reviews,
    image_url: product.images[0] ?? null,
    images: product.images,
    image_alt_text: product.name,
    image_review_status: product.imageApproved ? "approved" : "manual_review",
    created_at: new Date(0).toISOString(),
    category: category ? fallbackCategory(category) : null,
    brand: { id: product.brand.toLowerCase().replace(/\s+/g, "-"), name: product.brand, slug: product.brand.toLowerCase().replace(/\s+/g, "-"), is_active: true },
  };
}

export default function Index() {
  const [activeHero, setActiveHero] = useState(0);
  const { data: categories } = useCategories();
  const { data: featuredProducts } = useFeaturedProducts(8);
  const { data: marketingState } = usePublicMarketingState();
  const heroBanners = useMemo(() => {
    const banners = (marketingState?.banners ?? [])
      .filter((banner) => banner.placement === "home_hero")
      .sort((a, b) => b.priority - a.priority);
    if (banners.length === 0) return heroSlides;
    return banners.map((banner) => ({
      title: banner.title || banner.name,
      eyebrow: "GAMEL",
      text: banner.subtitle || "",
      image: banner.desktop_image || heroSlides[0].image,
      alt: banner.alt_text || banner.title || banner.name,
      cta: banner.cta_label || "Ver produtos",
      href: banner.cta_url || "/produtos",
    }));
  }, [marketingState]);
  const displayCategories = useMemo(() => (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || "",
    image_url: category.image_url || "/placeholder.svg",
    href: buildCategoryPath(category.slug),
  })), [categories]);
  const displayProducts = featuredProducts?.length
    ? featuredProducts
    : (seedProducts.some((product) => product.featured || product.bestseller)
        ? seedProducts.filter((product) => product.featured || product.bestseller)
        : seedProducts.filter((product) => product.quoteAvailable)
      ).slice(0, 8).map(fallbackProduct);
  const hero = heroBanners[activeHero % heroBanners.length];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHero((current) => (current + 1) % heroBanners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroBanners.length]);

  return (
    <Layout>
      <main className="shell-home py-8">
        <section className="relative min-h-[560px] overflow-hidden rounded-lg bg-[#050505] text-white">
          {heroBanners.map((slide, index) => (
            <img
              key={slide.title}
              src={slide.image}
              alt={slide.alt}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === activeHero % heroBanners.length ? "opacity-[.62]" : "opacity-0"}`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/78 to-black/20" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative flex min-h-[560px] flex-col justify-center px-6 py-12 md:px-10 lg:py-16">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff6417]">{hero.eyebrow}</p>
              <h1 className="mt-5 font-display text-5xl leading-none md:text-7xl">{hero.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/76">{hero.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-md bg-[#ff6417] text-white hover:bg-[#e9560b]">
                  <Link to={hero.href}>{hero.cta}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-md border-white/20 bg-white/8 text-white hover:bg-white/14 hover:text-white">
                  <Link to="/orcamento">
                    Solicitar orcamento
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-8 grid max-w-2xl gap-2 sm:grid-cols-2">
                {applicationHighlights.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium text-white/82">{item}</div>
                ))}
              </div>
            </div>
            <div className="mt-10 flex gap-2">
              {heroBanners.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => setActiveHero(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeHero % heroBanners.length ? "w-10 bg-[#ff6417]" : "w-2.5 bg-white/42 hover:bg-white/72"}`}
                  aria-label={`Ver banner ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="mr-1 font-semibold text-foreground">Atendimento GAMEL:</span>
            {commercialHighlights.map((item) => (
              <span key={item} className="rounded-full border border-border/70 bg-muted/30 px-3 py-1">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Categorias</p>
              <h2 className="font-display text-4xl">Linhas em destaque</h2>
            </div>
            <Link to="/produtos" className="text-sm font-semibold text-primary hover:underline">Ver catalogo</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {displayCategories.slice(0, 8).map((category) => (
              <Link key={category.id} to={category.href} className="group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  <img src={category.image_url || "/placeholder.svg"} alt={category.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Categoria</p>
                  <h3 className="mt-2 font-display text-3xl">{category.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{category.description}</p>
                  <p className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
                    Ver linha
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-lg bg-white px-5 py-8 shadow-sm ring-1 ring-border/80 md:px-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Produtos</p>
              <h2 className="font-display text-4xl">Produtos para consulta</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Uma vitrine inicial para orientar o pedido de cotação. Preços, estoque e condições comerciais sao confirmados pela equipe.</p>
            </div>
            <Link to="/produtos" className="text-sm font-semibold text-primary hover:underline">Abrir catalogo</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {displayProducts.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.75fr]">
          <div className="rounded-lg border border-border/80 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Como funciona</p>
            <h2 className="mt-2 font-display text-4xl">Orcamento online em fluxo simples.</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {["Escolha produtos ou categoria", "Envie dados de contato e quantidade", "A equipe comercial retorna pelo canal escolhido"].map((step, index) => (
                <div key={step} className="rounded-md bg-muted/45 p-4 text-sm leading-6 text-muted-foreground">
                  <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary font-semibold text-white">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-[#1f1f1f] p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6417]">Atendimento</p>
            <h2 className="mt-2 font-display text-4xl">Prefere falar direto?</h2>
            <p className="mt-3 text-sm leading-7 text-white/68">Acione o WhatsApp comercial com uma mensagem pronta de interesse.</p>
            <Button asChild className="mt-5 rounded-md bg-[#ff6417] text-white hover:bg-[#e9560b]">
              <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.default)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </main>
    </Layout>
  );
}
