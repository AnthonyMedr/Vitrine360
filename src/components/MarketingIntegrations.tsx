import { useEffect, useRef } from "react";

const gaId = import.meta.env.VITE_GA_ID;
const metaPixelId = import.meta.env.VITE_META_PIXEL_ID;
const CONSENT_KEY = "lgpd_consent";

declare global {
  interface FbqFunction {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    queue?: unknown[][];
    push?: (...args: unknown[]) => void;
    loaded?: boolean;
    version?: string;
  }

  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqFunction;
    _fbq?: Window["fbq"];
  }
}

export function MarketingIntegrations() {
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const readConsent = () => {
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw) as { accepted?: boolean };
        return parsed.accepted === true;
      } catch {
        return false;
      }
    };

    const bootstrapIntegrations = () => {
      if (bootstrappedRef.current || !readConsent()) return;
      bootstrappedRef.current = true;

      if (gaId && !document.getElementById("ga-script")) {
        const script = document.createElement("script");
        script.id = "ga-script";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        window.gtag =
          window.gtag ||
          function gtag(...args: unknown[]) {
            window.dataLayer?.push(args);
          };
        window.gtag("js", new Date());
        window.gtag("config", gaId);
      }

      if (metaPixelId && !document.getElementById("meta-pixel-script")) {
        if (!window.fbq) {
          const fbq: FbqFunction = ((...args: unknown[]) => {
            if (fbq.callMethod) {
              fbq.callMethod(...args);
              return;
            }
            fbq.queue = fbq.queue || [];
            fbq.queue.push(args);
          }) as FbqFunction;

          fbq.queue = [];
          fbq.loaded = true;
          fbq.version = "2.0";
          fbq.push = (...args: unknown[]) => {
            fbq.queue?.push(args);
          };
          window.fbq = fbq;
          if (!window._fbq) {
            window._fbq = fbq;
          }
        }

        const script = document.createElement("script");
        script.id = "meta-pixel-script";
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(script);

        window.fbq?.("init", metaPixelId);
        window.fbq?.("track", "PageView");
      }
    };

    // Third-party tags stay out of the critical path until the browser is idle and consent is explicit.
    const scheduleBootstrap = () => {
      if (!readConsent()) return;
      if (typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function") {
        const idleId = window.requestIdleCallback(() => bootstrapIntegrations(), { timeout: 2500 });
        return () => window.cancelIdleCallback?.(idleId);
      }

      const timer = window.setTimeout(bootstrapIntegrations, 600);
      return () => window.clearTimeout(timer);
    };

    const cancelScheduledBootstrap = scheduleBootstrap();
    const handleConsentUpdated = () => {
      const cancelNextBootstrap = scheduleBootstrap();
      if (cancelNextBootstrap) {
        cleanupHandlers.push(cancelNextBootstrap);
      }
    };

    const cleanupHandlers: Array<() => void> = [];
    if (cancelScheduledBootstrap) {
      cleanupHandlers.push(cancelScheduledBootstrap);
    }

    window.addEventListener("lgpd-consent-updated", handleConsentUpdated);

    return () => {
      window.removeEventListener("lgpd-consent-updated", handleConsentUpdated);
      cleanupHandlers.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
