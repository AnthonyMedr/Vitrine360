export const gamelScope = {
  activeModules: ["catalogo", "admin", "carrinho"],
  frozenModules: ["totem", "representante", "vitrine-tv", "qrcodes", "inteligencia-comercial"],
  frozenPublicRedirect: "/produtos",
  frozenAdminRedirect: "/admin",
  hiddenAdminRoutes: [
    "/admin/totem",
    "/admin/vitrine-tv",
    "/admin/qrcodes",
    "/admin/relatorios",
    "/admin/seo",
    "/admin/seo-agendamentos",
  ],
} as const;

export function isHiddenAdminRoute(path: string) {
  return gamelScope.hiddenAdminRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}
