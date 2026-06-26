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
  listCategoriesAdmin,
  listMediaAdmin,
  listProductsAdmin,
  saveProductAdmin,
} from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/produtos")({
  component: ProductsAdminPage,
});

const EMPTY_ITEMS: any[] = [];

function ProductsAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listProductsAdmin);
  const listCategoriesFn = useServerFn(listCategoriesAdmin);
  const listMediaFn = useServerFn(listMediaAdmin);
  const saveFn = useServerFn(saveProductAdmin);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listFn({ data: {} }),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-for-products"],
    queryFn: () => listCategoriesFn({ data: {} }),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-media-for-products"],
    queryFn: () => listMediaFn({ data: { status: "publicado" } }),
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setEditing(null);
    },
  });

  const items = productsQuery.data?.items ?? EMPTY_ITEMS;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item: any) =>
      [item.name, item.slug, item.short_description, item.categories?.name]
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
  const categoryOptions = (categoriesQuery.data?.items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
  }));

  return (
    <AdminPageShell
      title="Produtos"
      description="Cadastre, publique, inative ou arquive produtos. O frontend publico passa a consumir estes dados primeiro."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Crie ou edite o produto preenchendo nome, categoria, status e descricao curta.",
        "Use a imagem principal e as relacoes de midia para controlar galeria, totem e vitrine.",
        "Revise o preview antes de salvar para evitar slug, SEO ou status incorretos.",
        "Se o item nao puder aparecer publicamente, use inativo ou arquivado em vez de apagar.",
      ]}
      quickGuideNote="Os campos mais tecnicos continuam disponiveis, mas o fluxo principal do catalogo pode ser gerenciado pelos blocos Dados principais, Midia, Publicacao e SEO."
      actions={
        <button
          onClick={() =>
            setEditing({
              name: "",
              slug: "",
              shortDescription: "",
              description: "",
              technicalSpecs: [],
              benefits: [],
              applications: [],
              tags: [],
              environments: [],
              status: "rascunho",
              isFeatured: false,
              sortOrder: items.length,
              unit: "",
              priceLabel: "Sob consulta",
              sectionKey: "",
              primaryMediaId: "",
              mediaRelations: [],
            })
          }
          className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground"
        >
          <Plus className="size-4" /> Novo produto
        </button>
      }
    >
      <AdminCard title="Lista de produtos">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField
            label="Buscar produto"
            hint="Pesquise por nome, slug, categoria ou descricao curta."
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: ripado, forro, chapas-uv"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
        {productsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando produtos...
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.length === 0 && (
              <div className="border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                Nenhum produto encontrado com esse filtro.
              </div>
            )}
            {pagedItems.map((item: any) => (
              <article
                key={item.id}
                className="grid gap-3 border border-border bg-background p-4 lg:grid-cols-[80px_1fr_auto]"
              >
                <div className="overflow-hidden border border-border/60 bg-surface">
                  {item.media_assets?.file_url ? (
                    <img
                      src={item.media_assets.file_url}
                      alt={item.name}
                      className="aspect-square h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-xs text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.name}</strong>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.is_featured && (
                      <span className="bg-highlight/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                        destaque
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.short_description || item.description || "Sem descricao curta."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    /produto/{item.slug} • {item.categories?.name || "Sem categoria"} • ordem{" "}
                    {item.sort_order}
                  </p>
                </div>
                <div>
                  <button
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        categoryId: item.category_id,
                        name: item.name,
                        slug: item.slug,
                        shortDescription: item.short_description ?? "",
                        description: item.description ?? "",
                        technicalSpecs: Array.isArray(item.technical_specs)
                          ? item.technical_specs
                          : [],
                        benefits: Array.isArray(item.benefits) ? item.benefits : [],
                        applications: Array.isArray(item.applications) ? item.applications : [],
                        environments: Array.isArray(item.environments) ? item.environments : [],
                        tags: Array.isArray(item.tags) ? item.tags : [],
                        whatsappMessage: item.whatsapp_message ?? "",
                        seoTitle: item.seo_title ?? "",
                        seoDescription: item.seo_description ?? "",
                        status: item.status,
                        isFeatured: item.is_featured,
                        sortOrder: item.sort_order ?? 0,
                        unit: item.unit ?? "",
                        priceLabel: item.price_label ?? "",
                        sectionKey: item.section_key ?? "",
                        primaryMediaId: item.primary_media_id ?? "",
                        mediaRelations: Array.isArray(item.product_images)
                          ? item.product_images.map((relation: any) => ({
                              mediaAssetId: relation.media_asset_id,
                              imageRole: relation.image_role ?? "galeria",
                              sortOrder: relation.sort_order ?? 0,
                              isPrimary: relation.is_primary ?? false,
                            }))
                          : [],
                      })
                    }
                    className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-bold"
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
        <ProductFormModal
          categories={categoryOptions}
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

function ProductFormModal({
  categories,
  mediaItems,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  categories: Array<{ id: string; name: string }>;
  mediaItems: any[];
  initial: any;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState(initial);

  const previewDescription = useMemo(
    () =>
      form.seoDescription ||
      form.shortDescription ||
      form.description ||
      "Descricao do produto no catalogo.",
    [form.description, form.seoDescription, form.shortDescription],
  );
  const missingFields = useMemo(() => {
    const issues: string[] = [];
    if (!String(form.name ?? "").trim()) issues.push("Nome do produto");
    if (!String(form.slug ?? "").trim()) issues.push("Slug");
    if (!String(form.categoryId ?? "").trim()) issues.push("Categoria");
    if (!String(form.shortDescription ?? "").trim()) issues.push("Descricao curta");
    return issues;
  }, [form.categoryId, form.name, form.shortDescription, form.slug]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="grid max-h-[94vh] w-full max-w-6xl gap-4 overflow-auto border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {form.id ? "Editar produto" : "Novo produto"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha dados comerciais, SEO, mensagens de WhatsApp e informacoes tecnicas.
            </p>
          </div>
          <button onClick={onClose} className="border border-border px-3 py-2 text-sm font-bold">
            Fechar
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <AdminCard title="Dados principais">
              <div className="grid gap-3 md:grid-cols-2">
                <AdminField label="Nome">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ex: Forro HD Wood Marfim"
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField
                  label="Slug"
                  hint="Endereco amigavel da pagina do produto."
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current: any) => ({
                          ...current,
                          slug: slugifyText(current.name || current.slug || ""),
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
                    placeholder="ex: forro-hd-wood-marfim"
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField
                  label="Categoria"
                  hint="Use a categoria principal de exibicao no catalogo."
                >
                  <select
                    value={form.categoryId ?? ""}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        categoryId: event.target.value || null,
                      }))
                    }
                    className={inputClassName()}
                  >
                    <option value="">Selecione</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField
                  label="Status"
                  hint="Rascunho nao aparece publicamente. Publicado aparece. Inativo oculta sem perder historico. Arquivado retira da operacao."
                >
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, status: event.target.value }))
                    }
                    className={inputClassName()}
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="publicado">Publicado</option>
                    <option value="inativo">Inativo</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </AdminField>
                <AdminField label="Unidade">
                  <input
                    value={form.unit}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, unit: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="Preco exibido">
                  <input
                    value={form.priceLabel}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, priceLabel: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField label="Secao">
                  <input
                    value={form.sectionKey}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, sectionKey: event.target.value }))
                    }
                    className={inputClassName()}
                  />
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
              </div>
              <div className="mt-3 grid gap-3">
                <AdminField
                  label="Descricao curta"
                  hint="Resumo rapido usado em cards, vitrines e algumas areas do SEO."
                >
                  <textarea
                    value={form.shortDescription}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        shortDescription: event.target.value,
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField
                  label="Descricao completa"
                  hint="Explique aplicacoes, beneficios e diferenciais do produto."
                >
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, description: event.target.value }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
              </div>
            </AdminCard>

            <AdminCard title="Comercial e conteudo">
              <div className="border border-border bg-surface p-3 text-xs text-muted-foreground">
                Preencha primeiro o basico. Os campos abaixo ajudam a enriquecer o produto para
                atendimento, SEO e exibicao no painel. Os blocos em JSON continuam disponiveis para
                casos mais tecnicos e devem ser revisados com cuidado.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <AdminField label="Beneficios" hint="Separe por virgula">
                  <textarea
                    value={(form.benefits ?? []).join(", ")}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        benefits: splitCsv(event.target.value),
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField label="Aplicacoes" hint="Separe por virgula">
                  <textarea
                    value={(form.applications ?? []).join(", ")}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        applications: splitCsv(event.target.value),
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField label="Tags" hint="Separe por virgula">
                  <textarea
                    value={(form.tags ?? []).join(", ")}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        tags: splitCsv(event.target.value),
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField label="Mensagem WhatsApp">
                  <textarea
                    value={form.whatsappMessage}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        whatsappMessage: event.target.value,
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField
                  label="Especificacoes tecnicas"
                  hint="Adicione pares simples de nome e valor para a ficha tecnica."
                >
                  <KeyValueListEditor
                    items={form.technicalSpecs ?? []}
                    addLabel="Adicionar especificacao"
                    emptyMessage="Nenhuma especificacao cadastrada."
                    keyLabel="Campo"
                    valueLabel="Valor"
                    onChange={(items) =>
                      setForm((current: any) => ({
                        ...current,
                        technicalSpecs: items,
                      }))
                    }
                  />
                </AdminField>
                <AdminField
                  label="Ambientacoes"
                  hint="Registre exemplos de uso do produto com titulo, imagem e observacao."
                >
                  <EnvironmentListEditor
                    items={form.environments ?? []}
                    onChange={(items) =>
                      setForm((current: any) => ({
                        ...current,
                        environments: items,
                      }))
                    }
                  />
                </AdminField>
              </div>
            </AdminCard>

            <AdminCard title="Midia vinculada">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Imagem principal">
                  <select
                    value={form.primaryMediaId ?? ""}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        primaryMediaId: event.target.value,
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
                <AdminField
                  label="Relacoes de midia"
                  hint="Selecione arquivos para galeria, ambientacao, tecnica, totem e vitrine."
                >
                  <div className="max-h-80 space-y-2 overflow-auto border border-border bg-background p-3">
                    {mediaItems.map((item: any) => {
                      const relationIndex = Array.isArray(form.mediaRelations)
                        ? form.mediaRelations.findIndex(
                            (relation: any) => relation.mediaAssetId === item.id,
                          )
                        : -1;
                      const relation =
                        relationIndex >= 0 ? form.mediaRelations[relationIndex] : null;
                      return (
                        <div
                          key={item.id}
                          className="grid gap-2 border border-border/70 p-3 md:grid-cols-[1fr_180px]"
                        >
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={relationIndex >= 0}
                              onChange={(event) =>
                                setForm((current: any) => {
                                  const currentRelations = Array.isArray(current.mediaRelations)
                                    ? [...current.mediaRelations]
                                    : [];
                                  if (!event.target.checked) {
                                    return {
                                      ...current,
                                      mediaRelations: currentRelations.filter(
                                        (entry: any) => entry.mediaAssetId !== item.id,
                                      ),
                                    };
                                  }
                                  currentRelations.push({
                                    mediaAssetId: item.id,
                                    imageRole: "galeria",
                                    sortOrder: currentRelations.length,
                                    isPrimary: false,
                                  });
                                  return { ...current, mediaRelations: currentRelations };
                                })
                              }
                              className="mt-1 size-4"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {item.title || item.file_name}
                              </span>
                              <span className="text-xs text-muted-foreground">{item.type}</span>
                            </span>
                          </label>
                          <div className="grid gap-2 md:grid-cols-[1fr_88px]">
                            <select
                              disabled={relationIndex < 0}
                              value={relation?.imageRole ?? "galeria"}
                              onChange={(event) =>
                                setForm((current: any) => ({
                                  ...current,
                                  mediaRelations: (current.mediaRelations ?? []).map(
                                    (entry: any) =>
                                      entry.mediaAssetId === item.id
                                        ? { ...entry, imageRole: event.target.value }
                                        : entry,
                                  ),
                                }))
                              }
                              className={inputClassName()}
                            >
                              <option value="galeria">Galeria</option>
                              <option value="ambientacao">Ambientacao</option>
                              <option value="tecnica">Tecnica</option>
                              <option value="totem">Totem</option>
                              <option value="vitrine">Vitrine</option>
                            </select>
                            <input
                              type="number"
                              disabled={relationIndex < 0}
                              value={relation?.sortOrder ?? 0}
                              onChange={(event) =>
                                setForm((current: any) => ({
                                  ...current,
                                  mediaRelations: (current.mediaRelations ?? []).map(
                                    (entry: any) =>
                                      entry.mediaAssetId === item.id
                                        ? {
                                            ...entry,
                                            sortOrder: Number(event.target.value),
                                          }
                                        : entry,
                                  ),
                                }))
                              }
                              className={inputClassName()}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AdminField>
              </div>
            </AdminCard>
          </div>

          <div className="space-y-4">
            <AdminCard title="Publicacao">
              <label className="flex items-center justify-between border border-border bg-background px-3 py-3">
                <span className="text-sm font-bold">Produto em destaque</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.isFeatured)}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, isFeatured: event.target.checked }))
                  }
                  className="size-4"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                Produtos em destaque ganham prioridade nas vitrines e nas areas promocionais.
              </p>
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
            <AdminCard title="Preview">
              <p className="text-lg font-bold">{form.name || "Nome do produto"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                /produto/{form.slug || "slug-do-produto"}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{previewDescription}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Status: <strong>{form.status}</strong> • Categoria:{" "}
                <strong>
                  {categories.find((item) => item.id === form.categoryId)?.name || "Nao definida"}
                </strong>
              </p>
              <div className="mt-4 border border-border bg-surface p-3 text-xs text-muted-foreground">
                {missingFields.length === 0
                  ? "Checklist basico concluido. Produto pronto para salvamento."
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
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar produto
          </button>
        </div>
      </div>
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function KeyValueListEditor({
  items,
  onChange,
  addLabel,
  emptyMessage,
  keyLabel,
  valueLabel,
}: {
  items: Array<{ label?: string; value?: string }>;
  onChange: (items: Array<{ label: string; value: string }>) => void;
  addLabel: string;
  emptyMessage: string;
  keyLabel: string;
  valueLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      )}
      {items.map((item, index) => (
        <div
          key={`${item.label ?? "item"}-${index}`}
          className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
        >
          <input
            value={item.label ?? ""}
            onChange={(event) =>
              onChange(
                items.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, label: event.target.value } : entry,
                ) as Array<{ label: string; value: string }>,
              )
            }
            placeholder={keyLabel}
            className={inputClassName()}
          />
          <input
            value={item.value ?? ""}
            onChange={(event) =>
              onChange(
                items.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, value: event.target.value } : entry,
                ) as Array<{ label: string; value: string }>,
              )
            }
            placeholder={valueLabel}
            className={inputClassName()}
          />
          <button
            type="button"
            onClick={() =>
              onChange(
                items.filter((_, entryIndex) => entryIndex !== index) as Array<{
                  label: string;
                  value: string;
                }>,
              )
            }
            className="border border-border px-3 py-2 text-sm font-bold"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...(items as Array<{ label: string; value: string }>),
            { label: "", value: "" },
          ])
        }
        className="border border-border px-3 py-2 text-sm font-bold"
      >
        {addLabel}
      </button>
    </div>
  );
}

function EnvironmentListEditor({
  items,
  onChange,
}: {
  items: Array<{ title?: string; image?: string; caption?: string }>;
  onChange: (items: Array<{ title: string; image: string; caption: string }>) => void;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
          Nenhuma ambientacao cadastrada.
        </div>
      )}
      {items.map((item, index) => (
        <div
          key={`${item.title ?? "amb"}-${index}`}
          className="grid gap-2 border border-border bg-background p-3"
        >
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={item.title ?? ""}
              onChange={(event) =>
                onChange(
                  items.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, title: event.target.value } : entry,
                  ) as Array<{ title: string; image: string; caption: string }>,
                )
              }
              placeholder="Titulo do ambiente"
              className={inputClassName()}
            />
            <input
              value={item.image ?? ""}
              onChange={(event) =>
                onChange(
                  items.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, image: event.target.value } : entry,
                  ) as Array<{ title: string; image: string; caption: string }>,
                )
              }
              placeholder="URL da imagem"
              className={inputClassName()}
            />
          </div>
          <textarea
            value={item.caption ?? ""}
            onChange={(event) =>
              onChange(
                items.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, caption: event.target.value } : entry,
                ) as Array<{ title: string; image: string; caption: string }>,
              )
            }
            placeholder="Observacao opcional sobre o ambiente"
            className={textareaClassName()}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onChange(
                  items.filter((_, entryIndex) => entryIndex !== index) as Array<{
                    title: string;
                    image: string;
                    caption: string;
                  }>,
                )
              }
              className="border border-border px-3 py-2 text-sm font-bold"
            >
              Remover ambientacao
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...(items as Array<{ title: string; image: string; caption: string }>),
            { title: "", image: "", caption: "" },
          ])
        }
        className="border border-border px-3 py-2 text-sm font-bold"
      >
        Adicionar ambientacao
      </button>
    </div>
  );
}
