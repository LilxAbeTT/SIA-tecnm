// public/modules/admin.foro.js
// Módulo FORO v6.0 — Eventos Académicos (Administrador & Jefaturas)
console.log("✅ [LOAD] modules/admin.foro.js loaded");

if (!window.AdminForo) {
    window.AdminForo = (function () {
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
        // INIT (ADMIN)
        // ==========================================
        async function init(ctx) {
            console.log("[AdminForo] Init started", ctx);
            _ctx = ctx;
            _profile = ctx.profile;

            if (!_profile) return;
            const container = document.getElementById('view-foro');
            if (!container) return;

            // Roles Logic
            _isDifusion = _profile.email === 'difusion@loscabos.tecnm.mx' || _profile.permissions?.foro === 'superadmin';
            _isAdmin = _profile.permissions?.foro === 'admin' || _isDifusion;
            _isDivisionHead = _isAdmin && !_isDifusion;

            if (_isDifusion) {
                renderDifusionStructure(container);
                initDifusionView();
            } else if (_isDivisionHead) {
                renderDivisionHeadStructure(container);
                initDivisionHeadView();
            } else {
                container.innerHTML = '<div class="alert alert-danger m-4">No tienes permisos de administrador.</div>';
            }
        }
        // ==========================================
        // DIFUSIÓN (VALIDADOR) — ESTRUCTURA & LOGICA
        // ==========================================
        function renderDifusionStructure(container) {
            container.innerHTML = `
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3 animate__animated animate__fadeIn">
                    <div>
                        <h2 class="h4 fw-bold text-dark mb-1"><i class="bi bi-shield-check me-2 text-primary"></i>Panel de Difusión</h2>
                        <p class="text-muted small mb-0">Validación de Eventos Académicos</p>
                    </div>
                    <div class="d-flex gap-2">
                        
                    </div>
                </div>

                <!-- TABS DIFUSIÓN -->
                <ul class="nav nav-pills nav-fill bg-light p-1 rounded-pill mb-4 shadow-sm" style="max-width: 500px;">
                    <li class="nav-item">
                        <a class="nav-link rounded-pill active fw-bold small" id="tab-dif-queue" data-bs-toggle="pill" href="#pane-dif-queue" onclick="Foro.refreshDifusionData()">
                            <i class="bi bi-hourglass-top me-2"></i>Por Revisar <span class="badge bg-danger rounded-pill ms-1" id="badge-queue-count">0</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link rounded-pill fw-bold small" id="tab-dif-hist" data-bs-toggle="pill" href="#pane-dif-hist">
                            <i class="bi bi-clock-history me-2"></i>Historial
                        </a>
                    </li>
                </ul>

                <div class="tab-content">
                    <!-- PANE: POR REVISAR -->
                    <div class="tab-pane fade show active" id="pane-dif-queue">
                        <div id="difusion-queue-list" class="row g-3">
                            <div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>
                        </div>
                    </div>

                    <!-- PANE: HISTORIAL -->
                    <div class="tab-pane fade" id="pane-dif-hist">
                        <div class="card border-0 shadow-sm rounded-4">
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0">
                                    <thead class="bg-light">
                                        <tr>
                                            <th class="ps-4">Evento</th>
                                            <th>Solicitante</th>
                                            <th>Estado</th>
                                            <th>Fecha</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="difusion-history-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                ${getAdminModals()} <!-- Shared modals + new rejection modal -->
            `;
        }

        async function initDifusionView() {
            refreshDifusionData();
        }

        async function refreshDifusionData() {
            try {
                // Queue
                _difusionQueue = await ForoService.getPendingEvents(_ctx);
                document.getElementById('badge-queue-count').innerText = _difusionQueue.length;
                renderDifusionQueue();

                // History
                _difusionHistory = await ForoService.getHistoryEvents(_ctx);
                renderDifusionHistory();
            } catch (e) {
                console.error(e);
                showToast("Error cargando datos de difusión", 'error');
            }
        }

        function renderDifusionQueue() {
            const container = document.getElementById('difusion-queue-list');
            if (!container) return;

            if (!_difusionQueue.length) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="bg-white rounded-4 border border-dashed p-5">
                            <i class="bi bi-check-circle fs-1 d-block mb-3 text-muted opacity-50"></i>
                            <h6 class="fw-bold text-muted mb-1">¡Todo al día!</h6>
                            <p class="text-muted small mb-0">No tienes solicitudes pendientes de revisión.</p>
                        </div>
                    </div>`;
                return;
            }

            container.innerHTML = _difusionQueue.map(evt => {
                const cfg = getTypeCfg(evt.type);
                const dt = formatShortDate(evt.date);
                return `
                <div class="col-12 col-xl-6">
                    <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                        <div class="row g-0 h-100">
                            <!-- Left Color Strip -->
                            <div class="col-1 bg-${cfg.color} d-flex align-items-center justify-content-center">
                                <i class="bi ${cfg.icon} text-white fs-4"></i>
                            </div>
                            
                            <!-- Body -->
                            <div class="col-11 p-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="badge text-dark border">
                                        <i class="bi bi-person-circle me-1"></i>Solicita: <strong>${evt.createdByName || 'Jefe División'}</strong>
                                    </span>
                                    <small class="text-muted">${formatDate(evt.createdAt || new Date())}</small>
                                </div>

                                <h5 class="fw-bold mb-1">${evt.title}</h5>
                                <p class="text-muted small mb-2"><i class="bi bi-geo-alt me-1"></i>${evt.location}</p>
                                <p class="small text-muted mb-3 line-clamp-2">${evt.description || 'Sin descripción'}</p>

                                <div class="d-flex gap-2">
                                    <button class="btn btn-success btn-sm rounded-pill px-3 fw-bold" onclick="Foro.handleApprove('${evt.id}')">
                                        <i class="bi bi-check-lg me-1"></i>Aprobar
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold" onclick="Foro.openRejectModal('${evt.id}')">
                                        <i class="bi bi-x-lg me-1"></i>Rechazar
                                    </button>
                                    <button class="btn btn-light btn-sm rounded-pill px-3" onclick="Foro.openEventDetailsModal('${evt.id}')">
                                        <i class="bi bi-eye me-1"></i>Ver más
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function renderDifusionHistory() {
            const body = document.getElementById('difusion-history-body');
            if (!body) return;

            body.innerHTML = _difusionHistory.map(evt => {
                const status = getStatusCfg(evt.status);
                return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${evt.title}</div>
                    </td>
                    <td class="small text-muted">${evt.createdByName || '-'}</td>
                    <td><span class="badge bg-${status.color}-subtle text-${status.color} rounded-pill"><i class="bi ${status.icon} me-1"></i>${status.label}</span></td>
                    <td class="small">${formatDate(evt.date)}</td>
                    <td>
                        <button class="btn btn-sm btn-light border" onclick="Foro.openEventDetailsModal('${evt.id}')" title="Ver Detalle"><i class="bi bi-eye"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }

        async function handleApprove(id) {
            if (!confirm("¿Confirmar publicación del evento?")) return;
            try {
                await ForoService.approveEvent(_ctx, id);
                showToast("Evento aprobado y publicado.", 'success');
                refreshDifusionData();
            } catch (e) { showToast(e.message, 'error'); }
        }

        // ==========================================
        // JEFE DIVISIÓN (SOLICITANTE) — ESTRUCTURA & LOGICA
        // ==========================================
        function renderDivisionHeadStructure(container) {
            container.innerHTML = `
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3 animate__animated animate__fadeIn">
                    <div>
                        <h2 class="h4 fw-bold text-dark mb-1"><i class="bi bi-calendar-event-fill me-2 text-primary"></i>Gestión de Mis Eventos</h2>
                        <p class="text-muted small mb-0">${_profile.displayName || _profile.email}</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-dark rounded-pill shadow-sm" onclick="Foro.openScanner()">
                            <i class="bi bi-qr-code-scan me-2"></i>Escanear QR
                        </button>
                        <button class="btn btn-primary rounded-pill shadow-sm" onclick="Foro.openEventModal()">
                            <i class="bi bi-calendar-plus me-2"></i>Nuevo Evento
                        </button>
                    </div>
                </div>

                <!-- KPI SIMPLE -->
                <div class="row g-3 mb-4">
                    <div class="col-12">
                         <div class="alert alert-info border-0 shadow-sm rounded-4 mb-0 d-flex align-items-center">
                            <i class="bi bi-info-circle-fill fs-3 me-3 text-info opacity-75"></i>
                            <div>
                                <h6 class="fw-bold mb-1">Proceso de Publicación</h6>
                                <p class="small mb-0 opacity-75">Al crear un evento, este pasará a estado <strong>Pendiente</strong> hasta ser validado por el departamento de Difusión. Una vez aprobado, será visible para los estudiantes.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABLA MIS EVENTOS -->
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-header bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-muted small text-uppercase ls-1">Mis Solicitudes</span>
                        <button class="btn btn-sm btn-light border rounded-pill" onclick="Foro.initDivisionHeadView()"><i class="bi bi-arrow-clockwise"></i></button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light">
                                <tr>
                                    <th class="ps-4">Evento</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th>Aforo</th>
                                    <th class="text-end pe-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="foro-admin-events-body"></tbody>
                        </table>
                    </div>
                </div>

                ${getAdminModals()}
            `;
        }

        async function initDivisionHeadView() {
            try {
                const body = document.getElementById('foro-admin-events-body');
                if (body) body.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

                _adminEvents = await ForoService.getMyEvents(_ctx);
                renderDivisionEventsTable();
            } catch (e) {
                console.error("[Foro] Error loading division data:", e);
            }
        }

        function renderDivisionEventsTable() {
            const body = document.getElementById('foro-admin-events-body');
            if (!body) return;

            if (!_adminEvents.length) {
                body.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No has creado eventos.</td></tr>';
                return;
            }

            body.innerHTML = _adminEvents.map(evt => {
                const cfg = getTypeCfg(evt.type);
                const status = getStatusCfg(evt.status);

                // Tooltip logic for Rejection
                const rejectionInfo = evt.status === 'rejected' ?
                    `data-bs-toggle="tooltip" title="Motivo: ${evt.rejectionReason || 'No especificado'}"` : '';

                return `
                <tr>
                    <td class="ps-4">
                        <div class="d-flex align-items-center gap-3">
                           <div>
                                <div class="fw-bold text-dark">${evt.title}</div>
                                <small class="text-muted d-block text-truncate" style="max-width: 200px;">${evt.location || '-'}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-${status.color}-subtle text-${status.color} rounded-pill" ${rejectionInfo} style="cursor: ${evt.status === 'rejected' ? 'help' : 'default'}">
                            <i class="bi ${status.icon} me-1"></i>${status.label}
                        </span>
                        ${evt.status === 'rejected' ? '<div class="extra-small text-danger mt-1">Ver motivo</div>' : ''}
                    </td>
                    <td class="small">${formatDate(evt.date)}</td>
                    <td><span class="badge  text-dark border">${evt.registeredCount || 0} / ${evt.capacity || '-'}</span></td>
                    <td class="text-end pe-4">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-light border" onclick="Foro.viewEventAttendees('${evt.id}')" title="Ver asistentes"><i class="bi bi-people"></i></button>
                            <button class="btn btn-light border" onclick="Foro.publishEventQR('${evt.id}')" title="Publicar QR"><i class="bi bi-qr-code"></i></button>
                             ${evt.status !== 'active' ? `<button class="btn btn-light border" onclick="Foro.openEventModal('${evt.id}')" title="Editar"><i class="bi bi-pencil"></i></button>` : ''}
                            <button class="btn btn-light border text-danger" onclick="Foro.deleteEvent('${evt.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            // Activate tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        }

        // ==========================================
        // COMMON CRUD & ACTIONS
        // ==========================================

        async function openRejectModal(eventId) {
            const form = document.getElementById('form-foro-reject');
            form.reset();
            document.getElementById('reject-evt-id').value = eventId;
            new bootstrap.Modal(document.getElementById('modalForoReject')).show();
        }

        async function handleRejectSubmit(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            const original = btn.innerHTML;
            btn.innerHTML = 'Rechazando...';

            try {
                const id = document.getElementById('reject-evt-id').value;
                const reason = document.getElementById('reject-reason').value;
                await ForoService.rejectEvent(_ctx, id, reason);
                showToast("Evento rechazado.", 'warning');
                bootstrap.Modal.getInstance(document.getElementById('modalForoReject')).hide();
                refreshDifusionData();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }

        // ... (Existing CRUD functions remain, ensure they route correctly if needed) ...

        function openEventModal(id = null) {
            const form = document.getElementById('form-foro-event');
            form.reset();
            document.getElementById('foro-evt-id').value = id || '';
            document.getElementById('modalForoEventTitle').innerText = id ? 'Editar Evento' : 'Nuevo Evento';

            // Reset type selection
            const typeRadios = document.querySelectorAll('input[name="foro-evt-type"]');
            typeRadios.forEach(r => r.checked = r.value === 'otro');

            // Reset cover preview
            const preview = document.getElementById('cover-preview');
            if (preview) hide(preview);

            if (id) {
                const evt = _adminEvents.find(e => e.id === id);
                if (evt) {
                    document.getElementById('foro-evt-title').value = evt.title;
                    document.getElementById('foro-evt-speaker').value = evt.speaker || '';
                    document.getElementById('foro-evt-location').value = evt.location || '';
                    document.getElementById('foro-evt-desc').value = evt.description || '';
                    document.getElementById('foro-evt-capacity').value = evt.capacity || 100;

                    // Set date
                    if (evt.date) {
                        const d = evt.date.toDate ? evt.date.toDate() : new Date(evt.date);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        document.getElementById('foro-evt-date').value = local;
                    }

                    // Set type
                    typeRadios.forEach(r => r.checked = r.value === (evt.type || 'otro'));

                    // Set audience
                    if (evt.targetAudience) {
                        const sel = document.getElementById('foro-evt-audience');
                        Array.from(sel.options).forEach(o => {
                            o.selected = evt.targetAudience.includes(o.value);
                        });
                    }

                    // Show cover preview if exists
                    if (evt.coverImage) {
                        const previewImg = document.getElementById('cover-preview-img');
                        if (previewImg) {
                            previewImg.src = evt.coverImage;
                            show(preview);
                        }
                    }
                }
            }
            new bootstrap.Modal(document.getElementById('modalForoEvent')).show();
        }

        function openEventDetailsModal(id) {
            const evt = _adminEvents.find(e => e.id === id) || _difusionQueue.find(e => e.id === id) || _difusionHistory.find(e => e.id === id);
            if (!evt) return;

            document.getElementById('detail-title').innerText = evt.title;
            document.getElementById('detail-desc').innerText = evt.description || 'Sin descripción';
            document.getElementById('detail-date').innerText = formatDate(evt.date);
            document.getElementById('detail-location').innerText = evt.location || '-';
            document.getElementById('detail-capacity').innerText = evt.capacity || 0;
            document.getElementById('detail-type').innerText = (evt.type || 'Otro').toUpperCase();
            document.getElementById('detail-author').innerText = evt.createdByName || '-';
            document.getElementById('detail-audience').innerText = (evt.targetAudience || ['Todas']).join(', ');

            // Status Badge
            const status = getStatusCfg(evt.status);
            const badge = document.getElementById('detail-status-badge');
            badge.className = `badge bg-${status.color}-subtle text-${status.color} rounded-pill fs-6`;
            badge.innerHTML = `<i class="bi ${status.icon} me-1"></i>${status.label}`;

            // Rejection Msg
            const rejDiv = document.getElementById('detail-rejection');
            if (evt.status === 'rejected' && evt.rejectionReason) {
                document.getElementById('detail-rejection-msg').innerText = evt.rejectionReason;
                rejDiv.classList.remove('d-none');
            } else {
                rejDiv.classList.add('d-none');
            }

            // Cover
            const cover = document.getElementById('detail-cover');
            if (evt.coverImage) {
                cover.src = evt.coverImage;
                cover.classList.remove('d-none');
            } else {
                cover.classList.add('d-none');
            }

            new bootstrap.Modal(document.getElementById('modalForoDetails')).show();
        }

        async function handleEventSubmit(e) {
            e.preventDefault();
            // Call local refresh based on view
            const btn = e.target.querySelector('button[type="submit"]');
            // ... existing logic but at the end call:
            // if (_isDivisionHead) initDivisionHeadView();
            // else if (_isDifusion) initDifusionView(); // Though difusion rarely creates
            // The original implementation had hardcoded calls. I'll need to check the original function logic later or assume it's fine for now, 
            // but I should really just copy paste implementation if I want to be safe.

            // FOR NOW, copying implementation of handleEventSubmit here to ensure it calls correct init
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

            try {
                const id = document.getElementById('foro-evt-id').value;
                const selectedType = document.querySelector('input[name="foro-evt-type"]:checked')?.value || 'otro';

                // Handle cover image upload
                let coverImageUrl = '';
                const coverInput = document.getElementById('foro-evt-cover');
                if (coverInput && coverInput.files.length > 0) {
                    const file = coverInput.files[0];
                    const storage = _ctx.storage || (window.SIA && window.SIA.storage);
                    if (storage) {
                        const ext = file.name.split('.').pop();
                        const filename = `event_${Date.now()}.${ext}`;
                        const ref = storage.ref().child(`foro/covers/${filename}`);
                        const snapshot = await ref.put(file);
                        coverImageUrl = await snapshot.ref.getDownloadURL();
                    }
                }

                const data = {
                    title: document.getElementById('foro-evt-title').value,
                    speaker: document.getElementById('foro-evt-speaker').value,
                    location: document.getElementById('foro-evt-location').value,
                    date: new Date(document.getElementById('foro-evt-date').value),
                    capacity: parseInt(document.getElementById('foro-evt-capacity').value) || 100,
                    description: document.getElementById('foro-evt-desc').value,
                    type: selectedType,
                    targetAudience: Array.from(document.getElementById('foro-evt-audience').selectedOptions).map(o => o.value)
                };

                if (coverImageUrl) data.coverImage = coverImageUrl;

                if (id) {
                    await ForoService.updateEvent(_ctx, id, data);
                } else {
                    await ForoService.createEvent(_ctx, data);
                }

                bootstrap.Modal.getInstance(document.getElementById('modalForoEvent')).hide();
                showToast("Evento guardado correctamente.", 'success');

                // REFRESH CORRECT VIEW
                if (_isDivisionHead) await initDivisionHeadView();
                else if (_isDifusion) await initDifusionView();

            } catch (err) {
                showToast("Error: " + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        async function deleteEvent(id) {
            if (!confirm("¿Eliminar este evento definitivamente?")) return;
            try {
                await ForoService.deleteEvent(_ctx, id);
                showToast("Evento eliminado.", 'success');
                if (_isDivisionHead) await initDivisionHeadView();
                else if (_isDifusion) await refreshDifusionData();
            } catch (e) {
                showToast("Error: " + e.message, 'error');
            }
        }

        // --- QR PUBLISH ---
        function publishEventQR(eventId) {
            const event = _adminEvents.find(e => e.id === eventId);
            if (!event) return;

            document.getElementById('publish-qr-event-title').innerText = event.title;
            document.getElementById('publish-qr-event-meta').innerText = `${event.location || ''} — ${formatDate(event.date)}`;

            const container = document.getElementById('publish-qrcode-container');
            container.innerHTML = '';

            new bootstrap.Modal(document.getElementById('modalPublishQR')).show();

            setTimeout(() => {
                const qrData = ForoService.getEventQRData(eventId);
                new QRCode(container, {
                    text: qrData,
                    width: 280, height: 280,
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }, 500);
        }

        // --- VIEW ATTENDEES ---
        async function viewEventAttendees(eventId) {
            const event = _adminEvents.find(e => e.id === eventId);
            if (!event) return;

            const titleEl = document.getElementById('attendees-event-title');
            titleEl.innerText = event.title;
            titleEl.dataset.eventId = eventId;
            const listEl = document.getElementById('attendees-list');
            listEl.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

            new bootstrap.Modal(document.getElementById('modalAttendees')).show();

            try {
                const attendees = await ForoService.getEventAttendees(_ctx, eventId);

                if (!attendees.length) {
                    listEl.innerHTML = '<div class="text-center text-muted py-3">No hay inscritos.</div>';
                    document.getElementById('attendees-count').innerText = '0 inscritos';
                    return;
                }

                const attended = attendees.filter(a => a.status === 'attended').length;
                document.getElementById('attendees-count').innerText = `${attendees.length} inscritos — ${attended} asistieron`;

                listEl.innerHTML = `
                    <table class="table table-sm table-hover mb-0">
                        <thead><tr><th>Nombre</th><th>Matrícula</th><th>Carrera</th><th>Estado</th></tr></thead>
                        <tbody>
                            ${attendees.map(a => `
                                <tr>
                                    <td class="small">${a.userName || '-'}</td>
                                    <td class="small">${a.userMatricula || '-'}</td>
                                    <td class="small">${a.userCareer || '-'}</td>
                                    <td><span class="badge ${a.status === 'attended' ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${a.status === 'attended' ? 'Asistió' : 'Inscrito'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } catch (e) {
                listEl.innerHTML = `<div class="text-danger small">${e.message}</div>`;
            }
        }

        function exportAttendees(eventId) {
            const event = _adminEvents.find(e => e.id === eventId);
            if (!event) return;

            ForoService.getEventAttendees(_ctx, eventId).then(attendees => {
                if (!attendees.length) {
                    showToast("No hay datos para exportar.", 'warning');
                    return;
                }

                const headers = ['Nombre', 'Matrícula', 'Carrera', 'Estado', 'Fecha Inscripción'];
                const rows = attendees.map(a => [
                    a.userName || '',
                    a.userMatricula || '',
                    a.userCareer || '',
                    a.status === 'attended' ? 'Asistió' : 'Inscrito',
                    a.registeredAt ? formatDate(a.registeredAt) : ''
                ]);

                let csv = headers.join(',') + '\n';
                rows.forEach(r => {
                    csv += r.map(v => `"${v}"`).join(',') + '\n';
                });

                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `asistentes_${event.title.replace(/\s/g, '_')}.csv`;
                link.click();
                URL.revokeObjectURL(url);
            });
        }

        // --- SCANNER ---
        function openScanner() {
            new bootstrap.Modal(document.getElementById('modalScanner')).show();
            setTimeout(() => {
                const readerEl = document.getElementById('reader');
                if (!readerEl) return;

                if (!_html5QrcodeScanner) {
                    _html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
                    _html5QrcodeScanner.render(onScanSuccess, () => { });
                } else {
                    _html5QrcodeScanner.resume();
                }
            }, 500);
        }

        function stopScanner() {
            if (_html5QrcodeScanner) _html5QrcodeScanner.pause();
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalScanner'));
            if (modal) modal.hide();
        }

        async function onScanSuccess(decoded) {
            if (_html5QrcodeScanner) _html5QrcodeScanner.pause();
            try {
                const data = await ForoService.markAttendance(_ctx, decoded);
                showToast(`ASISTENCIA: ${data.userName} — ${data.eventTitle}`, 'success');
                _html5QrcodeScanner.resume();
            } catch (e) {
                showToast("Error: " + e.message, 'error');
                _html5QrcodeScanner.resume();
            }
        }

        // ==========================================
        // MODALES — TEMPLATES
        // ==========================================
        function getStudentModals() {
            return `
            <!-- Modal Ticket QR -->
            <div class="modal fade" id="modalTicketQR" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 p-4 text-center">
                        <h6 class="text-uppercase text-muted fw-bold small mb-3">Tu Pase de Acceso</h6>
                        <h4 class="fw-bold mb-1" id="qr-event-title">Evento</h4>
                        <p class="text-muted small mb-4" id="qr-event-meta">Detalles</p>
                        <div class="d-flex justify-content-center mb-4">
                            <div id="qrcode-container" class="bg-white p-3 rounded-4 shadow-sm"></div>
                        </div>
                        <div class="alert alert-light border small text-muted"><i class="bi bi-brightness-high me-2"></i>Sube el brillo al maximo para facilitar el escaneo.</div>
                        <button class="btn btn-dark w-100 rounded-pill" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Event Detail (Student) -->
            <div class="modal fade" id="modalEventDetailStudent" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0 pb-0">
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body px-4 pt-0">
                            <img id="sd-cover" src="" class="w-100 rounded-3 mb-3 d-none" style="max-height:220px; object-fit:cover;" onerror="this.classList.add('d-none')">
                            <div class="mb-3">
                                <span id="sd-type-badge" class="badge rounded-pill mb-2"></span>
                                <h4 class="fw-bold mb-0" id="sd-title"></h4>
                            </div>
                            <div class="row g-3 mb-4">
                                <div class="col-6">
                                    <div class="d-flex align-items-start gap-2">
                                        <i class="bi bi-person-fill text-primary mt-1"></i>
                                        <div class="small"><div class="text-muted" style="font-size:0.65rem;">Ponente</div><div class="fw-bold" id="sd-speaker"></div></div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="d-flex align-items-start gap-2">
                                        <i class="bi bi-geo-alt-fill text-danger mt-1"></i>
                                        <div class="small"><div class="text-muted" style="font-size:0.65rem;">Ubicacion</div><div class="fw-bold" id="sd-location"></div></div>
                                    </div>
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-start gap-2">
                                        <i class="bi bi-calendar-event text-success mt-1"></i>
                                        <div class="small"><div class="text-muted" style="font-size:0.65rem;">Fecha y Hora</div><div class="fw-bold" id="sd-date"></div></div>
                                    </div>
                                </div>
                            </div>
                            <div class="card border-0 rounded-3 p-3 mb-4" style="background:var(--surface);">
                                <h6 class="fw-bold small text-uppercase text-muted mb-2">Disponibilidad</h6>
                                <div id="sd-capacity"></div>
                            </div>
                            <div class="mb-3">
                                <h6 class="fw-bold small text-uppercase text-muted mb-2">Descripcion</h6>
                                <p class="text-muted small" id="sd-desc"></p>
                            </div>
                            <div class="mb-3">
                                <h6 class="fw-bold small text-uppercase text-muted mb-2">Dirigido a</h6>
                                <p class="text-muted small" id="sd-audience"></p>
                            </div>
                        </div>
                        <div class="modal-footer border-0 d-flex gap-2">
                            <button id="sd-btn-share" class="btn btn-outline-primary rounded-pill"><i class="bi bi-share-fill me-1"></i>Compartir</button>
                            <button id="sd-btn-register" class="btn btn-primary flex-grow-1 rounded-pill fw-bold"></button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Feedback -->
            <div class="modal fade" id="modalFeedback" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold">Califica el Evento</h5>
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form onsubmit="Foro.submitFeedback(event)">
                            <div class="modal-body">
                                <input type="hidden" id="feedback-ticket-id">
                                <input type="hidden" id="feedback-event-id">
                                <input type="hidden" id="feedback-rating" value="5">
                                <h6 class="fw-bold mb-3" id="feedback-event-title"></h6>
                                <div class="mb-4 text-center">
                                    <p class="small text-muted mb-2">Como calificarias este evento?</p>
                                    <div class="fs-2" style="cursor:pointer; letter-spacing:0.3rem;">
                                        <i class="bi bi-star-fill text-warning foro-star" onclick="Foro.setFeedbackRating(1)"></i>
                                        <i class="bi bi-star-fill text-warning foro-star" onclick="Foro.setFeedbackRating(2)"></i>
                                        <i class="bi bi-star-fill text-warning foro-star" onclick="Foro.setFeedbackRating(3)"></i>
                                        <i class="bi bi-star-fill text-warning foro-star" onclick="Foro.setFeedbackRating(4)"></i>
                                        <i class="bi bi-star-fill text-warning foro-star" onclick="Foro.setFeedbackRating(5)"></i>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Comentarios (Opcional)</label>
                                    <textarea id="feedback-comment" class="form-control" rows="3" placeholder="Comparte tu experiencia..."></textarea>
                                </div>
                            </div>
                            <div class="modal-footer border-0">
                                <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-warning rounded-pill fw-bold"><i class="bi bi-send-fill me-2"></i>Enviar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Modal Student Scanner -->
            <div class="modal fade" id="modalStudentScanner" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 overflow-hidden">
                        <div class="modal-header bg-dark text-white border-0">
                            <h5 class="modal-title"><i class="bi bi-qr-code-scan me-2"></i>Escanear Evento</h5>
                            <button type="button" class="btn-close btn-close-white" onclick="Foro.stopStudentScanner()"></button>
                        </div>
                        <div class="modal-body p-0 bg-black">
                            <div id="student-reader" style="width:100%; min-height:300px;"></div>
                        </div>
                        <div class="modal-footer border-0 justify-content-center">
                            <small class="text-muted">Escanea el QR proyectado en el evento</small>
                        </div>
                    </div>
                </div>
            </div>`;
        }



        // --- STUDENT SCANNER ---
        function openStudentScanner(eventId) {
            new bootstrap.Modal(document.getElementById('modalStudentScanner')).show();
            setTimeout(() => {
                if (!_studentScanner) {
                    _studentScanner = new Html5QrcodeScanner("student-reader", { fps: 10, qrbox: 250 });
                    _studentScanner.render(onStudentScanSuccess, () => { });
                } else {
                    _studentScanner.resume();
                }
            }, 500);
        }

        function stopStudentScanner() {
            if (_studentScanner) _studentScanner.pause();
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalStudentScanner'));
            if (modal) modal.hide();
        }

        async function onStudentScanSuccess(decoded) {
            if (_studentScanner) _studentScanner.pause();
            try {
                // Decoded format: SIA:FORO_EVENT:{eventId}
                const res = await ForoService.markAttendanceByEventQR(_ctx, decoded, _ctx.user?.uid || _profile?.uid);
                showToast(`Asistencia registrada: ${res.eventTitle}`, 'success');
                stopStudentScanner();
                loadTickets(); // Refresh tickets to show "Attended" status
            } catch (e) {
                showToast("Error: " + e.message, 'error');
                setTimeout(() => { if (_studentScanner) _studentScanner.resume(); }, 2000);
            }
        }

        function getAdminModals() {
            return `
            <!-- Modal Crear/Editar Evento -->
            <div class="modal fade" id="modalForoEvent" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold modal-title" id="modalForoEventTitle">Nuevo Evento</h5>
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-foro-event" onsubmit="Foro.handleEventSubmit(event)">
                                <input type="hidden" id="foro-evt-id">

                                <!-- Tipo de Evento -->
                                <div class="mb-4">
                                    <label class="form-label small fw-bold">Tipo de Evento</label>
                                    <div class="row g-2">
                                        <div class="col-4">
                                            <input type="radio" class="btn-check" name="foro-evt-type" id="type-conf" value="conferencia">
                                            <label class="btn btn-outline-primary w-100 py-3 rounded-3 text-center" for="type-conf">
                                                <i class="bi bi-mic-fill d-block fs-4 mb-1"></i>
                                                <span class="small fw-bold">Conferencia</span>
                                            </label>
                                        </div>
                                        <div class="col-4">
                                            <input type="radio" class="btn-check" name="foro-evt-type" id="type-expo" value="exposicion">
                                            <label class="btn btn-outline-info w-100 py-3 rounded-3 text-center" for="type-expo">
                                                <i class="bi bi-easel-fill d-block fs-4 mb-1"></i>
                                                <span class="small fw-bold">Exposición</span>
                                            </label>
                                        </div>
                                        <div class="col-4">
                                            <input type="radio" class="btn-check" name="foro-evt-type" id="type-otro" value="otro" checked>
                                            <label class="btn btn-outline-secondary w-100 py-3 rounded-3 text-center" for="type-otro">
                                                <i class="bi bi-calendar-event d-block fs-4 mb-1"></i>
                                                <span class="small fw-bold">Otro</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-8">
                                        <label class="form-label small fw-bold">Título</label>
                                        <input type="text" id="foro-evt-title" class="form-control" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label small fw-bold">Fecha y Hora</label>
                                        <input type="datetime-local" id="foro-evt-date" class="form-control" required>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Ponente / Responsable</label>
                                        <input type="text" id="foro-evt-speaker" class="form-control" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Lugar</label>
                                        <input type="text" id="foro-evt-location" class="form-control" required>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold">Aforo Máx</label>
                                        <input type="number" id="foro-evt-capacity" class="form-control" value="100" min="1">
                                    </div>
                                    <div class="col-md-9">
                                        <label class="form-label small fw-bold">Audiencia</label>
                                        <select id="foro-evt-audience" class="form-select" multiple>
                                            <option value="ALL" selected>Todas las carreras</option>
                                            <option value="ISC">Sistemas (ISC/ITIC)</option>
                                            <option value="ARQ">Arquitectura</option>
                                            <option value="CIV">Civil</option>
                                            <option value="ADM">Administración</option>
                                            <option value="CON">Contador Público</option>
                                            <option value="GAS">Gastronomía</option>
                                            <option value="TUR">Turismo</option>
                                            <option value="ELE">Electromecánica</option>
                                        </select>
                                        <div class="form-text extra-small">Ctrl+Click para múltiple</div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Descripción</label>
                                    <textarea id="foro-evt-desc" class="form-control" rows="3"></textarea>
                                </div>

                                <!-- Cover Image -->
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Imagen de Portada (Opcional)</label>
                                    <input type="file" id="foro-evt-cover" class="form-control" accept="image/*" onchange="Foro.previewCover(this)">
                                    <div id="cover-preview" class="mt-2 d-none">
                                        <img id="cover-preview-img" class="img-fluid rounded-3" style="max-height: 150px;">
                                    </div>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary rounded-pill fw-bold">
                                        <i class="bi bi-check-lg me-2"></i>Guardar Evento
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Publicar QR -->
            <div class="modal fade" id="modalPublishQR" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 p-4 text-center">
                        <h6 class="text-uppercase text-muted fw-bold small text-spacing-2 mb-3">QR del Evento</h6>
                        <h4 class="fw-bold text-dark mb-1" id="publish-qr-event-title">Evento</h4>
                        <p class="text-muted small mb-4" id="publish-qr-event-meta">Detalles</p>
                        <div class="d-flex justify-content-center mb-4">
                            <div id="publish-qrcode-container" class="bg-white p-3 rounded-4 shadow-sm"></div>
                        </div>
                        <p class="text-muted extra-small">Proyecta este QR para que los alumnos lo escaneen.</p>
                        <button class="btn btn-dark w-100 rounded-pill" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>

            <!-- Modal Asistentes -->
            <div class="modal fade" id="modalAttendees" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0">
                            <div>
                                <h5 class="fw-bold modal-title" id="attendees-event-title">Asistentes</h5>
                                <small class="text-muted" id="attendees-count"></small>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="Foro.exportAttendees(document.getElementById('attendees-event-title').dataset.eventId)"><i class="bi bi-download me-1"></i>CSV</button>
                                <button class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                        </div>
                        <div class="modal-body pt-0">
                            <div id="attendees-list"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Scanner QR -->
            <div class="modal fade" id="modalScanner" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 overflow-hidden">
                        <div class="modal-header bg-dark text-white border-0">
                            <h5 class="modal-title"><i class="bi bi-qr-code-scan me-2"></i>Escanear Asistencia</h5>
                            <button type="button" class="btn-close btn-close-white" onclick="Foro.stopScanner()"></button>
                        </div>
                        <div class="modal-body p-0 bg-black">
                            <div id="reader" style="width:100%; min-height:300px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Rejection -->
            <div class="modal fade" id="modalForoReject" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold modal-title">Rechazar Evento</h5>
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-foro-reject" onsubmit="Foro.handleRejectSubmit(event)">
                                <input type="hidden" id="reject-evt-id">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Motivo del rechazo</label>
                                    <textarea id="reject-reason" class="form-control" rows="3" required placeholder="Explica por qué no se puede publicar..."></textarea>
                                </div>
                                <div class="d-flex justify-content-end">
                                    <button type="button" class="btn btn-light rounded-pill me-2" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="submit" class="btn btn-danger rounded-pill fw-bold">Rechazar Evento</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Details (Read Only) -->
            <div class="modal fade" id="modalForoDetails" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content rounded-4 border-0">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold modal-title">Detalles del Evento</h5>
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <img id="detail-cover" src="" class="img-fluid rounded-3 mb-3 d-none" style="width: 100%; object-fit: cover; height: 200px;">
                                    <div class="p-3 bg-light rounded-3">
                                        <h6 class="fw-bold small text-muted text-uppercase">Información</h6>
                                        <p class="mb-1 small"><strong>Fecha:</strong> <span id="detail-date"></span></p>
                                        <p class="mb-1 small"><strong>Lugar:</strong> <span id="detail-location"></span></p>
                                        <p class="mb-1 small"><strong>Aforo:</strong> <span id="detail-capacity"></span></p>
                                        <p class="mb-1 small"><strong>Tipo:</strong> <span id="detail-type"></span></p>
                                        <p class="mb-0 small"><strong>Solicita:</strong> <span id="detail-author"></span></p>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <h3 class="fw-bold text-dark mb-2" id="detail-title"></h3>
                                    <div class="mb-3">
                                        <span class="badge" id="detail-status-badge"></span>
                                    </div>
                                    <h6 class="fw-bold small text-muted">Descripción</h6>
                                    <p class="text-muted" id="detail-desc"></p>
                                    
                                    <h6 class="fw-bold small text-muted mt-4">Audiencia Objetivo</h6>
                                    <p class="text-muted small" id="detail-audience"></p>

                                    <div id="detail-rejection" class="alert alert-danger d-none mt-3">
                                        <strong>Motivo de rechazo:</strong> <span id="detail-rejection-msg"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }

        // --- COVER PREVIEW HELPER ---
        function previewCover(input) {
            const preview = document.getElementById('cover-preview');
            const previewImg = document.getElementById('cover-preview-img');
            if (input.files && input.files[0] && previewImg) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    show(preview);
                };
                reader.readAsDataURL(input.files[0]);
            } else {
                hide(preview);
            }
        }


        return {
            init,
            openEventModal, handleEventSubmit, deleteEvent, publishEventQR,
            viewEventAttendees, exportAttendees, openScanner, stopScanner,
            refreshDifusionData, handleApprove, openRejectModal, handleRejectSubmit,
            initDivisionHeadView, renderDivisionEventsTable, previewEventCover: previewCover,
            previewCover, openEventDetailsModal
        };
    })();
}
