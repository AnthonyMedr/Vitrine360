export const gamelStoreInfo = {
  name: "GAMEL Metal",
  tagline: "GAMEL Distribuidora - Garanhuns/PE",
  slogan:
    "Solucoes em acabamentos, construcao, comunicacao visual e materiais para obras, reformas e projetos comerciais com catalogo digital e atendimento especializado.",
  description:
    "Acabamentos, coberturas e materiais para obras com atendimento comercial em Garanhuns/PE",
  domain: "www.gamelmetal.com",
  whatsapp: "5587981818752",
  whatsappDisplay: "(87) 98181-8752",
  phone: "(87) 98181-8752 / (87) 98157-3939 / (87) 92000-8304",
  email: "comercial@gamelmetal.com",
  address:
    "Rua Vereador Paulo Francisco Gomes, s/n, Lote Serra Branca, Quadra II, Lote 7, Magano, Garanhuns/PE, CEP 55294-770",
};

export const gamelWhatsAppMessages = {
  default: "Ola! Vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.",
  about: "Ola! Vim pelo site da GAMEL Metal. Gostaria de saber mais sobre a empresa.",
  contact: "Ola! Vim pelo site da GAMEL Metal. Gostaria de mais informacoes.",
  product: (productName: string) =>
    `Ola! Vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.\n\nProduto: ${productName}\nQuantidade aproximada:\nNome:\nCidade:`,
};

export const gamelHeroSlides = [
  {
    eyebrow: "Catalogo inteligente GAMEL",
    title: "Acabamentos e materiais para obras com atendimento comercial especializado.",
    text: "Consulte ripados, chapas, forros, pisos, telhas, ACM, aluminio e drywall em um catalogo preparado para orcamento assistido.",
    image: "/images/gamel/banners/banner-home-catalogo-gamel.png",
    alt: "Showroom moderno de acabamentos e materiais GAMEL.",
    cta: "Ver produtos",
    href: "/produtos",
  },
  {
    eyebrow: "Orcamento online",
    title: "Envie sua lista de materiais e receba retorno da equipe GAMEL.",
    text: "O site organiza produto, quantidade, cidade e contato para acelerar a resposta comercial sem prometer preco automatico nesta fase.",
    image: "/images/gamel/banners/banner-home-orcamento-gamel.png",
    alt: "Mesa de atendimento comercial com amostras de materiais e orcamento GAMEL.",
    cta: "Solicitar orcamento",
    href: "/produtos",
  },
  {
    eyebrow: "GAMEL Distribuidora",
    title: "Linhas para reformas, comunicacao visual e projetos comerciais em Garanhuns.",
    text: "Atendimento para clientes, profissionais e empresas que precisam validar produto, aplicacao e disponibilidade com suporte humano.",
    image: "/images/gamel/banners/banner-home-institucional-gamel.png",
    alt: "Materiais para obras e acabamentos organizados em showroom GAMEL.",
    cta: "Falar com a GAMEL",
    href: "/contato",
  },
];

export const gamelCommercialHighlights = [
  "Ripados, tetos, forros, pisos, telhas, ACM, aluminio e drywall",
  "Atendimento para clientes, profissionais, construtoras e empresas",
  "Retirada, entrega e disponibilidade confirmadas pela equipe comercial",
  "Orcamento assistido com produto, quantidade, cidade e contato",
];

export const gamelApplicationHighlights = [
  "Obras e reformas",
  "Acabamentos internos",
  "Comunicacao visual",
  "Projetos comerciais",
];

export const gamelFeaturedCategories = [
  {
    name: "Ripados internos e externos",
    slug: "ripados-internos",
    description:
      "Ripados WPC, PVC e linhas decorativas para paredes, paineis, fachadas e areas internas ou externas.",
    image: "/images/gamel/categorias/categoria-ripados-4x3.png",
  },
  {
    name: "Chapas UV",
    slug: "chapas-uv",
    description:
      "Chapas decorativas de alto brilho para revestimentos internos, paineis, cozinhas, salas e projetos comerciais.",
    image: "/images/gamel/categorias/categoria-chapas-uv-4x3.png",
  },
  {
    name: "Chapas Policarbonato",
    slug: "todos",
    description:
      "Policarbonato alveolar e compacto para coberturas, fechamentos, protecao e iluminacao natural.",
    image: "/images/gamel/categorias/categoria-policarbonato-4x3.png",
  },
  {
    name: "Tetos Laminados Vinilicos",
    slug: "tetos-laminados",
    description:
      "Tetos laminados e acabamentos vinilicos para ambientes internos com proposta decorativa.",
    image: "/images/gamel/categorias/categoria-tetos-laminados-vinilicos-4x3.png",
  },
  {
    name: "Pisos Vinilicos",
    slug: "pisos-vinilicos",
    description:
      "Pisos vinilicos em placas, reguas e caixas fechadas para interiores residenciais e comerciais.",
    image: "/images/gamel/categorias/categoria-pisos-vinilicos-4x3.png",
  },
  {
    name: "Forros PVC",
    slug: "forros-pvc",
    description: "Forros de PVC lisos, frisados e amadeirados para acabamento rapido de tetos.",
    image: "/images/gamel/categorias/categoria-forros-pvc-4x3.png",
  },
  {
    name: "ACM",
    slug: "acm",
    description:
      "Chapas ACM para fachadas, comunicacao visual, revestimentos e paineis corporativos.",
    image: "/images/gamel/categorias/categoria-acm-4x3.png",
  },
  {
    name: "Perfil de Aluminio",
    slug: "perfil-aluminio",
    description: "Perfis, cantoneiras, barras e arremates de aluminio para acabamento e montagem.",
    image: "/images/gamel/categorias/categoria-perfil-aluminio-4x3.png",
  },
];

export function getGamelWhatsAppUrl(message: string) {
  return `https://wa.me/${gamelStoreInfo.whatsapp}?text=${encodeURIComponent(message)}`;
}
