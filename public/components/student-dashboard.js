/**
 * SIA Student Dashboard - Dashboard principal del estudiante
 */
class SiaStudentDashboard extends HTMLElement {
    constructor() {
        super();
        this._profileHandler = null;
    }

    connectedCallback() {
        this.render();
        this._hydrate();
        // Escuchar evento global de perfil cargado (se dispara desde app.js)
        this._profileHandler = (e) => this._onProfileReady(e.detail);
        window.addEventListener('sia-profile-ready', this._profileHandler);
    }

    disconnectedCallback() {
        if (this._profileHandler) {
            window.removeEventListener('sia-profile-ready', this._profileHandler);
        }
    }

    // ── Utilidades ───────────────────────────────────────────────────

    _getGreeting() {
        const h = new Date().getHours();
        if (h >= 6 && h < 12) return 'Buenos dias';
        if (h >= 12 && h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    _getFormattedDate() {
        const str = new Date().toLocaleDateString('es-MX', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ── Render principal ─────────────────────────────────────────────

    render() {
        this.innerHTML = `
      <!-- HEADER: Saludo + Fecha + QR + Tutorial + Avatar -->
      <div class="sia-dash-header d-flex justify-content-between align-items-start mb-4 pt-2 dash-section" style="animation-delay: 0ms;">
        <div class="flex-grow-1">
          <p class="text-secondary small mb-0 fw-medium" id="dash-greeting">${this._getGreeting()},</p>
          <h2 class="fw-bold mb-0" id="dash-user-name" style="color: var(--text-heading);">
            <span class="skeleton-loader skeleton-text" style="width: 140px; height: 1.3em; display:inline-block;"></span>
          </h2>
          <p class="text-muted extra-small mb-0 mt-1" id="dash-date">${this._getFormattedDate()}</p>
        </div>

        <!-- Acciones header: QR + Tutorial + Avatar -->
        <div class="d-flex align-items-center gap-2 ms-2">

          <!-- Boton QR rapido -->
          <button class="btn sia-btn-qr" id="dash-qr-btn" title="Abrir ID Digital">
            <i class="bi bi-qr-code-scan"></i>
            <span class="d-none d-sm-inline ms-1">Mi QR</span>
          </button>

          <!-- Boton Ver Tutorial -->
          <button class="btn sia-btn-tutorial" id="btn-replay-tutorial" title="Ver tutorial del sistema">
            <i class="bi bi-play-circle"></i>
            <span class="d-none d-sm-inline ms-1">Tutorial</span>
          </button>

          <!-- Avatar (click → perfil) -->
          <div class="position-relative" id="dash-avatar-wrapper"
               onclick="window.SIA.navigate('view-profile')" style="cursor:pointer; flex-shrink:0;">
            <div class="dashboard-avatar shadow-sm">
              <span id="dash-avatar-initials">?</span>
              <img id="dash-avatar-img" src="" class="d-none" alt="Avatar">
            </div>
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-success border border-dark rounded-circle"
                  style="width:10px; height:10px;">
            </span>
          </div>
        </div>
      </div>

      <!-- SECTION: AVISOS (STORIES) -->
      <section class="mb-4 dash-section" style="animation-delay: 100ms;">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Novedades</h6>
          <span class="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 small" style="cursor:pointer;"
            onclick="openGlobalAvisosModal()">Ver todo</span>
        </div>

        <!-- Stories Scroll Container -->
        <div class="stories-container d-flex gap-3 overflow-auto pb-2" id="dashboard-stories-wrapper">
          <!-- Skeleton stories mientras carga -->
          <div class="story-item text-center">
            <div class="story-ring mb-1"><div class="story-circle skeleton-loader"></div></div>
            <span class="skeleton-loader" style="width:56px;height:0.6em;display:block;border-radius:4px;margin:2px auto 0;"></span>
          </div>
          <div class="story-item text-center">
            <div class="story-ring mb-1"><div class="story-circle skeleton-loader"></div></div>
            <span class="skeleton-loader" style="width:56px;height:0.6em;display:block;border-radius:4px;margin:2px auto 0;"></span>
          </div>
          <div class="story-item text-center">
            <div class="story-ring mb-1"><div class="story-circle skeleton-loader"></div></div>
            <span class="skeleton-loader" style="width:56px;height:0.6em;display:block;border-radius:4px;margin:2px auto 0;"></span>
          </div>
        </div>
      </section>

      <!-- SECTION: SMART CARDS (MODULES) -->
      <section class="mb-5 dash-section" style="animation-delay: 200ms;">
        <h6 class="fw-bold text-secondary text-uppercase small mb-3 px-1 ls-1">Tus Modulos</h6>

        <div class="row g-3 sia-modules-grid">

          <!-- CARD: LACTARIO (Dynamic Visibility) -->
          <div class="col-6 col-md-4 d-none animate-fade-in" id="smart-card-lactario-wrapper">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden"
              id="smart-card-lactario"
              onclick="window.SIA.navigate('view-lactario')">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/lactario.png" alt="Lactario" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Sala de Lactancia</h6>
              <p class="extra-small text-muted mb-0">Reservar sala</p>
            </div>
          </div>

          <!-- CARD: MEDI -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-medi"
              onclick="window.SIA.navigate('view-medi')" style="animation-delay: 250ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/medi.png" alt="Medi" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Servicios Médicos</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-medi-status">Citas medicas y atencion</p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-medi"></div>
            </div>
          </div>

          <!-- CARD: BIBLIO -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-biblio"
              onclick="window.SIA.navigate('view-biblio')" style="animation-delay: 300ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/biblio.png" alt="Biblio" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Biblioteca</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-biblio-status">Visita y llevate un libro a casa</p>
            </div>
          </div>

          <!-- CARD: FORO -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-foro"
              onclick="window.SIA.navigate('view-foro')" style="animation-delay: 350ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/foro.png" alt="Foro" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Eventos</h6>
              <p class="extra-small text-muted mb-0">Conferencias y mas</p>
            </div>
          </div>

          <!-- CARD: AULA -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-aula"
              onclick="window.SIA.navigate('view-aula')" style="animation-delay: 400ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/aula.png" alt="Aula" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Aula Virtual</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-aula-status">Consigue certificaciones en distintos cursos</p>
            </div>
          </div>

          <!-- CARD: QUEJAS -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-quejas"
              onclick="window.SIA.navigate('view-quejas')" style="animation-delay: 450ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3 d-flex align-items-center justify-content-center">
                  <img src="images/quejas.png" alt="Quejas" style="width:62px;height:62px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Quejas y Sugerencias</h6>
              <p class="extra-small text-muted mb-0">Buzon de Calidad</p>
            </div>
          </div>

          <!-- CARD: ENCUESTAS -->
          <div class="col-6 col-md-4">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-encuestas"
              onclick="window.SIA.navigate('view-encuestas')" style="animation-delay: 500ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3 d-flex align-items-center justify-content-center">
                  <img src="images/encuestas.png" alt="Encuestas" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Encuestas</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-encuestas-status">Tu opinion importa</p>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION: HELP BANNER -->
      <section class="mb-5 dash-section" style="animation-delay: 300ms;">
        <div class="smart-banner sia-help-banner p-4 rounded-4 shadow-sm text-white position-relative overflow-hidden"
          style="background: linear-gradient(135deg, #0A2540 0%, #0d3a63 100%);">
          <div class="position-absolute top-0 end-0 translate-middle p-5 bg-white opacity-10 rounded-circle"
            style="margin-right:-20px;margin-top:-20px;"></div>
          <div class="position-relative z-1">
            <h5 class="fw-bold filter-white mb-1">Necesitas ayuda?</h5>
            <p class="small opacity-75 mb-3" style="max-width:80%;">Reporta problemas, inicia tramites o contacta soporte.</p>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-light text-primary fw-bold rounded-pill px-3 shadow-sm"
                onclick="window.SIA.navigate('view-medi')">
                <i class="bi bi-chat-text-fill me-1"></i> Soporte
              </button>
              <button class="btn btn-sm btn-outline-light fw-bold rounded-pill px-3"
                onclick="window.open('mailto:soporte@loscabos.tecnm.mx')">
                Quejas
              </button>
            </div>
          </div>
        </div>
      </section>
        `;
    }

    // ── Hidratacion post-render ──────────────────────────────────────

    _hydrate() {
        this._setupQRButton();
        this._setupTutorialButton();

        // Intentar hidratar con datos ya disponibles
        const profile = window.SIA?.currentUserProfile || window.currentUserProfile;
        if (profile) {
            this._onProfileReady(profile);
        }
        // Si no hay perfil aun, el evento sia-profile-ready lo actualizara
    }

    // ── Callback cuando el perfil esta listo ─────────────────────────

    _onProfileReady(profile) {
        if (!profile) return;

        // Nombre
        const nameEl = this.querySelector('#dash-user-name');
        if (nameEl && profile.displayName) {
            nameEl.textContent = profile.displayName.split(' ').slice(0, 2).join(' ');
        }

        // Avatar: foto o iniciales
        const img = this.querySelector('#dash-avatar-img');
        const initials = this.querySelector('#dash-avatar-initials');
        if (!img || !initials) return;

        // Calcular iniciales
        const name = profile.displayName || '';
        if (name) {
            const parts = name.trim().split(' ');
            const ini = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : (parts[0][0] || 'U').toUpperCase();
            initials.textContent = ini;
        }

        // Intentar foto de Microsoft (photoURL)
        if (profile.photoURL) {
            img.src = profile.photoURL;
            img.onload = () => {
                img.classList.remove('d-none');
                initials.classList.add('d-none');
            };
            img.onerror = () => {
                img.classList.add('d-none');
                initials.classList.remove('d-none');
            };
        }

        // Verificar tutorial (primera vez)
        this._checkFirstTimeTutorial();
    }

    // ── Boton QR rapido ──────────────────────────────────────────────

    _setupQRButton() {
        const btn = this.querySelector('#dash-qr-btn');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // openDigitalID ya existe en app.js y puebla foto + QR correctamente
            if (typeof window.openDigitalID === 'function') {
                window.openDigitalID();
            } else {
                window.SIA?.navigate('view-profile');
            }
        });
    }

    // ── Tutorial ─────────────────────────────────────────────────────

    _setupTutorialButton() {
        const btn = this.querySelector('#btn-replay-tutorial');
        if (!btn) return;

        btn.addEventListener('click', () => {
            if (typeof SiaOnboardingTour !== 'undefined') {
                SiaOnboardingTour.resetForUser();
            }
            this._launchTutorial();
        });
    }

    _checkFirstTimeTutorial() {
        if (typeof SiaOnboardingTour !== 'undefined' && SiaOnboardingTour.shouldShow()) {
            setTimeout(() => this._launchTutorial(), 1000);
        }
    }

    _launchTutorial() {
        let tour = document.querySelector('sia-onboarding-tour');
        if (!tour) {
            tour = document.createElement('sia-onboarding-tour');
            document.body.appendChild(tour);
        }
        requestAnimationFrame(() => tour.start());
    }
}

if (!customElements.get('sia-student-dashboard')) {
    customElements.define('sia-student-dashboard', SiaStudentDashboard);
}
