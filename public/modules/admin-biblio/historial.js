if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Historial = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _searchDebounce = null;
    let _ultimoDocHistorial = null;
    let _tipoHistorialActivo = null;

    function syncFromState() {
        _ctx = state.ctx;
        _searchDebounce = state.searchDebounce;
        _ultimoDocHistorial = state.ultimoDocHistorial;
        _tipoHistorialActivo = state.tipoHistorialActivo;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.searchDebounce = _searchDebounce;
        state.ultimoDocHistorial = _ultimoDocHistorial;
        state.tipoHistorialActivo = _tipoHistorialActivo;
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
    function abrirModalDevolucion(...args) { return window.AdminBiblio.abrirModalDevolucion(...args); }
    function consultarDevolucion(...args) { return window.AdminBiblio.consultarDevolucion(...args); }
    function perdonarRetrasoModal(...args) { return window.AdminBiblio.perdonarRetrasoModal(...args); }
    function confirmarDevolucion(...args) { return window.AdminBiblio.confirmarDevolucion(...args); }
    function abrirModalComputadoras(...args) { return window.AdminBiblio.abrirModalComputadoras(...args); }
    function forzarLimpiezaPCs(...args) { return window.AdminBiblio.forzarLimpiezaPCs(...args); }
    function loadPCGrid(...args) { return window.AdminBiblio.loadPCGrid(...args); }
    function asignarPC(...args) { return window.AdminBiblio.asignarPC(...args); }
    function handleAssetClick(...args) { return window.AdminBiblio.handleAssetClick(...args); }
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

    function abrirModalHistorial(type) {
        clearLiveAssetStreams();
        _tipoHistorialActivo = type;
        _ultimoDocHistorial = null; // Reiniciar paginación

        let titulo, icono, color;
        if (type === 'visitas') { titulo = 'Historial de Visitas'; icono = 'person-check-fill'; color = 'primary'; }
        else if (type === 'prestamos') { titulo = 'Historial de Préstamos Activos'; icono = 'book-half'; color = 'warning'; }
        else if (type === 'devoluciones') { titulo = 'Historial de Devoluciones'; icono = 'box-arrow-in-down'; color = 'success'; }
        else if (type === 'pcs') { titulo = 'Activos en uso'; icono = 'pc-display'; color = 'info'; }

        const placeholder = type === 'pcs'
            ? 'Buscar por matricula o equipo...'
            : 'Buscar por matricula...';

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-${color} text-${type === 'prestamos' ? 'dark' : 'white'} p-4">
                <h4 class="fw-bold mb-0"><i class="bi bi-${icono} me-3"></i>${titulo}</h4>
                <button class="btn-close ${type === 'prestamos' ? '' : 'btn-close-white'}" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4 bg-light">
                <!-- Filtros -->
                <div class="row g-2 mb-3">
                    <div class="col-8">
                        <input type="text" id="historial-search" class="form-control rounded-pill shadow-sm" placeholder="Buscar por Matrícula..." onkeyup="if(event.key==='Enter') AdminBiblio.cargarHistorial(true)">
                    </div>
                    <div class="col-4">
                        <button class="btn btn-${color} w-100 rounded-pill shadow-sm text-truncate" onclick="AdminBiblio.cargarHistorial(true)">
                            <i class="bi bi-search"></i> Buscar
                        </button>
                    </div>
                </div>

                <!-- Contenedor Lista -->
                <div class="bg-white rounded-4 shadow-sm p-3 border">
                    <div id="historial-list-container" class="d-flex flex-column gap-3" style="max-height: 400px; overflow-y: auto;">
                        <div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm"></span> Cargando...</div>
                    </div>
                    
                    <!-- Paginación -->
                    <div class="text-center mt-3 border-top pt-3" id="historial-pagination" style="display:none;">
                        <button class="btn btn-sm btn-outline-secondary rounded-pill px-4 shadow-sm" onclick="AdminBiblio.cargarHistorial(false)">
                            <i class="bi bi-arrow-down-circle me-1"></i> Cargar siguientes 10
                        </button>
                    </div>
                </div>
            </div>
        `;

        const searchInput = document.getElementById('historial-search');
        if (searchInput) searchInput.placeholder = placeholder;

        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();
        cargarHistorial(true);
    }


    async function cargarHistorial(nuevaBusqueda = false) {
        if (nuevaBusqueda) _ultimoDocHistorial = null;

        const container = document.getElementById('historial-list-container');
        const pagination = document.getElementById('historial-pagination');
        const searchVal = document.getElementById('historial-search').value.trim();
        const type = _tipoHistorialActivo;

        if (nuevaBusqueda) {
            container.innerHTML = '<div class="text-center text-muted py-4"><span class="spinner-border text-primary"></span></div>';
            pagination.style.display = 'none';
        }

        try {
            let queryRef;
            const LIMIT = 10;
            let docsData = [];
            let applyPagination = true;

            if (type === 'visitas') {
                queryRef = _ctx.db.collection('biblio-visitas').orderBy('fecha', 'desc');
                if (searchVal) queryRef = _ctx.db.collection('biblio-visitas').where('matricula', '==', searchVal.toUpperCase()).orderBy('fecha', 'desc');
            } else if (type === 'prestamos') {
                if (searchVal) {
                    const user = await BiblioService.findUserByQuery(_ctx, searchVal);
                    if (!user) {
                        container.innerHTML = '<div class="alert alert-light text-center mb-0 border"><i class="bi bi-inbox fs-3 text-muted d-block mb-2"></i>No se encontraron resultados.</div>';
                        pagination.style.display = 'none';
                        return;
                    }
                    queryRef = _ctx.db.collection('prestamos-biblio').where('studentId', '==', user.uid).orderBy('fechaSolicitud', 'desc');
                } else {
                    queryRef = _ctx.db.collection('prestamos-biblio').orderBy('fechaSolicitud', 'desc');
                }
            } else if (type === 'devoluciones') {
                if (searchVal) {
                    const user = await BiblioService.findUserByQuery(_ctx, searchVal);
                    if (!user) {
                        container.innerHTML = '<div class="alert alert-light text-center mb-0 border"><i class="bi bi-inbox fs-3 text-muted d-block mb-2"></i>No se encontraron resultados.</div>';
                        pagination.style.display = 'none';
                        return;
                    }
                    queryRef = _ctx.db.collection('prestamos-biblio')
                        .where('studentId', '==', user.uid)
                        .where('estado', 'in', ['finalizado', 'cobro_pendiente'])
                        .orderBy('fechaDevolucionReal', 'desc');
                } else {
                    queryRef = _ctx.db.collection('prestamos-biblio').where('estado', 'in', ['finalizado', 'cobro_pendiente']).orderBy('fechaDevolucionReal', 'desc');
                }
            } else if (type === 'pcs') {
                queryRef = _ctx.db.collection('biblio-activos').where('status', '==', 'ocupado');
                if (searchVal) {
                    applyPagination = false;
                }
            }

            if (applyPagination) {
                queryRef = queryRef.limit(LIMIT);
            }

            if (applyPagination && _ultimoDocHistorial && !nuevaBusqueda) {
                queryRef = queryRef.startAfter(_ultimoDocHistorial);
            }

            const snap = await queryRef.get();

            if (snap.empty) {
                if (nuevaBusqueda) {
                    container.innerHTML = '<div class="alert alert-light text-center mb-0 border"><i class="bi bi-inbox fs-3 text-muted d-block mb-2"></i>No se encontraron resultados.</div>';
                }
                pagination.style.display = 'none';
                return;
            }

            _ultimoDocHistorial = applyPagination ? snap.docs[snap.docs.length - 1] : null;

            // Map docs to data
            docsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (type === 'pcs' && searchVal) {
                const searchLower = searchVal.toLowerCase();
                docsData = docsData.filter(item => {
                    const matricula = (item.occupiedByMatricula || '').toLowerCase();
                    const nombre = (item.nombre || '').toLowerCase();
                    const id = (item.id || '').toLowerCase();
                    return matricula.includes(searchLower) || nombre.includes(searchLower) || id.includes(searchLower);
                });

                if (docsData.length === 0) {
                    container.innerHTML = '<div class="alert alert-light text-center mb-0 border"><i class="bi bi-inbox fs-3 text-muted d-block mb-2"></i>No se encontraron resultados.</div>';
                    pagination.style.display = 'none';
                    return;
                }
            }

            // ENHANCEMENT: Fetch user and book details for loans and returns
            if (type === 'prestamos' || type === 'devoluciones') {
                const uidsFetch = [...new Set(docsData.map(d => d.studentId).filter(id => id))];
                const bookIdsFetch = [...new Set(docsData.map(d => d.libroId).filter(id => id))];

                try {
                    // Fetch Users
                    const userMap = {};
                    if (uidsFetch.length > 0) {
                        for (let i = 0; i < uidsFetch.length; i += 10) {
                            const chunk = uidsFetch.slice(i, i + 10);
                            const usersSnap = await _ctx.db.collection('usuarios').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                            usersSnap.forEach(uDoc => { userMap[uDoc.id] = uDoc.data(); });
                        }
                    }

                    // Fetch Books
                    const bookMap = {};
                    if (bookIdsFetch.length > 0) {
                        for (let i = 0; i < bookIdsFetch.length; i += 10) {
                            const chunk = bookIdsFetch.slice(i, i + 10);
                            const bookSnap = await _ctx.db.collection('biblio-catalogo').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                            bookSnap.forEach(bDoc => { bookMap[bDoc.id] = bDoc.data(); });
                        }
                    }

                    // Assign data back
                    docsData.forEach(d => {
                        if (d.studentId && userMap[d.studentId]) {
                            d._resolvedStudentName = userMap[d.studentId].displayName || userMap[d.studentId].nombre || 'Estudiante';
                            d._resolvedStudentMatricula = userMap[d.studentId].matricula || d.studentId;
                        } else {
                            d._resolvedStudentName = 'Estudiante';
                            d._resolvedStudentMatricula = d.studentId;
                        }

                        if (d.libroId && bookMap[d.libroId]) {
                            d.adquisicion = bookMap[d.libroId].adquisicion || bookMap[d.libroId].numeroAdquisicion || bookMap[d.libroId].isbn || '--';
                        }
                    });
                } catch (err) {
                    console.warn("Could not fetch user/book details for history", err);
                }
            }

            let html = '';

            // If prestamos, separate active vs inactive UI if it's the first render
            if (type === 'prestamos' && nuevaBusqueda) {
                const activos = docsData.filter(d => isActiveLoanState(d.estado));
                const inactivos = docsData.filter(d => !isActiveLoanState(d.estado));

                if (activos.length > 0) {
                    html += `<h6 class="fw-bold text-success mb-2"><i class="bi bi-circle-fill small me-2 text-success"></i>Préstamos Activos</h6>`;
                    activos.forEach(data => html += generarItemHistorial(type, data));
                }

                if (inactivos.length > 0) {
                    html += `<h6 class="fw-bold text-muted mb-2 mt-4"><i class="bi bi-archive me-2"></i>Otros Préstamos (Historial)</h6>`;
                    inactivos.forEach(data => html += generarItemHistorial(type, data));
                }
            } else {
                // Normal render for others or paginated loans
                docsData.forEach(data => {
                    html += generarItemHistorial(type, data);
                });
            }

            if (nuevaBusqueda) {
                container.innerHTML = html;
            } else {
                container.insertAdjacentHTML('beforeend', html);
            }

            pagination.style.display = applyPagination && snap.docs.length === LIMIT ? 'block' : 'none';

        } catch (e) {
            console.error("Error cargando historial:", e);
            container.innerHTML = `<div class="alert alert-danger text-center"><i class="bi bi-exclamation-triangle-fill d-block mb-2"></i> Error: ${e.message}</div>`;
        }
    }


    function generarItemHistorial(type, item) {
        const itemPayload = encodeItemPayload(item);
        const safeItemId = escapeJsString(item.id || '');

        if (type === 'visitas') {
            const hora = item.fecha?.toDate ? item.fecha.toDate().toLocaleString() : '--';
            const salida = item.salida?.toDate ? item.salida.toDate().toLocaleTimeString() : 'En curso';
            const studentName = escapeHtml(item.studentName || 'Estudiante');
            const matricula = escapeHtml(item.matricula || '--');
            const motivo = escapeHtml(item.motivo || 'Visita');
            return `
                <div class="d-flex align-items-center gap-3 bg-light rounded-3 p-3 border hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('visita', '${safeItemId}', AdminBiblio.decodeItemPayload('${itemPayload}'))">
                    <div class="bg-primary bg-opacity-10 rounded-circle text-primary d-flex align-items-center justify-content-center" style="width:40px;height:40px;min-width:40px;">
                        <i class="bi bi-person-fill"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="fw-bold text-truncate">${studentName}</div>
                        <div class="text-muted small">${matricula} &bull; ${motivo}</div>
                    </div>
                    <div class="text-end" style="min-width: 80px;">
                        <div class="small fw-bold text-dark">${hora}</div>
                        <span class="badge ${salida === 'En curso' ? 'bg-success' : 'bg-secondary'} rounded-pill mt-1" style="font-size:0.65rem;">S: ${salida}</span>
                    </div>
                </div>`;
        } else if (type === 'prestamos') {
            const isActivo = isActiveLoanState(item.estado);
            const isPendingPickup = item.estado === 'pendiente' || item.estado === 'pendiente_entrega';
            const venc = item.fechaVencimiento?.toDate ? item.fechaVencimiento.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
            const fSol = item.fechaSolicitud?.toDate ? item.fechaSolicitud.toDate().toLocaleDateString() : '--';
            const studentDis = escapeHtml(item._resolvedStudentName ? `${item._resolvedStudentName} (${item._resolvedStudentMatricula})` : item.studentId);
            const titulo = escapeHtml(item.tituloLibro || 'Libro');
            const statusBadge = isPendingPickup
                ? `<span class="badge bg-info text-white rounded-pill fw-bold">Pendiente</span>`
                : (isActivo
                    ? `<span class="badge bg-warning text-dark rounded-pill fw-bold">Vence: ${venc}</span>`
                    : `<span class="badge bg-secondary text-white rounded-pill fw-bold">${escapeHtml(item.estado || '--')}</span>`);
            return `
                <div class="d-flex align-items-center gap-3 bg-${isActivo ? 'white' : 'light'} rounded-3 p-3 border hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('prestamo', '${safeItemId}', AdminBiblio.decodeItemPayload('${itemPayload}'))">
                    <div class="bg-${isActivo ? 'warning' : 'secondary'} bg-opacity-10 rounded-circle text-${isActivo ? 'warning' : 'secondary'} d-flex align-items-center justify-content-center" style="width:40px;height:40px;min-width:40px;">
                        <i class="bi bi-book"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="fw-bold text-truncate ${!isActivo ? 'text-muted' : ''}">${titulo}</div>
                        <div class="text-muted small text-truncate" style="max-width: 200px;">${studentDis} &bull; Solicitado: ${fSol}</div>
                    </div>
                    <div class="text-end" style="min-width: 80px;">
                        ${statusBadge}
                    </div>
                </div>`;
        } else if (type === 'devoluciones') {
            const dDev = parseDate(item.fechaDevolucionReal);
            const fecha = dDev ? dDev.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
            const hora = dDev ? dDev.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const multa = item.montoDeuda || 0;
            const studentDis = escapeHtml(item._resolvedStudentName ? `${item._resolvedStudentName} (${item._resolvedStudentMatricula})` : item.studentId);
            const titulo = escapeHtml(item.tituloLibro || 'Libro');
            return `
                <div class="d-flex align-items-center gap-3 bg-light rounded-3 p-3 border hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('devolucion', '${safeItemId}', AdminBiblio.decodeItemPayload('${itemPayload}'))">
                    <div class="bg-success bg-opacity-10 rounded-circle text-success d-flex align-items-center justify-content-center" style="width:40px;height:40px;min-width:40px;">
                        <i class="bi bi-box-arrow-in-down"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="fw-bold text-truncate">${titulo}</div>
                        <div class="text-muted small text-truncate" style="max-width: 300px;">
                            <i class="bi bi-person me-1"></i>${studentDis} &bull; <i class="bi bi-clock ms-1"></i> ${fecha} ${hora}
                        </div>
                    </div>
                    <div class="text-end" style="min-width: 100px;">
                        ${multa > 0
                    ? `<span class="badge bg-danger rounded-pill fw-bold" style="font-size: 0.75rem;">Deuda: $${multa}</span>`
                    : `<span class="badge bg-success rounded-pill fw-bold" style="font-size: 0.75rem;">Liquido</span>`}
                        ${item.perdonado ? `<span class="badge bg-info text-dark ms-1" style="font-size: 0.75rem;" title="Multa Perdonada"><i class="bi bi-shield-check"></i> Perdón</span>` : ''}
                    </div>
                </div>`;
        } else if (type === 'pcs') {
            let timeLabel = '';
            if (item.expiresAt) {
                const expMs = item.expiresAt.toMillis ? item.expiresAt.toMillis() : item.expiresAt;
                const remainMs = expMs - Date.now();
                timeLabel = remainMs <= 0 ? 'Expirado' : `${Math.ceil(remainMs / 60000)} min`;
            }
            const nombre = escapeHtml(item.nombre || 'Equipo');
            const matricula = escapeHtml(item.occupiedByMatricula || 'En uso');
            return `
                <div class="d-flex align-items-center gap-3 bg-light rounded-3 p-3 border hover-scale cursor-pointer" onclick="AdminBiblio.showAdminItemDetail('pc', '${safeItemId}', AdminBiblio.decodeItemPayload('${itemPayload}'))">
                    <div class="bg-info bg-opacity-10 rounded-circle text-info d-flex align-items-center justify-content-center" style="width:40px;height:40px;min-width:40px;">
                        <i class="bi bi-pc-display"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="fw-bold text-truncate">${nombre}</div>
                        <div class="text-muted small">${matricula}</div>
                    </div>
                    <div class="text-end" style="min-width: 80px;">
                        <span class="badge ${timeLabel === 'Expirado' ? 'bg-danger' : 'bg-info'} rounded-pill fw-bold">${timeLabel || 'Ocupado'}</span>
                    </div>
                </div>`;
        }
        return '';
    }

    // --- 1. MODAL REGISTRAR VISITA (STREAMLINED) ---
    // Single Screen Logic


    async function mostrarLibrosUsuario(matricula) {
        document.getElementById('prestamo-preview')?.classList.add('d-none');
        document.getElementById('devol-preview')?.classList.add('d-none');
        const container = document.getElementById('lista-libros-container');
        if (!container) return;

        container.innerHTML = '<div class="text-center py-3"><span class="spinner-border text-primary"></span></div>';

        try {
            const user = await BiblioService.findUserByQuery(_ctx, matricula);
            if (!user) throw new Error("Usuario no encontrado.");

            if (!user.recogidos || user.recogidos.length === 0) {
                container.innerHTML = '';
                return showToast("El estudiante no tiene préstamos activos. Ingresa el código del libro.", "info");
            }

            let html = `<h6 class="fw-bold text-muted mb-3"><i class="bi bi-journal-text me-2"></i>Préstamos activos de ${user.nombre}:</h6>`;
            html += '<div class="list-group rounded-4 shadow-sm">';

            user.recogidos.forEach(loan => {
                const fVenc = loan.fechaVencimiento?.toDate ? loan.fechaVencimiento.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
                const fine = loan.multaActual > 0 ? `<span class="badge bg-danger ms-2">$${loan.multaActual} Multa</span>` : '';
                const safeTitulo = escapeHtml(loan.tituloLibro || 'Libro');
                const safeTituloJs = escapeJsString(loan.tituloLibro || 'Libro');
                const safeMatricula = escapeJsString(matricula);

                html += `
                    <div class="list-group-item d-flex justify-content-between align-items-center p-3 border-0 border-bottom">
                        <div>
                            <div class="fw-bold text-dark">${safeTitulo} ${fine}</div>
                            <div class="text-muted small">Vence: <strong class="text-danger">${fVenc}</strong></div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-primary rounded-pill fw-bold" onclick="AdminBiblio.confirmarRenovacion('${loan.id}', '${safeTituloJs}', '${fVenc}', '${safeMatricula}')">
                                <i class="bi bi-calendar-plus me-1"></i>Renovar
                            </button>
                            <button class="btn btn-sm btn-outline-success rounded-pill fw-bold" onclick="AdminBiblio.confirmarRecibirSinLibro('${loan.id}', '${loan.libroId}', '${safeMatricula}')">
                                <i class="bi bi-check2-circle me-1"></i>Recibir
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = '';
            showToast(e.message, "danger");
        }
    }


    function confirmarRenovacion(loanId, titulo, fVencActual, matricula) {
        showConfirmModal({
            icon: 'calendar-plus',
            iconColor: '#0d6efd',
            title: `Renovar Extensión`,
            message: `¿Deseas extender 1 día hábil la fecha de entrega de <strong>${escapeHtml(titulo)}</strong>?<br>Vencimiento actual: ${escapeHtml(fVencActual)}`,
            confirmText: 'Renovar',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                try {
                    await BiblioService.extenderPrestamoAdmin(_ctx, loanId);
                    showToast("Renovación exitosa.", "success");
                    mostrarLibrosUsuario(matricula); // Refresh list
                } catch (e) {
                    showToast(e.message, "danger");
                }
            }
        });
    }


    function confirmarRecibirSinLibro(idPrestamo, idLibro, matricula) {
        // En lugar de devolverlo directamente, rellenamos los campos de devolución 
        // para que se muestre el desglose (incluyendo deudas y la opción de perdonar)
        const userInput = document.getElementById('devol-user');
        const bookInput = document.getElementById('devol-book');

        if (userInput) userInput.value = matricula;
        if (bookInput) bookInput.value = idLibro;

        // Limpiamos la vista de los préstamos del usuario para dar paso al preview de devolución
        const container = document.getElementById('lista-libros-container');
        if (container) container.innerHTML = '';

        consultarDevolucion();
    }

    // --- 6. GESTION DE LIBROS (NUEVO) ---


    return {
        abrirModalHistorial: withState(abrirModalHistorial),
        cargarHistorial: withState(cargarHistorial),
        generarItemHistorial: withState(generarItemHistorial),
        mostrarLibrosUsuario: withState(mostrarLibrosUsuario),
        confirmarRenovacion: withState(confirmarRenovacion),
        confirmarRecibirSinLibro: withState(confirmarRecibirSinLibro)
    };
})();
