import { Link } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

export default function FutureEcommerce() {
  return (
    <Layout>
      <main className="shell-reading py-16">
        <div className="rounded-lg border border-border/80 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Fase futura</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-foreground">E-commerce em preparacao</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Está funcionalidade faz parte da fase futura de e-commerce da GAMEL. Para comprar ou solicitar produtos neste momento, utilize o orcamento online com atendimento comercial.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/orcamento">
                Solicitar orcamento
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/produtos">Ver catalogo</Link>
            </Button>
          </div>
        </div>
      </main>
    </Layout>
  );
}
