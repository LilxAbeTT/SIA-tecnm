// public/modules/foro.js
// Módulo FORO v6.0 — Eventos Académicos (Conferencias, Exposiciones, Otros)
console.log("✅ [LOAD] modules/foro.js loaded");

if (!window.Foro) {
    window.Foro = (function () {

        // --- PRIVATE STATE ---
        let _ctx = null;
        let _profile = null;
        let _isAdmin = false;
        let _isDifusion = false;
        let _isDivisionHead = false;

        let _events = [];
        let _tickets = [];
        let _adminEvents = [];
        let _difusionQueue = [];
        let _difusionHistory = [];
        let _html5QrcodeScanner = null;
        let _studentScanner = null;

        // Student Enhanced State
        let _activeFilter = 'all';
        let _searchQuery = '';
        let _sortBy = 'upcoming';
        let _favorites = JSON.parse(localStorage.getItem('foro_favorites') || '[]');
        let _eventsListener = null;

        // --- HELPERS ---
        const show = (el) => el?.classList.remove('d-none');
        const hide = (el) => el?.classList.add('d-none');

        const TYPE_CONFIG = {
            'conferencia': { icon: 'bi-mic-fill', color: 'primary', label: 'Conferencia' },
            'exposicion': { icon: 'bi-easel-fill', color: 'info', label: 'Exposición' },
            'otro': { icon: 'bi-calendar-event', color: 'secondary', label: 'Evento' }
        };

        const STATUS_CONFIG = {
            'active': { icon: 'bi-check-circle-fill', color: 'success', label: 'Publicado' },
            'pending': { icon: 'bi-hourglass-split', color: 'warning', label: 'En Revisión' },
            'rejected': { icon: 'bi-x-circle-fill', color: 'danger', label: 'Rechazado' }
        };

        function formatDate(date) {
            if (!date) return '-';
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('es-MX', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }

        function formatShortDate(date) {
            if (!date) return { month: '', day: '' };
            const d = date.toDate ? date.toDate() : new Date(date);
            return {
                month: d.toLocaleString('es-MX', { month: 'short' }).toUpperCase(),
                day: d.getDate()
            };
        }

        function showToast(msg, type) {
            if (window.showToast) window.showToast(msg, type);
            else if (window.SIA?.showToast) window.SIA.showToast(msg, type);
            else alert(msg);
        }

        function getTypeCfg(type) {
            return TYPE_CONFIG[type] || TYPE_CONFIG['otro'];
        }

        function getStatusCfg(status) {
            return STATUS_CONFIG[status] || STATUS_CONFIG['pending'];
        }

        // ==========================================
        // INIT
        // ==========================================
        async function init(ctx) {
            console.log("[Foro] Init started", ctx);
            _ctx = ctx;
            _profile = ctx.profile;

            if (!_profile) {
                console.error("[Foro] No profile found");
                return;
            }

            const container = document.getElementById('view-foro');
            if (!container) {
                console.error("[Foro] Container #view-foro not found!");
                return;
            }

            // Roles Logic
            _isDifusion = _profile.email === 'difusion@loscabos.tecnm.mx' ||
                _profile.permissions?.foro === 'superadmin';
            _isAdmin = _profile.permissions?.foro === 'admin' || _isDifusion;
            _isDivisionHead = _isAdmin && !_isDifusion;

            // Para la nueva arquitectura modularizada, la lógica admin ya no está aquí.
            // Solamente se inicializa la vista de estudiante si llegó aquí.
            renderLayout(container);
            initStudentView();
        }

        function renderLayout(container) {
            renderStudentStructure(container);
        }

        // ==========================================
        // ESTUDIANTE — ESTRUCTURA
        // ==========================================
        function renderStudentStructure(container) {
            container.innerHTML = `
                <div id="foro-app" class="fade-up-entry">

                    <!-- HERO BANNER -->
                    <div class="hero-banner-v2 rounded-8 shadow-sm mb-4 position-relative overflow-hidden foro-hero" style="background: linear-gradient(135deg, #24e0b8ff 0%, #1a944dff 60%, #d63384 100%);">
                        <div class="hero-content-v2 text-white">
                            <span class="badge bg-white text-primary mb-2 fw-bold"><i class="bi bi-chat-heart-fill me-1"></i>Participa en eventos</span>
                            <h2 class="fw-bold text-white mb-2">Eventos del Campus</h2>
                            <p class="text-white small opacity-75 mb-0" style="max-width:420px;">Conferencias y eventos academicos.<br> Inscribete, obten tu pase y vive la experiencia.</p>
                        </div>
                        <i class="bi bi-calendar-event-fill position-absolute text-white opacity-10" style="font-size:5rem; bottom:-20px; right:-10px; z-index:1;"></i>
                    </div>

                    <!-- TABS -->
                    <div class="d-flex flex-column gap-3 mb-4">
                        <div class="bg-light p-1 rounded-pill d-inline-flex align-self-start shadow-sm flex-wrap">
                            <button class="btn btn-sm rounded-pill px-3 py-2 fw-bold foro-tab-btn active" id="btn-tab-cartelera" onclick="Foro.switchTab('cartelera')">
                                <i class="bi bi-grid-fill me-1 d-none d-sm-inline"></i>Cartelera
                            </button>
                            <button class="btn btn-sm rounded-pill px-3 py-2 fw-bold foro-tab-btn text-muted" id="btn-tab-tickets" onclick="Foro.switchTab('tickets')">
                                <i class="bi bi-ticket-perforated me-1 d-none d-sm-inline"></i>Mis Tickets
                            </button>
                            <button class="btn btn-sm rounded-pill px-3 py-2 fw-bold foro-tab-btn text-muted" id="btn-tab-history" onclick="Foro.switchTab('history')">
                                <i class="bi bi-award me-1 d-none d-sm-inline"></i>Historial
                            </button>
                        </div>

                        <!-- SEARCH BAR (Cartelera) -->
                        <div id="foro-search-bar" class="d-flex gap-2 flex-wrap">
                            <div class="flex-grow-1" style="min-width:200px;">
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control border-start-0 ps-0" id="foro-search-input"
                                           placeholder="Buscar evento, ponente, lugar..."
                                           oninput="Foro.handleSearch(this.value)">
                                </div>
                            </div>
                            <select class="form-select form-select-sm" style="max-width:180px;" id="foro-sort-select" onchange="Foro.handleSort(this.value)">
                                <option value="upcoming">Proximos primero</option>
                                <option value="popularity">Mas populares</option>
                                <option value="capacity">Ultimos lugares</option>
                            </select>
                        </div>

                        <!-- FILTERS (Cartelera) -->
                        <div id="foro-filters" class="d-flex gap-2 flex-wrap align-items-center">
                            <button class="btn btn-sm rounded-pill bg-white border shadow-sm fw-bold foro-filter-chip active" data-filter="all" onclick="Foro.setFilter('all')">Todos</button>
                            <button class="btn btn-sm rounded-pill bg-white border shadow-sm fw-bold foro-filter-chip" data-filter="conferencia" onclick="Foro.setFilter('conferencia')">
                                <i class="bi bi-mic-fill me-1 text-primary"></i>Conferencias
                            </button>
                            <button class="btn btn-sm rounded-pill bg-white border shadow-sm fw-bold foro-filter-chip" data-filter="exposicion" onclick="Foro.setFilter('exposicion')">
                                <i class="bi bi-easel-fill me-1 text-info"></i>Exposiciones
                            </button>
                            <button class="btn btn-sm rounded-pill bg-white border shadow-sm fw-bold foro-filter-chip" data-filter="otro" onclick="Foro.setFilter('otro')">
                                <i class="bi bi-calendar-event me-1 text-secondary"></i>Otros
                            </button>
                            <button class="btn btn-sm rounded-pill bg-white border shadow-sm fw-bold foro-filter-chip" data-filter="favorites" onclick="Foro.setFilter('favorites')">
                                <i class="bi bi-heart-fill me-1 text-danger"></i>Favoritos
                                ${_favorites.length ? '<span class="badge bg-danger rounded-pill ms-1">' + _favorites.length + '</span>' : ''}
                            </button>
                        </div>
                    </div>

                    <!-- TAB: CARTELERA -->
                    <div id="foro-content-cartelera">
                        <div id="foro-events-grid" class="row g-3 g-md-4">
                            ${renderSkeletonCards(6)}
                        </div>
                    </div>

                    <!-- TAB: MIS TICKETS -->
                    <div id="foro-content-tickets" class="d-none">
                        <div id="foro-tickets-list"></div>
                    </div>

                    <!-- TAB: MI HISTORIAL -->
                    <div id="foro-content-history" class="d-none">
                        <div id="foro-history-container"></div>
                    </div>

                </div>

                ${getStudentModals()}
            `;
        }

        function getStudentModals() {
            return `
            <!-- MODAL: EVENT DETAIL (STUDENT) -->
            <div class="modal fade" id="modalEventDetailStudent" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content overflow-hidden border-0 shadow rounded-4">
                        <div class="position-relative bg-light">
                            <img src="" id="sd-cover" class="w-100 object-fit-cover" style="height: 200px;" onerror="this.src='/images/foro.png'">
                            <span id="sd-type-badge" class="position-absolute top-0 start-0 m-3 badge bg-primary shadow-sm"></span>
                            <button class="btn-close position-absolute top-0 end-0 m-3 bg-white rounded-circle shadow-sm p-2" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4">
                            <h4 class="fw-bold mb-3" id="sd-title"></h4>
                            
                            <div class="d-flex flex-column gap-2 mb-4 text-muted small">
                                <div><i class="bi bi-person-fill me-2 text-primary"></i><span id="sd-speaker"></span></div>
                                <div><i class="bi bi-geo-alt-fill me-2 text-danger"></i><span id="sd-location"></span></div>
                                <div><i class="bi bi-calendar-event me-2 text-success"></i><span id="sd-date"></span></div>
                                <div><i class="bi bi-people-fill me-2 text-info"></i>Dirigido a: <span id="sd-audience"></span></div>
                            </div>
                            
                            <div class="p-3 bg-light rounded-3 mb-4" id="sd-capacity">
                                <!-- Capacity bar goes here -->
                            </div>
                            
                            <h6 class="fw-bold mb-2">Acerca del evento</h6>
                            <p class="text-secondary small line-clamp-4" id="sd-desc"></p>
                        </div>
                        <div class="modal-footer border-0 p-3 pt-0 gap-2">
                            <button class="btn btn-outline-primary rounded-pill px-3" id="sd-btn-share"><i class="bi bi-share-fill"></i></button>
                            <button class="btn btn-primary rounded-pill flex-grow-1 fw-bold" id="sd-btn-register">Inscribirme</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL: TICKET QR -->
            <div class="modal fade" id="modalTicketQR" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center p-4">
                            <h6 class="fw-bold text-dark mb-1" id="qr-event-title">Evento</h6>
                            <p class="small text-muted mb-4" id="qr-event-meta">Ubicacion - Fecha</p>
                            
                            <div class="bg-white p-3 rounded-4 shadow-sm border d-inline-block mx-auto mb-3">
                                <div id="qrcode-container" class="d-flex justify-content-center"></div>
                            </div>
                            
                            <p class="small text-muted mb-0">Presenta este QR en la entrada del evento para registrar tu asistencia.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL: FEEDBACK -->
            <div class="modal fade" id="modalForoFeedback" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow rounded-4">
                        <div class="modal-header border-0 bg-light">
                            <h5 class="fw-bold mb-0"><i class="bi bi-star-fill text-warning me-2"></i>Calificar Evento</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4 text-center">
                            <h6 class="fw-bold mb-1" id="feedback-event-title">Evento</h6>
                            <p class="small text-muted mb-4">¿Que te pareció este evento?</p>
                            
                            <input type="hidden" id="feedback-ticket-id">
                            <input type="hidden" id="feedback-event-id">
                            <input type="hidden" id="feedback-rating" value="0">
                            
                            <div class="d-flex justify-content-center gap-2 mb-4" id="feedback-stars">
                                <i class="bi bi-star fs-1 text-warning" style="cursor:pointer;" onclick="Foro.setFeedbackRating(1)"></i>
                                <i class="bi bi-star fs-1 text-warning" style="cursor:pointer;" onclick="Foro.setFeedbackRating(2)"></i>
                                <i class="bi bi-star fs-1 text-warning" style="cursor:pointer;" onclick="Foro.setFeedbackRating(3)"></i>
                                <i class="bi bi-star fs-1 text-warning" style="cursor:pointer;" onclick="Foro.setFeedbackRating(4)"></i>
                                <i class="bi bi-star fs-1 text-warning" style="cursor:pointer;" onclick="Foro.setFeedbackRating(5)"></i>
                            </div>
                            
                            <textarea id="feedback-comments" class="form-control rounded-4 bg-light border-0" rows="3" placeholder="(Opcional) Dinos que te gusto o que podria mejorar..."></textarea>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary rounded-pill px-4" id="btn-submit-feedback" onclick="Foro.submitFeedback()">Enviar Reseña</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- MODAL: STUDENT SCANNER -->
            <div class="modal fade" id="modalStudentScanner" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow rounded-4 overflow-hidden">
                        <div class="modal-header bg-dark text-white border-0">
                            <h5 class="fw-bold mb-0"><i class="bi bi-camera me-2"></i>Escanear QR del Evento</h5>
                            <button type="button" class="btn-close btn-close-white" onclick="Foro.stopStudentScanner()"></button>
                        </div>
                        <div class="modal-body p-0 bg-dark position-relative">
                            <div id="student-reader" style="width: 100%; min-height: 300px;"></div>
                            <div class="position-absolute top-50 start-50 translate-middle text-center w-100 p-4" style="pointer-events:none;">
                                <div class="border border-2 border-white opacity-50 mx-auto rounded-4 mb-3" style="width: 200px; height: 200px; box-shadow: 0 0 0 4000px rgba(0,0,0,0.6);"></div>
                                <p class="text-white fw-bold mb-0">Enfoca el código QR proyectado</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }

        function renderSkeletonCards(count) {
            return Array.from({ length: count }, () => `
                <div class="col-6 col-lg-4">
                    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div class="skeleton-loader skeleton-rect" style="height:160px;"></div>
                        <div class="card-body p-3">
                            <div class="skeleton-loader skeleton-text mb-2" style="width:80%;"></div>
                            <div class="skeleton-loader skeleton-text mb-2" style="width:60%;"></div>
                            <div class="skeleton-loader skeleton-text" style="width:40%;"></div>
                            <div class="skeleton-loader mt-3" style="height:36px; border-radius:50rem;"></div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function setFilter(type) {
            _activeFilter = type;
            document.querySelectorAll('#view-foro .foro-filter-chip').forEach(chip => {
                chip.classList.toggle('active', chip.dataset.filter === type);
            });
            renderEvents();
        }

        function handleSearch(query) {
            _searchQuery = query.toLowerCase().trim();
            renderEvents();
        }

        function handleSort(sortBy) {
            _sortBy = sortBy;
            renderEvents();
        }

        function clearSearch() {
            _searchQuery = '';
            const input = document.getElementById('foro-search-input');
            if (input) input.value = '';
            renderEvents();
        }

        function filterAndSortEvents(events) {
            let filtered = [...events];

            // Type filter
            if (_activeFilter === 'favorites') {
                filtered = filtered.filter(e => _favorites.includes(e.id));
            } else if (_activeFilter !== 'all') {
                filtered = filtered.filter(e => e.type === _activeFilter);
            }

            // Search
            if (_searchQuery) {
                filtered = filtered.filter(e =>
                    (e.title || '').toLowerCase().includes(_searchQuery) ||
                    (e.speaker || '').toLowerCase().includes(_searchQuery) ||
                    (e.location || '').toLowerCase().includes(_searchQuery)
                );
            }

            // Sort
            switch (_sortBy) {
                case 'upcoming':
                    filtered.sort((a, b) => {
                        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
                        const db = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
                        return da - db;
                    });
                    break;
                case 'popularity':
                    filtered.sort((a, b) => (b.registeredCount || 0) - (a.registeredCount || 0));
                    break;
                case 'capacity':
                    filtered.sort((a, b) => {
                        const pa = a.capacity ? (a.registeredCount || 0) / a.capacity : 0;
                        const pb = b.capacity ? (b.registeredCount || 0) / b.capacity : 0;
                        return pb - pa;
                    });
                    break;
            }
            return filtered;
        }

        // ==========================================
        // ESTUDIANTE — LOGICA
        // ==========================================
        async function initStudentView() {
            try {
                setupRealtimeEvents();
                setTimeout(() => {
                    if (window.initPullToRefresh) window.initPullToRefresh();
                    if (window.initSwipeGestures) window.initSwipeGestures();
                }, 500);
            } catch (e) {
                console.error("[Foro] Error loading student data:", e);
            }
        }

        function setupRealtimeEvents() {
            if (_eventsListener) _eventsListener();

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            _eventsListener = _ctx.db.collection('foro_events')
                .where('status', '==', 'active')
                .where('date', '>=', yesterday)
                .orderBy('date', 'asc')
                .onSnapshot(snapshot => {
                    const userCareer = _profile?.career || 'GENERIC';
                    _events = snapshot.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(evt => {
                            if (!evt.targetAudience || evt.targetAudience.includes('ALL')) return true;
                            return evt.targetAudience.includes(userCareer);
                        });
                    renderEvents();
                }, error => {
                    console.error('[Foro] Realtime error, falling back:', error);
                    ForoService.getActiveEvents(_ctx).then(evts => {
                        _events = evts;
                        renderEvents();
                    });
                });
        }

        function cleanupRealtimeListeners() {
            if (_eventsListener) { _eventsListener(); _eventsListener = null; }
        }

        function switchTab(tabName) {
            const tabs = ['cartelera', 'tickets', 'history'];
            tabs.forEach(t => {
                const content = document.getElementById(`foro-content-${t}`);
                const btn = document.getElementById(`btn-tab-${t}`);
                if (!content || !btn) return;
                if (t === tabName) {
                    show(content);
                    btn.classList.add('active');
                    btn.classList.remove('text-muted');
                } else {
                    hide(content);
                    btn.classList.remove('active');
                    btn.classList.add('text-muted');
                }
            });

            const filters = document.getElementById('foro-filters');
            const searchBar = document.getElementById('foro-search-bar');
            if (filters) { tabName === 'cartelera' ? show(filters) : hide(filters); }
            if (searchBar) { tabName === 'cartelera' ? show(searchBar) : hide(searchBar); }

            if (tabName === 'tickets') loadTickets();
            else if (tabName === 'history') loadHistory();
        }

        // --- EVENT STATUS / COUNTDOWN ---
        function getEventStatus(eventDate) {
            const now = new Date();
            const d = eventDate?.toDate ? eventDate.toDate() : new Date(eventDate);
            if (!d || isNaN(d)) return { label: '-', variant: 'secondary', icon: 'bi-calendar' };

            const diff = d - now;
            const mins = Math.floor(diff / 60000);
            const days = Math.floor(diff / 86400000);

            if (diff < -7200000) return { label: 'Finalizado', variant: 'secondary', icon: 'bi-check-circle-fill' };
            if (diff < 0) return { label: 'En curso', variant: 'success', icon: 'bi-broadcast', pulse: true };
            if (mins < 60) return { label: `En ${mins} min`, variant: 'warning', icon: 'bi-clock-fill', pulse: true };
            if (d.toDateString() === now.toDateString()) {
                return { label: `Hoy ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`, variant: 'warning', icon: 'bi-alarm-fill' };
            }
            const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
            if (d.toDateString() === tomorrow.toDateString()) {
                return { label: `Mañana ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`, variant: 'info', icon: 'bi-calendar-check' };
            }
            if (days <= 7) return { label: `En ${days} dia${days > 1 ? 's' : ''}`, variant: 'info', icon: 'bi-calendar' };
            return { label: formatDate(d), variant: 'secondary', icon: 'bi-calendar' };
        }

        // --- RENDER EVENTS ---
        function renderEvents() {
            const container = document.getElementById('foro-events-grid');
            if (!container) return;

            const shown = filterAndSortEvents(_events);

            if (!shown.length) {
                const isSearch = _searchQuery || _activeFilter !== 'all';
                container.innerHTML = `
                    <div class="col-12 text-center py-5 fade-up-entry">
                        <div class="rounded-4 p-5" style="background: var(--surface); border: 1px dashed var(--border-color);">
                            <i class="bi ${isSearch ? 'bi-search' : 'bi-calendar-x'} fs-1 d-block mb-3 text-muted opacity-50"></i>
                            <h6 class="fw-bold mb-1">${isSearch ? 'Sin resultados' : 'Sin eventos disponibles'}</h6>
                            <p class="text-muted small mb-0">${isSearch ? 'Intenta con otros términos o filtros.' : 'Vuelve pronto para nuevos eventos.'}</p>
                            ${isSearch ? '<button class="btn btn-sm btn-outline-primary rounded-pill mt-3" onclick="Foro.clearSearch(); Foro.setFilter(\'all\');">Limpiar filtros</button>' : ''}
                        </div>
                    </div>`;
                return;
            }

            container.innerHTML = shown.map(evt => {
                const isFull = evt.registeredCount >= evt.capacity;
                const cfg = getTypeCfg(evt.type);
                const dt = formatShortDate(evt.date);
                const coverImg = evt.coverImage || '/images/foro.png';
                const capacityPct = evt.capacity ? Math.min(100, Math.round((evt.registeredCount || 0) / evt.capacity * 100)) : 0;
                const isAlmostFull = capacityPct >= 80 && !isFull;
                const fav = _favorites.includes(evt.id);

                return `
                <div class="col-6 col-lg-4">
                    <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden foro-event-card"
                         onclick="Foro.openEventDetailModal('${evt.id}')" style="cursor:pointer;">
                        <div class="position-relative foro-card-cover">
                            <img src="${coverImg}" class="w-100 h-100 object-fit-cover" onerror="this.src='/images/foro.png'" alt="${evt.title}">
                            <div class="card-img-overlay-gradient position-absolute top-0 start-0 w-100 h-100"></div>

                            <!-- Fav button -->
                            <button class="position-absolute btn btn-sm rounded-circle shadow-sm ${fav ? 'btn-danger' : 'btn-light'} foro-fav-btn"
                                    onclick="event.stopPropagation(); Foro.toggleFavorite('${evt.id}')" style="top:8px; right:8px; width:32px; height:32px; padding:0; z-index:5;">
                                <i class="bi ${fav ? 'bi-heart-fill' : 'bi-heart'}" style="font-size:0.85rem;"></i>
                            </button>

                            <!-- Type Badge -->
                            <div class="position-absolute top-0 start-0 m-2">
                                <span class="badge bg-${cfg.color} rounded-pill shadow-sm" style="font-size:0.65rem;"><i class="bi ${cfg.icon} me-1"></i>${cfg.label}</span>
                            </div>

                            <!-- Almost full badge -->
                            ${isAlmostFull ? '<span class="badge bg-warning text-dark rounded-pill shadow-sm position-absolute foro-last-spots" style="bottom:8px; right:8px; font-size:0.6rem;"><i class="bi bi-exclamation-triangle-fill me-1"></i>Últimos lugares</span>' : ''}
                            ${isFull ? '<span class="badge bg-danger rounded-pill shadow-sm position-absolute foro-sold-out" style="bottom:8px; right:8px;"><i class="bi bi-x-circle-fill me-1"></i>Lleno</span>' : ''}

                            <!-- Title overlay -->
                            <div class="position-absolute bottom-0 start-0 w-100 p-2 text-white">
                                <h6 class="fw-bold mb-0 small line-clamp-2" style="text-shadow:0 1px 4px rgba(0,0,0,0.6);">${evt.title}</h6>
                            </div>
                        </div>

                        <div class="card-body p-2 d-flex flex-column">
                            <div class="d-flex flex-column gap-1 mb-2" style="font-size:0.75rem;">
                                <div class="text-truncate text-muted"><i class="bi bi-person-fill me-1 text-primary"></i>${evt.speaker || 'Por confirmar'}</div>
                                <div class="text-truncate text-muted"><i class="bi bi-geo-alt-fill me-1 text-danger"></i>${evt.location || 'Por confirmar'}</div>
                                <div class="text-truncate text-muted"><i class="bi bi-calendar-event me-1 text-success"></i>${formatDate(evt.date)}</div>
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span style="font-size:0.65rem;" class="fw-bold ${isFull ? 'text-danger' : 'text-muted'}">${isFull ? 'Cupo Lleno' : (evt.registeredCount || 0) + ' / ' + evt.capacity}</span>
                                    <span style="font-size:0.65rem;" class="text-muted">${capacityPct}%</span>
                                </div>
                                <div class="progress rounded-pill" style="height:4px;">
                                    <div class="progress-bar ${isFull ? 'bg-danger' : capacityPct > 75 ? 'bg-warning' : 'bg-success'} rounded-pill" style="width:${capacityPct}%;"></div>
                                </div>
                            </div>

                            <div class="d-flex gap-1 mt-auto">
                                <button class="btn ${isFull ? 'btn-outline-secondary' : 'btn-primary'} flex-grow-1 rounded-pill fw-bold py-1"
                                    onclick="event.stopPropagation(); Foro.handleRegister('${evt.id}')" ${isFull ? 'disabled' : ''} style="font-size:0.75rem;">
                                    <i class="bi ${isFull ? 'bi-x-circle' : 'bi-ticket-perforated'} me-1"></i>${isFull ? 'Lleno' : 'Inscribirme'}
                                </button>
                                <button class="btn btn-outline-primary rounded-pill py-1 px-2"
                                    onclick="event.stopPropagation(); Foro.shareEvent('${evt.id}')" style="font-size:0.75rem;" title="Compartir">
                                    <i class="bi bi-share-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        // --- TICKETS ---
        async function loadTickets() {
            const list = document.getElementById('foro-tickets-list');
            if (!list) return;
            list.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
            try {
                _tickets = await ForoService.getUserTickets(_ctx, _ctx.user?.uid || _profile?.uid);
                renderTickets();
            } catch (e) {
                console.error(e);
                list.innerHTML = '<div class="text-danger text-center py-5">Error al cargar tickets.</div>';
            }
        }

        function renderTickets() {
            const list = document.getElementById('foro-tickets-list');
            if (!list) return;

            if (!_tickets.length) {
                list.innerHTML = `
                    <div class="text-center py-5 fade-up-entry">
                        <div class="rounded-4 p-5" style="background:var(--surface); border:1px dashed var(--border-color);">
                            <i class="bi bi-ticket-perforated fs-1 d-block mb-3 text-muted opacity-50"></i>
                            <h6 class="fw-bold mb-1">Sin tickets todavia</h6>
                            <p class="text-muted small mb-3">Inscríbete a un evento desde la Cartelera para obtener tu pase.</p>
                            <button class="btn btn-sm btn-primary rounded-pill px-4" onclick="Foro.switchTab('cartelera')">
                                <i class="bi bi-grid-fill me-1"></i>Ir a Cartelera
                            </button>
                        </div>
                    </div>`;
                return;
            }

            const now = new Date();
            const upcoming = _tickets.filter(t => {
                const d = t.eventDate?.toDate ? t.eventDate.toDate() : new Date(t.eventDate);
                return t.status !== 'attended' && d && d > now;
            });
            const past = _tickets.filter(t => !upcoming.includes(t));

            let html = '';

            if (upcoming.length) {
                html += `<h6 class="fw-bold text-muted text-uppercase small mb-3"><i class="bi bi-calendar-event me-2"></i>Próximos (${upcoming.length})</h6>`;
                html += `<div class="foro-ticket-wallet mb-4">${upcoming.map(t => renderTicketCard(t, true)).join('')}</div>`;
            }

            if (past.length) {
                html += `<h6 class="fw-bold text-muted text-uppercase small mb-3 mt-3"><i class="bi bi-clock-history me-2"></i>Anteriores (${past.length})</h6>`;
                html += `<div class="row g-3">${past.map(t => '<div class="col-12 col-md-6">' + renderTicketCard(t, false) + '</div>').join('')}</div>`;
            }

            list.innerHTML = html;
        }

        function renderTicketCard(t, isUpcoming) {
            const isAttended = t.status === 'attended';
            const cfg = getTypeCfg(t.eventType);
            const dt = formatShortDate(t.eventDate);
            const status = getEventStatus(t.eventDate);
            const canFeedback = isAttended && !t.feedbackSubmitted && ForoService.canSubmitFeedback(t);

            return `
            <div class="foro-ticket-wallet-card">
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100 foro-ticket-card">
                    <!-- Status strip -->
                    <div class="px-3 py-2 d-flex align-items-center justify-content-between ${isAttended ? 'bg-success' : 'bg-primary'} bg-opacity-10">
                        <span class="badge ${isAttended ? 'bg-success' : 'bg-' + status.variant} rounded-pill shadow-sm ${status.pulse ? 'foro-pulse' : ''}">
                            <i class="bi ${isAttended ? 'bi-check-circle-fill' : status.icon} me-1"></i>
                            ${isAttended ? 'Asistencia Registrada' : status.label}
                        </span>
                        ${isAttended ? '<i class="bi bi-award-fill text-warning fs-5"></i>' : ''}
                    </div>

                    <div class="card-body p-3">
                        <div class="d-flex gap-3">
                            <div class="text-center flex-shrink-0" style="min-width:48px;">
                                <div class="rounded-3 p-2 border" style="background:var(--surface);">
                                    <div style="font-size:0.6rem;" class="fw-bold text-danger text-uppercase lh-1">${dt.month}</div>
                                    <div class="fs-5 fw-bold lh-1">${dt.day}</div>
                                </div>
                            </div>
                            <div class="flex-grow-1 overflow-hidden">
                                <span class="badge bg-${cfg.color}-subtle text-${cfg.color} rounded-pill mb-1" style="font-size:0.6rem;"><i class="bi ${cfg.icon} me-1"></i>${cfg.label}</span>
                                <h6 class="fw-bold mb-1 text-truncate" style="font-size:0.9rem;">${t.eventTitle}</h6>
                                <p class="small text-muted mb-0 text-truncate"><i class="bi bi-geo-alt me-1"></i>${t.eventLocation || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Attendance buttons -->
                    ${!isAttended ? `
                    <div class="px-3 pb-2">
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary btn-sm flex-grow-1 rounded-pill fw-bold" onclick="event.stopPropagation(); Foro.showTicketQR('${t.id}')">
                                <i class="bi bi-qr-code me-1"></i>Mi QR
                            </button>
                            <button class="btn btn-outline-primary btn-sm flex-grow-1 rounded-pill fw-bold" onclick="event.stopPropagation(); Foro.openStudentScanner('${t.eventId}')">
                                <i class="bi bi-camera me-1"></i>Escanear
                            </button>
                        </div>
                    </div>` : ''}

                    <!-- Other actions -->
                    <div class="px-3 pb-3 d-flex gap-2">
                        ${canFeedback ? `<button class="btn btn-warning btn-sm flex-grow-1 rounded-pill fw-bold text-dark" onclick="event.stopPropagation(); Foro.openFeedbackModal('${t.id}', '${t.eventId}', '${t.eventTitle.replace(/'/g, "\\'")}')">
                            <i class="bi bi-star-fill me-1"></i>Calificar
                        </button>` : ''}
                        ${isUpcoming && !isAttended ? `<button class="btn btn-outline-danger btn-sm rounded-pill" onclick="event.stopPropagation(); Foro.cancelTicket('${t.id}', '${t.eventId}', '${t.eventTitle.replace(/'/g, "\\'")}')">
                            <i class="bi bi-x-circle me-1"></i>Cancelar
                        </button>` : ''}
                    </div>
                </div>
            </div>`;
        }

        // --- QR MODAL ---
        function showTicketQR(ticketId) {
            const t = _tickets.find(tk => tk.id === ticketId);
            if (!t) return;

            document.getElementById('qr-event-title').innerText = t.eventTitle;
            document.getElementById('qr-event-meta').innerText = `${t.eventLocation || ''} — ${formatDate(t.eventDate)}`;
            const container = document.getElementById('qrcode-container');
            container.innerHTML = '';

            new bootstrap.Modal(document.getElementById('modalTicketQR')).show();

            setTimeout(() => {
                new QRCode(container, {
                    text: t.qrCodeData,
                    width: 250, height: 250,
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }, 300);
        }

        // --- EVENT DETAIL MODAL (STUDENT) ---
        function openEventDetailModal(eventId) {
            const evt = _events.find(e => e.id === eventId);
            if (!evt) return;

            const isFull = evt.registeredCount >= evt.capacity;
            const capacityPct = evt.capacity ? Math.min(100, Math.round((evt.registeredCount || 0) / evt.capacity * 100)) : 0;
            const cfg = getTypeCfg(evt.type);

            document.getElementById('sd-title').innerText = evt.title;
            document.getElementById('sd-speaker').innerText = evt.speaker || 'Por confirmar';
            document.getElementById('sd-location').innerText = evt.location || 'Por confirmar';
            document.getElementById('sd-date').innerText = formatDate(evt.date);
            document.getElementById('sd-desc').innerText = evt.description || 'Sin descripcion disponible.';
            document.getElementById('sd-audience').innerText = (evt.targetAudience || ['Todas las carreras']).join(', ');

            // Type badge
            const typeBadge = document.getElementById('sd-type-badge');
            typeBadge.className = `badge bg-${cfg.color} rounded-pill`;
            typeBadge.innerHTML = `<i class="bi ${cfg.icon} me-1"></i>${cfg.label}`;

            // Capacity
            document.getElementById('sd-capacity').innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="small fw-bold ${isFull ? 'text-danger' : ''}">${isFull ? 'CUPO LLENO' : (evt.registeredCount || 0) + ' / ' + evt.capacity + ' inscritos'}</span>
                    <span class="small text-muted">${capacityPct}%</span>
                </div>
                <div class="progress rounded-pill" style="height:6px;">
                    <div class="progress-bar ${isFull ? 'bg-danger' : capacityPct > 80 ? 'bg-warning' : 'bg-success'}" style="width:${capacityPct}%;"></div>
                </div>`;

            // Cover
            const cover = document.getElementById('sd-cover');
            if (evt.coverImage) { cover.src = evt.coverImage; cover.classList.remove('d-none'); }
            else { cover.classList.add('d-none'); }

            // Register button
            const btn = document.getElementById('sd-btn-register');
            btn.disabled = isFull;
            btn.className = `btn w-100 rounded-pill fw-bold ${isFull ? 'btn-outline-secondary' : 'btn-primary'}`;
            btn.innerHTML = `<i class="bi ${isFull ? 'bi-x-circle' : 'bi-ticket-perforated'} me-2"></i>${isFull ? 'Evento Lleno' : 'Inscribirme Ahora'}`;
            btn.onclick = isFull ? null : () => {
                bootstrap.Modal.getInstance(document.getElementById('modalEventDetailStudent')).hide();
                handleRegister(eventId);
            };

            // Share button
            document.getElementById('sd-btn-share').onclick = () => shareEvent(eventId);

            new bootstrap.Modal(document.getElementById('modalEventDetailStudent')).show();
        }

        // --- STUDENT SCANNER ---
        function openStudentScanner(eventId) {
            if (!window.Html5QrcodeScanner) {
                showToast("El lector QR se está cargando, intenta de nuevo.", "warning");
                return;
            }
            const modalEl = document.getElementById('modalStudentScanner');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            modalEl.addEventListener('shown.bs.modal', function onShow() {
                modalEl.removeEventListener('shown.bs.modal', onShow);
                startStudentScanner(eventId);
            });
            modalEl.addEventListener('hidden.bs.modal', function onHide() {
                modalEl.removeEventListener('hidden.bs.modal', onHide);
                stopStudentScanner();
            });
        }

        function startStudentScanner(eventId) {
            _studentScanner = new Html5QrcodeScanner("student-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
            _studentScanner.render(async (decodedText, decodedResult) => {
                _studentScanner.clear();
                showToast("Procesando...", "info");
                try {
                    await ForoService.markAttendanceByEventQR(_ctx, eventId, _ctx.user.uid, decodedText);
                    showToast("¡Asistencia registrada exitosamente!", "success");
                    bootstrap.Modal.getInstance(document.getElementById('modalStudentScanner')).hide();
                    loadTickets();
                } catch (error) {
                    showToast(error.message, "danger");
                    bootstrap.Modal.getInstance(document.getElementById('modalStudentScanner')).hide();
                }
            }, (error) => { });
        }

        function stopStudentScanner() {
            if (_studentScanner) {
                _studentScanner.clear().catch(e => console.error("Error stopping scanner", e));
                _studentScanner = null;
            }
        }

        // --- REGISTER ---
        function handleRegister(eventId) {
            confirmAction('¿Confirmar inscripción al evento?', async () => {
                try {
                    const event = _events.find(e => e.id === eventId);
                    if (!event) throw new Error("Evento no encontrado.");
                    await ForoService.registerUser(_ctx, event, _profile);
                    showToast("¡Inscripción exitosa! Revisa 'Mis Tickets'.", 'success');
                    switchTab('tickets');
                } catch (e) {
                    showToast("Error: " + e.message, 'danger');
                }
            });
        }

        // --- CANCEL TICKET ---
        function cancelTicket(ticketId, eventId, eventTitle) {
            confirmAction('¿Cancelar inscripción a "' + eventTitle + '"?', async () => {
                try {
                    await ForoService.cancelRegistration(_ctx, ticketId, eventId);
                    showToast('Inscripción cancelada', 'success');
                    loadTickets();
                } catch (e) {
                    showToast('Error: ' + e.message, 'danger');
                }
            });
        }

        // --- FAVORITES ---
        function toggleFavorite(eventId) {
            const idx = _favorites.indexOf(eventId);
            if (idx > -1) { _favorites.splice(idx, 1); showToast('Eliminado de favoritos', 'info'); }
            else { _favorites.push(eventId); showToast('Agregado a favoritos', 'success'); }
            localStorage.setItem('foro_favorites', JSON.stringify(_favorites));
            renderEvents();
        }

        // --- SHARE ---
        async function shareEvent(eventId) {
            const evt = _events.find(e => e.id === eventId);
            if (!evt) return;
            const text = `${evt.title}\n${evt.speaker || ''}\n${evt.location || ''} - ${formatDate(evt.date)}\n${evt.description || ''}`;
            const url = window.location.origin + '/#foro';

            if (navigator.share) {
                try { await navigator.share({ title: evt.title, text, url }); }
                catch (e) { if (e.name !== 'AbortError') copyToClipboard(text + '\n' + url); }
            } else {
                copyToClipboard(text + '\n' + url);
            }
        }

        function copyToClipboard(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => showToast('Copiado al portapapeles', 'success'));
            }
        }

        // --- HISTORY ---
        async function loadHistory() {
            const container = document.getElementById('foro-history-container');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
            try {
                const history = await ForoService.getUserEventHistory(_ctx, _ctx.user?.uid || _profile?.uid);
                renderHistory(history);
            } catch (e) {
                console.error(e);
                container.innerHTML = '<div class="text-danger text-center py-5">Error al cargar historial.</div>';
            }
        }

        function renderHistory(history) {
            const container = document.getElementById('foro-history-container');
            if (!container) return;

            if (!history.length) {
                container.innerHTML = `
                    <div class="text-center py-5 fade-up-entry">
                        <div class="rounded-4 p-5" style="background:var(--surface); border:1px dashed var(--border-color);">
                            <i class="bi bi-award fs-1 d-block mb-3 text-muted opacity-50"></i>
                            <h6 class="fw-bold mb-1">Sin eventos asistidos</h6>
                            <p class="text-muted small mb-3">Participa en eventos para comenzar tu historial.</p>
                            <button class="btn btn-sm btn-primary rounded-pill px-4" onclick="Foro.switchTab('cartelera')"><i class="bi bi-grid-fill me-1"></i>Ver Eventos</button>
                        </div>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <!-- Stats -->
                <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <div class="card-body p-4 text-white">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:60px; height:60px;">
                                <i class="bi bi-award-fill fs-2"></i>
                            </div>
                            <div class="flex-grow-1">
                                <h3 class="fw-bold mb-0">${history.length} Evento${history.length > 1 ? 's' : ''}</h3>
                                <p class="mb-0 opacity-90 small">asistidos en total</p>
                            </div>
                            <button class="btn btn-light btn-sm rounded-pill fw-bold" onclick="Foro.downloadCertificate()">
                                <i class="bi bi-file-earmark-pdf me-1"></i>Constancia
                            </button>
                        </div>
                    </div>
                </div>

                <div class="row g-3">
                    ${history.map(evt => {
                const cfg = getTypeCfg(evt.eventType);
                const dt = formatShortDate(evt.eventDate);
                return `
                        <div class="col-12 col-md-6">
                            <div class="card border-0 shadow-sm rounded-4 h-100">
                                <div class="card-body p-3">
                                    <div class="d-flex gap-3">
                                        <div class="text-center flex-shrink-0" style="min-width:48px;">
                                            <div class="rounded-3 p-2 border" style="background:var(--surface);">
                                                <div style="font-size:0.6rem;" class="fw-bold text-danger text-uppercase lh-1">${dt.month}</div>
                                                <div class="fs-5 fw-bold lh-1">${dt.day}</div>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 overflow-hidden">
                                            <span class="badge bg-${cfg.color}-subtle text-${cfg.color} rounded-pill mb-1" style="font-size:0.6rem;"><i class="bi ${cfg.icon} me-1"></i>${cfg.label}</span>
                                            <h6 class="fw-bold mb-1 text-truncate" style="font-size:0.9rem;">${evt.eventTitle}</h6>
                                            <p class="small text-muted mb-0"><i class="bi bi-calendar-check me-1"></i>${formatDate(evt.eventDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
            }).join('')}
                </div>`;
        }

        // --- FEEDBACK & CONSTANCIAS ---
        function openFeedbackModal(ticketId, eventId, eventTitle) {
            document.getElementById('feedback-ticket-id').value = ticketId;
            document.getElementById('feedback-event-id').value = eventId;
            document.getElementById('feedback-event-title').innerText = eventTitle;
            document.getElementById('feedback-comments').value = '';
            setFeedbackRating(0);
            new bootstrap.Modal(document.getElementById('modalForoFeedback')).show();
        }

        function setFeedbackRating(stars) {
            document.getElementById('feedback-rating').value = stars;
            const starIcons = document.querySelectorAll('#feedback-stars i');
            starIcons.forEach((el, idx) => {
                if (idx < stars) {
                    el.classList.remove('bi-star');
                    el.classList.add('bi-star-fill');
                } else {
                    el.classList.remove('bi-star-fill');
                    el.classList.add('bi-star');
                }
            });
        }

        async function submitFeedback() {
            const ticketId = document.getElementById('feedback-ticket-id').value;
            const eventId = document.getElementById('feedback-event-id').value;
            const rating = parseInt(document.getElementById('feedback-rating').value);
            const comments = document.getElementById('feedback-comments').value.trim();

            if (rating === 0) {
                showToast("Por favor selecciona una calificación de estrellas.", "warning");
                return;
            }

            const btn = document.getElementById('btn-submit-feedback');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
            btn.disabled = true;

            try {
                await ForoService.submitEventFeedback(_ctx, ticketId, eventId, { rating, comments });
                showToast("Gracias por tu retroalimentación.", "success");
                bootstrap.Modal.getInstance(document.getElementById('modalForoFeedback')).hide();
                loadTickets();
            } catch (error) {
                showToast("Error al enviar: " + error.message, "danger");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        function downloadCertificate() {
            showToast("La descarga de constancias de historial estará disponible próximamente.", "info");
        }

        function getDashboardWidget() {
            // Un componente widget simple expuesto para el router/app.js si se necesita en el futuro
            return `
            <div class="card border-0 shadow-sm rounded-4 h-100">
                <div class="card-body">
                    <h6 class="fw-bold mb-3"><i class="bi bi-calendar-event text-primary me-2"></i>Próximos Eventos</h6>
                    <div class="d-flex flex-column gap-2" id="foro-widget-container">
                        <div class="text-center small text-muted">Cargando eventos...</div>
                    </div>
                </div>
            </div>`;
        }

        // Helpers adicionales de confirmación global si no existen en app.js
        function confirmAction(msg, action) {
            if (confirm(msg)) action();
        }

        return {
            init,
            // Student Exposes
            switchTab, setFilter, handleSearch, handleSort, clearSearch,
            handleRegister, showTicketQR, openEventDetailModal, toggleFavorite,
            shareEvent, cancelTicket, downloadCertificate, openFeedbackModal,
            setFeedbackRating, submitFeedback, getDashboardWidget,
            openStudentScanner, stopStudentScanner,
            cleanup: cleanupRealtimeListeners
        };
    })();
}
