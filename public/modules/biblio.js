const Biblio = (function () {
    let _ctx = null;
    let _searchDebounce = null;
    let _adminStatsInterval = null;
    let _inlineSearchDebounce = null;
    let _inlineSearchToken = 0;
    let _globalSearchToken = 0;
    let _currentBookDetail = null;
    let _requestingLoan = false;
    let _studentGamification = null;
    let _studentWishlist = [];
    let _studentWaitlist = [];
    let _studentReservations = [];
    let _serviceCatalog = null;
    let _biblioBreadcrumbHandler = null;

    function escapeHtml(value) {
        return (value == null ? '' : String(value))
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeJsString(value) {
        return (value == null ? '' : String(value))
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r?\n/g, ' ');
    }

    function getBookYear(book = {}) {
        return book.anio ?? book.año ?? book['año'] ?? '';
    }

    function encodeBookPayload(book) {
        const payload = {
            id: book?.id || '',
            titulo: book?.titulo || '',
            autor: book?.autor || '',
            categoria: book?.categoria || '',
            clasificacion: book?.clasificacion || '',
            anio: getBookYear(book),
            adquisicion: book?.adquisicion || '',
            stock: Number(book?.copiasDisponibles) || 0
        };
        return encodeURIComponent(JSON.stringify(payload));
    }

    function decodeBookPayload(payload) {
        try {
            return JSON.parse(decodeURIComponent(payload || ''));
        } catch (error) {
            console.warn('[Biblio] Payload de libro inválido:', error);
            return null;
        }
    }

    function openBookDetailFromPayload(payload) {
        const book = decodeBookPayload(payload);
        if (!book) return;
        verDetalleLibro(book.id, book.titulo, book.autor, book.stock, book.categoria, book.clasificacion, book.anio, book.adquisicion);
    }

    function getServiceTypeMeta(type) {
        const meta = {
            pc: {
                icon: 'bi-pc-display',
                label: 'Computadora',
                description: 'Reserva equipo por bloques de 1 hora.',
                accent: 'primary'
            },
            sala: {
                icon: 'bi-people-fill',
                label: 'Sala',
                description: 'Reserva un espacio colaborativo.',
                accent: 'success'
            },
            mesa: {
                icon: 'bi-grid-3x3-gap-fill',
                label: 'Mesa',
                description: 'Aparta un lugar de estudio individual.',
                accent: 'warning'
            }
        };
        return meta[type] || {
            icon: 'bi-grid',
            label: 'Servicio',
            description: 'Servicio de biblioteca.',
            accent: 'secondary'
        };
    }

    function formatDateTime(value) {
        if (!value) return '--';
        const date = value?.toDate ? value.toDate() : new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function findLoanById(id) {
        if (!id) return null;
        const groups = [
            _fullLists['list-solicitudes'] || [],
            _fullLists['list-enmano'] || [],
            _fullLists['list-historial'] || []
        ];
        for (const group of groups) {
            const match = group.find(item => item.id === id);
            if (match) return match;
        }
        return null;
    }

    function userHasActiveBookRequest(bookId) {
        if (!bookId) return false;
        const activeLoans = [
            ...(_fullLists['list-solicitudes'] || []),
            ...(_fullLists['list-enmano'] || [])
        ];
        return activeLoans.some(item => item.libroId === bookId);
    }

    function formatDateLabel(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    }

    function getMillis(value) {
        if (!value) return null;
        if (value instanceof Date) return value.getTime();
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (typeof value === 'number') return value;
        return null;
    }

    function renderPerkChips(perks = {}) {
        const chips = [
            {
                icon: 'bi-calendar2-range',
                label: `${Math.max(1, Number(perks.maxDailyReservations) || 1)} reserva${(Number(perks.maxDailyReservations) || 1) === 1 ? '' : 's'} por dia`
            },
            {
                icon: 'bi-lightning-charge',
                label: `${Math.max(5, Number(perks.reservationLeadMinutes) || 15)} min de anticipacion`
            },
            {
                icon: 'bi-stars',
                label: `${Math.max(3, Number(perks.recommendationSlots) || 3)} recomendaciones`
            }
        ];

        return chips.map(chip => `
            <span class="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-2 px-3 py-2">
                <i class="bi ${chip.icon}" style="color: var(--biblio);"></i>${escapeHtml(chip.label)}
            </span>
        `).join('');
    }

    function renderAchievementStatTiles(stats = {}) {
        const tiles = [
            { icon: 'bi-bookmark-check', label: 'Solicitudes', value: stats.loanRequests || 0 },
            { icon: 'bi-bag-check', label: 'Recogidos', value: stats.pickups || 0 },
            { icon: 'bi-alarm', label: 'A tiempo', value: stats.onTimeReturns || 0 },
            { icon: 'bi-lightning-charge', label: 'Racha', value: stats.onTimeStreak || 0 },
            { icon: 'bi-geo-alt', label: 'Visitas', value: stats.visits || 0 },
            { icon: 'bi-pc-display', label: 'Reservas', value: stats.reservations || 0 },
            { icon: 'bi-compass', label: 'Categorias', value: stats.uniqueCategories || 0 },
            { icon: 'bi-calendar-check', label: 'Activas', value: stats.activeReservations || 0 }
        ];

        return `
            <div class="row g-2">
                ${tiles.map(item => `
                    <div class="col-6 col-md-3">
                        <div class="rounded-4 border h-100 p-3 bg-white">
                            <div class="d-flex align-items-center gap-2 small text-muted mb-2">
                                <i class="bi ${item.icon}" style="color: var(--biblio);"></i>
                                <span>${escapeHtml(item.label)}</span>
                            </div>
                            <div class="fw-bold fs-5" style="color: var(--biblio-text);">${escapeHtml(String(item.value))}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderGamificationSummary(perfil, gamification) {
        const container = document.getElementById('biblio-achievement-summary');
        if (!container) return;
        if (!gamification) {
            container.innerHTML = '';
            return;
        }

        const summary = gamification.summary || {};
        const nextAchievement = (summary.nextAchievements || [])[0] || null;
        const pendingCount = Math.max(0, Number(summary.pendingCount) || Math.max((summary.totalCount || 0) - (summary.completedCount || 0), 0));
        const missionCount = document.getElementById('biblio-mission-count');
        if (missionCount) {
            missionCount.textContent = `${pendingCount}`;
            missionCount.classList.toggle('d-none', pendingCount <= 0);
        }

        const heroTitle = document.getElementById('hero-achievement-title');
        if (heroTitle) heroTitle.textContent = gamification.title || perfil?.tituloBiblioteca || 'Curioso del Acervo';

        const heroMeta = document.getElementById('hero-achievements-meta');
        if (heroMeta) {
            heroMeta.textContent = `${summary.completedCount || 0}/${summary.totalCount || 0} logros desbloqueados${pendingCount > 0 ? ` · ${pendingCount} pendientes` : ''}`;
        }

        container.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: linear-gradient(135deg, rgba(15,118,110,0.08), rgba(20,184,166,0.04));">
                <div class="card-body p-3 p-md-4">
                    <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                        <div>
                            <p class="small text-uppercase fw-bold mb-1" style="color: var(--biblio); letter-spacing: 0.08em;">Progreso de Biblioteca</p>
                            <h6 class="fw-bold mb-1" style="color: var(--biblio-text);">${escapeHtml(gamification.title || 'Curioso del Acervo')}</h6>
                            <p class="small text-muted mb-0">${summary.completedCount || 0} de ${summary.totalCount || 0} logros completados</p>
                        </div>
                        <span class="badge rounded-pill text-bg-dark px-3 py-2">${gamification.level || perfil?.nivel || 1}</span>
                    </div>
                    <div class="progress rounded-pill mb-3" style="height: 8px;">
                        <div class="progress-bar" style="width:${Math.max(0, Math.min(100, Number(summary.levelProgressPct) || 0))}%; background: linear-gradient(90deg, #0f766e, #14b8a6);"></div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 mb-3">
                        ${renderPerkChips(gamification.perks || perfil?.perksBiblioteca || {})}
                    </div>
                    ${nextAchievement ? `
                        <div class="rounded-4 p-3" style="background: rgba(255,255,255,0.8);">
                            <div class="d-flex align-items-start gap-3">
                                <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 44px; height: 44px; background: rgba(15,118,110,0.12); color: var(--biblio);">
                                    <i class="bi ${escapeHtml(nextAchievement.icon || 'bi-trophy')}"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <p class="small text-uppercase fw-bold mb-1 text-muted">Siguiente desbloqueo</p>
                                    <h6 class="fw-bold mb-1" style="color: var(--biblio-text);">${escapeHtml(nextAchievement.title)}</h6>
                                    <p class="small text-muted mb-2">${escapeHtml(nextAchievement.description || '')}</p>
                                    <div class="d-flex align-items-center justify-content-between gap-3 small">
                                        <span>${nextAchievement.progress || 0}/${nextAchievement.target || 0}</span>
                                        <span class="fw-bold" style="color: var(--biblio);">${escapeHtml(nextAchievement.rewardLabel || `+${nextAchievement.xpReward || 0} XP`)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>` : ''}
                </div>
            </div>
        `;
    }

    function showGamificationToast(gamification) {
        const unlocks = gamification?.newUnlocks || [];
        if (!unlocks.length || typeof showToast !== 'function') return;

        if (unlocks.length === 1) {
            showToast(`Logro desbloqueado: ${unlocks[0].title}`, 'success');
            return;
        }

        showToast(`${unlocks.length} nuevos logros desbloqueados`, 'success');
    }

    async function syncStudentGamification(perfil = null) {
        const uid = _ctx?.auth?.currentUser?.uid;
        if (!uid || !window.BiblioService?.syncGamification) return null;

        try {
            const gamification = await BiblioService.syncGamification(_ctx, uid, perfil);
            if (gamification) {
                _studentGamification = gamification;
            }
            return gamification;
        } catch (error) {
            console.warn('[Biblio] No se pudo sincronizar gamificacion:', error);
            return null;
        }
    }

    function getBiblioBreadcrumbLabel(tabId) {
        switch (tabId) {
            case 'tab-prestamos-btn':
                return 'Mi actividad';
            case 'tab-historial-btn':
                return 'Historial';
            case 'tab-buscar-btn':
            default:
                return 'Explorar';
        }
    }

    function syncBiblioBreadcrumb(tabId) {
        const label = getBiblioBreadcrumbLabel(tabId);
        window.SIA?.setBreadcrumbSection?.('view-biblio', label, { moduleClickable: false });
    }

    function getCurrentBiblioTabId() {
        return document.querySelector('#view-biblio .nav-pills .nav-link.active')?.id || 'tab-buscar-btn';
    }

    function bindBiblioBreadcrumbSync() {
        const container = document.getElementById('view-biblio');
        if (!container) return;

        if (_biblioBreadcrumbHandler) {
            container.removeEventListener('shown.bs.tab', _biblioBreadcrumbHandler);
        }

        _biblioBreadcrumbHandler = (event) => {
            const tabId = event?.target?.id;
            if (!tabId || !/^tab-(buscar|prestamos|historial)-btn$/.test(tabId)) return;
            syncBiblioBreadcrumb(tabId);
        };

        container.addEventListener('shown.bs.tab', _biblioBreadcrumbHandler);
        syncBiblioBreadcrumb(getCurrentBiblioTabId());
    }

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
            bindBiblioBreadcrumbSync();
            await loadStudentFullData();
            return;
        }

        container.innerHTML = renderStudentStructure();
        bindBiblioBreadcrumbSync();

        // Initiators
        loadStudentFullData();
        renderTopBooksCarousel();
        checkBiblioTutorial();
    }

    function renderStudentStructure() {
        return `
            <style>
                #biblio-student-app { --biblio: #0f766e; --biblio-light: #14b8a6; --biblio-surface: #f8fafb; --biblio-text: #1e293b; }
                #biblio-student-app .nav-pills .nav-link.active { background-color: var(--biblio) !important; color: #fff !important; font-weight: 700; }
                #biblio-student-app .nav-pills .nav-link { color: #64748b; transition: all 0.2s; font-size: 0.85rem; }
                #biblio-student-app .btn-biblio { background-color: var(--biblio); color: #fff; border: none; }
                #biblio-student-app .btn-biblio:hover { background-color: #0d6b63; color: #fff; }
                #biblio-student-app .biblio-card-stripe-warning { border-left: 4px solid #f59e0b; }
                #biblio-student-app .biblio-card-stripe-danger { border-left: 4px solid #dc3545; }
                #biblio-student-app .biblio-card-stripe-info { border-left: 4px solid var(--biblio-light); }
                #biblio-student-app .biblio-card-stripe-success { border-left: 4px solid #198754; }
                #biblio-student-app .biblio-card-stripe-secondary { border-left: 4px solid #6c757d; }
                #biblio-student-app .biblio-book-result { transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }
                #biblio-student-app .biblio-book-result:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important; }
                #biblio-student-app .biblio-service-card-disabled { opacity: 0.58; cursor: not-allowed; }
                #biblio-student-app .biblio-book-initial { width: 56px; height: 72px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 800; color: #fff; flex-shrink: 0; }
                #biblio-student-app .biblio-section-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
                #biblio-student-app .biblio-section-head p { margin: 0.15rem 0 0; font-size: 0.78rem; color: #64748b; }
                #biblio-student-app .biblio-activity-card { border: 1px solid rgba(15,118,110,0.08); background: #fff; }
                #modal-misiones .modal-content { background: linear-gradient(180deg, #fff8e7 0%, #fffdf7 38%, #ffffff 100%); min-height: 100%; }
                #modal-misiones .modal-body { background: transparent; overscroll-behavior: contain; }
                #modal-misiones .biblio-missions-primary { background: transparent; }
                #modal-misiones .biblio-missions-secondary { background: rgba(255,255,255,0.78); backdrop-filter: blur(4px); }
                @media (max-width: 768px) {
                    #biblio-student-app .biblio-hero { padding: 1.25rem !important; }
                    #biblio-student-app .biblio-hero h2 { font-size: 1.3rem; }
                    #biblio-student-app .biblio-hero-icon { display: none !important; }
                    #biblio-student-app .nav-pills .nav-link { font-size: 0.75rem; padding: 0.4rem 0.6rem; }
                }
                @media (max-width: 575.98px) {
                    #modal-misiones .modal-dialog { margin: 0; }
                    #modal-misiones .modal-content { min-height: 100dvh; border-radius: 0 !important; }
                    #modal-misiones .modal-body { padding-bottom: calc(1rem + env(safe-area-inset-bottom)); }
                    #biblio-student-app .biblio-section-head { align-items: flex-start; flex-direction: column; }
                }
            </style>

            <div id="biblio-student-app">
                <!-- HERO BANNER (Teal) -->
                <div class="biblio-hero shadow-sm mb-4" style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); border-radius: 1rem; padding: 1.5rem; position: relative; overflow: hidden;">
                    <div class="position-relative z-1">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-white text-dark mb-2 fw-bold shadow-sm" style="font-size: 0.7rem; color: #0f766e !important;">
                                <i class="bi bi-book-half me-1"></i>Biblioteca ITES
                            </span>
                            <div class="d-flex gap-2 flex-wrap justify-content-end">
                                <button class="btn btn-sm bg-opacity-25 text-white border-0 rounded-pill px-3 d-inline-flex align-items-center gap-2" id="biblio-btn-missions" onclick="Biblio.showMissionsModal()" title="Ver misiones">
                                    <span><i class="bi bi-trophy me-1"></i>Misiones</span>
                                    <span id="biblio-mission-count" class="badge rounded-pill text-bg-dark d-none">0</span>
                                </button>
                                <button class="btn btn-sm bg-opacity-25 text-white border-0 rounded-pill px-3" id="biblio-btn-tutorial" onclick="Biblio.launchTutorial()" title="Ver tutorial">
                                    <i class="bi bi-play-circle me-1"></i>Tutorial
                                </button>
                            </div>
                        </div>
                        <h2 class="fw-bold mb-1 text-white" id="hero-user-name" style="font-size: 1.5rem;">Biblioteca</h2>
                        <p class="small mb-2 text-white" id="hero-user-subtitle" style="max-width: 70%; opacity: 0.85;">Explora, aprende y crece.</p>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <span class="badge bg-dark bg-opacity-25 text-white rounded-pill px-2 py-1" id="xp-level-badge" style="font-size: 0.7rem;">NIVEL 1</span>
                            <div class="progress rounded-pill" style="height: 5px; width: 120px; background: rgba(255,255,255,0.2);">
                                <div id="xp-bar-fill" class="progress-bar rounded-pill" style="width: 0%; background: #fff;"></div>
                            </div>
                            <small class="text-white fw-bold" id="xp-current" style="font-size: 0.7rem; opacity: 0.85;">0 XP</small>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                            <span class="badge bg-white text-dark rounded-pill px-3 py-2" id="hero-achievement-title">Curioso del Acervo</span>
                            <small class="text-white" id="hero-achievements-meta" style="opacity: 0.85;">0/0 logros desbloqueados</small>
                        </div>
                    </div>
                    <i class="bi bi-book-half biblio-hero-icon position-absolute end-0 top-50 translate-middle-y me-3 text-white" style="font-size: 6rem; opacity: 0.08;"></i>
                </div>

                <!-- ALERTA DEUDA GLOBAL -->
                <div id="debt-alert-sticky" class="alert alert-danger border-0 shadow-sm rounded-4 d-none align-items-center gap-3 mb-4">
                    <i class="bi bi-exclamation-triangle-fill fs-4"></i>
                    <div>
                        <h6 class="fw-bold mb-0">Tienes un adeudo pendiente</h6>
                        <p class="mb-0 small">Debes <strong id="debt-amount">$0.00</strong>. Acude a mostrador para regularizarte.</p>
                    </div>
                </div>

                <div id="biblio-achievement-summary"></div>

                <!-- NAV PILLS (3 tabs) -->
                <ul class="nav nav-pills nav-fill p-1 rounded-pill shadow-sm mb-4" role="tablist" style="background: var(--biblio-surface);">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active rounded-pill" id="tab-buscar-btn" data-bs-toggle="pill" data-bs-target="#tab-buscar" type="button" role="tab">
                            <i class="bi bi-search me-1"></i>Explorar
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill" id="tab-prestamos-btn" data-bs-toggle="pill" data-bs-target="#tab-prestamos" type="button" role="tab">
                            <i class="bi bi-book me-1"></i>Mi actividad
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill" id="tab-historial-btn" data-bs-toggle="pill" data-bs-target="#tab-historial" type="button" role="tab">
                            <i class="bi bi-clock-history me-1"></i>Historial
                        </button>
                    </li>
                </ul>

                <!-- TAB CONTENT -->
                <div class="tab-content">

                    <!-- TAB 1: BUSCAR -->
                    <div class="tab-pane fade show active" id="tab-buscar" role="tabpanel">
                        <!-- Buscador principal -->
                        <div class="card border-0 shadow-sm rounded-4 mb-4">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-3" style="color: var(--biblio);">
                                    <i class="bi bi-search me-2"></i>¿Qué libro buscas?
                                </h6>
                                <div class="d-flex gap-2 mb-3">
                                    <input type="text" class="form-control border rounded-pill px-4" placeholder="Título, autor, código..." id="biblio-quick-search" style="background: var(--biblio-surface);"
                                           oninput="Biblio.handleInlineSearch(this.value)"
                                           onkeyup="if(event.key==='Enter' && this.value.trim().length >= 3) Biblio.toggleSearch()">
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
                                <h6 class="fw-bold mb-3 small" style="color: var(--biblio);">
                                    <i class="bi bi-bookmark-star me-2"></i>Explorar por Categoría
                                </h6>
                                <div class="d-flex flex-wrap gap-2">
                                    <button class="btn btn-sm rounded-pill px-3 fw-bold border" onclick="Biblio.openCategoryModal('Administración')">
                                        <i class="bi bi-briefcase me-1 text-primary"></i>Administración
                                    </button>
                                    <button class="btn btn-sm rounded-pill px-3 fw-bold border" onclick="Biblio.openCategoryModal('Arquitectura')">
                                        <i class="bi bi-building me-1 text-info"></i>Arquitectura
                                    </button>
                                    <button class="btn btn-sm rounded-pill px-3 fw-bold border" onclick="Biblio.openCategoryModal('Ciencias Básicas')">
                                        <i class="bi bi-calculator me-1 text-success"></i>Ciencias Básicas
                                    </button>
                                    <button class="btn btn-sm rounded-pill px-3 fw-bold border" onclick="Biblio.openCategoryModal('Gastronomía')">
                                        <i class="bi bi-cup-hot me-1 text-danger"></i>Gastronomía
                                    </button>
                                    <button class="btn btn-sm rounded-pill px-3 fw-bold border" onclick="Biblio.openCategoryModal('Literatura')">
                                        <i class="bi bi-journal-richtext me-1" style="color: var(--biblio);"></i>Literatura
                                    </button>
                                </div>
                                <!-- Resultados de categoría inline -->
                                <div id="biblio-category-results" class="mt-3 d-none"></div>
                            </div>
                        </div>

                        <div class="row g-3 mb-4">
                            <div class="col-12 col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100 biblio-book-result" onclick="Biblio.openSuggestionModal()">
                                    <div class="card-body p-3 d-flex align-items-center gap-3">
                                        <div class="p-2 rounded-3" style="background: rgba(15,118,110,0.1);">
                                            <i class="bi bi-lightbulb-fill" style="color: var(--biblio);"></i>
                                        </div>
                                        <div class="flex-grow-1">
                                            <h6 class="fw-bold mb-0 small" style="color: var(--biblio-text);">Sugerir compra</h6>
                                            <small class="text-muted">Pide un titulo que te gustaria ver en catalogo.</small>
                                        </div>
                                        <i class="bi bi-chevron-right text-muted"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100">
                                    <div class="card-body p-3">
                                        <div class="d-flex align-items-center gap-3 mb-2">
                                            <div class="p-2 rounded-3" style="background: rgba(59,130,246,0.12);">
                                                <i class="bi bi-heart-fill text-primary"></i>
                                            </div>
                                            <div>
                                                <h6 class="fw-bold mb-0 small" style="color: var(--biblio-text);">Tu lista guardada</h6>
                                                <small class="text-muted">Guarda libros y retomalos despues.</small>
                                            </div>
                                        </div>
                                        <div id="biblio-wishlist-summary" class="small text-muted">Cargando tus guardados...</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Top 5 Carrusel -->
                        <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style="background: #1e293b;">
                            <div class="card-body p-3 position-relative text-white">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="badge shadow-sm fw-bold" style="background: var(--biblio);">
                                        <i class="bi bi-fire me-1"></i>Lo más leído
                                    </span>
                                    <div class="d-flex gap-1">
                                        <button class="btn btn-sm bg-white bg-opacity-10 border-0 rounded-circle text-white" onclick="Biblio.scrollCarousel(-1)" style="width:28px;height:28px;"><i class="bi bi-chevron-left small"></i></button>
                                        <button class="btn btn-sm bg-white bg-opacity-10 border-0 rounded-circle text-white" onclick="Biblio.scrollCarousel(1)" style="width:28px;height:28px;"><i class="bi bi-chevron-right small"></i></button>
                                    </div>
                                </div>
                                <div id="biblio-top-carousel" class="d-flex gap-3 overflow-auto pb-2" style="scroll-behavior: smooth; scrollbar-width: none;">
                                    <div class="w-100 text-center py-4 text-white-50"><span class="spinner-border spinner-border-sm me-2"></span>Cargando destacados...</div>
                                </div>
                            </div>
                        </div>

                        <!-- Enlace eLibro -->
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--biblio-surface);">
                            <div class="card-body p-3 d-flex align-items-center gap-3">
                                <div class="p-2 rounded-3" style="background: rgba(15,118,110,0.1);">
                                    <i class="bi bi-link-45deg fs-4" style="color: var(--biblio);"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="fw-bold mb-0 small" style="color: var(--biblio-text);">Biblioteca Digital eLibro</h6>
                                    <small class="text-muted">Accede con tu correo institucional</small>
                                </div>
                                <a href="https://elibro.net/es/lc/itesloscabos/inicio" target="_blank" class="btn btn-sm btn-biblio rounded-pill px-3">
                                    <i class="bi bi-box-arrow-up-right me-1"></i>Acceder
                                </a>
                            </div>
                        </div>

                        <div id="biblio-wishlist-section" class="mb-4"></div>
                    </div>

                    <!-- TAB 2: MIS PRÉSTAMOS -->
                    <div class="tab-pane fade" id="tab-prestamos" role="tabpanel">
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: linear-gradient(135deg, rgba(15,118,110,0.08), rgba(20,184,166,0.03));">
                            <div class="card-body p-3 p-md-4">
                                <div class="biblio-section-head">
                                    <div>
                                        <h6 class="fw-bold mb-0" style="color: var(--biblio-text);"><i class="bi bi-book me-2" style="color: var(--biblio);"></i>Mi actividad en biblioteca</h6>
                                        <p>Primero ves lo urgente: por recoger, préstamos activos, reservas y lista de espera.</p>
                                    </div>
                                    <button class="btn btn-sm border rounded-pill" onclick="Biblio.refreshData()">
                                        <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
                                    </button>
                                </div>
                                <div id="biblio-activity-summary">
                                    <div class="text-center py-3 text-muted">
                                        <span class="spinner-border spinner-border-sm"></span>
                                        <span class="ms-2">Cargando actividad...</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="biblio-section-head">
                            <div>
                                <h6 class="fw-bold mb-0 small text-muted text-uppercase"><i class="bi bi-hourglass-split me-2"></i>Solicitudes por recoger</h6>
                                <p>Libros apartados que todavía debes pasar a mostrador a recoger.</p>
                            </div>
                        </div>
                        <div id="list-solicitudes" class="d-flex flex-column gap-3 mb-4">
                            <div class="text-center py-4 text-muted rounded-4">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando...</span>
                            </div>
                        </div>

                        <div class="biblio-section-head">
                            <div>
                                <h6 class="fw-bold mb-0 small text-muted text-uppercase"><i class="bi bi-backpack2 me-2"></i>Libros en mano</h6>
                                <p>Tus préstamos activos, con alertas y acciones rápidas.</p>
                            </div>
                        </div>
                        <div id="list-enmano" class="d-flex flex-column gap-3 mb-4">
                            <div class="text-center py-5 text-muted">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando...</span>
                            </div>
                        </div>

                        <div class="biblio-section-head">
                            <div>
                                <h6 class="fw-bold mb-0 small text-muted text-uppercase"><i class="bi bi-calendar-check me-2"></i>Mis reservas</h6>
                                <p>Bloques activos de computadora, sala o mesa.</p>
                            </div>
                        </div>
                        <div id="list-mis-reservas">
                            <div class="text-center py-4 text-muted rounded-4" style="background: var(--biblio-surface);">
                                <i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>
                                <p class="mb-0 small">No tienes reservas activas.</p>
                            </div>
                        </div>

                        <div class="biblio-section-head mt-4">
                            <div>
                                <h6 class="fw-bold mb-0 small text-muted text-uppercase"><i class="bi bi-grid me-2"></i>Espacios y equipos</h6>
                                <p>Reserva por tipo según disponibilidad real de biblioteca.</p>
                            </div>
                        </div>
                        <div id="biblio-service-hub" class="row g-3 mb-4">
                            <div class="col-12">
                                <div class="text-center py-4 text-muted rounded-4" style="background: var(--biblio-surface);">
                                    <span class="spinner-border spinner-border-sm"></span>
                                    <span class="ms-2">Cargando servicios...</span>
                                </div>
                            </div>
                        </div>

                        <div class="biblio-section-head">
                            <div>
                                <h6 class="fw-bold mb-0 small text-muted text-uppercase"><i class="bi bi-hourglass me-2"></i>Lista de espera</h6>
                                <p>Libros agotados que estás monitoreando para apartarlos cuando vuelva el stock.</p>
                            </div>
                        </div>
                        <div id="list-waitlist-books">
                            <div class="text-center py-4 text-muted rounded-4" style="background: var(--biblio-surface);">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando lista de espera...</span>
                            </div>
                        </div>
                    </div>

                    <!-- TAB 3: HISTORIAL -->
                    <div class="tab-pane fade" id="tab-historial" role="tabpanel">
                        <div class="biblio-section-head">
                            <div>
                                <h6 class="fw-bold mb-0" style="color: var(--biblio-text);"><i class="bi bi-clock-history me-2" style="color: var(--biblio);"></i>Historial y recomendaciones</h6>
                                <p>Consulta movimientos anteriores y descubre lecturas relacionadas.</p>
                            </div>
                        </div>
                        <div id="list-historial" class="d-flex flex-column gap-3">
                            <div class="text-center py-5 text-muted">
                                <span class="spinner-border spinner-border-sm"></span>
                                <span class="ms-2">Cargando...</span>
                            </div>
                        </div>

                        <!-- Recomendaciones -->
                        <div class="mt-4" id="biblio-recomendaciones"></div>
                    </div>

                </div>

                <!-- MODALES -->
                <div class="modal fade" id="modal-misiones" tabindex="-1">
                    <div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down">
                        <div class="modal-content rounded-4 border-0 shadow-lg" id="misiones-content"></div>
                    </div>
                </div>

                <div class="modal fade" id="modal-search-global" tabindex="-1">
                    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content rounded-4 border-0 shadow-lg" style="background: var(--biblio-surface);">
                            <div class="modal-header border-0 bg-white sticky-top py-3">
                                <div class="input-group input-group-lg rounded-pill border overflow-hidden" style="background: var(--biblio-surface);">
                                    <span class="input-group-text border-0 bg-transparent ps-4"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control border-0 bg-transparent shadow-none" placeholder="Titulo, autor, codigo..." id="global-search-input" oninput="Biblio.handleGlobalSearch(this.value)">
                                    <button class="btn border-0" onclick="document.getElementById('global-search-input').value=''; Biblio.handleGlobalSearch('')"><i class="bi bi-x-circle-fill text-muted"></i></button>
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
                                <div class="text-center mt-4 pt-2 border-top" id="elibro-search-fallback" style="display:none;">
                                    <p class="small text-muted mb-2">¿No encuentras lo que buscas?</p>
                                    <a id="elibro-search-link" href="#" target="_blank" class="btn btn-sm btn-outline-dark rounded-pill px-4">
                                        <i class="bi bi-link-45deg me-1"></i>Buscar en eLibro
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modal-libro-detalle" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
                        <div class="modal-content rounded-4 border-0 shadow-lg" id="libro-detalle-content"></div>
                    </div>
                </div>

                <div class="modal fade" id="modal-servicio-reserva" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
                        <div class="modal-content rounded-4 border-0 shadow-lg" id="servicio-reserva-content"></div>
                    </div>
                </div>

                <div class="modal fade" id="modal-sugerencia" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
                        <div class="modal-content rounded-4 border-0 shadow-lg">
                            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: white;">
                                <div>
                                    <h5 class="fw-bold mb-1"><i class="bi bi-lightbulb-fill me-2"></i>Sugerir compra</h5>
                                    <p class="small mb-0 opacity-75">Comparte un titulo que deberia estar en biblioteca.</p>
                                </div>
                                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-4" style="background: var(--biblio-surface);">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">Titulo</label>
                                    <input id="sug-titulo" class="form-control rounded-4" maxlength="180" placeholder="Ej. Fundamentos de..." />
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">Autor</label>
                                    <input id="sug-autor" class="form-control rounded-4" maxlength="180" placeholder="Autor o editorial" />
                                </div>
                            </div>
                            <div class="modal-footer border-0 px-4 pb-4">
                                <button class="btn btn-biblio w-100 rounded-pill fw-bold py-2" onclick="Biblio.sendSuggestion()">
                                    <i class="bi bi-send-fill me-2"></i>Enviar sugerencia
                                </button>
                            </div>
                        </div>
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
                const tituloSafe = escapeHtml(book.titulo || '?');
                const payload = encodeBookPayload(book);
                const prestamos = book._prestamos ? `<span class="text-white-50" style="font-size:0.6rem;">${book._prestamos}x prestado</span>` : '';
                return `
                    <div class="flex-shrink-0 text-center" style="width: 110px; cursor: pointer;" onclick="Biblio.openBookDetailFromPayload('${payload}')">
                        <div class="card border-0 shadow-lg overflow-hidden rounded-3 mx-auto" style="width: 100px;">
                            <div class="d-flex align-items-center justify-content-center text-white fw-bold" style="height: 130px; font-size: 2.5rem; background: linear-gradient(to bottom right, ${colors[i % colors.length]}, #222);">
                                ${tituloSafe.charAt(0)}
                            </div>
                        </div>
                        <p class="text-white small mt-2 mb-0 text-truncate" style="max-width: 110px; font-size: 0.7rem;">${tituloSafe}</p>
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
    function handleInlineSearch(val) {
        if (_inlineSearchDebounce) clearTimeout(_inlineSearchDebounce);
        _inlineSearchToken += 1;
        const currentToken = _inlineSearchToken;
        const searchValue = (val || '').trim();

        const wrapper = document.getElementById('biblio-inline-results');
        const container = document.getElementById('biblio-inline-results-list');
        if (!wrapper || !container) return;

        if (!searchValue || searchValue.length < 3) {
            wrapper.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        wrapper.classList.remove('d-none');
        container.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm text-primary"></span></div>';

        _inlineSearchDebounce = setTimeout(async () => {
            try {
                const results = await BiblioService.searchCatalogo(_ctx, searchValue);
                if (currentToken !== _inlineSearchToken) return;
                if (!results || results.length === 0) {
                    container.innerHTML = '<p class="text-muted small text-center mb-0 py-2">Sin resultados</p>';
                    return;
                }

                container.innerHTML = results.slice(0, 5).map(book => `
                    <div class="d-flex align-items-center gap-2 p-2 rounded-3 hover-lift" style="cursor:pointer;"
                         onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')">
                        <div class=" rounded-2 p-2 text-center" style="min-width:36px;">
                            <i class="bi bi-book text-muted"></i>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="fw-bold small text-truncate">${escapeHtml(book.titulo)}</div>
                            <div class="text-muted" style="font-size:0.7rem;">${escapeHtml(book.autor || '')}</div>
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
        const inlineVal = (document.getElementById('biblio-quick-search')?.value || '').trim();
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
        _globalSearchToken += 1;
        const currentToken = _globalSearchToken;
        _searchDebounce = setTimeout(async () => {
            const container = document.getElementById('global-search-results');
            const fallback = document.getElementById('elibro-search-fallback');
            if (!container) return;
            const searchValue = (val || '').trim();
            if (!searchValue || searchValue.length < 3) {
                container.innerHTML = '<div class="col-12 text-center text-muted opacity-50 py-5">Ingresa al menos 3 caracteres...</div>';
                if (fallback) fallback.style.display = 'none';
                return;
            }

            container.innerHTML = '<div class="col-12 text-center py-5" style="color:#0f766e;"><div class="spinner-border"></div></div>';

            try {
                const results = await BiblioService.searchCatalogo(_ctx, searchValue);
                if (currentToken !== _globalSearchToken) return;
                // eLibro fallback link
                if (fallback) {
                    fallback.style.display = 'block';
                    const eLink = document.getElementById('elibro-search-link');
                    if (eLink) eLink.href = `https://elibro.net/es/lc/itesloscabos/busqueda_avanzada?q=${encodeURIComponent(searchValue)}`;
                }
                if (!results || results.length === 0) {
                    container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-search fs-1 d-block mb-2 opacity-25"></i>No se encontraron resultados.</div>';
                    return;
                }

                container.innerHTML = results.map(book => {
                    const initial = (book.titulo || '?')[0].toUpperCase();
                    const colors = ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b91c1c', '#0d9488'];
                    const bgc = colors[initial.charCodeAt(0) % colors.length];
                    const stock = book.copiasDisponibles || 0;
                    const year = getBookYear(book);
                    return `
                    <div class="col-12">
                        <div class="card border-0 shadow-sm rounded-4 biblio-book-result" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')">
                            <div class="card-body d-flex align-items-center gap-3 p-3">
                                <div class="biblio-book-initial" style="background: ${bgc};">${initial}</div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <h6 class="fw-bold mb-1 text-truncate" style="color:#1e293b; font-size:0.9rem;">${escapeHtml(book.titulo)}</h6>
                                    <p class="small text-muted mb-1 text-truncate">${escapeHtml(book.autor || 'Autor desconocido')}</p>
                                    <div class="d-flex flex-wrap gap-1">
                                        ${book.categoria ? `<span class="badge rounded-pill px-2" style="background:rgba(15,118,110,0.1);color:#0f766e;font-size:0.65rem;">${escapeHtml(book.categoria)}</span>` : ''}
                                        ${year ? `<span class="badge rounded-pill bg-secondary bg-opacity-10 text-muted" style="font-size:0.65rem;">${escapeHtml(year)}</span>` : ''}
                                    </div>
                                </div>
                                <div class="text-end flex-shrink-0">
                                    <span class="badge ${stock > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill d-block mb-1">
                                        ${stock > 0 ? `${stock} disp.` : 'Agotado'}
                                    </span>
                                    <small class="text-muted" style="font-size:0.65rem;">Ver <i class="bi bi-chevron-right"></i></small>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            } catch (e) {
                container.innerHTML = '<div class="col-12 text-center text-danger">Error al buscar en el catálogo. Intenta de nuevo.</div>';
            }
        }, 500);
    }

    // --- CATEGORÍA INLINE ---
    async function openCategoryModal(category) {
        const container = document.getElementById('biblio-category-results');
        if (!container) return;

        container.classList.remove('d-none');
        container.innerHTML = `<div class="text-center py-3" style="color:#0f766e;"><div class="spinner-border spinner-border-sm"></div> <span class="ms-2 small">Cargando ${category}...</span></div>`;

        try {
            const books = await BiblioService.getBooksByCategory(_ctx, category, 5);
            if (!books || books.length === 0) {
                container.innerHTML = `<div class="text-center text-muted py-3 small"><i class="bi bi-search me-1"></i>No se encontraron libros en "${category}".</div>`;
                return;
            }

            const _renderCatCard = (book) => {
                const initial = (book.titulo || '?')[0].toUpperCase();
                const colors = ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b91c1c', '#0d9488'];
                const bg = colors[initial.charCodeAt(0) % colors.length];
                const stock = book.copiasDisponibles || 0;
                return `<div class="card border-0 shadow-sm rounded-3 biblio-book-result mb-2" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')">
                    <div class="card-body d-flex align-items-center gap-3 p-2 px-3">
                        <div class="biblio-book-initial" style="background:${bg};width:40px;height:52px;font-size:1.1rem;border-radius:6px;">${initial}</div>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="fw-bold mb-0 text-truncate" style="color:#1e293b;font-size:0.82rem;">${escapeHtml(book.titulo)}</h6>
                            <small class="text-muted text-truncate d-block" style="font-size:0.7rem;">${escapeHtml(book.autor || 'Autor desconocido')}</small>
                        </div>
                        <span class="badge ${stock > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill" style="font-size:0.6rem;">${stock > 0 ? `${stock}` : '0'}</span>
                    </div>
                </div>`;
            };

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold small" style="color:#0f766e;"><i class="bi bi-bookmark-star-fill me-1"></i>${escapeHtml(category)}</span>
                    <button class="btn btn-sm border-0 text-muted p-0" onclick="document.getElementById('biblio-category-results').classList.add('d-none')"><i class="bi bi-x-lg"></i></button>
                </div>
                ${books.map(_renderCatCard).join('')}
                <button class="btn btn-sm btn-outline-dark rounded-pill w-100 mt-1" onclick="Biblio._openCategoryInModal('${escapeJsString(category)}')">
                    <i class="bi bi-grid me-1"></i>Ver más en ${escapeHtml(category)}
                </button>
            `;
        } catch (e) {
            container.innerHTML = `<div class="text-center text-danger py-3 small">Error: ${e.message}</div>`;
        }
    }

    // Abre categoría completa en el modal global
    async function _openCategoryInModal(category) {
        const modal = new bootstrap.Modal(document.getElementById('modal-search-global'));
        modal.show();
        const titleEl = document.getElementById('search-results-title');
        const container = document.getElementById('global-search-results');
        const globalInput = document.getElementById('global-search-input');
        if (titleEl) titleEl.innerHTML = `<i class="bi bi-bookmark-star-fill me-2" style="color:#0f766e;"></i>Categoría: ${escapeHtml(category)}`;
        if (globalInput) { globalInput.value = ''; globalInput.placeholder = `Buscar en ${category}...`; }
        if (container) container.innerHTML = '<div class="col-12 text-center py-5" style="color:#0f766e;"><div class="spinner-border"></div></div>';
        try {
            const books = await BiblioService.getBooksByCategory(_ctx, category, 30);
            if (!books || books.length === 0) {
                container.innerHTML = '<div class="col-12 text-center text-muted py-5">No se encontraron libros.</div>';
                return;
            }
            container.innerHTML = books.map(book => {
                const initial = (book.titulo || '?')[0].toUpperCase();
                const colors = ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b91c1c', '#0d9488'];
                const bgc = colors[initial.charCodeAt(0) % colors.length];
                const stock = book.copiasDisponibles || 0;
                return `<div class="col-12"><div class="card border-0 shadow-sm rounded-4 biblio-book-result" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')"><div class="card-body d-flex align-items-center gap-3 p-3"><div class="biblio-book-initial" style="background:${bgc};">${initial}</div><div class="flex-grow-1 overflow-hidden"><h6 class="fw-bold mb-1 text-truncate" style="color:#1e293b;font-size:0.9rem;">${escapeHtml(book.titulo)}</h6><p class="small text-muted mb-0 text-truncate">${escapeHtml(book.autor || 'Autor desconocido')}</p></div><div class="text-end flex-shrink-0"><span class="badge ${stock > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">${stock > 0 ? `${stock} disp.` : 'Agotado'}</span></div></div></div></div>`;
            }).join('');
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
    function verDetalleLibro(id, titulo, autor, stock, categoria, clasificacion, anio, adquisicion) {
        const modalContent = document.getElementById('libro-detalle-content');
        if (!modalContent) return;
        _currentBookDetail = { id, titulo, autor, stock, categoria, clasificacion, anio, adquisicion: adquisicion || id };
        const initial = (titulo || '?')[0].toUpperCase();
        const colors = ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b91c1c', '#0d9488'];
        const bg = colors[initial.charCodeAt(0) % colors.length];
        const safeTitulo = escapeHtml(titulo || 'Libro');
        const safeAutor = escapeHtml(autor || 'Autor desconocido');
        const safeCategoria = escapeHtml(categoria || '');
        const safeClasificacion = escapeHtml(clasificacion || '');
        const safeAnio = escapeHtml(anio || '');
        const safeAdquisicion = escapeHtml(adquisicion || id || '--');
        const hasActiveRequest = userHasActiveBookRequest(id);
        const inWishlist = _studentWishlist.some(item => item.id === id);
        const inWaitlist = _studentWaitlist.some(item => item.id === id);
        modalContent.innerHTML = `
            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, ${bg}15 0%, ${bg}05 100%);">
                <div class="d-flex align-items-center gap-3 w-100">
                    <div class="biblio-book-initial" style="background: ${bg}; width:52px; height:68px; font-size:1.4rem;">${initial}</div>
                    <div class="flex-grow-1 overflow-hidden">
                        <h5 class="modal-title fw-bold mb-1" style="color: var(--biblio-text);">${safeTitulo}</h5>
                        <p class="mb-0 small text-muted">${safeAutor}</p>
                    </div>
                </div>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4 pb-2">
                <div class="row g-2 mb-3">
                    ${categoria ? `<div class="col-6"><div class="p-2 rounded-3" style="background: var(--biblio-surface);"><small class="text-muted d-block" style="font-size:0.65rem;">Categoría</small><strong class="small" style="color: var(--biblio-text);">${safeCategoria}</strong></div></div>` : ''}
                    ${anio ? `<div class="col-6"><div class="p-2 rounded-3" style="background: var(--biblio-surface);"><small class="text-muted d-block" style="font-size:0.65rem;">Año</small><strong class="small" style="color: var(--biblio-text);">${safeAnio}</strong></div></div>` : ''}
                    ${clasificacion ? `<div class="col-6"><div class="p-2 rounded-3" style="background: var(--biblio-surface);"><small class="text-muted d-block" style="font-size:0.65rem;">Clasificación</small><strong class="small" style="color: var(--biblio-text);">${safeClasificacion}</strong></div></div>` : ''}
                    <div class="col-6"><div class="p-2 rounded-3" style="background: var(--biblio-surface);"><small class="text-muted d-block" style="font-size:0.65rem;">No. Adquisición</small><strong class="small" style="color: var(--biblio-text);">${safeAdquisicion}</strong></div></div>
                </div>
                <div class="alert ${stock > 0 ? 'alert-success' : 'alert-secondary'} d-flex align-items-center gap-2 rounded-3 border-0">
                    <i class="bi ${stock > 0 ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                    <div><strong>${stock}</strong> copias disponibles</div>
                </div>
                <div class="rounded-4 p-3 mb-2" style="background: var(--biblio-surface);">
                    <div class="d-flex flex-wrap gap-2 mb-2">
                        <span class="badge rounded-pill ${inWishlist ? 'text-bg-primary' : 'text-bg-light border'}">${inWishlist ? 'En tu lista guardada' : 'No guardado'}</span>
                        <span class="badge rounded-pill ${inWaitlist ? 'text-bg-warning' : 'text-bg-light border'}">${inWaitlist ? 'Esperando stock' : 'Sin espera activa'}</span>
                    </div>
                    <p class="small text-muted mb-0">${stock > 0 ? 'Si lo apartas, tendras 24 horas para recogerlo en mostrador.' : 'Si no hay stock, puedes seguir este titulo desde la lista de espera.'}</p>
                </div>
            </div>
            <div class="modal-footer border-0 px-4 pb-4 d-flex flex-column gap-2">
                ${hasActiveRequest
                    ? `<button id="btn-book-request" class="btn btn-secondary w-100 rounded-pill fw-bold py-2" disabled>
                            <i class="bi bi-check2-circle me-2"></i>Ya tienes este libro en proceso
                       </button>`
                    : (stock > 0
                        ? `<button id="btn-book-request" class="btn btn-biblio w-100 rounded-pill fw-bold py-2" onclick="Biblio.solicitarLibro()">
                                <i class="bi bi-bookmark-plus-fill me-2"></i>Apartar para recoger
                           </button>`
                        : `<button class="btn ${inWaitlist ? 'btn-outline-danger' : 'btn-outline-dark'} w-100 rounded-pill fw-bold py-2" onclick="Biblio.toggleWaitlist('${escapeJsString(id)}')">
                                <i class="bi ${inWaitlist ? 'bi-bell-slash' : 'bi-bell'} me-2"></i>${inWaitlist ? 'Salir de lista de espera' : 'Unirme a lista de espera'}
                           </button>`)}
                <div class="d-grid gap-2 w-100" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                    <button class="btn ${inWishlist ? 'btn-outline-danger' : 'btn-outline-primary'} rounded-pill fw-bold py-2" onclick="Biblio.toggleWishlist('${escapeJsString(id)}')">
                        <i class="bi ${inWishlist ? 'bi-heartbreak' : 'bi-heart'} me-2"></i>${inWishlist ? 'Quitar' : 'Guardar'}
                    </button>
                    <button class="btn btn-outline-dark rounded-pill fw-bold py-2" onclick="Biblio.openSuggestionModal()">
                        <i class="bi bi-lightbulb me-2"></i>Sugerir otro
                    </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-libro-detalle')).show();
    }

    async function solicitarLibro(id, titulo) {
        const bookId = id || _currentBookDetail?.id;
        const bookTitle = titulo || _currentBookDetail?.titulo || 'Libro';
        if (!bookId || !_ctx?.auth?.currentUser) {
            showToast("No se pudo identificar el libro a solicitar.", "warning");
            return;
        }
        if (_requestingLoan) return;

        const btn = document.getElementById('btn-book-request');
        const originalHtml = btn?.innerHTML || '';

        try {
            _requestingLoan = true;
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Solicitando...';
            }

            await BiblioService.autoPrestarLibro(_ctx, {
                uid: _ctx.auth.currentUser.uid,
                email: _ctx.auth.currentUser.email,
                bookId,
                titulo: bookTitle
            });
            if (_studentWishlist.some(item => item.id === bookId) && window.BiblioService?.removeFromWishlist) {
                await BiblioService.removeFromWishlist(_ctx, _ctx.auth.currentUser.uid, bookId).catch(() => {});
            }
            if (_studentWaitlist.some(item => item.id === bookId) && window.BiblioService?.leaveWaitlist) {
                await BiblioService.leaveWaitlist(_ctx, _ctx.auth.currentUser.uid, bookId).catch(() => {});
            }
            showToast("Solicitud registrada. Tienes 24 horas para recoger tu libro en mostrador.", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-libro-detalle'))?.hide();
            await loadStudentFullData();

            // 🔔 Notificación al estudiante tras iniciar préstamo
            if (false && window.Notify && _ctx.auth.currentUser) {
                window.Notify.send(_ctx.auth.currentUser.uid, {
                    tipo: 'biblio',
                    titulo: '📚 Préstamo Iniciado',
                    mensaje: `"${titulo}" está en espera. Pasa a mostrador para recogerlo.`,
                    link: '#/biblio'
                });
            }

            if (window.Notify && _ctx.auth.currentUser) {
                window.Notify.send(_ctx.auth.currentUser.uid, {
                    tipo: 'biblio',
                    titulo: 'Solicitud registrada',
                    mensaje: `"${bookTitle}" quedo apartado. Tienes 24 horas para recogerlo en mostrador.`,
                    link: '#/biblio'
                });
            }

            // [ENCUESTAS] Registrar uso
            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'prestamo_auto', bookId });
            }
        } catch (e) {
            showToast(e.message, "danger");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        } finally {
            _requestingLoan = false;
        }
    }

    // --- MISIONES ---
    async function showMissionsModal() {
        const content = document.getElementById('misiones-content');
        if (!content) return;

        let gamification = _studentGamification;
        if (!gamification) {
            content.innerHTML = `
                <div class="modal-body p-4 text-center">
                    <div class="spinner-border" style="color: var(--biblio);"></div>
                    <p class="small text-muted mt-3 mb-0">Cargando logros...</p>
                </div>
            `;
            gamification = await syncStudentGamification();
        }

        if (!gamification) {
            content.innerHTML = `
                <div class="modal-body p-4 text-center">
                    <i class="bi bi-exclamation-circle fs-1 text-muted d-block mb-2"></i>
                    <p class="small text-muted mb-0">No se pudo cargar tu progreso.</p>
                </div>
            `;
            new bootstrap.Modal(document.getElementById('modal-misiones')).show();
            return;
        }

        const summary = gamification.summary || {};
        const achievements = gamification.achievements || [];
        const recentUnlocks = gamification.recentUnlocks || [];
        const stats = gamification.stats || {};
        const pendingCount = Math.max(0, Number(summary.pendingCount) || Math.max((summary.totalCount || 0) - (summary.completedCount || 0), 0));

        content.innerHTML = `
            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, #FFD24D, #fd7e14);">
                <div>
                    <h5 class="fw-bold mb-1 text-dark"><i class="bi bi-trophy-fill me-2"></i>Logros y Recompensas</h5>
                    <p class="small mb-0 text-dark opacity-75">${escapeHtml(gamification.title || 'Curioso del Acervo')}</p>
                </div>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
                <div class="p-4 border-bottom biblio-missions-primary">
                    <div class="row g-3 align-items-center">
                        <div class="col-12 col-md-6">
                            <div class="d-flex align-items-center gap-3">
                                <div class="rounded-4 d-flex align-items-center justify-content-center text-dark fw-bold" style="width:58px;height:58px;background:rgba(0,0,0,0.08);">
                                    <i class="bi bi-award fs-4"></i>
                                </div>
                                <div>
                                    <p class="small text-uppercase fw-bold mb-1 text-muted">Nivel actual</p>
                                    <h4 class="fw-bold mb-0">Nivel ${gamification.level || 1}</h4>
                                    <p class="small text-muted mb-0">${gamification.xp || 0} XP acumulada</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="rounded-4 p-3 bg-white shadow-sm h-100">
                                <div class="d-flex justify-content-between align-items-center mb-2 small">
                                    <span class="fw-bold">Progreso</span>
                                    <span>${summary.completedCount || 0}/${summary.totalCount || 0}</span>
                                </div>
                                <div class="progress rounded-pill mb-2" style="height:8px;">
                                    <div class="progress-bar" style="width:${Math.max(0, Math.min(100, Number(summary.completionPct) || 0))}%; background: linear-gradient(90deg, #0f766e, #14b8a6);"></div>
                                </div>
                                <p class="small text-muted mb-1">${summary.completionPct || 0}% del panel completado</p>
                                <p class="small text-muted mb-0">${pendingCount} meta${pendingCount === 1 ? '' : 's'} activas · ${summary.completedXp || 0} XP por logros</p>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 mt-3">
                        ${renderPerkChips(gamification.perks || {})}
                    </div>
                    <div class="mt-3">
                        ${renderAchievementStatTiles(stats)}
                    </div>
                </div>

                ${recentUnlocks.length ? `
                    <div class="p-4 border-bottom biblio-missions-secondary">
                        <h6 class="fw-bold mb-3" style="color: var(--biblio-text);">Desbloqueos recientes</h6>
                        <div class="d-flex flex-column gap-2">
                            ${recentUnlocks.map(item => `
                                <div class="rounded-4 border p-3 d-flex align-items-center gap-3">
                                    <div class="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0" style="width:42px;height:42px;background: linear-gradient(135deg, #0f766e, #14b8a6);">
                                        <i class="bi ${escapeHtml(item.icon || 'bi-trophy')}"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="fw-bold small">${escapeHtml(item.title || 'Logro')}</div>
                                        <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(item.rewardLabel || '')}</div>
                                    </div>
                                    <small class="text-muted">${escapeHtml(formatDateLabel(item.completedAtMs))}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}

                <div class="p-4 biblio-missions-secondary">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold mb-0" style="color: var(--biblio-text);">Panel completo de logros</h6>
                        <span class="badge rounded-pill text-bg-light border">${achievements.length}</span>
                    </div>
                    <div class="d-flex flex-column gap-2">
                        ${achievements.map(item => `
                            <div class="rounded-4 border p-3 ${item.completed ? 'bg-white' : ''}" style="${item.completed ? 'border-color: rgba(15,118,110,0.2) !important;' : 'background:#fafafa;'}">
                                <div class="d-flex align-items-start gap-3">
                                    <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 ${item.completed ? 'text-white' : 'text-muted'}" style="width:44px;height:44px;${item.completed ? 'background: linear-gradient(135deg, #0f766e, #14b8a6);' : 'background: #eceff3;'}">
                                        <i class="bi ${escapeHtml(item.icon || 'bi-star')}"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                                            <span class="badge rounded-pill text-bg-light border">${escapeHtml(item.category || 'Logro')}</span>
                                            <span class="badge rounded-pill ${item.completed ? 'text-bg-success' : 'text-bg-secondary'}">${item.completed ? 'Desbloqueado' : `+${item.xpReward || 0} XP`}</span>
                                        </div>
                                        <h6 class="fw-bold mb-1 small" style="color: var(--biblio-text);">${escapeHtml(item.title)}</h6>
                                        <p class="small text-muted mb-2">${escapeHtml(item.description || '')}</p>
                                        <div class="progress rounded-pill mb-2" style="height:6px;">
                                            <div class="progress-bar ${item.completed ? 'bg-success' : ''}" style="width:${Math.max(0, Math.min(100, Number(item.progressPct) || 0))}%; ${item.completed ? '' : 'background: linear-gradient(90deg, #0f766e, #14b8a6);'}"></div>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center small">
                                            <span>${item.progress || 0}/${item.target || 0}</span>
                                            <span class="fw-bold" style="color: var(--biblio);">${escapeHtml(item.rewardLabel || `+${item.xpReward || 0} XP`)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-misiones')).show();
    }

    // --- PRESTAMO: DETALLE, EXTENSION, CANCELACION ---
    function verDetallePrestamo(id) {
        const content = document.getElementById('libro-detalle-content');
        if (!content) return;
        const loan = findLoanById(id);
        if (!loan) {
            showToast("No se encontro el detalle de este prestamo.", "warning");
            return;
        }
        const dueDate = loan.fechaVencimiento?.toDate ? loan.fechaVencimiento.toDate() : null;
        const pickupDeadline = loan.fechaExpiracionRecoleccion?.toDate ? loan.fechaExpiracionRecoleccion.toDate() : null;
        const requestDate = loan.fechaSolicitud?.toDate ? loan.fechaSolicitud.toDate() : null;
        const returnDate = loan.fechaDevolucionReal?.toDate ? loan.fechaDevolucionReal.toDate() : null;
        const cancellationDate = loan.fechaCancelacion?.toDate ? loan.fechaCancelacion.toDate() : null;
        const extensionCount = Number(loan.extensiones) || 0;
        const isDelivered = loan.estado === 'entregado';
        const isPendingPickup = ['pendiente', 'pendiente_entrega'].includes(loan.estado);
        const overdueAmount = Number(loan.multaActual || loan.montoDeuda || 0);
        const canExtend = isDelivered && extensionCount === 0 && (!dueDate || dueDate > new Date());
        content.innerHTML = `
            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, rgba(15,118,110,0.12), rgba(20,184,166,0.06));">
                <div>
                    <h5 class="fw-bold mb-1">Detalle de prestamo</h5>
                    <p class="small text-muted mb-0">${escapeHtml(loan.tituloLibro || 'Libro')}</p>
                </div>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <div class="rounded-4 p-3" style="background: var(--biblio-surface);">
                            <div class="small text-muted mb-1">Estado</div>
                            <div class="fw-bold text-dark">${escapeHtml((loan.estado_simulado || loan.estado || 'N/A').split('_').join(' '))}</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="rounded-4 p-3" style="background: var(--biblio-surface);">
                            <div class="small text-muted mb-1">Extensiones</div>
                            <div class="fw-bold text-dark">${extensionCount}/1</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="rounded-4 p-3" style="background: var(--biblio-surface);">
                            <div class="small text-muted mb-1">Solicitado</div>
                            <div class="fw-bold text-dark">${escapeHtml(formatDateTime(requestDate))}</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="rounded-4 p-3" style="background: var(--biblio-surface);">
                            <div class="small text-muted mb-1">${isPendingPickup ? 'Recoger antes de' : 'Fecha limite'}</div>
                            <div class="fw-bold text-dark">${escapeHtml(formatDateTime(isPendingPickup ? pickupDeadline : dueDate))}</div>
                        </div>
                    </div>
                </div>
                <div class="rounded-4 p-3 mb-3 ${overdueAmount > 0 ? 'border border-danger-subtle' : ''}" style="background: ${overdueAmount > 0 ? 'rgba(220,53,69,0.08)' : 'var(--biblio-surface)'};">
                    <div class="d-flex justify-content-between align-items-center gap-3">
                        <div>
                            <div class="small text-muted mb-1">${overdueAmount > 0 ? 'Adeudo estimado' : 'Situacion actual'}</div>
                            <div class="fw-bold ${overdueAmount > 0 ? 'text-danger' : 'text-dark'}">${overdueAmount > 0 ? `$${overdueAmount.toFixed(2)}` : 'Sin adeudos registrados'}</div>
                        </div>
                        <i class="bi ${overdueAmount > 0 ? 'bi-exclamation-triangle-fill text-danger' : 'bi-patch-check-fill text-success'} fs-3"></i>
                    </div>
                </div>
                <div class="small text-muted mb-0">
                    ${returnDate ? `Movimiento final registrado: ${escapeHtml(formatDateTime(returnDate))}.` : ''}
                    ${cancellationDate ? ` Cancelado: ${escapeHtml(formatDateTime(cancellationDate))}.` : ''}
                    ${isPendingPickup ? ' Recuerda pasar a mostrador dentro de la ventana de recoleccion.' : ' Devuelvelo a tiempo para evitar multas y conservar tu racha.'}
                </div>
            </div>
            <div class="modal-footer border-0 px-4 pb-4 d-flex gap-2 flex-wrap">
                ${canExtend ? `<button class="btn btn-biblio rounded-pill px-4" onclick="Biblio.solicitarExtension('${escapeJsString(loan.id)}')"><i class="bi bi-plus-circle me-2"></i>Extender 1 dia</button>` : ''}
                ${isPendingPickup ? `<button class="btn btn-outline-danger rounded-pill px-4" onclick="Biblio.cancelarSolicitud('${escapeJsString(loan.id)}')"><i class="bi bi-x-circle me-2"></i>Cancelar solicitud</button>` : ''}
                <button class="btn btn-outline-secondary rounded-pill px-4 ms-auto" data-bs-dismiss="modal">Cerrar</button>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-libro-detalle')).show();
    }

    async function solicitarExtension(loanId) {
        if (!confirm("Solicitar extension de 1 dia? (Solo valido 1 vez)")) return;
        try {
            await BiblioService.extenderPrestamo(_ctx, loanId);
            showToast("Extension aplicada", "success");
            await loadStudentFullData();
        } catch (e) { showToast(e.message, "danger"); }
    }

    async function cancelarSolicitud(loanId) {
        if (!confirm("Cancelar solicitud?")) return;
        try {
            await BiblioService.cancelarSolicitud(_ctx, loanId);
            showToast("Solicitud cancelada", "success");
            await loadStudentFullData();
        } catch (e) { showToast(e.message, "danger"); }
    }

    // --- CARGA DE DATOS ESTUDIANTE ---
    async function loadStudentFullData() {
        if (!_ctx?.auth?.currentUser) return;
        try {
            let perfil = await BiblioService.getPerfilBibliotecario(_ctx, _ctx.auth.currentUser.uid);
            if (!perfil) return;

            const gamification = await syncStudentGamification(perfil);
            if (gamification?.profile) {
                perfil = gamification.profile;
            }

            if (window.Encuestas && window.Encuestas.checkAndShowServiceSurvey) {
                setTimeout(() => window.Encuestas.checkAndShowServiceSurvey('biblioteca'), 2000);
            }

            const heroName = document.getElementById('hero-user-name');
            const heroSub = document.getElementById('hero-user-subtitle');
            if (heroName) heroName.textContent = `Hola, ${(perfil.nombre || 'Estudiante').split(' ')[0]}`;
            if (heroSub) heroSub.textContent = `${perfil.matricula || ''} - ${perfil.tituloBiblioteca || 'Explora, aprende y crece.'}`;

            const elLvlBadge = document.getElementById('xp-level-badge');
            const elCur = document.getElementById('xp-current');
            const elBar = document.getElementById('xp-bar-fill');
            const nextLevelXP = gamification?.summary?.nextLevelXp || Math.max(perfil.nivel * 500, 500);
            const progress = gamification?.summary?.levelProgressPct ?? Math.min((perfil.xp / nextLevelXP) * 100, 100);

            if (elLvlBadge) elLvlBadge.innerText = `NIVEL ${perfil.nivel}`;
            if (elCur) elCur.innerText = `${perfil.xp} XP`;
            if (elBar) elBar.style.width = `${progress}%`;

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

            _fullLists['list-solicitudes'] = perfil.solicitados || [];
            _fullLists['list-enmano'] = perfil.recogidos || [];
            _fullLists['list-historial'] = perfil.historial || [];

            renderGamificationSummary(perfil, gamification || _studentGamification);
            renderBookList('list-solicitudes', perfil.solicitados || [], 'solicitado');
            renderBookList('list-enmano', perfil.recogidos || [], 'recogido');
            renderBookList('list-historial', perfil.historial || [], 'historial');
            renderActivitySummary();
            await loadStudentCollections();
            await loadMisReservas();
            await renderRecommendations(perfil);
            showGamificationToast(gamification);
        } catch (e) {
            console.error("Error cargando perfil:", e);
            showToast("No se pudo actualizar tu informacion de biblioteca.", "warning");
        }
    }

    async function refreshData() {
        await loadStudentFullData();
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
                <div class="text-center py-4 text-muted  rounded-4">
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

    async function renderRecommendations(perfil) {
        const container = document.getElementById('biblio-recomendaciones');
        if (!container) return;

        try {
            const historyIds = new Set((perfil?.historial || []).map(item => item.libroId).filter(Boolean));
            const recommendationSlots = Math.max(3, Number(_studentGamification?.perks?.recommendationSlots) || 3);
            const topBooks = await BiblioService.getTopBooks(_ctx, Math.max(6, recommendationSlots * 2));
            const books = (topBooks || []).filter(book => !historyIds.has(book.id)).slice(0, recommendationSlots);

            if (books.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-3">
                        <h6 class="fw-bold mb-3" style="color: var(--biblio-text);">
                            <i class="bi bi-stars me-2" style="color: var(--biblio);"></i>Te puede interesar
                        </h6>
                        <div class="d-flex flex-column gap-2">
                            ${books.map(book => `
                                <div class="card border-0 rounded-3 biblio-book-result" style="background: var(--biblio-surface);" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')">
                                    <div class="card-body p-3 d-flex align-items-center justify-content-between gap-3">
                                        <div class="overflow-hidden">
                                            <div class="fw-bold text-truncate" style="color: var(--biblio-text);">${escapeHtml(book.titulo || 'Libro')}</div>
                                            <div class="small text-muted text-truncate">${escapeHtml(book.autor || 'Autor desconocido')}</div>
                                        </div>
                                        <span class="badge ${Number(book.copiasDisponibles) > 0 ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} rounded-pill">
                                            ${Number(book.copiasDisponibles) > 0 ? 'Disponible' : 'Sin stock'}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('[Biblio] No se pudieron cargar recomendaciones:', error);
            container.innerHTML = '';
        }
    }

    async function loadStudentCollections() {
        const uid = _ctx?.auth?.currentUser?.uid;
        if (!uid) return;

        try {
            const [wishlist, waitlist, serviceCatalog] = await Promise.all([
                window.BiblioService?.getWishlist ? BiblioService.getWishlist(_ctx, uid) : Promise.resolve([]),
                window.BiblioService?.getMyWaitlist ? BiblioService.getMyWaitlist(_ctx, uid) : Promise.resolve([]),
                window.BiblioAssetsService?.getServiceCatalog ? BiblioAssetsService.getServiceCatalog(_ctx) : Promise.resolve(null)
            ]);

            _studentWishlist = Array.isArray(wishlist) ? wishlist : [];
            _studentWaitlist = Array.isArray(waitlist) ? waitlist : [];
            _serviceCatalog = serviceCatalog || null;
        } catch (error) {
            console.warn('[Biblio] No se pudieron cargar paneles del estudiante:', error);
            _studentWishlist = [];
            _studentWaitlist = [];
            _serviceCatalog = null;
        }

        renderWishlistSection();
        renderWaitlistSection();
        renderServiceHub();
        renderActivitySummary();
    }

    function renderWishlistSection() {
        const summary = document.getElementById('biblio-wishlist-summary');
        const container = document.getElementById('biblio-wishlist-section');
        if (summary) {
            summary.textContent = _studentWishlist.length
                ? `${_studentWishlist.length} libro${_studentWishlist.length === 1 ? '' : 's'} guardado${_studentWishlist.length === 1 ? '' : 's'}`
                : 'Aun no has guardado libros.';
        }
        if (!container) return;

        if (!_studentWishlist.length) {
            container.innerHTML = `
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-4 text-center text-muted">
                        <i class="bi bi-heart fs-1 d-block mb-2 opacity-50"></i>
                        <h6 class="fw-bold mb-1" style="color: var(--biblio-text);">Tu lista guardada esta vacia</h6>
                        <p class="small mb-0">Abre un libro y guardalo para consultarlo despues.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold mb-0" style="color: var(--biblio-text);">
                            <i class="bi bi-heart-fill me-2 text-primary"></i>Mi lista guardada
                        </h6>
                        <span class="badge rounded-pill text-bg-light border">${_studentWishlist.length}</span>
                    </div>
                    <div class="d-flex flex-column gap-2">
                        ${_studentWishlist.slice(0, 6).map(book => `
                            <div class="card border-0 rounded-4" style="background: var(--biblio-surface);">
                                <div class="card-body p-3 d-flex align-items-center gap-3">
                                    <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style="width:44px;height:58px;background:#0f766e;color:#fff;font-weight:700;">
                                        ${escapeHtml((book.titulo || '?').charAt(0).toUpperCase())}
                                    </div>
                                    <div class="flex-grow-1 overflow-hidden" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')" style="cursor:pointer;">
                                        <div class="fw-bold text-truncate" style="color: var(--biblio-text);">${escapeHtml(book.titulo || 'Libro')}</div>
                                        <div class="small text-muted text-truncate">${escapeHtml(book.autor || 'Autor desconocido')}</div>
                                    </div>
                                    <div class="d-flex flex-column align-items-end gap-2">
                                        <span class="badge ${Number(book.copiasDisponibles) > 0 ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} rounded-pill">
                                            ${Number(book.copiasDisponibles) > 0 ? 'Disponible' : 'Sin stock'}
                                        </span>
                                        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="event.stopPropagation(); Biblio.toggleWishlist('${escapeJsString(book.id)}')">
                                            <i class="bi bi-heartbreak me-1"></i>Quitar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderWaitlistSection() {
        const container = document.getElementById('list-waitlist-books');
        if (!container) return;

        if (!_studentWaitlist.length) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted rounded-4" style="background: var(--biblio-surface);">
                    <i class="bi bi-hourglass fs-1 d-block mb-2 opacity-50"></i>
                    <p class="mb-0 small">No estas esperando ningun libro por ahora.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = _studentWaitlist.map(book => `
            <div class="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start gap-3">
                        <div class="overflow-hidden flex-grow-1" onclick="Biblio.openBookDetailFromPayload('${encodeBookPayload(book)}')" style="cursor:pointer;">
                            <div class="fw-bold text-dark text-truncate">${escapeHtml(book.titulo || 'Libro')}</div>
                            <div class="small text-muted text-truncate mb-2">${escapeHtml(book.autor || 'Autor desconocido')}</div>
                            <div class="d-flex flex-wrap gap-2">
                                <span class="badge rounded-pill ${Number(book.copiasDisponibles) > 0 ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">
                                    ${Number(book.copiasDisponibles) > 0 ? 'Ya hay copias disponibles' : 'Seguimos esperando stock'}
                                </span>
                                <span class="badge rounded-pill text-bg-light border">Te uniste ${escapeHtml(formatDateLabel(getMillis(book.joinedAt)) || 'recientemente')}</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger rounded-pill flex-shrink-0" onclick="Biblio.toggleWaitlist('${escapeJsString(book.id)}')">
                            <i class="bi bi-x-circle me-1"></i>Salir
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderActivitySummary() {
        const container = document.getElementById('biblio-activity-summary');
        if (!container) return;

        const cards = [
            {
                icon: 'bi-hourglass-split',
                label: 'Por recoger',
                value: (_fullLists['list-solicitudes'] || []).length,
                helper: 'solicitudes activas',
                accent: 'info'
            },
            {
                icon: 'bi-backpack2',
                label: 'En mano',
                value: (_fullLists['list-enmano'] || []).length,
                helper: 'préstamos activos',
                accent: 'warning'
            },
            {
                icon: 'bi-calendar-check',
                label: 'Reservas',
                value: _studentReservations.length,
                helper: 'espacios apartados',
                accent: 'success'
            },
            {
                icon: 'bi-hourglass',
                label: 'Espera',
                value: _studentWaitlist.length,
                helper: 'libros monitoreados',
                accent: 'secondary'
            }
        ];

        container.innerHTML = `
            <div class="row g-2">
                ${cards.map(item => `
                    <div class="col-6 col-lg-3">
                        <div class="card border-0 shadow-sm rounded-4 h-100 biblio-activity-card">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center gap-2 mb-2 small text-muted">
                                    <div class="rounded-circle bg-${item.accent} bg-opacity-10 d-flex align-items-center justify-content-center" style="width:32px;height:32px;">
                                        <i class="bi ${item.icon} text-${item.accent}"></i>
                                    </div>
                                    <span>${item.label}</span>
                                </div>
                                <div class="fw-bold fs-4" style="color: var(--biblio-text);">${item.value}</div>
                                <div class="small text-muted">${item.helper}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderServiceHub() {
        const container = document.getElementById('biblio-service-hub');
        if (!container) return;

        const catalog = _serviceCatalog || {};
        const types = ['pc', 'sala', 'mesa'];
        container.innerHTML = types.map(type => {
            const meta = getServiceTypeMeta(type);
            const item = catalog[type] || { total: 0, available: 0, occupied: 0 };
            const isEnabled = item.total > 0;
            const subtitle = !isEnabled
                ? 'Sin espacios configurados'
                : (item.available > 0
                    ? `${item.available} disponible${item.available === 1 ? '' : 's'} ahora`
                    : `${item.total} activo${item.total === 1 ? '' : 's'} sin espacios libres ahora`);

            return `
                <div class="col-12 col-md-4">
                    <div class="card border-0 shadow-sm rounded-4 h-100 ${isEnabled ? 'biblio-book-result' : 'biblio-service-card-disabled'}"
                         ${isEnabled ? `onclick="Biblio.abrirModalServicio('${type}')"` : ''}>
                        <div class="card-body p-3 d-flex align-items-center gap-3">
                            <div class="p-2 rounded-3 bg-${meta.accent} bg-opacity-10">
                                <i class="bi ${meta.icon} text-${meta.accent}"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-0 small" style="color: var(--biblio-text);">${meta.label}</h6>
                                <small class="text-muted d-block" style="font-size:0.72rem;">${meta.description}</small>
                                <small class="${isEnabled ? 'text-dark' : 'text-muted'} d-block mt-1" style="font-size:0.72rem;">${subtitle}</small>
                            </div>
                            ${isEnabled ? '<i class="bi bi-chevron-right text-muted"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openSuggestionModal() {
        const titleInput = document.getElementById('sug-titulo');
        const authorInput = document.getElementById('sug-autor');
        if (titleInput) titleInput.value = '';
        if (authorInput) authorInput.value = '';
        new bootstrap.Modal(document.getElementById('modal-sugerencia')).show();
    }

    function _createBookCard(item, type) {
        const el = document.createElement('div');
        const titulo = escapeHtml(item.tituloLibro || 'Libro desconocido');

        let statusColor = 'secondary';
        let statusText = 'Desconocido';
        let mainDate = '--';
        let dateLabel = '';
        let actionBtn = '';
        let alertLate = false;

        if (type === 'recogido') {
            const venc = item.fechaVencimiento?.toDate ? item.fechaVencimiento.toDate() : null;
            const now = new Date();
            const isToday = venc && now.toDateString() === venc.toDateString();
            const isLate = venc && now > venc;
            const isAfter3PM = now.getHours() >= 15;

            alertLate = Boolean((isToday && isAfter3PM) || isLate);
            statusColor = isLate ? 'danger' : (isToday ? 'info' : 'warning');
            statusText = isLate ? 'VENCIDO' : (isToday ? 'VENCE HOY' : 'EN PRESTAMO');
            mainDate = venc ? venc.toLocaleDateString() : '--';
            dateLabel = 'Fecha limite';

            const canExtend = !isLate && !isToday && !(item.extensiones > 0);
            actionBtn = `
                <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="Biblio.verDetallePrestamo('${escapeJsString(item.id)}')">
                    <i class="bi bi-eye me-1"></i>Detalle
                </button>
                ${canExtend ? `<button class="btn btn-sm rounded-pill ms-2" style="border-color:#0f766e; color:#0f766e;" onclick="Biblio.solicitarExtension('${escapeJsString(item.id)}')">
                    <i class="bi bi-plus-circle me-1"></i>+1 dia
                </button>` : ''}
            `;
        } else if (type === 'solicitado') {
            const exp = item.fechaExpiracionRecoleccion?.toDate ? item.fechaExpiracionRecoleccion.toDate() : null;
            const isExpired = exp && exp <= new Date();
            statusColor = isExpired ? 'danger' : 'info';
            statusText = isExpired ? 'POR VENCER / EXPIRADA' : 'PENDIENTE POR RECOGER';
            mainDate = exp ? `${exp.toLocaleDateString()} ${exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--';
            dateLabel = 'Recoger antes de';
            actionBtn = `<button class="btn btn-sm btn-outline-danger rounded-pill" onclick="Biblio.cancelarSolicitud('${escapeJsString(item.id)}')">
                <i class="bi bi-x-circle me-1"></i>Cancelar
            </button>`;
        } else if (type === 'historial') {
            const simulatedState = item.estado_simulado || item.estado;
            statusColor = simulatedState === 'finalizado'
                ? 'success'
                : (simulatedState === 'cobro_pendiente' ? 'danger' : 'secondary');
            statusText = simulatedState === 'finalizado'
                ? 'DEVUELTO'
                : (simulatedState === 'cobro_pendiente'
                    ? 'CON MULTA'
                    : (simulatedState === 'no_recogido' ? 'NO RECOGIDO' : escapeHtml((item.estado || 'N/A').toUpperCase())));
            const devol = item.fechaDevolucionReal?.toDate ? item.fechaDevolucionReal.toDate().toLocaleDateString() : '';
            const cancel = item.fechaCancelacion?.toDate ? item.fechaCancelacion.toDate().toLocaleDateString() : '';
            mainDate = devol || cancel || '--';
            dateLabel = simulatedState === 'no_recogido' ? 'Cancelado el' : 'Movimiento';
        }

        el.className = `card border-0 shadow-sm rounded-4 overflow-hidden biblio-card-stripe-${statusColor} mb-3`;
        el.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge bg-${statusColor}-subtle text-${statusColor} rounded-pill fw-bold small">${statusText}</span>
                    ${alertLate ? '<i class="bi bi-alarm-fill text-danger fs-5" title="Devolver urgentemente"></i>' : ''}
                </div>
                <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">${titulo}</h6>
                <div class="d-flex align-items-center text-muted small mb-2">
                    <i class="bi bi-calendar-event me-2"></i>${escapeHtml(dateLabel)}: <strong class="ms-1 text-dark">${escapeHtml(mainDate)}</strong>
                </div>
                ${actionBtn ? `<div class="d-flex justify-content-end gap-2">${actionBtn}</div>` : ''}
            </div>
        `;
        return el;
    }

    // --- MIS RESERVAS ---
    async function loadMisReservas() {
        const container = document.getElementById('list-mis-reservas');
        if (!container || !_ctx?.auth?.currentUser) return;
        try {
            const reservas = await BiblioAssetsService.getMyReservations(_ctx, _ctx.auth.currentUser.uid);
            _studentReservations = Array.isArray(reservas) ? reservas : [];
            if (!reservas || reservas.length === 0) {
                renderActivitySummary();
                container.innerHTML = `
                    <div class="text-center py-4 text-muted rounded-4">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>
                        <p class="mb-0 small">No tienes reservas activas.</p>
                    </div>`;
                return;
            }

            renderActivitySummary();
            container.innerHTML = reservas.map(r => {
                const reservationId = escapeJsString(r.id);
                const assetLabel = escapeHtml(r.assetName || r.assetId || 'Activo');
                const timeLabel = escapeHtml(`${r.date} - ${r.hourBlock}`);
                const meta = getServiceTypeMeta(r.tipo);
                return `
                    <div class="card border-0 shadow-sm rounded-3 mb-2">
                        <div class="card-body p-3 d-flex align-items-center gap-3">
                            <div class="bg-${meta.accent} bg-opacity-10 p-2 rounded-3">
                                <i class="bi ${meta.icon} text-${meta.accent}"></i>
                            </div>
                            <div class="flex-grow-1 overflow-hidden">
                                <h6 class="fw-bold mb-0 small text-truncate">${assetLabel}</h6>
                                <small class="text-muted d-block text-truncate">${escapeHtml(meta.label)} · ${timeLabel}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-success-subtle text-success rounded-pill d-inline-block mb-2">Activa</span>
                                <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="Biblio.cancelarReserva('${reservationId}')">
                                    <i class="bi bi-x-circle me-1"></i>Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            _studentReservations = [];
            renderActivitySummary();
            console.warn("Error cargando reservas:", e);
            container.innerHTML = `<div class="alert alert-warning border-0 rounded-3 small mb-0">${escapeHtml(e.message || 'No se pudieron cargar tus reservas.')}</div>`;
        }
    }

    async function cancelarReserva(reservationId) {
        if (!reservationId) return;
        if (!confirm("Cancelar esta reserva?")) return;
        try {
            await BiblioAssetsService.cancelarReserva(_ctx, reservationId);
            showToast("Reserva cancelada.", "success");
            await loadStudentFullData();
            if (document.getElementById('modal-servicio-reserva')?.classList.contains('show')) {
                await renderAvailabilityGrid();
            }
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function sendSuggestion() {
        const titleInput = document.getElementById('sug-titulo');
        const authorInput = document.getElementById('sug-autor');
        if (!titleInput || !authorInput) {
            showToast("La sugerencia de compra no esta disponible en esta vista.", "info");
            return;
        }
        const t = titleInput.value?.trim();
        const a = authorInput.value?.trim();
        if (!t) return showToast("Falta titulo", "warning");
        try {
            await BiblioService.addSuggestion(_ctx, { titulo: t, autor: a, by: _ctx.auth.currentUser.uid, uid: _ctx.auth.currentUser.uid });
            showToast("Sugerencia enviada", "success");
            titleInput.value = '';
            authorInput.value = '';
            bootstrap.Modal.getInstance(document.getElementById('modal-sugerencia'))?.hide();
            await loadStudentFullData();
        } catch (e) { showToast(e.message || "Error enviando", "danger"); }
    }

    async function toggleWishlist(bookId = null) {
        const uid = _ctx?.auth?.currentUser?.uid;
        const book = bookId ? (_studentWishlist.find(item => item.id === bookId) || _currentBookDetail) : _currentBookDetail;
        const resolvedBookId = bookId || book?.id;
        if (!uid || !resolvedBookId || !window.BiblioService) return;

        try {
            const exists = _studentWishlist.some(item => item.id === resolvedBookId);
            if (exists) {
                await BiblioService.removeFromWishlist(_ctx, uid, resolvedBookId);
                showToast("Libro quitado de tu lista guardada.", "info");
            } else {
                await BiblioService.saveToWishlist(_ctx, uid, {
                    id: resolvedBookId,
                    titulo: book?.titulo || '',
                    autor: book?.autor || '',
                    categoria: book?.categoria || '',
                    clasificacion: book?.clasificacion || '',
                    adquisicion: book?.adquisicion || '',
                    anio: book?.anio || '',
                    copiasDisponibles: Number(book?.stock ?? book?.copiasDisponibles) || 0
                });
                showToast("Libro guardado en tu lista.", "success");
            }

            await loadStudentCollections();
            if (_currentBookDetail?.id === resolvedBookId) {
                verDetalleLibro(
                    _currentBookDetail.id,
                    _currentBookDetail.titulo,
                    _currentBookDetail.autor,
                    _currentBookDetail.stock,
                    _currentBookDetail.categoria,
                    _currentBookDetail.clasificacion,
                    _currentBookDetail.anio,
                    _currentBookDetail.adquisicion
                );
            }
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar tu lista guardada.', "danger");
        }
    }

    async function toggleWaitlist(bookId = null) {
        const uid = _ctx?.auth?.currentUser?.uid;
        const book = bookId ? (_studentWaitlist.find(item => item.id === bookId) || _currentBookDetail) : _currentBookDetail;
        const resolvedBookId = bookId || book?.id;
        if (!uid || !resolvedBookId || !window.BiblioService) return;

        try {
            const exists = _studentWaitlist.some(item => item.id === resolvedBookId);
            if (exists) {
                await BiblioService.leaveWaitlist(_ctx, uid, resolvedBookId);
                showToast("Saliste de la lista de espera.", "info");
            } else {
                await BiblioService.joinWaitlist(_ctx, uid, {
                    id: resolvedBookId,
                    titulo: book?.titulo || '',
                    autor: book?.autor || '',
                    categoria: book?.categoria || '',
                    adquisicion: book?.adquisicion || ''
                });
                showToast("Te uniste a la lista de espera.", "success");
            }

            await loadStudentCollections();
            if (_currentBookDetail?.id === resolvedBookId) {
                verDetalleLibro(
                    _currentBookDetail.id,
                    _currentBookDetail.titulo,
                    _currentBookDetail.autor,
                    _currentBookDetail.stock,
                    _currentBookDetail.categoria,
                    _currentBookDetail.clasificacion,
                    _currentBookDetail.anio,
                    _currentBookDetail.adquisicion
                );
            }
        } catch (error) {
            showToast(error.message || 'No se pudo actualizar la lista de espera.', "danger");
        }
    }

    // [FIX] Update Dashboard Helper
    async function updateDashboard() {
        try {
            // Filter today
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));

            // Count active visits
            const visitsSnap = await _ctx.db.collection('biblio-visitas') // Define Const or use string
                .where('fecha', '>=', startOfDay)
                .orderBy('fecha', 'desc')
                .limit(100)
                .get();

            const todayVisits = visitsSnap.docs;

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
                                <div class=" rounded-circle p-2 me-3">
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


    // --- SERVICIOS DIGITALES ---

    let _currentServiceType = 'pc';
    let _selectedAssetId = null;
    let _selectedTimeBlock = null;

    function abrirModalServicio(type) {
        _currentServiceType = type || 'pc';
        _selectedAssetId = null;
        _selectedTimeBlock = null;
        const modalContent = document.getElementById('servicio-reserva-content');
        const today = new Date().toISOString().split('T')[0];
        const serviceMeta = getServiceTypeMeta(_currentServiceType);
        const serviceState = _serviceCatalog?.[_currentServiceType] || { total: 0, available: 0 };
        if (serviceState.total < 1) {
            showToast(`No hay ${serviceMeta.label.toLowerCase()}s configuradas por ahora.`, "info");
            return;
        }
        const perks = _studentGamification?.perks || {};
        const dailyLimit = Math.max(1, Number(perks.maxDailyReservations) || 1);
        const minLeadMinutes = Math.max(5, Number(perks.reservationLeadMinutes) || 15);

        modalContent.innerHTML = `
            <div class="modal-header border-0 p-4" style="background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: white;">
                <div>
                    <h5 class="fw-bold mb-1"><i class="bi ${serviceMeta.icon} me-2"></i>${serviceMeta.label}</h5>
                    <p class="small mb-0 opacity-75">${serviceMeta.description}</p>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4" style="background: var(--biblio-surface);">
                <div class="alert alert-info border-0 rounded-3 small mb-3">
                    <i class="bi bi-info-circle me-1"></i>Puedes reservar <strong>${dailyLimit} bloque${dailyLimit === 1 ? '' : 's'} por dia</strong>. El horario elegido debe apartarse con al menos ${minLeadMinutes} minutos de anticipacion.
                </div>
                <div class="row g-3 mb-3">
                    <div class="col-12 col-md-6">
                        <label class="small fw-bold text-muted mb-2">Fecha</label>
                        <input type="date" class="form-control rounded-4" id="service-date-picker" value="${today}" min="${today}" onchange="Biblio.renderAvailabilityGrid()">
                    </div>
                    <div class="col-12 col-md-6">
                        <label class="small fw-bold text-muted mb-2">Disponibilidad actual</label>
                        <div class="form-control rounded-4 bg-white d-flex align-items-center">${serviceState.available} disponible${serviceState.available === 1 ? '' : 's'} de ${serviceState.total}</div>
                    </div>
                </div>
                <label class="small fw-bold text-muted mb-2">Elige tu horario</label>
                <div id="service-availability-grid" class="d-flex flex-column gap-2" style="max-height: 350px; overflow-y: auto;">
                    <div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm" style="color:#0f766e;"></span> Cargando disponibilidad...</div>
                </div>
            </div>
            <div class="modal-footer border-0 p-3">
                <button class="btn btn-biblio w-100 rounded-pill fw-bold py-2" id="btn-confirm-service" disabled onclick="Biblio.confirmarReserva()">
                    Confirmar reserva
                </button>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('modal-servicio-reserva')).show();
        setTimeout(renderAvailabilityGrid, 500);
    }

    async function renderAvailabilityGrid() {
        const date = document.getElementById('service-date-picker').value;
        const container = document.getElementById('service-availability-grid');
        if (!container || !date) return;

        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border" style="color:#0f766e;"></div></div>';

        try {
            const serviceMeta = getServiceTypeMeta(_currentServiceType);
            const allAssets = await new Promise(resolve => {
                const unsub = BiblioAssetsService.streamAssets(_ctx, (list) => {
                    resolve(list.filter(a => a.tipo === _currentServiceType && (a.status === 'disponible' || a.status === 'ocupado')));
                    unsub();
                });
            });

            const occupiedMap = await BiblioAssetsService.getAvailability(_ctx, date, _currentServiceType);

            if (allAssets.length === 0) {
                container.innerHTML = `<div class="alert alert-secondary small border-0 rounded-3">No hay ${escapeHtml(serviceMeta.label.toLowerCase())}s registradas.</div>`;
                return;
            }

            container.innerHTML = '';
            const hours = [];
            for (let i = 8; i <= 18; i++) hours.push(`${i.toString().padStart(2, '0')}:00`);
            const now = new Date();
            const today = new Date().toISOString().split('T')[0];
            const perks = _studentGamification?.perks || {};
            const minLeadMinutes = Math.max(5, Number(perks.reservationLeadMinutes) || 15);

            allAssets.forEach(asset => {
                const assetRow = document.createElement('div');
                assetRow.className = 'p-3 rounded-3 shadow-sm mb-2';
                assetRow.style.background = 'white';

                const occupiedHours = occupiedMap[asset.id] || [];
                const occupiedUntil = asset.expiresAt?.toDate ? asset.expiresAt.toDate() : null;
                const safeAssetId = escapeJsString(asset.id || '');

                let slotsHtml = `<div class="d-flex gap-2 overflow-auto pb-1" style="scrollbar-width:thin;">`;
                hours.forEach(h => {
                    const slotStart = new Date(`${date}T${h}:00`);
                    const isTaken = occupiedHours.includes(h);
                    const isTooSoon = slotStart.getTime() - now.getTime() < minLeadMinutes * 60 * 1000;
                    const overlapsCurrentUse = today === date && asset.status === 'ocupado' && (!occupiedUntil || occupiedUntil > slotStart);
                    const disabled = isTaken || isTooSoon || overlapsCurrentUse;

                    if (disabled) {
                        const cls = isTaken
                            ? 'bg-danger-subtle text-danger border-danger'
                            : ((overlapsCurrentUse || asset.status === 'ocupado') ? 'bg-warning-subtle text-warning border-warning' : 'text-muted border-light');
                        slotsHtml += `<button class="btn btn-sm ${cls} rounded-pill px-3" disabled style="min-width:70px;">${h}</button>`;
                    } else {
                        slotsHtml += `<button class="btn btn-sm rounded-pill px-3" style="min-width:70px; border-color:#0f766e; color:#0f766e;" 
                                        onclick="Biblio.selectSlot(this, '${safeAssetId}', '${h}')">${h}</button>`;
                    }
                });
                slotsHtml += `</div>`;

                assetRow.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi ${serviceMeta.icon} me-2" style="color:#0f766e;"></i>
                        <span class="fw-bold small" style="color:#1e293b;">${escapeHtml(asset.nombre || serviceMeta.label)}</span>
                        ${asset.status === 'ocupado' ? '<span class="badge bg-warning-subtle text-warning ms-2" style="font-size:0.6rem;">En uso</span>' : ''}
                    </div>
                    ${slotsHtml}
                `;
                container.appendChild(assetRow);
            });

        } catch (e) {
            container.innerHTML = `<div class="text-danger small">Error: ${escapeHtml(e.message)}</div>`;
        }
    }

    function selectSlot(btn, assetId, time) {
        document.querySelectorAll('#service-availability-grid button').forEach(b => {
            if (!b.disabled) {
                b.classList.remove('text-white');
                b.style.background = '';
                b.style.borderColor = '#0f766e';
                b.style.color = '#0f766e';
            }
        });

        btn.style.background = '#0f766e';
        btn.style.borderColor = '#0f766e';
        btn.style.color = 'white';
        btn.classList.add('text-white');

        _selectedAssetId = assetId;
        _selectedTimeBlock = time;
        document.getElementById('btn-confirm-service').disabled = false;
    }

    async function confirmarReserva() {
        const date = document.getElementById('service-date-picker').value;
        if (!_selectedAssetId || !_selectedTimeBlock || !date) return;
        const serviceMeta = getServiceTypeMeta(_currentServiceType);

        const btn = document.getElementById('btn-confirm-service');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Reservando...';

        try {
            await BiblioAssetsService.reservarEspacio(_ctx, {
                studentId: _ctx.auth.currentUser.uid,
                assetId: _selectedAssetId,
                hourBlock: _selectedTimeBlock,
                date,
                tipo: _currentServiceType
            });
            if (window.BiblioService?.procesarRecompensa) {
                await BiblioService.procesarRecompensa(_ctx, _ctx.auth.currentUser.uid, 'uso_activo');
            }

            try {
                const statsRef = _ctx.db.collection('biblio-stats').doc(`reservas-${_currentServiceType}`);
                await statsRef.set({
                    total: firebase.firestore.FieldValue.increment(1),
                    lastReservation: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (statsErr) {
                console.warn('[BIBLIO] Stats error:', statsErr);
            }

            showToast(`${serviceMeta.label} reservada para las ${_selectedTimeBlock}.`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-servicio-reserva'))?.hide();

            if (window.EncuestasServicioService) {
                EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: `reserva_${_currentServiceType}`, assetId: _selectedAssetId, hora: _selectedTimeBlock });
            }

            await loadStudentFullData();
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Reintentar";
        }
    }

    // --- TUTORIAL ONBOARDING BIBLIOTECA ---
    const BIBLIO_TOUR_VERSION = 'v1';
    async function checkBiblioTutorial() {
        try {
            const uid = _ctx?.auth?.currentUser?.uid;
            if (!uid) return;

            // Restringir el tutorial solo a estudiantes
            const profile = window.Store?.userProfile || window.SIA?.currentUserProfile;
            if (profile && profile.role && profile.role !== 'student') return;

            const key = `sia_biblio_tour_done_${BIBLIO_TOUR_VERSION}_${uid}`;

            if (window.SIA?.getUserPreferences) {
                const prefs = await window.SIA.getUserPreferences(uid);
                if (prefs === null) return;
                if (prefs && prefs[`biblio_tour_${BIBLIO_TOUR_VERSION}`]) return;
            }

            if (!localStorage.getItem(key)) {
                setTimeout(() => launchTutorial(), 1200);
            }
        } catch (e) { return; }
    }

    function launchTutorial() {
        let tour = document.querySelector('sia-onboarding-tour');
        if (!tour) {
            tour = document.createElement('sia-onboarding-tour');
            document.body.appendChild(tour);
        }

        // Guardar estado original del tour (para no destruir el del dashboard)
        const originalSteps = tour._steps;
        const originalComplete = tour._complete;
        const originalSkip = tour._skip;

        // Inyectar pasos de biblioteca temporalmente
        tour._steps = [
            { target: null, title: 'Bienvenido a la Biblioteca', description: 'Aquí puedes buscar libros, pedirlos prestados al instante y gestionar tus préstamos activos. Te mostraremos cómo funciona.', position: 'center' },
            { target: '#biblio-btn-tutorial', title: 'Repetir Tutorial', description: 'Si necesitas volver a ver esta guía, toca este botón en cualquier momento.', position: 'bottom' },
            { target: '#tab-buscar-btn', title: 'Explorar', description: 'Busca libros por título, autor o categoría. También puedes explorar por categorías, guardar favoritos y abrir la biblioteca digital eLibro.', position: 'bottom' },
            { target: '#tab-prestamos-btn', title: 'Mi actividad', description: 'Aquí ves lo urgente: solicitudes por recoger, libros en mano, reservas activas y tu lista de espera.', position: 'bottom' },
            { target: '#tab-historial-btn', title: 'Historial', description: 'Consulta tus movimientos anteriores y revisa recomendaciones relacionadas con tus lecturas.', position: 'bottom' },
            { target: null, title: '¡Listo! Explora la Biblioteca', description: 'Ya puedes buscar y pedir libros prestados. Recuerda pasar a mostrador a recoger tu libro una vez que lo solicites. ¡Buena lectura!', position: 'center' }
        ];

        const markDone = async () => {
            try {
                const uid = _ctx?.auth?.currentUser?.uid;
                if (!uid) return;

                if (window.SIA?.updateUserPreferences) {
                    await window.SIA.updateUserPreferences(uid, {
                        [`biblio_tour_${BIBLIO_TOUR_VERSION}`]: true
                    });
                }
                localStorage.setItem(`sia_biblio_tour_done_${BIBLIO_TOUR_VERSION}_${uid}`, 'true');
            } catch (e) { /* ignore */ }
        };

        const restore = () => {
            // Restaurar estado original del tour
            tour._steps = originalSteps;
            tour._complete = originalComplete;
            tour._skip = originalSkip;
        };

        tour._complete = () => { markDone(); restore(); if (originalComplete) originalComplete.call(tour); };
        tour._skip = () => { markDone(); restore(); if (originalSkip) originalSkip.call(tour); };

        requestAnimationFrame(() => tour.start());
    }

    return {
        init,
        initStudent,
        // Student
        handleSearch: handleGlobalSearch, handleGlobalSearch, handleInlineSearch, openCategoryModal, _openCategoryInModal,
        verDetalleLibro, solicitarLibro, sendSuggestion, openSuggestionModal, toggleWishlist, toggleWaitlist, openBookDetailFromPayload,
        toggleSearch, showMissionsModal, scrollCarousel, verDetallePrestamo, solicitarExtension, cancelarSolicitud,
        refreshData, showAllItems, cancelarReserva,
        // Digital Services (Student)
        abrirModalServicio, renderAvailabilityGrid, selectSlot, confirmarReserva,
        solicitarServicio: abrirModalServicio, renderTopBooksCarousel,
        // Tutorial
        launchTutorial
    };
})();
window.Biblio = Biblio;
