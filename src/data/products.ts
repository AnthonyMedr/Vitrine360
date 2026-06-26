import forroMarfim from "@/assets/produto-forro-wood-marfim.jpg";
import forroPreto from "@/assets/produto-forro-preto.jpg";
import forroCinza from "@/assets/produto-forro-cinza.jpg";
import chapaNero from "@/assets/produto-chapa-nero.jpg";
import chapaCalacata from "@/assets/produto-chapa-calacata.jpg";
import chapaBranca from "@/assets/produto-chapa-branca.jpg";
import ripadoWpc from "@/assets/produto-ripado-wpc.jpg";
import ripadoEscuro from "@/assets/produto-ripado-escuro.jpg";
import aluminio from "@/assets/produto-aluminio.jpg";
import pisoVinilico from "@/assets/produto-piso-vinilico.jpg";

export type Spec = { label: string; value: string };

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  longDescription: string;
  benefits: string[];
  applications: string[];
  environments?: { title: string; image: string; description?: string }[];
  specs?: Spec[];
  related?: string[];
  tip?: string;
  unit?: string;
  price: string;
  badge?: { label: string; tone: "action" | "brand" | "highlight" | "whatsapp" | "dark" };
  image: string;
  gallery?: string[];
  featured?: boolean;
  sectionId: string;
};

export const products: Product[] = [
  {
    id: "ripado-interno-nogueira",
    name: "Ripado Interno Nogueira",
    categoryId: "ripados-internos",
    categoryName: "Ripados Internos",
    description: "Painel ripado para paredes, paineis de TV e recepcoes com leitura premium.",
    longDescription:
      "Ripado interno com acabamento amadeirado nogueira, ideal para projetos comerciais e residenciais que pedem textura, elegancia e instalacao limpa.",
    benefits: [
      "Visual contemporaneo",
      "Baixa manutencao",
      "Aplicacao rapida",
      "Excelente para paineis e paredes de destaque",
    ],
    applications: ["Salas", "Recepcoes", "Paineis de TV", "Dormitorios"],
    environments: [
      {
        title: "Painel interno amadeirado",
        image: ripadoWpc,
        description: "Ideal para valorizar ambientes internos com leitura sofisticada.",
      },
    ],
    specs: [
      { label: "Uso", value: "Interno" },
      { label: "Acabamento", value: "Amadeirado fosco" },
      { label: "Comprimento", value: "Sob consulta" },
    ],
    related: ["teto-laminado-carvalho", "piso-vinilico-carvalho"],
    tip: "Combine com iluminacao quente para reforcar a textura do acabamento.",
    unit: "m2",
    price: "Sob consulta",
    badge: { label: "Destaque", tone: "highlight" },
    image: ripadoWpc,
    gallery: [ripadoWpc, ripadoEscuro],
    featured: true,
    sectionId: "ripados",
  },
  {
    id: "ripado-externo-grafite",
    name: "Ripado Externo Grafite",
    categoryId: "ripados-externos",
    categoryName: "Ripados Externos",
    description: "Solucao para fachadas e areas externas com visual marcante e alta resistencia.",
    longDescription:
      "Ripado externo em tom grafite para fachadas, muros, halls e composicoes de alto impacto visual, pensado para uso aparente e leitura arquitetonica forte.",
    benefits: [
      "Leitura arquitetonica moderna",
      "Acabamento uniforme",
      "Boa presenca para fachadas comerciais",
      "Baixa necessidade de manutencao",
    ],
    applications: ["Fachadas", "Muros", "Entradas comerciais", "Areas gourmet"],
    environments: [
      {
        title: "Fachada com ripado escuro",
        image: ripadoEscuro,
        description: "Excelente para vitrines e acessos com identidade premium.",
      },
    ],
    specs: [
      { label: "Uso", value: "Externo" },
      { label: "Cor", value: "Grafite" },
      { label: "Aplicacao", value: "Fachadas e composicoes externas" },
    ],
    related: ["acm-grafite-escovado", "perfil-aluminio-estrutural"],
    unit: "m2",
    price: "Sob consulta",
    badge: { label: "Fachada", tone: "brand" },
    image: ripadoEscuro,
    gallery: [ripadoEscuro, ripadoWpc],
    featured: true,
    sectionId: "ripados",
  },
  {
    id: "forro-pvc-branco-neve",
    name: "Forro PVC Branco Neve",
    categoryId: "forros-pvc",
    categoryName: "Forros PVC",
    description: "Forro leve, limpo e versatil para lojas, residencias e ambientes tecnicos.",
    longDescription:
      "Forro PVC branco com leitura clean, facil higienizacao e excelente custo-beneficio para tetos comerciais e residenciais.",
    benefits: [
      "Facil manutencao",
      "Instalacao agil",
      "Boa refletancia de luz",
      "Versatil para diferentes ambientes",
    ],
    applications: ["Lojas", "Corredores", "Salas", "Ambientes tecnicos"],
    environments: [
      {
        title: "Teto clean para operacao comercial",
        image: forroCinza,
        description: "Base neutra para projetos que pedem claridade e organizacao visual.",
      },
    ],
    specs: [
      { label: "Material", value: "PVC" },
      { label: "Acabamento", value: "Liso" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["forro-pvc-preto-premium", "perfil-aluminio-estrutural"],
    unit: "m2",
    price: "Sob consulta",
    image: forroCinza,
    gallery: [forroCinza, forroPreto],
    featured: true,
    sectionId: "forros-pvc",
  },
  {
    id: "forro-pvc-preto-premium",
    name: "Forro PVC Preto Premium",
    categoryId: "forros-pvc",
    categoryName: "Forros PVC",
    description: "Forro de impacto visual para showrooms, areas gourmet e ambientes autorais.",
    longDescription:
      "Forro PVC preto com leitura sofisticada para projetos que querem identidade forte no teto, combinando facil instalacao e presenca visual marcante.",
    benefits: [
      "Visual premium",
      "Otimo para ambientes assinados",
      "Facil limpeza",
      "Boa composicao com luz indireta",
    ],
    applications: ["Showrooms", "Lojas", "Areas gourmet", "Espacos corporativos"],
    environments: [
      {
        title: "Ambiente de alto contraste",
        image: forroPreto,
        description: "Excelente para projetos com linguagem contemporanea.",
      },
    ],
    specs: [
      { label: "Material", value: "PVC" },
      { label: "Cor", value: "Preto" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["ripado-interno-nogueira", "chapa-uv-nero-premium"],
    unit: "m2",
    price: "Sob consulta",
    badge: { label: "Premium", tone: "dark" },
    image: forroPreto,
    gallery: [forroPreto, forroCinza],
    sectionId: "forros-pvc",
  },
  {
    id: "teto-laminado-carvalho",
    name: "Teto Laminado Carvalho",
    categoryId: "tetos-laminados",
    categoryName: "Tetos Laminados",
    description: "Acabamento laminado para tetos internos com leitura quente e sofisticada.",
    longDescription:
      "Teto laminado no padrao carvalho para ambientes comerciais e residenciais que pedem acabamento amadeirado, elegante e com forte valorizacao visual.",
    benefits: [
      "Leitura amadeirada",
      "Valoriza iluminacao indireta",
      "Visual sofisticado",
      "Otimo para recepcoes e salas",
    ],
    applications: ["Recepcoes", "Salas", "Lojas", "Espacos corporativos"],
    environments: [
      {
        title: "Recepcao com teto laminado",
        image: forroMarfim,
        description: "Excelente para criar calor visual sem perder elegancia.",
      },
    ],
    specs: [
      { label: "Acabamento", value: "Laminado amadeirado" },
      { label: "Padrao", value: "Carvalho" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["ripado-interno-nogueira", "piso-vinilico-carvalho"],
    unit: "m2",
    price: "Sob consulta",
    badge: { label: "Ambiente premium", tone: "action" },
    image: forroMarfim,
    gallery: [forroMarfim, ripadoWpc],
    featured: true,
    sectionId: "tetos-laminados",
  },
  {
    id: "teto-laminado-grafite",
    name: "Teto Laminado Grafite",
    categoryId: "tetos-laminados",
    categoryName: "Tetos Laminados",
    description: "Teto laminado escuro para projetos comerciais com identidade mais urbana.",
    longDescription:
      "Acabamento laminado grafite pensado para lojas, showrooms e ambientes que buscam contraste, profundidade e presenca arquitetonica.",
    benefits: [
      "Contraste visual forte",
      "Combinacao com luz tecnica",
      "Visual contemporaneo",
      "Boa leitura para ambientes comerciais",
    ],
    applications: ["Showrooms", "Lojas", "Corredores", "Espacos corporativos"],
    environments: [
      {
        title: "Forro escuro para showroom",
        image: forroPreto,
        description: "Reforca identidade visual de projetos mais ousados.",
      },
    ],
    specs: [
      { label: "Acabamento", value: "Laminado" },
      { label: "Cor", value: "Grafite" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["forro-pvc-preto-premium", "acm-grafite-escovado"],
    unit: "m2",
    price: "Sob consulta",
    image: forroPreto,
    gallery: [forroPreto, forroMarfim],
    sectionId: "tetos-laminados",
  },
  {
    id: "piso-vinilico-carvalho",
    name: "Piso Vinilico Carvalho",
    categoryId: "pisos-vinilicos",
    categoryName: "Pisos Vinilicos",
    description: "Piso vinilico amadeirado para ambientes confortaveis e de instalacao eficiente.",
    longDescription:
      "Piso vinilico no padrao carvalho, ideal para lojas, salas e dormitorios, entregando conforto, boa leitura comercial e acabamento moderno.",
    benefits: [
      "Instalacao agil",
      "Conforto ao caminhar",
      "Visual amadeirado",
      "Boa leitura para ambientes internos",
    ],
    applications: ["Salas", "Dormitorios", "Lojas", "Escritorios"],
    environments: [
      {
        title: "Piso vinilico com leitura natural",
        image: pisoVinilico,
        description: "Base quente para composicoes comerciais e residenciais.",
      },
    ],
    specs: [
      { label: "Padrao", value: "Carvalho" },
      { label: "Uso", value: "Interno" },
      { label: "Formato", value: "Reguas vinilicas" },
    ],
    related: ["teto-laminado-carvalho", "ripado-interno-nogueira"],
    unit: "m2",
    price: "Sob consulta",
    badge: { label: "Conforto", tone: "highlight" },
    image: pisoVinilico,
    featured: true,
    sectionId: "pisos-vinilicos",
  },
  {
    id: "chapa-uv-nero-premium",
    name: "Chapa UV Nero Premium",
    categoryId: "chapas-uv",
    categoryName: "Chapas UV",
    description: "Superficie de alto impacto para paineis, paredes e composicoes sofisticadas.",
    longDescription:
      "Chapa UV em padrao nero para projetos que pedem brilho, contraste e presenca visual, muito utilizada em paineis, lojas e ambientes de atendimento.",
    benefits: [
      "Leitura sofisticada",
      "Superficie de forte impacto visual",
      "Boa aplicacao em paineis",
      "Facilidade de composicao com aluminio e ripado",
    ],
    applications: ["Paineis", "Paredes", "Recepcoes", "Ambientes comerciais"],
    environments: [
      {
        title: "Painel escuro de destaque",
        image: chapaNero,
        description: "Ideal para compor pontos focais em ambientes premium.",
      },
    ],
    specs: [
      { label: "Acabamento", value: "UV" },
      { label: "Padrao", value: "Nero" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["chapa-uv-bianco-lux", "acm-grafite-escovado"],
    unit: "chapa",
    price: "Sob consulta",
    badge: { label: "Alto impacto", tone: "dark" },
    image: chapaNero,
    gallery: [chapaNero, chapaCalacata],
    featured: true,
    sectionId: "chapas-uv",
  },
  {
    id: "chapa-uv-bianco-lux",
    name: "Chapa UV Bianco Lux",
    categoryId: "chapas-uv",
    categoryName: "Chapas UV",
    description: "Padrao claro para ambientes comerciais e residenciais com leitura elegante.",
    longDescription:
      "Chapa UV clara com leitura refinada, indicada para cozinhas, paines, recepcoes e composicoes internas que pedem luminosidade e sofisticacao.",
    benefits: [
      "Visual claro e elegante",
      "Boa composicao com metais e ripados",
      "Otima leitura para ambientes internos",
    ],
    applications: ["Cozinhas", "Recepcoes", "Paineis", "Ambientes internos"],
    environments: [
      {
        title: "Composicao clara e sofisticada",
        image: chapaBranca,
        description: "Ajuda a ampliar a sensacao de luz e limpeza visual.",
      },
    ],
    specs: [
      { label: "Acabamento", value: "UV" },
      { label: "Padrao", value: "Bianco" },
      { label: "Uso", value: "Interno" },
    ],
    related: ["chapa-uv-nero-premium", "perfil-aluminio-estrutural"],
    unit: "chapa",
    price: "Sob consulta",
    image: chapaBranca,
    gallery: [chapaBranca, chapaCalacata],
    sectionId: "chapas-uv",
  },
  {
    id: "perfil-aluminio-estrutural",
    name: "Perfil de Aluminio Estrutural",
    categoryId: "perfil-aluminio",
    categoryName: "Perfil de Aluminio",
    description: "Perfis para acabamento, estrutura e composicao de projetos comerciais.",
    longDescription:
      "Linha de perfis de aluminio para acabamento, molduras, estrutura leve e composicoes que pedem limpeza visual e resistencia.",
    benefits: [
      "Acabamento profissional",
      "Versatilidade de uso",
      "Boa integracao com ACM e chapas UV",
      "Leitura limpa e moderna",
    ],
    applications: ["Acabamentos", "Estruturas leves", "Molduras", "Composicoes comerciais"],
    environments: [
      {
        title: "Detalhamento em aluminio",
        image: aluminio,
        description: "Complementa paineis, fachadas e acabamentos internos.",
      },
    ],
    specs: [
      { label: "Material", value: "Aluminio" },
      { label: "Uso", value: "Interno e externo" },
      { label: "Formatos", value: "Sob consulta" },
    ],
    related: ["acm-grafite-escovado", "chapa-uv-nero-premium"],
    unit: "barra",
    price: "Sob consulta",
    image: aluminio,
    featured: true,
    sectionId: "perfil-aluminio",
  },
  {
    id: "acm-grafite-escovado",
    name: "ACM Grafite Escovado",
    categoryId: "acm",
    categoryName: "ACM",
    description: "Solucao para fachadas, paineis e comunicacao visual com leitura robusta.",
    longDescription:
      "ACM em tom grafite escovado para fachadas, marquises, paineis e composicoes externas ou internas com presenca contemporanea e acabamento premium.",
    benefits: [
      "Otimo para fachada",
      "Boa leitura corporativa",
      "Acabamento premium",
      "Excelente composicao com aluminio e ripado externo",
    ],
    applications: ["Fachadas", "Marquises", "Paineis", "Comunicacao visual"],
    environments: [
      {
        title: "Painel e fachada com ACM",
        image: chapaCalacata,
        description: "Funciona muito bem em composicoes limpas e corporativas.",
      },
    ],
    specs: [
      { label: "Material", value: "ACM" },
      { label: "Acabamento", value: "Grafite escovado" },
      { label: "Uso", value: "Interno e externo" },
    ],
    related: ["perfil-aluminio-estrutural", "ripado-externo-grafite"],
    unit: "chapa",
    price: "Sob consulta",
    badge: { label: "Fachadas", tone: "action" },
    image: chapaCalacata,
    gallery: [chapaCalacata, aluminio],
    featured: true,
    sectionId: "acm",
  },
];

export const sections = [
  {
    id: "ripados",
    title: "Ripados",
    subtitle: "Linhas internas e externas para paredes e fachadas",
  },
  {
    id: "forros-pvc",
    title: "Forros PVC",
    subtitle: "Leveza, praticidade e leitura comercial limpa",
  },
  {
    id: "tetos-laminados",
    title: "Tetos Laminados",
    subtitle: "Acabamento premium para projetos internos",
  },
  {
    id: "pisos-vinilicos",
    title: "Pisos Vinilicos",
    subtitle: "Conforto visual e instalacao eficiente",
  },
  {
    id: "chapas-uv",
    title: "Chapas UV",
    subtitle: "Superficies sofisticadas para paineis e paredes",
  },
  {
    id: "perfil-aluminio",
    title: "Perfil de Aluminio",
    subtitle: "Estrutura, acabamento e composicao tecnica",
  },
  { id: "acm", title: "ACM", subtitle: "Fachadas, marquises e paineis com presenca premium" },
] as const;

export function findProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
