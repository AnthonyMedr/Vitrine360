import { type ChangeEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Copy, RefreshCw, Trash2, Upload } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { AdminEmptyState, AdminLoadingState, AdminOperationalToolbar, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { catalogCategoryCovers, catalogImagePlan, catalogOptionalPackages, catalogPlannedAssets } from "@/data/catalogImagePlan";

type MediaAsset = {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "icon" | "other";
  url: string;
  alt_text: string | null;
  usage: string;
  status: string;
  metadata_json?: { size_bytes?: number; original_filename?: string };
  created_at: string;
};

type MediaLibraryItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  image_url: string;
  media_role: "primary" | "gallery";
  category_name: string | null;
  audit_status: "ok" | "manual_review" | "suspect" | "critical";
  review_status: string | null;
  review_notes: string | null;
  approved_for_public_use: boolean;
  used_in_home: boolean;
  used_in_campaigns: string[];
  used_in_landings: string[];
  used_in_pdp: boolean;
  risk: "low" | "medium" | "high";
};

type MediaUsageMapItem = {
  image_id: string;
  image_url: string;
  product_id: string;
  product_name: string;
  campaigns_using: string[];
  landing_pages_using: string[];
  home_using: boolean;
  pdp_using: boolean;
  approval_status: string | null;
  risk: "low" | "medium" | "high";
};

export default function AdminMediaLibrary() {
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const library = useAdminResource<MediaLibraryItem[]>(isAdmin ? "/api/admin/media-library" : null, []);
  const usageMap = useAdminResource<MediaUsageMapItem[]>(isAdmin ? "/api/admin/media-library/usage-map" : null, []);
  const assets = useAdminResource<MediaAsset[]>(isAdmin ? "/api/admin/marketing/assets" : null, []);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  if (loading) return <AdminLoadingState label="Carregando biblioteca de midia..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  async function handleAssetUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast({ title: "Formato não suportado", description: "Envie um arquivo JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 5MB por arquivo.", variant: "destructive" });
      return;
    }
    setUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      await apiFetch("/api/admin/media-assets/upload", { method: "POST", body: formData });
      toast({ title: "Arquivo enviado", description: "Já disponível para reuso em banners, categorias e produtos." });
      await assets.reload();
    } catch (error) {
      toast({ title: "Falha no upload", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingAsset(false);
    }
  }

  async function copyAssetUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "URL copiada", description: "Cole em qualquer campo de imagem do painel." });
    } catch {
      toast({ title: "Não foi possível copiar", description: url, variant: "destructive" });
    }
  }

  async function deleteAsset(id: string, name: string) {
    if (!window.confirm(`Excluir "${name}" da biblioteca? Isso não afeta usos já salvos por URL em outros lugares.`)) return;
    try {
      await apiFetch(`/api/admin/marketing/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast({ title: "Arquivo excluído" });
      await assets.reload();
    } catch (error) {
      toast({ title: "Falha ao excluir", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  }

  const summary = {
    total: library.data.length,
    approved: library.data.filter((item) => item.approved_for_public_use).length,
    pending: library.data.filter((item) => item.review_status === "manual_review" || item.review_status === null).length,
    rejected: library.data.filter((item) => item.review_status === "rejected").length,
  };

  async function review(id: string, decision: "approved" | "manual_review" | "suspect" | "rejected" | "reopen") {
    try {
      await apiFetch(`/api/admin/media-library/${encodeURIComponent(id)}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast({ title: "Revisão de midia atualizada" });
      await library.reload();
      await usageMap.reload();
    } catch (error) {
      toast({
        title: "Falha na revisão da midia",
        description: error instanceof Error ? error.message : "Revise permissao e estado da imagem.",
        variant: "destructive",
      });
    }
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Midia"
      title="Midia e revisão visual"
      description="Biblioteca derivada do catálogo para identificar produtos sem imagem, imagens duplicadas, imagens genericas, divergencias de categoria, alt text e status visual: pendente, aprovada, suspeita ou reprovada."
      actions={
        <>
          <Button variant="outline" onClick={() => { void library.reload(); void usageMap.reload(); void assets.reload(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/produtos">Abrir produtos</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Arquivos indexados" value={summary.total} />
          <WorkspaceMetric label="Aprovadas" value={summary.approved} tone={summary.approved > 0 ? "ok" : "warn"} />
          <WorkspaceMetric label="Pendentes" value={summary.pending} tone={summary.pending > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Reprovadas" value={summary.rejected} tone={summary.rejected > 0 ? "danger" : "ok"} />
        </div>

        <WorkspaceSection title="Biblioteca de mídia">
          <AdminOperationalToolbar
            title="Arquivos avulsos para reuso"
            description="Envie imagens uma vez e reutilize em banners, categorias ou produtos copiando a URL. Diferente da fila abaixo, estes arquivos não ficam presos a um produto específico."
            resultLabel={`${assets.data.length} arquivo(s) na biblioteca`}
          />
          <div className="mb-4">
            <Label htmlFor="media-asset-upload-input">Enviar novo arquivo (JPG, PNG ou WEBP, até 5MB)</Label>
            <Input
              id="media-asset-upload-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAssetUpload}
              disabled={uploadingAsset}
              className="mt-1 max-w-md"
            />
            {uploadingAsset ? <p className="mt-1 text-xs text-muted-foreground">Enviando...</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.data.map((asset) => (
              <div key={asset.id} className="overflow-hidden rounded-lg border bg-card">
                <div className="aspect-square bg-muted">
                  <img src={asset.url} alt={asset.alt_text || asset.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium" title={asset.name}>{asset.name}</p>
                  <Badge variant="outline" className="text-[10px]">{asset.usage}</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => void copyAssetUrl(asset.url)}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copiar URL
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteAsset(asset.id, asset.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {assets.data.length === 0 ? (
            <AdminEmptyState
              title="Nenhum arquivo avulso enviado ainda."
              description="Use o campo acima para enviar imagens que serão reutilizadas em banners, categorias e outros lugares do site."
            />
          ) : null}
        </WorkspaceSection>

        <WorkspaceSection title="Plano mestre de imagens V4">
          <AdminOperationalToolbar
            title="Cobertura planejada do catálogo"
            description="Manifesto nominal importado da planilha V4. Imagens de produto e variação exigem fonte original/aprovada; ambientações devem respeitar a referência exata do item."
            resultLabel={`${catalogPlannedAssets.length} assets obrigatórios`}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetric label="Produtos planejados" value={catalogImagePlan.length} />
            <WorkspaceMetric label="Assets obrigatórios" value={catalogPlannedAssets.length} tone="warn" />
            <WorkspaceMetric label="Capas de categoria" value={catalogCategoryCovers.length} tone="warn" />
            <WorkspaceMetric label="Embalagens opcionais" value={catalogOptionalPackages.length} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {catalogImagePlan.map((item) => (
              <AdminQueueCard
                key={item.productId}
                title={item.product}
                description={`${item.category} · ${item.requiredAssets} arquivo(s) obrigatório(s)`}
                tone={item.status.toLowerCase() === "pendente" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{item.productId}</Badge><Badge variant="outline">{item.status}</Badge></>}
                meta={<div className="space-y-1 text-xs leading-5"><p><strong>Ambientação:</strong> {item.recommendedEnvironment}</p><p><strong>Detalhes:</strong> {item.technicalDetails}</p><p><strong>Variações:</strong> {item.variations || "confirmar"}</p></div>}
              />
            ))}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Fila de revisão visual">
          <AdminOperationalToolbar
            title="Governanca visual"
            description="Revise imagens usadas em PDP, home, campanhas e landings antes de liberar uso publico."
            resultLabel={`${library.data.length} arquivo(s) na biblioteca`}
          />
          <div className="space-y-3">
            {library.data.slice(0, 18).map((item) => (
              <AdminQueueCard
                key={item.id}
                title={item.product_name}
                description={`${item.sku || "sem sku"} - ${item.category_name || "Sem categoria"}`}
                tone={item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{item.media_role}</Badge><Badge variant={item.risk === "high" ? "destructive" : item.risk === "medium" ? "outline" : "default"}>{item.audit_status}</Badge></>}
                meta={
                  <div className="space-y-2">
                    <p className="break-all">{item.image_url}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.used_in_home ? <Badge variant="outline">home</Badge> : null}
                      {item.used_in_pdp ? <Badge variant="outline">pdp</Badge> : null}
                      {item.used_in_campaigns.length > 0 ? <Badge variant="outline">{item.used_in_campaigns.length} campanha(s)</Badge> : null}
                      {item.used_in_landings.length > 0 ? <Badge variant="outline">{item.used_in_landings.length} landing(s)</Badge> : null}
                    </div>
                  </div>
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void review(item.id, "manual_review")}>Pendente</Button>
                    <Button size="sm" variant="outline" onClick={() => void review(item.id, "suspect")}>Suspeita</Button>
                    <Button size="sm" variant="destructive" onClick={() => void review(item.id, "rejected")}>Reprovada</Button>
                    <Button size="sm" variant="outline" onClick={() => void review(item.id, "reopen")}>Reabrir</Button>
                    <Button size="sm" onClick={() => void review(item.id, "approved")}>Aprovada</Button>
                  </div>
                }
              />
            ))}
            {library.data.length === 0 ? (
              <AdminEmptyState title="Nenhuma midia indexada." description="As imagens vinculadas ao catálogo aparecerao aqui para revisão visual." />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Mapa de uso visual">
          <AdminOperationalToolbar
            title="Mapa de uso visual"
            description="Entenda onde cada imagem aparece antes de aprovar, reabrir ou bloquear uma campanha."
            resultLabel={`${usageMap.data.length} imagem(ns) mapeada(s)`}
          />
          <div className="space-y-3">
            {usageMap.data.slice(0, 12).map((item) => (
              <AdminQueueCard
                key={item.image_id}
                title={item.product_name}
                description={`Home: ${item.home_using ? "sim" : "não"} | PDP: ${item.pdp_using ? "sim" : "não"} | Campanhas: ${item.campaigns_using.length} | Landings: ${item.landing_pages_using.length}`}
                tone={item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "neutral"}
                eyebrow={<><Badge variant="outline">{item.approval_status || "sem revisão"}</Badge><Badge variant={item.risk === "high" ? "destructive" : item.risk === "medium" ? "outline" : "default"}>{item.risk}</Badge></>}
                meta={<p className="break-all">{item.image_url}</p>}
              />
            ))}
            {usageMap.data.length === 0 ? (
              <AdminEmptyState title="Nenhum uso visual mapeado." description="Quando imagens forem usadas em home, PDP, campanhas ou landings, o mapa será preenchido." />
            ) : null}
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
