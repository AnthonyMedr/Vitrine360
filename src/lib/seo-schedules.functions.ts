import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/integrations/auth/auth-middleware";
import { databaseAdmin } from "@/integrations/postgres/client.server";

async function assertCapability(userId: string, capability: "view_reports" | "manage_technical") {
  const { assertCapability: assertCapabilitySafe } = await import("@/lib/admin-access.server");
  return assertCapabilitySafe(userId, capability);
}

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    await assertCapability(context.userId, "manage_technical");
    const { data, error } = await databaseAdmin
      .from("seo_audit_schedules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    (d: {
      id?: string;
      scope: string;
      campaignSlug?: string | null;
      frequency: string;
      enabled?: boolean;
    }) => ({
      id: d.id,
      scope: ["all", "campaigns", "categories", "products"].includes(d.scope) ? d.scope : "all",
      campaignSlug: d.campaignSlug ? String(d.campaignSlug).slice(0, 200) : null,
      frequency: ["hourly", "daily", "weekly"].includes(d.frequency) ? d.frequency : "daily",
      enabled: d.enabled !== false,
    }),
  )
  .handler(async ({ context, data }) => {
    await assertCapability(context.userId, "manage_technical");
    const row = {
      scope: data.scope,
      campaign_slug: data.campaignSlug,
      frequency: data.frequency,
      enabled: data.enabled,
      next_run_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: updated, error } = await databaseAdmin
        .from("seo_audit_schedules")
        .update(row)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await databaseAdmin
      .from("seo_audit_schedules")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ context, data }) => {
    await assertCapability(context.userId, "manage_technical");
    const { error } = await databaseAdmin.from("seo_audit_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditHistory = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { campaignSlug?: string; limit?: number } | undefined) => ({
    campaignSlug: d?.campaignSlug ? String(d.campaignSlug).slice(0, 200) : undefined,
    limit: Math.min(Math.max(Number(d?.limit ?? 50), 1), 200),
  }))
  .handler(async ({ context, data }) => {
    await assertCapability(context.userId, "view_reports");
    let q = databaseAdmin
      .from("seo_audits")
      .select("id, scope, campaign_slug, triggered_by, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.campaignSlug) q = q.eq("campaign_slug", data.campaignSlug);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const getAuditDetail = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ context, data }) => {
    await assertCapability(context.userId, "view_reports");
    const { data: row, error } = await databaseAdmin
      .from("seo_audits")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
