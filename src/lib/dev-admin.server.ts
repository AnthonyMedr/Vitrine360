const DEV_ADMIN_EMAIL = "admin@infinitilabs.com.br";
const DEV_ADMIN_USER_ID = "dev-admin-local";

export function isDevAdminBypassRequest(headers?: Headers) {
  if (!headers) return false;
  const bypassEnabled = (process.env.VITE_ENABLE_DEV_ADMIN_BYPASS ?? "0") === "1";
  if (!bypassEnabled || headers.get("x-dev-admin-bypass") !== "1") return false;

  const hostHeader =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? headers.get("origin") ?? "";
  return (
    hostHeader.includes("127.0.0.1") ||
    hostHeader.includes("localhost") ||
    process.env.NODE_ENV !== "production"
  );
}

export function getDevAdminContext() {
  return {
    userId: DEV_ADMIN_USER_ID,
    claims: {
      sub: DEV_ADMIN_USER_ID,
      email: DEV_ADMIN_EMAIL,
      role: "admin",
    },
  };
}

export function hasDatabaseAdminAccess() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDevAdminEmail() {
  return DEV_ADMIN_EMAIL;
}
