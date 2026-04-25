// public/components/vocacional-landing.js
// Dependencias cargadas globalmente en index.html (VocacionalService, VOCACIONAL_CATALOGS)

const ITES_CAREERS_INFO = [
    {
        id: 'ISC',
        title: 'Conecta el Futuro: Ingeniería en Sistemas Computacionales',
        desc: 'Domina el desarrollo de software, la arquitectura de redes y las nuevas tecnologías. Aquí aprenderás a crear soluciones digitales que transforman industrias completas.',
        tip: '"No te quedes solo con la teoría; involúcrate en proyectos reales como el SIA desde los primeros semestres. ¡La práctica hace al maestro!"',
        icon: 'bi-laptop text-primary',
        bg: 'bg-primary bg-opacity-10'
    },
    {
        id: 'ADM',
        title: 'Liderazgo que Transforma: Ingeniería en Administración',
        desc: 'Prepárate para dirigir organizaciones con eficiencia y visión estratégica. Aprende a gestionar recursos humanos, financieros y tecnológicos para liderar cualquier empresa al éxito.',
        tip: '"El networking es clave. Conecta con tus profesores y participa en foros de emprendimiento; esas relaciones valen tanto como tus calificaciones."',
        icon: 'bi-briefcase text-success',
        bg: 'bg-success bg-opacity-10'
    },
    {
        id: 'ELEC',
        title: 'Potencia tu Entorno: Ingeniería Electromecánica',
        desc: 'Combina los principios de la mecánica, electricidad y electrónica para diseñar, mantener y optimizar sistemas industriales fundamentales para el mundo moderno.',
        tip: '"Aprovecha los talleres al máximo. Ensúciate las manos, la mejor forma de entender un circuito o motor es armándolo tú mismo."',
        icon: 'bi-lightning-charge text-warning',
        bg: 'bg-warning bg-opacity-10'
    },
    {
        id: 'CIVIL',
        title: 'Construye el Mañana: Ingeniería Civil',
        desc: 'Diseña y ejecuta grandes proyectos de infraestructura. Aprenderás sobre estructuras, materiales e hidráulica para edificar el desarrollo de tu ciudad.',
        tip: '"El dibujo técnico estructurado y las matemáticas son tus aliados. Visualiza los proyectos terminados incluso antes de empezar los planos."',
        icon: 'bi-cone-striped text-secondary',
        bg: 'bg-secondary bg-opacity-10'
    },
    {
        id: 'ARQ',
        title: 'Diseña Espacios Únicos: Arquitectura',
        desc: 'Transforma ideas en espacios funcionales y estéticos. Desarrolla tu creatividad aprendiendo sobre urbanismo, diseño sostenible y técnicas de construcción.',
        tip: '"Construye tu portafolio desde el primer día y mantente siempre inspirado observando cómo la sociedad interactúa con su entorno."',
        icon: 'bi-rulers text-danger',
        bg: 'bg-danger bg-opacity-10'
    },
    {
        id: 'CP',
        title: 'Domina los Negocios: Contador Público',
        desc: 'Conviértete en un experto fiscal y financiero esencial para cualquier empresa. Aprenderás a analizar datos para tomar decisiones estratégicas e impulsar el éxito económico.',
        tip: '"Mantente actualizado con las reformas fiscales. Un buen contador nunca deja de estudiar el entorno regulatorio."',
        icon: 'bi-calculator text-info',
        bg: 'bg-info bg-opacity-10'
    },
    {
        id: 'TUR',
        title: 'Explora el Mundo: Licenciatura en Turismo',
        desc: 'Desarrolla experiencias inolvidables gestionando destinos turísticos y empresas hoteleras. Aprende relaciones públicas, sustentabilidad y alta dirección.',
        tip: '"Aprende todos los idiomas posibles y busca realizar prácticas en hoteles de lujo de Los Cabos para destacar desde egresado."',
        icon: 'bi-airplane text-primary',
        bg: 'bg-primary bg-opacity-10'
    },
    {
        id: 'GASTRO',
        title: 'Crea Arte Culinario: Gastronomía',
        desc: 'Perfecciona técnicas culinarias internacionales mientras aprendes a gestionar empresas de alimentos y bebidas con los más altos estándares.',
        tip: '"La limpieza y la disciplina en la cocina son tan importantes como el sazón. ¡Ponle pasión y rigor a cada platillo!"',
        icon: 'bi-cup-hot text-danger',
        bg: 'bg-danger bg-opacity-10'
    }
];

class VocacionalLanding extends HTMLElement {
    constructor() {
        super();
        this.selectedHighSchool = '';
    }

    connectedCallback() {
        console.log('[VocacionalLanding] connectedCallback - esperando VocacionalService...');
        if (typeof VocacionalService !== 'undefined' && VocacionalService.VOCACIONAL_CATALOGS) {
            console.log('[VocacionalLanding] VocacionalService ya disponible, renderizando.');
            this.render();
            this.setupEventListeners();
        } else {
            const MAX_TRIES = 50; // 5 segundos
            let tries = 0;
            const interval = setInterval(() => {
                tries++;
                if (typeof VocacionalService !== 'undefined' && VocacionalService.VOCACIONAL_CATALOGS) {
                    clearInterval(interval);
                    this.render();
                    this.setupEventListeners();
                } else if (tries >= MAX_TRIES) {
                    clearInterval(interval);
                    this.innerHTML = `<div class="alert alert-danger m-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>Error al cargar el servicio vocacional. Recarga la página.</div>`;
                }
            }, 100);
        }
    }

    refresh() {
        if (typeof VocacionalService !== 'undefined' && VocacionalService.VOCACIONAL_CATALOGS) {
            if (!this.querySelector('#vocacional-register-form')) {
                this.render();
                this.setupEventListeners();
            }
        } else {
            this.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="min-height:50vh;"><div class="spinner-border text-primary"></div></div>`;
            const interval = setInterval(() => {
                if (typeof VocacionalService !== 'undefined' && VocacionalService.VOCACIONAL_CATALOGS) {
                    clearInterval(interval);
                    this.render();
                    this.setupEventListeners();
                }
            }, 100);
        }
    }

    render() {
        this.innerHTML = `
            <div class="vocacional-landing-wrapper">
                
                <!-- HERO SECTION -->
                <section class="hero-section text-center py-5 d-flex flex-column justify-content-center align-items-center px-3 position-relative overflow-hidden">
                    <div class="bg-shape bg-shape-1 position-absolute rounded-circle opacity-25" style="width: 300px; height: 300px; background: linear-gradient(135deg, #0d6efd, #6610f2); top: -100px; left: -100px; filter: blur(50px);"></div>
                    <div class="bg-shape bg-shape-2 position-absolute rounded-circle opacity-25" style="width: 250px; height: 250px; background: linear-gradient(135deg, #198754, #20c997); bottom: -50px; right: -50px; filter: blur(40px);"></div>
                    
                    <div class="position-relative z-1 mb-4 animate-fade-up">
                        <img src="/images/logo-ites.png" alt="TecNM Los Cabos" style="height: 80px;" class="mb-4 shadow-sm rounded-4 p-2 bg-white">
                        <br>
                        <span class="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold text-uppercase tracing-wider">
                            <i class="bi bi-stars me-1"></i> Descubre tu Vocación
                        </span>
                        <h1 class="display-4 fw-bolder mt-3 mb-3 text-dark">
                            Elige con <span class="text-primary position-relative">confianza<svg class="position-absolute bottom-0 start-0 w-100 mb-n1 text-primary-opacity" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0,15 Q50,0 100,15 L100,20 L0,20 Z" fill="currentColor" opacity="0.2"/></svg></span><br>tu futuro profesional
                        </h1>
                        <p class="lead text-muted mx-auto mb-4" style="max-width: 650px; font-weight: 500;">
                            Responde nuestro test especializado para alinear tus habilidades, conocimientos técnicos y aptitudes con la carrera perfecta para ti en el ITES Los Cabos.
                        </p>
                        
                        <div class="d-flex flex-wrap justify-content-center gap-3">
                            <a href="#register-section" class="btn btn-primary btn-lg rounded-pill px-5 py-3 fw-bold shadow hover-elevate">
                                Empezar Test Ahora <i class="bi bi-arrow-right ms-2"></i>
                            </a>
                            <button id="btn-recovery-session" class="btn btn-outline-secondary btn-lg rounded-pill px-4 py-3 fw-bold bg-white shadow-sm hover-elevate">
                                <i class="bi bi-arrow-counterclockwise me-2"></i>Recuperar Sesión
                            </button>
                        </div>
                    </div>
                </section>

                <!-- CARRERAS SECTION -->
                <section class="careers-section py-5  position-relative">
                    <div class="container">
                        <div class="text-center mb-5 animate-fade-up">
                            <h2 class="fw-bold mb-2">Conoce Nuestras Carreras</h2>
                            <p class="text-muted">Explora las 8 ingenierías y licenciaturas líderes en la región de Los Cabos.</p>
                        </div>
                        
                        <!-- Indicador para móviles -->
                        <div class="text-center mb-4 d-block d-md-none animate-fade-up">
                            <span class="small text-primary fw-bold px-3 py-2 bg-primary bg-opacity-10 rounded-pill">
                                <i class="bi bi-arrows-expand me-1"></i> Desliza horizontalmente para ver más
                            </span>
                        </div>
                        
                        <!-- Carrusel Nativo de Tarjetas -->
                        <div class="position-relative">
                            <!-- Sombra indicadora en los bordes para sugerir scroll -->
                            <div class="position-absolute top-0 bottom-0 start-0 z-1 pointer-events-none d-none d-md-block" style="width: 40px; background: linear-gradient(to right, #f8f9fa, transparent); margin-bottom: 1.5rem;"></div>
                            <div class="position-absolute top-0 bottom-0 end-0 z-1 pointer-events-none d-none d-md-block" style="width: 40px; background: linear-gradient(to left, #f8f9fa, transparent); margin-bottom: 1.5rem;"></div>
                            
                            <div id="careers-carousel" class="d-flex gap-4 overflow-auto pb-4 px-3 snap-x hide-scrollbar" style="scroll-snap-type: x mandatory; scroll-behavior: smooth;">
                                ${ITES_CAREERS_INFO.map(career => `
                                    <div class="card border-0 shadow rounded-4 flex-shrink-0 hover-elevate career-card" style="width: 320px; scroll-snap-align: center;">
                                    <div class="card-body p-4 d-flex flex-column">
                                        <div class="icon-wrapper mb-3 ${career.bg} rounded-circle d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                                            <i class="bi ${career.icon} fs-3"></i>
                                        </div>
                                        <h5 class="fw-bolder text-dark mb-2" style="font-size: 1.15rem;">${career.title}</h5>
                                        <p class="text-muted small mb-4" style="line-height: 1.6;">${career.desc}</p>
                                        
                                        <div class="mt-auto  rounded-3 p-3 position-relative border">
                                            <i class="bi bi-chat-quote-fill position-absolute text-primary opacity-25" style="top: -10px; right: 10px; font-size: 2rem;"></i>
                                            <span class="badge bg-dark mb-2">💡 El Tip</span>
                                            <p class="mb-0 small fst-italic fw-medium text-dark">${career.tip}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            </div>
                        </div>
                    </div>
                </section>

                <!-- SECCIÓN REGISTRO -->
                <section id="register-section" class="py-5 position-relative">
                    <div class="container py-4" style="max-width: 800px;">
                        <div class="card border-0 shadow-lg rounded-4 overflow-hidden">
                            <div class="row g-0">
                                <div class="col-md-5 bg-primary text-white p-5 d-flex flex-column justify-content-center position-relative overflow-hidden">
                                     <div class="position-absolute rounded-circle opacity-50" style="width: 200px; height: 200px; background: rgba(255,255,255,0.1); top: -50px; left: -50px;"></div>
                                     <div class="position-absolute rounded-circle opacity-50" style="width: 150px; height: 150px; background: rgba(255,255,255,0.1); bottom: -30px; right: -30px;"></div>
                                     <div class="position-relative z-1">
                                         <h3 class="fw-bold mb-3">Estás a un paso</h3>
                                         <p class="opacity-75 mb-4">Ingresa tus datos para generar tu perfil vocacional y comenzar el test. Si ya lo habías iniciado, restauraremos tu progreso automáticamente según tu teléfono o correo.</p>
                                         <div class="d-flex align-items-center mb-3">
                                            <i class="bi bi-check-circle-fill me-2 text-success"></i> <span class="small fw-medium">Test de ~15 minutos</span>
                                         </div>
                                         <div class="d-flex align-items-center mb-3">
                                            <i class="bi bi-check-circle-fill me-2 text-success"></i> <span class="small fw-medium">Análisis de perfil de ingreso</span>
                                         </div>
                                         <div class="d-flex align-items-center">
                                            <i class="bi bi-check-circle-fill me-2 text-success"></i> <span class="small fw-medium">Resultados instantáneos</span>
                                         </div>
                                     </div>
                                </div>
                                <div class="col-md-7 p-4 p-md-5 bg-white">
                                    <h4 class="fw-bold mb-4 border-bottom pb-3 text-dark"><i class="bi bi-person-badge me-2 text-primary"></i>Datos de Registro</h4>
                                    
                                    <form id="vocacional-register-form" onsubmit="event.preventDefault();">
                                        <div class="row g-3">
                                            <!-- Nombre -->
                                            <div class="col-md-12">
                                                <label class="form-label fw-bold small text-muted">Nombre Completo <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control  border-0 py-2 py-md-3" id="v-name" placeholder="Ej. Juan Pérez García" required>
                                            </div>
                                            
                                            <!-- Teléfono & Email -->
                                            <div class="col-md-6">
                                                <label class="form-label fw-bold small text-muted">Teléfono Móvil <span class="text-danger">*</span></label>
                                                <input type="tel" class="form-control  border-0 py-2 py-md-3" id="v-phone" placeholder="10 dígitos" minlength="10" maxlength="10" pattern="[0-9]{10}" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-bold small text-muted">Correo (Opcional)</label>
                                                <input type="email" class="form-control  border-0 py-2 py-md-3" id="v-email" placeholder="correo@ejemplo.com">
                                            </div>

                                            <!-- Preparatoria -->
                                            <div class="col-md-12 mt-3">
                                                 <label class="form-label fw-bold small text-muted">¿De qué preparatoria provienes? <span class="text-danger">*</span></label>
                                                 <select class="form-select  border-0 py-2 py-md-3" id="v-highschool" required>
                                                    <option value="" disabled selected>-- Selecciona tu preparatoria --</option>
                                                    <optgroup label="Bachilleratos Públicos">
                                                        ${VocacionalService.VOCACIONAL_CATALOGS.highSchools.filter(h => h.type === 'public').map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                                                    </optgroup>
                                                    <optgroup label="Bachilleratos Privados">
                                                        ${VocacionalService.VOCACIONAL_CATALOGS.highSchools.filter(h => h.type === 'private').map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                                                    </optgroup>
                                                    <option value="otro">Otra preparatoria / Foráneo...</option>
                                                 </select>
                                            </div>
                                            
                                            <!-- Otra Preparatoria Manual -->
                                            <div class="col-md-12 mt-3 d-none animate-fade-in" id="v-other-hs-container">
                                                <label class="form-label fw-bold small text-muted">Escribe el nombre de tu preparatoria <span class="text-danger">*</span></label>
                                                <input type="text" class="form-control  border-0 py-2 py-md-3" id="v-highschool-other" placeholder="Nombre y ciudad de la prepa">
                                            </div>

                                            <!-- Especialidad Técnica (Dinámico) -->
                                            <div class="col-md-12 mt-3 d-none animate-fade-in" id="v-tech-career-container">
                                                <label class="form-label fw-bold small text-primary">
                                                    <i class="bi bi-tools me-1"></i> Especialidad técnica (Opcional)
                                                </label>
                                                <select class="form-select bg-primary bg-opacity-10 border-0 py-2 py-md-3" id="v-tech-career">
                                                    <!-- Llenado automático -->
                                                </select>
                                            </div>
                                        </div>

                                        <div class="d-grid mt-4 pt-2">
                                            <button type="submit" class="btn btn-primary btn-lg rounded-pill fw-bold py-3 shadow-sm hover-elevate" id="v-submit-btn">
                                                Comenzar Test <i class="bi bi-arrow-right ms-2"></i>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- RECUPERACIÓN MODAL (Oculto) -->
                <div class="modal fade" id="recoveryModal" tabindex="-1" aria-hidden="true">
                  <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                      <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title fw-bold"><i class="bi bi-arrow-counterclockwise text-primary me-2"></i>Recuperar tu Test</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                      </div>
                      <div class="modal-body p-4">
                        <p class="text-muted small mb-4">Si cerraste tu navegador y quieres retomar el test donde te quedaste, ingresa tu teléfono o correo registrado.</p>
                        <form id="recovery-form" onsubmit="event.preventDefault();">
                            <div class="mb-3">
                                <label class="form-label fw-bold small">Teléfono (10 dígitos)</label>
                                <input type="tel" class="form-control  border-0 py-2" id="recover-phone" placeholder="5512345678" pattern="[0-9]{10}">
                            </div>
                            <div class="text-center mb-3 fw-bold text-muted small">O</div>
                            <div class="mb-4">
                                <label class="form-label fw-bold small">Correo Institucional/Personal</label>
                                <input type="email" class="form-control  border-0 py-2" id="recover-email" placeholder="correo@ejemplo.com">
                            </div>
                            <button type="submit" class="btn btn-primary w-100 rounded-pill fw-bold py-2 shadow-sm" id="btn-submit-recovery">Buscar Test</button>
                        </form>
                        <div id="recovery-error" class="text-danger small fw-bold mt-3 text-center d-none">No se encontró ningún test con esos datos.</div>
                      </div>
                    </div>
                  </div>
                </div>

            </div>

            <style>
                .hover-elevate { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
                .hover-elevate:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important; z-index: 10; }
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .career-card { border: 1px solid rgba(0,0,0,0.05) !important; }
            </style>
        `;
    }

    setupEventListeners() {
        // Elements
        const hsSelect = this.querySelector('#v-highschool');
        const otherHsContainer = this.querySelector('#v-other-hs-container');
        const otherHsInput = this.querySelector('#v-highschool-other');

        const techContainer = this.querySelector('#v-tech-career-container');
        const techSelect = this.querySelector('#v-tech-career');
        const form = this.querySelector('#vocacional-register-form');
        const btn = this.querySelector('#v-submit-btn');

        // Smooth Scrolling logic for Hero CTA
        const ctaBtn = this.querySelector('a[href="#register-section"]');
        ctaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.querySelector('#register-section').scrollIntoView({ behavior: 'smooth' });
        });

        // High School Logic
        hsSelect.addEventListener('change', (e) => {
            const hsId = e.target.value;
            this.selectedHighSchool = hsId;

            // Handle "Otro"
            if (hsId === 'otro') {
                otherHsContainer.classList.remove('d-none');
                otherHsInput.required = true;
                techContainer.classList.add('d-none');
                techSelect.innerHTML = '';
                techSelect.value = '';
                return;
            } else {
                otherHsContainer.classList.add('d-none');
                otherHsInput.required = false;
                otherHsInput.value = '';
            }

            const schoolData = VocacionalService.VOCACIONAL_CATALOGS.highSchools.find(h => h.id === hsId);
            if (schoolData && schoolData.technicalCareers && schoolData.technicalCareers.length > 0) {
                let optionsHtml = '<option value="" selected>No cursé especialidad técnica</option>';
                schoolData.technicalCareers.forEach(career => {
                    optionsHtml += `<option value="${career}">${career}</option>`;
                });
                techSelect.innerHTML = optionsHtml;
                techContainer.classList.remove('d-none');
            } else {
                techSelect.innerHTML = '';
                techSelect.value = '';
                techContainer.classList.add('d-none');
            }
        });

        // Main Registration Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Protegiendo datos...';

            // Determine School string
            let finalHighSchool = '';
            if (this.selectedHighSchool === 'otro') {
                finalHighSchool = "Otra: " + otherHsInput.value.trim();
            } else {
                const schoolData = VocacionalService.VOCACIONAL_CATALOGS.highSchools.find(h => h.id === this.selectedHighSchool);
                finalHighSchool = schoolData ? schoolData.name : 'Otra';
            }

            const payload = {
                name: this.querySelector('#v-name').value.trim(),
                phone: this.querySelector('#v-phone').value.trim(),
                email: this.querySelector('#v-email').value.trim(),
                highSchool: finalHighSchool,
                technicalCareer: techSelect.value || null
            };

            try {
                // Registrar o recuperar en Firebase (la validación del duplicado se hace con phone + email en auth/service)
                const aspiranteId = await VocacionalService.registerAspirante(payload);

                // Guardar ID en LocalStorage para esta sesión
                localStorage.setItem('sia_vocacional_id', aspiranteId);

                // Navegar a la página del test activo
                window.location.hash = '#/vocacional/test';

            } catch (error) {
                alert("Ocurrió un error de conexión. Intenta de nuevo.");
                btn.disabled = false;
                btn.innerHTML = 'Comenzar Test <i class="bi bi-arrow-right ms-2"></i>';
            }
        });

        // RECOVERY LOGIC
        const btnRecoveryOpen = this.querySelector('#btn-recovery-session');
        const recoveryModalEl = this.querySelector('#recoveryModal');
        let recoveryModal = null;
        if (typeof bootstrap !== 'undefined') {
            recoveryModal = new bootstrap.Modal(recoveryModalEl);
        }

        btnRecoveryOpen.addEventListener('click', () => {
            if (recoveryModal) recoveryModal.show();
        });

        const recoveryForm = this.querySelector('#recovery-form');
        const recoveryBtn = this.querySelector('#btn-submit-recovery');
        const recoveryErr = this.querySelector('#recovery-error');

        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = this.querySelector('#recover-phone').value.trim();
            const email = this.querySelector('#recover-email').value.trim();

            if (!phone && !email) {
                recoveryErr.textContent = "Por favor ingresa al menos un método de contacto.";
                recoveryErr.classList.remove('d-none');
                return;
            }

            recoveryBtn.disabled = true;
            recoveryBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Buscando...';
            recoveryErr.classList.add('d-none');

            try {
                // Check if user exists
                const existingId = await VocacionalService.findAspiranteByContact(phone, email);

                if (existingId) {
                    localStorage.setItem('sia_vocacional_id', existingId);
                    if (recoveryModal) recoveryModal.hide();
                    window.location.hash = '#/vocacional/test';
                } else {
                    recoveryErr.textContent = "No se encontró ningún registro con esos datos.";
                    recoveryErr.classList.remove('d-none');
                    recoveryBtn.disabled = false;
                    recoveryBtn.innerHTML = 'Buscar Test';
                }
            } catch (error) {
                console.error(error);
                recoveryErr.textContent = "Error de red buscando aspirante.";
                recoveryErr.classList.remove('d-none');
                recoveryBtn.disabled = false;
                recoveryBtn.innerHTML = 'Buscar Test';
            }
        });

        // Auto-scroll del carrusel de carreras
        const carousel = this.querySelector('#careers-carousel');
        if (carousel) {
            let isScrolling = false;
            let scrollTimer;
            let autoScrollInterval;

            const startAutoScroll = () => {
                autoScrollInterval = setInterval(() => {
                    if (!isScrolling) {
                        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
                        if (maxScroll <= 0) return; // Not enough content to scroll

                        // Si está al final, regresar al inicio
                        if (carousel.scrollLeft >= maxScroll - 10) {
                            carousel.scrollTo({ left: 0, behavior: 'smooth' });
                        } else {
                            carousel.scrollBy({ left: 340, behavior: 'smooth' }); // width of card + gap
                        }
                    }
                }, 4000); // 4 seconds interval for reading
            };

            const stopAutoScroll = () => clearInterval(autoScrollInterval);

            // Detener auto-scroll cuando el usuario interactúa
            carousel.addEventListener('mouseenter', stopAutoScroll);
            carousel.addEventListener('mouseleave', startAutoScroll);
            carousel.addEventListener('touchstart', stopAutoScroll, { passive: true });
            carousel.addEventListener('touchend', startAutoScroll, { passive: true });

            // Pausa el auto-scroll durante y poco tiempo después de que el usuario haga scroll manual
            carousel.addEventListener('scroll', () => {
                isScrolling = true;
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => { isScrolling = false; }, 2000); // Resume active checking 2s after last scroll
            }, { passive: true });

            startAutoScroll();

            // Guardar para poder limpiar si el componente se destruye (opcional)
            this._autoScrollInterval = autoScrollInterval;
        }
    }
}

customElements.define('vocacional-landing', VocacionalLanding);
