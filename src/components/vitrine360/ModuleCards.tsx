import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  LayoutGrid,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

const activeModules = [
  {
    title: "Catalogo",
    route: "/produtos",
    description: "Produtos, categorias, busca e paginas individuais para consulta comercial.",
    modules: ["Produtos", "Categorias", "Busca"],
    icon: LayoutGrid,
    accent: "bg-brand text-brand-foreground",
  },
  {
    title: "Carrinho de orcamento",
    route: "/carrinho",
    description: "Lista de produtos para solicitar cotacao com contato e observacoes.",
    modules: ["Itens", "Quantidades", "Lead"],
    icon: ShoppingCart,
    accent: "bg-action text-action-foreground",
  },
  {
    title: "Admin",
    route: "/admin",
    description: "Gestao do catalogo, midias, conteudos e operacao comercial aprovada.",
    modules: ["Produtos", "Conteudos", "Usuarios"],
    icon: ShieldCheck,
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
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">Escopo ativo do GAMEL Digital</h2>
          <div className="mt-3 h-1 w-12 bg-action" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {activeModules.map((experience) => {
          const Icon = experience.icon;
          return (
            <Link
              key={experience.route}
              to={experience.route}
              className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-action/30 hover:shadow-pop"
            >
              <span
                className={`inline-flex size-12 items-center justify-center rounded-md ${experience.accent}`}
              >
                <Icon className="size-6" />
              </span>
              <div className="flex-1">
                <h3 className="font-display text-2xl">{experience.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {experience.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {experience.modules.slice(0, 3).map((module) => (
                    <span
                      key={module}
                      className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {module}
                    </span>
                  ))}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-action">
                Abrir
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-2 border border-border bg-surface px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <Building2 className="size-4 text-action" />
        Totem, representante, vitrine TV, QR Codes e inteligencia comercial ficam congelados para
        fase futura.
      </div>
    </section>
  );
}
