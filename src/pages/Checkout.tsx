import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Check, CreditCard, Lock, MapPin, PackageCheck, Receipt, ShieldCheck, Store, TicketPercent, Truck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getCartLineLabel, getCartLineTotal, useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useAddressLookup } from "@/hooks/useAddressLookup";
import { useCompanyLookup } from "@/hooks/useCompanyLookup";
import { useCoupon } from "@/hooks/useCoupon";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import { useEventBus } from "@/hooks/useEventBus";
import { useShipping } from "@/hooks/useShipping";
import { apiFetch } from "@/lib/api";
import { getCustomerProfile, hydrateProfileFromOrder, updateCustomerProfile, type CustomerOrigin, type CustomerType } from "@/lib/customerCenter";
import type { LocalOrder } from "@/lib/localCommerce";
import { validateCheckout } from "@/lib/checkout-validation";
import { STORE_INFO, WHATSAPP_MESSAGES } from "@/constants/store";
import { toast } from "sonner";

type DeliveryType = "pickup" | "delivery";
type PaymentMethod = "pix" | "credit_card" | "boleto" | "cash";

const paymentOptions: Array<{
  id: PaymentMethod;
  label: string;
  description: string;
}> = [
  { id: "pix", label: "PIX", description: "Confirmação mais rapida para liberar o pedido." },
  { id: "credit_card", label: "Cartão", description: "Parcele e conclua com agilidade." },
  { id: "boleto", label: "Boleto", description: "Pagamento bancario com aprovação posterior." },
  { id: "cash", label: "Dinheiro na retirada", description: "Pague ao retirar na loja." },
];

const trustPills = [
  "Pedido protegido e dados tratados com segurança",
  "Atendimento nacional para obra, reforma e manutencao",
  "Retirada rapida, frete por CEP ou cotação assistida",
];

const checkoutSteps = [
  { key: "address", label: "Endereço", href: "/checkout/endereco" },
  { key: "shipping", label: "Entrega", href: "/checkout/entrega" },
  { key: "payment", label: "Pagamento", href: "/checkout/pagamento" },
  { key: "confirm", label: "Confirmação", href: "/checkout/confirmação" },
];

const checkoutStepGuidance = [
  {
    title: "Quem compra e como devemos atender",
    description: "Preencha apenas os dados essenciais para contato, faturamento e liberacao do pedido sem retrabalho.",
  },
  {
    title: "Como o pedido vai sair da loja",
    description: "Escolha retirada ou entrega e valide a opção mais segura para prazo, custo, volume e rotina da obra.",
  },
  {
    title: "Como o pedido será liberado",
    description: "Selecione a forma de pagamento e veja como a aprovação impacta a separacao e a expedicao.",
  },
  {
    title: "Ultima revisão antes do fechamento",
    description: "Confira observacoes, aceite as políticas e conclua com clareza sobre o que acontece depois da compra.",
  },
];

const nextStepCards = [
  {
    key: "separation",
    title: "Separacao e conferencia",
    description: "A equipe valida o pedido, separa o material e prepara a próxima etapa sem improviso.",
    icon: PackageCheck,
  },
  {
    key: "payment",
    title: "Pagamento e liberacao",
    description: "Assim que o pagamento confirma, o pedido fica pronto para retirada, expedicao ou acompanhamento.",
    icon: ShieldCheck,
  },
  {
    key: "tracking",
    title: "Rastreio e suporte",
    description: "Você acompanha o andamento e pode acionar o time comercial se precisar ajustar a obra.",
    icon: CalendarClock,
  },
];

function getAfterSalesGuidance(deliveryType: DeliveryType, paymentMethod: PaymentMethod) {
  const paymentLabel =
    paymentMethod === "pix"
      ? "A aprovação costuma ser mais rapida e libera a operação sem espera desnecessaria."
      : paymentMethod === "boleto"
        ? "A liberacao depende da compensacao bancaria antes da separacao final."
        : paymentMethod === "cash"
          ? "O time confirma a separacao e orienta o pagamento no momento da retirada."
          : "Assim que a operação financeira confirmar o pagamento, o pedido segue para a próxima etapa.";

  const deliveryLabel =
    deliveryType === "pickup"
      ? "Depois da compra, a loja confirma a separacao e avisa quando o material estiver pronto para retirada."
      : "Depois da compra, você acompanha expedicao e entrega com rastreio e apoio do atendimento da loja.";

  return {
    deliveryLabel,
    paymentLabel,
    supportLabel: "Se precisar ajustar prazo, recebimento ou pos-venda, o atendimento nacional segue acessivel por WhatsApp.",
  };
}

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, totalItems, totalPrice, clearCart, getCartItemsForTracking } = useCart();
  const { user } = useAuth();
  const { createOrder, loading } = useCreateOrder();
  const { coupon, calculateDiscount, validateCoupon, removeCoupon } = useCoupon();
  const { trackCheckoutStart, emitEvent } = useEventBus();
  const { lookupCep, loading: addressLookupLoading, error: addressLookupError } = useAddressLookup();
  const { lookupCnpj, loading: companyLookupLoading, error: companyLookupError } = useCompanyLookup();
  const {
    options,
    selectedOption,
    setSelectedOption,
    calculateShipping,
    formatCep,
    loading: shippingLoading,
    error: shippingError,
    message: shippingMessage,
    underAnalysis: shippingUnderAnalysis,
    nationalCoverage,
  } = useShipping();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [couponCode, setCouponCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
  });
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "Garanhuns",
    state: "PE",
    zipCode: "",
  });
  const [notes, setNotes] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("retail");
  const [customerOrigin, setCustomerOrigin] = useState<CustomerOrigin>("web");
  const [companyName, setCompanyName] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [allowPromotions, setAllowPromotions] = useState(false);
  const [preferredChannel, setPreferredChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [acceptPolicies, setAcceptPolicies] = useState(false);

  const discount = useMemo(() => calculateDiscount(totalPrice), [calculateDiscount, totalPrice]);
  const shippingCost = deliveryType === "pickup" ? 0 : selectedOption?.price ?? 0;
  const total = totalPrice + shippingCost - discount;
  const currentStepIndex = useMemo(() => {
    const matched = checkoutSteps.findIndex((step) => location.pathname === step.href);
    return matched >= 0 ? matched : 0;
  }, [location.pathname]);
  const showAddressStep = currentStepIndex === 0;
  const showShippingStep = currentStepIndex === 1;
  const showPaymentStep = currentStepIndex === 2;
  const showConfirmStep = currentStepIndex === 3;
  const currentStepGuidance = checkoutStepGuidance[currentStepIndex] || checkoutStepGuidance[0];
  const nextStepHref = checkoutSteps[Math.min(currentStepIndex + 1, checkoutSteps.length - 1)]?.href;
  const prevStepHref = currentStepIndex > 0 ? checkoutSteps[currentStepIndex - 1]?.href : "/carrinho";
  const afterSalesGuidance = getAfterSalesGuidance(deliveryType, paymentMethod);
  const deliveryShippingOptions = useMemo(() => options.filter((option) => option.deliveryType === "delivery"), [options]);

  useEffect(() => {
    if (items.length === 0) {
      navigate("/carrinho");
    }
  }, [items.length, navigate]);

  useEffect(() => {
    const profile = getCustomerProfile(user);
    setCustomer((prev) => ({
      ...prev,
      name: prev.name || profile.fullName || user?.user_metadata?.full_name || "",
      email: prev.email || profile.email || user?.email || "",
      phone: prev.phone || profile.phone || "",
      cpf: prev.cpf || profile.cpfCnpj || "",
    }));
    setCustomerType(profile.customerType);
    setCustomerOrigin(profile.customerOrigin);
    setCompanyName(profile.companyName || "");
    setStateRegistration(profile.stateRegistration || "");
    setPreferredChannel(profile.preferredChannel);
    setAllowPromotions(profile.allowPromotions);
    const defaultAddress = profile.addresses.find((entry) => entry.isDefault) || profile.addresses[0];
    if (defaultAddress) {
      setAddress((prev) => ({
        ...prev,
        street: prev.street || defaultAddress.street,
        number: prev.number || defaultAddress.number,
        complement: prev.complement || defaultAddress.complement || "",
        neighborhood: prev.neighborhood || defaultAddress.neighborhood,
        city: prev.city || defaultAddress.city,
        state: prev.state || defaultAddress.state,
        zipCode: prev.zipCode || defaultAddress.zipCode,
      }));
    }
  }, [user]);

  useEffect(() => {
    trackCheckoutStart(getCartItemsForTracking(), totalPrice, deliveryType, total);
  }, [deliveryType, getCartItemsForTracking, total, totalPrice, trackCheckoutStart]);

  useEffect(() => {
    if (deliveryType === "delivery" && address.zipCode.replace(/\D/g, "").length === 8) {
      void lookupCep(address.zipCode).then((result) => {
        if (!result) return;
        setAddress((prev) => ({
          ...prev,
          street: result.street || prev.street,
          complement: prev.complement || result.complement || "",
          neighborhood: result.neighborhood || prev.neighborhood,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
      });
      void calculateShipping(address.zipCode, totalPrice, items.map((item) => ({ productId: item.product.id, quantity: item.quantity })));
    }
  }, [address.zipCode, calculateShipping, deliveryType, items, lookupCep, totalPrice]);

  useEffect(() => {
    if (deliveryType === "pickup") {
      setSelectedOption(null);
      setPaymentMethod((current) => (current === "cash" ? current : "pix"));
      return;
    }

    setPaymentMethod((current) => (current === "cash" ? "pix" : current));
  }, [deliveryType, setSelectedOption]);

  useEffect(() => {
    if (deliveryType === "delivery" && selectedOption && !deliveryShippingOptions.some((option) => option.id === selectedOption.id)) {
      setSelectedOption(null);
    }
  }, [deliveryShippingOptions, deliveryType, selectedOption, setSelectedOption]);

  useEffect(() => {
    if (customerType !== "business") return;
    const cnpj = customer.cpf.replace(/\D/g, "");
    if (cnpj.length !== 14) return;

    void lookupCnpj(cnpj).then((result) => {
      if (!result) return;
      setCompanyName((current) => current || result.legalName || result.tradeName);
      setCustomer((prev) => ({
        ...prev,
        name: prev.name || result.tradeName || result.legalName,
        email: prev.email || result.email,
        phone: prev.phone || result.phone,
      }));
      setAddress((prev) => ({
        ...prev,
        street: prev.street || result.address.street,
        number: prev.number || result.address.number,
        complement: prev.complement || result.address.complement,
        neighborhood: prev.neighborhood || result.address.neighborhood,
        city: prev.city || result.address.city,
        state: prev.state || result.address.state,
        zipCode: prev.zipCode || formatCep(result.address.zipCode),
      }));
    });
  }, [customer.cpf, customerType, formatCep, lookupCnpj]);

  const handleCustomerChange = (field: keyof typeof customer, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleAddressChange = (field: keyof typeof address, value: string) => {
    const nextValue = field === "zipCode" ? formatCep(value) : value;
    setAddress((prev) => ({ ...prev, [field]: nextValue }));
    setErrors((prev) => ({ ...prev, [`address.${field}`]: "" }));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Digite um código de cupom");
      return;
    }

    const result = await validateCoupon(couponCode.trim().toUpperCase(), totalPrice);
    if (result) {
      toast.success("Cupom aplicado com sucesso");
      setCouponCode("");
      return;
    }

    toast.error("Não foi possível validar esse cupom");
  };

  const submitOrder = async () => {
    if (!acceptPolicies) {
      toast.error("Confirme a política de privacidade para continuar");
      return;
    }

    const validation = validateCheckout({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf: customer.cpf,
      deliveryType,
      paymentMethod,
      address: deliveryType === "delivery" ? address : undefined,
      notes,
    });

    if (validation.success === false) {
      setErrors(validation.errors);
      toast.error("Revise os dados do checkout");
      return;
    }

    const validatedData = validation.data;
    const shippingAddress = validatedData.deliveryType === "delivery" ? address : undefined;

    if (validatedData.deliveryType === "delivery" && !selectedOption) {
      toast.error(nationalCoverage?.requested && shippingUnderAnalysis ? "Frete nacional ainda não liberado para este CEP" : "Selecione uma opção de entrega");
      return;
    }

    const { order, error } = await createOrder({
      customerName: validatedData.customer.name,
      customerEmail: validatedData.customer.email,
      customerPhone: validatedData.customer.phone,
      customerCpf: validatedData.customer.cpf,
      deliveryType: validatedData.deliveryType,
      paymentMethod: validatedData.paymentMethod,
      shippingAddress,
      shippingCost,
      couponCode: coupon?.code,
      notes: validatedData.notes,
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        quantityInformedClient: item.quantityInformedClient,
        quantityCalculatedSystem: item.quantityCalculatedSystem,
        commercialRuleApplied: item.commercialRuleApplied,
        requestedMeasurement: item.requestedMeasurement,
        areaDesiredM2: item.areaDesiredM2,
        totalAreaM2: item.totalAreaM2,
        weightDesiredKg: item.weightDesiredKg,
        totalWeightKg: item.totalWeightKg,
        volumeDesiredLiters: item.volumeDesiredLiters,
        totalVolumeLiters: item.totalVolumeLiters,
        cubicMetersDesired: item.cubicMetersDesired,
        totalCubicMeters: item.totalCubicMeters,
        calculatedBoxes: item.calculatedBoxes,
        calculatedPieces: item.calculatedPieces,
        calculatedPackages: item.calculatedPackages,
        lossMarginApplied: item.lossMarginApplied,
        packagingClosed: item.packagingClosed,
        openPackageAllowed: item.openPackageAllowed,
        calculationOrigin: item.calculationOrigin,
        notes: item.notes,
      })),
    });

    if (error || !order) {
      toast.error(error || "Não foi possível concluir o pedido");
      return;
    }

    const createdOrder = order as LocalOrder & { id: string; tracking_token?: string };
    let paymentRedirectUrl: string | null = null;
    try {
      const paymentResponse = await apiFetch<{ paymentIntent?: { checkoutUrl?: string } }>(`/api/orders/${createdOrder.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ action: "initiate", paymentMethod, trackingToken: createdOrder.tracking_token }),
      });
      paymentRedirectUrl = paymentResponse.paymentIntent?.checkoutUrl || null;
    } catch (paymentError) {
      toast.error(paymentError instanceof Error ? paymentError.message : "Não foi possível iniciar o pagamento");
    }

    updateCustomerProfile(
      {
        fullName: validatedData.customer.name,
        email: validatedData.customer.email,
        phone: validatedData.customer.phone,
        cpfCnpj: validatedData.customer.cpf,
        customerType,
        customerOrigin,
        companyName: companyName || undefined,
        stateRegistration: stateRegistration || undefined,
        preferredChannel,
        allowPromotions,
      },
      user,
      validatedData.customer.email,
    );
    hydrateProfileFromOrder(createdOrder, user);

    emitEvent("order.created", {
      order_id: createdOrder.id || "",
      order_number: createdOrder.order_number,
      items: items.map((item) => ({
        sku: item.product.sku || item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: Number(item.product.price),
        total_price: getCartLineTotal(item),
        tipo_venda: item.product.sale_type,
        unidade_medida: item.product.unit_measure,
        quantidade_informada: item.quantityInformedClient ?? item.quantity,
        quantidade_calculada: item.quantityCalculatedSystem ?? item.quantity,
      })),
      customer: {
        name: validatedData.customer.name,
        email: validatedData.customer.email,
        phone: validatedData.customer.phone,
      },
      subtotal: totalPrice,
      shipping_cost: shippingCost,
      discount,
      total,
      payment_method: paymentMethod,
      delivery_type: deliveryType,
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
    });
    emitEvent("customer.origin_detected", {
      origin: customerOrigin,
      channel: preferredChannel,
      customer_type: customerType,
    });

    toast.success("Pedido realizado com sucesso");
    clearCart();
    if (paymentRedirectUrl) {
      window.location.href = paymentRedirectUrl;
      return;
    }
    navigate("/pedido-confirmado", { state: { order: createdOrder, userWasGuest: !user } });
  };

  const availablePayments = paymentOptions.filter((option) => deliveryType === "pickup" || option.id !== "cash");
  const validateCurrentStep = () => {
    const validation = validateCheckout({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpf: customer.cpf,
      deliveryType,
      paymentMethod,
      address: deliveryType === "delivery" ? address : undefined,
      notes,
    });

    if (showAddressStep && validation.success === false) {
      const nextErrors = Object.fromEntries(Object.entries(validation.errors).filter(([field]) => field.startsWith("customer.")));
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast.error("Revise nome, e-mail, telefone e CPF/CNPJ antes de continuar");
        return false;
      }
    }

    if (showShippingStep) {
      if (deliveryType === "delivery" && validation.success === false) {
        const nextErrors = Object.fromEntries(Object.entries(validation.errors).filter(([field]) => field.startsWith("address.")));
        if (Object.keys(nextErrors).length > 0) {
          setErrors(nextErrors);
          toast.error("Revise o endereço de entrega antes de continuar");
          return false;
        }
      }

      if (deliveryType === "delivery" && !selectedOption) {
        toast.error(nationalCoverage?.requested && shippingUnderAnalysis ? "Frete nacional ainda precisa de cotação assistida" : "Selecione uma opção de entrega");
        return false;
      }
    }

    if (showPaymentStep && !availablePayments.some((option) => option.id === paymentMethod)) {
      setPaymentMethod("pix");
      toast.error("Escolha uma forma de pagamento valida para este tipo de entrega");
      return false;
    }

    setErrors({});
    return true;
  };

  const goToNextStep = () => {
    if (!validateCurrentStep()) return;
    navigate(nextStepHref);
  };

  return (
    <Layout>
      <div className="container py-6 pb-28 xl:pb-6">
        <div className="rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Checkout guiado</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-secondary md:text-4xl">Feche seu pedido com clareza, segurança e ritmo de obra.</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                Organize entrega, pagamento, dados fiscais e observacoes em uma unica etapa, com resumo completo do pedido e suporte comercial ao lado.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {trustPills.map((pill) => (
                <div key={pill} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm leading-6 text-muted-foreground">
                  {pill}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/80 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            {checkoutSteps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => navigate(step.href)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive ? "bg-primary text-primary-foreground" : isCompleted ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Etapa {index + 1}</p>
                      <p className="font-semibold text-foreground">{step.label}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-dashed bg-muted/35 p-4">
          <p className="eyebrow">Foco destá etapa</p>
          <p className="mt-2 font-semibold text-foreground">{currentStepGuidance.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{currentStepGuidance.description}</p>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await submitOrder();
            }}
            className="space-y-6"
          >
            <section className={`rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5 ${showAddressStep ? "block" : "hidden"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Dados do cliente</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Quem vai receber ou retirar</h2>
                </div>
                <BadgeCheck className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-lg border border-dashed bg-muted/35 p-4 text-sm">
                  <p className="font-semibold text-foreground">{user ? "Conta reconhecida" : "Compra como visitante liberada"}</p>
                  <p className="mt-1 text-muted-foreground">
                    {user
                      ? "Seus dados estao sendo preenchidos de forma progressiva para acelerar o checkout e futuras recompras."
                      : "Você pode concluir sem criar conta. Depois da compra, o site convida você a ativar sua conta com menos friccao."}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={customer.name} onChange={(e) => handleCustomerChange("name", e.target.value)} className="mt-1.5 h-11" placeholder="Nome de quem responde pelo pedido" />
                  {errors["customer.name"] || errors.name ? <p className="mt-1 text-xs text-destructive">{errors["customer.name"] || errors.name}</p> : null}
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={customer.email} onChange={(e) => handleCustomerChange("email", e.target.value)} className="mt-1.5 h-11" placeholder="seu@email.com" />
                  {errors["customer.email"] || errors.email ? <p className="mt-1 text-xs text-destructive">{errors["customer.email"] || errors.email}</p> : null}
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={customer.phone} onChange={(e) => handleCustomerChange("phone", e.target.value)} className="mt-1.5 h-11" placeholder="(87) 99999-0000" />
                  {errors["customer.phone"] || errors.phone ? <p className="mt-1 text-xs text-destructive">{errors["customer.phone"] || errors.phone}</p> : null}
                </div>
                <div>
                  <Label htmlFor="cpf">{customerType === "business" ? "CNPJ" : "CPF"}</Label>
                  <Input id="cpf" value={customer.cpf} onChange={(e) => handleCustomerChange("cpf", e.target.value)} className="mt-1.5 h-11" placeholder={customerType === "business" ? "00.000.000/0000-00" : "000.000.000-00"} />
                  {errors["customer.cpf"] || errors.cpf ? <p className="mt-1 text-xs text-destructive">{errors["customer.cpf"] || errors.cpf}</p> : null}
                  {customerType === "business" && companyLookupLoading ? <p className="mt-1 text-xs text-muted-foreground">Consultando dados do CNPJ...</p> : null}
                  {customerType === "business" && companyLookupError ? <p className="mt-1 text-xs text-amber-700">{companyLookupError}</p> : null}
                </div>
                <div>
                  <Label htmlFor="companyName">Empresa / razao social</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5 h-11" placeholder="Opcional para compra profissional ou PJ" />
                </div>
                <div>
                  <Label htmlFor="stateRegistration">Inscricao estadual</Label>
                  <Input id="stateRegistration" value={stateRegistration} onChange={(e) => setStateRegistration(e.target.value)} className="mt-1.5 h-11" placeholder="Opcional" />
                </div>
                <div className="md:col-span-2 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg bg-muted/45 p-4">
                    <p className="text-sm font-medium">Tipo de cliente</p>
                    <RadioGroup value={customerType} onValueChange={(value) => setCustomerType(value as CustomerType)} className="mt-3 space-y-2">
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="retail" />Consumidor final</Label>
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="pro" />Profissional</Label>
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="business" />Empresa</Label>
                    </RadioGroup>
                  </div>
                  <div className="rounded-lg bg-muted/45 p-4">
                    <p className="text-sm font-medium">Origem do relacionamento</p>
                    <RadioGroup value={customerOrigin} onValueChange={(value) => setCustomerOrigin(value as CustomerOrigin)} className="mt-3 space-y-2">
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="web" />Site</Label>
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="whatsapp" />WhatsApp</Label>
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="showroom" />Showroom</Label>
                    </RadioGroup>
                  </div>
                  <div className="rounded-lg bg-muted/45 p-4">
                    <p className="text-sm font-medium">Canal preferido</p>
                    <RadioGroup value={preferredChannel} onValueChange={(value) => setPreferredChannel(value as "whatsapp" | "email")} className="mt-3 space-y-2">
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="whatsapp" />WhatsApp</Label>
                      <Label className="flex items-center gap-2 text-sm"><RadioGroupItem value="email" />E-mail</Label>
                    </RadioGroup>
                    <Label className="mt-4 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={allowPromotions} onChange={(e) => setAllowPromotions(e.target.checked)} />
                      Aceito receber promocoes
                    </Label>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  Seus dados ajudam a emitir o pedido, agilizar o atendimento e facilitar futuras recompras.
                </div>
              </div>
            </section>

            <section className={`rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5 ${showShippingStep ? "block" : "hidden"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Entrega ou retirada</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Defina a logistica do pedido</h2>
                </div>
                <Truck className="h-5 w-5 text-primary" />
              </div>

              <RadioGroup value={deliveryType} onValueChange={(value) => setDeliveryType(value as DeliveryType)} className="mt-5 grid gap-3 lg:grid-cols-2">
                <Label htmlFor="pickup-option" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40">
                  <RadioGroupItem value="pickup" id="pickup-option" className="mt-1" />
                  <Store className="mt-0.5 h-5 w-5 text-success" />
                  <div className="flex-1">
                    <p className="font-semibold">Retirar na loja</p>
                    <p className="mt-1 text-sm text-muted-foreground">Ideal para ganhar velocidade. Separacao estimada em ate 2 horas.</p>
                  </div>
                  <span className="text-sm font-semibold text-success">Gratis</span>
                </Label>
                <Label htmlFor="delivery-option" className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40">
                  <RadioGroupItem value="delivery" id="delivery-option" className="mt-1" />
                  <Truck className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">Receber no endereco</p>
                    <p className="mt-1 text-sm text-muted-foreground">Calcule opcoes de entrega a partir do CEP da obra, empresa ou residencia.</p>
                  </div>
                </Label>
              </RadioGroup>

              {deliveryType === "delivery" ? (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <div className="flex items-start gap-3">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Operação nacional por CEP</p>
                      <p className="mt-1 leading-6 text-muted-foreground">
                        CEP local pode retornar rota direta. CEP nacional depende de transportadora homologada ou cotação assistida para itens pesados, volumosos ou fora das faixas configuradas.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {deliveryType === "delivery" && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input id="zipCode" value={address.zipCode} onChange={(e) => handleAddressChange("zipCode", e.target.value)} className="h-11" placeholder="55295-000" />
                      <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => calculateShipping(address.zipCode, totalPrice, items.map((item) => ({ productId: item.product.id, quantity: item.quantity })))} disabled={shippingLoading}>
                        {shippingLoading ? "Calculando..." : "Calcular"}
                      </Button>
                    </div>
                    {errors["address.zipCode"] ? <p className="mt-1 text-xs text-destructive">{errors["address.zipCode"]}</p> : null}
                    {addressLookupLoading ? <p className="mt-1 text-xs text-muted-foreground">Localizando endereco pelo CEP...</p> : null}
                    {addressLookupError ? <p className="mt-1 text-xs text-amber-700">{addressLookupError}</p> : null}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="street">Rua</Label>
                    <Input id="street" value={address.street} onChange={(e) => handleAddressChange("street", e.target.value)} className="mt-1.5 h-11" placeholder="Rua, avenida ou travessa" />
                    {errors["address.street"] ? <p className="mt-1 text-xs text-destructive">{errors["address.street"]}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="number">Numero</Label>
                    <Input id="number" value={address.number} onChange={(e) => handleAddressChange("number", e.target.value)} className="mt-1.5 h-11" placeholder="123" />
                    {errors["address.number"] ? <p className="mt-1 text-xs text-destructive">{errors["address.number"]}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input id="complement" value={address.complement} onChange={(e) => handleAddressChange("complement", e.target.value)} className="mt-1.5 h-11" placeholder="Apto, bloco, referencia" />
                  </div>

                  <div>
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input id="neighborhood" value={address.neighborhood} onChange={(e) => handleAddressChange("neighborhood", e.target.value)} className="mt-1.5 h-11" placeholder="Seu bairro" />
                    {errors["address.neighborhood"] ? <p className="mt-1 text-xs text-destructive">{errors["address.neighborhood"]}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" value={address.city} onChange={(e) => handleAddressChange("city", e.target.value)} className="mt-1.5 h-11" placeholder="Cidade" />
                    {errors["address.city"] ? <p className="mt-1 text-xs text-destructive">{errors["address.city"]}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="state">UF</Label>
                    <Input id="state" value={address.state} onChange={(e) => handleAddressChange("state", e.target.value)} className="mt-1.5 h-11" placeholder="PE" maxLength={2} />
                    {errors["address.state"] ? <p className="mt-1 text-xs text-destructive">{errors["address.state"]}</p> : null}
                  </div>

                  {shippingError && <p className="text-sm text-destructive">{shippingError}</p>}
                  {shippingMessage && <p className="text-sm text-muted-foreground">{shippingMessage}</p>}
                  {nationalCoverage?.requested && shippingUnderAnalysis ? (
                    <div className="md:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-semibold">Entrega nacional aguardando provider homologado</p>
                      <p className="mt-1">
                        Este CEP está fora das faixas locais ou exige regra de transportadora. O pedido pode seguir por atendimento comercial, mas a venda nacional automatica depende de Melhor Envio ou outro provider com token, CEP de origem e ambiente homologado.
                      </p>
                      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                        <span className="rounded-md bg-white/70 px-2 py-1">Validar cubagem</span>
                        <span className="rounded-md bg-white/70 px-2 py-1">Confirmar transportadora</span>
                        <span className="rounded-md bg-white/70 px-2 py-1">Gerar prazo assistido</span>
                      </div>
                      {nationalCoverage.missing.length > 0 ? <p className="mt-2 text-xs">Pendências: {nationalCoverage.missing.join(", ")}</p> : null}
                    </div>
                  ) : null}
                  {deliveryShippingOptions.length > 0 && (
                    <div className="md:col-span-2">
                      <Label>Opcoes de frete</Label>
                      <RadioGroup
                        value={selectedOption?.id}
                        onValueChange={(value) => setSelectedOption(deliveryShippingOptions.find((option) => option.id === value) ?? null)}
                        className="mt-2 space-y-2"
                      >
                        {deliveryShippingOptions.map((option) => (
                          <Label key={option.id} htmlFor={`shipping-${option.id}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40">
                            <RadioGroupItem value={option.id} id={`shipping-${option.id}`} className="mt-1" />
                            <div className="flex-1">
                              <p className="font-semibold">{option.name}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {option.isCheapest ? <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">mais barato</span> : null}
                                {option.isFastest ? <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">mais rapido</span> : null}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{option.price === 0 ? "Gratis" : `R$ ${option.price.toFixed(2).replace(".", ",")}`}</p>
                              <p className="text-xs text-muted-foreground">{option.estimatedDays}</p>
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className={`rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5 ${showPaymentStep ? "block" : "hidden"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Pagamento</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Escolha como quer concluir</h2>
                </div>
                <CreditCard className="h-5 w-5 text-primary" />
              </div>

              <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} className="mt-5 grid gap-3 md:grid-cols-2">
                {availablePayments.map((option) => (
                  <Label key={option.id} htmlFor={`payment-${option.id}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40">
                    <RadioGroupItem value={option.id} id={`payment-${option.id}`} className="mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold">{option.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </section>

            <section className={`rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5 ${showConfirmStep ? "block" : "hidden"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Observações</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Informações importantes para a equipe</h2>
                </div>
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <Textarea
                className="mt-5 min-h-[140px] rounded-lg"
                placeholder="Ex.: material para a obra da Rua X, entregar no período da manhã, precisa de emissão para CNPJ da construtora..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {errors.notes ? <p className="mt-1 text-xs text-destructive">{errors.notes}</p> : null}
              <div className="mt-5 rounded-lg border bg-muted/35 p-4">
                <Label className="flex items-start gap-3 text-sm leading-6">
                  <input type="checkbox" className="mt-1" checked={acceptPolicies} onChange={(e) => setAcceptPolicies(e.target.checked)} />
                  <span>Li e aceito a política de privacidade, uso de dados para emissão do pedido e contato operacional.</span>
                </Label>
              </div>
            </section>
          </form>

          <aside className="space-y-4">
            <div className="sticky top-24 rounded-lg border border-border/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Resumo final</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Seu pedido</h2>
                </div>
                <PackageCheck className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-5 space-y-3">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-start gap-3 rounded-lg bg-muted/25 p-3">
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                      <img src={item.product.image_url || item.product.images?.[0] || "/placeholder.svg"} alt={item.product.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold">{item.product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{getCartLineLabel(item)}</p>
                    </div>
                    <p className="text-sm font-semibold">R$ {getCartLineTotal(item).toFixed(2).replace(".", ",")}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-dashed bg-white p-4">
                {coupon ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success">Cupom ativo</p>
                      <p className="mt-1 font-semibold text-success">{coupon.code}</p>
                    </div>
                    <button type="button" onClick={removeCoupon} className="text-sm font-medium text-primary hover:underline">
                      remover
                    </button>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="coupon">Cupom</Label>
                    <div className="mt-2 flex gap-2">
                      <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" className="h-10" />
                      <Button type="button" variant="outline" className="h-10 shrink-0" onClick={handleApplyCoupon}>
                        Aplicar
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>{shippingCost === 0 ? "Gratis" : `R$ ${shippingCost.toFixed(2).replace(".", ",")}`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Desconto</span>
                    <span>-R$ {discount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-display text-3xl font-bold">R$ {total.toFixed(2).replace(".", ",")}</p>
                </div>
                <p className="text-right text-[11px] text-muted-foreground">
                  {totalItems} {totalItems === 1 ? "item" : "itens"}
                </p>
              </div>

              <div className="mt-5 grid gap-2">
                {showConfirmStep ? (
                <Button type="button" size="lg" className="w-full rounded-lg" disabled={loading} onClick={submitOrder}>
                    {loading ? "Finalizando pedido..." : "Concluir pedido"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" size="lg" className="w-full rounded-lg" onClick={goToNextStep}>
                    Avancar etapa
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" className="w-full rounded-lg">
                  <Link to={prevStepHref}>
                    <ArrowLeft className="h-4 w-4" />
                    {currentStepIndex > 0 ? "Voltar etapa" : "Voltar ao carrinho"}
                  </Link>
                </Button>
              </div>

              <div className="mt-4 rounded-lg border border-dashed bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  O que acontece depois da compra
                </div>
                <div className="mt-3 space-y-3">
                  {nextStepCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.key} className="flex items-start gap-3 rounded-lg bg-background/70 p-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{card.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {deliveryType === "pickup"
                    ? "Retirada escolhida: a loja confirma a separacao e libera o pedido assim que o pagamento entrar."
                    : "Entrega escolhida: o pedido segue para expedicao com rastreio e previsão conforme a opção de frete selecionada."}
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-muted/45 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Lock className="h-4 w-4 text-primary" />
                  Checkout protegido
                </div>
                <p className="mt-2 leading-6">
                  Seus dados seguem para a emissão do pedido e acompanhamento do atendimento, sem etapas confusas.
                </p>
              </div>
              <div className="mt-5 rounded-lg border border-dashed bg-muted/25 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  Pos-venda e acompanhamento
                </div>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>{afterSalesGuidance.deliveryLabel}</p>
                  <p>{afterSalesGuidance.paymentLabel}</p>
                  <p>{afterSalesGuidance.supportLabel}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-white px-4 py-4 shadow-sm">
              <p className="eyebrow">Apoio comercial</p>
              <h3 className="mt-2 font-display text-2xl font-bold">Precisa ajustar quantidade, prazo ou logistica?</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Fale com a equipe da loja antes de concluir e feche o pedido com a configuração certa para sua obra.
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{STORE_INFO.address.street}, {STORE_INFO.address.number} - {STORE_INFO.address.neighborhood}</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span>{STORE_INFO.hours.weekdays}</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <TicketPercent className="h-4 w-4 text-primary" />
                  <span>Condições especiais para compra recorrente e orçamento.</span>
                </div>
              </div>
              <WhatsAppButton
                origin="checkout"
                label="Falar com atendimento"
                message={WHATSAPP_MESSAGES.quote}
                className="mt-5 w-full rounded-lg"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border/80 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div>
                  <p className="font-semibold">Pedido acompanhado</p>
                  <p className="text-sm text-muted-foreground">Você poderá rastrear status, pagar e recomprar com base no histórico.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Recompra a partir do histórico
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Token de rastreio para pedidos como visitante
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Painel da conta para revisar últimas compras
                </div>
              </div>
            </motion.div>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/96 px-4 py-3 shadow-[0_-14px_34px_rgba(15,23,42,0.14)] backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-screen-sm items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Etapa {currentStepIndex + 1} de {checkoutSteps.length}</p>
              <p className="truncate text-sm font-semibold">{checkoutSteps[currentStepIndex]?.label}</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(total)}</p>
            </div>
            <Button asChild variant="outline" className="h-11 shrink-0 px-4">
              <Link to={prevStepHref}>{currentStepIndex > 0 ? "Voltar" : "Carrinho"}</Link>
            </Button>
            {showConfirmStep ? (
              <Button type="button" className="h-11 shrink-0 px-4" disabled={loading} onClick={submitOrder}>
                {loading ? "Finalizando..." : "Concluir"}
              </Button>
            ) : (
              <Button type="button" className="h-11 shrink-0 px-4" onClick={goToNextStep}>
                Continuar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
