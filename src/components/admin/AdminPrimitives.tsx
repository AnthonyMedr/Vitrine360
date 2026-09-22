import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminPageShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-6 text-center">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function AdminLoadingState({ label = "Carregando..." }: { label?: string }) {
  return <div className="min-h-screen bg-muted/30 p-8 text-sm text-muted-foreground">{label}</div>;
}

export function AdminOperationalToolbar({
  title,
  description,
  resultLabel,
  children,
  actions,
}: {
  title: string;
  description?: string;
  resultLabel?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {resultLabel ? <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{resultLabel}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">{children}</div> : null}
    </div>
  );
}

export function AdminQueueCard({
  title,
  eyebrow,
  description,
  meta,
  tone = "neutral",
  action,
}: {
  title: string;
  eyebrow?: ReactNode;
  description?: string;
  meta?: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
  action?: ReactNode;
}) {
  const toneClass = {
    neutral: "border-border bg-background",
    ok: "border-emerald-200 bg-emerald-50/50",
    warn: "border-amber-200 bg-amber-50/70",
    danger: "border-red-200 bg-red-50/70",
  }[tone];

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2 flex flex-wrap gap-2">{eyebrow}</div> : null}
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <div className="mt-3 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
