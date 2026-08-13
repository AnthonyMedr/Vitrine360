import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQuoteCart } from "@/context/QuoteCartContext";
import type { Product } from "@/data/products";
import { cn } from "@/lib/utils";

export function GamelAddToQuoteButton({
  product,
  className,
  children,
}: {
  product: Product;
  className?: string;
  children?: ReactNode;
}) {
  const quoteCart = useQuoteCart();
  const alreadySelected = quoteCart.hasProduct(product.id);

  return (
    <Button
      type="button"
      size="sm"
      className={cn("h-10 rounded-md", className)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        quoteCart.addProduct(product);
        toast.success(
          alreadySelected ? "Quantidade atualizada" : "Produto adicionado ao orçamento",
          {
            description: "Você pode revisar os itens no carrinho ou continuar no catálogo.",
          },
        );
      }}
    >
      {children ?? (
        <>
          {alreadySelected ? "Adicionar mais" : "Adicionar ao orçamento"}
          {alreadySelected ? (
            <Plus className="ml-2 h-4 w-4" />
          ) : (
            <ArrowRight className="ml-2 h-4 w-4" />
          )}
        </>
      )}
    </Button>
  );
}

export function GamelQuoteCartIconButton({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const quoteCart = useQuoteCart();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={label ? "default" : "icon"}
          className={cn(
            "relative h-11 border-white/14 bg-white/8 text-white hover:bg-white/12 hover:text-white",
            label ? "gap-2 px-4" : "w-11",
            className,
          )}
          aria-label="Abrir carrinho de orcamento"
        >
          <ShoppingCart className="h-5 w-5" />
          {label ? <span className="font-semibold">{label}</span> : null}
          {quoteCart.totalItems > 0 ? <QuoteCartBadge value={quoteCart.totalItems} /> : null}
        </Button>
      </SheetTrigger>
      <GamelQuoteCartSheetContent />
    </Sheet>
  );
}

export function GamelQuoteCartMobileLink({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  const quoteCart = useQuoteCart();

  return (
    <Link
      to="/carrinho"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-md bg-action px-4 py-3 text-sm font-semibold text-white",
        className,
      )}
    >
      <span>Revisar orçamento</span>
      {quoteCart.totalItems > 0 ? (
        <span className="rounded-full bg-white/18 px-2 py-0.5 text-xs">{quoteCart.totalItems}</span>
      ) : null}
    </Link>
  );
}

function QuoteCartBadge({ value }: { value: number }) {
  return (
    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[10px] font-bold leading-none text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function GamelQuoteCartSheetContent() {
  const quoteCart = useQuoteCart();
  const visibleItems = quoteCart.items.slice(0, 5);

  return (
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
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[56px_1fr_auto] gap-3 rounded-md border p-2"
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-5">{item.productName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.quantity} {item.unit || "un"}
                    {item.categoryName ? ` | ${item.categoryName}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => quoteCart.removeItem(item.id)}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {quoteCart.items.length > visibleItems.length ? (
              <p className="text-xs text-muted-foreground">
                Mais {quoteCart.items.length - visibleItems.length} item(ns) no orçamento.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t p-5">
        <div className="mb-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Produtos</span>
            <strong>{quoteCart.totalLines}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Quantidade total</span>
            <strong>{quoteCart.totalItems}</strong>
          </div>
        </div>
        <Button asChild className="h-11 w-full rounded-md bg-action text-white hover:bg-accent">
          <Link to="/carrinho">
            <Check className="mr-2 h-4 w-4" />
            Revisar carrinho
          </Link>
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-10 rounded-md">
            <Link to="/produtos">Catálogo</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md"
            onClick={quoteCart.clearCart}
            disabled={quoteCart.items.length === 0}
          >
            Limpar
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}

export function GamelQuoteCartLineControls({ id, quantity }: { id: string; quantity: number }) {
  const quoteCart = useQuoteCart();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => quoteCart.updateItem(id, { quantity: quantity - 1 })}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        value={quantity}
        type="number"
        min={1}
        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-sm"
        onChange={(event) =>
          quoteCart.updateItem(id, { quantity: Number(event.target.value || 1) })
        }
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => quoteCart.updateItem(id, { quantity: quantity + 1 })}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
