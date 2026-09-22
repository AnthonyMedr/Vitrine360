import { Link } from "react-router-dom";
import { ArrowRight, Building2, ClipboardList, Hammer, MessageCircle, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";
import { useEventBus } from "@/hooks/useEventBus";
import storefrontImage from "@/assets/storefront-real-hero.jpg";

const audiences = [
  { icon: Hammer, title: "Montadores", text: "Cotação recorrente, reposicao e apoio para medidas em campo." },
  { icon: Building2, title: "Construtoras", text: "Orçamento consolidado para obras, reformas e manutencao em escala." },
  { icon: Ruler, title: "Arquitetos", text: "Linhas visuais para especificar acabamento com segurança." },
  { icon: ClipboardList, title: "Revendas", text: "Cotação por volume, disponibilidade, prazo e negociação assistida." },
];

export function HowToBuySection() {
  const { emitEvent } = useEventBus();
  const trackHomeB2bClick = () => {
    emitEvent("support.requested", {
      channel: "site",
      origin: "b2b_home_cta_click",
      page_url: window.location.href,
    });
  };

  return (
    <section className="pb-8">
      <div className="shell-home">
        <div className="grid overflow-hidden rounded-[2.2rem] border border-border/70 bg-secondary shadow-card lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[320px]">
            <img src={storefrontImage} alt="Ambiente de atendimento comercial da GAMEL em Garanhuns" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(7,20,35,0.62))]" />
            <div className="absolute bottom-5 left-5 right-5 rounded-[1.35rem] bg-white/92 p-4 text-secondary shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Empresas e obras</p>
              <p className="mt-1 font-display text-xl font-bold">Orcamento assistido para empresa, obra ou revenda.</p>
            </div>
          </div>

          <div className="p-6 text-secondary-foreground md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/60">B2B e obras</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Orcamento para empresa, obra ou revenda?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-secondary-foreground/74 md:text-base">
              A GAMEL atende empresas, lojistas, construtoras, instaladores e profissionais que precisam de
              materiais para acabamento, cotação organizada e suporte comercial para a obra.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {audiences.map((item) => (
                <div key={item.title} className="rounded-[1.25rem] border border-white/10 bg-white/8 p-4">
                  <item.icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-secondary-foreground/68">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="lg">
                <Link to="/vendas-para-empresas" onClick={trackHomeB2bClick}>
                  Ver condições para empresas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/18 bg-white/8 text-white hover:bg-white/14">
                <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.businessSales)} target="_blank" rel="noopener noreferrer" onClick={trackHomeB2bClick}>
                  <MessageCircle className="h-5 w-5" />
                  Falar comercial
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
