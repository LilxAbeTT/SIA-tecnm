if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Devoluciones = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _currentDevolData = null;

    function syncFromState() {
        _ctx = state.ctx;
        _currentDevolData = state.currentDevolData;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.currentDevolData = _currentDevolData;
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
            document.getElementById('prev-d-debt').innerText = `$${info.fine.toFixed(2)}`;

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

            if (info.daysLate > 0) {
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

            showToast("Libro recibido correctamente.", "success");
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
        consultarDevolucion: withState(consultarDevolucion),
        perdonarRetrasoModal: withState(perdonarRetrasoModal),
        confirmarDevolucion: withState(confirmarDevolucion)
    };
})();
