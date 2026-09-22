import { Link, Navigate } from "react-router-dom";
import { ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEmptyState, AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type PermissionProfile = {
  id?: string;
  name?: string;
  slug: string;
  level?: number;
  isActive?: boolean;
  permissions: string[];
  modules?: Array<{ key: string; access: "full" | "limited" | "view" | "none" }>;
};

const moduleLabels: Record<string, string> = {
  catalog: "Catálogo",
  orders: "Pedidos e operação",
  customers: "Clientes e atendimento",
  marketing: "Marketing",
  fiscal: "Fiscal e financeiro",
  integrations: "Integrações e governanca",
};

export default function AdminRbacSimulator() {
  const { isAdmin, loading } = useAdmin();
  const profiles = useAdminResource<PermissionProfile[]>(isAdmin ? "/api/admin/permissions/overview" : null, []);
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedProfile = useMemo(
    () => profiles.data.find((profile) => profile.slug === (selectedSlug || profiles.data[0]?.slug)),
    [profiles.data, selectedSlug],
  );
  const modules = selectedProfile?.modules || [];
  const blockedModules = modules.filter((module) => module.access === "none");
  const writableModules = modules.filter((module) => module.access === "full" || module.access === "limited");

  if (loading) return <AdminLoadingState label="Carregando simulador RBAC..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  return (
    <AdminWorkspaceShell
      eyebrow="Usuários e permissoes"
      title="Simulador RBAC administrativo"
      description="Simule a visao por perfil antes de alterar usuários reais. Esta tela e somente leitura e não concede permissoes."
      actions={<><Button asChild variant="outline"><Link to="/admin/usuarios"><UsersRound className="mr-2 h-4 w-4" />Usuarios</Link></Button><Button asChild><Link to="/admin/governanca">Governanca</Link></Button></>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Perfis" value={profiles.data.length} />
          <WorkspaceMetric label="Permissoes" value={selectedProfile?.permissions.length ?? 0} />
          <WorkspaceMetric label="Modulos com escrita" value={writableModules.length} tone={writableModules.length > 0 ? "ok" : "warn"} />
          <WorkspaceMetric label="Modulos bloqueados" value={blockedModules.length} tone={blockedModules.length > 0 ? "warn" : "ok"} />
        </div>

        <WorkspaceSection title="Selecionar perfil">
          <AdminOperationalToolbar
            title="Simulacao segura de acesso"
            description="Use antes de criar usuários, revisar cargo ou investigar acesso negado. Nenhuma alteracao e enviada ao backend."
            resultLabel={selectedProfile ? `perfil ${selectedProfile.slug}` : "sem perfil selecionado"}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {profiles.data.map((profile) => (
              <Button
                key={profile.slug}
                type="button"
                size="sm"
                variant={(selectedSlug || profiles.data[0]?.slug) === profile.slug ? "default" : "outline"}
                onClick={() => setSelectedSlug(profile.slug)}
              >
                {profile.name || profile.slug}
              </Button>
            ))}
          </div>
          {profiles.data.length === 0 ? (
            <AdminEmptyState title="Nenhum perfil RBAC retornado." description="Revise o endpoint de permissoes ou a carga inicial de perfis." />
          ) : null}
        </WorkspaceSection>

        <WorkspaceSection title="Mapa de acesso por modulo">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <AdminQueueCard
                key={module.key}
                title={moduleLabels[module.key] || module.key}
                description={getAccessDescription(module.access)}
                tone={module.access === "none" ? "danger" : module.access === "view" ? "warn" : "ok"}
                eyebrow={<Badge variant={module.access === "none" ? "destructive" : "outline"}>{module.access}</Badge>}
              />
            ))}
            {modules.length === 0 ? (
              <AdminEmptyState title="Perfil sem mapa modular." description="Permissoes diretas ainda podem existir, mas o menu não consegue simular a visao por area." />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Permissoes efetivas">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(selectedProfile?.permissions || []).slice(0, 48).map((permission) => (
              <div key={permission} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{permission}</span>
              </div>
            ))}
            {(selectedProfile?.permissions || []).length === 0 ? <p className="text-sm text-muted-foreground">Sem permissoes diretas para este perfil.</p> : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Checklist antes de alterar usuários">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["Confirme cargo real", "Revise modulos visiveis", "Valide permissoes destrutivas", "Registre motivo em auditoria"].map((item) => (
              <div key={item} className="rounded-lg border bg-background p-4">
                <p className="font-semibold">{item}</p>
                <p className="mt-1 text-sm text-muted-foreground">Ajustes reais devem ser feitos em Usuarios e perfis.</p>
              </div>
            ))}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}

function getAccessDescription(access: PermissionProfile["modules"][number]["access"]) {
  if (access === "full") return "Acesso completo ao modulo, incluindo acoes criticas conforme permissoes.";
  if (access === "limited") return "Acesso operacional limitado para rotinas do perfil.";
  if (access === "view") return "Somente consulta e acompanhamento.";
  return "Modulo oculto ou bloqueado para este perfil.";
}
