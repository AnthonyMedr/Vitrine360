import { Link } from "react-router-dom";
import { Image, MessageSquareText, PackageSearch, ShieldCheck } from "lucide-react";
import { WorkspaceSection } from "@/components/admin/AdminWorkspaceShell";

function RoutineCard({ icon: Icon, title, description, href }: { icon: typeof PackageSearch; title: string; description: string; href: string }) {
  return (
    <Link to={href} className="rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function RoutineSection() {
  return (
    <WorkspaceSection title="Rotina para manter o site pronto">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RoutineCard
          icon={PackageSearch}
          title="Produtos"
          description="Cadastro, descrição, medidas, aplicações e destaque no catálogo."
          href="/admin/produtos"
        />
        <RoutineCard
          icon={Image}
          title="Midia"
          description="Fotos de produtos, banners, aplicações e imagens institucionais."
          href="/admin/midia"
        />
        <RoutineCard
          icon={MessageSquareText}
          title="Banners e conteúdo"
          description="Hero, vitrines, campanhas e chamadas comerciais da home."
          href="/admin/banners-vitrines"
        />
        <RoutineCard
          icon={ShieldCheck}
          title="Go-live"
          description="Checklist de ambiente, dominio, LGPD, equipe e pendencias externas."
          href="/admin/go-live"
        />
      </div>
    </WorkspaceSection>
  );
}
