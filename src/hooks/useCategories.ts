import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LocalCategory } from "@/lib/localCommerce";

export type Category = LocalCategory;

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => apiFetch<Category[]>("/api/categories"),
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const categories = await apiFetch<Category[]>("/api/categories");
      return categories.find((item) => item.slug === slug) ?? null;
    },
    enabled: !!slug,
  });
}
