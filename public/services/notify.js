// public/services/notify.js
// Servicio Centralizado de Notificaciones (v2.1 Refactorizado - Toasts & Badges)

const Notify = {
  _unsub: null,
  _audio: null,
  _lastCount: 0,
  _currentPage: 0,
  _pageSize: 5,
  _allNotifs: [],

  /**
   * Inicia la escucha de notificaciones para el usuario actual.
   * Reemplaza la lógica dispersa en app.js
   */
  init(ctx, uid) {
    this.cleanup(); // Asegurar limpieza previa

    if (!uid) {
      console.warn("[Notify] No UID provided for initialization.");
      return;
    }


    // Initial Sound Load
    if (!this._audio) {
      this._audio = new Audio("/assets/sounds/notification.mp3"); // Ensure this file exists or use a reliable URL
      this._audio.volume = 0.5;
    }

    // Listener en tiempo real
    this._unsub = ctx.db.collection('usuarios').doc(uid).collection('notificaciones')
      .orderBy('createdAt', 'desc')
      .limit(50) // Aumentado para tener más notificaciones disponibles
      .onSnapshot(snapshot => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        this._allNotifs = notifs;
        this._currentPage = 0; // Reset page on new data
        this._processUpdates(notifs);
        this._render();
      }, error => {
        console.error("❌ [Notify] Error en listener:", error);
      });
  },

  /**
   * Detecta nuevas notificaciones y muestra Toast y sonido
   */
  _processUpdates(notifs) {
    const unreadCount = notifs.filter(n => !n.leido).length;

    // Si aumentaron las no leídas, significa que llegó una nueva (o se marcó no leída)
    if (unreadCount > this._lastCount && this._lastCount !== 0) {
      this.playSound();

      // Mostrar Toast de la más reciente si es nueva (menos de 1 min)
      const latest = notifs[0];
      if (latest && !latest.leido) {
        const now = new Date();
        const created = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date();
        if ((now - created) < 60000) { // Solo si es reciente
          this._showToast(latest);
        }
      }
    }
    this._lastCount = unreadCount;
  },

  _showToast(n) {
    // Usar la función global showToast si existe, o crear una custom
    const msg = `${n.titulo}: ${n.mensaje}`;
    if (window.showToast) {
      window.showToast(msg, 'info'); // 'info' maps to blue/standard
    } else {
      // Fallback Alert (console for now)
      console.log("Toast:", msg);
    }
  },

  /**
   * Limpia suscripciones activas.
   */
  cleanup() {
    if (this._unsub) {
      console.log("🔕 [Notify] Deteniendo servicio.");
      this._unsub();
      this._unsub = null;
    }
  },

  /**
   * Marca notificaciones como leídas.
   */
  async markAsRead(ctx, uid, notifIds) {
    if (!notifIds || notifIds.length === 0) return;

    const batch = ctx.db.batch();
    const ref = ctx.db.collection('usuarios').doc(uid).collection('notificaciones');

    notifIds.forEach(id => {
      batch.update(ref.doc(id), { leido: true });
    });

    try {
      await batch.commit();
      // Feedback háptico si está disponible (mejora UI/UX)
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(20);
    } catch (e) {
      console.error("[Notify] Error marcando leídos:", e);
    }
  },

  /**
   * Envía una notificación a un usuario (escribe en Firestore).
   */
  async send(targetUid, data) {
    if (!targetUid) return;
    try {
      await firebase.firestore().collection('usuarios').doc(targetUid).collection('notificaciones').add({
        titulo: data.title || 'Notificación',
        mensaje: data.message || '',
        tipo: data.type || 'info',
        link: data.link || null,
        leido: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("[Notify] Error enviando notificación:", e);
    }
  },

  /**
   * Renderiza la UI de notificaciones (Badge y Lista) con paginación.
   * @private
   */
  _render() {
    const notifs = this._allNotifs;

    // Desktop notifications (navbar dropdown)
    const badge = document.getElementById('notif-dot');
    const list = document.getElementById('nav-notif-list-v2');

    // Mobile notifications (bottom nav badge)
    const mobileBadge = document.getElementById('mobile-notif-badge');

    const unreadCount = notifs.filter(n => !n.leido).length;

    // Visual Badges
    if (badge) {
      if (unreadCount > 0) {
        badge.classList.remove('d-none');
        badge.classList.add('bg-danger');
      } else {
        badge.classList.add('d-none');
      }
    }

    if (mobileBadge) {
      if (unreadCount > 0) {
        mobileBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        mobileBadge.classList.remove('d-none');
      } else {
        mobileBadge.classList.add('d-none');
      }
    }

    // Render Desktop List (with pagination)
    if (list) {
      this._renderPaginated(list, notifs, unreadCount);
    }

    // Render Mobile Drawer List
    const mobileList = document.getElementById('notifs-list');
    if (mobileList) {
      this._renderPaginated(mobileList, notifs, unreadCount);
    }
  },

  /**
   * Renderiza notificaciones con paginación
   * @private
   */
  _renderPaginated(container, notifs, unreadCount) {
    if (notifs.length === 0) {
      container.innerHTML = `
        <li class="text-center p-3 text-muted small">
          <i class="bi bi-bell-slash mb-2 d-block fs-5 opacity-50"></i>
          Sin notificaciones.
        </li>`;
      return;
    }

    // Calculate visible notifications
    const start = 0;
    const end = (this._currentPage + 1) * this._pageSize;
    const visibleNotifs = notifs.slice(start, end);
    const hasMore = end < notifs.length;

    // Render visible notifications
    container.innerHTML = visibleNotifs.map(n => this._renderItem(n)).join('');

    // "Ver más..." button
    if (hasMore) {
      const moreBtn = document.createElement('li');
      moreBtn.className = 'text-center py-2 border-top';
      const remaining = notifs.length - end;
      moreBtn.innerHTML = `
        <button class="btn btn-link btn-sm text-decoration-none small">
          Ver más notificaciones (${remaining} restantes)
        </button>`;
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        this._currentPage++;
        this._render();
      };
      container.appendChild(moreBtn);
    }

    // "Marcar todas como leídas" button
    if (unreadCount > 0) {
      const markAllBtn = document.createElement('li');
      markAllBtn.className = 'text-center pt-2 border-top mt-2';
      markAllBtn.innerHTML = `
        <button class="btn btn-link btn-sm text-decoration-none text-primary small fw-bold">
          Marcar todas como leídas (${unreadCount})
        </button>`;
      markAllBtn.onclick = (e) => {
        e.stopPropagation();
        const unreadIds = notifs.filter(n => !n.leido).map(n => n.id);
        this.markAsRead(SIA, SIA.auth.currentUser.uid, unreadIds);
      };
      container.appendChild(markAllBtn);
    }
  },

  _renderItem(n) {
    const isUnread = !n.leido;
    const bgClass = isUnread ? 'bg-primary-subtle' : 'bg-transparent';

    // Time helper fallback
    let dateStr = "Reciente";
    if (n.createdAt && n.createdAt.seconds) {
      const date = n.createdAt.toDate();
      dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    let icon = 'bi-info-circle-fill text-primary';
    if (n.tipo === 'medi') icon = 'bi-heart-pulse-fill text-danger';
    if (n.tipo === 'biblio') icon = 'bi-book-half text-warning';
    if (n.tipo === 'aula') icon = 'bi-mortarboard-fill text-success';
    if (n.tipo === 'foro') icon = 'bi-ticket-perforated-fill text-purple';

    return `
        <li class="dropdown-item px-3 py-2 border-bottom ${bgClass} text-wrap" style="cursor: pointer; min-width: 250px;" 
            onclick="Notify.markAsRead(SIA, SIA.auth.currentUser.uid, ['${n.id}']); ${n.link ? `window.navigate('${n.link}')` : ''}">
            <div class="d-flex align-items-start gap-2">
                <i class="bi ${icon} mt-1 fs-6"></i>
                <div class="w-100">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                         <span class="fw-bold small text-dark">${n.titulo}</span>
                         ${isUnread ? '<span class="badge bg-danger rounded-circle p-1 ms-1" style="width:6px; height:6px;"> </span>' : ''}
                    </div>
                    <p class="mb-0 extra-small text-muted lh-sm text-truncate-2">${n.mensaje}</p>
                    <small class="text-muted extra-small opacity-75">${dateStr}</small>
                </div>
            </div>
        </li>`;
  },

  playSound() {
    if (this._audio) {
      this._audio.currentTime = 0;
      this._audio.play().catch(e => console.warn("[Notify] Audio blocked by browser:", e));
    }
  }
};

window.Notify = Notify;




// Exponer globalmente
window.Notify = Notify;