import { Link, Navigate } from "react-router-dom";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEmptyState, AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type ExecutiveSummary = {
  generated_at?: string;
  period?: string;
  orders?: { today?: number; pending?: number; paid?: number; canceled?: number };
  revenue?: { period_total?: number; average_ticket?: number };
  catalog?: { active?: number; without_image?: number; without_price?: number; incomplete?: number };
  marketing?: { active_campaigns?: number; active_banners?: number };
  operations?: { alerts?: number; critical_alerts?: number };
};

type DecisionBoard = {
  generated_at?: string;
  decision?: string;
  summary?: { blockers?: number; warnings?: number; actions?: number };
  items?: Array<{ id: string; title: string; owner?: string; severity?: string; status?: string; route?: string; recommendation?: string }>;
};

type ControlCenter = {
  next_decision: string;
  summary: { total_actions: number; done: number; pending_real_execution: number; blocked_external: number; monitor: number };
  actions: Array<{ id: string; label: string; owner: string; status: string; priority: string; route: string; note: string }>;
};

export default function AdminReports() {
  const { isAdmin, loading } = useAdmin();
  const summary = useAdminResource<ExecutiveSummary>(isAdmin ? "/api/admin/executive/summary" : null, {});
  const decision = useAdminResource<DecisionBoard>(isAdmin ? "/api/admin/executive/decision-board" : null, { items: [], summary: {} });
  const control = useAdminResource<ControlCenter>(isAdmin ? "/api/admin/governance/control-center" : null, {
    next_decision: "CARREGANDO",
    summary: { total_actions: 0, done: 0, pending_real_execution: 0, blocked_external: 0, monitor: 0 },
    actions: [],
  });

  if (loading) return <AdminLoadingState label="Carregando relatórios administrativos..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const reportLinks = [
    { label: "Ata executiva", href: "/api/admin/executive/report?format=md", format: "MD" },
    { label: "Briefing executivo", href: "/api/admin/executive/briefing?format=md", format: "MD" },
    { label: "Plano de acoes", href: "/api/admin/executive/actions.csv", format: "CSV" },
    { label: "Controle de governanca", href: "/api/admin/governance/control-center/export?format=md", format: "MD" },
    { label: "Fechamento programavel", href: "/api/admin/governance/programmatic-completion/export?format=md", format: "MD" },
    { label: "Auditoria", href: "/api/admin/audit-logs?limit=100", format: "JSON" },
  ];

  const reloadAll = () => {
    void summary.reload();
    void decision.reload();
    void control.reload();
  };

  return (
    <AdminWorkspaceShell
      eyebrow="Relatórios"
      title="Central de relatórios executivos e operacionais"
      description="Area dedicada para gerar atas, CSVs, decisoes, status de go-live e evidencias de gestao sem depender de acesso técnico."
      actions={<><Button asChild variant="outline"><Link to="/admin">Dashboard</Link></Button><Button onClick={reloadAll} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Pedidos hoje" value={summary.data.orders?.today ?? 0} />
          <WorkspaceMetric label="Pedidos pendentes" value={summary.data.orders?.pending ?? 0} tone={(summary.data.orders?.pending ?? 0) > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Produtos incompletos" value={summary.data.catalog?.incomplete ?? 0} tone={(summary.data.catalog?.incomplete ?? 0) > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Acoes abertas" value={control.data.summary.total_actions - control.data.summary.done} tone={control.data.summary.total_actions - control.data.summary.done > 0 ? "warn" : "ok"} />
        </div>

        <WorkspaceSection title="Pacote de exportacao">
          <AdminOperationalToolbar
            title="Relatórios prontos para gestao"
            description="Os links abaixo usam endpoints existentes, preservam bloqueios externos e não exibem secrets."
            resultLabel={control.data.next_decision.replace(/_/g, " ")}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reportLinks.map((report) => (
              <a key={report.href} href={report.href} target="_blank" rel="noreferrer" className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{report.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Abrir ou baixar em formato {report.format}.</p>
                  </div>
                  <Badge variant="outline">{report.format}</Badge>
                </div>
                <p className="mt-3 inline-flex items-center text-sm font-medium text-primary"><Download className="mr-2 h-4 w-4" />Gerar</p>
              </a>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Quadro de decisao">
          <div className="grid gap-3 lg:grid-cols-2">
            {(decision.data.items || []).slice(0, 8).map((item) => (
              <AdminQueueCard
                key={item.id}
                title={item.title}
                description={item.recommendation || item.status || "Item aguardando classificacao."}
                tone={item.severity === "critical" ? "danger" : item.severity === "high" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{item.owner || "Sem dono"}</Badge><Badge variant="secondary">{item.severity || "info"}</Badge></>}
                action={item.route ? <Button asChild size="sm" variant="outline"><Link to={item.route}>Abrir</Link></Button> : null}
              />
            ))}
            {(!decision.data.items || decision.data.items.length === 0) ? (
              <AdminEmptyState title="Quadro de decisao sem itens." description="Atualize os checks ou abra o dashboard executivo para gerar novos sinais." action={<Button asChild><Link to="/admin"><BarChart3 className="mr-2 h-4 w-4" />Dashboard</Link></Button>} />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Acoes por prioridade">
          <div className="space-y-3">
            {control.data.actions.slice(0, 10).map((action) => (
              <AdminQueueCard
                key={action.id}
                title={action.label}
                description={action.note}
                tone={action.priority === "critical" ? "danger" : action.priority === "high" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{action.owner}</Badge><Badge variant="secondary">{action.status}</Badge></>}
                action={<Button asChild size="sm" variant="outline"><Link to={action.route || "/admin/governanca"}>Executar</Link></Button>}
              />
            ))}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
