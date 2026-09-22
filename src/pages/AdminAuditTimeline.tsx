import { Link, Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type AuditLog = {
  id?: string;
  event_id?: string;
  event_type: string;
  occurred_at?: string;
  created_at?: string;
  actor_id?: string | null;
  actor_name?: string | null;
  source_channel?: string;
  order_id?: string | null;
  payload?: Record<string, unknown> | null;
};

export default function AdminAuditTimeline() {
  const { isAdmin, loading } = useAdmin();
  const audit = useAdminResource<AuditLog[]>(isAdmin ? "/api/admin/audit-logs" : null, []);

  if (loading) return <AdminLoadingState label="Carregando auditoria..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const grouped = groupByDomain(audit.data);
  const permissionDenied = audit.data.filter((entry) => entry.event_type.includes("permission_denied"));
  const adminEvents = audit.data.filter((entry) => entry.event_type.startsWith("admin."));
  const orderEvents = audit.data.filter((entry) => entry.event_type.startsWith("order."));

  return (
    <AdminWorkspaceShell
      eyebrow="Auditoria"
      title="Timeline de acoes administrativas"
      description="Visao dedicada para rastrear acoes sensiveis, pedidos, permissoes, segurança, fiscal, marketing e operação."
      actions={<><Button variant="outline" onClick={() => void audit.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button asChild><Link to="/admin/governanca">Governanca</Link></Button></>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Eventos carregados" value={audit.data.length} />
          <WorkspaceMetric label="Admin" value={adminEvents.length} />
          <WorkspaceMetric label="Pedidos" value={orderEvents.length} />
          <WorkspaceMetric label="Acesso negado" value={permissionDenied.length} tone={permissionDenied.length > 0 ? "warn" : "ok"} />
        </div>

        <WorkspaceSection title="Resumo por dominio">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {Object.entries(grouped).map(([domain, count]) => (
              <div key={domain} className="rounded-lg border p-3">
                <p className="font-semibold">{domain}</p>
                <p className="mt-2 font-display text-3xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Timeline recente">
          <div className="relative space-y-0">
            {audit.data.slice(0, 80).map((entry, index) => {
              const occurredAt = entry.occurred_at || entry.created_at || "";
              return (
                <div key={entry.id || entry.event_id || `${entry.event_type}-${index}`} className="relative border-l pl-5 pb-5">
                  <div className="absolute -left-2 top-1 h-4 w-4 rounded-full border bg-background" />
                  <div className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{entry.event_type}</p>
                      <Badge variant="outline">{domainOf(entry.event_type)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.actor_name || entry.actor_id || "sistema"} · {occurredAt ? new Date(occurredAt).toLocaleString("pt-BR") : "sem data"} · {entry.source_channel || "admin"}
                    </p>
                    {entry.order_id ? <p className="mt-2 text-sm text-muted-foreground">Pedido vinculado: {entry.order_id}</p> : null}
                    {entry.payload?.entity ? <p className="mt-2 text-sm text-muted-foreground">Entidade: {String(entry.payload.entity)} {entry.payload.entityId ? `· ${String(entry.payload.entityId)}` : ""}</p> : null}
                  </div>
                </div>
              );
            })}
            {audit.data.length === 0 ? <p className="text-sm text-muted-foreground">Sem eventos retornados para esta permissao.</p> : null}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}

function domainOf(eventType: string) {
  return eventType.split(".")[0] || "sistema";
}

function groupByDomain(entries: AuditLog[]) {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    const domain = domainOf(entry.event_type);
    acc[domain] = (acc[domain] ?? 0) + 1;
    return acc;
  }, {});
}
