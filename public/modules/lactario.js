// modules/lactario.js
// Módulo de Lactario - SIA
// Vista Principal

const Lactario = (function () {
    let _ctx = null;
    let _profile = null;
    let _activeBooking = null;

    // --- UI HELPERS ---
    const show = (el) => el?.classList.remove('d-none');
    const hide = (el) => el?.classList.add('d-none');

    // --- INIT ---
    async function init(ctx) {

        _ctx = ctx;
        _profile = ctx.profile;

        const container = document.getElementById('view-lactario');
        if (!container) return;

        // 1. Check Access
        const access = await LactarioService.checkAccess(_profile);

        if (!access.allowed) {
            renderAccessDenied(container, access.reason);
            return;
        }

        // 2. Render Main Layout
        renderLayout(container, access.isAdmin, access.isPsych);

        // 3. Load Data
        await LactarioService.loadConfig(ctx);
        if (access.isAdmin) {
            initAdminView();
        } else if (access.isPsych) {
            initPsychView();
        } else {
            initStudentView();
        }
    }

    // --- RENDERS ---

    function renderAccessDenied(container, reason) {
        container.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center min-vh-50 py-5 text-center">
                <div class="bg-danger bg-opacity-10 p-4 rounded-circle mb-3 text-danger">
                    <i class="bi bi-slash-circle display-1"></i>
                </div>
                <h2 class="fw-bold mb-2">Acceso Restringido</h2>
                <p class="text-muted mb-4" style="max-width: 500px;">
                    ${reason}
                </p>
                <div class="small text-muted">Si crees que esto es un error, contacta a Calidad o Servicio Médico.</div>
                <button class="btn btn-primary rounded-pill mt-4" onclick="SIA.navigate('view-dashboard')">Volver al Inicio</button>
            </div>
        `;
    }

    function renderLayout(container, isAdmin, isPsych) {
        // Theme Colors: Pink/Rose for Maternal vibe
        const maternalTheme = `
            <style>
                .text-maternal { color: #f472b6 !important; }
                .bg-maternal { background-color: #d63384 !important; }
                .bg-maternal-subtle { background-color: rgba(214, 51, 132, 0.15) !important; }
                .border-maternal { border-color: rgba(244, 114, 182, 0.3) !important; }
                .btn-maternal { background-color: #d63384; color: white; border: none; }
                .btn-maternal:hover { background-color: #c2185b; color: white; }
                .hero-lactario {
                    background: linear-gradient(135deg, rgba(214,51,132,0.3) 0%, rgba(244,114,182,0.15) 100%);
                    color: #f9a8d4;
                }
            </style>
        `;

        container.innerHTML = `
            ${maternalTheme}
            <div id="lactario-app" class="animate-fade-in">
                ${isAdmin ? renderAdminStructure() : (isPsych ? renderPsychStructure() : renderStudentStructure())}
            </div>
            
            <!-- Modal QR Scanner -->
            <div class="modal fade" id="modalLactarioQR" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold">Escanear QR de Sala</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center p-4">
                            <div class="mb-3">
                                <i class="bi bi-qr-code-scan display-1 text-maternal"></i>
                            </div>
                            <p class="text-muted small">Apunta tu cámara al código QR ubicado en la puerta del cubículo.</p>
                            
                            <!-- Real Scanner -->
                            <div id="qr-reader" style="width: 100%;"></div>
                            <div id="qr-reader-results"></div>
                            
                            <div id="qr-status-msg" class="small fw-bold mt-2"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Generic Admin Action Modal -->
            <div class="modal fade" id="modalLactarioAdmin" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h6 class="fw-bold" id="lacModalTitle">Acción</h6>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <form id="lacModalForm" onsubmit="event.preventDefault();"></form>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-sm btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-sm btn-maternal rounded-pill" id="lacModalSave">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
            
             <!-- Modal Fridge Agreement -->
            <div class="modal fade" id="modalLactarioFridge" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold text-maternal">Uso del Refrigerador</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <ul class="text-muted small mb-4">
                                <li class="mb-2">Etiqueta tu contenedor claramente con tu <strong>Nombre</strong> y <strong>Hora de extracción</strong>.</li>
                                <li class="mb-2">El refrigerador se limpia diariamente a las 2:00 P.M. y 8:00 P.M., no dejes nada despues de tu turno escolar.</li>
                                <li class="mb-2">Usa solo el espacio asignado.</li>
                            </ul>
                            <div class="alert alert-warning small border-0 d-flex align-items-center">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                <span>La institución no se hace responsable por contenedores sin etiqueta.</span>
                            </div>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-maternal rounded-pill fw-bold" onclick="Lactario.confirmFridgeUse()">Entendido, Escanear</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderStudentStructure() {
        return `
            <div class="hero-banner-v2 shadow-sm mb-4 hero-lactario">
                <div class="hero-content-v2">
                    <span class="badge bg-white text-maternal mb-2 fw-bold"><i class="bi bi-heart-fill me-1"></i>Sala de Lactancia</span>
                    <h2 class="fw-bold mb-2">Bienvenida, mamá ${_profile.displayName.split(' ')[0]}</h2>
                    <p class="small opacity-75 mb-3">Un espacio seguro y privado para ti y tu bebé.</p>
                </div>
                <i class="bi bi-person-hearts hero-bg-icon-v2 text-white opacity-25"></i>
            </div >



            <!-- TABS NAVIGATION -->
            <ul class="nav nav-pills nav-fill bg-white p-1 rounded-pill shadow-sm mb-4" id="pills-tab" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active rounded-pill fw-bold" id="tab-reservations-btn" data-bs-toggle="pill" data-bs-target="#tab-reservations" type="button" role="tab">Reservas</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link rounded-pill fw-bold" id="tab-fridge-btn" data-bs-toggle="pill" data-bs-target="#tab-fridge" type="button" role="tab">Frigobar</button>
                </li>
            </ul>

            <div class="tab-content" id="pills-tabContent">
                <!-- RESERVATIONS TAB -->
                <div class="tab-pane fade show active" id="tab-reservations" role="tabpanel">
        
            <div id="wrapper-active-booking" class="d-none mb-4">
                <!-- Dynamic Contextual Banner -->
                <div id="active-visit-banner" class="alert alert-info border-0 shadow-sm rounded-4 mb-3 d-none animate-fade-in">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-lightbulb-fill fs-4 me-3"></i>
                        <div>
                            <h6 class="fw-bold mb-1" id="banner-title">Tips para tu sesión</h6>
                            <p class="small mb-0 opacity-75" id="banner-text">...</p>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow rounded-4 bg-white border-start border-4 border-maternal overflow-hidden">
                    <div class="card-header bg-white border-0 pt-4 pb-0 px-4">
                         <div class="d-flex justify-content-between align-items-center">
                            <h5 class="fw-bold text-maternal mb-0" id="lbl-status-title">Tu Próxima Visita</h5>
                        </div>
                    </div>
                    <div class="card-body p-4">
                        <div class="row align-items-center g-3">
                            <!-- Visual Date -->
                            <div class="col-auto">
                                <div class="text-center bg-light rounded-4 border p-2" style="min-width: 80px;">
                                    <div class="term-month text-danger fw-bold extra-small text-uppercase mb-0" id="lbl-date-month">MES</div>
                                    <div class="display-5 fw-bold text-dark lh-1" id="lbl-date-day">00</div>
                                    <div class="small text-muted fw-bold" id="lbl-date-weekday">Dia</div>
                                </div>
                            </div>
                            
                            <!-- Visual Time & Countdown -->
                            <div class="col">
                                <div class="d-flex flex-column justify-content-center h-100 ps-2">
                                    <div class="d-flex align-items-center flex-wrap gap-4">
                                        <div class="d-flex align-items-baseline gap-2">
                                            <div class="display-4 fw-bold text-dark lh-1" id="lbl-next-time">--:--</div>
                                            <div class="text-muted small">hrs</div>
                                        </div>
                                        <!-- Space Label Repositioned -->
                                        <div class="d-flex align-items-center text-muted">
                                            <i class="bi bi-door-closed-fill me-2 fs-4 text-maternal"></i>
                                            <span class="fs-4 fw-bold text-dark lh-1" id="lbl-next-space">--</span>
                                        </div>
                                    </div>

                                    <!-- Countdown Container -->
                                    <div id="visit-timer" class="d-none text-maternal fw-bold small mt-1 animate-pulse">
                                        <i class="bi bi-hourglass-split me-1"></i><span id="timer-val">00:00</span>
                                        <span id="timer-label" class="fw-normal text-muted">para iniciar</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr class="border-light my-4">

                        <div class="d-flex gap-2 justify-content-between align-items-center mt-3">
                            <button class="btn btn-outline-dark btn-sm rounded-pill px-3" id="btn-cancel-visit" onclick="Lactario.cancelBooking()">
                                Cancelar
                            </button>

                            <div class="d-flex gap-2">
                                <!-- Fridge Button (Hidden by default) -->
                                <button id="btn-fridge-req" class="btn btn-info text-white rounded-pill fw-bold shadow-sm d-none" onclick="Lactario.openFridgeModal()">
                                    <i class="bi bi-snow2 me-2"></i>Usar Refri
                                </button>

                                <!-- Main Action -->
                                <button id="btn-main-action" class="btn btn-maternal rounded-pill fw-bold shadow-sm px-4" onclick="Lactario.openScanner()">
                                    <i class="bi bi-qr-code me-2"></i>Entrar
                                </button>
                            </div>
                        </div>

                        <!-- Notices & Rules -->
                        <div class="mt-4 p-3 bg-light rounded-4 border border-light">
                            <div class="d-flex gap-2 mb-2">
                                <i class="bi bi-info-circle-fill text-maternal mt-1"></i>
                                <span id="visit-hint" class="small fw-bold text-dark">Escanea el QR en la puerta al llegar (hasta 15 min antes permitido).</span>
                            </div>
                            <div class="ps-4">
                                <h6 class="extra-small fw-bold text-muted text-uppercase mb-1">Reglamento de Uso</h6>
                                <ul class="mb-0 ps-3 small text-muted">
                                    <li>Lávate las manos antes de iniciar.</li>
                                    <li>Si usas el refrigerador, etiqueta tu contenedor con nombre y hora.</li>
                                    <li>Deja el cubículo limpio y ordenado al salir.</li>
                                    <li>El tiempo máximo por sesión es de 30 minutos.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            <!-- NEW BOOKING CARD -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
                <div class="card-header bg-white py-3">
                    <h6 class="fw-bold mb-0 text-maternal"><i class="bi bi-calendar-plus me-2"></i>Reservar Espacio</h6>
                </div>
                <div class="card-body p-4">
                    <form id="form-lactario-book">
                        <div class="row g-3">
                            <div class="col-12">
                                <label class="form-label small fw-bold text-muted">¿Cuándo nos visitas?</label>
                                <div class="d-flex gap-2">
                                    <input type="hidden" id="lac-date" required>
                                        <button type="button" class="btn btn-outline-maternal flex-fill fw-bold active" id="btn-date-today" onclick="Lactario.selectDateTab('today')">Hoy</button>
                                        <button type="button" class="btn btn-outline-maternal flex-fill fw-bold" id="btn-date-tomorrow" onclick="Lactario.selectDateTab('tomorrow')">Mañana</button>
                                </div>
                            </div>

                            <div class="col-12">
                                <label class="form-label small fw-bold text-muted">Motivo</label>
                                <select id="lac-type" class="form-select">
                                    <option value="Lactancia">Lactancia</option>
                                    <option value="Extracción">Extracción Manual</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <div class="form-check bg-light p-3 rounded-3 border">
                                    <input class="form-check-input" type="checkbox" id="lac-accompaniment">
                                    <label class="form-check-label small fw-bold ms-2" for="lac-accompaniment">
                                        Solicitar Acompañamiento Psicológico
                                        <div class="text-muted extra-small fw-normal">Un especialista estará disponible para ti durante la sesión.</div>
                                    </label>
                                </div>
                            </div>

                            <div class="col-12">
                                <label class="form-label small fw-bold text-muted">Horarios Disponibles</label>
                                <!-- Carousel Container -->
                                <div class="d-flex align-items-center">
                                    <div class="d-flex overflow-auto pb-2 gap-2 flex-grow-1" id="lac-slots-container" style="white-space: nowrap;">
                                        <div class="text-muted small p-2">Selecciona un día para ver horarios.</div>
                                    </div>
                                    <button type="button" class="btn btn-light rounded-circle shadow-sm ms-2" title="Actualizar Horarios" onclick="Lactario.loadSlotsForDate(document.getElementById('lac-date').value)">
                                        <i class="bi bi-arrow-clockwise text-maternal"></i>
                                    </button>
                                </div>
                                <input type="hidden" id="lac-selected-time" required>
                            </div>
                        </div>
                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-maternal rounded-pill py-2 fw-bold">Confirmar Reserva</button>
                        </div>
                    </form>
                </div>
            </div>

                </div>
                
                <!-- FRIDGE TAB -->
                <div class="tab-pane fade" id="tab-fridge" role="tabpanel">
                    <div id="wrapper-fridge-status" class="py-4 animate-fade-in">
                        <div class="text-center text-muted py-5">
                            <span class="spinner-border spinner-border-sm me-2"></span>Cargando estado...
                        </div>
                    </div>
                </div>
            </div>

            <!-- TIPS SECTION (Enhanced) -->
            <h6 class="fw-bold text-muted mb-3"><i class="bi bi-heart-pulse-fill text-danger me-2"></i>Guía de Bienestar Materno</h6>
            <div class="row g-3">
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm h-100 bg-white hover-scale">
                        <div class="card-body text-center p-3">
                            <div class="d-inline-flex align-items-center justify-content-center bg-info bg-opacity-10 rounded-circle mb-3" style="width:50px; height:50px">
                                <i class="bi bi-droplet-fill text-info fs-4"></i>
                            </div>
                            <h6 class="fw-bold small text-dark">Hidratación Vital</h6>
                            <p class="extra-small text-muted mb-0">La leche es 87% agua. Bebe al menos un vaso de agua antes y después de cada extracción.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm h-100 bg-white hover-scale">
                        <div class="card-body text-center p-3">
                            <div class="d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 rounded-circle mb-3" style="width:50px; height:50px">
                                <i class="bi bi-clock-history text-warning fs-4"></i>
                            </div>
                            <h6 class="fw-bold small text-dark">Frecuencia</h6>
                            <p class="extra-small text-muted mb-0">Mantén un horario regular (cada 3-4 horas) para que tu cuerpo no disminuya la producción de leche.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm h-100 bg-white hover-scale">
                        <div class="card-body text-center p-3">
                            <div class="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 rounded-circle mb-3" style="width:50px; height:50px">
                                <i class="bi bi-music-note-beamed text-success fs-4"></i>
                            </div>
                            <h6 class="fw-bold small text-dark">Ambiente Zen</h6>
                            <p class="extra-small text-muted mb-0">El estrés inhibe la oxitocina. Respira profundo, escucha música suave o mira fotos de tu bebé.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card border-0 shadow-sm h-100 bg-white hover-scale">
                        <div class="card-body text-center p-3">
                            <div class="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 rounded-circle mb-3" style="width:50px; height:50px">
                                <i class="bi bi-snow text-danger fs-4"></i>
                            </div>
                            <h6 class="fw-bold small text-dark">Conservación</h6>
                            <p class="extra-small text-muted mb-0">Etiqueta siempre con fecha y hora. Usa el refrigerador solo para tu turno y transporta con hielera.</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div class="col-lg-4">

            <!-- ... STATS ... -->
            <!-- END TIPS REPLACEMENT -->



            <!-- STATS -->
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-4 text-center">
                    <h6 class="fw-bold text-muted mb-3">Tu Historial</h6>
                    <div class="row">
                        <div class="col-6 border-end">
                            <div class="display-5 fw-bold text-maternal" id="stat-visits">0</div>
                            <div class="extra-small text-muted fw-bold">VISITAS</div>
                        </div>
                        <div class="col-6">
                            <div class="display-5 fw-bold text-dark" id="stat-hours">0</div>
                            <div class="extra-small text-muted fw-bold">HORAS</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
    }

    function renderAdminStructure() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="fw-bold text-maternal">Panel de Administración</h3>
                <span class="badge bg-white text-dark shadow-sm border">Admin Calidad</span>
            </div>

            <!--TABS-->
            <ul class="nav nav-pills nav-fill bg-white p-1 rounded-pill border shadow-sm mb-4" id="adminTabs">
                <li class="nav-item">
                    <a class="nav-link admin-tab-btn active fw-bold text-maternal rounded-pill" id="btn-tab-stats" href="#" onclick="Lactario.switchAdminTab('stats'); return false;">Estadísticas</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link admin-tab-btn rounded-pill" id="btn-tab-spaces" href="#" onclick="event.preventDefault(); Lactario.switchAdminTab('spaces');">Espacios</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link admin-tab-btn rounded-pill" id="btn-tab-fridges" href="#" onclick="event.preventDefault(); Lactario.switchAdminTab('fridges');">Refrigeradores</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link admin-tab-btn rounded-pill" id="btn-tab-config" href="#" onclick="event.preventDefault(); Lactario.switchAdminTab('config');">Configuración</a>
                </li>
            </ul>
            
            <!--STATS TAB-->
            <div id="pane-stats" class="admin-tab-pane animate-fade-in">
                <div class="d-flex justify-content-between mb-4">
                     <h5 class="fw-bold text-maternal">Reporte General</h5>
                     <div class="d-flex gap-2">
                        <select class="form-select w-auto shadow-sm border-0 rounded-pill small fw-bold text-muted" id="stat-range-filter" onchange="Lactario.loadAdminStats()">
                            <option value="7days">Últimos 7 días</option>
                            <option value="30days">Últimos 30 días</option>
                            <option value="all">Todo el Historial</option>
                        </select>
                        <div class="btn-group shadow-sm">
                            <button class="btn btn-outline-danger btn-sm rounded-start-pill" onclick="Lactario.exportReport('pdf')" title="PDF"><i class="bi bi-file-earmark-pdf-fill"></i></button>
                            <button class="btn btn-outline-success btn-sm" onclick="Lactario.exportReport('excel')" title="Excel"><i class="bi bi-file-earmark-excel-fill"></i></button>
                            <button class="btn btn-outline-primary btn-sm rounded-end-pill" onclick="Lactario.exportReport('word')" title="Word"><i class="bi bi-file-earmark-word-fill"></i></button>
                        </div>
                    </div>
                </div>

                <!-- METRICS ROW -->
                <div class="row g-3 mb-4">
                    <div class="col-6 col-md-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div class="card-body p-3 text-center">
                                <h6 class="text-muted extra-small fw-bold mb-1">VISITAS TOTALES</h6>
                                <div class="fs-2 fw-bold text-dark" id="stat-total-visits">--</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                         <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div class="card-body p-3 text-center">
                                <h6 class="text-muted extra-small fw-bold mb-1">COMPLETADAS</h6>
                                <div class="fs-2 fw-bold text-success" id="stat-completion">--</div>
                            </div>
                        </div>
                    </div>
                     <div class="col-6 col-md-3">
                          <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div class="card-body p-3 text-center">
                                <h6 class="text-muted extra-small fw-bold mb-1">HORA PICO</h6>
                                <div class="fs-2 fw-bold text-primary" id="stat-peak">--:--</div>
                            </div>
                        </div>
                    </div>
                     <div class="col-6 col-md-3">
                          <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
                            <div class="card-body p-3 text-center">
                                <h6 class="text-muted extra-small fw-bold mb-1">DURACIÓN PROM.</h6>
                                <div class="fs-2 fw-bold text-info" id="stat-duration">--m</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CHARTS GRID -->
                <div class="row g-4">
                     <!-- 1. Evolution -->
                    <div class="col-md-8">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-2 border-0"><h6 class="fw-bold mb-0 small">Tendencia de Visitas</h6></div>
                            <div class="card-body" style="height: 250px;"><canvas id="chart-visits"></canvas></div>
                        </div>
                    </div>
                    <!-- 2. Types Donut -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-2 border-0"><h6 class="fw-bold mb-0 small">Motivos</h6></div>
                            <div class="card-body" style="height: 250px; position: relative;"><canvas id="chart-types"></canvas></div>
                        </div>
                    </div>
                    <!-- 3. Peak Hours Bar -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-2 border-0"><h6 class="fw-bold mb-0 small">Horas de Mayor Uso</h6></div>
                            <div class="card-body" style="height: 200px;"><canvas id="chart-hours"></canvas></div>
                        </div>
                    </div>
                     <!-- 4. Durations Histogram (Simplified as Bar) -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-2 border-0"><h6 class="fw-bold mb-0 small">Duración de Visitas</h6></div>
                            <div class="card-body" style="height: 200px;"><canvas id="chart-duration"></canvas></div>
                        </div>
                    </div>
                    <!-- 5. Status Pie -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-header bg-white py-2 border-0"><h6 class="fw-bold mb-0 small">Estatus de Reservas</h6></div>
                            <div class="card-body" style="height: 200px;"><canvas id="chart-status"></canvas></div>
                        </div>
                    </div>
                </div>
            </div>

            <!--SPACES TAB-->
            <div id="pane-spaces" class="admin-tab-pane d-none animate-fade-in">
                 <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-muted">Gestión de Espacios</h6>
                    <button class="btn btn-maternal rounded-pill shadow-sm" onclick="Lactario.addSpacePrompt()"><i class="bi bi-plus-lg me-1"></i>Nuevo Espacio</button>
                 </div>
                 <div id="admin-spaces-list"></div>
            </div>

            <!--FRIDGES TAB-->
            <div id="pane-fridges" class="admin-tab-pane d-none animate-fade-in">
                 <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-muted">Gestión de Refrigeradores</h6>
                    <button class="btn btn-maternal rounded-pill shadow-sm" onclick="Lactario.addFridgePrompt()"><i class="bi bi-plus-lg me-1"></i>Nuevo Refrigerador</button>
                 </div>
                 <div id="admin-fridges-list"></div>
            </div>

            <!--CONFIG TAB-->
    <div id="pane-config" class="admin-tab-pane d-none animate-fade-in">
        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-header bg-white py-3 border-0"><h6 class="fw-bold mb-0">Parámetros del Servicio</h6></div>
            <div class="card-body p-4">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label small fw-bold">Hora Apertura (24h)</label>
                        <input type="number" id="conf-open" class="form-control" min="7" max="22">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label small fw-bold">Hora Cierre (24h)</label>
                        <input type="number" id="conf-close" class="form-control" min="7" max="22">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label small fw-bold">Tolerancia (min)</label>
                        <input type="number" id="conf-tolerance" class="form-control" min="5" max="60">
                    </div>
                    <div class="col-12 mt-4 text-end">
                        <button class="btn btn-dark rounded-pill" id="btn-save-conf" onclick="Lactario.saveAdminConfig()">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
    }

    // --- STUDENT LOGIC ---

    // --- STUDENT LOGIC ---

    // Expose for onClick
    let _selectDateTabFn = null;
    function selectDateTab(day) {
        if (_selectDateTabFn) _selectDateTabFn(day);
    }

    async function initStudentView() {
        // Lazy Cleanup of expired bookings
        LactarioService.checkExpiredBookings(_ctx).then(() => refreshStatus());
        // refreshStatus(); // Moved inside then() to ensure we see latest status

        // Setup Date Tabs Logic
        // Setup Date Tabs Logic
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fix: Use local date components instead of toISOString (UTC)
        // toISOString can return next day if late at night in Western Hemisphere
        const toLocalISO = (d) => {
            const offset = d.getTimezoneOffset() * 60000;
            const local = new Date(d.getTime() - offset);
            return local.toISOString().split('T')[0];
        };

        const todayStr = toLocalISO(today);
        const tomorrowStr = toLocalISO(tomorrow);

        // Function exposed (via closure bridge)
        _selectDateTabFn = async (day) => {
            const btnToday = document.getElementById('btn-date-today');
            const btnTomorrow = document.getElementById('btn-date-tomorrow');
            const inputDate = document.getElementById('lac-date');

            if (day === 'today') {
                btnToday.classList.add('active', 'btn-maternal', 'text-white');
                btnToday.classList.remove('btn-outline-maternal');
                btnTomorrow.classList.remove('active', 'btn-maternal', 'text-white');
                btnTomorrow.classList.add('btn-outline-maternal');
                inputDate.value = todayStr;
            } else {
                btnTomorrow.classList.add('active', 'btn-maternal', 'text-white');
                btnTomorrow.classList.remove('btn-outline-maternal');
                btnToday.classList.remove('active', 'btn-maternal', 'text-white');
                btnToday.classList.add('btn-outline-maternal');
                inputDate.value = tomorrowStr;
            }
            await loadSlotsForDate(inputDate.value);
        };

        async function loadSlotsForDate(date) {
            if (!date) return;
            const box = document.getElementById('lac-slots-container');
            box.innerHTML = '<span class="spinner-border spinner-border-sm text-maternal"></span>';
            try {
                const slots = await LactarioService.getAvailability(_ctx, date);
                renderSlots(slots);
            } catch (err) {
                box.innerHTML = '<span class="text-danger small">Error.</span>';
                console.error(err);
            }
        }

        // Init Default (Today)
        _selectDateTabFn('today');

        // Expose for Refresh Button
        Lactario.loadSlotsForDate = loadSlotsForDate;

        // Form Submit
        const form = document.getElementById('form-lactario-book');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type="submit"]');
                const date = document.getElementById('lac-date').value;
                const time = document.getElementById('lac-selected-time').value;
                const type = document.getElementById('lac-type').value;
                const accompaniment = document.getElementById('lac-accompaniment').checked;

                if (!time) {
                    showToast('Por favor selecciona un horario.', 'warning');
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = 'Reservando...';

                try {
                    await LactarioService.createReservation(_ctx, {
                        user: _ctx.user,
                        date,
                        timeStr: time,
                        type,
                        accompaniment
                        // Fridge checks removed from here
                    });

                    showToast('¡Reserva confirmada!', 'success');
                    form.reset();
                    // Restore tab
                    _selectDateTabFn('today');
                    refreshStatus();
                } catch (err) {
                    showToast(err.message, 'danger');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = 'Confirmar Reserva';
                }
            });
        }
    }

    function renderSlots(slots) {
        const box = document.getElementById('lac-slots-container');
        box.innerHTML = '';

        if (slots.length === 0) {
            box.innerHTML = '<div class="small text-muted p-2">No hay horarios disponibles.</div>';
            return;
        }

        const input = document.getElementById('lac-selected-time');

        slots.forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            // Flex Item for carousel
            btn.className = `btn btn-sm ${s.isFull ? 'btn-light text-muted' : 'btn-outline-danger'} rounded-pill px-4 py-2 m-1 shadow-sm flex-shrink-0`;
            // Using formattedTime (12h) for display
            btn.innerHTML = `<div class="fw-bold">${s.formattedTime}</div><div class="extra-small">${s.available} lugares</div>`;
            btn.disabled = s.isFull;

            if (!s.isFull) {
                btn.onclick = () => {
                    box.querySelectorAll('button').forEach(b => {
                        if (!b.disabled) {
                            b.classList.remove('btn-danger', 'text-white');
                            b.classList.add('btn-outline-danger');
                        }
                    });
                    btn.classList.remove('btn-outline-danger');
                    btn.classList.add('btn-danger', 'text-white');
                    input.value = s.time; // Keep 24h value for internal logic
                };
            }

            box.appendChild(btn);
        });
    }

    // --- TIMER LOGIC ---
    let _timerInterval = null;

    function startTimer(checkInTimeStr, durationMins = 30) {
        if (_timerInterval) clearInterval(_timerInterval);
        const start = new Date(checkInTimeStr).getTime(); // Timestamp
        const end = start + (durationMins * 60 * 1000);

        const tick = () => {
            const now = Date.now();
            const diff = end - now;

            if (diff <= 0) {
                document.getElementById('timer-val').innerText = "00:00";
                document.getElementById('visit-timer').classList.add('text-danger');
                document.getElementById('visit-hint').innerHTML = "<strong class='text-danger'>Tu tiempo ha terminado. Por favor libera el espacio.</strong>";
                clearInterval(_timerInterval);
                return;
            }

            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            // Warnings
            if (m < 10) {
                document.getElementById('visit-timer').classList.replace('text-maternal', 'text-danger');
                // Only show alert once? Let UI handle color
            } else {
                document.getElementById('visit-timer').classList.replace('text-danger', 'text-maternal');
            }

            document.getElementById('timer-val').innerText = `${pad(m)}:${pad(s)} `;
        };

        tick(); // Immed
        _timerInterval = setInterval(tick, 1000);
    }
    const pad = n => String(n).padStart(2, '0');

    async function refreshStatus() {
        if (_timerInterval) clearInterval(_timerInterval); // Reset

        const active = await LactarioService.getUserActiveReservation(_ctx, _ctx.user.uid);
        _activeBooking = active;

        const wrapper = document.getElementById('wrapper-active-booking');
        const banner = document.getElementById('active-visit-banner');
        const btnMain = document.getElementById('btn-main-action');
        const btnFridge = document.getElementById('btn-fridge-req');
        const lblStatus = document.getElementById('lbl-status-title');
        const timerBox = document.getElementById('visit-timer');
        const timerVal = document.getElementById('timer-val');
        const timerLbl = document.getElementById('timer-label');

        if (active && (active.status === 'confirmed' || active.status === 'checked-in')) {
            show(wrapper);
            const isCheckedIn = active.status === 'checked-in';

            // Visual Date Parsing
            const d = new Date(active.date);
            // Capitalize First Letter helper
            const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
            document.getElementById('lbl-date-month').textContent = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
            document.getElementById('lbl-date-day').textContent = d.getDate();
            document.getElementById('lbl-date-weekday').textContent = cap(d.toLocaleDateString('es-MX', { weekday: 'short' }));

            document.getElementById('lbl-next-time').textContent = active.time;
            document.getElementById('lbl-next-space').textContent = active.spaceName || 'Cubículo 1';

            // UI State
            if (isCheckedIn) {
                lblStatus.textContent = "Visita en Curso";
                lblStatus.classList.add('text-success');

                // Countdown: Time Left in Session
                show(timerBox);
                timerBox.classList.remove('text-maternal', 'text-muted');
                timerBox.classList.add('text-danger'); // Urgency
                timerLbl.textContent = 'restantes';

                // Start Timer (Counts down 30 mins from checkIn)
                const checkInDate = active.checkInTime ? active.checkInTime.toDate() : new Date();
                startTimer(checkInDate);

                // Buttons
                btnMain.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Salida';
                btnMain.classList.replace('btn-maternal', 'btn-outline-danger');

                show(btnFridge);
                document.getElementById('btn-cancel-visit').classList.add('d-none');

                // Show Banner Tips
                show(banner);
                // Ensure type exists, default to Lactancia if not
                const type = active.type || 'Lactancia';
                updateBannerTips(type);

                document.getElementById('visit-hint').textContent = "Recuerda escanear el QR de Salida al terminar.";

            } else {
                // Confirmed (Waiting to Start)
                lblStatus.textContent = "Tu Próxima Visita";
                lblStatus.classList.remove('text-success');

                // Countdown: Time TO Start
                // Fix: active.date is a Date Object (from Firestore Timestamp), not a string.
                // We compare timestamps directly to check if we are close to the start time.
                const now = new Date();
                const target = active.date; // Contains full date & time (e.g. Feb 5 17:00)

                const diffMins = (target - now) / 60000;

                // Show if within 60 mins before start (and not yet past start significantly, though status handles that)
                if (diffMins > -15 && diffMins < 60) {
                    show(timerBox);
                    timerBox.classList.add('text-maternal');
                    timerLbl.textContent = diffMins > 0 ? 'para iniciar' : 'retraso';

                    const updateStartTimer = () => {
                        const n = new Date();
                        const d = target - n;
                        if (d > 0) {
                            const mm = Math.floor(d / 60000);
                            const ss = Math.floor((d % 60000) / 1000);
                            timerVal.textContent = `${pad(mm)}:${pad(ss)}`;
                        } else {
                            timerVal.textContent = "00:00";
                            timerLbl.textContent = "¡Tiempo!";
                        }
                    };
                    updateStartTimer();
                    _timerInterval = setInterval(updateStartTimer, 1000);
                } else {
                    hide(timerBox);
                }

                btnMain.innerHTML = '<i class="bi bi-qr-code me-2"></i>Entrar';
                btnMain.classList.replace('btn-outline-danger', 'btn-maternal');

                hide(btnFridge);
                document.getElementById('btn-cancel-visit').classList.remove('d-none');
            }

        } else {
            hide(wrapper);
        }

        // --- FRIDGE TAB RENDERING ---
        const fridgeContainer = document.getElementById('wrapper-fridge-status');
        if (fridgeContainer) {
            try {
                const items = await LactarioService.getFridgeStatus(_ctx, _ctx.user.uid);

                if (items && items.length > 0) {
                    const item = items[0]; // Show latest
                    const dateStr = item.fridgeTime ? item.fridgeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                    fridgeContainer.innerHTML = `
                        <div class="card border-0 shadow-sm rounded-4 bg-info bg-opacity-10 mb-3">
                            <div class="card-body p-4 text-center">
                                <div class="bg-white p-3 rounded-circle d-inline-block shadow-sm mb-3">
                                    <i class="bi bi-snow2 display-4 text-info"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-1">Leche en Resguardo</h5>
                                <span class="badge bg-info text-white mb-2 shadow-sm">${item.fridgeId || 'Refrigerador'}</span>
                                <p class="small text-muted mb-3">Guardado a las <span class="fw-bold text-dark">${dateStr}</span></p>
                                
                                <div class="bg-white rounded-3 p-3 text-start mb-4 shadow-sm">
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="bi bi-clock-history text-warning me-2"></i>
                                        <span class="small fw-bold">Horarios de Limpieza</span>
                                    </div>
                                    <p class="extra-small text-muted mb-0 lh-sm">
                                        El personal realiza limpieza a las <strong>2:00 PM</strong> y <strong>8:00 PM</strong>. 
                                        Asegúrate de retirar tu contenedor antes de estos horarios.
                                    </p>
                                </div>

                                <button class="btn btn-info text-white rounded-pill fw-bold px-4 py-2 shadow-sm" onclick="Lactario.openScanner('pickup')">
                                    <i class="bi bi-box-arrow-up me-2"></i>Retirar (Escanear)
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    fridgeContainer.innerHTML = `
                        <div class="text-center py-5">
                            <i class="bi bi-inbox text-muted display-1 opacity-25"></i>
                            <h6 class="fw-bold text-muted mt-3">Tu espacio está vacío</h6>
                            <p class="small text-muted opacity-75">No tienes contenedores registrados actualmente.</p>
                        </div>
                    `;
                }
            } catch (e) {
                console.error("Fridge status error", e);
                fridgeContainer.innerHTML = '<div class="text-center text-danger small">Error cargando frigobar</div>';
            }
        }
    }

    function updateBannerTips(type) {
        const title = document.getElementById('banner-title');
        const text = document.getElementById('banner-text');

        if (type === 'Extracción') {
            title.textContent = "Tips para Extracción";
            text.textContent = "Masajea suavemente el pecho antes de iniciar. Usa una velocidad baja al principio para estimular la bajada de la leche.";
        } else {
            title.textContent = "Tips de Lactancia";
            text.textContent = "Busca una posición cómoda (Cuna, Balón de Rugby). Verifica que el agarre del bebé cubra gran parte de la areola.";
        }
    }

    // --- STUDENT FRIDGE ACTIONS ---
    function openFridgeModal() {
        const modalEl = document.getElementById('modalLactarioFridge');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    async function confirmFridgeUse() {
        const modalEl = document.getElementById('modalLactarioFridge');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        openScannerForFridge();
    }

    let _scanMode = 'access';

    function openScannerForFridge() {
        openScanner('fridge');
    }

    // --- QR ACTIONS ---
    let html5QrcodeScanner = null;

    function openScanner(mode = 'access') {
        _scanMode = mode;
        const modalEl = document.getElementById('modalLactarioQR');

        // Set Title
        const mTitle = document.querySelector('#modalLactarioQR .modal-title');
        if (mTitle) {
            mTitle.innerText = mode === 'fridge' ? "Escanear QR del Refrigerador" : "Escanear QR de Sala";
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        document.getElementById('qr-reader-results').innerHTML = "";
        modalEl.addEventListener('shown.bs.modal', startCamera, { once: true });
        modalEl.addEventListener('hidden.bs.modal', stopCamera, { once: true });
    }

    function startCamera() {
        if (html5QrcodeScanner) return;
        // Fix: Restrict to Camera Only to avoid file upload errors and improve UX
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", {
            fps: 10,
            qrbox: 250,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        }, false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }

    function stopCamera() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().catch(console.error);
            html5QrcodeScanner = null;
        }
    }

    async function onScanSuccess(decodedText, decodedResult) {
        if (!_activeBooking) return;
        try {
            if (html5QrcodeScanner) {
                await html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }

            let res;
            if (_scanMode === 'fridge') {
                await LactarioService.useFridge(_ctx, _activeBooking.id, decodedText);
                res = { message: 'Refrigerador registrado' };
                const btn = document.getElementById('btn-fridge-req');
                if (btn) { btn.disabled = true; btn.innerText = 'Refrigerador en uso'; }
            } else if (_scanMode === 'pickup') {
                // For pickup, we might not have _activeBooking (if picking up later). 
                // We need logic to find WHICH booking/item we are picking up.
                // Ideally, we passed the bookingID or we assume we pick up the oldest/all.
                // For now, let's assume we pick up the specific booking associated with the fridge item displayed.
                // BUT `onScanSuccess` relies on global context.
                // Let's use `window._pickupBookingId` hack or better, just pass it.
                // Since onScanSuccess is a callback, we need to store state.

                // If _scanMode is pickup, we expect decodedText to be the fridge ID (verification).
                // We call pickupFridge on the pending item.
                const items = await LactarioService.getFridgeStatus(_ctx, _ctx.user.uid);
                const item = items[0]; // Assume first
                if (item) {
                    await LactarioService.pickupFridge(_ctx, item.id);
                    res = { message: 'Leche retirada correctamente' };
                } else {
                    throw new Error("No hay registros pendientes de retiro.");
                }
            } else {
                res = await LactarioService.validateVisit(_ctx, _activeBooking.id, decodedText);
            }

            const resContainer = document.getElementById('qr-reader-results');
            resContainer.innerHTML = `
                <div class="text-center text-success mt-4">
                    <i class="bi bi-check-circle-fill display-1"></i>
                    <h5 class="fw-bold mt-3">${res.message}</h5>
                </div>
            `;
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalLactarioQR'));
                modal.hide();
                refreshStatus();
            }, 2000);

        } catch (err) {
            const resContainer = document.getElementById('qr-reader-results');
            resContainer.innerHTML = `
                <div class="text-center text-danger mt-4">
                    <i class="bi bi-x-circle-fill display-1"></i>
                    <h5 class="fw-bold mt-3">Error</h5>
                    <p>${err.message}</p>
                    <button class="btn btn-sm btn-outline-dark mt-2" onclick="Lactario.openScanner(_scanMode)">Intentar de nuevo</button>
                </div>
            `;
        }
    }

    function onScanFailure(error) { } // Ignore



    async function cancelBooking() {
        if (!_activeBooking) return;
        if (!confirm("¿Seguro que deseas cancelar tu visita?")) return;

        try {
            await LactarioService.cancelReservation(_ctx, _activeBooking.id, "User requested");
            refreshStatus();
            showToast("Reserva cancelada.", "info");

            // Refresh slots if a date is selected (might be the date of the cancelled booking)
            const dateInput = document.getElementById('lac-date');
            if (dateInput && dateInput.value) {
                // Manually trigger change event or call loadSlots directly if available scope
                // Since loadSlotsForDate is local in initStudentView, we can't call it here easily
                // unless we move it or trigger event.
                dateInput.dispatchEvent(new Event('change'));
            }
        } catch (e) { console.error(e); }
    }

    // --- ADMIN LOGIC ---
    // --- ADMIN LOGIC ---

    // Expose Admin functions
    function switchAdminTab(tabId) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active', 'fw-bold', 'text-maternal'));
        document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.add('d-none'));

        document.getElementById(`btn-tab-${tabId}`).classList.add('active', 'fw-bold', 'text-maternal');
        document.getElementById(`pane-${tabId}`).classList.remove('d-none');

        if (tabId === 'stats') loadAdminStats();
        if (tabId === 'fridges') loadAdminFridges();
    }

    async function initAdminView() {
        // Initialize with spaces and stats
        loadAdminSpaces();
        loadAdminConfig();

        // Force switch to stats tab to trigger loadAdminStats
        // Use timeout to ensure DOM is ready if needed, though usually synchronous after renderLayout
        setTimeout(() => switchAdminTab('stats'), 100);
    }

    // ... (loadAdminSpaces remains)

    async function loadAdminFridges() {
        const list = document.getElementById('admin-fridges-list');
        list.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';
        try {
            const fridges = await LactarioService.getFridges(_ctx);
            if (fridges.length === 0) list.innerHTML = '<div class="text-muted small">No hay refrigeradores registrados.</div>';
            else {
                list.innerHTML = fridges.map(f => `
                    <div class="d-flex justify-content-between align-items-center p-3 bg-white border shadow-sm rounded-4 mb-3">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-info bg-opacity-10 p-2 rounded-circle text-info">
                                <i class="bi bi-snow2 fs-4"></i>
                            </div>
                            <div>
                                <div class="fw-bold text-dark">${f.name}</div>
                                <div class="extra-small text-muted">Capacidad: <strong>${f.limit || 10}</strong> espacios</div>
                                <span class="badge ${f.active !== false ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                                    ${f.active !== false ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                             <div class="form-check form-switch pt-1 me-2" title="Activar/Desactivar">
                                <input class="form-check-input" style="cursor: pointer;" type="checkbox" onchange="Lactario.toggleFridge('${f.id}', this.checked)" ${f.active !== false ? 'checked' : ''}>
                                <label class="form-check-label small ms-1 text-muted">${f.active !== false ? 'On' : 'Off'}</label>
                            </div>
                            <button class="btn btn-sm btn-outline-primary border-0" onclick="Lactario.editFridge('${f.id}', '${f.name}', ${f.limit || 10})" title="Editar"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-outline-dark border-0" onclick="Lactario.printQR('${f.id}', '${f.name}')" title="Imprimir QR"><i class="bi bi-qr-code"></i></button>
                            <button class="btn btn-sm btn-outline-danger border-0" onclick="Lactario.deleteFridge('${f.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                        </div>
                    </div >
    `).join('');
            }
        } catch (e) { list.innerHTML = `<div class="text-danger small">Error: ${e.message}</div>`; }
    }

    async function addFridgePrompt() {
        const name = prompt("Nombre del Refrigerador (ej. Refri Principal):");
        if (name) {
            // Default 10
            await LactarioService.addFridge(_ctx, name);
            loadAdminFridges();
        }
    }

    async function editFridge(id, currentName, currentLimit) {
        const newName = prompt("Nombre del Refrigerador:", currentName);
        if (newName === null) return;

        const newLimit = prompt("Capacidad (Espacios disponibles):", currentLimit);
        if (newLimit === null) return;

        if (newName && newLimit) {
            await LactarioService.updateFridge(_ctx, id, {
                name: newName,
                limit: parseInt(newLimit)
            });
            loadAdminFridges();
        }
    }

    async function toggleFridge(id, state) {
        await LactarioService.toggleFridge(_ctx, id, state);
        loadAdminFridges();
    }

    async function deleteFridge(id) {
        if (confirm('¿Eliminar refrigerador?')) {
            await LactarioService.deleteFridge(_ctx, id);
            loadAdminFridges();
        }
    }

    async function loadAdminSpaces() {
        const list = document.getElementById('admin-spaces-list');
        list.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';
        try {
            const spaces = await LactarioService.getSpaces(_ctx);
            list.innerHTML = spaces.map(s => `
    <div class="d-flex justify-content-between align-items-center p-3 bg-white border shadow-sm rounded-4 mb-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="bg-light p-2 rounded-circle text-maternal">
                            <i class="bi bi-door-closed-fill fs-4"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${s.name}</div>
                            <div class="extra-small text-muted">ID: ${s.id}</div>
                            <span class="badge ${s.active ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                                ${s.active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                         <div class="form-check form-switch pt-1" title="Activar/Desactivar">
                            <input class="form-check-input" type="checkbox" onchange="Lactario.toggleSpace('${s.id}', this.checked)" ${s.active ? 'checked' : ''}>
                        </div>
                        <button class="btn btn-sm btn-outline-dark border-0" onclick="Lactario.printQR('${s.id}', '${s.name}')" title="Imprimir QR"><i class="bi bi-qr-code"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="Lactario.deleteSpace('${s.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div >
    `).join('');
        } catch (e) { list.innerHTML = `< div class="text-danger small" > Error: ${e.message}</div > `; }
    }

    async function loadAdminConfig() {
        try {
            const config = await LactarioService.loadConfig(_ctx);
            document.getElementById('conf-open').value = config.openHour;
            document.getElementById('conf-close').value = config.closeHour;
            document.getElementById('conf-tolerance').value = config.tolerance;
        } catch (e) { }
    }

    async function saveAdminConfig() {
        const btn = document.getElementById('btn-save-conf');
        btn.disabled = true;
        try {
            const newConf = {
                openHour: parseInt(document.getElementById('conf-open').value),
                closeHour: parseInt(document.getElementById('conf-close').value),
                tolerance: parseInt(document.getElementById('conf-tolerance').value)
            };
            await LactarioService.updateConfig(_ctx, newConf);
            showToast('Configuración guardada.', 'success');
        } catch (e) { showToast(e.message, 'danger'); }
        finally { btn.disabled = false; }
    }

    async function loadAdminStats() {
        // Safety check: if tab is not visible/rendered, don't update innerText
        const container = document.getElementById('pane-stats');
        if (!container) return;

        const range = document.getElementById('stat-range-filter')?.value || '7days';
        try {
            const stats = await LactarioService.getStats(_ctx, range);

            // Metrics - Safe Update
            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

            setTxt('stat-total-visits', stats.total);
            setTxt('stat-completion', stats.statusCounts.completed || 0);
            setTxt('stat-peak', stats.peakHour);
            setTxt('stat-duration', stats.averageDuration + 'm');
            setTxt('stat-rate', '98%');

            // Render Charts

            // Render Charts
            if (window.Chart) renderCharts(stats);

            // Store stats for export
            Lactario._currentStats = stats;
            Lactario._currentRange = range;

        } catch (e) { console.error(e); }
    }

    // Chart Instances Storage
    const _charts = {};

    function renderCharts(stats) {
        // Helper to destroy if exists
        const initChart = (id, config) => {
            if (_charts[id]) _charts[id].destroy();
            const ctx = document.getElementById(id);
            if (ctx) _charts[id] = new Chart(ctx, config);
        };

        const labelsDate = Object.keys(stats.visitsByDate).sort();

        // 1. Visits Evolution (Line)
        initChart('chart-visits', {
            type: 'line',
            data: {
                labels: labelsDate,
                datasets: [{
                    label: 'Visitas',
                    data: labelsDate.map(l => stats.visitsByDate[l]),
                    borderColor: '#d63384',
                    backgroundColor: 'rgba(214, 51, 132, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        // 2. Types (Doughnut)
        const types = Object.keys(stats.visitsByReason);
        initChart('chart-types', {
            type: 'doughnut',
            data: {
                labels: types,
                datasets: [{
                    data: types.map(t => stats.visitsByReason[t]),
                    backgroundColor: ['#0dcaf0', '#6610f2', '#fd7e14']
                }]
            },
            options: { plugins: { legend: { position: 'bottom' } } }
        });

        // 3. Peak Hours (Bar)
        const hours = Object.keys(stats.visitsByHour).sort((a, b) => a - b);
        initChart('chart-hours', {
            type: 'bar',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Visitas',
                    data: hours.map(h => stats.visitsByHour[h]),
                    backgroundColor: '#0d6efd',
                    borderRadius: 4
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        // 4. Duration (Bar/Histogram mockup)
        // Group durations into bins: <15, 15-30, 30-45, >45
        const bins = { '<15m': 0, '15-30m': 0, '30-45m': 0, '>45m': 0 };
        stats.durations.forEach(d => {
            if (d < 15) bins['<15m']++;
            else if (d < 30) bins['15-30m']++;
            else if (d < 45) bins['30-45m']++;
            else bins['>45m']++;
        });
        initChart('chart-duration', {
            type: 'bar',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    label: 'Frecuencia',
                    data: Object.values(bins),
                    backgroundColor: '#198754',
                    borderRadius: 4
                }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } } }
        });

        // 5. Status (Pie)
        initChart('chart-status', {
            type: 'pie',
            data: {
                labels: ['Completada', 'Cancelada', 'Pendiente', 'No Asistió'],
                datasets: [{
                    data: [
                        stats.statusCounts.completed,
                        stats.statusCounts.cancelled,
                        stats.statusCounts.reserved || stats.statusCounts.confirmed || 0,
                        stats.statusCounts['no-show'] || 0
                    ],
                    backgroundColor: ['#198754', '#dc3545', '#ffc107', '#6c757d']
                }]
            },
            options: { plugins: { legend: { position: 'right' } } }
        });
    }

    function exportReport(type = 'pdf') {
        if (!Lactario._currentStats) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        const stats = Lactario._currentStats;
        const range = Lactario._currentRange || '7days';

        if (type === 'pdf') {
            PDFGenerator.generateLactarioReport(stats, range);
        } else if (type === 'excel') {
            // Simple CSV Export
            let csv = 'Fecha,Visitas\n';
            Object.keys(stats.visitsByDate).forEach(d => {
                csv += `${d},${stats.visitsByDate[d]}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Lactario_Reporte_${Date.now()}.csv`; // Excel opens CSV natively
            a.click();
        } else if (type === 'word') {
            // Basic HTML Doc for Word
            const html = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>Reporte Lactario</title></head>
                <body>
                    <h1>Reporte lactario (${range})</h1>
                    <p>Total Visitas: ${stats.total}</p>
                    <p>Hora Pico: ${stats.peakHour}</p>
                    <table border="1">
                        <tr><th>Fecha</th><th>Visitas</th></tr>
                        ${Object.keys(stats.visitsByDate).map(d => `<tr><td>${d}</td><td>${stats.visitsByDate[d]}</td></tr>`).join('')}
                    </table>
                </body></html>
             `;
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Lactario_${Date.now()}.doc`;
            a.click();
        }
    }

    async function loadAdminSpaces() {
        const list = document.getElementById('admin-spaces-list');
        list.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';
        try {
            const spaces = await LactarioService.getSpaces(_ctx);
            list.innerHTML = spaces.map(s => `
                <div class="d-flex justify-content-between align-items-center p-3 bg-white border shadow-sm rounded-4 mb-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="bg-light p-2 rounded-circle text-maternal">
                            <i class="bi bi-door-closed-fill fs-4"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${s.name}</div>
                            <div class="extra-small text-muted">ID: ${s.id}</div>
                            <span class="badge ${s.active ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                                ${s.active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                         <div class="form-check form-switch pt-1 me-2" title="Activar/Desactivar">
                            <input class="form-check-input" style="cursor: pointer;" type="checkbox" onchange="Lactario.toggleSpace('${s.id}', this.checked)" ${s.active ? 'checked' : ''}>
                            <label class="form-check-label small ms-1 text-muted">${s.active ? 'On' : 'Off'}</label>
                        </div>
                        <button class="btn btn-sm btn-outline-primary border-0" onclick="Lactario.editSpace('${s.id}', '${s.name}')" title="Editar"><i class="bi bi-pencil-fill"></i></button>
                        <button class="btn btn-sm btn-outline-dark border-0" onclick="Lactario.printQR('${s.id}', '${s.name}')" title="Imprimir QR"><i class="bi bi-qr-code"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="Lactario.deleteSpace('${s.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    </div>
                </div >
    `).join('');
        } catch (e) { list.innerHTML = `<div class="text-danger small">Error: ${e.message}</div>`; }
    }

    // --- MODAL HELPER ---
    function showModalForm(title, inputs, onSave) {
        document.getElementById('lacModalTitle').innerText = title;
        const form = document.getElementById('lacModalForm');
        form.innerHTML = inputs.map(i => `
            <div class="mb-3">
                <label class="form-label extra-small text-muted fw-bold">${i.label}</label>
                <input type="${i.type || 'text'}" class="form-control form-control-sm rounded-pill" id="${i.id}" value="${i.value || ''}" placeholder="${i.placeholder || ''}">
            </div>
        `).join('');

        const btnSave = document.getElementById('lacModalSave');
        const newBtn = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtn, btnSave);

        newBtn.onclick = async () => {
            const values = {};
            inputs.forEach(i => values[i.id] = document.getElementById(i.id).value);

            newBtn.disabled = true;
            newBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

            try {
                await onSave(values);
                const modalEl = document.getElementById('modalLactarioAdmin');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            } catch (e) { showToast(e.message, 'danger'); }
            finally {
                newBtn.disabled = false;
                newBtn.innerText = 'Guardar';
            }
        };

        const modal = new bootstrap.Modal(document.getElementById('modalLactarioAdmin'));
        modal.show();
    }

    // --- SPACE ACTIONS ---
    function addSpacePrompt() {
        showModalForm('Nuevo Espacio', [
            { id: 'sName', label: 'Nombre', placeholder: 'Ej. Sala 1' }
        ], async (vals) => {
            if (!vals.sName) throw new Error('El nombre es requerido');
            await LactarioService.addSpace(_ctx, vals.sName);
            loadAdminSpaces();
        });
    }

    function editSpace(id, name) {
        showModalForm('Editar Espacio', [
            { id: 'eSName', label: 'Nombre', value: name }
        ], async (vals) => {
            if (!vals.eSName) throw new Error('El nombre es requerido');
            await LactarioService.updateSpace(_ctx, id, { name: vals.eSName });
            loadAdminSpaces();
        });
    }

    // --- FRIDGE ACTIONS ---
    function addFridgePrompt() {
        showModalForm('Nuevo Refrigerador', [
            { id: 'fName', label: 'Nombre', placeholder: 'Ej. Refri Principal' },
            { id: 'fLimit', label: 'Capacidad (Espacios)', type: 'number', value: '10' }
        ], async (vals) => {
            if (!vals.fName) throw new Error('El nombre es requerido');
            // Assuming addFridge update in service or we send just name and update later?
            // Current service `addFridge` only takes name. 
            // We will update logic to be cleaner in next iteration if needed, but for now:
            await LactarioService.addFridge(_ctx, vals.fName);
            // Ideally we should update the limit immediately after, but `addFridge` returns ref.
            // Let's stick to Name only for ADD to avoid service mismatch without reading it again.
            // Wait, previous attempt analysis: I saw `addFridge(ctx, name)` in service.
            loadAdminFridges();
        });
    }

    function editFridge(id, name, limit) {
        showModalForm('Editar Refrigerador', [
            { id: 'eName', label: 'Nombre', value: name },
            { id: 'eLimit', label: 'Capacidad', type: 'number', value: limit }
        ], async (vals) => {
            if (!vals.eName) throw new Error('El nombre es requerido');
            await LactarioService.updateFridge(_ctx, id, {
                name: vals.eName,
                limit: parseInt(vals.eLimit) || 10
            });
            loadAdminFridges();
        });
    }

    async function toggleSpace(id, state) {
        await LactarioService.toggleSpace(_ctx, id, state);
        loadAdminSpaces();
    }

    async function deleteSpace(id) {
        if (confirm('¿Seguro que deseas eliminar este cubículo permanentemente?')) {
            await LactarioService.deleteSpace(_ctx, id);
            loadAdminSpaces();
        }
    }

    function printQR(id, name) {
        // Generar una ventana de impresión simple o un PDF
        const w = window.open('', '_blank');
        w.document.write(`
            <html>
            <body style="text-align:center; font-family: sans-serif; padding: 20px;">
        <br><br>
            <div id="qrcode" style="display:inline-block; margin-bottom:20px;"></div>
            <h1 style="margin:0; font-size: 2em;">${name}</h1>
            <p style="color:gray; font-size:1.2em;">${id}</p>

            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
                <script>
                    new QRCode(document.getElementById("qrcode"), {
                        text: "${id}",
                    width: 300,
                    height: 300
                        });
                        setTimeout(() => window.print(), 800);
                    <\/script>
                </body>
            </html>
            `);
        w.document.close();
    }

    return {
        init,
        openScanner,
        // handleScan public no longer needed if internal
        cancelBooking,
        addSpacePrompt,
        printQR,
        openFridgeModal,
        confirmFridgeUse,
        // Admin prompt replacements
        addFridgePrompt,
        editFridge,
        editSpace,
        // ...
        switchAdminTab,
        toggleSpace,
        deleteSpace,
        saveAdminConfig,
        selectDateTab,
        // Stats & Export
        loadAdminStats,
        exportReport,
        // Fridge
        addFridgePrompt,
        toggleFridge,
        editFridge,
        deleteFridge,
        // Space
        editSpace
    };

})();

window.Lactario = Lactario;
