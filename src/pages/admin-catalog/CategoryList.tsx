import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CategoryHealth } from "./types";

export function CategoryList({
  categoryHealth,
  saving,
  onMoveCategory,
  onToggleCategory,
}: {
  categoryHealth: CategoryHealth[];
  saving: boolean;
  onMoveCategory: (category: CategoryHealth, direction: "up" | "down") => void;
  onToggleCategory: (category: CategoryHealth) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-semibold">Categorias cadastradas ({categoryHealth.length}) — use as setas para definir a ordem de exibição no site</p>
      {categoryHealth.map((category, index) => (
        <div key={category.id} className={`rounded-lg border p-4 ${category.empty ? "border-amber-300 bg-amber-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-0.5">
                <Button size="icon" variant="outline" className="h-6 w-6" disabled={saving || index === 0} onClick={() => onMoveCategory(category, "up")} aria-label={`Mover ${category.name} para cima`}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="outline" className="h-6 w-6" disabled={saving || index === categoryHealth.length - 1} onClick={() => onMoveCategory(category, "down")} aria-label={`Mover ${category.name} para baixo`}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <div>
                <p className="font-semibold">{category.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">/{category.slug} - {category.productCount} produto(s), {category.activeProductCount} ativo(s)</p>
              </div>
            </div>
            <Switch checked={category.is_active} onCheckedChange={() => onToggleCategory(category)} disabled={saving} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {category.empty ? <Badge variant="outline">sem produto</Badge> : null}
            {category.productsWithoutImage > 0 ? <Badge variant="outline">{category.productsWithoutImage} sem imagem</Badge> : null}
            {!category.description ? <Badge variant="outline">sem descricao</Badge> : null}
            {!category.image_url ? <Badge variant="outline">sem imagem categoria</Badge> : null}
            {!category.empty && category.productsWithoutImage === 0 && category.description ? <Badge>ok</Badge> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
