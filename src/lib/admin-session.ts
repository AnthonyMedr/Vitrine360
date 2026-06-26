const ADMIN_TOKEN_KEY = "vitrine360.admin-token";
const ADMIN_EMAIL_KEY = "vitrine360.admin-email";

export function getStoredAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getStoredAdminEmail() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_EMAIL_KEY);
}

export function storeAdminSession(input: { token: string; email: string }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, input.token);
  window.localStorage.setItem(ADMIN_EMAIL_KEY, input.email);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_EMAIL_KEY);
}

export function hasStoredAdminSession() {
  return Boolean(getStoredAdminToken());
}
