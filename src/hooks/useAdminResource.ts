import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export function useAdminResource<T>(url: string | null, fallback: T) {
  const fallbackRef = useRef(fallback);
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<T>(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar recurso administrativo.");
      setData(fallbackRef.current);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
