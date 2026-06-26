/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import {
  AdminCard,
  AdminField,
  AdminPagination,
  AdminPageShell,
  badgeTone,
  inputClassName,
  textareaClassName,
} from "@/components/admin/module-ui";
import { getStoredAdminToken } from "@/lib/admin-session";
import { listMediaAdmin, saveMediaMetadataAdmin } from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/midia")({
  component: MediaAdminPage,
});

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function MediaAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMediaAdmin);
  const saveFn = useServerFn(saveMediaMetadataAdmin);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<any | null>(null);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const pageSize = 8;

  const query = useQuery({
    queryKey: ["admin-media", typeFilter, statusFilter],
    queryFn: () => listFn({ data: { type: typeFilter || null, status: statusFilter || null } }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setDraft(null);
    },
  });

  const grouped = query.data?.items ?? [];
  const filteredItems = grouped.filter((item: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.title, item.file_name, item.alt_text, item.type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const processUpload = async (file: File) => {
    setUploadError("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError(`Formato invalido para "${file.name}". Use JPG, PNG ou WEBP.`);
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 5) {
      setUploadError(`Arquivo "${file.name}" acima do limite inicial de 5 MB.`);
      return;
    }

    const dimensions = await readImageDimensions(file);
    const token = getStoredAdminToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "produto");
    formData.append("storeId", query.data?.storeId ?? "default-store");

    setUploading(true);
    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Falha ao enviar arquivo.");
      }

      setDraft({
        fileName: result.fileName,
        originalFileName: result.originalFileName,
        fileUrl: result.fileUrl,
        storagePath: result.storagePath,
        mimeType: result.mimeType,
        size: result.size,
        width: dimensions.width,
        height: dimensions.height,
        type: "produto",
        title: file.name.replace(/\.[^.]+$/, ""),
        altText: "",
        description: "",
        tags: [],
        status: "rascunho",
        recommendedUse: getRecommendedMediaUse(dimensions.width, dimensions.height),
      });
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const queueNextUpload = async () => {
    setPendingUploads((current) => {
      const [next, ...rest] = current;
      if (next) {
        void processUpload(next);
      }
      return rest;
    });
  };

  const handleUploadSelection = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (selected.length === 0) return;
    if (uploading || draft) {
      setPendingUploads((current) => [...current, ...selected]);
      return;
    }

    const [first, ...rest] = selected;
    if (rest.length > 0) {
      setPendingUploads(rest);
    }
    await processUpload(first);
  };

  return (
    <AdminPageShell
      title="Biblioteca de midia"
      description="Centralize imagens de produtos, ambientacoes, campanhas, totem e vitrine. Os arquivos ficam no storage, nao no codigo."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Envie a imagem e depois complete titulo, ALT, tipo e status.",
        "Publique apenas arquivos aprovados para aparecer no site, totem ou vitrine.",
        "Use o tipo correto para facilitar filtros e relacoes com produtos e campanhas.",
      ]}
      quickGuideNote="Formatos aceitos nesta etapa: JPG, PNG e WEBP. Limite inicial por arquivo: 5 MB."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {pendingUploads.length > 0 && (
            <div className="rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              fila: {pendingUploads.length}
            </div>
          )}
          <button
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}{" "}
            Enviar imagem
          </button>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        hidden
        onChange={(event) => event.target.files && handleUploadSelection(event.target.files)}
      />

      <AdminCard title="Entrada de arquivos">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files?.length) {
              void handleUploadSelection(event.dataTransfer.files);
            }
          }}
          className="grid gap-3 border border-dashed border-border bg-background p-6 text-sm text-muted-foreground"
        >
          <p className="font-bold text-foreground">
            Arraste arquivos aqui ou use o botao de envio.
          </p>
          <p>
            Voce pode selecionar varios arquivos. O sistema vai colocar os proximos em fila e abrir
            o cadastro de metadados um por vez.
          </p>
          <p>Proporcoes recomendadas: produto 1:1, banner 16:9, totem 9:16, vitrine 16:9.</p>
        </div>
      </AdminCard>

      <AdminCard title="Filtros">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <AdminField label="Buscar arquivo" hint="Pesquise por titulo, nome, ALT ou tipo.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: banner, ripado, vitrine"
              className={inputClassName()}
            />
          </AdminField>
          <AdminField label="Tipo de midia" hint="Filtre pela finalidade principal do arquivo.">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={inputClassName()}
            >
              <option value="">Todos</option>
              {[
                "produto",
                "galeria",
                "ambientacao",
                "tecnica",
                "campanha",
                "categoria",
                "banner",
                "totem",
                "vitrine",
                "institucional",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Status" hint="Rascunho, publicado ou arquivado.">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClassName()}
            >
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Arquivos">
        {uploadError && <p className="mb-4 text-sm text-destructive">{uploadError}</p>}
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando biblioteca...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.length === 0 && (
              <div className="border border-dashed border-border bg-background p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3 xl:col-span-4">
                Nenhum arquivo encontrado com os filtros atuais.
              </div>
            )}
            {pagedItems.map((item: any) => (
              <article key={item.id} className="overflow-hidden border border-border bg-background">
                <div className="aspect-square bg-surface">
                  <img
                    src={item.file_url}
                    alt={item.alt_text || item.title || item.file_name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{item.title || item.file_name}</strong>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.type}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.width ?? 0}x{item.height ?? 0} | {Math.round((item.size ?? 0) / 1024)} KB
                  </p>
                  {Array.isArray(item.usages) && item.usages.length > 0 && (
                    <div className="border border-border/60 bg-surface p-2 text-[11px] text-muted-foreground">
                      {item.usages.slice(0, 3).map((usage: string) => (
                        <p key={usage}>{usage}</p>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <AdminPagination
          currentPage={currentPage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </AdminCard>

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="grid w-full max-w-3xl gap-4 border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight">
                  Registrar midia
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Defina metadados, tipo, ALT e status antes de publicar.
                </p>
              </div>
              <button
                onClick={() => {
                  setDraft(null);
                  void queueNextUpload();
                }}
                className="border border-border px-3 py-2 text-sm font-bold"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="overflow-hidden border border-border bg-background">
                <img
                  src={draft.fileUrl}
                  alt={draft.title}
                  className="aspect-square h-full w-full object-cover"
                />
              </div>
              <div className="grid gap-3">
                <AdminField label="Titulo">
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current: any) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Ex: Banner Semana do Forro"
                    className={inputClassName()}
                  />
                </AdminField>
                <AdminField
                  label="ALT"
                  hint="Descreva a imagem de forma objetiva para acessibilidade e SEO."
                >
                  <input
                    value={draft.altText}
                    onChange={(event) =>
                      setDraft((current: any) => ({ ...current, altText: event.target.value }))
                    }
                    placeholder="Ex: Ripado amadeirado aplicado em sala comercial"
                    className={inputClassName()}
                  />
                </AdminField>
                <div className="border border-border bg-surface p-3 text-xs text-muted-foreground">
                  Recomendacao automatica: <strong>{draft.recommendedUse}</strong>
                  <br />
                  Dimensoes detectadas: {draft.width ?? 0}x{draft.height ?? 0}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <AdminField label="Tipo">
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        setDraft((current: any) => ({ ...current, type: event.target.value }))
                      }
                      className={inputClassName()}
                    >
                      {[
                        "produto",
                        "galeria",
                        "ambientacao",
                        "tecnica",
                        "campanha",
                        "categoria",
                        "banner",
                        "totem",
                        "vitrine",
                        "institucional",
                      ].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Status">
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((current: any) => ({ ...current, status: event.target.value }))
                      }
                      className={inputClassName()}
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="publicado">Publicado</option>
                      <option value="arquivado">Arquivado</option>
                    </select>
                  </AdminField>
                </div>
                <AdminField
                  label="Descricao"
                  hint="Contexto comercial interno para a equipe identificar melhor o uso da imagem."
                >
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current: any) => ({ ...current, description: event.target.value }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
                <AdminField
                  label="Tags"
                  hint="Separe por virgula. Ex: campanha, madeira, sala, totem"
                >
                  <input
                    value={(draft.tags ?? []).join(", ")}
                    onChange={(event) =>
                      setDraft((current: any) => ({
                        ...current,
                        tags: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }))
                    }
                    className={inputClassName()}
                  />
                </AdminField>
              </div>
            </div>

            {saveMutation.error && (
              <p className="text-sm text-destructive">{(saveMutation.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraft(null);
                  void queueNextUpload();
                }}
                className="border border-border px-4 py-2 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate(draft, {
                    onSuccess: () => {
                      void queueNextUpload();
                    },
                  })
                }
                className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}{" "}
                Salvar midia
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = objectUrl;
    });
    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getRecommendedMediaUse(width: number, height: number) {
  if (!width || !height) return "Uso geral";
  const ratio = width / height;
  if (ratio > 1.65) return "Banner ou vitrine 16:9";
  if (ratio < 0.7) return "Totem vertical 9:16";
  if (ratio > 0.9 && ratio < 1.1) return "Produto ou card 1:1";
  if (ratio >= 0.7 && ratio <= 0.9) return "Ambientacao 4:5";
  return "Galeria ou uso institucional";
}
