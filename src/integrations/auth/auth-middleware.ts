import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readBootstrapEmail, requireBootstrapToken } from "@/lib/bootstrap-admin.server";
import { getDevAdminContext, isDevAdminBypassRequest } from "@/lib/dev-admin.server";

export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  if (isDevAdminBypassRequest(request.headers)) {
    return next({ context: getDevAdminContext() });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing admin token");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (token !== requireBootstrapToken()) {
    throw new Error("Unauthorized: Invalid admin token");
  }

  return next({
    context: {
      userId: "bootstrap-admin",
      claims: {
        sub: "bootstrap-admin",
        email: readBootstrapEmail(),
        role: "admin",
      },
    },
  });
});
