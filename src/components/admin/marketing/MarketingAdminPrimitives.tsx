import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketingCampaign, MarketingState } from "@/hooks/useMarketing";

export function MarketingStatusBadge({ status }: { status: string }) {
  const variant = status === "active" || status === "production" ? "default" : status === "error" ? "destructive" : status === "scheduled" || status === "sandbox" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export function DateRangeFields({
  startsAt,
  endsAt,
  onChange,
}: {
  startsAt: string | null | undefined;
  endsAt: string | null | undefined;
  onChange: (patch: { starts_at?: string | null; ends_at?: string | null }) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Inicio</Label>
        <Input type="datetime-local" value={startsAt ? startsAt.slice(0, 16) : ""} onChange={(event) => onChange({ starts_at: event.target.value ? new Date(event.target.value).toISOString() : null })} />
      </div>
      <div className="space-y-2">
        <Label>Fim</Label>
        <Input type="datetime-local" value={endsAt ? endsAt.slice(0, 16) : ""} onChange={(event) => onChange({ ends_at: event.target.value ? new Date(event.target.value).toISOString() : null })} />
      </div>
    </div>
  );
}

export function PriorityInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>Prioridade</Label>
      <Input type="number" min={0} max={1000} value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />
    </div>
  );
}

export function ImageUrlField({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="https://... ou /assets/imagem.jpg" />
    </div>
  );
}

export function ValidationChecklist({ campaign }: { campaign: Partial<MarketingCampaign> }) {
  const checks = [
    ["Periodo definido", Boolean(campaign.starts_at && campaign.ends_at)],
    ["CTA configurado", Boolean(campaign.cta_label && campaign.cta_url)],
    ["WhatsApp configurado", Boolean(campaign.whatsapp_message)],
    ["Banner mobile", Boolean(campaign.banner_mobile)],
    ["Produtos ou categorias", Boolean((campaign.products_json?.length ?? 0) > 0 || (campaign.categories_json?.length ?? 0) > 0)],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist de publicacao</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {checks.map(([label, ok]) => (
          <div key={String(label)} className="flex items-center justify-between rounded-md border px-3 py-2">
            <span>{label}</span>
            <Badge variant={ok ? "default" : "outline"}>{ok ? "ok" : "revisar"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MobileDesktopPreview({ campaign }: { campaign: Partial<MarketingCampaign> }) {
  const image = campaign.banner_desktop || campaign.banner_mobile;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview desktop/mobile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="overflow-hidden rounded-lg border bg-background">
          {image ? <img className="h-48 w-full object-cover" src={image} alt={campaign.headline || campaign.name || "Preview"} /> : <div className="flex h-48 items-center justify-center bg-muted text-sm text-muted-foreground">Sem imagem desktop</div>}
          <div className="p-4">
            <h3 className="font-semibold">{campaign.headline || campaign.name || "Headline da campanha"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.subheadline || "Subheadline da campanha"}</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          {campaign.banner_mobile || image ? <img className="h-36 w-full object-cover" src={campaign.banner_mobile || image || ""} alt={campaign.headline || campaign.name || "Preview mobile"} /> : <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">Sem imagem mobile</div>}
          <div className="p-3">
            <p className="text-sm font-semibold">{campaign.cta_label || "CTA"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignPublicationStateCard({ campaign }: { campaign: Partial<MarketingCampaign> }) {
  const now = Date.now();
  const startsAt = campaign.starts_at ? Date.parse(campaign.starts_at) : null;
  const endsAt = campaign.ends_at ? Date.parse(campaign.ends_at) : null;
  const isActiveWindow = (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
  const affectsSiteNow = campaign.status === "active" && isActiveWindow;
  const label = affectsSiteNow
    ? "Campanha publicada e moldando o site agora"
    : campaign.status === "scheduled"
      ? "Campanha programada, aguardando janela"
      : "Campanha em rascunho/revisão, sem afetar o site";
  const detail = affectsSiteNow
    ? "Alteracoes desta campanha devem ser tratadas como estado ao vivo da home e das vitrines."
    : "Use o preview para revisar antes de publicar. Mudancas aqui ainda não alteram o site ao vivo.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estado de publicacao</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <span>Status atual</span>
          <Badge variant={affectsSiteNow ? "default" : "outline"}>{campaign.status || "draft"}</Badge>
        </div>
        <div className="rounded-md border p-3">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignSiteExperiencePreview({
  siteExperience,
}: {
  siteExperience: MarketingState["site_experience"] | null | undefined;
}) {
  const hero = siteExperience?.hero;
  const homeSlots = siteExperience?.home_slots ?? [];
  const title = hero?.title || siteExperience?.active_campaign?.headline || "Sem experiência de campanha ativa";
  const subtitle = hero?.subtitle || siteExperience?.active_campaign?.subheadline || "O site segue com fallback institucional.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview executivo desktop/mobile</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            {siteExperience?.top_bar?.enabled ? siteExperience.top_bar.text || "Top bar de campanha" : "Top bar institucional"}
          </div>
          {hero?.desktop_image ? <img className="h-44 w-full object-cover" src={hero.desktop_image} alt={title} /> : <div className="flex h-44 items-center justify-center bg-muted text-sm text-muted-foreground">Sem hero desktop</div>}
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Desktop</p>
              <h3 className="mt-1 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {homeSlots.slice(0, 3).map((slot) => (
                <div key={slot.showcase_id} className="rounded-md border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{slot.slot}</p>
                  <p className="mt-1 text-sm font-medium">{slot.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{slot.product_count} produto(s)</p>
                </div>
              ))}
              {homeSlots.length === 0 ? <div className="rounded-md border p-3 text-xs text-muted-foreground">Sem vitrines home vinculadas.</div> : null}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] border bg-background">
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-muted" />
          {hero?.mobile_image || hero?.desktop_image ? (
            <img className="h-36 w-full object-cover" src={hero?.mobile_image || hero?.desktop_image || ""} alt={title} />
          ) : (
            <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">Sem hero mobile</div>
          )}
          <div className="space-y-3 p-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mobile</p>
              <p className="mt-1 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{siteExperience?.active_campaign?.cta_label || hero?.cta_label || "CTA"}</p>
            </div>
            <div className="space-y-2">
              {homeSlots.slice(0, 2).map((slot) => (
                <div key={`${slot.showcase_id}-mobile`} className="rounded-md border p-2">
                  <p className="text-xs font-medium">{slot.title}</p>
                </div>
              ))}
              {homeSlots.length === 0 ? <div className="rounded-md border p-2 text-[11px] text-muted-foreground">Sem slots de campanha.</div> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignSurfacePreview({
  siteExperience,
}: {
  siteExperience: MarketingState["site_experience"] | null | undefined;
}) {
  const surfaces = [
    {
      key: "publication",
      title: "Publicação",
      description: siteExperience?.publication.live_label || "Sem campanha ativa.",
      state: siteExperience?.publication.affects_site_now ? "ao vivo" : "rascunho",
    },
    {
      key: "top-bar",
      title: "Top bar",
      description: siteExperience?.top_bar?.enabled ? siteExperience.top_bar.text || "Top bar de campanha" : "Sem top bar de campanha.",
      state: siteExperience?.top_bar?.enabled ? "ativa" : "vazia",
    },
    {
      key: "hero",
      title: "Hero",
      description: siteExperience?.hero.title || "Sem hero comercial.",
      state: siteExperience?.hero.desktop_image || siteExperience?.hero.mobile_image ? "com imagem" : "copy only",
    },
    {
      key: "home",
      title: "Faixas da home",
      description:
        (siteExperience?.home_slots?.length ?? 0) > 0
          ? `${siteExperience?.home_slots.length ?? 0} slot(s) ordenado(s) para a campanha.`
          : "Sem vitrines de campanha na home.",
      state: (siteExperience?.home_slots?.length ?? 0) > 0 ? "ativa" : "vazia",
    },
    {
      key: "landing",
      title: "Landing",
      description: siteExperience?.landing_page ? `/campanhas/${siteExperience.landing_page.slug}` : "Sem landing conectada.",
      state: siteExperience?.landing_page ? "conectada" : "vazia",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview por superficie</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {surfaces.map((surface) => (
          <div key={surface.key} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{surface.title}</p>
              <Badge variant={surface.state === "vazia" || surface.state === "rascunho" ? "outline" : "secondary"}>{surface.state}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium">{surface.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
