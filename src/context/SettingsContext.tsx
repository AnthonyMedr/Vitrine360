/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { brandConfig } from "@/config/brand";

export type BadgeTone = "action" | "highlight" | "brand" | "dark" | "whatsapp";

export type BadgePreset = { id: string; label: string; tone: BadgeTone };

export type ScheduledCampaign = {
  id: string;
  name: string;
  badgeLabel: string;
  message: string;
  tone: BadgeTone;
  startDate: string;
  endDate: string;
  enabled: boolean;
};

export type AppSettings = {
  brand: string;
  tagline: string;
  whatsappNumber: string;
  whatsappLabel: string;
  address: string;
  hours: string;
  instagram: string;
  logoUrl: string;
  actionColor: string;
  highlightColor: string;
  kioskMode: boolean;
  offlineMode: boolean;
  idleTimeoutSec: number;
  badgePresets: BadgePreset[];
  campaigns: ScheduledCampaign[];
};

const DEFAULTS: AppSettings = {
  brand: brandConfig.defaultStoreName,
  tagline: "Acabamentos e construcao",
  whatsappNumber: brandConfig.defaultStorePhoneNumber,
  whatsappLabel: brandConfig.defaultStorePhoneLabel,
  address: brandConfig.defaultStoreAddress,
  hours: brandConfig.defaultStoreOpeningHours,
  instagram: brandConfig.defaultInstagramHandle,
  logoUrl: brandConfig.defaultLogoUrl,
  actionColor: brandConfig.defaultActionColor,
  highlightColor: brandConfig.defaultHighlightColor,
  kioskMode: false,
  offlineMode: true,
  idleTimeoutSec: 90,
  badgePresets: [
    { id: "destaque", label: "Destaque", tone: "highlight" },
    { id: "oferta", label: "Oferta", tone: "action" },
    { id: "novidade", label: "Novidade", tone: "brand" },
    { id: "exclusivo", label: "Exclusivo", tone: "dark" },
  ],
  campaigns: [
    {
      id: "semana",
      name: "Tabloide da Semana",
      badgeLabel: "OFERTA DA SEMANA",
      message: "Tabloide da Semana - confira os destaques de hoje!",
      tone: "action",
      startDate: "2025-01-01",
      endDate: "2099-12-31",
      enabled: true,
    },
    {
      id: "mes",
      name: "Tabloide do Mes",
      badgeLabel: "OFERTA DO MES",
      message: "Tabloide do Mes - descontos exclusivos durante todo o mes.",
      tone: "highlight",
      startDate: "2025-01-01",
      endDate: "2099-12-31",
      enabled: false,
    },
  ],
};

const STORAGE_KEY = "vitrine360-settings-v4";

type Ctx = {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  syncFromStorefront: (storefront: StorefrontSnapshot | null | undefined) => void;
  reset: () => void;
  activeCampaign: ScheduledCampaign | null;
};

const SettingsCtx = createContext<Ctx | null>(null);

type StorefrontSnapshot = {
  store?: {
    storeName?: string;
    whatsappNumber?: string;
    address?: string;
    openingHours?: string;
    instagramUrl?: string;
    institutionalText?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string | null;
  };
  totem?: {
    idleResetSeconds?: number;
  };
};

function sanitizeBadgePreset(value: unknown, index: number): BadgePreset | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<BadgePreset>;
  if (typeof item.label !== "string" || item.label.trim() === "") return null;

  const tone: BadgeTone =
    item.tone === "action" ||
    item.tone === "highlight" ||
    item.tone === "brand" ||
    item.tone === "dark" ||
    item.tone === "whatsapp"
      ? item.tone
      : "highlight";

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : `badge-${index}`,
    label: item.label,
    tone,
  };
}

function sanitizeCampaign(value: unknown, index: number): ScheduledCampaign | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ScheduledCampaign>;

  if (
    typeof item.name !== "string" ||
    typeof item.badgeLabel !== "string" ||
    typeof item.message !== "string" ||
    typeof item.startDate !== "string" ||
    typeof item.endDate !== "string"
  ) {
    return null;
  }

  const tone: BadgeTone =
    item.tone === "action" ||
    item.tone === "highlight" ||
    item.tone === "brand" ||
    item.tone === "dark" ||
    item.tone === "whatsapp"
      ? item.tone
      : "action";

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : `campaign-${index}`,
    name: item.name,
    badgeLabel: item.badgeLabel,
    message: item.message,
    tone,
    startDate: item.startDate,
    endDate: item.endDate,
    enabled: Boolean(item.enabled),
  };
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return DEFAULTS;
  const parsed = value as Partial<AppSettings>;

  return {
    brand: typeof parsed.brand === "string" ? parsed.brand : DEFAULTS.brand,
    tagline: typeof parsed.tagline === "string" ? parsed.tagline : DEFAULTS.tagline,
    whatsappNumber:
      typeof parsed.whatsappNumber === "string"
        ? parsed.whatsappNumber.replace(/\D/g, "")
        : DEFAULTS.whatsappNumber,
    whatsappLabel:
      typeof parsed.whatsappLabel === "string" ? parsed.whatsappLabel : DEFAULTS.whatsappLabel,
    address: typeof parsed.address === "string" ? parsed.address : DEFAULTS.address,
    hours: typeof parsed.hours === "string" ? parsed.hours : DEFAULTS.hours,
    instagram: typeof parsed.instagram === "string" ? parsed.instagram : DEFAULTS.instagram,
    logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : DEFAULTS.logoUrl,
    actionColor: typeof parsed.actionColor === "string" ? parsed.actionColor : DEFAULTS.actionColor,
    highlightColor:
      typeof parsed.highlightColor === "string" ? parsed.highlightColor : DEFAULTS.highlightColor,
    kioskMode: typeof parsed.kioskMode === "boolean" ? parsed.kioskMode : DEFAULTS.kioskMode,
    offlineMode:
      typeof parsed.offlineMode === "boolean" ? parsed.offlineMode : DEFAULTS.offlineMode,
    idleTimeoutSec:
      typeof parsed.idleTimeoutSec === "number" && Number.isFinite(parsed.idleTimeoutSec)
        ? parsed.idleTimeoutSec
        : DEFAULTS.idleTimeoutSec,
    badgePresets: Array.isArray(parsed.badgePresets)
      ? parsed.badgePresets
          .map((item, index) => sanitizeBadgePreset(item, index))
          .filter((item): item is BadgePreset => Boolean(item))
      : DEFAULTS.badgePresets,
    campaigns: Array.isArray(parsed.campaigns)
      ? parsed.campaigns
          .map((item, index) => sanitizeCampaign(item, index))
          .filter((item): item is ScheduledCampaign => Boolean(item))
      : DEFAULTS.campaigns,
  };
}

function pickForeground(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#111111";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#1a1a1a" : "#ffffff";
}

function applyVars(settings: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--action", settings.actionColor);
  root.style.setProperty("--action-foreground", pickForeground(settings.actionColor));
  root.style.setProperty("--ring", settings.actionColor);
  root.style.setProperty("--highlight", settings.highlightColor);
  root.style.setProperty("--highlight-foreground", pickForeground(settings.highlightColor));
  root.classList.toggle("kiosk", settings.kioskMode);
}

function pickActiveCampaign(campaigns: ScheduledCampaign[]): ScheduledCampaign | null {
  const today = new Date().toISOString().slice(0, 10);
  const active = campaigns
    .filter(
      (campaign) => campaign.enabled && campaign.startDate <= today && campaign.endDate >= today,
    )
    .sort((left, right) => (left.endDate < right.endDate ? -1 : 1));

  return active[0] ?? null;
}

function formatPhoneLabel(number: string) {
  const digits = number.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits || DEFAULTS.whatsappLabel;
}

function mergeStorefrontSettings(
  current: AppSettings,
  storefront: StorefrontSnapshot,
): AppSettings {
  const store = storefront.store;
  const totem = storefront.totem;
  const whatsappNumber = (store?.whatsappNumber ?? current.whatsappNumber).replace(/\D/g, "");

  return {
    ...current,
    brand: store?.storeName || current.brand,
    tagline: store?.institutionalText || current.tagline,
    whatsappNumber,
    whatsappLabel: formatPhoneLabel(whatsappNumber),
    address: store?.address || current.address,
    hours: store?.openingHours || current.hours,
    instagram: store?.instagramUrl || current.instagram,
    logoUrl: store?.logoUrl || current.logoUrl,
    actionColor: store?.secondaryColor || current.actionColor,
    highlightColor: store?.primaryColor || current.highlightColor,
    idleTimeoutSec:
      typeof totem?.idleResetSeconds === "number" ? totem.idleResetSeconds : current.idleTimeoutSec,
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const current = localStorage.getItem(STORAGE_KEY);

      if (current) {
        setSettings(normalizeSettings(JSON.parse(current)));
      }
    } catch {
      setSettings(DEFAULTS);
    }
  }, []);

  useEffect(() => {
    applyVars(settings);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const activeCampaign = useMemo(
    () => pickActiveCampaign(settings.campaigns),
    [settings.campaigns],
  );

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => setSettings((current) => ({ ...current, ...patch })),
      syncFromStorefront: (storefront) => {
        if (!storefront) return;
        setSettings((current) => mergeStorefrontSettings(current, storefront));
      },
      reset: () => setSettings(DEFAULTS),
      activeCampaign,
    }),
    [settings, activeCampaign],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);

  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return ctx;
}

export function whatsappLink(message: string, number?: string) {
  const normalizedNumber = number ?? DEFAULTS.whatsappNumber;
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
}
