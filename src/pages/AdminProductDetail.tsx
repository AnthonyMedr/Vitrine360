import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { PauseCircle, RefreshCw, Save } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminCapabilities } from "@/hooks/useAdminCapabilities";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { auditCatalogImages } from "@/lib/catalogImageAudit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { LocalProduct } from "@/lib/localCommerce";
import type { CatalogImageAuditItem } from "@/lib/catalogImageAudit";

type ReviewQueuePriority = "all" | "critica" | "alta" | "media";

type CatalogImageAuditResponse = {
  items: CatalogImageAuditItem[];
};

type ProductQualityScore = {
  product_completeness_score: number;
  commercial_score: number;
  visual_score: number;
  seo_score: number;
  fiscal_score: number;
  operational_score: number;
  campaign_score: number;
  ready_for_publication: boolean;
  ready_for_campaign: boolean;
  ready_for_home: boolean;
  ready_for_traffic: boolean;
  ready_for_assisted_operation: boolean;
  dimensions: Record<
    "commercial" | "visual" | "seo" | "fiscal" | "operational" | "campaign",
    { blockers: string[]; warnings: string[] }
  >;
};

type ProductDraft = {
  name: string;
  slug: string;
  sku: string;
  category_id: string;
  brand_id: string;
  price: string;
  promotional_price: string;
  stock: string;
  stock_minimum: string;
  unit_measure: string;
  material: string;
  image_url: string;
  image_alt_text: string;
  image_review_status: NonNullable<LocalProduct["image_review_status"]> | "manual_review";
  image_review_notes: string;
  short_description: string;
  description: string;
  application: string;
  ncm: string;
  cest: string;
  origin_code: string;
  fiscal_group: string;
  tax_classification_status: "pending" | "ready" | "review";
  weight: string;
  width: string;
  height: string;
  length: string;
  dimensions: string;
  related_product_ids: string;
  availability: LocalProduct["availability"];
  delivery_type: LocalProduct["delivery_type"];
  is_active: boolean;
  is_featured: boolean;
};

const emptyDraft: ProductDraft = {
  name: "",
  slug: "",
  sku: "",
  category_id: "",
  brand_id: "",
  price: "",
  promotional_price: "",
  stock: "",
  stock_minimum: "",
  unit_measure: "un",
  material: "",
  image_url: "",
  image_alt_text: "",
  image_review_status: "manual_review",
  image_review_notes: "",
  short_description: "",
  description: "",
  application: "",
  ncm: "",
  cest: "",
  origin_code: "",
  fiscal_group: "",
  tax_classification_status: "pending",
  weight: "",
  width: "",
  height: "",
  length: "",
  dimensions: "",
  related_product_ids: "",
  availability: "disponivel",
  delivery_type: "pickup_or_delivery",
  is_active: true,
  is_featured: false,
};

function buildProductDraft(product: LocalProduct): ProductDraft {
  return {
    name: product.name ?? "",
    slug: product.slug ?? "",
    sku: product.sku ?? "",
    category_id: product.category_id ?? "",
    brand_id: product.brand_id ?? "",
    price: String(product.price ?? ""),
    promotional_price: product.promotional_price == null ? "" : String(product.promotional_price),
    stock: String(product.stock ?? ""),
    stock_minimum: String(product.stock_minimum ?? ""),
    unit_measure: product.unit_measure ?? product.unit ?? "un",
    material: product.material ?? "",
    image_url: product.image_url ?? "",
    image_alt_text: product.image_alt_text ?? product.name ?? "",
    image_review_status: product.image_review_status ?? "manual_review",
    image_review_notes: product.image_review_notes ?? "",
    short_description: product.short_description ?? "",
    description: product.description ?? "",
    application: product.application ?? "",
    ncm: product.ncm ?? "",
    cest: product.cest ?? "",
    origin_code: product.origin_code ?? "",
    fiscal_group: product.fiscal_group ?? "",
    tax_classification_status: product.tax_classification_status ?? "pending",
    weight: product.weight == null ? "" : String(product.weight),
    width: product.width == null ? "" : String(product.width),
    height: product.height == null ? "" : String(product.height),
    length: product.length == null ? "" : String(product.length),
    dimensions: product.dimensions ?? "",
    related_product_ids: (product.related_product_ids ?? []).join(", "),
    availability: product.availability ?? "disponivel",
    delivery_type: product.delivery_type ?? "pickup_or_delivery",
    is_active: product.is_active,
    is_featured: product.is_featured,
  };
}

export default function AdminProductDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { isAdmin, loading } = useAdmin();
  const capabilities = useAdminCapabilities();
  const { toast } = useToast();
  const products = useAdminResource<LocalProduct[]>(isAdmin ? "/api/admin/products" : null, []);
  const categories = useAdminResource<Array<{ id: string; name: string; is_active: boolean }>>(isAdmin ? "/api/admin/categories" : null, []);
  const brands = useAdminResource<Array<{ id: string; name: string; is_active: boolean }>>(isAdmin ? "/api/admin/brands" : null, []);
  const reviewQueue = useAdminResource<CatalogImageAuditResponse>(
    isAdmin && searchParams.get("queue") === "visual" ? "/api/admin/catalog/image-audit" : null,
    { items: [] },
  );
  const qualityScore = useAdminResource<ProductQualityScore>(
    isAdmin && id ? `/api/admin/products/${id}/quality-score` : null,
    {
      product_completeness_score: 0,
      commercial_score: 0,
      visual_score: 0,
      seo_score: 0,
      fiscal_score: 0,
      operational_score: 0,
      campaign_score: 0,
      ready_for_publication: false,
      ready_for_campaign: false,
      ready_for_home: false,
      ready_for_traffic: false,
      ready_for_assisted_operation: false,
      dimensions: {
        commercial: { blockers: [], warnings: [] },
        visual: { blockers: [], warnings: [] },
        seo: { blockers: [], warnings: [] },
        fiscal: { blockers: [], warnings: [] },
        operational: { blockers: [], warnings: [] },
        campaign: { blockers: [], warnings: [] },
      },
    },
  );
  const product = useMemo(() => products.data.find((entry) => entry.id === id) ?? null, [id, products.data]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [draftProductId, setDraftProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!product || draftProductId === product.id) return;
    setDraft(buildProductDraft(product));
    setDraftProductId(product.id);
  }, [draftProductId, product]);

  const imageAudit = useMemo(() => {
    if (!product) return null;
    return auditCatalogImages([product]).items[0] ?? null;
  }, [product]);
  const reviewQueuePriority = (searchParams.get("queuePriority") || "all") as ReviewQueuePriority;
  const reviewQueueCategory = searchParams.get("queueCategory") || "all";
  const reviewQueueItems = useMemo(
    () =>
      reviewQueue.data.items
        .filter((item) => {
          if (reviewQueuePriority !== "all" && getReviewQueuePriority(item) !== reviewQueuePriority) return false;
          if (reviewQueueCategory !== "all" && (item.category_name || "Sem categoria") !== reviewQueueCategory) return false;
          return true;
        })
        .sort((a, b) => {
          const priorityDiff = getReviewQueuePriorityWeight(getReviewQueuePriority(a)) - getReviewQueuePriorityWeight(getReviewQueuePriority(b));
          if (priorityDiff !== 0) return priorityDiff;
          const activeRank = Number(b.is_active) - Number(a.is_active);
          if (activeRank !== 0) return activeRank;
          return a.product_name.localeCompare(b.product_name);
        }),
    [reviewQueue.data.items, reviewQueueCategory, reviewQueuePriority],
  );
  const reviewQueueIndex = useMemo(() => reviewQueueItems.findIndex((item) => item.product_id === product?.id), [product?.id, reviewQueueItems]);
  const previousReviewItem = reviewQueueIndex > 0 ? reviewQueueItems[reviewQueueIndex - 1] : null;
  const nextReviewItem = reviewQueueIndex >= 0 && reviewQueueIndex < reviewQueueItems.length - 1 ? reviewQueueItems[reviewQueueIndex + 1] : null;
  const reviewQueueReturnLink = useMemo(() => {
    const params = new URLSearchParams();
    if (reviewQueuePriority !== "all") params.set("queuePriority", reviewQueuePriority);
    if (reviewQueueCategory !== "all") params.set("queueCategory", reviewQueueCategory);
    return params.toString() ? `/admin/produtos?${params.toString()}` : "/admin/produtos";
  }, [reviewQueueCategory, reviewQueuePriority]);

  if (loading) return <AdminLoadingState label="Carregando produto..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;
  if (products.loading && !product) return <AdminLoadingState label="Localizando produto pelo ID..." />;

  async function savePatch(payload: Partial<LocalProduct>) {
    if (!product) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast({ title: "Produto atualizado" });
      await products.reload();
    } catch (error) {
      toast({
        title: "Atualização bloqueada",
        description: error instanceof Error ? error.message : "Revise os campos e permissoes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageFileSelect(event: ChangeEvent<HTMLInputElement>) {
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
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", draft.slug || draft.name || "produto");
      const result = await apiFetch<{ url: string }>("/api/admin/products/image-upload", { method: "POST", body: formData });
      setDraft((current) => ({ ...current, image_url: result.url }));
      toast({ title: "Imagem enviada", description: "Clique em Salvar para aplicar ao produto." });
    } catch (error) {
      toast({ title: "Falha no upload", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveCommercial() {
    if (!capabilities.canAny(["catalog.edit", "products.media_manage", "products.seo_edit"])) {
      toast({ title: "Acao bloqueada por RBAC", description: "Seu perfil não pode alterar cadastro comercial.", variant: "destructive" });
      return;
    }
    const publishIssues = getCommercialPublishIssues(draft);
    if (draft.is_active && publishIssues.length > 0) {
      toast({
        title: "Publicação bloqueada",
        description: `Corrija antes de manter ativo: ${publishIssues.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    await savePatch({
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      sku: draft.sku.trim() || null,
      category_id: draft.category_id || null,
      brand_id: draft.brand_id || null,
      price: toNumber(draft.price, 0),
      promotional_price: toNullableNumber(draft.promotional_price),
      stock: toNumber(draft.stock, 0),
      stock_minimum: toNumber(draft.stock_minimum, 0),
      unit_measure: draft.unit_measure as LocalProduct["unit_measure"],
      unit: draft.unit_measure,
      material: draft.material.trim() || null,
      image_url: draft.image_url.trim() || null,
      image_alt_text: draft.image_alt_text.trim() || null,
      image_review_status: draft.image_review_status,
      image_review_notes: draft.image_review_notes.trim() || null,
      short_description: draft.short_description.trim() || null,
      description: draft.description.trim() || null,
      application: draft.application.trim() || null,
      related_product_ids: draft.related_product_ids
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      availability: draft.availability,
      delivery_type: draft.delivery_type,
      is_active: draft.is_active,
      is_featured: draft.is_featured,
    });
  }

  async function saveFiscalLogistics() {
    if (!capabilities.canAny(["fiscal.edit", "catalog.edit"])) {
      toast({ title: "Acao bloqueada por RBAC", description: "Seu perfil não pode alterar informações técnicas.", variant: "destructive" });
      return;
    }
    if (draft.tax_classification_status === "ready" && (!draft.ncm.trim() || !draft.origin_code.trim())) {
      toast({ title: "Revisão técnica incompleta", description: "Não marque como revisado sem codigo técnico e origem conferidos.", variant: "destructive" });
      return;
    }
    await savePatch({
      ncm: draft.ncm.trim() || null,
      cest: draft.cest.trim() || null,
      origin_code: draft.origin_code.trim() || null,
      fiscal_group: draft.fiscal_group.trim() || null,
      tax_classification_status: draft.tax_classification_status,
      weight: toNullableNumber(draft.weight),
      width: toNullableNumber(draft.width),
      height: toNullableNumber(draft.height),
      length: toNullableNumber(draft.length),
      dimensions: draft.dimensions.trim() || null,
    });
  }

  async function quarantinePublication() {
    if (!product) return;
    if (!capabilities.canAny(["catalog.edit", "products.media_manage"])) {
      toast({ title: "Acao bloqueada por RBAC", description: "Seu perfil não pode retirar produto de publicação.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Retirar "${product.name}" de publicação? O produto sai do catálogo e de qualquer busca até revisão manual.`)) {
      return;
    }
    await savePatch({
      is_active: false,
      is_featured: false,
      status_product: "draft",
      availability: "sob_consulta",
      image_review_status: imageAudit?.audit_status === "suspect" ? "suspect" : "manual_review",
      image_review_notes: buildQuarantineNote(product, imageAudit),
    });
  }

  async function archiveProduct() {
    if (!product) return;
    if (!capabilities.canAny(["catalog.edit"])) {
      toast({ title: "Acao bloqueada por RBAC", description: "Seu perfil não pode arquivar produto.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Arquivar "${product.name}"? O produto sai do catálogo e de qualquer busca, mas orçamentos antigos que já citam este item continuam intactos. Pode ser desarquivado depois.`)) {
      return;
    }
    await savePatch({
      is_active: false,
      is_featured: false,
      status_product: "archived",
      availability: "indisponivel",
    });
  }

  async function restoreArchivedProduct() {
    if (!product) return;
    if (!capabilities.canAny(["catalog.edit"])) {
      toast({ title: "Acao bloqueada por RBAC", description: "Seu perfil não pode desarquivar produto.", variant: "destructive" });
      return;
    }
    await savePatch({
      status_product: "draft",
    });
  }

  if (!product && !products.loading) {
    return (
      <AdminWorkspaceShell title="Produto não encontrado" eyebrow="Produtos" actions={<Button asChild variant="outline"><Link to="/admin/produtos">Voltar</Link></Button>}>
        <p className="text-sm text-muted-foreground">O produto solicitado nao foi retornado pela API administrativa.</p>
      </AdminWorkspaceShell>
    );
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Editor de produto"
      title={product ? product.name : "Carregando produto"}
      description="Tela dedicada para cadastro comercial, publicação, imagens, disponibilidade, medidas e informações técnicas."
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => {
              void products.reload();
              void categories.reload();
              void brands.reload();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button asChild variant="outline">
            <Link to={reviewQueueReturnLink}>Voltar</Link>
          </Button>
        </>
      }
    >
      {product ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <WorkspaceMetric label="Ref. comercial" value={`R$ ${Number(product.price).toFixed(2).replace(".", ",")}`} />
            <WorkspaceMetric label="Disponibilidade" value={product.stock} tone={product.stock <= 0 ? "danger" : product.stock <= 5 ? "warn" : "ok"} />
            <WorkspaceMetric label="Revisão técnica" value={product.tax_classification_status || "pending"} tone={product.tax_classification_status === "ready" ? "ok" : "warn"} />
            <WorkspaceMetric label="Publicação" value={product.is_active ? "Ativo" : "Inativo"} tone={product.is_active ? "ok" : "warn"} />
            <WorkspaceMetric label="Imagem" value={imageAudit?.audit_status || "manual_review"} tone={imageAudit?.audit_status === "critical" ? "danger" : imageAudit?.audit_status === "suspect" ? "warn" : imageAudit?.audit_status === "ok" ? "ok" : "neutral"} />
          </div>

          <WorkspaceSection title="PIM / qualidade do produto">
            <div className="grid gap-4 xl:grid-cols-6">
              <WorkspaceMetric label="Score geral" value={qualityScore.data.product_completeness_score} tone={qualityScore.data.product_completeness_score >= 85 ? "ok" : qualityScore.data.product_completeness_score >= 70 ? "warn" : "danger"} />
              <WorkspaceMetric label="Comercial" value={qualityScore.data.commercial_score} />
              <WorkspaceMetric label="Visual" value={qualityScore.data.visual_score} />
              <WorkspaceMetric label="SEO" value={qualityScore.data.seo_score} />
              <WorkspaceMetric label="Técnico" value={qualityScore.data.fiscal_score} />
              <WorkspaceMetric label="Operacional" value={qualityScore.data.operational_score} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {qualityScore.data.ready_for_publication ? <Badge>publicavel</Badge> : <Badge variant="outline">nao publicavel</Badge>}
              {qualityScore.data.ready_for_campaign ? <Badge>pronto campanha</Badge> : <Badge variant="outline">nao pronto campanha</Badge>}
              {qualityScore.data.ready_for_home ? <Badge>pronto home</Badge> : null}
              {qualityScore.data.ready_for_traffic ? <Badge>pronto trafego</Badge> : null}
              {qualityScore.data.ready_for_assisted_operation ? <Badge>operacao assistida</Badge> : null}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {Object.entries(qualityScore.data.dimensions).map(([dimension, info]) => (
                <div key={dimension} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold capitalize">{dimension}</p>
                    {info.blockers.length === 0 ? <Badge>ok</Badge> : <Badge variant="destructive">{info.blockers.length} blocker(s)</Badge>}
                    {info.warnings.length > 0 ? <Badge variant="outline">{info.warnings.length} warning(s)</Badge> : null}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {info.blockers.map((entry) => <p key={`${dimension}-b-${entry}`}>- {entry}</p>)}
                    {info.warnings.map((entry) => <p key={`${dimension}-w-${entry}`}>- {entry}</p>)}
                    {info.blockers.length === 0 && info.warnings.length === 0 ? <p>Sem pendencias nesta dimensao.</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          {searchParams.get("queue") === "visual" ? (
            <WorkspaceSection
              title="Fila operacional da revisão visual"
              action={<Badge variant="outline">{reviewQueueIndex >= 0 ? `${reviewQueueIndex + 1} de ${reviewQueueItems.length}` : `${reviewQueueItems.length} item(ns)`}</Badge>}
            >
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Curadoria guiada por fila</p>
                  <p className="text-sm text-muted-foreground">
                    Volte ao workspace com o mesmo recorte de prioridade/categoria ou avance para o proximo SKU sem perder o contexto da revisao.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filtros ativos: prioridade <span className="font-medium text-foreground">{reviewQueuePriority}</span> - categoria <span className="font-medium text-foreground">{reviewQueueCategory}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={reviewQueueReturnLink}>Voltar para fila</Link>
                  </Button>
                  {previousReviewItem ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={buildReviewQueueEditorLink(previousReviewItem, reviewQueuePriority, reviewQueueCategory)}>Anterior</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>Anterior</Button>
                  )}
                  {nextReviewItem ? (
                    <Button asChild size="sm">
                      <Link to={buildReviewQueueEditorLink(nextReviewItem, reviewQueuePriority, reviewQueueCategory)}>Proximo</Link>
                    </Button>
                  ) : (
                    <Button size="sm" disabled>Proximo</Button>
                  )}
                </div>
              </div>
            </WorkspaceSection>
          ) : null}

          {product.status_product === "archived" ? (
            <WorkspaceSection title="Produto arquivado">
              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Este produto está arquivado</p>
                  <p className="text-sm text-muted-foreground">
                    Não aparece no catálogo público nem em buscas. Orçamentos antigos que citam este item continuam intactos.
                  </p>
                </div>
                <Button variant="outline" onClick={restoreArchivedProduct} disabled={saving || !capabilities.canAny(["catalog.edit"])}>
                  Desarquivar
                </Button>
              </div>
            </WorkspaceSection>
          ) : (
            <WorkspaceSection title="Arquivar produto">
              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Retirar este produto de circulação definitivamente</p>
                  <p className="text-sm text-muted-foreground">
                    Use quando o produto saiu de linha. Diferente de excluir: o cadastro fica preservado e orçamentos antigos continuam íntegros. Pode ser desarquivado depois.
                  </p>
                </div>
                <Button variant="outline" onClick={archiveProduct} disabled={saving || !capabilities.canAny(["catalog.edit"])}>
                  Arquivar produto
                </Button>
              </div>
            </WorkspaceSection>
          )}

          {product.is_active && (imageAudit?.audit_status === "critical" || !hasRealImageDraft(draft)) ? (
            <WorkspaceSection title="Bloqueio operacional recomendado">
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">Produto ativo com risco visual critico</p>
                  <p className="text-sm text-muted-foreground">
                    Este item deve sair de publicacao e campanha ate revisao humana da imagem principal, alt text e coerencia com a familia do produto.
                  </p>
                </div>
                <Button variant="destructive" onClick={quarantinePublication} disabled={saving || !capabilities.canAny(["catalog.edit", "products.media_manage"])}>
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Retirar de publicacao
                </Button>
              </div>
            </WorkspaceSection>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <WorkspaceSection title="Cadastro comercial">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome" value={draft.name} onChange={(value) => updateDraft(setDraft, "name", value)} />
                <Field label="Slug publico" value={draft.slug} onChange={(value) => updateDraft(setDraft, "slug", slugifyDraft(value))} />
                <Field label="SKU" value={draft.sku} onChange={(value) => updateDraft(setDraft, "sku", value)} />
                <div>
                  <Label>Categoria</Label>
                  <Select value={draft.category_id || "none"} onValueChange={(value) => updateDraft(setDraft, "category_id", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.data
                        .filter((category) => category.is_active || category.id === draft.category_id)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.is_active ? category.name : `${category.name} (arquivada)`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Marca</Label>
                  <Select value={draft.brand_id || "none"} onValueChange={(value) => updateDraft(setDraft, "brand_id", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem marca</SelectItem>
                      {brands.data.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Referencia comercial interna" type="number" value={draft.price} onChange={(value) => updateDraft(setDraft, "price", value)} />
                <Field label="Referencia promocional interna" type="number" value={draft.promotional_price} onChange={(value) => updateDraft(setDraft, "promotional_price", value)} />
                <Field label="Disponibilidade informada" type="number" value={draft.stock} onChange={(value) => updateDraft(setDraft, "stock", value)} />
                <Field label="Minimo para alerta interno" type="number" value={draft.stock_minimum} onChange={(value) => updateDraft(setDraft, "stock_minimum", value)} />
                <div>
                  <Label>Unidade de venda</Label>
                  <Select value={draft.unit_measure || "un"} onValueChange={(value) => updateDraft(setDraft, "unit_measure", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">unidade</SelectItem>
                      <SelectItem value="m">metro linear</SelectItem>
                      <SelectItem value="m2">metro quadrado</SelectItem>
                      <SelectItem value="cx">caixa</SelectItem>
                      <SelectItem value="kg">quilo</SelectItem>
                      <SelectItem value="pc">peca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Material/acabamento" value={draft.material} onChange={(value) => updateDraft(setDraft, "material", value)} />
                <div className="md:col-span-2">
                  <Label>Descricao curta</Label>
                  <Textarea value={draft.short_description} onChange={(event) => updateDraft(setDraft, "short_description", event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Descricao completa</Label>
                  <Textarea rows={5} value={draft.description} onChange={(event) => updateDraft(setDraft, "description", event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Aplicacao</Label>
                  <Textarea value={draft.application} onChange={(event) => updateDraft(setDraft, "application", event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Produtos relacionados</Label>
                  <Input value={draft.related_product_ids} onChange={(event) => updateDraft(setDraft, "related_product_ids", event.target.value)} placeholder="IDs separados por virgula; use para kits, acessorios e complementares" />
                </div>
              </div>
              <Button className="mt-4" onClick={saveCommercial} disabled={saving || draft.name.trim().length === 0 || !capabilities.canAny(["catalog.edit", "products.media_manage", "products.seo_edit"])}>
                <Save className="mr-2 h-4 w-4" />
                Salvar cadastro
              </Button>
            </WorkspaceSection>

            <WorkspaceSection title="Publicação">
              <div className="space-y-4">
                <Toggle label="Produto ativo" checked={draft.is_active} onCheckedChange={(checked) => updateDraft(setDraft, "is_active", checked)} />
                <Toggle label="Destaque na vitrine" checked={draft.is_featured} onCheckedChange={(checked) => updateDraft(setDraft, "is_featured", checked)} />
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">Checklist comercial</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {getCommercialChecklist(draft).map((item) => (
                      <li key={item.label} className={item.ok ? "text-emerald-700" : "text-amber-800"}>
                        {item.ok ? "OK" : "Pendente"} - {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Produtos publicados precisam de cadastro comercial minimo, imagem aprovada e CTA de orcamento/WhatsApp.
                </div>
              </div>
            </WorkspaceSection>
          </div>

          <WorkspaceSection title="Midia, alt text e revisão humana">
            <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt={draft.image_alt_text || draft.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">Sem imagem principal</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={imageAudit?.audit_status === "critical" ? "destructive" : imageAudit?.audit_status === "suspect" ? "outline" : imageAudit?.audit_status === "ok" ? "default" : "secondary"}>
                    {imageAudit?.audit_status || "manual_review"}
                  </Badge>
                  <Badge variant="outline">{draft.image_review_status}</Badge>
                </div>
                <div>
                  <Label htmlFor="image-upload-input">Enviar imagem (JPG, PNG ou WEBP, até 5MB)</Label>
                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageFileSelect}
                    disabled={uploadingImage || !capabilities.canAny(["catalog.edit", "products.media_manage"])}
                    className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {uploadingImage ? <p className="mt-1 text-xs text-muted-foreground">Enviando...</p> : null}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Imagem principal" value={draft.image_url} onChange={(value) => updateDraft(setDraft, "image_url", value)} />
                <Field label="Alt text" value={draft.image_alt_text} onChange={(value) => updateDraft(setDraft, "image_alt_text", value)} />
                <div>
                  <Label>Status de revisao da imagem</Label>
                  <Select value={draft.image_review_status} onValueChange={(value) => updateDraft(setDraft, "image_review_status", value as ProductDraft["image_review_status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual_review">pendente</SelectItem>
                      <SelectItem value="approved">aprovada</SelectItem>
                      <SelectItem value="suspect">suspeita</SelectItem>
                      <SelectItem value="broken">reprovada</SelectItem>
                      <SelectItem value="missing">sem imagem</SelectItem>
                      <SelectItem value="duplicate">duplicada em revisao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Observacao interna da revisao</Label>
                  <Textarea value={draft.image_review_notes} onChange={(event) => updateDraft(setDraft, "image_review_notes", event.target.value)} placeholder="Ex.: imagem temporaria da familia; aguardando foto real do SKU Nero 6m." />
                </div>
                <div className="md:col-span-2 rounded-lg border p-3 text-sm">
                  <p className="font-semibold">Overrides humanos por heuristica</p>
                  <p className="mt-1 text-muted-foreground">
                    Use somente quando a equipe validar visualmente que a familia pode compartilhar a mesma foto, que a imagem generica e aceitavel para o SKU ou que o metadado divergente nao representa erro real. A IA sugere. O humano aprova. O sistema audita.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => updateDraft(setDraft, "image_review_notes", appendAuditOverride(draft.image_review_notes, "[duplicate-ok]"))}>
                      Aprovar duplicidade
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => updateDraft(setDraft, "image_review_notes", appendAuditOverride(draft.image_review_notes, "[generic-ok]"))}>
                      Aprovar imagem generica
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => updateDraft(setDraft, "image_review_notes", appendAuditOverride(draft.image_review_notes, "[metadata-ok]"))}>
                      Aprovar divergencia de metadados
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => updateDraft(setDraft, "image_review_notes", removeAuditOverrides(draft.image_review_notes))}>
                      Limpar overrides
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2 rounded-lg border p-3 text-sm">
                  <p className="font-semibold">Diagnostico automatico</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imageAudit?.issues.map((issue) => (
                      <Badge key={issue.code} variant={issue.severity === "critical" ? "destructive" : issue.severity === "suspect" ? "outline" : "secondary"}>
                        {issue.label}
                      </Badge>
                    ))}
                    {!imageAudit?.issues.length ? <Badge>sem alerta automatico</Badge> : null}
                  </div>
                  <p className="mt-3 text-muted-foreground">{imageAudit?.recommended_action || "A auditoria sugere; a equipe aprova e audita a decisao final."}</p>
                </div>
              </div>
            </div>
            <Button className="mt-4" onClick={saveCommercial} disabled={saving || !capabilities.canAny(["catalog.edit", "products.media_manage", "products.seo_edit"])}>
              <Save className="mr-2 h-4 w-4" />
              Salvar midia/publicacao
            </Button>
          </WorkspaceSection>

          <WorkspaceSection title="Informações técnicas e medidas">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Codigo técnico/NCM interno" value={draft.ncm} onChange={(value) => updateDraft(setDraft, "ncm", value)} />
              <Field label="Codigo complementar" value={draft.cest} onChange={(value) => updateDraft(setDraft, "cest", value)} />
              <Field label="Origem do produto" value={draft.origin_code} onChange={(value) => updateDraft(setDraft, "origin_code", value)} />
              <Field label="Grupo técnico" value={draft.fiscal_group} onChange={(value) => updateDraft(setDraft, "fiscal_group", value)} />
              <div>
                <Label>Status tecnico</Label>
                <Select value={draft.tax_classification_status} onValueChange={(value) => updateDraft(setDraft, "tax_classification_status", value as ProductDraft["tax_classification_status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pendente</SelectItem>
                    <SelectItem value="review">em revisao</SelectItem>
                    <SelectItem value="ready">revisado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Peso kg" type="number" value={draft.weight} onChange={(value) => updateDraft(setDraft, "weight", value)} />
              <Field label="Largura cm" type="number" value={draft.width} onChange={(value) => updateDraft(setDraft, "width", value)} />
              <Field label="Altura cm" type="number" value={draft.height} onChange={(value) => updateDraft(setDraft, "height", value)} />
              <Field label="Comprimento cm" type="number" value={draft.length} onChange={(value) => updateDraft(setDraft, "length", value)} />
              <div className="md:col-span-2 xl:col-span-3">
                <Label>Dimensoes comerciais</Label>
                <Input value={draft.dimensions} onChange={(event) => updateDraft(setDraft, "dimensions", event.target.value)} placeholder="Ex.: 200 x 120 x 0,8 cm" />
              </div>
            </div>
            <Button className="mt-4" onClick={saveFiscalLogistics} disabled={saving || !capabilities.canAny(["fiscal.edit", "catalog.edit"])}>
              <Save className="mr-2 h-4 w-4" />
              Salvar informacoes tecnicas
            </Button>
          </WorkspaceSection>
        </div>
      ) : null}
    </AdminWorkspaceShell>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function updateDraft<K extends keyof ProductDraft>(setDraft: Dispatch<SetStateAction<ProductDraft>>, key: K, value: ProductDraft[K]) {
  setDraft((current) => ({ ...current, [key]: value }));
}

function slugifyDraft(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hasRealImageDraft(draft: ProductDraft) {
  const normalized = draft.image_url.trim().toLowerCase();
  return normalized.length > 0 && !normalized.includes("placeholder");
}

function buildQuarantineNote(product: LocalProduct, audit: CatalogImageAuditItem | null) {
  const issueSummary = audit?.issues.slice(0, 3).map((issue) => issue.label).join(", ") || "imagem principal sem validação objetiva";
  return `Retirado de publicação pelo editor do produto em ${new Date().toISOString()} por risco visual/comercial. Motivo: ${issueSummary}. Reativar somente após revisão humana do cadastro ${product.sku || product.id}.`;
}

function getCommercialChecklist(draft: ProductDraft) {
  return [
    { label: "nome e slug publico", ok: draft.name.trim().length >= 3 && draft.slug.trim().length >= 3 },
    { label: "SKU ou codigo interno", ok: draft.sku.trim().length > 0 },
    { label: "categoria definida", ok: draft.category_id.trim().length > 0 },
    { label: "produto sob consulta ou disponibilidade informada", ok: toNumber(draft.price, 0) > 0 || draft.availability === "sob_consulta" },
    { label: "disponibilidade comercial registrada", ok: toNumber(draft.stock, 0) > 0 || ["sob_consulta", "indisponivel", "entrega_sob_analise"].includes(String(draft.availability)) },
    { label: "imagem principal", ok: draft.image_url.trim().length > 0 && !isPlaceholderProductImage(draft.image_url) },
    { label: "alt text revisado", ok: draft.image_alt_text.trim().length >= 5 },
    { label: "descrição e aplicação", ok: draft.description.trim().length >= 20 && draft.application.trim().length >= 3 },
    { label: "unidade e material/acabamento", ok: draft.unit_measure.trim().length > 0 && draft.material.trim().length > 0 },
  ];
}

function getCommercialPublishIssues(draft: ProductDraft) {
  return getCommercialChecklist(draft)
    .filter((item) => !item.ok)
    .map((item) => item.label);
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlaceholderProductImage(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "/" || normalized.includes("placeholder.svg") || normalized.includes("placeholder");
}

function getReviewQueuePriority(item: CatalogImageAuditItem): ReviewQueuePriority {
  if (item.is_active && item.audit_status === "critical") return "critica";
  if (item.is_active && (item.audit_status === "suspect" || item.audit_status === "manual_review")) return "alta";
  return "media";
}

function getReviewQueuePriorityWeight(priority: ReviewQueuePriority) {
  switch (priority) {
    case "critica":
      return 0;
    case "alta":
      return 1;
    case "media":
      return 2;
    default:
      return 3;
  }
}

function buildReviewQueueEditorLink(item: CatalogImageAuditItem, priority: ReviewQueuePriority, category: string) {
  const params = new URLSearchParams();
  params.set("queue", "visual");
  if (priority !== "all") params.set("queuePriority", priority);
  if (category !== "all") params.set("queueCategory", category);
  return `/admin/produto/${item.product_id}?${params.toString()}`;
}

function appendAuditOverride(notes: string, tag: "[duplicate-ok]" | "[generic-ok]" | "[metadata-ok]") {
  const normalized = notes.trim();
  if (normalized.includes(tag)) return normalized;
  return normalized.length > 0 ? `${normalized} ${tag}` : tag;
}

function removeAuditOverrides(notes: string) {
  return notes
    .replace(/\[duplicate-ok\]/g, "")
    .replace(/\[generic-ok\]/g, "")
    .replace(/\[metadata-ok\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
