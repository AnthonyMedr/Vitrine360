import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Plus, QrCode as QrCodeIcon, Trash2 } from "lucide-react";
import { QRCode } from "@/components/tabloide/QRCode";
import {
  AdminCard,
  AdminField,
  AdminPageShell,
  inputClassName,
} from "@/components/admin/module-ui";
import { getPublicStorefront } from "@/lib/commercial.functions";
import { downloadQRCodePng, downloadQRCodeSvg } from "@/lib/qrcode-download";
import { createQRCode, deleteQRCode, listQRCodes } from "@/lib/qrcodes.functions";

export const Route = createFileRoute("/admin/qrcodes")({
  component: QRCodesAdmin,
});

const BASE = typeof window !== "undefined" ? window.location.origin : "";

function QRCodesAdmin() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listQRCodes);
  const createFn = useServerFn(createQRCode);
  const deleteFn = useServerFn(deleteQRCode);
  const storefrontFn = useServerFn(getPublicStorefront);

  const qrcodesQuery = useQuery({
    queryKey: ["qrcodes"],
    queryFn: () => listFn(),
  });
  const storefrontQuery = useQuery({
    queryKey: ["admin-qrcodes-storefront"],
    queryFn: () => storefrontFn({}),
  });

  const createMut = useMutation({
    mutationFn: (input: { label: string; url: string; scope?: string; refId?: string }) =>
      createFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qrcodes"] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qrcodes"] }),
  });

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");

  const presets = useMemo(
    () => [
      ...(storefrontQuery.data?.campaigns ?? []).map((campaign) => ({
        label: `Campanha | ${campaign.name}`,
        url: `${BASE}/campanha/${campaign.slug}`,
        scope: "campaign",
        refId: campaign.slug,
      })),
      ...(storefrontQuery.data?.products ?? []).slice(0, 10).map((product) => ({
        label: `Produto | ${product.name}`,
        url: `${BASE}/produto/${product.id}`,
        scope: "product",
        refId: product.id,
      })),
      { label: "Totem", url: `${BASE}/totem`, scope: "totem" },
      { label: "Vitrine TV", url: `${BASE}/vitrine`, scope: "tv" },
      { label: "Catalogo", url: `${BASE}/catalogo`, scope: "catalog" },
    ],
    [storefrontQuery.data?.campaigns, storefrontQuery.data?.products],
  );

  const items = qrcodesQuery.data?.items ?? [];
  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.label, item.url, item.scope]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  return (
    <AdminPageShell
      title="QR Codes"
      description="Crie e baixe QR codes persistidos no banco para campanhas, produtos, totem e catalogo."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Use atalhos para preencher rapidamente campanhas, produtos ou rotas principais.",
        "Crie rotulos claros para a equipe identificar o destino de cada QR.",
        "Baixe PNG ou SVG conforme o material de divulgacao ou impressao.",
      ]}
      quickGuideNote="Evite remover QR codes que ja estejam em material impresso ou sinalizacao em loja sem antes substituir o destino."
    >
      <AdminCard title="Novo QR Code">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <AdminField label="Rotulo" hint="Nome interno para identificar o QR na operacao.">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex: Campanha principal"
              className={inputClassName()}
            />
          </AdminField>
          <AdminField label="URL ou texto" hint="Destino que o QR deve abrir ao ser escaneado.">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              className={inputClassName()}
            />
          </AdminField>
          <button
            disabled={!label.trim() || !url.trim() || createMut.isPending}
            onClick={() => {
              createMut.mutate(
                { label, url, scope: "custom" },
                {
                  onSuccess: () => {
                    setLabel("");
                    setUrl("");
                  },
                },
              );
            }}
            className="inline-flex items-center justify-center gap-1 bg-action px-4 py-2 font-bold text-action-foreground disabled:opacity-50"
          >
            {createMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}{" "}
            Adicionar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Atalhos:
          </span>
          {presets.slice(0, 12).map((preset) => (
            <button
              key={preset.url}
              onClick={() => {
                setLabel(preset.label);
                setUrl(preset.url);
              }}
              className="border border-border bg-background px-3 py-1.5 text-xs hover:border-action"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {createMut.error && (
          <p className="mt-3 text-sm text-destructive">
            {(createMut.error as Error).message.includes("Forbidden")
              ? "Apenas administradores podem criar QR codes."
              : (createMut.error as Error).message}
          </p>
        )}
      </AdminCard>

      <AdminCard title="QR Codes salvos">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField label="Buscar QR Code" hint="Pesquise por rotulo, escopo ou destino.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: campanha, totem, catalogo"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} item(ns)
            </div>
          </div>
        </div>
        {qrcodesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum QR encontrado. Crie acima ou ajuste o filtro.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((qr) => (
              <article
                key={qr.id}
                className="flex flex-col items-center border border-border bg-foreground p-5 text-background"
              >
                <QRCode data={qr.url} size={180} />
                <p className="mt-3 text-center font-display font-extrabold">{qr.label}</p>
                <p className="mt-1 break-all text-center font-mono text-[10px] text-background/60">
                  {qr.url}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-background/50">
                  {qr.scope} | {qr.scan_count} scans
                </p>
                <div className="mt-4 flex w-full gap-2">
                  <button
                    onClick={() => downloadQRCodePng(qr.url, `${slugify(qr.label)}.png`)}
                    className="inline-flex flex-1 items-center justify-center gap-1 bg-action py-2 text-xs font-bold text-action-foreground"
                  >
                    <Download className="size-3.5" /> PNG
                  </button>
                  <button
                    onClick={() => downloadQRCodeSvg(qr.url, `${slugify(qr.label)}.svg`)}
                    className="inline-flex flex-1 items-center justify-center gap-1 bg-highlight py-2 text-xs font-bold text-highlight-foreground"
                  >
                    <Download className="size-3.5" /> SVG
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remover o QR Code "${qr.label}"? Essa acao nao deve ser feita se ele ainda estiver em uso em material impresso.`,
                        )
                      ) {
                        removeMut.mutate(qr.id);
                      }
                    }}
                    aria-label="Remover"
                    className="inline-flex items-center justify-center bg-destructive/20 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
