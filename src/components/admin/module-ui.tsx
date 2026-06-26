import { useMemo, useState } from "react";

/* eslint-disable react-refresh/only-export-components */
export function AdminPageShell({
  title,
  description,
  actions,
  quickGuideTitle,
  quickGuideItems,
  quickGuideNote,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  quickGuideTitle?: string;
  quickGuideItems?: string[];
  quickGuideNote?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      {(quickGuideItems?.length || quickGuideNote) && (
        <section className="border border-border bg-surface p-4 text-sm text-card-foreground shadow-card">
          {quickGuideTitle && <h2 className="font-display text-3xl">{quickGuideTitle}</h2>}
          {quickGuideItems?.length ? (
            <ol className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              {quickGuideItems.map((item, index) => (
                <li key={item} className="flex gap-2">
                  <span className="font-bold text-foreground">{index + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {quickGuideNote && <p className="mt-3 text-xs text-muted-foreground">{quickGuideNote}</p>}
        </section>
      )}
      {children}
    </main>
  );
}

export function AdminCard({
  title,
  children,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5 text-card-foreground shadow-card">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="font-display text-3xl">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminField({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          {label}
        </span>
        {action}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function inputClassName() {
  return "block w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-action";
}

export function textareaClassName() {
  return "block min-h-24 w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-action";
}

export function badgeTone(status: string) {
  switch (status) {
    case "publicado":
    case "publicada":
    case "ativo":
      return "bg-whatsapp/15 text-whatsapp";
    case "agendada":
      return "bg-brand/12 text-brand";
    case "arquivado":
    case "arquivada":
    case "inativo":
    case "inativa":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-action/12 text-action";
  }
}

export function slugifyText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-3 py-3 text-sm">
      <p className="text-muted-foreground">
        Pagina <strong className="text-foreground">{currentPage}</strong> de{" "}
        <strong className="text-foreground">{totalPages}</strong>
      </p>
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="border border-border px-3 py-1.5 font-bold transition-colors hover:bg-highlight disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="border border-border px-3 py-1.5 font-bold transition-colors hover:bg-highlight disabled:opacity-50"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}

export function AdminSelectionField({
  label,
  hint,
  items,
  selected,
  onToggle,
  searchPlaceholder = "Buscar item",
  emptyMessage = "Nenhum item encontrado.",
}: {
  label: string;
  hint?: string;
  items: Array<{ value: string; label: string; meta?: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [term, setTerm] = useState("");

  const filteredItems = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      [item.label, item.value, item.meta]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [items, term]);

  return (
    <AdminField
      label={label}
      hint={
        hint ? `${hint} Selecionados: ${selected.length}.` : `Selecionados: ${selected.length}.`
      }
    >
      <div className="border border-border bg-background p-3">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          className={inputClassName()}
        />
        <div className="mt-3 max-h-56 space-y-2 overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filteredItems.map((item) => (
              <label
                key={item.value}
                className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2 text-sm transition-colors hover:border-action/30"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.meta ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.meta}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={selected.includes(item.value)}
                  onChange={() => onToggle(item.value)}
                  className="size-4"
                />
              </label>
            ))
          )}
        </div>
      </div>
    </AdminField>
  );
}
