// public/sw.js
// Service Worker de SIA — caché offline y manejo de notificaciones click.
// ⚠️ Los mensajes push de FCM en background los maneja firebase-messaging-sw.js
// (Firebase Messaging SDK lo registra automáticamente en /firebase-messaging-sw.js)

const CACHE_NAME = 'sia-cache-v_MAP_6';

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './styles/01-theme-base.css',
  './styles/02-aula-module.css',
  './styles/03-landing-foundation.css',
  './styles/04-landing-visuals.css',
  './styles/05-landing-platform.css',
  './styles/06-landing-app-responsive.css',
  './styles/07-dashboard-foundation.css',
  './styles/08-theme-and-profile-overrides.css',
  './styles/09-navigation-shell.css',
  './styles/10-dashboard-interactions.css',
  './styles/11-controls-reportes.css',
  './styles/12-foro-events.css',
  './styles/13-medi-components.css',
  './styles/14-superadmin.css'
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
        return caches.match(event.request, { ignoreSearch: true })
          .then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response("Offline (Network Error & Not Cached)", { status: 408, statusText: "Offline" });
          });
      })
  );
});

// ============================================================
// 📱 PUSH NOTIFICATIONS — Recibe mensajes del servidor push
// ============================================================
self.addEventListener('push', event => {
  let data = { titulo: 'SIA', mensaje: 'Tienes una nueva notificación.', link: '/', tipo: 'info' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    console.warn('[SW] Payload push no es JSON válido.');
  }

  // Ícono según tipo de notificación
  const iconMap = {
    medi: '/images/medi.png',
    biblio: '/images/biblio.png',
    aula: '/images/aula.png',
    foro: '/images/foro.png',
    cafeteria: '/images/cafeteria.png',
  };
  const icon = iconMap[data.tipo] || '/images/logo-sia.png';

  const options = {
    body: data.mensaje,
    icon: icon,
    badge: '/assets/icons/badge-96x96.png',
    vibrate: [200, 100, 200],
    tag: data.tipo || 'sia-notif',
    renotify: true,
    data: {
      link: data.link || '/',
      url: self.location.origin + (data.link || '/'),
      tipo: data.tipo || 'info'
    },
    actions: [
      { action: 'open', title: 'Ver ahora', icon: '/assets/icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.titulo, options)
  );
});

// ============================================================
// 🔔 CLICK EN NOTIFICACIÓN — Abre SIA y navega al link
// ============================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const link = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Si la app ya está abierta en alguna pestaña, enfocamos esa
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          // Mandamos el link al cliente para que navegue
          if (event.notification.data?.link) {
            client.postMessage({ type: 'SIA_NAVIGATE', link: event.notification.data.link });
          }
          return;
        }
      }
      // Si no está abierta, abrir la URL
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

// ============================================================
// 🔄 PUSH SUBSCRIPTION CHANGE — Auto-renovar suscripción
// ============================================================
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        // Notificar al cliente para que actualice el token en Firestore
        return clients.matchAll().then(allClients => {
          allClients.forEach(c => c.postMessage({
            type: 'SIA_PUSH_RENEWED',
            subscription: subscription.toJSON()
          }));
        });
      })
  );
});
