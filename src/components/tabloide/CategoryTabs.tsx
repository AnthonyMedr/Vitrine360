import { categories as defaultCategories, type Category } from "@/data/categories";
import { cn } from "@/lib/utils";

export function CategoryTabs({
  active,
  onChange,
  categories = defaultCategories,
}: {
  active: string;
  onChange: (id: string) => void;
  categories?: Category[];
}) {
  return (
    <nav className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto no-scrollbar flex gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors",
              active === c.id
                ? "bg-brand text-brand-foreground shadow-card"
                : "bg-surface text-surface-foreground hover:bg-secondary",
            )}
          >
            {c.short}
          </button>
        ))}
      </div>
    </nav>
  );
}
