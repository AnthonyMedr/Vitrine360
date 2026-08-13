import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageCircle,
  Send,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { GamelQuoteCartLineControls } from "@/components/public/GamelQuoteCart";
import { GamelPublicLayout } from "@/components/public/GamelPublicLayout";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { useQuoteCart } from "@/context/QuoteCartContext";
import { getGamelWhatsAppUrl } from "@/data/gamel-site";

type QuoteLead = {
  leadRef: string;
  name: string;
  whatsapp: string;
  email: string;
  product: string;
  category: string;
  quantity: string;
  city: string;
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

export const Route = createFileRoute("/carrinho")({
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
      { title: `${brandConfig.productName} | Carrinho de Cotacao` },
      {
        name: "description",
        content:
          "Carrinho de cotacao GAMEL para revisar produtos selecionados e acompanhar solicitacoes comerciais.",
      },
      { property: "og:url", content: absoluteUrl("/carrinho") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/carrinho") }],
  }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const search = Route.useSearch();
  const quoteCart = useQuoteCart();
  const [leads, setLeads] = useState<QuoteLead[]>([]);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
    product: search.nome || search.produto || "",
    message: search.nome ? `Tenho interesse em receber cotacao para ${search.nome}.` : "",
    preference: "whatsapp",
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedLead, setSubmittedLead] = useState<QuoteLead | null>(null);

  useEffect(() => {
    setLeads(readLeads());
  }, []);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Informe seu nome.";
    if (form.whatsapp.replace(/\D/g, "").length < 10) {
      nextErrors.whatsapp = "Informe um WhatsApp com DDD.";
    }
    if (!form.city.trim()) nextErrors.city = "Informe a cidade.";
    if (quoteCart.items.length === 0 && !form.product.trim() && !form.message.trim()) {
      nextErrors.product = "Informe um produto ou descreva a necessidade.";
    }
    if (!consent) nextErrors.consent = "Confirme o consentimento para contato comercial.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const items = quoteCart.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    }));

    const lead: QuoteLead = {
      leadRef: createLeadRef(),
      name: form.name.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      product: items.length
        ? items.map((item) => item.productName).join(", ")
        : form.product.trim(),
      category: Array.from(
        new Set(quoteCart.items.map((item) => item.categoryName).filter(Boolean)),
      ).join(", "),
      quantity: items.length
        ? items
            .map((item) => `${item.quantity} ${item.unit || "un"} de ${item.productName}`)
            .join("; ")
        : "",
      message: form.message.trim(),
      preference: form.preference,
      createdAt: new Date().toISOString(),
      items,
    };

    saveLead(lead);
    setLeads([lead, ...leads].slice(0, 100));
    setSubmittedLead(lead);
    if (quoteCart.items.length > 0) quoteCart.clearCart();
  };

  const whatsappMessage = submittedLead
    ? [
        "Ola, vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.",
        "",
        ...(submittedLead.items || []).map(
          (item) =>
            `Item: ${item.quantity} ${item.unit || "un"} - ${item.productName}${
              item.notes ? ` (${item.notes})` : ""
            }`,
        ),
        submittedLead.product && !submittedLead.items?.length
          ? `Produto: ${submittedLead.product}`
          : null,
        `Nome: ${submittedLead.name}`,
        `Cidade: ${submittedLead.city}`,
        submittedLead.message ? `Mensagem: ${submittedLead.message}` : null,
        `Referencia: ${submittedLead.leadRef}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <GamelPublicLayout>
      <main className="shell-home py-12">
        <section className="rounded-lg bg-brand p-6 text-white md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Carrinho de cotacao
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-none md:text-7xl">
            Revise os produtos antes de enviar para a GAMEL.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/68">
            O carrinho organiza itens de interesse para orçamento assistido. Preço, estoque, frete,
            prazo e condições continuam sob validação da equipe comercial.
          </p>
        </section>

        <section className="mt-8 rounded-lg border border-border/80 bg-white p-6 shadow-sm">
          {quoteCart.items.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-primary" />
              <h2 className="mt-4 font-display text-4xl">Seu carrinho de orçamento está vazio</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Escolha produtos no catálogo para montar uma solicitação completa para o comercial.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild className="rounded-md bg-action text-white hover:bg-accent">
                  <Link to="/produtos">
                    Ver catalogo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-md">
                  <a href="#dados-atendimento">Solicitar sem produtos</a>
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {quoteCart.totalLines} produto(s) | {quoteCart.totalItems} unidade(s)
                  </p>
                  <h2 className="font-display text-4xl">Itens selecionados</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="rounded-md">
                    <Link to="/produtos">Adicionar mais</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-md text-destructive hover:text-destructive"
                    onClick={quoteCart.clearCart}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                  <Button asChild className="rounded-md bg-action text-white hover:bg-accent">
                    <a href="#dados-atendimento">
                      Enviar carrinho
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3">
                {quoteCart.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-white">
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
                        <p className="line-clamp-2 font-display text-2xl">{item.productName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[item.sku ? `SKU ${item.sku}` : null, item.categoryName]
                            .filter(Boolean)
                            .join(" | ") || "Produto sob consulta"}
                        </p>
                        <input
                          placeholder="Observação para este item"
                          value={item.notes ?? ""}
                          onChange={(event) =>
                            quoteCart.updateItem(item.id, { notes: event.target.value })
                          }
                          className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 md:flex-col md:items-end">
                        <GamelQuoteCartLineControls id={item.id} quantity={item.quantity} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => quoteCart.removeItem(item.id)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section
          id="dados-atendimento"
          className="mt-8 rounded-lg border border-border/80 bg-white p-6 shadow-sm"
        >
          {submittedLead ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
              <h2 className="mt-4 font-display text-4xl">Carrinho enviado</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Referencia {submittedLead.leadRef}. Voce pode abrir o WhatsApp com os dados ja
                preenchidos para acelerar o atendimento comercial.
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Dados para atendimento
                </p>
                <h2 className="mt-2 font-display text-4xl">Enviar carrinho para a GAMEL</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Informe o contato para a equipe comercial retornar com preco, disponibilidade,
                  prazo e condicoes.
                </p>
              </div>

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

              {quoteCart.items.length === 0 ? (
                <Field label="Produto ou necessidade" error={errors.product}>
                  <input
                    value={form.product}
                    onChange={(event) => updateField("product", event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Ex: ripado, forro PVC, ACM"
                  />
                </Field>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
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
                <Field label="Mensagem">
                  <input
                    value={form.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Medidas, prazo, aplicacao ou duvidas"
                  />
                </Field>
              </div>

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
                  Autorizo a GAMEL a entrar em contato para atendimento comercial sobre este
                  carrinho.
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
                Enviar carrinho
              </Button>
            </form>
          )}
        </section>

        {leads.length > 0 ? (
          <section className="mt-8 rounded-lg border border-border/80 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Histórico local
              </p>
              <h2 className="font-display text-4xl">Cotações recentes</h2>
            </div>
            <div className="grid gap-3">
              {leads.slice(0, 6).map((lead) => (
                <article
                  key={lead.leadRef}
                  className="rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        <FileText className="h-4 w-4" />
                        {lead.leadRef}
                      </p>
                      <h3 className="mt-2 font-display text-2xl">
                        {lead.product || lead.category || "Solicitação comercial"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lead.quantity || "Quantidade sob consulta"} -{" "}
                        {lead.city || "Cidade nao informada"}
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      Em análise comercial
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </GamelPublicLayout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground">
      {label}
      {children}
      {error ? <span className="text-xs font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}
