import heroImage from "@/assets/hero-campaign.jpg";
import { brandConfig } from "@/config/brand";

export const campaign = {
  id: "encarte-principal",
  badge: "Central Comercial Digital | Edicao Atual",
  title: "Sua operacao comercial mais visivel, organizada e digital.",
  highlight: "digital",
  subtitle:
    "Catalogo, campanhas, QR Code, totem, vitrine TV e atendimento por WhatsApp em uma unica experiencia comercial.",
  validity: "Conteudos sujeitos a disponibilidade e vigencia comercial da loja.",
  validUntil: "Consulte campanhas e condicoes diretamente com a equipe comercial.",
  cta: { label: "Ver ofertas", href: "#ofertas" },
  heroImage,
};

export const settings = {
  brand: brandConfig.defaultStoreName,
  tagline: "Operacao comercial digital assistida",
  whatsappNumber: brandConfig.defaultStorePhoneNumber,
  whatsappLabel: brandConfig.defaultStorePhoneLabel,
  address: brandConfig.defaultStoreAddress,
  hours: brandConfig.defaultStoreOpeningHours,
  instagram: brandConfig.defaultInstagramHandle,
  legal:
    "Ofertas validas por tempo limitado ou enquanto durar o estoque. Imagens meramente ilustrativas. Consulte disponibilidade, medidas, cores, modelos e condicoes diretamente com a loja.",
};

export const whatsappLink = (message: string) =>
  `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(message)}`;
