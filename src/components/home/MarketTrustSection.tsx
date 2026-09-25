import { Link } from "react-router-dom";
import { Award, Building2, MapPin, ShieldCheck, Star, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrands } from "@/hooks/useBrands";
import { useProducts } from "@/hooks/useProducts";
import { CATALOG_ROUTES } from "@/lib/catalogRoutes";

const reviews = [
  {
    name: "Cliente residencial",
    text: "Comprei teto laminado e acabamento com retirada rápida. O atendimento ajudou a fechar a quantidade certa.",
  },
  {
    name: "Montador parceiro",
    text: "A linha de PVC e ripado facilita a cotação por obra. Ter produto, prazo e suporte no mesmo lugar ajuda muito.",
  },
  {
    name: "Orçamento para reforma",
    text: "A navegação por categoria deixa mais facil comparar piso, chapa UV, telha e forro sem depender so do WhatsApp.",
  },
];

export function MarketTrustSection() {
  const { data: brands = [] } = useBrands();
  const { data: products = [] } = useProducts({ limit: 1000 });
  const metrics = [
    { value: String(products.length), label: "produtos ativos no catálogo" },
    { value: "Brasil", label: "catálogo preparado para cotação por CEP" },
    { value: "B2C + B2B", label: "mix para cliente final, obra e revenda" },
    { value: "Assistido", label: "lead acompanhado pela equipe comercial" },
  ];

  return (
    <section className="pb-8">
      <div className="shell-home space-y-7">
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] bg-secondary p-6 text-secondary-foreground shadow-card md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/60">Prova social</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
              Uma loja física com catalogo preparado para atendimento nacional.
            </h2>
            <p className="mt-4 text-sm leading-7 text-secondary-foreground/74 md:text-base">
              Estrutura para atender cliente residencial, obra profissional, montadores, arquitetos, construtoras e revendas com clareza de produto, retirada, entrega e suporte.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[1.25rem] border border-white/10 bg-white/8 p-4">
                  <p className="font-display text-3xl font-bold text-white">{metric.value}</p>
                  <p className="mt-1 text-sm leading-5 text-secondary-foreground/66">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.name} className="surface-panel rounded-[1.6rem] px-5 py-5">
                <div className="flex gap-1 text-accent">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">"{review.text}"</p>
                <p className="mt-4 text-sm font-semibold text-foreground">{review.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="surface-panel rounded-[2rem] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">Marcas parceiras</p>
                <h2 className="section-title">Credibilidade tambem vem do mix certo</h2>
              </div>
              <Button asChild variant="outline">
                <Link to={CATALOG_ROUTES.allProducts}>Ver produtos</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {brands.map((brand) => (
                <span key={brand.id} className="rounded-full border border-border/70 bg-background/72 px-4 py-2 text-sm font-semibold text-foreground">
                  {brand.name}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary/20 bg-primary/8 p-6 shadow-card">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <h3 className="mt-4 font-display text-2xl font-bold">Confianca antes do clique</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p className="flex gap-2"><Building2 className="mt-0.5 h-4 w-4 text-primary" /> CNPJ e canais oficiais visiveis.</p>
              <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" /> Retirada local em loja física.</p>
              <p className="flex gap-2"><Truck className="mt-0.5 h-4 w-4 text-primary" /> Entrega nacional em homologação com atendimento comercial.</p>
              <p className="flex gap-2"><Users className="mt-0.5 h-4 w-4 text-primary" /> Suporte humano para especificacao.</p>
              <p className="flex gap-2"><Award className="mt-0.5 h-4 w-4 text-primary" /> Politicas claras de orcamento e atendimento.</p>
            </div>
          </div>
        </div>

        <article className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-card md:p-8">
          <p className="eyebrow">Conteudo SEO</p>
          <h2 className="section-title">GAMEL em Garanhuns: acabamento com catalogo e apoio comercial</h2>
          <p className="mt-4 max-w-5xl text-sm leading-7 text-muted-foreground md:text-base">
            Encontre tetos laminados vinílicos, pisos vinílicos, ripados internos e externos, chapas UV, policarbonato e telhas PVC para obra, reforma e acabamento. A GAMEL combina catálogo inteligente, retirada local e atendimento comercial para ajudar clientes, montadores, arquitetos, construtoras e revendas a escolher materiais com mais segurança.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Tetos laminados", "Pisos vinílicos", "Chapas UV", "Ripados internos", "Ripados externos", "Policarbonato", "Telhas PVC"].map((term) => (
              <Link key={term} to={CATALOG_ROUTES.allProducts} className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground">
                {term}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
