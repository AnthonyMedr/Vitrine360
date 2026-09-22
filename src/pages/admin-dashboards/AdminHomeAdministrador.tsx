import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Download, Image, Megaphone, MessageSquareText, PackageSearch, Plus, RefreshCw, Save, ShieldCheck, UsersRound } from "lucide-react";
import { useAdminResource } from "@/hooks/useAdminResource";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminEmptyState, AdminQueueCard } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell, WorkspaceMetric, WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { ManagementTask, DailyManagement, TasksResponse, Draft } from "./adminHomeShared";
import { emptyDaily, taskTone, formatDate } from "./adminHomeShared";

type CatalogImageAuditResponse = {
  active_summary: { suspect: number; critical: number; manual_review: number };
};

type QuoteRequestsResponse = { requests: Array<{ quote: { status?: string | null } }> };
type LeadRecord = { status?: string | null };

const shortcuts = [
  { label: "Orçamentos", description: "Fila comercial com protocolo, produtos, status e responsável.", href: "/admin/orçamentos", icon: MessageSquareText },
  { label: "Produtos", description: "Corrigir cadastro, imagem, texto e publicação.", href: "/admin/produtos", icon: PackageSearch },
  { label: "Banners e vitrines", description: "Ajustar home, chamadas comerciais e vitrines.", href: "/admin/banners-vitrines", icon: Megaphone },
  { label: "Mídia", description: "Organizar imagens do catálogo e materiais visuais.", href: "/admin/midia", icon: Image },
  { label: "Operação", description: "Leads e orçamentos em andamento.", href: "/admin/operação", icon: ClipboardList },
  { label: "Usuários e permissões", description: "Perfis, acessos e auditoria.", href: "/admin/usuarios", icon: UsersRound },
];

export default function AdminHomeAdministrador() {
  const daily = useAdminResource<DailyManagement>("/api/admin/management/daily", emptyDaily);
  const tasks = useAdminResource<TasksResponse>("/api/admin/management/tasks", { tasks: [] });
  const { data: products = [] } = useProducts({ limit: 200 });
  const imageAudit = useAdminResource<CatalogImageAuditResponse>("/api/admin/catalog/image-audit", {
    active_summary: { suspect: 0, critical: 0, manual_review: 0 },
  });
  const quoteRequests = useAdminResource<QuoteRequestsResponse>("/api/admin/quote-requests", { requests: [] });
  const leads = useAdminResource<LeadRecord[]>("/api/admin/leads", []);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const productsPendingReview = useMemo(
    () => products.filter((product) => product.status_product === "draft" || product.image_review_status === "manual_review" || product.image_review_status === "suspect"),
    [products],
  );
  const newQuotes = useMemo(
    () => quoteRequests.data.requests.filter((request) => ["new", "novo", "draft", "pending", "pendente"].includes(String(request.quote.status || "novo").toLowerCase())),
    [quoteRequests.data.requests],
  );
  const leadsInService = useMemo(
    () => leads.data.filter((lead) => ["em_atendimento", "em atendimento", "open", "aberto", "pending", "pendente"].includes(String(lead.status || "").toLowerCase())),
    [leads.data],
  );

  function createTask() {
    setFeedback(null);
    setDraft({
      id: "",
      title: "",
      description: "",
      area: "Gestao",
      severity: "medium",
      owner: "",
      status: "novo",
      due_at: new Date().toISOString().slice(0, 10),
      note: "",
      recommended_action: "Acompanhar e registrar andamento.",
    });
  }

  function editTask(task: ManagementTask) {
    setFeedback(null);
    setDraft({
      id: task.id,
      title: task.title,
      description: task.description,
      area: task.area,
      severity: task.severity,
      owner: task.owner,
      status: task.status,
      due_at: task.due_at.slice(0, 10),
      note: task.note || "",
      recommended_action: task.recommended_action,
    });
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        area: draft.area.trim() || "Gestao",
        severity: draft.severity,
        owner: draft.owner.trim() || "Sem responsável",
        status: draft.status,
        due_at: new Date(`${draft.due_at}T12:00:00`).toISOString(),
        note: draft.note.trim(),
        recommended_action: draft.recommended_action.trim() || "Acompanhar e registrar andamento.",
      };
      if (draft.id) {
        await apiFetch(`/api/admin/management/tasks/${encodeURIComponent(draft.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/admin/management/tasks", { method: "POST", body: JSON.stringify(payload) });
      }
      await Promise.all([tasks.reload(), daily.reload()]);
      setFeedback("Tarefa salva.");
      setDraft(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Painel GAMEL"
      title="Início"
      description="Painel GAMEL para acompanhar orçamentos, catálogo, presença digital e tarefas do time."
      actions={<Button onClick={() => { void daily.reload(); void tasks.reload(); }} variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Orçamentos novos" value={newQuotes.length} tone={newQuotes.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Leads em atendimento" value={leadsInService.length} />
          <WorkspaceMetric label="Produtos para revisar" value={productsPendingReview.length} tone={productsPendingReview.length > 0 ? "warn" : "ok"} />
          <WorkspaceMetric label="Imagens suspeitas" value={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical} tone={imageAudit.data.active_summary.suspect + imageAudit.data.active_summary.critical > 0 ? "danger" : "ok"} />
        </div>

        <WorkspaceSection title="Atalhos">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <Link key={shortcut.href} to={shortcut.href} className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-semibold">{shortcut.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{shortcut.description}</p>
                </Link>
              );
            })}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Tarefas do time" action={<><Button size="sm" onClick={createTask}><Plus className="mr-2 h-4 w-4" />Nova tarefa</Button><Button asChild size="sm" variant="outline"><a href="/api/admin/management/tasks?format=csv" target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />CSV</a></Button></>}>
          {draft ? (
            <div className="mb-4 rounded-lg border bg-muted/25 p-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-sm font-medium">
                  Título
                  <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="text-sm font-medium">
                  Responsável
                  <input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="text-sm font-medium lg:col-span-2">
                  Descrição
                  <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="text-sm font-medium">
                  Prazo
                  <input type="date" value={draft.due_at} onChange={(event) => setDraft({ ...draft, due_at: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </label>
                <label className="text-sm font-medium">
                  Severidade
                  <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Status
                  <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <option value="novo">Novo</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={saveDraft} disabled={saving || !draft.title.trim()}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
                {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
              </div>
            </div>
          ) : feedback ? (
            <div className="mb-4 rounded-lg border bg-background p-3 text-sm text-muted-foreground">{feedback}</div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {daily.data.priorities.map((task) => (
              <AdminQueueCard
                key={task.id}
                title={task.title}
                description={task.description}
                tone={taskTone(task)}
                eyebrow={<><Badge variant="outline">{task.owner || "Sem responsável"}</Badge><Badge variant="secondary">{task.area}</Badge>{task.external_blocker ? <Badge variant="destructive">externo</Badge> : null}</>}
                meta={<span>Prazo: {formatDate(task.due_at)} - {task.recommended_action}</span>}
                action={<Button size="sm" variant="outline" onClick={() => editTask(task)}>Editar</Button>}
              />
            ))}
            {daily.data.priorities.length === 0 ? (
              <AdminEmptyState title="Nenhuma tarefa prioritária agora." description="Crie uma tarefa manual ou acompanhe orçamentos e catálogo pelos atalhos acima." />
            ) : null}
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Quando chamar o administrador">
          <div className="grid gap-3 lg:grid-cols-2">
            <AdminQueueCard
              title="Permissões e usuários"
              description="Mudanças de perfil, acesso, segurança e auditoria devem ficar com responsáveis autorizados."
              tone="neutral"
              eyebrow={<ShieldCheck className="h-4 w-4 text-primary" />}
              action={<Button asChild size="sm" variant="outline"><Link to="/admin/usuarios">Usuários</Link></Button>}
            />
            <AdminQueueCard
              title="Configurações e integrações"
              description="Domínio, credenciais, integrações e ajustes técnicos ficam com o administrador."
              tone="neutral"
              eyebrow={<ShieldCheck className="h-4 w-4 text-primary" />}
              action={<Button asChild size="sm" variant="outline"><Link to="/admin/configuracoes">Configurações</Link></Button>}
            />
          </div>
        </WorkspaceSection>
      </div>
    </AdminWorkspaceShell>
  );
}
