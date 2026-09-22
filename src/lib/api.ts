const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
const CSRF_COOKIE_KEY = "gamel_csrf";

export function resolveApiInput(input: string) {
  if (!input.startsWith("/api")) {
    return input;
  }

  if (API_BASE_URL) {
    return `${API_BASE_URL}${input}`;
  }

  return input;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${name}=`));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(name.length + 1));
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const resource = resolveApiInput(input);
  const method = (init?.method || "GET").toUpperCase();
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", createRequestId());
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_KEY);
    if (csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(resource, {
    ...init,
    credentials: "include",
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || `Erro ${response.status} na API`;
    throw new Error(`${message} [${response.status} ${response.statusText}] ${resource}`);
  }

  return data as T;
}
