import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";

const CONSENT_KEY = "lgpd_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();
  const isInternalRoute = location.pathname.startsWith("/admin") || location.pathname === "/auth";

  useEffect(() => {
    if (isInternalRoute) {
      setVisible(false);
      return;
    }
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isInternalRoute]);

  const persistConsent = (accepted: boolean) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ accepted, date: new Date().toISOString() }));
    window.dispatchEvent(new Event("lgpd-consent-updated"));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="surface-panel fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-[1.6rem] px-4 py-4 shadow-lg md:left-4 md:right-auto"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Cookie className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Privacidade e cookies</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Usamos cookies para melhorar sua experiencia. Analytics e marketing so sao ativados com seu consentimento, conforme a{" "}
                <Link to="/politicas" className="text-primary underline">
                  LGPD
                </Link>
                .
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => persistConsent(true)}>
                  Aceitar
                </Button>
                <Button size="sm" variant="outline" onClick={() => persistConsent(false)}>
                  Recusar
                </Button>
              </div>
            </div>
            <button onClick={() => persistConsent(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
