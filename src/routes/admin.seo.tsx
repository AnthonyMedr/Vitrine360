import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { AdminCard, AdminPageShell } from "@/components/admin/module-ui";
import { auditSeo } from "@/lib/seo-audit.functions";

export const Route = createFileRoute("/admin/seo")({
  component: SeoAuditPage,
});

function SeoAuditPage() {
  const fn = useServerFn(auditSeo);
  const [scope, setScope] = useState<"all" | "campaigns" | "categories" | "products">("all");
  const q = useQuery({
    queryKey: ["seo-audit", scope],
    queryFn: () => fn({ data: { scope } }),
  });

  return (
    <AdminPageShell
      title="Auditoria de SEO"
      description="Verifique rapidamente se titulos, descricoes, canonical, sitemap e JSON-LD estao consistentes nas rotas principais."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Escolha o escopo para auditar a vitrine inteira ou apenas um grupo de paginas.",
        "Use os indicadores para encontrar falhas de metadado, sitemap e marcacao estruturada.",
        "Corrija primeiro paginas publicas com maior impacto comercial ou de campanha.",
      ]}
      quickGuideNote="Esta auditoria serve como triagem operacional. A validacao final de SEO ainda deve considerar conteudo real e dominio oficial."
    >
      <AdminCard
        title="Escopo da auditoria"
        action={<Search className="size-4 text-muted-foreground" />}
      >
        <div className="flex flex-wrap gap-2">
          {(["all", "campaigns", "categories", "products"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setScope(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                scope === item
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background"
              }`}
            >
              {item === "all" ? "Tudo" : item}
            </button>
          ))}
        </div>
      </AdminCard>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Auditando paginas...
        </div>
      )}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {q.data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Paginas auditadas" value={q.data.summary.total} />
            <Stat label="OK" value={q.data.summary.ok} tone="bg-whatsapp/10 text-whatsapp" />
            <Stat label="Com avisos" value={q.data.summary.warn} tone="bg-highlight/20" />
            <Stat label="Sitemap" value={q.data.summary.sitemapUrls} suffix="URLs" />
          </div>

          <AdminCard title="Resultado por rota">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Title</th>
                    <th className="px-4 py-3 text-center">Description</th>
                    <th className="px-4 py-3 text-center">OG image</th>
                    <th className="px-4 py-3 text-center">Canonical</th>
                    <th className="px-4 py-3 text-center">JSON-LD</th>
                    <th className="px-4 py-3 text-center">Sitemap</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.pages.map((page) => (
                    <tr key={page.url} className="border-b border-border/60">
                      <td className="break-all px-4 py-2 font-mono text-xs">{page.path}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{page.type}</td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.title} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.description} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.ogImage} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.canonical} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.jsonLd} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Mark ok={page.checks.inSitemap} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </>
      )}
    </AdminPageShell>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "bg-card",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <div className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 font-display text-3xl font-extrabold">
        {value} {suffix && <span className="text-sm font-bold opacity-60">{suffix}</span>}
      </div>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="inline size-4 text-whatsapp" />
  ) : (
    <XCircle className="inline size-4 text-destructive" />
  );
}
