import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid, Monitor, Sparkles, Tag, Tv } from "lucide-react";

const modules = [
  {
    to: "/catalogo",
    icon: LayoutGrid,
    title: "Catalogo Digital",
    desc: "Produtos, categorias e fichas comerciais organizadas para consulta rapida.",
    accent: "bg-brand text-brand-foreground",
  },
  {
    to: "/ofertas",
    icon: Tag,
    title: "Campanhas e Ofertas",
    desc: "Destaques promocionais com leitura visual forte para conversao comercial.",
    accent: "bg-action text-action-foreground",
  },
  {
    to: "/totem",
    icon: Monitor,
    title: "Totem Interativo",
    desc: "Experiencia touch com navegacao simples para showroom, loja e recepcao.",
    accent: "bg-foreground text-background",
  },
  {
    to: "/vitrine",
    icon: Tv,
    title: "Vitrine para TV",
    desc: "Apresentacao continua para telas de loja com alto impacto visual.",
    accent: "bg-highlight text-highlight-foreground",
  },
] as const;

export function ModuleCards() {
  return (
    <section data-testid="home-modules-section" className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-action">
            <Sparkles className="size-3.5" /> Plataforma comercial integrada
          </span>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">
            Escolha como apresentar a Gamel Distribuidora
          </h2>
          <div className="mt-3 h-1 w-12 bg-action" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group flex flex-col gap-4 rounded-[1.75rem] border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-action/30 hover:shadow-pop"
            >
              <span
                className={`inline-flex size-12 items-center justify-center rounded-2xl ${m.accent}`}
              >
                <Icon className="size-6" />
              </span>
              <div className="flex-1">
                <h3 className="font-display text-2xl">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-action">
                Acessar
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
