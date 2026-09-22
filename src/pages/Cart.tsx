import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, MapPin, Minus, Package2, Plus, ShieldCheck, ShoppingBag, Store, Tag, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/products/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { getCartLineLabel, getCartLineTotal, getCartOperationalLabel, useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useCoupon } from "@/hooks/useCoupon";
import { useProducts } from "@/hooks/useProducts";
import { useShipping } from "@/hooks/useShipping";
import { CATALOG_ROUTES } from "@/lib/catalogRoutes";
import { STORE_INFO } from "@/constants/store";
import { getCustomerProfile, saveCartRecord, saveCartRecordAsync } from "@/lib/customerCenter";

export default function Cart() {
  const { items, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const { user } = useAuth();
  const [shippingOption, setShippingOption] = useState("pickup");
  const [zipCode, setZipCode] = useState("");
  const [shippingMessage, setShippingMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [savedCartName, setSavedCartName] = useState("");
  const [savingCart, setSavingCart] = useState(false);
  const { coupon, loading: couponLoading, error: couponError, validateCoupon, calculateDiscount, removeCoupon } = useCoupon();
  const { data: suggestions = [] } = useProducts({ featured: true, limit: 4 });
  const {
    loading: shippingLoading,
    options: shippingOptions,
    error: shippingError,
    message: quoteMessage,
    underAnalysis: shippingUnderAnalysis,
    nationalCoverage,
    calculateShipping,
    formatCep,
    setSelectedOption,
  } = useShipping();

  const quotedDeliveryOption = shippingOptions.find((option) => option.deliveryType === "delivery") ?? shippingOptions[0] ?? null;
  const shippingCost =
    shippingOption === "delivery"
      ? quotedDeliveryOption?.price ?? 0
      : 0;
  const shippingCostLabel =
    shippingOption === "delivery" && !quotedDeliveryOption
      ? "A calcular"
      : shippingCost === 0
        ? "Gratis"
        : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`;
  const discount = calculateDiscount(totalPrice);
  const finalTotal = totalPrice + shippingCost - discount;
  const freeShippingThreshold = STORE_INFO.freeShipping.minValue;
  const remainingForFreeShipping = freeShippingThreshold - totalPrice;
  const suggestionPool = suggestions.filter((product) => !items.some((item) => item.product.id === product.id));
  const profile = getCustomerProfile(user);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Digite um codigo de cupom");
      return;
    }
    const result = await validateCoupon(couponCode.toUpperCase().trim(), totalPrice);
    if (result) {
      toast.success("Cupom aplicado");
      setCouponCode("");
    } else if (couponError) {
      toast.error(couponError);
    }
  };

  const handleSaveCart = async () => {
    if (items.length === 0) {
      toast.error("Seu carrinho precisa ter itens para ser salvo");
      return;
    }

    const nextName = savedCartName.trim() || `Carrinho ${new Date().toLocaleDateString("pt-BR")}`;
    setSavingCart(true);
    try {
      const result = await saveCartRecordAsync(nextName, items, user);
      setSavedCartName("");

      if (result.persisted) {
        toast.success("Carrinho salvo na sua conta para recuperar depois");
      } else if (result.reason === "guest") {
        toast.success("Carrinho salvo neste dispositivo. Entre na conta para sincronizar.");
      } else {
        toast.warning("Carrinho salvo neste dispositivo. A sincronizacao com a conta falhou.");
      }
    } finally {
      setSavingCart(false);
    }
  };

  const handleZipCodeSimulation = () => {
    const normalized = zipCode.replace(/\D/g, "");
    if (normalized.length !== 8) {
      toast.error("Informe um CEP valido para simular o frete");
      return;
    }

    void calculateShipping(
      normalized,
      totalPrice,
      items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    ).then(() => {
      setShippingOption("delivery");
      setSelectedOption(null);
      setShippingMessage(
        totalPrice >= freeShippingThreshold
          ? "Frete promocional liberado para está faixa de pedido. Você ainda podera revisar opções no checkout."
          : "Simulacao inicial pronta. As opções finais de entrega ou cotação serão confirmadas na etapa de checkout.",
      );
    });
  };

  const handleSaveItemForLater = (productId: string) => {
    const item = items.find((entry) => entry.product.id === productId);
    if (!item) return;
    const nextName = `Salvar para depois - ${item.product.name}`;
    saveCartRecord(nextName, [item], user);
    removeItem(productId);
    toast.success("Item salvo para depois");
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl rounded-lg border border-border/80 bg-white px-8 py-10 shadow-sm">
            <ShoppingBag className="mx-auto h-20 w-20 text-muted-foreground/35" />
            <h1 className="mt-6 font-display text-3xl font-bold">Seu carrinho ainda está vazio</h1>
            <p className="mt-3 text-muted-foreground">
              Quando você adicionar produtos, eles ficarao aqui com resumo de frete, cupom e recomendacao para fechar o pedido.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link to={CATALOG_ROUTES.allProducts}>Explorar catalogo</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6">
        <div className="rounded-lg border border-border/80 bg-white p-4 shadow-sm sm:p-5 md:p-5">
          <p className="eyebrow">Carrinho ativo</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-secondary md:text-4xl">Revise seu pedido</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Revise quantidades, metragem, caixas calculadas e siga para um checkout mais claro e rapido.
              </p>
            </div>
            <Button asChild variant="outline" size="lg" className="rounded-lg">
              <Link to={CATALOG_ROUTES.allProducts}>
                Continuar comprando
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {remainingForFreeShipping > 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <Truck className="h-5 w-5 shrink-0 text-primary" />
            <span>
              Adicione mais <strong className="text-primary">R$ {remainingForFreeShipping.toFixed(2).replace(".", ",")}</strong> para liberar campanha de frete quando a rota e o CEP forem elegiveis.
            </span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
            <Check className="h-5 w-5 shrink-0" />
            Você ja alcancou a faixa da campanha de frete. A disponibilidade final depende do CEP, volume e transportadora.
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
              <div className="hidden items-center px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:flex">
                <span className="flex-1">Produto</span>
                <span className="w-40 text-center">Quantidade</span>
                <span className="w-32 text-right">Subtotal</span>
              </div>

              {items.map((item, index) => {
                const imageUrl = item.product.image_url || item.product.images?.[0] || "/placeholder.svg";
                const lineTotal = getCartLineTotal(item);
                const lineLabel = getCartLineLabel(item);
                const operationalLabel = getCartOperationalLabel(item);
                const isCommerciallyCalculated = Boolean(
                  item.requestedMeasurement ||
                    item.areaDesiredM2 ||
                    item.weightDesiredKg ||
                    item.volumeDesiredLiters ||
                    item.cubicMetersDesired,
                );

                return (
                  <div key={item.product.id}>
                    {index > 0 && <Separator />}
                    <div className="flex gap-4 p-4 md:px-6 md:py-5">
                      <Link to={`/produto/${item.product.slug}`} className="shrink-0">
                        <div className="h-24 w-24 overflow-hidden rounded-lg bg-muted">
                          <img src={imageUrl} alt={item.product.name} className="h-full w-full object-cover" />
                        </div>
                      </Link>

                      <div className="min-w-0 flex-1">
                        {item.product.brand?.name && (
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.product.brand.name}</p>
                        )}
                        <Link to={`/produto/${item.product.slug}`} className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-tight text-foreground transition-colors hover:text-primary">
                          {item.product.name}
                        </Link>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
                            <Package2 className="h-3.5 w-3.5" />
                            SKU {item.product.sku || item.product.id}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
                            <Store className="h-3.5 w-3.5" />
                            {lineLabel}
                          </span>
                          {isCommerciallyCalculated ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">Operacional: {operationalLabel}</span>
                          ) : null}
                          {item.calculatedBoxes ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">{item.calculatedBoxes} caixas calculadas</span>
                          ) : null}
                          {item.calculatedPackages ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">{item.calculatedPackages} embalagens calculadas</span>
                          ) : null}
                        </div>
                        <button onClick={() => removeItem(item.product.id)} className="mt-4 text-sm font-medium text-primary hover:underline">
                          Excluir item
                        </button>
                        <button onClick={() => handleSaveItemForLater(item.product.id)} className="mt-2 block text-sm font-medium text-muted-foreground hover:text-primary hover:underline">
                          Salvar para depois
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-center">
                        {isCommerciallyCalculated ? (
                          <div className="rounded-lg border px-3 py-2 text-center text-xs text-muted-foreground">
                            Ajuste a metragem na pagina do produto
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              aria-label={`Diminuir quantidade de ${item.product.name}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-16 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              aria-label={`Aumentar quantidade de ${item.product.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="hidden w-32 shrink-0 self-center text-right md:block">
                        <p className="font-display text-xl font-bold">R$ {lineTotal.toFixed(2).replace(".", ",")}</p>
                        <p className="text-xs text-muted-foreground">
                          {`R$ ${Number(item.product.price).toFixed(2).replace(".", ",")} por ${item.product.display_unit ?? item.product.unit_measure ?? "unidade"}`}
                        </p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 text-right md:hidden">
                      <p className="font-display text-xl font-bold">R$ {lineTotal.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                );
              })}

              <div className="border-t px-6 py-4 text-right">
                <span className="text-sm text-muted-foreground">Subtotal ({totalItems} {totalItems === 1 ? "item" : "itens"}): </span>
                <span className="text-xl font-bold">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            {suggestionPool.length > 0 && (
              <section className="rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Para completar o pedido</p>
                    <h2 className="font-display text-2xl font-bold">Sugestoes para sua compra</h2>
                  </div>
                  <Link to={CATALOG_ROUTES.allProducts} className="text-sm font-medium text-primary hover:underline">Ver catalogo</Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {suggestionPool.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} compact />
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Carrinho como ativo comercial</p>
                  <h2 className="font-display text-2xl font-bold">Salvar para continuar depois</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Guarde este carrinho para recompra futura, comparacao entre pedidos ou conclusao com apoio comercial.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/45 px-4 py-3 text-sm">
                  {profile.savedCarts.length} carrinho{profile.savedCarts.length === 1 ? "" : "s"} salvo{profile.savedCarts.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
                <Input
                  value={savedCartName}
                  onChange={(event) => setSavedCartName(event.target.value)}
                  placeholder="Nomeie este carrinho. Ex.: Obra banheiro, reposicao, cliente showroom"
                  className="h-11 rounded-lg"
                />
                <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={handleSaveCart} disabled={savingCart}>
                  {savingCart ? "Salvando..." : "Salvar carrinho"}
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {user?.id
                  ? "Carrinhos salvos ficam vinculados a sua conta e podem ser recuperados na area Minha conta."
                  : "Como visitante, o carrinho fica salvo neste dispositivo. Entre na conta para sincronizar entre atendimentos."}
              </p>
            </section>

            <section className="rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Frete rapido no carrinho</p>
                  <h2 className="font-display text-2xl font-bold">Simule o CEP antes do checkout</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                    O projeto pede calculo de frete desde o carrinho. Aqui você antecipa a decisão e fecha os detalhes na etapa de entrega.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/45 px-4 py-3 text-sm">
                  Retirada sempre disponivel
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={zipCode}
                    onChange={(event) => setZipCode(formatCep(event.target.value))}
                    placeholder="Digite o CEP da entrega"
                    className="h-11 rounded-lg pl-10"
                  />
                </div>
                <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={handleZipCodeSimulation} disabled={shippingLoading}>
                  {shippingLoading ? "Calculando..." : "Calcular frete"}
                </Button>
              </div>

              {shippingMessage ? <p className="mt-3 text-sm text-muted-foreground">{shippingMessage}</p> : null}
              {shippingError ? <p className="mt-3 text-sm text-destructive">{shippingError}</p> : null}
              {quoteMessage ? <p className="mt-2 text-sm text-muted-foreground">{quoteMessage}</p> : null}
              {nationalCoverage?.requested && shippingUnderAnalysis ? (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Cotação nacional em analise</p>
                  <p className="mt-1">
                    Este CEP exige provider nacional homologado ou atendimento comercial para fechar prazo e custo. Continue para o checkout ou acione o atendimento.
                  </p>
                </div>
              ) : null}
              {shippingOptions.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {shippingOptions.slice(0, 2).map((option) => (
                    <div key={option.id} className="rounded-lg border border-border/70 bg-card/70 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">{option.name}</span>
                        <span className="font-semibold">{option.price === 0 ? "Gratis" : `R$ ${option.price.toFixed(2).replace(".", ",")}`}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{option.estimatedDays}</span>
                        {option.isCheapest ? <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">mais barato</span> : null}
                        {option.isFastest ? <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">mais rapido</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="space-y-4">
            <div className="sticky top-24 rounded-lg border border-border/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Resumo do pedido</h2>
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-5 space-y-3">
                {coupon ? (
                  <div className="flex items-center justify-between rounded-lg border border-success bg-success/10 p-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium text-success">{coupon.code}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive" aria-label={`Remover cupom ${coupon.code}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="Cupom de desconto" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} className="h-10 rounded-lg" />
                    <Button variant="outline" size="sm" className="h-10 shrink-0 rounded-lg" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                      {couponLoading ? "..." : "Aplicar"}
                    </Button>
                  </div>
                )}

                <RadioGroup value={shippingOption} onValueChange={setShippingOption} className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="flex flex-1 cursor-pointer items-center gap-3">
                      <Store className="h-4 w-4 text-success" />
                      <div className="flex-1">
                        <p className="font-medium">Retirar na loja</p>
                        <p className="text-xs text-muted-foreground">Disponivel em ate 2 horas</p>
                      </div>
                      <span className="font-semibold text-success">Gratis</span>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery" className="flex flex-1 cursor-pointer items-center gap-3">
                      <Truck className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">Entrega por CEP</p>
                        <p className="text-xs text-muted-foreground">Prazo e custo confirmados por rota ou transportadora</p>
                      </div>
                      <span className="font-semibold">{shippingCostLabel}</span>
                    </Label>
                  </div>
                </RadioGroup>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Desconto</span>
                      <span>-R$ {discount.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className={shippingCost === 0 ? "font-medium text-success" : ""}>
                      {shippingCostLabel}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total do pedido</p>
                    <p className="font-display text-3xl font-bold">R$ {finalTotal.toFixed(2).replace(".", ",")}</p>
                  </div>
                  <p className="text-right text-[11px] text-muted-foreground">10x de R$ {(finalTotal / 10).toFixed(2).replace(".", ",")} sem juros</p>
                </div>

                <Button asChild variant="hero" size="lg" className="mt-2 w-full rounded-lg">
                  <Link to="/checkout">
                    Ir para o checkout
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
