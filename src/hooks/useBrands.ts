import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LocalBrand } from "@/lib/localCommerce";

export type Brand = LocalBrand;

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => apiFetch<Brand[]>("/api/brands"),
  });
}
