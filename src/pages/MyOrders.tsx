import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, ChevronDown, ChevronRight, Clock, LifeBuoy, Package, RefreshCcw, RotateCcw, Search, Truck, Wallet, XCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { LocalAuditLogEntry, LocalOrder, LocalOrderItem, OrderStatus } from "@/lib/localCommerce";
import type { Product } from "@/hooks/useProducts";
import { createReturnRequest, createSupportTicket, getCustomerProfile, syncCustomerProfileFromServer, type ReturnMethod } from "@/lib/customerCenter";

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: JSX.Element }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800", icon: <Clock className="h-4 w-4" /> },
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
  awaiting_payment: { label: "Aguardando pagamento", color: "bg-orange-100 text-orange-800", icon: <Clock className="h-4 w-4" /> },
  payment_approved: { label: "Pagamento aprovado", color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="h-4 w-4" /> },
  confirmed: { label: "Confirmado", color: "bg-blue-100 text-blue-800", icon: <CheckCircle className="h-4 w-4" /> },
  processing: { label: "Preparando", color: "bg-purple-100 text-purple-800", icon: <Package className="h-4 w-4" /> },
  in_separation: { label: "Em separacao", color: "bg-amber-100 text-amber-800", icon: <Package className="h-4 w-4" /> },
  in_expedition: { label: "Em expedicao", color: "bg-cyan-100 text-cyan-800", icon: <Truck className="h-4 w-4" /> },
  shipped: { label: "Enviado", color: "bg-indigo-100 text-indigo-800", icon: <Truck className="h-4 w-4" /> },
  out_for_delivery: { label: "Saiu para entrega", color: "bg-teal-100 text-teal-800", icon: <Truck className="h-4 w-4" /> },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
};

function getOrderNextAction(order: LocalOrder) {
  switch (order.status) {
    case "awaiting_payment":
      return "Concluir o pagamento para liberar a separacao do pedido.";
    case "payment_approved":
      return "A equipe vai encaminhar a separacao e a próxima atualização aparecera no rastreio.";
    case "confirmed":
    case "processing":
    case "in_separation":
      return order.delivery_type === "pickup"
        ? "A loja vai avisar assim que o material estiver pronto para retirada."
        : "Seu pedido está em preparacao para expedicao ou programacao de entrega.";
    case "in_expedition":
    case "shipped":
      return "A expedicao está em andamento. Acompanhe o rastreio para a próxima movimentacao.";
    case "out_for_delivery":
      return "Seu pedido saiu para entrega. Se precisar ajustar o recebimento, acione o atendimento.";
    case "delivered":
      return "Pedido concluido. Se necessário, você ainda pode abrir suporte ou devolucao.";
    case "cancelled":
      return "Pedido encerrado. Em caso de dúvida, fale com o atendimento.";
    default:
      return "Seu pedido segue em andamento e você pode acompanhar as próximas atualizações aqui.";
  }
}

function getOrderActionOwner(order: LocalOrder) {
  switch (order.status) {
    case "awaiting_payment":
      return { label: "Acao sua", tone: "bg-amber-100 text-amber-800" };
    case "out_for_delivery":
      return { label: "Entrega em rota", tone: "bg-teal-100 text-teal-800" };
    case "delivered":
      return { label: "Pos-venda disponível", tone: "bg-emerald-100 text-emerald-800" };
    case "cancelled":
      return { label: "Pedido encerrado", tone: "bg-zinc-100 text-zinc-800" };
    default:
      return { label: "Equipe em andamento", tone: "bg-sky-100 text-sky-800" };
  }
}

function getOrderLogisticsLabel(order: LocalOrder) {
  if (order.delivery_type === "pickup") return "Retirada na loja";
  if (order.shipping_address?.state && order.shipping_address.state !== "PE") return "Entrega nacional";
  return "Entrega por CEP";
}

function getOrderLogisticsDetail(order: LocalOrder) {
  if (order.shipment?.tracking_code) {
    return `${order.shipment.carrier || "Transportadora"}: rastreio ${order.shipment.tracking_code}.`;
  }
  if (order.delivery_type === "pickup") return "Aguardando separacao e liberacao para retirada.";
  if (["in_expedition", "shipped", "out_for_delivery"].includes(order.status)) {
    return "Expedicao em andamento. Confira o rastreio para movimentacao e prazo.";
  }
  return "A equipe valida CEP, volume e transportadora antes da expedicao.";
}

type PeriodFilter = "all" | "30" | "90" | "365";

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const { id: orderIdFromRoute } = useParams();
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, LocalOrderItem[]>>({});
  const [orderEventsMap, setOrderEventsMap] = useState<Record<string, LocalAuditLogEntry[]>>({});
  const [returnReason, setReturnReason] = useState<Record<string, string>>({});
  const [returnMethod, setReturnMethod] = useState<Record<string, ReturnMethod>>({});
  const [returnAttachmentUrl, setReturnAttachmentUrl] = useState<Record<string, string>>({});
  const [supportMessage, setSupportMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        await syncCustomerProfileFromServer(user);
        const data = await apiFetch<LocalOrder[]>("/api/orders/me");
        setOrders(data);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [user]);

  const loadOrderDetails = useCallback(async (orderId: string) => {
    if (orderItemsMap[orderId] && orderEventsMap[orderId]) return;
    try {
      const [items, events] = await Promise.all([
        apiFetch<LocalOrderItem[]>(`/api/orders/${orderId}/items`),
        apiFetch<LocalAuditLogEntry[]>(`/api/audit/orders/${orderId}`),
      ]);
      setOrderItemsMap((prev) => ({ ...prev, [orderId]: items }));
      setOrderEventsMap((prev) => ({ ...prev, [orderId]: events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()) }));
    } catch {
      toast.error("Não foi possível carregar os detalhes deste pedido");
    }
  }, [orderEventsMap, orderItemsMap]);

  useEffect(() => {
    if (!orderIdFromRoute || orders.length === 0) return;
    const matchedOrder = orders.find((order) => order.id === orderIdFromRoute);
    if (!matchedOrder) return;
    setExpandedOrderId(matchedOrder.id);
    void loadOrderDetails(matchedOrder.id);
  }, [loadOrderDetails, orderIdFromRoute, orders]);

  const toggleExpanded = async (orderId: string) => {
    setExpandedOrderId((current) => (current === orderId ? null : orderId));
    if (expandedOrderId !== orderId) await loadOrderDetails(orderId);
  };

  const handleBuyAgain = async (orderId: string) => {
    setReordering(orderId);
    try {
      const items = await apiFetch<Array<{ product_id: string; quantity: number }>>(`/api/orders/${orderId}/items`);
      if (items.length === 0) {
        toast.error("Nenhum produto encontrado neste pedido");
        return;
      }
      const products = await apiFetch<Product[]>("/api/products");
      let added = 0;
      for (const item of items) {
        const product = products.find((entry) => entry.id === item.product_id);
        if (product) {
          addItem(product, item.quantity);
          added += 1;
        }
      }
      if (added > 0) {
        toast.success(`${added} item(ns) adicionado(s) ao carrinho`);
        navigate("/carrinho");
      } else {
        toast.error("Os produtos deste pedido não estao mais disponiveis");
      }
    } catch {
      toast.error("Erro ao repetir compra");
    } finally {
      setReordering(null);
    }
  };

  const handleReturnRequest = (order: LocalOrder) => {
    if (!user) return;
    if (!isReturnEligible(order)) {
      toast.error("Este pedido não está elegivel para devolucao automatica");
      return;
    }
    const reason = returnReason[order.id]?.trim();
    if (!reason) {
      toast.error("Informe o motivo da solicitação");
      return;
    }
    createReturnRequest({
      orderId: order.id,
      orderNumber: order.order_number,
      reason,
      note: reason,
      attachmentUrl: returnAttachmentUrl[order.id]?.trim() || undefined,
      method: returnMethod[order.id] || "exchange",
    }, user);
    setReturnReason((prev) => ({ ...prev, [order.id]: "" }));
    setReturnAttachmentUrl((prev) => ({ ...prev, [order.id]: "" }));
    toast.success("Solicitação de devolucao registrada");
  };

  const handleSupport = (order: LocalOrder) => {
    if (!user) return;
    const message = supportMessage[order.id]?.trim();
    if (!message) {
      toast.error("Descreva o que você precisa");
      return;
    }
    const profile = getCustomerProfile(user);
    createSupportTicket({ orderId: order.id, subject: `Suporte do pedido #${order.order_number}`, channel: profile.preferredChannel, message }, user);
    setSupportMessage((prev) => ({ ...prev, [order.id]: "" }));
    toast.success("Atendimento vinculado ao pedido");
  };

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (periodFilter !== "all") {
      const days = Number(periodFilter);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (new Date(order.created_at).getTime() < cutoff) return false;
    }
    if (!search.trim()) return true;
    const normalized = search.toLowerCase();
    return order.order_number.toLowerCase().includes(normalized) || (order.store_name || "").toLowerCase().includes(normalized) || (order.order_origin || "").toLowerCase().includes(normalized);
  }), [orders, periodFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((order) => order.status !== "cancelled");
      return {
        total: orders.length,
        pending: orders.filter((order) => order.status === "pending" || order.status === "awaiting_payment").length,
        delivered: orders.filter((order) => order.status === "delivered").length,
        nationalDelivery: orders.filter((order) => order.delivery_type === "delivery" && order.shipping_address?.state && order.shipping_address.state !== "PE").length,
        spent: activeOrders.reduce((sum, order) => sum + Number(order.total), 0),
        returnEligible: orders.filter((order) => isReturnEligible(order)).length,
      };
  }, [orders]);

  const ongoingOrders = useMemo(() => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).slice(0, 3), [orders]);
  const reorderOrders = useMemo(() => orders.filter((order) => order.status === "delivered").slice(0, 3), [orders]);

  const exportHistory = () => {
    const rows = [["pedido", "data", "tipo", "origem", "status", "pagamento", "total"], ...filteredOrders.map((order) => [
      order.order_number,
      new Date(order.created_at).toLocaleDateString("pt-BR"),
      order.order_type || "normal",
      order.order_origin || "ecommerce",
      order.status,
      translatePaymentStatus(order.payment_status),
      Number(order.total).toFixed(2).replace(".", ","),
    ])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meus-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container py-8">
          <Skeleton className="mb-6 h-10 w-72" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
          <div className="mt-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container py-8">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Inicio</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Pedidos e devolucoes</span>
        </nav>

        <div className="rounded-[2.25rem] gradient-dark p-6 text-secondary-foreground shadow-card md:p-8">
          <p className="eyebrow text-secondary-foreground/60">Pedidos e devolucoes</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold md:text-4xl">Acompanhe pedidos, devolucoes e recompra em um painel unico.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary-foreground/76 md:text-base">Veja o andamento, revise o historico do pedido, abra suporte, solicite devolucao e compre novamente com menos friccao.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="lg" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link to="/produtos">Continuar comprando<ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button type="button" variant="outline" size="lg" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={exportHistory}>
                Exportar historico
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Package className="h-5 w-5 text-primary" />} label="Total de pedidos" value={String(stats.total)} />
          <StatCard icon={<Clock className="h-5 w-5 text-primary" />} label="Aguardando acao" value={String(stats.pending)} />
          <StatCard icon={<CheckCircle className="h-5 w-5 text-primary" />} label="Pedidos entregues" value={String(stats.delivered)} />
          <StatCard icon={<Truck className="h-5 w-5 text-primary" />} label="Entregas nacionais" value={String(stats.nationalDelivery)} />
        </div>

        <section className="mt-6 grid gap-4 xl:grid-cols-4">
          <OrdersHubCard title="Seus pedidos" description="Acompanhe status, pagamento e entrega." meta={`${stats.total} pedido(s) no histórico`} />
          <OrdersHubCard title="Devolucoes" description="Abra solicitações elegiveis direto pelo pedido." meta={`${stats.returnEligible} pedido(s) com devolucao self-service`} />
          <OrdersHubCard title="Comprar novamente" description="Reponha itens e listas de compra com um clique." meta={`${reorderOrders.length} pedido(s) recentes para recompra`} />
          <OrdersHubCard title="Precisa de ajuda?" description="Abra atendimento vinculado ao pedido sem ligar para a loja." meta="Suporte, entrega, pagamento e troca" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="surface-panel rounded-[2rem] px-5 py-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div>
                  <Label>Buscar pedido</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-11 pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Numero, origem ou loja" />
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | OrderStatus)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(statusConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Periodo</Label>
                  <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Todo o histórico" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo o historico</SelectItem>
                      <SelectItem value="30">Ultimos 30 dias</SelectItem>
                      <SelectItem value="90">Ultimos 90 dias</SelectItem>
                      <SelectItem value="365">Ultimos 12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            {filteredOrders.length === 0 ? (
              <div className="surface-panel rounded-[2rem] py-20 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h2 className="font-display text-2xl font-semibold">Nenhum pedido encontrado</h2>
                <p className="mt-2 text-muted-foreground">Ajuste os filtros ou faca uma nova compra para alimentar seu historico.</p>
                <Button asChild className="mt-6">
                  <Link to="/produtos">Explorar produtos</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order, index) => {
                  const status = statusConfig[order.status];
                  const isExpanded = expandedOrderId === order.id;
                  const orderItems = orderItemsMap[order.id] || [];
                  const events = orderEventsMap[order.id] || [];

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-[1.75rem] border bg-card p-5 shadow-card md:p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-display text-xl font-semibold">Pedido #{order.order_number}</h3>
                            <Badge className={`${status.color} flex items-center gap-1`}>{status.icon}{status.label}</Badge>
                            {order.assisted_sale ? <Badge variant="secondary">Compra assistida</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Realizado em {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                          <InfoPill label="Tipo" value={order.order_type || "normal"} />
                          <InfoPill label="Origem" value={order.order_origin || "ecommerce"} />
                          <InfoPill label="Total" value={`R$ ${Number(order.total).toFixed(2).replace(".", ",")}`} strong />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="grid gap-3 sm:grid-cols-4">
                          <InfoPill label="Logistica" value={getOrderLogisticsLabel(order)} />
                          <InfoPill label="Pagamento" value={translatePayment(order.payment_method)} />
                          <InfoPill label="Status pag." value={translatePaymentStatus(order.payment_status)} />
                          <InfoPill label="Loja" value={order.store_name || "Site"} />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{getOrderLogisticsDetail(order)}</p>

                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/rastrear?token=${order.tracking_token}`}>Acompanhar</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void toggleExpanded(order.id)}>
                            {isExpanded ? "Fechar detalhes" : "Ver detalhes"}
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </Button>
                          <Button size="sm" disabled={reordering === order.id} onClick={() => void handleBuyAgain(order.id)} className="gap-2">
                            <RefreshCcw className="h-4 w-4" />
                            {reordering === order.id ? "Adicionando..." : "Comprar de novo"}
                          </Button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-5 grid gap-5 border-t pt-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                          <div className="space-y-5">
                            <div>
                              <h4 className="font-display text-lg font-semibold">Itens do pedido</h4>
                              <div className="mt-3 space-y-3">
                                {orderItems.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Carregando itens ou nenhum item encontrado.</p>
                                ) : orderItems.map((item) => (
                                  <div key={item.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold">{item.product_name}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">SKU {item.product_sku || item.product_id} · Qtd. {item.quantity}</p>
                                      </div>
                                      <p className="font-semibold">R$ {Number(item.total_price).toFixed(2).replace(".", ",")}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-display text-lg font-semibold">Timeline do pedido</h4>
                              <div className="mt-3 space-y-3">
                                {events.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Carregando eventos do pedido.</p>
                                ) : events.map((event) => (
                                  <div key={event.event_id} className="rounded-[1.2rem] border p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="font-semibold">{translateEvent(event.event_type)}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                          {new Date(event.occurred_at).toLocaleString("pt-BR")} · {event.actor_name || "Sistema"}
                                        </p>
                                      </div>
                                      <Badge variant="outline">{event.source_channel}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-[1.2rem] border p-4">
                              <h4 className="font-semibold">Solicitar troca ou devolucao</h4>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {isReturnEligible(order)
                                  ? "Abra uma solicitação vinculada ao pedido sem depender de contato manual inicial."
                                  : "A devolucao self-service está disponível apenas para pedidos entregues nos ultimos 7 dias."}
                              </p>
                              <Textarea className="mt-3" value={returnReason[order.id] || ""} onChange={(e) => setReturnReason((prev) => ({ ...prev, [order.id]: e.target.value }))} placeholder="Descreva o motivo da troca ou devolucao" disabled={!isReturnEligible(order)} />
                              <Input className="mt-3" value={returnAttachmentUrl[order.id] || ""} onChange={(e) => setReturnAttachmentUrl((prev) => ({ ...prev, [order.id]: e.target.value }))} placeholder="Link da foto ou anexo de apoio (opcional)" disabled={!isReturnEligible(order)} />
                              <div className="mt-3">
                                <Label>Metodo desejado</Label>
                                <Select value={returnMethod[order.id] || "exchange"} onValueChange={(value) => setReturnMethod((prev) => ({ ...prev, [order.id]: value as ReturnMethod }))} disabled={!isReturnEligible(order)}>
                                  <SelectTrigger className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="exchange">Troca</SelectItem>
                                    <SelectItem value="credit">Credito</SelectItem>
                                    <SelectItem value="refund">Reembolso</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => handleReturnRequest(order)} disabled={!isReturnEligible(order)}>
                                <RotateCcw className="h-4 w-4" />
                                Registrar solicitação
                              </Button>
                            </div>

                            <div className="rounded-[1.2rem] border p-4">
                              <h4 className="font-semibold">Suporte vinculado ao pedido</h4>
                              <p className="mt-1 text-sm text-muted-foreground">Abra atendimento contextualizado para entrega, pagamento ou itens.</p>
                              <Textarea className="mt-3" value={supportMessage[order.id] || ""} onChange={(e) => setSupportMessage((prev) => ({ ...prev, [order.id]: e.target.value }))} placeholder="Descreva o que precisa resolver neste pedido" />
                              <Button type="button" className="mt-3 w-full" onClick={() => handleSupport(order)}>
                                <LifeBuoy className="h-4 w-4" />
                                Abrir atendimento
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.8rem] border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">Em andamento</h3>
              <div className="mt-4 space-y-3">
                {ongoingOrders.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido em andamento agora.</p> : ongoingOrders.map((order) => (
                  <div key={order.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                    <p className="font-semibold">Pedido #{order.order_number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{statusConfig[order.status].label}</p>
                    <Badge className={`mt-3 ${getOrderActionOwner(order).tone}`}>{getOrderActionOwner(order).label}</Badge>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{getOrderNextAction(order)}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => void toggleExpanded(order.id)}>Ver pedido</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">Comprar novamente</h3>
              <div className="mt-4 space-y-3">
                {reorderOrders.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não tem pedidos entregues para recompra.</p> : reorderOrders.map((order) => (
                  <div key={order.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                    <p className="font-semibold">Pedido #{order.order_number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")} · R$ {Number(order.total).toFixed(2).replace(".", ",")}</p>
                    <Button size="sm" className="mt-3" disabled={reordering === order.id} onClick={() => void handleBuyAgain(order.id)}>Repetir compra</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function isReturnEligible(order: LocalOrder) {
  if (order.status !== "delivered") return false;
  const deliveredDate = new Date(order.updated_at).getTime();
  return Date.now() - deliveredDate <= 7 * 24 * 60 * 60 * 1000;
}

function OrdersHubCard({ title, description, meta }: { title: string; description: string; meta: string }) {
  return <div className="rounded-[1.5rem] border bg-card p-5 shadow-card"><h3 className="font-display text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-4 text-sm font-medium text-foreground">{meta}</p></div>;
}

function StatCard({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return <div className="rounded-[1.4rem] border bg-card p-5 shadow-card"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p>{icon}</div><p className="mt-3 font-display text-3xl font-bold">{value}</p></div>;
}

function InfoPill({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-2xl bg-muted/55 px-4 py-3"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className={`mt-1 text-sm ${strong ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{value}</p></div>;
}

function translatePayment(method: LocalOrder["payment_method"]) {
  switch (method) {
    case "credit_card": return "Cartão";
    case "boleto": return "Boleto";
    case "pix": return "PIX";
    case "payment_link": return "Link";
    case "store_pos": return "POS loja";
    default: return "Dinheiro";
  }
}

function translatePaymentStatus(status?: LocalOrder["payment_status"]) {
  switch (status) {
    case "approved": return "Aprovado";
    case "initiated": return "Iniciado";
    case "failed": return "Falhou";
    case "cancelled": return "Cancelado";
    default: return "Pendente";
  }
}

function translateEvent(eventType: string) {
  const dictionary: Record<string, string> = {
    "order.created": "Pedido criado",
    "order.status_updated": "Status atualizado",
    "payment.initiated": "Pagamento iniciado",
    "payment.approved": "Pagamento aprovado",
    "payment.failed": "Pagamento falhou",
    "order.address_confirmed": "Endereço confirmado",
    "order.freight_calculated": "Frete calculado",
    "order.released_for_fulfillment": "Liberado para expedicao",
    "order.delivered": "Pedido entregue",
    "order.cancelled": "Pedido cancelado",
    "assisted_sale.order_created": "Pedido assistido criado",
  };
  return dictionary[eventType] || eventType;
}
