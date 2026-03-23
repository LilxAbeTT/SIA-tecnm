// public/services/push-service.js
// Servicio hibrido de Push:
// - Web/PWA: Firebase Messaging + service worker
// - App Android/iOS (Capacitor): @capacitor/push-notifications
// Expone: window.PushService

(function () {
  if (window.PushService) return;

  const VAPID_PUBLIC_KEY = 'BDTvfRz5eTjMDRGNYFs0f0nayq45awR_OkHaw7du1T0hvJLNeCmlM1sEIa0vNzlVZAJw6yqN-MX4Ys2h5v09XgA';
  const DEFAULT_PERMISSION = 'default';

  function withTimeout(promise, ms, label) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[PushService] Timeout: ${label}`)), ms)
    );
    return Promise.race([promise, timeout]);
  }

  function getDb() {
    return window.SIA?.db || null;
  }

  function getCapacitorPushPlugin() {
    return window.Capacitor?.Plugins?.PushNotifications || null;
  }

  function isNativePlatform() {
    if (!window.Capacitor) return false;
    if (typeof window.Capacitor.isNativePlatform === 'function') {
      return window.Capacitor.isNativePlatform();
    }
    const platform = window.Capacitor.getPlatform?.();
    return platform === 'android' || platform === 'ios';
  }

  function getNativePlatform() {
    const platform = window.Capacitor?.getPlatform?.();
    return platform === 'android' || platform === 'ios' ? platform : 'native';
  }

  function isWebSupported() {
    return typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
      && typeof firebase?.messaging === 'function';
  }

  function normalizePermissionState(value) {
    if (value === 'granted') return 'granted';
    if (value === 'denied') return 'denied';
    return DEFAULT_PERMISSION;
  }

  function normalizeToken(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function buildTokenDocId(transport, platform) {
    if (transport === 'web') return 'web';
    const safePlatform = String(platform || 'native').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    return `native_${safePlatform}`;
  }

  function normalizeRouteLink(link) {
    if (!link || typeof link !== 'string') return null;
    if (link.startsWith('http')) {
      try {
        const url = new URL(link);
        return url.pathname || '/';
      } catch (_) {
        return null;
      }
    }
    return link.startsWith('/') ? link : `/${link}`;
  }

  const PushService = {
    _token: null,
    _nativePermissionState: DEFAULT_PERMISSION,
    _nativeListenersReady: false,
    _pendingNativeRegistration: null,
    _subscriptionPromise: null,

    isSupported() {
      return this.isNativeSupported() || this.isWebSupported();
    },

    isNativeSupported() {
      return isNativePlatform() && !!getCapacitorPushPlugin();
    },

    isWebSupported() {
      return isWebSupported();
    },

    getPermissionState() {
      if (this.isNativeSupported()) return this._nativePermissionState;
      if (!this.isWebSupported()) return 'denied';
      return Notification.permission;
    },

    async getPermissionStateAsync() {
      if (this.isNativeSupported()) {
        try {
          const status = await getCapacitorPushPlugin().checkPermissions();
          this._nativePermissionState = normalizePermissionState(status?.receive);
        } catch (err) {
          console.warn('[PushService] No se pudo consultar el permiso nativo:', err);
        }
        return this._nativePermissionState;
      }
      return this.getPermissionState();
    },

    async requestAndSubscribe(uid) {
      if (!uid) {
        console.warn('[PushService] UID requerido.');
        return false;
      }
      if (this._subscriptionPromise) return this._subscriptionPromise;

      const task = this.isNativeSupported()
        ? this._requestNativeAndSubscribe(uid)
        : this._requestWebAndSubscribe(uid);

      this._subscriptionPromise = task.finally(() => {
        this._subscriptionPromise = null;
      });

      return this._subscriptionPromise;
    },

    async unsubscribe(uid) {
      if (this.isNativeSupported()) {
        return this._unsubscribeNative(uid);
      }
      return this._unsubscribeWeb(uid);
    },

    async showLocalNotification(title, options = {}) {
      if (this.isNativeSupported()) return;
      if (!this.isWebSupported()) return;

      const permission = await this.getPermissionStateAsync();
      if (permission !== 'granted') return;

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body: options.body || '',
          icon: options.icon || '/images/logo-sia.png',
          badge: '/assets/icons/badge-96x96.png',
          data: options.data || {},
          vibrate: [150, 80, 150],
          tag: options.tag || 'sia-notif',
          renotify: true,
          ...options
        });
      } catch (err) {
        console.warn('[PushService] Error mostrando notificacion local:', err);
      }
    },

    _ensureNativeListeners() {
      if (this._nativeListenersReady || !this.isNativeSupported()) return;

      const plugin = getCapacitorPushPlugin();

      plugin.addListener('registration', (token) => {
        const value = normalizeToken(token?.value);
        console.log('[PushService] Token nativo recibido:', value ? `${value.substring(0, 20)}...` : '(vacio)');

        if (this._pendingNativeRegistration) {
          if (value) {
            this._pendingNativeRegistration.resolve(value);
          } else {
            this._pendingNativeRegistration.reject(new Error('Token nativo vacio.'));
          }
          this._pendingNativeRegistration = null;
        }
      });

      plugin.addListener('registrationError', (error) => {
        console.error('[PushService] Error de registro nativo:', error);
        if (this._pendingNativeRegistration) {
          this._pendingNativeRegistration.reject(error);
          this._pendingNativeRegistration = null;
        }
      });

      plugin.addListener('pushNotificationReceived', (notification) => {
        console.log('[PushService] Push nativo recibido:', notification?.title || notification);
      });

      plugin.addListener('pushNotificationActionPerformed', (action) => {
        const rawLink = action?.notification?.data?.link || action?.notification?.data?.url || null;
        const route = normalizeRouteLink(rawLink);
        if (!route) return;

        if (typeof window.SIA?.navigate === 'function') {
          window.SIA.navigate(route);
          return;
        }

        window.dispatchEvent(new CustomEvent('sia-push-open', { detail: { route } }));
      });

      this._nativeListenersReady = true;
    },

    async _requestNativeAndSubscribe(uid) {
      if (!this.isNativeSupported()) {
        console.warn('[PushService] Push nativo no disponible.');
        return false;
      }

      this._ensureNativeListeners();

      let permission = await this.getPermissionStateAsync();
      if (permission !== 'granted') {
        try {
          const status = await getCapacitorPushPlugin().requestPermissions();
          permission = normalizePermissionState(status?.receive);
          this._nativePermissionState = permission;
        } catch (err) {
          console.error('[PushService] Error pidiendo permiso nativo:', err);
          return false;
        }
      }

      if (permission !== 'granted') {
        console.log('[PushService] Permiso nativo denegado o ignorado.');
        return false;
      }

      const plugin = getCapacitorPushPlugin();
      if (getNativePlatform() === 'android') {
        try {
          await plugin.createChannel({
            id: 'sia-general',
            name: 'SIA',
            description: 'Canal principal de notificaciones SIA',
            importance: 5,
            visibility: 1,
            sound: 'default'
          });
        } catch (err) {
          console.warn('[PushService] No se pudo crear el canal Android:', err);
        }
      }

      let token;
      try {
        token = await withTimeout(
          new Promise((resolve, reject) => {
            this._pendingNativeRegistration = { resolve, reject };
            Promise.resolve(plugin.register()).catch(reject);
          }),
          15000,
          'PushNotifications.register'
        );
      } catch (err) {
        this._pendingNativeRegistration = null;
        console.error('[PushService] Error obteniendo token nativo:', err?.message || err);
        return false;
      }

      token = normalizeToken(token);
      if (!token) {
        console.warn('[PushService] Token nativo vacio.');
        return false;
      }

      this._token = token;
      return this._saveTokenToFirestore(uid, token, {
        transport: 'native',
        platform: getNativePlatform()
      });
    },

    async _requestWebAndSubscribe(uid) {
      if (!this.isWebSupported()) {
        console.warn('[PushService] Push web no soportado en este entorno.');
        return false;
      }

      let permission;
      try {
        permission = await Notification.requestPermission();
      } catch (err) {
        console.error('[PushService] Error en requestPermission:', err);
        return false;
      }

      if (permission !== 'granted') {
        console.log('[PushService] Permiso web denegado o ignorado.');
        return false;
      }

      let registration;
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (err) {
        console.error('[PushService] No se pudo registrar firebase-messaging-sw.js:', err);
        return false;
      }

      let token;
      try {
        const messaging = firebase.messaging();
        token = await withTimeout(
          messaging.getToken({
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
          }),
          15000,
          'messaging.getToken'
        );
      } catch (err) {
        if (err.message?.includes('Timeout')) {
          console.error('[PushService] FCM getToken tardo demasiado (posible error de SW/red).');
        } else {
          console.error('[PushService] Error obteniendo token web:', err?.code, err?.message);
        }
        return false;
      }

      token = normalizeToken(token);
      if (!token) {
        console.warn('[PushService] Token web vacio.');
        return false;
      }

      this._token = token;
      return this._saveTokenToFirestore(uid, token, {
        transport: 'web',
        platform: 'web'
      });
    },

    async _unsubscribeNative(uid) {
      if (!this.isNativeSupported()) return false;
      try {
        await getCapacitorPushPlugin().unregister();
        await this._removeTokenFromFirestore(uid, {
          transport: 'native',
          platform: getNativePlatform()
        });
        this._token = null;
        return true;
      } catch (err) {
        console.error('[PushService] Error al desuscribir push nativo:', err);
        return false;
      }
    },

    async _unsubscribeWeb(uid) {
      if (!this.isWebSupported()) return false;
      try {
        const messaging = firebase.messaging();
        await messaging.deleteToken();
        await this._removeTokenFromFirestore(uid, { transport: 'web', platform: 'web' });
        this._token = null;
        return true;
      } catch (err) {
        console.error('[PushService] Error al desuscribir push web:', err);
        return false;
      }
    },

    async _saveTokenToFirestore(uid, token, meta = {}) {
      const db = getDb();
      if (!db) {
        console.warn('[PushService] SIA.db no disponible para guardar token.');
        return false;
      }

      const transport = meta.transport || (this.isNativeSupported() ? 'native' : 'web');
      const platform = meta.platform || (transport === 'native' ? getNativePlatform() : 'web');
      const docId = buildTokenDocId(transport, platform);

      try {
        await db.collection('usuarios').doc(uid)
          .collection('pushTokens').doc(docId)
          .set({
            fcmToken: token,
            token,
            transport,
            platform,
            deviceClass: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            userAgent: navigator.userAgent || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

        console.log(`[PushService] Token guardado en Firestore como ${docId}.`);
        return true;
      } catch (err) {
        console.error('[PushService] Error guardando token en Firestore:', err);
        return false;
      }
    },

    async _removeTokenFromFirestore(uid, meta = {}) {
      const db = getDb();
      if (!db || !uid) return false;

      const transport = meta.transport || (this.isNativeSupported() ? 'native' : 'web');
      const platform = meta.platform || (transport === 'native' ? getNativePlatform() : 'web');
      const docId = buildTokenDocId(transport, platform);

      try {
        await db.collection('usuarios').doc(uid)
          .collection('pushTokens').doc(docId).delete();
        return true;
      } catch (err) {
        console.warn('[PushService] No se pudo eliminar token:', err);
        return false;
      }
    }
  };

  window.PushService = PushService;
})();
