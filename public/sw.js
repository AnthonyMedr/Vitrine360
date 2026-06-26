// Vitrine360 - offline cache service worker
const CACHE_VERSION = "v1";
const CACHE_NAME = `vitrine360-cache-${CACHE_VERSION}`;
const IMG_CACHE = `vitrine360-img-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMG_CACHE && k.startsWith("vitrine360-"))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.hostname.includes("api.qrserver.com")) return;

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.includes("text/html");
  const isImage =
    req.destination === "image" ||
    /\.(png|jpg|jpeg|webp|svg|gif|avif)$/i.test(url.pathname) ||
    url.hostname.includes("api.qrserver.com");

  if (isHTML) {
    // NetworkFirst with cache fallback
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(req)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (isImage) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMG_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return hit || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (
          fresh.ok &&
          (req.destination === "script" ||
            req.destination === "style" ||
            req.destination === "font")
        ) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return hit || Response.error();
      }
    })(),
  );
});
