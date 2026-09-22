import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LocalCompanyLookupResponse } from "@/lib/localCommerce";

export function useCompanyLookup() {
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<LocalCompanyLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookupCnpj = useCallback(async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      setCompany(null);
      setError("CNPJ invalido");
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<LocalCompanyLookupResponse>(`/api/company/cnpj/${cleanCnpj}`);
      setCompany(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível localizar o CNPJ";
      setCompany(null);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    company,
    error,
    lookupCnpj,
  };
}
