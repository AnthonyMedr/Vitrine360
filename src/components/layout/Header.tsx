import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { buildCatalogSearchPath } from "@/lib/catalogRoutes";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { STORE_INFO } from "@/constants/store";

const navigationLinks = [
  { label: "Início", href: "/" },
  { label: "Produtos", href: "/produtos" },
  { label: "Para empresas", href: "/vendas-para-empresas" },
  { label: "Quem Somos", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const quoteCart = useQuoteCart();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleCartItems = quoteCart.items.slice(0, 4);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(location.pathname.startsWith("/produtos") || location.pathname.startsWith("/busca") ? params.get("q") ?? "" : "");
  }, [location.pathname, location.search]);

  const isActivePath = useMemo(() => {
    return (href: string) => location.pathname === href || (href !== "/" && location.pathname.startsWith(href));
  }, [location.pathname]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = searchQuery.trim();
    if (!normalized) return;
    navigate(buildCatalogSearchPath(normalized));
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black text-white shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)]">
      <div className="shell-wide flex min-h-[4.75rem] max-w-[1440px] items-center gap-3 py-2.5 lg:gap-4">
        <Link to="/" className="header-logo group flex shrink-0 items-center gap-3" aria-label="Página inicial GAMEL">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden" aria-hidden="true">
            <img
              src="/assets/brand/gamel-icone-512.png"
              alt=""
              className="scale-[1.45] transition-transform duration-300 group-hover:scale-[1.52]"
            />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block whitespace-nowrap font-display text-[1.75rem] leading-[0.9] tracking-[0.025em] text-white">{STORE_INFO.name}</span>
            <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-white/58">Garanhuns/PE</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="hidden min-w-[19rem] max-w-[38rem] flex-1 lg:flex">
          <div className="flex h-12 w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.06] shadow-inner shadow-black/20 transition-colors focus-within:border-[#ff6417] focus-within:bg-white/[0.09]">
            <Input
              type="search"
              placeholder="Buscar produto, categoria, aplicação ou marca"
              className="h-12 flex-1 rounded-none border-0 bg-transparent px-4 text-sm text-white placeholder:text-white/45 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit" className="flex h-12 w-14 items-center justify-center border-l border-white/10 bg-[#ff6417] text-white transition-colors hover:bg-[#e9560b]" aria-label="Buscar">
              <Search className="h-5 w-5" />
            </button>
          </div>
        </form>

        <nav className="ml-auto hidden items-center gap-1 border-l border-white/10 pl-4 xl:flex">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                isActivePath(link.href) ? "bg-[#ff6417] text-white shadow-[0_8px_18px_-10px_rgba(255,100,23,0.9)]" : "text-white/75 hover:bg-white/8 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Sheet>
          <SheetTrigger asChild>
            <Button className="relative hidden h-12 rounded-lg border-0 bg-[#ff6417] px-5 font-bold text-white shadow-[0_8px_20px_-12px_rgba(255,100,23,.9)] transition-colors hover:bg-[#e9560b] xl:inline-flex" aria-label="Abrir meu orçamento">
              <ShoppingCart className="h-5 w-5" />
              <span>Meu orçamento</span>
              {quoteCart.totalItems > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6417] px-1.5 text-[10px] font-bold leading-none text-white">
                  {quoteCart.totalItems > 99 ? "99+" : quoteCart.totalItems}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full max-w-md flex-col p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>Resumo do orçamento</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {quoteCart.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum produto selecionado ainda.
                </div>
              ) : (
                <div className="grid gap-3">
                  {visibleCartItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[56px_1fr_auto] gap-3 rounded-md border p-2">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-contain" /> : <ShoppingCart className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-5">{item.productName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.quantity} {item.unit || "un"}{item.variantLabel ? ` | ${item.variantLabel}` : ""}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => quoteCart.removeItem(item.id)} aria-label="Remover item">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {quoteCart.items.length > visibleCartItems.length ? (
                    <p className="text-xs text-muted-foreground">Mais {quoteCart.items.length - visibleCartItems.length} item(ns) no orçamento.</p>
                  ) : null}
                </div>
              )}
            </div>
            <div className="border-t p-5">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Itens selecionados</span>
                <strong>{quoteCart.totalItems}</strong>
              </div>
              <Button asChild className="h-11 w-full rounded-md bg-[#ff6417] text-white hover:bg-[#e9560b]">
                <Link to="/orcamento">Revisar solicitação</Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 h-10 w-full rounded-md">
                <Link to="/produtos">Continuar no catálogo</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Button asChild className="relative ml-auto h-10 rounded-lg border-0 bg-[#ff6417] px-3 font-bold text-white hover:bg-[#e9560b] sm:px-4 xl:hidden" aria-label="Abrir meu orçamento">
          <Link to="/orcamento">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Meu orçamento</span>
            {quoteCart.totalItems > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6417] px-1.5 text-[10px] font-bold leading-none text-white">
                {quoteCart.totalItems > 99 ? "99+" : quoteCart.totalItems}
              </span>
            ) : null}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" className="border border-white/12 text-white hover:bg-white/10 xl:hidden" onClick={() => setIsMenuOpen((value) => !value)}>
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-white/10 bg-[#111] xl:hidden">
          <div className="shell-wide space-y-4 py-4">
            <form onSubmit={handleSearch} className="flex overflow-hidden rounded-md border border-white/12 bg-white/8">
              <Input
                type="search"
                placeholder="Buscar produtos"
                className="h-11 flex-1 rounded-none border-0 bg-transparent text-white placeholder:text-white/45 focus-visible:ring-0"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit" className="px-4 text-white" aria-label="Buscar">
                <Search className="h-4 w-4" />
              </button>
            </form>
            <div className="grid gap-2">
              {navigationLinks.map((link) => (
                <Link key={link.href} to={link.href} onClick={() => setIsMenuOpen(false)} className="rounded-md border border-white/10 px-4 py-3 text-sm text-white/82">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
