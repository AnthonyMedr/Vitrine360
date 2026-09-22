import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { Server } from "node:http";

let testDataDir: string | null = null;
let serverModulePromise: Promise<typeof import("../server/index.ts")> | null = null;
let dbModulePromise: Promise<typeof import("../server/db.ts")> | null = null;
const adminSessionCache = new Map<string, { csrfToken: string; sessionToken: string; cookieHeader: string }>();

function ensureTestDataDir() {
  if (testDataDir) {
    return testDataDir;
  }

  testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-http-tests-"));
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "test";
  process.env.DATA_DIR = testDataDir;
  process.env.DB_PROVIDER = "sqlite";
  process.env.QUEUE_PROVIDER = "auto";
  process.env.DATABASE_URL = "";
  process.env.REDIS_URL = "";
  return testDataDir;
}

async function getServerModule() {
  ensureTestDataDir();
  serverModulePromise ??= import("../server/index.ts");
  return serverModulePromise;
}

export async function getDbModule() {
  ensureTestDataDir();
  dbModulePromise ??= import("../server/db.ts");
  return dbModulePromise;
}

export async function createTestServer() {
  const { startServer, stopServer } = await getServerModule();
  const server = (await startServer(0)) as Server;
  if (!server.listening) {
    await once(server, "listening");
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Nao foi possivel resolver a porta do servidor de teste");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await stopServer(server);
      if (testDataDir && fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
      testDataDir = null;
      serverModulePromise = null;
      dbModulePromise = null;
      adminSessionCache.clear();
    },
  };
}

export function getSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export function getCookieValue(setCookieHeaders: string[], cookieName: string) {
  const cookieHeader = setCookieHeaders.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookieHeader) return null;
  return cookieHeader.split(";")[0]?.slice(cookieName.length + 1) ?? null;
}

export async function createCsrfSession(baseUrl: string) {
  const bootstrapResponse = await fetch(`${baseUrl}/api/health`);
  const csrfToken = getCookieValue(getSetCookieHeaders(bootstrapResponse), "lojao_csrf");
  if (!csrfToken) {
    throw new Error("Token CSRF nao retornado no bootstrap");
  }

  return {
    csrfToken,
    cookieHeader: `lojao_csrf=${csrfToken}`,
  };
}

export async function createAdminSession(baseUrl: string) {
  const cached = adminSessionCache.get(baseUrl);
  if (cached) {
    return cached;
  }

  const { csrfToken } = await createCsrfSession(baseUrl);

  const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: `lojao_csrf=${csrfToken}`,
    },
    body: JSON.stringify({
      email: "admin@gamelmetal.com",
      password: "admin123",
    }),
  });
  if (!signinResponse.ok) {
    throw new Error(`Falha ao autenticar admin: ${signinResponse.status}`);
  }
  const sessionToken = getCookieValue(getSetCookieHeaders(signinResponse), "gamel_session");
  if (!sessionToken) {
    throw new Error("Cookie de sessao nao retornado");
  }

  const session = {
    csrfToken,
    sessionToken,
    cookieHeader: `lojao_csrf=${csrfToken}; gamel_session=${sessionToken}`,
  };
  adminSessionCache.set(baseUrl, session);
  return session;
}
