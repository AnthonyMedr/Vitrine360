import { createMiddleware } from "@tanstack/react-start";
import { getStoredAdminToken } from "@/lib/admin-session";
import { getDevAdminEmail, isDevAdminBypassEnabled } from "@/lib/dev-admin";

export const attachAdminAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getStoredAdminToken();
  return next({
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : isDevAdminBypassEnabled()
        ? {
            "x-dev-admin-bypass": "1",
            "x-dev-admin-email": getDevAdminEmail(),
          }
        : {},
  });
});
