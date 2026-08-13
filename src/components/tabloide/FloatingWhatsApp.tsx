import { MessageCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { buildGenericMessage, whatsappUrl } from "@/lib/whatsapp";
import { trackEvent } from "@/lib/analytics";

export function FloatingWhatsApp() {
  const { settings } = useSettings();
  const url = whatsappUrl(buildGenericMessage(settings), settings.whatsappNumber);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("campaign_cta", { label: "floating_whatsapp" })}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 bg-whatsapp px-4 py-3 text-whatsapp-foreground rounded-full shadow-pop transition-all hover:scale-[1.03] active:scale-95"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline text-sm font-bold pr-1">Orçamento rápido</span>
    </a>
  );
}
