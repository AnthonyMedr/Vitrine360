import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LocalCommercialSettings, LocalDeliveryZone, LocalSiteContent } from "@/lib/localCommerce";

export function useSiteContent() {
  return useQuery({
    queryKey: ["site-content"],
    queryFn: async () => apiFetch<LocalSiteContent>("/api/site-content"),
  });
}

export function useCommercialSettings() {
  return useQuery({
    queryKey: ["commercial-settings"],
    queryFn: async () => apiFetch<LocalCommercialSettings>("/api/commercial-settings"),
  });
}

export function useDeliveryZones() {
  return useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => apiFetch<LocalDeliveryZone[]>("/api/delivery-zones"),
  });
}
