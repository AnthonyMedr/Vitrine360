import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

export function CatalogModelSection() {
  return (
    <WorkspaceSection title="Modelo de gestao do catálogo GAMEL">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cadastro minimo</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Nome comercial, SKU, categoria oficial e subcategoria.</li>
            <li>Descricao curta, descricao longa, aplicacoes e especificacoes.</li>
            <li>Unidade de consulta: peca, chapa, barra, caixa, kit, metro linear ou metro quadrado.</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imagem do produto</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Imagem principal limpa, sem marca d'agua e coerente com cor/acabamento.</li>
            <li>Alt text com produto, categoria e aplicação.</li>
            <li>Status manual_review até aprovacao humana para home ou campanha.</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publicação</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Produto ativo apenas com categoria, aplicação, imagem e descrição revisadas.</li>
            <li>Destaque de home exige imagem aprovada e texto comercial completo.</li>
            <li>Todo CTA deve levar para orçamento, interesse comercial ou WhatsApp.</li>
          </ul>
        </div>
      </div>
    </WorkspaceSection>
  );
}
