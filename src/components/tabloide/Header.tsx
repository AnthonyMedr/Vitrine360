import { MessageCircle, Search } from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { useSettings, whatsappLink } from "@/context/SettingsContext";

export function Header({ onSearch, query }: { onSearch: (q: string) => void; query: string }) {
  const { settings } = useSettings();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <div className="rounded-lg bg-brand p-1.5 shadow-card">
            <StoreLogo
              brand={settings.brand}
              logoUrl={settings.logoUrl}
              imageClassName="size-8"
              fallbackClassName="size-8 bg-brand-foreground/10 text-brand-foreground"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-extrabold uppercase tracking-tight text-foreground sm:text-lg">
              {settings.brand}
            </span>
            <span className="mt-0.5 hidden text-[10px] font-bold uppercase tracking-widest text-action sm:block">
              Tabloide Digital
            </span>
          </div>
        </a>

        <div className="relative mx-4 hidden max-w-md flex-1 md:flex">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="O que voce procura? Ripado, forro PVC, chapa UV..."
            className="w-full rounded-full border border-transparent bg-surface py-2 pl-10 pr-4 text-sm focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20"
            aria-label="Buscar produtos"
          />
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#ofertas"
            className="hidden px-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:text-action sm:inline-flex"
          >
            Ofertas
          </a>
          <a
            href={whatsappLink(
              `Ola! Vi o Tabloide Digital do ${settings.brand} e gostaria de fazer um orcamento.`,
              settings.whatsappNumber,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-action px-3 py-2 text-xs font-bold text-action-foreground shadow-card transition-all hover:brightness-110 sm:px-4 sm:text-sm"
          >
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </div>
    </header>
  );
}
