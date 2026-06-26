import { createServerFn } from "@tanstack/react-start";
import type { Category } from "@/data/categories";
import type { Product } from "@/data/products";
import { getResolvedCatalogData } from "@/lib/commercial-data.server";
import { requestAiJson } from "@/lib/ai-provider";

async function loadCatalog() {
  const data = await getResolvedCatalogData();
  return {
    products: data.products,
    categories: data.categories,
  };
}

function buildCatalog(products: Product[]) {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.categoryName,
    description: product.description,
    applications: product.applications,
    tip: product.tip,
  }));
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function scoreCatalog(term: string, products: Product[], categoryId?: string) {
  const normalizedTerm = term.toLowerCase();

  return products
    .filter((product) => !categoryId || categoryId === "all" || product.categoryId === categoryId)
    .map((product) => {
      const haystack = [
        product.name,
        product.categoryName,
        product.description,
        product.longDescription,
        ...product.applications,
        ...product.benefits,
        product.tip ?? "",
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const token of normalizedTerm.split(/\s+/).filter(Boolean)) {
        if (haystack.includes(token)) score += 3;
      }

      if (
        normalizedTerm.includes("banheiro") &&
        /banheiro|umidade|lav[aá]vel|chapa uv|piso/.test(haystack)
      ) {
        score += 4;
      }
      if (
        normalizedTerm.includes("cozinha") &&
        /cozinha|forro|lav[aá]vel|revestimento|chapa uv/.test(haystack)
      ) {
        score += 4;
      }
      if (
        normalizedTerm.includes("fachada") &&
        /fachada|ripado|externa|acm|aluminio/.test(haystack)
      ) {
        score += 4;
      }
      if (
        normalizedTerm.includes("garagem") &&
        /garagem|externa|fachada|acm|aluminio/.test(haystack)
      ) {
        score += 4;
      }
      if (normalizedTerm.includes("teto") && /forro|pvc|laminado|teto/.test(haystack)) {
        score += 4;
      }

      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function mockRecommendations(
  categoryId: string | undefined,
  scenario: string,
  products: Product[],
) {
  const ranked = scoreCatalog(scenario, products, categoryId).slice(0, 4);
  const recommendations = ranked.map(({ product }) => ({
    id: product.id,
    reason: `Indicado para ${product.categoryName.toLowerCase()} com foco em ${product.applications[0]?.toLowerCase() ?? "aplicacao versatil"}.`,
  }));

  return {
    recommendations,
    summary:
      recommendations.length > 0
        ? `Sugestao automatica preparada com base no cenario informado: ${scenario}.`
        : "Nenhuma recomendacao direta foi encontrada para este cenario.",
  };
}

function mockRoomSimulation(room: string, style: string | undefined, products: Product[]) {
  const ranked = scoreCatalog(`${room} ${style ?? ""}`, products).slice(0, 5);
  const itens = ranked.map(({ product }) => ({
    id: product.id,
    papel: `Aplicacao recomendada para ${room.toLowerCase()}.`,
    specsChave:
      product.specs
        ?.slice(0, 2)
        .map((spec) => `${spec.label}: ${spec.value}`)
        .join(" | ") ?? product.description,
    dicaInstalacao: product.tip ?? `Considere o estilo ${style ?? "moderno"} na composicao final.`,
  }));

  return {
    ambiente: room,
    conceito: `Composicao ${style?.toLowerCase() ?? "contemporanea"} para ${room.toLowerCase()}, priorizando acabamento, manutencao e apelo visual.`,
    itens,
    combinacoes:
      "Combine tons claros com pontos de destaque para reforcar a leitura comercial do ambiente.",
    manutencao:
      "Priorize limpeza regular e validacao do material mais adequado para a area instalada.",
  };
}

export const recommendProducts = createServerFn({ method: "POST" })
  .validator((input: { categoryId?: string; scenario: string }) => ({
    categoryId: typeof input.categoryId === "string" ? input.categoryId.slice(0, 60) : undefined,
    scenario: String(input.scenario ?? "").slice(0, 500),
  }))
  .handler(async ({ data }) => {
    const { products, categories } = await loadCatalog();
    const scope =
      data.categoryId && data.categoryId !== "all"
        ? buildCatalog(products).filter(
            (product) =>
              products.find((candidate) => candidate.id === product.id)?.categoryId ===
              data.categoryId,
          )
        : buildCatalog(products);
    const categoryName = categories.find(
      (category: Category) => category.id === data.categoryId,
    )?.name;
    const system =
      'Voce e especialista comercial do Vitrine360. Dado um catalogo, recomende produtos para o cenario do cliente. Responda APENAS JSON no formato {"recommendations":[{"id":string,"reason":string}],"summary":string}. Use APENAS ids existentes no catalogo. Maximo de 4 itens.';
    const user = JSON.stringify({
      category: categoryName ?? "qualquer",
      scenario: data.scenario || "uso geral residencial",
      catalog: scope,
    });

    const validIds = new Set(products.map((product) => product.id));

    try {
      const raw = await requestAiJson({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const parsed = safeParse<{
        recommendations?: { id: string; reason: string }[];
        summary?: string;
      }>(raw, {});

      return {
        recommendations: (parsed.recommendations ?? [])
          .filter((recommendation) => recommendation && validIds.has(recommendation.id))
          .slice(0, 4),
        summary: parsed.summary ?? "",
      };
    } catch (error) {
      if ((error as Error).message !== "AI_MOCK_MODE") {
        console.warn("[AI] fallback local ativado:", error);
      }
      return mockRecommendations(data.categoryId, data.scenario, products);
    }
  });

export const simulateRoom = createServerFn({ method: "POST" })
  .validator((input: { room: string; style?: string }) => ({
    room: String(input.room ?? "").slice(0, 100),
    style: typeof input.style === "string" ? input.style.slice(0, 120) : undefined,
  }))
  .handler(async ({ data }) => {
    const { products } = await loadCatalog();
    const system =
      'Voce e arquiteto de interiores parceiro do Vitrine360. Para o ambiente informado, escolha do catalogo os produtos ideais e gere recomendacoes detalhadas. Responda APENAS JSON no formato {"ambiente":string,"conceito":string,"itens":[{"id":string,"papel":string,"specsChave":string,"dicaInstalacao":string}],"combinacoes":string,"manutencao":string}. Use APENAS ids existentes. Maximo de 5 itens.';
    const user = JSON.stringify({
      ambiente: data.room,
      estilo: data.style ?? "moderno e clean",
      catalogo: buildCatalog(products),
    });

    const validIds = new Set(products.map((product) => product.id));

    try {
      const raw = await requestAiJson({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const parsed = safeParse<{
        ambiente?: string;
        conceito?: string;
        itens?: { id: string; papel: string; specsChave: string; dicaInstalacao: string }[];
        combinacoes?: string;
        manutencao?: string;
      }>(raw, {});

      return {
        ambiente: parsed.ambiente ?? data.room,
        conceito: parsed.conceito ?? "",
        itens: (parsed.itens ?? []).filter((item) => item && validIds.has(item.id)).slice(0, 5),
        combinacoes: parsed.combinacoes ?? "",
        manutencao: parsed.manutencao ?? "",
      };
    } catch (error) {
      if ((error as Error).message !== "AI_MOCK_MODE") {
        console.warn("[AI] fallback local ativado:", error);
      }
      return mockRoomSimulation(data.room, data.style, products);
    }
  });
