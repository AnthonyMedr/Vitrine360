import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Filter, Grid, List, SlidersHorizontal, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/products/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";
import { categories as seedCategories, products as seedProducts, type Category as SeedCategory, type Product as SeedProduct } from "@/data/products";
import { useBrands } from "@/hooks/useBrands";
import { useCategories, useCategory } from "@/hooks/useCategories";
import { useProductsPaged, type Product } from "@/hooks/useProducts";
import { buildCategoryPath, CATALOG_ROUTES } from "@/lib/catalogRoutes";

const diameters = ["160mm", "200mm", "250mm", "122x244cm", "184x950mm"];
const availabilityOptions = [
  { value: "disponivel", label: "Disponível" },
  { value: "sob_consulta", label: "Sob consulta" },
  { value: "retirada_loja", label: "Retirada na loja" },
  { value: "entrega_sob_analise", label: "Entrega sob análise" },
];
const deliveryOptions = [
  { value: "pickup", label: "Retirada" },
  { value: "delivery", label: "Entrega nacional" },
  { value: "pickup_or_delivery", label: "Retirada ou frete" },
  { value: "quote", label: "Cotação assistida" },
];
const saleTypeOptions = [
  { value: "unidade", label: "Por unidade" },
  { value: "metro_linear", label: "Metro linear" },
  { value: "metro_quadrado", label: "Metro quadrado" },
  { value: "caixa", label: "Por caixa" },
  { value: "peca", label: "Por peca" },
];
const unitMeasureOptions = [
  { value: "un", label: "un" },
  { value: "m", label: "m" },
  { value: "m2", label: "m2" },
  { value: "caixa", label: "caixa" },
  { value: "peca", label: "peca" },
];
const quickSearchTerms = [
  "ripados",
  "teto laminado",
  "chapa uv",
  "policarbonato",
  "piso vinilico",
  "telha pvc",
];
const applicationSearchTerms = [
  "fachada",
  "parede",
  "teto",
  "piso",
  "cobertura",
  "comunicação visual",
  "ambiente externo",
  "acabamento interno",
];

type SortOption = "newest" | "name_asc" | "rating";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Mais recentes" },
  { value: "rating", label: "Mais avaliados" },
  { value: "name_asc", label: "A-Z" },
];

const searchAliases: Record<string, string[]> = {
  "teto laminado": ["teto", "laminado", "pvc", "amadeirado"],
  "tetos laminados": ["teto", "laminado", "pvc", "amadeirado"],
  "chapa uv": ["chapa", "uv", "painel", "marmorizada"],
  "chapas uv": ["chapa", "uv", "painel", "marmorizada"],
  "piso vinilico": ["piso", "vinilico", "regua", "amadeirado"],
  "pisos vinílicos": ["piso", "vinilico", "regua", "amadeirado"],
  "ripado wpc": ["ripado", "wpc", "painel", "madeira plastica"],
  "ripado externo": ["ripado", "wpc", "externo", "fachada"],
  "ripado interno": ["ripado", "wpc", "interno", "painel"],
  ripados: ["ripado", "painel", "decorativo"],
  "telha pvc": ["telha", "pvc", "cobertura"],
  "telhas pvc": ["telha", "pvc", "cobertura"],
  policarbonato: ["policarbonato", "chapa", "cobertura", "translucido"],
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fallbackCategory(category: SeedCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    image_url: category.image,
    sort_order: category.order,
    is_active: true,
  };
}

function fallbackProduct(product: SeedProduct): Product {
  const category = seedCategories.find((item) => item.name === product.category) ?? seedCategories[0];
  const isNamedGamelProduct = Number(product.id) >= 23;
  const isRipado = product.category === "Ripados internos e externos";
  const skuPrefix = isNamedGamelProduct ? (isRipado ? "GML-RIP" : "GML-TLV") : "GML";

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.shortDescription,
    application: product.application,
    price: product.price,
    original_price: product.originalPrice ?? null,
    category_id: category?.id ?? null,
    brand_id: null,
    material: product.material,
    diameter: product.diameter ?? null,
    measures: product.diameter ?? product.technicalSpecs[0] ?? null,
    dimensions: product.diameter ?? null,
    weight: product.weightPerUnit ?? null,
    unit: product.unitMeasure ?? "un",
    sale_type: product.saleType ?? "unidade",
    unit_measure: product.unitMeasure ?? "un",
    display_unit: product.displayUnit ?? product.unitMeasure ?? "un",
    stock: product.stock,
    availability: product.quoteAvailable ? "sob_consulta" : "indisponivel",
    delivery_type: "quote",
    is_on_request: true,
    is_active: true,
    is_featured: Boolean(product.featured),
    rating: product.rating,
    review_count: product.reviews,
    image_url: product.images[0] ?? null,
    images: product.images,
    image_alt_text: product.name,
    image_review_status: product.imageApproved ? "approved" : "manual_review",
    image_review_notes: product.imageApproved ? "Imagem aprovada na planilha-mestre." : "Imagem aguardando aprovação.",
    created_at: new Date(Date.now() - Number(product.id.replace(/\D/g, "")) * 60_000).toISOString(),
    category: category ? fallbackCategory(category) : null,
    brand: { id: "gamel-curadoria", name: product.brand, slug: "gamel-curadoria", is_active: true },
  };
}

function scoreSuggestion(value: string, normalizedQuery: string) {
  const normalizedValue = value.toLowerCase();
  if (normalizedValue === normalizedQuery) return 100;
  if (normalizedValue.startsWith(normalizedQuery)) return 80;
  if (normalizedValue.split(/\s+/).some((term) => term.startsWith(normalizedQuery))) return 60;
  if (normalizedValue.includes(normalizedQuery)) return 40;
  return 0;
}

function filterFallbackProducts(input: {
  products: Product[];
  categorySlug?: string;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedAvailability: string[];
  selectedDeliveryTypes: string[];
  selectedSaleTypes: string[];
  selectedUnitMeasures: string[];
  selectedSubcategories: string[];
  selectedDiameters: string[];
  effectiveSearch: string;
  isOffersRoute: boolean;
  sortBy: SortOption;
}) {
  const terms = normalizeText(input.effectiveSearch).split(/\s+/).filter((term) => term.length >= 2);
  const filtered = input.products.filter((product) => {
    if (input.isOffersRoute && !product.is_featured) return false;
    if (input.categorySlug && product.category?.slug !== input.categorySlug) return false;
    if (input.selectedCategories.length > 0 && (!product.category?.name || !input.selectedCategories.includes(product.category.name))) return false;
    if (input.selectedBrands.length > 0 && (!product.brand?.name || !input.selectedBrands.includes(product.brand.name))) return false;
    if (input.selectedAvailability.length > 0 && (!product.availability || !input.selectedAvailability.includes(product.availability))) return false;
    if (input.selectedDeliveryTypes.length > 0 && (!product.delivery_type || !input.selectedDeliveryTypes.includes(product.delivery_type))) return false;
    if (input.selectedSaleTypes.length > 0 && (!product.sale_type || !input.selectedSaleTypes.includes(product.sale_type))) return false;
    if (input.selectedUnitMeasures.length > 0 && (!product.unit_measure || !input.selectedUnitMeasures.includes(product.unit_measure))) return false;
    if (input.selectedSubcategories.length > 0 && (!product.subcategory || !input.selectedSubcategories.includes(product.subcategory))) return false;
    if (input.selectedDiameters.length > 0 && (!product.diameter || !input.selectedDiameters.includes(product.diameter))) return false;
    if (terms.length > 0) {
      const haystack = normalizeText([
        product.name,
        product.sku,
        product.description,
        product.short_description,
        product.application,
        product.subcategory,
        product.category?.name,
        product.brand?.name,
        product.material,
        product.diameter,
      ].filter(Boolean).join(" "));
      if (!terms.some((term) => haystack.includes(term))) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (input.sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (input.sortBy === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
    return b.created_at.localeCompare(a.created_at);
  });
}

export default function Products() {
  const { slug: categorySlug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: categoryFromSlug } = useCategory(categorySlug || "");
  const { data: brands, isLoading: brandsLoading } = useBrands();
  const fallbackCategories = useMemo(() => seedCategories.map(fallbackCategory), []);
  const displayCategories = useMemo(
    () => (categories?.length ? categories : fallbackCategories),
    [categories, fallbackCategories],
  );
  const publicCategoryOptions = useMemo(() => displayCategories.map((category) => ({
    id: category.id,
    name: category.name,
    sourceNames: [category.name],
  })), [displayCategories]);
  const resolvedCategoryFromSlug = categoryFromSlug ?? (categorySlug ? displayCategories.find((category) => category.slug === categorySlug) ?? null : null);
  const isOffersRoute = location.pathname === CATALOG_ROUTES.offers;
  const isSearchRoute = location.pathname === CATALOG_ROUTES.search;
  const resolvedBasePath = isOffersRoute ? CATALOG_ROUTES.offers : categorySlug ? buildCategoryPath(categorySlug) : CATALOG_ROUTES.allProducts;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDiameters, setSelectedDiameters] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [selectedDeliveryTypes, setSelectedDeliveryTypes] = useState<string[]>([]);
  const [selectedSaleTypes, setSelectedSaleTypes] = useState<string[]>([]);
  const [selectedUnitMeasures, setSelectedUnitMeasures] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveSearch = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const aliasTerms = Object.entries(searchAliases).find(([alias]) => normalized.includes(alias))?.[1] ?? [];
    return [searchQuery.trim(), ...aliasTerms].filter(Boolean).join(" ");
  }, [searchQuery]);

  const {
    data: productsResponse,
    isLoading: productsLoading,
  } = useProductsPaged({
    categorySlug: resolvedCategoryFromSlug?.slug,
    category: selectedCategories,
    brand: selectedBrands,
    featured: isOffersRoute,
    readyForCampaign: isOffersRoute,
    search: effectiveSearch || undefined,
    availability: selectedAvailability,
    deliveryType: selectedDeliveryTypes,
    saleType: selectedSaleTypes,
    unitMeasure: selectedUnitMeasures,
    subcategory: selectedSubcategories,
    diameter: selectedDiameters,
    sort: sortBy,
    page: currentPage,
    pageSize: 20,
  });

  const fallbackProducts = useMemo(() => seedProducts.map(fallbackProduct), []);
  const fallbackFilteredProducts = useMemo(() => filterFallbackProducts({
    products: fallbackProducts,
    categorySlug: resolvedCategoryFromSlug?.slug,
    selectedCategories,
    selectedBrands,
    selectedAvailability,
    selectedDeliveryTypes,
    selectedSaleTypes,
    selectedUnitMeasures,
    selectedSubcategories,
    selectedDiameters,
    effectiveSearch,
    isOffersRoute,
    sortBy,
  }), [
    effectiveSearch,
    fallbackProducts,
    isOffersRoute,
    resolvedCategoryFromSlug?.slug,
    selectedAvailability,
    selectedBrands,
    selectedCategories,
    selectedDeliveryTypes,
    selectedDiameters,
    selectedSaleTypes,
    selectedSubcategories,
    selectedUnitMeasures,
    sortBy,
  ]);
  const apiProducts = productsResponse?.items ?? [];
  const shouldUseFallbackProducts = !productsLoading && apiProducts.length === 0 && fallbackFilteredProducts.length > 0;
  const products = shouldUseFallbackProducts ? fallbackFilteredProducts.slice((currentPage - 1) * 20, currentPage * 20) : apiProducts;
  const effectiveTotal = shouldUseFallbackProducts ? fallbackFilteredProducts.length : productsResponse?.total ?? products.length;
  const effectiveTotalPages = shouldUseFallbackProducts ? Math.max(1, Math.ceil(fallbackFilteredProducts.length / 20)) : productsResponse?.totalPages ?? 1;
  const effectivePage = shouldUseFallbackProducts ? Math.min(currentPage, effectiveTotalPages) : productsResponse?.page ?? currentPage;
  // Invalid category slugs must degrade to a safe catalog state instead of crashing or silently showing the wrong department.
  const hasInvalidCategorySlug = Boolean(categorySlug) && !categoriesLoading && !resolvedCategoryFromSlug;
  const heroTitle = resolvedCategoryFromSlug
    ? resolvedCategoryFromSlug.name
    : isOffersRoute
      ? "Destaques para consulta comercial"
      : isSearchRoute && searchQuery
        ? `Resultados para "${searchQuery}"`
        : "Catálogo digital GAMEL";
  const heroDescription = hasInvalidCategorySlug
    ? "A categoria solicitada não foi encontrada. Mantive um fallback seguro para você voltar ao catálogo sem quebrar a navegação."
    : isOffersRoute
      ? "Selecao de produtos destacados para consulta e atendimento especializado."
      : "Navegue por categorias, marca, aplicação, medida e tipo de atendimento. A Fase 1 opera como catálogo comercial com orçamento online.";

  const subcategoryOptions = useMemo(() => {
    const pool = products
      .map((product) => product.subcategory)
      .filter((value): value is string => Boolean(value));
    return [...new Set(pool)].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const typeaheadSuggestions = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (normalized.length < 2) return [];

    const pool = [
      ...products.map((product) => product.name),
      ...(brands ?? []).map((brand) => brand.name),
      ...publicCategoryOptions.map((category) => category.name),
      ...Object.keys(searchAliases),
    ];
    const aliasBoost = Object.entries(searchAliases).some(([alias, terms]) => alias.includes(normalized) || terms.some((term) => term.includes(normalized)));

    return [...new Set(pool)]
      .map((value) => ({
        value,
        score: scoreSuggestion(value, normalized) + (aliasBoost && Object.keys(searchAliases).includes(value.toLowerCase()) ? 15 : 0),
      }))
      .filter((entry) => entry.score > 0 && entry.value.toLowerCase() !== normalized)
      .sort((a, b) => (b.score - a.score) || a.value.localeCompare(b.value))
      .slice(0, 6)
      .map((entry) => entry.value);
  }, [brands, products, publicCategoryOptions, searchQuery]);

  const isLoading = productsLoading || categoriesLoading || brandsLoading;
  const spotlightCategories = useMemo(() => displayCategories.slice(0, 5), [displayCategories]);
  const noResultsSuggestions = useMemo(() => {
    const categorySuggestions = spotlightCategories.map((category) => category.name.toLowerCase());
    return [...new Set([...typeaheadSuggestions, ...quickSearchTerms, ...categorySuggestions])]
      .filter((term) => term.toLowerCase() !== searchQuery.trim().toLowerCase())
      .slice(0, 6);
  }, [searchQuery, spotlightCategories, typeaheadSuggestions]);

  useEffect(() => {
    if (resolvedCategoryFromSlug) {
      setSelectedCategories([resolvedCategoryFromSlug.name]);
      return;
    }
    if (categorySlug) {
      setSelectedCategories([]);
    }
  }, [resolvedCategoryFromSlug, categorySlug]);

  useEffect(() => {
    const query = searchParams.get("q") ?? "";
    setSearchQuery(query);
    const sort = searchParams.get("sort");
    setSortBy(sort === "popular" ? "rating" : "newest");
    const pageParam = Number(searchParams.get("page") || 1);
    setCurrentPage(Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1);
  }, [searchParams]);

  const updateSearchRoute = (nextQuery: string, nextPage = 1, nextSort = sortBy) => {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery) {
      nextParams.set("q", normalizedQuery);
    } else {
      nextParams.delete("q");
    }
    if (nextSort === "rating") {
      nextParams.set("sort", "popular");
    } else {
      nextParams.delete("sort");
    }
    if (nextPage > 1) {
      nextParams.set("page", String(nextPage));
    } else {
      nextParams.delete("page");
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Route-aware navigation keeps "ofertas", category pages and generic catalog pages consistent while filters mutate.
  const navigateToSearch = (nextQuery: string, nextPage = 1, nextSort = sortBy) => {
    const nextParams = new URLSearchParams();
    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery) {
      nextParams.set("q", normalizedQuery);
    }
    if (nextSort === "rating") {
      nextParams.set("sort", "popular");
    }
    if (nextPage > 1) {
      nextParams.set("page", String(nextPage));
    }
    navigate({
      pathname: normalizedQuery ? CATALOG_ROUTES.search : resolvedBasePath,
      search: nextParams.toString() ? `?${nextParams.toString()}` : "",
    });
  };

  const navigateToCategory = (slug: string) => {
    navigate(buildCategoryPath(slug));
  };

  const toggleFilter = (value: string, selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedDiameters([]);
    setSelectedAvailability([]);
    setSelectedDeliveryTypes([]);
    setSelectedSaleTypes([]);
    setSelectedUnitMeasures([]);
    setSelectedSubcategories([]);
    setSearchQuery("");
    setCurrentPage(1);
    navigate(resolvedBasePath);
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedDiameters.length > 0 ||
    selectedAvailability.length > 0 ||
    selectedDeliveryTypes.length > 0 ||
    selectedSaleTypes.length > 0 ||
    selectedUnitMeasures.length > 0 ||
    selectedSubcategories.length > 0 ||
    searchQuery.length > 0;

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    selectedDiameters.length +
    selectedAvailability.length +
    selectedDeliveryTypes.length +
    selectedSaleTypes.length +
    selectedUnitMeasures.length +
    selectedSubcategories.length +
    (searchQuery ? 1 : 0);

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-bold">Departamento</h3>
        <div className="space-y-1.5">
          {publicCategoryOptions.map((category) => {
            const isSelected = category.sourceNames.some((name) => selectedCategories.includes(name));
            return (
            <div key={category.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${category.id}`}
                checked={isSelected}
                onCheckedChange={() => {
                  setSelectedCategories((current) => isSelected
                    ? current.filter((name) => !category.sourceNames.includes(name))
                    : [...new Set([...current, ...category.sourceNames])]);
                  setCurrentPage(1);
                }}
              />
              <label htmlFor={`cat-${category.id}`} className="cursor-pointer text-sm">
                {category.name}
              </label>
            </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Marca</h3>
        <div className="space-y-1.5">
          {brands?.map((brand) => (
            <div key={brand.id} className="flex items-center gap-2">
              <Checkbox
                id={`brand-${brand.id}`}
                checked={selectedBrands.includes(brand.name)}
                onCheckedChange={() => toggleFilter(brand.name, selectedBrands, setSelectedBrands)}
              />
              <label htmlFor={`brand-${brand.id}`} className="cursor-pointer text-sm">
                {brand.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Medidas</h3>
        <div className="flex flex-wrap gap-1.5">
          {diameters.map((diameter) => (
            <button
              key={diameter}
              onClick={() => toggleFilter(diameter, selectedDiameters, setSelectedDiameters)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedDiameters.includes(diameter)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {diameter}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Disponibilidade</h3>
        <div className="space-y-1.5">
          {availabilityOptions.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`availability-${option.value}`}
                checked={selectedAvailability.includes(option.value)}
                onCheckedChange={() => toggleFilter(option.value, selectedAvailability, setSelectedAvailability)}
              />
              <label htmlFor={`availability-${option.value}`} className="cursor-pointer text-sm">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Tipo de atendimento</h3>
        <div className="space-y-1.5">
          {deliveryOptions.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`delivery-${option.value}`}
                checked={selectedDeliveryTypes.includes(option.value)}
                onCheckedChange={() => toggleFilter(option.value, selectedDeliveryTypes, setSelectedDeliveryTypes)}
              />
              <label htmlFor={`delivery-${option.value}`} className="cursor-pointer text-sm">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Tipo de venda</h3>
        <div className="space-y-1.5">
          {saleTypeOptions.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`sale-${option.value}`}
                checked={selectedSaleTypes.includes(option.value)}
                onCheckedChange={() => toggleFilter(option.value, selectedSaleTypes, setSelectedSaleTypes)}
              />
              <label htmlFor={`sale-${option.value}`} className="cursor-pointer text-sm">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Unidade de medida</h3>
        <div className="flex flex-wrap gap-1.5">
          {unitMeasureOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter(option.value, selectedUnitMeasures, setSelectedUnitMeasures)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedUnitMeasures.includes(option.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {subcategoryOptions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">Subcategoria</h3>
          <div className="flex flex-wrap gap-1.5">
            {subcategoryOptions.map((option) => (
              <button
                key={option}
                onClick={() => toggleFilter(option, selectedSubcategories, setSelectedSubcategories)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedSubcategories.includes(option)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full" size="sm">
          <X className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="container py-5">
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary hover:underline">
            Inicio
          </Link>
          <ChevronRight className="h-3 w-3" />
          {hasInvalidCategorySlug ? (
            <>
              <Link to="/produtos" className="hover:text-primary hover:underline">
                Produtos
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">Categoria indisponivel</span>
            </>
          ) : resolvedCategoryFromSlug ? (
            <>
              <Link to="/produtos" className="hover:text-primary hover:underline">
                Produtos
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{resolvedCategoryFromSlug.name}</span>
            </>
          ) : (
            <span className="text-foreground">Todos os produtos</span>
          )}
        </nav>

        <div className="mb-4 rounded-lg border border-border/80 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Catálogo profissional</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-secondary md:text-4xl">{heroTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{heroDescription}</p>
              {resolvedCategoryFromSlug?.description && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{resolvedCategoryFromSlug.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 text-foreground">
                {effectiveTotal} {effectiveTotal === 1 ? "produto" : "produtos"}
              </span>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">Orcamento assistido</span>
              <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 text-foreground">Catalogo técnico</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-border/80 bg-white px-3 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Buscas rapidas:</span>
              {quickSearchTerms.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    setCurrentPage(1);
                    navigateToSearch(term);
                  }}
                  className="rounded-lg border border-border/70 bg-card px-3 py-1.5 font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Aplicacoes:</span>
              {applicationSearchTerms.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    setCurrentPage(1);
                    navigateToSearch(term);
                  }}
                  className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  const nextSort = value as SortOption;
                  setSortBy(nextSort);
                  setCurrentPage(1);
                  if (searchQuery.trim()) {
                    navigateToSearch(searchQuery, 1, nextSort);
                  } else {
                    updateSearchRoute(searchQuery, 1, nextSort);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[180px] rounded-lg border-border/70 bg-white text-sm shadow-sm">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden gap-1 md:flex">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setViewMode("grid")}
                  aria-label="Ver produtos em grade"
                  aria-pressed={viewMode === "grid"}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setViewMode("list")}
                  aria-label="Ver produtos em lista"
                  aria-pressed={viewMode === "list"}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-border/80 bg-white px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
              <span className="font-semibold text-foreground">
                {products.length} {products.length === 1 ? "resultado nesta página" : "resultados nesta página"}
              </span>
              <span> com </span>
              <span className="font-semibold text-foreground">
                {activeFilterCount} {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
              </span>
              <span>. Ajuste ou limpe os filtros para ampliar a busca.</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
            {selectedCategories.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedCategories, setSelectedCategories)}>
                {item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedBrands.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedBrands, setSelectedBrands)}>
                {item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedDiameters.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedDiameters, setSelectedDiameters)}>
                {item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedAvailability.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedAvailability, setSelectedAvailability)}>
                {availabilityOptions.find((option) => option.value === item)?.label || item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedDeliveryTypes.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedDeliveryTypes, setSelectedDeliveryTypes)}>
                {deliveryOptions.find((option) => option.value === item)?.label || item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedSaleTypes.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedSaleTypes, setSelectedSaleTypes)}>
                {saleTypeOptions.find((option) => option.value === item)?.label || item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedUnitMeasures.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedUnitMeasures, setSelectedUnitMeasures)}>
                {unitMeasureOptions.find((option) => option.value === item)?.label || item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {selectedSubcategories.map((item) => (
              <Badge key={item} variant="secondary" className="cursor-pointer gap-1" onClick={() => toggleFilter(item, selectedSubcategories, setSelectedSubcategories)}>
                {item} <X className="h-3 w-3" />
              </Badge>
            ))}
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => setSearchQuery("")}>
                "{searchQuery}" <X className="h-3 w-3" />
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">
              Limpar tudo
            </button>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <aside className="hidden w-72 shrink-0 lg:block 2xl:w-80">
            <div className="sticky top-24 rounded-lg border border-border/80 bg-white p-4 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <p className="font-semibold">Filtros</p>
              </div>
              {isLoading ? <div className="space-y-3">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-5 w-full" />)}</div> : <FilterContent />}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex gap-2 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-lg border-border/70 bg-white shadow-sm">
                    <Filter className="h-3.5 w-3.5" />
                    Filtros
                    {activeFilterCount > 0 && <Badge className="flex h-5 min-w-5 items-center justify-center p-0 text-[10px]">{activeFilterCount}</Badge>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
              {searchQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg border-border/70 bg-white shadow-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    navigate("/produtos");
                  }}
                >
                  Limpar busca
                </Button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {[...Array(8)].map((_, index) => (
                  <div key={index} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                    <Skeleton className="aspect-square w-full" />
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="mt-1 h-6 w-24" />
                      <Skeleton className="mt-2 h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hasInvalidCategorySlug ? (
              <div className="rounded-lg border border-border/80 bg-white py-16 text-center shadow-sm">
                <p className="eyebrow">Categoria indisponivel</p>
                <p className="mt-2 font-display text-3xl font-bold text-foreground">Não encontrei essa categoria</p>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  O link pode estar antigo ou o slug pode ter mudado. Mantive um fallback seguro para você continuar navegando no catálogo.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={CATALOG_ROUTES.allProducts}>Ver todo o catalogo</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                      navigate("/produtos");
                    }}
                  >
                    Voltar ao catalogo
                  </Button>
                  <Button asChild variant="whatsapp" size="sm">
                    <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.contact)} target="_blank" rel="noopener noreferrer">
                      Pedir ajuda comercial
                    </a>
                  </Button>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-lg border border-border/80 bg-white py-16 text-center shadow-sm">
                <p className="eyebrow">{isOffersRoute ? "Ofertas em ajuste" : "Busca sem resultado"}</p>
                <p className="mt-2 font-display text-3xl font-bold text-foreground">
                  {isOffersRoute ? "Nenhuma oferta disponível agora" : "Nenhum produto encontrado"}
                </p>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  {isOffersRoute
                    ? "Os produtos destacados deste recorte podem ter sido redistribuidos. Use o catálogo principal ou o atendimento comercial para continuar o atendimento."
                    : "Tente ajustar os filtros, revisar a busca ou pedir ajuda comercial pelo WhatsApp para localizar a linha correta."}
                </p>
                {noResultsSuggestions.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tente buscar por</p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {noResultsSuggestions.map((suggestion) => (
                        <button
                          key={`rescue-${suggestion}`}
                          type="button"
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setCurrentPage(1);
                            navigateToSearch(suggestion);
                          }}
                          className="rounded-lg border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    Limpar filtros
                  </Button>
                  {searchQuery ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                        navigate(resolvedBasePath);
                      }}
                    >
                      Remover busca
                    </Button>
                  ) : null}
                  <Button asChild variant="whatsapp" size="sm">
                    <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.contact)} target="_blank" rel="noopener noreferrer">
                      Falar com especialista
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
                  {products.map((product, index) => (
                    <motion.div
                      key={`${product.id}-${product.slug}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>
                {effectiveTotalPages > 1 ? (
                  <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border border-border/80 bg-white px-4 py-3 text-sm shadow-sm md:flex-row">
                    <p className="text-muted-foreground">
                      Pagina <strong className="text-foreground">{effectivePage}</strong> de <strong className="text-foreground">{effectiveTotalPages}</strong> - {effectiveTotal} produto(s)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={effectivePage <= 1}
                        onClick={() => {
                          const nextPage = Math.max(effectivePage - 1, 1);
                          setCurrentPage(nextPage);
                          if (searchQuery.trim()) {
                            navigateToSearch(searchQuery, nextPage, sortBy);
                          } else {
                            updateSearchRoute(searchQuery, nextPage, sortBy);
                          }
                        }}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={effectivePage >= effectiveTotalPages}
                        onClick={() => {
                          const nextPage = Math.min(effectivePage + 1, effectiveTotalPages);
                          setCurrentPage(nextPage);
                          if (searchQuery.trim()) {
                            navigateToSearch(searchQuery, nextPage, sortBy);
                          } else {
                            updateSearchRoute(searchQuery, nextPage, sortBy);
                          }
                        }}
                      >
                        Proxima
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
