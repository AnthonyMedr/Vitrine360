import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Truck, CheckCircle, Clock, XCircle, MapPin, Phone, MessageCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { LocalOrder, LocalOrderItem } from "@/lib/localCommerce";
import { getWhatsAppUrl, STORE_INFO, WHATSAPP_MESSAGES } from "@/constants/store";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500" },
  awaiting_payment: { label: "Aguardando pagamento", icon: Clock, color: "bg-orange-500" },
  payment_approved: { label: "Pagamento aprovado", icon: CheckCircle, color: "bg-emerald-500" },
  confirmed: { label: "Confirmado", icon: CheckCircle, color: "bg-blue-500" },
  processing: { label: "Em preparacao", icon: Package, color: "bg-orange-500" },
  in_separation: { label: "Em separacao", icon: Package, color: "bg-amber-500" },
  in_expedition: { label: "Em expedicao", icon: Truck, color: "bg-cyan-500" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-500" },
  out_for_delivery: { label: "Saiu para entrega", icon: Truck, color: "bg-teal-500" },
  delivered: { label: "Entregue", icon: CheckCircle, color: "bg-green-500" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-500" },
};

const paymentMethodLabels: Record<string, string> = {
  credit_card: "Cartão de credito",
  boleto: "Boleto bancario",
  pix: "PIX",
  cash: "Dinheiro",
  payment_link: "Link de pagamento",
  store_pos: "Pagamento na loja",
};

function getNextStepMessage(order: LocalOrder) {
  switch (order.status) {
    case "pending":
      return {
        title: "Pedido recebido",
        text: "Seu pedido foi registrado e aguarda a próxima confirmação operacional ou financeira.",
      };
    case "awaiting_payment":
      return {
        title: "Aguardando pagamento",
        text: "Assim que o pagamento for aprovado, a equipe libera o pedido para preparo e separacao.",
      };
    case "payment_approved":
      return {
        title: "Pagamento aprovado",
        text: "O pagamento ja foi confirmado e a equipe vai liberar o pedido para separacao, retirada ou expedicao.",
      };
    case "confirmed":
      return {
        title: "Pedido confirmado",
        text: "O time interno validou o pedido e vai encaminhar a separacao, retirada ou expedicao.",
      };
    case "processing":
      return {
        title: "Em preparacao",
        text: "Seu pedido está em tratamento operacional para seguir para separacao ou programacao de entrega.",
      };
    case "in_separation":
      return {
        title: order.delivery_type === "pickup" ? "Separando para retirada" : "Separando seu pedido",
        text: order.delivery_type === "pickup"
          ? "Seu pedido está sendo separado. Assim que ficar pronto, a loja vai avisar para retirada."
          : "Seu pedido está em separacao para seguir para expedicao ou programacao de entrega.",
      };
    case "in_expedition":
    case "shipped":
      return {
        title: "Em expedicao",
        text: order.delivery_type === "pickup"
          ? "Seu pedido ja saiu da etapa interna final e está sendo preparado para disponibilidade na loja."
          : "A expedicao ja foi iniciada. O próximo passo e a roteirizacao final ou a saida para entrega.",
      };
    case "out_for_delivery":
      return {
        title: "Saiu para entrega",
        text: "Seu pedido ja está em rota. Se houver qualquer mudanca de recebimento, fale com a loja pelo WhatsApp.",
      };
    case "delivered":
      return {
        title: "Pedido entregue",
        text: "O ciclo principal foi concluido. Se precisar, você ainda pode acionar suporte ou devolucao assistida.",
      };
    case "cancelled":
      return {
        title: "Pedido cancelado",
        text: "O pedido foi encerrado. Em caso de dúvida sobre pagamento ou reembolso, acione o atendimento.",
      };
    default:
      return {
        title: "Pedido em andamento",
        text: "Sua compra está em tratamento interno. Se precisar de apoio, fale com a loja.",
      };
  }
}

const statusProgress: Record<string, number> = {
  pending: 10,
  awaiting_payment: 18,
  payment_approved: 32,
  confirmed: 42,
  processing: 52,
  in_separation: 62,
  in_expedition: 74,
  shipped: 84,
  out_for_delivery: 92,
  delivered: 100,
  cancelled: 100,
};

function getLogisticsProfile(order: LocalOrder) {
  if (order.delivery_type === "pickup") {
    return {
      title: "Retirada na loja",
      badge: "retirada",
      text: "A loja confirma separacao e libera retirada quando o material estiver pronto.",
      nextOwner: "Loja e cliente",
    };
  }

  const isNational = order.shipping_address?.state && order.shipping_address.state !== STORE_INFO.address.state;
  return {
    title: isNational ? "Entrega nacional" : "Entrega por CEP",
    badge: isNational ? "transportadora" : "rota/transportadora",
    text: isNational
      ? "Pedido com destino fora do estado-base. A expedicao pode exigir transportadora homologada ou cotação assistida."
      : "Pedido com entrega por CEP. A equipe valida rota, volume e prazo antes da expedicao.",
    nextOwner: "Operação logistica",
  };
}

const fulfillmentTimeline = [
  { key: "payment_approved", label: "Pagamento" },
  { key: "in_separation", label: "Separacao" },
  { key: "in_expedition", label: "Expedicao" },
  { key: "out_for_delivery", label: "Transporte" },
  { key: "delivered", label: "Concluido" },
];

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const [token, setToken] = useState(tokenFromUrl || "");
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [items, setItems] = useState<LocalOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchOrder = async (trackingToken: string) => {
    if (!trackingToken) {
      toast({ title: "Token invalido", description: "Insira um token de rastreamento valido.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const data = await apiFetch<{ order: LocalOrder; items: LocalOrderItem[] }>(`/api/orders/track/${trackingToken}`);
      setOrder(data.order);
      setItems(data.items);
    } catch {
      setOrder(null);
      setItems([]);
      toast({ title: "Pedido não encontrado", description: "Verifique se o token de rastreamento está correto.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenFromUrl) void fetchOrder(tokenFromUrl);
  }, [tokenFromUrl]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const StatusIcon = order ? statusConfig[order.status]?.icon || Clock : Clock;
  const nextStep = order ? getNextStepMessage(order) : null;
  const logisticsProfile = order ? getLogisticsProfile(order) : null;
  const progress = order ? statusProgress[order.status] ?? 20 : 0;

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 rounded-[2.1rem] gradient-dark px-6 py-8 text-center text-secondary-foreground shadow-card">
          <p className="eyebrow text-secondary-foreground/60">Rastreio do pedido</p>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-5xl">Acompanhe entrega, retirada e proxima etapa.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-secondary-foreground/78 md:text-base">
            Consulte o status operacional do pedido, confira itens, entrega e o proximo passo sem depender de atendimento manual.
          </p>
        </div>

        <Card className="mb-8 rounded-[1.8rem] border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Digite o token de rastreamento</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void fetchOrder(token);
              }}
              className="flex flex-col gap-3 sm:flex-row sm:gap-4"
            >
              <Input
                type="text"
                placeholder="Ex: token de rastreamento"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="min-w-0 flex-1"
              />
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && searched && !order && (
          <Card className="rounded-[1.8rem] border-border/70 shadow-card">
            <CardContent className="py-12 text-center">
              <XCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">Pedido não encontrado</h2>
              <p className="text-muted-foreground">Verifique se o token de rastreamento está correto e tente novamente.</p>
            </CardContent>
          </Card>
        )}

        {!loading && order && (
          <div className="space-y-6">
            <Card className="rounded-[1.8rem] border-border/70 shadow-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">Pedido #{order.order_number}</CardTitle>
                    <p className="mt-1 text-muted-foreground">Realizado em {formatDate(order.created_at)}</p>
                  </div>
                  <Badge className={`${statusConfig[order.status]?.color} text-white`}>
                    <StatusIcon className="mr-1 h-4 w-4" />
                    {statusConfig[order.status]?.label || order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border bg-muted/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Progresso operacional</p>
                      <p className="mt-1 text-sm text-muted-foreground">{logisticsProfile?.text}</p>
                    </div>
                    <Badge variant="outline">{logisticsProfile?.badge}</Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-5">
                    {fulfillmentTimeline.map((step) => {
                      const stepProgress = statusProgress[step.key] ?? 0;
                      const done = progress >= stepProgress;
                      return (
                        <div key={step.key} className={`rounded-lg border px-2 py-2 text-center text-xs ${done ? "border-primary/30 bg-primary/5 text-primary" : "bg-background text-muted-foreground"}`}>
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {logisticsProfile ? (
              <Card className="rounded-[1.8rem] border-border/70 shadow-card">
                <CardContent className="grid gap-3 py-5 md:grid-cols-3">
                  <div className="rounded-xl bg-muted/35 p-4">
                    <Truck className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-semibold">{logisticsProfile.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{logisticsProfile.nextOwner}</p>
                  </div>
                  <div className="rounded-xl bg-muted/35 p-4">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-semibold">Conferencia operacional</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Itens, pagamento, endereco e volume seguem auditados no admin.</p>
                  </div>
                  <div className="rounded-xl bg-muted/35 p-4">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <p className="mt-2 font-semibold">Atendimento assistido</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Alteracoes de recebimento devem ser tratadas antes da saida.</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[1.8rem] border-border/70 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Itens do pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Frete</span>
                      <span>{formatCurrency(order.shipping_cost || 0)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto</span>
                        <span>-{formatCurrency(order.discount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.8rem] border-border/70 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Informações de entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Truck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{logisticsProfile?.title || (order.delivery_type === "pickup" ? "Retirada na loja" : "Entrega")}</p>
                      <p className="text-sm text-muted-foreground">{paymentMethodLabels[order.payment_method] || order.payment_method}</p>
                    </div>
                  </div>

                  {order.delivery_type === "delivery" && order.shipping_address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Endereco de entrega</p>
                        <p className="text-sm text-muted-foreground">
                          {order.shipping_address.street}, {order.shipping_address.number}
                          {order.shipping_address.complement && `, ${order.shipping_address.complement}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.shipping_address.neighborhood} - {order.shipping_address.city}/{order.shipping_address.state}
                        </p>
                        <p className="text-sm text-muted-foreground">CEP: {order.shipping_address.zipCode}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {order.shipment ? (
              <Card className="rounded-[1.8rem] border-border/70 shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">Transportadora e rastreio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-muted/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Transportadora</p>
                      <p className="mt-2 font-semibold">{order.shipment.carrier || "Em definicao"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{order.shipment.service || "Servico será confirmado pela operação."}</p>
                    </div>
                    <div className="rounded-xl bg-muted/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Codigo</p>
                      <p className="mt-2 font-semibold">{order.shipment.tracking_code || "Ainda não informado"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Atualizado em {order.shipment.updated_at ? formatDate(order.shipment.updated_at) : "análise operacional"}</p>
                    </div>
                    <div className="rounded-xl bg-muted/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Previsão</p>
                      <p className="mt-2 font-semibold">{order.shipment.estimated_delivery_at ? formatDate(order.shipment.estimated_delivery_at) : "A confirmar"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{order.shipment.dispatched_at ? `Despachado em ${formatDate(order.shipment.dispatched_at)}` : "Despacho pendente"}</p>
                    </div>
                  </div>
                  {order.shipment.notes ? <p className="mt-4 rounded-xl border bg-background p-3 text-sm text-muted-foreground">{order.shipment.notes}</p> : null}
                  {order.shipment.tracking_url ? (
                    <Button className="mt-4" variant="outline" asChild>
                      <a href={order.shipment.tracking_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir rastreio da transportadora
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {nextStep ? (
              <Card className="rounded-[1.8rem] border-primary/20 bg-primary/5 shadow-card">
                <CardContent className="py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Proximo passo</p>
                  <h2 className="mt-2 text-lg font-semibold">{nextStep.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{nextStep.text}</p>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[1.8rem] border-green-200 bg-green-50 shadow-card dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium">Duvidas sobre o pedido?</p>
                      <p className="text-sm text-muted-foreground">Entre em contato pelo WhatsApp</p>
                    </div>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700" asChild>
                    <a href={getWhatsAppUrl(`${WHATSAPP_MESSAGES.orderTracking}\n\nPedido #${order.order_number}`)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar no WhatsApp
                    </a>
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Atendimento da loja: {STORE_INFO.phone}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
