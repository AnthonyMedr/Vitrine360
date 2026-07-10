import heroCampaign from "@/assets/hero-campaign.jpg";
import chapaNero from "@/assets/produto-chapa-nero.jpg";
import ripadoWpc from "@/assets/produto-ripado-wpc.jpg";
import forroMarfim from "@/assets/produto-forro-wood-marfim.jpg";
import aluminio from "@/assets/produto-aluminio.jpg";

export type Campaign = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  period: string;
  banner: string;
  status: "publicado" | "rascunho" | "encerrado";
  productIds: string[];
  accent?: "action" | "highlight" | "brand" | "dark";
  showOnHome?: boolean;
  showOnTotem?: boolean;
  showOnVitrine?: boolean;
};

export const campaigns: Campaign[] = [
  {
    slug: "mix-principal-gamel",
    name: "Mix Principal Gamel Distribuidora",
    tagline: "Linhas comerciais para interiores, fachadas e acabamentos em destaque.",
    description:
      "Ripados, forros, tetos laminados, pisos vinilicos, chapas UV, aluminio e ACM reunidos em uma vitrine comercial unica.",
    period: "Durante todo o mes",
    banner: heroCampaign,
    status: "publicado",
    productIds: [
      "ripado-interno-nogueira",
      "forro-pvc-branco-neve",
      "teto-laminado-carvalho",
      "piso-vinilico-carvalho",
    ],
    accent: "action",
  },
  {
    slug: "especial-ripados",
    name: "Especial Ripados",
    tagline: "Linhas internas e externas para projetos com identidade forte.",
    description:
      "Solucoes em ripados para paredes, paineis e fachadas com leitura premium para residencias e operacoes comerciais.",
    period: "Edicao em destaque",
    banner: ripadoWpc,
    status: "publicado",
    productIds: ["ripado-interno-nogueira", "ripado-externo-grafite", "teto-laminado-carvalho"],
    accent: "brand",
  },
  {
    slug: "tetos-e-forros",
    name: "Tetos e Forros",
    tagline: "Acabamentos para transformar a leitura do ambiente pelo alto.",
    description:
      "Forros PVC e tetos laminados para lojas, salas, recepcoes e ambientes internos com acabamento limpo e sofisticado.",
    period: "Promocao da semana",
    banner: forroMarfim,
    status: "publicado",
    productIds: [
      "forro-pvc-branco-neve",
      "forro-pvc-preto-premium",
      "teto-laminado-carvalho",
      "teto-laminado-grafite",
    ],
    accent: "highlight",
  },
  {
    slug: "superficies-e-fachadas",
    name: "Superficies e Fachadas",
    tagline: "Chapas UV, ACM e aluminio para composicoes de alto impacto.",
    description:
      "Materiais pensados para fachadas, paineis, recepcoes e comunicacao visual com acabamento forte e leitura profissional.",
    period: "Enquanto durar o estoque",
    banner: chapaNero,
    status: "publicado",
    productIds: [
      "chapa-uv-nero-premium",
      "chapa-uv-bianco-lux",
      "perfil-aluminio-estrutural",
      "acm-grafite-escovado",
    ],
    accent: "dark",
  },
  {
    slug: "ambientes-completos",
    name: "Ambientes Completos",
    tagline: "Combinacoes de teto, piso e revestimento para leitura comercial consistente.",
    description:
      "Monte composicoes equilibradas unindo pisos vinilicos, tetos laminados, chapas UV e perfis de aluminio.",
    period: "Campanha recorrente",
    banner: aluminio,
    status: "publicado",
    productIds: [
      "piso-vinilico-carvalho",
      "teto-laminado-carvalho",
      "chapa-uv-bianco-lux",
      "perfil-aluminio-estrutural",
    ],
    accent: "action",
  },
];

export function findCampaign(slug: string): Campaign | undefined {
  return campaigns.find((campaign) => campaign.slug === slug);
}
