import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryDraft } from "./types";

export function CategoryForm({
  categoryDraft,
  onCategoryDraftChange,
  saving,
  onSubmit,
}: {
  categoryDraft: CategoryDraft;
  onCategoryDraftChange: (updater: (current: CategoryDraft) => CategoryDraft) => void;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-3 rounded-lg border p-4" onSubmit={onSubmit}>
      <div>
        <p className="font-semibold">Nova categoria</p>
        <p className="mt-1 text-xs text-muted-foreground">Slug e auditoria sao gerados automaticamente no backend.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category-name">Nome</Label>
        <Input id="category-name" value={categoryDraft.name} onChange={(event) => onCategoryDraftChange((current) => ({ ...current, name: event.target.value }))} required minLength={3} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category-description">Descricao SEO/comercial</Label>
        <Textarea id="category-description" value={categoryDraft.description} onChange={(event) => onCategoryDraftChange((current) => ({ ...current, description: event.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category-image">Imagem</Label>
        <Input id="category-image" value={categoryDraft.image_url} onChange={(event) => onCategoryDraftChange((current) => ({ ...current, image_url: event.target.value }))} placeholder="/assets/catalog/gamel-phase1/categoria-ripados.png" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category-icon">Icone curto</Label>
        <Input id="category-icon" value={categoryDraft.icon} onChange={(event) => onCategoryDraftChange((current) => ({ ...current, icon: event.target.value.slice(0, 3) }))} placeholder="PVC" />
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <span className="text-sm font-medium">Ativa</span>
        <Switch checked={categoryDraft.is_active} onCheckedChange={(checked) => onCategoryDraftChange((current) => ({ ...current, is_active: checked }))} />
      </div>
      <Button className="w-full" type="submit" disabled={saving}>Criar categoria</Button>
    </form>
  );
}
