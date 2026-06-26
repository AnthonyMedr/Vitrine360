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
import { listCategoriesAdmin, saveCategoryAdmin } from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/categorias")({
  component: CategoriesAdminPage,
});

const EMPTY_ITEMS: any[] = [];

function CategoriesAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCategoriesAdmin);
  const saveFn = useServerFn(saveCategoryAdmin);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const query = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => listFn({ data: {} }),
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditing(null);
    },
  });

  const items = query.data?.items ?? EMPTY_ITEMS;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item: any) =>
      [item.name, item.slug, item.short_name, item.description]
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
      title="Categorias"
      description="Gerencie categorias publicas, ordem de exibicao e SEO basico do catalogo."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Crie categorias com nome claro e ordem de exibicao coerente para o catalogo.",
        "Use o status para esconder categorias sem apagar historico.",
        "Revise o slug e o preview antes de salvar para evitar links ruins.",
      ]}
      quickGuideNote="Categorias organizam busca, catalogo, totem e areas promocionais. Se uma categoria nao deve aparecer, prefira inativa ou arquivada."
      actions={
        <button
          onClick={() =>
            setEditing({
              name: "",
              slug: "",
              shortName: "",
              description: "",
              seoTitle: "",
              seoDescription: "",
              status: "publicada",
              sortOrder: items.length,
            })
          }
          className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground"
        >
          <Plus className="size-4" /> Nova categoria
        </button>
      }
    >
      <AdminCard title="Lista de categorias">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField label="Buscar categoria" hint="Pesquise por nome, slug ou descricao.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: chapas, forros, pvc"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando categorias...
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.length === 0 && (
              <div className="border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                Nenhuma categoria encontrada com esse filtro.
              </div>
            )}
            {pagedItems.map((item: any) => (
              <article
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.name}</strong>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    /categoria/{item.slug} • ordem {item.sort_order}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditing({
                      id: item.id,
                      name: item.name,
                      slug: item.slug,
                      shortName: item.short_name ?? "",
                      description: item.description ?? "",
                      seoTitle: item.seo_title ?? "",
                      seoDescription: item.seo_description ?? "",
                      status: item.status,
                      sortOrder: item.sort_order ?? 0,
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
        <CategoryFormModal
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

function CategoryFormModal({
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  initial: any;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState(initial);

  const titlePreview = useMemo(
    () => form.seoTitle || form.name || "Categoria",
    [form.seoTitle, form.name],
  );
  const missingFields = useMemo(() => {
    const issues: string[] = [];
    if (!String(form.name ?? "").trim()) issues.push("Nome da categoria");
    if (!String(form.slug ?? "").trim()) issues.push("Slug");
    return issues;
  }, [form.name, form.slug]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="grid max-h-[92vh] w-full max-w-4xl gap-4 overflow-auto border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {form.id ? "Editar categoria" : "Nova categoria"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estruture a navegacao principal do catalogo e controle a publicacao.
            </p>
          </div>
          <button onClick={onClose} className="border border-border px-3 py-2 text-sm font-bold">
            Fechar
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <AdminCard title="Dados da categoria">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Nome" hint="Nome principal exibido no catalogo.">
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex: Chapas UV"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Slug"
                hint="Endereco amigavel da categoria."
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
                  placeholder="ex: chapas-uv"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Nome curto" hint="Opcional. Bom para menus e areas compactas.">
                <input
                  value={form.shortName}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, shortName: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Status"
                hint="Publicada aparece no catalogo. Inativa oculta. Arquivada sai da operacao."
              >
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, status: event.target.value }))
                  }
                  className={inputClassName()}
                >
                  <option value="publicada">Publicada</option>
                  <option value="inativa">Inativa</option>
                  <option value="arquivada">Arquivada</option>
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
            </div>
            <div className="mt-3">
              <AdminField
                label="Descricao"
                hint="Resumo para ajudar busca, SEO e entendimento comercial."
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

          <div className="space-y-4">
            <AdminCard title="SEO">
              <div className="grid gap-3">
                <AdminField
                  label="SEO title"
                  hint="Se vazio, o nome da categoria continua como base."
                >
                  <input
                    value={form.seoTitle}
                    onChange={(event) =>
                      setForm((current: any) => ({ ...current, seoTitle: event.target.value }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField
                  label="SEO description"
                  hint="Texto curto para busca e compartilhamento."
                >
                  <textarea
                    value={form.seoDescription}
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
              <p className="text-sm font-bold">{titlePreview}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                /categoria/{form.slug || "slug-da-categoria"}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {form.seoDescription ||
                  form.description ||
                  "Descricao da categoria para busca e compartilhamento."}
              </p>
              <div className="mt-4 border border-border bg-surface p-3 text-xs text-muted-foreground">
                {missingFields.length === 0
                  ? "Checklist basico concluido. A categoria ja pode ser salva."
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
            {saving && <Loader2 className="size-4 animate-spin" />} Salvar categoria
          </button>
        </div>
      </div>
    </div>
  );
}
