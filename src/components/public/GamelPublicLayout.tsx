import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronUp,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Ruler,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GamelAddToQuoteButton,
  GamelQuoteCartIconButton,
  GamelQuoteCartMobileLink,
} from "@/components/public/GamelQuoteCart";
import type { Product } from "@/data/products";
import {
  gamelFeaturedCategories,
  gamelStoreInfo,
  gamelWhatsAppMessages,
  getGamelWhatsAppUrl,
} from "@/data/gamel-site";

const navigationLinks = [
  { label: "Inicio", href: "/" },
  { label: "Produtos", href: "/produtos" },
  { label: "Quem Somos", href: "/sobre" },
  { label: "Contato", href: "/contato" },
] as const;

export function GamelPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,var(--background),var(--background)_68%,rgba(238,229,218,0.4))]">
      <GamelPublicHeader />
      <main className="flex-1">{children}</main>
      <GamelPublicFooter />
      <GamelWhatsAppFloatingButton />
    </div>
  );
}

export function GamelPublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = searchQuery.trim();
    if (!normalized) return;
    window.location.assign(`/produtos?busca=${encodeURIComponent(normalized)}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand/95 text-white shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)] backdrop-blur">
      <div className="border-b border-white/10 bg-secondary">
        <div className="shell-wide flex min-h-9 items-center justify-between gap-4 py-2 text-xs text-white/72">
          <span>{gamelStoreInfo.description}</span>
          <a
            href={getGamelWhatsAppUrl(gamelWhatsAppMessages.default)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp comercial
          </a>
        </div>
      </div>

      <div className="shell-wide flex min-h-[4.7rem] items-center gap-3 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/assets/brand/gamel-icon-512.png"
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-3xl leading-none text-white">
              {gamelStoreInfo.name}
            </span>
            <span className="block truncate text-xs text-white/58">{gamelStoreInfo.tagline}</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="ml-4 hidden min-w-[14rem] flex-1 lg:flex">
          <div className="flex h-11 w-full overflow-hidden rounded-md border border-white/14 bg-white/8 focus-within:border-action">
            <input
              type="search"
              placeholder="Buscar produto, categoria, aplicacao ou marca"
              className="h-11 flex-1 rounded-none border-0 bg-transparent px-4 text-sm text-white placeholder:text-white/45 focus:outline-none"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button
              type="submit"
              className="flex h-11 w-12 items-center justify-center bg-action text-white hover:bg-accent"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </form>

        <nav className="ml-auto hidden items-center gap-1 xl:flex">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/76 transition-colors hover:bg-white/8 hover:text-white [&.active]:bg-white/10 [&.active]:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <GamelQuoteCartIconButton
          label="Carrinho"
          className="ml-auto hidden border-action/70 bg-action text-white hover:bg-accent xl:inline-flex"
        />

        <GamelQuoteCartIconButton className="ml-auto xl:hidden" />

        <Button
          variant="ghost"
          size="icon"
          className="border border-white/12 text-white hover:bg-white/10 xl:hidden"
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-white/10 bg-brand xl:hidden">
          <div className="shell-wide space-y-4 py-4">
            <form
              onSubmit={handleSearch}
              className="flex overflow-hidden rounded-md border border-white/12 bg-white/8"
            >
              <input
                type="search"
                placeholder="Buscar produtos"
                className="h-11 flex-1 rounded-none border-0 bg-transparent px-3 text-white placeholder:text-white/45 focus:outline-none"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit" className="px-4 text-white" aria-label="Buscar">
                <Search className="h-4 w-4" />
              </button>
            </form>
            <div className="grid gap-2">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-md border border-white/10 px-4 py-3 text-sm text-white/82"
                >
                  {link.label}
                </Link>
              ))}
              <GamelQuoteCartMobileLink onClick={() => setIsMenuOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function GamelPublicProductCard({ product }: { product: Product }) {
  const measureSummary = product.specs?.[0]?.value || product.unit || "";
  const productWhatsAppUrl = getGamelWhatsAppUrl(gamelWhatsAppMessages.product(product.name));

  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.id }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[1.18/1] overflow-hidden bg-white">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.025]"
          loading="lazy"
          decoding="async"
        />
        {product.featured ? (
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            Destaque
          </span>
        ) : null}
        <span className="absolute bottom-3 right-3 rounded-md border border-border bg-white/90 px-2 py-1 text-xs font-medium text-foreground">
          SKU {product.id.slice(0, 10).toUpperCase()}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">GAMEL</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-border px-2 py-1 text-xs">
            {product.categoryName}
          </span>
          {product.applications.length > 0 ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs">Aplicacao</span>
          ) : null}
        </div>

        <h3 className="mt-3 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-foreground group-hover:text-primary">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {product.description || "Produto disponivel para consulta comercial e orcamento online."}
        </p>

        {measureSummary ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Ruler className="h-3.5 w-3.5 text-primary" />
            <span>{measureSummary}</span>
          </div>
        ) : null}

        <div className="mt-auto pt-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Consulte preco, disponibilidade, quantidade e atendimento com a equipe comercial.
          </div>

          <div className="mt-3 grid gap-2">
            <GamelAddToQuoteButton product={product} />
            <div className="grid gap-2 min-[430px]:grid-cols-2">
              <Button asChild type="button" variant="outline" size="sm" className="h-9 rounded-md">
                <Link to="/produto/$slug" params={{ slug: product.id }}>
                  <span className="truncate">Ver aplicacoes</span>
                </Link>
              </Button>
              <Button
                asChild
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-md border-whatsapp/30 text-whatsapp"
              >
                <a href={productWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" />
                  <span className="truncate">Interesse</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function GamelPublicFooter() {
  const categoryLinks = useMemo(() => gamelFeaturedCategories.slice(0, 6), []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer id="contato" className="mt-12 bg-brand text-white">
      <button
        onClick={scrollToTop}
        className="flex w-full items-center justify-center gap-2 border-y border-white/10 bg-secondary py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/72"
      >
        <ChevronUp className="h-4 w-4" />
        Voltar ao topo
      </button>

      <div className="shell-wide grid gap-8 py-12 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
        <div id="sobre">
          <div className="flex items-center gap-3">
            <img
              src="/assets/brand/gamel-icon-512.png"
              alt=""
              className="h-16 w-16 shrink-0 object-contain"
            />
            <div>
              <p className="font-display text-4xl leading-none text-white">GAMEL</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Garanhuns Metal
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/68">{gamelStoreInfo.slogan}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {gamelStoreInfo.domain}
          </p>
        </div>

        <div>
          <h4 className="text-lg text-white">Categorias</h4>
          <div className="mt-4 space-y-3 text-sm">
            {categoryLinks.map((item) => (
              <Link
                key={item.slug}
                to={item.slug === "todos" ? "/produtos" : "/categoria/$slug"}
                params={item.slug === "todos" ? undefined : { slug: item.slug }}
                className="block text-white/68 hover:text-white"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-lg text-white">Links uteis</h4>
          <div className="mt-4 space-y-3 text-sm">
            {navigationLinks.map((link) => (
              <Link key={link.href} to={link.href} className="block text-white/68 hover:text-white">
                {link.label}
              </Link>
            ))}
            <Link to="/carrinho" className="block text-white/68 hover:text-white">
              Carrinho
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-lg text-white">Contato</h4>
          <div className="mt-4 space-y-4 text-sm text-white/68">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-action" />
              <span>{gamelStoreInfo.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-action" />
              <span>{gamelStoreInfo.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-action" />
              <span>{gamelStoreInfo.email}</span>
            </div>
            <a
              href={getGamelWhatsAppUrl(gamelWhatsAppMessages.default)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2 font-semibold text-white hover:bg-accent"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp comercial
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell-wide flex flex-col gap-3 py-4 pr-24 text-xs text-white/52 md:flex-row md:items-center md:justify-between lg:pr-28">
          <p>{new Date().getFullYear()} GARANHUNS METAL LTDA. Catalogo institucional.</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/carrinho"
              className="inline-flex min-h-9 items-center rounded-md px-3 font-semibold text-white/68 hover:bg-white/8 hover:text-white"
            >
              Ver carrinho
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function GamelWhatsAppFloatingButton() {
  return (
    <a
      href={getGamelWhatsAppUrl(gamelWhatsAppMessages.default)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-sm font-bold text-white shadow-pop transition-transform hover:scale-[1.03]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Fale conosco</span>
    </a>
  );
}
