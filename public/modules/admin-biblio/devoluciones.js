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

    let _debtorsList = [];
    let _condonadosList = [];
    let _isShowingCondonados = false;
    let _debtorsPage = 0;
    const DEBTORS_PAGE_SIZE = 10;
    let _activeFilter = { type: 'all', val: null };

    async function cargarListaDeudoresGlobal() {
        try {
            const rawRecords = await BiblioService.fetchAllDebtorsAndCondonations(_ctx);
            // Group by user
            const usersMap = {};
            rawRecords.forEach(r => {
                const uid = r.studentId || r.studentMatricula || 'S/N';
                if (!usersMap[uid]) {
                    usersMap[uid] = {
                        studentId: r.studentId,
                        studentMatricula: r.studentMatricula,
                        studentName: r.studentName,
                        tipoUsuario: r.tipoUsuario || 'Usuario',
                        deudas: [],
                        condonaciones: [],
                        deudaTotal: 0,
                        totalCondonado: 0
                    };
                }
                
                if (r.perdonado) {
                    usersMap[uid].condonaciones.push(r);
                    usersMap[uid].totalCondonado += (Number(r.multaOriginal) || Number(r.multaReferencia) || 0);
                } else if (r.condonable || r.montoDeuda > 0) {
                    usersMap[uid].deudas.push(r);
                    usersMap[uid].deudaTotal += (Number(r.montoDeuda) || 0);
                }
            });

            _debtorsList = Object.values(usersMap).filter(u => u.deudaTotal > 0).sort((a,b) => b.deudaTotal - a.deudaTotal);
            _condonadosList = Object.values(usersMap).filter(u => u.condonaciones.length > 0).sort((a,b) => b.totalCondonado - a.totalCondonado);
            
            renderDebtorsTable();
        } catch (e) {
            console.error(e);
            showToast("Error al cargar deudores: " + e.message, "danger");
            const tbody = document.getElementById('condon-table-body');
            if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error al cargar datos.</td></tr>`;
        }
    }

    function toggleCondonadosView() {
        _isShowingCondonados = !_isShowingCondonados;
        _debtorsPage = 0;
        
        const btn = document.getElementById('btn-toggle-condonados');
        const title = document.getElementById('condon-table-title');
        if (!btn || !title) return;
        
        if (_isShowingCondonados) {
            btn.innerHTML = `<i class="bi bi-arrow-left-right me-1"></i>Ver Adeudos Pendientes`;
            title.innerText = 'Usuarios Condonados';
        } else {
            btn.innerHTML = `<i class="bi bi-arrow-left-right me-1"></i>Ver Solo Condonaciones`;
            title.innerText = 'Usuarios con Deuda Pendiente';
        }
        
        renderDebtorsTable();
    }

    function getFilteredLists() {
        const now = new Date();
        const currentYear = now.getFullYear();
        let startDate, endDate;
        let periodName = 'Todos los registros';

        if (_activeFilter.type === 'all') {
            startDate = new Date(1970, 0, 1);
            endDate = new Date(2100, 11, 31);
        } else if (_activeFilter.type === 'month') {
            const m = _activeFilter.val;
            startDate = new Date(currentYear, m, 1);
            endDate = new Date(currentYear, m + 1, 0, 23, 59, 59);
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            periodName = meses[m];
        } else if (_activeFilter.type === 'quarter') {
            const q = _activeFilter.val;
            startDate = new Date(currentYear, q * 3, 1);
            endDate = new Date(currentYear, q * 3 + 3, 0, 23, 59, 59);
            periodName = `Trimestre ${q + 1}`;
        } else if (_activeFilter.type === 'semester') {
            const s = _activeFilter.val;
            startDate = new Date(currentYear, s * 6, 1);
            endDate = new Date(currentYear, s * 6 + 6, 0, 23, 59, 59);
            periodName = `Semestre ${s + 1}`;
        }

        const getMs = (dateVal) => {
            if (!dateVal) return 0;
            if (dateVal.toMillis) return dateVal.toMillis();
            if (dateVal.seconds) return dateVal.seconds * 1000;
            return new Date(dateVal).getTime() || 0;
        };

        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        const filteredDebtors = _debtorsList.map(u => {
            const validDeudas = u.deudas.filter(d => {
                const ms = getMs(d.fechaVencimiento);
                return ms >= startMs && ms <= endMs;
            });
            return validDeudas.length > 0 ? { ...u, deudas: validDeudas, deudaTotal: validDeudas.reduce((acc, d) => acc + (Number(d.montoDeuda)||0), 0) } : null;
        }).filter(Boolean);

        const filteredCondonados = _condonadosList.map(u => {
            const validCondon = u.condonaciones.filter(c => {
                const ms = getMs(c.fechaDevolucionReal || c.fechaPago || c.fechaVencimiento);
                return ms >= startMs && ms <= endMs;
            });
            return validCondon.length > 0 ? { ...u, condonaciones: validCondon, totalCondonado: validCondon.reduce((acc, c) => acc + (Number(c.multaOriginal) || Number(c.multaReferencia) || 0), 0) } : null;
        }).filter(Boolean);

        return { filteredDebtors, filteredCondonados, period: periodName, startDate, endDate, currentYear };
    }

    function onFilterChange(type) {
        if(type === 'all') {
            document.getElementById('filter-month').value = "";
            document.getElementById('filter-quarter').value = "";
            document.getElementById('filter-semester').value = "";
            _activeFilter = { type: 'all', val: null };
        } else if(type === 'month') {
            document.getElementById('filter-quarter').value = "";
            document.getElementById('filter-semester').value = "";
            _activeFilter = { type: 'month', val: parseInt(document.getElementById('filter-month').value.replace('m_', '')) };
        } else if(type === 'quarter') {
            document.getElementById('filter-month').value = "";
            document.getElementById('filter-semester').value = "";
            _activeFilter = { type: 'quarter', val: parseInt(document.getElementById('filter-quarter').value.replace('q_', '')) };
        } else if(type === 'semester') {
            document.getElementById('filter-month').value = "";
            document.getElementById('filter-quarter').value = "";
            _activeFilter = { type: 'semester', val: parseInt(document.getElementById('filter-semester').value.replace('s_', '')) };
        }
        
        if (type !== 'all' && isNaN(_activeFilter.val)) {
            _activeFilter = { type: 'all', val: null };
        }

        _debtorsPage = 0;
        renderDebtorsTable();
    }

    function renderDebtorsTable() {
        const tbody = document.getElementById('condon-table-body');
        const pagination = document.getElementById('condon-pagination');
        if (!tbody || !pagination) return;

        const { filteredDebtors, filteredCondonados } = getFilteredLists();
        const listToUse = _isShowingCondonados ? filteredCondonados : filteredDebtors;
        
        if (listToUse.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No hay registros para mostrar en esta categoría y periodo.</td></tr>`;
            pagination.classList.add('d-none');
            return;
        }

        const totalPages = Math.ceil(listToUse.length / DEBTORS_PAGE_SIZE);
        const safePage = Math.min(Math.max(_debtorsPage, 0), totalPages - 1);
        _debtorsPage = safePage;

        const startIndex = safePage * DEBTORS_PAGE_SIZE;
        const pageItems = listToUse.slice(startIndex, startIndex + DEBTORS_PAGE_SIZE);

        tbody.innerHTML = pageItems.map(user => {
            const isPersonal = user.tipoUsuario.toLowerCase().includes('personal') || user.tipoUsuario.toLowerCase().includes('docente');
            const badgeClass = isPersonal ? 'bg-primary bg-opacity-10 text-primary border-primary' : 'bg-secondary bg-opacity-10 text-secondary border-secondary';
            const uidStr = escapeJsString(user.studentId || user.studentMatricula);
            
            if (_isShowingCondonados) {
                const lastReason = user.condonaciones[0]?.motivoPerdon || 'Perdón general';
                return `
                    <tr class="cursor-pointer" onclick="AdminBiblio.mostrarDetallesUsuario('${uidStr}')">
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${escapeHtml(user.studentName)}</div>
                            <div class="small text-muted font-monospace">${escapeHtml(user.studentMatricula)}</div>
                        </td>
                        <td><span class="badge border ${badgeClass}">${escapeHtml(user.tipoUsuario)}</span></td>
                        <td>
                            <div class="fw-bold text-success">$${user.totalCondonado.toFixed(2)}</div>
                            <div class="small text-muted" style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(lastReason)}">${escapeHtml(lastReason)}</div>
                        </td>
                        <td class="text-end pe-4">
                            <span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Condonado</span>
                        </td>
                    </tr>
                `;
            } else {
                const hasUnreturned = user.deudas.some(d => {
                    const status = String(d.status).toLowerCase();
                    return !d.fechaDevolucionReal && !status.includes('devuelto') && status !== 'entregado' && status !== 'completado';
                });
                
                const returnBadge = hasUnreturned 
                    ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger small ms-2" title="El usuario no ha devuelto todos los libros prestados"><i class="bi bi-clock-history me-1"></i>Deuda Sumando</span>` 
                    : `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning small ms-2" title="Los libros han sido devueltos, pero aún debe pagar la multa"><i class="bi bi-check-all me-1"></i>Libros Devueltos</span>`;

                return `
                    <tr class="cursor-pointer" onclick="AdminBiblio.mostrarDetallesUsuario('${uidStr}')">
                        <td class="ps-4">
                            <div class="fw-bold text-dark">${escapeHtml(user.studentName)}</div>
                            <div class="small text-muted font-monospace">${escapeHtml(user.studentMatricula)}</div>
                        </td>
                        <td><span class="badge border ${badgeClass}">${escapeHtml(user.tipoUsuario)}</span></td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="fw-bold text-danger">$${user.deudaTotal.toFixed(2)}</div>
                                ${returnBadge}
                            </div>
                            <div class="small text-muted mt-1">${user.deudas.length} préstamo(s)</div>
                        </td>
                        <td class="text-end pe-4">
                            <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold shadow-sm" onclick="event.stopPropagation(); AdminBiblio.iniciarCondonacionUsuario('${uidStr}')">
                                <i class="bi bi-shield-check me-1"></i>Condonar
                            </button>
                        </td>
                    </tr>
                `;
            }
        }).join('');

        if (totalPages > 1) {
            pagination.classList.remove('d-none');
            pagination.innerHTML = `
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" onclick="AdminBiblio.cambiarPaginaDeudores(-1)" ${safePage === 0 ? 'disabled' : ''}>
                    <i class="bi bi-chevron-left me-1"></i>Anterior
                </button>
                <span class="small fw-bold text-muted">Pág ${safePage + 1} de ${totalPages}</span>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" onclick="AdminBiblio.cambiarPaginaDeudores(1)" ${safePage >= totalPages - 1 ? 'disabled' : ''}>
                    Siguiente<i class="bi bi-chevron-right ms-1"></i>
                </button>
            `;
        } else {
            pagination.classList.add('d-none');
        }
    }

    function mostrarDetallesUsuario(uid) {
        let user = _debtorsList.find(u => u.studentId === uid || u.studentMatricula === uid);
        let isCondonado = false;
        if (!user) {
            user = _condonadosList.find(u => u.studentId === uid || u.studentMatricula === uid);
            isCondonado = true;
        }
        if (!user) return;

        const parseDate = (val) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            return new Date(val).getTime() || 0;
        };

        const formatD = (val) => val ? new Date(parseDate(val)).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '--';

        const modalId = 'modal-detalles-usuario';
        let mEl = document.getElementById(modalId);
        if (!mEl) {
            mEl = document.createElement('div');
            mEl.id = modalId;
            mEl.className = 'modal fade';
            document.body.appendChild(mEl);
        }

        const itemsHTML = isCondonado ? user.condonaciones.map(loan => {
            return `
                <div class="list-group-item bg-white border-0 shadow-sm mb-2 rounded-3 p-3">
                    <div class="fw-bold text-dark mb-1"><i class="bi bi-book me-2 text-secondary"></i>${escapeHtml(loan.tituloLibro || 'Libro')}</div>
                    <div class="small text-muted mb-1"><i class="bi bi-calendar-check me-2"></i><strong>Vencía:</strong> ${formatD(loan.fechaVencimiento)}</div>
                    <div class="small text-muted mb-1"><i class="bi bi-calendar-event me-2"></i><strong>Condonado:</strong> ${formatD(loan.fechaDevolucionReal || loan.fechaPago || loan.fechaSolicitud)}</div>
                    <div class="small text-info mt-2 fst-italic"><i class="bi bi-info-circle me-1"></i>"${escapeHtml(loan.motivoPerdon || 'Perdón general')}"</div>
                </div>
            `;
        }).join('') : user.deudas.map(loan => {
            return `
                <div class="list-group-item bg-white border-0 shadow-sm mb-2 rounded-3 p-3">
                    <div class="fw-bold text-dark mb-1"><i class="bi bi-book me-2 text-secondary"></i>${escapeHtml(loan.tituloLibro || 'Libro')}</div>
                    <div class="small text-muted mb-1"><i class="bi bi-calendar-plus me-2"></i><strong>Préstamo:</strong> ${formatD(loan.fechaEntrega || loan.fechaSolicitud)}</div>
                    <div class="small text-muted mb-1"><i class="bi bi-calendar-x me-2"></i><strong>Vencía:</strong> ${formatD(loan.fechaVencimiento)}</div>
                    <div class="small text-danger fw-bold mt-2"><i class="bi bi-exclamation-triangle me-1"></i>Retraso: ${Number(loan.diasRetraso) || 0} día(s) ($${(Number(loan.montoDeuda)||0).toFixed(2)})</div>
                </div>
            `;
        }).join('');

        mEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered" style="z-index: 1060;">
                <div class="modal-content rounded-4 border-0 shadow">
                    <div class="modal-header border-0 ${isCondonado ? 'bg-success' : 'bg-danger'} text-white">
                        <h5 class="fw-bold mb-0"><i class="bi bi-person-vcard me-2"></i>Detalles del Usuario</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body bg-light">
                        <div class="text-center mb-4">
                            <h5 class="fw-bold text-dark mb-1">${escapeHtml(user.studentName)}</h5>
                            <div class="text-muted font-monospace">${escapeHtml(user.studentMatricula)}</div>
                            <span class="badge ${isCondonado ? 'bg-success' : 'bg-danger'} mt-2">${isCondonado ? 'Condonado' : 'Adeudo Activo'}</span>
                        </div>
                        <h6 class="fw-bold text-secondary mb-3">${isCondonado ? 'Historial de Condonaciones' : 'Préstamos Vencidos'}</h6>
                        <div class="list-group" style="max-height: 50vh; overflow-y: auto;">
                            ${itemsHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
        new bootstrap.Modal(mEl).show();
    }

    function cambiarPaginaDeudores(dir) {
        _debtorsPage += dir;
        renderDebtorsTable();
    }

    function abrirModalCondonacion() {
        clearLiveAssetStreams();
        _isShowingCondonados = false;
        _debtorsPage = 0;
        
        const now = new Date();
        const m = now.getMonth();
        const q = Math.floor(m / 3);
        const s = Math.floor(m / 6);
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        let monthOpts = '<option value="">Por Mes</option>';
        for(let i = m; i >= 0; i--) monthOpts += `<option value="m_${i}">${meses[i]}</option>`;
        
        let quarterOpts = '<option value="">Por Trimestre</option>';
        for(let i = q; i >= 0; i--) quarterOpts += `<option value="q_${i}">Trimestre ${i+1}</option>`;
        
        let semOpts = '<option value="">Por Semestre</option>';
        for(let i = s; i >= 0; i--) semOpts += `<option value="s_${i}">Semestre ${i+1}</option>`;

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-secondary text-white p-4">
                <h3 class="fw-bold mb-0"><i class="bi bi-shield-check me-3"></i>Retrasos y Condonaciones</h3>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <h5 class="fw-bold text-dark mb-0 me-2" id="condon-table-title">Usuarios con Deuda Pendiente</h5>
                        <select class="form-select form-select-sm w-auto rounded-pill fw-bold text-secondary shadow-sm" id="filter-month" onchange="AdminBiblio.onFilterChange('month')">
                            ${monthOpts}
                        </select>
                        <select class="form-select form-select-sm w-auto rounded-pill fw-bold text-secondary shadow-sm" id="filter-quarter" onchange="AdminBiblio.onFilterChange('quarter')">
                            ${quarterOpts}
                        </select>
                        <select class="form-select form-select-sm w-auto rounded-pill fw-bold text-secondary shadow-sm" id="filter-semester" onchange="AdminBiblio.onFilterChange('semester')">
                            ${semOpts}
                        </select>
                        <button class="btn btn-sm btn-dark rounded-pill fw-bold shadow-sm" id="btn-filter-all" onclick="AdminBiblio.onFilterChange('all')">Todos</button>
                    </div>
                    <button class="btn btn-outline-secondary rounded-pill fw-bold btn-sm bg-white shadow-sm" id="btn-toggle-condonados" onclick="AdminBiblio.toggleCondonadosView()">
                        <i class="bi bi-arrow-left-right me-1"></i>Ver Solo Condonaciones
                    </button>
                </div>
                
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light text-secondary">
                                <tr>
                                    <th class="ps-4">Usuario</th>
                                    <th>Vocación</th>
                                    <th>Monto</th>
                                    <th class="text-end pe-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="condon-table-body">
                                <tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-secondary"></div><div class="small mt-2 fw-bold text-muted">Cargando base de datos...</div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div id="condon-pagination" class="d-flex justify-content-between align-items-center mb-4 d-none"></div>

                <div class="mt-4 border-top pt-3 d-flex flex-wrap justify-content-end align-items-center gap-3">
                    <button class="btn btn-primary rounded-pill fw-bold shadow-sm px-4" onclick="AdminBiblio.exportarDeudores()">
                        <i class="bi bi-file-earmark-pdf me-2"></i>Exportar lista
                    </button>
                </div>
            </div>
        `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        cargarListaDeudoresGlobal();
    }

    async function iniciarCondonacionUsuario(uid) {
        const user = _debtorsList.find(u => u.studentId === uid || u.studentMatricula === uid);
        if (!user || user.deudas.length === 0) return;

        if (user.deudas.length === 1) {
            condonarRegistroIndividual(user.deudas[0].id);
        } else {
            mostrarPanelMultiCondonacion(user);
        }
    }

    function mostrarPanelMultiCondonacion(user) {
        const modalId = 'modal-multi-condonacion';
        let mEl = document.getElementById(modalId);
        if (!mEl) {
            mEl = document.createElement('div');
            mEl.id = modalId;
            mEl.className = 'modal fade';
            mEl.innerHTML = `
                <div class="modal-dialog modal-dialog-centered" style="z-index: 1060;">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 bg-secondary text-white">
                            <h5 class="fw-bold mb-0"><i class="bi bi-shield-check me-2"></i>Condonar Préstamos Múltiples</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body bg-light" id="multi-condonacion-body">
                            <!-- Inyectado dinamicamente -->
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(mEl);
        }

        const body = document.getElementById('multi-condonacion-body');
        body.innerHTML = `
            <p class="small text-muted mb-3">El usuario <strong>${escapeHtml(user.studentName)}</strong> tiene múltiples deudas. Selecciona cuál condonar:</p>
            <div class="list-group mb-3">
                ${user.deudas.map(loan => `
                    <div class="list-group-item d-flex justify-content-between align-items-center bg-white border-0 shadow-sm mb-2 rounded-3 p-3">
                        <div>
                            <div class="fw-bold text-dark">${escapeHtml(loan.tituloLibro || 'Libro')}</div>
                            <div class="small text-danger fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>$${(Number(loan.montoDeuda)||0).toFixed(2)} de deuda</div>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary rounded-pill fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('${modalId}')).hide(); setTimeout(()=>AdminBiblio.condonarRegistroIndividual('${escapeJsString(loan.id)}'), 400);">
                            Condonar
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        new bootstrap.Modal(mEl).show();
    }

    async function condonarRegistroIndividual(loanId) {
        let justificacion = await showPromptModal({
            icon: 'shield-check',
            iconColor: '#6c757d',
            title: 'Condonar registro',
            message: 'Escribe el motivo o justificación de la condonación para este préstamo. El retraso seguirá registrado para historial, pero la deuda se perdonará.',
            placeholder: 'Ej: Error de sistema, Perdonado por dirección...',
            confirmText: 'Confirmar Condonación',
            confirmClass: 'btn-secondary text-white'
        });
        
        if (justificacion === null) return;
        justificacion = justificacion.trim();
        if (!justificacion) {
            showToast('Debes escribir una justificación obligatoriamente.', 'warning');
            return;
        }

        try {
            await BiblioService.condonarRegistroPrestamo(_ctx, loanId, justificacion);
            showToast("Registro condonado correctamente.", "success");
            loadAdminStats();
            cargarListaDeudoresGlobal(); // Recargar datos
        } catch (e) {
            console.error('[AdminBiblio] Error condonando registro:', e);
            showToast(e.message, "danger");
        }
    }

    function exportarDeudores() {
        if (!window.ExportUtils) {
            return showToast("ExportUtils no está cargado.", "warning");
        }
        
        const { filteredDebtors, filteredCondonados, period, startDate, endDate, currentYear } = getFilteredLists();

        const totalDeudaPeriodo = filteredDebtors.reduce((acc, u) => acc + u.deudaTotal, 0);
        const totalCondonadoPeriodo = filteredCondonados.reduce((acc, u) => acc + u.totalCondonado, 0);

        const sections = [];
        
        if (filteredDebtors.length > 0) {
            sections.push({
                title: 'Usuarios con Adeudos Activos',
                headers: ['Matrícula', 'Nombre', 'Vocación', 'Libro(s)', 'Estado', 'Monto'],
                rows: filteredDebtors.map(u => {
                    const hasUnreturned = u.deudas.some(d => {
                        const status = String(d.status).toLowerCase();
                        return !d.fechaDevolucionReal && !status.includes('devuelto') && status !== 'entregado' && status !== 'completado';
                    });
                    const statusText = hasUnreturned ? 'Deuda Sumando' : 'Devuelto (Solo Multa)';
                    const books = u.deudas.map(d => d.tituloLibro || 'Libro sin título').join('\n');
                    
                    return [
                        u.studentMatricula || 'S/N',
                        u.studentName,
                        u.tipoUsuario,
                        books,
                        statusText,
                        `$${u.deudaTotal.toFixed(2)}`
                    ];
                }),
                tone: 'danger'
            });
        }
        
        if (filteredCondonados.length > 0) {
            sections.push({
                title: 'Usuarios Condonados',
                headers: ['Matrícula', 'Nombre', 'Vocación', 'Libro(s)', 'Motivo', 'Monto'],
                rows: filteredCondonados.map(u => {
                    const books = u.condonaciones.map(d => d.tituloLibro || 'Libro sin título').join('\n');
                    const reasons = u.condonaciones.map(d => d.motivoPerdon || 'Perdón general').join('\n');
                    
                    return [
                        u.studentMatricula || 'S/N',
                        u.studentName,
                        u.tipoUsuario,
                        books,
                        reasons,
                        `$${u.totalCondonado.toFixed(2)} (Condonado)`
                    ];
                }),
                tone: 'success'
            });
        }

        if (sections.length === 0) {
            return showToast("No hay registros en el periodo seleccionado para exportar.", "warning");
        }

        ExportUtils.generatePDF({
            period: period
        }, {
            kind: 'generic',
            filenameBase: `Deudores_${period}_${currentYear}`,
            title: 'Reporte de Deudores y Condonaciones',
            subtitle: `Periodo: ${startDate.toLocaleDateString('es-MX')} al ${endDate.toLocaleDateString('es-MX')}`,
            recordCount: filteredDebtors.length + filteredCondonados.length,
            summary: [
                ['Total Adeudos Pendientes', `$${totalDeudaPeriodo.toFixed(2)}`],
                ['Total Condonado', `$${totalCondonadoPeriodo.toFixed(2)}`],
                ['Total de Usuarios en Reporte', String(filteredDebtors.length + filteredCondonados.length)]
            ],
            sections: sections
        }, 'BIBLIO');
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
        toggleCondonadosView: withState(toggleCondonadosView),
        cambiarPaginaDeudores: withState(cambiarPaginaDeudores),
        iniciarCondonacionUsuario: withState(iniciarCondonacionUsuario),
        condonarRegistroIndividual: withState(condonarRegistroIndividual),
        mostrarDetallesUsuario: withState(mostrarDetallesUsuario),
        exportarDeudores: withState(exportarDeudores),
        consultarDevolucion: withState(consultarDevolucion),
        perdonarRetrasoModal: withState(perdonarRetrasoModal),
        confirmarDevolucion: withState(confirmarDevolucion),
        onFilterChange: withState(onFilterChange)
    };
})();
