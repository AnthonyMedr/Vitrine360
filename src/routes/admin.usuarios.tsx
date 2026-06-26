/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  AdminCard,
  AdminField,
  AdminPagination,
  AdminPageShell,
  inputClassName,
} from "@/components/admin/module-ui";
import { getCapabilityLabel, getRoleLabel } from "@/lib/admin-capabilities";
import { assignUserRoleAdmin, listUsersAndRolesAdmin } from "@/lib/commercial.functions";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsersAdminPage,
});

function UsersAdminPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUsersAndRolesAdmin);
  const assignFn = useServerFn(assignUserRoleAdmin);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("viewer");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn({ data: {} }),
  });

  const mutation = useMutation({
    mutationFn: ({ nextUserId, nextRole }: { nextUserId: string; nextRole: string }) =>
      assignFn({ data: { userId: nextUserId, role: nextRole } }),
    onSuccess: () => {
      setUserId("");
      setRole("viewer");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = query.data?.items ?? [];
  const filteredUsers = users.filter((item: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [item.email, item.id, ...(item.roles ?? []).map((entry: any) => entry.role)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const roleDescriptions: Record<string, string> = {
    infiniti_master: "Acesso total, incluindo configuracoes tecnicas e governanca completa.",
    store_admin: "Gerencia a operacao comercial da loja sem alterar a camada tecnica.",
    commercial_operator: "Opera cadastros e campanhas do dia a dia com acesso reduzido.",
    viewer: "Consulta dashboard e relatorios sem editar a operacao.",
  };

  return (
    <AdminPageShell
      title="Usuarios e permissoes"
      description="Gerencie perfis de acesso por loja. Permissoes tecnicas seguem restritas a perfis master."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Selecione ou cole o ID do usuario e atribua o perfil adequado.",
        "Use visualizador para acesso de consulta e operador para rotina comercial.",
        "Mantenha perfis tecnicos mais amplos apenas com a equipe responsavel da InfiniTI.",
      ]}
      quickGuideNote="Perfis mais amplos aumentam o risco operacional. Prefira o menor nivel de acesso necessario para cada pessoa."
    >
      <AdminCard title="Atribuir permissao">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <AdminField label="User ID">
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={inputClassName()}
            />
          </AdminField>
          <AdminField label="Perfil">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={inputClassName()}
            >
              <option value="infiniti_master">InfiniTI Master</option>
              <option value="store_admin">Administrador da Loja</option>
              <option value="commercial_operator">Operador Comercial</option>
              <option value="viewer">Visualizador</option>
            </select>
          </AdminField>
          <div className="self-end">
            <button
              disabled={mutation.isPending || !userId}
              onClick={() => mutation.mutate({ nextUserId: userId, nextRole: role })}
              className="inline-flex items-center gap-2 bg-action px-4 py-2 text-sm font-bold text-action-foreground disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar perfil
            </button>
          </div>
        </div>
        {mutation.error && (
          <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}
      </AdminCard>

      <AdminCard title="Usuarios conhecidos">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <AdminField label="Buscar usuario" hint="Pesquise por email, ID ou perfil atual.">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: admin, visualizador, @cliente"
              className={inputClassName()}
            />
          </AdminField>
          <div className="flex items-end">
            <div className="border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {filteredUsers.length} usuario(s)
            </div>
          </div>
        </div>
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando usuarios...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">User ID</th>
                    <th className="py-2 pr-3">Perfis</th>
                    <th className="py-2 pr-3">Ajuste rapido</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-sm text-muted-foreground">
                        Nenhum usuario encontrado com esse filtro.
                      </td>
                    </tr>
                  )}
                  {pagedUsers.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">{item.email ?? "-"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{item.id}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {(item.roles ?? []).map((entry: any) => (
                            <span
                              key={entry.id}
                              className="bg-surface px-2 py-1 text-[11px] font-bold uppercase"
                            >
                              {getRoleLabel(entry.role)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <InlineRoleEditor
                          currentRoles={(item.roles ?? []).map((entry: any) => entry.role)}
                          loading={mutation.isPending}
                          onPickId={() => setUserId(item.id)}
                          onSave={(nextRole) => mutation.mutate({ nextUserId: item.id, nextRole })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              currentPage={currentPage}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </AdminCard>

      <AdminCard title="Guia rapido de perfis">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["infiniti_master", "store_admin", "commercial_operator", "viewer"].map((profileKey) => (
            <article key={profileKey} className="border border-border bg-background p-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                {getRoleLabel(profileKey)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{roleDescriptions[profileKey]}</p>
            </article>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="Matriz de permissao por perfil">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Perfil</th>
                <th className="py-2 pr-3">Capacidades</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(query.data?.capabilityMatrix ?? {}).map(([profile, capabilities]) => (
                <tr key={profile} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 font-bold uppercase">{profile}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      {(capabilities as string[]).map((capability) => (
                        <span
                          key={capability}
                          className="bg-surface px-2 py-1 text-[11px] font-bold"
                        >
                          {getCapabilityLabel(capability as any)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

function InlineRoleEditor({
  currentRoles,
  loading,
  onPickId,
  onSave,
}: {
  currentRoles: string[];
  loading: boolean;
  onPickId: () => void;
  onSave: (role: string) => void;
}) {
  const [nextRole, setNextRole] = useState(currentRoles[0] ?? "viewer");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={nextRole}
        onChange={(event) => setNextRole(event.target.value)}
        className="border border-border bg-background px-2 py-1.5 text-xs"
      >
        <option value="infiniti_master">InfiniTI Master</option>
        <option value="store_admin">Administrador da Loja</option>
        <option value="commercial_operator">Operador Comercial</option>
        <option value="viewer">Visualizador</option>
      </select>
      <button
        onClick={() => onSave(nextRole)}
        disabled={loading}
        className="inline-flex items-center gap-1 border border-border px-2 py-1.5 text-xs font-bold hover:bg-highlight disabled:opacity-60"
      >
        <ShieldCheck className="size-3.5" /> Aplicar
      </button>
      <button
        onClick={onPickId}
        className="inline-flex items-center gap-1 border border-border px-2 py-1.5 text-xs font-bold"
      >
        Usar ID
      </button>
    </div>
  );
}
