import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Send,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { GamelQuoteCartLineControls } from "@/components/public/GamelQuoteCart";
import { GamelPublicLayout } from "@/components/public/GamelPublicLayout";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { useQuoteCart, type QuoteCartItem } from "@/context/QuoteCartContext";
import { gamelStoreInfo, getGamelWhatsAppUrl } from "@/data/gamel-site";

type QuoteLead = {
  leadRef: string;
  name: string;
  whatsapp: string;
  email: string;
  city: string;
  product: string;
  category: string;
  quantity: string;
  message: string;
  preference: string;
  createdAt: string;
  items?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string | null;
    notes: string | null;
  }>;
};

type QuoteSearch = {
  nome?: string;
  produto?: string;
  categoria?: string;
  aplicacao?: string;
};

const STORAGE_KEY = "gamel_quote_leads";

function createLeadRef() {
  return `GAMEL-${Date.now().toString().slice(-8)}`;
}

function readLeads(): QuoteLead[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as QuoteLead[];
  } catch {
    return [];
  }
}

function saveLead(lead: QuoteLead) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([lead, ...readLeads()].slice(0, 100)));
}

function buildSearchFallbackItem(search: QuoteSearch): QuoteCartItem | null {
  const productName = search.nome || search.produto;
  if (!productName) return null;

  return {
    id: `search:${productName}`,
    productId: search.produto || productName,
    productSlug: search.produto || productName,
    productName,
    sku: null,
    imageUrl: null,
    categoryName: search.categoria || search.aplicacao || null,
    quantity: 1,
    unit: null,
    notes: null,
  };
}

export const Route = createFileRoute("/orcamento")({
  validateSearch: (search: Record<string, unknown>) => ({
    nome: typeof search.nome === "string" && search.nome ? search.nome : undefined,
    produto: typeof search.produto === "string" && search.produto ? search.produto : undefined,
    categoria:
      typeof search.categoria === "string" && search.categoria ? search.categoria : undefined,
    aplicacao:
      typeof search.aplicacao === "string" && search.aplicacao ? search.aplicacao : undefined,
  }),
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Solicitar Orcamento` },
      {
        name: "description",
        content:
          "Solicite orcamento assistido da GAMEL Metal com produto, quantidade, cidade e contato comercial.",
      },
      { property: "og:url", content: absoluteUrl("/orcamento") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/orcamento") }],
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/carrinho", search });
  },
  component: OrcamentoPage,
});

function OrcamentoPage() {
  const search = Route.useSearch();
  const quoteCart = useQuoteCart();
  const fallbackItem = useMemo(() => buildSearchFallbackItem(search), [search]);
  const visibleItems =
    quoteCart.items.length > 0 ? quoteCart.items : fallbackItem ? [fallbackItem] : [];
  const isEditableCart = quoteCart.items.length > 0;
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
    product: search.nome || search.produto || "",
    category: search.categoria || search.aplicacao || "",
    quantity: "",
    message: search.nome
      ? `Tenho interesse em receber orientacao e cotacao para ${search.nome}.`
      : "",
    preference: "whatsapp",
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedLead, setSubmittedLead] = useState<QuoteLead | null>(null);

  const whatsappMessage = useMemo(() => {
    if (!submittedLead) return "";
    const itemLines = submittedLead.items?.length
      ? submittedLead.items.map(
          (item) =>
            `Item: ${item.quantity} ${item.unit || "un"} - ${item.productName}${
              item.notes ? ` (${item.notes})` : ""
            }`,
        )
      : [];
    return [
      "Ola, vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.",
      "",
      ...itemLines,
      submittedLead.product && itemLines.length === 0 ? `Produto: ${submittedLead.product}` : null,
      submittedLead.category ? `Categoria/aplicacao: ${submittedLead.category}` : null,
      submittedLead.quantity ? `Quantidade aproximada: ${submittedLead.quantity}` : null,
      `Nome: ${submittedLead.name}`,
      `Cidade: ${submittedLead.city}`,
      submittedLead.message ? `Mensagem: ${submittedLead.message}` : null,
      `Referencia: ${submittedLead.leadRef}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [submittedLead]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Informe seu nome.";
    if (!form.whatsapp.trim()) nextErrors.whatsapp = "Informe um WhatsApp para atendimento.";
    if (form.whatsapp.replace(/\D/g, "").length < 10) {
      nextErrors.whatsapp = "Informe um WhatsApp com DDD.";
    }
    if (!form.city.trim()) nextErrors.city = "Informe a cidade.";
    if (visibleItems.length === 0 && !form.product.trim() && !form.message.trim()) {
      nextErrors.product = "Informe um produto de interesse ou descreva a necessidade.";
    }
    if (!consent) nextErrors.consent = "Confirme o consentimento para contato comercial.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    const itemSummary = visibleItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    }));
    const productSummary =
      itemSummary.length > 0
        ? itemSummary.map((item) => item.productName).join(", ")
        : form.product.trim();
    const quantitySummary =
      itemSummary.length > 0
        ? itemSummary
            .map((item) => `${item.quantity} ${item.unit || "un"} de ${item.productName}`)
            .join("; ")
        : form.quantity.trim();

    const lead: QuoteLead = {
      leadRef: createLeadRef(),
      name: form.name.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      product: productSummary,
      category:
        form.category.trim() ||
        Array.from(new Set(visibleItems.map((item) => item.categoryName).filter(Boolean))).join(
          ", ",
        ),
      quantity: quantitySummary,
      message: form.message.trim(),
      preference: form.preference,
      createdAt: new Date().toISOString(),
      items: itemSummary,
    };

    saveLead(lead);
    setSubmittedLead(lead);
    if (quoteCart.items.length > 0) quoteCart.clearCart();
  };

  return (
    <GamelPublicLayout>
      <main className="shell-home py-12">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-brand p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Orcamento online
            </p>
            <h1 className="mt-4 font-display text-5xl leading-none md:text-7xl">
              Solicite atendimento comercial da GAMEL Metal.
            </h1>
            <p className="mt-5 text-sm leading-7 text-white/68">
              Envie produto, categoria, quantidade aproximada e cidade. A equipe comercial analisa a
              necessidade sem prometer preco, estoque, frete ou prazo automaticamente.
            </p>
            <div className="mt-6 rounded-md border border-white/10 bg-white/8 p-4 text-sm leading-7 text-white/70">
              Atendimento oficial: WhatsApp {gamelStoreInfo.whatsappDisplay}, telefones{" "}
              {gamelStoreInfo.phone} e e-mail {gamelStoreInfo.email}.
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-white p-5 shadow-sm md:p-6">
            {submittedLead ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                <h2 className="mt-4 font-display text-4xl">Orcamento registrado</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Referencia {submittedLead.leadRef}. Voce pode abrir o WhatsApp com os dados ja
                  preenchidos para acelerar o atendimento.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-md bg-action text-white hover:bg-accent">
                    <a
                      href={getGamelWhatsAppUrl(whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Enviar pelo WhatsApp
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="rounded-md">
                    <Link to="/produtos">Voltar ao catalogo</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <section className="rounded-lg border border-border/80 bg-muted/20 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-4">
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Itens selecionados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revise produtos, quantidades e observações antes do envio.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isEditableCart ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={quoteCart.clearCart}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Limpar
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" size="sm" className="rounded-md">
                        <Link to="/produtos">Adicionar produto</Link>
                      </Button>
                    </div>
                  </div>

                  {visibleItems.length === 0 ? (
                    <div className="m-4 rounded-md border border-dashed border-primary/30 bg-action/5 px-5 py-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ClipboardList className="h-6 w-6" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        Nenhum produto adicionado.
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">
                        Você ainda pode descrever a necessidade no formulário ou escolher produtos
                        no catálogo.
                      </p>
                    </div>
                  ) : (
                    <div className="grid divide-y bg-white">
                      {visibleItems.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-4 p-4 md:grid-cols-[88px_minmax(0,1fr)]"
                        >
                          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-base font-semibold leading-6">
                                  {item.productName}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {[item.sku ? `SKU ${item.sku}` : null, item.categoryName]
                                    .filter(Boolean)
                                    .join(" | ") || "Produto sob consulta"}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Disponibilidade e condições sob confirmação comercial.
                                </p>
                              </div>
                              {isEditableCart ? (
                                <GamelQuoteCartLineControls id={item.id} quantity={item.quantity} />
                              ) : (
                                <span className="rounded-md border px-3 py-2 text-sm font-semibold">
                                  {item.quantity} {item.unit || "un"}
                                </span>
                              )}
                            </div>
                            {isEditableCart ? (
                              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                <input
                                  placeholder="Observação deste item"
                                  value={item.notes ?? ""}
                                  onChange={(event) =>
                                    quoteCart.updateItem(item.id, { notes: event.target.value })
                                  }
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="justify-self-start text-destructive hover:text-destructive"
                                  onClick={() => quoteCart.removeItem(item.id)}
                                >
                                  <Trash2 className="mr-1.5 h-4 w-4" />
                                  Remover
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome" error={errors.name}>
                    <input
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Seu nome"
                    />
                  </Field>
                  <Field label="WhatsApp" error={errors.whatsapp}>
                    <input
                      value={form.whatsapp}
                      onChange={(event) => updateField("whatsapp", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="(87) 99999-9999"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="E-mail">
                    <input
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="email@empresa.com"
                    />
                  </Field>
                  <Field label="Cidade" error={errors.city}>
                    <input
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Cidade/UF"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Produto ou necessidade" error={errors.product}>
                    <input
                      value={form.product}
                      onChange={(event) => updateField("product", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Ex: ripado, forro PVC, ACM"
                    />
                  </Field>
                  <Field label="Categoria/aplicacao">
                    <input
                      value={form.category}
                      onChange={(event) => updateField("category", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Ex: fachada, teto, obra"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Quantidade aproximada">
                    <input
                      value={form.quantity}
                      onChange={(event) => updateField("quantity", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Medida, unidades, metros..."
                    />
                  </Field>
                  <Field label="Preferencia de contato">
                    <select
                      value={form.preference}
                      onChange={(event) => updateField("preference", event.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telefone">Telefone</option>
                      <option value="email">E-mail</option>
                    </select>
                  </Field>
                </div>

                <Field label="Mensagem">
                  <textarea
                    value={form.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Descreva onde sera aplicado, medidas, prazos e duvidas."
                  />
                </Field>

                <label className="flex gap-3 rounded-md border border-border bg-muted/25 p-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => {
                      setConsent(event.target.checked);
                      setErrors((current) => ({ ...current, consent: "" }));
                    }}
                    className="mt-1"
                  />
                  <span>
                    Autorizo a GAMEL a entrar em contato para atendimento comercial sobre esta
                    solicitacao.
                    {errors.consent ? (
                      <span className="mt-1 block text-xs font-semibold text-destructive">
                        {errors.consent}
                      </span>
                    ) : null}
                  </span>
                </label>

                <Button
                  type="submit"
                  className="h-12 rounded-md bg-action text-white hover:bg-accent"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Registrar orcamento
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>
    </GamelPublicLayout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground">
      {label}
      {children}
      {error ? <span className="text-xs font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}
