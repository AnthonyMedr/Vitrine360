import { createFileRoute } from "@tanstack/react-router";
import { databaseAdmin } from "@/integrations/postgres/client.server";
import { auditSeo } from "@/lib/seo-audit.functions";

/**
 * Runs scheduled SEO audits. Called by pg_cron periodically.
 * Picks every schedule due (next_run_at <= now() and enabled),
 * executes audit and stores result in seo_audits, then schedules next run.
 */
export const Route = createFileRoute("/api/public/cron/seo-audit")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const { data: schedules, error } = await databaseAdmin
          .from("seo_audit_schedules")
          .select("*")
          .eq("enabled", true)
          .lte("next_run_at", now.toISOString())
          .limit(20);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        const results: Array<{ id: string; ok: boolean; error?: string }> = [];
        for (const s of schedules ?? []) {
          try {
            const scope = (s.scope as "all" | "campaigns" | "categories" | "products") ?? "all";
            const result = await auditSeo({ data: { scope } });
            await databaseAdmin.from("seo_audits").insert({
              scope,
              campaign_slug: s.campaign_slug,
              triggered_by: "cron",
              summary: result.summary as never,
              pages: result.pages as never,
            });
            const nextMs =
              s.frequency === "hourly"
                ? 3600_000
                : s.frequency === "weekly"
                  ? 7 * 86400_000
                  : 86400_000;
            await databaseAdmin
              .from("seo_audit_schedules")
              .update({
                last_run_at: now.toISOString(),
                next_run_at: new Date(now.getTime() + nextMs).toISOString(),
              })
              .eq("id", s.id);
            results.push({ id: s.id, ok: true });
          } catch (e) {
            results.push({ id: s.id, ok: false, error: (e as Error).message });
          }
        }
        return Response.json({ ok: true, ran: results.length, results });
      },
      GET: async () => Response.json({ ok: true, endpoint: "cron/seo-audit" }),
    },
  },
});
