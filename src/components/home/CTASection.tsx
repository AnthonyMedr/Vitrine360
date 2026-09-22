import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";

export function CTASection() {
  return (
    <section className="pb-10">
      <div className="shell-home">
        <div className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--secondary)))] px-6 py-9 text-white shadow-card md:px-10 md:py-12">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/68">Pronto para cotar</p>
              <h2 className="mt-3 max-w-4xl font-display text-3xl font-bold leading-tight md:text-5xl">
                Escolha acabamentos para sua obra ou empresa e conte com suporte para fechar medidas.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/76 md:text-base">
                Consulte o catálogo, envie seu interesse e use o atendimento especializado quando a obra, a entrega ou a cotação por volume pedir uma decisão assistida.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="secondary" size="lg" className="justify-center">
                  <Link to="/produtos">
                    <ClipboardList className="h-5 w-5" />
                    Ver produtos
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="justify-center border-white/24 bg-white/8 text-white hover:bg-white/16">
                  <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.default)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Falar com especialista
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
              <ShieldCheck className="h-6 w-6 text-white" />
              <p className="mt-4 font-display text-xl font-bold">Orcamento com mais segurança</p>
              <p className="mt-2 text-sm leading-6 text-white/72">
                Retirada local, envio nacional em homologação, atendimento comercial, politicas claras e canais oficiais.
              </p>
              <Button asChild variant="outline" className="mt-5 w-full border-white/20 bg-white/8 text-white hover:bg-white/16">
                <Link to="/politicas">
                  Ver politicas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
