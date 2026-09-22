import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WhatsAppButton } from "./WhatsAppButton";
import { CampaignTopBar } from "@/components/marketing/CampaignTopBar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const showFloatingWhatsApp = !location.pathname.startsWith("/orcamento") && !location.pathname.startsWith("/admin");

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background))_68%,hsl(var(--muted)/0.4))]">
      <CampaignTopBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {showFloatingWhatsApp ? <WhatsAppButton floating label="Fale conosco" origin="floating_widget" /> : null}
    </div>
  );
}
