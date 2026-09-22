import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Headphones,
  MapPin,
  MessageCircle,
  PackageCheck,
  Ruler,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { STORE_INFO, getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";

const audiences = [
  { icon: Building2, title: "Construtoras e incorporadoras", text: "Cotação organizada por etapa da obra, quantidade, prazo e endereço de entrega." },
  { icon: Ruler, title: "Arquitetos e especificadores", text: "Apoio comercial para comparar linhas, acabamentos, medidas e aplicações." },
  { icon: ClipboardList, title: "Revendas e instaladores", text: "Atendimento para reposição, compras recorrentes e demandas em maior volume." },
];

const steps = [
  { number: "01", icon: ClipboardCheck, title: "Envie sua demanda", text: "Selecione os produtos no catálogo ou descreva os materiais necessários." },
  { number: "02", icon: FileCheck2, title: "Compartilhe o contexto", text: "Informe empresa, obra, quantidade, prazo, CEP e referências disponíveis." },
  { number: "03", icon: Headphones, title: "Receba o retorno", text: "A equipe confirma preço, disponibilidade, prazo, frete e condições comerciais." },
];

const serviceBenefits = [
  { icon: PackageCheck, title: "Conferência comercial", text: "Produtos, medidas e quantidades revisados com o contexto informado." },
  { icon: Truck, title: "Logística sob análise", text: "Prazo e modalidade de entrega avaliados conforme o destino e a disponibilidade." },
  { icon: ShieldCheck, title: "Proposta confirmada", text: "Condições válidas somente após o retorno da equipe, sem promessas automáticas." },
];

export default function BusinessSales() {
  return (
    <Layout>
      <div className="bg-[#f6f3ef] pb-4 pt-6 md:pb-8 md:pt-8">
        <div className="shell-wide max-w-[1440px] space-y-5 md:space-y-7">
          <section className="relative isolate overflow-hidden rounded-lg border border-black/10 bg-[#070707] text-white shadow-[0_26px_70px_-42px_rgba(0,0,0,.9)]">
            <img
              src="/assets/applications/gamel-phase1/aplicacao-fachadas-lojas.png"
              alt="Fachada comercial contemporânea com revestimentos metálicos e ripados"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
              loading="eager"
            />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,5,5,.98)_0%,rgba(5,5,5,.93)_42%,rgba(5,5,5,.55)_72%,rgba(5,5,5,.2)_100%)]" />
            <div className="grid min-h-[540px] px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-end lg:gap-12 xl:px-14">
              <div className="max-w-3xl self-center">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff6417]">Importação • Atacado • Distribuição B2B</p>
                <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.025em] md:text-6xl">
                  Sua demanda de materiais, organizada de ponta a ponta.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/74 md:text-lg md:leading-8">
                  Centralize produtos, quantidades, prazo e local de entrega em uma cotação acompanhada pela equipe comercial GAMEL.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-lg bg-[#ff6417] px-6 text-white hover:bg-[#e9560b]">
                    <Link to="/orcamento?tipo=empresa">Solicitar cotação empresarial <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-white/25 bg-white/[.06] px-6 text-white hover:bg-white/12 hover:text-white">
                    <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.businessSales)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Falar com o comercial</a>
                  </Button>
                </div>
              </div>

              <aside className="mt-10 border-l-2 border-[#ff6417] bg-black/62 p-5 backdrop-blur-sm lg:mt-0">
                <p className="text-sm font-semibold text-white">Cotação técnica e transparente</p>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-white/68">
                  <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#ff6417]" aria-hidden="true" />Preço e estoque confirmados pela equipe.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#ff6417]" aria-hidden="true" />Prazo e frete avaliados para o destino.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#ff6417]" aria-hidden="true" />Protocolo para acompanhar a solicitação.</li>
                </ul>
              </aside>
            </div>
            <div aria-hidden="true" className="absolute bottom-0 right-0 h-12 w-32 bg-[#ff6417] [clip-path:polygon(42%_0,100%_0,100%_100%,0_100%)]" />
          </section>

          <section className="rounded-lg border border-border/80 bg-white px-6 py-9 shadow-sm md:px-9 md:py-11">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Para quem atendemos</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-[#111] md:text-4xl">Suporte comercial para diferentes negócios.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Cada solicitação é analisada de acordo com o uso, o volume e a etapa do projeto.</p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {audiences.map(({ icon: Icon, title, text }) => (
                <article key={title} className="group rounded-lg border border-border/80 bg-[#faf8f5] p-6 transition-colors hover:border-[#ff6417]/45 hover:bg-white">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#fff0e5] text-[#ff6417]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-[#111]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="relative grid overflow-hidden rounded-lg bg-[#101010] text-white shadow-sm lg:grid-cols-[.82fr_1.18fr]">
            <div className="relative min-h-[330px] overflow-hidden lg:min-h-[490px]">
              <img
                src="/assets/applications/gamel-phase1/aplicacao-interiores-corporativos.png"
                alt="Ambiente corporativo com acabamentos contemporâneos"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
            </div>
            <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12 xl:p-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Atendimento que reduz incertezas</p>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight md:text-4xl">Informação certa antes de confirmar a compra.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/64 md:text-base md:leading-7">
                O canal empresarial organiza a demanda e aproxima sua equipe de um consultor GAMEL. Assim, detalhes importantes são conferidos antes da proposta.
              </p>
              <div className="mt-7 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {serviceBenefits.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="border-t border-white/12 pt-5">
                    <Icon className="h-5 w-5 text-[#ff6417]" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/52">{text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div aria-hidden="true" className="absolute right-0 top-0 h-20 w-40 border-l border-[#ff6417]/25 bg-[linear-gradient(135deg,transparent_0%,transparent_47%,rgba(255,100,23,.14)_48%,transparent_49%)]" />
          </section>

          <section className="rounded-lg border border-border/80 bg-white px-6 py-9 shadow-sm md:px-9 md:py-11">
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]">Como funciona</p>
                <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-[#111] md:text-4xl">Um fluxo simples, com acompanhamento humano.</h2>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">Você envia as informações uma vez e a equipe usa esse contexto para preparar o retorno.</p>
              </div>
              <ol className="grid gap-4 md:grid-cols-3">
                {steps.map(({ number, icon: Icon, title, text }) => (
                  <li key={number} className="relative rounded-lg border border-border/80 bg-[#faf8f5] p-6">
                    <span className="font-display text-4xl font-semibold text-[#ff6417]">{number}</span>
                    <Icon className="mt-7 h-5 w-5 text-[#ff6417]" aria-hidden="true" />
                    <h3 className="mt-3 font-display text-lg font-semibold text-[#111]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#ff6417]/25 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="p-7 md:p-9">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff6417]"><FileText className="h-4 w-4" aria-hidden="true" />Pronto para cotar</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-[#111]">Envie sua lista e o contexto da obra.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Inclua CNPJ, produtos, quantidades, prazo, CEP e arquivos de referência. Quanto mais completo o envio, mais objetivo será o retorno.</p>
                <p className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground"><MapPin className="h-4 w-4 text-[#ff6417]" aria-hidden="true" />Base comercial em {STORE_INFO.address.city}/{STORE_INFO.address.state}.</p>
              </div>
              <div className="border-t border-border/70 bg-[#faf8f5] p-7 lg:border-l lg:border-t-0 lg:p-9">
                <Button asChild size="lg" className="h-12 rounded-lg bg-[#ff6417] px-6 text-white hover:bg-[#e9560b]">
                  <Link to="/orcamento?tipo=empresa"><ShieldCheck className="h-4 w-4" />Iniciar cotação B2B</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
