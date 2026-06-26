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
  getTotemSettingsAdmin,
  listBannersAdmin,
  listCampaignsAdmin,
  listCategoriesAdmin,
  listMediaAdmin,
  listProductsAdmin,
  saveTotemSettingsAdmin,
} from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/totem")({
  component: TotemSettingsPage,
});

function TotemSettingsPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getTotemSettingsAdmin);
  const saveFn = useServerFn(saveTotemSettingsAdmin);
  const categoriesFn = useServerFn(listCategoriesAdmin);
  const productsFn = useServerFn(listProductsAdmin);
  const campaignsFn = useServerFn(listCampaignsAdmin);
  const bannersFn = useServerFn(listBannersAdmin);
  const mediaFn = useServerFn(listMediaAdmin);

  const query = useQuery({
    queryKey: ["admin-totem-settings"],
    queryFn: () => getFn({ data: {} }),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-totem-categories"],
    queryFn: () => categoriesFn({ data: {} }),
  });
  const productsQuery = useQuery({
    queryKey: ["admin-totem-products"],
    queryFn: () => productsFn({ data: {} }),
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin-totem-campaigns"],
    queryFn: () => campaignsFn({ data: {} }),
  });
  const bannersQuery = useQuery({
    queryKey: ["admin-totem-banners"],
    queryFn: () => bannersFn({ data: {} }),
  });
  const mediaQuery = useQuery({
    queryKey: ["admin-totem-media"],
    queryFn: () => mediaFn({ data: { status: "publicado" } }),
  });

  const [form, setForm] = useState<any>({
    welcomeMessage: "",
    introTitle: "",
    introSubtitle: "",
    idleResetSeconds: 60,
    primaryQrTarget: "",
    heroMediaId: "",
    showFeaturedProducts: true,
    showCampaigns: true,
    showCategories: true,
    categorySlugs: [],
    featuredProductSlugs: [],
    campaignSlugs: [],
    bannerSlugs: [],
    status: "ativo",
  });

  useEffect(() => {
    if (query.data?.item) {
      setForm({
        welcomeMessage: query.data.item.welcome_message ?? "",
        introTitle: query.data.item.intro_title ?? "",
        introSubtitle: query.data.item.intro_subtitle ?? "",
        idleResetSeconds: query.data.item.idle_reset_seconds ?? 60,
        primaryQrTarget: query.data.item.primary_qr_target ?? "",
        heroMediaId: query.data.item.hero_media_id ?? "",
        showFeaturedProducts: query.data.item.show_featured_products ?? true,
        showCampaigns: query.data.item.show_campaigns ?? true,
        showCategories: query.data.item.show_categories ?? true,
        categorySlugs: query.data.item.category_slugs ?? [],
        featuredProductSlugs: query.data.item.featured_product_slugs ?? [],
        campaignSlugs: query.data.item.campaign_slugs ?? [],
        bannerSlugs: query.data.item.banner_slugs ?? [],
        status: query.data.item.status ?? "ativo",
      });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-totem-settings"] }),
  });

  return (
    <AdminPageShell
      title="Totem"
      description="Controle a abertura, os destaques e os recortes de exibicao do totem direto pelo painel."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Defina a mensagem inicial, o QR principal e o tempo de reset por inatividade.",
        "Escolha categorias, produtos, campanhas e banners que podem aparecer no totem.",
        "Mantenha apenas conteudos aprovados para evitar exibicao de material antigo ou fora de contexto.",
      ]}
      quickGuideNote="O totem e uma experiencia de tela grande e toque. Sempre valide o resultado final em equipamento fisico antes de publicar."
    >
      <AdminCard title="Configuracoes operacionais do totem">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando configuracoes...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminField label="Titulo de abertura" hint="Mensagem principal da tela inicial.">
              <input
                value={form.introTitle}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, introTitle: event.target.value }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField
              label="Subtitulo de abertura"
              hint="Texto complementar curto para orientar o visitante."
            >
              <input
                value={form.introSubtitle}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, introSubtitle: event.target.value }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField label="Mensagem inicial" hint="Mensagem curta de acolhimento no totem.">
              <input
                value={form.welcomeMessage}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, welcomeMessage: event.target.value }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField
              label="Tempo de reset por inatividade (segundos)"
              hint="Depois desse tempo sem uso, o totem volta para a tela inicial."
            >
              <input
                type="number"
                value={form.idleResetSeconds}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    idleResetSeconds: Number(event.target.value),
                  }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField
              label="Destino principal do QR"
              hint="URL principal usada no QR fixo ou prioritario do totem."
            >
              <input
                value={form.primaryQrTarget}
                onChange={(event) =>
                  setForm((current: any) => ({ ...current, primaryQrTarget: event.target.value }))
                }
                className={inputClassName()}
              />
            </AdminField>
            <AdminField label="Imagem de abertura" hint="Arte principal da tela inicial.">
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
            <AdminField label="Status" hint="Ativo exibe. Pausado interrompe o modo totem.">
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
            <ToggleRow
              label="Exibir produtos em destaque"
              checked={Boolean(form.showFeaturedProducts)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showFeaturedProducts: checked }))
              }
            />
            <ToggleRow
              label="Exibir campanhas"
              checked={Boolean(form.showCampaigns)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showCampaigns: checked }))
              }
            />
            <ToggleRow
              label="Exibir categorias"
              checked={Boolean(form.showCategories)}
              onChange={(checked) =>
                setForm((current: any) => ({ ...current, showCategories: checked }))
              }
            />
            <AdminSelectionField
              label="Categorias liberadas"
              items={(categoriesQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.name,
                meta: item.status ?? "",
              }))}
              selected={form.categorySlugs ?? []}
              hint="Se nada for marcado, o totem pode mostrar todas as categorias publicadas."
              searchPlaceholder="Buscar categoria"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  categorySlugs: toggleInArray(current.categorySlugs, value),
                }))
              }
            />
            <AdminSelectionField
              label="Produtos em destaque"
              items={(productsQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.name,
                meta: item.categories?.name ?? item.slug,
              }))}
              selected={form.featuredProductSlugs ?? []}
              hint="O totem prioriza estes produtos, mas volta para a categoria completa quando nao houver correspondencia."
              searchPlaceholder="Buscar produto"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  featuredProductSlugs: toggleInArray(current.featuredProductSlugs, value),
                }))
              }
            />
            <AdminSelectionField
              label="Campanhas visiveis"
              items={(campaignsQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.title,
                meta: item.status ?? "",
              }))}
              selected={form.campaignSlugs ?? []}
              hint="Se nenhuma for escolhida, o totem usa as campanhas publicadas com exibicao habilitada."
              searchPlaceholder="Buscar campanha"
              onToggle={(value) =>
                setForm((current: any) => ({
                  ...current,
                  campaignSlugs: toggleInArray(current.campaignSlugs, value),
                }))
              }
            />
            <AdminSelectionField
              label="Banners visiveis"
              items={(bannersQuery.data?.items ?? []).map((item: any) => ({
                value: item.slug,
                label: item.title,
                meta: item.status ?? "",
              }))}
              selected={form.bannerSlugs ?? []}
              hint="Sem selecao manual, o totem usa banners publicados marcados para exibicao no canal."
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
          <SummaryPill label="Categorias" value={(form.categorySlugs ?? []).length} />
          <SummaryPill label="Produtos" value={(form.featuredProductSlugs ?? []).length} />
          <SummaryPill label="Campanhas" value={(form.campaignSlugs ?? []).length} />
          <SummaryPill label="Banners" value={(form.bannerSlugs ?? []).length} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="border border-border bg-background p-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Resumo de exibicao
            </p>
            <p className="mt-2 font-bold">{form.introTitle || "Titulo inicial nao definido"}</p>
            <p className="mt-1 text-muted-foreground">
              {form.introSubtitle || form.welcomeMessage || "Sem subtitulo definido."}
            </p>
            <p className="mt-3 text-muted-foreground">
              Reset: {form.idleResetSeconds || 0}s • Status: {form.status}
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

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-surface px-4 py-3 text-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
