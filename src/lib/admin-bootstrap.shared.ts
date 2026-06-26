export const DEFAULT_DEV_ADMIN_EMAIL = "admin@infinitilabs.com.br";
export const LEGACY_DEV_ADMIN_EMAIL = "admin@infiniti.com.br";
export const DEFAULT_BOOTSTRAP_PASSWORD = "V360.Infiniti.Admin!2026";
export const LEGACY_BOOTSTRAP_PASSWORD = "admin@2026";
export const DEFAULT_BOOTSTRAP_TOKEN = "v360-local-bootstrap-token-2026-rotate";

export function getAcceptedLocalAdminEmails() {
  return [DEFAULT_DEV_ADMIN_EMAIL, LEGACY_DEV_ADMIN_EMAIL];
}

export function getAcceptedLocalAdminPasswords() {
  return [DEFAULT_BOOTSTRAP_PASSWORD, LEGACY_BOOTSTRAP_PASSWORD];
}

export function matchesLocalAdminCredentials(email: string, password: string) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedPassword = String(password || "");

  return (
    getAcceptedLocalAdminEmails().includes(normalizedEmail) &&
    getAcceptedLocalAdminPasswords().includes(normalizedPassword)
  );
}
