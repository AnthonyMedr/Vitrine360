import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { KeyRound, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdminEmptyState, AdminLoadingState, AdminOperationalToolbar } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  profileId: string | null;
  profileSlug: string | null;
  profileName: string | null;
  level: number;
  jobTitle: string | null;
  storeId: string | null;
  storeName: string | null;
  canStartAssistedSale: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

type PermissionProfile = {
  id: string;
  slug: string;
  name: string;
  description: string;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
  modules: Array<{ key: string; label: string; access: "full" | "limited" | "view" | "none" }>;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  profileId: string;
  jobTitle: string;
  storeId: string;
  storeName: string;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  profileId: "comercial",
  jobTitle: "",
  storeId: "garanhuns",
  storeName: "Showroom Garanhuns",
};

export default function AdminUsers() {
  const { isAdmin, loading, user } = useAdmin();
  const users = useAdminResource<AdminUser[]>(isAdmin ? "/api/admin/users" : null, []);
  const roles = useAdminResource<PermissionProfile[]>(isAdmin ? "/api/admin/roles" : null, []);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [passwordByUser, setPasswordByUser] = useState<Record<string, string>>({});

  const sortedRoles = useMemo(() => roles.data.slice().sort((a, b) => b.level - a.level), [roles.data]);
  const visibleUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.data.filter((entry) => {
      const matchesRole = roleFilter === "all" || entry.profileSlug === roleFilter || entry.profileId === roleFilter;
      const matchesQuery =
        query.length === 0
        || entry.name.toLowerCase().includes(query)
        || entry.email.toLowerCase().includes(query)
        || String(entry.jobTitle ?? "").toLowerCase().includes(query)
        || String(entry.storeName ?? "").toLowerCase().includes(query);
      return matchesRole && matchesQuery;
    });
  }, [roleFilter, userQuery, users.data]);
  const activeUsers = users.data.filter((entry) => entry.isActive);
  const inactiveUsers = users.data.length - activeUsers.length;
  const adminMasters = users.data.filter((entry) => entry.isActive && ["administrador", "admin_master"].includes(String(entry.profileSlug))).length;
  const rawCurrentProfile = user?.user_metadata?.permission_profile_id || "administrador";
  const currentProfile = rawCurrentProfile === "admin_master" || rawCurrentProfile === "admin" ? "administrador" : rawCurrentProfile;

  if (loading) return <AdminLoadingState label="Carregando usuários e perfis..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const reloadAll = () => {
    void users.reload();
    void roles.reload();
  };

  const updateForm = (key: keyof UserForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<AdminUser>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          profileId: form.profileId,
          jobTitle: form.jobTitle,
          storeId: form.storeId || null,
          storeName: form.storeName || null,
          isActive: true,
        }),
      });
      setForm(emptyForm);
      setMessage("Usuário administrativo criado com auditoria registrada.");
      await users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuário administrativo.");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (target: AdminUser, payload: Partial<{ profileId: string; isActive: boolean; jobTitle: string; password: string }>) => {
    setUpdatingId(target.id);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<AdminUser>(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (payload.password) {
        setPasswordByUser((current) => ({ ...current, [target.id]: "" }));
      }
      setMessage("Usuário atualizado com auditoria registrada.");
      await users.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuário administrativo.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminWorkspaceShell
      eyebrow="Governanca e acesso"
      title="Usuários, perfis e hierarquia"
      description="Crie usuários administrativos da Fase 1, defina perfis simples e mantenha auditoria das alteracoes criticas."
      actions={
        <>
          <Button variant="outline" onClick={reloadAll}>
            <RefreshCw className="mr-2 h-4 w-4" />Atualizar
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/audit-logs">Auditoria</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {(users.error || roles.error) ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Esta tela exige permissao `users.manage` e `roles.manage`. Perfil atual: {currentProfile}. Detalhe: {users.error || roles.error}
          </div>
        ) : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <WorkspaceMetric label="Usuários admin" value={users.data.length} detail={`${activeUsers.length} ativos`} />
          <WorkspaceMetric label="Administradores ativos" value={adminMasters} detail="Nunca desativar o ultimo administrador" tone={adminMasters > 0 ? "ok" : "danger"} />
          <WorkspaceMetric label="Usuários inativos" value={inactiveUsers} tone={inactiveUsers > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Perfis oficiais" value={roles.data.length} detail="perfis de sistema" />
          <WorkspaceMetric label="Maior nivel" value={sortedRoles[0]?.level ?? 0} detail={sortedRoles[0]?.name ?? "sem perfil"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <WorkspaceSection title="Criar usuário administrativo">
            <form className="space-y-4" onSubmit={createUser}>
              <div className="grid gap-2">
                <Label htmlFor="admin-name">Nome</Label>
                <Input id="admin-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nome do operador" required minLength={3} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-email">E-mail</Label>
                <Input id="admin-email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="operador@empresa.com.br" type="email" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-password">Senha temporaria</Label>
                <Input id="admin-password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} type="password" minLength={8} required />
                <p className="text-xs text-muted-foreground">A senha e enviada somente na criacao. Hash/salt nunca retornam ao frontend.</p>
              </div>
              <div className="grid gap-2">
                <Label>Perfil</Label>
                <Select value={form.profileId} onValueChange={(value) => updateForm("profileId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedRoles.map((role) => (
                      <SelectItem key={role.slug} value={role.slug}>
                        {role.name} - nivel {role.level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-job">Cargo operacional</Label>
                <Input id="admin-job" value={form.jobTitle} onChange={(event) => updateForm("jobTitle", event.target.value)} placeholder="Opcional; usa nome do perfil se vazio" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="admin-store-id">Loja</Label>
                  <Input id="admin-store-id" value={form.storeId} onChange={(event) => updateForm("storeId", event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-store-name">Nome da loja</Label>
                  <Input id="admin-store-name" value={form.storeName} onChange={(event) => updateForm("storeName", event.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={saving || roles.data.length === 0} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />{saving ? "Criando..." : "Criar usuário"}
              </Button>
            </form>
          </WorkspaceSection>

          <WorkspaceSection title="Usuários administrativos">
            <AdminOperationalToolbar
              title="Controle de usuários"
              description="Filtre operadores, ajuste perfis, redefina senha temporaria e mantenha usuários inativos sem exclusao destrutiva."
              resultLabel={`${visibleUsers.length} usuário(s) visivel(is)`}
            />
            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px]">
              <Input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Buscar usuário, email, cargo ou loja" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os perfis</SelectItem>
                  {sortedRoles.map((role) => (
                    <SelectItem key={role.slug} value={role.slug}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {visibleUsers.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{entry.name}</p>
                        <Badge variant={entry.isActive ? "default" : "secondary"}>{entry.isActive ? "ativo" : "inativo"}</Badge>
                        <Badge variant={["administrador", "admin_master"].includes(String(entry.profileSlug)) ? "destructive" : "outline"}>nivel {entry.level}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.email}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.profileName || "Perfil não definido"} - {entry.jobTitle || "sem cargo"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ultimo login: {entry.lastLoginAt ? new Date(entry.lastLoginAt).toLocaleString("pt-BR") : "sem registro"} - Atualizado: {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("pt-BR") : "sem registro"}
                      </p>
                    </div>
                    <div className="grid min-w-72 gap-3">
                      <Select value={entry.profileSlug || entry.profileId || ""} onValueChange={(value) => updateUser(entry, { profileId: value })} disabled={updatingId === entry.id}>
                        <SelectTrigger>
                          <SelectValue placeholder="Perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedRoles.map((role) => (
                            <SelectItem key={role.slug} value={role.slug}>
                              {role.name} - nivel {role.level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm font-medium">Usuario ativo</span>
                        <Switch
                          checked={entry.isActive}
                          onCheckedChange={(checked) => {
                            if (!checked && !window.confirm(`Desativar o acesso de ${entry.name || entry.email}? A pessoa não vai mais conseguir entrar no painel.`)) return;
                            void updateUser(entry, { isActive: checked });
                          }}
                          disabled={updatingId === entry.id}
                        />
                      </div>
                      <div className="grid gap-2 rounded-md border p-3">
                        <Label htmlFor={`reset-${entry.id}`}>Senha temporaria</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id={`reset-${entry.id}`}
                            value={passwordByUser[entry.id] ?? ""}
                            onChange={(event) => setPasswordByUser((current) => ({ ...current, [entry.id]: event.target.value }))}
                            type="password"
                            minLength={8}
                            placeholder="Nova senha temporaria"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={updatingId === entry.id || (passwordByUser[entry.id] ?? "").trim().length < 8}
                            onClick={() => updateUser(entry, { password: (passwordByUser[entry.id] ?? "").trim() })}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />Redefinir
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">A senha nova invalida sessao antiga e nao volta no payload da API.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {visibleUsers.length === 0 ? (
                <AdminEmptyState
                  title="Nenhum usuário encontrado"
                  description="Revise busca, perfil filtrado ou atualize a lista antes de criar outro acesso administrativo."
                />
              ) : null}
            </div>
          </WorkspaceSection>
        </div>

        <WorkspaceSection title="Matriz operacional por perfil">
          <AdminOperationalToolbar
            title="Matriz de responsabilidades"
            description="Use a matriz para orientar treinamento, segregacao de funcoes e liberacao segura das rotinas de catálogo, orçamento e go-live."
            resultLabel={`${roleOperationalMatrix.length} perfil(is) operacional(is)`}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roleOperationalMatrix.map((entry) => (
              <div key={entry.profile} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entry.priority === "critico" ? "destructive" : entry.priority === "operacional" ? "outline" : "secondary"}>{entry.priority}</Badge>
                  <p className="font-semibold">{entry.profile}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{entry.scope}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <p><strong>Tela principal:</strong> {entry.screen}</p>
                  <p><strong>Faz:</strong> {entry.does}</p>
                  <p><strong>Nao faz:</strong> {entry.doesNot}</p>
                </div>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Hierarquia oficial de perfis">
          <AdminOperationalToolbar
            title="Hierarquia RBAC"
            description="Confira nivel, permissoes explicitas e acessos por modulo antes de conceder privilegio administrativo."
            resultLabel={`${sortedRoles.length} perfil(is) oficial(is)`}
          />
          <div className="space-y-3">
            {sortedRoles.map((role) => (
              <div key={role.slug} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{role.name}</p>
                      <Badge variant={role.isActive ? "default" : "secondary"}>nivel {role.level}</Badge>
                      {role.isSystem ? <Badge variant="outline">sistema</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{role.permissions.includes("*") ? "Todas as permissoes" : `${role.permissions.length} permissoes explicitas`}</p>
                  </div>
                  <div className="grid min-w-[280px] gap-2 sm:grid-cols-2">
                    {role.modules.map((module) => (
                      <div key={`${role.slug}-${module.key}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                        <span>{module.label}</span>
                        <Badge variant={module.access === "full" ? "default" : module.access === "none" ? "secondary" : "outline"}>{module.access}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Regras de segurança desta tela">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SafetyItem title="Somente Administrador" detail="A API exige `users.manage` e `roles.manage`; perfis inferiores recebem 403." />
            <SafetyItem title="Sem exclusao destrutiva" detail="Usuários são ativados/desativados. O ultimo Administrador ativo não pode ser rebaixado ou desativado." />
            <SafetyItem title="Auditoria obrigatoria" detail="Criacao e alteracao geram `admin.user_created` e `admin.user_updated`." />
            <SafetyItem title="Senha protegida" detail="Senha e aceita apenas em POST/PATCH; hash, salt e token de sessao não voltam ao frontend." />
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}

function SafetyItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

const roleOperationalMatrix = [
  {
    profile: "Administrador",
    priority: "critico",
    scope: "Dono técnico-operacional da Fase 1.",
    screen: "Inicio, Usuários, Go-live e todos os modulos ativos",
    does: "cria usuários, troca perfis, aprova configurações criticas, publica catálogo e audita operação.",
    doesNot: "mantem modulos futuros fora da operação da Fase 1.",
  },
  {
    profile: "Comercial",
    priority: "operacional",
    scope: "Atendimento de leads e solicitações de orçamento.",
    screen: "Orcamentos / Leads",
    does: "registra retorno, responsável, status, observacoes internas e continuidade no WhatsApp.",
    doesNot: "não converte solicitação em fluxo transacional nesta fase.",
  },
  {
    profile: "Catálogo e conteúdo",
    priority: "operacional",
    scope: "Produto, categoria, imagem, SEO e publicação.",
    screen: "Produtos, Categorias / Catálogo e Midia",
    does: "corrige nome, slug, categoria, descrição, medidas, especificações, imagem e alt text.",
    doesNot: "não habilita modulos operacionais avancados fora do catálogo inteligente.",
  },
  {
    profile: "Marketing",
    priority: "operacional",
    scope: "Banners, vitrines e campanhas institucionais.",
    screen: "Banners e vitrines",
    does: "gerencia hero, categorias em destaque, produtos em destaque e CTAs de orçamento/WhatsApp.",
    doesNot: "não publica campanha voltada a fluxo transacional nesta fase.",
  },
  {
    profile: "Visualizacao/Diretoria",
    priority: "consulta",
    scope: "Acompanhamento executivo sem edicao operacional.",
    screen: "Inicio / Dashboard e Go-live",
    does: "acompanha indicadores, pendencias reais e evolucao da homologacao.",
    doesNot: "não edita produto, imagem, usuário, lead ou configuração critica.",
  },
] as const;
