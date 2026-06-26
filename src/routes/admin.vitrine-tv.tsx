/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import {
  AdminCard,
  AdminField,
  AdminPageShell,
  AdminSelectionField,
  inputClassName,
} from "@/components/admin/module-ui";
import {
  getVitrineSettingsAdmin,
  listBannersAdmin,
  listCampaignsAdmin,
  listMediaAdmin,
  listProductsAdmin,
  saveVitrineSettingsAdmin,
} from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/vitrine-tv")({
  component: VitrineSettingsPage,
});

function VitrineSettingsPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getVitrineSettingsAdmin);
  const saveFn = useServerFn(saveVitrineSettingsAdmin);
  const campaignsFn = useServerFn(listCampaignsAdmin);
  const productsFn = useServerFn(listProductsAdmin);
  const bannersFn = useServerFn(listBannersAdmin);
  const mediaFn = useServerFn(listMediaAdmin);
  const query = useQuery({
    queryKey: ["admin-vitrine-settings"],
    queryFn: () => getFn({ data: {} }),
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin-vitrine-campaigns"],
    queryFn: () => campaignsFn({ data: {} }),
  });
  const productsQuery = useQuery({
    queryKey: ["admin-vitrine-products"],
    queryFn: () => productsFn({ data: {} }),
  });
  const bannersQuery = useQuery({
    queryKey: ["admin-vitrine-banners"],
    queryFn: () => bannersFn({ data: {} }),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-vitrine-media"],
    queryFn: () => mediaFn({ data: { status: "publicado" } }),
  });

  const [form, setForm] = useState<any>({
    slideDurationSeconds: 8,
    orientation: "paisagem",
    status: "ativo",
    showCampaigns: true,
    showFeaturedProducts: true,
    showQrCodes: true,
    heroMediaId: "",
    layoutMode: "automatico",
    campaignSlugs: [],
    productSlugs: [],
    bannerSlugs: [],
  });

  useEffect(() => {
    if (query.data?.item) {
      setForm({
        slideDurationSeconds: query.data.item.slide_duration_seconds ?? 8,
        orientation: query.data.item.orientation ?? "paisagem",
        status: query.data.item.status ?? "ativo",
        showCampaigns: query.data.item.show_campaigns ?? true,
        showFeaturedProducts: query.data.item.show_featured_products ?? true,
        showQrCodes: query.data.item.show_qr_codes ?? true,
        heroMediaId: query.data.item.hero_media_id ?? "",
        layoutMode: query.data.item.layout_mode ?? "automatico",
        campaignSlugs: query.data.item.campaign_slugs ?? [],
        productSlugs: query.data.item.product_slugs ?? [],
        bannerSlugs: query.data.item.banner_slugs ?? [],
      });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-vitrine-settings"] }),
  });

  return (
    <AdminPageShell
      title="Vitrine TV"
      description="Defina o modo de exibicao, a ordem de conteudo e o uso de QR na tela de vitrine."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Defina a duracao dos slides e a orientacao correta da tela.",
        "Escolha se a vitrine mostra campanhas, produtos, banners ou um modo misto.",
        "Revise a densidade visual com conteudo real antes de publicar no monitor ou TV da loja.",
      ]}
      quickGuideNote="A vitrine precisa ser legivel a distancia. Prefira menos texto e conteudos com imagem forte."
    >
      <AdminCard title="Configuracoes da vitrine">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando configuracoes...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminField
              label="Duracao do slide (segundos)"
              hint="Tempo que cada slide permanece visivel."
            >
              <input
                type="number"
                value={form.slideDurationSeconds}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    slideDurationSeconds: Number(event.target.value),
                  }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField
              label="Orientacao"
              hint="Paisagem para TV horizontal, retrato para monitor vertical."
            >
              <select
                value={form.orientation}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, orientation: event.target.value }))
                }
                className={inputClassName()}
              >
                <option value="paisagem">Paisagem</option>
                <option value="retrato">Retrato</option>
              </select>
            </AdminField>
            <AdminField label="Status" hint="Ativo exibe. Pausado interrompe a vitrine.">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, status: event.target.value }))
                }
                className={inputClassName()}
              >
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
              </select>
            </AdminField>
            <AdminField
              label="Modo de composicao"
              hint="Automatico tenta equilibrar conteudos. Os demais priorizam um tipo."
            >
              <select
                value={form.layoutMode}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, layoutMode: event.target.value }))
                }
                className={inputClassName()}
              >
                <option value="automatico">Automatico</option>
                <option value="campanhas">Somente campanhas</option>
                <option value="produtos">Somente produtos</option>
                <option value="misto">Misto</option>
              </select>
            </AdminField>
            <AdminField
              label="Imagem institucional"
              hint="Imagem de apoio quando a vitrine precisar de abertura ou respiro visual."
            >
              <select
                value={form.heroMediaId}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, heroMediaId: event.target.value }))
                }
                className={inputClassName()}
              >
                <option value="">Nenhuma</option>
                {(mediaQuery.data?.items ?? []).map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.file_name} ({item.type})
                  </option>
                ))}
              </select>
            </AdminField>
            <ToggleRow
              label="Exibir campanhas"
              checked={Boolean(form.showCampaigns)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showCampaigns: checked }))
              }
            />
            <ToggleRow
              label="Exibir produtos em destaque"
              checked={Boolean(form.showFeaturedProducts)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showFeaturedProducts: checked }))
              }
            />
            <ToggleRow
              label="Exibir QR Codes"
              checked={Boolean(form.showQrCodes)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showQrCodes: checked }))
              }
            />
            <AdminSelectionField
              label="Campanhas selecionadas"
              items={(campaignsQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.title,
                meta: item.status ?? "",
              }))}
              selected={form.campaignSlugs ?? []}
              hint="Sem selecao manual, a vitrine usa as campanhas publicadas habilitadas para o canal."
              searchPlaceholder="Buscar campanha"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  campaignSlugs: toggleInArray(current.campaignSlugs, value),
                }))
              }
            />
            <AdminSelectionField
              label="Produtos selecionados"
              items={(productsQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.name,
                meta: item.categories?.name ?? item.slug,
              }))}
              selected={form.productSlugs ?? []}
              hint="Use para forcar vitrines tematicas ou sazonais com poucos produtos-chave."
              searchPlaceholder="Buscar produto"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  productSlugs: toggleInArray(current.productSlugs, value),
                }))
              }
            />
            <AdminSelectionField
              label="Banners selecionados"
              items={(bannersQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.title,
                meta: item.status ?? "",
              }))}
              selected={form.bannerSlugs ?? []}
              hint="Banners ajudam a preencher a grade quando a vitrine precisar de mensagem mais institucional."
              searchPlaceholder="Buscar banner"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  bannerSlugs: toggleInArray(current.bannerSlugs, value),
                }))
              }
            />
          </div>
        )}
        {mutation.error && (
          <p className="mt-4 text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryPill label="Campanhas" value={(form.campaignSlugs ?? []).length} />
          <SummaryPill label="Produtos" value={(form.productSlugs ?? []).length} />
          <SummaryPill label="Banners" value={(form.bannerSlugs ?? []).length} />
          <SummaryPill label="Slide" value={Number(form.slideDurationSeconds) || 0} suffix="s" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="border border-border bg-background p-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Resumo de exibicao
            </p>
            <p className="mt-2 font-bold">
              Orientacao: {form.orientation} • Modo: {form.layoutMode}
            </p>
            <p className="mt-1 text-muted-foreground">
              Slide: {form.slideDurationSeconds || 0}s • QR:{" "}
              {form.showQrCodes ? "ativo" : "desativado"} • Status: {form.status}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
              className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
              configuracoes
            </button>
          </div>
        </div>
      </AdminCard>
    </AdminPageShell>
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

function toggleInArray(values: string[] | undefined, value: string) {
  const current = Array.isArray(values) ? values : [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function SummaryPill({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3 text-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-bold text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
