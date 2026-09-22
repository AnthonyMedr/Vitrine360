import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { RefreshCw, Send, UserRoundCheck } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric } from "@/components/admin/AdminWorkspaceShell";
import { useToast } from "@/components/ui/use-toast";
import type { AdminLead, AdminQuote, AdminQuoteRequestsResponse, LeadDraft } from "./admin-operations/types";
import { isOpenStatus } from "./admin-operations/operationsHelpers";
import { RequestsQueueSection } from "./admin-operations/RequestsQueueSection";
import { LeadsTable } from "./admin-operations/LeadsTable";
import { LeadsQueueSection } from "./admin-operations/LeadsQueueSection";
import { RoutineSection } from "./admin-operations/RoutineSection";

export default function AdminOperations() {
  const { isAdmin, loading } = useAdmin();
  const leads = useAdminResource<AdminLead[]>(isAdmin ? "/api/admin/leads" : null, []);
  const quotes = useAdminResource<AdminQuote[]>(isAdmin ? "/api/admin/quotes" : null, []);
  const quoteRequests = useAdminResource<AdminQuoteRequestsResponse>(isAdmin ? "/api/admin/quote-requests" : null, { requests: [] });
  const [leadDrafts, setLeadDrafts] = useState<Record<string, LeadDraft>>({});
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const { toast } = useToast();

  if (loading) return <AdminLoadingState label="Carregando atendimento comercial..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const requests = quoteRequests.data.requests;
  const openLeads = leads.data.filter((lead) => isOpenStatus(lead.status));
  const openQuotes = quotes.data.filter((quote) => isOpenStatus(quote.status));
  const recentRequests = requests.slice(0, 6);
  const recentLeads = leads.data.slice(0, 6);
  const isBusy = leads.loading || quotes.loading || quoteRequests.loading;
  const errors = [leads.error, quotes.error, quoteRequests.error].filter(Boolean);

  const reloadAll = () => {
    void leads.reload();
    void quotes.reload();
    void quoteRequests.reload();
  };

  const updateLeadDraft = (leadId: string, patch: LeadDraft) => {
    setLeadDrafts((current) => ({ ...current, [leadId]: { ...current[leadId], ...patch } }));
  };

  const saveLeadAttendance = async (lead: AdminLead) => {
    setUpdatingLeadId(lead.id);
    try {
      const draft = leadDrafts[lead.id] ?? {};
      await apiFetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          stage: draft.stage || lead.stage || lead.status || "contacted",
          notes: typeof draft.notes === "string" ? draft.notes : lead.notes || "",
          responsible_name: "Comercial GAMEL",
        }),
      });
      setLeadDrafts((current) => {
        const next = { ...current };
        delete next[lead.id];
        return next;
      });
      await leads.reload();
      await quoteRequests.reload();
    } catch (error) {
      toast({ title: "Falha ao salvar atendimento", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUpdatingLeadId(null);
    }
  };

  return (
    <AdminWorkspaceShell
      title="Atendimento comercial e orcamentos"
      eyebrow="Fase 1 GAMEL"
      description="Central para acompanhar leads, solicitações do site, orcamentos recebidos e os ajustes que alimentam o catálogo inteligente."
      actions={(
        <>
          <Button variant="outline" onClick={reloadAll} disabled={isBusy}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button asChild>
            <Link to="/orcamento">
              <Send className="h-4 w-4" />
              Abrir formulario
            </Link>
          </Button>
        </>
      )}
    >
      <div className="space-y-6">
        {errors.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {errors[0]}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Leads cadastrados" value={leads.data.length} />
          <WorkspaceMetric label="Leads em aberto" value={openLeads.length} tone={openLeads.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Solicitações do site" value={requests.length} />
          <WorkspaceMetric label="Orcamentos abertos" value={openQuotes.length} tone={openQuotes.length > 0 ? "warn" : "ok"} />
        </div>

        <RequestsQueueSection requests={requests} recentRequests={recentRequests} />

        <LeadsTable
          requests={requests}
          leadDrafts={leadDrafts}
          updatingLeadId={updatingLeadId}
          onUpdateLeadDraft={updateLeadDraft}
          onSaveLeadAttendance={(lead) => void saveLeadAttendance(lead)}
        />

        <LeadsQueueSection recentLeads={recentLeads} />

        <RoutineSection />

        <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <UserRoundCheck className="h-4 w-4 text-primary" />
            Proxima validacao comercial
          </div>
          <p className="mt-2">
            Confirmar responsavel comercial, SLA de retorno e teste real de WhatsApp/e-mail em producao. Esta validacao fecha a rotina de atendimento da Fase 1.
          </p>
        </div>
      </div>
    </AdminWorkspaceShell>
  );
}
