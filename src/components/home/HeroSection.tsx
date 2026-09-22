import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Headset,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";
import heroImage from "@/assets/banner-2-hero.jpg";

const proofItems = [
  { icon: Truck, title: "Entrega nacional", text: "Catálogo pronto para cotação por CEP" },
  { icon: ShieldCheck, title: "Atendimento assistido", text: "Lead acompanhado pela equipe comercial" },
  { icon: MapPin, title: "Base física", text: "Retirada e atendimento em Garanhuns" },
];

const quickActions = [
  { label: "Chapas UV", href: "/busca?q=Chapas%20UV" },
  { label: "Pisos vinílicos", href: "/busca?q=Pisos%20vinílicos" },
  { label: "Ripados", href: "/busca?q=Ripado" },
  { label: "Telhas", href: "/busca?q=Telhas" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(var(--muted)/0.55),hsl(var(--background))_88%)] pb-6 pt-3 md:pb-8">
      <div className="shell-home space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-h-[320px] overflow-hidden rounded-[1.25rem] border border-border/70 bg-secondary shadow-card md:min-h-[360px]">
            <img
              src={heroImage}
              alt="Caminhao e materiais de acabamento para entrega nacional"
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={1200}
              height={675}
              sizes="(min-width: 1024px) calc(100vw - 390px), 100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--secondary))_0%,hsl(var(--secondary)/0.92)_34%,hsl(var(--secondary)/0.36)_66%,transparent),linear-gradient(180deg,rgba(7,20,35,0.08),rgba(7,20,35,0.36))]" />

            <div className="relative z-10 flex h-full max-w-2xl flex-col justify-center px-5 py-7 text-secondary-foreground md:px-8 lg:px-10">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-foreground/78">
                <BadgeCheck className="h-4 w-4 text-accent" />
                Catálogo inteligente para obra e acabamento
              </div>

              <h1 className="mt-5 max-w-xl font-display text-4xl font-bold leading-[0.95] tracking-normal text-white md:text-5xl xl:text-[4.1rem]">
                Materiais de acabamento com orcamento assistido
              </h1>

              <p className="mt-4 max-w-lg text-sm leading-6 text-secondary-foreground/78 md:text-base md:leading-7">
                PVC amadeirado, chapas UV, ripados, pisos vinílicos, telhas, drywall, ferragens, perfis e motores com suporte comercial antes da decisão.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="hero" size="lg" className="h-12 justify-center rounded-xl px-6 shadow-xl">
                  <Link to="/produtos">
                    Ver produtos
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 justify-center rounded-xl border-white/22 bg-white/10 px-6 text-white hover:bg-white/16">
                  <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.default)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Especialista
                  </a>
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {quickActions.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/86 transition-colors hover:bg-white/16"
                  >
                    <Search className="h-3.5 w-3.5 text-accent" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[1.1rem] border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-[#242424] to-[#080808] shadow-[0_10px_20px_-16px_rgba(255,100,23,0.8)]">
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                  <img src="/assets/brand/gamel-logo-metal-symbol.png" alt="GAMEL" className="relative h-full w-full scale-[1.3] object-cover object-center" loading="eager" decoding="async" width={32} height={32} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Loja física</p>
                  <p className="font-display text-xl leading-none text-secondary">Atendimento real</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Equipe comercial para confirmar disponibilidade, medida, prazo e retirada.</p>
            </div>

            <div className="rounded-[1.1rem] border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-white">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Orcamento</p>
                  <p className="font-display text-xl leading-none text-secondary">Solicitação guiada</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Fluxo preparado para registrar interesse, produto, quantidade e retorno comercial.</p>
            </div>

            <div className="rounded-[1.1rem] border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                  <Headset className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Suporte</p>
                  <p className="font-display text-xl leading-none text-secondary">Atendimento assistido</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Ajuda para calcular quantidade, fechar listas maiores e atender empresas em escala.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {proofItems.map((item) => (
            <div key={item.title} className="flex items-center gap-3 rounded-[1rem] border border-border/70 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="truncate text-sm text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
