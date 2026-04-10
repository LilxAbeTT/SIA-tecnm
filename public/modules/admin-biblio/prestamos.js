if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Prestamos = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _currentPrestamoData = null;

    function syncFromState() {
        _ctx = state.ctx;
        _currentPrestamoData = state.currentPrestamoData;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.currentPrestamoData = _currentPrestamoData;
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
    function abrirModalDevolucion(...args) { return window.AdminBiblio.abrirModalDevolucion(...args); }
    function consultarDevolucion(...args) { return window.AdminBiblio.consultarDevolucion(...args); }
    function perdonarRetrasoModal(...args) { return window.AdminBiblio.perdonarRetrasoModal(...args); }
    function confirmarDevolucion(...args) { return window.AdminBiblio.confirmarDevolucion(...args); }
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

    function abrirModalPrestamo() {
        clearLiveAssetStreams();
        _currentPrestamoData = null;
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-warning text-dark p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-book-half me-3"></i>Prestar Libro</h3>
                <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 ">
                 <div class="row g-3 mb-4">
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-mortarboard-fill me-1 text-warning"></i>Estudiante</label>
                        <div class="input-group">
                            <span class="input-group-text bg-warning bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-warning"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="prestamo-user" placeholder="Ej: 22380123" autofocus
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarPrestamo()">
                        </div>
                   </div>
                   <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted"><i class="bi bi-journal-bookmark-fill me-1 text-warning"></i>Libro</label>
                        <div class="input-group">
                            <span class="input-group-text bg-warning bg-opacity-10 border-0"><i class="bi bi-upc-scan text-warning"></i></span>
                            <input type="text" class="form-control rounded-end fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="prestamo-book" placeholder="Ej: B-001"
                                   onkeyup="if(event.key==='Enter') AdminBiblio.consultarPrestamo()">
                        </div>
                   </div>
                </div>
                <div id="prestamo-scan-status" class="small text-center mt-2 d-none"></div>
                
                <div class="d-grid mb-4">
                    <button class="btn btn-warning rounded-pill border-0 fw-bold shadow-sm py-2" onclick="AdminBiblio.consultarPrestamo()">
                        <i class="bi bi-search me-2"></i>Verificar Disponibilidad
                    </button>
                </div>

                <div id="lista-libros-container" class="mb-4"></div>

                <!-- Preview Area -->
                <div id="prestamo-preview" class="d-none animate__animated animate__fadeIn">
                     <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                        <div class="card-body bg-white p-4">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">USUARIO</span>
                                <span class="fw-bold text-dark" id="prev-p-user">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">LIBRO</span>
                                <span class="fw-bold text-dark" id="prev-p-book">-</span>
                            </div>
                             <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted small fw-bold">ENTREGA ESPERADA</span>
                                <span class="fw-bold text-dark" id="prev-p-date">-</span>
                            </div>
                            <div class="mt-3 pt-3 border-top" id="prev-p-alert-box">
                                <!-- Status here -->
                            </div>
                        </div>
                     </div>
                     <button class="btn btn-warning btn-lg w-100 rounded-pill py-3 fw-bold shadow" id="btn-conf-prestamo" onclick="AdminBiblio.confirmarPrestamo()" disabled>
                        CONFIRMAR PRÉSTAMO
                     </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('prestamo-user').focus(), 500);
    }



    async function consultarPrestamo() {
        const u = document.getElementById('prestamo-user').value.trim();
        const b = document.getElementById('prestamo-book').value.trim();

        if (!u && !b) return showToast("Ingresa datos", "warning");
        if (u && !b) return mostrarLibrosUsuario(u);

        try {
            const info = await BiblioService.getPrestamoInfo(_ctx, u, b);
            _currentPrestamoData = info;

            document.getElementById('prev-p-user').innerText = `${info.user.nombre} (${info.user.matricula})`;
            document.getElementById('prev-p-book').innerText = info.book.titulo;
            document.getElementById('prev-p-date').innerText = info.borrowerPolicy?.requiresConfirmation
                ? 'Se define al confirmar'
                : info.returnDate.toLocaleDateString();

            const alertBox = document.getElementById('prev-p-alert-box');
            const confirmBtn = document.getElementById('btn-conf-prestamo');

            let htmlContent = '';

            // ⚠️ WARNING: PENDIENTES
            if (info.user.recogidos && info.user.recogidos.length > 0) {
                htmlContent += `
                    <div class="alert alert-warning d-flex align-items-center gap-2 small p-2 mb-2">
                        <i class="bi bi-exclamation-triangle-fill fs-4"></i>
                        <div>
                            <strong>¡Atención!</strong>
                            <div class="mb-0">El usuario tiene <strong>${info.user.recogidos.length}</strong> préstamos pendientes sin devolver.</div>
                        </div>
                    </div>`;
            }

            if (info.loanPolicy?.isWeekly) {
                htmlContent += `
                    <div class="alert alert-info d-flex align-items-center gap-2 small p-2 mb-2">
                        <i class="bi bi-journal-richtext fs-4"></i>
                        <div>
                            <strong>Prestamo especial</strong>
                            <div class="mb-0">Este libro de ${escapeHtml(info.book.categoria || 'literatura')} dura <strong>1 semana</strong>.</div>
                        </div>
                    </div>`;
            }

            if (info.borrowerPolicy?.requiresConfirmation) {
                htmlContent += `
                    <div class="alert alert-primary d-flex align-items-center gap-2 small p-2 mb-2">
                        <i class="bi bi-person-badge fs-4"></i>
                        <div>
                            <strong>Confirmacion requerida</strong>
                            <div class="mb-0">Este usuario no parece alumno regular. Al confirmar se te preguntara si el prestamo es para docente/personal. Si lo es, dura <strong>1 semana</strong> y el retraso solo se registra <strong>sin cobro</strong>.</div>
                        </div>
                    </div>`;
            }

            if (info.canLoan) {
                htmlContent += `<div class="text-success small fw-bold"><i class="bi bi-check-circle me-1"></i> Todo en orden.</div>`;
                confirmBtn.disabled = false;
            } else {
                htmlContent += `<div class="text-danger fw-bold"><i class="bi bi-x-circle me-1"></i> NO SE PUEDE PRESTAR: ${info.reason}</div>`;
                confirmBtn.disabled = true;
            }

            alertBox.innerHTML = htmlContent;

            document.getElementById('prestamo-preview').classList.remove('d-none');
        } catch (e) {
            showToast(e.message, "danger");
            document.getElementById('prestamo-preview').classList.add('d-none');
        }
    }


    async function confirmarPrestamo() {
        if (!_currentPrestamoData) return;
        const btn = document.getElementById('btn-conf-prestamo');
        btn.disabled = true;
        btn.innerText = "Procesando...";

        try {
            let staffLoan = false;
            if (_currentPrestamoData.borrowerPolicy?.requiresConfirmation) {
                staffLoan = window.confirm(
                    'Este usuario no parece alumno regular.\n\nAceptar = prestamo para docente/personal administrativo: dura 1 semana y el retraso se registra sin cobro.\n\nCancelar = prestamo normal.'
                );
            }

            await BiblioService.prestarLibroManual(_ctx, _currentPrestamoData.user.uid, _currentPrestamoData.book.id, { staffLoan });

            const warnings = [];
            await runNonCriticalTask('registro de visita', async () => {
                try {
                    await BiblioService.registrarVisita(_ctx, {
                        uid: _currentPrestamoData.user.uid,
                        matricula: _currentPrestamoData.user.matricula,
                        motivo: 'Prestamo Libro'
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
                        { action: 'prestamo_admin', bookId: _currentPrestamoData.book.id, studentId: _currentPrestamoData.user.uid },
                        _currentPrestamoData.user.uid
                    ), warnings);
            }

            const durationMsg = staffLoan
                ? " Prestamo confirmado para personal: dura 1 semana y el retraso se registra sin cobro."
                : (_currentPrestamoData.loanPolicy?.isWeekly ? " Prestamo configurado por 1 semana." : "");
            showToast(`Prestamo realizado exitosamente.${durationMsg}`, "success");
            if (warnings.length > 0) {
                showToast(`Prestamo guardado, pero fallaron procesos secundarios: ${warnings.join(', ')}.`, "warning");
            }
            _currentPrestamoData = null;
            loadAdminStats();
            bootstrap.Modal.getInstance(document.getElementById('modal-admin-action')).hide();
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Confirmar Prestamo";
        }
    }

    // --- 3. MODAL DEVOLVER LIBRO ---

    return {
        abrirModalPrestamo: withState(abrirModalPrestamo),
        consultarPrestamo: withState(consultarPrestamo),
        confirmarPrestamo: withState(confirmarPrestamo)
    };
})();
