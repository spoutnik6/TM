// Service worker : mise en cache de l'app shell pour un fonctionnement
// hors-ligne complet, indispensable pour l'installation en PWA sur Android.

const CACHE_NAME = "turing-machine-web-v17";
const CARD_IMAGES = Array.from({ length: 48 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `./assets/cards/TM_GameCards_FR-${n}.webp`;
});
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./cards.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./assets/brand/logo-tm.png",
  "./assets/brand/turing-splash.webp",
  ...CARD_IMAGES,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
    })
  );
});
