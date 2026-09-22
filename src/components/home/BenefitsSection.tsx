import { Building2, ClipboardCheck, Headset, MapPin, ShieldCheck, Truck } from "lucide-react";

const benefits = [
  { icon: Truck, title: "Entrega nacional", desc: "Catálogo preparado para cotação por CEP, volume, peso e regra de transportadora." },
  { icon: ShieldCheck, title: "Atendimento seguro", desc: "Solicitação registrada, políticas visiveis, canais oficiais e histórico operacional." },
  { icon: ClipboardCheck, title: "Orçamento estruturado", desc: "Fluxo preparado para produto, quantidade, cidade, contato e retorno comercial." },
  { icon: MapPin, title: "Retirada na loja", desc: "Consulte tetos laminados, chapas UV, pisos vinílicos e ripados para retirada na operação física." },
  { icon: Building2, title: "Orçamento para empresas", desc: "Atendimento para construtoras, revendas, montadores e demandas recorrentes." },
  { icon: Headset, title: "Suporte comercial", desc: "Apoio para especificação, medidas, lista de materiais e fechamento por volume." },
];

export function BenefitsSection() {
  return (
    <section className="pb-8">
      <div className="shell-home">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Confianca no atendimento</p>
            <h2 className="section-title">Padrao nacional de atendimento comercial</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Entrega, retirada, suporte e orcamento empresarial organizados para reduzir duvida e aumentar previsibilidade.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="surface-panel rounded-[1.7rem] px-5 py-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <benefit.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold leading-tight text-foreground">{benefit.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
