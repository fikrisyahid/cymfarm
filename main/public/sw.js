// CymFarm Offline PWA Service Worker Cache
const CACHE_NAME = "cymfarm-cache-v3";

const STATIC_ASSETS = [
  "/lapangan",
  "/riwayat",
  "/login",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

// Install: pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Strategy for offline PWA
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Jangan intercept API sync / auth (biarkan online / ditangani Dexie & UI)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 2. Handle HTML navigation (buka halaman atau restart app)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Jika online dan respon 200, update cache halaman ini
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // OFFLINE: cari fallback halaman
          const cache = await caches.open(CACHE_NAME);
          const matched =
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/lapangan"));
          return matched || Response.error();
        })
    );
    return;
  }

  // 3. Handle static assets (_next/static, css, js, icons, images)
  // Cache-first, fallback network, auto-cache new static files
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.pathname.startsWith("/_next/static/") ||
              url.pathname.endsWith(".svg") ||
              url.pathname.endsWith(".png") ||
              url.pathname.endsWith(".ico") ||
              url.pathname.endsWith(".json"))
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return Response.error();
        });
    })
  );
});
