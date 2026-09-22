import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminEmptyState } from "@/components/admin/AdminPrimitives";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { extractNoteField, labelLeadStatus, leadStatusOptions } from "./operationsHelpers";
import type { AdminLead, AdminQuoteRequest, LeadDraft } from "./types";

export function LeadsTable({
  requests,
  leadDrafts,
  updatingLeadId,
  onUpdateLeadDraft,
  onSaveLeadAttendance,
}: {
  requests: AdminQuoteRequest[];
  leadDrafts: Record<string, LeadDraft>;
  updatingLeadId: string | null;
  onUpdateLeadDraft: (leadId: string, patch: LeadDraft) => void;
  onSaveLeadAttendance: (lead: AdminLead) => void;
}) {
  return (
    <WorkspaceSection title="Solicitações recebidas pelo site">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Referencia</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Quantidade</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Observacao interna</th>
              <th className="px-3 py-2">Atendimento</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 12).map((request) => {
              const firstItem = request.items[0];
              const lead = request.lead;
              const leadDraft = lead ? leadDrafts[lead.id] : null;
              return (
                <tr key={request.quote.id} className="border-t">
                  <td className="px-3 py-3 font-medium">{request.quote.quote_number || request.quote.id}</td>
                  <td className="px-3 py-3">{request.quote.customer_name || "Sem nome"}</td>
                  <td className="px-3 py-3">{request.quote.customer_phone || "A confirmar"}</td>
                  <td className="px-3 py-3">{request.quote.customer_email || "-"}</td>
                  <td className="px-3 py-3">{extractNoteField(request.quote.notes, "Cidade") || "-"}</td>
                  <td className="px-3 py-3">{firstItem?.product_name || request.lead?.product_interest || "Sob consulta"}</td>
                  <td className="px-3 py-3">{extractNoteField(request.quote.notes, "Categoria") || "-"}</td>
                  <td className="px-3 py-3">{firstItem?.quantity ? `${firstItem.quantity}${firstItem.unit ? ` ${firstItem.unit}` : ""}` : "-"}</td>
                  <td className="px-3 py-3">{request.lead?.page_origin || "site"}</td>
                  <td className="px-3 py-3"><Badge>{labelLeadStatus(lead?.stage || lead?.status || request.quote.status)}</Badge></td>
                  <td className="px-3 py-3">
                    {lead ? (
                      <textarea
                        value={leadDraft?.notes ?? lead.notes ?? ""}
                        onChange={(event) => onUpdateLeadDraft(lead.id, { notes: event.target.value })}
                        className="min-h-16 w-64 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                        placeholder="Registrar retorno, combinado ou próximo passo"
                      />
                    ) : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {lead ? (
                      <div className="flex min-w-44 flex-col gap-2">
                        <select
                          value={leadDraft?.stage ?? lead.stage ?? lead.status ?? "new"}
                          onChange={(event) => onUpdateLeadDraft(lead.id, { stage: event.target.value })}
                          className="h-9 rounded-md border bg-background px-2 text-xs outline-none focus:border-primary"
                        >
                          {leadStatusOptions.map((option, index) => (
                            <option key={`${option.label}-${index}`} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" disabled={updatingLeadId === lead.id} onClick={() => onSaveLeadAttendance(lead)}>
                          {updatingLeadId === lead.id ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 ? (
          <AdminEmptyState title="Nenhuma solicitação registrada." description="Teste o formulario publico e confirme se o registro aparece nesta tabela." />
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Campos operacionais restantes, como responsavel e observacoes internas, devem ser atualizados na rotina de atendimento conforme o lead avanca por Novo, Em atendimento, Respondido, Em negociacao, Fechado, Perdido ou Arquivado.
      </p>
    </WorkspaceSection>
  );
}
