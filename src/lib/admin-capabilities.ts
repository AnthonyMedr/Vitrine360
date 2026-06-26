import type { AdminCapability, AdminRole } from "@/lib/admin-access";

export const adminNavigation = [
  { label: "Dashboard", to: "/admin", exact: true, capability: "view_dashboard" },
  { label: "Produtos", to: "/admin/produtos", capability: "manage_products" },
  { label: "Categorias", to: "/admin/categorias", capability: "manage_categories" },
  { label: "Campanhas", to: "/admin/campanhas", capability: "manage_campaigns" },
  { label: "Banners", to: "/admin/conteudo", capability: "manage_banners" },
  { label: "Midia", to: "/admin/midia", capability: "manage_media" },
  { label: "Loja", to: "/admin/loja", capability: "manage_store" },
  { label: "Totem", to: "/admin/totem", capability: "manage_totem" },
  { label: "Vitrine TV", to: "/admin/vitrine-tv", capability: "manage_vitrine" },
  { label: "Usuarios", to: "/admin/usuarios", capability: "manage_users" },
  { label: "Relatorios", to: "/admin/relatorios", capability: "view_reports" },
  {
    label: "Tecnico",
    to: "/admin/configuracoes-tecnicas",
    capability: "manage_technical",
  },
] satisfies Array<{
  label: string;
  to: string;
  exact?: boolean;
  capability: AdminCapability;
}>;

const adminRouteCapabilities: Array<{
  match: (pathname: string) => boolean;
  capability: AdminCapability;
}> = [
  {
    match: (pathname) => pathname === "/admin" || pathname === "/admin/",
    capability: "view_dashboard",
  },
  { match: (pathname) => pathname.startsWith("/admin/produtos"), capability: "manage_products" },
  {
    match: (pathname) => pathname.startsWith("/admin/categorias"),
    capability: "manage_categories",
  },
  { match: (pathname) => pathname.startsWith("/admin/campanhas"), capability: "manage_campaigns" },
  { match: (pathname) => pathname.startsWith("/admin/conteudo"), capability: "manage_banners" },
  { match: (pathname) => pathname.startsWith("/admin/midia"), capability: "manage_media" },
  { match: (pathname) => pathname.startsWith("/admin/loja"), capability: "manage_store" },
  { match: (pathname) => pathname.startsWith("/admin/totem"), capability: "manage_totem" },
  { match: (pathname) => pathname.startsWith("/admin/vitrine-tv"), capability: "manage_vitrine" },
  { match: (pathname) => pathname.startsWith("/admin/usuarios"), capability: "manage_users" },
  { match: (pathname) => pathname.startsWith("/admin/relatorios"), capability: "view_reports" },
  { match: (pathname) => pathname.startsWith("/admin/qrcodes"), capability: "view_reports" },
  { match: (pathname) => pathname.startsWith("/admin/seo"), capability: "view_reports" },
  {
    match: (pathname) => pathname.startsWith("/admin/configuracoes-tecnicas"),
    capability: "manage_technical",
  },
];

const capabilityLabels: Record<AdminCapability, string> = {
  view_dashboard: "Dashboard",
  manage_products: "Produtos",
  manage_categories: "Categorias",
  manage_campaigns: "Campanhas",
  manage_banners: "Banners",
  manage_media: "Midia",
  manage_store: "Loja",
  manage_totem: "Totem",
  manage_vitrine: "Vitrine TV",
  manage_users: "Usuarios",
  view_reports: "Relatorios",
  manage_technical: "Configuracoes tecnicas",
};

const roleLabels: Record<AdminRole, string> = {
  admin: "Administrador",
  infiniti_master: "InfiniTI Master",
  store_admin: "Administrador da Loja",
  commercial_operator: "Operador Comercial",
  editor: "Editor",
  viewer: "Visualizador",
};

export function getCapabilityLabel(capability: AdminCapability) {
  return capabilityLabels[capability] ?? capability;
}

export function getRoleLabel(role: AdminRole | string) {
  return roleLabels[role as AdminRole] ?? role;
}

export function hasAdminCapability(
  capabilities: AdminCapability[] | undefined,
  capability: AdminCapability,
) {
  return Boolean(capabilities?.includes(capability));
}

export function getRequiredCapabilityForAdminPath(pathname: string) {
  return adminRouteCapabilities.find((item) => item.match(pathname))?.capability ?? null;
}
