import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileText,
  Handshake,
  MessageCircle,
  ReceiptText,
  Users,
} from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { getPlatformExperience } from "@/config/platform";
import { useSettings } from "@/context/SettingsContext";
import { buildGenericMessage, whatsappUrl } from "@/lib/whatsapp";

const portal = getPlatformExperience("representante");

const representativeModules = [
  {
    title: "Clientes",
    description: "Carteira, historico, status de atendimento e proximas acoes comerciais.",
    icon: Users,
  },
  {
    title: "Precos",
    description: "Tabela comercial, linhas por categoria e leitura rapida de itens sob consulta.",
    icon: BadgePercent,
  },
  {
    title: "Condicoes",
    description: "Prazos, regras comerciais, descontos autorizados e politica por perfil.",
    icon: Handshake,
  },
  {
    title: "Cotacoes",
    description: "Montagem de orcamentos, envio por WhatsApp e acompanhamento de conversao.",
    icon: FileText,
  },
  {
    title: "Pedidos",
    description: "Pedidos aprovados, status operacional, faturamento e entrega.",
    icon: ReceiptText,
  },
  {
    title: "Comissoes",
    description: "Base de vendas, previsao de comissao e fechamento por periodo.",
    icon: ClipboardCheck,
  },
] as const;

export const Route = createFileRoute("/representante")({
  beforeLoad: () => {
    throw redirect({ to: "/produtos" });
  },
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Portal do Representante` },
      {
        name: "description",
        content:
          "Portal do Representante GAMEL para clientes, precos, condicoes, cotacoes, pedidos e comissoes.",
      },
      { property: "og:title", content: `${brandConfig.productName} | Portal do Representante` },
      {
        property: "og:description",
        content:
          "Experiencia comercial para representantes GAMEL com carteira, cotacoes, pedidos e comissoes.",
      },
      { property: "og:url", content: absoluteUrl("/representante") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/representante") }],
  }),
  component: RepresentativePortalPage,
});

function RepresentativePortalPage() {
  const { settings } = useSettings();
  const wa = whatsappUrl(
    `Ola! Quero acessar o Portal do Representante da ${settings.brand}.`,
    settings.whatsappNumber,
  );

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={null} />
      <GlobalHeader />
      <main>
        <section className="bg-brand text-brand-foreground">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.75fr)] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-action">
                <BriefcaseBusiness className="size-3.5" /> Experiencia comercial
              </span>
              <h1 className="mt-5 font-display text-5xl leading-none sm:text-7xl">
                Portal do Representante GAMEL
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-foreground/76 sm:text-lg">
                {portal?.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-action px-6 py-3.5 font-bold text-action-foreground shadow-pop transition-transform hover:scale-[1.02]"
                >
                  <MessageCircle className="size-4" /> Solicitar acesso
                </a>
                <Link
                  to="/catalogo"
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/6 px-6 py-3.5 font-bold text-brand-foreground shadow-card transition-transform hover:scale-[1.02] hover:bg-white/10"
                >
                  Consultar catalogo <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <aside className="border border-white/10 bg-white/6 p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <StoreLogo
                  brand={settings.brand}
                  logoUrl={settings.logoUrl}
                  imageClassName="size-10"
                  fallbackClassName="size-10 bg-white/10 text-brand-foreground"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-action">
                    GAMEL Digital
                  </p>
                  <p className="font-display text-2xl">{settings.brand}</p>
                </div>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="font-bold uppercase tracking-wider text-brand-foreground/55">
                    URL
                  </dt>
                  <dd className="mt-1 text-brand-foreground">{portal?.domainPath}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wider text-brand-foreground/55">
                    Publico
                  </dt>
                  <dd className="mt-1 text-brand-foreground">{portal?.audience}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wider text-brand-foreground/55">
                    Status
                  </dt>
                  <dd className="mt-1 text-action">Primeira camada estrutural pronta</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-action">
                Rotina do representante
              </span>
              <h2 className="mt-2 font-display text-4xl sm:text-5xl">
                Do cliente ao pedido aprovado
              </h2>
              <div className="mt-3 h-1 w-12 bg-action" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {representativeModules.map((module) => {
              const Icon = module.icon;
              return (
                <article key={module.title} className="rounded-lg border border-border bg-card p-5">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-brand text-brand-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display text-3xl">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {module.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-3">
            <div className="flex gap-3">
              <Building2 className="mt-1 size-5 shrink-0 text-action" />
              <div>
                <h3 className="font-bold">Base unica de catalogo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  O portal usa os mesmos produtos, categorias e campanhas do site publico e totem.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <FileText className="mt-1 size-5 shrink-0 text-action" />
              <div>
                <h3 className="font-bold">Cotacao guiada</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  A proxima fase conecta carrinho de cotacao, regras de preco e aprovacao interna.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ClipboardCheck className="mt-1 size-5 shrink-0 text-action" />
              <div>
                <h3 className="font-bold">Operacao rastreavel</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Leads, conversoes e pedidos entram na inteligencia comercial e no backoffice.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
