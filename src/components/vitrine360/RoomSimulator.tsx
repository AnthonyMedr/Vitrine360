import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Home, Loader2, Wrench, Lightbulb } from "lucide-react";
import { simulateRoom } from "@/lib/ai.functions";
import { products as defaultProducts, type Product } from "@/data/products";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { ProductModal } from "@/components/tabloide/ProductModal";
import { trackEvent } from "@/lib/analytics";

const ROOMS = [
  "Sala de estar",
  "Cozinha",
  "Banheiro",
  "Quarto",
  "Area gourmet",
  "Fachada comercial",
  "Loja / escritorio",
  "Garagem coberta",
  "Recepcao corporativa",
  "Restaurante",
];

const STYLES = ["Moderno", "Clean", "Industrial", "Rustico", "Sofisticado", "Biofilico"];

export function RoomSimulator({ products = defaultProducts }: { products?: Product[] }) {
  const [room, setRoom] = useState(ROOMS[0]);
  const [style, setStyle] = useState(STYLES[0]);
  const [open, setOpen] = useState<Product | null>(null);
  const fn = useServerFn(simulateRoom);
  const mut = useMutation({
    mutationFn: (input: { room: string; style: string }) => fn({ data: input }),
  });

  const run = () => {
    trackEvent("room_simulator", { label: `${room} | ${style}` });
    mut.mutate({ room, style });
  };

  const items = (mut.data?.itens ?? [])
    .map((i) => ({ ...i, product: products.find((p) => p.id === i.id) }))
    .filter((x): x is typeof x & { product: Product } => Boolean(x.product));

  return (
    <section data-testid="room-simulator-section" className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-center gap-2 text-highlight text-xs uppercase tracking-widest font-black">
          <Home className="size-4" /> Simulador de ambientes
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter mt-2">
          Escolha o espaco. Veja modelos, ficha tecnica e dicas de instalacao.
        </h2>

        <div className="mt-6 grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="bg-background/10 border border-background/20 text-background rounded-xl px-4 py-3 text-sm font-bold"
          >
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="bg-background/10 border border-background/20 text-background rounded-xl px-4 py-3 text-sm font-bold"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={mut.isPending}
            className="inline-flex items-center justify-center gap-2 bg-highlight text-highlight-foreground font-black px-6 py-3 rounded-xl shadow-card hover:brightness-110 disabled:opacity-60"
          >
            {mut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wrench className="size-4" />
            )}
            Simular ambiente
          </button>
        </div>

        {mut.error && (
          <p className="mt-4 text-sm text-destructive">{(mut.error as Error).message}</p>
        )}

        {mut.data && (
          <div className="mt-8 grid lg:grid-cols-[1fr_2fr] gap-6">
            <div className="bg-background/5 border border-background/10 rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest font-bold text-highlight">
                Conceito
              </p>
              <p className="mt-2 text-sm leading-relaxed">{mut.data.conceito || "-"}</p>
              {mut.data.combinacoes && (
                <>
                  <p className="mt-5 text-[11px] uppercase tracking-widest font-bold text-highlight">
                    Combinacoes
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{mut.data.combinacoes}</p>
                </>
              )}
              {mut.data.manutencao && (
                <>
                  <p className="mt-5 text-[11px] uppercase tracking-widest font-bold text-highlight">
                    Manutencao
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{mut.data.manutencao}</p>
                </>
              )}
            </div>
            <div className="space-y-4">
              {items.length === 0 && (
                <p className="text-background/70">Nenhum produto encontrado para este ambiente.</p>
              )}
              {items.map((it) => (
                <article
                  key={it.id}
                  className="bg-background text-foreground rounded-2xl overflow-hidden grid sm:grid-cols-[140px_1fr]"
                >
                  <button onClick={() => setOpen(it.product)} className="block">
                    <img
                      src={it.product.image}
                      alt={it.product.name}
                      className="w-full h-full object-cover aspect-square"
                    />
                  </button>
                  <div className="p-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-brand">
                      {it.product.categoryName}
                    </p>
                    <button
                      onClick={() => setOpen(it.product)}
                      className="font-display font-extrabold text-lg text-left hover:text-action"
                    >
                      {it.product.name}
                    </button>
                    <p className="text-sm mt-1">
                      <span className="font-bold">Papel:</span> {it.papel}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-bold">Specs:</span> {it.specsChave}
                    </p>
                    <p className="text-xs mt-2 flex items-start gap-1.5">
                      <Lightbulb className="size-3.5 shrink-0 mt-0.5 text-highlight" />
                      {it.dicaInstalacao}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
      <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
    </section>
  );
}
