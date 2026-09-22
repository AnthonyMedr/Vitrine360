import type { DbOrder, DbUser } from "./db";

type AccessUser = DbUser | null;

export function canAccessOrder(order: DbOrder, user: AccessUser, trackingToken?: string | null) {
  if (user?.role === "admin") return { allowed: true, user };
  if (user && order.user_id === user.id) return { allowed: true, user };
  if (trackingToken && trackingToken === order.tracking_token) return { allowed: true, user };
  return { allowed: false, user };
}
