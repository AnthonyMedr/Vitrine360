import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type MarketingStatus = "draft" | "review" | "scheduled" | "active" | "paused" | "ended" | "archived";
export type MarketingCampaignType =
  | "monthly"
  | "fortnightly"
  | "weekly"
  | "commemorative"
  | "flash"
  | "clearance"
  | "launch"
  | "institutional"
  | "regional"
  | "product"
  | "category"
  | "b2b"
  | "cart_recovery"
  | "whatsapp";

export type MarketingTheme = {
  id: string;
  name: string;
  slug: string;
  type: MarketingCampaignType;
  status: MarketingStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  color_primary: string;
  color_secondary: string;
  background_color: string;
  text_color: string;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  status: MarketingStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  landing_page_id?: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  whatsapp_message: string | null;
  banner_desktop: string | null;
  banner_mobile: string | null;
  coupon_id?: string | null;
  products_json: string[];
  categories_json: string[];
  rules_json?: Record<string, unknown>;
  published_at?: string | null;
};

export type MarketingBanner = {
  id: string;
  name: string;
  slug: string;
  placement: string;
  status: MarketingStatus;
  priority: number;
  desktop_image: string | null;
  mobile_image: string | null;
  alt_text: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export type ProductShowcase = {
  id: string;
  name: string;
  slug: string;
  status: MarketingStatus;
  placement: string;
  priority: number;
  title: string | null;
  subtitle: string | null;
  rule_type: string;
  product_ids_json: string[];
  category_ids_json: string[];
  max_items: number;
  products?: Array<{ id: string; slug: string; name: string; price: number; promotional_price: number | null; image: string | null; stock: number }>;
};

export type MarketingAsset = {
  id: string;
  name: string;
  type: string;
  url: string;
  alt_text: string | null;
  usage: string;
  status: MarketingStatus;
  campaign_id: string | null;
  theme_id: string | null;
};

export type MarketingCoupon = {
  id: string;
  code: string;
  name?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number | null;
  max_discount_value?: number | null;
  description: string | null;
  is_active: boolean;
  starts_at?: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  campaign_id?: string | null;
};

export type CampaignLandingPage = {
  id: string;
  campaign_id: string | null;
  theme_id: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  hero_desktop_image: string | null;
  hero_mobile_image: string | null;
  body_json: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  faq_json: Array<Record<string, unknown>>;
  showcase_ids_json: string[];
  banner_ids_json: string[];
  status: MarketingStatus;
  starts_at: string | null;
  ends_at: string | null;
};

export type ContentSnippet = {
  id: string;
  key: string;
  name: string;
  type: "headline" | "subheadline" | "cta" | "whatsapp" | "seo" | "faq" | "institutional" | "campaign_text";
  content: string;
  status: MarketingStatus;
  campaign_id: string | null;
  theme_id: string | null;
  product_id: string | null;
  category_id: string | null;
};

export type IntegrationProvider = {
  id: string;
  key: string;
  name: string;
  category: string;
  status: string;
  is_configured: boolean;
  is_required_for_production: boolean;
  last_checked_at: string | null;
  last_status_message: string | null;
  public_config_json: Record<string, unknown>;
  masked_secrets_json: Record<string, string>;
  configuration_checklist?: {
    required_secrets: string[];
    required_public_config: string[];
    missing_secrets: string[];
    missing_public_config: string[];
    production_checklist: string[];
    admin_instructions: string;
    ready_for_admin_configuration: boolean;
    ready_for_production: boolean;
    active_secret_count: number;
  };
};

export type IntegrationSecret = {
  id: string;
  provider_key: string;
  secret_key: string;
  masked_value: string;
  environment: "development" | "sandbox" | "production";
  status: "active" | "rotated" | "revoked";
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationDetail = {
  provider: IntegrationProvider;
  secrets: IntegrationSecret[];
  logs: Array<Record<string, unknown>>;
};

export type MarketingState = {
  theme: MarketingTheme | null;
  campaigns: MarketingCampaign[];
  banners: MarketingBanner[];
  cards: Array<Record<string, unknown>>;
  showcases: ProductShowcase[];
  site_experience: {
    mode: "default" | "campaign";
    mold_level: "default" | "light" | "guided" | "full";
    active_campaign: {
      id: string;
      slug: string;
      name: string;
      headline: string | null;
      subheadline: string | null;
      cta_label: string | null;
      cta_url: string | null;
      whatsapp_message: string | null;
    } | null;
    active_theme: {
      id: string;
      name: string;
      slug: string;
      color_primary: string;
      color_secondary: string;
      background_color: string;
      text_color: string;
    } | null;
    hero: {
      source: "banner" | "campaign" | "copy_only";
      title: string | null;
      subtitle: string | null;
      desktop_image: string | null;
      mobile_image: string | null;
      cta_label: string;
      cta_url: string;
    };
    category_focus: {
      ids: string[];
      names: string[];
      enabled: boolean;
    };
    surface_controls: {
      top_bar: boolean;
      hero: boolean;
      home_showcases: boolean;
      category_focus: boolean;
      landing: boolean;
      whatsapp: boolean;
      coupon: boolean;
    };
    publication: {
      live_state: "institutional" | "draft" | "scheduled" | "live";
      live_label: string;
      affects_site_now: boolean;
    };
    top_bar: {
      enabled: boolean;
      text: string | null;
      cta_label: string | null;
      cta_url: string | null;
    };
    home_slots: Array<{
      slot: "primary" | "secondary" | "tertiary";
      showcase_id: string;
      showcase_slug: string;
      showcase_name: string;
      title: string;
      subtitle: string | null;
      product_count: number;
      cta_url: string;
      cta_label: string;
    }>;
    landing_page: {
      id: string;
      slug: string;
      title: string;
      has_hero_desktop: boolean;
      has_hero_mobile: boolean;
      showcase_count: number;
    } | null;
    coupon: {
      id: string;
      code: string;
      discount_type: string;
      discount_value: number;
    } | null;
    configured_surfaces: string[];
    home_showcase_count: number;
    next_steps: string[];
  };
  top_bar: { campaign_id: string; text: string | null; cta_label: string | null; cta_url: string | null } | null;
  fallback: boolean;
};

export type MarketingOverview = {
  generated_at: string;
  counts: Record<string, number>;
  active: {
    theme: MarketingTheme | null;
    campaigns: MarketingCampaign[];
    banners: MarketingBanner[];
    showcases: ProductShowcase[];
    themes: MarketingTheme[];
  };
  site_experience: MarketingState["site_experience"];
  warnings: Array<{ item: string; detail: string }>;
  blockers: Array<{ item: string; detail: string }>;
  conflicts: Array<Record<string, unknown>>;
};

export type MarketingPreviewState = {
  preview_at: string;
  state: MarketingState;
  overview: MarketingOverview;
};

export function usePublicMarketingState() {
  return useQuery({
    queryKey: ["public-marketing-state"],
    queryFn: () => apiFetch<MarketingState>("/api/public/campaigns/active"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminMarketingPreview(atIso: string | null) {
  return useQuery({
    queryKey: ["admin-marketing-preview", atIso],
    queryFn: () => apiFetch<MarketingPreviewState>(`/api/admin/marketing/preview?at=${encodeURIComponent(atIso || new Date().toISOString())}`),
    enabled: Boolean(atIso),
  });
}

export function useAdminMarketingCalendar() {
  return useQuery({
    queryKey: ["admin-marketing-calendar"],
    queryFn: () =>
      apiFetch<{
        themes: MarketingTheme[];
        campaigns: MarketingCampaign[];
        banners: MarketingBanner[];
        landing_pages: Array<Record<string, unknown>>;
        assets: MarketingAsset[];
        coupons: MarketingCoupon[];
        readiness: Record<string, unknown>;
      }>("/api/admin/marketing/calendar"),
  });
}

export function useAdminMarketingReports() {
  return useQuery({
    queryKey: ["admin-marketing-reports"],
    queryFn: () =>
      apiFetch<{
        generated_at: string;
        totals: Record<string, number>;
        campaigns: Array<Record<string, string | number>>;
      }>("/api/admin/marketing/reports"),
  });
}

export function useAdminMarketingAssets() {
  return useQuery({
    queryKey: ["admin-marketing-assets"],
    queryFn: () => apiFetch<MarketingAsset[]>("/api/admin/marketing/assets"),
  });
}

export function useAdminMarketingCoupons() {
  return useQuery({
    queryKey: ["admin-marketing-coupons"],
    queryFn: () => apiFetch<MarketingCoupon[]>("/api/admin/marketing/coupons"),
  });
}

export function useAdminMarketingLandingPages() {
  return useQuery({
    queryKey: ["admin-marketing-landing-pages"],
    queryFn: () => apiFetch<CampaignLandingPage[]>("/api/admin/marketing/landing-pages"),
  });
}

export function useAdminMarketingSnippets() {
  return useQuery({
    queryKey: ["admin-marketing-snippets"],
    queryFn: () => apiFetch<ContentSnippet[]>("/api/admin/marketing/snippets"),
  });
}

export function useAdminIntegrations() {
  return useQuery({
    queryKey: ["admin-integrations-secure"],
    queryFn: () => apiFetch<IntegrationProvider[]>("/api/admin/integrations"),
  });
}

export function useAdminIntegrationDetail(key: string | null) {
  return useQuery({
    queryKey: ["admin-integration-detail", key],
    queryFn: () => apiFetch<IntegrationDetail>(`/api/admin/integrations/${key}`),
    enabled: Boolean(key),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MarketingCampaign>) =>
      apiFetch<MarketingCampaign>("/api/admin/marketing/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MarketingCampaign> }) =>
      apiFetch<MarketingCampaign>(`/api/admin/marketing/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MarketingAsset>) =>
      apiFetch<MarketingAsset>("/api/admin/marketing/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MarketingCoupon>) =>
      apiFetch<MarketingCoupon>("/api/admin/marketing/coupons", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-coupons"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
    },
  });
}

export function useCreateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CampaignLandingPage>) =>
      apiFetch<CampaignLandingPage>("/api/admin/marketing/landing-pages", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-landing-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useUpdateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CampaignLandingPage> }) =>
      apiFetch<CampaignLandingPage>(`/api/admin/marketing/landing-pages/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-landing-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useDuplicateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CampaignLandingPage>(`/api/admin/marketing/landing-pages/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-landing-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useCreateSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ContentSnippet>) =>
      apiFetch<ContentSnippet>("/api/admin/marketing/snippets", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-snippets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useUpdateSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContentSnippet> }) =>
      apiFetch<ContentSnippet>(`/api/admin/marketing/snippets/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-snippets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useDuplicateSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContentSnippet>(`/api/admin/marketing/snippets/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-snippets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
    },
  });
}

export function useCampaignAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "pause" | "end" | "duplicate" }) =>
      apiFetch<MarketingCampaign>(`/api/admin/marketing/campaigns/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-marketing-calendar"] });
    },
  });
}

export function useTestIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => apiFetch<IntegrationProvider>(`/api/admin/integrations/${key}/test`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-secure"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integration-detail"] });
    },
  });
}

export function useSaveIntegrationSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: { secret_key: string; value: string; environment: "development" | "sandbox" | "production" } }) =>
      apiFetch<IntegrationSecret>(`/api/admin/integrations/${key}/secrets`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-secure"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integration-detail", variables.key] });
    },
  });
}

export function useUpdateIntegrationProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      payload,
    }: {
      key: string;
      payload: { status?: string; is_configured?: boolean; public_config_json?: Record<string, unknown> };
    }) =>
      apiFetch<IntegrationProvider>(`/api/admin/integrations/${key}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-secure"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integration-detail", variables.key] });
    },
  });
}

export function useApproveIntegrationProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<IntegrationProvider>(`/api/admin/integrations/${key}/production-approval`, {
        method: "POST",
      }),
    onSuccess: (_data, key) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations-secure"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-integration-detail", key] });
    },
  });
}
