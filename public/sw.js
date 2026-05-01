/// <reference lib="webworker" />

const CACHE_NAME = "meshlink-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install: cache shell
self.addEventListener("install", (event) => {
  (event as ExtendableEvent).waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  (event as ExtendableEvent).waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const req = (event as FetchEvent).request;
  const url = new URL(req.url);

  // Skip non-GET and Matrix API calls (always network)
  if (req.method !== "GET" || url.pathname.startsWith("/_matrix") || url.pathname.startsWith("/_synapse")) {
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    (event as FetchEvent).respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return resp;
      }))
    );
    return;
  }

  // HTML: network-first, fallback to cache
  (event as FetchEvent).respondWith(
    fetch(req).catch(() => caches.match(req).then((cached) => cached || caches.match("/index.html")))
      .then((resp) => resp || new Response("Offline", { status: 503 }))
  );
});
