/**
 * SIA Student Dashboard - Dashboard avanzado del estudiante
 * Incluye: datos en vivo, actividad semanal, eventos, scorecard, tips, SOS, offline, reorder
 */
class SiaStudentDashboard extends HTMLElement {
  constructor() {
    super();
    this._profileHandler = null;
    this._viewChangedHandler = null;
    this._onlineHandler = null;
    this._offlineHandler = null;
    this._freshnessInterval = null;
    this._skeletonTimeout = null;
    this._profile = null;
    this._reportBtnObserver = null;
    this._panicStateHandler = null;
    this._panicDraft = null;
    this._tutorialCheckedUid = null;
    this._tutorialLaunchTimeout = null;
    this._viewHandler = null;
    this._goalsDraft = [];
    this._dashboardSessionUid = null;
  }

  connectedCallback() {
    this.render();
    this._hydrate();
    this._profileHandler = (e) => this._onProfileReady(e.detail);
    window.addEventListener('sia-profile-ready', this._profileHandler);
    this._viewHandler = (e) => {
      const viewId = e?.detail?.viewId || null;
      if (viewId !== 'view-dashboard') {
        if (this._tutorialLaunchTimeout) {
          clearTimeout(this._tutorialLaunchTimeout);
          this._tutorialLaunchTimeout = null;
        }
        return;
      }

      const profile = this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || null;
      const tutorialUid = profile?.uid || window.SIA?.auth?.currentUser?.uid || null;
      if (tutorialUid && this._tutorialCheckedUid !== tutorialUid) {
        this._tutorialCheckedUid = tutorialUid;
        this._checkFirstTimeTutorial();
      }
    };
    window.addEventListener('sia-view-changed', this._viewHandler);
    this._panicStateHandler = (event) => this._handlePanicStateChanged(event?.detail || {});
    window.addEventListener('sia-panic-state-changed', this._panicStateHandler);
    this._setupOfflineDetection();
  }

  disconnectedCallback() {
    if (this._profileHandler) window.removeEventListener('sia-profile-ready', this._profileHandler);
    if (this._viewHandler) window.removeEventListener('sia-view-changed', this._viewHandler);
    if (this._panicStateHandler) window.removeEventListener('sia-panic-state-changed', this._panicStateHandler);
    if (this._onlineHandler) window.removeEventListener('online', this._onlineHandler);
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);
    if (this._freshnessInterval) clearInterval(this._freshnessInterval);
    if (this._skeletonTimeout) clearTimeout(this._skeletonTimeout);
    if (this._tutorialLaunchTimeout) clearTimeout(this._tutorialLaunchTimeout);
    if (this._reportBtnObserver) this._reportBtnObserver.disconnect();
  }

  // ── Utilidades ───────────────────────────────────────────────────

  _getGreeting() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'Buenos días';
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
      <!-- OFFLINE BANNER -->
      <div id="dash-offline-banner" class="d-none dash-offline-banner mb-3 dash-section" style="animation-delay: 0ms;">
        <div class="d-flex align-items-center gap-2 p-3 rounded-3" style="background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.3);">
          <i class="bi bi-wifi-off text-warning"></i>
          <span class="extra-small fw-medium text-warning">Sin conexion — Mostrando datos en cache</span>
        </div>
      </div>

      <!-- HEADER: Saludo + Fecha + QR + Tutorial + Avatar -->
      <div class="sia-dash-header d-flex justify-content-between align-items-start mb-4 pt-2 dash-section" style="animation-delay: 0ms;">
        <div class="flex-grow-1">
          <p class="text-secondary small mb-0 fw-medium" id="dash-greeting">${this._getGreeting()},</p>
          <h2 class="fw-bold mb-0" id="dash-user-name" style="color: var(--text-heading);">
            <span class="skeleton-loader skeleton-text" style="width: 140px; height: 1.3em; display:inline-block;"></span>
          </h2>
          <p class="text-muted extra-small mb-0 mt-1" id="dash-date">${this._getFormattedDate()}</p>
          <div class="d-none" id="dash-header-status"></div>
        </div>

        <!-- Acciones header: Dark Mode + QR + Tutorial + Avatar Dropdown -->
        <div class="dash-header-actions d-flex align-items-center gap-2 ms-2">

          <!-- Boton Modo Oscuro -->
          <button class="btn btn-light rounded-circle shadow-sm d-flex align-items-center justify-content-center p-0" id="dash-dark-mode-btn" title="Alternar Modo Oscuro" style="width: 36px; height: 36px;" onclick="if(typeof toggleDarkMode === 'function') toggleDarkMode(); else document.getElementById('theme-toggle-btn')?.click();">
            <i class="bi bi-moon-stars-fill text-dark" style="font-size: 1.1rem;"></i>
          </button>

          <!-- Boton Mapa del Campus -->
          <button class="btn btn-sm d-flex align-items-center px-3 shadow-sm rounded-pill fw-bold" id="dash-campus-map-btn" title="Abrir mapa del campus">
            <i class="bi bi-geo-alt-fill me-1" style="font-size: 1rem;"></i>
            <span class="d-none d-sm-inline ms-1">Mapa</span>
          </button>

          <!-- Boton QR rapido -->
          <button class="btn sia-btn-qr" id="dash-qr-btn" title="Abrir ID Digital">
            <i class="bi bi-qr-code-scan"></i>
            <span class="d-none d-sm-inline ms-1">Mi QR</span>
          </button>

          <!-- Boton Ver Tutorial -->
          <button class="btn btn-primary btn-sm d-flex align-items-center px-3 shadow-sm rounded-pill fw-bold text-white" id="btn-replay-tutorial" title="Ver tutorial del sistema" style="background-color: var(--accent, #0ea5e9); border: none;">
            <i class="bi bi-question-circle-fill me-1" style="font-size: 1.1rem;"></i>
            <span class="d-none d-sm-inline ms-1">Tutorial</span>
          </button>

          <!-- C1-07: Avatar con Dropdown -->
          <div class="dropdown" id="dash-avatar-dropdown" style="z-index:1050;">
            <div class="position-relative" id="dash-avatar-wrapper"
                 data-bs-toggle="dropdown" data-bs-display="dynamic" aria-expanded="false"
                 style="cursor:pointer; flex-shrink:0;">
              <div class="dashboard-avatar shadow-sm">
                <span id="dash-avatar-initials">?</span>
                <img id="dash-avatar-img" src="" class="d-none" alt="Avatar">
              </div>
              <span class="position-absolute top-0 start-100 translate-middle p-1 bg-success border border-dark rounded-circle"
                    style="width:10px; height:10px;"></span>
            </div>
            <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 p-3 dash-avatar-menu" style="min-width: 220px; z-index:1060; position:absolute !important;">
              <li class="mb-2 px-1">
                <div class="fw-bold small" id="dash-dropdown-name" style="color: var(--text-heading);">Estudiante</div>
                <div class="extra-small text-muted" id="dash-dropdown-carrera"></div>
                <div class="extra-small text-muted" id="dash-dropdown-semestre"></div>
              </li>
              <li><hr class="dropdown-divider my-2"></li>
              <li><button class="dropdown-item small rounded-3 py-2" onclick="window.SIA.navigate('view-profile')">
                <i class="bi bi-person-circle me-2 text-primary"></i>Ver Perfil
              </button></li>
              <li><button class="dropdown-item small rounded-3 py-2" id="dash-dropdown-qr">
                <i class="bi bi-qr-code me-2" style="color: var(--accent);"></i>Mi Credencial Digital
              </button></li>
              <li><hr class="dropdown-divider my-2"></li>
              <li><button class="dropdown-item small rounded-3 py-2" id="dash-dropdown-reset-order">
                <i class="bi bi-arrow-repeat me-2 text-secondary"></i>Restablecer orden de modulos
              </button></li>
              <li><hr class="dropdown-divider my-2"></li>
              <li><button class="dropdown-item text-danger small fw-bold rounded-3 py-2" id="dash-dropdown-logout">
                <i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesion
              </button></li>
            </ul>
          </div>
        </div>
      </div>

      <!-- SECTION: AVISOS (STORIES) -->
      <section class="mb-4 dash-section" style="animation-delay: 100ms;">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Novedades</h6>
          <div class="d-flex align-items-center gap-2">
            <span class="extra-small text-muted" id="dash-stories-meta">0 guardadas</span>
            <span class="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 small" style="cursor:pointer;"
              onclick="window.openGlobalAvisosModal?.()">Ver todo</span>
          </div>
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

      <!-- C3-01: WIDGET DE ACTIVIDAD SEMANAL -->
      <section class="mb-4 dash-section" style="animation-delay: 150ms;" id="dash-activity-section">
        <h6 class="fw-bold text-secondary text-uppercase small mb-3 px-1 ls-1">Tu Semana</h6>
        <div class="d-flex gap-2 justify-content-between px-1" id="dash-activity-strip">
          ${this._renderActivitySkeletons()}
        </div>
      </section>

      <section class="mb-4 dash-section" style="animation-delay: 175ms;" id="dash-task-center-section">
        <div class="d-flex flex-column gap-3">
          <div class="d-flex justify-content-between align-items-start gap-3 px-1">
            <div>
              <h6 class="fw-bold text-secondary text-uppercase small mb-1 ls-1">Centro de Tareas</h6>
              <div class="extra-small text-muted" id="dash-task-center-summary">Priorizando pendientes del estudiante</div>
            </div>
            <div class="btn-group btn-group-sm dash-scope-group" role="group" aria-label="Filtro dashboard">
              <button type="button" class="btn btn-light rounded-pill active" data-dash-scope="today">Hoy</button>
              <button type="button" class="btn btn-light rounded-pill" data-dash-scope="week">Semana</button>
              <button type="button" class="btn btn-light rounded-pill" data-dash-scope="all">Todo</button>
            </div>
          </div>
          <div class="d-flex flex-column gap-2" id="dash-task-center-list">
            <div class="rounded-4 border p-3 skeleton-loader" style="height: 78px;"></div>
            <div class="rounded-4 border p-3 skeleton-loader" style="height: 78px;"></div>
          </div>
        </div>
      </section>

      <!-- SECTION: SMART CARDS (MODULES) -->
      <section class="mb-4 dash-section" style="animation-delay: 200ms;">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Tus Modulos</h6>
          <div class="d-flex align-items-center gap-2">
            <span class="extra-small text-muted dash-freshness d-none" id="dash-data-freshness"></span>
            <button class="btn btn-link btn-sm p-0 text-muted" id="dash-refresh-btn" title="Actualizar datos" style="font-size: 0.85rem;">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        <div class="row g-3 sia-modules-grid" id="smart-card-grid">

          <!-- CARD: LACTARIO (Dynamic Visibility) -->
          <div class="col-6 col-md-4 d-none animate-fade-in smart-card-col" id="smart-card-lactario-wrapper" data-card-id="lactario">
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
          <div class="col-6 col-md-4 smart-card-col" data-card-id="medi">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-medi"
              onclick="window.SIA.navigate('view-medi')" style="animation-delay: 250ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/medi.png" alt="Medi" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Servicios Medicos</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-medi-status">
                <span class="skeleton-loader" style="width:100px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-medi"></div>
            </div>
          </div>

          <!-- CARD: BIBLIO -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="biblio">
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
              <p class="extra-small text-muted mb-0" id="smart-card-biblio-status">
                <span class="skeleton-loader" style="width:110px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-biblio"></div>
            </div>
          </div>

         

          <!-- CARD: AULA -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="aula">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-aula"
              onclick="window.SIA.navigate('view-aula')" style="animation-delay: 400ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3">
                  <img src="images/aula.png" alt="Aula" style="width:52px;height:52px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Aula</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-aula-status">
                <span class="skeleton-loader" style="width:120px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="progress mt-2 d-none" style="height:3px;" id="smart-card-aula-progress-wrap">
                <div class="progress-bar" id="smart-card-aula-bar" style="width:0%; background: var(--aula);"></div>
              </div>
            </div>
          </div>


          <!-- CARD: COMUNIDAD -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="comunidad">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-comunidad"
              onclick="window.SIA.navigate('view-comunidad')" style="animation-delay: 375ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3 d-flex align-items-center justify-content-center">
                  <img src="images/comunidad.png" alt="Comunidad" style="width:60px;height:60px;object-fit:contain;">
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Comunidad</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-comunidad-status">Preguntas, ventas y campus social</p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-comunidad"></div>
            </div>
          </div>


 <!-- CARD: CAFETERIA -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="cafeteria">
            <div class="smart-card h-100 p-3 shadow-sm rounded-4 position-relative overflow-hidden smart-card-anim"
              id="smart-card-cafeteria"
              onclick="window.SIA.navigate('view-cafeteria')" style="animation-delay: 550ms;">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="icon-box-sm rounded-3 d-flex align-items-center justify-content-center">
                  <img src="images/cafeteria.png" alt="Cafeteria" style="width:52px;height:52px;object-fit:contain;"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div style="display:none;width:52px;height:52px;background:linear-gradient(135deg,#f97316,#fb923c);border-radius:12px;align-items:center;justify-content:center;">
                    <i class="bi bi-cup-hot-fill text-white" style="font-size:1.6rem;"></i>
                  </div>
                </div>
                <i class="bi bi-arrow-right-short text-muted opacity-50"></i>
              </div>
              <h6 class="fw-bold mb-1">Cafetería</h6>
              <p class="extra-small text-muted mb-0" id="smart-card-cafeteria-status">Ordena y recoge tu comida</p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-cafeteria"></div>
            </div>
          </div>

           <!-- CARD: FORO -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="foro">
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
              <p class="extra-small text-muted mb-0" id="smart-card-foro-status">
                <span class="skeleton-loader" style="width:90px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-foro"></div>
            </div>
          </div>

          <!-- CARD: QUEJAS -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="quejas">
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
              <p class="extra-small text-muted mb-0" id="smart-card-quejas-status">
                <span class="skeleton-loader" style="width:80px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-quejas"></div>
            </div>
          </div>

          <!-- CARD: ENCUESTAS -->
          <div class="col-6 col-md-4 smart-card-col" data-card-id="encuestas">
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
              <p class="extra-small text-muted mb-0" id="smart-card-encuestas-status">
                <span class="skeleton-loader" style="width:90px;height:0.7em;display:inline-block;border-radius:4px;"></span>
              </p>
              <div class="status-dot bg-secondary d-none" id="smart-dot-encuestas"></div>
            </div>
          </div>

         
        </div>
      </section>

      <!-- C3-02: PRÓXIMOS EVENTOS -->
      <section class="mb-4 dash-section d-none" style="animation-delay: 250ms;" id="dash-events-section">
        <div class="d-flex justify-content-between align-items-center gap-3 mb-3 px-1">
          <div>
            <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Proximos Eventos</h6>
            <div class="extra-small text-muted mt-1" id="dash-events-subtitle">Calendario del campus</div>
          </div>
          <button class="btn btn-outline-secondary btn-sm rounded-pill d-none" id="dash-events-export-btn">
            <i class="bi bi-calendar-plus me-1"></i>Exportar
          </button>
        </div>
        <div class="d-flex gap-3 overflow-auto pb-2 dash-events-scroll" id="dash-events-strip"></div>
      </section>

      <!-- C3-04: SCORECARD ACADÉMICO -->
      <section class="mb-4 dash-section" style="animation-delay: 280ms;" id="dash-scorecard-section">
        <div class="d-flex justify-content-between align-items-center mb-0 px-1 py-2 rounded-3 scorecard-toggle"
             id="dash-scorecard-toggle" style="cursor:pointer;">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">
            <i class="bi bi-mortarboard me-1"></i>Mi Avance Academico
          </h6>
          <i class="bi bi-chevron-down text-muted extra-small transition-base" id="dash-scorecard-chevron"></i>
        </div>
        <div class="scorecard-body" id="dash-scorecard-body">
          <div class="row g-3 mt-1">
            <div class="col-4 text-center">
              <div class="p-2 rounded-3" style="background: var(--surface, rgba(255,255,255,0.05));">
                <canvas id="dash-scorecard-chart" width="80" height="80" style="max-width:80px;margin:0 auto;display:block;"></canvas>
              </div>
            </div>
            <div class="col-8">
              <div class="d-flex flex-column gap-2">
                <div class="d-flex justify-content-between align-items-center">
                  <span class="extra-small text-muted">Cursos inscritos</span>
                  <span class="fw-bold small" id="dash-sc-enrolled">0</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <span class="extra-small text-muted">Completados</span>
                  <span class="fw-bold small text-success" id="dash-sc-completed">0</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <span class="extra-small text-muted">Certificados</span>
                  <span class="fw-bold small" style="color: var(--accent);" id="dash-sc-certs">0</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <span class="extra-small text-muted">Tareas por atender</span>
                  <span class="fw-bold small" id="dash-sc-pending-tasks">0</span>
                </div>
              </div>
            </div>
          </div>
          <div class="row g-2 mt-3">
            <div class="col-4">
              <div class="rounded-3 p-2 h-100" style="background: rgba(16,185,129,0.08);">
                <div class="extra-small text-uppercase fw-bold text-muted mb-1">Progreso</div>
                <div class="fw-bold small" id="dash-sc-percent">0%</div>
              </div>
            </div>
            <div class="col-4">
              <div class="rounded-3 p-2 h-100" style="background: rgba(245,158,11,0.1);">
                <div class="extra-small text-uppercase fw-bold text-muted mb-1">Riesgo</div>
                <div class="fw-bold small" id="dash-sc-risk">Estable</div>
              </div>
            </div>
            <div class="col-4">
              <div class="rounded-3 p-2 h-100" style="background: rgba(14,165,233,0.08);">
                <div class="extra-small text-uppercase fw-bold text-muted mb-1">Tendencia</div>
                <div class="fw-bold small" id="dash-sc-trend">Sin cambio</div>
              </div>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-3 px-1">
            <span class="extra-small text-muted">Siguiente entrega</span>
            <span class="small fw-bold" id="dash-sc-next-deadline">Sin pendientes</span>
          </div>
          <div class="mt-3" id="dash-sc-courses-list"></div>
        </div>
      </section>

      <!-- METAS Y RECORDATORIOS -->
      <section class="mb-4 dash-section" style="animation-delay: 290ms;" id="dash-goals-section">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Metas y Recordatorios</h6>
          <button
            class="btn btn-link btn-sm p-0 fw-bold text-decoration-none"
            style="color: var(--accent);"
            type="button"
            id="dash-goals-manage-btn">
            Gestionar
          </button>
        </div>
        <div class="p-3 rounded-4 shadow-sm border" style="background: linear-gradient(135deg, rgba(14,165,233,0.08), rgba(255,255,255,0.9)); border-color: rgba(14,165,233,0.12) !important;">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <div class="extra-small fw-bold text-uppercase mb-1" style="color: var(--accent); letter-spacing: 0.05em;">Seguimiento manual</div>
              <div class="fw-bold" id="dash-goals-summary" style="color: var(--text-heading);">Sin metas activas</div>
            </div>
            <div class="text-end flex-shrink-0">
              <div class="fw-bold" id="dash-goals-percent" style="font-size: 1.15rem; color: var(--accent);">0%</div>
              <div class="extra-small text-muted" id="dash-goals-count">0 metas</div>
            </div>
          </div>
          <div class="d-flex flex-column gap-2" id="dash-goals-list">
            <div class="rounded-3 p-3 border skeleton-loader" style="height: 72px;"></div>
            <div class="rounded-3 p-3 border skeleton-loader" style="height: 72px;"></div>
          </div>
        </div>
      </section>

      <!-- C1-08: RESUMEN DE HOY (reemplaza el banner estático) -->
      <section class="mb-4 dash-section" style="animation-delay: 300ms;">
        <div class="smart-banner sia-summary-banner p-4 rounded-4 shadow-sm text-white position-relative overflow-hidden"
          style="background: linear-gradient(135deg, #0A2540 0%, #0d3a63 100%);">
          <div class="position-absolute top-0 end-0 translate-middle p-5 bg-white rounded-circle"
            style="margin-right:-20px;margin-top:-20px;opacity:0.06;"></div>
          <div class="position-relative z-1">
            <h6 class="fw-bold mb-3 d-flex align-items-center gap-2" style="color: rgba(255,255,255,0.95);">
              <i class="bi bi-lightning-charge-fill" style="color: var(--accent);"></i>
              Resumen de Hoy
            </h6>
            <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
              <span class="badge rounded-pill text-bg-light text-dark" id="dash-summary-priority">Operando normal</span>
              <span class="extra-small text-white-50 text-end" id="dash-summary-context">Sin acciones urgentes</span>
            </div>
            <div class="row g-2 mb-3" id="dash-summary-stats">
              <div class="col-3 text-center">
                <div class="fw-bold" id="dash-sum-citas" style="font-size:1.2rem;">-</div>
                <div class="extra-small" style="opacity:0.6;">Citas</div>
              </div>
              <div class="col-3 text-center">
                <div class="fw-bold" id="dash-sum-libros" style="font-size:1.2rem;">-</div>
                <div class="extra-small" style="opacity:0.6;">Libros</div>
              </div>
              <div class="col-3 text-center">
                <div class="fw-bold" id="dash-sum-encuestas" style="font-size:1.2rem;">-</div>
                <div class="extra-small" style="opacity:0.6;">Encuestas</div>
              </div>
              <div class="col-3 text-center">
                <div class="fw-bold" id="dash-sum-quejas" style="font-size:1.2rem;">-</div>
                <div class="extra-small" style="opacity:0.6;">Quejas</div>
              </div>
            </div>
            <div id="dash-summary-cta">
              <button class="btn btn-sm btn-light fw-bold rounded-pill px-3 shadow-sm d-none" id="dash-summary-cta-btn"
                style="color: var(--primary);">
                <i class="bi bi-arrow-right-circle me-1"></i>
                <span id="dash-summary-cta-label">Sin pendientes</span>
              </button>
              <span class="extra-small d-none" id="dash-summary-ok" style="color: rgba(255,255,255,0.7);">
                <i class="bi bi-check-circle-fill text-success me-1"></i>Sin pendientes — Buen trabajo!
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- C3-05: TIP CONTEXTUAL DEL DÍA -->
      <section class="mb-4 dash-section" style="animation-delay: 325ms;" id="dash-history-section">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1">
          <h6 class="fw-bold text-secondary text-uppercase small mb-0 ls-1">Actividad Reciente</h6>
          <span class="extra-small text-muted" id="dash-history-meta">Ultimas acciones del ecosistema SIA</span>
        </div>
        <div class="d-flex flex-column gap-2" id="dash-history-list">
          <div class="rounded-4 border p-3 skeleton-loader" style="height: 72px;"></div>
          <div class="rounded-4 border p-3 skeleton-loader" style="height: 72px;"></div>
        </div>
      </section>

      <section class="mb-4 dash-section" style="animation-delay: 350ms;" id="dash-tip-section">
        <div class="dash-tip-card p-3 rounded-3 d-flex align-items-start gap-3" id="dash-tip-card">
          <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
               id="dash-tip-icon-wrap"
               style="width:36px;height:36px;background:rgba(0,208,255,0.12);">
            <i class="bi bi-lightbulb" id="dash-tip-icon" style="color:var(--accent);"></i>
          </div>
          <div class="flex-grow-1">
            <div class="extra-small fw-bold text-uppercase mb-1" style="color: var(--accent); letter-spacing: 0.05em;">Sabias que?</div>
            <p class="small mb-0" id="dash-tip-text" style="color: var(--text-body); line-height:1.4;">
              <span class="skeleton-loader" style="width:200px;height:0.7em;display:inline-block;border-radius:4px;"></span>
            </p>
            <button class="btn btn-link btn-sm p-0 mt-2 fw-bold text-decoration-none d-none" id="dash-tip-action" style="color: var(--accent);">
              Resolver ahora
            </button>
          </div>
        </div>
      </section>

      <!-- C3-03: PANEL SOS FLOTANTE -->
      <div class="dash-sos-fab d-none" id="dash-sos-fab">
        <button class="btn dash-sos-btn shadow-lg" id="dash-sos-toggle" title="Boton de panico">
          <i class="bi bi-shield-fill-exclamation"></i>
        </button>
        <div class="dash-sos-panel d-none shadow-lg rounded-4 p-3" id="dash-sos-panel">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold small" id="dash-sos-title" style="color: var(--text-heading);">Boton de panico</span>
            <button class="btn btn-link btn-sm p-0 text-muted" id="dash-sos-close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="rounded-pill px-3 py-2 mb-2 extra-small fw-bold" id="dash-sos-status" style="background: rgba(14,165,233,0.12); color: var(--accent);">
            Solo disponible para perfiles habilitados
          </div>
          <div class="d-flex flex-column gap-3" id="dash-sos-content"></div>
        </div>
      </div>

      <div class="modal fade" id="dash-goals-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
            <div class="modal-header border-0 pb-0">
              <div>
                <div class="extra-small fw-bold text-uppercase mb-1" style="color: var(--accent); letter-spacing: 0.08em;">Panel manual</div>
                <h5 class="modal-title fw-bold mb-1" style="color: var(--text-heading);">Metas y recordatorios del semestre</h5>
                <div class="small text-muted">Crea objetivos medibles o recordatorios con fecha sin salir del dashboard.</div>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body pt-3">
              <div class="dash-goal-helper rounded-4 p-3 mb-3">
                <div class="fw-bold small mb-1" style="color: var(--text-heading);">Como usarlo</div>
                <div class="extra-small text-muted">Usa metas para avances medibles como cursos, habitos o salud. Usa recordatorios para pendientes con fecha, por ejemplo entregar un formato o asistir a un evento.</div>
              </div>
              <div class="d-flex flex-wrap gap-2 mb-3">
                <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" data-goal-preset="course">
                  <i class="bi bi-mortarboard-fill me-1"></i>Curso
                </button>
                <button type="button" class="btn btn-outline-success btn-sm rounded-pill" data-goal-preset="habit">
                  <i class="bi bi-arrow-repeat me-1"></i>Habito
                </button>
                <button type="button" class="btn btn-outline-warning btn-sm rounded-pill" data-goal-preset="event">
                  <i class="bi bi-calendar2-check-fill me-1"></i>Pendiente
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" data-goal-preset="reminder">
                  <i class="bi bi-bell-fill me-1"></i>Recordatorio
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" data-goal-preset="personal">
                  <i class="bi bi-stars me-1"></i>Personal
                </button>
              </div>
              <div class="extra-small text-muted mb-3" id="dash-goals-modal-summary">Sin objetivos definidos</div>
              <div class="d-flex flex-column gap-3" id="dash-goals-modal-list"></div>
            </div>
            <div class="modal-footer border-0 pt-0">
              <button type="button" class="btn btn-light rounded-pill px-3" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold" id="dash-goals-save-btn">
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Activity strip skeletons ───────────────────────────────────

  _renderActivitySkeletons() {
    return Array(6).fill(0).map((_, i) => `
      <div class="activity-day-card skeleton-loader flex-fill rounded-4 d-flex flex-column justify-content-center align-items-center" 
           style="height: 65px; border: 2px solid rgba(0,0,0,0.15); background: linear-gradient(135deg, rgba(230,230,230,0.4), rgba(200,200,200,0.2));">
        <div style="width: 25px; height: 12px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 4px;"></div>
        <div style="width: 30px; height: 18px; background: rgba(0,0,0,0.2); border-radius: 4px;"></div>
      </div>
    `).join('');
  }

  // ── Hidratacion post-render ──────────────────────────────────────

  _hydrate() {
    this._setupCampusMapButton();
    this._setupQRButton();
    this._setupTutorialButton();
    this._setupAvatarDropdown();
    this._setupDashboardScopeControls();
    this._setupScorecardToggle();
    this._setupSOSPanel();
    this._setupRefreshButton();
    this._setupGoalsModal();
    this._setupSkeletonTimeout();

    // Intentar hidratar con datos ya disponibles
    const profile = window.SIA?.currentUserProfile || window.currentUserProfile;
    if (profile) {
      this._onProfileReady({ profile, source: 'dashboard-hydrate' });
    }
  }

  // ── C1-09: Skeleton Timeout con retry ──────────────────────────

  _setupSkeletonTimeout() {
    this._skeletonTimeout = setTimeout(() => {
      const nameEl = this.querySelector('#dash-user-name');
      if (nameEl && nameEl.querySelector('.skeleton-loader')) {
        nameEl.innerHTML = '<span class="text-warning extra-small" style="cursor:pointer;" id="dash-name-retry"><i class="bi bi-exclamation-triangle me-1"></i>Error al cargar — <u>Reintentar</u></span>';
        const retry = nameEl.querySelector('#dash-name-retry');
        if (retry) {
          retry.addEventListener('click', () => {
            nameEl.innerHTML = '<span class="skeleton-loader skeleton-text" style="width:140px;height:1.3em;display:inline-block;"></span>';
            const profile = window.SIA?.currentUserProfile || window.currentUserProfile;
            if (profile) this._onProfileReady(profile);
            else this._setupSkeletonTimeout();
          });
        }
      }
    }, 5000);
  }

  // ── C3-06: Deteccion Offline ───────────────────────────────────

  _setupOfflineDetection() {
    const banner = this.querySelector('#dash-offline-banner');
    if (!banner) return;

    this._onlineHandler = () => banner.classList.add('d-none');
    this._offlineHandler = () => banner.classList.remove('d-none');

    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('offline', this._offlineHandler);

    if (!navigator.onLine) banner.classList.remove('d-none');

    // Freshness interval
    this._freshnessInterval = setInterval(() => this._updateFreshness(), 30000);
  }

  _updateFreshness() {
    const el = this.querySelector('#dash-data-freshness');
    if (!el || !window._dashLastRefresh) return;
    const mins = Math.round((Date.now() - window._dashLastRefresh) / 60000);
    el.textContent = mins < 1 ? 'recién actualizado' : `hace ${mins} min`;
  }

  // ── Callback cuando el perfil esta listo ─────────────────────────

  _normalizeProfilePayload(payload) {
    if (!payload) return { profile: null, source: 'unknown' };
    if (payload.profile && typeof payload === 'object') {
      return {
        profile: payload.profile,
        source: payload.source || 'unknown'
      };
    }
    return { profile: payload, source: 'unknown' };
  }

  _getProfileCareer(profile) {
    return profile?.carrera || profile?.career || '';
  }

  _getDashboardPrefs(profile) {
    const prefs = profile?.prefs || profile?.preferences || {};
    return prefs?.dashboard || {};
  }

  _getEffectiveSessionUid(profile) {
    return window.SIA?.getEffectiveSessionUid?.(profile || this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || null)
      || profile?.uid
      || window.SIA?.auth?.currentUser?.uid
      || '';
  }

  _getFavoriteModules(profile) {
    const dashboardPrefs = this._getDashboardPrefs(profile);
    const rawFavorites = Array.isArray(dashboardPrefs?.favoriteModules) ? dashboardPrefs.favoriteModules : [];
    const moduleMap = {
      medi: { label: 'Medi', viewId: 'view-medi', icon: 'bi-heart-pulse-fill' },
      biblio: { label: 'Biblio', viewId: 'view-biblio', icon: 'bi-book-half' },
      aula: { label: 'Aula', viewId: 'view-aula', icon: 'bi-mortarboard-fill' },
      comunidad: { label: 'Comunidad', viewId: 'view-comunidad', icon: 'bi-people-fill' },
      foro: { label: 'Eventos', viewId: 'view-foro', icon: 'bi-calendar-event' },
      quejas: { label: 'Quejas', viewId: 'view-quejas', icon: 'bi-chat-heart' },
      encuestas: { label: 'Encuestas', viewId: 'view-encuestas', icon: 'bi-clipboard-check' },
      cafeteria: { label: 'Cafe', viewId: 'view-cafeteria', icon: 'bi-cup-hot-fill' }
    };
    return rawFavorites
      .map((id) => ({ id, ...(moduleMap[id] || {}) }))
      .filter((item) => item.viewId && item.label);
  }

  _escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _parseDate(value) {
    if (!value) return null;
    if (value.toDate) {
      const date = value.toDate();
      return Number.isNaN(date?.getTime?.()) ? null : date;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  _formatDateInputValue(value) {
    const date = this._parseDate(value);
    return date ? date.toISOString().slice(0, 10) : '';
  }

  _formatShortGoalDate(value) {
    const date = this._parseDate(value);
    if (!date) return 'Sin fecha';
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  _getGoalTypes() {
    return {
      course: {
        label: 'Curso o certificacion',
        shortLabel: 'Curso',
        icon: 'bi-mortarboard-fill',
        tone: 'info',
        trackProgress: true,
        titleLabel: 'Que quieres completar',
        titlePlaceholder: 'Ej. Completar 2 cursos de Aula',
        unitPlaceholder: 'cursos, certificados, materias',
        notePlaceholder: 'Ej. Priorizar certificaciones con evidencia'
      },
      habit: {
        label: 'Habito o rutina',
        shortLabel: 'Habito',
        icon: 'bi-arrow-repeat',
        tone: 'success',
        trackProgress: true,
        titleLabel: 'Que habito quieres mantener',
        titlePlaceholder: 'Ej. Estudiar 4 horas por semana',
        unitPlaceholder: 'horas, sesiones, dias',
        notePlaceholder: 'Ej. Medir cada viernes'
      },
      health: {
        label: 'Salud o bienestar',
        shortLabel: 'Salud',
        icon: 'bi-heart-pulse-fill',
        tone: 'danger',
        trackProgress: true,
        titleLabel: 'Que quieres cuidar',
        titlePlaceholder: 'Ej. Asistir a 3 seguimientos medicos',
        unitPlaceholder: 'consultas, sesiones, dias',
        notePlaceholder: 'Ej. Dar seguimiento con Medi'
      },
      event: {
        label: 'Pendiente o evento',
        shortLabel: 'Pendiente',
        icon: 'bi-calendar2-check-fill',
        tone: 'warning',
        trackProgress: true,
        titleLabel: 'Que pendiente quieres cerrar',
        titlePlaceholder: 'Ej. Asistir a la feria de empleo',
        unitPlaceholder: 'eventos, entregas, visitas',
        notePlaceholder: 'Ej. Llevar documentacion completa'
      },
      reminder: {
        label: 'Recordatorio',
        shortLabel: 'Recordatorio',
        icon: 'bi-bell-fill',
        tone: 'danger',
        trackProgress: false,
        titleLabel: 'Que no quieres olvidar',
        titlePlaceholder: 'Ej. Entregar formato medico',
        notePlaceholder: 'Ej. Llevar copia firmada y credencial'
      },
      personal: {
        label: 'Meta personal',
        shortLabel: 'Personal',
        icon: 'bi-stars',
        tone: 'secondary',
        trackProgress: true,
        titleLabel: 'Que quieres lograr',
        titlePlaceholder: 'Ej. Leer 2 libros este mes',
        unitPlaceholder: 'libros, sesiones, avances',
        notePlaceholder: 'Ej. Mantener constancia semanal'
      }
    };
  }

  _getGoalTypeMeta(goal) {
    const type = typeof goal === 'string' ? goal : goal?.type;
    const catalog = this._getGoalTypes();
    return catalog[type] || catalog.course;
  }

  _getGoalBadgeClass(goal) {
    const tone = this._getGoalTypeMeta(goal).tone;
    const classMap = {
      info: 'bg-info-subtle text-info',
      success: 'bg-success-subtle text-success',
      warning: 'bg-warning-subtle text-warning-emphasis',
      danger: 'bg-danger-subtle text-danger',
      secondary: 'bg-secondary-subtle text-secondary'
    };
    return classMap[tone] || classMap.info;
  }

  _isReminderGoal(goal) {
    return !this._getGoalTypeMeta(goal).trackProgress;
  }

  _normalizeSemesterGoals(rawGoals) {
    const source = Array.isArray(rawGoals) ? rawGoals : [];
    const goalTypes = this._getGoalTypes();
    return source
      .map((goal, index) => {
        const type = goalTypes[goal?.type] ? goal.type : 'course';
        const meta = this._getGoalTypeMeta(type);
        return {
          id: goal?.id || `goal_${index + 1}`,
          type,
          title: String(goal?.title || '').trim(),
          current: meta.trackProgress ? Math.max(0, Number(goal?.current) || 0) : 0,
          target: meta.trackProgress ? Math.max(0, Number(goal?.target) || 0) : 0,
          unit: String(goal?.unit || '').trim(),
          note: String(goal?.note || '').trim(),
          reminderAt: this._formatDateInputValue(goal?.reminderAt || goal?.when || goal?.dueAt || ''),
          done: Boolean(goal?.done)
        };
      })
      .filter((goal) => goal.title);
  }

  _getSemesterGoals(profile) {
    const prefs = profile?.prefs || profile?.preferences || {};
    const rawGoals = Array.isArray(prefs?.semesterGoals?.items) ? prefs.semesterGoals.items : [];
    return this._normalizeSemesterGoals(rawGoals);
  }

  _createDefaultGoal(type = 'course') {
    const safeType = this._getGoalTypes()[type] ? type : 'course';
    const meta = this._getGoalTypeMeta(safeType);
    const defaultReminder = new Date();
    defaultReminder.setDate(defaultReminder.getDate() + 7);
    return {
      id: `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type: safeType,
      title: safeType === 'reminder' ? 'Nuevo recordatorio' : `Nueva meta de ${meta.shortLabel.toLowerCase()}`,
      current: 0,
      target: safeType === 'habit' ? 4 : (safeType === 'reminder' ? 0 : 1),
      unit: safeType === 'habit' ? 'sesiones' : '',
      note: '',
      reminderAt: safeType === 'reminder' ? this._formatDateInputValue(defaultReminder) : '',
      done: false
    };
  }

  _getSemesterGoalProgress(goal) {
    if (!goal) return 0;
    if (goal.done) return 100;
    if (this._isReminderGoal(goal)) return 0;
    if (goal.target > 0) {
      return Math.max(0, Math.min(100, Math.round((goal.current / goal.target) * 100)));
    }
    return 0;
  }

  _getGoalReminderState(goal) {
    if (!goal) {
      return { label: 'Sin fecha', helper: 'Agrega una fecha para usarla como recordatorio.', className: 'bg-secondary-subtle text-secondary' };
    }
    if (goal.done) {
      return { label: 'Hecho', helper: 'Marcado como completado.', className: 'bg-success-subtle text-success' };
    }
    const date = this._parseDate(goal.reminderAt);
    if (!date) {
      return { label: 'Pendiente', helper: 'Sin fecha definida.', className: 'bg-secondary-subtle text-secondary' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (dayDiff < 0) {
      return { label: 'Vencido', helper: `Debio atenderse el ${this._formatShortGoalDate(date)}.`, className: 'bg-danger-subtle text-danger' };
    }
    if (dayDiff === 0) {
      return { label: 'Hoy', helper: 'Atiendelo hoy desde el dashboard.', className: 'bg-warning-subtle text-warning-emphasis' };
    }
    if (dayDiff === 1) {
      return { label: 'Manana', helper: 'Tienes este recordatorio muy pronto.', className: 'bg-info-subtle text-info' };
    }
    return { label: this._formatShortGoalDate(date), helper: `Programado para ${this._formatShortGoalDate(date)}.`, className: 'bg-secondary-subtle text-secondary' };
  }

  _populateHeaderStatus(profile) {
    const wrap = this.querySelector('#dash-header-status');
    if (!wrap) return;

    const favoriteModules = this._getFavoriteModules(profile).slice(0, 3);

    const favoriteChips = favoriteModules.map((module) => `
      <button class="btn btn-sm btn-outline-secondary rounded-pill dash-quick-module" type="button"
        onclick="window.SIA?.navigate('${module.viewId}')">
        <i class="bi ${module.icon} me-1"></i>${this._escapeHtml(module.label)}
      </button>`);

    if (!favoriteChips.length) {
      wrap.className = 'd-none';
      wrap.innerHTML = '';
      return;
    }

    wrap.className = 'd-flex flex-wrap gap-2 mt-2';
    wrap.innerHTML = favoriteChips.join('');
  }

  _applyScopeButtons(scope) {
    this.querySelectorAll('[data-dash-scope]').forEach((btn) => {
      const isActive = btn.dataset.dashScope === scope;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('btn-light', !isActive);
    });
  }

  _setupDashboardScopeControls() {
    const buttons = this.querySelectorAll('[data-dash-scope]');
    const group = this.querySelector('.dash-scope-group');
    if (!buttons.length) return;
    if (group?.dataset.bound === 'true') return;
    if (group) group.dataset.bound = 'true';

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const scope = btn.dataset.dashScope || 'week';
        this._applyScopeButtons(scope);
        if (typeof window.SIA?.setStudentDashboardScope === 'function') {
          window.SIA.setStudentDashboardScope(scope, { persist: true });
        }
      });
    });

    const fallbackScope = this._getDashboardPrefs(this._profile)?.defaultScope || 'week';
    this._applyScopeButtons(fallbackScope);
  }

  _populateSemesterGoals(profile) {
    const sectionEl = this.querySelector('#dash-goals-section');
    const summaryEl = this.querySelector('#dash-goals-summary');
    const percentEl = this.querySelector('#dash-goals-percent');
    const countEl = this.querySelector('#dash-goals-count');
    const listEl = this.querySelector('#dash-goals-list');
    if (sectionEl) sectionEl.classList.toggle('d-none', profile?.role !== 'student');
    if (!summaryEl || !percentEl || !countEl || !listEl || profile?.role !== 'student') return;

    const goals = this._getSemesterGoals(profile);
    if (!goals.length) {
      summaryEl.textContent = 'Sin objetivos activos';
      percentEl.textContent = '0%';
      countEl.textContent = '0 objetivos';
      listEl.innerHTML = `
        <div class="text-center py-3 px-2 rounded-3 border" style="background: rgba(255,255,255,0.72); border-style: dashed !important;">
          <div class="small fw-bold mb-1" style="color: var(--text-heading);">Aun no configuras metas o recordatorios</div>
          <div class="extra-small text-muted mb-3">Crea objetivos medibles o pendientes con fecha directamente desde tu dashboard.</div>
          <button
            class="btn btn-sm btn-primary rounded-pill px-3 fw-bold"
            type="button"
            data-open-goals-modal>
            Crear panel manual
          </button>
        </div>`;
      this._setupGoalsModal();
      return;
    }

    const completed = goals.filter(goal => this._getSemesterGoalProgress(goal) >= 100).length;
    const overall = Math.round(goals.reduce((sum, goal) => sum + this._getSemesterGoalProgress(goal), 0) / goals.length);
    const reminders = goals.filter((goal) => this._isReminderGoal(goal)).length;

    summaryEl.textContent = completed === goals.length
      ? 'Todo tu panel manual esta al dia'
      : reminders > 0
        ? `${completed} completadas, ${goals.length - completed} activas`
        : `${completed} de ${goals.length} metas completadas`;
    percentEl.textContent = `${overall}%`;
    countEl.textContent = `${goals.length} objetivo${goals.length === 1 ? '' : 's'}`;

    const visibleGoals = goals.slice(0, 4);
    listEl.innerHTML = visibleGoals.map(goal => {
      const pct = this._getSemesterGoalProgress(goal);
      const safeTitle = this._escapeHtml(goal.title);
      const safeNote = this._escapeHtml(goal.note);
      const goalType = this._getGoalTypeMeta(goal);
      const badgeClass = this._getGoalBadgeClass(goal);

      if (this._isReminderGoal(goal)) {
        const reminderState = this._getGoalReminderState(goal);
        return `
          <div class="rounded-3 border p-3" style="background: rgba(255,255,255,0.82); border-color: rgba(15,23,42,0.08) !important;">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span class="badge rounded-pill ${badgeClass}">${this._escapeHtml(goalType.shortLabel)}</span>
                  <span class="extra-small text-muted">${this._escapeHtml(reminderState.helper)}</span>
                </div>
                <div class="small fw-bold" style="color: var(--text-heading);">${safeTitle}</div>
              </div>
              <span class="badge rounded-pill ${reminderState.className}">${this._escapeHtml(reminderState.label)}</span>
            </div>
            ${safeNote ? `<div class="extra-small text-muted mt-2">${safeNote}</div>` : ''}
          </div>`;
      }

      const safeUnit = this._escapeHtml(goal.unit || 'avance');
      const progressLabel = goal.target > 0 ? `${goal.current}/${goal.target} ${safeUnit}` : (goal.done ? 'Completada' : 'En progreso');
      const statusLabel = pct >= 100 ? 'Completada' : `${pct}%`;

      return `
        <div class="rounded-3 border p-3" style="background: rgba(255,255,255,0.82); border-color: rgba(15,23,42,0.08) !important;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span class="badge rounded-pill ${badgeClass}">${this._escapeHtml(goalType.shortLabel)}</span>
              </div>
              <div class="small fw-bold" style="color: var(--text-heading);">${safeTitle}</div>
            </div>
            <span class="badge rounded-pill ${pct >= 100 ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info'}">${statusLabel}</span>
          </div>
          <div class="extra-small text-muted mt-1">${progressLabel}</div>
          <div class="progress mt-2" style="height: 6px; background: rgba(15,23,42,0.08);">
            <div class="progress-bar" role="progressbar" style="width: ${pct}%; background: ${pct >= 100 ? '#10b981' : 'var(--accent)'};"></div>
          </div>
          ${safeNote ? `<div class="extra-small text-muted mt-2">${safeNote}</div>` : ''}
        </div>`;
    }).join('');

    if (goals.length > visibleGoals.length) {
      listEl.insertAdjacentHTML('beforeend', `
        <div class="extra-small text-muted text-center pt-1">
          y ${goals.length - visibleGoals.length} objetivo${goals.length - visibleGoals.length === 1 ? '' : 's'} mas
        </div>`);
    }

    this._setupGoalsModal();
  }

  _renderGoalsModalEditor(goalsInput) {
    this._goalsDraft = this._normalizeSemesterGoals(goalsInput);
    const listEl = this.querySelector('#dash-goals-modal-list');
    const summaryEl = this.querySelector('#dash-goals-modal-summary');
    if (!listEl || !summaryEl) return;

    const goals = this._goalsDraft;
    const reminders = goals.filter((goal) => this._isReminderGoal(goal)).length;
    summaryEl.textContent = goals.length > 0
      ? `${goals.length} objetivo${goals.length === 1 ? '' : 's'} capturado${goals.length === 1 ? '' : 's'}${reminders ? ` · ${reminders} recordatorio${reminders === 1 ? '' : 's'}` : ''}`
      : 'No hay metas aun. Usa un tipo rapido para comenzar.';

    if (!goals.length) {
      listEl.innerHTML = `
        <div class="rounded-4 border border-dashed p-4 text-center" style="background: rgba(255,255,255,0.75); border-style: dashed !important;">
          <div class="fw-bold mb-1" style="color: var(--text-heading);">Tu panel esta vacio</div>
          <div class="small text-muted">Agrega un curso, un habito o un recordatorio con fecha para empezar.</div>
        </div>`;
      return;
    }

    const typeOptions = Object.entries(this._getGoalTypes())
      .map(([key, meta]) => `<option value="${key}">${this._escapeHtml(meta.label)}</option>`)
      .join('');

    listEl.innerHTML = goals.map((goal, index) => {
      const meta = this._getGoalTypeMeta(goal);
      const badgeClass = this._getGoalBadgeClass(goal);
      const isReminder = this._isReminderGoal(goal);
      const reminderState = this._getGoalReminderState(goal);
      return `
        <div class="dash-goal-editor-card rounded-4 border p-3 shadow-sm" data-semester-goal-item data-goal-id="${this._escapeHtml(goal.id)}">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
                <span class="badge rounded-pill ${badgeClass}">
                  <i class="bi ${meta.icon} me-1"></i>${this._escapeHtml(meta.shortLabel)}
                </span>
                <span class="extra-small text-muted">${isReminder ? this._escapeHtml(reminderState.helper) : 'Se mostrara con avance visible dentro del dashboard.'}</span>
              </div>
              <div class="fw-bold small" style="color: var(--text-heading);">Objetivo ${index + 1}</div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" data-goal-remove="${index}">
              <i class="bi bi-trash3 me-1"></i>Quitar
            </button>
          </div>
          <div class="row g-3">
            <div class="col-12 col-md-4">
              <label class="form-label small text-muted fw-bold">Tipo</label>
              <select class="form-select rounded-3" data-goal-field="type">
                ${typeOptions}
              </select>
            </div>
            <div class="col-12 col-md-8">
              <label class="form-label small text-muted fw-bold">${this._escapeHtml(meta.titleLabel)}</label>
              <input type="text" class="form-control rounded-3" data-goal-field="title" value="${this._escapeHtml(goal.title)}" placeholder="${this._escapeHtml(meta.titlePlaceholder)}">
            </div>
            ${isReminder ? `
              <div class="col-12 col-md-4">
                <label class="form-label small text-muted fw-bold">Fecha del recordatorio</label>
                <input type="date" class="form-control rounded-3" data-goal-field="reminderAt" value="${this._escapeHtml(goal.reminderAt || '')}">
              </div>
              <div class="col-12 col-md-8">
                <label class="form-label small text-muted fw-bold">Detalle o criterio</label>
                <input type="text" class="form-control rounded-3" data-goal-field="note" value="${this._escapeHtml(goal.note)}" placeholder="${this._escapeHtml(meta.notePlaceholder)}">
              </div>
            ` : `
              <div class="col-4 col-md-2">
                <label class="form-label small text-muted fw-bold">Actual</label>
                <input type="number" min="0" class="form-control rounded-3" data-goal-field="current" value="${goal.current}">
              </div>
              <div class="col-4 col-md-2">
                <label class="form-label small text-muted fw-bold">Objetivo</label>
                <input type="number" min="0" class="form-control rounded-3" data-goal-field="target" value="${goal.target}">
              </div>
              <div class="col-4 col-md-4">
                <label class="form-label small text-muted fw-bold">Unidad</label>
                <input type="text" class="form-control rounded-3" data-goal-field="unit" value="${this._escapeHtml(goal.unit)}" placeholder="${this._escapeHtml(meta.unitPlaceholder || 'avances')}">
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label small text-muted fw-bold">Notas o enfoque</label>
                <input type="text" class="form-control rounded-3" data-goal-field="note" value="${this._escapeHtml(goal.note)}" placeholder="${this._escapeHtml(meta.notePlaceholder)}">
              </div>
            `}
            <div class="col-12">
              <div class="dash-goal-meta-preview rounded-3 p-3">
                <div class="d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <div class="fw-bold small" style="color: var(--text-heading);">${isReminder ? 'Asi se tratara este recordatorio' : 'Asi se medira este objetivo'}</div>
                    <div class="extra-small text-muted">${isReminder ? 'Aparecera como pendiente hasta marcarlo como hecho.' : 'El dashboard mostrara porcentaje y avance actual contra objetivo.'}</div>
                  </div>
                  <div class="form-check form-switch m-0">
                    <input class="form-check-input" type="checkbox" role="switch" data-goal-field="done" ${goal.done ? 'checked' : ''}>
                    <label class="form-check-label small ms-2">Completada</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-goal-field="type"]').forEach((select, index) => {
      select.value = goals[index]?.type || 'course';
    });
  }

  _collectGoalsFromModal() {
    const items = Array.from(this.querySelectorAll('#dash-goals-modal-list [data-semester-goal-item]'));
    return this._normalizeSemesterGoals(items.map((item, index) => ({
      id: item.dataset.goalId || `goal_form_${index}`,
      type: item.querySelector('[data-goal-field="type"]')?.value || 'course',
      title: item.querySelector('[data-goal-field="title"]')?.value || '',
      current: item.querySelector('[data-goal-field="current"]')?.value || 0,
      target: item.querySelector('[data-goal-field="target"]')?.value || 0,
      unit: item.querySelector('[data-goal-field="unit"]')?.value || '',
      note: item.querySelector('[data-goal-field="note"]')?.value || '',
      reminderAt: item.querySelector('[data-goal-field="reminderAt"]')?.value || '',
      done: item.querySelector('[data-goal-field="done"]')?.checked || false
    })));
  }

  _openGoalsModal() {
    const profile = this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || null;
    if (profile?.role !== 'student') return;
    this._renderGoalsModalEditor(this._getSemesterGoals(profile));
    const modalEl = this.querySelector('#dash-goals-modal');
    if (!modalEl || !window.bootstrap?.Modal) return;
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  async _persistSemesterGoals(items) {
    const uid = this._getEffectiveSessionUid(this._profile);
    if (!uid) throw new Error('No se encontro la sesion del estudiante.');

    const nextSemesterGoals = {
      items,
      updatedAt: new Date().toISOString()
    };

    if (typeof window.SIA?.updateUserPreferences === 'function') {
      await window.SIA.updateUserPreferences(uid, { semesterGoals: nextSemesterGoals });
    } else if (window.SIA?.db) {
      await window.SIA.db.collection('usuarios').doc(uid).update({ 'prefs.semesterGoals': nextSemesterGoals });
    }

    const profile = this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || {};
    if (!profile.prefs) profile.prefs = profile.preferences || {};
    profile.prefs.semesterGoals = nextSemesterGoals;
    profile.preferences = profile.prefs;
    this._profile = profile;
  }

  async _saveGoalsFromModal() {
    const titleInputs = Array.from(this.querySelectorAll('#dash-goals-modal-list [data-goal-field="title"]'));
    const hasEmptyTitle = titleInputs.some((input) => String(input.value || '').trim() === '');
    if (hasEmptyTitle) {
      window.showToast?.('Completa o elimina los objetivos sin titulo antes de guardar.', 'warning');
      return;
    }

    const saveBtn = this.querySelector('#dash-goals-save-btn');
    const modalEl = this.querySelector('#dash-goals-modal');
    const originalLabel = saveBtn?.innerHTML || 'Guardar cambios';
    const items = this._collectGoalsFromModal();

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
      }
      await this._persistSemesterGoals(items);
      this._populateSemesterGoals(this._profile);
      window.dispatchEvent(new CustomEvent('sia-profile-ready', {
        detail: { profile: this._profile, source: 'dashboard-goals' }
      }));
      if (typeof window.SIA?.refreshStudentDashboard === 'function') {
        Promise.resolve(window.SIA.refreshStudentDashboard()).catch(() => { });
      }
      if (modalEl && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
      window.showToast?.('Panel manual actualizado', 'success');
    } catch (err) {
      console.error('[Dashboard] Error saving semester goals:', err);
      window.showToast?.(err?.message || 'No se pudieron guardar las metas', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalLabel;
      }
    }
  }

  _setupGoalsModal() {
    const manageBtn = this.querySelector('#dash-goals-manage-btn');
    if (manageBtn && manageBtn.dataset.bound !== 'true') {
      manageBtn.dataset.bound = 'true';
      manageBtn.addEventListener('click', () => this._openGoalsModal());
    }

    this.querySelectorAll('[data-open-goals-modal]').forEach((btn) => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => this._openGoalsModal());
    });

    const modalEl = this.querySelector('#dash-goals-modal');
    const listEl = this.querySelector('#dash-goals-modal-list');
    const saveBtn = this.querySelector('#dash-goals-save-btn');

    if (listEl && listEl.dataset.bound !== 'true') {
      listEl.dataset.bound = 'true';
      listEl.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('[data-goal-remove]');
        if (!removeBtn) return;
        const currentGoals = this._collectGoalsFromModal();
        currentGoals.splice(Number(removeBtn.dataset.goalRemove), 1);
        this._renderGoalsModalEditor(currentGoals);
      });

      listEl.addEventListener('change', (event) => {
        const typeSelect = event.target.closest('[data-goal-field="type"]');
        if (!typeSelect) return;
        const currentGoals = this._collectGoalsFromModal();
        const goalItems = Array.from(this.querySelectorAll('#dash-goals-modal-list [data-semester-goal-item]'));
        const goalIndex = goalItems.indexOf(typeSelect.closest('[data-semester-goal-item]'));
        if (goalIndex === -1) return;
        const nextType = this._getGoalTypes()[typeSelect.value] ? typeSelect.value : 'course';
        const currentGoal = currentGoals[goalIndex] || this._createDefaultGoal(nextType);
        const nextMeta = this._getGoalTypeMeta(nextType);
        currentGoals[goalIndex] = {
          ...currentGoal,
          type: nextType,
          current: nextMeta.trackProgress ? currentGoal.current : 0,
          target: nextMeta.trackProgress ? (currentGoal.target || 1) : 0,
          unit: nextMeta.trackProgress ? currentGoal.unit : '',
          reminderAt: nextMeta.trackProgress ? '' : (currentGoal.reminderAt || this._formatDateInputValue(new Date(Date.now() + 7 * 86400000)))
        };
        this._renderGoalsModalEditor(currentGoals);
      });
    }

    this.querySelectorAll('[data-goal-preset]').forEach((btn) => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        const currentGoals = this._collectGoalsFromModal();
        currentGoals.push(this._createDefaultGoal(btn.dataset.goalPreset || 'course'));
        this._renderGoalsModalEditor(currentGoals);
      });
    });

    if (saveBtn && saveBtn.dataset.bound !== 'true') {
      saveBtn.dataset.bound = 'true';
      saveBtn.addEventListener('click', () => this._saveGoalsFromModal());
    }

    if (modalEl && modalEl.dataset.bound !== 'true') {
      modalEl.dataset.bound = 'true';
      modalEl.addEventListener('show.bs.modal', () => {
        const profile = this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || null;
        this._renderGoalsModalEditor(this._getSemesterGoals(profile));
      });
    }

    window.SIA = window.SIA || {};
    window.SIA.openDashboardGoalsModal = () => this._openGoalsModal();
  }

  _updateLocalCardOrder(order) {
    if (!this._profile) return;
    this._profile = {
      ...this._profile,
      prefs: {
        ...(this._profile.prefs || {}),
        cardOrder: Array.isArray(order) ? [...order] : null
      }
    };
  }

  async _persistCardOrder(order) {
    this._updateLocalCardOrder(order);

    const uid = this._getEffectiveSessionUid(this._profile);
    if (!uid) return;

    if (typeof window.SIA?.updateUserPreferences === 'function') {
      await window.SIA.updateUserPreferences(uid, { cardOrder: order });
      return;
    }

    if (window.SIA?.db) {
      await window.SIA.db.collection('usuarios').doc(uid).update({ 'prefs.cardOrder': order });
    }
  }

  _onProfileReady(payload) {
    const { profile, source } = this._normalizeProfilePayload(payload);
    if (!profile) return;
    const effectiveUid = this._getEffectiveSessionUid(profile);
    const sessionChanged = effectiveUid !== this._dashboardSessionUid;
    this._dashboardSessionUid = effectiveUid || null;
    if (sessionChanged) {
      window.SIA?.resetStudentDashboardState?.({ clearDom: true, clearFreshness: true });
    }
    this._profile = profile;

    if (this._skeletonTimeout) {
      clearTimeout(this._skeletonTimeout);
      this._skeletonTimeout = null;
    }

    // Nombre
    const nameEl = this.querySelector('#dash-user-name');
    if (nameEl && profile.displayName) {
      nameEl.textContent = profile.displayName.split(' ').slice(0, 2).join(' ');
    }

    // Avatar: foto o iniciales
    const img = this.querySelector('#dash-avatar-img');
    const initials = this.querySelector('#dash-avatar-initials');
    const name = profile.displayName || '';
    if (initials && name) {
      const parts = name.trim().split(' ');
      const ini = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0][0] || 'U').toUpperCase();
      initials.textContent = ini;
    }

    if (img && initials && profile.photoURL) {
      img.src = profile.photoURL;
      img.onload = () => { img.classList.remove('d-none'); initials.classList.add('d-none'); };
      img.onerror = () => { img.classList.add('d-none'); initials.classList.remove('d-none'); };
    } else if (img && initials) {
      img.src = '';
      img.classList.add('d-none');
      initials.classList.remove('d-none');
    }

    // C1-07: Poblar dropdown del avatar
    const ddName = this.querySelector('#dash-dropdown-name');
    const ddCarrera = this.querySelector('#dash-dropdown-carrera');
    const ddSemestre = this.querySelector('#dash-dropdown-semestre');
    if (ddName) ddName.textContent = profile.displayName || 'Estudiante';
    if (ddCarrera) ddCarrera.textContent = this._getProfileCareer(profile);
    if (ddSemestre) ddSemestre.textContent = profile.semestre ? `Semestre ${profile.semestre}` : '';
    this._populateHeaderStatus(profile);
    this._applyScopeButtons(this._getDashboardPrefs(profile)?.defaultScope || 'week');

    // C3-03: Poblar SOS panel
    this._populateSOS(profile);
    this._populateSemesterGoals(profile);

    // C1-10: Restaurar orden de cards + enable drag reorder
    this._restoreCardOrder(profile);
    this._applyAccessVisibility(profile);
    this._setupCardReorder();

    // Verificar tutorial solo una vez por usuario en la vida del componente.
    const tutorialUid = profile.uid || window.SIA?.auth?.currentUser?.uid || null;
    const shouldEvaluateTutorial = source === 'app-auth' || source === 'dashboard-hydrate';
    if (shouldEvaluateTutorial && this._isDashboardVisible() && tutorialUid && this._tutorialCheckedUid !== tutorialUid) {
      this._tutorialCheckedUid = tutorialUid;
      this._checkFirstTimeTutorial();
    }

    if (typeof window.SIA?.restoreStudentDashboardCache === 'function') {
      window.SIA.restoreStudentDashboardCache({
        resetIfMissing: sessionChanged || source === 'app-auth' || source === 'qa-context-switch' || source === 'dashboard-hydrate'
      });
    }
  }

  _isDashboardVisible() {
    if (this.id !== 'view-dashboard' || this.classList.contains('d-none')) return false;

    const visibleViewId = document.querySelector('.app-view:not(.d-none)')?.id || null;
    if (visibleViewId) return visibleViewId === 'view-dashboard';

    const routedViewId = window.Store?.currentView || window.SIA?.currentView || null;
    if (routedViewId) return routedViewId === 'view-dashboard';

    const path = (window.location.pathname || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    return path === '/dashboard' || path === '/' || hash === '#/dashboard';
  }

  _applyAccessVisibility(profile) {
    const allowedViews = window.SIA?.getEffectiveAllowedViews ? window.SIA.getEffectiveAllowedViews(profile) : (profile?.allowedViews || []);
    const profileCategory = window.SIA?.getProfileCategory ? window.SIA.getProfileCategory(profile) : (profile?.role === 'student' ? 'student' : 'personal');
    const cardViewMap = {
      aula: 'view-aula',
      comunidad: 'view-comunidad',
      medi: 'view-medi',
      biblio: 'view-biblio',
      cafeteria: 'view-cafeteria',
      foro: 'view-foro',
      quejas: 'view-quejas',
      encuestas: 'view-encuestas',
      lactario: 'view-lactario'
    };

    this.querySelectorAll('.smart-card-col').forEach((col) => {
      const cardId = col.dataset.cardId;
      const viewId = cardViewMap[cardId];
      if (!viewId) return;

      const isVisible = allowedViews.some((allowedView) => viewId === allowedView || viewId.startsWith(`${allowedView}-`));
      col.classList.toggle('d-none', !isVisible);
    });

    const showAcademicSections = profileCategory === 'student';
    this.querySelector('#dash-activity-section')?.classList.toggle('d-none', !showAcademicSections);
    this.querySelector('#dash-scorecard-section')?.classList.toggle('d-none', !showAcademicSections);
    this.querySelector('#dash-goals-section')?.classList.toggle('d-none', !showAcademicSections);
  }

  // ── C1-07: Avatar Dropdown Setup ───────────────────────────────

  _setupAvatarDropdown() {
    const qrBtn = this.querySelector('#dash-dropdown-qr');
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        if (typeof window.openDigitalID === 'function') window.openDigitalID();
        else window.SIA?.navigate('view-profile');
      });
    }

    const logoutBtn = this.querySelector('#dash-dropdown-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (typeof window.logout === 'function') window.logout();
      });
    }

    const resetBtn = this.querySelector('#dash-dropdown-reset-order');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this._resetCardOrder());
    }
  }

  // ── C3-04: Scorecard toggle ────────────────────────────────────

  _setupScorecardToggle() {
    const toggle = this.querySelector('#dash-scorecard-toggle');
    const body = this.querySelector('#dash-scorecard-body');
    const chevron = this.querySelector('#dash-scorecard-chevron');
    if (!toggle || !body) return;

    toggle.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
    });
  }

  // ── C3-03: SOS Panel ───────────────────────────────────────────

  _setupSOSPanel() {
    const fab = this.querySelector('#dash-sos-toggle');
    const panel = this.querySelector('#dash-sos-panel');
    const close = this.querySelector('#dash-sos-close');

    if (fab && panel) {
      fab.addEventListener('click', () => panel.classList.toggle('d-none'));
    }
    if (close && panel) {
      close.addEventListener('click', () => panel.classList.add('d-none'));
    }
    this._renderPanicPanel();
  }

  _populateSOS(profile) {
    const sosFab = this.querySelector('#dash-sos-fab');
    if (!sosFab) return;
    if (window.PanicService?.canUsePanicFab?.(profile)) {
      sosFab.classList.remove('d-none');
      this._syncSOSFabPosition();
      if (!this._panicDraft) this._panicDraft = this._getDefaultPanicDraft();
      window.PanicService.loadConfig?.().catch(() => null);
      this._renderPanicPanel();
      return;
    }

    sosFab.classList.add('d-none');
  }

  _handlePanicStateChanged() {
    this._renderPanicPanel();
  }

  _getDefaultPanicDraft() {
    return {
      recipientMode: 'custom',
      selectedGroups: ['docentes'],
      campusZone: '',
      manualReference: '',
      reason: '',
      reviewMode: false,
      sending: false,
      locating: false,
      holdReady: false
    };
  }

  _syncSOSFabPosition() {
    const sosFab = this.querySelector('#dash-sos-fab');
    if (!sosFab) return;
    sosFab.classList.add('dash-sos-alone');
  }

  _getPanicUiState() {
    return window.PanicService?.getState?.() || {
      phase: 'idle',
      alert: null,
      config: window.PanicService?.getConfig?.() || null,
      tracking: { active: false, error: '', lastCapture: null, lastSentPoint: null }
    };
  }

  _getPanicConfig() {
    const panicState = this._getPanicUiState();
    return panicState.config || {
      main: {
        allowedRecipientModes: ['custom', 'staff', 'school'],
        campusZones: [],
        ui: { requireReasonFor: ['staff', 'school'] }
      },
      groups: {}
    };
  }

  _getPanicModeLabel(mode) {
    if (mode === 'staff') return 'Todo el personal';
    if (mode === 'school') return 'Toda la escuela';
    return 'Personalizado';
  }

  _formatPanicDate(value) {
    if (!value) return 'Ahora mismo';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ahora mismo';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  _renderPanicGroupButtons(config) {
    const draft = this._panicDraft || this._getDefaultPanicDraft();
    const groupKeys = Array.isArray(config?.main?.curatedGroups) && config.main.curatedGroups.length
      ? config.main.curatedGroups
      : ['docentes'];

    return groupKeys.map((groupKey) => {
      const normalizedKey = String(groupKey || '').trim();
      const selected = draft.selectedGroups.includes(normalizedKey);
      const label = config?.groups?.[normalizedKey]?.label || normalizedKey.replace(/_/g, ' ');
      return `
        <button type="button" class="btn btn-sm rounded-pill ${selected ? 'btn-danger' : 'btn-outline-secondary'}"
          data-panic-group="${normalizedKey}">
          ${label}
        </button>
      `;
    }).join('');
  }

  _renderPanicZoneOptions(config) {
    const draft = this._panicDraft || this._getDefaultPanicDraft();
    const zones = Array.isArray(config?.main?.campusZones) ? config.main.campusZones : [];
    return zones.map((zone) => `
      <option value="${zone.key}" ${draft.campusZone === zone.key ? 'selected' : ''}>${zone.label}</option>
    `).join('');
  }

  _renderPanicLocationSummary(panicState) {
    const point = panicState?.tracking?.lastCapture || panicState?.alert?.exactLocation || null;
    if (!point || point.lat == null || point.lng == null) {
      return `
        <div class="small fw-bold" style="color: var(--text-heading);">Sin GPS capturado todavia</div>
        <div class="extra-small text-muted">Si no hay permiso de ubicacion, describe una referencia manual clara.</div>
      `;
    }
    return `
      <div class="small fw-bold" style="color: var(--text-heading);">${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}</div>
      <div class="extra-small text-muted">
        Precision ${point.accuracy ? `${Math.round(point.accuracy)} m` : 'sin dato'} · ${this._formatPanicDate(point.capturedAt)}
      </div>
    `;
  }

  _renderPanicIdle(config, panicState) {
    const draft = this._panicDraft || this._getDefaultPanicDraft();
    const requiresReason = (config?.main?.ui?.requireReasonFor || []).includes(draft.recipientMode);
    return `
      <div class="dash-panic-card p-2 rounded-3">
        <div class="extra-small text-muted mb-2">Destino</div>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm rounded-pill ${draft.recipientMode === 'custom' ? 'btn-danger' : 'btn-outline-secondary'}" data-panic-mode="custom">Personalizado</button>
          <button type="button" class="btn btn-sm rounded-pill ${draft.recipientMode === 'staff' ? 'btn-danger' : 'btn-outline-secondary'}" data-panic-mode="staff">Todo el personal</button>
          <button type="button" class="btn btn-sm rounded-pill ${draft.recipientMode === 'school' ? 'btn-danger' : 'btn-outline-secondary'}" data-panic-mode="school">Toda la escuela</button>
        </div>
      </div>
      ${draft.recipientMode === 'custom' ? `
        <div class="dash-panic-card p-2 rounded-3">
          <div class="extra-small text-muted mb-2">Grupos autorizados</div>
          <div class="d-flex flex-wrap gap-2">${this._renderPanicGroupButtons(config)}</div>
        </div>
      ` : ''}
      <div class="dash-panic-card p-2 rounded-3">
        <label class="extra-small text-muted mb-1 d-block">Zona o edificio</label>
        <select class="form-select form-select-sm" id="dash-panic-zone">
          <option value="">Selecciona una zona</option>
          ${this._renderPanicZoneOptions(config)}
        </select>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <label class="extra-small text-muted mb-1 d-block">Referencia manual</label>
        <input type="text" class="form-control form-control-sm" id="dash-panic-reference"
          maxlength="180" placeholder="Ej. Piso 2, pasillo de laboratorios"
          value="${draft.manualReference || ''}">
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <label class="extra-small text-muted mb-1 d-block">Motivo ${requiresReason ? '(obligatorio)' : '(opcional)'}</label>
        <textarea class="form-control form-control-sm" id="dash-panic-reason" rows="2" maxlength="400"
          placeholder="Describe brevemente que esta ocurriendo">${draft.reason || ''}</textarea>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>${this._renderPanicLocationSummary(panicState)}</div>
          <button type="button" class="btn btn-sm btn-outline-primary rounded-pill" data-panic-refresh-location ${draft.locating ? 'disabled' : ''}>
            ${draft.locating ? 'Buscando...' : 'Ubicacion'}
          </button>
        </div>
        ${panicState?.tracking?.error ? `<div class="extra-small text-warning mt-2">${panicState.tracking.error}</div>` : ''}
      </div>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-danger btn-sm rounded-pill flex-fill fw-bold" data-panic-review ${draft.sending ? 'disabled' : ''}>
          ${draft.sending ? 'Enviando...' : 'Revisar alerta'}
        </button>
        <a href="tel:911" class="btn btn-outline-danger btn-sm rounded-pill fw-bold">911</a>
      </div>
    `;
  }

  _renderPanicReview(config, panicState) {
    const draft = this._panicDraft || this._getDefaultPanicDraft();
    const requiresHold = draft.recipientMode === 'staff' || draft.recipientMode === 'school';
    const zone = (config?.main?.campusZones || []).find((item) => item.key === draft.campusZone);
    return `
      <div class="dash-panic-card p-2 rounded-3">
        <div class="extra-small text-muted mb-2">Confirma la alerta</div>
        <div class="small"><strong>Destino:</strong> ${this._getPanicModeLabel(draft.recipientMode)}</div>
        ${draft.recipientMode === 'custom' ? `<div class="small"><strong>Grupos:</strong> ${(draft.selectedGroups || []).join(', ')}</div>` : ''}
        <div class="small"><strong>Zona:</strong> ${zone?.label || 'No indicada'}</div>
        <div class="small"><strong>Referencia:</strong> ${draft.manualReference || 'Sin referencia'}</div>
        <div class="small"><strong>Motivo:</strong> ${draft.reason || 'Sin motivo'}</div>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        ${this._renderPanicLocationSummary(panicState)}
      </div>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-light btn-sm rounded-pill flex-fill" data-panic-cancel-review>Editar</button>
        <button type="button" class="btn btn-danger btn-sm rounded-pill flex-fill fw-bold" data-panic-send ${draft.sending ? 'disabled' : ''}>
          ${requiresHold ? 'Mantener para confirmar' : (draft.sending ? 'Enviando...' : 'Enviar ahora')}
        </button>
      </div>
      ${requiresHold ? '<div class="extra-small text-muted text-center">Para los niveles mas altos se requiere mantener presionado el boton de envio.</div>' : ''}
    `;
  }

  _renderPanicActive(alert, panicState) {
    const zone = alert?.campusZone?.label || alert?.campusZone?.key || 'Sin zona';
    const summary = alert?.dispatchSummary || {};
    const mapUrl = window.PanicService?.getMapsUrl?.(alert) || '';
    return `
      <div class="dash-panic-card p-2 rounded-3">
        <div class="extra-small text-muted">Alerta activa</div>
        <div class="small fw-bold" style="color: var(--text-heading);">${this._getPanicModeLabel(alert?.recipientMode)}</div>
        <div class="extra-small text-muted">ID ${alert?.id || '---'} · ${this._formatPanicDate(alert?.createdAt)}</div>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <div class="small"><strong>Zona:</strong> ${zone}</div>
        <div class="small"><strong>Referencia:</strong> ${alert?.manualReference || 'Sin referencia'}</div>
        <div class="small"><strong>Motivo:</strong> ${alert?.reason || 'Sin motivo capturado'}</div>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <div class="small"><strong>Canales:</strong> ${summary.notificationCount || 0} in-app · ${summary.pushCount || 0} push · ${summary.emailCount || 0} email · ${summary.smsCount || 0} SMS</div>
        <div class="small"><strong>Acks:</strong> ${summary.ackCount || 0}</div>
        <div class="extra-small ${panicState?.tracking?.active ? 'text-success' : 'text-muted'}">
          ${panicState?.tracking?.active ? 'Seguimiento foreground activo.' : 'Seguimiento en espera o sin permiso.'}
        </div>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        ${this._renderPanicLocationSummary(panicState)}
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button type="button" class="btn btn-outline-primary btn-sm rounded-pill flex-fill" data-panic-refresh-location>Actualizar ubicacion</button>
        ${mapUrl ? `<a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm rounded-pill flex-fill">Abrir en Maps</a>` : ''}
      </div>
      <button type="button" class="btn btn-outline-danger btn-sm rounded-pill w-100 fw-bold" data-panic-resolve-own>
        Marcar como falsa alarma / a salvo
      </button>
    `;
  }

  _renderPanicTerminal(alert) {
    const status = String(alert?.status || '').toLowerCase();
    const isError = ['error', 'rejected'].includes(status);
    const details = alert?.dispatchSummary?.lastError || alert?.rejectionReason || alert?.resolution?.notes || '';
    return `
      <div class="dash-panic-card p-2 rounded-3">
        <div class="small fw-bold ${isError ? 'text-warning' : 'text-success'}">${isError ? 'Ultimo intento con incidencia' : 'Ultima alerta cerrada'}</div>
        <div class="extra-small text-muted">${this._formatPanicDate(alert?.resolvedAt || alert?.updatedAt || alert?.createdAt)}</div>
      </div>
      <div class="dash-panic-card p-2 rounded-3">
        <div class="small"><strong>Estado:</strong> ${status || 'cerrada'}</div>
        <div class="small"><strong>Destino:</strong> ${this._getPanicModeLabel(alert?.recipientMode)}</div>
        <div class="small"><strong>Zona:</strong> ${alert?.campusZone?.label || alert?.campusZone?.key || 'Sin zona'}</div>
        ${details ? `<div class="extra-small text-muted mt-2">${details}</div>` : ''}
      </div>
      <button type="button" class="btn btn-danger btn-sm rounded-pill w-100 fw-bold" data-panic-reset-draft>
        Preparar nueva alerta
      </button>
    `;
  }

  _renderPanicPanel() {
    const sosFab = this.querySelector('#dash-sos-fab');
    const toggle = this.querySelector('#dash-sos-toggle');
    const titleEl = this.querySelector('#dash-sos-title');
    const statusEl = this.querySelector('#dash-sos-status');
    const contentEl = this.querySelector('#dash-sos-content');
    if (!sosFab || !toggle || !statusEl || !contentEl) return;

    const profile = this._profile || window.SIA?.currentUserProfile || window.currentUserProfile || null;
    if (!window.PanicService?.canUsePanicFab?.(profile)) {
      sosFab.classList.add('d-none');
      return;
    }

    if (!this._panicDraft) this._panicDraft = this._getDefaultPanicDraft();
    sosFab.classList.remove('d-none');
    this._syncSOSFabPosition();

    const panicState = this._getPanicUiState();
    const alert = panicState.alert || null;
    const phase = panicState.phase || 'idle';
    const isError = ['error', 'rejected'].includes(String(alert?.status || '').toLowerCase());

    toggle.classList.toggle('dash-sos-btn-active', phase === 'active');
    toggle.classList.toggle('dash-sos-btn-error', phase === 'terminal' && isError);
    if (titleEl) titleEl.textContent = phase === 'active' ? 'Monitoreo activo' : 'Boton de panico';

    if (phase === 'active') {
      statusEl.textContent = 'Alerta activa y compartiendo seguimiento';
      statusEl.style.background = 'rgba(239,68,68,0.16)';
      statusEl.style.color = '#b91c1c';
      contentEl.innerHTML = this._renderPanicActive(alert, panicState);
    } else if (phase === 'terminal') {
      statusEl.textContent = isError ? 'Ultima alerta con incidencia o rechazo' : 'Ultima alerta cerrada';
      statusEl.style.background = isError ? 'rgba(245,158,11,0.16)' : 'rgba(16,185,129,0.16)';
      statusEl.style.color = isError ? '#b45309' : '#047857';
      contentEl.innerHTML = this._renderPanicTerminal(alert);
    } else if (this._panicDraft.reviewMode) {
      statusEl.textContent = 'Revision final antes del envio';
      statusEl.style.background = 'rgba(245,158,11,0.16)';
      statusEl.style.color = '#b45309';
      contentEl.innerHTML = this._renderPanicReview(this._getPanicConfig(), panicState);
    } else {
      statusEl.textContent = 'Selecciona alcance, zona y referencia';
      statusEl.style.background = 'rgba(14,165,233,0.12)';
      statusEl.style.color = 'var(--accent)';
      contentEl.innerHTML = this._renderPanicIdle(this._getPanicConfig(), panicState);
    }

    this._bindPanicPanelEvents();
  }

  _bindPanicPanelEvents() {
    this.querySelectorAll('[data-panic-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        this._panicDraft.recipientMode = button.dataset.panicMode || 'custom';
        if (this._panicDraft.recipientMode !== 'custom') this._panicDraft.selectedGroups = ['docentes'];
        this._renderPanicPanel();
      });
    });

    this.querySelectorAll('[data-panic-group]').forEach((button) => {
      button.addEventListener('click', () => {
        const groupKey = button.dataset.panicGroup;
        const selected = new Set(this._panicDraft.selectedGroups || []);
        if (selected.has(groupKey)) selected.delete(groupKey);
        else selected.add(groupKey);
        this._panicDraft.selectedGroups = [...selected];
        if (this._panicDraft.selectedGroups.length === 0) this._panicDraft.selectedGroups = ['docentes'];
        this._renderPanicPanel();
      });
    });

    const zone = this.querySelector('#dash-panic-zone');
    if (zone) {
      zone.addEventListener('change', () => {
        this._panicDraft.campusZone = zone.value || '';
      });
    }

    const reference = this.querySelector('#dash-panic-reference');
    if (reference) {
      reference.addEventListener('input', () => {
        this._panicDraft.manualReference = reference.value || '';
      });
    }

    const reason = this.querySelector('#dash-panic-reason');
    if (reason) {
      reason.addEventListener('input', () => {
        this._panicDraft.reason = reason.value || '';
      });
    }

    const refreshLocation = this.querySelector('[data-panic-refresh-location]');
    if (refreshLocation) {
      refreshLocation.addEventListener('click', () => this._refreshPanicLocation());
    }

    const reviewButton = this.querySelector('[data-panic-review]');
    if (reviewButton) {
      reviewButton.addEventListener('click', () => this._startPanicReview());
    }

    const cancelReview = this.querySelector('[data-panic-cancel-review]');
    if (cancelReview) {
      cancelReview.addEventListener('click', () => {
        this._panicDraft.reviewMode = false;
        this._renderPanicPanel();
      });
    }

    const sendButton = this.querySelector('[data-panic-send]');
    if (sendButton) {
      const needsHold = this._panicDraft.recipientMode === 'staff' || this._panicDraft.recipientMode === 'school';
      if (needsHold) {
        const holdMs = this._getPanicConfig()?.main?.ui?.holdToConfirmMs || 1800;
        let holdTimer = null;
        const start = () => {
          sendButton.textContent = 'Confirmando...';
          holdTimer = window.setTimeout(() => {
            holdTimer = null;
            this._submitPanicAlert();
          }, holdMs);
        };
        const cancel = () => {
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = null;
          if (!this._panicDraft.sending) sendButton.textContent = 'Mantener para confirmar';
        };
        sendButton.addEventListener('pointerdown', start);
        sendButton.addEventListener('pointerup', cancel);
        sendButton.addEventListener('pointerleave', cancel);
      } else {
        sendButton.addEventListener('click', () => this._submitPanicAlert());
      }
    }

    const resolveOwn = this.querySelector('[data-panic-resolve-own]');
    if (resolveOwn) {
      resolveOwn.addEventListener('click', () => this._resolveOwnPanicAlert());
    }

    const resetDraft = this.querySelector('[data-panic-reset-draft]');
    if (resetDraft) {
      resetDraft.addEventListener('click', () => {
        this._panicDraft = this._getDefaultPanicDraft();
        this._renderPanicPanel();
      });
    }
  }

  async _refreshPanicLocation() {
    if (!window.PanicService?.captureCurrentLocation) return;
    this._panicDraft.locating = true;
    this._renderPanicPanel();
    try {
      const point = await window.PanicService.captureCurrentLocation();
      const panicState = this._getPanicUiState();
      if (panicState?.phase === 'active' && panicState?.alert?.id) {
        await window.PanicService.updateLocation?.(panicState.alert.id, point);
      }
      window.showToast?.('Ubicacion capturada', 'success');
    } catch (error) {
      window.showToast?.(error?.message || 'No se pudo leer la ubicacion', 'warning');
    } finally {
      this._panicDraft.locating = false;
      this._renderPanicPanel();
    }
  }

  _validatePanicDraft() {
    const config = this._getPanicConfig();
    const requiresReason = (config?.main?.ui?.requireReasonFor || []).includes(this._panicDraft.recipientMode);
    if (!this._panicDraft.campusZone) {
      throw new Error('Selecciona una zona o edificio del campus.');
    }
    if (requiresReason && !String(this._panicDraft.reason || '').trim()) {
      throw new Error('Debes capturar un motivo breve para este alcance.');
    }
    if (this._panicDraft.recipientMode === 'custom' && (!Array.isArray(this._panicDraft.selectedGroups) || !this._panicDraft.selectedGroups.length)) {
      throw new Error('Selecciona al menos un grupo autorizado.');
    }
  }

  _startPanicReview() {
    try {
      this._validatePanicDraft();
      this._panicDraft.reviewMode = true;
      this._renderPanicPanel();
    } catch (error) {
      window.showToast?.(error?.message || 'Faltan datos para continuar', 'warning');
    }
  }

  _buildPanicPayload() {
    const panicState = this._getPanicUiState();
    return {
      recipientMode: this._panicDraft.recipientMode,
      selectedGroups: this._panicDraft.recipientMode === 'custom' ? this._panicDraft.selectedGroups : [],
      campusZone: this._panicDraft.campusZone,
      manualReference: (this._panicDraft.manualReference || '').trim(),
      reason: (this._panicDraft.reason || '').trim(),
      exactLocation: panicState?.tracking?.lastCapture || null,
      clientRequestId: `panic_${Date.now()}`
    };
  }

  async _submitPanicAlert() {
    if (!window.PanicService?.createAlert) return;
    try {
      this._validatePanicDraft();
      this._panicDraft.sending = true;
      this._renderPanicPanel();
      const result = await window.PanicService.createAlert(this._buildPanicPayload());
      this._panicDraft = this._getDefaultPanicDraft();
      window.showToast?.(
        result?.reusedExisting ? 'Ya existe una alerta activa para tu perfil.' : 'Alerta enviada. Se inicio el seguimiento.',
        result?.reusedExisting ? 'warning' : 'danger'
      );
    } catch (error) {
      console.error('[Dashboard] Error creando alerta de panico:', error);
      window.showToast?.(error?.message || 'No se pudo enviar la alerta', 'danger');
      this._panicDraft.sending = false;
      return;
    }
    this._renderPanicPanel();
  }

  async _resolveOwnPanicAlert() {
    const panicState = this._getPanicUiState();
    const alertId = panicState?.alert?.id;
    if (!alertId || !window.PanicService?.resolveAlert) return;
    const confirmed = window.confirm('Esto cerrara tu alerta activa como falsa alarma o a salvo. Continuar?');
    if (!confirmed) return;
    try {
      await window.PanicService.resolveAlert(alertId, { type: 'false_alarm', notes: 'Cierre desde dashboard de estudiante.' });
      window.showToast?.('La alerta fue cerrada', 'success');
    } catch (error) {
      console.error('[Dashboard] Error resolviendo alerta:', error);
      window.showToast?.(error?.message || 'No se pudo cerrar la alerta', 'danger');
    }
  }

  // ── Refresh Button ─────────────────────────────────────────────

  _setupRefreshButton() {
    const btn = this.querySelector('#dash-refresh-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.querySelector('i').classList.add('spin');
      const refreshPromise = typeof window.SIA?.refreshStudentDashboard === 'function'
        ? window.SIA.refreshStudentDashboard()
        : window.SIA?.updateSmartCards?.();

      Promise.resolve(refreshPromise)
        .catch((e) => console.warn('[Dashboard] Error refreshing student dashboard:', e))
        .finally(() => {
          setTimeout(() => btn.querySelector('i')?.classList.remove('spin'), 300);
        });
    });
  }

  // ── C1-10: Card Reorder ────────────────────────────────────────

  _restoreCardOrder(profile) {
    const order = profile.prefs?.cardOrder;
    if (!order || !Array.isArray(order)) return;

    const grid = this.querySelector('#smart-card-grid');
    if (!grid) return;

    const cols = Array.from(grid.querySelectorAll('.smart-card-col'));
    const ordered = [];
    const remaining = [...cols];

    order.forEach(id => {
      const idx = remaining.findIndex(c => c.dataset.cardId === id);
      if (idx !== -1) {
        ordered.push(remaining.splice(idx, 1)[0]);
      }
    });

    // Agregar los que no estaban en el orden guardado
    ordered.push(...remaining);
    ordered.forEach(col => grid.appendChild(col));
  }

  async _resetCardOrder() {
    const nextProfile = this._profile
      ? {
        ...this._profile,
        prefs: {
          ...(this._profile.prefs || {}),
          cardOrder: null
        }
      }
      : this._profile;

    this._profile = nextProfile;
    this.render();
    this._hydrate();
    if (nextProfile) this._onProfileReady({ profile: nextProfile, source: 'reset-card-order' });

    try {
      await this._persistCardOrder(null);
      window.showToast?.('Orden de módulos restablecido', 'success');
    } catch (e) {
      console.warn('[Dashboard] Error resetting card order:', e);
      window.showToast?.('No se pudo restablecer el orden', 'warning');
    }
  }

  _setupCardReorder() {
    const grid = this.querySelector('#smart-card-grid');
    if (!grid || grid.dataset.reorderBound === 'true') return;
    grid.dataset.reorderBound = 'true';

    let dragEl = null;

    grid.querySelectorAll('.smart-card-col').forEach(col => {
      col.setAttribute('draggable', 'true');

      col.addEventListener('dragstart', (e) => {
        dragEl = col;
        col.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });

      col.addEventListener('dragend', () => {
        col.style.opacity = '1';
        grid.querySelectorAll('.smart-card-col').forEach(c => c.classList.remove('drag-over'));
        dragEl = null;
      });

      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (dragEl && dragEl !== col) {
          const allCols = Array.from(grid.querySelectorAll('.smart-card-col'));
          const dragIdx = allCols.indexOf(dragEl);
          const dropIdx = allCols.indexOf(col);
          if (dragIdx < dropIdx) col.after(dragEl);
          else col.before(dragEl);
          this._saveCardOrder();
        }
      });
    });

    // Touch reorder (long press)
    let touchTimer = null;
    let touchDragEl = null;
    let touchMovedCard = false;

    const clearTouchState = () => {
      clearTimeout(touchTimer);
      touchTimer = null;

      if (touchDragEl) {
        touchDragEl.classList.remove('drag-active');
      }

      touchDragEl = null;
      touchMovedCard = false;
    };

    grid.querySelectorAll('.smart-card-col').forEach(col => {
      col.addEventListener('touchstart', () => {
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
          touchDragEl = col;
          touchMovedCard = false;
          col.classList.add('drag-active');
          navigator.vibrate?.(50);
        }, 350);
      }, { passive: true });

      col.addEventListener('touchmove', (e) => {
        if (!touchDragEl) {
          clearTimeout(touchTimer);
          return;
        }

        const touch = e.touches?.[0];
        if (!touch) return;

        e.preventDefault();
        const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.smart-card-col');
        if (!target || target === touchDragEl || !grid.contains(target)) return;

        const allCols = Array.from(grid.querySelectorAll('.smart-card-col'));
        const dragIdx = allCols.indexOf(touchDragEl);
        const targetIdx = allCols.indexOf(target);
        if (dragIdx === -1 || targetIdx === -1) return;

        if (dragIdx < targetIdx) target.after(touchDragEl);
        else target.before(touchDragEl);

        touchMovedCard = true;
      }, { passive: false });

      col.addEventListener('touchend', () => {
        clearTimeout(touchTimer);
        if (!touchDragEl) return;

        const shouldSave = touchMovedCard;
        clearTouchState();

        if (shouldSave) this._saveCardOrder();
      });

      col.addEventListener('touchcancel', clearTouchState);
    });
  }

  _saveCardOrder() {
    const grid = this.querySelector('#smart-card-grid');
    if (!grid) return;
    const order = Array.from(grid.querySelectorAll('.smart-card-col'))
      .map(c => c.dataset.cardId)
      .filter(Boolean);

    this._persistCardOrder(order)
      .catch(e => console.warn('[Dashboard] Error saving card order:', e));
  }

  // ── Boton QR rapido ──────────────────────────────────────────────

  _setupQRButton() {
    const btn = this.querySelector('#dash-qr-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.openDigitalID === 'function') window.openDigitalID();
      else window.SIA?.navigate('view-profile');
    });
  }

  // ── Tutorial ─────────────────────────────────────────────────────

  _setupCampusMapButton() {
    const btn = this.querySelector('#dash-campus-map-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.SIA?.navigate?.('view-campus-map');
    });
  }

  _setupTutorialButton() {
    const btn = this.querySelector('#btn-replay-tutorial');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (window.SiaOnboardingTour) window.SiaOnboardingTour.resetForUser();
      this._launchTutorial();
    });
  }

  async _checkFirstTimeTutorial() {
    if (!window.SiaOnboardingTour || !this._isDashboardVisible()) return;
    try {
      const uid = window.SIA?.auth?.currentUser?.uid || window.Store?.userProfile?.uid;
      let hasSeenTour = false;

      if (uid && window.SIA?.getUserPreferences) {
        const prefs = await window.SIA.getUserPreferences(uid);
        if (prefs === null) return;
        if (prefs && prefs[`tour_${window.SIA_TOUR_VERSION}`]) {
          hasSeenTour = true;
        }
      }

      if (!hasSeenTour && window.SiaOnboardingTour.shouldShow()) {
        if (this._tutorialLaunchTimeout) clearTimeout(this._tutorialLaunchTimeout);
        this._tutorialLaunchTimeout = setTimeout(() => {
          this._tutorialLaunchTimeout = null;
          if (this._isDashboardVisible()) this._launchTutorial();
        }, 1000);
      }
    } catch (e) {
      console.warn("Error checking tutorial DB preferences", e);
      return;
    }
  }

  _launchTutorial() {
    if (!this._isDashboardVisible() || window.SIA_TOUR_ACTIVE) return;
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
