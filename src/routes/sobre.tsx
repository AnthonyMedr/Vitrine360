import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Building2, MapPin, MessageCircle, Ruler, Store, Users } from "lucide-react";
import { GamelPublicLayout } from "@/components/public/GamelPublicLayout";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { gamelStoreInfo, gamelWhatsAppMessages, getGamelWhatsAppUrl } from "@/data/gamel-site";

const highlights = [
  {
    icon: Store,
    title: "Distribuidora em Garanhuns",
    description: "Atendimento para obras, reformas, comunicacao visual, acabamento e manutencao.",
  },
  {
    icon: Ruler,
    title: "Materiais sob medida",
    description: "Orientacao sobre medidas, aplicacoes, unidades, acabamentos e compatibilidade.",
  },
  {
    icon: Users,
    title: "Atendimento comercial",
    description: "Equipe preparada para entender a necessidade e montar uma proposta sob consulta.",
  },
  {
    icon: Award,
    title: "Catalogo especializado",
    description: "Linhas de PVC, vinilicos, policarbonato, ACM, aluminio, drywall e coberturas.",
  },
] as const;

const categories = [
  "Ripados internos e externos",
  "Chapas UV",
  "Chapas Policarbonato",
  "Tetos Laminados Vinilicos",
  "Pisos Vinilicos",
  "Forros PVC",
  "Telhas",
  "ACM",
  "Perfil de Aluminio",
  "Drywall e Acessorios",
];

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Quem Somos` },
      {
        name: "description",
        content:
          "Conheca a GAMEL Metal, distribuidora em Garanhuns/PE para obras, acabamentos, comunicacao visual e atendimento comercial.",
      },
      { property: "og:url", content: absoluteUrl("/sobre") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/sobre") }],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <GamelPublicLayout>
      <main className="shell-home py-12">
        <section className="rounded-lg bg-brand p-6 text-white md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Quem somos
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-none md:text-7xl">
            GAMEL Distribuidora em Garanhuns/PE.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/68">
            A GAMEL e uma distribuidora de materiais para acabamento, construcao, comunicacao
            visual, obras e reformas. O site aproxima clientes, profissionais e empresas da equipe
            comercial, com catalogo organizado e atendimento por orcamento.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-border/80 bg-white p-5 shadow-sm"
              >
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-display text-2xl">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div className="rounded-lg border border-border/80 bg-white p-6 shadow-sm">
            <h2 className="font-display text-4xl">O que a GAMEL entrega</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                A empresa atende demandas de construcao, acabamento e comunicacao visual com linhas
                como ripados, chapas UV, policarbonato, tetos laminados, pisos vinilicos, forros
                PVC, telhas, ACM, perfis de aluminio e drywall.
              </p>
              <p>
                Cada solicitacao passa por analise comercial para confirmar produto, quantidade,
                medida, aplicacao, disponibilidade e melhor forma de atendimento.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Dados da empresa
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Razao social:</strong> GARANHUNS METAL LTDA
              </p>
              <p>
                <strong className="text-foreground">Nome fantasia:</strong> GAMEL Distribuidora
              </p>
              <p>
                <strong className="text-foreground">Cidade:</strong> Garanhuns/PE
              </p>
              <p>
                <strong className="text-foreground">CNPJ:</strong> {brandConfig.defaultStoreCnpj}
              </p>
              <p>
                <strong className="text-foreground">Endereco:</strong> {gamelStoreInfo.address}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">
              Atendimento regional
            </span>
          </div>
          <h2 className="mt-3 font-display text-4xl">Presenca local, atendimento consultivo.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            A GAMEL atende a partir de Garanhuns/PE e recebe demandas de clientes finais,
            construtores, instaladores, arquitetos, empresas e profissionais que precisam comparar
            materiais, validar medidas e solicitar proposta comercial.
          </p>
        </section>

        <section className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h2 className="font-display text-3xl">Precisa de atendimento?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            Use o formulario de orcamento ou acione o WhatsApp comercial com uma mensagem de
            interesse.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/carrinho">Abrir carrinho</Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href={getGamelWhatsAppUrl(gamelWhatsAppMessages.about)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </main>
    </GamelPublicLayout>
  );
}
