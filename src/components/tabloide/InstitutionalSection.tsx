import { Award, Sparkles, Store, Truck } from "lucide-react";

const items = [
  { icon: Store, title: "Loja fisica", text: "Visite nosso showroom completo." },
  { icon: Award, title: "Atendimento especializado", text: "Equipe que entende de obra." },
  { icon: Truck, title: "Entrega agil", text: "Logistica para sua regiao." },
  { icon: Sparkles, title: "Variedade premium", text: "Marcas lideres em acabamento." },
];

export function InstitutionalSection({
  title = "Tudo para acabamento, construcao e reforma em um so lugar.",
  description = "Variedade, atendimento especializado e solucoes modernas para transformar sua obra com praticidade e beleza.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="mx-auto my-16 max-w-7xl px-4">
      <div className="rounded-3xl bg-gradient-to-br from-brand via-brand to-action p-[1px] shadow-pop">
        <div className="grid items-center gap-10 rounded-[calc(1.5rem-1px)] bg-card p-8 text-card-foreground lg:grid-cols-2 lg:p-12">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-action">
              Por que escolher a Gamel
            </span>
            <h2 className="mb-4 mt-3 text-balance font-display text-4xl sm:text-5xl">{title}</h2>
            <p className="max-w-md text-muted-foreground">{description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-action/30"
              >
                <item.icon className="mb-2 size-5 text-action" />
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
