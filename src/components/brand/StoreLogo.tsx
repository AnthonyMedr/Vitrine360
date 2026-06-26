import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) return "V";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function StoreLogo({
  brand,
  logoUrl,
  className,
  imageClassName,
  fallbackClassName,
}: {
  brand: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  if (logoUrl) {
    return (
      <img src={logoUrl} alt={brand} className={cn("object-contain", imageClassName, className)} />
    );
  }

  return (
    <div
      aria-label={brand}
      title={brand}
      className={cn(
        "grid place-items-center rounded-lg bg-brand/15 text-brand",
        fallbackClassName,
        className,
      )}
    >
      {brand.trim().length <= 2 ? (
        <Store className="size-5" />
      ) : (
        <span className="font-display text-xs font-extrabold uppercase tracking-tight">
          {getInitials(brand)}
        </span>
      )}
    </div>
  );
}
