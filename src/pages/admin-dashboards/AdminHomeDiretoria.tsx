import { Link } from "react-router-dom";
import { BarChart3, Eye, RefreshCw } from "lucide-react";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type ExecutiveSummary = {
  executive?: { readiness_score?: number };
  orders?: { pending?: number; revenue?: number; average_ticket?: number };
  catalog?: { active_products?: number; image_audit_active?: { critical?: number; missing_image?: number } };
  integrations?: { required?: number; required_ready?: number };
  alerts?: Array<{ priority?: string }>;
};

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
}

export default function AdminHomeDiretoria() {
  const summary = useAdminResource<ExecutiveSummary>("/api/admin/executive/summary", {});

  const criticalAlerts = summary.data.alerts?.filter((alert) => alert.priority === "CRITICO").length ?? 0;
  const totalAlerts = summary.data.alerts?.length ?? 0;

  return (
    <AdminWorkspaceShell
      eyebrow="Painel GAMEL"
      title="Início"
      description="Resumo executivo do negócio, somente para consulta."
      actions={<Button onClick={() => { void summary.reload(); }} variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
          <Eye className="h-3.5 w-3.5" />
          Modo consulta — somente leitura
        </Badge>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Pedidos pendentes" value={summary.data.orders?.pending ?? 0} tone={(summary.data.orders?.pending ?? 0) > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Faturamento acumulado" value={formatCurrency(summary.data.orders?.revenue)} />
          <WorkspaceMetric label="Ticket médio" value={formatCurrency(summary.data.orders?.average_ticket)} />
          <WorkspaceMetric label="Nota de prontidão" value={summary.data.executive?.readiness_score ?? 0} tone={(summary.data.executive?.readiness_score ?? 0) >= 70 ? "ok" : "warn"} />
          <WorkspaceMetric label="Produtos ativos no catálogo" value={summary.data.catalog?.active_products ?? 0} />
          <WorkspaceMetric label="Produtos sem imagem" value={summary.data.catalog?.image_audit_active?.missing_image ?? 0} tone={(summary.data.catalog?.image_audit_active?.missing_image ?? 0) > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Integrações obrigatórias prontas" value={`${summary.data.integrations?.required_ready ?? 0}/${summary.data.integrations?.required ?? 0}`} />
          <WorkspaceMetric label="Alertas críticos" value={criticalAlerts} detail={`${totalAlerts} alerta(s) no total`} tone={criticalAlerts > 0 ? "danger" : "ok"} />
        </div>

        <WorkspaceSection title="Relatório completo" action={<Button asChild size="sm" variant="outline"><Link to="/admin/relatorios">Ver relatório completo</Link></Button>}>
          <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Este painel traz um resumo rápido. Para o detalhamento completo — pedidos, catálogo, marketing e operações —
              acesse a página de Relatórios.
            </p>
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
