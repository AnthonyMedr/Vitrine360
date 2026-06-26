import { useEffect, useState } from "react";
import type { Product } from "@/data/products";
import { findProduct } from "@/data/products";
import { useSettings } from "@/context/SettingsContext";
import {
  MessageCircle,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  QrCode,
} from "lucide-react";
import { QRCode } from "./QRCode";
import { cn } from "@/lib/utils";
import { buildProductMessage, whatsappUrl } from "@/lib/whatsapp";
import { trackEvent, trackWhatsApp } from "@/lib/analytics";

export function ProductModal({
  product,
  onClose,
  onOpenRelated,
}: {
  product: Product | null;
  onClose: () => void;
  onOpenRelated?: (p: Product) => void;
}) {
  const { settings } = useSettings();
  const [imgIndex, setImgIndex] = useState(0);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    setImgIndex(0);
    setShowQR(false);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [product, onClose]);

  if (!product) return null;

  const gallery = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
  const current = gallery[imgIndex] ?? product.image;
  const message = buildProductMessage(product, settings);
  const waLink = whatsappUrl(message, settings.whatsappNumber);
  const related = (product.related ?? []).map(findProduct).filter((p): p is Product => Boolean(p));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/70 backdrop-blur-sm p-0 sm:p-6 animate-reveal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-pop"
      >
        {/* Close (always visible, large touch target) */}
        <div className="sticky top-0 z-20 flex justify-end p-3 bg-gradient-to-b from-background/90 to-transparent">
          <button
            onClick={onClose}
            className="bg-background border border-border size-12 rounded-full shadow-card grid place-items-center hover:bg-surface active:scale-95 transition-all"
            aria-label="Fechar"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Gallery */}
        <div className="-mt-16">
          <div className="relative aspect-[16/10] bg-surface overflow-hidden">
            <img src={current} alt={product.name} className="w-full h-full object-cover" />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-12 rounded-full bg-background/90 border border-border grid place-items-center shadow-card hover:bg-background"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  onClick={() => setImgIndex((i) => (i + 1) % gallery.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-12 rounded-full bg-background/90 border border-border grid place-items-center shadow-card hover:bg-background"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="size-6" />
                </button>
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === imgIndex ? "w-8 bg-action" : "w-2 bg-background/70",
                      )}
                      aria-label={`Imagem ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2 px-4 sm:px-6 pt-4 overflow-x-auto no-scrollbar">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  className={cn(
                    "shrink-0 size-20 rounded-xl overflow-hidden border-2 transition-all",
                    i === imgIndex
                      ? "border-action ring-2 ring-action/30"
                      : "border-border opacity-70",
                  )}
                >
                  <img src={g} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-[11px] text-brand font-bold uppercase tracking-widest">
                {product.categoryName}
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight mt-1 mb-3">
                {product.name}
              </h2>
            </div>
            {product.badge && (
              <span className="bg-highlight text-highlight-foreground text-xs font-black px-3 py-1.5 rounded uppercase tracking-wider">
                {product.badge.label}
              </span>
            )}
          </div>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            {product.longDescription}
          </p>

          {/* Tip */}
          {product.tip && (
            <div className="mt-6 flex items-start gap-3 bg-highlight/20 border border-highlight/40 p-4 rounded-2xl">
              <Lightbulb className="size-5 text-foreground shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-foreground">
                <span className="font-bold uppercase tracking-wider text-[11px] mr-2">
                  Dica do especialista:
                </span>
                {product.tip}
              </p>
            </div>
          )}

          {/* Benefits & Applications */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold text-foreground mb-3">
                Benefícios
              </h3>
              <ul className="space-y-2.5">
                {product.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm sm:text-base">
                    <Check className="size-5 text-whatsapp shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest font-bold text-foreground mb-3">
                Aplicações
              </h3>
              <ul className="space-y-2.5">
                {product.applications.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm sm:text-base">
                    <Check className="size-5 text-brand shrink-0 mt-0.5" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Specs */}
          {product.specs && product.specs.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-widest font-bold text-foreground mb-3">
                Ficha técnica
              </h3>
              <dl className="grid sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden">
                {product.specs.map((s) => (
                  <div key={s.label} className="bg-card p-4">
                    <dt className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                      {s.label}
                    </dt>
                    <dd className="text-sm font-semibold text-foreground mt-1">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Ambientes */}
          {product.environments && product.environments.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xs uppercase tracking-widest font-bold text-foreground mb-4">
                Ambientes instalados e inspirações
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {product.environments.map((env) => (
                  <figure
                    key={env.title}
                    onClick={() =>
                      trackEvent("environment_view", {
                        productId: product.id,
                        productName: product.name,
                        label: env.title,
                      })
                    }
                    className="rounded-2xl overflow-hidden border border-border bg-surface cursor-pointer"
                  >
                    <img
                      src={env.image}
                      alt={env.title}
                      className="w-full aspect-[4/3] object-cover"
                    />
                    <figcaption className="p-4">
                      <p className="font-bold text-foreground">{env.title}</p>
                      {env.description && (
                        <p className="text-sm text-muted-foreground mt-1">{env.description}</p>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {related.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xs uppercase tracking-widest font-bold text-foreground mb-4">
                Combina com
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {related.map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => onOpenRelated?.(rp)}
                    className="text-left bg-surface rounded-2xl overflow-hidden border border-border hover:border-action hover:shadow-card transition-all active:scale-95"
                  >
                    <img
                      src={rp.image}
                      alt={rp.name}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-3">
                      <p className="text-[10px] uppercase font-bold text-brand tracking-wider">
                        {rp.categoryName}
                      </p>
                      <p className="text-sm font-bold text-foreground line-clamp-2 mt-0.5">
                        {rp.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sticky CTA */}
          <div className="mt-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-surface rounded-2xl">
            <div>
              <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                Preço
              </span>
              <p className="font-mono text-action text-2xl font-bold">{product.price}</p>
              {product.unit && (
                <span className="text-xs text-muted-foreground">Cobrado por {product.unit}</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowQR((s) => {
                    if (!s)
                      trackEvent("product_qr", {
                        productId: product.id,
                        productName: product.name,
                      });
                    return !s;
                  });
                }}
                className="inline-flex items-center justify-center gap-2 bg-background border border-border text-foreground px-5 py-4 rounded-xl font-bold hover:bg-card active:scale-95 transition-all"
              >
                <QrCode className="size-5" /> {showQR ? "Ocultar QR" : "Levar no celular"}
              </button>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsApp(product, settings)}
                className="inline-flex items-center justify-center gap-2 bg-action text-action-foreground px-6 py-4 rounded-xl font-black text-base shadow-card hover:brightness-110 active:scale-95 transition-all"
              >
                <MessageCircle className="size-5" /> Falar com vendedor
              </a>
            </div>
          </div>

          {showQR && (
            <div className="mt-6 flex flex-col items-center bg-foreground text-background p-6 rounded-2xl animate-reveal">
              <p className="text-xs uppercase tracking-widest font-bold mb-3 text-highlight">
                Aponte a câmera do seu celular
              </p>
              <QRCode
                data={waLink}
                size={200}
                label={`Continue a conversa sobre ${product.name}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
