import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LocalShippingQuoteOption, LocalShippingQuoteResponse } from "@/lib/localCommerce";

export type ShippingOption = LocalShippingQuoteOption;

export function useShipping() {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [underAnalysis, setUnderAnalysis] = useState(false);
  const [nationalCoverage, setNationalCoverage] = useState<LocalShippingQuoteResponse["nationalCoverage"]>(undefined);

  const calculateShipping = useCallback(async (cep: string, subtotal = 0, items?: Array<{ productId: string; quantity: number }>) => {
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      setError("CEP invalido");
      setOptions([]);
      setSelectedOption(null);
      setNationalCoverage(undefined);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        cep: cleanCep,
        subtotal: String(subtotal),
      });
      if (items && items.length > 0) {
        query.set("items", JSON.stringify(items));
      }
      const data = await apiFetch<LocalShippingQuoteResponse>(`/api/shipping/quote?${query.toString()}`);
      setOptions(data.options);
      setSelectedOption(data.options.find((item) => item.deliveryType === "delivery") ?? null);
      setUnderAnalysis(data.underAnalysis);
      setMessage(data.message);
      setNationalCoverage(data.nationalCoverage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular o frete");
      setOptions([]);
      setSelectedOption(null);
      setNationalCoverage(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatCep = useCallback((value: string) => {
    const cleanValue = value.replace(/\D/g, "");
    if (cleanValue.length <= 5) return cleanValue;
    return `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
  }, []);

  return {
    loading,
    options,
    selectedOption,
    error,
    message,
    underAnalysis,
    nationalCoverage,
    calculateShipping,
    setSelectedOption,
    formatCep,
  };
}
