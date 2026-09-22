import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, CheckCircle2, ClipboardList, Copy, FileText, Loader2, MessageCircle, Minus, Plus, Send, ShoppingCart, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STORE_INFO, getWhatsAppUrl } from "@/constants/store";
import { emit } from "@/data/events/eventBus";
import { addToOutbox } from "@/data/events/outbox";
import { getPageContext } from "@/data/events/utmTracking";
import type { LeadCreatedPayload, QuoteSubmittedPayload } from "@/domain/types";
import { apiFetch, resolveApiInput } from "@/lib/api";
import { useQuoteCart, type QuoteCartItem } from "@/contexts/QuoteCartContext";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { useCompanyLookup } from "@/hooks/useCompanyLookup";

type QuoteRequestResponse = {
  request: {
    id: string;
    protocol: string;
    status: string;
    createdAt: string;
    accessToken: string;
    marketingConsent: boolean;
  };
  itemsAccepted: number;
  duplicate: boolean;
  whatsappHandoff: {
    enabled: boolean;
    message: string;
  };
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `quote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildUrlFallbackItem(searchParams: URLSearchParams): QuoteCartItem | null {
  const slug = searchParams.get("produto") || "";
  const name = searchParams.get("nome") || "";
  if (!slug && !name) return null;
  return {
    id: `url:${slug || name}`,
    productId: slug || "sob-consulta",
    productSlug: slug || "sob-consulta",
    productName: name || "Produto sob consulta",
    sku: null,
    imageUrl: null,
    categoryName: searchParams.get("categoria") || null,
    variantId: null,
    variantLabel: null,
    quantity: Number(searchParams.get("quantidade") || 1) || 1,
    unit: "un",
    notes: null,
  };
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8), digits.slice(8, 12), digits.slice(12, 14)].filter(Boolean);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${parts[0]}.${parts[1]}`;
  if (digits.length <= 8) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (digits.length <= 12) return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}`;
  return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}-${parts[4]}`;
}

function buildBusinessContext(form: Record<string, string>, attachmentName: string) {
  const context = [
    ["Tipo de atendimento", "Cotação B2B"], ["Função", form.role], ["Obra ou projeto", form.project],
    ["CEP de entrega", form.deliveryZip], ["Prazo desejado", form.deadline], ["Previsão de compra", form.purchaseForecast], ["Referência de arquivo", attachmentName],
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n");
  return [context, form.message.trim()].filter(Boolean).join("\n\n");
}

export default function Quote() {
  const [searchParams] = useSearchParams();
  const quoteCart = useQuoteCart();
  const fallbackItem = useMemo(() => buildUrlFallbackItem(searchParams), [searchParams]);
  const visibleItems = quoteCart.items.length > 0 ? quoteCart.items : fallbackItem ? [fallbackItem] : [];
  const isEditableCart = quoteCart.items.length > 0;
  const selectedUnits = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCategories = new Set(visibleItems.map((item) => item.categoryName).filter(Boolean)).size;
  const isBusinessRequest = searchParams.get("tipo") === "empresa";
  const { lookupCnpj, loading: companyLookupLoading, error: companyLookupError } = useCompanyLookup();
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    company: "",
    cnpj: "",
    segment: "",
    role: "",
    project: "",
    deliveryZip: "",
    deadline: "",
    purchaseForecast: "",
    city: "",
    state: "PE",
    message: searchParams.get("nome") ? `Tenho interesse em receber orientação para ${searchParams.get("nome")}.` : "",
    preference: "whatsapp",
  });
  const [consent, setConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<QuoteRequestResponse | null>(null);
  const [submitNotice, setSubmitNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const stateTouchedRef = useRef(false);

  const updateField = (field: keyof typeof form, value: string) => {
    if (field === "state") stateTouchedRef.current = true;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Informe seu nome.";
    if (form.whatsapp.replace(/\D/g, "").length < 10) nextErrors.whatsapp = "Informe um WhatsApp com DDD.";
    if (!form.city.trim()) nextErrors.city = "Informe a cidade.";
    if (!/^[A-Z]{2}$/.test(form.state.trim().toUpperCase())) nextErrors.state = "Informe a UF.";
    if (form.cnpj.replace(/\D/g, "").length !== 14) nextErrors.cnpj = "Informe o CNPJ da empresa.";
    if (visibleItems.length === 0) nextErrors.items = "Adicione ao menos um produto para solicitar orçamento.";
    if (isBusinessRequest && !form.company.trim()) nextErrors.company = "Informe a empresa para a cotação B2B.";
    if (!consent) nextErrors.consent = "Confirme o consentimento para contato comercial.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitNotice("");
    const pageContext = getPageContext();

    try {
      const response = await apiFetch<QuoteRequestResponse>("/api/quote-requests", {
        method: "POST",
        body: JSON.stringify({
          customer: {
            name: form.name,
            whatsapp: form.whatsapp,
            email: form.email || null,
            company: form.company || null,
            cnpj: form.cnpj || null,
            segment: form.segment || null,
            city: form.city,
            state: form.state || null,
          },
          items: visibleItems.map((item) => ({
            productId: item.productId,
            productVariantId: item.variantId,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          })),
          message: isBusinessRequest ? buildBusinessContext(form, attachmentName) : form.message || null,
          preference: form.preference,
          pageOrigin: pageContext.page_url,
          utm: pageContext.utm,
          privacyPolicyVersion: "2026-07",
          consent,
          marketingConsent,
          idempotencyKey: createIdempotencyKey(),
        }),
      });

      if (FEATURE_FLAGS.events) {
        const leadPayload: LeadCreatedPayload = {
          channel: "form",
          name: form.name,
          email: form.email || undefined,
          phone: form.whatsapp,
          lead_produto_interesse: visibleItems.map((item) => item.productName).join(", "),
          lead_pagina_origem: pageContext.page_url,
          utm: pageContext.utm,
          context: { page_url: pageContext.page_url, referrer: pageContext.referrer },
        };
        const quotePayload: QuoteSubmittedPayload = {
          lead_ref: response.request.protocol,
          quote_number: response.request.protocol,
          customer_name: form.name,
          customer_email: form.email || undefined,
          customer_phone: form.whatsapp,
          lead_produto_interesse: visibleItems.map((item) => item.productName).join(", "),
          lead_pagina_origem: pageContext.page_url,
          city: form.city,
          category: visibleItems.map((item) => item.categoryName).filter(Boolean).join(", "),
          quantity: String(visibleItems.reduce((sum, item) => sum + item.quantity, 0)),
          message: isBusinessRequest ? buildBusinessContext(form, attachmentName) : form.message,
          preference: form.preference,
        };
        addToOutbox(emit("lead.created", leadPayload));
        addToOutbox(emit("quote.submitted", quotePayload));
      }

      setSubmitted(response);
      if (quoteCart.items.length > 0) quoteCart.clearCart();
    } catch {
      setSubmitNotice("Não foi possível concluir o envio neste momento. Seus produtos continuam salvos. Tente novamente ou fale com nossa equipe pelo WhatsApp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyProtocol = async () => {
    if (!submitted?.request.protocol) return;
    try {
      await navigator.clipboard.writeText(submitted.request.protocol);
      setSubmitNotice("Protocolo copiado.");
    } catch {
      setSubmitNotice(`Protocolo: ${submitted.request.protocol}`);
    }
  };

  const whatsappMessage = submitted?.whatsappHandoff.message || [
    "Ola, vim pelo site da GAMEL Metal e gostaria de solicitar um orçamento.",
    ...visibleItems.map((item) => `Item: ${item.quantity} ${item.unit || "un"} - ${item.productName}`),
    isBusinessRequest ? buildBusinessContext(form, attachmentName) : (form.message ? `Mensagem: ${form.message}` : null),
  ].filter(Boolean).join("\n");

  const handleCnpjLookup = async () => {
    const result = await lookupCnpj(form.cnpj);
    if (!result?.ok) return;
    setForm((current) => ({ ...current, company: current.company || result.tradeName || result.legalName, city: current.city || result.address.city, state: stateTouchedRef.current ? current.state : result.address.state || current.state, email: current.email || result.email }));
  };

  return (
    <Layout>
      <main className="shell-wide max-w-[1440px] py-5 md:py-7">
        {submitted ? (
          <section className="rounded-lg border border-border/80 bg-white px-5 py-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h1 className="mt-4 font-display text-4xl">Solicitação enviada com sucesso</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              Protocolo {submitted.request.protocol}. Nossa equipe comercial analisara os produtos selecionados e entrara em contato para apresentar preços, condições e disponibilidade.
            </p>
            {submitNotice ? <p className="mt-3 text-xs text-muted-foreground">{submitNotice}</p> : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button type="button" variant="outline" onClick={() => void copyProtocol()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar protocolo
              </Button>
              <Button asChild>
                <a href={getWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={resolveApiInput(`/api/quote-requests/${submitted.request.id}/pdf?token=${encodeURIComponent(submitted.request.accessToken)}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Baixar PDF da solicitação
                </a>
              </Button>
              <Button asChild variant="outline"><Link to="/produtos">Voltar ao catalogo</Link></Button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="flex flex-col gap-3 rounded-lg bg-[#050505] px-5 py-5 text-white shadow-[0_22px_60px_-42px_rgba(0,0,0,0.9)] md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6417]">{isBusinessRequest ? "Cotação B2B" : "Carrinho de orçamento"}</p>
                <h1 className="mt-2 font-display text-4xl leading-none md:text-5xl">{isBusinessRequest ? "Cotação para empresa ou obra" : "Meu orçamento"}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
                  {isBusinessRequest ? "Inclua o contexto da obra para a equipe analisar prazo, entrega e condições comerciais." : "Revise produtos, informe seus dados e envie uma solicitação para atendimento comercial da GAMEL."}
                </p>
              </div>
              <Button asChild variant="outline" className="h-10 rounded-md border-white/18 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/produtos">Continuar no catalogo</Link>
              </Button>
            </div>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="grid min-w-0 gap-5">
                <div className="rounded-lg border border-border/80 bg-[#f7f3ee] p-3 md:p-4">
                  <div className="grid gap-2 text-sm md:grid-cols-3">
                    <div className="rounded-md border border-primary/20 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Etapa 1</p>
                      <p className="mt-1 font-semibold text-foreground">Produtos</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Etapa 2</p>
                      <p className="mt-1 font-semibold text-foreground">Dados de contato</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Etapa 3</p>
                      <p className="mt-1 font-semibold text-foreground">Envio seguro</p>
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border border-border/80 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 md:px-5">
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Itens selecionados
                      </p>
                      <p className="text-xs text-muted-foreground">Revise quantidades e observacoes antes do envio.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isEditableCart ? (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={quoteCart.clearCart}>
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Limpar
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" size="sm"><Link to="/produtos">Adicionar produto</Link></Button>
                    </div>
                  </div>
                  {errors.items ? <p className="px-4 pt-3 text-xs text-destructive md:px-5">{errors.items}</p> : null}
                  <div className="grid divide-y">
                    {visibleItems.length === 0 ? (
                      <div className="m-4 rounded-md border border-dashed border-primary/30 bg-[#fffaf4] px-5 py-10 text-center md:m-5">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <ClipboardList className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">Nenhum produto adicionado.</p>
                        <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">
                          Escolha produtos no catálogo para a equipe comercial receber uma solicitação completa.
                        </p>
                        <Button asChild className="mt-4 rounded-md" size="sm"><Link to="/produtos">Escolher produtos</Link></Button>
                      </div>
                    ) : visibleItems.map((item) => (
                      <div key={item.id} className="grid gap-4 p-4 md:grid-cols-[96px_minmax(0,1fr)] md:p-5">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-contain" /> : <ShoppingCart className="h-7 w-7 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-base font-semibold leading-6">{item.productName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{[item.sku ? `SKU ${item.sku}` : null, item.categoryName, item.variantLabel].filter(Boolean).join(" | ") || "Produto sob consulta"}</p>
                              <p className="mt-2 text-xs text-emerald-700">Disponibilidade e condições sob confirmação comercial.</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => quoteCart.updateItem(item.id, { quantity: item.quantity - 1 })} disabled={!isEditableCart}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                value={item.quantity}
                                type="number"
                                min={1}
                                className="h-8 w-16 text-center"
                                onChange={(event) => quoteCart.updateItem(item.id, { quantity: Number(event.target.value || 1) })}
                                disabled={!isEditableCart}
                              />
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => quoteCart.updateItem(item.id, { quantity: item.quantity + 1 })} disabled={!isEditableCart}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <Input
                              placeholder="Observacao deste item"
                              value={item.notes ?? ""}
                              onChange={(event) => quoteCart.updateItem(item.id, { notes: event.target.value })}
                              disabled={!isEditableCart}
                            />
                            <Button type="button" variant="ghost" size="sm" className="justify-self-start text-destructive hover:text-destructive" onClick={() => quoteCart.removeItem(item.id)} disabled={!isEditableCart}>
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {fallbackItem && !isEditableCart ? (
                    <p className="mx-4 mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 md:mx-5">
                      Este item veio de um link antigo. Para editar livremente, adicione produtos pelo catálogo.
                    </p>
                  ) : null}
                </section>

                <section className="rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
                  <div className="mb-4">
                    <p className="text-base font-semibold">Dados para retorno comercial</p>
                    <p className="text-xs text-muted-foreground">{isBusinessRequest ? "Informe o contexto da compra para receber um retorno comercial mais preciso." : "Somente os campos essenciais são obrigatórios."}</p>
                  </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" value={form.name} onChange={(event) => updateField("name", event.target.value)} className="mt-1.5" />
                    {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp *</Label>
                    <Input id="whatsapp" value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} className="mt-1.5" />
                    {errors.whatsapp ? <p className="mt-1 text-xs text-destructive">{errors.whatsapp}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="email">E-mail opcional</Label>
                    <Input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="company">Empresa {isBusinessRequest ? "*" : ""}</Label>
                    <Input id="company" value={form.company} onChange={(event) => updateField("company", event.target.value)} className="mt-1.5" />
                    {errors.company ? <p className="mt-1 text-xs text-destructive">{errors.company}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} className="mt-1.5" />
                    {errors.city ? <p className="mt-1 text-xs text-destructive">{errors.city}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="state">UF *</Label>
                    <Input id="state" value={form.state} onChange={(event) => updateField("state", event.target.value.toUpperCase().slice(0, 2))} className="mt-1.5" />
                    {errors.state ? <p className="mt-1 text-xs text-destructive">{errors.state}</p> : null}
                  </div>
                  <div>
                    <Label>Preferencia</Label>
                    <Select value={form.preference} onValueChange={(value) => updateField("preference", value)}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="cnpj">CNPJ da empresa *</Label>
                    <div className="mt-1.5 flex gap-2"><Input id="cnpj" value={form.cnpj} onChange={(event) => updateField("cnpj", formatCnpj(event.target.value))} onBlur={() => void handleCnpjLookup()} /><Button type="button" variant="outline" className="shrink-0" onClick={() => void handleCnpjLookup()} disabled={companyLookupLoading || form.cnpj.replace(/\D/g, "").length !== 14}>{companyLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}</Button></div>
                    {errors.cnpj ? <p className="mt-1 text-xs text-destructive">{errors.cnpj}</p> : null}
                    {companyLookupError && form.cnpj.replace(/\D/g, "").length === 14 ? <p className="mt-1 text-xs text-muted-foreground">{companyLookupError}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="segment">Segmento</Label>
                    <Input id="segment" value={form.segment} onChange={(event) => updateField("segment", event.target.value)} className="mt-1.5" />
                  </div>
                </div>

                {isBusinessRequest ? <section className="mt-5 rounded-lg border border-primary/20 bg-[#fffaf4] p-4 md:p-5">
                  <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div><p className="font-semibold">Contexto da compra</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Essas informações orientam a análise; preço, frete e prazo serão confirmados pelo comercial.</p></div></div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div><Label htmlFor="role">Sua função</Label><Select value={form.role} onValueChange={(value) => updateField("role", value)}><SelectTrigger id="role" className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Compras">Compras</SelectItem><SelectItem value="Engenharia ou obra">Engenharia ou obra</SelectItem><SelectItem value="Arquitetura ou especificação">Arquitetura ou especificação</SelectItem><SelectItem value="Revenda">Revenda</SelectItem><SelectItem value="Instalação">Instalação</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></div>
                    <div><Label htmlFor="project">Nome da obra ou projeto</Label><Input id="project" value={form.project} onChange={(event) => updateField("project", event.target.value)} className="mt-1.5" placeholder="Ex.: Reforma loja centro" /></div>
                    <div><Label htmlFor="deliveryZip">CEP de entrega</Label><Input id="deliveryZip" value={form.deliveryZip} onChange={(event) => updateField("deliveryZip", event.target.value.replace(/\D/g, "").slice(0, 8))} className="mt-1.5" placeholder="Somente números" /></div>
                    <div><Label htmlFor="deadline">Prazo desejado</Label><Input id="deadline" value={form.deadline} onChange={(event) => updateField("deadline", event.target.value)} className="mt-1.5" placeholder="Ex.: até 15/09" /></div>
                    <div><Label htmlFor="purchaseForecast">Previsão de compra</Label><Select value={form.purchaseForecast} onValueChange={(value) => updateField("purchaseForecast", value)}><SelectTrigger id="purchaseForecast" className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Imediata">Imediata</SelectItem><SelectItem value="Em até 30 dias">Em até 30 dias</SelectItem><SelectItem value="Em 30 a 60 dias">Em 30 a 60 dias</SelectItem><SelectItem value="Em mais de 60 dias">Em mais de 60 dias</SelectItem></SelectContent></Select></div>
                    <div><Label htmlFor="attachment">Referência de lista ou projeto</Label><div className="mt-1.5 flex items-center gap-2"><Input id="attachment" type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,image/*" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name || "")} /><FileText className="h-4 w-4 shrink-0 text-primary" /></div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">O nome do arquivo seguirá na solicitação. Após o protocolo, envie o arquivo pelo WhatsApp usando o mesmo número.</p></div>
                  </div>
                </section> : null}

                <div>
                  <Label htmlFor="message">Mensagem geral</Label>
                  <Textarea id="message" value={form.message} onChange={(event) => updateField("message", event.target.value)} className="mt-1.5 min-h-24" />
                </div>
                </section>

                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm leading-6 text-amber-950">
                    Está solicitação não representa pedido confirmado, reserva de estoque ou garantia de preço. Valores, condições, prazos e disponibilidade serao confirmados pela equipe comercial da GAMEL.
                  </p>
                  <div className="mt-4 flex items-start gap-3 rounded-md bg-white/70 p-3">
                    <Checkbox id="consent" checked={consent} onCheckedChange={(value) => {
                      setConsent(Boolean(value));
                      setErrors((current) => ({ ...current, consent: "" }));
                    }} />
                    <Label htmlFor="consent" className="text-sm font-normal leading-6 text-amber-950">
                      Autorizo o uso dos meus dados para retorno comercial relacionado a está solicitação.
                    </Label>
                  </div>
                  {errors.consent ? <p className="mt-2 text-xs text-destructive">{errors.consent}</p> : null}

                  <div className="mt-3 flex items-start gap-3 rounded-md bg-white/70 p-3">
                    <Checkbox id="marketingConsent" checked={marketingConsent} onCheckedChange={(value) => setMarketingConsent(Boolean(value))} />
                    <Label htmlFor="marketingConsent" className="text-sm font-normal leading-6 text-amber-950">
                      Autorizo a GAMEL a me enviar catálogo, novidades e ofertas por e-mail e telefone/WhatsApp comercial.
                      <span className="mt-1 block text-xs text-amber-800/80">Opcional — marcando esta opção, você também libera o download imediato do PDF da solicitação.</span>
                    </Label>
                  </div>
                </section>

                {submitNotice ? <p className="text-xs text-amber-700">{submitNotice}</p> : null}
              </div>

              <aside className="xl:sticky xl:top-28 xl:self-start">
                <div className="rounded-lg border border-border/80 bg-white p-5 shadow-sm">
                  <p className="text-lg font-semibold">Resumo da solicitação</p>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Linhas</span>
                      <strong>{visibleItems.length}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Unidades</span>
                      <strong>{selectedUnits}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categorias</span>
                      <strong>{selectedCategories}</strong>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
                    Sem valores nesta etapa. A equipe GAMEL confirma preço, prazo, disponibilidade e condições no atendimento.
                  </div>
                  <Button type="submit" className="mt-4 h-12 w-full rounded-md text-base" disabled={isSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Enviando..." : "Enviar solicitação"}
                  </Button>
                  <Button asChild variant="outline" className="mt-2 h-10 w-full rounded-md">
                    <Link to="/produtos">Adicionar mais produtos</Link>
                  </Button>
                </div>

                <div className="mt-4 rounded-lg border border-border/80 bg-[#050505] p-5 text-sm leading-6 text-white shadow-sm">
                  <p className="font-semibold">Atendimento oficial</p>
                  <p className="mt-2 text-white/72">WhatsApp {STORE_INFO.whatsappDisplay}</p>
                  <p className="break-words text-white/72">{STORE_INFO.email}</p>
                </div>
              </aside>
            </section>
          </form>
        )}
      </main>
    </Layout>
  );
}
