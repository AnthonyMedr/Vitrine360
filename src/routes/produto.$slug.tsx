import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lightbulb, MessageCircle, QrCode } from "lucide-react";
import { FloatingWhatsApp } from "@/components/tabloide/FloatingWhatsApp";
import { Footer } from "@/components/tabloide/Footer";
import { ProductCard } from "@/components/tabloide/ProductCard";
import { ProductModal } from "@/components/tabloide/ProductModal";
import { QRCode } from "@/components/tabloide/QRCode";
import { StorefrontSettingsSync } from "@/components/tabloide/StorefrontSettingsSync";
import { GlobalHeader } from "@/components/vitrine360/GlobalHeader";
import { absoluteUrl, brandConfig } from "@/config/brand";
import { useSettings } from "@/context/SettingsContext";
import { type Product } from "@/data/products";
import { getPublicProduct, getPublicStorefront } from "@/lib/commercial.functions";
import { trackWhatsApp } from "@/lib/analytics";
import {
  buildBreadcrumbJsonLd,
  buildJsonLdScripts,
  buildProductJsonLd,
} from "@/lib/seo-structured-data";
import { buildProductMessage, whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ params }) => ({
    storefront: await getPublicStorefront({}),
    product: await getPublicProduct({ data: { slug: params.slug } }),
  }),
  head: ({ params, loaderData }) => {
    const url = absoluteUrl(`/produto/${params.slug}`);
    const product = loaderData?.product;
    const categorySlug = loaderData?.storefront?.categories?.find(
      (item) => item.id === product?.categoryId,
    )?.slug;
    return {
      meta: [
        {
          title: product ? `${product.name} | ${brandConfig.productName}` : "Produto | Vitrine360",
        },
        {
          name: "description",
          content: product?.description || "Produto do catalogo comercial do Vitrine360.",
        },
        {
          property: "og:title",
          content: product ? `${product.name} | Vitrine360` : "Produto | Vitrine360",
        },
        {
          property: "og:description",
          content: product?.description || "Produto do catalogo comercial.",
        },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(product?.image ? [{ property: "og:image", content: product.image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: buildJsonLdScripts([
        buildBreadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Catalogo", path: "/catalogo" },
          {
            name: product?.categoryName ?? "Categoria",
            path: categorySlug ? `/categoria/${categorySlug}` : "/catalogo",
          },
          { name: product?.name ?? "Produto", path: `/produto/${params.slug}` },
        ]),
        product
          ? buildProductJsonLd({
              id: product.id,
              name: product.name,
              description: product.description,
              categoryName: product.categoryName,
              image: product.image,
              price: product.price,
              unit: product.unit,
              path: `/produto/${params.slug}`,
            })
          : null,
      ]),
    };
  },
  component: ProdutoPage,
});

function ProdutoPage() {
  const initialData = Route.useLoaderData();
  const slug = Route.useParams().slug;
  const { settings } = useSettings();
  const storefrontFn = useServerFn(getPublicStorefront);
  const productFn = useServerFn(getPublicProduct);
  const [imgIndex, setImgIndex] = useState(0);
  const [open, setOpen] = useState<Product | null>(null);

  const storefrontQuery = useQuery({
    queryKey: ["public-storefront"],
    queryFn: () => storefrontFn({}),
    initialData: initialData.storefront,
  });
  const productQuery = useQuery({
    queryKey: ["public-product", slug],
    queryFn: () => productFn({ data: { slug } }),
    initialData: initialData.product,
  });

  const product = productQuery.data ?? null;

  if (!productQuery.isLoading && !product) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Produto nao encontrado</h1>
          <Link to="/catalogo" className="mt-6 inline-block font-bold text-action">
            Ver catalogo
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const gallery = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];
  const wa = whatsappUrl(buildProductMessage(product, settings), settings.whatsappNumber);
  const related = (product.related ?? [])
    .map(
      (item) => storefrontQuery.data?.products.find((candidate) => candidate.id === item) ?? null,
    )
    .filter((item): item is Product => Boolean(item));

  return (
    <div className="min-h-screen bg-background">
      <StorefrontSettingsSync storefront={storefrontQuery.data} />
      <GlobalHeader />
      <main>
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-action">
              Inicio
            </Link>
            <span>/</span>
            <Link to="/catalogo" className="hover:text-action">
              Catalogo
            </Link>
            <span>/</span>
            <span className="font-bold text-foreground">{product.name}</span>
          </nav>
        </div>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-8 lg:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl bg-surface">
              <img
                src={gallery[imgIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {gallery.length > 1 && (
              <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
                {gallery.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setImgIndex(index)}
                    className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      index === imgIndex
                        ? "border-action ring-2 ring-action/30"
                        : "border-border opacity-70"
                    }`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
              {product.categoryName}
            </span>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tighter sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {product.longDescription}
            </p>

            {product.tip && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-highlight/40 bg-highlight/20 p-4">
                <Lightbulb className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm">
                  <span className="mr-2 text-[11px] font-bold uppercase tracking-wider">Dica:</span>
                  {product.tip}
                </p>
              </div>
            )}

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">Beneficios</h2>
                <ul className="space-y-2.5">
                  {product.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-5 shrink-0 text-whatsapp" /> {benefit}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">Aplicacoes</h2>
                <ul className="space-y-2.5">
                  {product.applications.map((application) => (
                    <li key={application} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-5 shrink-0 text-brand" /> {application}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsApp(product, settings)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-action px-6 py-4 font-black text-action-foreground shadow-card hover:brightness-110"
              >
                <MessageCircle className="size-5" /> Pedir orcamento
              </a>
              <details className="rounded-xl bg-surface">
                <summary className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-4 font-bold">
                  <QrCode className="size-5" /> Levar no celular
                </summary>
                <div className="mt-1 grid place-items-center rounded-xl bg-foreground p-5 text-background">
                  <QRCode
                    data={wa}
                    size={180}
                    label={`Continue no celular sobre ${product.name}`}
                  />
                </div>
              </details>
            </div>
          </div>
        </section>

        {product.specs && product.specs.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-12">
            <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight">
              Ficha tecnica
            </h2>
            <dl className="grid gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2">
              {product.specs.map((spec) => (
                <div key={spec.label} className="bg-card p-4">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {spec.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-16">
            <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight">
              Combina com
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {related.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} onOpen={setOpen} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <FloatingWhatsApp />
      <ProductModal product={open} onClose={() => setOpen(null)} onOpenRelated={setOpen} />
    </div>
  );
}
