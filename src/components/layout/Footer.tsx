import { Link } from "react-router-dom";
import { ChevronUp, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { STORE_INFO, WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";
import { buildCategoryPath } from "@/lib/catalogRoutes";
import { useCategories } from "@/hooks/useCategories";

const institutionalLinks = [
  { label: "Início", href: "/" },
  { label: "Produtos", href: "/produtos" },
  { label: "Quem Somos", href: "/sobre" },
  { label: "Contato", href: "/contato" },
  { label: "Políticas", href: "/politicas" },
];

export function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const { data: categories } = useCategories();
  const footerCategories = (categories ?? []).map((category) => ({
    label: category.name,
    href: buildCategoryPath(category.slug),
  }));

  return (
    <footer className="mt-10 bg-black text-white">
      <button onClick={scrollToTop} className="flex w-full items-center justify-center gap-2 border-y border-white/10 bg-[#1b1b1b] py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/68 hover:bg-[#242424] hover:text-white">
        <ChevronUp className="h-4 w-4" />
        Voltar ao topo
      </button>

      <div className="shell-wide grid max-w-[1360px] gap-8 py-10 lg:grid-cols-[1.1fr_1.15fr_0.7fr_1fr]">
        <div>
          <Link to="/" className="footer-logo group inline-flex items-center gap-3" aria-label="Página inicial GAMEL">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden" aria-hidden="true">
              <img
                src="/assets/brand/gamel-icone-512.png"
                alt=""
                className="scale-[1.45] transition-transform duration-300 group-hover:scale-[1.52]"
              />
            </span>
            <span>
              <span className="block font-display text-[1.75rem] leading-[0.9] tracking-[0.025em] text-white">GAMEL</span>
              <span className="mt-1 block text-[10px] font-medium text-white/58">Garanhuns/PE</span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/66">Tetos laminados vinílicos, pisos, ripados, chapas UV, policarbonato e telhas PVC para obras e acabamentos.</p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff6417]">{STORE_INFO.domain}</p>
        </div>

        <div>
          <h4 className="text-base text-white">Categorias</h4>
          <div className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {footerCategories.map((item) => (
              <Link key={item.href + item.label} to={item.href} className="block text-white/68 hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-base text-white">Links úteis</h4>
          <div className="mt-4 grid gap-2.5 text-sm">
            {institutionalLinks.map((item) => (
              <Link key={item.href} to={item.href} className="block text-white/68 hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-base text-white">Contato</h4>
          <div className="mt-4 space-y-3.5 text-sm leading-6 text-white/68">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-[#ff6417]" />
              <span>{STORE_INFO.address.full}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-[#ff6417]" />
              <span>{STORE_INFO.phone || "Canal comercial via WhatsApp"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-[#ff6417]" />
              <span>{STORE_INFO.email || "E-mail comercial em confirmação"}</span>
            </div>
            <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.default)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-[#ff6417] px-4 py-2 font-semibold text-white hover:bg-[#e9560b]">
              <MessageCircle className="h-4 w-4" />
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell-wide flex max-w-[1360px] flex-col gap-3 py-4 pr-20 text-xs text-white/52 md:flex-row md:items-center md:justify-between lg:pr-24">
          <p>
            {new Date().getFullYear()} GAMEL. Catálogo digital de produtos e acabamentos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/politicas" className="inline-flex min-h-9 items-center rounded-md px-3 font-semibold text-white/68 hover:bg-white/8 hover:text-white">
              Privacidade e termos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
