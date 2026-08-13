import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Home,
  Layers3,
  MessageCircle,
  PanelsTopLeft,
  ShieldCheck,
} from "lucide-react";
import { GamelPublicLayout } from "@/components/public/GamelPublicLayout";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { gamelWhatsAppMessages, getGamelWhatsAppUrl } from "@/data/gamel-site";

const applicationHero = {
  eyebrow: "Aplicacoes GAMEL",
  title: "Ideias de uso para transformar produtos em solucoes de obra, acabamento e fachada.",
  text: "Veja onde cada linha se encaixa e avance direto para o catalogo ou orcamento assistido. A equipe comercial valida produto, medida, disponibilidade e melhor alternativa para cada projeto.",
  image: "/images/gamel/aplicacoes/aplicacao-ambientes-corporativos.png",
  alt: "Recepcao corporativa moderna com ripados, chapas decorativas e iluminacao elegante.",
};

const applications = [
  {
    title: "Ambientes residenciais",
    text: "Solucoes para salas, quartos, areas gourmet e ambientes internos com acabamento moderno.",
    image: "/images/gamel/aplicacoes/aplicacao-ambientes-residenciais.png",
    alt: "Ambiente residencial com ripado, teto laminado, piso vinilico e acabamento sofisticado.",
    categories: ["Ripados internos e externos", "Chapas UV", "Pisos Vinilicos", "Forros PVC"],
    href: "/produtos?busca=residencial",
  },
  {
    title: "Ambientes corporativos",
    text: "Materiais para recepcoes, escritorios, showrooms e espacos comerciais.",
    image: "/images/gamel/aplicacoes/aplicacao-ambientes-corporativos.png",
    alt: "Recepcao corporativa moderna com ripados, chapas decorativas e iluminacao elegante.",
    categories: ["Chapas UV", "Pisos Vinilicos", "Tetos Laminados", "Ripados"],
    href: "/produtos?busca=corporativo",
  },
  {
    title: "Fachadas comerciais",
    text: "Fachadas com ACM, ripados externos, vidro, perfis e acabamento arquitetonico.",
    image: "/images/gamel/aplicacoes/aplicacao-fachadas-comerciais.png",
    alt: "Fachada comercial moderna com ACM, ripado externo e iluminacao laranja.",
    categories: ["ACM", "Perfil de Aluminio", "Policarbonato", "Ripados externos"],
    href: "/produtos?busca=fachada",
  },
  {
    title: "Coberturas e areas externas",
    text: "Solucoes em policarbonato, telhas e estruturas para protecao e iluminacao natural.",
    image: "/images/gamel/aplicacoes/aplicacao-coberturas-areas-externas.png",
    alt: "Area externa com cobertura em policarbonato e estrutura metalica.",
    categories: ["Policarbonato", "Telha de PVC", "Telha de Fibrocimento", "Aluminio"],
    href: "/produtos?busca=cobertura",
  },
  {
    title: "Forros e tetos",
    text: "Acabamentos para tetos internos com forro PVC, tetos laminados e iluminacao embutida.",
    image: "/images/gamel/aplicacoes/aplicacao-forros-tetos.png",
    alt: "Ambiente interno com forro PVC ou teto laminado instalado.",
    categories: ["Forros PVC", "Tetos Laminados", "Ripados internos"],
    href: "/produtos?busca=forro",
  },
  {
    title: "Obras e drywall",
    text: "Materiais para obras limpas, reformas, divisorias, forros e acabamentos tecnicos.",
    image: "/images/gamel/aplicacoes/aplicacao-obras-drywall.png",
    alt: "Obra limpa com drywall, perfis, placas e acessorios organizados.",
    categories: ["Drywall", "Forros PVC", "Perfil de Aluminio"],
    href: "/produtos?busca=drywall",
  },
] as const;

const summary = [
  {
    icon: Home,
    title: "Residencial",
    text: "Reformas, areas gourmet, salas, cozinhas e acabamentos internos.",
  },
  {
    icon: Building2,
    title: "Comercial",
    text: "Lojas, recepcoes, escritorios, fachadas e pontos de atendimento.",
  },
  {
    icon: PanelsTopLeft,
    title: "Tecnico",
    text: "Coberturas, fechamentos, perfis, drywall e itens sob consulta.",
  },
  {
    icon: ShieldCheck,
    title: "Assistido",
    text: "A GAMEL confirma medida, disponibilidade, quantidade e aplicacao antes da proposta.",
  },
] as const;

export const Route = createFileRoute("/aplicacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/produtos" });
  },
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Aplicacoes GAMEL` },
      {
        name: "description",
        content:
          "Aplicacoes de produtos GAMEL para ambientes residenciais, corporativos, fachadas, coberturas, forros, tetos e obras.",
      },
      { property: "og:url", content: absoluteUrl("/aplicacoes") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/aplicacoes") }],
  }),
  component: AplicacoesPage,
});

function AplicacoesPage() {
  return (
    <GamelPublicLayout>
      <main className="shell-home py-10">
        <section className="relative min-h-[520px] overflow-hidden rounded-lg bg-brand text-white">
          <img
            src={applicationHero.image}
            alt={applicationHero.alt}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/78 to-black/18" />
          <div className="relative flex min-h-[520px] flex-col justify-center px-6 py-12 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {applicationHero.eyebrow}
            </p>
            <h1 className="mt-5 max-w-5xl font-display text-5xl leading-none md:text-7xl">
              {applicationHero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/76">
              {applicationHero.text}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-md bg-action text-white hover:bg-accent">
                <Link to="/produtos">
                  Ver catalogo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-md border-white/20 bg-white/8 text-white hover:bg-white/14 hover:text-white"
              >
                <Link to="/carrinho">Abrir carrinho</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-border/80 bg-white p-5 shadow-sm"
              >
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-display text-2xl">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Menu Aplicacoes
              </p>
              <h2 className="font-display text-4xl">Escolha pelo tipo de projeto</h2>
            </div>
            <Link to="/carrinho" className="text-sm font-semibold text-primary hover:underline">
              Enviar necessidade para a GAMEL
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {applications.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm"
              >
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Aplicacao
                  </p>
                  <h3 className="mt-2 font-display text-3xl">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/78"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild className="rounded-md bg-action text-white hover:bg-accent">
                      <a href={item.href}>
                        Ver produtos
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="rounded-md">
                      <Link
                        to="/carrinho"
                        search={{ aplicacao: item.title, nome: "", produto: "", categoria: "" }}
                      >
                        Pedir orientacao
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.78fr]">
          <div className="rounded-lg border border-border/80 bg-white p-6 shadow-sm">
            <Layers3 className="h-6 w-6 text-primary" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Catalogo assistido
            </p>
            <h2 className="mt-2 font-display text-4xl">Nao encontrou a aplicacao exata?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Envie fotos, medidas aproximadas, cidade e objetivo do projeto. A equipe comercial
              direciona a linha correta antes de confirmar preco, estoque ou frete.
            </p>
            <Button asChild className="mt-5 rounded-md bg-action text-white hover:bg-accent">
              <Link to="/carrinho">
                Abrir carrinho
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-lg bg-secondary p-6 text-white shadow-sm">
            <MessageCircle className="h-6 w-6 text-accent" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Atendimento direto
            </p>
            <h2 className="mt-2 font-display text-4xl">Prefere falar no WhatsApp?</h2>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Abra uma conversa com a equipe GAMEL e informe ambiente, produto desejado, medida e
              cidade.
            </p>
            <Button asChild className="mt-5 rounded-md bg-action text-white hover:bg-accent">
              <a
                href={getGamelWhatsAppUrl(gamelWhatsAppMessages.default)}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp comercial
              </a>
            </Button>
          </div>
        </section>
      </main>
    </GamelPublicLayout>
  );
}
