class SiaLandingView extends HTMLElement {
  constructor() {
    super();
    this.handlePwaStateChange = this.updateAppPromoState.bind(this);
  }

  connectedCallback() {
    this.render();
    window.addEventListener('beforeinstallprompt', this.handlePwaStateChange);
    window.addEventListener('appinstalled', this.handlePwaStateChange);
  }

  disconnectedCallback() {
    window.removeEventListener('beforeinstallprompt', this.handlePwaStateChange);
    window.removeEventListener('appinstalled', this.handlePwaStateChange);
  }

  isAppInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
    return false;
  }

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  canInstallApp() {
    return Boolean(window.SIA && window.SIA.deferredPrompt);
  }

  notify(message, type = 'info') {
    const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
    if (toastFn) toastFn(message, type);
  }

  getInstallInstructionsHtml(reinstall = false) {
    const actionLabel = reinstall ? 'volver a instalar' : 'instalar';

    if (this.isAndroid()) {
      return `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-android2 text-success me-2"></i>Android</h6>
          <p class="small mb-3">Para ${actionLabel} SIA en Android, usa Chrome y sigue estos pasos:</p>
          <ol class="small ps-3 mb-0">
            <li class="mb-2">Abre SIA y toca el menu de <strong>tres puntos</strong>.</li>
            <li class="mb-2">Selecciona <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
            <li>Confirma la instalacion para tener acceso directo a tus procesos, credencial y avisos.</li>
          </ol>
        </div>
      `;
    }

    if (this.isIOS()) {
      return `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-apple me-2"></i>iPhone y iPad</h6>
          <p class="small mb-3">En iOS se instala desde <strong>Safari</strong> usando el menu de compartir:</p>
          <ol class="small ps-3 mb-0">
            <li class="mb-2">Abre SIA en <strong>Safari</strong>.</li>
            <li class="mb-2">Toca <strong>Compartir</strong> <i class="bi bi-box-arrow-up"></i>.</li>
            <li>Elige <strong>"Agregar a pantalla de inicio"</strong> y confirma para dejar SIA como app.</li>
          </ol>
        </div>
      `;
    }

    return `
      <div class="text-start">
        <h6 class="fw-bold mb-3"><i class="bi bi-laptop me-2"></i>Instalacion desde navegador</h6>
        <p class="small mb-3">Si tu navegador permite instalar SIA, encontraras la opcion en alguno de estos puntos:</p>
        <ol class="small ps-3 mb-0">
          <li class="mb-2">Icono de instalacion en la barra de direcciones.</li>
          <li class="mb-2">Menu principal del navegador con la opcion <strong>"Instalar app"</strong>.</li>
          <li>Si ya la tenias instalada y quieres ${actionLabel}, primero eliminala y luego vuelve a agregarla.</li>
        </ol>
      </div>
    `;
  }

  showInstallInstructions(reinstall = false) {
    const title = reinstall ? 'SIA ya esta instalada' : 'Instalar SIA';
    const html = this.getInstallInstructionsHtml(reinstall);

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title,
        html,
        icon: null,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#1B396A',
        width: '520px'
      });
      return;
    }

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modalId = 'landing-app-install-modal';
      let modal = document.getElementById(modalId);

      if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header border-0">
                <h5 class="modal-title"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body pt-0"></div>
              <div class="modal-footer border-0">
                <button type="button" class="btn btn-primary rounded-pill px-4" data-bs-dismiss="modal">Entendido</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.querySelector('.modal-title').textContent = title;
      modal.querySelector('.modal-body').innerHTML = html;
      new bootstrap.Modal(modal).show();
      return;
    }

    window.alert('Instalacion disponible desde el navegador o agregando SIA a la pantalla de inicio.');
  }

  async confirmReinstall() {
    const message = 'SIA ya esta instalada en este dispositivo. Quieres ver como volver a instalarla?';

    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title: 'App ya instalada',
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Si, mostrar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1B396A'
      });
      return result.isConfirmed;
    }

    return window.confirm(message);
  }

  async handleInstallClick() {
    if (this.isAppInstalled()) {
      const confirmed = await this.confirmReinstall();
      if (confirmed) this.showInstallInstructions(true);
      return;
    }

    if (window.SIA && typeof window.SIA.installApp === 'function' && this.canInstallApp()) {
      await window.SIA.installApp();
      setTimeout(() => this.updateAppPromoState(), 300);
      return;
    }

    this.showInstallInstructions(false);
  }

  async handleShareClick() {
    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const payload = {
      title: 'SIA | TecNM Campus Los Cabos',
      text: 'Instala SIA y entra mas rapido a tus procesos academicos y de campus.',
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error('No fue posible compartir SIA:', error);
          this.notify('No fue posible abrir el menu para compartir.', 'warning');
        }
      }
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.notify('Enlace de SIA copiado al portapapeles.', 'success');
        return;
      } catch (error) {
        console.error('No fue posible copiar el enlace de SIA:', error);
      }
    }

    this.notify(`Comparte este enlace: ${shareUrl}`, 'info');
  }

  updateAppPromoCard(card) {
    const installBtn = card.querySelector('[data-role="install"]');
    const status = card.querySelector('[data-role="status"]');

    if (!installBtn || !status) return;

    card.classList.remove('is-installed');

    if (this.isAppInstalled()) {
      card.classList.add('is-installed');
      installBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Reinstalar app</span>';
      status.textContent = 'SIA ya esta instalada en este dispositivo. Si quieres volver a instalarla, te guiaremos paso a paso.';
      return;
    }

    if (this.canInstallApp()) {
      installBtn.innerHTML = '<i class="bi bi-download"></i><span>Instalar app</span>';
      status.textContent = 'Disponible para Android y iOS. Instalarla te deja el acceso directo en tu pantalla de inicio.';
      return;
    }

    installBtn.innerHTML = '<i class="bi bi-phone"></i><span>Como instalar</span>';
    status.textContent = this.isIOS()
      ? 'En iPhone y iPad se instala desde Safari con Compartir y luego Agregar a pantalla de inicio.'
      : 'Si tu navegador no muestra la descarga directa, te indicamos como instalar SIA manualmente.';
  }

  updateAppPromoState() {
    this.querySelectorAll('[data-landing-app-card]').forEach((card) => {
      this.updateAppPromoCard(card);
    });
  }

  getStudentProcesses() {
    return [
      {
        module: 'Academico',
        title: 'Clases y seguimiento',
        desc: 'Entra a materias, revisa actividades y consulta lo pendiente sin salir de SIA.',
        icon: 'bi-mortarboard-fill',
        tone: 'is-blue',
        tags: ['Aula', 'Tareas', 'Cursos']
      },
      {
        module: 'Servicios',
        title: 'Servicios del campus',
        desc: 'Usa biblioteca, cafeteria y mapa del campus desde el mismo acceso institucional.',
        icon: 'bi-grid-1x2-fill',
        tone: 'is-amber',
        tags: ['Biblioteca', 'Cafeteria', 'Mapa']
      },
      {
        module: 'Bienestar',
        title: 'Salud y acompanamiento',
        desc: 'Agenda atencion medica o psicologica y da seguimiento a tu bienestar desde el celular.',
        icon: 'bi-heart-pulse-fill',
        tone: 'is-red',
        tags: ['Citas', 'Salud', 'Seguimiento']
      },
      {
        module: 'Campus',
        title: 'Avisos, perfil y credencial',
        desc: 'Consulta novedades, abre tu perfil y mantén a la mano tu identidad institucional.',
        icon: 'bi-megaphone-fill',
        tone: 'is-cyan',
        tags: ['Avisos', 'Perfil', 'Credencial']
      }
    ];
  }

  renderStudentProcesses() {
    return this.getStudentProcesses().map((process) => `
      <article class="landing-card landing-process-card rounded-4">
        <div class="landing-process-top">
          <div class="landing-module-icon ${process.tone}">
            <i class="bi ${process.icon}"></i>
          </div>
          <span class="landing-process-badge">${process.module}</span>
        </div>
        <h3 class="landing-process-title">${process.title}</h3>
        <p class="landing-process-desc">${process.desc}</p>
        <div class="landing-process-tags">
          ${process.tags.map((tag) => `<span class="landing-process-tag">${tag}</span>`).join('')}
        </div>
      </article>
    `).join('');
  }

  getNavHtml() {
    return `
      <div class="fixed-top d-flex justify-content-center mt-3" style="z-index: 1030;">
        <nav class="navbar navbar-expand-lg landing-nav-pill rounded-pill py-2 px-3 position-relative" style="max-width: 95%; width: auto;">
          <div class="container-fluid gap-3">
            <a class="navbar-brand landing-brand-lockup d-flex align-items-center gap-2 m-0" href="#landing-hero">
              <div class="landing-brand-logos">
                <img src="/images/logo-ites.png" alt="TecNM" class="logo-tecnm">
                <div class="brand-divider"></div>
                <img src="/images/logo-sia.png" alt="SIA" class="logo-ites">
              </div>
              <div class="landing-brand-copy">
                <strong>SIA</strong>
                <span>ITES Los Cabos</span>
              </div>
            </a>

            <button class="navbar-toggler border-0 p-1 ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#landingNavContent">
              <i class="bi bi-list fs-4 text-white"></i>
            </button>

            <div class="collapse navbar-collapse landing-nav-collapse" id="landingNavContent">
              <ul class="navbar-nav mx-3 gap-1">
                <li class="nav-item"><a href="#landing-hero" class="nav-link">Inicio</a></li>
                <li class="nav-item"><a href="#landing-procesos" class="nav-link">Que puedes hacer</a></li>
                <li class="nav-item"><a href="#landing-vocacional" class="nav-link">Aspirantes</a></li>
                <li class="nav-item"><a href="#landing-contacto" class="nav-link">Contacto</a></li>
              </ul>

              <button id="btn-login-hero-nav" data-landing-login class="btn btn-landing-cta d-flex align-items-center gap-2">
                <i class="bi bi-box-arrow-in-right"></i>
                <span>Acceso Institucional</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    `;
  }

  getHeroHtml() {
    return `
      <main id="landing-hero" class="landing-hero w-100 position-relative d-flex align-items-center" style="min-height: 92vh; background: linear-gradient(160deg, #0f1114 0%, #111825 40%, #1B396A 100%); overflow: hidden;">
        <div class="position-absolute w-100 h-100 top-0 start-0 pe-none" style="overflow: hidden;">
          <div class="position-absolute w-100 h-100" style="opacity: 0.03; background-image:
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 60px 60px;"></div>
          <div class="position-absolute" style="top: -20%; right: -10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(27,57,106,0.4) 0%, transparent 70%); border-radius: 50%; filter: blur(80px);"></div>
          <div class="position-absolute" style="bottom: -30%; left: -10%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(128,126,130,0.2) 0%, transparent 70%); border-radius: 50%; filter: blur(60px);"></div>
        </div>

        <div class="container position-relative pt-5" style="z-index: 2;">
          <div class="row align-items-center gy-5 landing-hero-layout">
            <div class="col-lg-6 order-1">
              <div class="landing-section-label mb-4 landing-fade-up landing-fade-up-1">Plataforma Oficial ITES Los Cabos</div>

              <h1 class="landing-hero-title display-3 fw-bold lh-sm mb-4 landing-fade-up landing-fade-up-2">
                Todo tu campus,<br>
                <span class="landing-gradient-text">en un solo acceso.</span>
              </h1>

              <p class="landing-hero-subtitle mb-4 landing-fade-up landing-fade-up-3">
                SIA es la plataforma institucional del <strong>TecNM Campus Los Cabos</strong>. Desde aqui puedes entrar a clases, servicios, credencial y avisos con tu cuenta institucional. Si aun eres aspirante, ya puedes estudiar y practicar para admision sin crear cuenta.
              </p>

              <div class="landing-hero-actions landing-fade-up landing-fade-up-4">
                <button id="btn-hero-cta-login" data-landing-login class="btn btn-acceso-institucional d-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-microsoft"></i>
                  <span>Entrar con cuenta institucional</span>
                </button>
                <a href="#/admisiones" class="btn btn-outline-light landing-secondary-cta rounded-pill px-4 py-3 fw-semibold d-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-journal-richtext"></i>
                  <span>Prepararme para admision</span>
                </a>
                <a href="#/mapa-campus" class="btn landing-campus-cta rounded-pill px-4 py-3 fw-semibold d-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-geo-alt-fill"></i>
                  <span>Mapa del campus</span>
                </a>
              </div>

              <div class="landing-trust-list landing-fade-up landing-fade-up-5">
                <span class="landing-trust-chip"><i class="bi bi-shield-check"></i>Acceso oficial</span>
                <span class="landing-trust-chip"><i class="bi bi-phone"></i>Listo para celular</span>
                <span class="landing-trust-chip"><i class="bi bi-grid-1x2-fill"></i>Servicios en un solo lugar</span>
              </div>

              <div class="landing-hero-note landing-fade-up landing-fade-up-5">
                Alumnos, docentes y personal entran con su correo institucional. Aspirantes pueden iniciar por admisiones y guardar progreso local sin iniciar sesion.
              </div>
            </div>

            <div class="col-lg-6 order-2 text-center position-relative">
              <div class="position-relative d-inline-block landing-float">
                <div class="position-absolute top-50 start-50 translate-middle rounded-circle" style="width: 280px; height: 280px; background: rgba(27,57,106,0.3); filter: blur(60px);"></div>
                <div class="card landing-mockup-card landing-dashboard-preview landing-hero-surface rounded-4 overflow-hidden ms-auto me-auto">
                  <div class="p-3 d-flex align-items-center gap-2" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <div class="d-flex gap-1">
                      <div class="rounded-circle" style="width:9px; height:9px; background:#ff5f56;"></div>
                      <div class="rounded-circle" style="width:9px; height:9px; background:#ffbd2e;"></div>
                      <div class="rounded-circle" style="width:9px; height:9px; background:#27c93f;"></div>
                    </div>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.3); font-family: 'Noto Sans', sans-serif;">sia.loscabos.tecnm.mx</span>
                  </div>
                  <div class="p-4 text-start">
                    <div class="d-flex justify-content-between mb-4">
                      <div>
                        <h5 class="fw-bold mb-1" style="color: #fff; font-size: 1.1rem;">Accesos mas usados</h5>
                        <small style="color: rgba(255,255,255,0.45); font-size: 0.8rem;">Lo esencial de SIA en una sola entrada</small>
                      </div>
                      <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold landing-preview-mark">SIA</div>
                    </div>
                    <div class="landing-preview-list">
                      <div class="landing-preview-item is-priority">
                        <div>
                          <div class="landing-preview-label">Entrar a clases</div>
                          <div class="landing-preview-text">Materias, actividades y seguimiento academico.</div>
                        </div>
                      </div>
                      <div class="landing-preview-item">
                        <div>
                          <div class="landing-preview-label">Resolver servicios</div>
                          <div class="landing-preview-text">Biblioteca, cafeteria y recursos de campus.</div>
                        </div>
                      </div>
                      <div class="landing-preview-item">
                        <div>
                          <div class="landing-preview-label">Mantenerte al dia</div>
                          <div class="landing-preview-text">Avisos, perfil, credencial y acceso rapido.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  getVocacionalHtml() {
    return `
      <section id="landing-vocacional" class="landing-section-alt py-5">
        <div class="container py-4">
          <div class="landing-vocational-spotlight">
            <div class="landing-vocational-copy">
              <div class="landing-section-label mb-3">Ruta publica para aspirantes</div>
              <h2 class="fw-bold mb-3">Si aun no eres parte del campus, empieza por admisiones.</h2>
              <p class="landing-vocational-lead mb-4">
                El nuevo centro de admision de SIA convierte la guia EVALUATEC 2026 en una ruta de estudio por carrera, con practica por areas, fechas oficiales y progreso local sin cuenta institucional.
              </p>
              <div class="landing-trust-list mb-4">
                <span class="landing-trust-chip"><i class="bi bi-stars"></i>Nuevo ingreso</span>
                <span class="landing-trust-chip"><i class="bi bi-journal-check"></i>Estudio + practica</span>
                <span class="landing-trust-chip"><i class="bi bi-arrow-repeat"></i>Progreso local</span>
              </div>
              <div class="landing-vocational-actions">
                <a href="#/admisiones" class="btn btn-acceso-institucional d-inline-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-journal-richtext"></i>
                  <span>Entrar a admisiones</span>
                </a>
                <a href="#/test-vocacional" class="btn btn-outline-light landing-secondary-cta rounded-pill px-4 py-3 fw-semibold d-inline-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-compass-fill"></i>
                  <span>Test vocacional</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  getProcessesHtml() {
    return `
      <section id="landing-procesos" class="py-5">
        <div class="container py-4">
          <div class="text-center mb-5">
            <div class="landing-section-label justify-content-center mb-3">Que puedes hacer aqui</div>
            <h2 class="fw-bold mb-3" style="font-size: 2.25rem;">Lo esencial de SIA, sin vueltas.</h2>
            <p class="mx-auto" style="max-width: 640px; color: rgba(255,255,255,0.55); font-size: 0.98rem;">
              SIA no necesita explicarse por decenas de modulos. Estas son las acciones que concentran el uso diario dentro del campus.
            </p>
          </div>

          <div class="landing-process-grid">
            ${this.renderStudentProcesses()}
          </div>

          <div class="landing-process-footer">
            <p class="mb-0">Todo parte del mismo acceso institucional para evitar brincar entre herramientas separadas.</p>
            <button data-landing-login class="btn btn-landing-cta d-inline-flex align-items-center justify-content-center gap-2">
              <i class="bi bi-box-arrow-in-right"></i>
              <span>Entrar a SIA</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  getHowItWorksHtml() {
    return `
      <section id="landing-beneficios" class="landing-section-alt py-5">
        <div class="container py-4">
          <div class="text-center mb-5">
            <div class="landing-section-label justify-content-center mb-3">Como funciona</div>
            <h2 class="fw-bold mb-3" style="font-size: 2.25rem;">Un acceso, tres pasos.</h2>
          </div>

          <div class="landing-step-grid">
            <article class="landing-card landing-step-card rounded-4">
              <div class="landing-step-number">1</div>
              <h3>Entra con tu cuenta institucional</h3>
              <p>Alumnos, docentes y personal usan el mismo acceso oficial del campus.</p>
            </article>
            <article class="landing-card landing-step-card rounded-4">
              <div class="landing-step-number">2</div>
              <h3>Abre el modulo que necesitas</h3>
              <p>Clases, servicios, bienestar, credencial y avisos viven dentro de la misma plataforma.</p>
            </article>
            <article class="landing-card landing-step-card rounded-4">
              <div class="landing-step-number">3</div>
              <h3>Resuelve el proceso desde tu celular</h3>
              <p>La interfaz prioriza consulta rapida, continuidad y acceso diario desde movil.</p>
            </article>
          </div>
        </div>
      </section>
    `;
  }

  getAppPromoHtml() {
    return `
      <section id="landing-app" class="py-5">
        <div class="container py-4">
          <div id="landing-app-banner" class="landing-app-banner landing-app-banner-compact" data-landing-app-card>
            <div class="landing-app-copy">
              <div class="landing-app-kicker mb-2">App SIA</div>
              <h3 class="landing-app-title mb-2">Instalala si entras seguido.</h3>
              <p class="mb-0">
                Deja SIA en tu pantalla de inicio para entrar mas rapido a tus procesos de campus.
              </p>
            </div>
            <div class="landing-app-actions">
              <button id="btn-landing-app-install" class="btn btn-landing-app-download d-flex align-items-center justify-content-center gap-2" data-role="install">
                <i class="bi bi-download"></i>
                <span>Instalar app</span>
              </button>
              <button id="btn-landing-app-share" class="btn btn-landing-app-share d-flex align-items-center justify-content-center gap-2" data-role="share">
                <i class="bi bi-share-fill"></i>
                <span>Compartir SIA</span>
              </button>
            </div>
            <div id="landing-app-status" class="landing-app-status" data-role="status"></div>
          </div>
        </div>
      </section>
    `;
  }

  getFooterHtml() {
    return `
      <footer id="landing-contacto" class="pt-5 pb-4" style="border-top: 1px solid rgba(255,255,255,0.06) !important;">
        <div class="container">
          <div class="row g-4 justify-content-between align-items-start">
            <div class="col-lg-5">
              <div class="landing-brand-logos mb-3">
                <img src="/images/tecnm-logo-oscuro.png" alt="TecNM" class="logo-tecnm" style="height: 40px;">
                <div class="brand-divider" style="height: 32px;"></div>
                <img src="/images/logo-sia.png" alt="SIA" class="logo-ites">
              </div>
              <p style="color: rgba(255,255,255,0.4); font-size: 0.85rem; line-height: 1.7; max-width: 320px;">
                SIA es la plataforma institucional del Tecnologico Nacional de Mexico, Campus Los Cabos.
              </p>
              <div class="d-flex gap-3 mt-3">
                <a class="landing-social-link" href="https://www.facebook.com/itesloscabos.oficial" target="_blank" rel="noopener" aria-label="Facebook ITES Los Cabos">
                  <i class="bi bi-facebook"></i>
                </a>
                <a class="landing-social-link" href="https://www.instagram.com/ites_loscabos" target="_blank" rel="noopener" aria-label="Instagram ITES Los Cabos">
                  <i class="bi bi-instagram"></i>
                </a>
              </div>
            </div>

            <div class="col-6 col-lg-3">
              <h6 class="fw-bold mb-3" style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">Acceso rapido</h6>
              <ul class="list-unstyled" style="font-size: 0.85rem;">
                <li class="mb-2"><button data-landing-login class="btn p-0 border-0 bg-transparent text-start">Acceso institucional</button></li>
                <li class="mb-2"><a href="#/admisiones">Admisiones</a></li>
                <li class="mb-2"><a href="#/test-vocacional">Test vocacional</a></li>
                <li class="mb-2"><a href="#/mapa-campus">Mapa del campus</a></li>
                <li class="mb-2"><a href="#landing-contacto">Soporte</a></li>
              </ul>
            </div>

            <div class="col-6 col-lg-4">
              <h6 class="fw-bold mb-3" style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">Soporte</h6>
              <ul class="list-unstyled" style="font-size: 0.85rem;">
                <li class="mb-2" style="color: rgba(255,255,255,0.4);"><i class="bi bi-telephone me-2"></i>+52 (624) 142 5939</li>
                <li class="mb-2"><a href="mailto:soporte.sia@loscabos.tecnm.mx"><i class="bi bi-envelope me-2"></i>soporte.sia@loscabos.tecnm.mx</a></li>
                <li class="mb-2" style="color: rgba(255,255,255,0.4);"><i class="bi bi-geo-alt me-2"></i>C. Gandhi, Guaymitas, San Jose del Cabo, B.C.S.</li>
              </ul>
            </div>
          </div>

          <hr style="border-color: rgba(255,255,255,0.06); margin: 2rem 0;">

          <div class="row align-items-center">
            <div class="col-md-6 text-center text-md-start" style="font-size: 0.78rem; color: rgba(255,255,255,0.3);">
              &copy; 2026 SIA | TecNM Campus Los Cabos
            </div>
            <div class="col-md-6 text-center text-md-end" style="font-size: 0.78rem;">
              <a href="https://www.itesloscabos.edu.mx" target="_blank" rel="noopener" style="color: rgba(255,255,255,0.3);">Sitio Oficial ITES</a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  bindLoginButtons() {
    const loginButtons = Array.from(this.querySelectorAll('[data-landing-login]'));

    const setLoginLoading = (isLoading) => {
      loginButtons.forEach((button) => {
        if (!button.dataset.defaultHtml) {
          button.dataset.defaultHtml = button.innerHTML;
        }

        button.disabled = isLoading;
        button.innerHTML = isLoading
          ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span>Conectando...</span>'
          : button.dataset.defaultHtml;
      });
    };

    const triggerLogin = async () => {
      if (window.SIA && window.SIA.initiateMicrosoftLogin) {
        setLoginLoading(true);
        try {
          await window.SIA.initiateMicrosoftLogin();
        } finally {
          window.setTimeout(() => setLoginLoading(false), 400);
        }
      } else {
        console.warn('SIA.initiateMicrosoftLogin not found');
      }
    };

    loginButtons.forEach((button) => {
      button.onclick = () => triggerLogin();
    });
  }

  bindLandingAnchors() {
    this.querySelectorAll('a[href^="#landing-"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const collapse = this.querySelector('#landingNavContent');
          if (collapse && collapse.classList.contains('show') && typeof bootstrap !== 'undefined') {
            const bsCollapse = bootstrap.Collapse.getInstance(collapse);
            if (bsCollapse) bsCollapse.hide();
          }
        }
      });
    });
  }

  render() {
    this.className = 'd-none';
    this.innerHTML = `
      ${this.getNavHtml()}
      ${this.getHeroHtml()}
      ${this.getProcessesHtml()}
      ${this.getHowItWorksHtml()}
      ${this.getVocacionalHtml()}
      ${this.getAppPromoHtml()}
      ${this.getFooterHtml()}
      <button id="btn-login-microsoft" class="d-none"></button>
    `;

    const btnInstallApp = this.querySelector('#btn-landing-app-install');
    const btnShareApp = this.querySelector('#btn-landing-app-share');

    this.bindLoginButtons();
    this.bindLandingAnchors();

    if (btnInstallApp) btnInstallApp.onclick = () => this.handleInstallClick();
    if (btnShareApp) btnShareApp.onclick = () => this.handleShareClick();

    this.querySelectorAll('[data-role="install"]').forEach((button) => {
      button.onclick = () => this.handleInstallClick();
    });

    this.querySelectorAll('[data-role="share"]').forEach((button) => {
      button.onclick = () => this.handleShareClick();
    });

    this.updateAppPromoState();
  }
}

if (!customElements.get('sia-landing-view')) {
  customElements.define('sia-landing-view', SiaLandingView);
}
