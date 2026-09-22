import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Home, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Route rendering failed", error, errorInfo);
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_28%),linear-gradient(180deg,hsl(var(--muted)/0.38),hsl(var(--background))_62%)]">
        <div className="shell-home flex min-h-screen items-center justify-center py-16">
          <div className="surface-panel w-full max-w-2xl rounded-[2rem] px-7 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Falha de navegação</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Essa pagina encontrou um erro inesperado</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              A central GAMEL continua ativa, mas está tela precisa ser recarregada. Se o erro continuar, volte para o inicio do Admin e siga pela rota principal da Fase 1.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recarregar pagina
              </Button>
              <Button asChild variant="outline">
                <Link to="/">
                  <Home className="mr-2 h-4 w-4" />
                  Voltar para a home
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/produtos">
                  <Search className="mr-2 h-4 w-4" />
                  Ir para o catalogo
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
