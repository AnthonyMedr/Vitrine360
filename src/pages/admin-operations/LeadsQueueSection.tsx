import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { formatContact, formatDate, isOpenStatus } from "./operationsHelpers";
import type { AdminLead } from "./types";

export function LeadsQueueSection({ recentLeads }: { recentLeads: AdminLead[] }) {
  return (
    <WorkspaceSection title="Leads e origem comercial">
      <div className="grid gap-3 lg:grid-cols-2">
        {recentLeads.map((lead) => (
          <AdminQueueCard
            key={lead.id}
            title={lead.name || "Lead sem nome"}
            description={lead.product_interest || lead.notes || "Contato registrado para atendimento comercial."}
            tone={isOpenStatus(lead.status) ? "warn" : "neutral"}
            eyebrow={(
              <>
                <Badge variant="outline">{lead.source || "site"}</Badge>
                {lead.linked_quote_id ? <Badge variant="secondary">com orcamento</Badge> : null}
              </>
            )}
            meta={<span>{formatContact(lead.phone, lead.email)} - {formatDate(lead.created_at)}</span>}
            action={<Button asChild size="sm" variant="outline"><Link to="/admin/operacao">Ver atendimento</Link></Button>}
          />
        ))}
        {recentLeads.length === 0 ? (
          <AdminEmptyState title="Nenhum lead cadastrado." description="Leads vindos do formulario e do WhatsApp serão exibidos aqui para acompanhamento." />
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
