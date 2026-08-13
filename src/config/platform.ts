export type PlatformExperienceKey =
  | "site-publico"
  | "totem"
  | "representante"
  | "backoffice"
  | "inteligencia";

export type PlatformExperience = {
  key: PlatformExperienceKey;
  title: string;
  shortTitle: string;
  route: string;
  domainPath: string;
  audience: string;
  description: string;
  modules: string[];
};

export const platformExperiences: PlatformExperience[] = [
  {
    key: "site-publico",
    title: "Site publico",
    shortTitle: "Site",
    route: "/",
    domainPath: "gamelmetal.com",
    audience: "Clientes finais, arquitetos, instaladores e compradores",
    description:
      "Institucional, catalogo, produtos, ambientes, calculadoras e carrinho de cotacao.",
    modules: [
      "Institucional",
      "Catalogo",
      "Produtos",
      "Ambientes",
      "Calculadoras",
      "Carrinho de cotacao",
    ],
  },
  {
    key: "totem",
    title: "Modo Totem GAMEL",
    shortTitle: "Totem",
    route: "/totem",
    domainPath: "gamelmetal.com/totem",
    audience: "Showroom, loja, feiras e atendimento presencial",
    description:
      "Interface touch com catalogo visual, campanhas, ambientes, calculadoras, QR Code e metricas.",
    modules: [
      "Catalogo touch",
      "Produtos em destaque",
      "Ambientes",
      "Campanhas",
      "Calculadoras",
      "Envio para celular",
    ],
  },
  {
    key: "representante",
    title: "Portal do Representante",
    shortTitle: "Representante",
    route: "/representante",
    domainPath: "gamelmetal.com/representante",
    audience: "Representantes comerciais e equipes externas",
    description:
      "Clientes, precos, condicoes comerciais, cotacoes, pedidos e comissoes em uma rotina guiada.",
    modules: ["Clientes", "Precos", "Condicoes", "Cotacoes", "Pedidos", "Comissoes"],
  },
  {
    key: "backoffice",
    title: "Backoffice GAMEL",
    shortTitle: "Admin",
    route: "/admin",
    domainPath: "gamelmetal.com/admin",
    audience: "Operacao interna, comercial, marketing e financeiro",
    description:
      "Triagem, validacao, aprovacao, faturamento, entrega e gestao do conteudo digital.",
    modules: [
      "Produtos",
      "Conteudos",
      "Totens",
      "Representantes",
      "Clientes",
      "Precos",
      "Relatorios",
    ],
  },
  {
    key: "inteligencia",
    title: "Inteligencia Comercial",
    shortTitle: "Inteligencia",
    route: "/admin/relatorios",
    domainPath: "gamelmetal.com/admin/relatorios",
    audience: "Diretoria, gestores comerciais e marketing",
    description:
      "Leitura de produtos, representantes, cidades, estados, conversoes, vendas e oportunidades.",
    modules: ["Produtos", "Representantes", "Cidades", "Estados", "Conversoes", "Vendas"],
  },
];

export function getPlatformExperience(key: PlatformExperienceKey) {
  return platformExperiences.find((experience) => experience.key === key);
}
