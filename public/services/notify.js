// public/services/notify.js
// Servicio centralizado de notificaciones:
// - Feed in-app
// - Toasts y sonido
// - Delegacion al servicio de push
// Expone: window.Notify

const _NOTIFY_ICON_MAP = {
  medi: { icon: 'bi-heart-pulse-fill', color: '#dc3545' },
  biblio: { icon: 'bi-book-half', color: '#ffc107' },
  aula: { icon: 'bi-mortarboard-fill', color: '#0d6efd' },
  foro: { icon: 'bi-ticket-perforated-fill', color: '#6f42c1' },
  cafeteria: { icon: 'bi-cup-hot-fill', color: '#fd7e14' },
  quejas: { icon: 'bi-chat-heart-fill', color: '#20c997' },
  encuestas: { icon: 'bi-clipboard2-check-fill', color: '#0dcaf0' },
  lactario: { icon: 'bi-droplet-fill', color: '#e83e8c' },
  recordatorio: { icon: 'bi-alarm-fill', color: '#6c757d' },
  sistema: { icon: 'bi-gear-fill', color: '#6c757d' },
  aviso: { icon: 'bi-megaphone-fill', color: '#198754' },
  info: { icon: 'bi-info-circle-fill', color: '#0d6efd' }
};

function _relativeTime(ts) {
  if (!ts) return 'Ahora';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} dia${days > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

const Notify = {
  _unsub: null,
  _audio: null,
  _lastCount: 0,
  _lastRenderedCount: 0,
  _currentPage: 0,
  _pageSize: 10,
  _allNotifs: [],
  _ctx: null,
  _uid: null,

  init(ctx, uid) {
    this.cleanup();
    this._ctx = ctx;
    this._uid = uid;

    if (!uid) {
      console.warn('[Notify] No UID provided for initialization.');
      return;
    }

    if (!this._audio) {
      this._audio = new Audio('/assets/sounds/notification.wav');
      this._audio.volume = 0.55;
    }

    this._unsub = ctx.db
      .collection('usuarios').doc(uid)
      .collection('notificaciones')
      .orderBy('createdAt', 'desc')
      .limit(80)
      .onSnapshot(snapshot => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this._allNotifs = notifs;
        this._currentPage = 0;
        this._processUpdates(notifs);
        this._render();
      }, error => {
        console.error('[Notify] Error en listener:', error);
      });

    if (window.PushService && PushService.isSupported()) {
      setTimeout(async () => {
        try {
          const permission = typeof PushService.getPermissionStateAsync === 'function'
            ? await PushService.getPermissionStateAsync()
            : PushService.getPermissionState();
          if (permission !== 'granted') return;

          console.log('[Notify] Permiso concedido; refrescando token FCM en background...');
          const ok = await PushService.requestAndSubscribe(uid);
          console.log('[Notify] Token FCM auto-refresh:', ok ? 'OK' : 'fallo');
        } catch (e) {
          console.warn('[Notify] Token FCM auto-refresh error:', e);
        }
      }, 2000);
    }
  },

  _processUpdates(notifs) {
    const unreadCount = notifs.filter(n => !n.leido).length;

    if (unreadCount > this._lastCount && this._lastCount !== 0) {
      this.playSound();

      const latest = notifs[0];
      if (latest && !latest.leido) {
        const created = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date();
        if ((Date.now() - created.getTime()) < 90000) {
          this._showToast(latest);
          if (!latest?.meta?.skipLocalEcho && window.PushService && PushService.getPermissionState() === 'granted') {
            window.PushService.showLocalNotification(latest.titulo, {
              body: latest.mensaje,
              icon: '/images/logo-sia.png',
              tag: latest.tipo || 'sia',
              data: { link: latest.link || null }
            });
          }
        }
      }
    }
    this._lastCount = unreadCount;
  },

  _showToast(n) {
    if (window.showToast) {
      window.showToast(n.titulo + ': ' + n.mensaje, n.urgente ? 'danger' : 'info');
    }
  },

  cleanup() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  },

  async markAsRead(ctx, uid, notifIds) {
    if (!notifIds || notifIds.length === 0) return;
    const db = (ctx && ctx.db) || (window.SIA && window.SIA.db);
    if (!db) return;
    const batch = db.batch();
    const ref = db.collection('usuarios').doc(uid).collection('notificaciones');
    notifIds.forEach(id => batch.update(ref.doc(id), { leido: true }));
    try {
      await batch.commit();
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (e) {
      console.error('[Notify] Error marcando leidos:', e);
    }
  },

  async deleteOne(uid, notifId) {
    const db = window.SIA && window.SIA.db;
    if (!db || !uid || !notifId) return;
    try {
      await db.collection('usuarios').doc(uid).collection('notificaciones').doc(notifId).delete();
    } catch (e) {
      console.error('[Notify] Error eliminando notificacion:', e);
    }
  },

  async send(targetUid, data) {
    if (!targetUid) return;
    const db = window.SIA && window.SIA.db;
    if (!db) return;
    try {
      await db.collection('usuarios').doc(targetUid).collection('notificaciones').add({
        titulo: data.titulo || data.title || 'Notificacion',
        mensaje: data.mensaje || data.message || '',
        tipo: data.tipo || data.type || 'info',
        link: data.link || null,
        urgente: data.urgente || false,
        leido: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('[Notify] Error enviando notificacion:', e);
    }
  },

  async sendToRole(role, data, maxUsers = 300) {
    const db = window.SIA && window.SIA.db;
    if (!db || !role) return;
    try {
      const snapshot = await db.collection('usuarios')
        .where('role', '==', role)
        .limit(maxUsers)
        .get();

      if (snapshot.empty) return;

      const BATCH_SIZE = 450;
      let batch = db.batch();
      let count = 0;
      const promises = [];

      for (const userDoc of snapshot.docs) {
        const ref = db.collection('usuarios').doc(userDoc.id)
          .collection('notificaciones').doc();
        batch.set(ref, {
          titulo: data.titulo || data.title || 'Notificacion',
          mensaje: data.mensaje || data.message || '',
          tipo: data.tipo || data.type || 'info',
          link: data.link || null,
          urgente: data.urgente || false,
          leido: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
        if (count >= BATCH_SIZE) {
          promises.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      }

      if (count > 0) promises.push(batch.commit());
      await Promise.all(promises);
      console.log(`[Notify] Enviado a ${snapshot.size} usuarios con rol '${role}'.`);
    } catch (e) {
      console.error('[Notify] Error en sendToRole:', e);
    }
  },

  async requestPushPermission(uid) {
    if (window.PushService) {
      return window.PushService.requestAndSubscribe(uid);
    }
    return false;
  },

  _render() {
    const notifs = this._allNotifs;
    const unreadCount = notifs.filter(n => !n.leido).length;

    ['notif-dot', 'mobile-notif-badge', 'admin-mobile-notif-badge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'notif-dot') {
        el.classList.toggle('d-none', unreadCount === 0);
        if (unreadCount > 0) el.classList.add('bg-danger');
      } else {
        el.textContent = unreadCount > 99 ? '99+' : (unreadCount > 0 ? unreadCount : '');
        el.classList.toggle('d-none', unreadCount === 0);
        if (unreadCount > this._lastRenderedCount) {
          el.classList.add('notif-badge-bounce');
          setTimeout(() => el.classList.remove('notif-badge-bounce'), 600);
        }
      }
    });
    this._lastRenderedCount = unreadCount;

    ['nav-notif-list-v2', 'notifs-list', 'notif-center-list'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this._renderPaginated(el, notifs, unreadCount);
    });
  },

  _renderPaginated(container, notifs, unreadCount) {
    if (notifs.length === 0) {
      container.innerHTML = `
        <li class="text-center p-4 text-muted">
          <i class="bi bi-bell-slash mb-2 d-block fs-2 opacity-25"></i>
          <span class="small">Sin notificaciones</span>
        </li>`;
      return;
    }

    const end = (this._currentPage + 1) * this._pageSize;
    const visible = notifs.slice(0, end);
    const hasMore = end < notifs.length;

    container.innerHTML = visible.map(n => this._renderItem(n)).join('');

    if (hasMore) {
      const moreBtn = document.createElement('li');
      moreBtn.className = 'text-center py-2 border-top';
      moreBtn.innerHTML = `
        <button class="btn btn-link btn-sm text-decoration-none small">
          Ver mas (${notifs.length - end} restantes)
        </button>`;
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        this._currentPage++;
        this._render();
      };
      container.appendChild(moreBtn);
    }

    if (unreadCount > 0) {
      const uid = this._uid || window.SIA?.auth?.currentUser?.uid;
      const markAllBtn = document.createElement('li');
      markAllBtn.className = 'text-center pt-2 border-top mt-1';
      markAllBtn.innerHTML = `
        <button class="btn btn-link btn-sm text-decoration-none text-primary small fw-bold">
          <i class="bi bi-check2-all me-1"></i>Marcar todo como leido (${unreadCount})
        </button>`;
      markAllBtn.onclick = (e) => {
        e.stopPropagation();
        const unreadIds = notifs.filter(n => !n.leido).map(n => n.id);
        this.markAsRead(window.SIA, uid, unreadIds);
      };
      container.appendChild(markAllBtn);
    }
  },

  _renderItem(n) {
    const isUnread = !n.leido;
    const meta = _NOTIFY_ICON_MAP[n.tipo] || _NOTIFY_ICON_MAP.info;
    const uid = this._uid || window.SIA?.auth?.currentUser?.uid;
    const timeStr = _relativeTime(n.createdAt);
    const linkAction = n.link ? `SIA.navigate('${n.link}');` : '';
    const escapedTitulo = (n.titulo || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedMsg = (n.mensaje || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `
      <li class="notif-item px-3 py-2 border-bottom ${isUnread ? 'notif-item--unread' : ''}"
          data-notif-id="${n.id}"
          onclick="Notify.markAsRead(SIA,'${uid}',['${n.id}']); ${linkAction}">
        <div class="d-flex align-items-start gap-2">
          <div class="notif-icon-dot flex-shrink-0" style="background:${meta.color}20; color:${meta.color}">
            <i class="bi ${meta.icon}"></i>
          </div>
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex justify-content-between align-items-start">
              <span class="fw-semibold small text-truncate me-1">${escapedTitulo}</span>
              <div class="d-flex align-items-center gap-1 flex-shrink-0">
                ${isUnread ? '<span class="notif-unread-dot"></span>' : ''}
                <button class="btn btn-link btn-sm p-0 notif-delete-btn"
                  onclick="event.stopPropagation(); Notify.deleteOne('${uid}','${n.id}');"
                  title="Eliminar">
                  <i class="bi bi-x text-muted small"></i>
                </button>
              </div>
            </div>
            <p class="mb-0 extra-small text-muted lh-sm">${escapedMsg}</p>
            <small class="text-muted extra-small opacity-75">${timeStr}</small>
          </div>
        </div>
      </li>`;
  },

  playSound() {
    if (this._audio) {
      this._audio.currentTime = 0;
      this._audio.play().catch(e => console.warn('[Notify] Audio blocked:', e));
    }
  }
};

window.Notify = Notify;
