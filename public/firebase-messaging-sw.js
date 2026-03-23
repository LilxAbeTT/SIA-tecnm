// public/firebase-messaging-sw.js
// ⚠️ Firebase Messaging SDK busca este archivo en la RAÍZ del sitio.
// NO renombrar ni mover — Firebase lo registra automáticamente.

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDa0T8ptJzEHzcKSkhNEBfRbyW2y4prnU8",
  authDomain: "sia-tecnm.firebaseapp.com",
  projectId: "sia-tecnm",
  storageBucket: "sia-tecnm.appspot.com",
  messagingSenderId: "435425224959",
  appId: "1:435425224959:web:4362523f6ef509a86684ca"
});

const messaging = firebase.messaging();

// Manejo de mensajes push cuando la app está cerrada o en background
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Mensaje en background:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};
  const link = data.link || '/';
  const tipo = data.tipo || 'info';

  const iconMap = {
    medi:      '/images/medi.png',
    biblio:    '/images/biblio.png',
    aula:      '/images/aula.png',
    cafeteria: '/images/cafeteria.png',
    encuestas: '/images/encuestas.png',
  };

  const notifOptions = {
    body: body || '',
    icon: iconMap[tipo] || '/images/logo-sia.png',
    badge: '/assets/icons/badge-96x96.png',
    vibrate: [150, 80, 150],
    tag: `sia-${tipo}`,
    renotify: true,
    data: {
      link,
      url: link.startsWith('http') ? link : (self.location.origin + link),
      tipo
    }
  };

  // Solo mostrar si Firebase no lo muestra automáticamente desde el payload
  return self.registration.showNotification(title || 'SIA', notifOptions);
});

// Click en la notificación → abrir o enfocar la app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const link = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if (event.notification.data?.link) {
            client.postMessage({ type: 'SIA_NAVIGATE', link: event.notification.data.link });
          }
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
