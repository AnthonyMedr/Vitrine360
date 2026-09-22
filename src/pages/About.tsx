import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Eye,
  Gem,
  Handshake,
  MapPin,
  MessageCircle,
  PackageCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { STORE_INFO, WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";
import { useInstitutionalPage } from "@/hooks/useInstitutionalPage";

const pillars = [
  {
    icon: Boxes,
    title: "Importação e distribuição B2B",
    text: "Portfólio de revestimentos e soluções de acabamento para o mercado profissional.",
  },
  {
    icon: Users,
    title: "Atendimento consultivo",
    text: "Apoio para comparar aplicações, medidas e necessidades de cada projeto.",
  },
  {
    icon: PackageCheck,
    title: "Operação comercial",
    text: "Disponibilidade, prazo, frete e condições confirmados antes do fechamento.",
  },
];

const values = [
  { icon: BadgeCheck, title: "Ética e transparência", text: "Relações claras em cada atendimento e negociação." },
  { icon: Users, title: "Foco no cliente", text: "Escuta ativa para indicar soluções adequadas a cada demanda." },
  { icon: Gem, title: "Compromisso com a qualidade", text: "Cuidado com portfólio, informação e experiência de compra." },
  { icon: Sparkles, title: "Evolução constante", text: "Melhoria contínua de produtos, processos e atendimento." },
  { icon: Handshake, title: "Parcerias duradouras", text: "Proximidade comercial para crescer junto com o mercado." },
  { icon: Target, title: "Responsabilidade", text: "Decisões consistentes, do orçamento ao pós-atendimento." },
];

const defaultIntro = "Da importação à distribuição B2B, a GAMEL conecta portfólio, apresentação e parceria comercial para atender lojistas, distribuidores, revendedores e empresas em todo o Brasil.";

export default function About() {
  const { data: quemSomos } = useInstitutionalPage("quem_somos");
  const intro = quemSomos?.content?.trim() || defaultIntro;

  return (
    <Layout>
      <div className="bg-[#f6f3ef] pb-4 pt-6 md:pb-8 md:pt-8">
        <div className="shell-wide max-w-[1440px] space-y-5 md:space-y-7">
          <section className="relative isolate overflow-hidden rounded-lg border border-black/10 bg-[#080808] text-white shadow-[0_26px_70px_-42px_rgba(0,0,0,.9)]">
            <img
              src="/assets/catalog/gamel-phase1/institucional-showroom-gamel.png"
              alt="Showroom contemporâneo com painéis, ripados e revestimentos"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-[66%_center]"
              loading="eager"
            />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,5,5,.98)_0%,rgba(5,5,5,.94)_38%,rgba(5,5,5,.58)_68%,rgba(5,5,5,.2)_100%)]" />
            <div className="grid min-h-[520px] px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:gap-12 xl:px-14">
              <div className="max-w-3xl self-center">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff6417]">GAMEL institucional</p>
                <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.025em] text-white md:text-6xl">
                  Soluções que ampliam possibilidades.
                </h1>
                <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-white/74 md:text-lg md:leading-8">
                  {intro}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-lg bg-[#ff6417] px-6 text-white hover:bg-[#e9560b]">
                    <Link to="/produtos">Conhecer o catálogo <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-white/25 bg-white/[.06] px-6 text-white hover:bg-white/12 hover:text-white">
                    <Link to="/orcamento">Solicitar orçamento</Link>
                  </Button>
                </div>
              </div>

              <aside className="mt-10 border-l-2 border-[#ff6417] bg-black/58 p-5 backdrop-blur-sm lg:mt-0">
                <MapPin className="h-5 w-5 text-[#ff6417]" aria-hidden="true" />
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-white/55">Nossa base</p>
                <p className="mt-2 font-display text-2xl font-semibold text-white">{STORE_INFO.address.city}/{STORE_INFO.address.state}</p>
                <p className="mt-3 text-sm leading-6 text-white/68">
                  Atendimento comercial para clientes locais e demandas de outras regiões do Brasil.
                </p>
              </aside>
            </div>
            <div aria-hidden="true" className="absolute bottom-0 right-0 h-12 w-32 bg-[#ff6417] [clip-path:polygon(42%_0,100%_0,100%_100%,0_100%)]" />
          </section>

          <section aria-label="Como a GAMEL atua" className="grid overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className={`p-6 md:p-7 ${index > 0 ? "border-t border-border/70 md:border-l md:border-t-0" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff1e7] text-[#ff6417]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-lg font-semibold text-[#111]">{title}</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </section>

          <section className="grid overflow-hidden rounded-lg border border-border/75 bg-white shadow-sm lg:grid-cols-[.94fr_1.06fr]">
            <div className="relative min-h-[340px] overflow-hidden lg:min-h-[520px]">
              <img
                src="/assets/applications/gamel-phase1/aplicacao-interiores-corporativos.png"
                alt="Ambiente corporativo com revestimentos e iluminação integrada"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <div className="absolute bottom-0 left-0 max-w-md p-6 text-white md:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Material, aplicação e resultado</p>
                <p className="mt-3 font-display text-2xl font-semibold leading-tight md:text-3xl">Acabamentos pensados para transformar espaços.</p>
              </div>
            </div>

            <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12 xl:p-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">A GAMEL</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-[#121212] md:text-4xl">
                Da escolha do material à decisão comercial.
              </h2>
              <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
                <p>
                  Atuamos com importação, atacado e distribuição B2B de revestimentos e soluções de acabamento para lojistas, distribuidores, revendedores e empresas.
                </p>
                <p>
                  Mais do que apresentar produtos, organizamos informações e apoiamos a escolha. Medidas, aplicação, disponibilidade, entrega e condições comerciais são validadas pela equipe antes de cada fechamento.
                </p>
              </div>
              <Link to="/vendas-para-empresas" className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#ff6417] hover:text-[#e9560b]">
                Conheça o atendimento para empresas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-lg bg-[#101010] p-7 text-white shadow-sm md:p-8">
              <Sparkles className="h-6 w-6 text-[#ff6417]" aria-hidden="true" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Propósito</p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-tight">Levar soluções que unem estética, funcionalidade e valor comercial.</h2>
              <p className="mt-4 text-sm leading-6 text-white/65">Transformar espaços que valorizam ambientes, ampliam possibilidades de projeto e contribuem para resultados mais consistentes.</p>
            </article>
            <article className="rounded-lg border border-border/80 bg-white p-7 shadow-sm md:p-8">
              <Target className="h-6 w-6 text-[#ff6417]" aria-hidden="true" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Missão</p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-[#121212]">Qualidade, variedade e atendimento especializado.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Fornecer revestimentos e soluções de acabamento, gerando valor para nossos parceiros e para o mercado.</p>
            </article>
            <article className="rounded-lg border border-border/80 bg-white p-7 shadow-sm md:p-8">
              <Eye className="h-6 w-6 text-[#ff6417]" aria-hidden="true" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Visão</p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-[#121212]">Ser referência em importação, atacado e distribuição.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Ser reconhecida pela solidez, inovação e parceria com nossos clientes no mercado de revestimentos.</p>
            </article>
          </section>

          <section className="relative overflow-hidden rounded-lg bg-[#101010] px-6 py-9 text-white shadow-sm md:px-10 md:py-12">
            <div className="grid gap-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Nossos valores</p>
                <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">Princípios presentes em cada parceria.</h2>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
                {values.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="bg-[#151515] p-5 md:p-6">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 text-[#ff6417]" aria-hidden="true" />
                      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/58">{text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div aria-hidden="true" className="absolute right-0 top-0 h-20 w-40 border-l border-[#ff6417]/25 bg-[linear-gradient(135deg,transparent_0%,transparent_47%,rgba(255,100,23,.14)_48%,transparent_49%)]" />
          </section>

          <section className="overflow-hidden rounded-lg border border-[#ff6417]/25 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="p-7 md:p-9">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> {STORE_INFO.address.city}/{STORE_INFO.address.state}
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-[#111]">Vamos construir novas possibilidades?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Explore o catálogo ou conte o que seu projeto precisa. A equipe GAMEL ajuda você a seguir para a próxima etapa.</p>
              </div>
              <div className="flex flex-col gap-3 border-t border-border/70 bg-[#faf8f5] p-7 sm:flex-row lg:border-l lg:border-t-0 lg:p-9">
                <Button asChild size="lg" className="h-12 rounded-lg bg-[#ff6417] text-white hover:bg-[#e9560b]"><Link to="/orcamento">Solicitar orçamento</Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-lg bg-white">
                  <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.about)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
