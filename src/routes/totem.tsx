import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronRight, Home, MessageCircle } from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { QRCode } from "@/components/tabloide/QRCode";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { brandConfig } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { type Category } from "@/data/categories";
import { type Product } from "@/data/products";
import { useIdleReset } from "@/hooks/use-idle-reset";
import { trackEvent, trackWhatsApp } from "@/lib/analytics";
import { buildProductMessage, whatsappUrl } from "@/lib/whatsapp";
import { getPublicStorefront } from "@/lib/commercial.functions";

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_PRODUCTS: Product[] = [];

export const Route = createFileRoute("/totem")({
  loader: () => getPublicStorefront({}),
  head: () => ({
    meta: [
      { title: `${brandConfig.productName} | Totem Interativo` },
      {
        name: "description",
        content: "Modo totem touch screen para autoatendimento e apoio comercial em loja fisica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TotemPage,
});

type Step = "categorias" | "produtos" | "detalhe";

function TotemPage() {
  const initialStorefront = Route.useLoaderData();
  const { settings } = useSettings();
  const storefrontFn = useServerFn(getPublicStorefront);
  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialStorefront,
  });
  const [step, setStep] = useState<Step>("categorias");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("kiosk");
    return () => {
      document.documentElement.classList.remove("kiosk");
    };
  }, []);

  const categories = storefrontQuery.data?.categories ?? EMPTY_CATEGORIES;
  const products = storefrontQuery.data?.products ?? EMPTY_PRODUCTS;
  const totemSettings = storefrontQuery.data?.totem;

  const reset = () => {
    setStep("categorias");
    setCategoryId(null);
    setProduct(null);
  };

  const { idle, wake } = useIdleReset({
    timeoutMs: (totemSettings?.idleResetSeconds ?? settings.idleTimeoutSec) * 1000,
    enabled: true,
    onIdle: reset,
  });

  const visibleCategories = useMemo(
    () =>
      categories.filter((item) => {
        if (item.id === "all") return false;
        if (!totemSettings?.categorySlugs?.length) return true;
        return totemSettings.categorySlugs.includes(item.slug);
      }),
    [categories, totemSettings?.categorySlugs],
  );
  const listProducts = useMemo(() => {
    if (!categoryId) return [];

    const selectedProductIds = totemSettings?.featuredProductSlugs ?? [];
    const categoryProducts = products.filter((item) => item.categoryId === categoryId);
    if (selectedProductIds.length === 0) return categoryProducts;

    const featuredMatches = categoryProducts.filter((item) => selectedProductIds.includes(item.id));
    return featuredMatches.length > 0 ? featuredMatches : categoryProducts;
  }, [categoryId, products, totemSettings?.featuredProductSlugs]);
  const visibleCampaigns = useMemo(
    () =>
      (storefrontQuery.data?.campaigns ?? []).filter((item) => {
        if (!totemSettings?.showCampaigns) return false;
        if (totemSettings.campaignSlugs.length === 0) return item.showOnTotem ?? true;
        return totemSettings.campaignSlugs.includes(item.slug);
      }),
    [storefrontQuery.data?.campaigns, totemSettings],
  );
  const visibleBanners = useMemo(
    () =>
      (storefrontQuery.data?.banners ?? []).filter((item) => {
        if (totemSettings?.bannerSlugs.length === 0) return item.showOnTotem;
        return totemSettings.bannerSlugs.includes(item.slug);
      }),
    [storefrontQuery.data?.banners, totemSettings?.bannerSlugs],
  );

  if (totemSettings?.status === "pausado") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <StorefrontSettingsSync storefront={storefrontQuery.data} />
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Totem pausado</h1>
          <p className="mt-3 text-foreground/70">
            A exibicao do totem foi pausada no painel administrativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen select-none flex-col bg-[#0e0e0e] text-white">
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-white/78 hover:text-action"
          >
            <Home className="size-5" /> Inicio
          </button>
          <div className="flex items-center gap-2">
            <StoreLogo
              brand={settings.brand}
              logoUrl={settings.logoUrl}
              className="size-10 rounded-lg bg-white/5 p-1"
              imageClassName="size-8"
              fallbackClassName="size-8 bg-action/15 text-action"
            />
            <span className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
              {settings.brand}
            </span>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center text-xs font-bold uppercase tracking-[0.22em] text-white/62 hover:text-action"
          >
            Sair do totem
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {step === "categorias" && (
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-action">
                Totem interativo
              </span>
            </div>
            <h1 className="mb-4 text-center font-display text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
              {totemSettings?.introTitle || "Toque na sua "}
              {!totemSettings?.introTitle && <span className="text-action">categoria</span>}
            </h1>
            <p className="mb-12 text-center text-lg text-white/68">
              {totemSettings?.introSubtitle ||
                totemSettings?.welcomeMessage ||
                "Encontre ripados, forros PVC, tetos laminados, pisos vinilicos, chapas UV, aluminio e ACM."}
            </p>
            {totemSettings?.heroMediaUrl && (
              <div className="mb-8 overflow-hidden border border-white/10 bg-white/5">
                <img
                  src={totemSettings.heroMediaUrl}
                  alt={totemSettings.introTitle || settings.brand}
                  className="h-52 w-full object-cover"
                />
              </div>
            )}
            {visibleBanners.length > 0 && (
              <div className="mb-8 grid gap-4 md:grid-cols-2">
                {visibleBanners.slice(0, 2).map((banner) => (
                  <div
                    key={banner.slug}
                    className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(35,39,43,0.92),rgba(14,14,14,0.98))]"
                  >
                    {banner.image && (
                      <img
                        src={banner.image}
                        alt={banner.title}
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-action">
                        Destaque
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white">
                        {banner.title}
                      </h2>
                      {banner.subtitle && (
                        <p className="mt-2 text-sm text-white/70">{banner.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {visibleCampaigns.length > 0 && (
              <div className="mb-8 flex flex-wrap justify-center gap-3">
                {visibleCampaigns.slice(0, 4).map((campaign) => (
                  <span
                    key={campaign.slug}
                    className="border border-white/10 bg-white/6 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white/80"
                  >
                    {campaign.name}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setCategoryId(category.id);
                    setStep("produtos");
                    trackEvent("category_filter", {
                      categoryId: category.id,
                      categoryName: category.name,
                    });
                  }}
                  className="group flex aspect-square min-h-[44px] flex-col items-center justify-center gap-4 border border-white/10 bg-[linear-gradient(180deg,rgba(35,39,43,0.98),rgba(18,19,21,1))] p-6 text-center transition-all hover:-translate-y-1 hover:border-action hover:bg-[linear-gradient(180deg,rgba(255,106,0,0.96),rgba(219,88,0,0.96))] hover:text-action-foreground active:scale-95"
                >
                  <span className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {category.short}
                  </span>
                  <ChevronRight className="size-6 opacity-60 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "produtos" && categoryId && (
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 flex items-center justify-between">
              <button
                onClick={() => {
                  setStep("categorias");
                  setCategoryId(null);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 border border-white/10 bg-white/8 px-5 py-3 font-bold uppercase tracking-[0.16em] text-white hover:bg-white/14"
              >
                <ArrowLeft className="size-5" /> Voltar
              </button>
              <h1 className="text-right font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {categories.find((item) => item.id === categoryId)?.name}
              </h1>
            </div>
            {listProducts.length === 0 ? (
              <p className="py-20 text-center text-white/60">
                Esta categoria ainda nao tem produtos cadastrados. Fale com um vendedor.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {listProducts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setProduct(item);
                      setStep("detalhe");
                      trackEvent("product_view", {
                        productId: item.id,
                        productName: item.name,
                        categoryId: item.categoryId,
                        categoryName: item.categoryName,
                        label: "totem",
                      });
                    }}
                    className="overflow-hidden border border-white/10 bg-[#f4f5f6] text-left text-[#1f2327] shadow-pop transition-transform hover:-translate-y-1 hover:border-action active:scale-95"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-action">
                        {item.categoryName}
                      </span>
                      <p className="mt-1 font-display text-lg font-extrabold leading-tight">
                        {item.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "detalhe" && product && (
          <TotemDetail
            product={product}
            qrTarget={totemSettings?.primaryQrTarget ?? null}
            onBack={() => {
              setProduct(null);
              setStep("produtos");
            }}
            wa={whatsappUrl(buildProductMessage(product, settings), settings.whatsappNumber)}
          />
        )}
      </main>

      {idle && (
        <div
          onClick={wake}
          className="fixed inset-0 z-[80] flex cursor-pointer items-center justify-center bg-black/95 backdrop-blur-md animate-reveal"
        >
          <div className="border border-white/10 bg-[linear-gradient(180deg,rgba(35,39,43,0.92),rgba(14,14,14,0.98))] px-10 py-12 text-center shadow-pop">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-action">
              Toque para comecar
            </p>
            <h2 className="font-display text-6xl font-extrabold tracking-tighter text-white sm:text-8xl">
              {settings.brand}
            </h2>
            <p className="mt-4 text-lg text-white/68">Catalogo digital interativo</p>
          </div>
        </div>
      )}
    </div>
  );
}
function TotemDetail({
  product,
  qrTarget,
  onBack,
  wa,
}: {
  product: Product;
  qrTarget: string | null;
  onBack: () => void;
  wa: string;
}) {
  const { settings } = useSettings();
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex min-h-[44px] items-center gap-2 border border-white/10 bg-white/8 px-5 py-3 font-bold uppercase tracking-[0.16em] text-white hover:bg-white/14"
      >
        <ArrowLeft className="size-5" /> Voltar
      </button>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden border border-white/10 bg-white/5">
          <img
            src={product.image}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        </div>
        <div className="border border-white/10 bg-[linear-gradient(180deg,rgba(35,39,43,0.94),rgba(14,14,14,0.98))] p-6">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-action">
            {product.categoryName}
          </span>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tighter text-white sm:text-5xl">
            {product.name}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">{product.longDescription}</p>

          {product.benefits.length > 0 && (
            <ul className="mt-6 space-y-2 text-white/80">
              {product.benefits.slice(0, 5).map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span className="text-action">-</span> {benefit}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row">
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsApp(product, settings)}
              className="inline-flex min-h-[44px] items-center gap-3 bg-action px-8 py-5 text-lg font-black text-action-foreground shadow-pop active:scale-95"
            >
              <MessageCircle className="size-6" /> Pedir orcamento
            </a>
            <div className="border border-white/10 bg-white p-4 text-foreground">
              <QRCode data={qrTarget || wa} size={120} label="Continue no celular" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
