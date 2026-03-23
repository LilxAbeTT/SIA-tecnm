// public/modules/foro/foro.student.js
// Student controller for Eventos

if (!window.ForoModule) window.ForoModule = {};

if (!window.ForoModule.Student) {
    window.ForoModule.Student = (function () {
        function create() {
            const shared = window.ForoModule?.Shared;
            if (!shared) throw new Error('[Eventos] Shared helpers not loaded.');

            const state = {
                ctx: null,
                profile: null,
                roles: null,
                events: [],
                tickets: [],
                history: [],
                favorites: [],
                activeFilter: 'all',
                searchQuery: '',
                sortBy: 'upcoming',
                activeTab: 'cartelera',
                eventsUnsub: null,
                studentScanner: null,
                resourcesBundle: null,
                chatConversation: null,
                chatMsgsUnsub: null
            };
            const TAB_LABELS = Object.freeze({
                cartelera: 'Cartelera',
                tickets: 'Mi Agenda',
                history: 'Historial'
            });

            return {
                init,
                saveState,
                restoreState,
                switchTab,
                setFilter,
                handleSearch,
                handleSort,
                clearSearch,
                handleRegister,
                showTicketQR,
                openEventDetailModal,
                toggleFavorite,
                shareEvent,
                cancelTicket,
                downloadCertificate,
                openFeedbackModal,
                setFeedbackRating,
                submitFeedback,
                downloadCalendar,
                openStudentScanner,
                stopStudentScanner,
                openResourcesModal,
                openConversationModal,
                sendConversationMessage,
                enableReminders,
                getDashboardWidget,
                cleanup
            };

            async function init(ctx) {
                cleanup();
                state.ctx = ctx;
                state.profile = ctx?.profile || null;
                state.roles = shared.determineRoles(state.profile);

                const container = document.getElementById('view-foro');
                if (!container || !state.profile) return;

                container.innerHTML = renderLayout();
                const saved = window.ModuleStateManager?.getState('view-foro');
                if (saved) restoreState(saved);
                if (ctx?.ModuleManager?.addSubscription) ctx.ModuleManager.addSubscription(cleanup);

                state.favorites = await shared.loadFavoriteIds(ctx, state.profile);
                refreshFavoriteChip();
                startEventsStream();
                await loadTickets();
                if (state.activeTab === 'history') await loadHistory();
                switchTab(state.activeTab);
                await syncReminderButton();
            }

            function saveState() {
                return {
                    activeTab: state.activeTab,
                    activeFilter: state.activeFilter,
                    searchQuery: state.searchQuery,
                    sortBy: state.sortBy
                };
            }

            function restoreState(saved) {
                if (!saved) return;
                state.activeTab = saved.activeTab || state.activeTab;
                state.activeFilter = saved.activeFilter || state.activeFilter;
                state.searchQuery = saved.searchQuery || '';
                state.sortBy = saved.sortBy || state.sortBy;

                const search = document.getElementById('foro-search-input');
                const sort = document.getElementById('foro-sort-select');
                if (search) search.value = state.searchQuery;
                if (sort) sort.value = state.sortBy;
            }

            function renderLayout() {
                return `
                    <section class="foro-shell fade-up-entry">
                        <div class="foro-hero-card mb-3">
                            <div class="foro-hero-copy">
                                <span class="foro-hero-kicker"><i class="bi bi-calendar-event"></i>Eventos del campus</span>
                                <h2 class="foro-hero-title">Tu agenda de eventos en un solo lugar</h2>
                                <p class="foro-hero-text">Inscribete, lleva tu pase y registra asistencia sin perder tiempo antes de entrar a la cartelera.</p>
                                <div class="foro-hero-actions">
                                    <button class="btn foro-hero-primary rounded-pill fw-bold" type="button" onclick="Foro.openStudentScanner()">
                                        <i class="bi bi-qr-code-scan me-2"></i>Escanear QR
                                    </button>
                                    <button class="btn foro-hero-secondary rounded-pill fw-bold" type="button" id="foro-reminders-btn" onclick="Foro.enableReminders()">
                                        <i class="bi bi-bell me-2"></i>Activar recordatorios
                                    </button>
                                </div>
                            </div>
                            <div class="foro-hero-meta">
                                <div><span>Publicados</span><strong id="foro-hero-count">0</strong></div>
                                <div><span>Mi agenda</span><strong id="foro-hero-tickets">0</strong></div>
                            </div>
                        </div>

                        <div class="d-flex flex-column gap-3 mb-4">
                            <div class="foro-tabbar" role="tablist" aria-label="Secciones de eventos">
                                ${tabBtn('cartelera', 'Cartelera', 'bi-grid-fill')}
                                ${tabBtn('tickets', 'Mi agenda', 'bi-ticket-perforated-fill')}
                                ${tabBtn('history', 'Historial', 'bi-clock-history')}
                            </div>

                            <div id="foro-search-bar" class="d-flex gap-2 flex-wrap">
                                <div class="flex-grow-1" style="min-width:220px;">
                                    <div class="input-group">
                                        <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
                                        <input id="foro-search-input" class="form-control border-start-0" placeholder="Buscar por evento, responsable o lugar" oninput="Foro.handleSearch(this.value)" aria-label="Buscar eventos">
                                    </div>
                                </div>
                                <select class="form-select" id="foro-sort-select" style="max-width:220px;" onchange="Foro.handleSort(this.value)" aria-label="Ordenar eventos">
                                    <option value="upcoming">Proximos primero</option>
                                    <option value="popularity">Mas demandados</option>
                                    <option value="capacity">Ultimos lugares</option>
                                </select>
                            </div>

                            <div id="foro-filters" class="d-flex gap-2 flex-wrap">
                                ${filterBtn('all', 'Todos')}
                                ${filterBtn('conferencia', 'Conferencias')}
                                ${filterBtn('exposicion', 'Exposiciones')}
                                ${filterBtn('otro', 'Otros')}
                                ${filterBtn('favorites', 'Favoritos', 'bi-heart-fill')}
                            </div>
                        </div>

                        <div id="foro-content-cartelera"><div id="foro-events-grid" class="row g-3">${renderSkeletons()}</div></div>
                        <div id="foro-content-tickets" class="d-none"><div id="foro-tickets-list"></div></div>
                        <div id="foro-content-history" class="d-none"><div id="foro-history-container"></div></div>
                    </section>
                    ${renderModals()}
                `;
            }

            function tabBtn(id, label, icon) {
                return `<button class="foro-tab-btn ${state.activeTab === id ? 'active' : ''}" data-tab="${id}" onclick="Foro.switchTab('${id}')" role="tab" aria-selected="${state.activeTab === id}"><i class="bi ${icon}"></i>${label}</button>`;
            }

            function filterBtn(id, label, icon = '') {
                return `<button class="foro-filter-chip ${state.activeFilter === id ? 'active' : ''}" data-filter="${id}" onclick="Foro.setFilter('${id}')">${icon ? `<i class="bi ${icon}"></i>` : ''}${label}</button>`;
            }

            function renderSkeletons() {
                return Array.from({ length: 6 }, () => `<div class="col-12 col-md-6 col-xl-4"><div class="foro-card-skeleton"></div></div>`).join('');
            }

            function renderModals() {
                return `
                    <div class="modal fade" id="modalEventDetailStudent" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow-lg"><div class="modal-header border-0"><div><div class="small text-uppercase text-muted fw-bold" id="sd-type-badge"></div><h4 class="fw-bold mb-0" id="sd-title"></h4></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body pt-0"><div id="sd-detail-body"></div></div><div class="modal-footer border-0" id="sd-actions"></div></div></div></div>
                    <div class="modal fade" id="modalTicketQR" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content rounded-4 border-0 shadow"><div class="modal-header border-0 pb-0"><button class="btn-close ms-auto" data-bs-dismiss="modal"></button></div><div class="modal-body text-center pt-0 pb-4"><h6 class="fw-bold" id="qr-event-title"></h6><p class="small text-muted" id="qr-event-meta"></p><div class="foro-qr-box"><div id="qrcode-container"></div></div><p class="small text-muted mb-0">Este pase es para validacion por staff. Para autoasistencia usa el QR proyectado del evento.</p></div></div></div></div>
                    <div class="modal fade" id="modalForoFeedback" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow"><div class="modal-header border-0"><h5 class="fw-bold mb-0">Calificar evento</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><input type="hidden" id="feedback-ticket-id"><input type="hidden" id="feedback-event-id"><input type="hidden" id="feedback-rating" value="0"><h6 class="fw-bold mb-1" id="feedback-event-title"></h6><p class="small text-muted mb-3">Tu opinion ayuda a mejorar la siguiente edicion.</p><div class="d-flex gap-2 justify-content-center mb-3" id="feedback-stars">${Array.from({ length: 5 }, (_, i) => `<button class="btn btn-link p-0 text-warning" onclick="Foro.setFeedbackRating(${i + 1})" aria-label="Calificar con ${i + 1} estrellas"><i class="bi bi-star fs-2"></i></button>`).join('')}</div><textarea id="feedback-comments" class="form-control" rows="3" placeholder="Comentario opcional"></textarea></div><div class="modal-footer border-0"><button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button><button class="btn btn-primary rounded-pill" id="btn-submit-feedback" onclick="Foro.submitFeedback()">Enviar</button></div></div></div></div>
                    <div class="modal fade" id="modalStudentScanner" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow overflow-hidden"><div class="modal-header bg-dark text-white border-0"><h5 class="fw-bold mb-0"><i class="bi bi-qr-code-scan me-2"></i>Escanear QR del evento o materiales</h5><button class="btn-close btn-close-white" onclick="Foro.stopStudentScanner()"></button></div><div class="modal-body p-0 bg-dark"><div id="student-reader" style="width:100%; min-height:320px;"></div></div></div></div></div>
                    <div class="modal fade" id="modalEventResources" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow"><div class="modal-header border-0"><div><h5 class="fw-bold mb-0" id="resources-title">Recursos del evento</h5><p class="small text-muted mb-0" id="resources-subtitle"></p></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="resources-body"></div></div></div></div>
                    <div class="modal fade" id="modalEventConversation" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content rounded-4 border-0 shadow"><div class="modal-header border-0"><div><h5 class="fw-bold mb-0" id="conversation-title">Contacto del evento</h5><p class="small text-muted mb-0">Escribe al organizador para dudas logisticas o de acceso.</p></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body pt-0"><div id="foro-conversation-thread" class="foro-chat-thread"></div><div class="input-group mt-3"><input id="foro-conversation-input" class="form-control" placeholder="Escribe tu mensaje"><button class="btn btn-primary" onclick="Foro.sendConversationMessage()">Enviar</button></div></div></div></div></div>
                `;
            }

            function startEventsStream() {
                state.eventsUnsub = window.ForoService.streamActiveEvents(state.ctx, { limit: 48 }, (events) => {
                    state.events = events;
                    renderEvents();
                }, () => {
                    window.ForoService.getActiveEvents(state.ctx).then((events) => {
                        state.events = events;
                        renderEvents();
                    });
                });
            }

            function switchTab(tab) {
                state.activeTab = tab;
                syncBreadcrumb(tab);
                ['cartelera', 'tickets', 'history'].forEach((key) => {
                    document.getElementById(`foro-content-${key}`)?.classList.toggle('d-none', key !== tab);
                });
                document.getElementById('foro-search-bar')?.classList.toggle('d-none', tab !== 'cartelera');
                document.getElementById('foro-filters')?.classList.toggle('d-none', tab !== 'cartelera');
                document.querySelectorAll('#view-foro .foro-tab-btn').forEach((button) => {
                    const active = button.dataset.tab === tab;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                if (tab === 'history' && !state.history.length) void loadHistory();
                if (tab === 'tickets') renderTickets();
            }

            function syncBreadcrumb(tab = state.activeTab) {
                const label = TAB_LABELS[tab] || TAB_LABELS.cartelera;
                window.SIA?.setBreadcrumbSection?.('view-foro', label, { moduleClickable: false });
            }

            function setFilter(value) { state.activeFilter = value; renderEvents(); refreshFavoriteChip(); }
            function handleSearch(value) { state.searchQuery = String(value || '').toLowerCase().trim(); renderEvents(); }
            function handleSort(value) { state.sortBy = value || 'upcoming'; renderEvents(); }
            function clearSearch() { state.searchQuery = ''; const input = document.getElementById('foro-search-input'); if (input) input.value = ''; renderEvents(); }

            async function loadTickets() {
                state.tickets = await window.ForoService.getUserTickets(state.ctx, shared.getUserUid(state.ctx, state.profile));
                updateHeroMeta();
                renderEvents();
                renderTickets();
            }

            async function loadHistory() {
                const container = document.getElementById('foro-history-container');
                if (container) container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
                state.history = await window.ForoService.getUserEventHistory(state.ctx, shared.getUserUid(state.ctx, state.profile));
                renderHistory();
            }

            function getTicketByEventId(eventId) { return state.tickets.find((ticket) => ticket.eventId === eventId); }
            function updateHeroMeta() { setText('foro-hero-count', state.events.length); setText('foro-hero-tickets', state.tickets.length); }
            function refreshFavoriteChip() { const chip = document.querySelector('#view-foro [data-filter="favorites"]'); if (chip) chip.innerHTML = `<i class="bi bi-heart-fill"></i>Favoritos${state.favorites.length ? `<span class="badge rounded-pill bg-danger ms-1">${state.favorites.length}</span>` : ''}`; }
            function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

            async function syncReminderButton() {
                const button = document.getElementById('foro-reminders-btn');
                if (!button) return;
                if (!window.PushService?.isSupported?.()) {
                    button.classList.add('d-none');
                    return;
                }

                const permission = typeof window.PushService.getPermissionStateAsync === 'function'
                    ? await window.PushService.getPermissionStateAsync()
                    : window.PushService.getPermissionState();

                if (permission === 'granted') {
                    button.disabled = true;
                    button.classList.add('is-active');
                    button.innerHTML = '<i class="bi bi-bell-fill me-2"></i>Recordatorios activos';
                    return;
                }

                button.disabled = false;
                button.classList.remove('d-none', 'is-active');
                button.innerHTML = '<i class="bi bi-bell me-2"></i>Activar recordatorios';
            }

            async function enableReminders() {
                const uid = shared.getUserUid(state.ctx, state.profile);
                if (!uid || !window.PushService?.isSupported?.()) return;

                const ok = await window.PushService.requestAndSubscribe(uid);
                if (ok) {
                    shared.showToast('Recordatorios push activados.', 'success');
                } else {
                    shared.showToast('No fue posible activar recordatorios en este dispositivo.', 'warning');
                }
                await syncReminderButton();
            }

            function getVisibleEvents() {
                let events = [...state.events];
                if (state.activeFilter === 'favorites') events = events.filter((event) => state.favorites.includes(event.id));
                else if (state.activeFilter !== 'all') events = events.filter((event) => event.type === state.activeFilter);
                if (state.searchQuery) events = events.filter((event) => [event.title, event.speaker, event.location].some((item) => String(item || '').toLowerCase().includes(state.searchQuery)));
                if (state.sortBy === 'popularity') events.sort((a, b) => (b.registeredCount || 0) - (a.registeredCount || 0));
                else if (state.sortBy === 'capacity') events.sort((a, b) => ((b.registeredCount || 0) / (b.capacity || 1)) - ((a.registeredCount || 0) / (a.capacity || 1)));
                else events.sort((a, b) => (shared.toDate(a.date) || new Date(0)) - (shared.toDate(b.date) || new Date(0)));
                return events;
            }

            function renderEvents() {
                const grid = document.getElementById('foro-events-grid');
                if (!grid) return;
                const esc = shared.escapeHtml;
                const events = getVisibleEvents();
                updateHeroMeta();
                if (!events.length) {
                    grid.innerHTML = `<div class="col-12"><div class="foro-empty-state"><i class="bi bi-calendar-x"></i><h6 class="fw-bold">No encontramos eventos con esos filtros.</h6><p class="small text-muted mb-3">Prueba otra busqueda o vuelve a la cartelera completa.</p><button class="btn btn-outline-primary rounded-pill" onclick="Foro.clearSearch();Foro.setFilter('all')">Limpiar filtros</button></div></div>`;
                    return;
                }

                grid.innerHTML = events.map((event) => {
                    const typeCfg = shared.getTypeCfg(event.type);
                    const phase = shared.getEventPhase(event);
                    const ticket = getTicketByEventId(event.id);
                    const registered = !!ticket;
                    const full = (event.registeredCount || 0) >= (event.capacity || 0);
                    const capacity = Math.min(100, Math.round(((event.registeredCount || 0) / (event.capacity || 1)) * 100));
                    return `<div class="col-12 col-md-6 col-xl-4"><article class="foro-event-card card border-0 h-100 shadow-sm">
                        <div class="foro-event-cover" style="background-image:url('${shared.escapeAttr(event.coverImage || '/images/foro.png')}')"><button class="foro-fav-btn ${state.favorites.includes(event.id) ? 'is-active' : ''}" onclick="event.stopPropagation();Foro.toggleFavorite('${event.id}')" aria-label="Guardar ${esc(event.title)}"><i class="bi ${state.favorites.includes(event.id) ? 'bi-heart-fill' : 'bi-heart'}"></i></button><span class="badge bg-${typeCfg.color}">${typeCfg.label}</span></div>
                        <div class="card-body d-flex flex-column"><div class="d-flex justify-content-between align-items-start gap-2 mb-2"><h5 class="fw-bold mb-0">${esc(event.title)}</h5><span class="badge text-bg-${phase.variant} ${phase.pulse ? 'foro-pulse' : ''}"><i class="bi ${phase.icon} me-1"></i>${esc(phase.label)}</span></div><p class="small text-muted mb-2"><i class="bi bi-person-vcard me-1"></i>${esc(event.speaker || 'Por confirmar')}<br><i class="bi bi-geo-alt me-1"></i>${esc(event.location || 'Por confirmar')}</p><div class="small text-muted mb-3">${esc(shared.formatDate(event.date))}</div><div class="foro-capacity mb-3"><div class="d-flex justify-content-between small"><span>${full ? 'Cupo lleno' : `${event.registeredCount || 0} / ${event.capacity || 0} inscritos`}</span><span>${capacity}%</span></div><div class="progress" style="height:6px;"><div class="progress-bar ${full ? 'bg-danger' : capacity > 80 ? 'bg-warning' : 'bg-success'}" style="width:${capacity}%"></div></div></div><div class="d-flex gap-2 mt-auto"><button class="btn ${registered ? 'btn-outline-primary' : (full ? 'btn-outline-secondary' : 'btn-primary')} rounded-pill flex-grow-1" onclick="event.stopPropagation();${registered ? `Foro.switchTab('tickets')` : `Foro.handleRegister('${event.id}')`}" ${full && !registered ? 'disabled' : ''}>${registered ? 'Ya inscrito' : full ? 'Sin lugares' : 'Inscribirme'}</button><button class="btn btn-light rounded-pill" onclick="event.stopPropagation();Foro.openEventDetailModal('${event.id}')" aria-label="Ver detalle"><i class="bi bi-eye"></i></button></div></div></article></div>`;
                }).join('');
            }

            function renderTickets() {
                const list = document.getElementById('foro-tickets-list');
                if (!list) return;
                const esc = shared.escapeHtml;
                if (!state.tickets.length) {
                    list.innerHTML = `<div class="foro-empty-state"><i class="bi bi-ticket-perforated"></i><h6 class="fw-bold">Todavia no tienes eventos en tu agenda.</h6><p class="small text-muted mb-3">Inscribete desde la cartelera para generar tu pase y tu seguimiento.</p><button class="btn btn-primary rounded-pill" onclick="Foro.switchTab('cartelera')">Ir a cartelera</button></div>`;
                    return;
                }

                list.innerHTML = `<div class="row g-3">${state.tickets.map((ticket) => {
                    const phase = shared.getEventPhase(ticket);
                    const attended = ticket.status === 'attended';
                    const eventStatus = ticket.eventStatus || 'active';
                    const eventStatusCfg = shared.getStatusCfg(eventStatus);
                    const isEventActive = eventStatus === 'active';
                    const showDayMode = !attended && isEventActive && ['today', 'soon', 'checkin', 'live', 'tomorrow'].includes(phase.key);
                    const badgeVariant = attended ? 'success' : (isEventActive ? phase.variant : eventStatusCfg.color);
                    const badgeLabel = attended ? 'Asistencia registrada' : (isEventActive ? phase.label : eventStatusCfg.label);
                    const statusNote = !attended && !isEventActive
                        ? `<div class="small text-muted mb-3">${esc(
                            eventStatus === 'cancelled'
                                ? 'La organizacion cancelo este evento.'
                                : eventStatus === 'rejected'
                                    ? 'El evento fue retirado de la cartelera durante la revision editorial.'
                                    : 'El evento esta en revision por cambios recientes.'
                        )}</div>`
                        : '';
                    const inactiveActions = eventStatus === 'cancelled'
                        ? `<button class="btn btn-outline-secondary rounded-pill" disabled><i class="bi bi-slash-circle me-1"></i>Evento cancelado</button>`
                        : `<button class="btn btn-outline-danger rounded-pill" onclick="Foro.cancelTicket('${ticket.id}','${ticket.eventId}','${shared.escapeInlineText(ticket.eventTitle)}')"><i class="bi bi-x-circle me-1"></i>Cancelar registro</button>`;

                    return `<div class="col-12 col-xl-6"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body p-4"><div class="d-flex justify-content-between gap-3 flex-wrap mb-3"><div><span class="badge bg-${badgeVariant} ${!attended && isEventActive && phase.pulse ? 'foro-pulse' : ''}">${esc(badgeLabel)}</span><h5 class="fw-bold mt-2 mb-1">${esc(ticket.eventTitle)}</h5><p class="small text-muted mb-0">${esc(ticket.eventLocation || '')}</p></div><div class="text-end small text-muted"><div>${esc(shared.formatDate(ticket.eventDate))}</div><div>${esc(shared.formatTimeRange(ticket))}</div>${ticket.eventRoom ? `<div>${esc(ticket.eventRoom)}</div>` : ''}</div></div>${statusNote}${showDayMode ? `<div class="foro-day-card mb-3"><div class="small fw-bold text-uppercase text-muted mb-2">Modo dia del evento</div><div class="small mb-2">${ticket.eventDayInstructions ? esc(ticket.eventDayInstructions) : 'Tu pase y la asistencia estan listos para usarse.'}</div>${ticket.eventMapUrl ? `<a class="btn btn-sm btn-light rounded-pill me-2" href="${shared.escapeAttr(ticket.eventMapUrl)}" target="_blank" rel="noopener"><i class="bi bi-map me-1"></i>Mapa</a>` : ''}${ticket.contactEnabled ? `<button class="btn btn-sm btn-outline-primary rounded-pill" onclick="Foro.openConversationModal('${ticket.eventId}')"><i class="bi bi-chat-dots me-1"></i>Contacto</button>` : ''}</div>` : ''}<div class="d-flex flex-wrap gap-2">${attended ? `${ticket.hasResources ? `<button class="btn btn-outline-primary rounded-pill" onclick="Foro.openResourcesModal('${ticket.eventId}')"><i class="bi bi-folder2-open me-1"></i>Recursos</button>` : ''}${window.ForoService.canSubmitFeedback(ticket) ? `<button class="btn btn-warning rounded-pill" onclick="Foro.openFeedbackModal('${ticket.id}','${ticket.eventId}','${shared.escapeInlineText(ticket.eventTitle)}')"><i class="bi bi-star-fill me-1"></i>Calificar</button>` : ''}` : (isEventActive ? `<button class="btn btn-primary rounded-pill" onclick="Foro.showTicketQR('${ticket.id}')"><i class="bi bi-qr-code me-1"></i>Mi pase</button>${ticket.allowSelfCheckIn !== false ? `<button class="btn btn-outline-primary rounded-pill" onclick="Foro.openStudentScanner()"><i class="bi bi-qr-code-scan me-1"></i>Registrar asistencia</button>` : ''}<button class="btn btn-light rounded-pill" onclick="Foro.downloadCalendar('${ticket.eventId}')"><i class="bi bi-calendar-plus me-1"></i>Calendario</button><button class="btn btn-outline-danger rounded-pill" onclick="Foro.cancelTicket('${ticket.id}','${ticket.eventId}','${shared.escapeInlineText(ticket.eventTitle)}')"><i class="bi bi-x-circle me-1"></i>Cancelar</button>` : inactiveActions)}</div></div></div></div>`;
                }).join('')}</div>`;
            }

            function renderHistory() {
                const container = document.getElementById('foro-history-container');
                if (!container) return;
                const esc = shared.escapeHtml;
                if (!state.history.length) {
                    container.innerHTML = `<div class="foro-empty-state"><i class="bi bi-award"></i><h6 class="fw-bold">Aun no registras asistencias.</h6><p class="small text-muted mb-3">Cuando confirmes asistencia aqui apareceran tus eventos completados y sus materiales.</p><button class="btn btn-primary rounded-pill" onclick="Foro.switchTab('cartelera')">Explorar eventos</button></div>`;
                    return;
                }

                container.innerHTML = `<div class="foro-history-hero mb-4"><div><div class="small text-uppercase fw-bold opacity-75">Historial</div><h3 class="fw-bold mb-1">${state.history.length} evento${state.history.length === 1 ? '' : 's'} asistido${state.history.length === 1 ? '' : 's'}</h3><p class="mb-0 opacity-75">Tus constancias y recursos se mantienen aqui.</p></div><button class="btn btn-light rounded-pill fw-bold" onclick="Foro.downloadCertificate()"><i class="bi bi-file-earmark-pdf me-1"></i>Constancia</button></div><div class="row g-3">${state.history.map((ticket) => `<div class="col-12 col-md-6"><div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body"><span class="badge bg-success-subtle text-success mb-2">Asistencia confirmada</span><h6 class="fw-bold mb-1">${esc(ticket.eventTitle)}</h6><p class="small text-muted mb-3">${esc(shared.formatDate(ticket.eventDate))}</p><div class="d-flex flex-wrap gap-2">${ticket.hasResources ? `<button class="btn btn-outline-primary rounded-pill" onclick="Foro.openResourcesModal('${ticket.eventId}')"><i class="bi bi-folder2-open me-1"></i>Recursos</button>` : ''}<button class="btn btn-light rounded-pill" onclick="Foro.downloadCalendar('${ticket.eventId}')"><i class="bi bi-calendar-plus me-1"></i>Calendario</button>${window.ForoService.canSubmitFeedback(ticket) ? `<button class="btn btn-warning rounded-pill" onclick="Foro.openFeedbackModal('${ticket.id}','${ticket.eventId}','${shared.escapeInlineText(ticket.eventTitle)}')"><i class="bi bi-star-fill me-1"></i>Calificar</button>` : ''}</div></div></div></div>`).join('')}</div>`;
            }

            async function handleRegister(eventId) {
                if (!window.confirm('Confirmar inscripcion al evento?')) return;
                try {
                    await window.ForoService.registerUser(state.ctx, eventId);
                    shared.showToast('Inscripcion confirmada.', 'success');
                    await loadTickets();
                    switchTab('tickets');
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible inscribirte.', 'danger');
                }
            }

            async function cancelTicket(ticketId, eventId, title) {
                if (!window.confirm(`Cancelar tu lugar en "${title}"?`)) return;
                try {
                    await window.ForoService.cancelRegistration(state.ctx, ticketId, eventId);
                    shared.showToast('Tu inscripcion fue cancelada.', 'success');
                    await loadTickets();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible cancelar.', 'danger');
                }
            }

            async function toggleFavorite(eventId) {
                const index = state.favorites.indexOf(eventId);
                if (index >= 0) state.favorites.splice(index, 1);
                else state.favorites.push(eventId);
                state.favorites = await shared.saveFavoriteIds(state.ctx, state.profile, state.favorites);
                renderEvents();
                refreshFavoriteChip();
            }

            function showTicketQR(ticketId) {
                const ticket = state.tickets.find((item) => item.id === ticketId);
                if (!ticket) return;
                setText('qr-event-title', ticket.eventTitle);
                setText('qr-event-meta', `${ticket.eventLocation || ''} | ${shared.formatDate(ticket.eventDate)}`);
                const box = document.getElementById('qrcode-container');
                box.innerHTML = '';
                new bootstrap.Modal(document.getElementById('modalTicketQR')).show();
                setTimeout(() => new QRCode(box, { text: ticket.qrCodeData, width: 250, height: 250, correctLevel: QRCode.CorrectLevel.H }), 150);
            }

            function openEventDetailModal(eventId) {
                const event = state.events.find((item) => item.id === eventId);
                if (!event) return;
                const ticket = getTicketByEventId(eventId);
                const body = document.getElementById('sd-detail-body');
                const type = shared.getTypeCfg(event.type);
                const phase = shared.getEventPhase(event);
                const esc = shared.escapeHtml;
                setText('sd-type-badge', type.label);
                setText('sd-title', event.title);
                body.innerHTML = `<div class="foro-detail-grid"><div class="foro-detail-main">${event.coverImage ? `<img src="${shared.escapeAttr(event.coverImage)}" class="foro-detail-cover" alt="${esc(event.title)}">` : ''}<p class="text-muted mb-3">${esc(event.description || 'Sin descripcion disponible.')}</p><div class="foro-detail-badges"><span class="badge bg-${phase.variant} ${phase.pulse ? 'foro-pulse' : ''}">${esc(phase.label)}</span><span class="badge bg-light text-dark">${esc(shared.formatAudience(event.targetAudience))}</span></div></div><aside class="foro-detail-side"><div class="foro-side-card"><div><i class="bi bi-person-vcard"></i>${esc(event.speaker || 'Por confirmar')}</div><div><i class="bi bi-geo-alt"></i>${esc(event.location || 'Por confirmar')}</div><div><i class="bi bi-door-open"></i>${esc(event.room || 'Por definir')}</div><div><i class="bi bi-clock"></i>${esc(shared.formatTimeRange(event))}</div>${event.mapUrl ? `<a href="${shared.escapeAttr(event.mapUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-light rounded-pill mt-2"><i class="bi bi-map me-1"></i>Ver mapa</a>` : ''}</div>${event.dayInstructions ? `<div class="foro-side-card small text-muted">${esc(event.dayInstructions)}</div>` : ''}</aside></div>`;
                document.getElementById('sd-actions').innerHTML = `<button class="btn btn-light rounded-pill" onclick="Foro.shareEvent('${event.id}')"><i class="bi bi-share me-1"></i>Compartir</button><button class="btn btn-light rounded-pill" onclick="Foro.downloadCalendar('${event.id}')"><i class="bi bi-calendar-plus me-1"></i>Calendario</button>${ticket ? `<button class="btn btn-outline-primary rounded-pill" onclick="bootstrap.Modal.getInstance(document.getElementById('modalEventDetailStudent')).hide();Foro.switchTab('tickets')">Ver mi agenda</button>` : `<button class="btn btn-primary rounded-pill" onclick="bootstrap.Modal.getInstance(document.getElementById('modalEventDetailStudent')).hide();Foro.handleRegister('${event.id}')">Inscribirme</button>`}`;
                new bootstrap.Modal(document.getElementById('modalEventDetailStudent')).show();
            }

            async function shareEvent(eventId) {
                const event = state.events.find((item) => item.id === eventId) || await window.ForoService.getEventById(state.ctx, eventId).catch(() => null);
                if (!event) return;
                const text = `${event.title}\n${shared.formatDate(event.date)}\n${event.location || ''}`;
                const url = `${window.location.origin}/foro`;
                if (navigator.share) {
                    try { await navigator.share({ title: event.title, text, url }); return; } catch (error) { if (error.name === 'AbortError') return; }
                }
                navigator.clipboard?.writeText(`${text}\n${url}`);
                shared.showToast('Informacion copiada.', 'success');
            }

            async function downloadCalendar(eventId) {
                try {
                    const event = state.events.find((item) => item.id === eventId) ||
                        state.tickets.find((item) => item.eventId === eventId) ||
                        state.history.find((item) => item.eventId === eventId) ||
                        await window.ForoService.getEventById(state.ctx, eventId);
                    window.ForoService.downloadEventCalendar(event);
                } catch (error) {
                    shared.showToast(error.message || 'No se pudo generar el calendario.', 'warning');
                }
            }

            function openFeedbackModal(ticketId, eventId, eventTitle) {
                document.getElementById('feedback-ticket-id').value = ticketId;
                document.getElementById('feedback-event-id').value = eventId;
                setText('feedback-event-title', eventTitle);
                document.getElementById('feedback-comments').value = '';
                setFeedbackRating(0);
                new bootstrap.Modal(document.getElementById('modalForoFeedback')).show();
            }

            function setFeedbackRating(stars) {
                document.getElementById('feedback-rating').value = stars;
                document.querySelectorAll('#feedback-stars i').forEach((icon, index) => {
                    icon.className = `bi ${index < stars ? 'bi-star-fill' : 'bi-star'} fs-2`;
                });
            }

            async function submitFeedback() {
                const ticketId = document.getElementById('feedback-ticket-id').value;
                const eventId = document.getElementById('feedback-event-id').value;
                const rating = parseInt(document.getElementById('feedback-rating').value, 10);
                const comment = document.getElementById('feedback-comments').value.trim();
                if (!rating) return shared.showToast('Selecciona una calificacion.', 'warning');
                const button = document.getElementById('btn-submit-feedback');
                const backup = button.innerHTML;
                button.disabled = true;
                button.innerHTML = 'Enviando...';
                try {
                    await window.ForoService.submitEventFeedback(state.ctx, ticketId, eventId, null, rating, comment);
                    bootstrap.Modal.getInstance(document.getElementById('modalForoFeedback'))?.hide();
                    shared.showToast('Gracias por tu retroalimentacion.', 'success');
                    await loadTickets();
                    await loadHistory();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible enviar la resena.', 'danger');
                } finally {
                    button.disabled = false;
                    button.innerHTML = backup;
                }
            }

            function openStudentScanner() {
                if (!window.Html5QrcodeScanner) return shared.showToast('El lector QR aun se esta cargando.', 'warning');
                const modal = new bootstrap.Modal(document.getElementById('modalStudentScanner'));
                modal.show();
                setTimeout(() => {
                    state.studentScanner = new Html5QrcodeScanner('student-reader', { fps: 10, qrbox: { width: 240, height: 240 } }, false);
                    state.studentScanner.render(async (decodedText) => {
                        try {
                            await state.studentScanner.clear();
                            state.studentScanner = null;
                            const result = await window.ForoService.processStudentQr(state.ctx, decodedText);
                            modal.hide();
                            if (result.type === 'attendance') {
                                shared.showToast('Asistencia registrada.', 'success');
                                await loadTickets();
                                await loadHistory();
                            } else if (result.type === 'resources') {
                                state.resourcesBundle = result;
                                renderResourcesBundle(result);
                                new bootstrap.Modal(document.getElementById('modalEventResources')).show();
                            }
                        } catch (error) {
                            shared.showToast(error.message || 'No fue posible procesar el QR.', 'danger');
                            modal.hide();
                        }
                    }, () => { });
                }, 150);
            }

            function stopStudentScanner() {
                if (state.studentScanner?.clear) state.studentScanner.clear().catch(() => null);
                state.studentScanner = null;
                bootstrap.Modal.getInstance(document.getElementById('modalStudentScanner'))?.hide();
            }

            async function openResourcesModal(eventId) {
                try {
                    const bundle = typeof eventId === 'string' ? await window.ForoService.getEventResources(state.ctx, { eventId }) : eventId;
                    state.resourcesBundle = bundle;
                    renderResourcesBundle(bundle);
                    new bootstrap.Modal(document.getElementById('modalEventResources')).show();
                } catch (error) {
                    shared.showToast(error.message || 'Aun no hay recursos para este evento.', 'warning');
                }
            }

            function renderResourcesBundle(bundle) {
                const esc = shared.escapeHtml;
                setText('resources-title', bundle?.event?.title || 'Recursos del evento');
                setText('resources-subtitle', bundle?.items?.length ? `${bundle.items.length} recurso(s) disponible(s)` : 'Sin materiales publicados');
                document.getElementById('resources-body').innerHTML = bundle?.items?.length
                    ? bundle.items.map((item) => `<a class="foro-resource-card" href="${shared.escapeAttr(item.url)}" target="_blank" rel="noopener"><div><strong>${esc(item.title || 'Recurso')}</strong>${item.description ? `<div class="small text-muted mt-1">${esc(item.description)}</div>` : ''}</div><span class="badge bg-light text-dark">${esc(item.type === 'file' ? 'Archivo' : 'Enlace')}</span></a>`).join('')
                    : '<div class="text-muted small">Aun no se publican recursos.</div>';
            }

            async function openConversationModal(eventId) {
                try {
                    const event = state.events.find((item) => item.id === eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                    const conversation = await window.ForoChatService.getOrCreateConversation(state.ctx, event, state.profile);
                    state.chatConversation = conversation;
                    setText('conversation-title', event.title || conversation.eventTitle);
                    if (state.chatMsgsUnsub) state.chatMsgsUnsub();
                    state.chatMsgsUnsub = window.ForoChatService.streamMessages(state.ctx, conversation.id, (messages) => renderConversation(messages));
                    await window.ForoChatService.markAsRead(state.ctx, conversation.id, 'student').catch(() => null);
                    new bootstrap.Modal(document.getElementById('modalEventConversation')).show();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible abrir el chat del evento.', 'danger');
                }
            }

            function renderConversation(messages) {
                const esc = shared.escapeHtml;
                const thread = document.getElementById('foro-conversation-thread');
                thread.innerHTML = !messages.length
                    ? '<div class="text-muted small text-center py-4">Aun no hay mensajes. Puedes escribir primero.</div>'
                    : messages.map((msg) => `<div class="foro-chat-bubble ${msg.senderId === shared.getUserUid(state.ctx, state.profile) ? 'is-me' : ''}"><div class="small">${esc(msg.text)}</div><div class="extra-small opacity-75 mt-1">${esc(msg.senderName || '')}</div></div>`).join('');
                thread.scrollTop = thread.scrollHeight;
            }

            async function sendConversationMessage() {
                const input = document.getElementById('foro-conversation-input');
                const text = input.value.trim();
                if (!text || !state.chatConversation) return;
                input.value = '';
                await window.ForoChatService.sendMessage(state.ctx, state.chatConversation.id, state.profile, 'student', text).catch((error) => shared.showToast(error.message || 'No fue posible enviar el mensaje.', 'danger'));
            }

            async function downloadCertificate() {
                try {
                    await window.ForoService.generateAttendanceCertificate(state.ctx, shared.getUserUid(state.ctx, state.profile), state.profile);
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible generar la constancia.', 'warning');
                }
            }

            function getDashboardWidget() {
                return `<div class="card border-0 shadow-sm rounded-4 h-100"><div class="card-body"><h6 class="fw-bold mb-3"><i class="bi bi-calendar-event text-primary me-2"></i>Proximos eventos</h6><div class="small text-muted">Explora la cartelera para ver nuevas convocatorias.</div></div></div>`;
            }

            function cleanup() {
                if (state.eventsUnsub) state.eventsUnsub();
                state.eventsUnsub = null;
                if (state.chatMsgsUnsub) state.chatMsgsUnsub();
                state.chatMsgsUnsub = null;
                stopStudentScanner();
            }
        }

        return { create };
    })();
}
