import { Link, useParams } from "react-router-dom";
import { Copy, FileText, MessageCircle, RefreshCw, Save } from "lucide-react";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch, resolveApiInput } from "@/lib/api";
import { getWhatsAppUrl } from "@/constants/store";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

type QuoteRequestDetail = {
  request: {
    id: string;
    protocol: string;
    status: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    company_name: string | null;
    cnpj: string | null;
    segment: string | null;
    city: string;
    state: string | null;
    contact_preference: string;
    message: string | null;
    page_origin: string;
    utm_json: Record<string, string | null>;
    responsible_name: string | null;
    next_action: string | null;
    next_action_due_at: string | null;
    lost_reason: string | null;
    archived_at: string | null;
    consent_recorded_at: string | null;
    marketing_consent: boolean;
    created_at: string;
  };
  items: Array<{
    id: string;
    product_name_snapshot: string;
    sku_snapshot: string | null;
    variant_label_snapshot: string | null;
    image_url_snapshot: string | null;
    quantity: number;
    unit: string | null;
    notes: string | null;
    calculation_snapshot_json: Record<string, unknown> | null;
  }>;
  history: Array<{ id: string; from_status: string | null; to_status: string; note: string | null; actor_name: string; created_at: string }>;
  notes: Array<{ id: string; note: string; actor_name: string; created_at: string }>;
  source: "quote_request_v2" | "legacy_quote";
};

const statuses = [
  ["new", "Novo"],
  ["triage", "Em triagem"],
  ["contacted", "Em atendimento"],
  ["waiting_customer", "Aguardando cliente"],
  ["negotiating", "Em negociação"],
  ["converted", "Convertido"],
  ["lost", "Perdido"],
  ["archived", "Arquivado"],
];

export default function AdminQuoteRequestDetail() {
  const { id = "" } = useParams();
  const { isAdmin } = useAdmin();
  const resource = useAdminResource<QuoteRequestDetail | null>(isAdmin && id ? `/api/admin/quote-requests/${id}` : null, null);
  const [statusNote, setStatusNote] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDueAt, setNextActionDueAt] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (resource.loading) return <AdminLoadingState label="Carregando detalhe do orçamento..." />;
  if (!resource.data) {
    return (
      <AdminWorkspaceShell title="Orçamento não encontrado" eyebrow="M1 essencial" actions={<Button asChild variant="outline"><Link to="/admin/orcamentos">Voltar</Link></Button>}>
        <p className="text-sm text-muted-foreground">A solicitacao nao foi localizada na leitura atual.</p>
      </AdminWorkspaceShell>
    );
  }

  const detail = resource.data;
  const request = detail.request;
  const isLegacy = detail.source === "legacy_quote";
  const whatsapp = getWhatsAppUrl(`Ola, vim falar sobre o protocolo ${request.protocol} da GAMEL Metal.`);
  const copySummary = () => {
    const summary = [
      `Protocolo: ${request.protocol}`,
      `Cliente: ${request.customer_name}`,
      `Empresa: ${request.company_name || "-"}`,
      `WhatsApp: ${request.customer_phone}`,
      `Cidade/UF: ${request.city}${request.state ? `/${request.state}` : ""}`,
      "Itens:",
      ...detail.items.map((item) => `- ${item.quantity} ${item.unit || "un"} | ${item.product_name_snapshot}${item.variant_label_snapshot ? ` | ${item.variant_label_snapshot}` : ""}${item.notes ? ` | Obs: ${item.notes}` : ""}`),
    ].join("\n");
    void navigator.clipboard?.writeText(summary);
  };
  const whatsappTemplates = [
    {
      label: "Primeiro contato",
      message: `Ola, ${request.customer_name}. Recebemos sua solicitação ${request.protocol} pelo site da GAMEL Metal. Vou conferir os produtos selecionados e te retorno com preço, disponibilidade e condições.`,
    },
    {
      label: "Pedir detalhe",
      message: `Ola, ${request.customer_name}. Sobre o protocolo ${request.protocol}, você pode me confirmar medidas, local de aplicação e quantidade aproximada para seguirmos com o atendimento?`,
    },
    {
      label: "Retomar conversa",
      message: `Ola, ${request.customer_name}. Passando para dar continuidade ao atendimento da solicitação ${request.protocol} da GAMEL Metal.`,
    },
  ];

  const updateStatus = async (status: string) => {
    if (isLegacy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/quote-requests/${request.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: statusNote }),
      });
      setStatusNote("");
      await resource.reload();
    } catch (error) {
      toast({ title: "Falha ao atualizar status", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const assignResponsible = async () => {
    if (isLegacy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/quote-requests/${request.id}/responsible`, {
        method: "PATCH",
        body: JSON.stringify({ responsible_name: responsibleName || null }),
      });
      setResponsibleName("");
      await resource.reload();
    } catch (error) {
      toast({ title: "Falha ao atribuir responsável", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (isLegacy || !internalNote.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/quote-requests/${request.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: internalNote }),
      });
      setInternalNote("");
      await resource.reload();
    } catch (error) {
      toast({ title: "Falha ao salvar observação", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateNextAction = async () => {
    if (isLegacy || !nextAction.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/quote-requests/${request.id}/next-action`, {
        method: "PATCH",
        body: JSON.stringify({ next_action: nextAction, next_action_due_at: nextActionDueAt || null }),
      });
      setNextAction("");
      setNextActionDueAt("");
      await resource.reload();
    } catch (error) {
      toast({ title: "Falha ao salvar próxima ação", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminWorkspaceShell
      title={`Orçamento ${request.protocol}`}
      eyebrow="Solicitação publica"
      description="Detalhe operacional da solicitação. Convertido não significa venda, faturamento ou pedido."
      actions={<><Button asChild variant="outline"><Link to="/admin/orcamentos">Voltar</Link></Button><Button variant="outline" onClick={copySummary}><Copy className="mr-2 h-4 w-4" />Copiar dados</Button><Button variant="outline" onClick={() => void resource.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>{!isLegacy ? <Button asChild variant="outline"><a href={resolveApiInput(`/api/admin/quote-requests/${request.id}/pdf`)} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Baixar PDF</a></Button> : null}<Button asChild><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button></>}
    >
      {isLegacy ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Registro legado em dual-read. Para editar status, use registros M1 V2 ou execute backfill.</div> : null}
      <div className="grid gap-3 md:grid-cols-5">
        <WorkspaceMetric label="Protocolo" value={request.protocol} detail="Referencia comercial" tone="ok" />
        <WorkspaceMetric label="Status" value={statuses.find(([value]) => value === request.status)?.[1] || request.status} detail="M1 essencial" tone={request.status === "lost" ? "danger" : request.status === "new" ? "warn" : "ok"} />
        <WorkspaceMetric label="Itens" value={detail.items.length} detail={`${detail.items.reduce((sum, item) => sum + item.quantity, 0)} unidade(s)`} tone="ok" />
        <WorkspaceMetric label="Responsável" value={request.responsible_name || "Sem responsável"} detail="Atendimento" tone={request.responsible_name ? "ok" : "warn"} />
        <WorkspaceMetric label="Contato comercial" value={request.marketing_consent ? "Autorizado" : "Não autorizado"} detail="Catálogo, novidades e ofertas" tone={request.marketing_consent ? "ok" : "warn"} />
      </div>

      <WorkspaceSection title="Próxima acao">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs uppercase text-muted-foreground">Acao registrada</p>
            <p className="mt-1 font-medium">{request.next_action || "Sem próxima acao definida"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {request.next_action_due_at ? `Prazo sugerido: ${new Date(request.next_action_due_at).toLocaleString("pt-BR")}` : "Defina uma acao para organizar o atendimento comercial."}
            </p>
          </div>
          <div className="grid gap-2">
            <Input placeholder="Ex.: Enviar retorno pelo WhatsApp" value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={isLegacy} />
            <div className="flex gap-2">
              <Input type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} disabled={isLegacy} />
              <Button type="button" onClick={() => void updateNextAction()} disabled={busy || isLegacy || !nextAction.trim()}>Salvar</Button>
            </div>
          </div>
        </div>
      </WorkspaceSection>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <WorkspaceSection title="Solicitante">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Nome" value={request.customer_name} />
            <Info label="WhatsApp" value={request.customer_phone} />
            <Info label="E-mail" value={request.customer_email || "-"} />
            <Info label="Empresa" value={request.company_name || "-"} />
            <Info label="CNPJ" value={request.cnpj || "-"} />
            <Info label="Segmento" value={request.segment || "-"} />
            <Info label="Cidade/UF" value={`${request.city}${request.state ? `/${request.state}` : ""}`} />
            <Info label="Preferencia" value={request.contact_preference} />
            <Info label="Consentimento" value={request.consent_recorded_at ? new Date(request.consent_recorded_at).toLocaleString("pt-BR") : "-"} />
            <Info label="Origem" value={request.page_origin} />
            <Info label="Responsável" value={request.responsible_name || "Sem responsável"} />
            <Info label="Perda" value={request.lost_reason || "-"} />
            <Info label="Arquivado em" value={request.archived_at ? new Date(request.archived_at).toLocaleString("pt-BR") : "-"} />
          </div>
          {request.message ? <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm leading-6">{request.message}</p> : null}
          <div className="mt-4 rounded-md border bg-muted/20 p-3">
            <p className="text-xs uppercase text-muted-foreground">UTM</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(request.utm_json || {}, null, 2)}</pre>
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Status e responsável">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2"><Badge>{statuses.find(([value]) => value === request.status)?.[1] || request.status}</Badge><span className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString("pt-BR")}</span></div>
            <Select value={request.status} onValueChange={(value) => void updateStatus(value)} disabled={busy || isLegacy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Nota da mudanca de status ou motivo da perda" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} disabled={isLegacy} />
            <div className="flex gap-2">
              <Input placeholder="Responsável" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} disabled={isLegacy} />
              <Button type="button" variant="outline" onClick={() => void assignResponsible()} disabled={busy || isLegacy}><Save className="h-4 w-4" /></Button>
            </div>
          </div>
        </WorkspaceSection>
      </div>

      <WorkspaceSection title="Itens">
        <div className="grid gap-3">
          {detail.items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-md border bg-white p-3 md:grid-cols-[72px_1fr]">
              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-md bg-muted">
                {item.image_url_snapshot ? <img src={item.image_url_snapshot} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] uppercase text-muted-foreground">Sem imagem</span>}
              </div>
              <div>
                <p className="font-medium">{item.product_name_snapshot}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[item.sku_snapshot ? `SKU ${item.sku_snapshot}` : null, item.variant_label_snapshot, `${item.quantity} ${item.unit || "un"}`].filter(Boolean).join(" | ")}</p>
                {item.notes ? <p className="mt-2 text-sm">{item.notes}</p> : null}
                {item.calculation_snapshot_json ? <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">{JSON.stringify(item.calculation_snapshot_json, null, 2)}</pre> : null}
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceSection title="Notas internas">
          <div className="grid gap-2">
            <Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Registrar nota interna" disabled={isLegacy} />
            <Button type="button" onClick={() => void addNote()} disabled={busy || isLegacy || !internalNote.trim()}>Adicionar nota</Button>
            {detail.notes.map((note) => <p key={note.id} className="rounded-md border p-3 text-sm">{note.note}<span className="mt-1 block text-xs text-muted-foreground">{note.actor_name} - {new Date(note.created_at).toLocaleString("pt-BR")}</span></p>)}
          </div>
        </WorkspaceSection>
        <WorkspaceSection title="Templates WhatsApp">
          <div className="grid gap-2">
            {whatsappTemplates.map((template) => (
              <Button key={template.label} asChild variant="outline" className="justify-start">
                <a href={getWhatsAppUrl(template.message)} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {template.label}
                </a>
              </Button>
            ))}
            <p className="text-xs leading-5 text-muted-foreground">Templates nao substituem o registro da solicitacao; use notas internas para documentar contatos relevantes.</p>
          </div>
        </WorkspaceSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <WorkspaceSection title="Histórico">
          <div className="grid gap-2">
            {detail.history.length === 0 ? <p className="text-sm text-muted-foreground">Historico M1 indisponivel para registro legado.</p> : null}
            {detail.history.map((entry) => <p key={entry.id} className="rounded-md border p-3 text-sm">{entry.from_status || "-"} {"->"} {entry.to_status}<span className="mt-1 block text-xs text-muted-foreground">{entry.actor_name} - {new Date(entry.created_at).toLocaleString("pt-BR")}</span>{entry.note ? <span className="mt-1 block">{entry.note}</span> : null}</p>)}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
