import type { Product } from "@/data/products";
import type { AppSettings } from "@/context/SettingsContext";

export function buildProductMessage(product: Product, settings: AppSettings) {
  const lines = [
    `Olá, ${settings.brand}! 👋`,
    "",
    `Tenho interesse no produto abaixo (visto no Catálogo Digital do totem):`,
    "",
    `🏷️ *${product.name}*`,
    `📂 Categoria: ${product.categoryName}`,
    product.unit ? `📐 Unidade: ${product.unit}` : "",
    `💰 Preço de referência: ${product.price}`,
    `🔖 Código: ${product.id}`,
    "",
    `Poderia confirmar disponibilidade, prazo e condições?`,
    settings.address ? `📍 Loja: ${settings.address}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildGenericMessage(settings: AppSettings) {
  return `Olá, ${settings.brand}! 👋\nVi o Catálogo Digital no totem e gostaria de fazer um orçamento.`;
}

export function whatsappUrl(message: string, number: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
