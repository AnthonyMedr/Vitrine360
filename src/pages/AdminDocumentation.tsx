import { Link, Navigate } from "react-router-dom";
import { BookOpen, ExternalLink } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

const documents = [
  { title: "Indice oficial GAMEL", path: "docs/gamel/README.md", owner: "Todos", route: "/admin/docs", priority: "onboarding" },
  { title: "Escopo Fase 1", path: "docs/gamel/SCOPE_PHASE1.md", owner: "Gestao", route: "/admin", priority: "go-live" },
  { title: "Painel administrativo", path: "docs/gamel/ADMIN_PHASE1.md", owner: "Gestao", route: "/admin", priority: "diario" },
  { title: "Catálogo inteligente", path: "docs/gamel/CATALOG_PHASE1.md", owner: "Catálogo", route: "/admin/produtos", priority: "diario" },
  { title: "Checklist go-live", path: "docs/gamel/GO_LIVE_HOMOLOGATION_CHECKLIST.md", owner: "Diretoria", route: "/admin/go-live", priority: "go-live" },
  { title: "Relatório de execucao", path: "docs/gamel/FINAL_EXECUTION_REPORT.md", owner: "Gestao", route: "/admin/go-live", priority: "go-live" },
];

export default function AdminDocumentation() {
  const { isAdmin, loading } = useAdmin();

  if (loading) return <AdminLoadingState label="Carregando documentacao interna..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  return (
    <AdminWorkspaceShell
      eyebrow="Documentacao interna"
      title="Central de guias da Fase 1"
      description="Indice simples para gerenciar site institucional, catálogo, produtos, imagens, banners, leads e orcamentos da Fase 1."
      actions={<Button asChild><Link to="/admin/go-live">Go-live</Link></Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Documentos chave" value={documents.length} />
          <WorkspaceMetric label="Rotinas diarias" value={documents.filter((doc) => doc.priority === "diario").length} />
          <WorkspaceMetric label="Governanca" value={documents.filter((doc) => ["acesso", "auditoria", "go-live"].includes(doc.priority)).length} />
          <WorkspaceMetric label="Checkpoint" value="Ativo" tone="ok" />
        </div>

        <WorkspaceSection title="Como usar a documentacao">
          <AdminOperationalToolbar
            title="Runbook dentro do fluxo"
            description="Cada documento aponta para a tela correta do painel. A equipe consulta o procedimento, executa a rotina e registra evidencias para homologacao."
            resultLabel="operação Fase 1"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["Abrir guia", "Executar na tela", "Registrar evidencia", "Revisar no relatório"].map((step, index) => (
              <div key={step} className="rounded-lg border bg-background p-4">
                <Badge variant="outline">Passo {index + 1}</Badge>
                <p className="mt-3 font-semibold">{step}</p>
                <p className="mt-1 text-sm text-muted-foreground">Fluxo simples para operacao assistida e auditoria interna.</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Biblioteca Admin">
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((doc) => (
              <AdminQueueCard
                key={doc.path}
                title={doc.title}
                description={doc.path}
                tone={doc.priority === "go-live" || doc.priority === "acesso" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{doc.owner}</Badge><Badge variant="secondary">{doc.priority}</Badge></>}
                action={<Button asChild size="sm" variant="outline"><Link to={doc.route}><ExternalLink className="mr-2 h-4 w-4" />Abrir tela</Link></Button>}
              />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Treinamento por perfil">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              "Administrador cria acessos, revisa permissoes, auditoria e configurações.",
              "Comercial acompanha leads, solicitações do site, WhatsApp e SLA de retorno.",
              "Catálogo cadastra produtos, categorias, descrições, medidas, imagens e destaques.",
              "Marketing atualiza banners, vitrines, campanhas e textos comerciais.",
              "Diretoria consulta indicadores, pendencias, readiness e plano de go-live.",
              "Modulos futuros permanecem fora da rotina operacional da Fase 1.",
            ].map((item) => (
              <div key={item} className="rounded-lg border bg-background p-4">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
