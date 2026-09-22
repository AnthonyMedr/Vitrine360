import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Check, ChevronRight, CreditCard, Headset, MapPin, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, Trash2, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/hooks/useAuth";
import { useEventBus } from "@/hooks/useEventBus";
import { useProducts, type Product } from "@/hooks/useProducts";
import { useShipping } from "@/hooks/useShipping";
import { apiFetch } from "@/lib/api";
import type { PaymentMethod } from "@/lib/localCommerce";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";

interface CartItem {
  product: Product;
  quantity: number;
}

interface AssistedStartResponse {
  correlation_id: string;
  mode: {
    order_type: "assisted";
    order_origin: "showroom";
    source_channel: "store";
    source_actor: "human";
    assisted_sale: true;
    delivery_required: true;
    pickup_allowed: false;
  };
  seller: {
    seller_id: string;
    seller_name: string;
    store_id: string;
    store_name: string;
    can_start_assisted_sale: boolean;
  };
}

const ASSISTED_PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de Credito" },
  { value: "payment_link", label: "Link de Pagamento" },
  { value: "store_pos", label: "Pagamento Presencial Vinculado" },
];

const STEPS = [
  { n: 1, label: "Produtos" },
  { n: 2, label: "Cliente" },
  { n: 3, label: "Frete" },
  { n: 4, label: "Pagamento" },
];

export default function AssistedSale() {
  const { isAdmin, canStartAssistedSale, loading: adminLoading } = useAdmin();
  const { user: authUser } = useAuth();
  const { logEvent } = useAuditLog();
  const { emitEvent } = useEventBus();
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const { loading: shippingLoading, options: shippingOptions, selectedOption: selectedShipping, error: shippingError, calculateShipping, setSelectedOption: setSelectedShipping, formatCep } = useShipping();

  const [modeActivated, setModeActivated] = useState(false);
  const [activationLoading, setActivationLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", cpf: "", notes: "" });
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [correlationId, setCorrelationId] = useState("");
  const [sellerContext, setSellerContext] = useState<AssistedStartResponse["seller"] | null>(null);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(query) ||
      (product.sku || "").toLowerCase().includes(query) ||
      (product.category?.name || "").toLowerCase().includes(query) ||
      (product.brand?.name || "").toLowerCase().includes(query),
    );
  }, [products, searchQuery]);

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const shippingCost = selectedShipping?.price || 0;
  const total = subtotal + shippingCost;

  const activateAssistedMode = async () => {
    setActivationLoading(true);
    try {
      const response = await apiFetch<AssistedStartResponse>("/api/assisted-sales/start", { method: "POST" });
      setCorrelationId(response.correlation_id);
      setSellerContext(response.seller);
      setModeActivated(true);
      setStep(1);
      setCartItems([]);
      toast.success("Modo assistido ativado", {
        description: `${response.seller.seller_name} - ${response.seller.store_name}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar a compra assistida");
    } finally {
      setActivationLoading(false);
    }
  };

  const addToCart = async (product: Product) => {
    const isFirstItem = cartItems.length === 0;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      return existing
        ? prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...prev, { product, quantity: 1 }];
    });

    if (isFirstItem && correlationId) {
      await logEvent({
        eventType: "assisted_sale.cart_created",
        correlationId,
        sourceChannel: "store",
        metadata: {
          seller_id: sellerContext?.seller_id || authUser?.id || null,
          seller_name: sellerContext?.seller_name || authUser?.user_metadata?.full_name || authUser?.email || null,
          store_id: sellerContext?.store_id || authUser?.user_metadata?.store_id || null,
          store_name: sellerContext?.store_name || authUser?.user_metadata?.store_name || null,
          first_product_id: product.id,
          first_product_name: product.name,
        },
      });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems((prev) =>
      quantity <= 0 ? prev.filter((item) => item.product.id !== productId) : prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    );
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    if (formatted.replace(/\D/g, "").length === 8) calculateShipping(formatted, subtotal, cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })));
  };

  const handleCustomerStepAdvance = async () => {
    if (!customer.name || !customer.phone || !address.street || !address.number || !address.city || !address.state || !cep) return;
    if (correlationId) {
      await logEvent({
        eventType: "assisted_sale.customer_identified",
        correlationId,
        sourceChannel: "store",
        metadata: { customer_name: customer.name, customer_phone: customer.phone, customer_email: customer.email || null, zip_code: cep, city: address.city, state: address.state },
      });
    }
    setStep(3);
  };

  const handleCreateOrder = async () => {
    if (!sellerContext) return;
    setIsProcessing(true);
    try {
      const response = await apiFetch<{ order: { id: string; order_number: string } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          correlationId,
          idempotencyKey: `${correlationId || "assisted"}-${Date.now()}`,
          customerName: customer.name,
          customerEmail: customer.email || "",
          customerPhone: customer.phone,
          customerCpf: customer.cpf,
          deliveryType: "delivery",
          paymentMethod,
          shippingAddress: { ...address, zipCode: cep },
          shippingCost,
          notes: customer.notes,
          items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          status: "awaiting_payment",
          orderType: "assisted",
          orderOrigin: "showroom",
          sourceChannel: "store",
          sourceActor: "human",
          assistedSale: true,
          sellerId: sellerContext.seller_id,
          sellerName: sellerContext.seller_name,
          storeId: sellerContext.store_id,
          storeName: sellerContext.store_name,
          deliveryRequired: true,
          pickupAllowed: false,
          assistedSaleNotes: customer.notes || null,
        }),
      });

      await apiFetch(`/api/orders/${response.order.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ action: "initiate", paymentMethod }),
      });

      await logEvent({
        orderId: response.order.id,
        eventType: "assisted_sale.payment_started",
        correlationId,
        sourceChannel: "store",
        newValue: {
          order_number: response.order.order_number,
          seller_name: sellerContext.seller_name,
          store_name: sellerContext.store_name,
          customer_name: customer.name,
          total,
          payment_method: paymentMethod,
          payment_linked_to_order: true,
          delivery_required: true,
          items_count: cartItems.length,
        },
      });

      toast.success("Pedido assistido criado com sucesso!", { description: `Pedido ${response.order.order_number} - aguardando pagamento` });
      navigate("/admin");
    } catch (error) {
      toast.error("Erro ao criar pedido", { description: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!sellerContext || cartItems.length === 0 || !customer.name) return;
    setIsProcessing(true);
    try {
      const response = await apiFetch<{ quote: { quote_number: string } }>("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          correlationId,
          customerName: customer.name,
          customerEmail: customer.email || null,
          customerPhone: customer.phone || null,
          notes: customer.notes || null,
          sellerId: sellerContext.seller_id,
          sellerName: sellerContext.seller_name,
          storeId: sellerContext.store_id,
          storeName: sellerContext.store_name,
          items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        }),
      });
      emitEvent("quote.created", {
        quote_number: response.quote.quote_number,
        customer_name: customer.name,
        customer_email: customer.email || undefined,
        customer_phone: customer.phone || undefined,
        lead_origem: "showroom",
        lead_canal: "store",
        lead_produto_interesse: cartItems.map((item) => item.product.name).join(", "),
        lead_pagina_origem: window.location.pathname,
        total: cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
      });
      toast.success("Orçamento salvo", { description: `Orçamento ${response.quote.quote_number} criado com sucesso` });
      navigate("/admin");
    } catch (error) {
      toast.error("Erro ao salvar orçamento", { description: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (adminLoading) return <AdminLoadingState label="Carregando venda assistida..." />;
  if (!isAdmin && !canStartAssistedSale) {
    navigate("/admin");
    return null;
  }

  return (
    <AdminWorkspaceShell
      title="Central de Atendimento"
      eyebrow="Venda assistida"
      description="Operação assistida para showroom e venda omnichannel, com vendedor identificado e auditoria do pedido."
      actions={
        <>
          <Badge className="border-amber-300 bg-amber-100 text-amber-800">Modo vendedor</Badge>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            Voltar ao Admin
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!modeActivated ? (
          <div className="space-y-6">
            <div className="rounded-3xl border bg-card p-8 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Entrada operacional</p>
              <h2 className="mt-3 font-display text-3xl font-bold">Escolha como este atendimento vai comecar</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                O modo assistido precisa ser ativado agora, no inicio do atendimento. A partir dai o pedido ja nasce como
                digital, com vendedor, showroom, entrega obrigatoria e auditoria do fluxo.
              </p>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p><strong>Vendedor logado:</strong> {authUser?.user_metadata?.full_name || authUser?.email || "-"}</p>
                <p><strong>Loja/showroom:</strong> {authUser?.user_metadata?.store_name || "Showroom Garanhuns"}</p>
                <p><strong>Permissao para compra assistida:</strong> {canStartAssistedSale ? "Sim" : "Não"}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <EntryCard title="Novo Pedido Online" description="Abrir a loja para um pedido digital padrao, sem atendimento assistido." icon={<ShoppingBag className="h-5 w-5 text-primary" />} onClick={() => navigate("/produtos")} />
              <EntryCard title="Nova Compra Assistida" description="Ativar o modo showroom com vendedor identificado, entrega obrigatoria e pedido digital." icon={<Headset className="h-5 w-5 text-amber-700" />} highlight loading={activationLoading} onClick={activateAssistedMode} />
              <EntryCard title="Novo Orçamento" description="Registrar interesse comercial antes de transformar em pedido." icon={<Package className="h-5 w-5 text-sky-700" />} onClick={() => toast.info("Fluxo de orçamento em evolucao. Use a compra assistida quando precisar fechar o pedido.")} />
              <EntryCard title="Consultar Pedidos" description="Voltar para o painel e acompanhar pedidos ja criados." icon={<BarChart3 className="h-5 w-5 text-emerald-700" />} onClick={() => navigate("/admin")} />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-800">Compra Assistida</Badge>
                    <Badge variant="outline">Origem: Showroom</Badge>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-bold">Modo assistido ativado no inicio do atendimento</h2>
                  <p className="mt-2 text-sm text-amber-900/85">Todo o carrinho, frete, pagamento e pedido seguirao as regras da venda assistida.</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/admin")}>Cancelar atendimento</Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ModeInfo label="Vendedor responsável" value={sellerContext?.seller_name || "-"} />
                <ModeInfo label="Loja de origem" value={sellerContext?.store_name || "-"} />
                <ModeInfo label="Entrega obrigatoria" value="Sim" />
                <ModeInfo label="Retirada imediata" value="Bloqueada" />
                <ModeInfo label="Correlacao" value={correlationId || "-"} mono />
              </div>
            </div>

            <div className="mb-8 flex items-center gap-4">
              {STEPS.map(({ n, label }) => (
                <div key={n} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= n ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {step > n ? <Check className="h-4 w-4" /> : n}
                  </div>
                  <span className={`hidden text-sm sm:inline ${step >= n ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
                  {n < STEPS.length && <div className="h-px w-6 bg-border" />}
                </div>
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl border bg-card p-6 shadow-card">
                  {step === 1 && (
                    <>
                      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ShoppingCart className="h-5 w-5" />Montagem do carrinho assistido</h2>
                      <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Buscar por nome, SKU, categoria ou marca..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      </div>
                      <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
                        {filteredProducts.map((product) => {
                          const inCart = cartItems.find((item) => item.product.id === product.id);
                          return (
                            <div key={product.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="h-full w-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{product.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {product.sku && <span>SKU: {product.sku}</span>}
                                    <span>Estoque: {product.stock || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="font-bold text-primary">R$ {Number(product.price).toFixed(2).replace(".", ",")}</span>
                                {inCart ? (
                                  <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, inCart.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="w-8 text-center font-medium">{inCart.quantity}</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, inCart.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => void addToCart(product)}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-6 flex justify-end">
                        <Button onClick={() => setStep(2)} disabled={cartItems.length === 0} className="bg-amber-500 hover:bg-amber-600">Proximo: Cliente<ChevronRight className="ml-1 h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><User className="h-5 w-5" />Identificacao do cliente</h2>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2"><Label>Nome completo ou razao social *</Label><Input className="mt-1" value={customer.name} onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))} /></div>
                        <div><Label>CPF / CNPJ</Label><Input className="mt-1" value={customer.cpf} onChange={(e) => setCustomer((prev) => ({ ...prev, cpf: e.target.value }))} /></div>
                        <div><Label>Telefone *</Label><Input className="mt-1" value={customer.phone} onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><Label>E-mail</Label><Input className="mt-1" type="email" value={customer.email} onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))} /></div>
                      </div>
                      <Separator className="my-6" />
                      <div className="mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-amber-500" /><h3 className="font-display font-semibold">Endereco de entrega</h3></div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><Label>CEP *</Label><Input className="mt-1" value={cep} maxLength={9} onChange={(e) => handleCepChange(e.target.value)} /></div>
                        <div className="sm:col-span-2"><Label>Rua *</Label><Input className="mt-1" value={address.street} onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))} /></div>
                        <div><Label>Numero *</Label><Input className="mt-1" value={address.number} onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))} /></div>
                        <div><Label>Complemento</Label><Input className="mt-1" value={address.complement} onChange={(e) => setAddress((prev) => ({ ...prev, complement: e.target.value }))} /></div>
                        <div><Label>Bairro *</Label><Input className="mt-1" value={address.neighborhood} onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))} /></div>
                        <div><Label>Cidade *</Label><Input className="mt-1" value={address.city} onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))} /></div>
                        <div><Label>UF *</Label><Input className="mt-1" maxLength={2} value={address.state} onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))} /></div>
                      </div>
                      <Separator className="my-6" />
                      <Textarea rows={3} value={customer.notes} onChange={(e) => setCustomer((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Observacoes do atendimento, preferencias ou instrucoes de entrega..." />
                      <div className="mt-6 flex justify-between">
                        <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                        <Button onClick={() => void handleCustomerStepAdvance()} disabled={!customer.name || !customer.phone || !address.street || !address.number || !address.city || !address.state || !cep} className="bg-amber-500 hover:bg-amber-600">Proximo: Frete<ChevronRight className="ml-1 h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Truck className="h-5 w-5" />Frete e prazo</h2>
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium text-amber-800">Entrega obrigatoria: a compra assistida não permite retirada imediata.</p></div>
                      {shippingLoading && <p className="mt-4 text-sm text-muted-foreground">Calculando frete...</p>}
                      {shippingError && <p className="mt-4 text-sm text-destructive">{shippingError}</p>}
                      {shippingOptions.length > 0 && !shippingLoading && (
                        <div className="mt-4">
                          <RadioGroup value={selectedShipping?.id} onValueChange={(id) => { const option = shippingOptions.find((item) => item.id === id); if (option) setSelectedShipping(option); }}>
                            {shippingOptions.filter((item) => item.id !== "pickup").map((option) => (
                              <div key={option.id} className={`mb-2 cursor-pointer rounded-lg border p-4 ${selectedShipping?.id === option.id ? "border-amber-500 bg-amber-50" : "border-border"}`}>
                                <div className="flex items-center gap-3">
                                  <RadioGroupItem value={option.id} />
                                  <div className="flex-1"><p className="font-medium">{option.name}</p><p className="text-sm text-muted-foreground">{option.estimatedDays}</p></div>
                                  <span className="font-bold">{option.price === 0 ? "Gratis" : `R$ ${option.price.toFixed(2).replace(".", ",")}`}</span>
                                </div>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                      <div className="mt-6 flex justify-between">
                        <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                        <Button onClick={() => setStep(4)} disabled={!selectedShipping} className="bg-amber-500 hover:bg-amber-600">Proximo: Pagamento<ChevronRight className="ml-1 h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                  {step === 4 && (
                    <>
                      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><CreditCard className="h-5 w-5" />Pagamento e criacao do pedido</h2>
                      <div className="mt-6">
                        <Label className="mb-3 block font-semibold">Forma de pagamento</Label>
                        <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} className="space-y-3">
                          {ASSISTED_PAYMENT_OPTIONS.map((option) => (
                            <div key={option.value} className={`cursor-pointer rounded-lg border-2 p-4 ${paymentMethod === option.value ? "border-amber-500 bg-amber-50" : "border-border"}`}>
                              <div className="flex items-center gap-3"><RadioGroupItem value={option.value} /><span className="font-medium">{option.label}</span></div>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                      <Separator className="my-6" />
                      <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm md:grid-cols-2">
                        <p><strong>Classificacao:</strong> Pedido assistido</p>
                        <p><strong>Origem:</strong> Showroom</p>
                        <p><strong>Vendedor:</strong> {sellerContext?.seller_name || "-"}</p>
                        <p><strong>Loja:</strong> {sellerContext?.store_name || "-"}</p>
                      </div>
                      <div className="mt-6 flex justify-between">
                        <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
                        <div className="flex gap-2"><Button variant="outline" onClick={() => void handleCreateQuote()} disabled={isProcessing} size="lg">{isProcessing ? "Salvando..." : "Salvar Orçamento"}</Button><Button onClick={handleCreateOrder} disabled={isProcessing} className="bg-amber-500 hover:bg-amber-600" size="lg">{isProcessing ? "Criando pedido..." : "Criar Pedido Assistido"}</Button></div>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center gap-2"><Headset className="h-5 w-5 text-amber-600" /><h3 className="font-display font-bold text-amber-800">COMPRA ASSISTIDA</h3></div>
                  <div className="space-y-1.5 text-sm text-amber-900">
                    <p><strong>Tipo:</strong> Assistida</p>
                    <p><strong>Origem:</strong> Showroom</p>
                    <p><strong>Vendedor:</strong> {sellerContext?.seller_name || "-"}</p>
                    <p><strong>Loja:</strong> {sellerContext?.store_name || "-"}</p>
                    <p><strong>Entrega obrigatoria:</strong> Sim</p>
                    <p><strong>Retirada permitida:</strong> Não</p>
                    <p><strong>Pagamento vinculado:</strong> Sim</p>
                    <p><strong>Correlacao:</strong> {correlationId || "-"}</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-card">
                  <h3 className="mb-3 font-display font-semibold">Resumo do pedido</h3>
                  {cartItems.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum produto adicionado</p> : (
                    <div className="max-h-[300px] space-y-2 overflow-y-auto">
                      {cartItems.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between border-b pb-2 text-sm">
                          <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.product.name}</p><p className="text-xs text-muted-foreground">{item.quantity}x R$ {Number(item.product.price).toFixed(2).replace(".", ",")}</p></div>
                          <div className="flex shrink-0 items-center gap-2"><span className="font-semibold">R$ {(Number(item.product.price) * item.quantity).toFixed(2).replace(".", ",")}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, 0)}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator className="my-3" />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} itens)</span><span>R$ {subtotal.toFixed(2).replace(".", ",")}</span></div>
                    <div className="flex justify-between"><span>Frete</span><span>{shippingCost === 0 ? "A calcular" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-amber-600">R$ {total.toFixed(2).replace(".", ",")}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  );
}

function EntryCard({ title, description, icon, onClick, highlight = false, loading = false }: { title: string; description: string; icon: React.ReactNode; onClick: () => void; highlight?: boolean; loading?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={`rounded-3xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card disabled:cursor-wait disabled:opacity-70 ${highlight ? "border-amber-300 bg-amber-50" : "bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${highlight ? "bg-amber-100" : "bg-muted/50"}`}>{icon}</div>
        <div><p className="font-display text-lg font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
      </div>
      {loading && highlight ? <p className="mt-3 text-xs font-medium text-amber-800">Ativando modo assistido...</p> : null}
    </button>
  );
}

function ModeInfo({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-amber-700">{label}</p>
      <p className={`mt-2 text-sm font-semibold text-amber-950 ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

