import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import {
  adminNavigation,
  getRequiredCapabilityForAdminPath,
  getRoleLabel,
  hasAdminCapability,
} from "@/lib/admin-capabilities";
import { brandConfig } from "@/config/brand";
import { clearAdminSession, getStoredAdminEmail, hasStoredAdminSession } from "@/lib/admin-session";
import { getAdminProfileAdmin } from "@/lib/commercial.functions";
import { disableDevAdminBypass, getDevAdminEmail, isDevAdminBypassEnabled } from "@/lib/dev-admin";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Painel Administrativo` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const profileFn = useServerFn(getAdminProfileAdmin);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const isLoginRoute = useMemo(() => pathname === "/admin/login", [pathname]);

  const profileQuery = useQuery({
    queryKey: ["admin-profile"],
    queryFn: () => profileFn({ data: {} }),
    enabled: ready && !isLoginRoute && Boolean(email),
    retry: false,
  });

  useEffect(() => {
    if (isDevAdminBypassEnabled()) {
      setEmail(getDevAdminEmail());
      setReady(true);
      return;
    }

    setEmail(hasStoredAdminSession() ? getStoredAdminEmail() : null);
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!ready || isLoginRoute) return;
    if (!email) {
      router.navigate({ to: "/admin/login" });
    }
  }, [email, isLoginRoute, ready, router]);

  useEffect(() => {
    if (!profileQuery.error) return;

    clearAdminSession();
    if (isDevAdminBypassEnabled()) {
      disableDevAdminBypass();
    }
    router.navigate({ to: "/admin/login" });
  }, [profileQuery.error, router]);

  useEffect(() => {
    const capabilities = profileQuery.data?.capabilities;
    if (!ready || isLoginRoute || !email || !capabilities?.length) return;

    const requiredCapability = getRequiredCapabilityForAdminPath(pathname);
    if (!requiredCapability) return;
    if (hasAdminCapability(capabilities, requiredCapability)) return;

    const fallbackRoute =
      adminNavigation.find((item) => hasAdminCapability(capabilities, item.capability))?.to ??
      "/admin/login";
    if (pathname !== fallbackRoute) {
      router.navigate({ to: fallbackRoute });
    }
  }, [email, isLoginRoute, pathname, profileQuery.data?.capabilities, ready, router]);

  const visibleNav = useMemo(() => {
    const capabilities = profileQuery.data?.capabilities;
    if (!capabilities?.length) return adminNavigation.filter((item) => item.to === "/admin");
    return adminNavigation.filter((item) => hasAdminCapability(capabilities, item.capability));
  }, [profileQuery.data?.capabilities]);

  const profileSummary = useMemo(() => {
    if (!profileQuery.data?.roles?.length) return null;
    return profileQuery.data.roles.map((role) => getRoleLabel(role)).join(", ");
  }, [profileQuery.data?.roles]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-brand text-brand-foreground shadow-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2 font-display text-3xl">
            <ShieldCheck className="size-5 text-action" /> Vitrine360 Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-xs font-bold uppercase tracking-[0.2em]">
            {visibleNav.map(({ label, to, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: exact ?? to === "/admin" }}
                className="rounded-full px-3 py-1.5 hover:bg-white/8 [&.active]:bg-action [&.active]:text-action-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-brand-foreground/60 xl:inline">
              {brandConfig.signature}
            </span>
            {!isLoginRoute && email && profileQuery.isLoading && (
              <span className="hidden items-center gap-1 opacity-80 md:inline-flex">
                <Loader2 className="size-3 animate-spin" /> validando acesso
              </span>
            )}
            {!isLoginRoute && profileSummary && (
              <span className="hidden rounded-full border border-white/10 bg-white/6 px-3 py-1.5 font-bold md:inline-flex">
                {profileSummary}
              </span>
            )}
            {email && <span className="hidden opacity-80 sm:inline">{email}</span>}
            {email && (
              <button
                onClick={() => {
                  if (isDevAdminBypassEnabled()) {
                    disableDevAdminBypass();
                  }
                  clearAdminSession();
                  router.navigate({ to: "/admin/login" });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 font-bold hover:bg-white/10"
              >
                <LogOut className="size-3.5" /> Sair
              </button>
            )}
          </div>
        </div>
      </header>
      {isLoginRoute ? (
        <Outlet />
      ) : !ready ? (
        <div className="grid min-h-[40vh] place-items-center px-4">
          <div className="text-sm text-muted-foreground">Carregando sessao administrativa...</div>
        </div>
      ) : email && profileQuery.isLoading ? (
        <div className="grid min-h-[40vh] place-items-center px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando perfil administrativo...
          </div>
        </div>
      ) : email ? (
        <Outlet />
      ) : null}
      <div className="px-4 py-3 text-center text-[11px] text-muted-foreground">
        {brandConfig.signature}
      </div>
    </div>
  );
}
