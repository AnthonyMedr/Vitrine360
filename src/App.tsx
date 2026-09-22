import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QuoteCartProvider } from "@/contexts/QuoteCartContext";
import { CatalogProvider } from "@/data/catalog";
import { initializeUTMTracking } from "@/data/events/utmTracking";
import { CookieConsent } from "@/components/CookieConsent";
import { MarketingIntegrations } from "@/components/MarketingIntegrations";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { SEO_DEFAULTS, STORE_INFO } from "@/constants/store";
import { setMetaContent } from "@/lib/seoMeta";
const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Quote = lazy(() => import("./pages/Quote"));
const BusinessSales = lazy(() => import("./pages/BusinessSales"));
const FutureEcommerce = lazy(() => import("./pages/FutureEcommerce"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminHome = lazy(() => import("./pages/AdminHome"));
const AdminCatalogWorkspace = lazy(() => import("./pages/AdminCatalogWorkspace"));
const AdminProductsWorkspace = lazy(() => import("./pages/AdminProductsWorkspace"));
const AdminMediaLibrary = lazy(() => import("./pages/AdminMediaLibrary"));
const AdminProductDetail = lazy(() => import("./pages/AdminProductDetail"));
const AdminProductCreate = lazy(() => import("./pages/AdminProductCreate"));
const AdminGovernanceWorkspace = lazy(() => import("./pages/AdminGovernanceWorkspace"));
const AdminAuditTimeline = lazy(() => import("./pages/AdminAuditTimeline"));
const AdminBannersShowcases = lazy(() => import("./pages/AdminBannersShowcases"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminQuoteRequests = lazy(() => import("./pages/AdminQuoteRequests"));
const AdminQuoteRequestDetail = lazy(() => import("./pages/AdminQuoteRequestDetail"));
const AdminDocumentation = lazy(() => import("./pages/AdminDocumentation"));
const AdminRbacSimulator = lazy(() => import("./pages/AdminRbacSimulator"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminOperations = lazy(() => import("./pages/AdminOperations"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Policies = lazy(() => import("./pages/Policies"));
const Faq = lazy(() => import("./pages/Faq"));
const NotFound = lazy(() => import("./pages/NotFound"));

const authEnabled = FEATURE_FLAGS.admin || FEATURE_FLAGS.customerAccount;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type RouteSeoConfig = {
  title: string;
  description: string;
};

const routeSeo: Record<string, RouteSeoConfig> = {
  "/": {
    title: "GAMEL - Catálogo Digital de Acabamentos",
    description:
      "Conheça a GAMEL em Garanhuns/PE. Tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC com atendimento comercial.",
  },
  "/produtos": {
    title: "Catálogo GAMEL - Produtos para Obras e Acabamentos",
    description:
      "Veja o catálogo GAMEL de tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC.",
  },
  "/busca": {
    title: "Busca no Catálogo - GAMEL Metal",
    description:
      "Busque produtos no catálogo GAMEL e fale com a equipe comercial.",
  },
  "/categorias": {
    title: "Categorias GAMEL - Catálogo de Produtos",
    description:
      "Navegue pelas categorias oficiais da GAMEL para obras, reformas e acabamentos.",
  },
  "/orcamento": {
    title: "Solicitar Orçamento - GAMEL Metal",
    description:
      "Envie sua lista à GAMEL. Informe produto, quantidade e cidade para receber atendimento comercial.",
  },
  "/vendas-para-empresas": {
    title: "Soluções para Empresas - GAMEL",
    description: "Cotação B2B GAMEL para construtoras, revendas, instaladores, arquitetos e empresas.",
  },
  "/sobre": {
    title: "Quem Somos - GAMEL",
    description:
      "Conheça a GAMEL em Garanhuns/PE, especializada em materiais para obras e acabamentos.",
  },
  "/contato": {
    title: "Contato - GAMEL",
    description:
      "Fale com a GAMEL por WhatsApp, telefone ou e-mail para atendimento comercial.",
  },
  "/politicas": {
    title: "Política de Privacidade - GAMEL",
    description:
      "Entenda como a GAMEL trata os dados enviados em formulários, WhatsApp e canais de atendimento.",
  },
  "/faq": {
    title: "Perguntas Frequentes - GAMEL",
    description:
      "Tire suas dúvidas sobre pedidos, prazos, entrega e atendimento comercial da GAMEL.",
  },
  "/ofertas": {
    title: "Ofertas - Catálogo GAMEL",
    description:
      "Confira os produtos em destaque e condições especiais do catálogo GAMEL.",
  },
};

const formatSlug = (slug = "") =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getSeoForPath = (pathname: string): RouteSeoConfig => {
  if (routeSeo[pathname]) {
    return routeSeo[pathname];
  }

  if (pathname.startsWith("/categoria/")) {
    const categoryName = formatSlug(pathname.replace("/categoria/", ""));
    return {
      title: `${categoryName || "Categoria"} - Catálogo GAMEL`,
      description: `Conheça produtos da categoria ${categoryName || "selecionada"} no catálogo GAMEL e fale com a equipe comercial.`,
    };
  }

  if (pathname.startsWith("/produto/")) {
    const productName = formatSlug(pathname.replace("/produto/", ""));
    return {
      title: `${productName || "Produto"} - GAMEL`,
      description: `Veja informações do produto ${productName || "selecionado"} no catálogo GAMEL e fale com a equipe comercial.`,
    };
  }

  return {
    title: SEO_DEFAULTS.title,
    description: SEO_DEFAULTS.description,
  };
};

const RouteSeoManager = () => {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    const canonicalUrl = `${STORE_INFO.baseUrl}${location.pathname}`;
    const defaultImageUrl = `${STORE_INFO.baseUrl}${SEO_DEFAULTS.image}`;

    document.title = seo.title;
    setMetaContent('meta[name="description"]', seo.description);
    setMetaContent('meta[property="og:title"]', seo.title, "property");
    setMetaContent('meta[property="og:description"]', seo.description, "property");
    setMetaContent('meta[property="og:url"]', canonicalUrl, "property");
    setMetaContent('meta[name="twitter:title"]', seo.title);
    setMetaContent('meta[name="twitter:description"]', seo.description);
    // Reseta para a imagem padrao a cada navegacao - paginas com imagem propria (ex: produto)
    // sobrescrevem depois, no proprio efeito da pagina, que roda em seguida.
    setMetaContent('meta[property="og:image"]', defaultImageUrl, "property");
    setMetaContent('meta[name="twitter:image"]', defaultImageUrl);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
  }, [location.pathname]);

  return null;
};

const RouteFallback = () => (
  <div className="min-h-screen bg-muted/35">
    <div className="shell-home flex min-h-screen items-center justify-center py-12">
      <div className="surface-panel flex w-full max-w-lg items-center gap-4 rounded-xl px-5 py-5" role="status" aria-live="polite">
        <div className="gradient-dark flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-card">
          GM
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Carregando</p>
          <p className="mt-1 font-display text-xl font-bold text-foreground md:text-2xl">Preparando a próxima tela</p>
          <p className="mt-1 text-sm text-muted-foreground">Mantendo catálogo, orçamento e painel em cache para navegar mais rapido.</p>
        </div>
      </div>
    </div>
  </div>
);

const RouteScrollManager = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      window.setTimeout(() => {
        const id = decodeURIComponent(location.hash.slice(1));
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      }, 0);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.hash, location.pathname, location.search]);

  return null;
};

// Initialize UTM tracking on app load
initializeUTMTracking();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CatalogProvider>
        <QuoteCartProvider>
            <MarketingIntegrations />
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <RouteScrollManager />
            <RouteSeoManager />
            <CookieConsent />
            <RouteErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/produtos" element={<Products />} />
                  <Route path="/busca" element={<Products />} />
                  <Route path="/produto/:slug" element={<ProductDetail />} />
                  <Route path="/orcamento" element={<Quote />} />
                  <Route path="/aplicacoes" element={<Navigate to="/produtos" replace />} />
                  <Route path="/carrinho" element={<FutureEcommerce />} />
                  <Route path="/checkout" element={<FutureEcommerce />} />
                  <Route path="/checkout/endereco" element={<FutureEcommerce />} />
                  <Route path="/checkout/entrega" element={<FutureEcommerce />} />
                  <Route path="/checkout/pagamento" element={<FutureEcommerce />} />
                  <Route path="/checkout/confirmação" element={<FutureEcommerce />} />
                  <Route path="/checkout/sucesso" element={<FutureEcommerce />} />
                  <Route path="/pedido-confirmado" element={<FutureEcommerce />} />
                  <Route path="/auth" element={authEnabled ? <Auth /> : <FutureEcommerce />} />
                  <Route path="/meus-pedidos" element={<FutureEcommerce />} />
                  <Route path="/minha-conta" element={<FutureEcommerce />} />
                  <Route path="/conta" element={<FutureEcommerce />} />
                  <Route path="/conta/pedidos" element={<FutureEcommerce />} />
                  <Route path="/conta/dados" element={<FutureEcommerce />} />
                  <Route path="/conta/enderecos" element={<FutureEcommerce />} />
                  <Route path="/conta/favoritos" element={<FutureEcommerce />} />
                  <Route path="/conta/pedido/:id" element={<FutureEcommerce />} />
                  <Route path="/admin" element={<AdminHome />} />
                  <Route path="/admin/operação" element={<AdminOperations />} />
                  <Route path="/admin/catalogo" element={<AdminCatalogWorkspace />} />
                  <Route path="/admin/produtos" element={<AdminProductsWorkspace />} />
                  <Route path="/admin/midia" element={<AdminMediaLibrary />} />
                  <Route path="/admin/clientes-suporte" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/governanca" element={<AdminGovernanceWorkspace />} />
                  <Route path="/admin/audit-logs" element={<AdminAuditTimeline />} />
                  <Route path="/admin/marketing" element={<Navigate to="/admin/banners-vitrines" replace />} />
                  <Route path="/admin/integrações" element={<Navigate to="/admin/configuracoes" replace />} />
                  <Route path="/admin/configuracoes/integrações" element={<Navigate to="/admin/configuracoes" replace />} />
                  <Route path="/admin/usuarios" element={<AdminUsers />} />
                  <Route path="/admin/rbac-simulador" element={<AdminRbacSimulator />} />
                  <Route path="/admin/relatorios" element={<AdminReports />} />
                  <Route path="/admin/orçamentos" element={<AdminQuoteRequests />} />
                  <Route path="/admin/orçamentos/:id" element={<AdminQuoteRequestDetail />} />
                  <Route path="/admin/documentacao" element={<AdminDocumentation />} />
                  <Route path="/admin/campanhas" element={<Navigate to="/admin/banners-vitrines" replace />} />
                  <Route path="/admin/banners-vitrines" element={<AdminBannersShowcases />} />
                  <Route path="/admin/segurança" element={<AdminSecurity />} />
                  <Route path="/admin/configuracoes" element={<AdminSettings />} />
                  <Route path="/admin/venda-assistida" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/gestao" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/alertas" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/produto/novo" element={<AdminProductCreate />} />
                  <Route path="/admin/produto/:id" element={<AdminProductDetail />} />
                  <Route path="/admin/atendimento/ticket/:id" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/atendimento/devolucao/:id" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/categorias" element={<Navigate to="/admin/catalogo" replace />} />
                  <Route path="/admin/marcas" element={<Navigate to="/admin/catalogo" replace />} />
                  <Route path="/admin/lojas" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/estoque" element={<Navigate to="/admin/catalogo" replace />} />
                  <Route path="/admin/vendedores" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/clientes" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/leads" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/conteudo" element={<Navigate to="/admin/banners-vitrines" replace />} />
                  <Route path="/admin/permissões" element={<Navigate to="/admin/usuarios" replace />} />
                  <Route path="/admin/users" element={<Navigate to="/admin/usuarios" replace />} />
                  <Route path="/admin/roles" element={<Navigate to="/admin/usuarios" replace />} />
                  <Route path="/admin/atendimento" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/fase-1" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/executivo" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/hoje" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/tarefas" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/kanban" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/cockpit" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/score-gerencial" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/relatorios-gerenciais" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/meu-workspace" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/readiness" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/go-live" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/pedidos" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/wms" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/fiscal-financeiro" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/temas" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/cupons-promocoes" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/frete-entrega" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/pagamentos" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/financeiro" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/pedido/:id" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/fiscal/perfil/:id" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/fiscal/documento/:id" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/admin/carrinhos-abandonados" element={<Navigate to="/admin/operação" replace />} />
                  <Route path="/login" element={authEnabled ? <Navigate to="/auth" replace /> : <FutureEcommerce />} />
                  <Route path="/rastrear" element={<FutureEcommerce />} />
                  <Route path="/sobre" element={<About />} />
                  <Route path="/entrega" element={<FutureEcommerce />} />
                  <Route path="/contato" element={<Contact />} />
                  <Route path="/politicas" element={<Policies />} />
                  <Route path="/faq" element={<Faq />} />
                  <Route path="/formas-pagamento" element={<FutureEcommerce />} />
                  <Route path="/vendas-para-empresas" element={<BusinessSales />} />
                  <Route path="/campanhas/:slug" element={<FutureEcommerce />} />
                  <Route path="/status-pedido" element={<FutureEcommerce />} />
                  <Route path="/categorias" element={<Products />} />
                  <Route path="/categoria/:slug" element={<Products />} />
                  <Route path="/ofertas" element={<Products />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
            </BrowserRouter>
        </QuoteCartProvider>
      </CatalogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
