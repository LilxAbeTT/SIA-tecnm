const Biblio = (function () {
    let _ctx = null;
    let _searchDebounce = null;
    let _adminStatsInterval = null;

    function init(ctx) {
        _ctx = ctx;

        // 1. Check for Simulated Profile (Dev Mode)
        const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
        const simProfileJson = localStorage.getItem('sia_simulated_profile');
        let role = _ctx.profile?.role || 'student';

        if (isDevMode && simProfileJson) {
            try {
                const sim = JSON.parse(simProfileJson);
                if (sim.role) role = sim.role;
                // Merge permissions if needed
                if (!_ctx.profile) _ctx.profile = sim; // Force context if missing
                console.log(`[Biblio] ⚡ Dev Mode Detectado: Rol ${role}`);
            } catch (e) { console.error(e); }
        }

        // 2. Fallback if profile is missing
        if (!_ctx.profile && _ctx.auth.currentUser && !isDevMode) {
            _ctx.db.collection('usuarios').doc(_ctx.auth.currentUser.uid).get().then(doc => {
                const fetchedRole = doc.data()?.role || 'student';
                if (!_ctx.profile) _ctx.profile = { role: fetchedRole };
                initStudent();
            });
        } else {
            initStudent();
        }
    }

    // ============================================
    //              VISTA ESTUDIANTE v2 (Modernizada)
    // ============================================

    async function initStudent() {
        const container = document.getElementById('view-biblio');
        if (!container) return;

        // Idempotency check
        if (document.getElementById('biblio-student-app')) {
            loadStudentFullData();
            return;
        }

        container.innerHTML = renderStudentStructure();

        // Initiators
        loadStudentFullData();
        renderTopBooksCarousel();
    }

    function renderStudentStructure() {
        return `
            <style>
                #biblio-student-app .nav-pills .nav-link.active {
                    background-color: #FFD24D !important;
                    color: #000 !important;
                    font-weight: 700;
                }
                #biblio-student-app .nav-pills .nav-link {
                    color: #6c757d;
                    transition: all 0.2s;
                    font-size: 0.85rem;
                }
                #biblio-student-app .btn-biblio {
                    background-color: #FFD24D;
                    color: #000;
                    border: none;
                }
                #biblio-student-app .btn-biblio:hover {
                    background-color: #e6be45;
                    color: #000;
                }
                #biblio-student-app .biblio-card-stripe-warning { border-left: 4px solid #FFD24D; }
                #biblio-student-app .biblio-card-stripe-danger { border-left: 4px solid #dc3545; }
                #biblio-student-app .biblio-card-stripe-info { border-left: 4px solid #0dcaf0; }
                #biblio-student-app .biblio-card-stripe-success { border-left: 4px solid #198754; }
                #biblio-student-app .biblio-card-stripe-secondary { border-left: 4px solid #6c757d; }

                /* Mobile responsive */
                @media (max-width: 768px) {
                    #biblio-student-app .biblio-hero { padding: 1.25rem !important; }
                    #biblio-student-app .biblio-hero h2 { font-size: 1.3rem; }
                    #biblio-student-app .biblio-hero-icon { display: none !important; }
                    #biblio-student-app .nav-pills .nav-link { font-size: 0.75rem; padding: 0.4rem 0.5rem; }
                    #biblio-student-app .nav-pills .nav-link i { display: none; }
                    #biblio-student-app .biblio-search-card { order: -1; }
                }
            </style>

            <div id="biblio-student-app">
                <!-- HERO BANNER v2 (Mobile-friendly) -->
                <div class="biblio-hero shadow-sm mb-4" style="background: linear-gradient(135deg, #FFD24D 0%, #fd7e14 100%); border-radius: 1rem; padding: 1.5rem; position: relative; overflow: hidden;">
                    <div class="position-relative z-1">
                        <span class="badge bg-white text-warning mb-2 fw-bold shadow-sm" style="font-size: 0.7rem;">
                            <i class="bi bi-book-half me-1"></i>Biblioteca Digital
                        </span>
                        <h2 class="fw-bold mb-1 text-dark" id="hero-user-name" style="font-size: 1.5rem;">Biblioteca ITES</h2>
                        <p class="small opacity-75 mb-2 text-dark" id="hero-user-subtitle" style="max-width: 70%;">Explora, aprende y crece.</p>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge bg-dark bg-opacity-25 text-white rounded-pill px-2 py-1" id="xp-level-badge" style="font-size: 0.7rem;">NIVEL 1</span>
                            <div class="progress rounded-pill" style="height: 5px; width: 120px; background: rgba(0,0,0,0.15);">
                                <div id="xp-bar-fill" class="progress-bar bg-white rounded-pill" style="width: 0%"></div>
                            </div>
                            <small class="text-dark opacity-75 fw-bold" id="xp-current" style="font-size: 0.7rem;">0 XP</small>
                        </div>
                    </div>
                    <i class="bi bi-book-half biblio-hero-icon position-absolute end-0 top-50 translate-middle-y me-3 text-dark opacity-10" style="font-size: 6rem;"></i>
                </div>

                <!-- ALERTA DEUDA GLOBAL -->
                <div id="debt-alert-sticky" class="alert alert-danger border-0 shadow-sm rounded-4 d-none align-items-center gap-3 mb-4">
                    <i class="bi bi-exclamation-triangle-fill fs-4"></i>
                    <div>
                        <h6 class="fw-bold mb-0">Tienes un adeudo pendiente</h6>
                        <p class="mb-0 small">Debes <strong id="debt-amount">$0.00</strong>. Acude a mostrador para regularizarte.</p>
                    </div>
                </div>

                <!-- CARRUSEL TOP 5 LIBROS -->
                <div class="card border-0 shadow-sm rounded-4 mb-4 bg-dark text-white overflow-hidden">
                    <div class="card-body p-3 position-relative">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-warning text-dark shadow-sm fw-bold">
                                <i class="bi bi-fire me-1"></i>Lo mas leido
                            </span>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-dark bg-white bg-opacity-10 border-0 rounded-circle" onclick="Biblio.scrollCarousel(-1)" style="width:28px;height:28px;"><i class="bi bi-chevron-left small"></i></button>
                                <button class="btn btn-sm btn-dark bg-white bg-opacity-10 border-0 rounded-circle" onclick="Biblio.scrollCarousel(1)" style="width:28px;height:28px;"><i class="bi bi-chevron-right small"></i></button>
                            </div>
                        </div>
                        <div id="biblio-top-carousel" class="d-flex gap-3 overflow-auto pb-2" style="scroll-behavior: smooth; scrollbar-width: none;">
                            <div class="w-100 text-center py-4 text-white-50"><span class="spinner-border spinner-border-sm me-2"></span>Cargando destacados...</div>
                        </div>
                    </div>
                </div>

                <!-- NAV PILLS -->
                <ul class="nav nav-pills nav-fill bg-white p-1 rounded-pill shadow-sm mb-4" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active rounded-pill" data-bs-toggle="pill" data-bs-target="#tab-mochila" type="button" role="tab">
                            <i class="bi bi-backpack2 me-1"></i>Mi Mochila
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#tab-solicitados" type="button" role="tab">
                            <i class="bi bi-clock-history me-1"></i>Solicitados
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#tab-servicios" type="button" role="tab">
                            <i class="bi bi-pc-display me-1"></i>Servicios
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill" data-bs-toggle="pill" data-bs-target="#tab-historial" type="button" role="tab">
                            <i class="bi bi-archive me-1"></i>Historial
                        </button>
                    </li>
                </ul>

                <!-- ACTIONS ROW -->
                <div class="row g-3 mb-4 row-cols-1 row-cols-md-5">
                    <!-- Card 1: Registrar Visita -->
                    <div class="col">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.registrarVisita()">
                            <div class="card-body p-3 text-center">
                                <div class="bg-primary bg-opacity-10 p-2 rounded-3 text-primary d-inline-block mb-2">
                                    <i class="bi bi-person-check fs-4"></i>
                                </div>
                                <h6 class="fw-bold mb-0 small text-dark">Registrar Visita</h6>
                            </div>
                        </div>
                    </div>
                    <!-- Card 2: Solicitar Libro -->
                    <div class="col">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.toggleSearch()">
                            <div class="card-body p-3 text-center">
                                <div class="bg-success bg-opacity-10 p-2 rounded-3 text-success d-inline-block mb-2">
                                    <i class="bi bi-book fs-4"></i>
                                </div>
                                <h6 class="fw-bold mb-0 small text-dark">Solicitar Libro</h6>
                            </div>
                        </div>
                    </div>
                    <!-- Card 3: Reservar PC -->
                    <div class="col">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.abrirModalServicio('pc')">
                            <div class="card-body p-3 text-center">
                                <div class="bg-info bg-opacity-10 p-2 rounded-3 text-info d-inline-block mb-2">
                                    <i class="bi bi-pc-display fs-4"></i>
                                </div>
                                <h6 class="fw-bold mb-0 small text-dark">Reservar PC</h6>
                            </div>
                        </div>
                    </div>
                    <!-- Card 4: Reservar Sala -->
                    <div class="col">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.abrirModalServicio('sala')">
                            <div class="card-body p-3 text-center">
                                <div class="bg-warning bg-opacity-10 p-2 rounded-3 text-warning d-inline-block mb-2">
                                    <i class="bi bi-people fs-4"></i>
                                </div>
                                <h6 class="fw-bold mb-0 small text-dark">Reservar Sala</h6>
                            </div>
                        </div>
                    </div>
                    <!-- Card 5: Mis Adeudos -->
                    <div class="col">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.showDebtModal()">
                            <div class="card-body p-3 text-center">
                                <div class="bg-danger bg-opacity-10 p-2 rounded-3 text-danger d-inline-block mb-2">
                                    <i class="bi bi-cash-coin fs-4"></i>
                                </div>
                                <h6 class="fw-bold mb-0 small text-dark">Mis Adeudos</h6>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB CONTENT -->
                <div class="tab-content">

                    <!-- TAB 1: MI MOCHILA -->
                    <div class="tab-pane fade show active" id="tab-mochila" role="tabpanel">
                        <div class="row g-4">
                            <!-- Col Izquierda: Busqueda + XP -->
                            <div class="col-lg-5">
                                <!-- Buscar en Catalogo (Inline) -->
                                <div class="card border-0 shadow-sm rounded-4 mb-4 biblio-search-card">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold mb-3" style="color: #fd7e14;">
                                            <i class="bi bi-search me-2"></i>Buscar en Catálogo
                                        </h6>
                                        <div class="d-flex gap-2 mb-3">
                                            <input type="text" class="form-control border-0 bg-light rounded-pill" placeholder="Título, autor, código..." id="biblio-quick-search"
                                                   oninput="Biblio.handleInlineSearch(this.value)"
                                                   onkeyup="if(event.key==='Enter' && this.value.length >= 3) Biblio.toggleSearch()">
                                            <button class="btn btn-biblio rounded-pill px-3" onclick="Biblio.toggleSearch()" title="Búsqueda avanzada">
                                                <i class="bi bi-arrow-up-right"></i>
                                            </button>
                                        </div>
                                        <!-- Resultados inline -->
                                        <div id="biblio-inline-results" class="d-none">
                                            <div id="biblio-inline-results-list"></div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Categorías -->
                                <div class="card border-0 shadow-sm rounded-4 mb-4">
                                    <div class="card-body p-3">
                                        <h6 class="fw-bold mb-3 small" style="color: #fd7e14;">
                                            <i class="bi bi-bookmark-star me-2"></i>Explorar por Categoría
                                        </h6>
                                        <div class="d-flex flex-wrap gap-2">
                                            <button class="btn btn-sm  rounded-pill px-3 fw-bold" onclick="Biblio.openCategoryModal('Administración')">
                                                <i class=" bi bi-briefcase me-1 text-primary"></i>Administración
                                            </button>
                                            <button class="btn btn-sm  rounded-pill px-3 fw-bold" onclick="Biblio.openCategoryModal('Arquitectura')">
                                                <i class="bi bi-building me-1 text-info"></i>Arquitectura
                                            </button>
                                            <button class="btn btn-sm  rounded-pill px-3 fw-bold" onclick="Biblio.openCategoryModal('Ciencias Básicas')">
                                                <i class="bi bi-calculator me-1 text-success"></i>Ciencias Básicas
                                            </button>
                                            <button class="btn btn-sm rounded-pill px-3 fw-bold" onclick="Biblio.openCategoryModal('Gastronomía')">
                                                <i class="bi bi-cup-hot me-1 text-warning"></i>Gastronomía
                                            </button>
                                            <button class="btn btn-sm rounded-pill px-3 fw-bold" onclick="Biblio.openCategoryModal('Literatura')">
                                                <i class="bi bi-journal-richtext me-1 text-danger"></i>Literatura
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- XP / Misiones Card -->
                                <div class="card border-0 shadow-sm rounded-4">
                                    <div class="card-body p-4">
                                        <div class="d-flex align-items-center justify-content-between mb-3">
                                            <div>
                                                <span class="badge bg-warning text-dark rounded-pill fw-bold" id="xp-level-badge-card">NIVEL 1</span>
                                                <div class="small text-muted mt-1" id="xp-detail">0 / 500 XP</div>
                                            </div>
                                            <button class="btn btn-outline-dark rounded-pill fw-bold btn-sm" onclick="Biblio.showMissionsModal()">
                                                <i class="bi bi-trophy-fill me-2 text-warning"></i>Misiones
                                            </button>
                                        </div>
                                        <div class="progress rounded-pill" style="height: 8px;">
                                            <div id="xp-bar-fill-card" class="progress-bar bg-warning rounded-pill" style="width: 0%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Col Derecha: Libros En Mano -->
                            <div class="col-lg-7">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h6 class="fw-bold text-muted mb-0"><i class="bi bi-backpack2 me-2"></i>Libros En Mano</h6>
                                    <button class="btn btn-sm btn-light rounded-pill" onclick="Biblio.refreshData()">
                                        <i class="bi bi-arrow-clockwise"></i>
                                    </button>
                                </div>
                                <div id="list-enmano" class="d-flex flex-column gap-3">
                                    <div class="text-center py-5 text-muted">
                                        <span class="spinner-border spinner-border-sm"></span>
                                        <span class="ms-2">Cargando...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 2: SOLICITADOS -->
                    <div class="tab-pane fade" id="tab-solicitados" role="tabpanel">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-muted mb-0"><i class="bi bi-clock-history me-2"></i>Solicitudes Pendientes</h6>
                        </div>
                        <div id="list-solicitados" class="d-flex flex-column gap-3">
                            <div class="text-center py-5 text-muted">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando...</span>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 3: SERVICIOS DIGITALES -->
                    <div class="tab-pane fade" id="tab-servicios" role="tabpanel">
                        <h6 class="fw-bold text-muted mb-3"><i class="bi bi-grid me-2"></i>Servicios Disponibles</h6>
                        <div class="row g-3 mb-4">
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.abrirModalServicio('pc')">
                                    <div class="card-body p-4 d-flex align-items-center gap-3">
                                        <div class="bg-primary bg-opacity-10 p-3 rounded-4 text-primary">
                                            <i class="bi bi-pc-display fs-3"></i>
                                        </div>
                                        <div class="flex-grow-1">
                                            <h6 class="fw-bold mb-1 text-dark">Reservar Computadora</h6>
                                            <small class="text-muted">Consultar disponibilidad de equipos</small>
                                        </div>
                                        <i class="bi bi-chevron-right text-muted"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100 hover-lift" style="cursor:pointer;" onclick="Biblio.abrirModalServicio('sala')">
                                    <div class="card-body p-4 d-flex align-items-center gap-3">
                                        <div class="bg-success bg-opacity-10 p-3 rounded-4 text-success">
                                            <i class="bi bi-people fs-3"></i>
                                        </div>
                                        <div class="flex-grow-1">
                                            <h6 class="fw-bold mb-1 text-dark">Sala de Estudio</h6>
                                            <small class="text-muted">Reservar sala para trabajo en equipo</small>
                                        </div>
                                        <i class="bi bi-chevron-right text-muted"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Mis Reservas -->
                        <h6 class="fw-bold text-muted mb-3"><i class="bi bi-calendar-check me-2"></i>Mis Reservas</h6>
                        <div id="list-mis-reservas">
                            <div class="text-center py-4 text-muted bg-light rounded-4">
                                <i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>
                                <p class="mb-0 small">No tienes reservas activas.</p>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 4: HISTORIAL -->
                    <div class="tab-pane fade" id="tab-historial" role="tabpanel">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold text-muted mb-0"><i class="bi bi-archive me-2"></i>Historial de Libros</h6>
                        </div>
                        <div id="list-historial" class="d-flex flex-column gap-3">
                            <div class="text-center py-5 text-muted">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando...</span>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- MODALES -->

                <!-- Modal Misiones -->
                <div class="modal fade" id="modal-misiones" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow-lg overflow-hidden" id="misiones-content"></div>
                    </div>
                </div>

                <!-- Modal Busqueda Global -->
                <div class="modal fade" id="modal-search-global" tabindex="-1">
                    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content rounded-4 border-0 shadow-lg bg-light">
                            <div class="modal-header border-0 bg-white sticky-top py-3">
                                <div class="input-group input-group-lg bg-light rounded-pill border overflow-hidden">
                                    <span class="input-group-text border-0 bg-transparent ps-4"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control border-0 bg-transparent shadow-none" placeholder="Titulo, autor, codigo..." id="global-search-input" oninput="Biblio.handleGlobalSearch(this.value)">
                                    <button class="btn btn-white border-0" onclick="document.getElementById('global-search-input').value=''; Biblio.handleGlobalSearch('')"><i class="bi bi-x-circle-fill text-muted"></i></button>
                                </div>
                                <button class="btn-close ms-3" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-4">
                                <h6 class="fw-bold text-muted mb-3" id="search-results-title">Explorar</h6>
                                <div class="row g-3" id="global-search-results">
                                    <div class="col-12 text-center py-5 text-muted opacity-50">
                                        <i class="bi bi-book fs-1 mb-3 d-block"></i>
                                        Escribe para buscar en el catalogo
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Detalle Libro -->
                <div class="modal fade" id="modal-libro-detalle" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow-lg" id="libro-detalle-content"></div>
                    </div>
                </div>

                <!-- Modal Servicio Reserva -->
                <div class="modal fade" id="modal-servicio-reserva" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content rounded-4 border-0 shadow-lg" id="servicio-reserva-content"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- CARRUSEL TOP 5 (Mas prestados) ---
    async function renderTopBooksCarousel() {
        const container = document.getElementById('biblio-top-carousel');
        if (!container) return;

        try {
            // Intentar cargar los mas prestados
            let books = await BiblioService.getTopBooks(_ctx, 5);

            // Fallback: si no hay historial de prestamos, usar catalogo
            if (!books || books.length === 0) {
                books = await BiblioService.searchCatalogo(_ctx, 'a');
            }

            if (!books || books.length === 0) {
                container.innerHTML = '<div class="w-100 text-center py-4 text-white-50 small">No hay libros destacados por ahora.</div>';
                return;
            }

            const top5 = books.slice(0, 5);
            const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#ff5722', '#795548', '#607d8b'];

            container.innerHTML = top5.map((book, i) => {
                const titulo = (book.titulo || '?').replace(/'/g, "\\'");
                const autor = (book.autor || '').replace(/'/g, "\\'");
                const prestamos = book._prestamos ? `<span class="text-white-50" style="font-size:0.6rem;">${book._prestamos}x prestado</span>` : '';
                return `
                    <div class="flex-shrink-0 text-center" style="width: 110px; cursor: pointer;" onclick="Biblio.verDetalleLibro('${book.id}', '${titulo}', '${autor}', ${book.copiasDisponibles || 0})">
                        <div class="card border-0 shadow-lg overflow-hidden rounded-3 mx-auto" style="width: 100px;">
                            <div class="d-flex align-items-center justify-content-center text-white fw-bold" style="height: 130px; font-size: 2.5rem; background: linear-gradient(to bottom right, ${colors[i % colors.length]}, #222);">
                                ${(book.titulo || '?').charAt(0)}
                            </div>
                        </div>
                        <p class="text-white small mt-2 mb-0 text-truncate" style="max-width: 110px; font-size: 0.7rem;">${book.titulo}</p>
                        ${prestamos}
                    </div>`;
            }).join('');

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="w-100 text-center py-4 text-white-50 small">Error cargando libros.</div>';
        }
    }

    function scrollCarousel(dir) {
        const c = document.getElementById('biblio-top-carousel');
        if (c) c.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }

    // --- INLINE SEARCH ---
    let _inlineSearchDebounce = null;

    function handleInlineSearch(val) {
        if (_inlineSearchDebounce) clearTimeout(_inlineSearchDebounce);

        const wrapper = document.getElementById('biblio-inline-results');
        const container = document.getElementById('biblio-inline-results-list');
        if (!wrapper || !container) return;

        if (!val || val.length < 3) {
            wrapper.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        wrapper.classList.remove('d-none');
        container.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

        _inlineSearchDebounce = setTimeout(async () => {
            try {
                const results = await BiblioService.searchCatalogo(_ctx, val);
                if (!results || results.length === 0) {
                    container.innerHTML = '<p class="text-muted small text-center mb-0 py-2">Sin resultados</p>';
                    return;
                }

                container.innerHTML = results.slice(0, 5).map(book => `
                    <div class="d-flex align-items-center gap-2 p-2 rounded-3 hover-lift" style="cursor:pointer;"
                         onclick="Biblio.verDetalleLibro('${book.id}', '${(book.titulo || '').replace(/'/g, "\\'")}', '${(book.autor || '').replace(/'/g, "\\'")}', ${book.copiasDisponibles || 0})">
                        <div class="bg-light rounded-2 p-2 text-center" style="min-width:36px;">
                            <i class="bi bi-book text-muted"></i>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="fw-bold small text-truncate">${book.titulo}</div>
                            <div class="text-muted" style="font-size:0.7rem;">${book.autor || ''}</div>
                        </div>
                        <span class="badge ${book.copiasDisponibles > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill" style="font-size:0.65rem;">
                            ${book.copiasDisponibles > 0 ? book.copiasDisponibles : 'Agotado'}
                        </span>
                    </div>
                `).join('') + (results.length > 5 ? `
                    <div class="text-center mt-2">
                        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="Biblio.toggleSearch()">
                            <i class="bi bi-search me-1"></i>Ver todos (${results.length})
                        </button>
                    </div>` : '');
            } catch (e) {
                container.innerHTML = '<p class="text-danger small text-center mb-0 py-2">Error en búsqueda</p>';
            }
        }, 400);
    }

    // --- SEARCH (Modal Global) ---
    function toggleSearch() {
        const inlineVal = document.getElementById('biblio-quick-search')?.value || '';
        // Reset title and placeholder
        const titleEl = document.getElementById('search-results-title');
        if (titleEl) titleEl.textContent = 'Explorar';
        const globalInput = document.getElementById('global-search-input');
        if (globalInput) globalInput.placeholder = 'Título, autor, código...';

        new bootstrap.Modal(document.getElementById('modal-search-global')).show();
        setTimeout(() => {
            if (globalInput) {
                globalInput.value = inlineVal;
                globalInput.focus();
                if (inlineVal.length >= 3) handleGlobalSearch(inlineVal);
            }
        }, 500);
    }

    function handleGlobalSearch(val) {
        if (_searchDebounce) clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(async () => {
            const container = document.getElementById('global-search-results');
            if (!container) return;
            if (!val || val.length < 3) {
                container.innerHTML = '<div class="col-12 text-center text-muted opacity-50 py-5">Ingresa al menos 3 caracteres...</div>';
                return;
            }

            container.innerHTML = '<div class="col-12 text-center text-primary py-5"><div class="spinner-border"></div></div>';

            try {
                const results = await BiblioService.searchCatalogo(_ctx, val);
                if (!results || results.length === 0) {
                    container.innerHTML = '<div class="col-12 text-center text-muted py-5">No se encontraron resultados.</div>';
                    return;
                }

                container.innerHTML = results.map(book => `
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-3 hover-lift" style="cursor:pointer;" onclick="Biblio.verDetalleLibro('${book.id}', '${(book.titulo || '').replace(/'/g, "\\'")}', '${(book.autor || '').replace(/'/g, "\\'")}', ${book.copiasDisponibles})">
                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                <div class="bg-light rounded-3 p-3 text-center text-muted fw-bold" style="min-width: 50px;">
                                    <i class="bi bi-book fs-4"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="fw-bold mb-1 text-dark">${book.titulo}</h6>
                                    <p class="small text-muted mb-0">${book.autor}</p>
                                </div>
                                <div class="text-end">
                                    <span class="badge ${book.copiasDisponibles > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill d-block mb-1">
                                        ${book.copiasDisponibles > 0 ? 'Disponible' : 'Agotado'}
                                    </span>
                                    <small class="text-muted" style="font-size:0.7rem;">Ver detalle <i class="bi bi-chevron-right"></i></small>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (e) {
                container.innerHTML = `<div class="col-12 text-center text-danger">Error: ${e.message}</div>`;
            }
        }, 500);
    }

    // --- CATEGORÍA MODAL ---
    async function openCategoryModal(category) {
        // Abrir el modal de búsqueda global
        const modal = new bootstrap.Modal(document.getElementById('modal-search-global'));
        modal.show();

        const titleEl = document.getElementById('search-results-title');
        const container = document.getElementById('global-search-results');
        const globalInput = document.getElementById('global-search-input');

        if (titleEl) titleEl.innerHTML = `<i class="bi bi-bookmark-star-fill me-2 text-warning"></i>Categoría: ${category}`;
        if (globalInput) { globalInput.value = ''; globalInput.placeholder = `Buscar en ${category}...`; }
        if (container) container.innerHTML = '<div class="col-12 text-center text-primary py-5"><div class="spinner-border"></div></div>';

        try {
            const books = await BiblioService.getBooksByCategory(_ctx, category, 15);
            if (!books || books.length === 0) {
                container.innerHTML = `<div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-search fs-1 d-block mb-2 opacity-50"></i>
                    No se encontraron libros en esta categoría.
                </div>`;
                return;
            }

            container.innerHTML = books.map(book => `
                <div class="col-12">
                    <div class="card border-0 shadow-sm rounded-3 hover-lift" style="cursor:pointer;" onclick="Biblio.verDetalleLibro('${book.id}', '${(book.titulo || '').replace(/'/g, "\\'")}', '${(book.autor || '').replace(/'/g, "\\'")}', ${book.copiasDisponibles || 0})">
                        <div class="card-body d-flex align-items-center gap-3 p-3">
                            <div class="bg-light rounded-3 p-3 text-center text-muted fw-bold" style="min-width: 50px;">
                                <i class="bi bi-book fs-4"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-1 text-dark">${book.titulo}</h6>
                                <p class="small text-muted mb-0">${book.autor || 'Autor desconocido'}</p>
                            </div>
                            <div class="text-end">
                                <span class="badge ${(book.copiasDisponibles || 0) > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill d-block mb-1">
                                    ${(book.copiasDisponibles || 0) > 0 ? 'Disponible' : 'Agotado'}
                                </span>
                                <small class="text-muted" style="font-size:0.7rem;">Ver detalle <i class="bi bi-chevron-right"></i></small>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = `<div class="col-12 text-center text-danger py-5">Error: ${e.message}</div>`;
        }
    }

    // --- REGISTRAR VISITA (MANUAL) ---
    async function registrarVisita() {
        if (!confirm("¿Registrar tu visita a la biblioteca hoy?")) return;
        try {
            // Aquí idealmente habría una llamada al backend para validar ubicación o QR
            // Por ahora simulamos y registramos para la encuesta

            showToast("¡Bienvenido! Visita registrada.", "success");

            // [ENCUESTAS] Registrar uso
            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'visita_manual' });
            }

            // check if survey should trigger immediately
            if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
                setTimeout(() => window.Encuestas.checkAndShowServiceSurvey('biblioteca'), 1000);
            }

        } catch (e) { console.error(e); }
    }

    // --- DETALLE Y SOLICITUD DE LIBRO ---
    function verDetalleLibro(id, titulo, autor, stock) {
        const modalContent = document.getElementById('libro-detalle-content');
        if (!modalContent) return;
        modalContent.innerHTML = `
            <div class="modal-header border-0 p-4">
                <div>
                    <h5 class="modal-title fw-bold text-dark">${titulo}</h5>
                    <p class="mb-0 small text-muted">${autor}</p>
                </div>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4">
                <div class="alert ${stock > 0 ? 'alert-success' : 'alert-secondary'} d-flex align-items-center gap-2 rounded-3">
                    <i class="bi ${stock > 0 ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                    <div>Stock: <strong>${stock}</strong> copias disponibles</div>
                </div>
                <p class="small text-muted">ID: ${id}</p>
            </div>
            <div class="modal-footer border-0 px-4 pb-4">
                <button class="btn btn-biblio w-100 rounded-pill fw-bold" ${stock < 1 ? 'disabled' : ''} onclick="Biblio.solicitarLibro('${id}', '${(titulo || '').replace(/'/g, "\\'")}')">
                    <i class="bi bi-bag-plus me-2"></i>Solicitar para recoger
                </button>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-libro-detalle')).show();
    }

    async function solicitarLibro(id, titulo) {
        try {
            await BiblioService.apartarLibro(_ctx, { uid: _ctx.auth.currentUser.uid, email: _ctx.auth.currentUser.email, bookId: id, titulo: titulo });
            showToast("Libro apartado. Tienes 24h para recogerlo.", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-libro-detalle'))?.hide();
            loadStudentFullData();

            // [ENCUESTAS] Registrar uso
            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'solicitud_libro', bookId: id });
            }
        } catch (e) { showToast(e.message, "danger"); }
    }

    // --- MISIONES ---
    function showMissionsModal() {
        const currentLvl = document.getElementById('xp-level-badge')?.innerText || 'NIVEL 1';
        const currentXP = parseInt(document.getElementById('xp-current')?.innerText) || 0;

        const content = document.getElementById('misiones-content');
        if (!content) return;

        const missions = [
            { icon: 'bi-check-circle-fill', title: 'Primeros Pasos', desc: 'Inicia sesion por primera vez.', xp: 50, done: currentXP > 0 },
            { icon: 'bi-book-half', title: 'Raton de Biblioteca', desc: 'Solicita y devuelve 3 libros a tiempo.', xp: 150, done: false, progress: '0/3' },
            { icon: 'bi-geo-alt-fill', title: 'Visitante Frecuente', desc: 'Registra tu asistencia en recepcion 5 veces.', xp: 100, done: false, progress: '1/5' },
            { icon: 'bi-pc-display', title: 'Era Digital', desc: 'Reserva una computadora 3 veces.', xp: 75, done: false, progress: '0/3' },
            { icon: 'bi-people-fill', title: 'Trabajo en Equipo', desc: 'Reserva una sala de estudio.', xp: 50, done: false, progress: '0/1' }
        ];

        content.innerHTML = `
            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, #FFD24D, #fd7e14);">
                <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-trophy-fill me-2"></i>Misiones y Logros</h5>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
                <div class="p-4 text-center">
                    <h3 class="fw-bold">${currentLvl}</h3>
                    <p class="mb-0 text-muted small">Experiencia acumulada: ${currentXP} XP</p>
                </div>
                <div class="list-group list-group-flush">
                    ${missions.map(m => `
                        <div class="list-group-item p-3 d-flex align-items-center">
                            <div class="me-3 fs-3 ${m.done ? 'text-success' : 'text-secondary opacity-25'}"><i class="bi ${m.icon}"></i></div>
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-1 small">${m.title}</h6>
                                <small class="text-muted">${m.desc}</small>
                                ${m.progress && !m.done ? `<div class="progress mt-2" style="height: 4px;"><div class="progress-bar bg-warning" style="width: 20%"></div></div>` : ''}
                            </div>
                            <span class="badge ${m.done ? 'bg-success' : 'bg-warning text-dark'} rounded-pill ms-2">${m.done ? 'OK' : `+${m.xp}`}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-misiones')).show();
    }

    // --- PRESTAMO: DETALLE, EXTENSION, CANCELACION ---
    function verDetallePrestamo(id) {
        const content = document.getElementById('libro-detalle-content');
        if (!content) return;
        content.innerHTML = `
            <div class="modal-header border-0 p-4">
                <h5 class="fw-bold">Detalle de Prestamo</h5>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center p-4">
                <div class="bg-light rounded-3 p-4 mb-3 d-inline-block">
                    <i class="bi bi-book fs-1 text-primary"></i>
                </div>
                <h6 class="fw-bold mb-1">ID: ${id}</h6>
                <p class="text-muted small">Recuerda entregar tus libros a tiempo para ganar XP y evitar multas.</p>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-libro-detalle')).show();
    }

    async function solicitarExtension(loanId) {
        if (!confirm("Solicitar extension de 1 dia? (Solo valido 1 vez)")) return;
        try {
            await BiblioService.extenderPrestamo(_ctx, loanId);
            showToast("Extension aplicada", "success");
            loadStudentFullData();
        } catch (e) { showToast(e.message, "danger"); }
    }

    async function cancelarSolicitud(loanId) {
        if (!confirm("Cancelar solicitud?")) return;
        try {
            await BiblioService.cancelarSolicitud(_ctx, loanId);
            showToast("Solicitud cancelada", "success");
            loadStudentFullData();
        } catch (e) { showToast(e.message, "danger"); }
    }

    // --- CARGA DE DATOS ESTUDIANTE ---
    async function loadStudentFullData() {
        if (!_ctx.auth.currentUser) return;
        try {
            const tempProfile = await BiblioService.getPerfilBibliotecario(_ctx, _ctx.auth.currentUser.uid);
            if (tempProfile && tempProfile.xp === 0) {
                await BiblioService.procesarRecompensa(_ctx, _ctx.auth.currentUser.uid, 'first_login');
            }

            const perfil = await BiblioService.getPerfilBibliotecario(_ctx, _ctx.auth.currentUser.uid);
            if (!perfil) return;

            // [ENCUESTAS] Verificar encuesta de servicio
            if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
                setTimeout(() => window.Encuestas.checkAndShowServiceSurvey('biblioteca'), 2000);
            }

            // Hero banner
            const heroName = document.getElementById('hero-user-name');
            const heroSub = document.getElementById('hero-user-subtitle');
            if (heroName) heroName.textContent = `Hola, ${(perfil.nombre || 'Estudiante').split(' ')[0]}`;
            if (heroSub) heroSub.textContent = `${perfil.matricula || ''} - Explora, aprende y crece.`;

            // XP (hero)
            const elLvlBadge = document.getElementById('xp-level-badge');
            const elCur = document.getElementById('xp-current');
            const elBar = document.getElementById('xp-bar-fill');
            const nextLevelXP = perfil.nivel * 500;
            const progress = Math.min((perfil.xp / nextLevelXP) * 100, 100);

            if (elLvlBadge) elLvlBadge.innerText = `NIVEL ${perfil.nivel}`;
            if (elCur) elCur.innerText = `${perfil.xp} XP`;
            if (elBar) elBar.style.width = `${progress}%`;

            // XP (card in mochila tab)
            const elLvlCard = document.getElementById('xp-level-badge-card');
            const elDetailCard = document.getElementById('xp-detail');
            const elBarCard = document.getElementById('xp-bar-fill-card');
            if (elLvlCard) elLvlCard.innerText = `NIVEL ${perfil.nivel}`;
            if (elDetailCard) elDetailCard.innerText = `${perfil.xp} / ${nextLevelXP} XP`;
            if (elBarCard) elBarCard.style.width = `${progress}%`;

            // Debt Alert (global, visible in all tabs)
            const debtBox = document.getElementById('debt-alert-sticky');
            const debtAmt = document.getElementById('debt-amount');
            if (debtBox && debtAmt) {
                if (perfil.deudaTotal > 0) {
                    debtBox.classList.remove('d-none');
                    debtBox.classList.add('d-flex');
                    debtAmt.innerText = `$${perfil.deudaTotal.toFixed(2)}`;
                } else {
                    debtBox.classList.add('d-none');
                    debtBox.classList.remove('d-flex');
                }
            }

            // Guardar listas completas para "ver mas"
            _fullLists['list-enmano'] = perfil.recogidos;
            _fullLists['list-solicitados'] = perfil.solicitados;
            _fullLists['list-historial'] = perfil.historial.slice(0, 20);

            // Render lists (muestra solo los primeros 3)
            renderBookList('list-enmano', perfil.recogidos, 'recogido');
            renderBookList('list-solicitados', perfil.solicitados, 'solicitado');
            renderBookList('list-historial', perfil.historial.slice(0, 20), 'historial');

            // Load reservations
            loadMisReservas();

        } catch (e) { console.error("Error cargando perfil:", e); }
    }

    function refreshData() {
        loadStudentFullData();
        showToast("Datos actualizados", "info");
    }

    // --- RENDER BOOK LIST (Modernizado + Lazy: 3 items + ver mas) ---
    const INITIAL_SHOW = 3;

    function renderBookList(containerId, list, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (!list || list.length === 0) {
            const emptyMessages = {
                recogido: 'No tienes libros en mano.',
                solicitado: 'No tienes solicitudes pendientes.',
                historial: 'Tu historial esta vacio.'
            };
            const emptyIcons = {
                recogido: 'bi-backpack2',
                solicitado: 'bi-clock-history',
                historial: 'bi-archive'
            };
            container.innerHTML = `
                <div class="text-center py-4 text-muted bg-light rounded-4">
                    <i class="bi ${emptyIcons[type] || 'bi-inbox'} fs-1 d-block mb-2 opacity-50"></i>
                    <p class="mb-0 small">${emptyMessages[type] || 'No hay elementos.'}</p>
                </div>`;
            return;
        }

        // Mostrar solo los primeros INITIAL_SHOW items
        const visibleItems = list.slice(0, INITIAL_SHOW);
        const hasMore = list.length > INITIAL_SHOW;

        visibleItems.forEach(item => container.appendChild(_createBookCard(item, type)));

        // Boton "ver mas" si hay items ocultos
        if (hasMore) {
            const moreBtn = document.createElement('div');
            moreBtn.className = 'text-center mt-2';
            moreBtn.id = `btn-more-${containerId}`;
            moreBtn.innerHTML = `
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-4" onclick="Biblio.showAllItems('${containerId}', '${type}')">
                    <i class="bi bi-chevron-down me-1"></i>Ver todos (${list.length})
                </button>`;
            container.appendChild(moreBtn);
        }
    }

    // Almacenar listas completas para "ver mas"
    let _fullLists = {};

    function showAllItems(containerId, type) {
        const list = _fullLists[containerId];
        if (!list) return;
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        list.forEach(item => container.appendChild(_createBookCard(item, type)));
    }

    function _createBookCard(item, type) {
        const el = document.createElement('div');

        let statusColor = 'secondary';
        let statusText = 'Desconocido';
        let mainDate = '';
        let dateLabel = '';
        let actionBtn = '';
        let alertLate = false;

        if (type === 'recogido') {
            const venc = item.fechaVencimiento?.toDate ? item.fechaVencimiento.toDate() : null;
            const now = new Date();
            const isToday = venc && now.toDateString() === venc.toDateString();
            const isLate = venc && now > venc;
            const isAfter3PM = now.getHours() >= 15;

            alertLate = (isToday && isAfter3PM) || isLate;
            statusColor = isLate ? 'danger' : (isToday ? 'info' : 'warning');
            statusText = isLate ? 'VENCIDO' : (isToday ? 'VENCE HOY' : 'EN PRESTAMO');
            mainDate = venc ? venc.toLocaleDateString() : '???';
            dateLabel = 'Fecha Limite';

            const canExtend = !isLate && !isToday;
            actionBtn = `
                <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="Biblio.verDetallePrestamo('${item.id}')">
                    <i class="bi bi-eye me-1"></i>Detalle
                </button>
                ${canExtend ? `<button class="btn btn-sm btn-outline-warning rounded-pill ms-2" onclick="Biblio.solicitarExtension('${item.id}')">
                    <i class="bi bi-plus-circle me-1"></i>+1 Dia
                </button>` : ''}
            `;

        } else if (type === 'solicitado') {
            const exp = item.fechaExpiracionRecoleccion?.toDate ? item.fechaExpiracionRecoleccion.toDate() : null;
            statusColor = 'info';
            statusText = 'APROBADO';
            mainDate = exp ? `${exp.toLocaleDateString()} ${exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '???';
            dateLabel = 'Recoger antes de';
            actionBtn = `<button class="btn btn-sm btn-outline-danger rounded-pill" onclick="Biblio.cancelarSolicitud('${item.id}')">
                <i class="bi bi-x-circle me-1"></i>Cancelar
            </button>`;

        } else if (type === 'historial') {
            statusColor = item.estado === 'finalizado' ? 'success' : (item.estado === 'cobro_pendiente' ? 'danger' : 'secondary');
            statusText = item.estado === 'finalizado' ? 'DEVUELTO' : (item.estado === 'cobro_pendiente' ? 'CON MULTA' : (item.estado || 'N/A').toUpperCase());
            const devol = item.fechaDevolucionReal?.toDate ? item.fechaDevolucionReal.toDate().toLocaleDateString() : '';
            mainDate = devol;
            dateLabel = 'Devuelto el';
        }

        el.className = `card border-0 shadow-sm rounded-4 overflow-hidden biblio-card-stripe-${statusColor} mb-3`;
        el.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-${statusColor}-subtle text-${statusColor} rounded-pill fw-bold small">${statusText}</span>
                    ${alertLate ? '<i class="bi bi-alarm-fill text-danger fs-5" title="Devolver urgentemente"></i>' : ''}
                </div>
                <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">${item.tituloLibro || 'Libro Desconocido'}</h6>
                <div class="d-flex align-items-center text-muted small mb-2">
                    <i class="bi bi-calendar-event me-2"></i>${dateLabel}: <strong class="ms-1 text-dark">${mainDate}</strong>
                </div>
                ${actionBtn ? `<div class="d-flex justify-content-end gap-2">${actionBtn}</div>` : ''}
            </div>
        `;
        return el;
    }

    // --- MIS RESERVAS ---
    async function loadMisReservas() {
        const container = document.getElementById('list-mis-reservas');
        if (!container) return;
        try {
            const reservas = await BiblioAssetsService.getMyReservations(_ctx, _ctx.auth.currentUser.uid);
            if (!reservas || reservas.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4 text-muted bg-light rounded-4">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>
                        <p class="mb-0 small">No tienes reservas activas.</p>
                    </div>`;
                return;
            }
            container.innerHTML = reservas.map(r => `
                <div class="card border-0 shadow-sm rounded-3 mb-2">
                    <div class="card-body p-3 d-flex align-items-center gap-3">
                        <div class="bg-${r.tipo === 'pc' ? 'primary' : 'success'} bg-opacity-10 p-2 rounded-3">
                            <i class="bi bi-${r.tipo === 'pc' ? 'pc-display' : 'people'} text-${r.tipo === 'pc' ? 'primary' : 'success'}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="fw-bold mb-0 small">${r.assetId}</h6>
                            <small class="text-muted">${r.date} - ${r.hourBlock}</small>
                        </div>
                        <span class="badge bg-${r.status === 'activa' ? 'success' : 'secondary'}-subtle text-${r.status === 'activa' ? 'success' : 'secondary'} rounded-pill">${r.status}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.warn("Error cargando reservas:", e);
        }
    }

    async function sendSuggestion() {
        const t = document.getElementById('sug-titulo')?.value;
        const a = document.getElementById('sug-autor')?.value;
        if (!t) return showToast("Falta titulo", "warning");
        try {
            await BiblioService.addSuggestion(_ctx, { titulo: t, autor: a, by: _ctx.auth.currentUser.uid });
            showToast("Sugerencia enviada", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-sugerencia'))?.hide();
        } catch (e) { showToast("Error enviando", "danger"); }
    }

    // [FIX] Update Dashboard Helper
    async function updateDashboard() {
        try {
            // Count active visits
            const visitsSnap = await _ctx.db.collection('biblio-visitas') // Define Const or use string
                .orderBy('fecha', 'desc')
                .limit(50)
                .get();

            // Filter today
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const todayVisits = visitsSnap.docs.filter(d => d.data().fecha.toDate() >= startOfDay);

            if (document.getElementById('stat-visitas-hoy'))
                document.getElementById('stat-visitas-hoy').innerText = todayVisits.length;

            // Load Access List
            const listContainer = document.getElementById('admin-access-list');
            if (listContainer) {
                listContainer.innerHTML = todayVisits.slice(0, 10).map(d => {
                    const v = d.data();
                    const isTeam = v.motivo === 'Trabajo en Equipo' || v.relatedUsers?.length > 0;
                    return `
                        <div class="d-flex align-items-center justify-content-between p-3 border-bottom">
                            <div class="d-flex align-items-center">
                                <div class="bg-light rounded-circle p-2 me-3">
                                    <i class="bi bi-${isTeam ? 'people' : 'person'} text-primary"></i>
                                </div>
                                <div>
                                    <h6 class="fw-bold mb-0">${v.studentName}</h6>
                                    <small class="text-muted">${v.matricula} &bull; ${v.motivo}</small>
                                </div>
                            </div>
                            <div class="text-end">
                                <span class="text-muted small d-block mb-1">${v.fecha.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-0 mb-1" style="font-size: 0.75rem;" 
                                        onclick="Biblio.terminarVisita('${d.id}', '${v.uid || ''}', '${v.matricula || ''}')">
                                    Salida <i class="bi bi-box-arrow-right ms-1"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

        } catch (e) {
            console.warn("Dashboard update failed", e);
        }
    }

    async function terminarVisita(visitId, uid, matricula) {
        if (!confirm("¿Registrar salida del usuario? Se liberarán sus espacios asignados.")) return;
        try {
            // 1. Release Assets
            let msgDetails = "";
            if (uid) {
                const freed = await BiblioAssetsService.liberarActivoDeUsuario(_ctx, uid);
                if (freed) msgDetails = ` (Liberado: ${freed})`;
            }

            // 2. We could update the 'listing' status if we had one, but currently we just track valid visits.
            // Maybe update 'biblio-visitas' doc to add 'exitTime'?
            await _ctx.db.collection('biblio-visitas').doc(visitId).update({
                salida: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'finalizada'
            });

            showToast(`Salida registrada.${msgDetails}`, "success");
            updateDashboard(); // Refresh list

        } catch (e) { showToast(e.message, "danger"); }
    }


// --- SERVICIOS DIGITALES (PC / SALAS) ---

    let _currentServiceType = null;
    let _selectedAssetId = null;
    let _selectedTimeBlock = null;

    function abrirModalServicio(type) {
        _currentServiceType = type;
        const title = type === 'pc' ? 'Reservar Computadora' : 'Reservar Sala de Estudio';
        const modalContent = document.getElementById('servicio-reserva-content');

        // Date Default: Today
        const today = new Date().toISOString().split('T')[0];

        modalContent.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white">
                <h5 class="fw-bold mb-0"><i class="bi bi-${type === 'pc' ? 'pc-display' : 'people'} me-2"></i>${title}</h5>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                <label class="small fw-bold text-muted mb-2">1. Elige una fecha</label>
                <input type="date" id="service-date-picker" class="form-control rounded-pill mb-4 shadow-sm" value="${today}" min="${today}" onchange="AdminBiblio.renderAvailabilityGrid()">
                
                <label class="small fw-bold text-muted mb-2">2. Disponibilidad</label>
                <div id="service-availability-grid" class="d-flex flex-column gap-2" style="max-height: 300px; overflow-y: auto;">
                    <div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm"></span> Cargando horarios...</div>
                </div>
            </div>
            <div class="modal-footer border-0 p-3">
                <button class="btn btn-primary w-100 rounded-pill shadow" id="btn-confirm-service" disabled onclick="AdminBiblio.confirmarReserva()">
                    Confirmar Reserva
                </button>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('modal-servicio-reserva')).show();
        setTimeout(renderAvailabilityGrid, 500); // Allow render
    }

    async function renderAvailabilityGrid() {
        const date = document.getElementById('service-date-picker').value;
        const container = document.getElementById('service-availability-grid');
        const type = _currentServiceType;

        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>'; // Clear & Load

        try {
            // 1. Get Assets of Type
            const allAssets = await new Promise(resolve => {
                // Hack: use existing stream or fetch once.
                const unsub = BiblioAssetsService.streamAssets(_ctx, (list) => {
                    resolve(list.filter(a => a.tipo === type && (a.status === 'disponible' || !a.status))); // Filter active only
                    unsub(); // Unsub immediately
                });
            });

            // 2. Get Occupied Slots
            const occupiedMap = await BiblioAssetsService.getAvailability(_ctx, date, type);

            // 3. Render
            if (allAssets.length === 0) {
                container.innerHTML = `<div class="alert alert-secondary small">No hay equipos disponibles en este momento.</div>`;
                return;
            }

            container.innerHTML = '';

            // Generate Time Blocks (e.g. 8AM to 6PM)
            const hours = [];
            for (let i = 8; i <= 18; i++) hours.push(`${i.toString().padStart(2, '0')}:00`);

            allAssets.forEach(asset => {
                const assetRow = document.createElement('div');
                assetRow.className = 'bg-white p-3 rounded-3 shadow-sm mb-2';

                const occupiedHours = occupiedMap[asset.id] || [];

                let slotsHtml = `<div class="d-flex gap-2 overflow-auto pb-1" style="scrollbar-width:thin;">`;
                hours.forEach(h => {
                    const isTaken = occupiedHours.includes(h);
                    // Disable past hours if today
                    const now = new Date();
                    const isToday = new Date().toISOString().split('T')[0] === date;
                    const isPast = isToday && parseInt(h) <= now.getHours();

                    const disabled = isTaken || isPast;
                    const styleClass = isTaken ? 'bg-danger-subtle text-danger border-danger' :
                        (isPast ? 'bg-light text-muted border-light' : 'btn-outline-primary');

                    if (disabled) {
                        slotsHtml += `<button class="btn btn-sm ${styleClass} rounded-pill px-3" disabled style="min-width: 70px;">${h}</button>`;
                    } else {
                        slotsHtml += `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" style="min-width: 70px;" 
                                        onclick="AdminBiblio.selectSlot(this, '${asset.id}', '${h}')">${h}</button>`;
                    }
                });
                slotsHtml += `</div>`;

                assetRow.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-${type === 'pc' ? 'pc-display' : 'table'} text-muted me-2"></i>
                        <span class="fw-bold small text-dark">${asset.nombre}</span>
                    </div>
                    ${slotsHtml}
                `;
                container.appendChild(assetRow);
            });

        } catch (e) {
            container.innerHTML = `<div class="text-danger small">Error: ${e.message}</div>`;
        }
    }

    function selectSlot(btn, assetId, time) {
        // Clear previous selection
        document.querySelectorAll('#service-availability-grid button').forEach(b => {
            if (!b.disabled) {
                b.classList.remove('btn-primary', 'text-white');
                b.classList.add('btn-outline-primary');
            }
        });

        // Highlight new
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'text-white');

        _selectedAssetId = assetId;
        _selectedTimeBlock = time;

        document.getElementById('btn-confirm-service').disabled = false;
    }

    async function confirmarReserva() {
        const date = document.getElementById('service-date-picker').value;
        if (!_selectedAssetId || !_selectedTimeBlock || !date) return;

        const btn = document.getElementById('btn-confirm-service');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Reservando...';

        try {
            await BiblioAssetsService.reservarEspacio(_ctx, {
                studentId: _ctx.auth.currentUser.uid,
                assetId: _selectedAssetId,
                hourBlock: _selectedTimeBlock,
                date: date,
                tipo: _currentServiceType
            });
            showToast("Reserva exitosa", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-servicio-reserva')).hide();

            // [ENCUESTAS] Registrar uso
            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'reserva_espacio', type: _currentServiceType });
            }
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Reintentar";
        }
    }

    return {
        init,
        initStudent, // Export to allow router to call it
        // Student
        handleSearch: handleGlobalSearch, handleGlobalSearch, handleInlineSearch, openCategoryModal,
        verDetalleLibro, solicitarLibro, sendSuggestion, registrarVisita,
        toggleSearch, showMissionsModal, scrollCarousel, verDetallePrestamo, solicitarExtension, cancelarSolicitud,
        refreshData, showAllItems,
        // Digital Services (Student)
        abrirModalServicio, renderAvailabilityGrid, selectSlot, confirmarReserva,
        solicitarServicio: abrirModalServicio, renderTopBooksCarousel
    };
})();
window.Biblio = Biblio;
