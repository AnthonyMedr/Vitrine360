import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  useEffect(() => {
    document.title = "Página não encontrada - GAMEL";
  }, []);

  return (
    <Layout>
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <div className="text-8xl font-bold text-primary">404</div>
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Desculpe, a página que você está procurando não existe ou foi removida.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/produtos">
              <Search className="mr-2 h-4 w-4" />
              Ver Produtos
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
