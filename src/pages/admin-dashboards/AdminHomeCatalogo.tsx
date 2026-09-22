import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Boxes, Image, Megaphone, PackageSearch, RefreshCw } from "lucide-react";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { AdminEmptyState, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

type CatalogImageAuditResponse = {
  active_summary: { suspect: number; critical: number; manual_review: number };
};

type MarketingBanner = { id: string; name: string; status: string; placement: string; updated_at: string };

const shortcuts = [
  { label: "Produtos", description: "Corrigir cadastro, imagem, texto e publicação.", href: "/admin/produtos", icon: PackageSearch },
  { label: "Categorias", description: "Organizar e revisar categorias do catálogo.", href: "/admin/catalogo", icon: Boxes },
  { label: "Mídia", description: "Organizar imagens do catálogo e materiais visuais.", href: "/admin/midia", icon: Image },
  { label: "Banners e vitrines", description: "Ajustar home, chamadas comerciais e vitrines.", href: "/admin/banners-vitrines", icon: Megaphone },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminHomeCatalogo() {
  const { data: products = [] } = useProducts({ limit: 200 });
  const imageAudit = useAdminResource<CatalogImageAuditResponse>("/api/admin/catalog/image-audit", {
    active_summary: { suspect: 0, critical: 0, manual_review: 0 },
  });
  const banners = useAdminResource<MarketingBanner[]>("/api/admin/marketing/banners", []);

  const productsPendingReview = useMemo(
    () => products.filter((product) => product.status_product === "draft" || product.image_review_status === "manual_review" || product.image_review_status === "suspect"),
    [products],
  );
  const recentBanners = useMemo(
    () => [...banners.data].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5),
    [banners.data],
  );

  return (
    <AdminWorkspaceShell
      eyebrow="Painel GAMEL"
      title="Início"
      description="Catálogo e conteúdo do site: produtos, categorias, imagens e banners."
      actions={<Button onClick={() => { void imageAudit.reload(); void banners.reload(); }} variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric label="Produtos para revisar" value={productsPendingReview.length} tone={productsPendingReview.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Imagens suspeitas" value={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical} tone={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical > 0 ? "danger" : "ok"} />
          <WorkspaceMetric label="Produtos no catálogo" value={products.length} />
        </div>

        <WorkspaceSection title="Atalhos">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <Link key={shortcut.href} to={shortcut.href} className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-semibold">{shortcut.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{shortcut.description}</p>
                </Link>
              );
            })}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Produtos pendentes de revisão" action={<Button asChild size="sm" variant="outline"><Link to="/admin/produtos">Ver todos</Link></Button>}>
          <div className="grid gap-3 lg:grid-cols-2">
            {productsPendingReview.slice(0, 6).map((product) => (
              <AdminQueueCard
                key={product.id}
                title={product.name}
                description={product.category?.name || "Sem categoria"}
                tone="warn"
                action={<Button asChild size="sm" variant="outline"><Link to={`/admin/produto/${product.id}`}>Revisar</Link></Button>}
              />
            ))}
            {productsPendingReview.length === 0 ? (
              <AdminEmptyState title="Nenhum produto pendente de revisão." description="Catálogo em dia." />
            ) : null}
          </div>
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
