import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type InstitutionalPage = {
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  updated_at: string;
};

export function useInstitutionalPage(slug: string) {
  return useQuery({
    queryKey: ["institutional-page", slug],
    queryFn: () => apiFetch<InstitutionalPage>(`/api/public/content/pages/${slug}`),
    staleTime: 60_000,
    retry: false,
  });
}
