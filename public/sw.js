// public/sw.js
const CACHE_NAME = 'sia-cache-v_DARK_7'; // Versión con Dark Mode
const urlsToCache = [
  './',
  './index.html',
  './styles.css?v=dark_v7',
  './app.js?v=dark_v7'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forzar activación
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando caché obsoleto:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network First (Red Primero)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If not in cache and network failed, return a basic offline response or 404
            return new Response("Offline (Network Error & Not Cached)", { status: 408, statusText: "Offline" });
          });
      })
  );
});