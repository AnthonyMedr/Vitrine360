import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, QrCode, ScanSearch, ShieldCheck } from "lucide-react";
import { AdminCard, AdminPageShell } from "@/components/admin/module-ui";

export const Route = createFileRoute("/admin/relatorios")({
  component: ReportsAdminPage,
});

function ReportsAdminPage() {
  return (
    <AdminPageShell
      title="Relatorios e auditorias"
      description="Central operacional para leitura de desempenho, exportacoes, QR Codes e verificacoes tecnicas de SEO."
      quickGuideTitle="Como usar esta tela"
      quickGuideItems={[
        "Abra o dashboard para leitura diaria de leads, visualizacoes, IA e comportamento comercial.",
        "Use QR Codes para revisar materiais permanentes e campanhas com distribuicao fisica.",
        "Passe pelas auditorias de SEO antes de publicacoes importantes ou mudancas de conteudo.",
      ]}
      quickGuideNote="Esta area reune atalhos de analise. A homologacao final de producao ainda depende do dominio oficial, banco real e checklist completo de Go-Live."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminCard
          title="Relatorios comerciais"
          action={<BarChart3 className="size-4 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground">
            Acompanhe visualizacoes, leads, uso de IA, simulador, QR Code e filtros utilizados no
            catalogo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin"
              className="rounded-full bg-action px-4 py-2 text-xs font-bold uppercase tracking-wider text-action-foreground"
            >
              Abrir dashboard
            </Link>
          </div>
        </AdminCard>

        <AdminCard
          title="QR Codes operacionais"
          action={<QrCode className="size-4 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground">
            Consulte QR Codes permanentes de campanhas, materiais de apoio e pontos de contato da
            operacao comercial.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/qrcodes"
              className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Gerenciar QR Codes
            </Link>
          </div>
        </AdminCard>

        <AdminCard
          title="Auditoria de SEO"
          action={<ScanSearch className="size-4 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground">
            Verifique titulos, descricoes, canonical, JSON-LD e cobertura de sitemap antes de
            divulgar novas campanhas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/seo"
              className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Abrir auditoria
            </Link>
            <Link
              to="/admin/seo-agendamentos"
              className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Ver agendamentos
            </Link>
          </div>
        </AdminCard>

        <AdminCard
          title="Governanca tecnica"
          action={<ShieldCheck className="size-4 text-muted-foreground" />}
        >
          <p className="text-sm text-muted-foreground">
            Revise readiness de ambiente, logs recentes de auditoria e seed de contingencia antes do
            Go-Live assistido.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/configuracoes-tecnicas"
              className="rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Area tecnica
            </Link>
          </div>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
