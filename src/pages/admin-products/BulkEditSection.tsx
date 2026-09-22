import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminEmptyState } from "@/components/admin/AdminPrimitives";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { LocalProduct } from "@/lib/localCommerce";

export function BulkEditSection({
  bulkEditQuery,
  onBulkEditQueryChange,
  filteredProducts,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  categories,
  categoryId,
  onCategoryIdChange,
  status,
  onStatusChange,
  active,
  onActiveChange,
  applying,
  onApply,
}: {
  bulkEditQuery: string;
  onBulkEditQueryChange: (value: string) => void;
  filteredProducts: LocalProduct[];
  selectedIds: string[];
  onToggleSelection: (productId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  categories: Array<{ id: string; name: string; is_active: boolean }>;
  categoryId: string;
  onCategoryIdChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  active: string;
  onActiveChange: (value: string) => void;
  applying: boolean;
  onApply: () => void;
}) {
  return (
    <WorkspaceSection title="Edição em lote">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={bulkEditQuery}
            onChange={(event) => onBulkEditQueryChange(event.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="max-w-xs"
          />
          <span className="text-sm text-muted-foreground">{selectedIds.length} selecionado(s) de {filteredProducts.length}</span>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select value={categoryId} onValueChange={onCategoryIdChange}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep__">Não alterar</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep__">Não alterar</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Visível no site</label>
            <Select value={active} onValueChange={onActiveChange}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep__">Não alterar</SelectItem>
                <SelectItem value="true">Ativo (visível)</SelectItem>
                <SelectItem value="false">Inativo (oculto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={selectedIds.length === 0 || applying} onClick={onApply}>
            {applying ? "Aplicando..." : `Aplicar a ${selectedIds.length}`}
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-10 p-2">
                  <Checkbox
                    checked={filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id))}
                    onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  />
                </th>
                <th className="p-2">Produto</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Categoria</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 200).map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="p-2"><Checkbox checked={selectedIds.includes(product.id)} onCheckedChange={(checked) => onToggleSelection(product.id, Boolean(checked))} /></td>
                  <td className="p-2"><Link className="hover:underline" to={`/admin/produto/${product.id}`}>{product.name}</Link></td>
                  <td className="p-2 text-muted-foreground">{product.sku || "-"}</td>
                  <td className="p-2 text-muted-foreground">{product.category?.name || "Sem categoria"}</td>
                  <td className="p-2"><Badge variant={product.is_active ? "default" : "outline"}>{product.status_product || (product.is_active ? "active" : "inactive")}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 ? <AdminEmptyState title="Nenhum produto encontrado." description="Ajuste a busca acima." /> : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}
