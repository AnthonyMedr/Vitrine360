import { useEffect, useState } from "react";

export function useAdminPersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const storedValue = window.localStorage.getItem(key);
      return storedValue ? (JSON.parse(storedValue) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Prefer keeping the admin usable when local preferences cannot be saved.
    }
  }, [key, value]);

  const reset = () => setValue(initialValue);

  return [value, setValue, reset] as const;
}
