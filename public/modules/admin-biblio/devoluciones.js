if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Devoluciones = (function () {
    const state = window.AdminBiblio.State;
    const CONDONACION_PAGE_SIZE = 5;
    let _ctx = null;
    let _currentDevolData = null;
    let _currentCondonacionData = null;

    function syncFromState() {
        _ctx = state.ctx;
        _currentDevolData = state.currentDevolData;
        _currentCondonacionData = state.currentCondonacionData;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.currentDevolData = _currentDevolData;
        state.currentCondonacionData = _currentCondonacionData;
    }

    function withState(fn) {
        return function (...args) {
            syncFromState();
            try {
                const result = fn.apply(this, args);
                if (result && typeof result.then === 'function') {
                    return result.finally(() => {
                        syncToState();
                    });
                }
                syncToState();
                return result;
            } catch (error) {
                syncToState();
                throw error;
            }
        };
    }

    const shared = window.AdminBiblio.Shared || {};

    function escapeHtml(...args) { return shared.escapeHtml(...args); }
    function escapeJsString(...args) { return shared.escapeJsString(...args); }
    function encodeItemPayload(...args) { return shared.encodeItemPayload(...args); }
    function decodeItemPayload(...args) { return shared.decodeItemPayload(...args); }
    function parseDate(...args) { return shared.parseDate(...args); }
    function showConfirmModal(...args) { return shared.showConfirmModal(...args); }
    function showPromptModal(...args) { return shared.showPromptModal(...args); }
    function runNonCriticalTask(...args) { return shared.runNonCriticalTask(...args); }
    function isActiveLoanState(...args) { return shared.isActiveLoanState(...args); }
    function resetServiceSelection(...args) { return shared.resetServiceSelection(...args); }
    function clearLiveAssetStreams(...args) { return window.AdminBiblio.clearLiveAssetStreams(...args); }

    function cleanupRuntime(...args) { return window.AdminBiblio.cleanupRuntime(...args); }
    function init(...args) { return window.AdminBiblio.init(...args); }
    function terminarVisita(...args) { return window.AdminBiblio.terminarVisita(...args); }
    function initAdmin(...args) { return window.AdminBiblio.initAdmin(...args); }
    function forzarRecargaCache(...args) { return window.AdminBiblio.forzarRecargaCache(...args); }
    function startClock(...args) { return window.AdminBiblio.startClock(...args); }
    function loadAdminStats(...args) { return window.AdminBiblio.loadAdminStats(...args); }
    function showAdminItemDetail(...args) { return window.AdminBiblio.showAdminItemDetail(...args); }
    function confirmarEntregaApartado(...args) { return window.AdminBiblio.confirmarEntregaApartado(...args); }
    function registrarPagoDeuda(...args) { return window.AdminBiblio.registrarPagoDeuda(...args); }
    function abrirModalHistorial(...args) { return window.AdminBiblio.abrirModalHistorial(...args); }
    function cargarHistorial(...args) { return window.AdminBiblio.cargarHistorial(...args); }
    function generarItemHistorial(...args) { return window.AdminBiblio.generarItemHistorial(...args); }
    function abrirModalVisita(...args) { return window.AdminBiblio.abrirModalVisita(...args); }
    function renderVisitModalContent(...args) { return window.AdminBiblio.renderVisitModalContent(...args); }
    function verificarUsuarioVisita(...args) { return window.AdminBiblio.verificarUsuarioVisita(...args); }
    function toggleTeamForm(...args) { return window.AdminBiblio.toggleTeamForm(...args); }
    function mostrarRegistroAnonimo(...args) { return window.AdminBiblio.mostrarRegistroAnonimo(...args); }
    function addTeamMember(...args) { return window.AdminBiblio.addTeamMember(...args); }
    function confirmarVisitaDirecta(...args) { return window.AdminBiblio.confirmarVisitaDirecta(...args); }
    function confirmarVisitaUnregistered(...args) { return window.AdminBiblio.confirmarVisitaUnregistered(...args); }
    function abrirModalPrestamo(...args) { return window.AdminBiblio.abrirModalPrestamo(...args); }
    function consultarPrestamo(...args) { return window.AdminBiblio.consultarPrestamo(...args); }
    function confirmarPrestamo(...args) { return window.AdminBiblio.confirmarPrestamo(...args); }
    function abrirModalComputadoras(...args) { return window.AdminBiblio.abrirModalComputadoras(...args); }
    function forzarLimpiezaPCs(...args) { return window.AdminBiblio.forzarLimpiezaPCs(...args); }
    function loadPCGrid(...args) { return window.AdminBiblio.loadPCGrid(...args); }
    function asignarPC(...args) { return window.AdminBiblio.asignarPC(...args); }
    function handleAssetClick(...args) { return window.AdminBiblio.handleAssetClick(...args); }
    function mostrarLibrosUsuario(...args) { return window.AdminBiblio.mostrarLibrosUsuario(...args); }
    function confirmarRenovacion(...args) { return window.AdminBiblio.confirmarRenovacion(...args); }
    function confirmarRecibirSinLibro(...args) { return window.AdminBiblio.confirmarRecibirSinLibro(...args); }
    function abrirModalGestionLibros(...args) { return window.AdminBiblio.abrirModalGestionLibros(...args); }
    function renderBookForm(...args) { return window.AdminBiblio.renderBookForm(...args); }
    function saveBook(...args) { return window.AdminBiblio.saveBook(...args); }
    function renderBookEditSearch(...args) { return window.AdminBiblio.renderBookEditSearch(...args); }
    function handleEditSearch(...args) { return window.AdminBiblio.handleEditSearch(...args); }
    function renderEditBookCard(...args) { return window.AdminBiblio.renderEditBookCard(...args); }
    function abrirModalConfig(...args) { return window.AdminBiblio.abrirModalConfig(...args); }
    function loadConfigAssets(...args) { return window.AdminBiblio.loadConfigAssets(...args); }
    function openAddAssetModal(...args) { return window.AdminBiblio.openAddAssetModal(...args); }
    function createAsset(...args) { return window.AdminBiblio.createAsset(...args); }
    function confirmDeleteAsset(...args) { return window.AdminBiblio.confirmDeleteAsset(...args); }
    function toggleAssetStatus(...args) { return window.AdminBiblio.toggleAssetStatus(...args); }
    function abrirModalServicio(...args) { return window.AdminBiblio.abrirModalServicio(...args); }
    function renderAvailabilityGrid(...args) { return window.AdminBiblio.renderAvailabilityGrid(...args); }
    function selectSlot(...args) { return window.AdminBiblio.selectSlot(...args); }
    function confirmarReserva(...args) { return window.AdminBiblio.confirmarReserva(...args); }

    function abrirModalDevolucion() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-success text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-box-arrow-in-down me-3"></i>Devolver Libro</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 ">
                 <div class="row g-3 mb-4">
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-mortarboard-fill me-1 text-success"></i>Estudiante</label>
                        <div class="input-group">
                            <span class="input-group-text bg-success bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-success"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="devol-user" placeholder="Ej: 22380123" autofocus
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarDevolucion()">
                        </div>
                   </div>
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-journal-bookmark-fill me-1 text-success"></i>Libro</label>
                        <div class="input-group">
                            <span class="input-group-text bg-success bg-opacity-10 border-0"><i class="bi bi-upc-scan text-success"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="devol-book" placeholder="Ej: B-001"
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarDevolucion()">
                        </div>
                   </div>
                </div>
                <div id="devol-scan-status" class="small text-center mt-2 d-none"></div>
                
                <div class="d-grid mb-4">
                    <button class="btn btn-success rounded-pill border-0 fw-bold shadow-sm py-2" onclick="AdminBiblio.consultarDevolucion()">
                        <i class="bi bi-eye me-2"></i>Calcular Deuda y Estado
                    </button>
                </div>

                <div id="lista-libros-container" class="mb-4"></div>

                <!-- Preview Area -->
                <div id="devol-preview" class="d-none animate__animated animate__fadeIn">
                     <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                        <div class="card-body bg-white p-4">
                            <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">ESTUDIANTE</span>
                                <span class="fw-bold text-dark" id="prev-d-user">-</span>
                            </div>
                            <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">LIBRO</span>
                                <span class="fw-bold text-dark" id="prev-d-book">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">SOLICITADO EL</span>
                                <span class="fw-bold text-dark" id="prev-d-reqdate">-</span>
                            </div>
                            <div class="d-flex justify-content-between mb-3 pb-3">
                                <span class="text-muted small fw-bold">DIAS DE RETRASO</span>
                                <span class="fw-bold text-danger" id="prev-d-days">0</span>
                            </div>
                            <div class=" rounded-3 p-3 d-flex justify-content-between align-items-center mb-3">
                                <span class="fw-bold text-muted">TOTAL A PAGAR</span>
                                <span class="display-6 fw-bold text-danger" id="prev-d-debt">$0.00</span>
                            </div>
                            <!-- Actions Injection -->
                            <div id="devol-preview-actions"></div>
                        </div>
                     </div>
                     <button class="btn btn-success btn-lg w-100 rounded-pill py-3 fw-bold shadow" id="btn-conf-devol" onclick="AdminBiblio.confirmarDevolucion()">
                        CONFIRMAR DEVOLUCIÓN
                     </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('devol-user').focus(), 500);
    }

    function abrirModalCondonacion() {
        clearLiveAssetStreams();
        _currentCondonacionData = null;
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-secondary text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-shield-check me-3"></i>Retrasos y Condonaciones</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
                <div class="row g-3 mb-4">
                    <div class="col-12">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-person-vcard-fill me-1 text-secondary"></i>Usuario</label>
                        <div class="input-group">
                            <span class="input-group-text bg-secondary bg-opacity-10 border-0"><i class="bi bi-search text-secondary"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="condon-user" placeholder="Ej: 22380123 o correo" autofocus
                                   onkeyup="if(event.key==='Enter') AdminBiblio.buscarCondonaciones()">
                        </div>
                    </div>
                </div>

                <div class="d-grid gap-2 mb-4">
                    <button class="btn btn-secondary rounded-pill border-0 fw-bold shadow-sm py-2" onclick="AdminBiblio.buscarCondonaciones()">
                        <i class="bi bi-search me-2"></i>Buscar retrasos del usuario
                    </button>
                    <button class="btn btn-light rounded-pill border fw-bold shadow-sm py-2" onclick="AdminBiblio.cargarRetrasosRecientes(true)">
                        <i class="bi bi-clock-history me-2"></i>Ver retrasos activos recientes
                    </button>
                </div>

                <div id="condon-results" class="d-none animate__animated animate__fadeIn">
                    <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                        <div class="card-body bg-white p-4">
                            <div class="d-flex justify-content-between mb-3 border-bottom pb-3">
                                <span class="text-muted small fw-bold">USUARIO</span>
                                <span class="fw-bold text-dark" id="condon-user-name">-</span>
                            </div>
                            <div class="d-flex justify-content-between mb-3 pb-3">
                                <span class="text-muted small fw-bold">REGISTROS</span>
                                <span class="fw-bold text-dark" id="condon-count">0</span>
                            </div>
                            <div id="condon-list" class="d-flex flex-column gap-3"></div>
                            <div id="condon-pagination" class="d-flex justify-content-between align-items-center gap-3 mt-4 d-none"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('condon-user')?.focus(), 500);
    }

    function renderCondonacionList(records = [], emptyMessage = 'No hay adeudos o retrasos registrados para este usuario.') {
        const list = document.getElementById('condon-list');
        if (!list) return;

        if (!records.length) {
            list.innerHTML = `<div class="text-center text-muted small py-3">${escapeHtml(emptyMessage)}</div>`;
            return;
        }

        list.innerHTML = records.map((item) => {
            const titulo = escapeHtml(item.tituloLibro || 'Libro');
            const estado = escapeHtml(item.estado || '--');
            const adquisicion = escapeHtml(item.libroAdquisicion || item.adquisicion || item.libroId || '--');
            const estudiante = escapeHtml(item.studentName || 'Usuario');
            const matricula = escapeHtml(item.studentMatricula || item.studentId || 'S/N');
            const academicInfoKind = escapeHtml(item.academicInfoKind || 'Área');
            const academicInfoLabel = escapeHtml(item.academicInfoLabel || 'Sin información');
            const fechaVencimiento = parseDate(item.fechaVencimiento);
            const fechaVencLabel = fechaVencimiento ? fechaVencimiento.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
            const fechaEntrega = parseDate(item.fechaEntrega);
            const fechaEntregaLabel = fechaEntrega ? fechaEntrega.toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '--';
            const fechaMovimiento = parseDate(item.fechaDevolucionReal || item.fechaSolicitud || item.fechaPago);
            const fechaMovimientoLabel = fechaMovimiento ? fechaMovimiento.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
            const deuda = Number(item.montoDeuda) || 0;
            const refDebt = Number(item.montoReferencia) || Number(item.multaOriginal) || 0;
            const dias = Number(item.diasRetraso) || 0;
            const chips = [
                item.condonable
                    ? `<span class="badge bg-danger-subtle text-danger border">Adeudo: $${deuda.toFixed(2)}</span>`
                    : (item.perdonado
                        ? `<span class="badge bg-info text-dark border">Condonado</span>`
                        : (item.sinCobroRetraso
                            ? `<span class="badge bg-primary text-white">Retraso sin cobro</span>`
                            : `<span class="badge bg-success-subtle text-success border">Sin deuda</span>`)),
                dias > 0 ? `<span class="badge bg-light text-dark border">${dias} dia(s) de retraso</span>` : '',
                refDebt > 0 ? `<span class="badge bg-light text-dark border">Referencia: $${refDebt.toFixed(2)}</span>` : '',
                item.estado && item.estado !== 'entregado'
                    ? `<span class="badge bg-light text-dark border text-capitalize">${estado}</span>`
                    : ''
            ].filter(Boolean).join(' ');

            return `
                <div class="border rounded-4 p-3" style="background: #fafafa;">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div class="flex-grow-1">
                            <div class="fw-bold">${titulo}</div>
                            <div class="small text-muted">No. adquisición: ${adquisicion}</div>
                        </div>
                        ${item.condonable ? `
                            <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" onclick="AdminBiblio.condonarRegistro('${escapeJsString(item.id)}')">
                                <i class="bi bi-shield-check me-1"></i>Condonar
                            </button>
                        ` : ''}
                    </div>
                    <div class="row g-2 small mb-3">
                        <div class="col-md-6">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Estudiante</div>
                            <div class="fw-semibold text-dark">${estudiante}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Matrícula</div>
                            <div class="fw-semibold text-dark">${matricula}</div>
                        </div>
                        <div class="col-md-4">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Entregado</div>
                            <div class="fw-semibold text-dark">${fechaEntregaLabel}</div>
                        </div>
                        <div class="col-md-4">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Vencía</div>
                            <div class="fw-semibold text-dark">${fechaVencLabel}</div>
                        </div>
                        <div class="col-md-4">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Retraso</div>
                            <div class="fw-semibold text-dark">${dias} día(s)</div>
                        </div>
                        <div class="col-md-4">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">Multa actual</div>
                            <div class="fw-semibold text-dark">$${deuda.toFixed(2)}</div>
                        </div>
                        <div class="col-md-8">
                            <div class="text-muted text-uppercase fw-bold" style="font-size: .72rem;">${academicInfoKind}</div>
                            <div class="fw-semibold text-dark">${academicInfoLabel}</div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        ${chips}
                    </div>
                    <div class="small text-muted mt-2">Movimiento base: ${fechaMovimientoLabel}</div>
                    ${item.motivoPerdon ? `<div class="small text-muted mt-2 fst-italic">"${escapeHtml(item.motivoPerdon)}"</div>` : ''}
                </div>
            `;
        }).join('');
    }

    function renderCondonacionPanel() {
        const results = document.getElementById('condon-results');
        const userName = document.getElementById('condon-user-name');
        const count = document.getElementById('condon-count');
        const pagination = document.getElementById('condon-pagination');
        if (!results || !userName || !count || !pagination) return;

        const info = _currentCondonacionData || { mode: 'recent', records: [], page: 0, user: null };
        const records = Array.isArray(info.records) ? info.records : [];
        const isRecentMode = info.mode !== 'search';
        const totalPages = isRecentMode ? Math.max(1, Math.ceil(records.length / CONDONACION_PAGE_SIZE)) : 1;
        const safePage = isRecentMode ? Math.min(Math.max(Number(info.page) || 0, 0), totalPages - 1) : 0;
        if (safePage !== info.page) {
            _currentCondonacionData = { ...info, page: safePage };
        }

        const visibleRecords = isRecentMode
            ? records.slice(safePage * CONDONACION_PAGE_SIZE, (safePage + 1) * CONDONACION_PAGE_SIZE)
            : records;

        userName.innerText = isRecentMode
            ? 'Retrasos activos recientes'
            : `${info.user?.nombre || 'Usuario'} (${info.user?.matricula || 'S/N'})`;
        count.innerText = records.length;
        renderCondonacionList(
            visibleRecords,
            isRecentMode
                ? 'No hay préstamos vencidos pendientes por mostrar.'
                : 'No hay adeudos o retrasos registrados para este usuario.'
        );

        if (isRecentMode && records.length > 0) {
            pagination.classList.remove('d-none');
            pagination.innerHTML = `
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" ${safePage === 0 ? 'disabled' : ''} onclick="AdminBiblio.cambiarPaginaCondonacion(-1)">
                    <i class="bi bi-chevron-left me-1"></i>Anterior
                </button>
                <span class="small text-muted fw-bold">Página ${safePage + 1} de ${totalPages}</span>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" ${safePage >= totalPages - 1 ? 'disabled' : ''} onclick="AdminBiblio.cambiarPaginaCondonacion(1)">
                    Siguiente<i class="bi bi-chevron-right ms-1"></i>
                </button>
            `;
        } else {
            pagination.classList.add('d-none');
            pagination.innerHTML = '';
        }

        results.classList.remove('d-none');
    }

    async function cargarRetrasosRecientes(reset = true) {
        try {
            const records = await BiblioService.getRecentOverdueLoans(_ctx, 25);
            _currentCondonacionData = {
                mode: 'recent',
                records,
                page: reset ? 0 : Math.max(Number(_currentCondonacionData?.page) || 0, 0),
                user: null
            };
            renderCondonacionPanel();
        } catch (e) {
            console.error('[AdminBiblio] Error cargando retrasos recientes:', e);
            showToast(e.message, 'danger');
            document.getElementById('condon-results')?.classList.add('d-none');
        }
    }

    function cambiarPaginaCondonacion(direction = 0) {
        if (_currentCondonacionData?.mode === 'search') return;
        const records = Array.isArray(_currentCondonacionData?.records) ? _currentCondonacionData.records : [];
        const totalPages = Math.max(1, Math.ceil(records.length / CONDONACION_PAGE_SIZE));
        const currentPage = Number(_currentCondonacionData?.page) || 0;
        const nextPage = Math.min(Math.max(currentPage + Number(direction || 0), 0), totalPages - 1);
        _currentCondonacionData = { ..._currentCondonacionData, page: nextPage };
        renderCondonacionPanel();
    }

    async function buscarCondonaciones() {
        const query = document.getElementById('condon-user')?.value.trim();
        if (!query) {
            return showToast("Ingresa una matrícula o correo para buscar.", "warning");
        }

        try {
            const info = await BiblioService.getCondonacionInfo(_ctx, query);
            _currentCondonacionData = {
                mode: 'search',
                records: info.records,
                page: 0,
                user: info.user
            };
            renderCondonacionPanel();
        } catch (e) {
            console.error('[AdminBiblio] Error buscando condonaciones:', e);
            showToast(e.message, "danger");
            document.getElementById('condon-results')?.classList.add('d-none');
        }
    }

    async function condonarRegistro(loanId) {
        if (!_currentCondonacionData?.records?.length) return;
        const target = _currentCondonacionData.records.find((item) => item.id === loanId);
        if (!target || !target.condonable) {
            return showToast("Ese registro ya no tiene deuda condonable.", "warning");
        }

        let justificacion = await showPromptModal({
            icon: 'shield-check',
            iconColor: '#6c757d',
            title: 'Condonar registro',
            message: `Explica el motivo de la condonacion para "${escapeHtml(target.tituloLibro || 'Libro')}". El retraso seguira registrado, pero la deuda se eliminara.`,
            placeholder: 'Justificacion...',
            confirmText: 'Confirmar condonacion',
            confirmClass: 'btn-secondary'
        });

        if (justificacion === null) return;
        justificacion = justificacion.trim();
        if (!justificacion) {
            showToast('Debes escribir una justificacion obligatoriamente.', 'warning');
            return;
        }

        try {
            await BiblioService.condonarRegistroPrestamo(_ctx, loanId, justificacion);
            showToast("Registro condonado correctamente.", "success");
            if (_currentCondonacionData?.mode === 'search') {
                await buscarCondonaciones();
            } else {
                await cargarRetrasosRecientes(false);
            }
            loadAdminStats();
        } catch (e) {
            console.error('[AdminBiblio] Error condonando registro:', e);
            showToast(e.message, "danger");
        }
    }



    async function consultarDevolucion() {
        const u = document.getElementById('devol-user').value.trim();
        const b = document.getElementById('devol-book').value.trim();

        if (!u && !b) return showToast("Ingresa datos", "warning");
        if (u && !b) return mostrarLibrosUsuario(u);

        try {
            const info = await BiblioService.getDevolucionInfo(_ctx, u, b);
            _currentDevolData = info;

            document.getElementById('prev-d-user').innerText = `${info.user.nombre} (${info.user.matricula})`;
            document.getElementById('prev-d-book').innerText = info.loan.tituloLibro;
            document.getElementById('prev-d-reqdate').innerText = info.loan.fechaSolicitud.toDate().toLocaleDateString() + ' ' + info.loan.fechaSolicitud.toDate().toLocaleTimeString();
            document.getElementById('prev-d-days').innerText = info.daysLate > 0 ? info.daysLate : 'Ninguno';
            document.getElementById('prev-d-debt').innerText = info.loanPolicy?.lateFeeExempt && info.daysLate > 0
                ? 'Sin cobro'
                : `$${info.fine.toFixed(2)}`;

            let actionsHtml = '';

            // ⚠️ WARNING: OTROS PENDIENTES
            if (info.user.recogidos && info.user.recogidos.length > 0) {
                // El usuario tiene préstamos activos. 
                // Asumimos que la lista incluye el actual. Verificamos si hay > 1.
                // O si por alguna razon el servicio ya lo filtro (poco probable), seria > 0.
                // Mensaje seguro: "X libro(s) pendiente(s)"
                const total = info.user.recogidos.length;
                const others = total - 1;
                if (others > 0) {
                    actionsHtml += `
                        <div class="alert alert-warning d-flex align-items-center gap-2 small p-2 mb-3">
                            <i class="bi bi-info-circle-fill fs-4"></i>
                            <div>
                                <strong>¡Ojo!</strong>
                                <div class="mb-0">El estudiante aún conserva <strong>${others}</strong> libro(s) más.</div>
                            </div>
                        </div>`;
                }
            }

            if (info.daysLate > 0 && info.loanPolicy?.lateFeeExempt) {
                actionsHtml += `
                    <div class="alert alert-info d-flex align-items-center gap-2 small p-2 mb-3">
                        <i class="bi bi-person-badge-fill fs-4"></i>
                        <div>
                            <strong>Prestamo de personal</strong>
                            <div class="mb-0">Se registraran <strong>${info.daysLate}</strong> dia(s) de retraso sin generar cobro.</div>
                        </div>
                    </div>
                `;
            } else if (info.daysLate > 0) {
                // Show Forgive Option
                actionsHtml += `
                    <div class="mb-3 text-end">
                        <button class="btn btn-warning fw-bold text-dark rounded-pill py-2 shadow-sm" onclick="AdminBiblio.perdonarRetrasoModal()">
                            <i class="bi bi-shield-check me-1"></i>Perdonar Retraso
                        </button>
                    </div>
                `;
            }

            document.getElementById('devol-preview-actions').innerHTML = actionsHtml;

            document.getElementById('devol-preview').classList.remove('d-none');

        } catch (e) {
            showToast(e.message, "danger");
            document.getElementById('devol-preview').classList.add('d-none');
        }
    }


    async function perdonarRetrasoModal() {
        if (!_currentDevolData) return;

        let justificacion = await showPromptModal({
            icon: 'shield-check',
            iconColor: '#e0b801',
            title: 'Perdonar Retraso',
            message: 'Escribe el motivo de la condonación (Ej. Presentó justificante médico):',
            placeholder: 'Justificación...',
            confirmText: 'Confirmar Perdón',
            confirmClass: 'btn-warning text-dark'
        });

        if (justificacion === null) {
            return; // Cancelled
        }

        justificacion = justificacion.trim();
        if (!justificacion) {
            showToast('Debes escribir una justificación obligatoriamente.', 'warning');
            return;
        }

        if (justificacion) {
            const btn = document.getElementById('btn-conf-devol');
            if (btn) btn.disabled = true;
            try {
                await BiblioService.recibirLibroAdmin(_ctx,
                    _currentDevolData.loan.id,
                    _currentDevolData.loan.libroId,
                    true, // isForgiven
                    justificacion.trim()
                );

                const warnings = [];
                await runNonCriticalTask('registro de visita', async () => {
                    try {
                        await BiblioService.registrarVisita(_ctx, {
                            uid: _currentDevolData.user.uid,
                            matricula: _currentDevolData.user.matricula,
                            motivo: 'Devolucion Libro (Perdonado)'
                        });
                    } catch (error) {
                        if (error?.code !== 'VISITA_DUPLICADA_ACTIVA' && error?.code !== 'VISITA_ANONIMA_RECIENTE') {
                            throw error;
                        }
                    }
                }, warnings);

                if (window.EncuestasServicioService) {
                    await runNonCriticalTask('registro de encuesta de servicio', () =>
                        EncuestasServicioService.registerServiceUsage(
                            _ctx,
                            'biblioteca',
                            { action: 'devolucion_admin', loanId: _currentDevolData.loan.id, studentId: _currentDevolData.user.uid },
                            _currentDevolData.user.uid
                        ), warnings);
                }

                showToast("Libro recibido y multa perdonada.", "success");
                if (warnings.length > 0) {
                    showToast(`La devolucion se guardo, pero fallaron procesos secundarios: ${warnings.join(', ')}.`, "warning");
                }
                loadAdminStats();
                bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
                _currentDevolData = null;
            } catch (e) {
                showToast(e.message, "danger");
                if (btn) btn.disabled = false;
            }
        }
    }


    async function confirmarDevolucion() {
        if (!_currentDevolData) return;

        const btn = document.getElementById('btn-conf-devol');
        btn.disabled = true;
        btn.innerText = "Procesando...";

        try {
            await BiblioService.recibirLibroAdmin(_ctx,
                _currentDevolData.loan.id,
                _currentDevolData.loan.libroId,
                false, // NOT forgiven from this button
                ''
            );

            const warnings = [];
            await runNonCriticalTask('registro de visita', async () => {
                try {
                    await BiblioService.registrarVisita(_ctx, {
                        uid: _currentDevolData.user.uid,
                        matricula: _currentDevolData.user.matricula,
                        motivo: 'Devolucion Libro'
                    });
                } catch (error) {
                    if (error?.code !== 'VISITA_DUPLICADA_ACTIVA' && error?.code !== 'VISITA_ANONIMA_RECIENTE') {
                        throw error;
                    }
                }
            }, warnings);

            if (window.EncuestasServicioService) {
                await runNonCriticalTask('registro de encuesta de servicio', () =>
                    EncuestasServicioService.registerServiceUsage(
                        _ctx,
                        'biblioteca',
                        { action: 'devolucion_admin', loanId: _currentDevolData.loan.id, studentId: _currentDevolData.user.uid },
                        _currentDevolData.user.uid
                    ), warnings);
            }

            const toastMsg = _currentDevolData.loanPolicy?.lateFeeExempt && _currentDevolData.daysLate > 0
                ? "Libro recibido. Retraso registrado sin cobro."
                : "Libro recibido correctamente.";
            showToast(toastMsg, "success");
            if (warnings.length > 0) {
                showToast(`La devolucion se guardo, pero fallaron procesos secundarios: ${warnings.join(', ')}.`, "warning");
            }
            _currentDevolData = null;
            loadAdminStats();
            bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "CONFIRMAR DEVOLUCIÓN";
        }
    }

    // --- 4. COMPUTADORAS Y SALA ---


    return {
        abrirModalDevolucion: withState(abrirModalDevolucion),
        abrirModalCondonacion: withState(abrirModalCondonacion),
        cargarRetrasosRecientes: withState(cargarRetrasosRecientes),
        cambiarPaginaCondonacion: withState(cambiarPaginaCondonacion),
        consultarDevolucion: withState(consultarDevolucion),
        buscarCondonaciones: withState(buscarCondonaciones),
        condonarRegistro: withState(condonarRegistro),
        perdonarRetrasoModal: withState(perdonarRetrasoModal),
        confirmarDevolucion: withState(confirmarDevolucion)
    };
})();
