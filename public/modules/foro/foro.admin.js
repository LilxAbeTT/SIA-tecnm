// public/modules/foro/foro.admin.js
// Admin controller for Eventos

if (!window.ForoModule) window.ForoModule = {};

if (!window.ForoModule.Admin) {
    window.ForoModule.Admin = (function () {
        function create() {
            const shared = window.ForoModule?.Shared;
            if (!shared) throw new Error('[AdminEventos] Shared helpers not loaded.');

            const state = {
                ctx: null,
                profile: null,
                roles: null,
                adminEvents: [],
                difusionQueue: [],
                difusionHistory: [],
                eventConversations: [],
                scanner: null,
                qrTimer: null,
                conversationsUnsub: null,
                messageUnsub: null,
                activeConversation: null,
                selectedEventId: null
            };

            return {
                init,
                crearEvento,
                openEventModal,
                handleEventSubmit,
                deleteEvent,
                confirmCancelEvent,
                publishEventQR,
                publishResourcesQR,
                viewEventAttendees,
                exportAttendees,
                openScanner,
                stopScanner,
                refreshDifusionData,
                handleApprove,
                openRejectModal,
                handleRejectSubmit,
                initDivisionHeadView,
                renderDivisionEventsTable,
                previewEventCover: previewCover,
                previewCover,
                openEventDetailsModal,
                openEventMessages,
                selectConversation,
                sendConversationReply,
                addResourceRow,
                removeResourceRow,
                cleanup
            };

            async function init(ctx) {
                cleanup();
                state.ctx = ctx;
                state.profile = ctx?.profile || null;
                state.roles = shared.determineRoles(state.profile);

                const container = document.getElementById('view-foro');
                if (!container || !state.profile) return;

                container.innerHTML = state.roles.isDifusion ? renderDifusionView() : renderDivisionView();
                bindModalCleanup();

                if (ctx?.ModuleManager?.addSubscription) {
                    ctx.ModuleManager.addSubscription(cleanup);
                }

                if (state.roles.isDifusion) await refreshDifusionData();
                else await initDivisionHeadView();
            }

            function cleanup() {
                cleanupQrTimer();
                stopScanner();
                if (state.conversationsUnsub) state.conversationsUnsub();
                if (state.messageUnsub) state.messageUnsub();
                state.conversationsUnsub = null;
                state.messageUnsub = null;
                state.activeConversation = null;
                state.selectedEventId = null;
                state.eventConversations = [];
            }

            function bindModalCleanup() {
                const qrModal = document.getElementById('modalPublishQR');
                const msgModal = document.getElementById('modalForoMessages');
                if (qrModal) qrModal.addEventListener('hidden.bs.modal', cleanupQrTimer);
                if (msgModal) {
                    msgModal.addEventListener('hidden.bs.modal', () => {
                        if (state.conversationsUnsub) state.conversationsUnsub();
                        if (state.messageUnsub) state.messageUnsub();
                        state.conversationsUnsub = null;
                        state.messageUnsub = null;
                        state.activeConversation = null;
                        state.eventConversations = [];
                    });
                }
            }

            function cleanupQrTimer() {
                if (state.qrTimer) {
                    clearInterval(state.qrTimer);
                    state.qrTimer = null;
                }
            }

            function renderDifusionView() {
                return `
                    <section class="foro-admin-shell fade-up-entry">
                        <div class="foro-admin-hero mb-4">
                            <div>
                                <span class="foro-admin-kicker">Difusion</span>
                                <h2 class="h3 fw-bold mb-1">Mesa editorial de Eventos</h2>
                                <p class="text-muted mb-0">Aprueba, publica y monitorea la cartelera institucional desde un solo flujo.</p>
                            </div>
                            <div class="foro-admin-stats">
                                <div><strong id="badge-queue-count">0</strong><span>pendientes</span></div>
                                <div><strong id="badge-history-count">0</strong><span>en historial</span></div>
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-12 col-xl-5">
                                <div class="card border-0 shadow-sm rounded-4 h-100">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h6 class="fw-bold mb-0">Revision pendiente</h6>
                                                <small class="text-muted">Solo Difusion puede aprobar o rechazar.</small>
                                            </div>
                                        </div>
                                        <div id="difusion-queue-list" class="d-flex flex-column gap-3"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-xl-7">
                                <div class="card border-0 shadow-sm rounded-4 h-100">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h6 class="fw-bold mb-0">Historial editorial</h6>
                                                <small class="text-muted">Publicados, rechazados y cancelados recientemente.</small>
                                            </div>
                                            <button class="btn btn-outline-primary rounded-pill btn-sm" onclick="AdminForo.refreshDifusionData()">
                                                <i class="bi bi-arrow-repeat me-1"></i>Actualizar
                                            </button>
                                        </div>
                                        <div class="table-responsive">
                                            <table class="table align-middle mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Evento</th>
                                                        <th>Solicita</th>
                                                        <th>Estado</th>
                                                        <th>Fecha</th>
                                                        <th class="text-end">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="difusion-history-body"></tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                    ${renderModals()}
                `;
            }

            function renderDivisionView() {
                return `
                    <section class="foro-admin-shell fade-up-entry">
                        <div class="foro-admin-hero mb-4">
                            <div>
                                <span class="foro-admin-kicker">Jefatura / Organizacion</span>
                                <h2 class="h3 fw-bold mb-1">Gestion de mis eventos</h2>
                                <p class="text-muted mb-0">Prepara la ficha, publica recursos, atiende mensajes y valida asistencias sin salir del modulo.</p>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                <button class="btn btn-outline-dark rounded-pill" onclick="AdminForo.openScanner()">
                                    <i class="bi bi-qr-code-scan me-2"></i>Escanear ticket
                                </button>
                                <button class="btn btn-primary rounded-pill" onclick="AdminForo.openEventModal()">
                                    <i class="bi bi-calendar-plus me-2"></i>Nuevo evento
                                </button>
                            </div>
                        </div>

                        <div class="alert alert-info border-0 rounded-4 shadow-sm mb-4">
                            <strong>Flujo actual:</strong> la jefatura crea o actualiza sus eventos. Difusion es quien publica y aprueba la cartelera visible al estudiante.
                        </div>

                        <div class="card border-0 shadow-sm rounded-4">
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Evento</th>
                                                <th>Estado</th>
                                                <th>Fecha</th>
                                                <th>Recursos</th>
                                                <th class="text-end">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody id="foro-admin-events-body"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>
                    ${renderModals()}
                `;
            }

            function renderModals() {
                return `
                    <div class="modal fade" id="modalForoEvent" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-xl modal-dialog-scrollable">
                            <div class="modal-content rounded-4 border-0 shadow-lg">
                                <div class="modal-header border-0">
                                    <div>
                                        <div class="small text-uppercase text-muted fw-bold">Evento</div>
                                        <h5 class="fw-bold mb-0" id="modalForoEventTitle">Nuevo evento</h5>
                                    </div>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body pt-0">
                                    <form id="form-foro-event" onsubmit="AdminForo.handleEventSubmit(event)">
                                        <input type="hidden" id="foro-evt-id">
                                        <input type="hidden" id="foro-evt-cover-url">
                                        <div class="row g-3">
                                            <div class="col-md-8">
                                                <label class="form-label small fw-bold">Titulo</label>
                                                <input id="foro-evt-title" class="form-control" required maxlength="160">
                                            </div>
                                            <div class="col-md-4">
                                                <label class="form-label small fw-bold">Tipo</label>
                                                <select id="foro-evt-type" class="form-select">
                                                    <option value="conferencia">Conferencia</option>
                                                    <option value="exposicion">Exposicion</option>
                                                    <option value="otro">Otro</option>
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Inicio</label>
                                                <input id="foro-evt-date" type="datetime-local" class="form-control" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Fin</label>
                                                <input id="foro-evt-end-date" type="datetime-local" class="form-control" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Ponente / responsable</label>
                                                <input id="foro-evt-speaker" class="form-control" required maxlength="120">
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Ubicacion</label>
                                                <input id="foro-evt-location" class="form-control" required maxlength="160">
                                            </div>
                                            <div class="col-md-3">
                                                <label class="form-label small fw-bold">Salon / puerta</label>
                                                <input id="foro-evt-room" class="form-control" maxlength="120">
                                            </div>
                                            <div class="col-md-3">
                                                <label class="form-label small fw-bold">Aforo</label>
                                                <input id="foro-evt-capacity" type="number" class="form-control" min="1" max="5000" value="100">
                                            </div>
                                            <div class="col-md-3">
                                                <label class="form-label small fw-bold">Abre asistencia (min)</label>
                                                <input id="foro-evt-open-window" type="number" class="form-control" min="0" max="180" value="30">
                                            </div>
                                            <div class="col-md-3">
                                                <label class="form-label small fw-bold">Cierra asistencia (min)</label>
                                                <input id="foro-evt-close-window" type="number" class="form-control" min="15" max="360" value="120">
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Mapa / URL</label>
                                                <input id="foro-evt-map" class="form-control" placeholder="https://...">
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label small fw-bold">Portada</label>
                                                <input id="foro-evt-cover" type="file" class="form-control" accept="image/*" onchange="AdminForo.previewCover(this)">
                                                <div id="cover-preview" class="mt-2 d-none">
                                                    <img id="cover-preview-img" class="img-fluid rounded-3" style="max-height:140px;" alt="Vista previa de portada">
                                                </div>
                                            </div>
                                            <div class="col-md-12">
                                                <label class="form-label small fw-bold">Audiencia</label>
                                                <select id="foro-evt-audience" class="form-select" multiple>
                                                    <option value="ALL">Todas las carreras</option>
                                                    <option value="ISC">Sistemas</option>
                                                    <option value="ITIC">Tecnologias</option>
                                                    <option value="ARQ">Arquitectura</option>
                                                    <option value="CIV">Civil</option>
                                                    <option value="ADM">Administracion</option>
                                                    <option value="CON">Contador Publico</option>
                                                    <option value="GAS">Gastronomia</option>
                                                    <option value="TUR">Turismo</option>
                                                    <option value="ELE">Electromecanica</option>
                                                </select>
                                                <div class="form-text">Si no eliges ninguna carrera, el evento se publica para todos.</div>
                                            </div>
                                            <div class="col-md-12">
                                                <label class="form-label small fw-bold">Descripcion</label>
                                                <textarea id="foro-evt-desc" class="form-control" rows="3" maxlength="2200"></textarea>
                                            </div>
                                            <div class="col-md-12">
                                                <label class="form-label small fw-bold">Instrucciones del dia</label>
                                                <textarea id="foro-evt-day" class="form-control" rows="3" maxlength="1200" placeholder="Acceso, registro, puerta, equipo requerido..."></textarea>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-check form-switch mt-2">
                                                    <input class="form-check-input" type="checkbox" id="foro-evt-contact" checked>
                                                    <label class="form-check-label" for="foro-evt-contact">Permitir mensajes al organizador</label>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-check form-switch mt-2">
                                                    <input class="form-check-input" type="checkbox" id="foro-evt-self-checkin" checked>
                                                    <label class="form-check-label" for="foro-evt-self-checkin">Permitir autoasistencia por QR</label>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-check form-switch mt-2">
                                                    <input class="form-check-input" type="checkbox" id="foro-evt-res-qr" checked>
                                                    <label class="form-check-label" for="foro-evt-res-qr">Habilitar QR de recursos</label>
                                                </div>
                                            </div>
                                            <div class="col-12">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <label class="form-label small fw-bold mb-0">Recursos post evento</label>
                                                    <button class="btn btn-sm btn-outline-primary rounded-pill" type="button" onclick="AdminForo.addResourceRow()">
                                                        <i class="bi bi-plus-lg me-1"></i>Agregar recurso
                                                    </button>
                                                </div>
                                                <div id="foro-resource-list" class="d-flex flex-column gap-2"></div>
                                            </div>
                                        </div>
                                        <div class="d-flex justify-content-end gap-2 mt-4">
                                            <button class="btn btn-light rounded-pill" type="button" data-bs-dismiss="modal">Cerrar</button>
                                            <button class="btn btn-primary rounded-pill px-4" id="foro-submit-btn" type="submit">Guardar evento</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalPublishQR" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <div>
                                        <h5 class="fw-bold mb-0" id="publish-qr-title">QR del evento</h5>
                                        <p class="small text-muted mb-0" id="publish-qr-subtitle"></p>
                                    </div>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body text-center">
                                    <div class="foro-qr-box"><div id="publish-qrcode-container"></div></div>
                                    <p class="small text-muted mt-3 mb-0">El QR rota automaticamente para reducir capturas remotas.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalAttendees" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-xl modal-dialog-scrollable">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <div>
                                        <h5 class="fw-bold mb-0" id="attendees-event-title">Asistentes</h5>
                                        <small class="text-muted" id="attendees-count"></small>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="AdminForo.exportAttendees(document.getElementById('attendees-event-title').dataset.eventId)">CSV</button>
                                        <button class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                </div>
                                <div class="modal-body pt-0" id="attendees-list"></div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalScanner" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content rounded-4 border-0 overflow-hidden">
                                <div class="modal-header bg-dark text-white border-0">
                                    <h5 class="fw-bold mb-0"><i class="bi bi-qr-code-scan me-2"></i>Escanear asistencia</h5>
                                    <button type="button" class="btn-close btn-close-white" onclick="AdminForo.stopScanner()"></button>
                                </div>
                                <div class="modal-body p-0 bg-black">
                                    <div id="reader" style="width:100%; min-height:320px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalForoReject" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <h5 class="fw-bold mb-0">Rechazar evento</h5>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <form id="form-foro-reject" onsubmit="AdminForo.handleRejectSubmit(event)">
                                        <input type="hidden" id="reject-evt-id">
                                        <label class="form-label small fw-bold">Motivo</label>
                                        <textarea id="reject-reason" class="form-control" rows="3" required maxlength="500"></textarea>
                                        <div class="d-flex justify-content-end mt-3">
                                            <button class="btn btn-light rounded-pill me-2" type="button" data-bs-dismiss="modal">Cancelar</button>
                                            <button class="btn btn-danger rounded-pill" type="submit">Rechazar</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalForoCancelConfirm" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <div>
                                        <h5 class="fw-bold mb-0">Cancelar evento</h5>
                                        <p class="small text-muted mb-0">Esta accion retira el evento de la cartelera y actualiza la agenda de los inscritos.</p>
                                    </div>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body pt-0">
                                    <input type="hidden" id="cancel-evt-id">
                                    <p class="mb-0" id="cancel-evt-copy"></p>
                                </div>
                                <div class="modal-footer border-0">
                                    <button class="btn btn-light rounded-pill" type="button" data-bs-dismiss="modal">Volver</button>
                                    <button class="btn btn-danger rounded-pill" type="button" onclick="AdminForo.confirmCancelEvent()">
                                        <i class="bi bi-slash-circle me-1"></i>Cancelar evento
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalForoDetails" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <h5 class="fw-bold mb-0">Detalle del evento</h5>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body pt-0" id="evento-detail-body"></div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modalForoMessages" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-xl modal-dialog-centered">
                            <div class="modal-content rounded-4 border-0 shadow">
                                <div class="modal-header border-0">
                                    <div>
                                        <h5 class="fw-bold mb-0">Mensajes del evento</h5>
                                        <p class="small text-muted mb-0" id="messages-event-caption"></p>
                                    </div>
                                    <button class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body pt-0">
                                    <div class="row g-3">
                                        <div class="col-lg-4">
                                            <div id="foro-msg-conversations" class="foro-msg-list"></div>
                                        </div>
                                        <div class="col-lg-8">
                                            <div id="foro-msg-thread" class="foro-chat-thread"></div>
                                            <div class="input-group mt-3">
                                                <input id="foro-msg-input" class="form-control" placeholder="Responder al alumno">
                                                <button class="btn btn-primary" onclick="AdminForo.sendConversationReply()">Enviar</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            async function refreshDifusionData() {
                const [queue, history] = await Promise.all([
                    window.ForoService.getPendingEvents(state.ctx, { limit: 60 }),
                    window.ForoService.getHistoryEvents(state.ctx, { limit: 80 })
                ]);

                state.difusionQueue = queue;
                state.difusionHistory = history;
                renderDifusionQueue();
                renderDifusionHistory();
            }

            function renderDifusionQueue() {
                const list = document.getElementById('difusion-queue-list');
                if (!list) return;
                const esc = shared.escapeHtml;

                document.getElementById('badge-queue-count').textContent = String(state.difusionQueue.length);
                if (!state.difusionQueue.length) {
                    list.innerHTML = `
                        <div class="foro-empty-state py-5">
                            <i class="bi bi-inbox"></i>
                            <h6 class="fw-bold">No hay eventos en revision.</h6>
                            <p class="small text-muted mb-0">La cola editorial esta limpia por ahora.</p>
                        </div>
                    `;
                    return;
                }

                list.innerHTML = state.difusionQueue.map((event) => {
                    const typeCfg = shared.getTypeCfg(event.type);
                    return `
                        <article class="foro-review-card">
                            <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <div>
                                    <span class="badge bg-${typeCfg.color}">${esc(typeCfg.label)}</span>
                                    <h6 class="fw-bold mt-2 mb-1">${esc(event.title)}</h6>
                                    <div class="small text-muted">${esc(event.createdByName || 'Sin responsable')}</div>
                                </div>
                                <div class="small text-muted text-end">${esc(shared.formatDate(event.date))}</div>
                            </div>
                            <div class="small text-muted mb-3">
                                <div><i class="bi bi-person-vcard me-1"></i>${esc(event.speaker || 'Por confirmar')}</div>
                                <div><i class="bi bi-geo-alt me-1"></i>${esc(event.location || 'Sin sede')}</div>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                <button class="btn btn-success rounded-pill" onclick="AdminForo.handleApprove('${event.id}')">
                                    <i class="bi bi-check2-circle me-1"></i>Aprobar
                                </button>
                                <button class="btn btn-outline-danger rounded-pill" onclick="AdminForo.openRejectModal('${event.id}')">
                                    <i class="bi bi-x-circle me-1"></i>Rechazar
                                </button>
                                <button class="btn btn-light rounded-pill" onclick="AdminForo.openEventDetailsModal('${event.id}')">
                                    <i class="bi bi-eye me-1"></i>Detalle
                                </button>
                            </div>
                        </article>
                    `;
                }).join('');
            }

            function renderDifusionHistory() {
                const body = document.getElementById('difusion-history-body');
                if (!body) return;
                const esc = shared.escapeHtml;

                document.getElementById('badge-history-count').textContent = String(state.difusionHistory.length);
                if (!state.difusionHistory.length) {
                    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-5">Sin movimientos recientes.</td></tr>`;
                    return;
                }

                body.innerHTML = state.difusionHistory.map((event) => {
                    const status = shared.getStatusCfg(event.status);
                    return `
                        <tr>
                            <td>
                                <div class="fw-bold">${esc(event.title)}</div>
                                <div class="small text-muted">${esc(event.location || 'Sin sede')}</div>
                            </td>
                            <td class="small">${esc(event.createdByName || 'Sin responsable')}</td>
                            <td><span class="badge bg-${status.color}">${esc(status.label)}</span></td>
                            <td class="small">${esc(shared.formatDate(event.date))}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-light rounded-pill" onclick="AdminForo.openEventDetailsModal('${event.id}')">
                                    <i class="bi bi-eye me-1"></i>Detalle
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            async function initDivisionHeadView() {
                state.adminEvents = await window.ForoService.getMyEvents(state.ctx, { limit: 120 });
                renderDivisionEventsTable();
            }

            function renderDivisionEventsTable() {
                const body = document.getElementById('foro-admin-events-body');
                if (!body) return;
                const esc = shared.escapeHtml;

                if (!state.adminEvents.length) {
                    body.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-5 text-muted">
                                Aun no has creado eventos.
                            </td>
                        </tr>
                    `;
                    return;
                }

                body.innerHTML = state.adminEvents.map((event) => {
                    const status = shared.getStatusCfg(event.status);
                    const hasResources = event.hasResources === true;
                    const isPublished = event.status === 'active';
                    return `
                        <tr>
                            <td>
                                <div class="fw-bold">${esc(event.title)}</div>
                                <div class="small text-muted">${esc(event.location || 'Sin sede')} | ${esc(event.speaker || 'Sin ponente')}</div>
                            </td>
                            <td><span class="badge bg-${status.color}">${esc(status.label)}</span></td>
                            <td class="small">
                                <div>${esc(shared.formatDate(event.date))}</div>
                                <div>${esc(shared.formatTimeRange(event))}</div>
                            </td>
                            <td class="small">
                                ${hasResources ? `<span class="badge bg-success-subtle text-success">${event.resourcesCount || 0} recurso(s)</span>` : `<span class="text-muted">Sin recursos</span>`}
                            </td>
                            <td class="text-end">
                                <div class="d-flex gap-2 justify-content-end flex-wrap">
                                    <button class="btn btn-sm btn-light rounded-pill" onclick="AdminForo.openEventDetailsModal('${event.id}')">
                                        <i class="bi bi-eye me-1"></i>Detalle
                                    </button>
                                    <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="AdminForo.openEventModal('${event.id}')">
                                        <i class="bi bi-pencil-square me-1"></i>Editar
                                    </button>
                                    <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="AdminForo.viewEventAttendees('${event.id}')">
                                        <i class="bi bi-people me-1"></i>Asistentes
                                    </button>
                                    ${event.contactEnabled ? `
                                        <button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="AdminForo.openEventMessages('${event.id}')">
                                            <i class="bi bi-chat-dots me-1"></i>Mensajes
                                        </button>
                                    ` : ''}
                                    ${isPublished && event.allowSelfCheckIn !== false ? `
                                        <button class="btn btn-sm btn-primary rounded-pill" onclick="AdminForo.publishEventQR('${event.id}')">
                                            <i class="bi bi-qr-code me-1"></i>QR asistencia
                                        </button>
                                    ` : ''}
                                    ${isPublished && hasResources && event.resourcesQrEnabled !== false ? `
                                        <button class="btn btn-sm btn-outline-success rounded-pill" onclick="AdminForo.publishResourcesQR('${event.id}')">
                                            <i class="bi bi-qr-code me-1"></i>QR recursos
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="AdminForo.deleteEvent('${event.id}','${shared.escapeInlineText(event.title)}')">
                                        <i class="bi bi-slash-circle me-1"></i>Cancelar
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            function crearEvento() {
                openEventModal();
            }

            async function openEventModal(eventId = '') {
                resetEventForm();
                const modal = new bootstrap.Modal(document.getElementById('modalForoEvent'));
                if (eventId) {
                    document.getElementById('modalForoEventTitle').textContent = 'Editar evento';
                    const event = await getEventWithResources(eventId);
                    fillEventForm(event);
                } else {
                    document.getElementById('modalForoEventTitle').textContent = 'Nuevo evento';
                    addResourceRow();
                }
                modal.show();
            }

            function resetEventForm() {
                document.getElementById('form-foro-event')?.reset();
                setValue('foro-evt-id', '');
                setValue('foro-evt-cover-url', '');
                setChecked('foro-evt-contact', true);
                setChecked('foro-evt-self-checkin', true);
                setChecked('foro-evt-res-qr', true);
                const list = document.getElementById('foro-resource-list');
                if (list) list.innerHTML = '';
                previewCover('');
            }

            async function getEventWithResources(eventId) {
                const event = getKnownEvent(eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                try {
                    const resourceBundle = await window.ForoService.getEventResources(state.ctx, { eventId });
                    return {
                        ...event,
                        resources: Array.isArray(resourceBundle?.items) ? resourceBundle.items : [],
                        resourcesQrEnabled: resourceBundle?.qrEnabled === true
                    };
                } catch (error) {
                    return {
                        ...event,
                        resources: [],
                        resourcesQrEnabled: false
                    };
                }
            }

            function getKnownEvent(eventId) {
                return [
                    ...state.adminEvents,
                    ...state.difusionQueue,
                    ...state.difusionHistory
                ].find((event) => event.id === eventId) || null;
            }

            function fillEventForm(event) {
                setValue('foro-evt-id', event.id || '');
                setValue('foro-evt-title', event.title || '');
                setValue('foro-evt-type', event.type || 'otro');
                setValue('foro-evt-date', formatDateTimeLocal(event.date));
                setValue('foro-evt-end-date', formatDateTimeLocal(event.endDate));
                setValue('foro-evt-speaker', event.speaker || '');
                setValue('foro-evt-location', event.location || '');
                setValue('foro-evt-room', event.room || '');
                setValue('foro-evt-capacity', event.capacity || 100);
                setValue('foro-evt-open-window', event.attendanceOpensMinutesBefore || 30);
                setValue('foro-evt-close-window', event.attendanceClosesMinutesAfter || 120);
                setValue('foro-evt-map', event.mapUrl || '');
                setValue('foro-evt-desc', event.description || '');
                setValue('foro-evt-day', event.dayInstructions || '');
                setValue('foro-evt-cover-url', event.coverImage || '');
                setChecked('foro-evt-contact', event.contactEnabled !== false);
                setChecked('foro-evt-self-checkin', event.allowSelfCheckIn !== false);
                setChecked('foro-evt-res-qr', event.resourcesQrEnabled !== false);
                selectAudience(event.targetAudience);
                previewCover(event.coverImage || '');

                const list = document.getElementById('foro-resource-list');
                if (list) list.innerHTML = '';
                if (Array.isArray(event.resources) && event.resources.length) {
                    event.resources.forEach((item) => addResourceRow(item));
                } else {
                    addResourceRow();
                }
            }

            function formatDateTimeLocal(value) {
                const date = shared.toDate(value);
                if (!date) return '';
                const pad = (num) => String(num).padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            }

            function setValue(id, value) {
                const field = document.getElementById(id);
                if (field) field.value = value ?? '';
            }

            function setChecked(id, value) {
                const field = document.getElementById(id);
                if (field) field.checked = !!value;
            }

            function selectAudience(values) {
                const selected = Array.isArray(values) && values.length ? values : ['ALL'];
                const select = document.getElementById('foro-evt-audience');
                if (!select) return;
                Array.from(select.options).forEach((option) => {
                    option.selected = selected.includes(option.value);
                });
            }

            async function handleEventSubmit(event) {
                event.preventDefault();

                const button = document.getElementById('foro-submit-btn');
                const backup = button.innerHTML;
                button.disabled = true;
                button.innerHTML = 'Guardando...';

                try {
                    const payload = await readFormPayload();
                    if (payload.eventId) {
                        await window.ForoService.updateEvent(state.ctx, payload.eventId, payload);
                        shared.showToast('Evento actualizado.', 'success');
                    } else {
                        await window.ForoService.createEvent(state.ctx, payload);
                        shared.showToast(state.roles.isDifusion ? 'Evento creado y publicado.' : 'Evento enviado a revision.', 'success');
                    }

                    bootstrap.Modal.getInstance(document.getElementById('modalForoEvent'))?.hide();
                    if (state.roles.isDifusion) await refreshDifusionData();
                    else await initDivisionHeadView();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible guardar el evento.', 'danger');
                } finally {
                    button.disabled = false;
                    button.innerHTML = backup;
                }
            }

            async function readFormPayload() {
                const uid = shared.getUserUid(state.ctx, state.profile);
                if (!uid) throw new Error('No fue posible identificar al organizador.');

                const coverInput = document.getElementById('foro-evt-cover');
                let coverImage = document.getElementById('foro-evt-cover-url').value.trim();
                if (coverInput?.files?.[0]) {
                    coverImage = await window.ForoService.uploadCoverImage(state.ctx, coverInput.files[0], uid);
                }

                const resources = await readResourceRows(uid);
                const audience = Array.from(document.getElementById('foro-evt-audience')?.selectedOptions || []).map((option) => option.value);

                return {
                    eventId: document.getElementById('foro-evt-id').value.trim(),
                    title: document.getElementById('foro-evt-title').value.trim(),
                    type: document.getElementById('foro-evt-type').value,
                    date: document.getElementById('foro-evt-date').value,
                    endDate: document.getElementById('foro-evt-end-date').value,
                    speaker: document.getElementById('foro-evt-speaker').value.trim(),
                    location: document.getElementById('foro-evt-location').value.trim(),
                    room: document.getElementById('foro-evt-room').value.trim(),
                    capacity: Number(document.getElementById('foro-evt-capacity').value || 100),
                    attendanceOpensMinutesBefore: Number(document.getElementById('foro-evt-open-window').value || 30),
                    attendanceClosesMinutesAfter: Number(document.getElementById('foro-evt-close-window').value || 120),
                    mapUrl: document.getElementById('foro-evt-map').value.trim(),
                    coverImage,
                    targetAudience: audience,
                    description: document.getElementById('foro-evt-desc').value.trim(),
                    dayInstructions: document.getElementById('foro-evt-day').value.trim(),
                    contactEnabled: document.getElementById('foro-evt-contact').checked,
                    allowSelfCheckIn: document.getElementById('foro-evt-self-checkin').checked,
                    resourcesQrEnabled: document.getElementById('foro-evt-res-qr').checked,
                    resources
                };
            }

            async function readResourceRows(uid) {
                const rows = Array.from(document.querySelectorAll('#foro-resource-list .foro-resource-row'));
                const resources = [];

                for (const row of rows) {
                    const type = row.querySelector('.foro-resource-type')?.value || 'link';
                    const titleInput = row.querySelector('.foro-resource-title')?.value.trim() || '';
                    const description = row.querySelector('.foro-resource-desc')?.value.trim() || '';
                    const linkValue = row.querySelector('.foro-resource-url')?.value.trim() || '';
                    const fileInput = row.querySelector('.foro-resource-file');
                    const existingUrl = row.dataset.existingUrl || '';
                    const existingFileName = row.dataset.existingFileName || '';
                    const existingMime = row.dataset.existingMimeType || '';
                    let url = '';
                    let fileName = existingFileName;
                    let mimeType = existingMime;

                    if (type === 'file') {
                        if (fileInput?.files?.[0]) {
                            const uploaded = await window.ForoService.uploadEventMaterial(state.ctx, fileInput.files[0], uid);
                            url = uploaded.url;
                            fileName = uploaded.fileName;
                            mimeType = uploaded.mimeType;
                        } else {
                            url = existingUrl;
                        }
                    } else {
                        url = linkValue || existingUrl;
                        fileName = '';
                        mimeType = '';
                    }

                    if (!url) continue;
                    resources.push({
                        id: row.dataset.rowId || `res_${Date.now()}`,
                        type,
                        title: titleInput || fileName || 'Recurso',
                        description,
                        url,
                        fileName,
                        mimeType
                    });
                }

                return resources;
            }

            function previewCover(inputOrUrl) {
                const wrapper = document.getElementById('cover-preview');
                const image = document.getElementById('cover-preview-img');
                if (!wrapper || !image) return;

                if (typeof inputOrUrl === 'string') {
                    if (!inputOrUrl) {
                        wrapper.classList.add('d-none');
                        image.removeAttribute('src');
                        return;
                    }
                    image.src = inputOrUrl;
                    wrapper.classList.remove('d-none');
                    return;
                }

                const file = inputOrUrl?.files?.[0];
                if (!file) {
                    const existingUrl = document.getElementById('foro-evt-cover-url')?.value || '';
                    if (!existingUrl) {
                        wrapper.classList.add('d-none');
                        image.removeAttribute('src');
                        return;
                    }
                    image.src = existingUrl;
                    wrapper.classList.remove('d-none');
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    image.src = reader.result;
                    wrapper.classList.remove('d-none');
                };
                reader.readAsDataURL(file);
            }

            function addResourceRow(resource = {}) {
                const list = document.getElementById('foro-resource-list');
                if (!list) return;

                const rowId = resource.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const kind = resource.type === 'file' ? 'file' : 'link';
                list.insertAdjacentHTML('beforeend', `
                    <div class="foro-resource-row card border-0 shadow-sm" data-row-id="${rowId}" data-kind="${kind}" data-existing-url="${shared.escapeAttr(resource.url || '')}" data-existing-file-name="${shared.escapeAttr(resource.fileName || '')}" data-existing-mime-type="${shared.escapeAttr(resource.mimeType || '')}">
                        <div class="card-body">
                            <div class="row g-2 align-items-start">
                                <div class="col-md-2">
                                    <label class="form-label small fw-bold">Tipo</label>
                                    <select class="form-select foro-resource-type" onchange="this.closest('.foro-resource-row').dataset.kind=this.value">
                                        <option value="link" ${kind === 'link' ? 'selected' : ''}>Enlace</option>
                                        <option value="file" ${kind === 'file' ? 'selected' : ''}>Archivo</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold">Titulo</label>
                                    <input class="form-control foro-resource-title" value="${shared.escapeAttr(resource.title || '')}" maxlength="120">
                                </div>
                                <div class="col-md-4 foro-resource-url-wrap">
                                    <label class="form-label small fw-bold">URL</label>
                                    <input class="form-control foro-resource-url" placeholder="https://..." value="${shared.escapeAttr(resource.type === 'link' ? (resource.url || '') : '')}">
                                </div>
                                <div class="col-md-4 foro-resource-file-wrap">
                                    <label class="form-label small fw-bold">Archivo</label>
                                    <input type="file" class="form-control foro-resource-file">
                                    ${resource.type === 'file' && resource.url ? `<div class="form-text">Actual: ${shared.escapeHtml(resource.fileName || 'archivo')}</div>` : ''}
                                </div>
                                <div class="col-md-10">
                                    <label class="form-label small fw-bold">Descripcion</label>
                                    <input class="form-control foro-resource-desc" maxlength="280" value="${shared.escapeAttr(resource.description || '')}">
                                </div>
                                <div class="col-md-2 d-flex align-items-end">
                                    <button class="btn btn-outline-danger rounded-pill w-100" type="button" onclick="AdminForo.removeResourceRow('${rowId}')">
                                        <i class="bi bi-trash3 me-1"></i>Quitar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
            }

            function removeResourceRow(rowId) {
                document.querySelector(`#foro-resource-list [data-row-id="${rowId}"]`)?.remove();
                const list = document.getElementById('foro-resource-list');
                if (list && !list.children.length) addResourceRow();
            }

            function deleteEvent(eventId, title) {
                setValue('cancel-evt-id', eventId);
                const copy = document.getElementById('cancel-evt-copy');
                if (copy) copy.innerHTML = `Se cancelara el evento <strong>${shared.escapeHtml(title || 'seleccionado')}</strong>.`;
                new bootstrap.Modal(document.getElementById('modalForoCancelConfirm')).show();
            }

            async function confirmCancelEvent() {
                const eventId = document.getElementById('cancel-evt-id')?.value || '';
                if (!eventId) return;
                try {
                    await window.ForoService.deleteEvent(state.ctx, eventId);
                    bootstrap.Modal.getInstance(document.getElementById('modalForoCancelConfirm'))?.hide();
                    shared.showToast('Evento cancelado.', 'success');
                    if (state.roles.isDifusion) await refreshDifusionData();
                    else await initDivisionHeadView();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible cancelar el evento.', 'danger');
                }
            }

            async function publishQr(eventId, kind) {
                const modalElement = document.getElementById('modalPublishQR');
                const modal = new bootstrap.Modal(modalElement);
                const title = document.getElementById('publish-qr-title');
                const subtitle = document.getElementById('publish-qr-subtitle');
                const container = document.getElementById('publish-qrcode-container');

                const event = getKnownEvent(eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                cleanupQrTimer();

                const renderPayload = async () => {
                    const payload = await window.ForoService.getEventQrPayload(state.ctx, eventId, kind);
                    title.textContent = kind === 'resources' ? 'QR de recursos' : 'QR de asistencia';
                    subtitle.textContent = `${event.title || 'Evento'} | expira ${new Date(payload.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
                    container.innerHTML = '';
                    new QRCode(container, {
                        text: payload.qrData,
                        width: 260,
                        height: 260,
                        correctLevel: QRCode.CorrectLevel.H
                    });
                };

                await renderPayload();
                state.qrTimer = setInterval(() => {
                    renderPayload().catch((error) => {
                        cleanupQrTimer();
                        shared.showToast(error.message || 'No se pudo refrescar el QR.', 'warning');
                    });
                }, 50000);

                modal.show();
            }

            async function publishEventQR(eventId) {
                try {
                    await publishQr(eventId, 'attendance');
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible abrir el QR.', 'warning');
                }
            }

            async function publishResourcesQR(eventId) {
                try {
                    await publishQr(eventId, 'resources');
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible abrir el QR de recursos.', 'warning');
                }
            }

            function getAttendeeStatusMeta(ticket) {
                if (ticket.status === 'attended') {
                    return {
                        label: 'Asistio',
                        badgeClass: 'bg-success',
                        date: ticket.attendedAt || ticket.registeredAt || ticket.eventDate
                    };
                }

                if (ticket.status === 'cancelled') {
                    return {
                        label: 'Cancelado',
                        badgeClass: 'bg-danger-subtle text-danger',
                        date: ticket.cancelledAt || ticket.updatedAt || ticket.registeredAt || ticket.eventDate
                    };
                }

                return {
                    label: 'Inscrito',
                    badgeClass: 'bg-secondary',
                    date: ticket.registeredAt || ticket.eventDate
                };
            }

            async function viewEventAttendees(eventId) {
                try {
                    const attendees = await window.ForoService.getEventAttendees(state.ctx, eventId);
                    const event = getKnownEvent(eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                    const esc = shared.escapeHtml;
                    const registeredCount = attendees.filter((ticket) => ticket.status === 'registered').length;
                    const attendedCount = attendees.filter((ticket) => ticket.status === 'attended').length;
                    const cancelledCount = attendees.filter((ticket) => ticket.status === 'cancelled').length;
                    const container = document.getElementById('attendees-list');
                    const title = document.getElementById('attendees-event-title');
                    title.textContent = event.title || 'Asistentes';
                    title.dataset.eventId = eventId;
                    document.getElementById('attendees-count').textContent = `${registeredCount} inscrito(s) | ${attendedCount} asistencia(s)${cancelledCount ? ` | ${cancelledCount} cancelado(s)` : ''}`;

                    if (!attendees.length) {
                        container.innerHTML = `<div class="foro-empty-state py-5"><i class="bi bi-people"></i><h6 class="fw-bold">Aun no hay inscritos.</h6></div>`;
                    } else {
                        container.innerHTML = attendees.map((ticket) => {
                            const statusMeta = getAttendeeStatusMeta(ticket);
                            return `
                                <div class="foro-attendee-item">
                                    <div>
                                        <div class="fw-bold">${esc(ticket.userName || 'Alumno')}</div>
                                        <div class="small text-muted">${esc(ticket.userMatricula || 'Sin matricula')} | ${esc(ticket.userCareer || 'Sin carrera')}</div>
                                    </div>
                                    <div class="text-end">
                                        <span class="badge ${statusMeta.badgeClass}">${statusMeta.label}</span>
                                        <div class="small text-muted mt-1">${esc(shared.formatDate(statusMeta.date))}</div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }

                    new bootstrap.Modal(document.getElementById('modalAttendees')).show();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible cargar asistentes.', 'danger');
                }
            }

            async function exportAttendees(eventId) {
                try {
                    const attendees = await window.ForoService.getEventAttendees(state.ctx, eventId);
                    const event = getKnownEvent(eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                    const rows = [
                        ['Nombre', 'Matricula', 'Carrera', 'Estado', 'Registrado', 'Asistio', 'Cancelado']
                    ];

                    attendees.forEach((ticket) => {
                        const statusMeta = getAttendeeStatusMeta(ticket);
                        rows.push([
                            csvValue(ticket.userName),
                            csvValue(ticket.userMatricula),
                            csvValue(ticket.userCareer),
                            csvValue(statusMeta.label),
                            csvValue(shared.formatDate(ticket.registeredAt || ticket.eventDate)),
                            csvValue(shared.formatDate(ticket.attendedAt)),
                            csvValue(shared.formatDate(ticket.cancelledAt))
                        ]);
                    });

                    downloadBlob(`evento_${slugify(event.title || 'asistentes')}.csv`, rows.map((row) => row.join(',')).join('\n'), 'text/csv;charset=utf-8');
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible exportar asistentes.', 'danger');
                }
            }

            function csvValue(value) {
                const safe = String(value || '').replace(/"/g, '""');
                return `"${safe}"`;
            }

            function slugify(text) {
                return String(text || 'archivo')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '') || 'archivo';
            }

            function downloadBlob(fileName, content, type) {
                const blob = new Blob([content], { type });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(url);
            }

            function openScanner() {
                if (!window.Html5QrcodeScanner) {
                    shared.showToast('El lector QR aun se esta cargando.', 'warning');
                    return;
                }

                const modal = new bootstrap.Modal(document.getElementById('modalScanner'));
                modal.show();
                setTimeout(() => {
                    state.scanner = new Html5QrcodeScanner('reader', {
                        fps: 10,
                        qrbox: { width: 240, height: 240 }
                    }, false);

                    state.scanner.render(async (decodedText) => {
                        try {
                            const result = await window.ForoService.markAttendance(state.ctx, decodedText);
                            shared.showToast(`Asistencia registrada para ${result.userName || 'el alumno'}.`, 'success');
                        } catch (error) {
                            shared.showToast(error.message || 'No fue posible registrar la asistencia.', 'danger');
                        } finally {
                            stopScanner();
                        }
                    }, () => { });
                }, 150);
            }

            function stopScanner() {
                if (state.scanner?.clear) {
                    state.scanner.clear().catch(() => null);
                }
                state.scanner = null;
                bootstrap.Modal.getInstance(document.getElementById('modalScanner'))?.hide();
            }

            async function handleApprove(eventId) {
                try {
                    await window.ForoService.approveEvent(state.ctx, eventId);
                    shared.showToast('Evento aprobado y publicado.', 'success');
                    await refreshDifusionData();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible aprobar el evento.', 'danger');
                }
            }

            function openRejectModal(eventId) {
                setValue('reject-evt-id', eventId);
                setValue('reject-reason', '');
                new bootstrap.Modal(document.getElementById('modalForoReject')).show();
            }

            async function handleRejectSubmit(event) {
                event.preventDefault();
                const eventId = document.getElementById('reject-evt-id').value;
                const reason = document.getElementById('reject-reason').value.trim();
                if (!reason) return;

                try {
                    await window.ForoService.rejectEvent(state.ctx, eventId, reason);
                    bootstrap.Modal.getInstance(document.getElementById('modalForoReject'))?.hide();
                    shared.showToast('Evento rechazado.', 'success');
                    await refreshDifusionData();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible rechazar el evento.', 'danger');
                }
            }

            async function openEventDetailsModal(eventId) {
                try {
                    const event = await getEventWithResources(eventId);
                    const body = document.getElementById('evento-detail-body');
                    const esc = shared.escapeHtml;
                    const typeCfg = shared.getTypeCfg(event.type);
                    const status = shared.getStatusCfg(event.status);

                    body.innerHTML = `
                        <div class="foro-detail-grid">
                            <div class="foro-detail-main">
                                ${event.coverImage ? `<img src="${shared.escapeAttr(event.coverImage)}" class="foro-detail-cover mb-3" alt="${esc(event.title)}">` : ''}
                                <div class="d-flex gap-2 flex-wrap mb-3">
                                    <span class="badge bg-${typeCfg.color}">${esc(typeCfg.label)}</span>
                                    <span class="badge bg-${status.color}">${esc(status.label)}</span>
                                </div>
                                <h4 class="fw-bold mb-2">${esc(event.title)}</h4>
                                <p class="text-muted">${esc(event.description || 'Sin descripcion capturada.')}</p>
                                ${event.dayInstructions ? `<div class="foro-side-card mt-3">${esc(event.dayInstructions)}</div>` : ''}
                                ${Array.isArray(event.resources) && event.resources.length ? `
                                    <div class="mt-4">
                                        <div class="small text-uppercase fw-bold text-muted mb-2">Recursos</div>
                                        <div class="d-flex flex-column gap-2">
                                            ${event.resources.map((item) => `
                                                <a class="foro-resource-card" href="${shared.escapeAttr(item.url)}" target="_blank" rel="noopener">
                                                    <div>
                                                        <strong>${esc(item.title || 'Recurso')}</strong>
                                                        ${item.description ? `<div class="small text-muted mt-1">${esc(item.description)}</div>` : ''}
                                                    </div>
                                                    <span class="badge bg-light text-dark">${esc(item.type === 'file' ? 'Archivo' : 'Enlace')}</span>
                                                </a>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <aside class="foro-detail-side">
                                <div class="foro-side-card">
                                    <div><i class="bi bi-person-vcard"></i>${esc(event.speaker || 'Por confirmar')}</div>
                                    <div><i class="bi bi-geo-alt"></i>${esc(event.location || 'Sin sede')}</div>
                                    <div><i class="bi bi-door-open"></i>${esc(event.room || 'Sin puerta')}</div>
                                    <div><i class="bi bi-clock"></i>${esc(shared.formatTimeRange(event))}</div>
                                    <div><i class="bi bi-people"></i>${esc(`${event.registeredCount || 0} / ${event.capacity || 0}`)}</div>
                                    <div><i class="bi bi-mortarboard"></i>${esc(shared.formatAudience(event.targetAudience))}</div>
                                    ${event.mapUrl ? `<a class="btn btn-sm btn-light rounded-pill mt-2" href="${shared.escapeAttr(event.mapUrl)}" target="_blank" rel="noopener"><i class="bi bi-map me-1"></i>Ver mapa</a>` : ''}
                                </div>
                                ${event.rejectionReason ? `<div class="foro-side-card border-danger-subtle bg-danger-subtle small text-danger">${esc(event.rejectionReason)}</div>` : ''}
                            </aside>
                        </div>
                    `;

                    new bootstrap.Modal(document.getElementById('modalForoDetails')).show();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible abrir el detalle.', 'danger');
                }
            }

            async function openEventMessages(eventId) {
                try {
                    const organizerId = shared.getUserUid(state.ctx, state.profile);
                    const event = getKnownEvent(eventId) || await window.ForoService.getEventById(state.ctx, eventId);
                    state.selectedEventId = eventId;
                    state.activeConversation = null;
                    document.getElementById('messages-event-caption').textContent = event.title || 'Evento';
                    document.getElementById('foro-msg-thread').innerHTML = `<div class="text-muted small text-center py-5">Selecciona una conversacion para responder.</div>`;

                    if (state.conversationsUnsub) state.conversationsUnsub();
                    if (state.messageUnsub) state.messageUnsub();
                    state.conversationsUnsub = window.ForoChatService.streamEventConversations(state.ctx, organizerId, eventId, (conversations) => {
                        state.eventConversations = conversations;
                        renderConversationList();
                    });

                    new bootstrap.Modal(document.getElementById('modalForoMessages')).show();
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible abrir los mensajes.', 'danger');
                }
            }

            function renderConversationList() {
                const container = document.getElementById('foro-msg-conversations');
                if (!container) return;
                const esc = shared.escapeHtml;
                if (!state.eventConversations.length) {
                    container.innerHTML = `<div class="foro-empty-state py-5"><i class="bi bi-chat-dots"></i><h6 class="fw-bold">Todavia no hay mensajes.</h6></div>`;
                    return;
                }

                container.innerHTML = state.eventConversations.map((conversation) => `
                    <button class="foro-msg-item ${state.activeConversation?.id === conversation.id ? 'is-active' : ''}" onclick="AdminForo.selectConversation('${conversation.id}')">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div class="text-start">
                                <div class="fw-bold">${esc(conversation.studentName || 'Alumno')}</div>
                                <div class="small text-muted">${esc(conversation.lastMessage || 'Sin mensajes aun')}</div>
                            </div>
                            ${conversation.unreadByOrganizer ? `<span class="badge rounded-pill bg-primary">${conversation.unreadByOrganizer}</span>` : ''}
                        </div>
                    </button>
                `).join('');

                if (!state.activeConversation && state.eventConversations[0]) {
                    void selectConversation(state.eventConversations[0].id);
                }
            }

            async function selectConversation(conversationId) {
                const conversation = state.eventConversations.find((item) => item.id === conversationId);
                if (!conversation) return;
                state.activeConversation = conversation;
                renderConversationList();

                if (state.messageUnsub) state.messageUnsub();
                state.messageUnsub = window.ForoChatService.streamMessages(state.ctx, conversationId, renderConversationThread);
                await window.ForoChatService.markAsRead(state.ctx, conversationId, 'organizer').catch(() => null);
            }

            function renderConversationThread(messages) {
                const container = document.getElementById('foro-msg-thread');
                if (!container) return;
                const esc = shared.escapeHtml;

                container.innerHTML = !messages.length
                    ? `<div class="text-muted small text-center py-5">Todavia no hay mensajes.</div>`
                    : messages.map((message) => `
                        <div class="foro-chat-bubble ${message.senderId === shared.getUserUid(state.ctx, state.profile) ? 'is-me' : ''}">
                            <div class="small">${esc(message.text || '')}</div>
                            <div class="extra-small opacity-75 mt-1">${esc(message.senderName || '')}</div>
                        </div>
                    `).join('');
                container.scrollTop = container.scrollHeight;
            }

            async function sendConversationReply() {
                const input = document.getElementById('foro-msg-input');
                const text = input?.value.trim() || '';
                if (!text || !state.activeConversation) return;

                input.value = '';
                try {
                    await window.ForoChatService.sendMessage(state.ctx, state.activeConversation.id, state.profile, 'organizer', text);
                } catch (error) {
                    shared.showToast(error.message || 'No fue posible enviar el mensaje.', 'danger');
                }
            }
        }

        return { create };
    })();
}
