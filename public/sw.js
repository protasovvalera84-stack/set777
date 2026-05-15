/**
 * Meshlink Service Worker v3
 *
 * Strategy:
 * - HTML shell: cache-first with network update
 * - JS/CSS assets: network-first (Vite hashes handle HTTP cache)
 * - Matrix media: cache-first (images, avatars, thumbnails)
 * - Matrix API: always network (never cache)
 * - Icons/manifest: cache-first
 */

const CACHE_NAME = "meshlink-v3";
const MEDIA_CACHE = "meshlink-media-v1";
const MAX_MEDIA_ITEMS = 500;

// Install: cache HTML shell + icons
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/index.html", "/manifest.json", "/icons/icon.svg", "/icons/icon-256.png"])
    )
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Matrix API: always network, never cache
  if (url.pathname.startsWith("/_matrix/client") || url.pathname.startsWith("/_synapse")) return;

  // Matrix media (avatars, thumbnails, downloads): cache-first
  if (url.pathname.includes("/_matrix/media")) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((resp) => {
            if (resp.ok) {
              cache.put(req, resp.clone());
              // Limit cache size
              trimCache(MEDIA_CACHE, MAX_MEDIA_ITEMS);
            }
            return resp;
          }).catch(() => new Response("", { status: 404 }));
        })
      )
    );
    return;
  }

  // JS/CSS assets with hashes: network-first (HTTP cache handles them)
  if (url.pathname.startsWith("/assets/")) return;

  // HTML/manifest/icons: network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("/index.html"))
      )
      .then((resp) => resp || new Response("Offline", { status: 503 }))
  );
});

// Trim cache to max items
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, maxItems));
      }
    });
  });
}
