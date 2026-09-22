import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

const ROUTINE_ITEMS = [
  "Confirmar nome, slug e categoria oficial.",
  "Validar descrição curta, descrição completa e aplicação.",
  "Garantir capa da categoria e produtos vinculados.",
  "Manter CTA em orçamento ou WhatsApp.",
];

export function RoutineSection() {
  return (
    <WorkspaceSection title="Rotina de conferencia comercial">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROUTINE_ITEMS.map((item) => (
          <div key={item} className="rounded-lg border p-4 text-sm text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </WorkspaceSection>
  );
}
