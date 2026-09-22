import type { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusLabels } from "./bannersHelpers";
import type { BannerDraft, BannerStatus } from "./types";

export function BannerDraftForm({
  draft,
  onChange,
  uploadingField,
  onUploadImage,
}: {
  draft: BannerDraft;
  onChange: (patch: Partial<BannerDraft>) => void;
  uploadingField: "desktop_image" | "mobile_image" | null;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>, field: "desktop_image" | "mobile_image", onChange: (patch: Partial<BannerDraft>) => void) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2">
        <Label>Nome interno</Label>
        <Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Banner principal home" required minLength={3} />
      </div>
      <div className="grid gap-2">
        <Label>Posição</Label>
        <Input value={draft.placement} onChange={(event) => onChange({ placement: event.target.value })} placeholder="home_hero" />
      </div>
      <div className="grid gap-2">
        <Label>Título exibido</Label>
        <Input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Prioridade</Label>
        <Input type="number" value={draft.priority} onChange={(event) => onChange({ priority: event.target.value })} />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label>Subtítulo/descrição</Label>
        <Textarea value={draft.subtitle} onChange={(event) => onChange({ subtitle: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Imagem desktop</Label>
        <Input value={draft.desktop_image} onChange={(event) => onChange({ desktop_image: event.target.value })} placeholder="/images/gamel/banners/... ou envie um arquivo" />
        {draft.desktop_image ? <img src={draft.desktop_image} alt="" className="h-16 w-auto rounded border object-cover" /> : null}
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
          {uploadingField === "desktop_image" ? "Enviando..." : "Enviar imagem (JPG/PNG/WEBP, até 5MB)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingField !== null} onChange={(event) => onUploadImage(event, "desktop_image", onChange)} />
        </label>
      </div>
      <div className="grid gap-2">
        <Label>Imagem mobile</Label>
        <Input value={draft.mobile_image} onChange={(event) => onChange({ mobile_image: event.target.value })} placeholder="/images/gamel/banners/... ou envie um arquivo" />
        {draft.mobile_image ? <img src={draft.mobile_image} alt="" className="h-16 w-auto rounded border object-cover" /> : null}
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
          {uploadingField === "mobile_image" ? "Enviando..." : "Enviar imagem (JPG/PNG/WEBP, até 5MB)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingField !== null} onChange={(event) => onUploadImage(event, "mobile_image", onChange)} />
        </label>
      </div>
      <div className="grid gap-2">
        <Label>Início do agendamento (opcional)</Label>
        <Input type="datetime-local" value={draft.starts_at} onChange={(event) => onChange({ starts_at: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Fim do agendamento (opcional)</Label>
        <Input type="datetime-local" value={draft.ends_at} onChange={(event) => onChange({ ends_at: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Texto do CTA</Label>
        <Input value={draft.cta_label} onChange={(event) => onChange({ cta_label: event.target.value })} placeholder="Ver produtos" />
      </div>
      <div className="grid gap-2">
        <Label>Link do CTA</Label>
        <Input value={draft.cta_url} onChange={(event) => onChange({ cta_url: event.target.value })} placeholder="/produtos" />
      </div>
      <div className="grid gap-2">
        <Label>Texto alternativo (acessibilidade)</Label>
        <Input value={draft.alt_text} onChange={(event) => onChange({ alt_text: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={draft.status} onValueChange={(value) => onChange({ status: value as BannerStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(statusLabels) as BannerStatus[]).map((status) => (
              <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
