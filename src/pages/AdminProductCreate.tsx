import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminCapabilities } from "@/hooks/useAdminCapabilities";
import { useAdminResource } from "@/hooks/useAdminResource";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AdminLoadingState } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";

type Draft = {
  name: string;
  sku: string;
  category_id: string;
  brand_id: string;
  price: string;
  short_description: string;
};

const emptyDraft: Draft = {
  name: "",
  sku: "",
  category_id: "",
  brand_id: "",
  price: "",
  short_description: "",
};

export default function AdminProductCreate() {
  const { isAdmin, loading } = useAdmin();
  const capabilities = useAdminCapabilities();
  const { toast } = useToast();
  const navigate = useNavigate();
  const categories = useAdminResource<Array<{ id: string; name: string; is_active: boolean }>>(isAdmin ? "/api/admin/categories" : null, []);
  const brands = useAdminResource<Array<{ id: string; name: string; is_active: boolean }>>(isAdmin ? "/api/admin/brands" : null, []);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  if (loading) return <AdminLoadingState label="Carregando..." />;
  if (!isAdmin) return <Navigate to="/auth" replace />;
  if (!capabilities.canAny(["catalog.create"])) {
    return (
      <AdminWorkspaceShell title="Sem permissão" eyebrow="Produtos">
        <p className="text-sm text-muted-foreground">Seu perfil não pode criar produtos novos.</p>
      </AdminWorkspaceShell>
    );
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const priceValue = Number(draft.price.replace(",", "."));
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast({ title: "Preço inválido", description: "Informe um preço válido para continuar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<{ id: string }>("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name.trim(),
          sku: draft.sku.trim() || undefined,
          category_id: draft.category_id || null,
          brand_id: draft.brand_id || null,
          price: priceValue,
          short_description: draft.short_description.trim() || undefined,
          is_active: false,
        }),
      });
      toast({ title: "Produto criado", description: "Continue o cadastro: imagens, especificações e publicação." });
      navigate(`/admin/produto/${created.id}`);
    } catch (error) {
      toast({ title: "Falha ao criar produto", description: error instanceof Error ? error.message : "Revise os campos.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspaceShell
      eyebrow="Catálogo"
      title="Novo produto"
      description="Cadastro mínimo para criar o produto. Imagens, especificações técnicas, SEO e publicação são preenchidos na tela de edição em seguida."
    >
      <form onSubmit={createProduct} className="max-w-2xl space-y-4 rounded-lg border bg-background p-6">
        <div className="grid gap-2">
          <Label htmlFor="new-product-name">Nome do produto *</Label>
          <Input id="new-product-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required minLength={3} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="new-product-sku">SKU (opcional)</Label>
            <Input id="new-product-sku" value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))} placeholder="Gerado automaticamente se vazio" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-product-price">Preço *</Label>
            <Input id="new-product-price" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder="0,00" inputMode="decimal" required />
          </div>
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select value={draft.category_id || "none"} onValueChange={(value) => setDraft((current) => ({ ...current, category_id: value === "none" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.data.filter((category) => category.is_active).map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Marca</Label>
            <Select value={draft.brand_id || "none"} onValueChange={(value) => setDraft((current) => ({ ...current, brand_id: value === "none" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem marca</SelectItem>
                {brands.data.filter((brand) => brand.is_active).map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-product-description">Descrição curta</Label>
          <Textarea id="new-product-description" value={draft.short_description} onChange={(event) => setDraft((current) => ({ ...current, short_description: event.target.value }))} />
        </div>
        <p className="text-xs text-muted-foreground">O produto começa inativo (rascunho) — você publica depois de completar imagem e cadastro na tela de edição.</p>
        <Button type="submit" disabled={saving || !draft.name.trim() || !draft.price.trim()}>Criar e continuar cadastro</Button>
      </form>
    </AdminWorkspaceShell>
  );
}
