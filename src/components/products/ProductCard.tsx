import { memo, useCallback, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, Ruler } from "lucide-react";
import type { Product } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { getProductWhatsAppUrl } from "@/constants/store";
import { emit } from "@/data/events/eventBus";
import { addToOutbox } from "@/data/events/outbox";
import { getPageContext } from "@/data/events/utmTracking";
import type { LeadCreatedPayload } from "@/domain/types";
import { useQuoteCart } from "@/contexts/QuoteCartContext";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const mediaReviewStatuses = new Set(["manual_review", "suspect", "duplicate", "broken", "missing", "rejected"]);

function formatCommercialLabel(value: string | null | undefined) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ProductCardComponent({ product, compact = false }: ProductCardProps) {
  const navigate = useNavigate();
  const quoteCart = useQuoteCart();
  const { toast } = useToast();
  const imageUrl = product.image_url || product.images?.[0] || "/placeholder.svg";
  const mediaUnderReview = mediaReviewStatuses.has(String(product.image_review_status || "").trim().toLowerCase());
  const brandName = product.brand?.name || "";
  const categoryName = product.category?.name || "";
  const measureSummary = product.measures || product.dimensions || product.diameter || "";
  const applicationSummary = product.application || product.subcategory || categoryName || "Uso sob orientação comercial";

  const quoteUrl = `/orcamento?produto=${encodeURIComponent(product.slug)}&nome=${encodeURIComponent(product.name)}&categoria=${encodeURIComponent(categoryName)}`;
  const alreadySelected = quoteCart.hasProduct(product.id);

  const emitLead = useCallback((channel: "whatsapp" | "form") => {
    if (!FEATURE_FLAGS.events) return;
    const pageContext = getPageContext();
    const payload: LeadCreatedPayload = {
      channel,
      lead_produto_interesse: product.name,
      lead_pagina_origem: pageContext.page_url,
      utm: pageContext.utm,
      context: {
        product_sku: product.sku || product.id,
        product_name: product.name,
        page_url: pageContext.page_url,
        referrer: pageContext.referrer,
      },
    };
    addToOutbox(emit("lead.created", payload));
  }, [product.id, product.name, product.sku]);

  const handleWhatsAppClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    emitLead("whatsapp");
    if (FEATURE_FLAGS.events) addToOutbox(emit("whatsapp.clicked", { product_name: product.name, product_sku: product.sku || product.id }));
    window.open(getProductWhatsAppUrl(product.name), "_blank");
  }, [emitLead, product.id, product.name, product.sku]);

  const handleQuoteClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    emitLead("form");
    if (FEATURE_FLAGS.quoteCart) {
      quoteCart.addProduct(product);
      toast({
        title: alreadySelected ? "Quantidade atualizada" : "Produto adicionado ao seu orçamento.",
        description: "Continue no catálogo ou revise sua solicitação quando quiser.",
      });
      return;
    }
    navigate(quoteUrl);
  }, [alreadySelected, emitLead, navigate, product, quoteCart, quoteUrl, toast]);

  return (
    <Link to={`/produto/${product.slug}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
      <div className={`relative overflow-hidden bg-white ${compact ? "aspect-[4/3]" : "aspect-[1.18/1]"}`}>
        {mediaUnderReview ? (
          <div className="flex h-full w-full items-center justify-center px-5 text-center text-sm font-medium text-muted-foreground">
            Imagem em revisão. Cadastro comercial disponivel.
          </div>
        ) : (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.025]" loading="lazy" decoding="async" />
        )}
        {product.is_featured ? <Badge className="absolute left-3 top-3 rounded-md border-0 bg-primary text-primary-foreground">Destaque</Badge> : null}
        {product.sku ? <Badge variant="outline" className="absolute bottom-3 right-3 rounded-md bg-white/90">SKU {product.sku}</Badge> : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {brandName ? <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{brandName}</p> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categoryName ? <Badge variant="outline" className="rounded-md">{categoryName}</Badge> : null}
          {product.delivery_type ? <Badge variant="secondary" className="rounded-md">{formatCommercialLabel(product.delivery_type)}</Badge> : null}
        </div>

        <h3 className="mt-3 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-foreground group-hover:text-primary">{product.name}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{product.short_description || product.description || "Produto disponível para consulta comercial e orçamento online."}</p>
        {!compact ? (
          <div className="mt-3 rounded-md bg-muted/35 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Aplicacao indicada</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground">{applicationSummary}</p>
          </div>
        ) : null}

        {measureSummary && !compact ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Ruler className="h-3.5 w-3.5 text-primary" />
            <span>{measureSummary}</span>
          </div>
        ) : null}

        <div className="mt-auto pt-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
            Consulte preço, disponibilidade, quantidade e atendimento com a equipe comercial.
          </div>

          <div className="mt-3 grid gap-2">
            <Button type="button" size="sm" className="h-10 rounded-md" onClick={handleQuoteClick}>
              {alreadySelected ? "Adicionar mais" : "Adicionar ao orçamento"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="grid gap-2 min-[430px]:grid-cols-2">
              {alreadySelected ? (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-md" onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate("/orcamento");
                }}>
                  <span className="truncate">Ver orcamento</span>
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-md" onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate(`/produto/${product.slug}#aplicacoes`);
                }}>
                  <span className="truncate">Ver aplicacoes</span>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-md border-[#25D366]/30 text-[#128C7E]" onClick={handleWhatsAppClick}>
                <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="truncate">Interesse</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardComponent);
