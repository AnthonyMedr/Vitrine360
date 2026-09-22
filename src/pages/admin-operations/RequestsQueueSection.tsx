import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { describeRequest, formatContact, formatDate, isOpenStatus, labelStatus } from "./operationsHelpers";
import type { AdminQuoteRequest } from "./types";

export function RequestsQueueSection({ requests, recentRequests }: { requests: AdminQuoteRequest[]; recentRequests: AdminQuoteRequest[] }) {
  return (
    <WorkspaceSection
      title="Fila de retorno comercial"
      action={<Button asChild variant="outline" size="sm"><Link to="/orcamento">Testar formulario</Link></Button>}
    >
      <AdminOperationalToolbar
        title="Solicitações recebidas pelo site"
        description="Priorize contatos com produto, quantidade, cidade e WhatsApp. Quando faltar dado, responda pelo canal comercial antes de registrar compromisso."
        resultLabel={`${requests.length} solicitação(oes) no histórico`}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {recentRequests.map((request) => (
          <AdminQueueCard
            key={request.quote.id}
            title={request.quote.customer_name || "Cliente sem nome"}
            description={describeRequest(request)}
            tone={isOpenStatus(request.quote.status) ? "warn" : "neutral"}
            eyebrow={(
              <>
                <Badge variant="outline">{request.quote.quote_number || request.quote.id}</Badge>
                <Badge variant={isOpenStatus(request.quote.status) ? "secondary" : "outline"}>{labelStatus(request.quote.status)}</Badge>
              </>
            )}
            meta={<span>{formatContact(request.quote.customer_phone, request.quote.customer_email)} - {formatDate(request.quote.created_at)}</span>}
            action={<Button asChild size="sm" variant="outline"><Link to="/admin/operacao">Acompanhar</Link></Button>}
          />
        ))}
        {recentRequests.length === 0 ? (
          <AdminEmptyState
            title="Nenhuma solicitação recebida ainda."
            description="Teste o fluxo pelo formulario publico de orçamento e valide o recebimento antes do go-live."
            action={<Button asChild variant="outline"><Link to="/orcamento">Abrir formulario</Link></Button>}
          />
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
