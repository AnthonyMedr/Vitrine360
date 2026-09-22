import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminCapabilities } from "@/hooks/useAdminCapabilities";
import { resolveAdminPersona, type AdminPersona } from "@/lib/adminProfile";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";

const AdminHomeAdministrador = lazy(() => import("./admin-dashboards/AdminHomeAdministrador"));
const AdminHomeCatalogo = lazy(() => import("./admin-dashboards/AdminHomeCatalogo"));
const AdminHomeComercial = lazy(() => import("./admin-dashboards/AdminHomeComercial"));
const AdminHomeMarketing = lazy(() => import("./admin-dashboards/AdminHomeMarketing"));
const AdminHomeDiretoria = lazy(() => import("./admin-dashboards/AdminHomeDiretoria"));

const DASHBOARD_BY_PERSONA: Record<AdminPersona, () => JSX.Element> = {
  administrador: () => <AdminHomeAdministrador />,
  comercial: () => <AdminHomeComercial />,
  catalogo_conteudo: () => <AdminHomeCatalogo />,
  marketing: () => <AdminHomeMarketing />,
  visualizacao_diretoria: () => <AdminHomeDiretoria />,
};

export default function AdminHome() {
  const { isAdmin, loading } = useAdmin();
  const { profileId, loading: profileLoading } = useAdminCapabilities();

  if (loading || profileLoading) return <AdminLoadingState label="Carregando painel..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const persona = resolveAdminPersona(profileId);
  const Dashboard = DASHBOARD_BY_PERSONA[persona] ?? DASHBOARD_BY_PERSONA.administrador;

  return (
    <Suspense fallback={<AdminLoadingState label="Carregando painel..." />}>
      <Dashboard />
    </Suspense>
  );
}
