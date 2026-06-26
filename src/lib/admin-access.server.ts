/* eslint-disable @typescript-eslint/no-explicit-any */
import { databaseAdmin } from "@/integrations/postgres/client.server";
import { hasDatabaseAdminAccess } from "@/lib/dev-admin.server";

export const ADMIN_ROLES = ["admin", "infiniti_master", "store_admin"] as const;
export const EDITOR_ROLES = [
  "admin",
  "infiniti_master",
  "store_admin",
  "commercial_operator",
  "editor",
] as const;
export const VIEWER_ROLES = [
  "admin",
  "infiniti_master",
  "store_admin",
  "commercial_operator",
  "editor",
  "viewer",
] as const;

export type AdminRole = (typeof VIEWER_ROLES)[number];
export type AdminCapability =
  | "view_dashboard"
  | "manage_products"
  | "manage_categories"
  | "manage_campaigns"
  | "manage_banners"
  | "manage_media"
  | "manage_store"
  | "manage_totem"
  | "manage_vitrine"
  | "manage_users"
  | "view_reports"
  | "manage_technical";

type UserRoleRow = {
  id: string;
  role: AdminRole;
  store_id: string | null;
};

const ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  admin: [
    "view_dashboard",
    "manage_products",
    "manage_categories",
    "manage_campaigns",
    "manage_banners",
    "manage_media",
    "manage_store",
    "manage_totem",
    "manage_vitrine",
    "manage_users",
    "view_reports",
    "manage_technical",
  ],
  infiniti_master: [
    "view_dashboard",
    "manage_products",
    "manage_categories",
    "manage_campaigns",
    "manage_banners",
    "manage_media",
    "manage_store",
    "manage_totem",
    "manage_vitrine",
    "manage_users",
    "view_reports",
    "manage_technical",
  ],
  store_admin: [
    "view_dashboard",
    "manage_products",
    "manage_categories",
    "manage_campaigns",
    "manage_banners",
    "manage_media",
    "manage_store",
    "manage_totem",
    "manage_vitrine",
    "manage_users",
    "view_reports",
  ],
  commercial_operator: [
    "view_dashboard",
    "manage_products",
    "manage_categories",
    "manage_campaigns",
    "manage_banners",
    "manage_media",
    "view_reports",
  ],
  editor: [
    "view_dashboard",
    "manage_products",
    "manage_categories",
    "manage_campaigns",
    "manage_banners",
    "manage_media",
    "view_reports",
  ],
  viewer: ["view_dashboard", "view_reports"],
};

export async function getDefaultStoreId() {
  if (!hasDatabaseAdminAccess()) return "dev-store-local";

  const { data, error } = await (databaseAdmin as any)
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function getUserRoles(userId: string) {
  if (!hasDatabaseAdminAccess() && userId === "dev-admin-local") {
    return [
      {
        id: "dev-admin-local-role",
        role: "infiniti_master" as const,
        store_id: "dev-store-local",
      },
    ];
  }

  const { data, error } = await (databaseAdmin as any)
    .from("user_roles")
    .select("id, role, store_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as UserRoleRow[];
}

export async function assertRole(
  userId: string,
  allowedRoles: readonly string[],
  storeId?: string | null,
) {
  if (!hasDatabaseAdminAccess() && userId === "dev-admin-local") {
    return { role: "infiniti_master", storeId: storeId ?? "dev-store-local" };
  }

  const roles = await getUserRoles(userId);
  const matched = roles.find((item) => {
    if (!allowedRoles.includes(item.role)) return false;
    if (!storeId) return true;
    return item.store_id === storeId || item.role === "infiniti_master" || item.role === "admin";
  });

  if (!matched) {
    throw new Error("Forbidden");
  }

  return { role: matched.role, storeId: matched.store_id };
}

export async function getUserCapabilities(userId: string, storeId?: string | null) {
  const roles = await getUserRoles(userId);
  const scopedRoles = roles.filter((item) => {
    if (!storeId) return true;
    return item.store_id === storeId || item.role === "infiniti_master" || item.role === "admin";
  });

  const capabilities = new Set<AdminCapability>();
  for (const roleRow of scopedRoles) {
    for (const capability of ROLE_CAPABILITIES[roleRow.role] ?? []) {
      capabilities.add(capability);
    }
  }

  return {
    roles: scopedRoles.map((item) => item.role),
    capabilities: Array.from(capabilities),
  };
}

export async function assertCapability(
  userId: string,
  capability: AdminCapability,
  storeId?: string | null,
) {
  if (!hasDatabaseAdminAccess() && userId === "dev-admin-local") {
    return { role: "infiniti_master", storeId: storeId ?? "dev-store-local" };
  }

  const roles = await getUserRoles(userId);
  const matched = roles.find((item) => {
    const allowed = ROLE_CAPABILITIES[item.role] ?? [];
    if (!allowed.includes(capability)) return false;
    if (!storeId) return true;
    return item.store_id === storeId || item.role === "infiniti_master" || item.role === "admin";
  });

  if (!matched) {
    throw new Error("Forbidden");
  }

  return { role: matched.role, storeId: matched.store_id };
}

export function getRoleCapabilityMap() {
  return ROLE_CAPABILITIES;
}

export async function resolveStoreScope(userId: string, requestedStoreId?: string | null) {
  if (requestedStoreId) return requestedStoreId;

  const roles = await getUserRoles(userId);
  const storeScoped = roles.find((item) => item.store_id)?.store_id;
  if (storeScoped) return storeScoped;

  return getDefaultStoreId();
}

export async function writeAuditLog(input: {
  storeId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!hasDatabaseAdminAccess()) return;

  await (databaseAdmin as any).from("audit_logs").insert({
    store_id: input.storeId ?? null,
    user_id: input.userId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
