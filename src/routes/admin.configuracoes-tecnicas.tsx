import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseZap, Loader2 } from "lucide-react";
import { AdminCard, AdminPageShell } from "@/components/admin/module-ui";
import {
  getTechnicalOverviewAdmin,
  listRecentAuditLogsAdmin,
  seedCommercialDataAdmin,
} from "@/lib/commercial.functions";

type AuditLogItem = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  user_id: string | null;
};

export const Route = createFileRoute("/admin/configuracoes-tecnicas")({
  component: TechnicalSettingsPage,
});

function TechnicalSettingsPage() {
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getTechnicalOverviewAdmin);
  const auditLogsFn = useServerFn(listRecentAuditLogsAdmin);
  const seedFn = useServerFn(seedCommercialDataAdmin);
  const query = useQuery({
    queryKey: ["admin-technical-overview"],
    queryFn: () => overviewFn({}),
  });
  const logsQuery = useQuery({
    queryKey: ["admin-technical-audit-logs"],
    queryFn: () => auditLogsFn({}),
  });
  const seedMutation = useMutation({
    mutationFn: () => seedFn({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technical-overview"] });
    },
  });

  return (
    <AdminPageShell
      title="Configuracoes tecnicas restritas"
      description="Area reservada para a InfiniTI controlar ambiente, readiness de credenciais e saude estrutural da plataforma."
      actions={
        <button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
        >
          {seedMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <DatabaseZap className="size-4" />
          )}
          Executar seed inicial
        </button>
      }
    >
      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando visao tecnica...
        </div>
      ) : query.error ? (
        <AdminCard>
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
        </AdminCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminCard title="Migracao inicial">
            <p className="text-sm text-muted-foreground">
              Envie categorias, produtos, galerias e campanhas legadas do fallback local para o
              banco sem remover o mecanismo de contingencia.
            </p>
            {seedMutation.data && (
              <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm">
                <p>
                  Seed concluido para a loja <strong>{seedMutation.data.storeId}</strong>.
                </p>
                <p className="mt-1 text-muted-foreground">
                  {seedMutation.data.categories} categorias, {seedMutation.data.products} produtos e{" "}
                  {seedMutation.data.campaigns} campanhas sincronizados.
                </p>
              </div>
            )}
            {seedMutation.error && (
              <p className="mt-4 text-sm text-destructive">
                {(seedMutation.error as Error).message}
              </p>
            )}
          </AdminCard>
          <AdminCard title="Ambiente">
            <ul className="space-y-2 text-sm">
              {Object.entries(query.data?.env ?? {}).map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
                >
                  <span>{key}</span>
                  <strong>{value ? "OK" : "PENDENTE"}</strong>
                </li>
              ))}
            </ul>
          </AdminCard>
          <AdminCard title="Contagem estrutural">
            <ul className="space-y-2 text-sm">
              {Object.entries(query.data?.counts ?? {}).map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
                >
                  <span>{key}</span>
                  <strong>{String(value)}</strong>
                </li>
              ))}
            </ul>
          </AdminCard>
          <AdminCard title="Ultimos logs de auditoria">
            {logsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando logs...
              </div>
            ) : logsQuery.error ? (
              <p className="text-sm text-destructive">{(logsQuery.error as Error).message}</p>
            ) : (
              <div className="space-y-2">
                {(logsQuery.data?.items ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum log de auditoria encontrado.
                  </p>
                )}
                {(logsQuery.data?.items ?? []).map((item: AuditLogItem) => (
                  <article
                    key={item.id}
                    className="rounded-lg bg-background px-3 py-3 text-sm text-card-foreground"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{item.action}</strong>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.entity_type}
                      {item.entity_id ? ` | ${item.entity_id}` : ""}
                      {item.user_id ? ` | usuario ${item.user_id}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}
