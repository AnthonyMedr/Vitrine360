import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LocalCoupon } from "@/lib/localCommerce";

export interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  description: string | null;
}

export function useCoupon() {
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateCoupon = async (code: string, orderValue: number) => {
    if (!code.trim()) {
      setError("Digite um código de cupom");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<LocalCoupon>(`/api/coupons/${code.toUpperCase().trim()}?orderValue=${orderValue}`);
      const validCoupon: Coupon = {
        id: data.id,
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_order_value: data.min_order_value,
        description: data.description,
      };
      setCoupon(validCoupon);
      setLoading(false);
      return validCoupon;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao validar cupom");
      setCoupon(null);
      setLoading(false);
      return null;
    }
  };

  const calculateDiscount = (orderValue: number): number => {
    if (!coupon) return 0;
    if (coupon.discount_type === "percentage") {
      return (orderValue * coupon.discount_value) / 100;
    }
    return Math.min(coupon.discount_value, orderValue);
  };

  const removeCoupon = () => {
    setCoupon(null);
    setError(null);
  };

  return {
    loading,
    coupon,
    error,
    validateCoupon,
    calculateDiscount,
    removeCoupon,
  };
}
