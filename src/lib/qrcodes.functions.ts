import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/integrations/auth/auth-middleware";
import { databaseAdmin } from "@/integrations/postgres/client.server";

async function assertAdmin(userId: string) {
  const { data } = await databaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listQRCodes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await databaseAdmin
    .from("qrcodes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const createQRCode = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { label: string; url: string; scope?: string; refId?: string }) => ({
    label: String(d.label).slice(0, 200),
    url: String(d.url).slice(0, 1000),
    scope: (d.scope ?? "custom").slice(0, 40),
    refId: d.refId ? String(d.refId).slice(0, 200) : null,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await databaseAdmin
      .from("qrcodes")
      .insert({
        label: data.label,
        url: data.url,
        scope: data.scope,
        ref_id: data.refId,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteQRCode = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await databaseAdmin.from("qrcodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const incrementQRScan = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data }) => {
    const { data: row } = await databaseAdmin
      .from("qrcodes")
      .select("scan_count")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false };
    await databaseAdmin
      .from("qrcodes")
      .update({ scan_count: (row.scan_count ?? 0) + 1 })
      .eq("id", data.id);
    return { ok: true };
  });
