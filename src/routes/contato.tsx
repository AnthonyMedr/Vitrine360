import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { GamelPublicLayout } from "@/components/public/GamelPublicLayout";
import { Button } from "@/components/ui/button";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { gamelStoreInfo, gamelWhatsAppMessages, getGamelWhatsAppUrl } from "@/data/gamel-site";

const contactInfo = [
  { icon: MapPin, title: "Localizacao", content: gamelStoreInfo.address },
  {
    icon: Phone,
    title: "Telefones comerciais",
    content: gamelStoreInfo.phone,
    href: `tel:+${gamelStoreInfo.whatsapp}`,
  },
  {
    icon: Mail,
    title: "E-mail comercial",
    content: gamelStoreInfo.email,
    href: `mailto:${gamelStoreInfo.email}`,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    content: gamelStoreInfo.whatsappDisplay,
    href: getGamelWhatsAppUrl(gamelWhatsAppMessages.contact),
  },
] as const;

const companyInfo = [
  {
    icon: Building2,
    title: "Razao social",
    content: `GARANHUNS METAL LTDA - CNPJ ${brandConfig.defaultStoreCnpj}`,
  },
  {
    icon: Instagram,
    title: "Instagram",
    content: "@GAMELMETAL",
    href: "https://www.instagram.com/GAMELMETAL",
  },
] as const;

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Contato` },
      {
        name: "description",
        content:
          "Fale com a GAMEL Metal por WhatsApp, telefone ou e-mail para produtos e orcamento comercial.",
      },
      { property: "og:url", content: absoluteUrl("/contato") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/contato") }],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const mapQuery = encodeURIComponent(gamelStoreInfo.address);

  return (
    <GamelPublicLayout>
      <main className="shell-home py-12">
        <section className="rounded-lg bg-brand p-6 text-center text-white md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contato</p>
          <h1 className="mt-3 font-display text-5xl md:text-7xl">Fale com a GAMEL Metal</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/68">
            Solicite orcamento, tire duvidas sobre produtos e envie sua necessidade para atendimento
            comercial.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-action text-white hover:bg-accent">
              <Link to="/carrinho">Abrir carrinho</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/8 text-white hover:bg-white/14 hover:text-white"
            >
              <a
                href={getGamelWhatsAppUrl(gamelWhatsAppMessages.contact)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp comercial
              </a>
            </Button>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {contactInfo.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-border/80 bg-white p-5 shadow-sm"
              >
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-display text-2xl">{item.title}</h2>
                {"href" in item && item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="mt-2 block text-sm leading-6 text-muted-foreground hover:text-primary"
                  >
                    {item.content}
                  </a>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.content}</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {companyInfo.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg border border-border/80 bg-white p-5 shadow-sm"
              >
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-display text-2xl">{item.title}</h2>
                {"href" in item && item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm leading-6 text-muted-foreground hover:text-primary"
                  >
                    {item.content}
                  </a>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.content}</p>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-8 overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Localizacao
              </p>
              <h2 className="mt-2 font-display text-4xl">GAMEL Distribuidora em Garanhuns/PE</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {gamelStoreInfo.address}
              </p>
              <Button asChild className="mt-5 rounded-md">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Abrir no mapa
                </a>
              </Button>
            </div>
            <iframe
              title="Mapa da GAMEL Distribuidora em Garanhuns"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              className="min-h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </main>
    </GamelPublicLayout>
  );
}
