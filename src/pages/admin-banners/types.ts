export type InstitutionalPage = { slug: string; title: string; content: string; is_published: boolean; updated_at: string };
export type SiteContent = { pages: InstitutionalPage[] };

export type BannerStatus = "draft" | "review" | "scheduled" | "active" | "paused" | "ended" | "archived";

export type Banner = {
  id: string;
  name: string;
  slug: string;
  placement: string;
  status: BannerStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  desktop_image: string | null;
  mobile_image: string | null;
  alt_text: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
  updated_at: string;
};

export type BannerDraft = {
  name: string;
  placement: string;
  status: BannerStatus;
  priority: string;
  title: string;
  subtitle: string;
  desktop_image: string;
  mobile_image: string;
  alt_text: string;
  cta_label: string;
  cta_url: string;
  starts_at: string;
  ends_at: string;
};
