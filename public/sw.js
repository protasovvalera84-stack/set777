/**
 * Meshlink Service Worker
 * 
 * Strategy: Network-first for everything.
 * JS/CSS files have hashes in names (Vite) — browser HTTP cache handles them.
 * SW only provides offline fallback for the HTML shell.
 */

const CACHE_NAME = "meshlink-v2";

// Install: cache only the HTML shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/index.html", "/manifest.json"]))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, cache fallback only for HTML
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests
  if (req.method !== "GET") return;

  // Skip Matrix API (always network, never cache)
  if (url.pathname.startsWith("/_matrix") || url.pathname.startsWith("/_synapse")) return;

  // JS/CSS/assets: ALWAYS network (Vite hashes handle caching via HTTP headers)
  if (url.pathname.startsWith("/assets/")) return;

  // HTML pages: network-first, fallback to cached shell
  event.respondWith(
    fetch(req).then((resp) => {
      // Update cache with fresh HTML
      if (resp.ok && req.url.includes(url.origin)) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return resp;
    }).catch(() => {
      return caches.match(req).then((cached) => cached || caches.match("/index.html"));
    }).then((resp) => resp || new Response("Offline", { status: 503 }))
  );
});
