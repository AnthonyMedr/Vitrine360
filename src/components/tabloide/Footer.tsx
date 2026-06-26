import { Clock, Instagram, MapPin, Phone } from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { brandConfig } from "@/config/brand";
import { useSettings, whatsappLink } from "@/context/SettingsContext";
import { QRCode } from "./QRCode";

const LEGAL_NOTICE =
  "Ofertas validas por tempo limitado ou enquanto durar o estoque. Imagens meramente ilustrativas. Consulte disponibilidade, medidas, cores, modelos e condicoes diretamente com a loja. Precos e condicoes podem sofrer alteracao sem aviso previo.";

export function Footer() {
  const { settings } = useSettings();
  const qrTarget = whatsappLink(
    `Ola! Vi o Catalogo Digital do ${settings.brand} e quero saber mais.`,
    settings.whatsappNumber,
  );

  return (
    <footer className="bg-foreground text-background pt-16 pb-24">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-background/5 p-1.5 rounded-lg">
              <StoreLogo
                brand={settings.brand}
                logoUrl={settings.logoUrl}
                imageClassName="size-12"
                fallbackClassName="size-12 bg-background/10 text-background"
              />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tighter uppercase">
              {settings.brand}
            </span>
          </div>
          <p className="text-background/60 text-sm leading-relaxed max-w-sm mb-6">
            {settings.tagline}
          </p>

          <ul className="text-sm text-background/70 space-y-3">
            <li className="flex items-start gap-2">
              <MapPin className="size-4 mt-0.5 shrink-0 text-action" /> {settings.address}
            </li>
            <li className="flex items-start gap-2">
              <Clock className="size-4 mt-0.5 shrink-0 text-action" /> {settings.hours}
            </li>
            <li className="flex items-start gap-2">
              <Phone className="size-4 mt-0.5 shrink-0 text-action" /> {settings.whatsappLabel}
            </li>
            <li className="flex items-start gap-2">
              <Instagram className="size-4 mt-0.5 shrink-0 text-action" /> {settings.instagram}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-xs uppercase tracking-widest mb-4 text-highlight">
            Categorias
          </h4>
          <ul className="text-sm text-background/70 space-y-2">
            <li>Ripados internos e externos</li>
            <li>Forros PVC</li>
            <li>Tetos laminados</li>
            <li>Pisos vinilicos</li>
            <li>Chapas UV</li>
            <li>Perfil de aluminio</li>
            <li>ACM</li>
          </ul>
        </div>

        <div className="flex flex-col items-start md:items-center">
          <h4 className="font-bold text-xs uppercase tracking-widest mb-4 text-highlight">
            Leve no celular
          </h4>
          <QRCode data={qrTarget} size={144} label="Aponte a camera para falar no WhatsApp" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 border-t border-background/10">
        <p className="text-[11px] leading-relaxed text-background/50 max-w-4xl">{LEGAL_NOTICE}</p>
        <p className="text-[11px] leading-relaxed text-background/40 mt-3">
          {brandConfig.signature}
        </p>
      </div>
    </footer>
  );
}
