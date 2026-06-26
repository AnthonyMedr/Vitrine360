import { useEffect, useRef, useState } from "react";

/**
 * Triggers `onIdle` after `timeoutMs` of inactivity (no pointer/touch/key events).
 * Returns `idle` so the UI can render an attract screen.
 */
export function useIdleReset({
  timeoutMs,
  enabled,
  onIdle,
}: {
  timeoutMs: number;
  enabled: boolean;
  onIdle: () => void;
}) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }

    const reset = () => {
      setIdle(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setIdle(true);
        onIdleRef.current();
      }, timeoutMs);
    };

    const events = ["pointerdown", "touchstart", "keydown", "mousemove", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, enabled]);

  return { idle, wake: () => setIdle(false) };
}
