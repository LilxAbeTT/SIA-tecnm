class SiaLandingView extends HTMLElement {
  constructor() {
    super();
    this.handlePwaStateChange = this.updateAppPromoState.bind(this);
    this.revealObserver = null;
    this.visibilityObserver = null;
  }

  connectedCallback() {
    this.render();
    this.syncBodyState();
    this.observeVisibilityState();
    window.addEventListener('beforeinstallprompt', this.handlePwaStateChange);
    window.addEventListener('appinstalled', this.handlePwaStateChange);
  }

  disconnectedCallback() {
    document.body.classList.remove('sia-landing-active');
    window.removeEventListener('beforeinstallprompt', this.handlePwaStateChange);
    window.removeEventListener('appinstalled', this.handlePwaStateChange);

    if (this.revealObserver) {
      this.revealObserver.disconnect();
      this.revealObserver = null;
    }

    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
  }

  syncBodyState() {
    document.body.classList.toggle('sia-landing-active', !this.classList.contains('d-none'));
  }

  observeVisibilityState() {
    if (this.visibilityObserver) return;

    this.visibilityObserver = new MutationObserver(() => {
      this.syncBodyState();
    });

    this.visibilityObserver.observe(this, {
      attributes: true,
      attributeFilter: ['class']
    });
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

  getInfoContent() {
    return {
      que_es: {
        icon: 'bi-grid-1x2-fill',
        title: 'La plataforma',
        lead: 'SIA concentra en un solo acceso lo que más se usa dentro del TecNM Campus Los Cabos.',
        items: [
          'Reúne clases, servicios, avisos y herramientas institucionales dentro del mismo entorno.',
          'Evita brincar entre enlaces, módulos aislados y canales informales para resolver lo cotidiano.',
          'Prioriza consulta y acceso rápido desde el celular, sin perder la versión completa en escritorio.'
        ]
      },
      beneficios: {
        icon: 'bi-stars',
        title: 'Lo que encuentras aquí',
        lead: 'La idea es simple: entrar una vez y ubicar rápido lo importante.',
        items: [
          'Acceso único para estudiantes, docentes y personal.',
          'Rutas directas para aula, perfil, avisos, servicios de campus y seguimiento.',
          'Herramientas públicas para aspirantes como admisiones, práctica y mapa del campus.'
        ]
      },
      resuelve: {
        icon: 'bi-tools',
        title: 'Por qué existe',
        lead: 'Nace para que los procesos comunes del campus no dependan de varios sitios o pasos dispersos.',
        items: [
          'Centraliza accesos que antes se consultaban por separado.',
          'Da visibilidad a avisos, ubicaciones y trámites de uso frecuente.',
          'Reduce tiempo perdido al buscar dónde entrar, a quién acudir o cómo continuar un proceso.'
        ]
      },
      comunidad: {
        icon: 'bi-people-fill',
        title: 'Perfiles',
        lead: 'La experiencia cambia según quién entra, pero la puerta principal sigue siendo la misma.',
        items: [
          'Estudiantes: clases, servicios, bienestar, comunidad y avisos.',
          'Docentes y personal: herramientas operativas según permisos.',
          'Aspirantes: admisiones, práctica EVALUATEC, test vocacional y mapa del campus.'
        ]
      },
      contacto: {
        icon: 'bi-headset',
        title: 'Soporte y contacto',
        lead: 'Si necesitas ayuda con acceso o uso de SIA, estos son los canales base.',
        items: [
          'Teléfono: +52 (624) 142 5939',
          'Correo: soporte.sia@loscabos.tecnm.mx',
          'Campus: C. Gandhi, Guaymitas, San José del Cabo, B.C.S.'
        ]
      },
      estudiante: {
        icon: 'bi-mortarboard-fill',
        title: 'Estudiantes',
        lead: 'Entrada directa para consultar clases, avisos, servicios y herramientas de uso diario.',
        items: [
          'Acceso con cuenta institucional autorizada.',
          'Aula, perfil, credencial, servicios y avisos desde el mismo entorno.',
          'Rutas pensadas para uso frecuente desde celular.'
        ]
      },
      docente: {
        icon: 'bi-person-workspace',
        title: 'Docentes y personal',
        lead: 'Acceso operativo para herramientas internas según permisos institucionales.',
        items: [
          'Ingreso con cuenta institucional.',
          'Módulos disponibles de acuerdo con el perfil y el área asignada.',
          'Servicios de campus, avisos y seguimiento desde SIA.'
        ]
      },
      aspirante: {
        icon: 'bi-compass-fill',
        title: 'Aspirantes',
        lead: 'Ruta pública para explorar admisiones, practicar y ubicar el campus antes de ingresar.',
        items: [
          'Proceso de admisión sin iniciar sesión institucional.',
          'Práctica EVALUATEC y test vocacional como apoyo previo.',
          'Mapa del campus para ubicar edificios y servicios.'
        ]
      },
      visitante: {
        icon: 'bi-geo-alt-fill',
        title: 'Visitantes',
        lead: 'Consulta pública para ubicar el campus, revisar accesos principales y encontrar canales oficiales.',
        items: [
          'Mapa del campus disponible sin cuenta.',
          'Enlaces oficiales del TecNM Campus Los Cabos.',
          'Soporte y contacto institucional desde el pie del sitio.'
        ]
      },
      confianza: {
        icon: 'bi-shield-check',
        title: 'Acceso institucional',
        lead: 'SIA funciona como puerta de entrada para la comunidad del TecNM Campus Los Cabos.',
        items: [
          'El acceso interno requiere cuenta autorizada.',
          'Los módulos visibles cambian según el perfil del usuario.',
          'Las rutas públicas se mantienen separadas para aspirantes y visitantes.'
        ]
      }
    };
  }

  getModuleHighlights() {
    return {
      aula: {
        icon: 'bi-mortarboard-fill',
        title: 'Aula',
        lead: 'El espacio académico para consultar clases, actividades y seguimiento escolar.',
        items: [
          'Acceso a materias, publicaciones y entregas.',
          'Seguimiento de pendientes y avisos de clase.',
          'Herramientas para estudiantes y docentes según su perfil.'
        ]
      },
      biblio: {
        icon: 'bi-book-half',
        title: 'Biblioteca',
        lead: 'Servicios bibliotecarios y recursos del campus desde SIA.',
        items: [
          'Consulta de catálogo y préstamos.',
          'Reservas y seguimiento de servicios disponibles.',
          'Apoyo para localizar recursos académicos.'
        ]
      },
      medi: {
        icon: 'bi-heart-pulse-fill',
        title: 'Bienestar',
        lead: 'Atención médica, psicológica y acompañamiento para la comunidad del campus.',
        items: [
          'Agenda de citas y seguimiento de atención.',
          'Comunicación con profesionales de apoyo.',
          'Registro institucional para continuidad del servicio.'
        ]
      },
      comunidad: {
        icon: 'bi-people-fill',
        title: 'Comunidad',
        lead: 'Un punto de encuentro para avisos, participación y vida estudiantil.',
        items: [
          'Publicaciones y conversaciones del campus.',
          'Interacción entre estudiantes y áreas institucionales.',
          'Moderación para mantener un entorno seguro.'
        ]
      },
      cafeteria: {
        icon: 'bi-cup-hot-fill',
        title: 'Cafetería',
        lead: 'Consulta y seguimiento de servicios de cafetería dentro de SIA.',
        items: [
          'Menú y disponibilidad de productos.',
          'Pedidos y seguimiento de estado.',
          'Reseñas y comunicación con el servicio.'
        ]
      },
      avisos: {
        icon: 'bi-megaphone-fill',
        title: 'Avisos',
        lead: 'Comunicación institucional para no perder información importante del campus.',
        items: [
          'Avisos destacados y comunicados oficiales.',
          'Consulta rápida desde móvil.',
          'Seguimiento de novedades relevantes para cada perfil.'
        ]
      },
      quejas: {
        icon: 'bi-chat-square-heart-fill',
        title: 'Quejas y sugerencias',
        lead: 'Canal institucional para levantar reportes, comentarios y solicitudes.',
        items: [
          'Registro de tickets desde la plataforma.',
          'Historial y seguimiento de respuestas.',
          'Comunicación directa con las áreas responsables.'
        ]
      },
      mapa: {
        icon: 'bi-map-fill',
        title: 'Mapa del campus',
        lead: 'Guía visual para ubicar edificios, accesos y servicios dentro del plantel.',
        items: [
          'Ubicación de edificios principales.',
          'Consulta pública para aspirantes y visitantes.',
          'Acceso rápido desde el portal.'
        ]
      }
    };
  }

  getInstallInstructionsHtml(reinstall = false) {
    const actionLabel = reinstall ? 'volver a instalar' : 'instalar';

    if (this.isAndroid()) {
      return `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-android2 text-success me-2"></i>Android</h6>
          <p class="small mb-3">Para ${actionLabel} SIA en Android, usa Chrome y sigue estos pasos:</p>
          <ol class="small ps-3 mb-0">
            <li class="mb-2">Abre SIA y toca el menú de <strong>tres puntos</strong>.</li>
            <li class="mb-2">Selecciona <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong>.</li>
            <li>Confirma la instalación para tener acceso directo a tus procesos, credencial y avisos.</li>
          </ol>
        </div>
      `;
    }

    if (this.isIOS()) {
      return `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-apple me-2"></i>iPhone y iPad</h6>
          <p class="small mb-3">En iOS se instala desde <strong>Safari</strong> usando el menú de compartir:</p>
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
        <h6 class="fw-bold mb-3"><i class="bi bi-laptop me-2"></i>Instalación desde navegador</h6>
        <p class="small mb-3">Si tu navegador permite instalar SIA, encontrarás la opción en alguno de estos puntos:</p>
        <ol class="small ps-3 mb-0">
          <li class="mb-2">Ícono de instalación en la barra de direcciones.</li>
          <li class="mb-2">Menú principal del navegador con la opción <strong>"Instalar app"</strong>.</li>
          <li>Si ya la tenías instalada y quieres ${actionLabel}, primero elimínala y luego vuelve a agregarla.</li>
        </ol>
      </div>
    `;
  }

  showInstallInstructions(reinstall = false) {
    const title = reinstall ? 'SIA ya está instalada' : 'Instalar SIA';
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

    window.alert('Instalación disponible desde el navegador o agregando SIA a la pantalla de inicio.');
  }

  async confirmReinstall() {
    const message = 'SIA ya está instalada en este dispositivo. ¿Quieres ver cómo volver a instalarla?';

    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title: 'App ya instalada',
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, mostrar',
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
      text: 'SIA conecta acceso académico, servicios y avisos del TecNM Campus Los Cabos.',
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error('No fue posible compartir SIA:', error);
          this.notify('No fue posible abrir el menú para compartir.', 'warning');
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
      status.textContent = 'SIA ya está instalada en este dispositivo.';
      return;
    }

    if (this.canInstallApp()) {
      installBtn.innerHTML = '<i class="bi bi-download"></i><span>Instalar app</span>';
      status.textContent = 'Disponible para dejar SIA como acceso directo.';
      return;
    }

    installBtn.innerHTML = '<i class="bi bi-phone"></i><span>Cómo instalar</span>';
    status.textContent = this.isIOS()
      ? 'En iPhone y iPad se instala desde Safari.'
      : 'Te mostramos la instalación manual si el navegador no ofrece descarga directa.';
  }

  updateAppPromoState() {
    this.querySelectorAll('[data-landing-app-card]').forEach((card) => {
      this.updateAppPromoCard(card);
    });
  }

  getNavHtml() {
    return `
      <header class="sia-landing-nav-wrap">
        <nav class="sia-landing-nav" aria-label="Navegación principal">
          <a class="sia-landing-brand" href="#landing-hero" aria-label="Inicio SIA">
            <span class="sia-brand-logos">
              <img src="/images/logo-tecnm.png" alt="TecNM" class="sia-brand-logo-tecnm">
              <span class="sia-brand-divider"></span>
              <img src="/images/logo-ites.png" alt="ITES Los Cabos" class="sia-brand-logo-ites">
             </span>
            <span class="sia-brand-copy">
              <strong>Campus Los Cabos</strong>
              <small>TecNM</small>
            </span>
          </a>

          <button class="sia-nav-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#landingNavContent" aria-controls="landingNavContent" aria-expanded="false" aria-label="Abrir menú">
            <i class="bi bi-list"></i>
          </button>

          <div class="collapse sia-nav-content" id="landingNavContent">
            <a class="sia-nav-link" href="#landing-personas">Entradas</a>
            <a class="sia-nav-link" href="#landing-aspirantes">Aspirantes</a>
            <a class="sia-nav-link" href="#landing-servicios">Servicios</a>
            <button type="button" class="sia-nav-link" data-landing-info="contacto">Contacto</button>
            <button type="button" class="sia-nav-login" data-landing-login>
              <i class="bi bi-box-arrow-in-right"></i>
              <span>Acceder</span>
            </button>
          </div>
        </nav>
      </header>
    `;
  }

  getHeroHtml() {
    return `
      <main id="landing-hero" class="sia-landing-hero">
        <div class="sia-hero-glow" aria-hidden="true"></div>

        <section class="sia-hero-main" data-reveal>
          <div class="sia-hero-kicker">
            <i class="bi bi-buildings-fill"></i>
            <span>TecNM Campus Los Cabos</span>
          </div>

          <h1 class="sia-hero-logo-title">
            <img src="/images/logo-sia-mob.png" alt="SIA">
          </h1>
          <p class="sia-hero-subtitle">Portal de entrada para comunidad, aspirantes y visitantes del TecNM Campus Los Cabos.</p>

          <div class="sia-hero-actions" aria-label="Acciones principales">
            <button type="button" class="sia-action-primary" data-landing-login>
              <i class="bi bi-box-arrow-in-right"></i>
              <span>Acceder</span>
            </button>
            <a class="sia-action-secondary is-admissions" href="#/admisiones">
              <i class="bi bi-journal-check"></i>
              <span>Proceso de admisión</span>
            </a>
            <a class="sia-action-secondary is-map" href="#/mapa-campus">
              <i class="bi bi-geo-alt-fill"></i>
              <span>Mapa del campus</span>
            </a>
          </div>

          <button type="button" class="sia-read-more" data-landing-info="que_es">
            <span>Qué es SIA</span>
            <i class="bi bi-arrow-right-short"></i>
          </button>
        </section>

        <section class="sia-hero-panel" data-reveal>
          <div class="sia-phone-shell" aria-label="Vista rápida de SIA">
            <div class="sia-phone-top">
              <span></span>
            </div>
            <div class="sia-phone-header">
              <img src="/images/logo-sia-mob.png" alt="SIA">
              <div>
                <strong>Entrada SIA</strong>
                <span>Elige tu ruta</span>
              </div>
            </div>
            <div class="sia-phone-list">
              <button type="button" class="sia-phone-row" data-landing-login>
                <i class="bi bi-mortarboard-fill"></i>
                <span>Comunidad ITES</span>
                <b>Entrar</b>
              </button>
              <a class="sia-phone-row" href="#/admisiones">
                <i class="bi bi-pencil-square"></i>
                <span>Soy aspirante</span>
                <b>Ver</b>
              </a>
              <a class="sia-phone-row" href="#/mapa-campus">
                <i class="bi bi-signpost-split-fill"></i>
                <span>Visito el campus</span>
                <b>Mapa</b>
              </a>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  getQuickRoutesHtml() {
    return `
      <section id="landing-personas" class="sia-landing-section sia-audience-section" aria-label="Entradas por tipo de usuario">
        <div class="sia-section-heading" data-reveal>
          <span>Elige tu entrada</span>
          <h2>¿Cómo usarás SIA?</h2>
          <p class="sia-section-brief">Cada perfil muestra los accesos que normalmente necesita primero.</p>
        </div>

        <div class="sia-audience-grid">
          <article class="sia-audience-card is-student" data-reveal>
            <span><i class="bi bi-mortarboard-fill"></i></span>
            <h3>Estudiante</h3>
            <p>Clases, perfil, avisos y servicios del campus.</p>
            <div>
              <button type="button" data-landing-login>Acceder</button>
              <button type="button" data-landing-info="estudiante">Ver ruta</button>
            </div>
          </article>

          <article class="sia-audience-card is-staff" data-reveal>
            <span><i class="bi bi-person-workspace"></i></span>
            <h3>Docente o personal</h3>
            <p>Herramientas internas según permisos institucionales.</p>
            <div>
              <button type="button" data-landing-login>Acceder</button>
              <button type="button" data-landing-info="docente">Ver ruta</button>
            </div>
          </article>

          <article class="sia-audience-card is-applicant" data-reveal>
            <span><i class="bi bi-compass-fill"></i></span>
            <h3>Aspirante</h3>
            <p>Admisiones, práctica, test vocacional y mapa.</p>
            <div>
              <a href="#/admisiones">Abrir admisiones</a>
              <button type="button" data-landing-info="aspirante">Ver ruta</button>
            </div>
          </article>

          <article class="sia-audience-card is-visitor" data-reveal>
            <span><i class="bi bi-geo-alt-fill"></i></span>
            <h3>Visitante</h3>
            <p>Ubicación, acceso al campus y canales oficiales.</p>
            <div>
              <a href="#/mapa-campus">Ver mapa</a>
              <button type="button" data-landing-info="visitante">Ver ruta</button>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  renderModuleStickers() {
    const modules = this.getModuleHighlights();
    return Object.entries(modules).map(([key, module], index) => `
      <button
        type="button"
        class="sia-module-sticker is-${key}"
        data-landing-module="${key}"
        data-reveal
        style="--sticker-index: ${index};"
      >
        <span class="sia-module-sticker-icon">
          <i class="bi ${module.icon}"></i>
        </span>
        <span class="sia-module-sticker-copy">
          <strong>${module.title}</strong>
          <small>${module.lead}</small>
        </span>
      </button>
    `).join('');
  }

  getModulesHtml() {
    return `
      <section class="sia-landing-section sia-modules-section" aria-label="Accesos frecuentes">
        <div class="sia-section-heading" data-reveal>
          <span>Accesos frecuentes</span>
          <h2>Lo que más se usa dentro de SIA</h2>
          <p class="sia-section-brief">Abre una vista rápida de cada módulo sin salir del portal.</p>
        </div>

        <div class="sia-module-carousel" aria-label="Carrusel de módulos destacados de SIA">
          ${this.renderModuleStickers()}
        </div>
      </section>
    `;
  }

  getMinimalInfoHtml() {
    return `
      <section id="landing-aspirantes" class="sia-landing-section sia-aspirants-section" aria-label="Ruta para aspirantes">
        <div class="sia-aspirants-panel" data-reveal>
          <div class="sia-section-heading">
            <span>Aspirantes</span>
            <h2>Prepara tu ingreso al campus</h2>
            <p class="sia-section-brief">Consulta el proceso, practica y ubica el plantel antes de iniciar tu vida universitaria.</p>
          </div>

          <div class="sia-route-carousel is-aspirants" aria-label="Accesos para aspirantes">
            <article class="sia-route-card is-admissions">
              <i class="bi bi-journal-richtext"></i>
              <h3>Proceso de admisión</h3>
              <p>Guía pública con ruta, pasos y seguimiento para aspirantes.</p>
              <a href="#/admisiones">Abrir proceso</a>
            </article>

            <article class="sia-route-card is-campus">
              <i class="bi bi-ui-checks-grid"></i>
              <h3>Práctica EVALUATEC</h3>
              <p>Refuerza temas por carrera desde el módulo de admisiones.</p>
              <a href="#/admisiones">Practicar</a>
            </article>

            <article class="sia-route-card is-vocational">
              <i class="bi bi-compass-fill"></i>
              <h3>Test vocacional</h3>
              <p>Explora carreras y contrasta tu perfil antes de decidir.</p>
              <a href="#/test-vocacional">Abrir test</a>
            </article>

            <article class="sia-route-card is-location">
              <i class="bi bi-map-fill"></i>
              <h3>Mapa del campus</h3>
              <p>Ubica edificios, accesos y servicios del plantel.</p>
              <a href="#/mapa-campus">Ver mapa</a>
            </article>
          </div>
        </div>
      </section>
    `;
  }

  getCampusServicesHtml() {
    return `
      <section id="landing-servicios" class="sia-landing-section sia-campus-services" aria-label="Servicios del campus">
        <div class="sia-info-strip is-trust" data-reveal>
          <div>
            <span class="sia-strip-label">Servicios del campus</span>
            <h2>Atajos para resolver lo cotidiano</h2>
            <p class="sia-section-brief">SIA reúne servicios que normalmente se consultan por separado.</p>
          </div>
          <div class="sia-strip-actions">
            <button type="button" data-landing-module="biblio">
              <i class="bi bi-book-half"></i>
              <span>Biblioteca</span>
            </button>
            <button type="button" data-landing-module="medi">
              <i class="bi bi-heart-pulse-fill"></i>
              <span>Bienestar</span>
            </button>
            <button type="button" data-landing-info="confianza">
              <i class="bi bi-shield-check"></i>
              <span>Acceso seguro</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  getAppPromoHtml() {
    return `
      <section class="sia-landing-section sia-app-section">
        <div class="sia-app-panel" data-landing-app-card data-reveal>
          <div>
            <span class="sia-strip-label">App móvil</span>
            <h2>Instálala en tu inicio</h2>
            <p>Si usas SIA todos los días, instalar la app te deja entrar más rápido a tus procesos y avisos.</p>
            <small data-role="status"></small>
          </div>

          <div class="sia-app-actions">
            <button id="btn-landing-app-install" type="button" data-role="install">
              <i class="bi bi-download"></i>
              <span>Instalar app</span>
            </button>
            <button id="btn-landing-app-share" type="button" data-role="share">
              <i class="bi bi-share-fill"></i>
              <span>Compartir</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  getFooterHtml() {
    return `
      <footer id="landing-contacto" class="sia-landing-footer">
        <div class="sia-footer-brand">
          <span class="sia-brand-logos">
            <img src="/images/logo-tecnm.png" alt="TecNM" class="sia-brand-logo-tecnm">
            <span class="sia-brand-divider"></span>
            <img src="/images/logo-ites.png" alt="ITES Los Cabos" class="sia-brand-logo-ites">
            <span class="sia-brand-divider"></span>
            <img src="/images/logo-sia.png" alt="SIA" class="sia-brand-logo-sia">
          </span>
          <p>Sistema de Integración Académica del TecNM Campus Los Cabos.</p>
        </div>

        <div class="sia-footer-links">
          <button type="button" data-landing-info="contacto">Soporte</button>
          <a href="https://www.facebook.com/itesloscabos.oficial" target="_blank" rel="noopener">Facebook</a>
          <a href="https://www.instagram.com/ites_loscabos" target="_blank" rel="noopener">Instagram</a>
          <a href="https://www.itesloscabos.edu.mx" target="_blank" rel="noopener">Sitio oficial</a>
        </div>
      </footer>
    `;
  }

  getInfoModalHtml() {
    return `
      <div class="modal fade sia-info-modal" id="landingInfoModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <div class="sia-modal-heading">
                <span class="sia-modal-icon"><i class="bi bi-grid-1x2-fill"></i></span>
                <div>
                  <p>SIA</p>
                  <h2 class="modal-title">Información</h2>
                </div>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
              <button type="button" class="sia-modal-close" data-bs-dismiss="modal">Entendido</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showInfoModal(key) {
    const content = this.getInfoContent()[key];
    this.showLandingModal(content);
  }

  showModuleModal(key) {
    const content = this.getModuleHighlights()[key];
    this.showLandingModal(content);
  }

  showLandingModal(content) {
    const modal = this.querySelector('#landingInfoModal');
    if (!content || !modal) return;

    modal.querySelector('.sia-modal-icon i').className = `bi ${content.icon}`;
    modal.querySelector('.modal-title').textContent = content.title;
    modal.querySelector('.modal-body').innerHTML = `
      <p class="sia-modal-lead">${content.lead}</p>
      <ul class="sia-modal-list">
        ${content.items.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    `;

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
      return;
    }

    window.alert([content.title, content.lead, ...content.items].join('\n\n'));
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
          this.closeNav();
        }
      });
    });
  }

  bindInfoButtons() {
    this.querySelectorAll('[data-landing-info]').forEach((button) => {
      button.addEventListener('click', () => {
        this.showInfoModal(button.dataset.landingInfo);
        this.closeNav();
      });
    });
  }

  bindModuleButtons() {
    this.querySelectorAll('[data-landing-module]').forEach((button) => {
      button.addEventListener('click', () => {
        this.showModuleModal(button.dataset.landingModule);
      });
    });
  }

  bindRouteLinks() {
    this.querySelectorAll('a[href^="#/"]').forEach((link) => {
      link.addEventListener('click', () => this.closeNav());
    });
  }

  closeNav() {
    const collapse = this.querySelector('#landingNavContent');
    if (!collapse || !collapse.classList.contains('show') || typeof bootstrap === 'undefined') return;

    const bsCollapse = bootstrap.Collapse.getInstance(collapse) || bootstrap.Collapse.getOrCreateInstance(collapse);
    bsCollapse.hide();
  }

  setupRevealAnimations() {
    const revealItems = this.querySelectorAll('[data-reveal]');

    if (this.revealObserver) this.revealObserver.disconnect();

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    this.revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          this.revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });

    revealItems.forEach((item) => this.revealObserver.observe(item));
  }

  render() {
    this.className = 'd-none';
    this.innerHTML = `
      ${this.getNavHtml()}
      ${this.getHeroHtml()}
      ${this.getQuickRoutesHtml()}
      ${this.getModulesHtml()}
      ${this.getMinimalInfoHtml()}
      ${this.getCampusServicesHtml()}
      ${this.getAppPromoHtml()}
      ${this.getFooterHtml()}
      ${this.getInfoModalHtml()}
      <button id="btn-login-microsoft" class="d-none"></button>
    `;

    const btnInstallApp = this.querySelector('#btn-landing-app-install');
    const btnShareApp = this.querySelector('#btn-landing-app-share');

    this.bindLoginButtons();
    this.bindLandingAnchors();
    this.bindInfoButtons();
    this.bindModuleButtons();
    this.bindRouteLinks();
    this.setupRevealAnimations();

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
