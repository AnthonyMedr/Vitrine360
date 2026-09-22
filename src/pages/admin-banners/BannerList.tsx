import type { ChangeEvent } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminEmptyState } from "@/components/admin/AdminPrimitives";
import { statusLabels, formatDateTime } from "./bannersHelpers";
import { BannerDraftForm } from "./BannerDraftForm";
import type { Banner, BannerDraft } from "./types";

export function BannerList({
  banners,
  editingId,
  editDraft,
  savingId,
  uploadingField,
  onUploadImage,
  onStartEdit,
  onCloseEdit,
  onEditDraftChange,
  onSaveEdit,
  onMovePriority,
  onToggleActive,
  onDelete,
}: {
  banners: Banner[];
  editingId: string | null;
  editDraft: BannerDraft;
  savingId: string | null;
  uploadingField: "desktop_image" | "mobile_image" | null;
  onUploadImage: (event: ChangeEvent<HTMLInputElement>, field: "desktop_image" | "mobile_image", onChange: (patch: Partial<BannerDraft>) => void) => void;
  onStartEdit: (banner: Banner) => void;
  onCloseEdit: () => void;
  onEditDraftChange: (patch: Partial<BannerDraft>) => void;
  onSaveEdit: (id: string) => void;
  onMovePriority: (banner: Banner, direction: "up" | "down") => void;
  onToggleActive: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
}) {
  return (
    <div className="space-y-3">
      {banners.map((banner) => (
        <div key={banner.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{banner.name}</p>
                <Badge variant={banner.status === "active" ? "default" : "outline"}>{statusLabels[banner.status]}</Badge>
                <Badge variant="secondary">{banner.placement}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Atualizado em {formatDateTime(banner.updated_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" disabled={savingId === banner.id} onClick={() => onMovePriority(banner, "up")} aria-label={`Aumentar prioridade de ${banner.name}`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" disabled={savingId === banner.id} onClick={() => onMovePriority(banner, "down")} aria-label={`Diminuir prioridade de ${banner.name}`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => (editingId === banner.id ? onCloseEdit() : onStartEdit(banner))}>
                {editingId === banner.id ? "Fechar" : "Editar"}
              </Button>
              {banner.status === "active" || banner.status === "paused" ? (
                <Button size="sm" variant="outline" disabled={savingId === banner.id} onClick={() => onToggleActive(banner)}>
                  {banner.status === "active" ? "Pausar" : "Ativar"}
                </Button>
              ) : null}
              <Button size="sm" variant="destructive" disabled={savingId === banner.id} onClick={() => onDelete(banner)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          </div>

          {editingId === banner.id ? (
            <div className="mt-4 border-t pt-4">
              <BannerDraftForm draft={editDraft} onChange={onEditDraftChange} uploadingField={uploadingField} onUploadImage={onUploadImage} />
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onSaveEdit(banner.id)} disabled={savingId === banner.id}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={onCloseEdit} disabled={savingId === banner.id}>Cancelar</Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      {banners.length === 0 ? (
        <AdminEmptyState title="Nenhum banner cadastrado ainda." description="Crie o primeiro banner acima." />
      ) : null}
    </div>
  );
}
