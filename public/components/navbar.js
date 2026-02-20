import { Store } from '../core/state.js';
import { UiManager } from '../core/ui.js';

class SiaNavbar extends HTMLElement {
  constructor() {
    super();
    this.render = this.render.bind(this);
    this.updateUser = this.updateUser.bind(this);
  }

  connectedCallback() {
    this.render();
    Store.on('user-changed', this.updateUser);
    Store.on('cleared', this.updateUser);
    this.setupListeners();
  }

  getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  updateUser(data) {
    if (!data || !data.profile) return;

    const profile = data.profile;
    const role = profile.role || 'student';

    // 1. Initials
    const initials = this.getInitials(profile.displayName || 'Usuario');
    const avatarEl = this.querySelector('#nav-avatar-circle span');
    if (avatarEl) avatarEl.textContent = initials;

    // 2. Role-based UI visibility
    const isStudent = role === 'student';
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isDocente = role === 'docente' || role === 'personal';
    // Allow admins/students/docentes to see full nav. Others (restricted deps) are strict.
    const isDept = !isStudent && !isAdmin && !isDocente;

    // QR Code Check: HIDDEN IN DESKTOP (moved to profile dropdown)
    const qrBtn = this.querySelector('#btn-qr-nav');
    if (qrBtn) {
      qrBtn.classList.add('d-none'); // Always hidden in desktop navbar
    }

    // Search Check: HIDE FOR ADMINS
    const searchWrapper = this.querySelector('.search-wrapper');
    if (searchWrapper) {
      searchWrapper.classList.toggle('d-none', isAdmin);
    }

    // QR in Dropdown: Hide for admins
    const qrDropdownBtn = this.querySelector('#btn-qr-dropdown');
    if (qrDropdownBtn) {
      qrDropdownBtn.classList.toggle('d-none', isAdmin);
    }

    // 3. Update Brand Link
    const brandLink = this.querySelector('.navbar-brand');
    if (brandLink) {
      let defaultView = 'view-dashboard';
      if (role === 'bibliotecario' || role === 'biblio' || role === 'biblio_admin') defaultView = 'view-biblio';
      if (role === 'medico' || role === 'psicologo') defaultView = 'view-medi';
      if (role === 'aula_admin') defaultView = 'view-aula';
      if (role === 'foro_admin') defaultView = 'view-foro';

      brandLink.onclick = (e) => {
        e.preventDefault();
        if (window.navigate) window.navigate(defaultView);
        return false;
      };
    }
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
        // Direct Modal Open (using global function from navbar.js)
        if (window.openDigitalID) {
          window.openDigitalID();
        } else if (this.openRefactoredDigitalID) {
          this.openRefactoredDigitalID();
        } else {
          // Fallback: Navigate to profile and open modal
          if (window.navigate) {
            window.navigate('view-profile');
            setTimeout(() => {
              if (window.openDigitalID) window.openDigitalID();
            }, 500);
          }
        }
      });
    }

    // QR Code (Legacy - now hidden in desktop)
    const qrBtn = this.querySelector('#btn-qr-nav');
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        // Direct Modal Open (Requires Profile module loaded or usable global)
        if (window.Profile && window.Profile.openDigitalID) {
          window.Profile.openDigitalID();
        } else {
          // Fallback if Profile module not physically loaded yet (shouldn't happen in SPA but safety first)
          if (window.navigate) {
            window.navigate('view-profile');
            // Give it a moment to load then try opening
            setTimeout(() => {
              if (window.Profile && window.Profile.openDigitalID) window.Profile.openDigitalID();
            }, 800);
          }
        }
      });
    }
  }

  render() {
    this.innerHTML = `
      <div class="d-none d-md-block container sticky-top pb-2">
      <nav class="navbar sia-navbar sticky-top">
        <div class="container-fluid d-flex align-items-center flex-nowrap gap-2">

          <!-- Brand -->
          <a class="navbar-brand d-flex align-items-center me-0" href="#">
            <img src="/assets/icons/sia.ico" width="32" height="32" alt="SIA">
            <span class="fw-bold ms-2 desktop-brand-text d-none d-lg-block"
              style="color: var(--nav-text); letter-spacing: -0.5px;">SIA</span>
          </a>

          <!-- Compact Search (Mobile & Desktop) -->
          <div class="search-wrapper position-relative flex-grow-1 mx-2">
            <i class="bi bi-search search-icon-sia"></i>
            <input type="text" id="global-search-input-navbar" class="search-input-sia" placeholder="Buscar..."
              autocomplete="off" />
            <div id="navbar-search-results" class="search-results-dropdown d-none"></div>
          </div>

          <div class="d-flex align-items-center gap-2">

            <!-- Visual Separator -->
            <div class="vr opacity-25 d-none d-lg-block" style="height: 24px;"></div>

            <!-- App Drawer (Waffle) -->
            <div class="dropdown">
              <button class="nav-action-btn module-trigger-btn" id="btn-app-drawer" data-bs-toggle="dropdown"
                      title="Aplicaciones" aria-label="Abrir menú de aplicaciones">
                <i class="bi bi-grid-fill fs-5"></i>
              </button>
              <div class="dropdown-menu dropdown-menu-end app-drawer-dropdown mt-2 p-3 border-0 shadow-lg rounded-4" style="width: 280px;">
                <div class="app-grid text-center">
                  <a href="#" data-view="view-aula" class="app-icon-item">
                    <img src="assets/icons/aula.ico" alt="Aula" width="40" height="40"><span>Aula</span>
                  </a>
                  <a href="#" data-view="view-medi" class="app-icon-item">
                    <img src="assets/icons/medi.ico" alt="Médico" width="40" height="40"><span>Médico</span>
                  </a>
                  <a href="#" data-view="view-biblio" class="app-icon-item">
                    <img src="assets/icons/biblio.ico" alt="Biblioteca" width="40" height="40"><span>Biblioteca</span>
                  </a>
                  <a href="#" data-view="view-foro" class="app-icon-item">
                    <img src="assets/icons/foro.ico" alt="Foro" width="40" height="40"><span>Foro</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Notifications -->
            <div class="dropdown">
              <button class="nav-action-btn position-relative" id="notif-dropdown-btn" data-bs-toggle="dropdown"
                      title="Notificaciones" aria-label="Ver notificaciones">
                <i class="bi bi-bell fs-5"></i>
                <span class="badge-dot d-none" id="notif-dot"></span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 p-2"
                  style="width: 320px; max-height: 400px; overflow-y: auto;"
                  id="nav-notif-list-v2">
                <li class="text-center text-muted small py-2">No hay notificaciones</li>
              </ul>
            </div>

            <!-- Visual Separator (before user section) -->
            <div class="vr opacity-25 ms-1" style="height: 24px;"></div>

            <!-- Profile Avatar Dropdown -->
            <div class="dropdown">
              <button class="btn p-0 border-0 d-flex align-items-center gap-2" data-bs-toggle="dropdown"
                      aria-label="Menú de usuario">
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
                  <i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesión
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
    // Direct global method independent of Profile module
    // Find modal at root
    const modalEl = document.getElementById('modalDigitalID');
    if (!modalEl) {
      console.error("Modal ID Digital no encontrado en root.");
      return;
    }

    // FIX: Use the reliable global state from app.js (SIA namespace usually holds it)
    // Fallback chain: SIA.currentUserProfile -> window.currentUserProfile -> minimal Auth object
    const user = (window.SIA && window.SIA.currentUserProfile)
      ? window.SIA.currentUserProfile
      : (window.currentUserProfile || {});

    // Basic Data
    const name = user.displayName || 'Estudiante';
    const uid = user.uid || 'N/A';
    const email = user.email || '';

    // Matricula Logic
    let matricula = user.matricula;
    if (!matricula) {
      if (email.includes('@')) {
        const prefix = email.split('@')[0];
        if (/^\d+$/.test(prefix)) matricula = prefix;
      }
      if (!matricula && uid) matricula = uid.substring(0, 8).toUpperCase();
    }

    // Populate UI
    const matEl = document.getElementById('prof-id-matricula');
    if (matEl) matEl.textContent = matricula || '-------';

    const nameEl = document.getElementById('prof-id-name');
    if (nameEl) nameEl.textContent = name;

    // Generate QR using Matricula if possible, else UID
    const qrValue = matricula && matricula !== '-------' ? matricula : uid;

    const qrImg = document.getElementById('prof-qr-full');
    if (qrImg && qrValue) {
      // Use standard QR API
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrValue}`;
    }

    // Show
    const bsModal = new bootstrap.Modal(modalEl); // Force new instance to avoid stale state?
    bsModal.show();
  }
}

if (!customElements.get('sia-navbar')) {
  customElements.define('sia-navbar', SiaNavbar);
}
