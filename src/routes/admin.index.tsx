import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  Loader2,
  MessageCircle,
  QrCode,
  Search as SearchIcon,
  ShieldPlus,
} from "lucide-react";
import { useState } from "react";
import {
  AdminCard,
  AdminField,
  AdminPageShell,
  inputClassName,
} from "@/components/admin/module-ui";
import { claimAdminIfFirst, checkIsAdmin, getAdminDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const isAdminFn = useServerFn(checkIsAdmin);
  const claimFn = useServerFn(claimAdminIfFirst);
  const dashFn = useServerFn(getAdminDashboard);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [campaign, setCampaign] = useState("");
  const [category, setCategory] = useState("");

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => isAdminFn({}),
  });

  const dashQ = useQuery({
    queryKey: ["admin-dash", from, to, campaign, category],
    queryFn: () =>
      dashFn({
        data: { from, to, campaign: campaign || undefined, category: category || undefined },
      }),
    enabled: adminQ.data?.isAdmin === true,
  });

  const claimMut = useMutation({
    mutationFn: () => claimFn({}),
    onSuccess: () => adminQ.refetch(),
  });

  if (adminQ.isLoading) {
    return (
      <Centered>
        <Loader2 className="size-6 animate-spin" />
      </Centered>
    );
  }

  if (!adminQ.data?.isAdmin) {
    return (
      <Centered>
        <div className="max-w-md border border-border bg-card p-8 text-center text-card-foreground shadow-card">
          <ShieldPlus className="mx-auto size-10 text-action" />
          <h2 className="mt-4 font-display text-2xl font-extrabold">Acesso restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum perfil administrativo foi encontrado para esta sessao. Se for o primeiro acesso,
            reivindique a funcao administrativa.
          </p>
          <button
            onClick={() => claimMut.mutate()}
            disabled={claimMut.isPending}
            className="mt-6 inline-flex items-center gap-2 bg-action px-6 py-3 font-black text-action-foreground shadow-card hover:brightness-110 disabled:opacity-60"
          >
            {claimMut.isPending && <Loader2 className="size-4 animate-spin" />}
            Tornar-me administrador
          </button>
          {claimMut.data?.claimed === false && (
            <p className="mt-3 text-xs text-destructive">
              Ja existe um administrador. Solicite acesso a InfiniTI.
            </p>
          )}
        </div>
      </Centered>
    );
  }

  if (dashQ.isLoading || !dashQ.data) {
    return (
      <Centered>
        <Loader2 className="size-6 animate-spin" />
      </Centered>
    );
  }

  const data = dashQ.data;

  return (
    <AdminPageShell
      title="Painel administrativo"
      description="Leitura consolidada da operacao comercial para produtos, campanhas, leads, IA, QR Codes e comportamento do catalogo."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Ajuste o periodo e os filtros para isolar uma campanha, uma categoria ou uma janela especifica.",
        "Leia os indicadores primeiro para identificar volume, depois avance para produtos, categorias e leads.",
        "Exporte o CSV quando precisar repassar dados para comercial, direcao ou atendimento.",
      ]}
      quickGuideNote="Este dashboard ajuda na rotina diaria. A leitura final de producao ainda deve considerar analytics oficial, dominio definitivo e conteudo homologado."
    >
      <AdminCard title="Filtros operacionais">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <AdminField label="De">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className={inputClassName()}
            />
          </AdminField>
          <AdminField label="Ate">
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => setTo(event.target.value)}
              className={inputClassName()}
            />
          </AdminField>
          <AdminField label="Campanha" hint="Use o slug para filtrar uma acao especifica.">
            <input
              type="text"
              value={campaign}
              placeholder="ex: semana-do-forro"
              onChange={(event) => setCampaign(event.target.value)}
              className={inputClassName()}
            />
          </AdminField>
          <AdminField
            label="Categoria"
            hint="Use o slug da categoria quando quiser leitura mais recortada."
          >
            <input
              type="text"
              value={category}
              placeholder="ex: chapas-uv"
              onChange={(event) => setCategory(event.target.value)}
              className={inputClassName()}
            />
          </AdminField>
          <button
            onClick={() => {
              setFrom(monthAgo);
              setTo(today);
              setCampaign("");
              setCategory("");
            }}
            className="border border-foreground bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background"
          >
            Limpar
          </button>
        </div>
      </AdminCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={<MessageCircle className="size-4" />}
          label="Leads WhatsApp"
          value={data.totals.whatsapp}
          tone="bg-action text-action-foreground"
        />
        <Kpi icon={<Eye className="size-4" />} label="Visualizacoes" value={data.totals.views} />
        <Kpi icon={<QrCode className="size-4" />} label="QR Codes" value={data.totals.qr} />
        <Kpi icon={<SearchIcon className="size-4" />} label="Buscas" value={data.totals.searches} />
        <Kpi icon={<Eye className="size-4" />} label="Eventos" value={data.totals.events} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Eye className="size-4" />}
          label="Recomendacoes IA"
          value={data.totals.aiRecommend}
          tone="bg-brand text-brand-foreground"
        />
        <Kpi
          icon={<Eye className="size-4" />}
          label="Simulacoes"
          value={data.totals.roomSimulator}
          tone="bg-highlight text-highlight-foreground"
        />
        <Kpi
          icon={<MessageCircle className="size-4" />}
          label="Leads totais"
          value={data.totals.leads}
        />
        <Kpi
          icon={<Eye className="size-4" />}
          label="Dias com trafego"
          value={data.perDay.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Leitura rapida"
          items={[
            `${data.topProducts.length} produto(s) em destaque na janela filtrada`,
            `${data.topCategories.length} categoria(s) com busca ou filtro relevante`,
            `${data.leads.length} lead(s) recente(s) disponivel(is) para exportacao`,
          ]}
        />
        <SummaryCard
          title="Atencao comercial"
          items={[
            "Campanhas com muito acesso e pouco lead pedem CTA ou QR mais forte.",
            "Produtos muito vistos sem conversa podem precisar de descricao mais objetiva.",
            "Categorias com busca alta merecem destaque na home, totem ou vitrine.",
          ]}
        />
        <SummaryCard
          title="Proxima acao"
          items={[
            "Revisar banners e destaques da semana.",
            "Checar SEO ou QR Codes antes de nova divulgacao.",
            "Exportar leads filtrados para atendimento e follow-up.",
          ]}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Produtos mais vistos">
          <ol className="space-y-2 text-sm">
            {data.topProducts.length === 0 && (
              <li className="text-muted-foreground">Sem dados ainda.</li>
            )}
            {data.topProducts.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border border-border/60 bg-background px-3 py-2"
              >
                <span>
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {item.id}
                </span>
                <span className="font-bold">{item.count}</span>
              </li>
            ))}
          </ol>
        </AdminCard>
        <AdminCard title="Categorias mais filtradas">
          <ol className="space-y-2 text-sm">
            {data.topCategories.length === 0 && (
              <li className="text-muted-foreground">Sem dados ainda.</li>
            )}
            {data.topCategories.map((item, index) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 border border-border/60 bg-background px-3 py-2"
              >
                <span>
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {item.name}
                </span>
                <span className="font-bold">{item.count}</span>
              </li>
            ))}
          </ol>
        </AdminCard>
      </section>

      <AdminCard
        title={`Ultimos leads (${data.leads.length})`}
        action={
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(data.leads))}`}
            download={`leads_${from}_a_${to}.csv`}
            className="inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-background"
          >
            <Download className="size-3.5" /> CSV filtrado
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3">Loja</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum lead ainda.
                  </td>
                </tr>
              )}
              {data.leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap py-2 pr-3">
                    {new Date(lead.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3">{lead.product_name ?? "-"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{lead.category ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <span className="text-xs font-bold uppercase">{lead.source}</span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{lead.store_unit ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center py-24">{children}</div>;
}

function Kpi({
  icon,
  label,
  value,
  tone = "bg-card text-card-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={`border border-border/70 p-4 shadow-card ${tone}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function SummaryCard({ title, items }: { title: string; items: string[] }) {
  return (
    <AdminCard title={title}>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="font-bold text-foreground">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const header = [
    "data_hora",
    "origem",
    "campanha_categoria",
    "produto_id",
    "produto",
    "loja",
    "contato_nome",
    "contato_telefone",
    "mensagem",
  ].join(",");
  const body = rows
    .map((row) =>
      [
        new Date(String(row.created_at ?? "")).toISOString(),
        row.source,
        row.category ?? "",
        row.product_id ?? "",
        row.product_name ?? "",
        row.store_unit ?? "",
        row.contact_name ?? "",
        row.contact_phone ?? "",
        row.message ?? "",
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}
