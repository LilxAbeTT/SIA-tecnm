import { Store } from '../core/state.js';
import { Breadcrumbs } from '../core/breadcrumbs.js';

// ── C2-02: View labels for breadcrumb ──
const VIEW_LABELS = {
  'view-dashboard': { label: 'Dashboard', color: 'var(--primary)' },
  'view-medi': { label: 'Servicios Medicos', color: 'var(--med, #00D0FF)' },
  'view-biblio': { label: 'Biblioteca', color: 'var(--biblio, #FFD24D)' },
  'view-aula': { label: 'Aula Virtual', color: 'var(--aula, #4e1bda)' },
  'view-comunidad': { label: 'Comunidad', color: '#059669' },
  'view-foro': { label: 'Eventos', color: '#14532d' },
  'view-profile': { label: 'Mi Perfil', color: 'var(--primary)' },
  'view-quejas': { label: 'Quejas', color: '#10b981' },
  'view-encuestas': { label: 'Encuestas', color: '#f59e0b' },
  'view-lactario': { label: 'Lactario', color: '#E83E8C' },
  'view-reportes': { label: 'Reportes', color: 'var(--reportes, #6610f2)' },
  'view-cafeteria': { label: 'Cafeteria', color: 'var(--cafeteria, #f97316)' },
};

// ── C2-04: Module colors for bottom nav ──
const MODULE_COLORS = {
  'view-medi': 'var(--med, #00D0FF)',
  'view-biblio': 'var(--biblio, #FFD24D)',
  'view-aula': 'var(--aula, #4e1bda)',
  'view-comunidad': '#059669',
  'view-foro': '#14532d',
  'view-quejas': '#10b981',
  'view-encuestas': '#f59e0b',
  'view-lactario': '#E83E8C',
  'view-cafeteria': 'var(--cafeteria, #f97316)',
};

class SiaNavbar extends HTMLElement {
  constructor() {
    super();
    this.render = this.render.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this._viewChangedHandler = null;
    this._breadcrumbUnsub = null;
    this._notifUnsub = null;
  }

  connectedCallback() {
    this.render();
    Store.on('user-changed', this.updateUser);
    Store.on('cleared', this.updateUser);
    this.setupListeners();
    this._setupViewListener();
    this._setupBreadcrumbListener();
    this._syncBreadcrumb(Breadcrumbs.getState());
  }

  disconnectedCallback() {
    Store.off('user-changed', this.updateUser);
    Store.off('cleared', this.updateUser);
    if (this._viewChangedHandler) window.removeEventListener('sia-view-changed', this._viewChangedHandler);
    if (this._breadcrumbUnsub) this._breadcrumbUnsub();
    if (this._notifUnsub) this._notifUnsub();
  }

  _setupBreadcrumbListener() {
    this._breadcrumbUnsub = Breadcrumbs.subscribe((state) => this._syncBreadcrumb(state));
  }

  _syncBreadcrumb(state) {
    const pill = this.querySelector('#nav-context-pill');
    if (!pill) return;

    const shouldHide = !state || state.hidePill || !state.pillLabel || state.viewId === 'view-dashboard';
    if (shouldHide) {
      pill.classList.add('d-none');
      pill.classList.remove('d-md-inline-block');
      return;
    }

    pill.textContent = state.pillLabel;
    pill.style.background = state.color || 'var(--primary, #1B396A)';
    pill.style.color = '#fff';
    pill.classList.remove('d-none');
    pill.classList.add('d-md-inline-block');
  }

  getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  // ── C2-02: View change listener for breadcrumb + C2-04: bottom nav colors ──
  _setupViewListener() {
    this._viewChangedHandler = (e) => {
      const viewId = e.detail?.viewId;
      if (!viewId) return;

      // C2-04: Update mobile bottom nav color
      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) {
        const color = Breadcrumbs.getViewColor(viewId) || 'var(--primary, #1B396A)';
        bottomNav.style.setProperty('--mobile-nav-active-color', color);
      }

      // Track recent views for app drawer
      this._trackRecentView(viewId);
    };
    window.addEventListener('sia-view-changed', this._viewChangedHandler);
  }

  // ── C2-03: Track recent views ──
  _trackRecentView(viewId) {
    if (viewId === 'view-dashboard' || viewId === 'view-profile') return;
    try {
      let recents = JSON.parse(localStorage.getItem('sia_recent_views') || '[]');
      recents = recents.filter(r => r.viewId !== viewId);
      const label = Breadcrumbs.getPillLabel(viewId, Breadcrumbs.getViewLabel(viewId, ''));
      if (label) {
        recents.unshift({ viewId, label, time: Date.now() });
        recents = recents.slice(0, 2);
        localStorage.setItem('sia_recent_views', JSON.stringify(recents));
      }
    } catch (e) { }
  }

  updateUser(data) {
    if (!data || !data.profile) return;

    const profile = data.profile;
    const role = profile.role || 'student';
    const allowedViews = window.SIA?.getEffectiveAllowedViews ? window.SIA.getEffectiveAllowedViews(profile) : (profile.allowedViews || []);

    // 1. Initials
    const initials = this.getInitials(profile.displayName || 'Usuario');
    const avatarEl = this.querySelector('#nav-avatar-circle span');
    if (avatarEl) avatarEl.textContent = initials;

    // 2. Role-based UI visibility
    const isStudent = role === 'student';
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isDocente = role === 'docente' || role === 'personal';
    const isDept = !isStudent && !isAdmin && !isDocente;

    // QR Code Check: HIDDEN IN DESKTOP
    const qrBtn = this.querySelector('#btn-qr-nav');
    if (qrBtn) qrBtn.classList.add('d-none');

    // Search Check: HIDE FOR ADMINS
    const searchWrapper = this.querySelector('.search-wrapper');
    if (searchWrapper) searchWrapper.classList.toggle('d-none', isAdmin);

    // QR in Dropdown: Hide for admins
    const qrDropdownBtn = this.querySelector('#btn-qr-dropdown');
    if (qrDropdownBtn) qrDropdownBtn.classList.toggle('d-none', isAdmin);

    // 3. Update Brand Link
    const brandLink = this.querySelector('.navbar-brand');
    if (brandLink) {
      const defaultView = window.SIA?.getHomeView ? window.SIA.getHomeView(profile) : (allowedViews[0] || 'view-dashboard');

      brandLink.onclick = (e) => {
        e.preventDefault();
        if (window.navigate) window.navigate(defaultView);
        return false;
      };
    }

    // C2-01: Init notifications
    this._initNotifications();

    // C2-03: Update drawer with role-based visibility
    this._updateDrawerVisibility(profile);
  }

  // ── C2-01: Notifications Feed ──
  _initNotifications() {
    const list = this.querySelector('#nav-notif-list-v2');
    const dot = this.querySelector('#notif-dot');
    if (!list) return;

    // Delegate the dropdown rendering to the centralized notification service.
    // Avisos institucionales now live only in view-avisos / openGlobalAvisosModal().
    if (window.Notify?._render) {
      window.Notify._render();
      return;
    }

    list.innerHTML = '<li class="text-center text-muted small py-3"><i class="bi bi-bell-slash me-2"></i>Sin notificaciones</li>';
    if (dot) dot.classList.add('d-none');
  }

  _renderNotifications(notifications) {
    const list = this.querySelector('#nav-notif-list-v2');
    const dot = this.querySelector('#notif-dot');
    if (!list || !notifications) return;

    if (notifications.length === 0) {
      list.innerHTML = '<li class="text-center text-muted small py-3"><i class="bi bi-bell-slash me-2"></i>Sin notificaciones</li>';
      if (dot) dot.classList.add('d-none');
      return;
    }

    if (dot) dot.classList.remove('d-none');
    list.innerHTML = notifications.map(n => `
      <li class="p-2 rounded-3 mb-1" style="cursor:pointer;">
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-${n.icon || 'bell'} text-primary"></i>
          <div>
            <div class="fw-bold extra-small">${n.title}</div>
            <div class="extra-small text-muted">${n.message || ''}</div>
          </div>
        </div>
      </li>`).join('');
  }

  _timeAgo(date) {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  // ── C2-03: Update drawer visibility ──
  _updateDrawerVisibility(profile) {
    const allowedViews = window.SIA?.getEffectiveAllowedViews ? window.SIA.getEffectiveAllowedViews(profile) : (profile?.allowedViews || []);
    this.querySelectorAll('.app-icon-item').forEach((item) => {
      const viewId = item.dataset.view;
      if (!viewId) return;
      const isVisible = viewId === 'view-profile' || allowedViews.some((allowedView) => viewId === allowedView || viewId.startsWith(`${allowedView}-`));
      item.classList.toggle('d-none', !isVisible);
    });
  }

  setupListeners() {
    // Search
    const searchInput = this.querySelector('#global-search-input-navbar');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const event = new CustomEvent('sia-search-input', { detail: { term: e.target.value } });
        window.dispatchEvent(event);
      });
    }

    // App Drawer Items
    this.querySelectorAll('.app-icon-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.dataset.view;
        if (view && window.navigate) window.navigate(view);
      });
    });

    // Profile Nav
    this.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.closest('[data-view]').dataset.view;
        if (view && window.navigate) window.navigate(view);
      });
    });

    // Logout
    const logoutBtn = this.querySelector('#btn-logout-v2');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.logout) window.logout();
      });
    }

    // QR Code from Dropdown
    const qrDropdownBtn = this.querySelector('#btn-qr-dropdown');
    if (qrDropdownBtn) {
      qrDropdownBtn.addEventListener('click', () => {
        if (window.openDigitalID) {
          window.openDigitalID();
        } else if (this.openRefactoredDigitalID) {
          this.openRefactoredDigitalID();
        } else {
          if (window.navigate) {
            window.navigate('view-profile');
            setTimeout(() => { if (window.openDigitalID) window.openDigitalID(); }, 500);
          }
        }
      });
    }

    // QR Code (Legacy - now hidden in desktop)
    const qrBtn = this.querySelector('#btn-qr-nav');
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        if (window.Profile && window.Profile.openDigitalID) {
          window.Profile.openDigitalID();
        } else {
          if (window.navigate) {
            window.navigate('view-profile');
            setTimeout(() => { if (window.Profile && window.Profile.openDigitalID) window.Profile.openDigitalID(); }, 800);
          }
        }
      });
    }

    // C2-03: Populate recents on drawer open
    const drawerDropdown = this.querySelector('#btn-app-drawer');
    if (drawerDropdown) {
      drawerDropdown.addEventListener('click', () => {
        setTimeout(() => this._populateDrawerRecents(), 50);
      });
    }
  }

  // ── C2-03: Populate recent views in drawer ──
  _populateDrawerRecents() {
    const container = this.querySelector('#drawer-recientes');
    if (!container) return;

    try {
      const recents = JSON.parse(localStorage.getItem('sia_recent_views') || '[]');
      if (recents.length === 0) {
        container.classList.add('d-none');
        return;
      }

      container.classList.remove('d-none');
      container.innerHTML = `
        <div class="extra-small text-muted text-uppercase fw-bold mb-2 mt-1" style="letter-spacing:0.05em;">Recientes</div>
        ${recents.map(r => {
          const ago = this._timeAgo(new Date(r.time));
          return `<a href="#" class="d-flex align-items-center gap-2 py-2 px-1 rounded-2 text-decoration-none drawer-recent-item"
            data-view="${r.viewId}">
            <i class="bi bi-clock-history text-muted extra-small"></i>
            <span class="small fw-medium" style="color: var(--text-heading);">${r.label}</span>
            <span class="extra-small text-muted ms-auto">${ago}</span>
          </a>`;
        }).join('')}`;

      container.querySelectorAll('.drawer-recent-item').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const view = el.dataset.view;
          if (view && window.navigate) window.navigate(view);
        });
      });
    } catch (e) {
      container.classList.add('d-none');
    }
  }

  render() {
    this.innerHTML = `
      <div class="d-none d-md-block container sticky-top pb-2">
      <nav class="navbar sia-navbar sticky-top">
        <div class="container-fluid d-flex align-items-center flex-nowrap gap-2">

          <!-- Brand + C2-02: Breadcrumb Pill -->
          <a class="navbar-brand d-flex align-items-center me-0" href="#">
            <img src="/assets/icons/sia.ico" width="32" height="32" alt="SIA">
            <span class="fw-bold ms-2 desktop-brand-text d-none d-lg-block"
              style="color: var(--nav-text); letter-spacing: -0.5px;">SIA</span>
          </a>
          <span class="badge rounded-pill d-none extra-small fw-bold ms-1 nav-context-pill" id="nav-context-pill"
            style="padding: 4px 10px; font-size: 0.65rem; transition: all 0.2s ease;"></span>

          <!-- Compact Search (Mobile & Desktop) -->
          <div class="search-wrapper position-relative flex-grow-1 mx-2">
            <i class="bi bi-search search-icon-sia"></i>
            <input type="text" id="global-search-input-navbar" class="search-input-sia" placeholder="Buscar modulos, libros, cursos..."
              autocomplete="off" />
            <div id="navbar-search-results" class="search-results-dropdown d-none"></div>
          </div>

          <div class="d-flex align-items-center gap-2">

            <!-- Visual Separator -->
            <div class="vr opacity-25 d-none d-lg-block" style="height: 24px;"></div>

            <!-- C2-03: App Drawer (Waffle) Expandido -->
            <div class="dropdown">
              <button class="nav-action-btn module-trigger-btn" id="btn-app-drawer" data-bs-toggle="dropdown"
                      title="Aplicaciones" aria-label="Abrir menu de aplicaciones">
                <i class="bi bi-grid-fill fs-5"></i>
              </button>
              <div class="dropdown-menu dropdown-menu-end app-drawer-dropdown mt-2 p-3 border-0 shadow-lg rounded-4" style="width: 320px;">
                <div class="app-grid text-center">
                  <a href="#" data-view="view-aula" class="app-icon-item">
                    <img src="assets/icons/aula.ico" alt="Aula" width="40" height="40"><span>Aula</span>
                  </a>
                  <a href="#" data-view="view-comunidad" class="app-icon-item">
                    <img src="images/comunidad.png" alt="Comunidad" width="40" height="40" style="object-fit:contain;">
                    <span>Comunidad</span>
                  </a>
                  <a href="#" data-view="view-medi" class="app-icon-item">
                    <img src="images/medi.png" alt="Medico" width="40" height="40"><span>Medico</span>
                  </a>
                  <a href="#" data-view="view-biblio" class="app-icon-item">
                    <img src="images/biblio.png" alt="Biblioteca" width="40" height="40"><span>Biblioteca</span>
                  </a>
                  <a href="#" data-view="view-foro" class="app-icon-item">
                    <img src="images/foro.png" alt="Foro" width="40" height="40"><span>Foro</span>
                  </a>
                  <a href="#" data-view="view-quejas" class="app-icon-item">
                    <img src="images/quejas.png" alt="Quejas" width="40" height="40"><span>Quejas</span>
                  </a>
                  <a href="#" data-view="view-encuestas" class="app-icon-item">
                    <img src="images/encuestas.png" alt="Encuestas" width="40" height="40"><span>Encuestas</span>
                  </a>
                  <a href="#" data-view="view-profile" class="app-icon-item">
                    <img src="assets/icons/perfil.ico" alt="Perfil" width="40" height="40"><span>Perfil</span>
                  </a>
                  <a href="#" data-view="view-cafeteria" class="app-icon-item">
                    <img src="images/cafeteria.png" alt="Cafeteria" width="40" height="40"><span>Cafeteria</span>
                  </a>
                  <a href="#" data-view="view-lactario" class="app-icon-item d-none" id="drawer-item-lactario">
                    <div class="d-flex align-items-center justify-content-center rounded-3" style="width:40px;height:40px;background:linear-gradient(135deg,#E83E8C,#f093fb);">
                      <i class="bi bi-heart-fill text-white" style="font-size:1.1rem;"></i>
                    </div>
                    <span>Lactario</span>
                  </a>
                </div>
                <!-- Recientes -->
                <div id="drawer-recientes" class="d-none mt-2 pt-2" style="border-top: 1px solid var(--border-color);"></div>
              </div>
            </div>

            <!-- C2-01: Notifications with real feed -->
            <div class="dropdown">
              <button class="nav-action-btn position-relative" id="notif-dropdown-btn" data-bs-toggle="dropdown"
                      title="Notificaciones" aria-label="Ver notificaciones">
                <i class="bi bi-bell fs-5"></i>
                <span class="badge-dot d-none" id="notif-dot"></span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 p-2"
                  style="width: 340px; max-height: 420px; overflow-y: auto;"
                  id="nav-notif-list-v2">
                <li class="text-center text-muted small py-3">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Cargando...
                </li>
              </ul>
            </div>

            <!-- Visual Separator -->
            <div class="vr opacity-25 ms-1" style="height: 24px;"></div>

            <!-- Profile Avatar Dropdown -->
            <div class="dropdown">
              <button class="btn p-0 border-0 d-flex align-items-center gap-2" data-bs-toggle="dropdown"
                      aria-label="Menu de usuario">
                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold small"
                     style="width: 36px; height: 36px;" id="nav-avatar-circle">
                  <span class="fw-bold text-white small">U</span>
                </div>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3 mt-2" style="min-width: 200px;">
                <li><button class="dropdown-item small" data-view="view-profile">
                  <i class="bi bi-person-circle me-2"></i>Mi Perfil
                </button></li>
                <li><button class="dropdown-item small" id="btn-qr-dropdown">
                  <i class="bi bi-qr-code me-2"></i>Mi Credencial Digital
                </button></li>
                <li><hr class="dropdown-divider my-1"></li>
                <li><button class="dropdown-item text-danger small fw-bold" id="btn-logout-v2">
                  <i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesion
                </button></li>
              </ul>
            </div>

          </div>
        </div>
      </nav>
      </div>


      <!-- MOBILE BOTTOM NAV - REMOVED TO AVOID DUPLICATION WITH INDEX.HTML -->
      </div>
      `;

    // No mobile events needed here
  }

  openRefactoredDigitalID() {
    const modalEl = document.getElementById('modalDigitalID');
    if (!modalEl) {
      console.error("Modal ID Digital no encontrado en root.");
      return;
    }

    const user = (window.SIA && window.SIA.currentUserProfile)
      ? window.SIA.currentUserProfile
      : (window.currentUserProfile || {});

    const name = user.displayName || 'Estudiante';
    const uid = user.uid || 'N/A';
    const email = user.email || '';

    let matricula = user.matricula;
    if (!matricula) {
      if (email.includes('@')) {
        const prefix = email.split('@')[0];
        if (/^\d+$/.test(prefix)) matricula = prefix;
      }
      if (!matricula && uid) matricula = uid.substring(0, 8).toUpperCase();
    }

    const matEl = document.getElementById('prof-id-matricula');
    if (matEl) matEl.textContent = matricula || '-------';

    const nameEl = document.getElementById('prof-id-name');
    if (nameEl) nameEl.textContent = name;

    const qrValue = matricula && matricula !== '-------' ? matricula : uid;

    const qrImg = document.getElementById('prof-qr-full');
    if (qrImg && qrValue) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrValue}`;
    }

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }
}

if (!customElements.get('sia-navbar')) {
  customElements.define('sia-navbar', SiaNavbar);
}
