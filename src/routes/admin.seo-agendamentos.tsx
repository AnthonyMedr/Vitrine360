import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, History, Loader2, Play, Plus, Trash2 } from "lucide-react";
import {
  AdminCard,
  AdminField,
  AdminPageShell,
  inputClassName,
} from "@/components/admin/module-ui";
import {
  deleteSchedule,
  getAuditDetail,
  listAuditHistory,
  listSchedules,
  upsertSchedule,
} from "@/lib/seo-schedules.functions";
import { auditSeo } from "@/lib/seo-audit.functions";
import { campaigns } from "@/data/campaigns";

export const Route = createFileRoute("/admin/seo-agendamentos")({
  component: SchedulesPage,
});

function SchedulesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSchedules);
  const upsertFn = useServerFn(upsertSchedule);
  const delFn = useServerFn(deleteSchedule);
  const histFn = useServerFn(listAuditHistory);
  const detailFn = useServerFn(getAuditDetail);
  const runAudit = useServerFn(auditSeo);
  const [detailId, setDetailId] = useState<string | null>(null);

  const schedules = useQuery({ queryKey: ["seo-schedules"], queryFn: () => listFn() });
  const history = useQuery({ queryKey: ["seo-history"], queryFn: () => histFn({ data: {} }) });
  const detail = useQuery({
    queryKey: ["seo-history", detailId],
    queryFn: () => detailFn({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const saveMut = useMutation({
    mutationFn: (input: {
      id?: string;
      scope: string;
      campaignSlug?: string | null;
      frequency: string;
      enabled?: boolean;
    }) => upsertFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-schedules"] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-schedules"] }),
  });

  const runMut = useMutation({
    mutationFn: (scope: "all" | "campaigns" | "categories" | "products") =>
      runAudit({ data: { scope } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-history"] }),
  });

  return (
    <AdminPageShell
      title="Agendamentos de SEO"
      description="Organize auditorias recorrentes de paginas publicas, acompanhe o historico e rode verificacoes manuais quando precisar revisar a publicacao."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Cadastre rotinas por escopo ou por campanha para revisar metadados e sitemap com frequencia definida.",
        "Use a auditoria manual antes de publicar uma nova rodada comercial ou uma alteracao importante de conteudo.",
        "Abra o detalhe do historico para inspecionar o payload tecnico retornado pela auditoria.",
      ]}
      quickGuideNote="Os agendamentos ajudam a manter consistencia operacional, mas a validacao final ainda deve considerar dominio oficial, conteudo real e ambiente de producao."
      actions={
        <button
          onClick={() => runMut.mutate("all")}
          disabled={runMut.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background disabled:opacity-50"
        >
          {runMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Rodar auditoria agora
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
        <AdminCard
          title="Novo agendamento"
          action={<CalendarClock className="size-4 text-muted-foreground" />}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              saveMut.mutate({
                scope: String(formData.get("scope")),
                campaignSlug: String(formData.get("campaignSlug") || "") || null,
                frequency: String(formData.get("frequency")),
                enabled: true,
              });
              event.currentTarget.reset();
            }}
            className="space-y-4"
          >
            <AdminField
              label="Escopo"
              hint="Escolha se a rotina vai cobrir todo o site ou apenas um bloco especifico."
            >
              <select name="scope" className={inputClassName()}>
                <option value="all">Tudo</option>
                <option value="campaigns">Campanhas</option>
                <option value="categories">Categorias</option>
                <option value="products">Produtos</option>
              </select>
            </AdminField>

            <AdminField
              label="Campanha opcional"
              hint="Use somente quando quiser acompanhar uma campanha especifica."
            >
              <select name="campaignSlug" className={inputClassName()}>
                <option value="">Sem campanha especifica</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.slug} value={campaign.slug}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminField
              label="Frequencia"
              hint="Para rotinas de publicacao, diaria costuma ser suficiente. Use horario apenas em fases intensas."
            >
              <select name="frequency" className={inputClassName()}>
                <option value="daily">Diaria</option>
                <option value="hourly">Horaria</option>
                <option value="weekly">Semanal</option>
              </select>
            </AdminField>

            <button
              disabled={saveMut.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-action px-4 py-2.5 font-bold text-action-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Salvar agendamento
            </button>
          </form>
        </AdminCard>

        <AdminCard title="Agendamentos ativos">
          {schedules.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando agendamentos...
            </div>
          ) : schedules.data?.items.length ? (
            <div className="grid gap-3">
              {schedules.data.items.map((schedule) => (
                <article
                  key={schedule.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-bold text-foreground">
                      {getScopeLabel(schedule.scope)}
                      {schedule.campaign_slug ? ` · ${schedule.campaign_slug}` : ""}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Frequencia: {getFrequencyLabel(schedule.frequency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Proxima execucao:{" "}
                      {schedule.next_run_at
                        ? new Date(schedule.next_run_at).toLocaleString("pt-BR")
                        : "Nao definida"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ultima execucao:{" "}
                      {schedule.last_run_at
                        ? new Date(schedule.last_run_at).toLocaleString("pt-BR")
                        : "Ainda nao executada"}
                    </p>
                  </div>
                  <button
                    onClick={() => delMut.mutate(schedule.id)}
                    className="rounded-lg bg-destructive/15 p-2 text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Excluir agendamento"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento cadastrado. Crie a primeira rotina para acompanhar SEO com menos
              trabalho manual.
            </p>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title="Historico de auditorias"
        action={<History className="size-4 text-muted-foreground" />}
      >
        {history.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando historico...
          </div>
        ) : history.data?.items.length ? (
          <div className="grid gap-3">
            {history.data.items.map((entry) => {
              const summary = entry.summary as { total?: number; ok?: number; warn?: number };

              return (
                <button
                  key={entry.id}
                  onClick={() => setDetailId(entry.id)}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-action"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-bold text-foreground">
                      {getScopeLabel(entry.scope)}
                      {entry.campaign_slug ? ` · ${entry.campaign_slug}` : ""}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Origem: {entry.triggered_by}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 text-xs font-bold">
                    <span className="text-whatsapp">{summary.ok ?? 0} OK</span>
                    <span className="text-destructive">{summary.warn ?? 0} avisos</span>
                    <span className="text-muted-foreground">{summary.total ?? 0} total</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma auditoria registrada ainda. Rode uma verificacao manual para inaugurar o
            historico tecnico.
          </p>
        )}
      </AdminCard>

      {detailId ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-border bg-background p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight">
                  Detalhe da auditoria
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payload tecnico completo da execucao selecionada.
                </p>
              </div>
              <button
                onClick={() => setDetailId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
              >
                Fechar
              </button>
            </div>

            {detail.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando detalhe...
              </div>
            ) : detail.data ? (
              <pre className="overflow-auto rounded-lg bg-card p-3 text-xs">
                {JSON.stringify(detail.data, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nao foi possivel carregar o detalhe desta auditoria.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}

function getScopeLabel(scope: string) {
  switch (scope) {
    case "campaigns":
      return "Campanhas";
    case "categories":
      return "Categorias";
    case "products":
      return "Produtos";
    default:
      return "Tudo";
  }
}

function getFrequencyLabel(frequency: string) {
  switch (frequency) {
    case "hourly":
      return "Horaria";
    case "weekly":
      return "Semanal";
    default:
      return "Diaria";
  }
}
