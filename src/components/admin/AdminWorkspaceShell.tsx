import { useMemo, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Boxes, ClipboardList, FileText, Home, Image, LogOut, Megaphone, MessageSquareText, PackageSearch, ShieldCheck, Settings, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { resolveAdminPersona, resolveAdminProfileId, type AdminPersona } from "@/lib/adminProfile";

const ALL_PERSONAS: AdminPersona[] = ["administrador", "comercial", "catalogo_conteudo", "marketing", "visualizacao_diretoria"];

const navigation = [
  { label: "Início", href: "/admin", icon: Home, personas: ALL_PERSONAS, group: "Início" },
  { label: "Produtos", href: "/admin/produtos", icon: PackageSearch, personas: ["administrador", "catalogo_conteudo"] as AdminPersona[], group: "Catálogo", activePaths: ["/admin/produto/"] },
  { label: "Categorias", href: "/admin/catalogo", icon: Boxes, personas: ["administrador", "catalogo_conteudo"] as AdminPersona[], group: "Catálogo" },
  { label: "Mídia e imagens", href: "/admin/midia", icon: Image, personas: ["administrador", "catalogo_conteudo"] as AdminPersona[], group: "Catálogo" },
  { label: "Banners e vitrines", href: "/admin/banners-vitrines", icon: Megaphone, personas: ["administrador", "catalogo_conteudo", "marketing"] as AdminPersona[], group: "Catálogo" },
  { label: "Orçamentos", href: "/admin/orçamentos", icon: MessageSquareText, personas: ["administrador", "comercial"] as AdminPersona[], group: "Comercial", activePaths: ["/admin/orçamentos/"] },
  { label: "Operação", href: "/admin/operação", icon: ClipboardList, personas: ["administrador", "comercial"] as AdminPersona[], group: "Comercial" },
  { label: "Relatórios", href: "/admin/relatorios", icon: BarChart3, personas: ["administrador", "comercial", "visualizacao_diretoria"] as AdminPersona[], group: "Comercial" },
  { label: "Usuários e permissões", href: "/admin/usuarios", icon: UsersRound, personas: ["administrador"] as AdminPersona[], group: "Governança" },
  { label: "Governança", href: "/admin/governanca", icon: ShieldCheck, personas: ["administrador"] as AdminPersona[], group: "Governança" },
  { label: "Auditoria", href: "/admin/audit-logs", icon: FileText, personas: ["administrador"] as AdminPersona[], group: "Governança" },
  { label: "Segurança", href: "/admin/segurança", icon: ShieldCheck, personas: ["administrador"] as AdminPersona[], group: "Governança" },
  { label: "Configurações", href: "/admin/configuracoes", icon: Settings, personas: ["administrador"] as AdminPersona[], group: "Governança" },
  { label: "Documentação", href: "/admin/documentacao", icon: FileText, personas: ["administrador", "catalogo_conteudo"] as AdminPersona[], group: "Governança" },
];

type NavigationItem = (typeof navigation)[number];

type PermissionProfile = {
  slug: string;
  permissions: string[];
  modules: Array<{ key: string; access: "full" | "limited" | "view" | "none" }>;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isNavigationActive(pathname: string, item: NavigationItem) {
  const normalizedPathname = safeDecode(pathname);
  if (item.href === "/admin") return normalizedPathname === "/admin";
  return (
    normalizedPathname === item.href ||
    Boolean("activePaths" in item && item.activePaths?.some((path) => normalizedPathname.startsWith(path)))
  );
}

export function AdminWorkspaceShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, signOut } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate("/admin", { replace: true });
  };
  const profiles = useAdminResource<PermissionProfile[]>("/api/admin/permissions/overview", []);
  const currentProfileId = resolveAdminProfileId(user);
  const currentProfile = profiles.data.find((profile) => profile.slug === currentProfileId);
  const persona = resolveAdminPersona(currentProfileId);
  const visibleNavigation = useMemo(() => navigation.filter((item) => item.personas.includes(persona)), [persona]);
  const currentNavigationItem = useMemo(
    () => visibleNavigation.find((item) => isNavigationActive(location.pathname, item)) ?? navigation.find((item) => isNavigationActive(location.pathname, item)),
    [location.pathname, visibleNavigation],
  );
  const profileLabel = currentProfile?.slug || currentProfileId || user?.role || "admin";

  return (
    <div className="min-h-screen bg-muted/30">
      <a href="#admin-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground">
        Ir para conteudo principal
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-black px-4 py-5 text-white lg:flex">
        <Link to="/admin" className="flex shrink-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden" aria-hidden="true">
            <img src="/assets/brand/gamel-icone-512.png" alt="" className="scale-[1.55]" />
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight tracking-[0.02em] text-white">GAMEL</p>
            <p className="text-xs text-white/55">Painel administrativo</p>
          </div>
        </Link>

        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Navegacao administrativa">
          {visibleNavigation.map((item, index) => {
            const Icon = item.icon;
            const isFirstInGroup = index === 0 || visibleNavigation[index - 1].group !== item.group;
            const active = isNavigationActive(location.pathname, item);
            return (
              <div key={item.href}>
                {isFirstInGroup && item.group !== "Início" ? (
                  <p className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{item.group}</p>
                ) : null}
                <NavLink
                  to={item.href}
                  end={item.href === "/admin"}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground" : "text-white/72 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </div>
            );
          })}
          {profiles.loading && !currentProfile ? (
            <p className="px-3 py-2 text-xs text-white/50">Carregando permissoes do perfil...</p>
          ) : null}
        </nav>

        <div className="mt-4 shrink-0 rounded-xl border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sessão</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{user?.user_metadata?.full_name || user?.email || "Admin"}</p>
          <Badge className="mt-2" variant="outline">{profileLabel}</Badge>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Caminho administrativo">
                <Link to="/admin" className="font-medium text-primary hover:underline">Admin</Link>
                {currentNavigationItem && currentNavigationItem.href !== "/admin" ? (
                  <>
                    <span>/</span>
                    <Link to={currentNavigationItem.href} className="font-medium text-foreground hover:underline">{currentNavigationItem.label}</Link>
                  </>
                ) : null}
              </nav>
              {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
              <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
              {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground sm:flex" aria-label="Perfil administrativo">
                <span className="font-semibold text-foreground">{profileLabel}</span>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Site
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
              {actions}
            </div>
          </div>
          <div className="border-t px-4 py-2 lg:hidden">
            <label className="sr-only" htmlFor="admin-mobile-module-select">Selecionar modulo administrativo</label>
            <select
              id="admin-mobile-module-select"
              value={currentNavigationItem?.href ?? "/admin"}
              onChange={(event) => navigate(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {visibleNavigation.map((item) => (
                <option key={item.href} value={item.href}>{item.group} - {item.label}</option>
              ))}
            </select>
          </div>
        </header>
        <main id="admin-main-content" className="mx-auto max-w-7xl px-4 py-6 md:py-7">{children}</main>
      </div>
    </div>
  );
}

export function WorkspaceMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-foreground";
  return (
    <div className="content-auto rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${toneClass}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function WorkspaceSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="content-auto rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
