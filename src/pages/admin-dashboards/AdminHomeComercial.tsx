import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, MessageSquareText, RefreshCw } from "lucide-react";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEmptyState, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type QuoteRequestRow = {
  request: { id: string; protocol: string; customer_name: string };
  quote: { status?: string | null };
};

type QuoteRequestsResponse = { requests: QuoteRequestRow[] };
type LeadRecord = { id: string; name?: string; status?: string | null };

const openStatuses = ["new", "novo", "draft", "pending", "pendente"];

export default function AdminHomeComercial() {
  const quoteRequests = useAdminResource<QuoteRequestsResponse>("/api/admin/quote-requests", { requests: [] });
  const leads = useAdminResource<LeadRecord[]>("/api/admin/leads", []);

  const newQuotes = useMemo(
    () => quoteRequests.data.requests.filter((row) => openStatuses.includes(String(row.quote.status || "novo").toLowerCase())),
    [quoteRequests.data.requests],
  );
  const leadsInService = useMemo(
    () => leads.data.filter((lead) => ["em_atendimento", "em atendimento", "open", "aberto", "pending", "pendente"].includes(String(lead.status || "").toLowerCase())),
    [leads.data],
  );

  return (
    <AdminWorkspaceShell
      eyebrow="Painel GAMEL"
      title="Início"
      description="Orçamentos e leads recebidos, prontos para atendimento."
      actions={<Button onClick={() => { void quoteRequests.reload(); void leads.reload(); }} variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetric label="Orçamentos novos" value={newQuotes.length} tone={newQuotes.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Leads em atendimento" value={leadsInService.length} />
        </div>

        <WorkspaceSection title="Atalhos">
          <div className="grid gap-3 md:grid-cols-2">
            <Link to="/admin/orçamentos" className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Orçamentos</p>
              <p className="mt-1 text-sm text-muted-foreground">Fila comercial com protocolo, produtos, status e responsável.</p>
            </Link>
            <Link to="/admin/operação" className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
              <ClipboardList className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Operação</p>
              <p className="mt-1 text-sm text-muted-foreground">Leads e orçamentos em andamento.</p>
            </Link>
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Orçamentos novos" action={<Button asChild size="sm" variant="outline"><Link to="/admin/orçamentos">Ver todos</Link></Button>}>
          <div className="grid gap-3 lg:grid-cols-2">
            {newQuotes.slice(0, 6).map((row) => (
              <AdminQueueCard
                key={row.request.id}
                title={row.request.customer_name || "Cliente"}
                description={row.request.protocol ? `Protocolo ${row.request.protocol}` : ""}
                tone="warn"
                eyebrow={<Badge variant="outline">{row.quote.status || "novo"}</Badge>}
                action={<Button asChild size="sm" variant="outline"><Link to={`/admin/orçamentos/${row.request.id}`}>Abrir</Link></Button>}
              />
            ))}
            {newQuotes.length === 0 ? (
              <AdminEmptyState title="Nenhum orçamento novo agora." description="Fila comercial em dia." />
            ) : null}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
