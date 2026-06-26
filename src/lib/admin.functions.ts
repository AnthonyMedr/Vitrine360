import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/integrations/auth/auth-middleware";
import { databaseAdmin } from "@/integrations/postgres/client.server";
import { hasDatabaseAdminAccess } from "@/lib/dev-admin.server";
import { getDefaultStoreId } from "@/lib/admin-access";

const ADMIN_LIKE_ROLES = ["admin", "infiniti_master", "store_admin"];

/**
 * Concede o papel de admin ao usuário autenticado APENAS se ainda não
 * existir nenhum admin no sistema. Útil para o primeiro acesso.
 */
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    if (!hasDatabaseAdminAccess() && context.userId === "dev-admin-local") {
      return { claimed: true, bypass: true };
    }

    const { userId } = context;
    const { count, error: countError } = await databaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", ADMIN_LIKE_ROLES);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) return { claimed: false, reason: "already_exists" as const };
    const storeId = await getDefaultStoreId();
    const { error } = await databaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "store_admin", store_id: storeId });
    if (error) throw new Error(error.message);
    return { claimed: true };
  });

/** Verifica se o usuário autenticado é admin. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    if (!hasDatabaseAdminAccess() && context.userId === "dev-admin-local") {
      return { isAdmin: true, bypass: true };
    }

    const { userId } = context;
    const { data, error } = await databaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ADMIN_LIKE_ROLES)
      .limit(1);
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data && data.length > 0), roles: data ?? [] };
  });

/** Resumo agregado para o painel administrativo. */
export const getAdminDashboard = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    (d: { from?: string; to?: string; campaign?: string; category?: string } | undefined) => ({
      from: typeof d?.from === "string" ? d.from.slice(0, 30) : undefined,
      to: typeof d?.to === "string" ? d.to.slice(0, 30) : undefined,
      campaign: typeof d?.campaign === "string" ? d.campaign.slice(0, 80) : undefined,
      category: typeof d?.category === "string" ? d.category.slice(0, 80) : undefined,
    }),
  )
  .handler(async ({ context, data }) => {
    if (!hasDatabaseAdminAccess() && context.userId === "dev-admin-local") {
      const fromIso = data.from
        ? new Date(data.from).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toIso = data.to
        ? new Date(data.to + "T23:59:59").toISOString()
        : new Date().toISOString();

      return {
        range: {
          from: fromIso,
          to: toIso,
          campaign: data.campaign ?? null,
          category: data.category ?? null,
        },
        leads: [],
        totals: {
          leads: 0,
          events: 0,
          whatsapp: 0,
          views: 0,
          qr: 0,
          searches: 0,
          aiRecommend: 0,
          roomSimulator: 0,
        },
        topProducts: [],
        topCategories: [],
        perDay: [],
      };
    }

    const { userId } = context;
    const { data: roleRow } = await databaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ADMIN_LIKE_ROLES)
      .limit(1);
    if (!roleRow || roleRow.length === 0) throw new Error("Forbidden");

    const fromIso = data.from
      ? new Date(data.from).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toIso = data.to
      ? new Date(data.to + "T23:59:59").toISOString()
      : new Date().toISOString();

    let leadsQ = databaseAdmin
      .from("leads")
      .select("*")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(500);
    let eventsQ = databaseAdmin
      .from("analytics_events")
      .select("event_type, product_id, category, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(5000);

    const term = data.category || data.campaign;
    if (term) {
      leadsQ = leadsQ.ilike("category", `%${term}%`);
      eventsQ = eventsQ.ilike("category", `%${term}%`);
    }

    const [{ data: leads }, { data: events }] = await Promise.all([leadsQ, eventsQ]);

    const byType: Record<string, number> = {};
    const byProduct = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const e of events ?? []) {
      byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
      if (e.product_id) byProduct.set(e.product_id, (byProduct.get(e.product_id) ?? 0) + 1);
      if (e.category) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
      const day = (e.created_at ?? "").slice(0, 10);
      if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    return {
      range: {
        from: fromIso,
        to: toIso,
        campaign: data.campaign ?? null,
        category: data.category ?? null,
      },
      leads: leads ?? [],
      totals: {
        leads: leads?.length ?? 0,
        events: events?.length ?? 0,
        whatsapp: byType.product_whatsapp ?? 0,
        views: byType.product_view ?? 0,
        qr: byType.product_qr ?? 0,
        searches: byType.search ?? 0,
        aiRecommend: byType.ai_recommend ?? 0,
        roomSimulator: byType.room_simulator ?? 0,
      },
      topProducts: Array.from(byProduct.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topCategories: Array.from(byCategory.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      perDay: Array.from(byDay.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  });
