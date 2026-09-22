import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminEmptyState } from "@/components/admin/AdminPrimitives";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";
import type { InstitutionalPage } from "./types";

export function InstitutionalContentSection({
  quemSomosPage,
  quemSomosValue,
  onChange,
  onSave,
  saving,
  hasDraft,
}: {
  quemSomosPage: InstitutionalPage | null;
  quemSomosValue: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  hasDraft: boolean;
}) {
  return (
    <WorkspaceSection title="Conteúdo institucional (piloto: Quem Somos)">
      {quemSomosPage ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Texto de abertura exibido na página "Quem Somos" do site, logo abaixo do título principal. Demais seções da página (pilares, valores) continuam fixas.
          </p>
          <Textarea
            value={quemSomosValue}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-32"
          />
          <Button onClick={onSave} disabled={saving || !hasDraft}>Salvar texto</Button>
        </div>
      ) : (
        <AdminEmptyState title="Página institucional não encontrada." description="A página 'quem_somos' não existe na base de conteúdo." />
      )}
    </WorkspaceSection>
  );
}
