import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, CheckCircle, Store, Phone, ArrowRight, Package, CreditCard, MapPin, Calendar, MessageCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { STORE_INFO, WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";

interface OrderState {
  order?: {
    id: string;
    order_number: string;
    tracking_token?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    delivery_type: string;
    payment_method: string;
    shipping_address: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    } | null;
    subtotal: number;
    shipping_cost: number | null;
    discount: number | null;
    total: number;
    created_at: string;
  };
  userWasGuest?: boolean;
}

export default function OrderConfirmed() {
  const location = useLocation();
  const state = location.state as OrderState | null;
  const order = state?.order;
  const userWasGuest = Boolean(state?.userWasGuest);
  const orderNumber = order?.order_number || `PVC${Date.now().toString().slice(-6)}`;
  const whatsappLink = getWhatsAppUrl(`${WHATSAPP_MESSAGES.orderTracking}\n\nPedido: ${orderNumber}\nCliente: ${order?.customer_name || "Cliente"}`);
  const isNationalDelivery = order?.delivery_type === "delivery" && order.shipping_address?.state && order.shipping_address.state !== STORE_INFO.address.state;
  const deliveryTitle = order?.delivery_type === "pickup" ? "Retirada" : isNationalDelivery ? "Entrega nacional" : "Entrega por CEP";
  const deliveryGuidance =
    order?.delivery_type === "pickup"
      ? "A separacao será confirmada antes da retirada."
      : isNationalDelivery
        ? "A equipe valida cubagem, transportadora e prazo antes da expedicao nacional."
        : "A equipe valida rota, volume e janela de entrega antes da expedicao.";

  const paymentLabels: Record<string, string> = {
    credit_card: "Cartão de credito",
    boleto: "Boleto bancario",
    pix: "PIX",
    cash: "Dinheiro na retirada",
  };

  return (
    <Layout>
      <div className="container py-8 md:py-16">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2.25rem] gradient-dark px-6 py-10 text-center text-secondary-foreground shadow-card">
            <CheckCircle className="mx-auto h-20 w-20 text-success" />
            <h1 className="mt-6 font-display text-3xl font-bold text-white md:text-4xl">Pedido confirmado</h1>
            <p className="mt-2 text-secondary-foreground/76">
              Seu pedido ja entrou no fluxo operacional. Agora e acompanhar separacao, retirada, expedicao ou cotação assistida quando necessario.
            </p>
          </motion.div>

          <div className="mt-8 surface-panel rounded-[2rem] px-6 py-6 shadow-card md:px-8 md:py-8">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="eyebrow">Numero do pedido</p>
                <p className="mt-2 font-display text-4xl font-bold text-primary">{orderNumber}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  Guarde este numero para atendimento, rastreio e futuras recompras.
                </p>

                {order?.tracking_token && (
                  <div className="mt-5 rounded-[1.4rem] border bg-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Token de rastreamento</p>
                        <p className="mt-2 truncate font-mono text-sm">{order.tracking_token}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(order.tracking_token || "");
                          toast.success("Token copiado");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Link to={`/rastrear?token=${order.tracking_token}`} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                      Rastrear pedido
                    </Link>
                  </div>
                )}
              </div>

              <div className="rounded-[1.7rem] gradient-dark p-5 text-secondary-foreground">
                <p className="eyebrow text-secondary-foreground/60">Resumo financeiro</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary-foreground/68">Subtotal</span>
                    <span>R$ {Number(order?.subtotal || 0).toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-foreground/68">Frete</span>
                    <span>{Number(order?.shipping_cost || 0) === 0 ? "Gratis" : `R$ ${Number(order?.shipping_cost || 0).toFixed(2).replace(".", ",")}`}</span>
                  </div>
                  {Number(order?.discount || 0) > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Desconto</span>
                      <span>-R$ {Number(order?.discount || 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                </div>
                <Separator className="my-4 bg-white/10" />
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-secondary-foreground/68">Total</p>
                    <p className="font-display text-3xl font-bold">R$ {Number(order?.total || 0).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
              </div>
            </div>

            {order && (
              <>
                <Separator className="my-8" />

                <div className="grid gap-4 md:grid-cols-3">
                  <InfoCard
                    icon={<Package className="h-5 w-5 text-primary" />}
                    title="Pedido"
                    text={`Criado em ${new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                  />
                  <InfoCard icon={<CreditCard className="h-5 w-5 text-primary" />} title="Pagamento" text={paymentLabels[order.payment_method] || order.payment_method} />
                  <InfoCard
                    icon={order.delivery_type === "pickup" ? <Store className="h-5 w-5 text-primary" /> : <MapPin className="h-5 w-5 text-primary" />}
                    title={deliveryTitle}
                    text={
                      order.delivery_type === "pickup"
                        ? `${STORE_INFO.address.street}, ${STORE_INFO.address.number} - ${STORE_INFO.address.neighborhood}`
                        : order.shipping_address
                          ? `${order.shipping_address.street}, ${order.shipping_address.number} - ${order.shipping_address.neighborhood}`
                          : "Endereço informado no checkout"
                    }
                  />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Proxima etapa operacional</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{deliveryGuidance}</p>
                  {order.tracking_token ? (
                    <Button asChild variant="outline" size="sm" className="mt-3 rounded-lg">
                      <Link to={`/rastrear?token=${order.tracking_token}`}>Abrir rastreio detalhado</Link>
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {(!order || order.delivery_type === "pickup") && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[1.8rem] border border-success/20 bg-success/10 p-6 shadow-card">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-success" />
                <div>
                  <p className="font-semibold text-success">Disponivel para retirada em breve</p>
                  <p className="text-sm text-muted-foreground">
                    A separacao costuma levar cerca de 2 horas. Se quiser, confirme com a loja antes de sair.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 rounded-[1.6rem] border-2 border-[#25D366] bg-[#25D366]/10 p-5 text-[#25D366] transition-colors hover:bg-[#25D366]/15"
            >
              <MessageCircle className="h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">Acompanhar pelo WhatsApp</p>
                <p className="text-sm opacity-80">Receba suporte e atualizacoes do pedido direto com a loja.</p>
              </div>
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Enviamos os detalhes do pedido para <span className="font-medium text-foreground">{order?.customer_email || "seu e-mail"}</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary" />
              <span>Duvidas? {STORE_INFO.phone}</span>
            </div>
          </motion.div>

          {userWasGuest ? (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[1.8rem] border border-primary/20 bg-primary/5 p-6 shadow-card">
              <p className="eyebrow">Ative sua conta depois da compra</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Guarde seus pedidos e acelere a proxima compra</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Você concluiu como visitante. Agora pode criar sua conta para acompanhar pedidos, salvar enderecos, repetir compras e falar com a loja com menos esforco.
              </p>
              <Button asChild className="mt-5">
                <Link to="/auth">Ativar minha conta</Link>
              </Button>
            </motion.div>
          ) : null}

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link to="/produtos">
                Continuar comprando
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/meus-pedidos">Ver meus pedidos</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[1.4rem] bg-muted/45 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
