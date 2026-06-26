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
  inputClassName,
  textareaClassName,
} from "@/components/admin/module-ui";
import { getStoreSettingsAdmin, saveStoreSettingsAdmin } from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/loja")({
  component: StoreSettingsPage,
});

function StoreSettingsPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getStoreSettingsAdmin);
  const saveFn = useServerFn(saveStoreSettingsAdmin);
  const query = useQuery({
    queryKey: ["admin-store-settings"],
    queryFn: () => getFn({ data: {} }),
  });

  const [form, setForm] = useState<any>({
    storeName: "",
    whatsappNumber: "",
    address: "",
    openingHours: "",
    instagramUrl: "",
    facebookUrl: "",
    websiteUrl: "",
    institutionalText: "",
    primaryColor: "",
    secondaryColor: "",
    seoTitle: "",
    seoDescription: "",
  });

  useEffect(() => {
    if (query.data?.item) {
      setForm({
        storeName: query.data.item.store_name ?? "",
        whatsappNumber: query.data.item.whatsapp_number ?? "",
        address: query.data.item.address ?? "",
        openingHours: query.data.item.opening_hours ?? "",
        instagramUrl: query.data.item.instagram_url ?? "",
        facebookUrl: query.data.item.facebook_url ?? "",
        websiteUrl: query.data.item.website_url ?? "",
        institutionalText: query.data.item.institutional_text ?? "",
        primaryColor: query.data.item.primary_color ?? "",
        secondaryColor: query.data.item.secondary_color ?? "",
        seoTitle: query.data.item.seo_title ?? "",
        seoDescription: query.data.item.seo_description ?? "",
      });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-store-settings"] }),
  });

  return (
    <AdminPageShell
      title="Configuracoes da loja"
      description="Edite dados comerciais e institucionais exibidos no site, totem, vitrine e mensagens de WhatsApp."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Preencha os dados principais da loja exatamente como devem aparecer ao publico.",
        "Revise WhatsApp, endereco, horario e redes sociais antes de salvar.",
        "Use as cores e o texto institucional para alinhar a apresentacao comercial da loja.",
      ]}
      quickGuideNote="As alteracoes desta tela impactam o storefront, os contatos e parte da identidade visual operacional."
    >
      <AdminCard title="Dados comerciais">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando configuracoes...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminField label="Nome da loja" hint="Nome comercial exibido publicamente.">
                <input
                  value={form.storeName}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, storeName: event.target.value }))
                  }
                  placeholder="Ex: Gamel Metal"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="WhatsApp"
                hint="Use o numero no padrao internacional, sem espacos."
              >
                <input
                  value={form.whatsappNumber}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, whatsappNumber: event.target.value }))
                  }
                  placeholder="5585988887777"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Endereco" hint="Endereco completo visivel no rodape e contatos.">
                <input
                  value={form.address}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, address: event.target.value }))
                  }
                  placeholder="Av. Principal, 1234 - Centro, Fortaleza/CE"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Horario de funcionamento"
                hint="Texto simples para atendimento e exibicao no site."
              >
                <input
                  value={form.openingHours}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, openingHours: event.target.value }))
                  }
                  placeholder="Seg a Sex: 08h-18h | Sab: 08h-12h"
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Instagram URL" hint="Link completo do perfil oficial.">
                <input
                  value={form.instagramUrl}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, instagramUrl: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Facebook URL" hint="Opcional. Use o link completo.">
                <input
                  value={form.facebookUrl}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, facebookUrl: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField
                label="Website URL"
                hint="Opcional. Informe o dominio oficial, se existir."
              >
                <input
                  value={form.websiteUrl}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, websiteUrl: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Cor principal" hint="Hexadecimal. Ex: #f97316">
                <input
                  value={form.primaryColor}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, primaryColor: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <AdminField label="Cor secundaria" hint="Hexadecimal. Ex: #1f2937">
                <input
                  value={form.secondaryColor}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, secondaryColor: event.target.value }))
                  }
                  className={inputClassName()}
                />
              </AdminField>
              <div className="lg:col-span-2">
                <AdminField
                  label="Texto institucional"
                  hint="Breve apresentacao comercial da loja para home, rodape e areas institucionais."
                >
                  <textarea
                    value={form.institutionalText}
                    onChange={(event) =>
                      setForm((current: any) => ({
                        ...current,
                        institutionalText: event.target.value,
                      }))
                    }
                    className={textareaClassName()}
                  />
                </AdminField>
              </div>
              <AdminField label="SEO title" hint="Se vazio, o nome da loja continua como base.">
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
                hint="Resumo curto para busca e compartilhamento."
              >
                <textarea
                  value={form.seoDescription}
                  onChange={(event) =>
                    setForm((current: any) => ({ ...current, seoDescription: event.target.value }))
                  }
                  className={textareaClassName()}
                />
              </AdminField>
            </div>
            <div className="space-y-4">
              <AdminCard title="Preview institucional">
                <div className="space-y-3">
                  <div className="border border-border bg-background p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Loja
                    </p>
                    <p className="mt-2 font-display text-3xl font-extrabold tracking-tight">
                      {form.storeName || "Nome da loja"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {form.institutionalText || "Texto institucional e posicionamento comercial."}
                    </p>
                  </div>
                  <div className="border border-border bg-background p-3 text-sm">
                    <p className="font-bold">WhatsApp</p>
                    <p className="mt-1 text-muted-foreground">
                      {form.whatsappNumber || "Nao definido"}
                    </p>
                    <p className="mt-3 font-bold">Endereco</p>
                    <p className="mt-1 text-muted-foreground">{form.address || "Nao definido"}</p>
                    <p className="mt-3 font-bold">Horario</p>
                    <p className="mt-1 text-muted-foreground">
                      {form.openingHours || "Nao definido"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border border-border bg-background p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Cor principal
                      </p>
                      <div
                        className="mt-2 h-10 border border-border"
                        style={{ backgroundColor: form.primaryColor || "#23272B" }}
                      />
                      <p className="mt-2 text-muted-foreground">{form.primaryColor || "#23272B"}</p>
                    </div>
                    <div className="border border-border bg-background p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Cor secundaria
                      </p>
                      <div
                        className="mt-2 h-10 border border-border"
                        style={{ backgroundColor: form.secondaryColor || "#0E0E0E" }}
                      />
                      <p className="mt-2 text-muted-foreground">
                        {form.secondaryColor || "#0E0E0E"}
                      </p>
                    </div>
                  </div>
                </div>
              </AdminCard>
            </div>
          </div>
        )}

        {mutation.error && (
          <p className="mt-4 text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form)}
            className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar configuracoes
          </button>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
