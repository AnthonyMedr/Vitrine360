import { Hand, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-campaign.jpg";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { useSettings } from "@/context/SettingsContext";

export function AttractScreen({ onWake }: { onWake: () => void }) {
  const { settings } = useSettings();

  return (
    <button
      onClick={onWake}
      onTouchStart={onWake}
      className="fixed inset-0 z-[80] flex animate-reveal flex-col items-center justify-center overflow-hidden bg-brand text-brand-foreground"
      aria-label="Toque para comecar"
    >
      <div className="absolute inset-0 opacity-30">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/80 to-brand/40" />
      </div>

      <div className="relative z-10 px-8 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-highlight px-4 py-1.5 text-xs font-black uppercase tracking-widest text-highlight-foreground">
          <Sparkles className="size-3.5" /> Catalogo Digital Interativo
        </div>

        <div className="mb-8 flex justify-center">
          <div className="rounded-3xl bg-background p-4 shadow-pop">
            <StoreLogo
              brand={settings.brand}
              logoUrl={settings.logoUrl}
              imageClassName="size-24"
              fallbackClassName="size-24 bg-background/5 text-foreground"
            />
          </div>
        </div>

        <h1 className="mb-4 font-display text-5xl font-black tracking-tighter sm:text-7xl">
          {settings.brand}
        </h1>
        <p className="mx-auto mb-12 max-w-2xl text-xl text-brand-foreground/80 sm:text-2xl">
          Explore ripados, forros PVC, tetos laminados, pisos vinilicos, chapas UV, aluminio e ACM.
        </p>

        <div className="inline-flex animate-pulse items-center gap-4 rounded-2xl bg-action px-10 py-6 text-action-foreground shadow-pop">
          <Hand className="size-8" />
          <span className="font-display text-2xl font-black uppercase tracking-wide">
            Toque para comecar
          </span>
        </div>
      </div>
    </button>
  );
}
