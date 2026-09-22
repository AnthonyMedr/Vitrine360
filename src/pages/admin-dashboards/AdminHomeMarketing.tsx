import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Megaphone, RefreshCw } from "lucide-react";
import { useAdminResource } from "@/hooks/useAdminResource";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type MarketingBanner = { id: string; name: string; status: string; placement: string; updated_at: string };
type MarketingCampaign = { id: string; name: string; status: string; updated_at: string };

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminHomeMarketing() {
  const banners = useAdminResource<MarketingBanner[]>("/api/admin/marketing/banners", []);
  const campaigns = useAdminResource<MarketingCampaign[]>("/api/admin/marketing/campaigns", []);

  const activeBanners = useMemo(() => banners.data.filter((banner) => banner.status === "active"), [banners.data]);
  const activeCampaigns = useMemo(() => campaigns.data.filter((campaign) => campaign.status === "active"), [campaigns.data]);
  const recentBanners = useMemo(
    () => [...banners.data].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6),
    [banners.data],
  );

  return (
    <AdminWorkspaceShell
      eyebrow="Painel GAMEL"
      title="Início"
      description="Campanhas, banners e vitrines do site."
      actions={<Button onClick={() => { void banners.reload(); void campaigns.reload(); }} variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetric label="Banners ativos" value={activeBanners.length} />
          <WorkspaceMetric label="Campanhas ativas" value={activeCampaigns.length} />
        </div>

        <WorkspaceSection title="Atalhos">
          <Link to="/admin/banners-vitrines" className="block rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
            <Megaphone className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Banners e vitrines</p>
            <p className="mt-1 text-sm text-muted-foreground">Editar banners da home, campanhas e vitrines de produtos.</p>
          </Link>
        </WorkspaceSection>

        <WorkspaceSection title="Últimos banners editados" action={<Button asChild size="sm" variant="outline"><Link to="/admin/banners-vitrines">Abrir banners</Link></Button>}>
          <div className="grid gap-3 lg:grid-cols-2">
            {recentBanners.map((banner) => (
              <AdminQueueCard
                key={banner.id}
                title={banner.name}
                description={`${banner.placement} - atualizado em ${formatDateTime(banner.updated_at)}`}
                tone={banner.status === "active" ? "ok" : "neutral"}
              />
            ))}
            {recentBanners.length === 0 ? (
              <AdminEmptyState title="Nenhum banner cadastrado ainda." description="Crie um banner para a home ou vitrines." />
            ) : null}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
