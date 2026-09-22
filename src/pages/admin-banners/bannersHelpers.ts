import type { Banner, BannerDraft, BannerStatus } from "./types";

export const emptyDraft: BannerDraft = {
  name: "",
  placement: "home_hero",
  status: "draft",
  priority: "10",
  title: "",
  subtitle: "",
  desktop_image: "",
  mobile_image: "",
  alt_text: "",
  cta_label: "",
  cta_url: "",
  starts_at: "",
  ends_at: "",
};

export function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const statusLabels: Record<BannerStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  scheduled: "Agendado",
  active: "Ativo",
  paused: "Pausado",
  ended: "Encerrado",
  archived: "Arquivado",
};

export function bannerToDraft(banner: Banner): BannerDraft {
  return {
    name: banner.name,
    placement: banner.placement,
    status: banner.status,
    priority: String(banner.priority ?? 10),
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    desktop_image: banner.desktop_image ?? "",
    mobile_image: banner.mobile_image ?? "",
    alt_text: banner.alt_text ?? "",
    cta_label: banner.cta_label ?? "",
    cta_url: banner.cta_url ?? "",
    starts_at: toDatetimeLocalValue(banner.starts_at),
    ends_at: toDatetimeLocalValue(banner.ends_at),
  };
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function draftToPayload(draft: BannerDraft) {
  return {
    name: draft.name.trim(),
    placement: draft.placement.trim() || "home_hero",
    status: draft.status,
    priority: Number(draft.priority) || 10,
    title: draft.title.trim() || null,
    subtitle: draft.subtitle.trim() || null,
    desktop_image: draft.desktop_image.trim() || null,
    mobile_image: draft.mobile_image.trim() || null,
    alt_text: draft.alt_text.trim() || null,
    cta_label: draft.cta_label.trim() || null,
    cta_url: draft.cta_url.trim() || null,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
  };
}
