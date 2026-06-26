import {
  DEFAULT_BOOTSTRAP_PASSWORD,
  DEFAULT_BOOTSTRAP_TOKEN,
  DEFAULT_DEV_ADMIN_EMAIL,
  matchesLocalAdminCredentials,
} from "@/lib/admin-bootstrap.shared";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function isLocalRuntime() {
  const appBaseUrl = readEnv("APP_BASE_URL");
  return (
    !appBaseUrl ||
    appBaseUrl.includes("127.0.0.1") ||
    appBaseUrl.includes("localhost") ||
    process.env.NODE_ENV !== "production"
  );
}

export function readBootstrapEmail() {
  return readEnv("ADMIN_BOOTSTRAP_EMAIL") || DEFAULT_DEV_ADMIN_EMAIL;
}

export function requireBootstrapPassword() {
  const password = readEnv("ADMIN_BOOTSTRAP_PASSWORD") || DEFAULT_BOOTSTRAP_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD nao configurado.");
  }
  return password;
}

export function requireBootstrapToken() {
  const token = readEnv("ADMIN_BOOTSTRAP_TOKEN") || DEFAULT_BOOTSTRAP_TOKEN;
  if (!token) {
    throw new Error("ADMIN_BOOTSTRAP_TOKEN nao configurado.");
  }
  return token;
}

export function matchesBootstrapCredentials(email: string, password: string) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const normalizedPassword = String(password || "");

  if (
    normalizedEmail === readBootstrapEmail() &&
    normalizedPassword === requireBootstrapPassword()
  ) {
    return true;
  }

  if (!isLocalRuntime()) {
    return false;
  }

  return matchesLocalAdminCredentials(normalizedEmail, normalizedPassword);
}
