import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Menu, MessageCircle, Monitor, Search, Tag, Tv, X } from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { brandConfig } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { buildGenericMessage, whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/catalogo", label: "Catalogo", icon: LayoutGrid },
  { to: "/ofertas", label: "Ofertas", icon: Tag },
  { to: "/vitrine", label: "Vitrine", icon: Tv },
  { to: "/totem", label: "Totem", icon: Monitor },
] as const;

export function GlobalHeader({ onSearch }: { onSearch?: (query: string) => void }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const wa = whatsappUrl(buildGenericMessage(settings), settings.whatsappNumber);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand/96 text-brand-foreground backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="rounded-xl border border-white/10 bg-white/5 p-1.5 shadow-card">
            <StoreLogo
              brand={settings.brand}
              logoUrl={settings.logoUrl}
              imageClassName="size-8"
              fallbackClassName="size-8 bg-white/10 text-brand-foreground"
            />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-3xl font-normal uppercase">{settings.brand}</span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.28em] text-action">
              {brandConfig.productName}
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.to || path.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-colors",
                  active
                    ? "bg-action text-action-foreground"
                    : "text-brand-foreground/88 hover:bg-white/8",
                )}
              >
                <Icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {onSearch && (
            <Link
              to="/catalogo"
              aria-label="Buscar"
              className="hidden size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 md:inline-flex"
            >
              <Search className="size-4" />
            </Link>
          )}
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-action px-3 py-2 text-xs font-bold text-action-foreground shadow-card transition-all hover:brightness-110 sm:px-4 sm:text-sm"
          >
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          <button
            onClick={() => setOpen((current) => !current)}
            aria-label="Menu"
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-brand lg:hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = path === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold",
                    active
                      ? "bg-action text-action-foreground"
                      : "bg-white/6 text-brand-foreground",
                  )}
                >
                  <Icon className="size-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
