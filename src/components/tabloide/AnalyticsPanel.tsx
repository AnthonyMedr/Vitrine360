import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Eye,
  MessageCircle,
  QrCode,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  ANALYTICS_UPDATE_EVENT,
  clearEvents,
  exportCsv,
  getEvents,
  summarize,
  type AnalyticsEvent,
} from "@/lib/analytics";

export function AnalyticsPanel() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    const refresh = () => setEvents(getEvents());
    refresh();

    window.addEventListener(ANALYTICS_UPDATE_EVENT, refresh);
    return () => window.removeEventListener(ANALYTICS_UPDATE_EVENT, refresh);
  }, []);

  const summary = useMemo(() => summarize(events), [events]);
  const maxDay = Math.max(1, ...summary.last7Days.map((day) => day.count));

  const downloadCsv = () => {
    const blob = new Blob([exportCsv(events)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-vitrine360-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Painel de analytics"
        className="fixed bottom-5 left-20 z-40 inline-flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground opacity-50 shadow-pop transition-transform hover:scale-105 hover:opacity-100 active:scale-95"
      >
        <BarChart3 className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-foreground/50 backdrop-blur-sm animate-reveal"
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto bg-card text-card-foreground shadow-pop"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight">
                  Painel de analytics
                </h2>
                <p className="text-xs text-muted-foreground">
                  {summary.total} eventos registrados • dados salvos localmente no totem
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-surface"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard
                  icon={<Eye className="size-4" />}
                  label="Visualizacoes"
                  value={summary.byType.product_view}
                  accent="bg-brand text-brand-foreground"
                />
                <KpiCard
                  icon={<MessageCircle className="size-4" />}
                  label="WhatsApp"
                  value={summary.byType.product_whatsapp}
                  accent="bg-action text-action-foreground"
                />
                <KpiCard
                  icon={<QrCode className="size-4" />}
                  label="QR Codes"
                  value={summary.byType.product_qr}
                  accent="bg-foreground text-background"
                />
                <KpiCard
                  icon={<TrendingUp className="size-4" />}
                  label="Conversao"
                  value={`${(summary.conversionRate * 100).toFixed(1)}%`}
                  accent="bg-highlight text-highlight-foreground"
                />
              </div>

              <section>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-action">
                  Atividade nos ultimos 7 dias
                </h3>
                <div className="flex h-32 items-end gap-1.5 rounded-2xl bg-surface p-4">
                  {summary.last7Days.map((day) => (
                    <div
                      key={day.day}
                      className="group flex flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[10px] font-bold text-foreground opacity-0 group-hover:opacity-100">
                        {day.count}
                      </span>
                      <div
                        className="min-h-[2px] w-full rounded-t-md bg-action transition-all"
                        style={{ height: `${(day.count / maxDay) * 100}%` }}
                      />
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {day.day.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-action">
                  Produtos mais procurados
                </h3>
                {summary.topProducts.length === 0 ? (
                  <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
                    Ainda sem interacoes. Os cliques dos clientes vao aparecer aqui.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {summary.topProducts.map((product, index) => (
                      <li
                        key={product.id}
                        className="flex items-center gap-3 rounded-xl bg-surface p-3"
                      >
                        <span className="grid size-7 place-items-center rounded-full bg-foreground text-xs font-black text-background">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{product.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {product.views} views • {product.whatsapp} WhatsApp • {product.qr} QR
                          </p>
                        </div>
                        <span className="text-xs font-bold text-action">{product.score}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-action">
                  Categorias mais filtradas
                </h3>
                {summary.topCategories.length === 0 ? (
                  <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
                    Nenhum filtro registrado ainda.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {summary.topCategories.map((category) => (
                      <span
                        key={category.id}
                        className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm font-bold"
                      >
                        {category.name}
                        <span className="rounded-full bg-action px-2 py-0.5 text-[11px] text-action-foreground">
                          {category.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-wrap gap-3 border-t border-border pt-3">
                <button
                  onClick={downloadCsv}
                  disabled={events.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-40"
                >
                  <Download className="size-4" /> Exportar CSV
                </button>
                <button
                  onClick={() => {
                    if (confirm("Apagar todo o historico de analytics deste totem?")) {
                      clearEvents();
                      setEvents([]);
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" /> Limpar historico
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <span className={`inline-flex size-8 items-center justify-center rounded-full ${accent}`}>
        {icon}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-2xl font-extrabold leading-none text-foreground">{value}</p>
    </div>
  );
}
