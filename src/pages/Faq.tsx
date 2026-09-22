import { Layout } from "@/components/layout/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
const faqItems = [
  {
    value: "fase-1",
    title: "Como a GAMEL ajuda na escolha do material?",
    content: "O catálogo apresenta as linhas e acabamentos. A equipe comercial confirma aplicação, medida, disponibilidade e a alternativa mais adequada antes da proposta.",
  },
  {
    value: "orçamento",
    title: "Quais soluções encontro no catálogo?",
    content: "Tetos laminados vinílicos, pisos vinílicos, ripados internos e externos, chapas UV, chapas de policarbonato e telhas PVC.",
  },
  {
    value: "produtos",
    title: "Como envio uma solicitação?",
    content: "Envie produto, quantidade aproximada, cidade e uma breve descrição do ambiente. Se tiver fotos ou medidas, nossa equipe consegue orientar com mais precisão.",
  },
  {
    value: "atendimento",
    title: "Quais canais oficiais posso usar?",
    content: "A GAMEL atende por WhatsApp, telefone, e-mail, Instagram e pelo formulário de solicitação publicado na página de contato.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.title,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.content,
    },
  })),
};

export default function Faq() {
  return (
    <Layout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData).replace(/</g, "\\u003c") }} />
      <section className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">FAQ</p>
          <h1 className="mt-3 font-display text-4xl font-bold">Perguntas frequentes</h1>
          <p className="mt-4 text-muted-foreground">
            Dúvidas comuns sobre o catálogo, as soluções da GAMEL e o atendimento comercial.
          </p>

          <div className="mt-8 rounded-[1.8rem] border bg-card p-6 shadow-card">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem key={item.value} value={item.value}>
                  <AccordionTrigger>{item.title}</AccordionTrigger>
                  <AccordionContent>{item.content}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </Layout>
  );
}
