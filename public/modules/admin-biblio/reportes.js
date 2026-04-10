if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Reportes = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _adminStatsInterval = null;
    let _clockInterval = null;
    let _pcGridUnsub = null;
    let _scannerStationsUnsub = null;
    let _currentAdminStats = null;
    let _lastScannerScanKey = '';
    let _scannerSessions = {};
    let _visitUser = null;
    let _currentServiceType = null;
    let _selectedAssetId = null;
    let _selectedTimeBlock = null;

    function syncFromState() {
        _ctx = state.ctx;
        _adminStatsInterval = state.adminStatsInterval;
        _clockInterval = state.clockInterval;
        _pcGridUnsub = state.pcGridUnsub;
        _scannerStationsUnsub = state.scannerStationsUnsub;
        _currentAdminStats = state.currentAdminStats;
        _lastScannerScanKey = state.lastScannerScanKey;
        _scannerSessions = state.scannerSessions || {};
        _visitUser = state.visitUser;
        _currentServiceType = state.currentServiceType;
        _selectedAssetId = state.selectedAssetId;
        _selectedTimeBlock = state.selectedTimeBlock;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.adminStatsInterval = _adminStatsInterval;
        state.clockInterval = _clockInterval;
        state.pcGridUnsub = _pcGridUnsub;
        state.scannerStationsUnsub = _scannerStationsUnsub;
        state.currentAdminStats = _currentAdminStats;
        state.lastScannerScanKey = _lastScannerScanKey;
        state.scannerSessions = _scannerSessions;
        state.visitUser = _visitUser;
        state.currentServiceType = _currentServiceType;
        state.selectedAssetId = _selectedAssetId;
        state.selectedTimeBlock = _selectedTimeBlock;
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
    function resetServiceSelection() {
        _selectedAssetId = null;
        _selectedTimeBlock = null;
        state.selectedAssetId = null;
        state.selectedTimeBlock = null;
        const confirmBtn = document.getElementById('btn-confirm-service');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = 'Confirmar Reserva';
        }
    }

    function clearLiveAssetStreams() {
        if (_pcGridUnsub) {
            try { _pcGridUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing PC stream:', error); }
            _pcGridUnsub = null;
        }

        if (state.configAssetsUnsub) {
            try { state.configAssetsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing config stream:', error); }
            state.configAssetsUnsub = null;
        }

        state.pcGridUnsub = null;
    }

    function clearScannerListener() {
        if (_scannerStationsUnsub) {
            try { _scannerStationsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing scanner listener:', error); }
            _scannerStationsUnsub = null;
        }

        state.scannerStationsUnsub = null;
    }

    function cleanupRuntime(...args) { return window.AdminBiblio.cleanupRuntime(...args); }
    function init(...args) { return window.AdminBiblio.init(...args); }
    function abrirModalHistorial(...args) { return window.AdminBiblio.abrirModalHistorial(...args); }
    function cargarHistorial(...args) { return window.AdminBiblio.cargarHistorial(...args); }
    function generarItemHistorial(...args) { return window.AdminBiblio.generarItemHistorial(...args); }
    function abrirModalPrestamo(...args) { return window.AdminBiblio.abrirModalPrestamo(...args); }
    function consultarPrestamo(...args) { return window.AdminBiblio.consultarPrestamo(...args); }
    function confirmarPrestamo(...args) { return window.AdminBiblio.confirmarPrestamo(...args); }
    function abrirModalDevolucion(...args) { return window.AdminBiblio.abrirModalDevolucion(...args); }
    function consultarDevolucion(...args) { return window.AdminBiblio.consultarDevolucion(...args); }
    function perdonarRetrasoModal(...args) { return window.AdminBiblio.perdonarRetrasoModal(...args); }
    function confirmarDevolucion(...args) { return window.AdminBiblio.confirmarDevolucion(...args); }
    function abrirModalCondonacion(...args) { return window.AdminBiblio.abrirModalCondonacion(...args); }
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

    function setVisitActionButtonsDisabled(disabled) {
        document.querySelectorAll('#visit-options-container button, #visit-unregistered-container button, #btn-add-team-member').forEach(button => {
            if (disabled) {
                button.dataset.wasDisabled = button.disabled ? '1' : '0';
                button.disabled = true;
                return;
            }

            if (button.dataset.wasDisabled === '0') {
                button.disabled = false;
            }
            delete button.dataset.wasDisabled;
        });
    }

    function closeAdminActionModal() {
        const modalEl = document.getElementById('modal-admin-action');
        if (!modalEl) return;
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    function updateVisitScanStatus(message = '', tone = 'primary') {
        const el = document.getElementById('visit-scan-status');
        if (!el) return;

        if (!message) {
            el.textContent = '';
            el.className = 'small text-center mt-2 d-none';
            return;
        }

        el.textContent = message;
        el.className = `small text-center mt-2 text-${tone}`;
    }

    function getScanSourceLabel(scan = {}) {
        return scan.stationName || scan.stationId || 'escáner de biblioteca';
    }

    function normalizeScannerMode(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (['prestamo', 'loan'].includes(normalized)) return 'prestamo';
        if (['devolucion', 'return', 'devolucion_libro'].includes(normalized)) return 'devolucion';
        if (['pc', 'computadora', 'computadoras'].includes(normalized)) return 'pc';
        if (['servicio', 'reserva'].includes(normalized)) return 'servicio';
        return 'visita';
    }

    function updateDualScanStatus(elementId, message = '', tone = 'primary') {
        const el = document.getElementById(elementId);
        if (!el) return;

        if (!message) {
            el.textContent = '';
            el.className = 'small text-center mt-2 d-none';
            return;
        }

        el.textContent = message;
        el.className = `small text-center mt-2 text-${tone}`;
    }

    function getScannerSession(stationId, mode) {
        const key = stationId || 'default-station';
        const existing = _scannerSessions[key];
        if (existing && existing.mode === mode) return existing;

        const next = {
            stationId: key,
            mode,
            userQuery: '',
            bookQuery: '',
            stationName: ''
        };
        _scannerSessions[key] = next;
        syncToState();
        return next;
    }

    function resetScannerSession(stationId) {
        const key = stationId || 'default-station';
        delete _scannerSessions[key];
        syncToState();
    }

    function isLikelyUserIdentifier(value) {
        const candidate = String(value || '').trim();
        if (!candidate) return false;
        return /^\d{7,10}$/.test(candidate)
            || candidate.includes('@')
            || /^[A-Za-z0-9_-]{20,}$/.test(candidate);
    }

    async function resolveBiblioScanRole(query, session = {}) {
        const candidate = String(query || '').trim();
        if (!candidate) return { role: null, label: '' };

        const preferUser = isLikelyUserIdentifier(candidate);
        const attempts = preferUser ? ['user', 'book'] : ['book', 'user'];

        if (session.userQuery && !session.bookQuery) attempts.unshift('book');
        if (session.bookQuery && !session.userQuery) attempts.unshift('user');

        const orderedAttempts = [...new Set(attempts)];

        for (const attempt of orderedAttempts) {
            if (attempt === 'user') {
                try {
                    const user = await BiblioService.findUserByQuery(_ctx, candidate);
                    if (user?.uid) {
                        return {
                            role: 'user',
                            query: user.matricula || candidate,
                            label: `${user.nombre || 'Usuario'} (${user.matricula || candidate})`
                        };
                    }
                } catch (error) {
                    console.warn('[BiblioAdmin] No se pudo resolver usuario de escaneo:', error);
                }
            }

            if (attempt === 'book') {
                try {
                    const book = await BiblioService.findBookByCode(_ctx, candidate);
                    if (book?.id) {
                        return {
                            role: 'book',
                            query: candidate,
                            label: book.titulo || candidate
                        };
                    }
                } catch (error) {
                    console.warn('[BiblioAdmin] No se pudo resolver libro de escaneo:', error);
                }
            }
        }

        return { role: null, query: candidate, label: candidate };
    }

    function fillScannerFlowFields(fieldIds = {}, session = {}, statusElementId = '', scan = {}) {
        const userInput = fieldIds.user ? document.getElementById(fieldIds.user) : null;
        const bookInput = fieldIds.book ? document.getElementById(fieldIds.book) : null;

        if (userInput) userInput.value = session.userQuery || '';
        if (bookInput) bookInput.value = session.bookQuery || '';

        if (session.userQuery && session.bookQuery) {
            updateDualScanStatus(
                statusElementId,
                `Datos completos recibidos desde ${getScanSourceLabel(scan)}. Verificando usuario y libro.`,
                'success'
            );
            return;
        }

        if (session.userQuery) {
            updateDualScanStatus(
                statusElementId,
                `Usuario escaneado desde ${getScanSourceLabel(scan)}. Falta escanear el libro.`,
                'primary'
            );
            return;
        }

        if (session.bookQuery) {
            updateDualScanStatus(
                statusElementId,
                `Libro escaneado desde ${getScanSourceLabel(scan)}. Falta escanear el usuario.`,
                'warning'
            );
            return;
        }

        updateDualScanStatus(statusElementId, '');
    }

    function isLoanFlowModalOpen(mode = 'prestamo') {
        const userFieldId = mode === 'devolucion' ? 'devol-user' : 'prestamo-user';
        const modalEl = document.getElementById('modal-admin-action');
        if (!modalEl?.classList?.contains('show')) return false;
        return Boolean(document.getElementById(userFieldId));
    }

    function openCompletedLoanScannerFlow(modalConfig = {}, session = {}, scan = {}) {
        modalConfig.open();

        const hydrateAndConsult = () => {
            fillScannerFlowFields(modalConfig.fieldIds, session, modalConfig.statusId, scan);
            if (session.userQuery && session.bookQuery) {
                void modalConfig.consult();
            }
        };

        setTimeout(() => {
            const userFieldId = modalConfig.fieldIds?.user;
            if (userFieldId && !document.getElementById(userFieldId)) {
                modalConfig.open();
                setTimeout(hydrateAndConsult, 200);
                return;
            }
            hydrateAndConsult();
        }, 250);
    }

    async function applyLoanScannerPayload(scan = {}, mode = 'prestamo') {
        const query = scan.queryCandidate || scan.rawCode || '';
        if (!query) {
            showToast('Se recibio un escaneo sin datos utilizables.', 'warning');
            return;
        }

        const modalConfig = mode === 'devolucion'
            ? {
                open: abrirModalDevolucion,
                consult: consultarDevolucion,
                fieldIds: { user: 'devol-user', book: 'devol-book' },
                statusId: 'devol-scan-status',
                modeLabel: 'devolucion'
            }
            : {
                open: abrirModalPrestamo,
                consult: consultarPrestamo,
                fieldIds: { user: 'prestamo-user', book: 'prestamo-book' },
                statusId: 'prestamo-scan-status',
                modeLabel: 'prestamo'
            };

        _lastScannerScanKey = scan.scanKey || `${scan.stationId || mode}:${query}`;
        let session = getScannerSession(scan.stationId, mode);

        if (session.userQuery && session.bookQuery) {
            resetScannerSession(scan.stationId);
            session = getScannerSession(scan.stationId, mode);
        }

        session.stationName = scan.stationName || session.stationName || '';

        const resolved = await resolveBiblioScanRole(query, session);
        if (!resolved.role) {
            showToast(`El escaneo no coincide con usuario ni libro para ${modalConfig.modeLabel}.`, 'warning');
            return;
        }

        if (resolved.role === 'user') {
            session.userQuery = resolved.query || query;
            syncToState();
            showToast(`Usuario detectado para ${modalConfig.modeLabel}.`, 'info');
        } else {
            session.bookQuery = resolved.query || query;
            syncToState();
            showToast(`Libro detectado para ${modalConfig.modeLabel}.`, 'info');
        }

        if (!(session.userQuery && session.bookQuery)) {
            if (isLoanFlowModalOpen(mode)) {
                fillScannerFlowFields(modalConfig.fieldIds, session, modalConfig.statusId, scan);
            } else {
                const missingLabel = session.userQuery ? 'libro' : 'usuario';
                showToast(
                    `Escaneo recibido para ${modalConfig.modeLabel}. Falta escanear el ${missingLabel}.`,
                    'info'
                );
            }
            return;
        }

        openCompletedLoanScannerFlow(modalConfig, session, scan);
    }

    async function applyVisitScanPayload(scan = {}) {
        const query = scan.queryCandidate || scan.rawCode || '';
        if (!query) {
            showToast('Se recibió un escaneo sin datos utilizables.', 'warning');
            return;
        }

        _lastScannerScanKey = scan.scanKey || `${scan.stationId || 'scanner'}:${query}`;
        abrirModalVisita();

        setTimeout(() => {
            const input = document.getElementById('visita-input-matricula');
            if (!input) return;

            input.disabled = false;
            input.value = query;
            input.focus();
            input.select?.();
            updateVisitScanStatus(`Escaneo recibido desde ${getScanSourceLabel(scan)}. Revisa los datos antes de confirmar.`);
            void verificarUsuarioVisita();
        }, 250);
    }

    function setupVisitScannerListener() {
        clearScannerListener();

        if (!_ctx?.db || !window.ScannerService?.listenModuleStations) {
            return;
        }

        _scannerStationsUnsub = window.ScannerService.listenModuleStations(_ctx, 'biblio', (scan) => {
            if (!scan?.scanKey || scan.scanKey === _lastScannerScanKey) return;
            const mode = normalizeScannerMode(scan.mode);

            if (mode === 'prestamo') {
                void applyLoanScannerPayload(scan, 'prestamo');
                return;
            }

            if (mode === 'devolucion') {
                void applyLoanScannerPayload(scan, 'devolucion');
                return;
            }

            showToast(`Escaneo recibido desde ${getScanSourceLabel(scan)}.`, 'info');
            void applyVisitScanPayload(scan);
        });

        state.scannerStationsUnsub = _scannerStationsUnsub;
    }

    function formatVisitDuplicateHour(visit = {}) {
        const rawDate = visit.createdAtMs || visit.fecha || null;
        const parsedDate = parseDate(rawDate);
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) return '';
        return parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function showActiveVisitDuplicateModal(error) {
        const visit = error?.existingVisit || {};
        const personName = escapeHtml(visit.studentName || 'Esta persona');
        const matricula = escapeHtml(visit.matricula || 'S/N');
        const hour = formatVisitDuplicateHour(visit);
        const hourText = hour ? ` desde las <strong>${escapeHtml(hour)}</strong>` : '';

        showConfirmModal({
            icon: 'person-check-fill',
            iconColor: '#0d6efd',
            title: 'Visita ya registrada',
            message: `<strong>${personName}</strong>${hourText} ya tiene una visita en curso.<br>Matrícula: <strong>${matricula}</strong>.`,
            confirmText: 'Entendido',
            confirmClass: 'btn-primary',
            onConfirm: async () => { }
        });
    }

    function promptRecentAnonymousDuplicate(error, onConfirm) {
        const visit = error?.existingVisit || {};
        const hour = formatVisitDuplicateHour(visit);
        const hourText = hour ? ` a las <strong>${escapeHtml(hour)}</strong>` : '';

        showConfirmModal({
            icon: 'question-circle-fill',
            iconColor: '#f59e0b',
            title: 'Visita muy reciente',
            message: `Hace unos segundos ya registraste una visita similar${hourText}.<br>Si es otra persona, confirma para guardarla de todos modos.`,
            confirmText: 'Sí, es otra persona',
            confirmClass: 'btn-warning text-dark',
            sizeClass: 'modal-md',
            onConfirm
        });
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

            await BiblioService.finalizarVisita(_ctx, visitId, { uid, matricula });

            showToast(`Salida registrada.${msgDetails}`, "success");
            loadAdminStats(); // Refresh list

        } catch (e) { showToast(e.message, "danger"); }
    }

    // ============================================
    //              VISTA ADMIN 3.0 (MEGA INTUITIVE)
    // ============================================


    function initAdmin() {
        const container = document.getElementById('view-biblio');

        container.innerHTML = `
            <!-- HEADER -->
            <div class="d-flex justify-content-between align-items-center mb-5 animate__animated animate__fadeIn">
                <div class="d-flex align-items-center gap-4">
                     <div class="bg-white p-3 rounded-4 shadow-sm text-center" style="min-width: 100px;">
                        <img src="./images/logo-sia-mob.png" class="img-fluid" style="max-height: 60px;" onerror="this.style.display='none'">
                        <img src="./images/logo-ites.png" class="img-fluid" style="max-height: 80px;" onerror="this.style.display='none'">
                     </div>
                     <div>
                        <h2 class="fw-bold text-dark mb-0">Biblioteca Escolar</h2>
                        <p class="text-muted mb-0">Panel de Administración</p>
                     </div>
                </div>
                <div class="text-end d-flex align-items-center gap-3">
                    <button class="btn btn-outline-primary rounded-pill btn-sm d-none d-md-block shadow-sm" onclick="AdminBiblio.forzarRecargaCache()">
                        <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
                    </button>
                    <div class="text-end">
                        <h3 class="fw-bold text-dark mb-0 font-monospace" id="admin-clock-time">--:--:--</h3>
                        <p class="text-muted mb-0 small text-capitalize" id="admin-clock-date">Cargando fecha...</p>
                    </div>
                </div>
            </div>

            <!-- DASHBOARD CONTENT -->
            <div id="admin-dashboard-content" class="container-fluid px-4 py-4">
                
                <!-- ACTIONS ROW -->
                <div class="row g-4 mb-4 row-cols-1 row-cols-md-6 justify-content-center">
                    <!-- 1. REGISTRAR VISITA -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalVisita()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-primary-subtle p-4 rounded-circle mb-4 text-primary">
                                    <i class="bi bi-person-check-fill display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Registrar Visita</h4>
                                <p class="text-muted small mb-0">Consulta, Individual o Equipo</p>
                            </div>
                        </div>
                    </div>

                    <!-- 2. PRESTAR LIBRO -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalPrestamo()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-warning-subtle p-4 rounded-circle mb-4 text-warning">
                                    <i class="bi bi-book-half display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Prestar Libro</h4>
                                <p class="text-muted small mb-0">Salida de material</p>
                            </div>
                        </div>
                    </div>

                    <!-- 3. DEVOLVER LIBRO -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalDevolucion()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-success-subtle p-4 rounded-circle mb-4 text-success">
                                    <i class="bi bi-box-arrow-in-down display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Devolver Libro</h4>
                                <p class="text-muted small mb-0">Reingreso y cobros</p>
                            </div>
                        </div>
                    </div>

                    <!-- 4. COMPUTADORAS -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalComputadoras()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-info-subtle p-4 rounded-circle mb-4 text-info">
                                    <i class="bi bi-pc-display display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Computadoras</h4>
                                <p class="text-muted small mb-0">PC y sala de lectura</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 5. CONDONACION -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalCondonacion()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-secondary-subtle p-4 rounded-circle mb-4 text-secondary">
                                    <i class="bi bi-shield-check display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Retrasos y Condonaciones</h4>
                                <p class="text-muted small mb-0">Activos y por usuario</p>
                            </div>
                        </div>
                    </div>

                    <!-- 6. GESTION LIBROS (NEW) -->
                    <div class="col">
                        <div class="card border-0 shadow-lg h-100 hover-scale cursor-pointer bg-white" onclick="AdminBiblio.abrirModalGestionLibros()">
                            <div class="card-body p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                <div class="bg-dark-subtle p-4 rounded-circle mb-4 text-dark">
                                    <i class="bi bi-journal-album display-4"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Gestión Libros</h4>
                                <p class="text-muted small mb-0">Altas y Edición</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                 <!-- CONFIG BUTTON ROW -->
                 <div class="col-12 text-center mt-2 mb-4">
                    <div class="d-inline-flex flex-wrap justify-content-center gap-2">
                        <button class="btn btn-light rounded-pill px-4 text-muted small shadow-sm border" onclick="AdminBiblio.abrirModalConfig()">
                            <i class="bi bi-gear-fill me-2"></i>Configuración de Espacios
                        </button>
                        <button class="btn btn-light rounded-pill px-4 text-muted small shadow-sm border" onclick="AdminBiblio.abrirModalDiasInhabiles()">
                            <i class="bi bi-calendar-x-fill me-2"></i>Días inhábiles
                        </button>
                    </div>
                 </div>
            </div>

            <!-- STATS CARDS -->
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-5 g-4 mt-2 animate__animated animate__fadeInUp" style="animation-delay:0.2s;">
                <!-- Stats Visitas -->
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8f4fd 0%, #f8fbff 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-primary bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-person-check-fill text-primary"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Visitas</span>
                                </div>
                                <span class="badge bg-primary rounded-pill" id="stat-visitas-count">0</span>
                            </div>
                            <div id="stat-visitas-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                            <div class="mt-auto pt-2 border-top border-primary border-opacity-25 text-center">
                                <button class="btn btn-sm btn-link text-decoration-none fw-bold text-primary w-100" onclick="AdminBiblio.abrirModalHistorial('visitas')">Ver más <i class="bi bi-chevron-down ms-1"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats Préstamos -->
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, rgba(255,210,77,0.08) 0%, rgba(255,210,77,0.03) 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-warning bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-book-half text-warning"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Préstamos</span>
                                </div>
                                <span class="badge bg-warning text-dark rounded-pill" id="stat-prestamos-count">0</span>
                            </div>
                            <div id="stat-prestamos-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                            <div class="mt-auto pt-2 border-top border-warning border-opacity-25 text-center">
                                <button class="btn btn-sm btn-link text-decoration-none fw-bold text-warning w-100" onclick="AdminBiblio.abrirModalHistorial('prestamos')">Ver más <i class="bi bi-chevron-down ms-1"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats Devoluciones -->
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8faf0 0%, #f5fdf9 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-success bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-box-arrow-in-down text-success"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Devoluciones</span>
                                </div>
                                <span class="badge bg-success rounded-pill" id="stat-devol-count">0</span>
                            </div>
                            <div id="stat-devol-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                            <div class="mt-auto pt-2 border-top border-success border-opacity-25 text-center">
                                <button class="btn btn-sm btn-link text-decoration-none fw-bold text-success w-100" onclick="AdminBiblio.abrirModalHistorial('devoluciones')">Ver más <i class="bi bi-chevron-down ms-1"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Stats PCs -->
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #e8f8fd 0%, #f3fcff 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="bg-info bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                        <i class="bi bi-pc-display text-info"></i>
                                    </div>
                                    <span class="fw-bold small text-dark">Activos en uso</span>
                                </div>
                                <span class="badge bg-info rounded-pill" id="stat-pcs-count">0</span>
                            </div>
                            <div id="stat-pcs-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                            <div class="mt-auto pt-2 border-top border-info border-opacity-25 text-center">
                                <button class="btn btn-sm btn-link text-decoration-none fw-bold text-info w-100" onclick="AdminBiblio.abrirModalHistorial('pcs')">Ver más <i class="bi bi-chevron-down ms-1"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Resumen -->
                <div class="col">
                    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: linear-gradient(135deg, #f3f0ff 0%, #faf8ff 100%);">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <div class="bg-secondary bg-opacity-10 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                                    <i class="bi bi-bar-chart-line text-secondary"></i>
                                </div>
                                <span class="fw-bold small text-dark">Estadísticas</span>
                            </div>
                            <div id="stat-summary-list" class="d-flex flex-column gap-2">
                                <div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- STATS ROW -->
            </div>

            <!-- MODAL GENERICO ADMIN -->
            <div class="modal fade" id="modal-admin-action" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg rounded-5 overflow-hidden" id="modal-admin-body">
                        <!-- Content Injected -->
                    </div>
                </div>
            </div>

            <div class="modal fade" id="modal-servicio-reserva" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow-lg" id="servicio-reserva-content"></div>
                </div>
            </div>
        `;

        clearLiveAssetStreams();
        setupVisitScannerListener();
        startClock();
        loadAdminStats();

        const adminModalEl = document.getElementById('modal-admin-action');
        if (adminModalEl) {
            adminModalEl.removeEventListener('hidden.bs.modal', clearLiveAssetStreams);
            adminModalEl.addEventListener('hidden.bs.modal', clearLiveAssetStreams);
        }

        // Refrescar expiraciones de PC cada 60 segundos
        if (_adminStatsInterval) clearInterval(_adminStatsInterval);

        // Contador interno para solo refrescar stats de firebase cada 5 minutos (evitar exceso de lecturas)
        let _ticks = 4;

        _adminStatsInterval = setInterval(() => {
            if (document.hidden) return;
            _ticks++;
            // Cada 5 minutos (5 ticks de 60s) recarga los stats masivos
            if (_ticks >= 5) {
                loadAdminStats();
                _ticks = 0;
            }

            // *REMOVIDO* el auto-check global para evitar que relojes locales desfasados liberen PCs antes de tiempo.
            // Ahora la limpieza es manual vía el botón "Limpiar Expirados" en el Modal de Computadoras.
        }, 15 * 60 * 1000);
    }


    function forzarRecargaCache() {
        showToast("Actualizando datos...", "info");
        if (window.BiblioService && BiblioService.invalidateCatalogCache) {
            BiblioService.invalidateCatalogCache();
        }
        loadAdminStats();
    }


    function startClock() {
        const update = () => {
            const now = new Date();
            const time = document.getElementById('admin-clock-time');
            const date = document.getElementById('admin-clock-date');
            if (time) time.innerText = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (date) date.innerText = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        };
        update();
        if (_clockInterval) clearInterval(_clockInterval);
        _clockInterval = setInterval(update, 1000);
    }

    // --- STATS CARDS LOADER ---

    async function loadVisitSummaryCard() {
        const summaryEl = document.getElementById('stat-summary-list');
        if (!summaryEl || !_ctx) return;

        try {
            const stats = await BiblioService.getVisitSummaryStats(_ctx);
            summaryEl.innerHTML = `
                <div class="d-flex justify-content-between align-items-center bg-white rounded-3 p-2 shadow-sm">
                    <span class="small text-muted">Visitas hoy</span>
                    <span class="fw-bold text-dark">${stats.totalDia}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center bg-white rounded-3 p-2 shadow-sm">
                    <span class="small text-muted">Visitas semana</span>
                    <span class="fw-bold text-dark">${stats.totalSemana}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center bg-white rounded-3 p-2 shadow-sm">
                    <span class="small text-muted">Visitas anual</span>
                    <span class="fw-bold text-dark">${stats.totalAnio}</span>
                </div>
            `;
        } catch (e) {
            console.warn('[ADMIN SUMMARY] Error loading:', e);
            summaryEl.innerHTML = '<p class="text-muted small text-center mb-0">No se pudieron cargar las estadisticas.</p>';
        }
    }

    async function loadAdminStats() {
        try {
            const stats = await BiblioService.getDashboardStats(_ctx);
            _currentAdminStats = stats;

            // ---- VISITAS ----
            const visitasEl = document.getElementById('stat-visitas-list');
            const visitasCount = document.getElementById('stat-visitas-count');
            if (visitasCount) visitasCount.innerText = stats.visitasHoy;
            if (visitasEl) {
                if (stats.ultimasVisitas.length === 0) {
                    visitasEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin visitas hoy</p>';
                } else {
                    visitasEl.innerHTML = stats.ultimasVisitas.map(v => {
                        const hora = v.fecha?.toDate ? v.fecha.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('visita', '${v.id}')">
                                <div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-person-fill text-primary" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${escapeHtml(v.studentName || v._resolvedStudentName || 'Estudiante')}</div>
                                    <div class="text-muted text-truncate" style="font-size:0.68rem; max-width:180px;">${escapeHtml(v.matricula || v._resolvedStudentMatricula || '')} &bull; ${escapeHtml(v.motivo || 'Visita')}</div>
                                </div>
                                <span class="text-muted" style="font-size:0.65rem; white-space:nowrap;">${hora}</span>
                            </div>`;
                    }).join('');
                }
            }

            // ---- PRÉSTAMOS ----
            const prestEl = document.getElementById('stat-prestamos-list');
            const prestCount = document.getElementById('stat-prestamos-count');
            if (prestCount) prestCount.innerText = stats.prestamosHoy;
            if (prestEl) {
                if (stats.ultimosPrestamos.length === 0) {
                    prestEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin préstamos activos</p>';
                } else {
                    prestEl.innerHTML = stats.ultimosPrestamos.map(p => {
                        const venc = p.fechaVencimiento?.toDate ? p.fechaVencimiento.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '--';
                        const isPendingPickup = p.estado === 'pendiente' || p.estado === 'pendiente_entrega';
                        const secondaryLabel = isPendingPickup
                            ? 'Por recoger'
                            : `Vence: ${venc}`;
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('prestamo', '${p.id}')">
                                <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-book text-warning" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${escapeHtml(p.tituloLibro || 'Libro')}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">${secondaryLabel}</div>
                                </div>
                                <span class="badge ${isPendingPickup ? 'bg-info-subtle text-info' : 'bg-warning-subtle text-warning'}" style="font-size:0.6rem;">${isPendingPickup ? 'Pendiente' : 'Entregado'}</span>
                            </div>`;
                    }).join('');
                }
            }

            // ---- DEVOLUCIONES ----
            const devolEl = document.getElementById('stat-devol-list');
            const devolCount = document.getElementById('stat-devol-count');
            if (devolCount) devolCount.innerText = stats.ultimasDevoluciones.length;
            if (devolEl) {
                if (stats.ultimasDevoluciones.length === 0) {
                    devolEl.innerHTML = '<p class="text-muted small text-center mb-0">Sin devoluciones recientes</p>';
                } else {
                    devolEl.innerHTML = stats.ultimasDevoluciones.map(d => {
                        const fecha = d.fechaDevolucionReal?.toDate ? d.fechaDevolucionReal.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '--';
                        const multa = d.montoDeuda || 0;
                        return `
                            <div class="d-flex flex-column gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('devolucion', '${d.id}')">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                        <i class="bi bi-person-check text-success" style="font-size:0.75rem;"></i>
                                    </div>
                                    <div class="flex-grow-1 overflow-hidden">
                                        <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${d._resolvedStudentName || d.studentId || 'Estudiante'}</div>
                                    </div>
                                    <div class="text-muted text-end" style="font-size:0.65rem; white-space:nowrap;">
                                        <i class="bi bi-clock me-1"></i>${fecha}
                                    </div>
                                </div>
                                <div class="d-flex align-items-center justify-content-between p-1 bg-light rounded-2 border">
                                    <div class="text-truncate text-muted" style="font-size:0.65rem; max-width: 140px;">
                                        <i class="bi bi-journal-text me-1"></i>${escapeHtml(d.tituloLibro || 'Libro')}
                                    </div>
                                    ${multa > 0
                                ? `<span class="badge bg-danger text-white px-2 py-1" style="font-size:0.65rem;">Multa: $${multa}</span>`
                                : `<span class="badge bg-success-subtle text-success px-2 py-1" style="font-size:0.65rem;">Completado</span>`}
                                </div>
                            </div>`;
                    }).join('');
                }
            }

            // ---- PCS ACTIVAS ----
            const pcsEl = document.getElementById('stat-pcs-list');
            const pcsCount = document.getElementById('stat-pcs-count');
            if (pcsCount) pcsCount.innerText = stats.activosOcupados;
            if (pcsEl) {
                if (stats.pcsActivas.length === 0) {
                    pcsEl.innerHTML = '<p class="text-muted small text-center mb-0">Todas disponibles</p>';
                } else {
                    pcsEl.innerHTML = stats.pcsActivas.map(pc => {
                        const safePcId = escapeJsString(pc.id || '');
                        const safePcName = escapeHtml(pc.nombre || 'PC');
                        const safePcMatricula = escapeHtml(pc.occupiedByMatricula || 'En uso');
                        let timeLabel = '';
                        if (pc.expiresAt) {
                            const expMs = pc.expiresAt.toMillis ? pc.expiresAt.toMillis() : pc.expiresAt;
                            const remainMs = expMs - Date.now();
                            timeLabel = remainMs <= 0 ? 'Expirado' : `${Math.ceil(remainMs / 60000)} min`;
                        }
                        return `
                            <div class="d-flex align-items-center gap-2 bg-white rounded-3 p-2 shadow-sm hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('pc', '${safePcId}')">
                                <div class="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:28px;height:28px;min-width:28px;">
                                    <i class="bi bi-pc-display text-info" style="font-size:0.75rem;"></i>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <div class="fw-bold small text-truncate" style="font-size:0.78rem;">${safePcName}</div>
                                    <div class="text-muted" style="font-size:0.68rem;">${safePcMatricula}</div>
                                </div>
                                <span class="badge ${timeLabel === 'Expirado' ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'}" style="font-size:0.6rem;">${timeLabel || 'Ocupado'}</span>
                            </div>`;
                    }).join('');
                }
            }

            setTimeout(() => {
                loadVisitSummaryCard().catch((error) => console.warn('[ADMIN SUMMARY] Lazy load failed:', error));
            }, 0);

        } catch (e) {
            console.warn('[ADMIN STATS] Error loading:', e);
        }
    }


    function showAdminItemDetail(type, id, explicitItem = null) {
        if (!_currentAdminStats && !explicitItem) return;

        let item = explicitItem;
        let title = '';
        let content = '';
        let icon = '';
        let color = '';
        let sizeClass = 'modal-sm'; // Default

        if (type === 'visita') {
            if (!item) item = _currentAdminStats?.ultimasVisitas?.find(v => v.id === id);
            if (!item) return;
            icon = 'person-check-fill';
            color = 'primary';
            title = 'Detalle de Visita';
            const dIn = parseDate(item.fecha);
            const dOut = parseDate(item.salida);
            const horaIn = dIn ? dIn.toLocaleTimeString() : '--';
            const horaOut = dOut ? dOut.toLocaleTimeString() : 'En curso';
            const studentDis = escapeHtml(item.studentName || item._resolvedStudentName || 'Estudiante');
            const matDis = escapeHtml(item.matricula || item._resolvedStudentMatricula || '');
            const motivo = escapeHtml(item.motivo || 'General');
            const safeVisitId = escapeJsString(item.id || id || '');
            const safeStudentId = escapeJsString(item.studentId || '');
            const safeMatricula = escapeJsString(item.matricula || item._resolvedStudentMatricula || '');

            let related = '';
            if (item.relatedUsers && item.relatedUsers.length > 0) {
                related = `<div class="mt-3 pt-2 border-top">
                    <small class="text-muted fw-bold d-block mb-1">ACOMPAÑANTES:</small>
                    ${item.relatedUsers.map(r => `<span class="badge  text-dark border me-1 mb-1">${escapeHtml(r.matricula || r)}</span>`).join('')}
                </div>`;
            }

            content = `
                <div class="text-center mb-3">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-person-badge fs-1 text-primary"></i>
                    </div>
                    <h5 class="fw-bold mb-0">${studentDis}</h5>
                    <p class="text-muted mb-0">${matDis}</p>
                </div>
                <div class=" rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Motivo:</span>
                        <span class="fw-bold text-dark">${motivo}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Entrada:</span>
                        <span class="fw-bold text-dark">${horaIn}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Salida:</span>
                        <span class="fw-bold ${horaOut === 'En curso' ? 'text-success' : 'text-dark'}">${horaOut}</span>
                    </div>
                    ${related}
                </div>
                ${!item.salida ? `
                    <div class="mt-3">
                        <button class="btn btn-outline-danger w-100 rounded-pill btn-sm" onclick="AdminBiblio.terminarVisita('${safeVisitId}', '${safeStudentId}', '${safeMatricula}')">
                            Registrar salida
                        </button>
                    </div>
                ` : ''}
            `;

        } else if (type === 'prestamo') {
            if (!item) item = _currentAdminStats?.ultimosPrestamos?.find(p => p.id === id);
            if (!item) return;
            icon = 'book-half';
            color = 'warning';
            title = 'Detalle de Préstamo';
            sizeClass = 'modal-md';
            const dSol = parseDate(item.fechaSolicitud);
            const dVenc = parseDate(item.fechaVencimiento);
            const fSol = dSol ? dSol.toLocaleString() : '--';
            const fVenc = dVenc ? dVenc.toLocaleDateString() : '--';
            const studentDis = escapeHtml(item._resolvedStudentName ? `${item._resolvedStudentName} (${item._resolvedStudentMatricula})` : (item.studentId || item.studentEmail || 'Estudiante'));
            const adquisicionId = escapeHtml(item.adquisicion || item.libroAdquisicion || item.libroId || '--');
            const statusLabel = item.estado === 'entregado'
                ? 'Prestado'
                : (item.estado === 'pendiente' || item.estado === 'pendiente_entrega' ? 'Pendiente por recoger' : escapeHtml(item.estado || '--'));
            const tituloLibro = escapeHtml(item.tituloLibro || 'Libro');
            const safeLoanId = escapeJsString(item.id || id || '');
            const canDeliverPickup = item.estado === 'pendiente' || item.estado === 'pendiente_entrega';
            const pickupExpiry = parseDate(item.fechaExpiracionRecoleccion);
            const pickupLabel = pickupExpiry ? pickupExpiry.toLocaleString() : '--';

            content = `
                <div class="text-center mb-3">
                    <div class="bg-warning bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-book fs-1 text-warning"></i>
                    </div>
                    <h5 class="fw-bold mb-0 text-truncate px-3" title="${tituloLibro}">${tituloLibro}</h5>
                    <p class="text-muted small mb-0">No. Adquisición: ${adquisicionId}</p>
                </div>
                <div class=" rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1 gap-2">
                        <span class="text-muted">Estudiante:</span>
                        <span class="fw-bold text-dark text-truncate text-end" style="max-width:200px;">${studentDis}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1 gap-2">
                        <span class="text-muted">Solicitado:</span>
                        <span class="fw-bold text-dark text-end">${fSol}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1 gap-2">
                        <span class="text-muted">Vencimiento:</span>
                        <span class="fw-bold text-danger text-end">${fVenc}</span>
                    </div>
                    <div class="d-flex justify-content-between gap-2">
                        <span class="text-muted">Estado actual:</span>
                        <span class="fw-bold text-dark text-end text-capitalize">${statusLabel}</span>
                    </div>
                    ${canDeliverPickup ? `
                        <div class="d-flex justify-content-between gap-2 mt-1">
                            <span class="text-muted">Recoger antes de:</span>
                            <span class="fw-bold text-dark text-end">${pickupLabel}</span>
                        </div>
                    ` : ''}
                </div>
                ${canDeliverPickup ? `
                    <div class="mt-3">
                        <button class="btn btn-warning w-100 rounded-pill btn-sm fw-bold" onclick="AdminBiblio.confirmarEntregaApartado('${safeLoanId}')">
                            Entregar apartado
                        </button>
                    </div>
                ` : ''}
            `;

        } else if (type === 'devolucion') {
            if (!item) item = _currentAdminStats?.ultimasDevoluciones?.find(d => d.id === id);
            if (!item) return;
            icon = 'box-arrow-in-down';
            color = 'success';
            title = 'Detalle de Devolución';
            sizeClass = 'modal-md';
            const dDev = parseDate(item.fechaDevolucionReal);
            const fDev = dDev ? dDev.toLocaleString() : '--';
            const multa = item.montoDeuda || 0;
            const perdonado = item.perdonado ? `<span class="badge bg-info text-dark">Multa Perdonada</span>` : '';
            const retrasoSinCobro = item.sinCobroRetraso
                ? `<span class="badge bg-primary text-white">Retraso sin cobro${item.diasRetraso ? ` · ${item.diasRetraso} dia(s)` : ''}</span>`
                : '';
            const studentDis = escapeHtml(item._resolvedStudentName ? `${item._resolvedStudentName} (${item._resolvedStudentMatricula})` : (item.studentId || 'Estudiante'));
            const adquisicionId = escapeHtml(item.adquisicion || item.libroAdquisicion || item.libroId || '--');
            const tituloLibro = escapeHtml(item.tituloLibro || 'Libro');
            const motivoPerdon = escapeHtml(item.motivoPerdon || '');
            const safeDebtUid = escapeJsString(item.studentId || '');
            const canRegisterPayment = !!item.studentId && (item.estado === 'cobro_pendiente' || multa > 0);

            content = `
                <div class="text-center mb-3">
                    <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-check-lg fs-1 text-success"></i>
                    </div>
                    <h5 class="fw-bold mb-0 text-truncate px-3" title="${tituloLibro}">${tituloLibro}</h5>
                    <p class="text-muted small mb-0">No. Adquisición: ${adquisicionId}</p>
                    <p class="text-muted small mt-1 mb-0">${perdonado} ${retrasoSinCobro}</p>
                </div>
                <div class=" rounded-3 p-3 small">
                    <div class="d-flex justify-content-between mb-1 gap-2">
                        <span class="text-muted">Estudiante:</span>
                        <span class="fw-bold text-dark text-truncate text-end" style="max-width:200px;">${studentDis}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1 gap-2">
                        <span class="text-muted">Devuelto el:</span>
                        <span class="fw-bold text-dark text-end">${fDev}</span>
                    </div>
                    <div class="d-flex justify-content-between gap-2">
                        <span class="text-muted">Multa / Deuda:</span>
                        <span class="fw-bold ${multa > 0 ? 'text-danger' : 'text-dark'} text-end">${item.sinCobroRetraso ? 'Sin cobro' : `$${multa}`}</span>
                    </div>
                    ${item.sinCobroRetraso ? `<div class="d-flex justify-content-between gap-2 mt-1"><span class="text-muted">Retraso registrado:</span><span class="fw-bold text-primary text-end">${item.diasRetraso || 0} dia(s)</span></div>` : ''}
                    ${item.perdonado ? `<div class="mt-2 pt-2 border-top text-muted fst-italic">"${motivoPerdon}"</div>` : ''}
                </div>
                ${canRegisterPayment ? `
                    <div class="mt-3">
                        <button class="btn btn-outline-success w-100 rounded-pill btn-sm" onclick="AdminBiblio.registrarPagoDeuda('${safeDebtUid}')">
                            Registrar pago
                        </button>
                    </div>
                ` : ''}
            `;

        } else if (type === 'pc') {
            if (!item) item = _currentAdminStats?.pcsActivas?.find(p => p.id === id);
            if (!item) return;
            icon = 'pc-display';
            color = 'info';
            title = 'Detalle de Equipo';
            const ocupadoDesde = item.occupiedAt?.toDate ? item.occupiedAt.toDate().toLocaleTimeString() : '--';
            let expLabel = '--';
            if (item.expiresAt) {
                const expMs = item.expiresAt.toMillis ? item.expiresAt.toMillis() : item.expiresAt;
                expLabel = new Date(expMs).toLocaleTimeString();
            }
            const assetName = escapeHtml(item.nombre || 'Equipo');
            const assetMatricula = escapeHtml(item.occupiedByMatricula || 'Ocupado');
            const safeAssetId = escapeJsString(item.id || '');
            const safeAssetName = escapeJsString(item.nombre || 'Equipo');

            content = `
                <div class="text-center mb-3">
                    <div class="bg-info bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                        <i class="bi bi-pc-display fs-1 text-info"></i>
                    </div>
                    <h5 class="fw-bold mb-0">${assetName}</h5>
                    <p class="text-muted small mb-0">${assetMatricula}</p>
                </div>
                <div class=" rounded-3 p-3 small">
                     <div class="d-flex justify-content-between mb-1">
                        <span class="text-muted">Inicio:</span>
                        <span class="fw-bold text-dark">${ocupadoDesde}</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Expira:</span>
                        <span class="fw-bold text-dark">${expLabel}</span>
                    </div>
                </div>
                <div class="mt-3">
                     <button class="btn btn-outline-danger w-100 rounded-pill btn-sm" onclick="AdminBiblio.handleAssetClick('${safeAssetId}', '${safeAssetName}', 'ocupado', '')">
                        Liberar Ahora
                    </button>
                </div>
            `;
        }

        showConfirmModal({
            icon: icon,
            iconColor: `var(--bs-${color})`,
            title: title,
            message: content,
            confirmText: 'Cerrar',
            confirmClass: `btn-${color}`,
            sizeClass: sizeClass,
            onConfirm: async () => { }
        });

        setTimeout(() => {
            const cancelBtn = document.getElementById('mini-confirm-cancel');
            if (cancelBtn) cancelBtn.style.display = 'none';
        }, 50);
    }


    async function confirmarEntregaApartado(loanId) {
        if (!loanId) return;
        if (!confirm("Confirmar entrega de este apartado al estudiante?")) return;
        try {
            await BiblioService.entregarApartado(_ctx, loanId);
            showToast("Apartado entregado correctamente.", "success");
            bootstrap.Modal.getInstance(document.getElementById('mini-confirm-modal'))?.hide();
            await loadAdminStats();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }


    async function registrarPagoDeuda(uid) {
        if (!uid) return;
        if (!confirm("Registrar el pago y desbloquear al estudiante?")) return;
        try {
            await BiblioService.pagarDeudaMonitor(_ctx, uid);
            showToast("Pago registrado y cuenta desbloqueada.", "success");
            bootstrap.Modal.getInstance(document.getElementById('mini-confirm-modal'))?.hide();
            await loadAdminStats();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    // --- MODAL HISTORIAL (VER MAS) ---


    function abrirModalVisita() {
        clearLiveAssetStreams();
        _visitUser = null;
        syncToState();
        renderVisitModalContent();
        updateVisitScanStatus('');
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => {
            const input = document.getElementById('visita-input-matricula');
            if (input) input.focus();
        }, 500);
    }


    function renderVisitModalContent() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-person-badge me-3"></i>Registrar Entrada</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 ">
                <!-- STEP 1: INPUT -->
                <div class="d-flex justify-content-center gap-2 mb-4">
                    <input type="text" class="form-control form-control-lg rounded-pill fs-2 fw-bold font-monospace text-center border-3 border-primary shadow-sm" 
                           style="max-width: 400px;"
                           id="visita-input-matricula" placeholder="Matrícula" autofocus 
                           onkeyup="if(event.key==='Enter') AdminBiblio.verificarUsuarioVisita()">
                           
                    <button class="btn btn-lg btn-outline-secondary rounded-pill fw-bold shadow-sm d-flex align-items-center" 
                            onclick="AdminBiblio.mostrarRegistroAnonimo()" title="Registrar sin matrícula">
                         <i class="bi bi-person-x-fill me-2 fs-4"></i> Sin Matrícula
                    </button>
                </div>
                <div id="visit-scan-status" class="small text-center mt-2 d-none"></div>

                <div id="visit-options-container" class="d-none animate__animated animate__fadeInUp">
                     <!-- USER INFO HEADER -->
                     <div class="text-center mb-4">
                        <div class="d-flex justify-content-center mb-2">
                            <div id="v-user-photo" class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style="width:64px;height:64px;overflow:hidden;">
                                <i class="bi bi-person-fill text-primary fs-2"></i>
                            </div>
                        </div>
                        <h4 class="fw-bold text-dark mb-0" id="v-user-name">-</h4>
                        <span class="badge bg-primary rounded-pill mb-3" id="v-user-mat">-</span>
                        <p class="text-muted small">Selecciona motivo para registrar INMEDIATAMENTE:</p>
                     </div>

                     <!-- DIRECT ACTIONS -->
                     <div class="row g-3">
                        <div class="col-md-4">
                             <button class="btn btn-outline-success w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.confirmarVisitaDirecta('Consulta')">
                                <i class="bi bi-search fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Consulta</span>
                             </button>
                        </div>
                        <div class="col-md-4">
                             <button class="btn btn-outline-primary w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.confirmarVisitaDirecta('Trabajo Individual')">
                                <i class="bi bi-person fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Individual</span>
                             </button>
                        </div>
                        <div class="col-md-4">
                             <button class="btn btn-outline-warning w-100 p-3 rounded-4 shadow-sm hover-scale h-100" onclick="AdminBiblio.toggleTeamForm()">
                                <i class="bi bi-people fs-1 d-block mb-2"></i>
                                <span class="fw-bold">Equipo...</span>
                             </button>
                        </div>
                     </div>

                     <!-- TEAM FORM (Hidden by default) -->
                     <div id="v-team-form" class="mt-3 p-3 bg-white rounded-4 border shadow-sm d-none">
                        <h6 class="fw-bold text-muted border-bottom pb-2 mb-2">Integrantes del Equipo</h6>
                        <div id="v-team-inputs">
                            <input type="text" class="form-control mb-2 font-monospace team-member-input" placeholder="Matrícula 2">
                            <input type="text" class="form-control mb-2 font-monospace team-member-input" placeholder="Matrícula 3">
                        </div>
                        <button class="btn btn-sm btn-outline-secondary rounded-pill w-100 mb-3" id="btn-add-team-member" onclick="AdminBiblio.addTeamMember()">
                            <i class="bi bi-plus-circle me-1"></i>Añadir otro integrante
                        </button>
                        <button class="btn btn-warning w-100 fw-bold rounded-pill" onclick="AdminBiblio.confirmarVisitaDirecta('Trabajo en Equipo')">
                            CONFIRMAR EQUIPO
                        </button>
                     </div>
                </div>

                <div id="visit-error-msg" class="alert alert-danger fw-bold mt-3 text-center d-none"></div>

                <!-- NEW: UNREGISTERED VISITOR FORM -->
                <div id="visit-unregistered-container" class="d-none animate__animated animate__fadeInUp mt-3">
                    <div class="alert alert-warning mb-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>El usuario no está en nuestra base de datos.
                    </div>
                    
                    <h5 class="fw-bold mb-3"><i class="bi bi-person-fill-add me-2"></i>Registrar Visita Externa / Sin Cuenta</h5>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-12 col-md-6">
                            <label class="form-label small fw-bold">Tipo de Visitante</label>
                            <select class="form-select" id="unreg-tipo">
                                <option value="Estudiante Local (Sin acceso)">Estudiante Local (Olvido de credenciales)</option>
                                <option value="Profesional Externo">Profesional / Egresado / Externo</option>
                                <option value="Personal Docente">Docente Institucional</option>
                                <option value="Personal Administrativo">Personal Administrativo</option>
                                <option value="Otro">Otro Visitante</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6">
                            <label class="form-label small fw-bold">Género</label>
                            <select class="form-select" id="unreg-genero">
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                            </select>
                        </div>
                    </div>
                    
                    <p class="text-muted small mb-2">Selecciona el motivo de su visita:</p>
                    <div class="row g-2">
                        <div class="col-4">
                             <button class="btn btn-outline-success w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Consulta')">
                                <i class="bi bi-search d-block mb-1"></i><small class="fw-bold">Consulta</small>
                             </button>
                        </div>
                        <div class="col-4">
                             <button class="btn btn-outline-primary w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Trabajo Individual')">
                                <i class="bi bi-person d-block mb-1"></i><small class="fw-bold">Individual</small>
                             </button>
                        </div>
                        <div class="col-4">
                             <button class="btn btn-outline-warning w-100 p-2 rounded-3 text-center" onclick="AdminBiblio.confirmarVisitaUnregistered('Trabajo en Equipo')">
                                <i class="bi bi-people d-block mb-1"></i><small class="fw-bold">Equipo...</small>
                             </button>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }

    // Validate User & Show Options

    async function verificarUsuarioVisita() {
        const input = document.getElementById('visita-input-matricula');
        if (input.value.trim().length < 3) return;

        input.disabled = true;
        document.getElementById('visit-error-msg').classList.add('d-none');
        document.getElementById('visit-unregistered-container').classList.add('d-none');
        document.getElementById('visit-options-container').classList.add('d-none');

        try {
            const user = await BiblioService.findUserByQuery(_ctx, input.value.trim());
            if (!user) throw new Error("Estudiante NO encontrado.");

            _visitUser = user;
            syncToState();

            // Show first name + first last name
            const parts = (user.nombre || 'Estudiante').split(' ');
            let displayName = parts[0];
            if (parts.length >= 2) displayName += ' ' + parts[1];
            document.getElementById('v-user-name').innerText = displayName;
            document.getElementById('v-user-mat').innerText = user.matricula;

            // Profile photo
            const photoContainer = document.getElementById('v-user-photo');
            if (photoContainer) {
                // Try to get photoURL from user doc
                try {
                    const userDoc = await _ctx.db.collection('usuarios').doc(user.uid).get();
                    const photoURL = userDoc.data()?.photoURL;
                    if (photoURL) {
                        photoContainer.innerHTML = `<img src="${photoURL}" class="rounded-circle" style="width:64px;height:64px;object-fit:cover;">`;
                    }
                } catch (e) { /* keep default icon */ }
            }

            document.getElementById('visit-options-container').classList.remove('d-none');
        } catch (e) {
            // No se encontro usuario
            _visitUser = null;
            syncToState();
            document.getElementById('visit-unregistered-container').classList.remove('d-none');
            updateVisitScanStatus('El código se recibió, pero no coincide con un usuario registrado. Puedes capturarlo como visitante.', 'warning');
            input.disabled = false;
        }
    }


    function toggleTeamForm() {
        document.getElementById('v-team-form').classList.toggle('d-none');
    }


    function mostrarRegistroAnonimo() {
        _visitUser = null;
        syncToState();
        const input = document.getElementById('visita-input-matricula');
        if (input) {
            input.value = '';
        }
        document.getElementById('visit-error-msg')?.classList.add('d-none');
        document.getElementById('visit-options-container')?.classList.add('d-none');
        document.getElementById('visit-unregistered-container')?.classList.remove('d-none');
    }

    // Dynamic team member add (max 4 extras = 5 total)

    function addTeamMember() {
        const container = document.getElementById('v-team-inputs');
        const existing = container.querySelectorAll('.team-member-input').length;
        if (existing >= 4) {
            const btn = document.getElementById('btn-add-team-member');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Máximo alcanzado'; }
            return;
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control mb-2 font-monospace team-member-input animate__animated animate__fadeInDown';
        input.placeholder = `Matrícula ${existing + 2}`;
        container.appendChild(input);
        input.focus();

        if (existing + 1 >= 4) {
            const btn = document.getElementById('btn-add-team-member');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Máximo alcanzado'; }
        }
    }

    // Single Logic for all

    async function confirmarVisitaDirecta(motivo) {
        if (!_visitUser) return;

        const params = { uid: _visitUser.uid, matricula: _visitUser.matricula, motivo };
        const isTeamVisit = motivo === 'Trabajo en Equipo';
        let mates = [];

        try {
            if (isTeamVisit) {
                const inputs = document.querySelectorAll('.team-member-input');
                inputs.forEach(i => { if (i.value.trim()) mates.push(i.value.trim()); });
                if (mates.length === 0) throw new Error("Ingresa integrantes para el equipo.");
            }

            setVisitActionButtonsDisabled(true);

            if (isTeamVisit) {
                await BiblioService.registrarVisitaGrupo(_ctx, [_visitUser.matricula, ...mates], motivo);
            } else {
                await BiblioService.registrarVisita(_ctx, params);
            }

            const warnings = [];

            if (window.EncuestasServicioService) {
                await runNonCriticalTask('registro de encuesta de servicio', () =>
                    EncuestasServicioService.registerServiceUsage(
                        _ctx,
                        'biblioteca',
                        { action: 'visita_admin', studentId: params.uid },
                        params.uid
                    ), warnings);
            }

            if (motivo === 'Trabajo Individual' || motivo === 'Trabajo en Equipo') {
                try {
                    const mesa = await BiblioAssetsService.asignarMesaAutomatica(_ctx, _visitUser.uid, _visitUser.matricula);
                    closeAdminActionModal();
                    const now = new Date();
                    const expTime = new Date(now.getTime() + 60 * 60 * 1000);
                    const timeStr = expTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    showConfirmModal({
                        icon: 'table',
                        iconColor: '#0d6efd',
                        title: `Mesa Asignada: ${mesa.nombre}`,
                        message: `Bienvenido(a). Se asignó <strong>${mesa.nombre}</strong>.<br>Disponible hasta las <strong>${timeStr}</strong> (1 hora).`,
                        confirmText: 'Entendido',
                        confirmClass: 'btn-primary',
                        onConfirm: async () => { /* just close */ }
                    });
                } catch (err) {
                    closeAdminActionModal();
                    showToast(`✅ Bienvenido. (Sin mesa: ${err.message})`, "warning");
                }
            } else {
                showToast(`✅ Bienvenido.`, "success");
                closeAdminActionModal();
            }

            if (warnings.length > 0) {
                showToast(`La visita se guardo, pero fallo: ${warnings.join(', ')}.`, "warning");
            }

            await loadAdminStats();

        } catch (e) {
            if (e?.code === 'VISITA_DUPLICADA_ACTIVA') {
                showActiveVisitDuplicateModal(e);
            } else {
                showToast("Error: " + e.message, "danger");
            }
        } finally {
            setVisitActionButtonsDisabled(false);
        }
    }

    // --- LOGICA SIN REGISTRO ---

    async function confirmarVisitaUnregistered(motivo, options = {}) {
        const tipo = document.getElementById('unreg-tipo').value;
        const genero = document.getElementById('unreg-genero').value;
        const matriculaOriginalInput = document.getElementById('visita-input-matricula').value.trim();
        let groupNotes = options.groupNotes || '';
        let groupSize = Number(options.groupSize) || 1;

        try {
            if (motivo === 'Trabajo en Equipo' && !groupNotes) {
                const notes = await showPromptModal({
                    icon: 'people-fill',
                    iconColor: '#f59e0b',
                    title: 'Datos del equipo',
                    message: 'Anota integrantes, referencia del grupo o cantidad de personas para la visita.',
                    placeholder: 'Ej. 3 integrantes - Equipo de Redes',
                    confirmText: 'Guardar',
                    confirmClass: 'btn-warning text-dark'
                });
                if (!notes) return;
                groupNotes = notes;
                const sizeMatch = notes.match(/\d+/);
                groupSize = sizeMatch ? Math.max(parseInt(sizeMatch[0], 10), 2) : 2;
            }

            const params = {
                isUnregistered: true,
                matricula: matriculaOriginalInput || 'SIN_MATRICULA',
                motivo: motivo,
                visitorType: tipo,
                gender: genero,
                groupSize,
                groupNotes,
                forceDuplicateAnon: options.forceDuplicate === true
            };

            setVisitActionButtonsDisabled(true);

            const visit = await BiblioService.registrarVisita(_ctx, params);

            if (motivo === 'Trabajo Individual' || motivo === 'Trabajo en Equipo') {
                try {
                    await BiblioAssetsService.asignarMesaAutomatica(_ctx, visit.uid, visit.matricula);
                } catch (mesaErr) {
                    console.warn('[BIBLIO ADMIN] No se pudo asignar mesa a visita sin registro:', mesaErr);
                }
            }

            showToast(`✅ Visita Externa/Sin Cuenta registrada.`, "success");
            closeAdminActionModal();
            await loadAdminStats();

        } catch (e) {
            if (e?.code === 'VISITA_DUPLICADA_ACTIVA') {
                showActiveVisitDuplicateModal(e);
            } else if (e?.code === 'VISITA_ANONIMA_RECIENTE') {
                promptRecentAnonymousDuplicate(e, async () => {
                    await confirmarVisitaUnregistered(motivo, { forceDuplicate: true, groupNotes, groupSize });
                });
            } else {
                showToast("Error registrando visita externa: " + e.message, "danger");
            }
        } finally {
            setVisitActionButtonsDisabled(false);
        }
    }

    // --- 2. MODAL PRESTAR LIBRO ---

    function abrirModalComputadoras() {
        clearLiveAssetStreams();
        // ... (existing modal code) ...
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-info text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-pc-display me-3"></i>Computadoras y Sala</h3>
                <div class="ms-auto d-flex align-items-center gap-3">
                    <button class="btn btn-light btn-sm fw-bold text-info" onclick="AdminBiblio.forzarLimpiezaPCs()">
                        <i class="bi bi-stars"></i> Limpiar Expirados
                    </button>
                    <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
            </div>
            <div class="modal-body p-4 ">
                 <label class="form-label small fw-bold text-muted"><i class="bi bi-person-badge-fill me-1 text-info"></i>Número de Control del Estudiante</label>
                 <div class="input-group mb-4">
                    <span class="input-group-text bg-info bg-opacity-10 border-0"><i class="bi bi-person-vcard-fill text-info"></i></span>
                    <input type="text" class="form-control rounded-end fs-4 fw-bold font-monospace text-center border-0 bg-white shadow-sm" id="pc-matricula" placeholder="Ej: 22380123" autofocus>
                 </div>
                
                <h6 class="fw-bold text-muted mb-3 text-uppercase ls-1">Selecciona Equipo</h6>
                <div class="row g-3" id="admin-pc-grid">
                    <div class="text-center w-100 py-3"><span class="spinner-border"></span></div>
                </div>
            </div>
         `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        setTimeout(() => document.getElementById('pc-matricula').focus(), 500);

        // Grid load
        loadPCGrid();

        // Cleanup manual. Removido auto-cleanup al abrir para evitar expiraciones erróneas por reloj local desfadado.
    }


    async function forzarLimpiezaPCs() {
        try {
            const freed = await BiblioAssetsService.liberarActivosExpirados(_ctx);
            if (freed && freed.length > 0) {
                showToast(`🔄 Mesas/PC liberadas exitosamente: ${freed.join(', ')}`, 'success');
                loadPCGrid(); // Refresh grid
            } else {
                showToast("No hay equipos expirados para limpiar.", "info");
            }
        } catch (e) {
            showToast("Error al limpiar: " + e.message, "danger");
        }
    }


    function loadPCGrid() {
        if (_pcGridUnsub) {
            _pcGridUnsub();
            _pcGridUnsub = null;
        }

        _pcGridUnsub = BiblioAssetsService.streamAssetsAdmin(_ctx, (assets) => {
            const grid = document.getElementById('admin-pc-grid');
            if (!grid) return;

            const computers = assets.filter(a => a.tipo === 'pc' || a.tipo === 'sala').sort((a, b) => a.nombre.localeCompare(b.nombre));

            grid.innerHTML = computers.map(pc => {
                const isBusy = pc.status === 'ocupado';
                const isMaintenance = pc.status === 'mantenimiento';
                let timeInfo = '';
                if (isBusy && pc.expiresAt) {
                    const expiresMs = pc.expiresAt.toMillis ? pc.expiresAt.toMillis() : pc.expiresAt;
                    const remainMs = expiresMs - Date.now();
                    if (remainMs <= 0) {
                        timeInfo = `<span class="badge bg-warning text-dark mt-1" style="font-size:0.65rem;">⏰ EXPIRADO</span>`;
                    } else {
                        const mins = Math.ceil(remainMs / 60000);
                        timeInfo = `<span class="badge bg-white text-info mt-1" style="font-size:0.65rem;">⏱ ${mins} min</span>`;
                    }
                }
                const occupantLabel = isBusy && pc.occupiedByMatricula
                    ? `<span class="d-block small text-white-50 mt-1" style="font-size:0.7rem;">${escapeHtml(pc.occupiedByMatricula)}</span>`
                    : '';
                const safePcId = escapeJsString(pc.id || '');
                const safePcName = escapeJsString(pc.nombre || 'Equipo');
                const safePcStatus = escapeJsString(pc.status || 'disponible');
                const safeOccupiedBy = escapeJsString(pc.occupiedBy || '');
                const displayPcName = escapeHtml(pc.nombre || 'Equipo');
                const buttonClass = isMaintenance
                    ? 'btn-outline-secondary bg-light text-muted'
                    : (isBusy ? 'btn-danger' : 'btn-outline-primary bg-white');
                const badgeHtml = isMaintenance
                    ? `<span class="badge bg-secondary-subtle text-secondary mt-2">MANTENIMIENTO</span>`
                    : (isBusy
                        ? `<span class="badge bg-white text-danger mt-2">OCUPADO</span>${occupantLabel}${timeInfo}`
                        : `<span class="badge bg-primary-subtle text-primary mt-2">DISPONIBLE</span>`);
                const clickAction = isMaintenance
                    ? ''
                    : `onclick="AdminBiblio.handleAssetClick('${safePcId}', '${safePcName}', '${safePcStatus}', '${safeOccupiedBy}')"`
                    ;

                return `
                    <div class="col-md-3 col-6">
                        <button class="btn ${buttonClass} w-100 h-100 p-3 rounded-4 shadow-sm position-relative" 
                                ${clickAction}
                                ${isMaintenance ? 'disabled' : ''}>
                            <i class="bi bi-${pc.tipo === 'sala' ? 'people' : 'pc-display'} fs-2 mb-2 d-block"></i>
                            <span class="fw-bold small d-block">${displayPcName}</span>
                            ${badgeHtml}
                        </button>
                    </div>
                `;
            }).join('');
        });
    }

    // --- MINI-MODAL CONFIRM (reemplaza confirm() nativo) ---

    async function asignarPC(id, nombre) {
        const mat = document.getElementById('pc-matricula').value.trim();
        if (mat.length < 3) return showToast("Ingresa matrícula primero", "warning");
        const safeNombre = escapeHtml(nombre);

        // Calculate time
        const now = new Date();
        const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 Hour
        const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        showConfirmModal({
            icon: 'pc-display',
            iconColor: '#0dcaf0',
            title: `Asignar ${safeNombre}`,
            message: `Se asignará a <strong>${escapeHtml(mat)}</strong>.<br>Se liberará automáticamente a las <strong>${timeStr}</strong>.`,
            confirmText: 'Asignar',
            confirmClass: 'btn-info text-white',
            onConfirm: async () => {
                try {
                    const user = await BiblioService.findUserByQuery(_ctx, mat);
                    if (!user?.uid) throw new Error("No se encontró al estudiante para asignar el equipo.");

                    await BiblioAssetsService.asignarActivoManual(_ctx, user.uid, id, { matricula: user.matricula || mat });

                    const warnings = [];
                    await runNonCriticalTask('registro de visita', async () => {
                        try {
                            await BiblioService.registrarVisita(_ctx, { uid: user.uid, matricula: user.matricula || mat, motivo: `Uso ${nombre}` });
                        } catch (error) {
                            if (error?.code !== 'VISITA_DUPLICADA_ACTIVA' && error?.code !== 'VISITA_ANONIMA_RECIENTE') {
                                throw error;
                            }
                        }
                    }, warnings);

                    showToast(`✅ ${nombre} asignado a ${mat}. Expira: ${timeStr}`, "success");

                    const parentModalEl = document.getElementById('modal-admin-action');
                    if (parentModalEl) {
                        const parentModal = bootstrap.Modal.getInstance(parentModalEl);
                        if (parentModal) parentModal.hide();
                    }
                    if (warnings.length > 0) {
                        showToast(`El activo se asignó, pero falló: ${warnings.join(', ')}.`, "warning");
                    }
                    await loadAdminStats();
                } catch (e) { showToast(e.message, "danger"); }
            }
        });
    }

    // [FIX] Helper to handle PC clicks (Assign or Release)

    async function handleAssetClick(id, nombre, status, occupiedBy) {
        const safeNombre = escapeHtml(nombre);
        if (status === 'mantenimiento') return;
        if (status === 'ocupado') {
            showConfirmModal({
                icon: 'unlock-fill',
                iconColor: '#dc3545',
                title: `Liberar ${safeNombre}`,
                message: `¿Deseas liberar este equipo?<br>El equipo quedará <strong>disponible</strong> para otros usuarios.`,
                confirmText: 'Liberar Equipo',
                confirmClass: 'btn-danger',
                onConfirm: async () => {
                    try {
                        await BiblioAssetsService.liberarActivo(_ctx, id);
                        showToast(`✅ ${nombre} liberado`, "success");
                        loadPCGrid();
                    } catch (e) { showToast(e.message, "danger"); }
                }
            });
        } else {
            asignarPC(id, nombre);
        }
    }

    // --- FUNCIONES RENOVAR MODAL DE PRESTAMOS / DEVOLUCIONES ---

    function abrirModalServicio(type) {
        _currentServiceType = type;
        resetServiceSelection();
        const title = type === 'pc' ? 'Reservar Computadora' : 'Reservar Sala de Estudio';
        const modalContent = document.getElementById('servicio-reserva-content');

        // Date Default: Today
        const today = new Date().toISOString().split('T')[0];

        modalContent.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white">
                <h5 class="fw-bold mb-0"><i class="bi bi-${type === 'pc' ? 'pc-display' : 'people'} me-2"></i>${title}</h5>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 ">
                <label class="small fw-bold text-muted mb-2">1. Estudiante</label>
                <input type="text" id="service-student-query" class="form-control rounded-pill mb-4 shadow-sm" placeholder="Matricula o correo del estudiante">

                <label class="small fw-bold text-muted mb-2">2. Elige una fecha</label>
                <input type="date" id="service-date-picker" class="form-control rounded-pill mb-4 shadow-sm" value="${today}" min="${today}" onchange="AdminBiblio.renderAvailabilityGrid()">
                
                <label class="small fw-bold text-muted mb-2">3. Disponibilidad</label>
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
        resetServiceSelection();
        if (!container || !date || !type) return;

        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>'; // Clear & Load

        try {
            const allAssets = (await BiblioAssetsService.getAssetsOnce(_ctx))
                .filter(a => a.tipo === type && a.status !== 'mantenimiento')
                .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

            const occupiedMap = await BiblioAssetsService.getAvailability(_ctx, date, type);

            if (allAssets.length === 0) {
                container.innerHTML = `<div class="alert alert-secondary small">No hay equipos disponibles en este momento.</div>`;
                return;
            }

            container.innerHTML = '';

            const hours = [];
            for (let i = 8; i <= 18; i++) hours.push(`${i.toString().padStart(2, '0')}:00`);
            const now = new Date();
            const today = new Date().toISOString().split('T')[0];

            allAssets.forEach(asset => {
                const assetRow = document.createElement('div');
                assetRow.className = 'bg-white p-3 rounded-3 shadow-sm mb-2';

                const occupiedHours = occupiedMap[asset.id] || [];
                const safeAssetId = escapeJsString(asset.id || '');
                const occupiedUntil = asset.expiresAt?.toDate ? asset.expiresAt.toDate() : null;

                let slotsHtml = `<div class="d-flex gap-2 overflow-auto pb-1" style="scrollbar-width:thin;">`;
                hours.forEach(h => {
                    const slotStart = new Date(`${date}T${h}:00`);
                    const isTaken = occupiedHours.includes(h);
                    const isTooSoon = slotStart.getTime() - now.getTime() < 15 * 60 * 1000;
                    const overlapsCurrentUse = today === date && asset.status === 'ocupado' && (!occupiedUntil || occupiedUntil > slotStart);
                    const disabled = isTaken || isTooSoon || overlapsCurrentUse;
                    const styleClass = isTaken
                        ? 'bg-danger-subtle text-danger border-danger'
                        : ((overlapsCurrentUse || asset.status === 'ocupado') ? 'bg-warning-subtle text-warning border-warning' : (isTooSoon ? 'text-muted border-light' : 'btn-outline-primary'));

                    if (disabled) {
                        slotsHtml += `<button class="btn btn-sm ${styleClass} rounded-pill px-3" disabled style="min-width: 70px;">${h}</button>`;
                    } else {
                        slotsHtml += `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" style="min-width: 70px;" 
                                        onclick="AdminBiblio.selectSlot(this, '${safeAssetId}', '${h}')">${h}</button>`;
                    }
                });
                slotsHtml += `</div>`;

                assetRow.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-${type === 'pc' ? 'pc-display' : 'people'} text-muted me-2"></i>
                        <span class="fw-bold small text-dark">${escapeHtml(asset.nombre || 'Activo')}</span>
                        ${asset.status === 'ocupado' ? '<span class="badge bg-warning-subtle text-warning ms-2">En uso</span>' : ''}
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
        const studentQuery = document.getElementById('service-student-query')?.value.trim();
        if (!_selectedAssetId || !_selectedTimeBlock || !date) return;
        if (!studentQuery) return showToast("Ingresa la matricula o correo del estudiante.", "warning");

        const btn = document.getElementById('btn-confirm-service');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Reservando...';

        try {
            const user = await BiblioService.findUserByQuery(_ctx, studentQuery);
            if (!user?.uid) throw new Error("No se encontró al estudiante para registrar la reserva.");

            await BiblioAssetsService.reservarEspacio(_ctx, {
                studentId: user.uid,
                assetId: _selectedAssetId,
                hourBlock: _selectedTimeBlock,
                date,
                tipo: _currentServiceType
            });
            showToast("Reserva exitosa", "success");
            bootstrap.Modal.getInstance(document.getElementById('modal-servicio-reserva')).hide();

            if (window.EncuestasServicioService) {
                runNonCriticalTask('registro de encuesta de servicio', () =>
                    EncuestasServicioService.registerServiceUsage(_ctx, 'biblioteca', { action: 'reserva_espacio', type: _currentServiceType }, user.uid), []);
            }
        } catch (e) {
            showToast(e.message, "danger");
            btn.disabled = false;
            btn.innerText = "Reintentar";
        }
    }


    return {
        terminarVisita: withState(terminarVisita),
        initAdmin: withState(initAdmin),
        forzarRecargaCache: withState(forzarRecargaCache),
        startClock: withState(startClock),
        loadAdminStats: withState(loadAdminStats),
        showAdminItemDetail: withState(showAdminItemDetail),
        confirmarEntregaApartado: withState(confirmarEntregaApartado),
        registrarPagoDeuda: withState(registrarPagoDeuda),
        abrirModalVisita: withState(abrirModalVisita),
        renderVisitModalContent: withState(renderVisitModalContent),
        verificarUsuarioVisita: withState(verificarUsuarioVisita),
        toggleTeamForm: withState(toggleTeamForm),
        mostrarRegistroAnonimo: withState(mostrarRegistroAnonimo),
        addTeamMember: withState(addTeamMember),
        confirmarVisitaDirecta: withState(confirmarVisitaDirecta),
        confirmarVisitaUnregistered: withState(confirmarVisitaUnregistered),
        applyVisitScanPayload: withState(applyVisitScanPayload),
        abrirModalComputadoras: withState(abrirModalComputadoras),
        forzarLimpiezaPCs: withState(forzarLimpiezaPCs),
        loadPCGrid: withState(loadPCGrid),
        asignarPC: withState(asignarPC),
        handleAssetClick: withState(handleAssetClick),
        abrirModalServicio: withState(abrirModalServicio),
        renderAvailabilityGrid: withState(renderAvailabilityGrid),
        selectSlot: withState(selectSlot),
        confirmarReserva: withState(confirmarReserva)
    };
})();
