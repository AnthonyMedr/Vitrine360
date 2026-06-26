import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/integrations/auth/auth-middleware";
import { databaseAdmin } from "@/integrations/postgres/client.server";
import { getDefaultStoreId } from "@/lib/admin-access";

const KINDS = ["produto", "campanha", "banner", "categoria"] as const;
type Kind = (typeof KINDS)[number];
type ContentItemRow = {
  id: string;
  type: Kind;
  slug: string;
  title: string;
  status: string;
  metadata?: {
    position?: number;
    data?: Record<string, unknown>;
  } | null;
};

async function assertAdmin(userId: string) {
  const { data } = await databaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

function sanitize(d: {
  kind: string;
  slug: string;
  title: string;
  status?: string;
  position?: number;
  data?: Record<string, unknown>;
}) {
  const kind = KINDS.includes(d.kind as Kind) ? (d.kind as Kind) : "produto";
  return {
    kind,
    slug: String(d.slug)
      .slice(0, 200)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-"),
    title: String(d.title).slice(0, 300),
    status: ["publicado", "rascunho", "encerrado"].includes(d.status ?? "")
      ? (d.status as string)
      : "rascunho",
    position: Number.isFinite(d.position) ? Number(d.position) : 0,
    data: (d.data ?? {}) as never,
  };
}

export const listContent = createServerFn({ method: "POST" })
  .validator((d: { kind?: string; includeDrafts?: boolean } | undefined) => ({
    kind: d?.kind && KINDS.includes(d.kind as Kind) ? (d.kind as Kind) : undefined,
    includeDrafts: !!d?.includeDrafts,
  }))
  .handler(async ({ data }) => {
    const storeId = await getDefaultStoreId();
    let q = databaseAdmin
      .from("content_items")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.kind) q = q.eq("type", data.kind);
    if (!data.includeDrafts) q = q.eq("status", "publicado");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const contentRows = (rows ?? []) as ContentItemRow[];
    return {
      items: contentRows.map((row) => ({
        id: row.id,
        kind: row.type,
        slug: row.slug,
        title: row.title,
        status: row.status,
        position: Number(row.metadata?.position ?? 0),
        data: (row.metadata?.data as Record<string, unknown>) ?? row.metadata ?? {},
      })),
    };
  });

export const upsertContent = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    (d: {
      id?: string;
      kind: string;
      slug: string;
      title: string;
      status?: string;
      position?: number;
      data?: Record<string, unknown>;
    }) => ({ id: d.id, ...sanitize(d) }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const storeId = await getDefaultStoreId();
    const payload = {
      store_id: storeId,
      slug: data.slug,
      title: data.title,
      type: data.kind,
      body: null,
      metadata: {
        position: data.position,
        data: data.data ?? {},
      } as never,
      status: data.status,
      created_by: context.userId,
      updated_by: context.userId,
    };
    if (data.id) {
      const { data: row, error } = await databaseAdmin
        .from("content_items")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await databaseAdmin
      .from("content_items")
      .upsert(payload, { onConflict: "store_id,slug,type" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await databaseAdmin.from("content_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
