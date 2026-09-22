import { Link, Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type ModuleMetric = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
};

type ModuleItem = {
  title: string;
  description: string;
  route?: string;
  owner?: string;
  status?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
};

type ModuleLink = {
  label: string;
  route: string;
  variant?: "default" | "outline";
};

type ModuleSection = {
  title: string;
  description: string;
  items: ModuleItem[];
};

export function AdminModuleWorkspace({
  eyebrow,
  title,
  description,
  statusLabel,
  metrics,
  primaryLinks,
  sections,
  docsPath,
}: {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  metrics: ModuleMetric[];
  primaryLinks: ModuleLink[];
  sections: ModuleSection[];
  docsPath?: string;
}) {
  const { isAdmin, loading } = useAdmin();

  if (loading) return <AdminLoadingState label={`Carregando ${title.toLowerCase()}...`} />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  return (
    <AdminWorkspaceShell
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <>
          {primaryLinks.slice(0, 3).map((link) => (
            <Button key={link.route} asChild variant={link.variant || "outline"}>
              <Link to={link.route}>{link.label}</Link>
            </Button>
          ))}
          {docsPath ? (
            <Button asChild variant="outline">
              <Link to="/admin/documentacao">Docs</Link>
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <WorkspaceMetric key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} tone={metric.tone} />
          ))}
        </div>

        <WorkspaceSection title="Visao operacional">
          <AdminOperationalToolbar
            title={title}
            description={description}
            resultLabel={statusLabel}
            actions={<Button type="button" variant="outline" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {primaryLinks.map((link) => (
              <Link key={link.route} to={link.route} className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/40">
                <p className="font-semibold">{link.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{link.route}</p>
              </Link>
            ))}
          </div>
        </WorkspaceSection>

        {sections.map((section) => (
          <WorkspaceSection
            key={section.title}
            title={section.title}
            action={<Badge variant="outline">{section.description}</Badge>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {section.items.map((item) => (
                <AdminQueueCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  tone={item.tone || "neutral"}
                  eyebrow={<><Badge variant="outline">{item.owner || eyebrow}</Badge><Badge variant="secondary">{item.status || "gerenciavel"}</Badge></>}
                  action={item.route ? <Button asChild size="sm" variant="outline"><Link to={item.route}>Abrir</Link></Button> : null}
                />
              ))}
            </div>
          </WorkspaceSection>
        ))}

        {docsPath ? (
          <WorkspaceSection title="Referencia operacional">
            <div className="rounded-lg border bg-muted/25 p-4">
              <p className="font-semibold">{docsPath}</p>
              <p className="mt-1 text-sm text-muted-foreground">Documento de apoio listado na Central de Documentacao Interna.</p>
            </div>
          </WorkspaceSection>
        ) : null}
      </div>
    </AdminWorkspaceShell>
  );
}
