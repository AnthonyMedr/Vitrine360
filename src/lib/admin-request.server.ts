import { readBootstrapEmail, requireBootstrapToken } from "@/lib/bootstrap-admin.server";
import { getDevAdminContext, isDevAdminBypassRequest } from "@/lib/dev-admin.server";

export function requireAdminRequest(headers: globalThis.Headers) {
  if (isDevAdminBypassRequest(headers)) {
    return getDevAdminContext();
  }

  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing admin token");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (token !== requireBootstrapToken()) {
    throw new Error("Unauthorized: Invalid admin token");
  }

  return {
    userId: "bootstrap-admin",
    claims: {
      sub: "bootstrap-admin",
      email: readBootstrapEmail(),
      role: "admin",
    },
  };
}
