import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LocalAddressLookupResponse } from "@/lib/localCommerce";

export function useAddressLookup() {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<LocalAddressLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookupCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      setAddress(null);
      setError("CEP invalido");
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<LocalAddressLookupResponse>(`/api/address/cep/${cleanCep}`);
      setAddress(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível localizar o CEP";
      setAddress(null);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    address,
    error,
    lookupCep,
  };
}
