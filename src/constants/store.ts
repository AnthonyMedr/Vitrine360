export const STORE_INFO = {
  name: "GAMEL",
  tagline: "GAMEL - Garanhuns/PE",
  slogan: "Tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC para obras, reformas e acabamentos.",
  description: "Materiais para acabamentos e coberturas com atendimento comercial em Garanhuns/PE",
  domain: "www.gamelmetal.com",
  baseUrl: "https://www.gamelmetal.com",

  company: {
    legalName: "GARANHUNS METAL LTDA",
    tradeName: "GAMEL Distribuidora",
    cnpj: "64.156.323/0001-51",
    stateRegistration: "",
  },

  phone: "(87) 98139-0957",
  commercialPhones: ["(87) 98139-0957"],
  whatsapp: "5587981390957",
  whatsappDisplay: "(87) 98139-0957",
  email: "comercial@gamelmetal.com",

  address: {
    street: "Rua Vereador Paulo Francisco Gomes",
    number: "s/n, Lote Serra Branca, Quadra II, Lote 7",
    neighborhood: "Magano",
    city: "Garanhuns",
    state: "PE",
    zipCode: "55294-770",
    full: "Rua Vereador Paulo Francisco Gomes, s/n, Lote Serra Branca, Quadra II, Lote 7, Magano, Garanhuns/PE, CEP 55294-770",
  },

  hours: {
    weekdays: "8h as 18h",
    saturday: "8h as 12h",
    sunday: "Fechado",
    display: "Seg a Sex: 8h as 18h | Sabado: 8h as 12h",
  },

  social: {
    instagram: "@GAMELMETAL",
    facebook: "",
    linkedin: "",
  },

  freeShipping: {
    minValue: 299,
    description: "Frete gratis acima de R$ 299 em campanhas elegiveis",
  },

  shippingPolicy: {
    localDeliveryEta: "1 a 2 dias uteis",
    regionalDeliveryEta: "3 a 5 dias uteis",
    pickupEta: "até 2 horas após confirmação",
  },
};

export const WHATSAPP_MESSAGES = {
  default: "Ola! Vim pelo site da GAMEL Metal e gostaria de solicitar um orçamento.",
  product: (productName: string) =>
    `Ola! Vim pelo site da GAMEL Metal e gostaria de solicitar um orçamento.\n\nProduto: ${productName}\nQuantidade aproximada:\nNome:\nCidade:`,
  delivery: "Ola! Vim pelo site da GAMEL Metal. Gostaria de falar com a equipe comercial.",
  contact: "Ola! Vim pelo site da GAMEL Metal. Gostaria de mais informações.",
  businessSales:
    "Ola, vim pelo site da GAMEL Metal e gostaria de um orçamento para empresa.\n\nNome:\nEmpresa:\nCidade:\nProdutos de interesse:\nQuantidade aproximada:\nMensagem:",
  about: "Ola! Vim pelo site da GAMEL Metal. Gostaria de saber mais sobre a empresa.",
  quote: "Ola! Vim pelo site da GAMEL Metal e preciso de apoio comercial para orçamento.",
  orderTracking: "Ola! Vim pelo site da GAMEL Metal e gostaria de falar com a equipe comercial.",
};

export const LEGAL_LINKS = {
  policies: "/politicas",
  privacy: "/politicas?tab=privacidade",
  terms: "/politicas?tab=termos",
  exchange: "/politicas?tab=trocas",
  delivery: "/politicas?tab=entrega",
};

export const SEO_DEFAULTS = {
  title: "GAMEL - Catálogo Digital de Acabamentos",
  description: "Conheça o catálogo GAMEL de tetos laminados vinílicos, pisos vinílicos, ripados, chapas UV, policarbonato e telhas PVC.",
  keywords: "GAMEL, catálogo digital, tetos laminados vinílicos, pisos vinílicos, ripados, chapas UV, policarbonato, telhas PVC",
  image: "/assets/brand/gamel-icon-1024.png",
};

export const getWhatsAppUrl = (message: string) => {
  const encodedMessage = encodeURIComponent(message);
  return STORE_INFO.whatsapp ? `https://wa.me/${STORE_INFO.whatsapp}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;
};

export const getProductWhatsAppUrl = (productName: string) => getWhatsAppUrl(WHATSAPP_MESSAGES.product(productName));
