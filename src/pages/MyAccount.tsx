import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Headphones,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api";
import {
  addOrUpdateAddress,
  createSupportTicket,
  getCustomerProfile,
  getFavoriteProducts,
  removeAddress,
  removeFavoriteList,
  removeSavedCart,
  saveCustomerProfile,
  saveFavoriteList,
  syncCustomerProfileFromServer,
  type CustomerAddressBookEntry,
} from "@/lib/customerCenter";
import type { LocalOrder } from "@/lib/localCommerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { STORE_INFO, getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";
import { toast } from "sonner";

const emptyAddress: CustomerAddressBookEntry = {
  id: "",
  label: "",
  street: "",
  number: "",
  neighborhood: "",
  city: "Garanhuns",
  state: "PE",
  zipCode: "",
  type: "delivery",
  isDefault: true,
};

export default function MyAccount() {
  const { user, loading: authLoading } = useAuth();
  const { replaceCart } = useCart();
  const { data: products = [] } = useProducts({ limit: 50 });
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [supportMessage, setSupportMessage] = useState("");
  const [addressForm, setAddressForm] = useState<CustomerAddressBookEntry>(emptyAddress);
  const [favoriteListName, setFavoriteListName] = useState("");
  const [, setProfileVersion] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      try {
        await syncCustomerProfileFromServer(user);
        const data = await apiFetch<LocalOrder[]>("/api/orders/me");
        setOrders(data);
        setProfileVersion((value) => value + 1);
      } finally {
        setLoadingOrders(false);
      }
    };
    void run();
  }, [user]);

  useEffect(() => {
    const routeToSection: Record<string, string> = {
      "/conta/dados": "perfil",
      "/conta/enderecos": "endereços",
      "/conta/favoritos": "listas",
    };
    const targetId = routeToSection[location.pathname];
    if (!targetId) return;
    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.pathname]);

  const profile = getCustomerProfile(user);
  const summary = useMemo(
    () => ({
      orders: orders.length,
      active: orders.filter((order) => !["cancelled", "delivered"].includes(order.status)).length,
      spent: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total), 0),
      savedCarts: profile.savedCarts.length,
      returns: profile.returns.length,
    }),
    [orders, profile],
  );

  const favoriteProducts = useMemo(() => getFavoriteProducts(products, profile), [products, profile]);
  const latestOrder = orders[0];
  const firstName = profile.fullName?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Cliente";

  if (authLoading || loadingOrders) {
    return (
      <Layout>
        <div className="container py-8">
          <Skeleton className="h-12 w-56" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="mt-6 h-96 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container py-8">
        <div className="rounded-[2.25rem] gradient-dark p-6 text-secondary-foreground shadow-card md:p-8">
          <p className="eyebrow text-secondary-foreground/60">Sua conta</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold md:text-4xl">Ola, {firstName}. Central de conta e autoatendimento.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary-foreground/76 md:text-base">
                Gerencie pedidos, enderecos, listas, suporte, devolucoes e recompra em um unico painel operacional.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3.5 text-sm backdrop-blur-sm">
              <p className="text-secondary-foreground/65">Perfil ativo</p>
              <p className="mt-1 font-semibold">{profile.fullName || user.email}</p>
              <p className="text-secondary-foreground/70">{profile.customerType} · {profile.preferredChannel}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AccountStat label="Pedidos realizados" value={String(summary.orders)} />
          <AccountStat label="Pedidos em andamento" value={String(summary.active)} />
          <AccountStat label="Total comprado" value={`R$ ${summary.spent.toFixed(2).replace(".", ",")}`} />
          <AccountStat label="Carrinhos salvos" value={String(summary.savedCarts)} />
          <AccountStat label="Devolucoes abertas" value={String(summary.returns)} />
        </div>

        <section className="mt-6 surface-panel rounded-[2rem] px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hub da conta</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Atalhos principais</h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/conta/pedidos">Ver todos os pedidos</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HubCard
              icon={<ShoppingBag className="h-5 w-5 text-primary" />}
              title="Seus pedidos"
              description="Rastrear, devolver e comprar novamente."
              meta={latestOrder ? `Ultimo pedido #${latestOrder.order_number}` : "Nenhum pedido ainda"}
              href="/conta/pedidos"
            />
            <HubCard
              icon={<MapPin className="h-5 w-5 text-primary" />}
              title="Seus endereços"
              description="Atualize entrega, cobranca e endereços padrao."
              meta={`${profile.addresses.length} endereço(s) salvo(s)`}
              href="/conta/enderecos"
            />
            <HubCard
              icon={<Heart className="h-5 w-5 text-primary" />}
              title="Listas e favoritos"
              description="Organize listas por obra, ambiente ou recompra."
              meta={`${profile.favorites.length} favorito(s) e ${profile.lists.length} lista(s)`}
              href="/conta/favoritos"
            />
            <HubCard
              icon={<Headphones className="h-5 w-5 text-primary" />}
              title="Atendimento ao cliente"
              description="Abra suporte para pedido, entrega ou troca."
              meta={`${profile.tickets.length} atendimento(s) registrado(s)`}
              href="#suporte"
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section id="resumo" className="surface-panel rounded-[2rem] px-6 py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Resumo da conta</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Visao geral e recompra</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/produtos">Continuar comprando</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/conta/pedidos">Abrir meus pedidos</Link>
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoBlock icon={<ShoppingBag className="h-4 w-4 text-primary" />} label="Ultimo pedido" value={latestOrder ? `#${latestOrder.order_number}` : "Nenhum pedido ainda"} />
                <InfoBlock icon={<Truck className="h-4 w-4 text-primary" />} label="Status atual" value={latestOrder ? latestOrder.status : "Sem pedidos ativos"} />
                <InfoBlock icon={<Mail className="h-4 w-4 text-primary" />} label="E-mail" value={profile.email || user.email} />
                <InfoBlock icon={<Phone className="h-4 w-4 text-primary" />} label="Telefone" value={profile.phone || "Não informado"} />
              </div>
            </section>

            <section id="perfil" className="surface-panel rounded-[2rem] px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Acesso e segurança</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Perfil do cliente</h2>
                </div>
                <Badge variant="outline">{profile.customerType}</Badge>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Nome completo" value={profile.fullName} onChange={(value) => saveAndRefresh({ ...profile, fullName: value })} />
                <Field label="Telefone" value={profile.phone} onChange={(value) => saveAndRefresh({ ...profile, phone: value })} />
                <Field label="CPF / CNPJ" value={profile.cpfCnpj} onChange={(value) => saveAndRefresh({ ...profile, cpfCnpj: value })} />
                <Field label="Empresa" value={profile.companyName || ""} onChange={(value) => saveAndRefresh({ ...profile, companyName: value })} />
              </div>
            </section>

            <section id="endereços" className="surface-panel rounded-[2rem] px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Seus enderecos</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Entrega e cobranca</h2>
                </div>
                <Badge variant="secondary">{profile.addresses.length} salvo(s)</Badge>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {profile.addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum endereco salvo ainda.</p>
                  ) : (
                    profile.addresses.map((entry) => (
                      <div key={entry.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {entry.label} {entry.isDefault ? "· Padrao" : ""}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {entry.street}, {entry.number} - {entry.neighborhood}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {entry.city}/{entry.state} · {entry.zipCode}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              removeAddress(entry.id, user);
                              setProfileVersion((value) => value + 1);
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-[1.3rem] border p-4">
                  <p className="font-semibold">Adicionar endereco</p>
                  <div className="mt-3 space-y-3">
                    <Input placeholder="Nome do endereço" value={addressForm.label} onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))} />
                    <Input placeholder="Rua" value={addressForm.street} onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Numero" value={addressForm.number} onChange={(e) => setAddressForm((prev) => ({ ...prev, number: e.target.value }))} />
                      <Input placeholder="CEP" value={addressForm.zipCode} onChange={(e) => setAddressForm((prev) => ({ ...prev, zipCode: e.target.value }))} />
                    </div>
                    <Input placeholder="Bairro" value={addressForm.neighborhood} onChange={(e) => setAddressForm((prev) => ({ ...prev, neighborhood: e.target.value }))} />
                    <Button
                      onClick={() => {
                        if (!addressForm.label || !addressForm.street || !addressForm.number || !addressForm.neighborhood || !addressForm.city || !addressForm.state || !addressForm.zipCode) {
                          toast.error("Preencha os dados principais do endereço");
                          return;
                        }
                        addOrUpdateAddress({ ...addressForm, id: addressForm.id || `${Date.now()}` }, user);
                        setAddressForm(emptyAddress);
                        setProfileVersion((value) => value + 1);
                        toast.success("Endereço salvo");
                      }}
                      className="w-full"
                    >
                      Salvar endereco
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section id="listas" className="surface-panel rounded-[2rem] px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Listas e compras</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Carrinhos salvos, favoritos e listas</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Carrinhos salvos</p>
                  {profile.savedCarts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum carrinho salvo ainda.</p>
                  ) : (
                    profile.savedCarts.map((cart) => (
                      <div key={cart.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{cart.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {cart.items.reduce((sum, item) => sum + item.quantity, 0)} itens ·{" "}
                              {new Date(cart.updatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                replaceCart(cart.items);
                                toast.success("Carrinho restaurado");
                                navigate("/carrinho");
                              }}
                            >
                              Carregar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                removeSavedCart(cart.id, user);
                                setProfileVersion((value) => value + 1);
                              }}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Favoritos</p>
                  {favoriteProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Você ainda não favoritou produtos.</p>
                  ) : (
                    favoriteProducts.slice(0, 4).map((product) => (
                      <div key={product.id} className="flex items-center gap-3 rounded-[1.2rem] bg-muted/45 p-3">
                        <div className="h-14 w-14 overflow-hidden rounded-xl bg-muted">
                          <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 font-semibold">{product.name}</p>
                          <p className="text-sm text-muted-foreground">R$ {Number(product.price).toFixed(2).replace(".", ",")}</p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/produto/${product.slug}`}>Ver</Link>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Listas de compra</p>
                  <div className="rounded-[1.2rem] border p-4">
                    <Input placeholder="Nome da lista. Ex.: Obra banheiro" value={favoriteListName} onChange={(e) => setFavoriteListName(e.target.value)} />
                    <Button
                      className="mt-3 w-full"
                      variant="outline"
                      onClick={() => {
                        if (!favoriteListName.trim()) {
                          toast.error("Digite um nome para a lista");
                          return;
                        }
                        if (profile.favorites.length === 0) {
                          toast.error("Adicione favoritos antes de criar uma lista");
                          return;
                        }
                        saveFavoriteList(favoriteListName.trim(), profile.favorites, user);
                        setFavoriteListName("");
                        setProfileVersion((value) => value + 1);
                        toast.success("Lista criada");
                      }}
                    >
                      Criar lista com favoritos
                    </Button>
                  </div>
                  {profile.lists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda.</p>
                  ) : (
                    profile.lists.map((list) => (
                      <div key={list.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{list.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{list.productIds.length} produto(s)</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              removeFavoriteList(list.id, user);
                              setProfileVersion((value) => value + 1);
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section id="suporte" className="rounded-[1.8rem] border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Atendimento e devolucoes</p>
                  <h2 className="mt-2 font-display text-2xl font-bold">Autoatendimento e suporte</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.2rem] bg-muted/45 p-4">
                  <p className="font-semibold">Solicitações de devolucao</p>
                  <div className="mt-3 space-y-2">
                    {profile.returns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma devolucao solicitada ainda.</p>
                    ) : (
                      profile.returns.slice(0, 4).map((request) => (
                        <div key={request.id} className="rounded-xl border bg-background p-3 text-sm">
                          <p className="font-medium">Pedido #{request.orderNumber}</p>
                          <p className="text-muted-foreground">
                            {request.method} · {request.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-[1.2rem] border p-4">
                  <p className="font-semibold">Abrir atendimento</p>
                  <Textarea
                    className="mt-3"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Descreva sua dúvida sobre pedido, troca, entrega ou produto..."
                  />
                  <Button
                    className="mt-3 w-full"
                    onClick={() => {
                      if (!supportMessage.trim()) {
                        toast.error("Digite sua mensagem");
                        return;
                      }
                      createSupportTicket({ subject: "Atendimento pela conta", channel: profile.preferredChannel, message: supportMessage }, user);
                      setSupportMessage("");
                      setProfileVersion((value) => value + 1);
                      toast.success("Solicitação registrada");
                    }}
                  >
                    Registrar atendimento
                  </Button>
                  <Button asChild variant="whatsapp" className="mt-2 w-full">
                    <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.contact)} target="_blank" rel="noopener noreferrer">
                      Falar com a loja
                    </a>
                  </Button>
                  {profile.tickets.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold">Historico recente</p>
                      {profile.tickets.slice(0, 3).map((ticket) => (
                        <div key={ticket.id} className="rounded-xl bg-muted/45 p-3 text-sm">
                          <p className="font-medium">{ticket.subject}</p>
                          <p className="mt-1 text-muted-foreground">
                            {new Date(ticket.createdAt).toLocaleDateString("pt-BR")} · {ticket.channel}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.8rem] border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">Sua conta</h3>
              <div className="mt-4 space-y-2">
                <SidebarLink href="#perfil" label="Acesso e segurança" />
                <SidebarLink href="#endereços" label="Seus endereços" />
                <SidebarLink href="/conta/pedidos" label="Pedidos e devolucoes" />
                <SidebarLink href="#listas" label="Listas e compras" />
                <SidebarLink href="#suporte" label="Atendimento ao cliente" />
              </div>
            </div>

            <div className="rounded-[1.8rem] border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">Ajuda rapida</h3>
              <div className="mt-4 space-y-3 text-sm">
                <InfoBlock icon={<Truck className="h-4 w-4 text-primary" />} label="Entrega e retirada" value="Regras e prazos seguem disponiveis na conta e no checkout." />
                <InfoBlock icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Políticas" value="Trocas, devolucoes e privacidade reunidas em um unico lugar." />
                <InfoBlock icon={<MapPin className="h-4 w-4 text-primary" />} label="Loja" value={`${STORE_INFO.address.street}, ${STORE_INFO.address.number} - ${STORE_INFO.address.neighborhood}`} />
              </div>
            </div>

            <div className="rounded-[1.8rem] border bg-card p-5 shadow-card">
              <h3 className="font-display text-xl font-bold">Comprar novamente</h3>
              <div className="mt-4 space-y-3">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="rounded-[1.2rem] bg-muted/45 p-4">
                    <p className="font-semibold">Pedido #{order.order_number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")} · R$ {Number(order.total).toFixed(2).replace(".", ",")}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link to="/conta/pedidos">Ver detalhes</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );

  function saveAndRefresh(nextProfile: ReturnType<typeof getCustomerProfile>) {
    saveCustomerProfile(nextProfile, user, nextProfile.email);
    setProfileVersion((value) => value + 1);
  }
}

function AccountStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border bg-card p-5 shadow-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function HubCard({
  icon,
  title,
  description,
  meta,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  meta: string;
  href: string;
}) {
  const isRoute = href.startsWith("/");

  const body = (
    <div className="group rounded-[1.5rem] border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">{icon}</div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-4 text-sm font-medium text-foreground">{meta}</p>
    </div>
  );

  if (isRoute) return <Link to={href}>{body}</Link>;
  return <a href={href}>{body}</a>;
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  const isRoute = href.startsWith("/");
  const content = (
    <span className="flex items-center justify-between rounded-2xl bg-muted/45 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted">
      {label}
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </span>
  );
  return isRoute ? <Link to={href}>{content}</Link> : <a href={href}>{content}</a>;
}

function InfoBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-muted/45 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-muted-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1.5 h-11" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
