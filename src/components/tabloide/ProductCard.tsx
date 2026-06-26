import { MessageCircle, Plus } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import type { Product } from "@/data/products";
import { trackEvent, trackWhatsApp } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { buildProductMessage, whatsappUrl } from "@/lib/whatsapp";

const toneClass: Record<NonNullable<Product["badge"]>["tone"], string> = {
  action: "bg-action text-action-foreground",
  brand: "bg-brand text-brand-foreground",
  highlight: "bg-highlight text-highlight-foreground",
  whatsapp: "bg-whatsapp text-whatsapp-foreground",
  dark: "bg-foreground text-background",
};

export function ProductCard({
  product,
  onOpen,
  variant = "compact",
}: {
  product: Product;
  onOpen: (p: Product) => void;
  variant?: "compact" | "featured";
}) {
  const { settings } = useSettings();
  const waUrl = whatsappUrl(buildProductMessage(product, settings), settings.whatsappNumber);
  const isFeatured = variant === "featured";

  const handleOpen = () => {
    trackEvent("product_view", {
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
    });
    onOpen(product);
  };

  const handleWhatsApp = () => {
    trackWhatsApp(product, settings);
  };

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[1.5rem] border border-border bg-card transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-action/30 hover:shadow-pop",
      )}
    >
      <div className="relative overflow-hidden">
        <button
          onClick={handleOpen}
          className="block w-full"
          aria-label={`Ver detalhes de ${product.name}`}
        >
          <img
            src={product.image}
            alt={product.name}
            width={800}
            height={800}
            loading="lazy"
            className={cn(
              "w-full object-cover transition-transform duration-500 group-hover:scale-105",
              isFeatured ? "aspect-[4/3]" : "aspect-square",
            )}
          />
        </button>
        {product.badge && (
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-card",
              toneClass[product.badge.tone],
            )}
          >
            {product.badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-action">
            {product.categoryName}
          </span>
          <h3
            className={cn(
              "mt-1 font-display leading-tight text-foreground",
              isFeatured ? "text-2xl" : "text-xl",
            )}
          >
            {product.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted px-3 py-2">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Preco
            </span>
            <span className="font-mono text-sm font-bold text-action">
              {product.price.toUpperCase()}
            </span>
          </div>
          {product.unit && (
            <span className="rounded-full bg-background px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
              por {product.unit}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsApp}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-action py-2.5 text-xs font-bold text-action-foreground transition-all hover:brightness-110"
          >
            <MessageCircle className="size-4" /> Pedir orcamento
          </a>
          <button
            onClick={handleOpen}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-3 text-surface-foreground transition-colors hover:bg-highlight"
            aria-label="Ver detalhes"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
