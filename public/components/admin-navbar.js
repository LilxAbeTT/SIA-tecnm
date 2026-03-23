import { Store } from '../core/state.js';
import { Breadcrumbs } from '../core/breadcrumbs.js';

// Labels and colors for the breadcrumb
const VIEW_LABELS = {
    'view-dashboard': { label: 'Admin Panel', color: 'var(--primary)' },
    'view-medi': { label: 'Servicios Médicos', color: 'var(--med, #00D0FF)' },
    'view-biblio': { label: 'Biblioteca', color: 'var(--biblio, #FFD24D)' },
    'view-aula': { label: 'Aula Virtual', color: 'var(--aula, #4e1bda)' },
    'view-comunidad': { label: 'Comunidad', color: '#059669' },
    'view-foro': { label: 'Eventos', color: '#14532d' },
    'view-profile': { label: 'Mi Perfil', color: 'var(--primary)' },
    'view-quejas': { label: 'Quejas', color: '#10b981' },
    'view-encuestas': { label: 'Encuestas', color: '#f59e0b' },
    'view-lactario': { label: 'Lactario', color: '#E83E8C' },
    'view-reportes': { label: 'Reportes', color: 'var(--reportes, #6610f2)' },
};

// Acciones rápidas por módulo administrativo
// Podemos inyectar botones HTML directo dependiendo del viewId
const QUICK_ACTIONS = {
    'view-dashboard': `
    <button class="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold" onclick="window.navigate('view-reportes')">
      <i class="bi bi-graph-up me-1"></i> Reportes
    </button>
  `,
    'view-medi': `
    <button class="btn btn-sm btn-danger rounded-pill px-3 fw-bold shadow-sm" onclick="if(window.Medi) window.Medi.showAtencionRapida()">
      <i class="bi bi-plus-circle me-1"></i> Nueva Consulta
    </button>
  `,
    'view-biblio': `
    <button class="btn btn-sm btn-warning rounded-pill px-3 fw-bold shadow-sm text-dark" onclick="if(window.Biblio) window.Biblio.openScanner()">
      <i class="bi bi-upc-scan me-1"></i> Escanear
    </button>
  `,
    'view-aula': `
    <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm" onclick="if(window.Aula) window.Aula.crearCurso()">
      <i class="bi bi-journal-plus me-1"></i> Nuevo Curso
    </button>
  `,
    'view-foro': `
    <button class="btn btn-sm btn-info rounded-pill px-3 fw-bold shadow-sm text-dark" onclick="if(window.AdminForo?.crearEvento) window.AdminForo.crearEvento(); else if(window.AdminForo?.openEventModal) window.AdminForo.openEventModal();">
      <i class="bi bi-calendar-plus me-1"></i> Nuevo Evento
    </button>
  `,
    'view-reportes': `
    <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="if(window.AdminAudit) window.AdminAudit.generateMasterReport()">
      <i class="bi bi-download me-1"></i> Exportar Todo
    </button>
  `
};

class SiaAdminNavbar extends HTMLElement {
    constructor() {
        super();
        this.render = this.render.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this._viewChangedHandler = null;
        this._breadcrumbUnsub = null;
    }

    connectedCallback() {
        this.render();
        Store.on('user-changed', this.updateUser);
        Store.on('cleared', this.updateUser);
        this.setupListeners();
        this._setupViewListener();
        this._setupBreadcrumbListener();
        this._syncBreadcrumb(Breadcrumbs.getState());
        this._initThemeToggle();
    }

    disconnectedCallback() {
        Store.off('user-changed', this.updateUser);
        Store.off('cleared', this.updateUser);
        if (this._viewChangedHandler) window.removeEventListener('sia-view-changed', this._viewChangedHandler);
        if (this._breadcrumbUnsub) this._breadcrumbUnsub();
    }

    getInitials(name) {
        if (!name) return 'A';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }

    _setupBreadcrumbListener() {
        this._breadcrumbUnsub = Breadcrumbs.subscribe((state) => this._syncBreadcrumb(state));
    }

    _syncBreadcrumb(state) {
        const contextPill = this.querySelector('#admin-nav-context-pill');
        if (!contextPill) return;

        const shouldHide = !state || !state.pillLabel;
        if (shouldHide) {
            contextPill.classList.add('d-none');
            return;
        }

        const label = state.viewId === 'view-dashboard' ? 'Admin Panel' : state.pillLabel;
        contextPill.textContent = label;
        contextPill.style.background = state.color || 'var(--primary, #1B396A)';
        contextPill.style.color = '#fff';
        contextPill.classList.remove('d-none');
    }

    _setupViewListener() {
        this._viewChangedHandler = (e) => {
            const viewId = e.detail?.viewId;
            if (!viewId) return;

            // Update Quick Actions
            const actionsContainer = this.querySelector('#admin-quick-actions');
            if (actionsContainer) {
                const actionHtml = QUICK_ACTIONS[viewId] || '';
                actionsContainer.innerHTML = actionHtml;
            }
        };
        window.addEventListener('sia-view-changed', this._viewChangedHandler);
    }

    updateUser(data) {
        if (!data || !data.profile) return;
        const profile = data.profile;

        // Initials for avatar
        const initials = this.getInitials(profile.displayName || 'Admin');
        const avatarEl = this.querySelector('#admin-nav-avatar-circle span');
        if (avatarEl) avatarEl.textContent = initials;

        // Brand Link click behavior
        const brandLink = this.querySelector('.navbar-brand');
        if (brandLink) {
            brandLink.onclick = (e) => {
                e.preventDefault();
                const defaultView = window.SIA?.getHomeView ? window.SIA.getHomeView(profile) : 'view-dashboard';

                if (window.navigate) window.navigate(defaultView);
                return false;
            };
        }
    }

    setupListeners() {
        // Nav Profile items
        this.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('[data-view]').dataset.view;
                if (view && window.navigate) window.navigate(view);
            });
        });

        // Logout
        const logoutBtn = this.querySelector('#btn-admin-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (window.logout) window.logout();
            });
        }

        // Home button
        const homeBtn = this.querySelector('#btn-admin-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                if (window.navigate) {
                    const profile = window.SIA?.currentUserProfile || {};
                    const target = window.SIA?.getHomeView ? window.SIA.getHomeView(profile) : 'view-dashboard';
                    window.navigate(target);
                }
            });
        }
    }

    _initThemeToggle() {
        const themeBtn = this.querySelector('#btn-admin-theme-toggle');
        if (themeBtn) {
            // Set initial icon based on current theme
            const updateIcon = () => {
                const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
                themeBtn.innerHTML = currentTheme === 'dark'
                    ? '<i class="bi bi-moon-stars-fill"></i>'
                    : '<i class="bi bi-sun-fill text-warning"></i>';
            };

            updateIcon();

            themeBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                if (window.applyTheme) {
                    window.applyTheme(nextTheme);
                    updateIcon();
                }
            });
        }
    }

    render() {
        this.innerHTML = `
      <div class="d-none d-md-block container-fluid sticky-top pb-2 pt-2 px-3 px-lg-4">
        <nav class="navbar sia-admin-navbar sticky-top bg-white border rounded-4 shadow-sm" style="padding: 0.5rem 1.25rem;">
          <div class="d-flex align-items-center justify-content-between w-100 flex-nowrap gap-3">
            
            <!-- LEFT: Brand & Context -->
            <div class="d-flex align-items-center gap-3">
              <a class="navbar-brand d-flex align-items-center me-0" href="#">
                <img src="/assets/icons/sia.ico" width="32" height="32" alt="SIA">
                <div class="ms-2 d-none d-lg-block lh-1">
                  <span class="fw-bold desktop-brand-text d-block" style="color: var(--nav-text); letter-spacing: -0.5px;">SIA Admin</span>
                  <span class="text-muted" style="font-size: 0.65rem; letter-spacing: 0.5px;">WORKSPACE</span>
                </div>
              </a>

              <div class="vr opacity-25 d-none d-md-block" style="height: 24px;"></div>
              
              <button class="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center" 
                      id="btn-admin-home" title="Inicio / Dashboard" style="width: 36px; height: 36px;">
                <i class="bi bi-house-door-fill text-secondary"></i>
              </button>

              <span class="badge rounded-pill fw-bold fw-medium shadow-sm d-none" id="admin-nav-context-pill"
                style="padding: 6px 12px; font-size: 0.7rem; transition: all 0.2s ease;">Dashboard</span>
            </div>

            <!-- CENTER: Quick Actions Placeholder -->
            <div class="flex-grow-1 d-flex justify-content-center" id="admin-quick-actions">
              <!-- Dynamically populated based on active module -->
            </div>

            <!-- RIGHT: Actions & Profile -->
            <div class="d-flex align-items-center gap-2">
              
              <!-- Theme Toggle -->
              <button class="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center" 
                      id="btn-admin-theme-toggle" title="Cambiar Tema" style="width: 36px; height: 36px;">
                <i class="bi bi-moon-stars-fill"></i>
              </button>

              <!-- Notifications (Simulated for Admin) -->
              <button class="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center position-relative" 
                      title="Notificaciones" style="width: 36px; height: 36px;">
                <i class="bi bi-bell-fill text-secondary"></i>
              </button>

              <div class="vr opacity-25 ms-1 me-1" style="height: 24px;"></div>

              <!-- Profile Dropdown -->
              <div class="dropdown">
                <button class="btn p-0 border-0 d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-label="Menu de usuario">
                  <div class="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm"
                       style="width: 38px; height: 38px; border: 2px solid var(--border-color);" id="admin-nav-avatar-circle">
                    <span class="fw-bold text-white small">A</span>
                  </div>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-4 mt-2" style="min-width: 220px; padding: 0.5rem;">
                  <div class="px-3 py-2 border-bottom mb-2">
                    <span class="d-block fw-bold small text-dark">Modo Administrador</span>
                    <span class="d-block text-muted" style="font-size: 0.7rem;">Sesión segura activa</span>
                  </div>
                  <li><button class="dropdown-item rounded-3 small mb-1" data-view="view-profile">
                    <i class="bi bi-person-circle me-2 text-primary"></i>Configuración de Cuenta
                  </button></li>
                  <li><hr class="dropdown-divider my-2"></li>
                  <li><button class="dropdown-item rounded-3 text-danger small fw-bold" id="btn-admin-logout">
                    <i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesión Segura
                  </button></li>
                </ul>
              </div>

            </div>
          </div>
        </nav>
      </div>
    `;
    }
}

if (!customElements.get('sia-admin-navbar')) {
    customElements.define('sia-admin-navbar', SiaAdminNavbar);
}
