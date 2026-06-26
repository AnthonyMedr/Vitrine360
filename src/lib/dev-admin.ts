const DEV_ADMIN_STORAGE_KEY = "vitrine360.dev-admin-bypass";
const DEV_ADMIN_EMAIL = "admin@infinitilabs.com.br";

export function isDevAdminBypassAvailable() {
  const bypassEnabled = (import.meta.env.VITE_ENABLE_DEV_ADMIN_BYPASS ?? "0") === "1";
  if (!bypassEnabled || typeof window === "undefined") return false;
  const host = window.location.hostname;
  return import.meta.env.DEV || host === "127.0.0.1" || host === "localhost";
}

export function isDevAdminBypassEnabled() {
  if (!isDevAdminBypassAvailable() || typeof window === "undefined") return false;
  return window.localStorage.getItem(DEV_ADMIN_STORAGE_KEY) === "1";
}

export function enableDevAdminBypass() {
  if (!isDevAdminBypassAvailable() || typeof window === "undefined") return;
  window.localStorage.setItem(DEV_ADMIN_STORAGE_KEY, "1");
}

export function disableDevAdminBypass() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEV_ADMIN_STORAGE_KEY);
}

export function getDevAdminEmail() {
  return DEV_ADMIN_EMAIL;
}
