import { useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";
import type { PublicCatalogData } from "@/lib/commercial-data.server";

type StorefrontSnapshot = Pick<PublicCatalogData, "store" | "totem" | "vitrine">;

export function StorefrontSettingsSync({ storefront }: { storefront: StorefrontSnapshot | null }) {
  const { syncFromStorefront } = useSettings();

  useEffect(() => {
    if (!storefront) return;
    syncFromStorefront(storefront);
  }, [storefront, syncFromStorefront]);

  return null;
}
