import { Link, useNavigate } from "react-router-dom";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { getWhatsAppUrl } from "@/constants/store";
import { useMemo, useState } from "react";

type QuoteRequestRow = {
  request: {
    id: string;
    protocol: string;
    status: string;
    customer_name: string;
    customer_phone: string;
    company_name: string | null;
    marketing_consent: boolean;
    city: string;
    state: string | null;
    page_origin: string;
    responsible_name: string | null;
    next_action: string | null;
    next_action_due_at: string | null;
    created_at: string;
  };
  items: Array<{ product_name_snapshot: string; product_name?: string; quantity: number }>;
  source: "quote_request_v2" | "legacy_quote";
};

const statusLabels: Record<string, string> = {
  new: "Novo",
  triage: "Em triagem",
  contacted: "Em atendimento",
  waiting_customer: "Aguardando cliente",
  negotiating: "Em negociação",
  qualified: "Em negociação",
  converted: "Convertido",
  lost: "Perdido",
  archived: "Arquivado",
};

export default function AdminQuoteRequests() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const resource = useAdminResource<{ requests: QuoteRequestRow[] }>(isAdmin ? "/api/admin/quote-requests" : null, { requests: [] });
  const rows = resource.data.requests;
  const responsibleOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.request.responsible_name).filter(Boolean) as string[])).sort(), [rows]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        row.request.protocol,
        row.request.customer_name,
        row.request.company_name,
        row.request.customer_phone,
        row.request.city,
        row.request.responsible_name,
        ...row.items.map((item) => item.product_name_snapshot || item.product_name),
      ].filter(Boolean).join(" ").toLowerCase();
      const createdAt = row.request.created_at.slice(0, 10);
      if (normalized && !haystack.includes(normalized)) return false;
      if (statusFilter !== "all" && row.request.status !== statusFilter) return false;
      if (cityFilter.trim() && !`${row.request.city}/${row.request.state || ""}`.toLowerCase().includes(cityFilter.trim().toLowerCase())) return false;
      if (responsibleFilter === "unassigned" && row.request.responsible_name) return false;
      if (responsibleFilter !== "all" && responsibleFilter !== "unassigned" && row.request.responsible_name !== responsibleFilter) return false;
      if (dateFrom && createdAt < dateFrom) return false;
      if (dateTo && createdAt > dateTo) return false;
      return true;
    });
  }, [cityFilter, dateFrom, dateTo, query, responsibleFilter, rows, statusFilter]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (resource.loading) return <AdminLoadingState label="Carregando solicitações de orçamento..." />;

  const newCount = rows.filter((row) => row.request.status === "new").length;
  const openCount = rows.filter((row) => !["converted", "lost", "archived"].includes(row.request.status)).length;
  const unassigned = rows.filter((row) => !row.request.responsible_name).length;
  const waitingCount = rows.filter((row) => row.request.status === "waiting_customer").length;
  const negotiatingCount = rows.filter((row) => row.request.status === "negotiating").length;

  return (
    <AdminWorkspaceShell
      title="Orcamentos"
      eyebrow="M1 essencial"
      description="Solicitações publicas recebidas pelo site, separadas de cotacoes comerciais, pedidos e vendas."
      actions={<Button variant="outline" onClick={() => void resource.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <WorkspaceMetric label="Solicitações" value={rows.length} detail="Total em leitura dual" tone="ok" />
        <WorkspaceMetric label="Novas" value={newCount} detail="Aguardando triagem" tone={newCount > 0 ? "warn" : "ok"} />
        <WorkspaceMetric label="Sem responsável" value={unassigned} detail={`${openCount} abertas`} tone={unassigned > 0 ? "warn" : "ok"} />
      </div>

      <WorkspaceSection title="Fila de atendimento">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { value: "all", label: "Todos", count: rows.length },
            { value: "new", label: "Novo", count: newCount },
            { value: "triage", label: "Triagem", count: rows.filter((row) => row.request.status === "triage").length },
            { value: "contacted", label: "Atendimento", count: rows.filter((row) => row.request.status === "contacted").length },
            { value: "waiting_customer", label: "Aguardando", count: waitingCount },
            { value: "negotiating", label: "Negociando", count: negotiatingCount },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${statusFilter === tab.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:border-primary/50"}`}
            >
              <span className="block text-xs font-semibold uppercase">{tab.label}</span>
              <span className="mt-1 block text-lg font-bold">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="mb-4 rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.3fr)_180px_180px_160px_160px_180px]">
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por protocolo, cliente, empresa, produto ou telefone" />
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(statusLabels).filter(([value]) => value !== "qualified").map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={cityFilter} onChange={(event) => { setCityFilter(event.target.value); setPage(1); }} placeholder="Cidade/UF" />
          <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
          <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          <Select value={responsibleFilter} onValueChange={(value) => { setResponsibleFilter(value); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unassigned">Sem responsavel</SelectItem>
              {responsibleOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Protocolo</th>
                <th className="px-3 py-3">Solicitante</th>
                <th className="px-3 py-3">Cidade</th>
                <th className="px-3 py-3">Itens</th>
                <th className="px-3 py-3">Origem</th>
                <th className="px-3 py-3">Responsavel</th>
                <th className="px-3 py-3">Proxima acao</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nenhuma solicitacao encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : pagedRows.map((row) => {
                const summary = row.items.map((item) => item.product_name_snapshot || item.product_name).filter(Boolean).join(", ");
                const whatsapp = getWhatsAppUrl(`Ola, vim falar sobre o protocolo ${row.request.protocol} da GAMEL Metal.`);
                const openDetail = () => navigate(`/admin/orçamentos/${row.request.id}`);
                return (
                  <tr
                    key={`${row.source}:${row.request.id}`}
                    className="cursor-pointer border-t hover:bg-muted/40"
                    onClick={openDetail}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openDetail();
                    }}
                  >
                    <td className="px-3 py-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <Link className="text-primary hover:underline" to={`/admin/orçamentos/${row.request.id}`} onClick={(event) => event.stopPropagation()}>{row.request.protocol}</Link>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); void navigator.clipboard?.writeText(row.request.protocol); }} aria-label="Copiar protocolo">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.request.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{row.request.customer_phone}</p>
                      {row.request.marketing_consent ? (
                        <Badge variant="secondary" className="mt-1 text-[10px]">Autorizou contato comercial</Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{row.request.city}{row.request.state ? `/${row.request.state}` : ""}</td>
                    <td className="px-3 py-3">{row.items.length} item(ns)<p className="max-w-sm truncate text-xs text-muted-foreground">{summary}</p></td>
                    <td className="px-3 py-3"><span className="text-xs">{row.request.page_origin}</span></td>
                    <td className="px-3 py-3">{row.request.responsible_name || "Sem responsável"}</td>
                    <td className="px-3 py-3">
                      <p className="max-w-[220px] truncate text-xs">{row.request.next_action || "Sem próxima acao"}</p>
                      {row.request.next_action_due_at ? <p className="text-[11px] text-muted-foreground">{new Date(row.request.next_action_due_at).toLocaleDateString("pt-BR")}</p> : null}
                    </td>
                    <td className="px-3 py-3"><Badge variant="outline">{statusLabels[row.request.status] || row.request.status}</Badge></td>
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline"><Link to={`/admin/orçamentos/${row.request.id}`}>Abrir</Link></Button>
                        <Button asChild size="icon" variant="outline"><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{filtered.length} resultado(s), pagina {currentPage} de {totalPages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>Anterior</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>Proxima</Button>
          </div>
        </div>
      </WorkspaceSection>
    </AdminWorkspaceShell>
  );
}
