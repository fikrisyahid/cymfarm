// CymFarm Offline PWA Service Worker Cache
const CACHE_NAME = "cymfarm-cache-v2";

const STATIC_ASSETS = [
  "/lapangan",
  "/riwayat",
  "/login",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
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

// Fetch: Network first for API/sync, Cache first for offline shell assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jangan cache API sync / auth (biar selalu fresh atau ditangani Dexie secara offline)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Jika navigasi ke root '/', bypass SW cache dan biarkan network/Next.js middleware redirect ke /lapangan
  if (request.mode === "navigate" && url.pathname === "/") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update (stale-while-revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // offline, ignore
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache it
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If offline and navigate to html, fallback to cached /lapangan
          if (request.mode === "navigate") {
            return caches.match("/lapangan");
          }
        });
    })
  );
});
