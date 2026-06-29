import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const clientDir = path.join(rootDir, "dist", "client");
const serverEntryPath = path.join(rootDir, "dist", "server", "server.js");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(clientDir, normalizedPath);

  if (!filePath.startsWith(clientDir)) {
    return null;
  }

  return filePath;
}

async function tryServeStatic(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const url = new URL(request.url || "/", "http://localhost");
  const filePath = resolveStaticPath(url.pathname);
  if (!filePath || !existsSync(filePath)) return false;

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) return false;

  response.statusCode = 200;
  response.setHeader("content-length", fileStat.size);
  response.setHeader(
    "cache-control",
    url.pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300",
  );
  response.setHeader(
    "content-type",
    contentTypes.get(path.extname(filePath)) || "application/octet-stream",
  );

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  createReadStream(filePath).pipe(response);
  return true;
}

function createFetchRequest(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "http";
  const hostHeader = request.headers.host || `localhost:${port}`;
  const url = `${protocol}://${hostHeader}${request.url || "/"}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const init = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function sendFetchResponse(nodeResponse, fetchResponse) {
  nodeResponse.statusCode = fetchResponse.status;
  nodeResponse.statusMessage = fetchResponse.statusText;

  fetchResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!fetchResponse.body) {
    nodeResponse.end();
    return;
  }

  Readable.fromWeb(fetchResponse.body).pipe(nodeResponse);
}

const serverEntry = await import(pathToFileURL(serverEntryPath));
const app = serverEntry.default;

if (!app?.fetch) {
  throw new Error("dist/server/server.js nao exporta um handler fetch valido.");
}

const server = createServer(async (request, response) => {
  try {
    if (await tryServeStatic(request, response)) return;

    const fetchRequest = createFetchRequest(request);
    const fetchResponse = await app.fetch(fetchRequest, process.env, {});
    await sendFetchResponse(response, fetchResponse);
  } catch (error) {
    console.error(error);
    response.statusCode = 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Vitrine360 listening on http://${host}:${port}`);
});
