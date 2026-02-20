
class SiaLandingView extends HTMLElement {
   constructor() {
      super();
   }

   connectedCallback() {
      this.render();
   }

   render() {
      this.className = 'd-none'; // Initially hidden
      this.innerHTML = `

    <!-- NAVBAR FLOTANTE (Píldora con CTA prominente) -->
    <div class="fixed-top d-flex justify-content-center mt-3" style="z-index: 1030;">
      <nav class="navbar navbar-expand-lg landing-nav-pill rounded-pill py-2 px-3 position-relative"
           style="max-width: 95%; width: auto;">

        <div class="container-fluid gap-3">

          <!-- Brand: Logos TecNM (80%) + ITES (20%) -->
          <a class="navbar-brand d-flex align-items-center gap-2 m-0" href="#">
            <div class="landing-brand-logos">
              <img src="/images/tecnm-logo-oscuro.png" alt="TecNM" class="logo-tecnm">
              <div class="brand-divider"></div>
              <img src="/images/logo-ites.png" alt="ITES Los Cabos" class="logo-ites">
            </div>
          </a>

          <!-- Mobile Toggle -->
          <button class="navbar-toggler border-0 p-1 ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#landingNavContent">
            <i class="bi bi-list fs-4 text-white"></i>
          </button>

          <!-- Nav Content -->
          <div class="collapse navbar-collapse landing-nav-collapse" id="landingNavContent">
            <ul class="navbar-nav mx-3 gap-1">
              <li class="nav-item"><a href="#landing-hero" class="nav-link">Inicio</a></li>
              <li class="nav-item"><a href="#landing-modulos" class="nav-link">Módulos</a></li>
              <li class="nav-item"><a href="#landing-stats" class="nav-link">Campus</a></li>
              <li class="nav-item"><a href="#landing-contacto" class="nav-link">Contacto</a></li>
            </ul>

            <!-- CTA: Acceso Institucional (Prominente) -->
            <button id="btn-login-hero-nav" class="btn btn-landing-cta d-flex align-items-center gap-2">
               <i class="bi bi-box-arrow-in-right"></i>
               <span>Acceso Institucional</span>
            </button>
          </div>

        </div>
      </nav>
    </div>

    <!-- ============================== -->
    <!-- HERO SECTION                    -->
    <!-- ============================== -->
    <main id="landing-hero" class="landing-hero w-100 position-relative d-flex align-items-center"
          style="min-height: 92vh; background: linear-gradient(160deg, #0f1114 0%, #111825 40%, #1B396A 100%); overflow: hidden;">

      <!-- Decorative elements -->
      <div class="position-absolute w-100 h-100 top-0 start-0 pe-none" style="overflow: hidden;">
        <!-- Grid pattern overlay -->
        <div class="position-absolute w-100 h-100" style="opacity: 0.03; background-image:
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 60px 60px;"></div>
        <!-- Gradient orb -->
        <div class="position-absolute" style="top: -20%; right: -10%; width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(27,57,106,0.4) 0%, transparent 70%);
          border-radius: 50%; filter: blur(80px);"></div>
        <div class="position-absolute" style="bottom: -30%; left: -10%; width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(128,126,130,0.2) 0%, transparent 70%);
          border-radius: 50%; filter: blur(60px);"></div>
      </div>

      <div class="container position-relative pt-5" style="z-index: 2;">
         <div class="row align-items-center gy-5">

            <!-- Left: Text Content -->
            <div class="col-lg-6 order-2 order-lg-1">

               <!-- Section label -->
               <div class="landing-section-label mb-4 landing-fade-up landing-fade-up-1">
                  Plataforma Oficial ITES Los Cabos
               </div>

               <h1 class="landing-hero-title display-3 fw-bold lh-sm mb-4 landing-fade-up landing-fade-up-2"
                   style="color: #fff !important; letter-spacing: -0.02em;">
                  Tu campus digital,<br>
                  <span style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    es ITES.
                  </span>
               </h1>

               <p class="lead mb-5 landing-fade-up landing-fade-up-3" style="max-width: 480px; color: rgba(255,255,255,0.65); font-size: 1.1rem; line-height: 1.7;">
                  SIA unifica los servicios del <strong style="color: rgba(255,255,255,0.9);">TecNM Campus Los Cabos</strong>. Gestión académica, biblioteca, salud y comunidad en una sola plataforma segura.
               </p>

               <!-- CTA Buttons -->
               <div class="d-flex flex-column flex-sm-row gap-3 mb-5 landing-fade-up landing-fade-up-4">
                  <button id="btn-hero-cta-login" class="btn btn-acceso-institucional d-flex align-items-center justify-content-center gap-2">
                     <i class="bi bi-microsoft"></i>
                     <span>Acceso Institucional</span>
                  </button>
                  <a href="#landing-modulos" class="btn btn-outline-light rounded-pill px-4 py-3 fw-semibold"
                     style="border-color: rgba(255,255,255,0.15); font-size: 0.95rem;">
                     Explorar Módulos <i class="bi bi-arrow-down-short ms-1"></i>
                  </a>
               </div>

               <!-- Logos institucionales -->
               <div class="d-flex align-items-center gap-3 landing-fade-up landing-fade-up-5" style="opacity: 0.5;">
                   <div class="landing-brand-logos">
                      <img src="/images/tecnm-logo-oscuro.png" alt="TecNM" class="logo-tecnm" style="height: 36px;">
                      <div class="brand-divider" style="height: 28px;"></div>
                      <img src="/images/logo-ites.png" alt="ITES Los Cabos" class="logo-ites" style="height: 22px; filter: brightness(0) invert(1); opacity: 0.8;">
                   </div>
                   <span style="color: rgba(255,255,255,0.5); font-size: 0.75rem; font-weight: 600;">Plataforma Institucional</span>
               </div>
            </div>

            <!-- Right: Mockup Card -->
            <div class="col-lg-6 order-1 order-lg-2 text-center position-relative">
               <div class="position-relative d-inline-block landing-float">

                  <!-- Glow behind card -->
                  <div class="position-absolute top-50 start-50 translate-middle rounded-circle"
                       style="width: 280px; height: 280px; background: rgba(27,57,106,0.3); filter: blur(60px);"></div>

                  <div class="card landing-mockup-card rounded-4 overflow-hidden ms-auto me-auto"
                       style="max-width: 400px; transform: rotate(-1deg);">

                     <!-- Window bar -->
                     <div class="p-3 d-flex align-items-center gap-2" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <div class="d-flex gap-1">
                           <div class="rounded-circle" style="width:9px; height:9px; background:#ff5f56;"></div>
                           <div class="rounded-circle" style="width:9px; height:9px; background:#ffbd2e;"></div>
                           <div class="rounded-circle" style="width:9px; height:9px; background:#27c93f;"></div>
                        </div>
                        <span style="font-size: 0.7rem; color: rgba(255,255,255,0.3); font-family: 'Noto Sans', sans-serif;">sia.loscabos.tecnm.mx</span>
                     </div>

                     <div class="p-4 text-start">
                        <!-- User greeting -->
                        <div class="d-flex justify-content-between mb-4">
                           <div>
                              <h5 class="fw-bold mb-1" style="color: #fff; font-size: 1.1rem;">Hola, Estudiante</h5>
                              <small style="color: rgba(255,255,255,0.45); font-size: 0.8rem;">Ing. en Sistemas &bull; 4to Semestre</small>
                           </div>
                           <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                                style="width: 52px; height: 52px; background: linear-gradient(135deg, #1B396A, #2a5298); color: #fff; font-size: 1.1rem;">E</div>
                        </div>

                        <!-- Quick modules -->
                        <div class="row g-2 mb-3">
                           <div class="col-4">
                             <div class="p-2 rounded-3 text-center" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
                               <i class="bi bi-mortarboard" style="color: #4facfe; font-size: 1.25rem;"></i>
                               <div style="font-size: 0.65rem; color: rgba(255,255,255,0.5); margin-top: 2px;">Aula</div>
                             </div>
                           </div>
                           <div class="col-4">
                             <div class="p-2 rounded-3 text-center" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
                               <i class="bi bi-heart-pulse" style="color: #ff6b6b; font-size: 1.25rem;"></i>
                               <div style="font-size: 0.65rem; color: rgba(255,255,255,0.5); margin-top: 2px;">Salud</div>
                             </div>
                           </div>
                           <div class="col-4">
                             <div class="p-2 rounded-3 text-center" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
                               <i class="bi bi-book-half" style="color: #ffd700; font-size: 1.25rem;"></i>
                               <div style="font-size: 0.65rem; color: rgba(255,255,255,0.5); margin-top: 2px;">Biblio</div>
                             </div>
                           </div>
                        </div>

                        <!-- ID Card preview -->
                        <div class="rounded-3 p-3 d-flex align-items-center gap-3"
                             style="background: rgba(27,57,106,0.15); border: 1px solid rgba(27,57,106,0.2);">
                           <i class="bi bi-qr-code" style="font-size: 1.75rem; color: rgba(255,255,255,0.7);"></i>
                           <div>
                              <div class="fw-bold" style="color: #fff; font-size: 0.85rem;">Credencial Digital</div>
                              <div style="color: rgba(255,255,255,0.4); font-size: 0.7rem;">Vigente 2026</div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      </div>
    </main>

    <!-- ============================== -->
    <!-- AVISOS / NOVEDADES (Demo)       -->
    <!-- ============================== -->
    <section id="landing-avisos" class="py-5" style="background: #0f1114 !important;">
      <div class="container py-4">

        <div class="d-flex align-items-center justify-content-between mb-4">
          <div>
            <div class="landing-section-label mb-2">Novedades</div>
            <h2 class="fw-bold mb-0" style="font-size: 1.75rem;">Avisos Institucionales</h2>
          </div>
          <a href="#" class="btn btn-sm btn-outline-light rounded-pill px-3 d-none d-md-inline-flex align-items-center gap-1"
             style="border-color: rgba(255,255,255,0.12); font-size: 0.8rem; color: rgba(255,255,255,0.5);">
            Ver todos <i class="bi bi-arrow-right"></i>
          </a>
        </div>

        <div class="row g-3">

          <!-- Aviso 1: Destacado (Grande) -->
          <div class="col-lg-6">
            <div class="aviso-card h-100 d-flex flex-column p-4">
              <div class="d-flex align-items-center gap-2 mb-3">
                <span class="aviso-badge" style="background: rgba(27,57,106,0.3); color: #4facfe;">Acad&eacute;mico</span>
                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.35);">15 Ene 2026</span>
              </div>
              <h4 class="fw-bold mb-2" style="font-size: 1.25rem; color: #fff;">Inicio de Ciclo Escolar 2026-A</h4>
              <p class="mb-3 flex-grow-1" style="color: rgba(255,255,255,0.5); font-size: 0.9rem; line-height: 1.6;">
                Bienvenida oficial al nuevo semestre. Consulta tus horarios, aulas asignadas y calendario de actividades en tu m&oacute;dulo de Aula Virtual.
              </p>
              <div class="d-flex align-items-center gap-2" style="color: rgba(255,255,255,0.3); font-size: 0.8rem;">
                <i class="bi bi-person-circle"></i>
                <span>Direcci&oacute;n Acad&eacute;mica</span>
              </div>
            </div>
          </div>

          <!-- Aviso 2 + 3 (Compactos) -->
          <div class="col-lg-6">
            <div class="d-flex flex-column gap-3 h-100">

              <div class="aviso-card flex-grow-1 p-4">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="aviso-badge" style="background: rgba(220,38,38,0.2); color: #ff6b6b;">Salud</span>
                  <span style="font-size: 0.75rem; color: rgba(255,255,255,0.35);">20 Ene 2026</span>
                </div>
                <h5 class="fw-bold mb-1" style="font-size: 1.05rem; color: #fff;">Jornada de Vacunaci&oacute;n IMSS</h5>
                <p class="mb-0" style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">
                  Servicios m&eacute;dicos disponibles en campus. Agenda tu cita desde el m&oacute;dulo de Salud Integral.
                </p>
              </div>

              <div class="aviso-card flex-grow-1 p-4">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <span class="aviso-badge" style="background: rgba(16,185,129,0.2); color: #34d399;">Sistema</span>
                  <span style="font-size: 0.75rem; color: rgba(255,255,255,0.35);">10 Ene 2026</span>
                </div>
                <h5 class="fw-bold mb-1" style="font-size: 1.05rem; color: #fff;">Nuevos M&oacute;dulos Disponibles</h5>
                <p class="mb-0" style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">
                  Foro Estudiantil, Encuestas y Reportes Acad&eacute;micos ahora integrados en SIA.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- MÓDULOS DEL SISTEMA             -->
    <!-- ============================== -->
    <section id="landing-modulos" class="landing-section-alt py-5">
      <div class="container py-4">

        <div class="text-center mb-5">
          <div class="landing-section-label justify-content-center mb-3">Ecosistema Integral</div>
          <h2 class="fw-bold mb-3" style="font-size: 2.25rem;">Todo lo que necesitas,<br>en un solo lugar.</h2>
          <p class="mx-auto" style="max-width: 520px; color: rgba(255,255,255,0.45); font-size: 0.95rem;">
            Accede a todos los servicios del TecNM Campus Los Cabos desde una plataforma unificada, segura y moderna.
          </p>
        </div>

        <div class="landing-modules-grid">

          <!-- Aula Virtual -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(27,57,106,0.2); color: #4facfe;">
              <i class="bi bi-mortarboard-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Aula Virtual</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Cursos, capacitaciones y gesti&oacute;n curricular</p>
          </div>

          <!-- Biblioteca -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(217,119,6,0.2); color: #fbbf24;">
              <i class="bi bi-book-half"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Biblioteca</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Acervo digital y recursos acad&eacute;micos</p>
          </div>

          <!-- Salud Integral -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(220,38,38,0.2); color: #f87171;">
              <i class="bi bi-heart-pulse-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Salud Integral</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">IMSS, citas m&eacute;dicas y psicol&oacute;gicas</p>
          </div>

          <!-- Foro -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(8,145,178,0.2); color: #22d3ee;">
              <i class="bi bi-people-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Foro Estudiantil</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Comunidad, actividades y eventos</p>
          </div>

          <!-- Lactario -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(236,72,153,0.2); color: #f472b6;">
              <i class="bi bi-emoji-smile-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Lactario</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Servicio de apoyo materno</p>
          </div>

          <!-- Encuestas -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(139,92,246,0.2); color: #a78bfa;">
              <i class="bi bi-clipboard-data-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Encuestas</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Evaluaciones y retroalimentaci&oacute;n</p>
          </div>

          <!-- Quejas y Sugerencias -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(245,158,11,0.2); color: #fbbf24;">
              <i class="bi bi-chat-left-text-fill"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Quejas</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Buz&oacute;n institucional de sugerencias</p>
          </div>

          <!-- Reportes -->
          <div class="landing-card rounded-4 p-4 text-center" style="cursor: pointer;">
            <div class="landing-module-icon mx-auto mb-3" style="background: rgba(16,185,129,0.2); color: #34d399;">
              <i class="bi bi-file-earmark-bar-graph"></i>
            </div>
            <h6 class="fw-bold mb-1" style="font-size: 0.95rem;">Reportes</h6>
            <p class="mb-0" style="font-size: 0.78rem; color: rgba(255,255,255,0.4);">Documentos y reportes acad&eacute;micos</p>
          </div>

        </div>
      </div>
    </section>

    <!-- ============================== -->
    <!-- ESTADÍSTICAS DEL CAMPUS         -->
    <!-- ============================== -->
    <section id="landing-stats" class="py-5">
      <div class="container py-4">

        <div class="text-center mb-5">
          <div class="landing-section-label justify-content-center mb-3">ITES Los Cabos en N&uacute;meros</div>
        </div>

        <div class="row g-4 align-items-center justify-content-center text-center">
          <div class="col-6 col-md-3">
            <div class="stat-number mb-2">100+</div>
            <p class="mb-0" style="color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Estudiantes Activos</p>
          </div>
          <div class="d-none d-md-flex col-auto"><div class="stat-divider"></div></div>
          <div class="col-6 col-md-3">
            <div class="stat-number mb-2">9k</div>
            <p class="mb-0" style="color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Libros Digitales</p>
          </div>
          <div class="d-none d-md-flex col-auto"><div class="stat-divider"></div></div>
          <div class="col-6 col-md-3">
            <div class="stat-number mb-2">24/7</div>
            <p class="mb-0" style="color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Gesti&oacute;n Continua</p>
          </div>
          <div class="d-none d-md-flex col-auto"><div class="stat-divider"></div></div>
          <div class="col-6 col-md-2">
            <div class="stat-number mb-2">100%</div>
            <p class="mb-0" style="color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Seguro</p>
          </div>
        </div>

      </div>
    </section>

    <!-- ============================== -->
    <!-- FOOTER INSTITUCIONAL            -->
    <!-- ============================== -->
    <footer id="landing-contacto" class="pt-5 pb-4" style="border-top: 1px solid rgba(255,255,255,0.06) !important;">
      <div class="container">
        <div class="row g-4 justify-content-between">

          <!-- Brand + Description -->
          <div class="col-lg-4">
            <div class="landing-brand-logos mb-3">
              <img src="/images/tecnm-logo-oscuro.png" alt="TecNM" class="logo-tecnm" style="height: 40px;">
              <div class="brand-divider" style="height: 32px;"></div>
              <img src="/images/logo-ites.png" alt="ITES Los Cabos" class="logo-ites">
            </div>
            <p style="color: rgba(255,255,255,0.4); font-size: 0.85rem; line-height: 1.7; max-width: 300px;">
              Sistema de Integraci&oacute;n Acad&eacute;mico. Plataforma oficial del Tecnol&oacute;gico Nacional de M&eacute;xico, Campus Los Cabos.
            </p>
            <div class="d-flex gap-3 mt-3">
              <a href="https://www.facebook.com/itesloscabos.oficial" target="_blank" rel="noopener"
                 style="color: rgba(255,255,255,0.35); font-size: 1.2rem; transition: color 0.2s;"
                 onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">
                <i class="bi bi-facebook"></i>
              </a>
              <a href="https://www.instagram.com/ites_loscabos" target="_blank" rel="noopener"
                 style="color: rgba(255,255,255,0.35); font-size: 1.2rem; transition: color 0.2s;"
                 onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">
                <i class="bi bi-instagram"></i>
              </a>
            </div>
          </div>

          <!-- Quick Links -->
          <div class="col-6 col-lg-2">
            <h6 class="fw-bold mb-3" style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">Plataforma</h6>
            <ul class="list-unstyled" style="font-size: 0.85rem;">
              <li class="mb-2"><a href="#landing-hero" style="color: rgba(255,255,255,0.4);">Inicio</a></li>
              <li class="mb-2"><a href="#landing-modulos" style="color: rgba(255,255,255,0.4);">M&oacute;dulos</a></li>
              <li class="mb-2"><a href="#landing-stats" style="color: rgba(255,255,255,0.4);">Campus</a></li>
            </ul>
          </div>

          <!-- Contact -->
          <div class="col-6 col-lg-3">
            <h6 class="fw-bold mb-3" style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">Soporte</h6>
            <ul class="list-unstyled" style="font-size: 0.85rem;">
              <li class="mb-2" style="color: rgba(255,255,255,0.4);"><i class="bi bi-telephone me-2"></i>+52 (624) 142 5939</li>
              <li class="mb-2"><a href="mailto:soporte.sia@loscabos.tecnm.mx" style="color: rgba(255,255,255,0.4);"><i class="bi bi-envelope me-2"></i>soporte.sia@loscabos.tecnm.mx</a></li>
              <li class="mb-2" style="color: rgba(255,255,255,0.4);"><i class="bi bi-geo-alt me-2"></i>C. Gandhi, Guaymitas, San Jos&eacute; del Cabo, B.C.S.</li>
            </ul>
          </div>

          <!-- Institutional Badge -->
          <div class="col-lg-3">
            <div class="p-3 rounded-3 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
              <div class="d-flex justify-content-center align-items-center gap-2 mb-2">
                <i class="bi bi-shield-check" style="font-size: 1.5rem; color: #34d399;"></i>
                <div style="font-size: 0.8rem; font-weight: 700; line-height: 1.2; text-align: start; color: rgba(255,255,255,0.7);">Plataforma<br>Institucional</div>
              </div>
              <p class="mb-0" style="font-size: 0.7rem; color: rgba(255,255,255,0.3);">
                Desarrollado por Abraham Ríos, Ingeniero en Sistemas Computacionales.
              </p>
            </div>
          </div>
        </div>

        <hr style="border-color: rgba(255,255,255,0.06); margin: 2rem 0;">

        <div class="row align-items-center">
          <div class="col-md-6 text-center text-md-start" style="font-size: 0.78rem; color: rgba(255,255,255,0.3);">
            &copy; 2026 Sistema de Integraci&oacute;n Acad&eacute;mico v2.5
          </div>
          <div class="col-md-6 text-center text-md-end" style="font-size: 0.78rem;">
            <a href="https://www.itesloscabos.edu.mx" target="_blank" rel="noopener" style="color: rgba(255,255,255,0.3);">Sitio Oficial ITES</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- HIDDEN ANCHOR FOR APP.JS AUTH LOGIC -->
    <button id="btn-login-microsoft" class="d-none"></button>
        `;

      // Bind login events
      setTimeout(() => {
         const btnLoginNav = this.querySelector('#btn-login-hero-nav');
         const btnLoginHero = this.querySelector('#btn-hero-cta-login');

         const triggerLogin = () => {
            const btnMS = document.getElementById('btn-login-microsoft');
            if (btnMS) btnMS.click();
            else {
               console.warn("Login button ref not found");
            }
         };

         if (btnLoginNav) btnLoginNav.onclick = triggerLogin;
         if (btnLoginHero) btnLoginHero.onclick = triggerLogin;

         // Smooth scroll for anchor links
         this.querySelectorAll('a[href^="#landing-"]').forEach(link => {
            link.addEventListener('click', (e) => {
               e.preventDefault();
               const target = document.querySelector(link.getAttribute('href'));
               if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  // Close mobile nav if open
                  const collapse = this.querySelector('#landingNavContent');
                  if (collapse && collapse.classList.contains('show')) {
                     const bsCollapse = bootstrap.Collapse.getInstance(collapse);
                     if (bsCollapse) bsCollapse.hide();
                  }
               }
            });
         });
      }, 100);
   }
}

if (!customElements.get('sia-landing-view')) {
   customElements.define('sia-landing-view', SiaLandingView);
}
