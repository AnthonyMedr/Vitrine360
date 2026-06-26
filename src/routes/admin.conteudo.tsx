/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
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
  listBannersAdmin,
  listCampaignsAdmin,
  listMediaAdmin,
  listProductsAdmin,
  saveBannerAdmin,
} from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/conteudo")({
  component: BannersAdminPage,
});

function BannersAdminPage() {
  const queryClient = useQueryClient();
  const bannersFn = useServerFn(listBannersAdmin);
  const mediaFn = useServerFn(listMediaAdmin);
  const productsFn = useServerFn(listProductsAdmin);
  const campaignsFn = useServerFn(listCampaignsAdmin);
  const saveFn = useServerFn(saveBannerAdmin);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const bannersQuery = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => bannersFn({ data: {} }),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-banner-media"],
    queryFn: () => mediaFn({ data: { status: "publicado" } }),
  });
  const productsQuery = useQuery({
    queryKey: ["admin-banner-products"],
    queryFn: () => productsFn({ data: { includeArchived: false } }),
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin-banner-campaigns"],
    queryFn: () => campaignsFn({ data: { includeArchived: false } }),
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      setEditing(null);
    },
  });

  const items = bannersQuery.data?.items ?? [];
  const filteredItems = items.filter((item: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.title, item.slug, item.subtitle, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AdminPageShell
      title="Banners e destaques"
      description="Gerencie banners operacionais para home, totem e vitrine sem depender de JSON solto ou edicao manual."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Crie um banner com titulo, criativo e destino comercial claros.",
        "Defina em quais canais ele aparece: home, totem e vitrine.",
        "Use datas e status para controlar o periodo de exibicao sem apagar historico.",
      ]}
      quickGuideNote="Banners ajudam a destacar campanhas e produtos sem depender de alteracao manual no codigo."
      actions={
        <button
          onClick={() =>
            setEditing({
              title: "",
              slug: "",
              subtitle: "",
              description: "",
              mediaAssetId: "",
              ctaLabel: "",
              targetUrl: "",
              linkedProductSlug: "",
              linkedCampaignSlug: "",
              showOnHome: true,
              showOnTotem: false,
              showOnVitrine: false,
              startsAt: "",
              endsAt: "",
              status: "rascunho",
              sortOrder: bannersQuery.data?.items?.length ?? 0,
            })
          }
          className="inline-flex items-center gap-2 rounded-full bg-action px-4 py-2 text-sm font-bold text-action-foreground"
        >
          <Plus className="size-4" /> Novo banner
        </button>
      }
    >
      <AdminCard>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField label="Buscar banner" hint="Pesquise por titulo, slug ou chamada comercial.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: campanha principal, vitrine, destaque"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
        {bannersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando banners...
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                Nenhum banner encontrado com esse filtro.
              </div>
            )}
            {pagedItems.map((item: any) => (
              <article
                key={item.id}
                className="grid gap-3 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[220px_1fr_auto]"
              >
                <div className="overflow-hidden rounded-xl bg-surface">
                  {item.media_assets?.file_url ? (
                    <img
                      src={item.media_assets.file_url}
                      alt={item.media_assets.alt_text || item.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-[16/9] place-items-center text-sm text-muted-foreground">
                      Sem midia
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.title}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.show_on_home && <ChannelBadge label="home" />}
                    {item.show_on_totem && <ChannelBadge label="totem" />}
                    {item.show_on_vitrine && <ChannelBadge label="vitrine" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.subtitle || item.description || "Sem chamada configurada."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    /banner/{item.slug} | ordem {item.sort_order ?? 0}
                  </p>
                </div>
                <div>
                  <button
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        title: item.title,
                        slug: item.slug,
                        subtitle: item.subtitle ?? "",
                        description: item.description ?? "",
                        mediaAssetId: item.media_asset_id ?? "",
                        ctaLabel: item.cta_label ?? "",
                        targetUrl: item.target_url ?? "",
                        linkedProductSlug: item.linked_product_slug ?? "",
                        linkedCampaignSlug: item.linked_campaign_slug ?? "",
                        showOnHome: item.show_on_home ?? true,
                        showOnTotem: item.show_on_totem ?? false,
                        showOnVitrine: item.show_on_vitrine ?? false,
                        startsAt: item.starts_at ? item.starts_at.slice(0, 16) : "",
                        endsAt: item.ends_at ? item.ends_at.slice(0, 16) : "",
                        status: item.status ?? "rascunho",
                        sortOrder: item.sort_order ?? 0,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold"
                  >
                    <Pencil className="size-4" /> Editar
                  </button>
                </div>
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
        <BannerFormModal
          initial={editing}
          mediaItems={mediaQuery.data?.items ?? []}
          products={productsQuery.data?.items ?? []}
          campaigns={campaignsQuery.data?.items ?? []}
          saving={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : ""}
          onClose={() => setEditing(null)}
          onSave={(payload) => mutation.mutate(payload)}
        />
      )}
    </AdminPageShell>
  );
}

function BannerFormModal({
  initial,
  mediaItems,
  products,
  campaigns,
  saving,
  error,
  onClose,
  onSave,
}: {
  initial: any;
  mediaItems: any[];
  products: any[];
  campaigns: any[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState(initial);
  const selectedMedia = mediaItems.find((item) => item.id === form.mediaAssetId) ?? null;
  const selectedProduct = products.find((item) => item.slug === form.linkedProductSlug) ?? null;
  const selectedCampaign = campaigns.find((item) => item.slug === form.linkedCampaignSlug) ?? null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="grid max-h-[94vh] w-full max-w-5xl gap-4 overflow-auto rounded-2xl bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {form.id ? "Editar banner" : "Novo banner"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina o criativo, o canal de exibicao e o destino comercial do destaque.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-bold"
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminCard title="Conteudo do banner">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Titulo">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current: any) => ({
                      ...current,
                      title: event.target.value,
                      slug:
                        current.slug === slugifyText(current.title || "") || !current.slug
                          ? slugifyText(event.target.value)
                          : current.slug,
                    }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Slug"
                hint="Gerado automaticamente, mas pode ser ajustado manualmente."
              >
                <input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, slug: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
            </div>
            <div className="mt-3 grid gap-3">
              <AdminField label="Subtitulo">
                <textarea
                  value={form.subtitle}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, subtitle: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
              <AdminField label="Descricao">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, description: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
              <AdminField label="Media">
                <select
                  value={form.mediaAssetId}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, mediaAssetId: event.target.value }))
                  }
                  className={inputClassName()}
                >
                  <option value="">Selecione</option>
                  {mediaItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.file_name} ({item.type})
                    </option>
                  ))}
                </select>
              </AdminField>
              {selectedMedia && (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  {selectedMedia.file_url ? (
                    <img
                      src={selectedMedia.file_url}
                      alt={selectedMedia.alt_text || selectedMedia.title || form.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <div className="p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {selectedMedia.title || selectedMedia.file_name}
                    </strong>
                    <div className="mt-1">
                      {selectedMedia.type} {selectedMedia.status ? `| ${selectedMedia.status}` : ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AdminCard>

          <div className="space-y-4">
            <AdminCard title="Destino e canais">
              <div className="grid gap-3">
                <AdminField label="CTA">
                  <input
                    value={form.ctaLabel}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, ctaLabel: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="URL de destino">
                  <input
                    value={form.targetUrl}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, targetUrl: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="Produto vinculado">
                  <select
                    value={form.linkedProductSlug}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        linkedProductSlug: event.target.value,
                      }))
                    }
                    className={inputClassName()}
                  >
                    <option value="">Nenhum</option>
                    {products.map((item) => (
                      <option key={item.id} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Campanha vinculada">
                  <select
                    value={form.linkedCampaignSlug}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        linkedCampaignSlug: event.target.value,
                      }))
                    }
                    className={inputClassName()}
                  >
                    <option value="">Nenhuma</option>
                    {campaigns.map((item) => (
                      <option key={item.id} value={item.slug}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </AdminField>
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
                  label="Exibir na vitrine"
                  checked={Boolean(form.showOnVitrine)}
                  onChange={(checked) =>
                    setForm((current: any) => ({ ...current, showOnVitrine: checked }))
                  }
                />
              </div>
            </AdminCard>

            <AdminCard title="Resumo do destino">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Produto:</strong>{" "}
                  {selectedProduct?.name ?? "Nenhum vinculo"}
                </p>
                <p>
                  <strong className="text-foreground">Campanha:</strong>{" "}
                  {selectedCampaign?.title ?? "Nenhum vinculo"}
                </p>
                <p>
                  <strong className="text-foreground">Canais:</strong>{" "}
                  {[
                    form.showOnHome ? "home" : null,
                    form.showOnTotem ? "totem" : null,
                    form.showOnVitrine ? "vitrine" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Nenhum canal ativo"}
                </p>
              </div>
            </AdminCard>

            <AdminCard title="Status">
              <div className="grid gap-3">
                <AdminField label="Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, status: event.target.value }))
                    }
                    className={inputClassName()}
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="publicado">Publicado</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </AdminField>
                <AdminField label="Ordem">
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        sortOrder: Number(event.target.value),
                      }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="Inicio">
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, startsAt: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="Fim">
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, endsAt: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
              </div>
            </AdminCard>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar banner
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
    <label className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3">
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

function ChannelBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-highlight/25 px-2 py-0.5 text-[10px] font-bold uppercase">
      {label}
    </span>
  );
}
