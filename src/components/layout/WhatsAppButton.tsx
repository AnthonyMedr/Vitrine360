import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWhatsAppUrl, WHATSAPP_MESSAGES } from "@/constants/store";
import { useEventBus } from "@/hooks/useEventBus";

interface WhatsAppButtonProps {
  label?: string;
  message?: string;
  className?: string;
  floating?: boolean;
  compact?: boolean;
  origin?: string;
}

export function WhatsAppButton({
  label = "Fale conosco",
  message = WHATSAPP_MESSAGES.contact,
  className,
  floating = false,
  compact = false,
  origin = "site",
}: WhatsAppButtonProps) {
  const { trackLead, emitEvent } = useEventBus();
  const whatsappUrl = getWhatsAppUrl(message);

  const handleClick = () => {
    trackLead("whatsapp", {
      page_url: window.location.href,
      referrer: document.referrer || undefined,
    });
    emitEvent("support.requested", {
      channel: "whatsapp",
      origin,
      page_url: window.location.href,
    });
  };

  if (floating) {
    return (
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={cn(
          "group fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6 md:h-16 md:w-16",
          className,
        )}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={label}
      >
        <MessageCircle className="h-6 w-6 md:h-8 md:w-8" />
        <span className="pointer-events-none absolute -left-32 hidden rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
          {label}
        </span>
      </motion.a>
    );
  }

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1faa52]",
        compact ? "text-sm" : "text-base",
        className,
      )}
      aria-label={label}
    >
      <MessageCircle className={compact ? "h-4 w-4" : "h-5 w-5"} />
      <span>{label}</span>
    </a>
  );
}
