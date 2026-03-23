// public/modules/notifications.js
// Centro de Notificaciones SIA — v1.0 Mobile-First
// Expone: window.Notifications

var Notifications = (function () {
  let _ctx = null;
  let _uid = null;

  function init(ctx) {
    _ctx = ctx;
    // Intenta obtener uid de múltiples fuentes posibles
    _uid = ctx?.user?.uid
      || ctx?.auth?.currentUser?.uid
      || (typeof firebase !== 'undefined' && firebase.auth().currentUser?.uid)
      || null;

    console.log('[Notifications] init() uid =', _uid);

    const container = document.getElementById('view-notificaciones');
    if (!container) return;

    // Idempotency — si ya está inicializado solo re-renderizamos la lista
    if (document.getElementById('notif-center-app')) {
      _repopulateList();
      return;
    }

    container.innerHTML = _renderStructure();
    _bindEvents();

    // ✅ BUG FIX: Notify._render() ya fue llamado antes de que este DOM existiera.
    // Rellenamos la lista manualmente con los datos que ya están en memoria.
    _repopulateList();
  }

  /** Rellena notif-center-list con los datos actuales de Notify._allNotifs */
  function _repopulateList() {
    const list = document.getElementById('notif-center-list');
    if (!list || !window.Notify) return;

    const notifs = Notify._allNotifs || [];
    if (notifs.length === 0) {
      list.innerHTML = `
        <li class="text-center p-5 text-muted">
          <i class="bi bi-bell-slash mb-2 d-block fs-2 opacity-25"></i>
          <span class="small">Sin notificaciones por el momento</span>
        </li>`;
    } else {
      list.innerHTML = notifs.map(n => Notify._renderItem(n)).join('');
    }

    // Actualizar badge de no leídas en el hero
    const unread = notifs.filter(n => !n.leido).length;
    const badge = document.getElementById('nc-unread-badge');
    if (badge) {
      badge.textContent = unread > 0 ? unread : '';
      badge.classList.toggle('d-none', unread === 0);
    }

    // Mostrar botón de "Eliminar leídas" si hay leídas
    const delWrap = document.getElementById('nc-delete-all-wrap');
    if (delWrap) delWrap.style.display = notifs.some(n => n.leido) ? '' : 'none';
  }

  function _renderStructure() {
    return `
    <style>
      #notif-center-app { font-family: 'Inter', system-ui, sans-serif; max-width: 680px; margin: 0 auto; }
      #notif-center-app .nc-hero {
        background: linear-gradient(135deg, #1e293b 0%, #0d6efd 100%);
        border-radius: 1rem;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1rem;
        position: relative; overflow: hidden;
      }
      #notif-center-app .nc-hero::after {
        content:'';
        position:absolute;
        right:-30px; top:-30px;
        width:180px; height:180px;
        border-radius:50%;
        background: rgba(255,255,255,0.03);
        pointer-events: none; /* No bloquear clicks en el botón debajo */
      }
      #notif-center-app .nc-filter-pill {
        border-radius: 50px;
        font-size: 0.75rem;
        padding: 0.3rem 0.75rem;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.2s;
        white-space: nowrap;
        font-weight: 600;
      }
      #notif-center-app .nc-filter-pill.active {
        background: #0d6efd !important;
        color: #fff !important;
        border-color: #0d6efd !important;
      }
      #notif-center-app .nc-filter-pill:not(.active) {
        background: var(--bs-body-bg, #fff);
        color: var(--bs-body-color, #333);
        border-color: #dee2e6;
      }
      .notif-item {
        cursor: pointer;
        transition: background 0.15s;
        list-style: none;
      }
      .notif-item:hover { background: rgba(13,110,253,0.04); }
      .notif-item--unread { background: rgba(13,110,253,0.06) !important; }
      .notif-icon-dot {
        width: 38px; height: 38px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        font-size: 1rem;
      }
      .notif-unread-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #0d6efd;
        flex-shrink: 0;
        display: inline-block;
      }
      .notif-badge-bounce {
        animation: notif-bounce 0.5s ease;
      }
      @keyframes notif-bounce {
        0%,100%{transform:scale(1);} 40%{transform:scale(1.4);} 70%{transform:scale(0.9);}
      }
      .nc-push-banner {
        border-radius: 1rem;
        padding: 1rem 1.25rem;
        background: linear-gradient(135deg, #0d6efd15, #0dcaf015);
        border: 1.5px solid #0d6efd30;
        margin-bottom: 1rem;
      }
      .extra-small { font-size: 0.72rem !important; }
      .min-width-0 { min-width: 0; }
    </style>

    <div id="notif-center-app">
      <!-- Hero -->
      <div class="nc-hero text-white mb-3">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h5 class="fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-bell-fill text-white"></i><span class="text-white">Notificaciones</span>
              <span id="nc-unread-badge" class="badge bg-danger ms-1 d-none text-white" style="font-size:.65rem;"></span>
            </h5>
            <small class="opacity-75 text-white">Tus notificaciones, recordatorios y actualizaciones</small>
          </div>
          <button class="btn btn-sm btn-light bg-white bg-opacity-20 border-0 text-white rounded-pill"
                  onclick="Notifications.markAllRead()" id="nc-mark-all-btn">
            <i class="bi bi-check2-all me-1"></i>Todo leído
          </button>
        </div>
      </div>

      <!-- Push Permission Banner -->
      <div id="nc-push-banner" class="nc-push-banner d-none mb-3">
        <div class="d-flex align-items-center gap-3">
          <div class="flex-shrink-0 text-primary" style="font-size:1.8rem;">
            <i class="bi bi-phone-vibrate-fill"></i>
          </div>
          <div class="flex-grow-1">
            <strong class="small d-block">Recibe notificaciones en tu móvil</strong>
            <small class="text-muted">Entérate de citas, préstamos y avisos incluso con la app cerrada.</small>
          </div>
          <div class="d-flex flex-column gap-1 flex-shrink-0">
            <button class="btn btn-primary btn-sm rounded-pill px-3 fw-bold"
                    onclick="Notifications.requestPush()">
              Activar
            </button>
            <button class="btn btn-link btn-sm text-muted p-0" style="font-size:0.7rem;"
                    onclick="document.getElementById('nc-push-banner').classList.add('d-none'); localStorage.setItem('sia_push_dismissed','1');">
              Ahora no
            </button>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="d-flex gap-2 overflow-auto pb-2 mb-3" style="scrollbar-width:none;" id="nc-filters">
        <button class="nc-filter-pill active" data-filter="all">
          <i class="bi bi-grid-fill me-1"></i>Todas
        </button>
        <button class="nc-filter-pill" data-filter="medi">
          <i class="bi bi-heart-pulse-fill me-1"></i>Médico
        </button>
        <button class="nc-filter-pill" data-filter="biblio">
          <i class="bi bi-book-half me-1"></i>Biblioteca
        </button>
        <button class="nc-filter-pill" data-filter="aula">
          <i class="bi bi-mortarboard-fill me-1"></i>Aula
        </button>
        <button class="nc-filter-pill" data-filter="encuestas">
          <i class="bi bi-clipboard2-check-fill me-1"></i>Encuestas
        </button>
        <button class="nc-filter-pill" data-filter="aviso">
          <i class="bi bi-megaphone-fill me-1"></i>Avisos
        </button>
        <button class="nc-filter-pill" data-filter="unread">
          <i class="bi bi-circle-fill me-1"></i>No leídas
        </button>
      </div>

      <!-- Notification List -->
      <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
        <ul id="notif-center-list" class="list-unstyled mb-0 p-0">
          <li class="text-center p-5 text-muted">
            <span class="spinner-border spinner-border-sm me-2"></span>Cargando...
          </li>
        </ul>
      </div>

      <!-- Delete All -->
      <div class="text-center mt-3" id="nc-delete-all-wrap" style="display:none;">
        <button class="btn btn-outline-danger btn-sm rounded-pill px-4"
                onclick="Notifications.deleteAllRead()">
          <i class="bi bi-trash3 me-1"></i>Eliminar leídas
        </button>
      </div>
    </div>`;
  }

  function _bindEvents() {
    // Filter pills
    document.querySelectorAll('#nc-filters .nc-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#nc-filters .nc-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _applyFilter(btn.dataset.filter);
      });
    });

    // Check push permission prompt
    _checkPushBanner();
  }

  async function _checkPushBanner() {
    // Siempre mostramos el banner si estamos en el centro de notificaciones
    // y el permiso no está concedido. Ignoramos localStorage aquí —
    // el usuario está en el lugar correcto para activarlas.
    if (window.PushService && PushService.isSupported()) {
      const perm = typeof PushService.getPermissionStateAsync === 'function'
        ? await PushService.getPermissionStateAsync()
        : PushService.getPermissionState();
      if (perm !== 'granted') {
        localStorage.removeItem('sia_push_dismissed'); // reset para que vuelva a aparecer
        document.getElementById('nc-push-banner')?.classList.remove('d-none');
      } else {
        // Ya tiene permiso — ocultar el banner
        document.getElementById('nc-push-banner')?.classList.add('d-none');
      }
    }
  }

  function _applyFilter(filter) {
    const list = document.getElementById('notif-center-list');
    if (!list || !window.Notify) return;

    let notifs = Notify._allNotifs || [];
    if (filter === 'unread') {
      notifs = notifs.filter(n => !n.leido);
    } else if (filter !== 'all') {
      notifs = notifs.filter(n => n.tipo === filter);
    }

    // Re-render with the filtered list
    if (notifs.length === 0) {
      list.innerHTML = `
        <li class="text-center p-5 text-muted">
          <i class="bi bi-funnel mb-2 d-block fs-2 opacity-25"></i>
          <span class="small">Sin notificaciones en esta categoría</span>
        </li>`;
      return;
    }

    list.innerHTML = notifs.map(n => Notify._renderItem(n)).join('');
  }

  async function markAllRead() {
    // ── DIAGNÓSTICO ────────────────────────────────────────────────────────
    console.log('[markAllRead] called. _uid =', _uid, '| Notify =', !!window.Notify);
    console.log('[markAllRead] _allNotifs =', Notify?._allNotifs?.length, 'items');
    console.log('[markAllRead] unread snap =', (Notify?._allNotifs || []).map(n => ({id: n.id, leido: n.leido})));
    // ────────────────────────────────────────────────────────────────────────

    // Resolver uid en el momento de la llamada (no solo en init)
    const uid = _uid
      || (typeof firebase !== 'undefined' && firebase.auth().currentUser?.uid)
      || (window.SIA?.auth?.currentUser?.uid)
      || (window.SIA?.user?.uid)
      || null;

    if (!window.Notify) { console.error('[Notifications] markAllRead: Notify no disponible'); return; }
    if (!uid) { console.error('[Notifications] markAllRead: uid nulo'); return; }

    const unreadIds = (Notify._allNotifs || []).filter(n => !n.leido).map(n => n.id);
    console.log('[markAllRead] unreadIds count =', unreadIds.length);

    if (unreadIds.length === 0) {
      window.showToast?.('Ya no hay notificaciones sin leer', 'info');
      return;
    }

    // 1. Visual instantaneo: quitar clase unread y punto azul del DOM actual
    document.querySelectorAll('#notif-center-list .notif-item--unread').forEach(el => {
      el.classList.remove('notif-item--unread');
      el.querySelector('.notif-unread-dot')?.remove();
    });

    // 2. Actualizar la cache en memoria
    (Notify._allNotifs || []).forEach(n => { n.leido = true; });

    // 3. Actualizar badge del hero
    const badge = document.getElementById('nc-unread-badge');
    if (badge) { badge.textContent = ''; badge.classList.add('d-none'); }

    // 4. Persistir en Firestore
    await Notify.markAsRead(_ctx || window.SIA, uid, unreadIds);

    window.showToast?.('Notificaciones marcadas como leidas', 'success');
  }

  async function deleteAllRead() {
    if (!window.Notify || !_uid) return;
    const readNotifs = (Notify._allNotifs || []).filter(n => n.leido);
    await Promise.all(readNotifs.map(n => Notify.deleteOne(_uid, n.id)));
  }

  async function requestPush() {
    console.log('[Notifications] requestPush() llamado. uid =', _uid, '| PushService =', !!window.PushService);

    // Obtener uid si falta
    if (!_uid) {
      _uid = (typeof firebase !== 'undefined' && firebase.auth().currentUser?.uid) || null;
      console.warn('[Notifications] uid faltaba, reintentando:', _uid);
    }
    if (!_uid) {
      console.error('[Notifications] No hay uid — sesion no iniciada?');
      window.showToast?.('Error: no hay sesion activa', 'danger');
      return;
    }
    if (!window.PushService) {
      console.error('[Notifications] PushService no esta disponible');
      window.showToast?.('Error interno: servicio push no cargado', 'danger');
      return;
    }
    if (!PushService.isSupported()) {
      console.warn('[Notifications] Push no soportado en este navegador');
      window.showToast?.('Tu navegador no soporta notificaciones push', 'warning');
      return;
    }

    console.log('[Notifications] Solicitando token FCM...');
    const success = await PushService.requestAndSubscribe(_uid);
    console.log('[Notifications] resultado:', success);

    if (success) {
      document.getElementById('nc-push-banner')?.classList.add('d-none');
      localStorage.removeItem('sia_push_dismissed');
      window.showToast?.('Notificaciones activadas en tu dispositivo', 'success');
    } else {
      const perm = typeof PushService.getPermissionStateAsync === 'function'
        ? await PushService.getPermissionStateAsync()
        : PushService.getPermissionState();
      const blocked = perm === 'denied';
      window.showToast?.(blocked
        ? 'Notificaciones bloqueadas. Permitelas desde los ajustes del sistema o del navegador.'
        : 'No se pudo activar. Intenta de nuevo.',
        'warning');
    }
  }

  return { init, markAllRead, deleteAllRead, requestPush };
})();

window.Notifications = Notifications;
