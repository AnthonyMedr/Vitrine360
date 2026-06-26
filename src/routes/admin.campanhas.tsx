/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  AdminCard,
  AdminField,
  AdminPagination,
  AdminPageShell,
  badgeTone,
  inputClassName,
  slugifyText,
  textareaClassName,
} from "@/components/admin/module-ui";
import {
  listCampaignsAdmin,
  listMediaAdmin,
  listProductsAdmin,
  saveCampaignAdmin,
} from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/campanhas")({
  component: CampaignsAdminPage,
});

const EMPTY_ITEMS: any[] = [];

function CampaignsAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCampaignsAdmin);
  const listProductsFn = useServerFn(listProductsAdmin);
  const listMediaFn = useServerFn(listMediaAdmin);
  const saveFn = useServerFn(saveCampaignAdmin);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const campaignsQuery = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listFn({ data: {} }),
  });
  const productsQuery = useQuery({
    queryKey: ["admin-products-for-campaigns"],
    queryFn: () => listProductsFn({ data: {} }),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-media-for-campaigns"],
    queryFn: () => listMediaFn({ data: { status: "publicado" } }),
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      setEditing(null);
    },
  });

  const items = campaignsQuery.data?.items ?? EMPTY_ITEMS;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item: any) =>
      [item.title, item.slug, item.subtitle, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, search]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems]);

  return (
    <AdminPageShell
      title="Campanhas e ofertas"
      description="Monte campanhas dinamicas, relacione produtos, publique por periodo e escolha onde cada destaque aparece."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Defina o titulo, o periodo e a chamada principal da campanha.",
        "Escolha onde a campanha deve aparecer: home, totem e vitrine.",
        "Relacione os produtos certos e revise banner, imagens e SEO antes de publicar.",
      ]}
      quickGuideNote="Campanhas publicadas podem impactar varias telas ao mesmo tempo. Antes de salvar, confirme datas, CTA e canais de exibicao."
      actions={
        <button
          onClick={() =>
            setEditing({
              title: "",
              slug: "",
              subtitle: "",
              description: "",
              ctaLabel: "Ver ofertas",
              whatsappMessage: "",
              startDate: "",
              endDate: "",
              status: "rascunho",
              isFeatured: false,
              showOnHome: true,
              showOnTotem: true,
              showOnVitrine: true,
              productIds: [],
              bannerMediaId: "",
              galleryMediaIds: [],
              totemMediaId: "",
              vitrineMediaId: "",
            })
          }
          className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground"
        >
          <Plus className="size-4" /> Nova campanha
        </button>
      }
    >
      <AdminCard title="Lista de campanhas">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField
            label="Buscar campanha"
            hint="Pesquise por titulo, slug ou chamada comercial."
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: semana, forro, uv"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
        {campaignsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando campanhas...
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.length === 0 && (
              <div className="border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                Nenhuma campanha encontrada com esse filtro.
              </div>
            )}
            {pagedItems.map((item: any) => (
              <article
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.title}</strong>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.show_on_home && (
                      <span className="bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">
                        home
                      </span>
                    )}
                    {item.show_on_totem && (
                      <span className="bg-highlight/25 px-2 py-0.5 text-[10px] font-bold uppercase">
                        totem
                      </span>
                    )}
                    {item.show_on_vitrine && (
                      <span className="bg-action/15 px-2 py-0.5 text-[10px] font-bold uppercase text-action">
                        vitrine
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.subtitle || item.description || "Sem chamada comercial."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    /campanha/{item.slug}
                    {item.start_date &&
                      ` • inicio ${new Date(item.start_date).toLocaleDateString("pt-BR")}`}
                    {item.end_date &&
                      ` • fim ${new Date(item.end_date).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditing({
                      id: item.id,
                      title: item.title,
                      slug: item.slug,
                      subtitle: item.subtitle ?? "",
                      description: item.description ?? "",
                      ctaLabel: item.cta_label ?? "",
                      whatsappMessage: item.whatsapp_message ?? "",
                      startDate: item.start_date ? item.start_date.slice(0, 10) : "",
                      endDate: item.end_date ? item.end_date.slice(0, 10) : "",
                      status: item.status,
                      isFeatured: item.is_featured,
                      showOnHome: item.show_on_home,
                      showOnTotem: item.show_on_totem,
                      showOnVitrine: item.show_on_vitrine,
                      seoTitle: item.seo_title ?? "",
                      seoDescription: item.seo_description ?? "",
                      productIds: Array.isArray(item.campaign_products)
                        ? item.campaign_products
                            .map((relation: any) => relation.products?.slug)
                            .filter(Boolean)
                        : [],
                      bannerMediaId: item.banner_media_id ?? "",
                      galleryMediaIds: Array.isArray(item.gallery_media_ids)
                        ? item.gallery_media_ids
                        : [],
                      totemMediaId: item.totem_media_id ?? "",
                      vitrineMediaId: item.vitrine_media_id ?? "",
                    })
                  }
                  className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-bold"
                >
                  <Pencil className="size-4" /> Editar
                </button>
              </article>
            ))}
            <AdminPagination
              currentPage={currentPage}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </AdminCard>

      {editing && (
        <CampaignFormModal
          products={productsQuery.data?.items ?? []}
          mediaItems={mediaQuery.data?.items ?? []}
          initial={editing}
          saving={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : ""}
          onClose={() => setEditing(null)}
          onSave={(payload) => mutation.mutate(payload)}
        />
      )}
    </AdminPageShell>
  );
}

function CampaignFormModal({
  products,
  mediaItems,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  products: any[];
  mediaItems: any[];
  initial: any;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState(initial);
  const missingFields = useMemo(() => {
    const issues: string[] = [];
    if (!String(form.title ?? "").trim()) issues.push("Titulo");
    if (!String(form.slug ?? "").trim()) issues.push("Slug");
    if (!String(form.ctaLabel ?? "").trim()) issues.push("CTA");
    if (!String(form.subtitle ?? "").trim() && !String(form.description ?? "").trim()) {
      issues.push("Chamada comercial");
    }
    return issues;
  }, [form.ctaLabel, form.description, form.slug, form.subtitle, form.title]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="grid max-h-[94vh] w-full max-w-5xl gap-4 overflow-auto border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {form.id ? "Editar campanha" : "Nova campanha"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure chamada, periodo, produtos relacionados e canais de exibicao.
            </p>
          </div>
          <button onClick={onClose} className="border border-border px-3 py-2 text-sm font-bold">
            Fechar
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminCard title="Dados da campanha">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Titulo" hint="Nome principal da campanha.">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex: Semana do Forro"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Slug"
                hint="Endereco amigavel da campanha."
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current: any) => ({
                        ...current,
                        slug: slugifyText(current.title || current.slug || ""),
                      }))
                    }
                    className="text-[11px] font-bold text-action"
                  >
                    Gerar automaticamente
                  </button>
                }
              >
                <input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, slug: event.target.value }))
                  }
                  placeholder="ex: semana-do-forro"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="CTA" hint="Texto do botao principal.">
                <input
                  value={form.ctaLabel}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, ctaLabel: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Status"
                hint="Rascunho prepara. Agendada espera a data. Publicada aparece. Encerrada e arquivada tiram da operacao."
              >
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, status: event.target.value }))
                  }
                  className={inputClassName()}
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="agendada">Agendada</option>
                  <option value="publicada">Publicada</option>
                  <option value="encerrada">Encerrada</option>
                  <option value="arquivada">Arquivada</option>
                </select>
              </AdminField>
              <AdminField label="Inicio" hint="Data em que a campanha deve comecar.">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, startDate: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Fim" hint="Data final da campanha.">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, endDate: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
            </div>
            <div className="mt-3 grid gap-3">
              <AdminField label="Subtitulo" hint="Chamada curta para cards, banners e destaque.">
                <textarea
                  value={form.subtitle}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, subtitle: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
              <AdminField label="Descricao" hint="Explique a oferta ou a proposta comercial.">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, description: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
              <AdminField
                label="Mensagem WhatsApp"
                hint="Mensagem pronta para atendimento quando o cliente clicar no CTA."
              >
                <textarea
                  value={form.whatsappMessage}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, whatsappMessage: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
            </div>
          </AdminCard>

          <AdminCard title="Midia da campanha">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Banner principal">
                <select
                  value={form.bannerMediaId ?? ""}
                  onChange={(event) =>
                    setForm((current: any) => ({
                      ...current,
                      bannerMediaId: event.target.value,
                    }))
                  }
                  className={inputClassName()}
                >
                  <option value="">Selecione</option>
                  {mediaItems.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.file_name} ({item.type})
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Imagem do totem">
                <select
                  value={form.totemMediaId ?? ""}
                  onChange={(event) =>
                    setForm((current: any) => ({
                      ...current,
                      totemMediaId: event.target.value,
                    }))
                  }
                  className={inputClassName()}
                >
                  <option value="">Selecione</option>
                  {mediaItems.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.file_name} ({item.type})
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Imagem da vitrine">
                <select
                  value={form.vitrineMediaId ?? ""}
                  onChange={(event) =>
                    setForm((current: any) => ({
                      ...current,
                      vitrineMediaId: event.target.value,
                    }))
                  }
                  className={inputClassName()}
                >
                  <option value="">Selecione</option>
                  {mediaItems.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.file_name} ({item.type})
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Galeria de apoio">
                <div className="max-h-60 space-y-2 overflow-auto border border-border bg-background p-3">
                  {mediaItems.map((item: any) => {
                    const checked = (form.galleryMediaIds ?? []).includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate">{item.title || item.file_name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current: any) => ({
                              ...current,
                              galleryMediaIds: event.target.checked
                                ? [...(current.galleryMediaIds ?? []), item.id]
                                : (current.galleryMediaIds ?? []).filter(
                                    (mediaId: string) => mediaId !== item.id,
                                  ),
                            }))
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </AdminField>
            </div>
          </AdminCard>

          <div className="space-y-4">
            <AdminCard title="Distribuicao">
              <div className="grid gap-3">
                <p className="border border-border bg-surface p-3 text-xs text-muted-foreground">
                  Use estes controles para decidir onde a campanha aparece. Se a campanha nao
                  estiver pronta para o publico, mantenha em rascunho ou desligue os canais.
                </p>
                <ToggleRow
                  label="Destaque da campanha"
                  checked={Boolean(form.isFeatured)}
                  onChange={(checked) =>
                    setForm((current: any) => ({ ...current, isFeatured: checked }))
                  }
                />
                <ToggleRow
                  label="Exibir na home"
                  checked={Boolean(form.showOnHome)}
                  onChange={(checked) =>
                    setForm((current: any) => ({ ...current, showOnHome: checked }))
                  }
                />
                <ToggleRow
                  label="Exibir no totem"
                  checked={Boolean(form.showOnTotem)}
                  onChange={(checked) =>
                    setForm((current: any) => ({ ...current, showOnTotem: checked }))
                  }
                />
                <ToggleRow
                  label="Exibir na vitrine TV"
                  checked={Boolean(form.showOnVitrine)}
                  onChange={(checked) =>
                    setForm((current: any) => ({ ...current, showOnVitrine: checked }))
                  }
                />
              </div>
            </AdminCard>
            <AdminCard title="SEO">
              <div className="grid gap-3">
                <AdminField label="SEO title">
                  <input
                    value={form.seoTitle ?? ""}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, seoTitle: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="SEO description">
                  <textarea
                    value={form.seoDescription ?? ""}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        seoDescription: event.target.value,
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
              </div>
            </AdminCard>
            <AdminCard
              title="Produtos vinculados"
              action={
                <span className="text-xs text-muted-foreground">
                  {(form.productIds ?? []).length} selecionados
                </span>
              }
            >
              <div className="grid max-h-72 gap-2 overflow-auto">
                {products.map((product: any) => {
                  const checked = (form.productIds ?? []).includes(product.slug);
                  return (
                    <label
                      key={product.id}
                      className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span>{product.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setForm((current: any) => ({
                            ...current,
                            productIds: event.target.checked
                              ? [...(current.productIds ?? []), product.slug]
                              : (current.productIds ?? []).filter(
                                  (item: string) => item !== product.slug,
                                ),
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-4 border border-border bg-surface p-3 text-xs text-muted-foreground">
                {missingFields.length === 0
                  ? "Checklist basico concluido. Campanha pronta para salvamento."
                  : `Faltando para salvar com seguranca: ${missingFields.join(", ")}.`}
              </div>
            </AdminCard>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="border border-border px-4 py-2 text-sm font-bold">
            Cancelar
          </button>
          <button
            disabled={saving || missingFields.length > 0}
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar campanha
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between border border-border bg-background px-3 py-3">
      <span className="text-sm font-bold">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}
