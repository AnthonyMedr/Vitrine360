import { Navigate } from "react-router-dom";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { Banner, BannerDraft, BannerStatus, SiteContent } from "./admin-banners/types";
import { bannerToDraft, draftToPayload, emptyDraft } from "./admin-banners/bannersHelpers";
import { BannerDraftForm } from "./admin-banners/BannerDraftForm";
import { BannerList } from "./admin-banners/BannerList";
import { InstitutionalContentSection } from "./admin-banners/InstitutionalContentSection";

export default function AdminBannersShowcases() {
  const { isAdmin, loading } = useAdmin();
  const { toast } = useToast();
  const banners = useAdminResource<Banner[]>(isAdmin ? "/api/admin/marketing/banners" : null, []);
  const [createDraft, setCreateDraft] = useState<BannerDraft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BannerDraft>(emptyDraft);
  const [savingId, setSavingId] = useState<string | null>(null);
  const siteContent = useAdminResource<SiteContent>(isAdmin ? "/api/admin/content" : null, { pages: [] });
  const [quemSomosDraft, setQuemSomosDraft] = useState<string | null>(null);
  const [savingContent, setSavingContent] = useState(false);
  const [uploadingField, setUploadingField] = useState<"desktop_image" | "mobile_image" | null>(null);
  const sortedByPlacement = useMemo(() => {
    const groups = new Map<string, Banner[]>();
    for (const banner of banners.data) {
      const list = groups.get(banner.placement) ?? [];
      list.push(banner);
      groups.set(banner.placement, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
    return groups;
  }, [banners.data]);

  if (loading) return <AdminLoadingState label="Carregando banners..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;

  const quemSomosPage = siteContent.data.pages.find((page) => page.slug === "quem_somos") || null;
  const quemSomosValue = quemSomosDraft ?? quemSomosPage?.content ?? "";

  async function saveQuemSomos() {
    if (!quemSomosPage) return;
    setSavingContent(true);
    try {
      const nextPages = siteContent.data.pages.map((page) => page.slug === "quem_somos" ? { ...page, content: quemSomosValue, updated_at: new Date().toISOString() } : page);
      await apiFetch("/api/admin/content", { method: "PUT", body: JSON.stringify({ pages: nextPages }) });
      await siteContent.reload();
      setQuemSomosDraft(null);
      toast({ title: "Conteúdo institucional atualizado" });
    } catch (error) {
      toast({ title: "Falha ao salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingContent(false);
    }
  }

  async function createBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createDraft.name.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/marketing/banners", { method: "POST", body: JSON.stringify(draftToPayload(createDraft)) });
      setCreateDraft(emptyDraft);
      await banners.reload();
      toast({ title: "Banner criado" });
    } catch (error) {
      toast({ title: "Falha ao criar banner", description: error instanceof Error ? error.message : "Revise os campos.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(banner: Banner) {
    setEditingId(banner.id);
    setEditDraft(bannerToDraft(banner));
  }

  async function saveEdit(id: string) {
    setSavingId(id);
    try {
      await apiFetch(`/api/admin/marketing/banners/${id}`, { method: "PUT", body: JSON.stringify(draftToPayload(editDraft)) });
      await banners.reload();
      toast({ title: "Banner atualizado" });
      setEditingId(null);
    } catch (error) {
      toast({ title: "Falha ao atualizar banner", description: error instanceof Error ? error.message : "Revise os campos.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(banner: Banner) {
    const nextStatus: BannerStatus = banner.status === "active" ? "paused" : "active";
    if (banner.status === "active" && !window.confirm(`Pausar o banner "${banner.name}"? Ele some do site imediatamente.`)) {
      return;
    }
    setSavingId(banner.id);
    try {
      await apiFetch(`/api/admin/marketing/banners/${banner.id}`, { method: "PUT", body: JSON.stringify({ status: nextStatus }) });
      await banners.reload();
      toast({ title: nextStatus === "active" ? "Banner ativado" : "Banner pausado" });
    } catch (error) {
      toast({ title: "Falha ao atualizar banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm(`Excluir o banner "${banner.name}" permanentemente? Essa ação não pode ser desfeita.`)) return;
    setSavingId(banner.id);
    try {
      await apiFetch(`/api/admin/marketing/banners/${banner.id}`, { method: "DELETE" });
      await banners.reload();
      toast({ title: "Banner excluído" });
    } catch (error) {
      toast({ title: "Falha ao excluir banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function moveBannerPriority(banner: Banner, direction: "up" | "down") {
    const siblings = sortedByPlacement.get(banner.placement) ?? [];
    const index = siblings.findIndex((entry) => entry.id === banner.id);
    const swapWith = direction === "up" ? siblings[index - 1] : siblings[index + 1];
    if (!swapWith) return;
    setSavingId(banner.id);
    try {
      await Promise.all([
        apiFetch(`/api/admin/marketing/banners/${banner.id}`, { method: "PUT", body: JSON.stringify({ priority: swapWith.priority }) }),
        apiFetch(`/api/admin/marketing/banners/${swapWith.id}`, { method: "PUT", body: JSON.stringify({ priority: banner.priority }) }),
      ]);
      await banners.reload();
    } catch (error) {
      toast({ title: "Falha ao reordenar banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  const activeCount = banners.data.filter((banner) => banner.status === "active").length;
  const draftCount = banners.data.filter((banner) => banner.status === "draft" || banner.status === "review").length;

  async function handleBannerImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    field: "desktop_image" | "mobile_image",
    onChange: (patch: Partial<BannerDraft>) => void,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast({ title: "Formato não suportado", description: "Envie um arquivo JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 5MB por imagem.", variant: "destructive" });
      return;
    }
    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      formData.append("usage", field === "desktop_image" ? "banner_desktop" : "banner_mobile");
      const result = await apiFetch<{ url: string }>("/api/admin/media-assets/upload", { method: "POST", body: formData });
      onChange({ [field]: result.url });
      toast({ title: "Imagem enviada" });
    } catch (error) {
      toast({ title: "Falha no upload", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Marketing"
      title="Banners e vitrines"
      description="Editor dos banners exibidos no site — home e outras posições."
      actions={<Button variant="outline" onClick={() => void banners.reload()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric label="Banners ativos" value={activeCount} tone="ok" />
          <WorkspaceMetric label="Em rascunho/revisão" value={draftCount} />
          <WorkspaceMetric label="Total cadastrado" value={banners.data.length} />
        </div>

        <WorkspaceSection title="Novo banner">
          <form onSubmit={createBanner} className="space-y-3">
            <BannerDraftForm
              draft={createDraft}
              onChange={(patch) => setCreateDraft((current) => ({ ...current, ...patch }))}
              uploadingField={uploadingField}
              onUploadImage={(event, field, onChange) => void handleBannerImageUpload(event, field, onChange)}
            />
            <Button type="submit" disabled={creating || !createDraft.name.trim()}>Criar banner</Button>
          </form>
        </WorkspaceSection>

        <WorkspaceSection title="Banners cadastrados">
          <BannerList
            banners={banners.data}
            editingId={editingId}
            editDraft={editDraft}
            savingId={savingId}
            uploadingField={uploadingField}
            onUploadImage={(event, field, onChange) => void handleBannerImageUpload(event, field, onChange)}
            onStartEdit={startEdit}
            onCloseEdit={() => setEditingId(null)}
            onEditDraftChange={(patch) => setEditDraft((current) => ({ ...current, ...patch }))}
            onSaveEdit={(id) => void saveEdit(id)}
            onMovePriority={(banner, direction) => void moveBannerPriority(banner, direction)}
            onToggleActive={(banner) => void toggleActive(banner)}
            onDelete={(banner) => void deleteBanner(banner)}
          />
        </WorkspaceSection>

        <InstitutionalContentSection
          quemSomosPage={quemSomosPage}
          quemSomosValue={quemSomosValue}
          onChange={setQuemSomosDraft}
          onSave={() => void saveQuemSomos()}
          saving={savingContent}
          hasDraft={quemSomosDraft !== null}
        />
      </div>
    </AdminWorkspaceShell>
  );
}
