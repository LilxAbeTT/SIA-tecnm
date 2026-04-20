if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Catalogo = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _configAssetsUnsub = null;
    let _holidayCalendarCursor = null;
    let _holidaySelectedDates = [];
    let _holidayBlockedDates = [];
    let _holidaySelectionAnchor = null;
    let _holidayCalendarMeta = null;
    let _holidayPointerActive = false;
    let _holidayPointerMode = 'add';
    let _holidayLastPointerDate = '';

    function syncFromState() {
        _ctx = state.ctx;
        _configAssetsUnsub = state.configAssetsUnsub;
        _holidayCalendarCursor = state.holidayCalendarCursor;
        _holidaySelectedDates = Array.isArray(state.holidaySelectedDates) ? state.holidaySelectedDates.slice() : [];
        _holidayBlockedDates = Array.isArray(state.holidayBlockedDates) ? state.holidayBlockedDates.slice() : [];
        _holidaySelectionAnchor = state.holidaySelectionAnchor;
        _holidayCalendarMeta = state.holidayCalendarMeta;
    }

    function syncToState() {
        state.ctx = _ctx;
        state.configAssetsUnsub = _configAssetsUnsub;
        state.holidayCalendarCursor = _holidayCalendarCursor;
        state.holidaySelectedDates = Array.isArray(_holidaySelectedDates) ? _holidaySelectedDates.slice() : [];
        state.holidayBlockedDates = Array.isArray(_holidayBlockedDates) ? _holidayBlockedDates.slice() : [];
        state.holidaySelectionAnchor = _holidaySelectionAnchor;
        state.holidayCalendarMeta = _holidayCalendarMeta;
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

    function formatDateKeyLocal(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDateKeyLocal(value) {
        const raw = String(value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
        const [year, month, day] = raw.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    function startOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
    }

    function getHolidaySelectedSet() {
        return new Set(Array.isArray(_holidaySelectedDates) ? _holidaySelectedDates : []);
    }

    function getHolidayBlockedSet() {
        return new Set(Array.isArray(_holidayBlockedDates) ? _holidayBlockedDates : []);
    }

    function isWeekendDateKey(dateKey) {
        const date = parseDateKeyLocal(dateKey);
        if (!date) return false;
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    function normalizeHolidaySelection() {
        const blocked = getHolidayBlockedSet();
        _holidaySelectedDates = [...new Set((_holidaySelectedDates || []).filter((dateKey) => dateKey && !isWeekendDateKey(dateKey) && !blocked.has(dateKey)))].sort();
    }

    function normalizeHolidayBlockedDates() {
        _holidayBlockedDates = [...new Set((_holidayBlockedDates || []).filter((dateKey) => dateKey && !isWeekendDateKey(dateKey)))].sort();
    }

    function getDateRangeKeys(fromKey, toKey) {
        const start = parseDateKeyLocal(fromKey);
        const end = parseDateKeyLocal(toKey);
        if (!start || !end) return [];
        const rangeStart = start <= end ? start : end;
        const rangeEnd = start <= end ? end : start;
        const keys = [];
        const cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
            keys.push(formatDateKeyLocal(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return keys;
    }

    function groupHolidayRanges(dateKeys = []) {
        const sorted = [...new Set((dateKeys || []).filter(Boolean))].sort();
        if (!sorted.length) return [];
        const ranges = [];
        let current = { start: sorted[0], end: sorted[0], count: 1 };

        for (let index = 1; index < sorted.length; index += 1) {
            const previousDate = parseDateKeyLocal(current.end);
            const nextDate = parseDateKeyLocal(sorted[index]);
            const expectedKey = previousDate
                ? formatDateKeyLocal(new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate() + 1, 12, 0, 0, 0))
                : '';

            if (expectedKey && expectedKey === sorted[index]) {
                current.end = sorted[index];
                current.count += 1;
            } else {
                ranges.push(current);
                current = { start: sorted[index], end: sorted[index], count: 1 };
            }
        }

        ranges.push(current);
        return ranges;
    }

    function formatHolidayDateLabel(dateKey, withWeekday = false) {
        const date = parseDateKeyLocal(dateKey);
        if (!date) return '--';
        return date.toLocaleDateString('es-MX', withWeekday
            ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }
            : { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatHolidayDateTimeLabel(dateValue) {
        const date = parseDate(dateValue);
        if (!date) return '--';
        return date.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatInventoryStatusSummary(summary = {}) {
        const systemTotal = Number(summary.systemTotal) || 0;
        const registeredCatalog = Number(summary.registeredCatalog) || 0;
        const outsideCatalog = Number(summary.outsideCatalog) || 0;
        const estimatedMissing = Number(summary.estimatedMissing) || 0;

        return `
            <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="badge text-bg-light border">${systemTotal} en sistema</span>
                <span class="badge text-bg-light border">${registeredCatalog} registrados</span>
                <span class="badge text-bg-warning border">${estimatedMissing} faltantes</span>
                ${outsideCatalog > 0 ? `<span class="badge text-bg-light border">${outsideCatalog} fuera de sistema</span>` : ''}
            </div>
        `;
    }

    function sumInventoryStatusObserved(entries = []) {
        return (entries || []).reduce((total, entry) => total + (Number(entry?.totalObserved || entry?.cantidad || entry?.lastQuantity || 0) || 0), 0);
    }

    function buildGestionLibrosInventoryStatusHtml(currentState, catalogSummary, latestFinished) {
        const session = currentState?.session || null;
        if (session) {
            const statusLabel = session.status === 'paused'
                ? 'Pausado'
                : session.status === 'active'
                    ? 'En curso'
                    : 'Sin iniciar';

            return `
                <div class="fw-semibold text-dark">${escapeHtml(session.name || 'Sesion actual')}</div>
                <div class="small text-muted mb-2">Estado: ${escapeHtml(statusLabel)}</div>
                <div class="d-flex flex-wrap gap-2">
                    <span class="badge text-bg-light border">${Number(catalogSummary?.totalCopies) || 0} en sistema</span>
                    <span class="badge text-bg-light border">${Number(session.totalObserved) || 0} registrados</span>
                </div>
                <div class="d-grid gap-2 mt-3">
                    <button class="btn btn-outline-dark rounded-pill fw-bold" type="button" onclick="AdminBiblio.confirmFinalizeInventoryFromGestion()">
                        <i class="bi bi-flag me-2"></i>Cerrar inventario
                    </button>
                </div>
            `;
        }

        const finishedSession = latestFinished?.session || null;
        const summary = finishedSession?.summary || (finishedSession ? {
            systemTotal: Number(catalogSummary?.totalCopies) || 0,
            registeredCatalog: sumInventoryStatusObserved(latestFinished?.foundEntries),
            outsideCatalog: sumInventoryStatusObserved(latestFinished?.missingEntries),
            estimatedMissing: Math.max((Number(catalogSummary?.totalCopies) || 0) - sumInventoryStatusObserved(latestFinished?.foundEntries), 0),
            totalCaptured: sumInventoryStatusObserved(latestFinished?.foundEntries) + sumInventoryStatusObserved(latestFinished?.missingEntries)
        } : null);
        if (finishedSession && summary) {
            return `
                <div class="fw-semibold text-dark">Ultimo inventario cerrado</div>
                <div class="small text-muted mb-2">${escapeHtml(finishedSession.name || 'Resumen final listo')}</div>
                ${formatInventoryStatusSummary(summary)}
                <div class="d-grid gap-2">
                    <button class="btn btn-dark rounded-pill fw-bold" type="button" onclick="AdminBiblio.downloadInventorySummaryPdf('${escapeJsString(finishedSession.id || '')}')">
                        <i class="bi bi-file-earmark-pdf me-2"></i>Descargar PDF
                    </button>
                    <button class="btn btn-outline-warning rounded-pill fw-bold" type="button" onclick="AdminBiblio.confirmAdjustFinishedInventoryFromGestion('${escapeJsString(finishedSession.id || '')}')">
                        <i class="bi bi-arrow-repeat me-2"></i>Ajustar inventario
                    </button>
                </div>
                ${finishedSession.catalogAdjustedAt ? `
                    <div class="small text-success mt-2">Catalogo ajustado con este inventario.</div>
                ` : ''}
            `;
        }

        return 'No hay una sesion abierta. Al entrar podras iniciar una nueva.';
    }

    async function refreshGestionLibrosInventoryStatus() {
        const inventoryEl = document.getElementById('gestion-libros-inventory-status');
        if (!inventoryEl || !_ctx) return;

        inventoryEl.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Revisando estado...';
        try {
            const [currentState, catalogSummary, latestFinished] = await Promise.all([
                BiblioService.getCurrentInventorySession(_ctx),
                BiblioService.getInventoryCatalogSummary(_ctx),
                BiblioService.getLatestFinishedInventorySession(_ctx, { includeLists: true })
            ]);

            inventoryEl.innerHTML = buildGestionLibrosInventoryStatusHtml(currentState, catalogSummary, latestFinished);
        } catch (error) {
            console.error(error);
            inventoryEl.innerHTML = 'No se pudo cargar el estado del inventario.';
        }
    }

    async function confirmFinalizeInventoryFromGestion() {
        if (!_ctx) return;

        try {
            const currentState = await BiblioService.getCurrentInventorySession(_ctx);
            const session = currentState?.session || null;
            if (!session?.id) {
                showToast('No hay un inventario abierto para cerrar.', 'warning');
                await refreshGestionLibrosInventoryStatus();
                return;
            }

            const preview = await BiblioService.getInventoryClosurePreview(_ctx, session.id);
            const summary = preview?.summary || {};
            showConfirmModal({
                icon: 'flag-fill',
                iconColor: '#212529',
                title: 'Cerrar inventario',
                message: `
                    <div class="text-start">
                        <div class="small text-muted mb-3">Se cerrara oficialmente esta sesion.</div>
                        ${formatInventoryStatusSummary(summary)}
                        <div class="small text-muted">Si confirmas, se guardara el resumen final y quedara listo el PDF.</div>
                    </div>
                `,
                confirmText: 'Cerrar oficialmente',
                confirmClass: 'btn-dark',
                onConfirm: async () => {
                    await BiblioService.finalizeInventorySession(_ctx, session.id);
                    state.inventorySession = null;
                    state.inventoryFoundEntries = [];
                    state.inventoryMissingEntries = [];
                    await refreshGestionLibrosInventoryStatus();
                    showToast('Inventario cerrado oficialmente.', 'success');
                }
            });
        } catch (error) {
            showToast(error.message || 'No se pudo cerrar el inventario.', 'danger');
        }
    }

    async function confirmAdjustFinishedInventoryFromGestion(sessionId = '') {
        if (!_ctx) return;

        try {
            const details = sessionId
                ? await BiblioService.getInventorySessionDetails(_ctx, sessionId, { includeLists: true })
                : await BiblioService.getLatestFinishedInventorySession(_ctx, { includeLists: true });
            const session = details?.session || null;
            if (!session?.id) {
                showToast('No hay un inventario cerrado para ajustar.', 'warning');
                return;
            }

            const summary = session.summary || {
                systemTotal: 0,
                registeredCatalog: sumInventoryStatusObserved(details?.foundEntries),
                outsideCatalog: sumInventoryStatusObserved(details?.missingEntries),
                estimatedMissing: 0,
                totalCaptured: sumInventoryStatusObserved(details?.foundEntries) + sumInventoryStatusObserved(details?.missingEntries)
            };

            showConfirmModal({
                icon: 'exclamation-triangle-fill',
                iconColor: '#d97706',
                title: 'Ajustar catalogo al inventario',
                message: `
                    <div class="text-start">
                        <div class="fw-semibold text-dark mb-2">Total inventariado real: ${Number(summary.totalCaptured || summary.registeredCatalog || 0)}</div>
                        ${formatInventoryStatusSummary(summary)}
                        <div class="small text-muted mb-2">Este ajuste tomara el inventario cerrado como referencia real para actualizar el catalogo.</div>
                        <div class="small text-muted mb-2">Se activaran solo los ejemplares inventariados y el excedente quedara fuera del catalogo activo.</div>
                        <div class="small text-muted">Si hay ejemplares con prestamos activos, se conservaran temporalmente para no romper el stock.</div>
                        ${Number(summary.outsideCatalog) > 0 ? `<div class="small text-warning mt-2">Hay ${Number(summary.outsideCatalog) || 0} captura(s) fuera de sistema. Solo se ajustaran automaticamente los libros catalogados o ya asociados.</div>` : ''}
                    </div>
                `,
                confirmText: 'Confirmar ajuste',
                confirmClass: 'btn-warning',
                onConfirm: async () => {
                    await BiblioService.applyFinishedInventoryToCatalog(_ctx, session.id);
                    state.inventoryCatalogSummary = null;
                    await refreshGestionLibrosInventoryStatus();
                    showToast('Catalogo ajustado al inventario real.', 'success');
                }
            });
        } catch (error) {
            showToast(error.message || 'No se pudo ajustar el catalogo.', 'danger');
        }
    }

    function clearLiveAssetStreams() {
        if (state.pcGridUnsub) {
            try { state.pcGridUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing PC stream:', error); }
            state.pcGridUnsub = null;
        }

        if (_configAssetsUnsub) {
            try { _configAssetsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing config stream:', error); }
            _configAssetsUnsub = null;
        }

        state.configAssetsUnsub = null;
    }

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
    function abrirModalServicio(...args) { return window.AdminBiblio.abrirModalServicio(...args); }
    function renderAvailabilityGrid(...args) { return window.AdminBiblio.renderAvailabilityGrid(...args); }
    function selectSlot(...args) { return window.AdminBiblio.selectSlot(...args); }
    function confirmarReserva(...args) { return window.AdminBiblio.confirmarReserva(...args); }

    function abrirModalGestionLibros() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        const modalEl = document.getElementById('modal-admin-action');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-book-half me-3"></i>Gestion de Libros</h3>
                    <div class="small text-white-50">Elige primero el flujo que necesitas.</div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-3 p-md-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                
                <div class="row g-4">
                    <div class="col-12 col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body p-3 p-md-4">
                                <div class="d-flex align-items-center gap-3 mb-3">
                                    <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style="width:56px;height:56px;">
                                        <i class="bi bi-journal-plus fs-4 text-success"></i>
                                    </div>
                                    <div>
                                        <div class="small text-uppercase fw-bold text-muted">Agregar / editar</div>
                                        <h5 class="mb-0 text-dark">Catalogo de libros</h5>
                                    </div>
                                </div>
                                <div class="d-grid gap-2 mb-3">
                                    <button class="btn btn-success rounded-pill fw-bold" type="button" onclick="AdminBiblio.renderBookForm()">
                                        <i class="bi bi-plus-circle me-2"></i>Agregar nuevo libro
                                    </button>
                                    <button class="btn btn-outline-warning rounded-pill fw-bold" type="button" onclick="AdminBiblio.renderBookEditSearch()">
                                        <i class="bi bi-pencil-square me-2"></i>Editar libro existente
                                    </button>
                                </div>
                                <div class="small fw-bold text-muted text-uppercase mb-2">Ultimo agregado</div>
                                <div id="gestion-libros-last-book" class="rounded-4 border bg-light p-3 text-muted small">
                                    <span class="spinner-border spinner-border-sm me-2"></span>Cargando referencia...
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100 bg-danger-subtle">
                            <div class="card-body p-3 p-md-4">
                                <div class="d-flex align-items-center gap-3 mb-3">
                                    <div class="bg-white rounded-circle d-flex align-items-center justify-content-center text-danger shadow-sm" style="width:56px;height:56px;">
                                        <i class="bi bi-clipboard2-data fs-4"></i>
                                    </div>
                                    <div>
                                        <div class="small text-uppercase fw-bold text-danger-emphasis">Inventario</div>
                                        <h5 class="mb-0 text-dark">Conteo y faltantes</h5>
                                    </div>
                                </div>
                                <div class="d-grid gap-2 mb-3">
                                    <button class="btn btn-danger rounded-pill fw-bold" type="button" onclick="AdminBiblio.abrirModalInventario()">
                                        <i class="bi bi-play-circle me-2"></i>Abrir inventario
                                    </button>
                                </div>
                                <div class="small fw-bold text-muted text-uppercase mb-2">Sesion actual</div>
                                <div id="gestion-libros-inventory-status" class="rounded-4 border bg-white p-3 text-muted small">
                                    <span class="spinner-border spinner-border-sm me-2"></span>Revisando estado...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
         `;

        if (!modalEl.classList.contains('show')) {
            modal.show();
        }

        modalEl.removeEventListener('hidden.bs.modal', _cleanupBackdrop);
        modalEl.addEventListener('hidden.bs.modal', _cleanupBackdrop);

        void (async () => {
            try {
                const lastBook = await BiblioService.getLastAddedBook(_ctx);
                const lastBookEl = document.getElementById('gestion-libros-last-book');
                if (lastBookEl) {
                    if (!lastBook) {
                        lastBookEl.innerHTML = 'Aun no hay libros registrados manualmente.';
                    } else {
                        lastBookEl.innerHTML = `
                            <div class="fw-semibold text-dark text-truncate">${escapeHtml(lastBook.titulo || 'Sin titulo')}</div>
                            <div class="small text-muted text-truncate">${escapeHtml(lastBook.autor || 'Autor no registrado')}</div>
                            <div class="mt-2"><span class="badge bg-dark text-white">${escapeHtml(lastBook.adquisicion || 'S/N')}</span></div>
                        `;
                    }
                }
            } catch (error) {
                console.error(error);
            }
        })();

        void refreshGestionLibrosInventoryStatus();
    }


    function _cleanupBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
            backdrops.forEach(b => b.remove());
            document.body.classList.remove('modal-open');
        }
    }


    async function renderBookForm(bookToEdit = null) {
        // Validation: If adding new, fields empty. If editing, pre-fill.
        const isEdit = !!bookToEdit;
        const title = isEdit ? 'Modificar Libro' : 'Agregar Nuevo Libro';
        const btnText = isEdit ? 'Actualizar Libro' : 'Guardar Libro';
        const btnColor = isEdit ? 'btn-warning' : 'btn-success';

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 ${isEdit ? 'bg-warning' : 'bg-success'} text-white px-4 py-3">
                <div>
                    <h5 class="fw-bold mb-1"><i class="bi ${isEdit ? 'bi-pencil-square' : 'bi-plus-circle'} me-2"></i>${title}</h5>
                    <div class="small ${isEdit ? 'text-dark-emphasis' : 'text-white-50'}">${isEdit ? 'Ajusta el registro localizado antes de guardar.' : 'Captura los datos base para darlo de alta en el catalogo.'}</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="alert alert-light border rounded-4 shadow-sm mb-4">
                    <div class="small text-muted mb-0">${isEdit ? 'El numero de adquisicion permanece fijo para evitar cambiar la referencia del ejemplar.' : 'Si despues necesitas corregir datos, podras ubicarlo desde el panel lateral de actualizacion.'}</div>
                </div>
                <form id="book-form" onsubmit="event.preventDefault(); AdminBiblio.saveBook('${bookToEdit?.id || ''}')">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label small fw-bold text-muted">No. Adquisicion *</label>
                            <input type="text" class="form-control rounded-3" id="bf-adq" required placeholder="Ej. 000123" value="${escapeHtml(bookToEdit?.adquisicion || '')}" ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-8">
                            <label class="form-label small fw-bold text-muted">Titulo del Libro *</label>
                            <input type="text" class="form-control rounded-3" id="bf-titulo" required placeholder="Nombre del libro" value="${escapeHtml(bookToEdit?.titulo || '')}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Autor *</label>
                            <input type="text" class="form-control rounded-3" id="bf-autor" required placeholder="Autor principal" value="${escapeHtml(bookToEdit?.autor || '')}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Anio</label>
                            <input type="text" class="form-control rounded-3" id="bf-anio" placeholder="2024" value="${escapeHtml(bookToEdit?.anio ?? bookToEdit?.['año'] ?? '')}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small fw-bold text-muted">Copias Totales *</label>
                            <input type="number" class="form-control rounded-3" id="bf-copias" required min="1" value="${bookToEdit?.copiasTotales ?? bookToEdit?.copiasDisponibles ?? 1}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Categoria *</label>
                            <select class="form-select rounded-3" id="bf-cat" required>
                                <option value="">Selecciona...</option>
                                <option value="Administracion">Administracion</option>
                                <option value="Arquitectura">Arquitectura</option>
                                <option value="Ciencias Basicas">Ciencias Basicas</option>
                                <option value="Gastronomia">Gastronomia</option>
                                <option value="Literatura">Literatura</option>
                                <option value="General">General</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Clasificacion / Ubicacion</label>
                            <input type="text" class="form-control rounded-3" id="bf-clasif" placeholder="Ej: HM251 W46" value="${escapeHtml(bookToEdit?.clasificacion || '')}">
                        </div>
                    </div>
                    <div class="d-grid mt-4">
                        <button type="submit" class="btn ${btnColor} py-2 rounded-pill fw-bold shadow-sm">
                            <i class="bi bi-check-lg me-2"></i>${btnText}
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Retrieve and set category if editing
        if (bookToEdit?.categoria) {
            const sel = document.getElementById('bf-cat');
            if (sel) sel.value = bookToEdit.categoria;
        }
    }


    async function saveBook(editId) {
        const data = {
            adquisicion: document.getElementById('bf-adq').value.trim().toUpperCase(),
            titulo: document.getElementById('bf-titulo').value.trim(),
            autor: document.getElementById('bf-autor').value.trim(),
            anio: document.getElementById('bf-anio').value.trim(),
            copiasTotales: parseInt(document.getElementById('bf-copias').value, 10),
            categoria: document.getElementById('bf-cat').value,
            clasificacion: document.getElementById('bf-clasif').value.trim(),
            ubicacion: 'Estanteria' // Default
        };

        if (!data.adquisicion || !data.titulo || !data.autor || !data.categoria) {
            return showToast("Completa los campos obligatorios (*)", "warning");
        }

        try {
            if (editId) {
                await BiblioService.updateLibro(_ctx, editId, data);
                showToast("Libro actualizado correctamente", "success");
            } else {
                // Check dup adquisicion? usually service handles or just allow.
                await BiblioService.addLibro(_ctx, data);
                showToast("Libro registrado exitosamente", "success");
            }
            AdminBiblio.abrirModalGestionLibros(); // Go back
        } catch (e) {
            showToast("Error al guardar: " + e.message, "danger");
        }
    }


    async function renderBookEditSearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-warning text-dark px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-search me-2"></i>Buscar para Modificar</h5>
                <button class="btn-close" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="edit-search-input" placeholder="Ingresa No. Adquisicion (Ej: 00001)">
                    <button class="btn btn-warning px-4 fw-bold" onclick="AdminBiblio.handleEditSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                    <h6 class="fw-bold text-muted small mb-3 text-uppercase ls-1">Ultimo Agregado / Resultado</h6>
                <div id="edit-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Cargando ultimo registro...</div>
                </div>
            </div>
        `;

        // Load default (last added)
        try {
            const lastBook = await BiblioService.getLastAddedBook(_ctx);
            renderEditBookCard(lastBook);
        } catch (e) { console.error(e); }
    }


    async function handleEditSearch() {
        const q = document.getElementById('edit-search-input').value.trim();
        if (!q) return showToast("Ingresa un numero de adquisicion", "warning");

        const container = document.getElementById('edit-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const book = await BiblioService.getBookByAdquisicion(_ctx, q);
            renderEditBookCard(book, true);
        } catch (e) {
            container.innerHTML = `<div class="p-4 text-center text-danger">Error: ${e.message}</div>`;
        }
    }


    function renderEditBookCard(book, isSearch = false) {
        const container = document.getElementById('edit-search-result');
        if (!book) {
            container.innerHTML = `<div class="p-4 text-center text-muted opacity-75">${isSearch ? 'No se encontro el libro.' : 'No hay libros registrados manualmente aun.'}</div>`;
            return;
        }

        const bookPayload = encodeItemPayload(book);
        const adquisicion = escapeHtml(book.adquisicion || 'S/N');
            const titulo = escapeHtml(book.titulo || 'Sin titulo');
        const autor = escapeHtml(book.autor || 'Desconocido');

        container.innerHTML = `
            <div class="card-body d-flex align-items-center gap-3 p-3">
                <div class="bg-warning bg-opacity-10 p-3 rounded-3 text-warning">
                    <i class="bi bi-book fs-3"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="badge bg-dark text-white mb-1">${adquisicion}</div>
                    <h6 class="fw-bold mb-1 text-truncate">${titulo}</h6>
                    <small class="text-muted d-block text-truncate">${autor}</small>
                </div>
                <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('${bookPayload}'))">
                    Modificar <i class="bi bi-arrow-right ms-1"></i>
                </button>
            </div>
        `;
    }

    // --- 5. CONFIGURACION ---

    function abrirModalConfig() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-dark text-white p-4">
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-opacity-10 p-3 rounded-circle">
                         <i class="bi bi-gear-fill fs-3 text-white"></i>
                    </div>
                    <div>
                <h3 class="fw-bold mb-0">Configuracion de Espacios</h3>
                        <p class="small text-white-50 mb-0">Gestiona mesas y computadoras activas</p>
                    </div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0 ">
                 <div class="d-flex justify-content-between p-3 bg-white border-bottom">
                    <ul class="nav nav-pills gap-2" role="tablist">
                        <li class="nav-item"><button class="nav-link active rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-mesas">Mesas</button></li>
                        <li class="nav-item"><button class="nav-link rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-pcs">PCs</button></li>
                        <li class="nav-item"><button class="nav-link rounded-pill small fw-bold" data-bs-toggle="pill" data-bs-target="#tab-conf-salas">Sala</button></li>
                    </ul>
                    <button class="btn btn-warning btn-sm rounded-pill fw-bold shadow-sm" onclick="AdminBiblio.openAddAssetModal()">
                        <i class="bi bi-plus-lg me-1"></i>Agregar
                    </button>
                 </div>
                 
                 <div class="tab-content p-4">
                    <div class="tab-pane fade show active" id="tab-conf-mesas"><div id="list-mesas" class="row g-3"></div></div>
                    <div class="tab-pane fade" id="tab-conf-pcs"><div id="list-pcs" class="row g-3"></div></div>
                    <div class="tab-pane fade" id="tab-conf-salas"><div id="list-salas" class="row g-3"></div></div>
                 </div>
            </div>
         `;
        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();

        loadConfigAssets();
    }

    async function abrirModalDiasInhabiles() {
        clearLiveAssetStreams();
        _holidayCalendarCursor = startOfMonth(new Date());
        _holidaySelectedDates = [];
        _holidayBlockedDates = [];
        _holidaySelectionAnchor = null;
        _holidayCalendarMeta = null;

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-danger text-white p-4">
                <div>
                <h3 class="fw-bold mb-0"><i class="bi bi-calendar-x-fill me-2"></i>Dias inhabiles</h3>
                <p class="small text-white-50 mb-0">Los prestamos, renovaciones y retrasos ignoraran fines de semana y las fechas marcadas aqui.</p>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
                <div class="text-center py-5 text-muted">
                    <span class="spinner-border spinner-border-sm me-2"></span>Cargando calendario...
                </div>
            </div>
        `;

        new bootstrap.Modal(document.getElementById('modal-admin-action')).show();

        try {
            const config = await BiblioService.getHolidayCalendarConfig(_ctx, { force: true });
            _holidaySelectedDates = Array.isArray(config.holidayDates) ? config.holidayDates.slice() : [];
            _holidayBlockedDates = Array.isArray(config.blockedDates) ? config.blockedDates.slice() : [];
            normalizeHolidayBlockedDates();
            normalizeHolidaySelection();
            _holidayCalendarMeta = {
                updatedAt: config.updatedAt || null,
                updatedBy: config.updatedBy || ''
            };
            renderHolidayCalendarModal();
        } catch (error) {
            console.error('[BiblioAdmin] Error cargando dias inhabiles:', error);
            showToast(error.message || 'No se pudo cargar la configuracion de dias inhabiles.', 'danger');
        }
    }

    function renderHolidayCalendarModal() {
        const body = document.getElementById('modal-admin-body');
        if (!body) return;

        normalizeHolidayBlockedDates();
        normalizeHolidaySelection();
        const cursor = _holidayCalendarCursor || startOfMonth(new Date());
        const nextMonth = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12, 0, 0, 0));

        body.innerHTML = `
            <div class="modal-header border-0 bg-danger text-white p-4">
                <div>
                    <h3 class="fw-bold mb-0"><i class="bi bi-calendar-x-fill me-2"></i>Días inhábiles</h3>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4" onmouseup="AdminBiblio.finalizarArrastreDiasInhabiles()" onmouseleave="AdminBiblio.finalizarArrastreDiasInhabiles()" style="user-select:none;">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-secondary rounded-pill" onclick="AdminBiblio.cambiarMesDiasInhabiles(-1)">
                                <i class="bi bi-chevron-left"></i>
                            </button>
                            <button class="btn btn-outline-secondary rounded-pill" onclick="AdminBiblio.irMesActualDiasInhabiles()">
                                Hoy
                            </button>
                            <button class="btn btn-outline-secondary rounded-pill" onclick="AdminBiblio.cambiarMesDiasInhabiles(1)">
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>
                        <div class="small text-muted fw-semibold">${escapeHtml(cursor.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))} / ${escapeHtml(nextMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))}</div>
                    </div>
                </div>

                <div id="holiday-calendar-grid" class="row g-3 mb-4">
                    ${renderHolidayMonth(cursor)}
                    ${renderHolidayMonth(nextMonth)}
                </div>

                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-3">
                        <div class="row g-3 align-items-end">
                            <div class="col-md-5">
                                <label class="form-label small fw-bold text-muted">Desde</label>
                                <input type="date" id="holiday-range-start" class="form-control rounded-3 shadow-sm" onchange="AdminBiblio.handleHolidayRangeInput()">
                            </div>
                            <div class="col-md-5">
                                <label class="form-label small fw-bold text-muted">Hasta</label>
                                <input type="date" id="holiday-range-end" class="form-control rounded-3 shadow-sm" onchange="AdminBiblio.handleHolidayRangeInput()">
                            </div>
                            <div class="col-md-2 d-grid">
                                <button class="btn btn-light border rounded-pill fw-bold" onclick="AdminBiblio.limpiarDiasInhabiles()">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-0 px-4 pb-4 pt-0 d-flex justify-content-between gap-2">
                <button class="btn btn-light rounded-pill px-4 fw-bold" data-bs-dismiss="modal">Cerrar</button>
                <button class="btn btn-danger rounded-pill px-4 fw-bold" id="btn-save-holidays" onclick="AdminBiblio.guardarDiasInhabiles()">
                    Guardar días inhábiles
                </button>
            </div>
        `;
    }

    function renderHolidayMonth(monthDate) {
        const firstDay = startOfMonth(monthDate);
        const firstWeekday = (firstDay.getDay() + 6) % 7;
        const totalDays = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
        const selected = getHolidaySelectedSet();
        const blocked = getHolidayBlockedSet();
        const todayKey = formatDateKeyLocal(new Date());
        const weekHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
        const cells = [];

        for (let blank = 0; blank < firstWeekday; blank += 1) {
            cells.push('<div></div>');
        }

        for (let day = 1; day <= totalDays; day += 1) {
            const currentDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), day, 12, 0, 0, 0);
            const dateKey = formatDateKeyLocal(currentDate);
            const isSelected = selected.has(dateKey);
            const isBlocked = blocked.has(dateKey);
            const isToday = dateKey === todayKey;
            const isWeekend = isWeekendDateKey(dateKey);
            const isDisabled = isWeekend || isBlocked;
            const buttonClass = isDisabled
                ? 'btn-light border text-muted opacity-50'
                : (isSelected
                    ? 'btn-danger text-white border-danger'
                    : (isToday ? 'btn-outline-primary border-primary text-primary' : 'btn-light border'));
            const pointerAttrs = isDisabled
                ? 'disabled'
                : `onmousedown="AdminBiblio.iniciarArrastreDiasInhabiles('${dateKey}')" onmouseenter="AdminBiblio.arrastrarDiaInhabil('${dateKey}')"`;
            const title = isWeekend
                ? `${formatHolidayDateLabel(dateKey, true)} · Fin de semana`
                : (isBlocked
                    ? `${formatHolidayDateLabel(dateKey, true)} · Periodo largo`
                    : formatHolidayDateLabel(dateKey, true));

            cells.push(`
                <button class="btn ${buttonClass} rounded-3 d-flex align-items-center justify-content-center fw-semibold"
                        style="height:42px;"
                        ${pointerAttrs}
                        onclick="return false"
                        title="${escapeHtml(title)}">
                    ${day}
                </button>
            `);
        }

        return `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm rounded-4 h-100">
                    <div class="card-body p-3">
                        <div class="fw-bold text-capitalize mb-3">${escapeHtml(firstDay.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))}</div>
                        <div class="d-grid gap-2" style="grid-template-columns: repeat(7, minmax(0, 1fr));">
                            ${weekHeaders.map((label) => `<div class="small text-muted text-center fw-bold">${label}</div>`).join('')}
                            ${cells.join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function cambiarMesDiasInhabiles(offset) {
        const cursor = _holidayCalendarCursor || startOfMonth(new Date());
        _holidayCalendarCursor = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + Number(offset || 0), 1, 12, 0, 0, 0));
        finalizarArrastreDiasInhabiles();
        renderHolidayCalendarModal();
    }

    function irMesActualDiasInhabiles() {
        _holidayCalendarCursor = startOfMonth(new Date());
        finalizarArrastreDiasInhabiles();
        renderHolidayCalendarModal();
    }

    function iniciarArrastreDiasInhabiles(dateKey) {
        if (!dateKey || isWeekendDateKey(dateKey) || getHolidayBlockedSet().has(dateKey)) return false;
        const selected = getHolidaySelectedSet();
        _holidayPointerActive = true;
        _holidayPointerMode = selected.has(dateKey) ? 'remove' : 'add';
        _holidayLastPointerDate = '';
        window.addEventListener('mouseup', window.AdminBiblio.finalizarArrastreDiasInhabiles, { once: true });
        toggleDiaInhabil(dateKey, _holidayPointerMode);
        return false;
    }

    function arrastrarDiaInhabil(dateKey) {
        if (!_holidayPointerActive || !dateKey || isWeekendDateKey(dateKey) || getHolidayBlockedSet().has(dateKey) || _holidayLastPointerDate === dateKey) return false;
        toggleDiaInhabil(dateKey, _holidayPointerMode);
        return false;
    }

    function finalizarArrastreDiasInhabiles() {
        _holidayPointerActive = false;
        _holidayPointerMode = 'add';
        _holidayLastPointerDate = '';
    }

    function toggleDiaInhabil(dateKey, mode = null) {
        if (!dateKey || isWeekendDateKey(dateKey) || getHolidayBlockedSet().has(dateKey)) return;
        const nextSelection = getHolidaySelectedSet();
        const nextMode = mode || (nextSelection.has(dateKey) ? 'remove' : 'add');

        if (nextMode === 'remove') nextSelection.delete(dateKey);
        else nextSelection.add(dateKey);

        _holidaySelectionAnchor = dateKey;
        _holidayLastPointerDate = dateKey;
        _holidaySelectedDates = [...nextSelection].sort();
        renderHolidayCalendarModal();
    }

    function handleHolidayRangeInput() {
        const start = document.getElementById('holiday-range-start')?.value;
        const end = document.getElementById('holiday-range-end')?.value;
        if (!start || !end) return;

        const rangeKeys = getDateRangeKeys(start, end).filter((dateKey) => !isWeekendDateKey(dateKey));
        if (!rangeKeys.length) {
            showToast('Ese periodo solo contiene fines de semana.', 'warning');
            return;
        }

        const selected = getHolidaySelectedSet();
        const blocked = getHolidayBlockedSet();
        const shouldRemove = rangeKeys.every((key) => blocked.has(key));
        rangeKeys.forEach((key) => {
            if (shouldRemove) blocked.delete(key);
            else blocked.add(key);
            selected.delete(key);
        });
        _holidayBlockedDates = [...blocked].sort();
        _holidaySelectedDates = [...selected].sort();
        _holidaySelectionAnchor = end;
        renderHolidayCalendarModal();

        const startInput = document.getElementById('holiday-range-start');
        const endInput = document.getElementById('holiday-range-end');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
    }

    function limpiarDiasInhabiles() {
        _holidaySelectedDates = [];
        _holidayBlockedDates = [];
        _holidaySelectionAnchor = null;
        finalizarArrastreDiasInhabiles();
        renderHolidayCalendarModal();
    }

    function cerrarModalesAdminBiblioteca() {
        document.querySelectorAll('.modal.show').forEach((modalEl) => {
            if (!modalEl || modalEl.id === 'mini-confirm-modal') return;
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        });
    }

    async function guardarDiasInhabiles() {
        const saveBtn = document.getElementById('btn-save-holidays');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        }

        try {
            const result = await BiblioService.saveHolidayCalendarConfig(_ctx, {
                holidayDates: _holidaySelectedDates,
                blockedDates: _holidayBlockedDates
            });
            _holidayCalendarMeta = {
                updatedAt: new Date(),
                updatedBy: _ctx?.auth?.currentUser?.uid || ''
            };
            await loadAdminStats();
            showConfirmModal({
                icon: 'check-circle-fill',
                iconColor: '#dc3545',
                title: 'Dias inhabiles guardados',
                message: `Se guardo el calendario y se recalcularon ${result.adjustedLoans || 0} prestamo(s) activo(s).`,
                confirmText: 'Aceptar',
                confirmClass: 'btn-danger',
                sizeClass: 'modal-sm',
                onConfirm: async () => {
                    cerrarModalesAdminBiblioteca();
                }
            });
        } catch (error) {
            console.error('[BiblioAdmin] Error guardando dias inhabiles:', error);
            showToast(error.message || 'No se pudo guardar la configuracion.', 'danger');
        } finally {
            const refreshedSaveBtn = document.getElementById('btn-save-holidays');
            if (refreshedSaveBtn) {
                refreshedSaveBtn.disabled = false;
            refreshedSaveBtn.innerHTML = 'Guardar dias inhabiles';
            }
        }
    }


    function loadConfigAssets() {
        if (_configAssetsUnsub) {
            _configAssetsUnsub();
            _configAssetsUnsub = null;
        }

        _configAssetsUnsub = BiblioAssetsService.streamAssetsAdmin(_ctx, (assets) => {
            const renderCard = (a) => `
                <div class="col-md-6 col-lg-6">
                    <div class="card h-100 shadow-sm border-0">
                        <div class="card-body d-flex align-items-center justify-content-between p-3">
                            <div class="d-flex align-items-center gap-3">
                                 <div class=" rounded-circle p-2 text-muted">
                                    <i class="bi bi-${a.tipo === 'pc' ? 'pc-display' : (a.tipo === 'mesa' ? 'table' : 'people')} fs-5"></i>
                                 </div>
                                 <div class="lh-sm">
                                     <div class="fw-bold text-dark">${escapeHtml(a.nombre || 'Activo')}</div>
                                     <small class="text-muted text-uppercase" style="font-size:0.65rem;">${escapeHtml(a.status || 'disponible')}</small>
                                 </div>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" title="Habilitar/Deshabilitar" 
                                           ${a.status !== 'mantenimiento' ? 'checked' : ''} 
                                           onchange="AdminBiblio.toggleAssetStatus('${a.id}', this.checked)">
                                </div>
                                <button class="btn btn-sm text-danger opacity-50 hover-opacity-100" title="Eliminar definitivamente"
                                        onclick="AdminBiblio.confirmDeleteAsset('${escapeJsString(a.id)}', '${escapeJsString(a.nombre)}')">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Separate lists
            const mesas = assets.filter(a => a.tipo === 'mesa').sort((a, b) => a.nombre.localeCompare(b.nombre));
            const pcs = assets.filter(a => a.tipo === 'pc').sort((a, b) => a.nombre.localeCompare(b.nombre));
            const salas = assets.filter(a => a.tipo === 'sala').sort((a, b) => a.nombre.localeCompare(b.nombre));

            const elM = document.getElementById('list-mesas');
            const elP = document.getElementById('list-pcs');
            const elS = document.getElementById('list-salas');

            if (elM) elM.innerHTML = mesas.length ? mesas.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin mesas registradas</div>';
            if (elP) elP.innerHTML = pcs.length ? pcs.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin PCs registradas</div>';
            if (elS) elS.innerHTML = salas.length ? salas.map(renderCard).join('') : '<div class="text-muted small text-center w-100">Sin salas registradas</div>';
        });
    }


    async function openAddAssetModal() {
        // Modal para seleccionar tipo
        const body = document.getElementById('modal-admin-body');
        // Save previous content to restore later? No, usually config is main. 
        // We can just re-render config on close or just show a modal on top.
        // Let's use the valid approach: A new modal on top or replace content temporarily.
        // Better: Use a small SweetAlert-style custom modal overlay like showConfirmModal

        const modalHtml = `
            <div class="modal fade" id="modal-add-asset" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="fw-bold">Agregar Nuevo Espacio</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4 text-center">
                <p class="text-muted small mb-4">Selecciona el tipo de espacio a crear. El sistema asignara un nombre automaticamente (ej. MESA-09).</p>
                            <div class="row g-3 justify-content-center">
                                <div class="col-4">
                                    <button class="btn btn-outline-primary w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('mesa')">
                                        <i class="bi bi-table fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">Mesa</span>
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-info w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('pc')">
                                        <i class="bi bi-pc-display fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">PC</span>
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-success w-100 py-3 rounded-4 hover-scale" onclick="AdminBiblio.createAsset('sala')">
                                        <i class="bi bi-people fs-1 d-block mb-2"></i>
                                        <span class="fw-bold small">Sala</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove prev if exists
        document.getElementById('modal-add-asset')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('modal-add-asset');
        const modal = new bootstrap.Modal(modalEl);

        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
            if (document.querySelector('.modal.show')) document.body.classList.add('modal-open');
        });

        modal.show();
    }


    async function createAsset(type) {
        // 1. Get current assets to calculate name
        // Close modal first to avoid double interaction or keep it? Close it.
        const modalEl = document.getElementById('modal-add-asset');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        try {
            const assets = await BiblioAssetsService.getAssetsOnce(_ctx);
            // Filter by type
            const sameType = assets.filter(a => a.tipo === type);

            // Generate Name: "MESA-01" -> extract number
            // Regex to find max number
            let maxNum = 0;
            const prefix = type === 'pc' ? 'PC' : (type === 'mesa' ? 'MESA' : 'SALA');

            sameType.forEach(a => {
                const parts = a.nombre.match(/(\d+)$/);
                if (parts) {
                    const num = parseInt(parts[0], 10);
                    if (num > maxNum) maxNum = num;
                }
            });

            const nextNum = maxNum + 1;
            const newName = `${type === 'mesa' ? 'Mesa' : (type === 'pc' ? 'PC' : 'Sala')} ${nextNum}`; // Display Name "Mesa 9"

            // Confirm creation? User said "Solo que confirme que se agregara".
            // Let's just do it and show toast, or standard confirm? 
            // "Show a mini modal asking type... Just allow... confirm that it will be added"

            showConfirmModal({
                icon: type === 'pc' ? 'pc-display' : (type === 'mesa' ? 'table' : 'people'),
                iconColor: '#0dcaf0',
                title: 'Crear Espacio',
                message: `¿Crear <strong>${newName}</strong>?`,
                confirmText: 'Si, Crear',
                confirmClass: 'btn-success',
                onConfirm: async () => {
                    await BiblioAssetsService.saveAsset(_ctx, null, { nombre: newName, tipo: type });
                    showToast("Espacio creado: " + newName, "success");
                }
            });

        } catch (e) {
            showToast("Error: " + e.message, "danger");
        }
    }


    async function confirmDeleteAsset(id, nombre) {
        showConfirmModal({
            icon: 'trash-fill',
            iconColor: '#dc3545',
            title: 'Eliminar Espacio',
                message: `¿Estas seguro de eliminar <strong>${escapeHtml(nombre)}</strong>?<br>Esta accion es irreversible.`,
            confirmText: 'Eliminar',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                try {
                    await BiblioAssetsService.deleteAsset(_ctx, id);
                    showToast("Espacio eliminado", "info");
                } catch (e) {
                    showToast(e.message, "danger");
                }
            }
        });
    }


    async function toggleAssetStatus(id, active) {
        try {
            await BiblioAssetsService.saveAsset(_ctx, id, { status: active ? 'disponible' : 'mantenimiento' });
            // showToast("Estado actualizado", "success"); // Too noisy
        } catch (e) { showToast(e.message || "Error al actualizar", "danger"); }
    }

    // --- SERVICIOS DIGITALES (PC / SALAS) ---



    return {
        abrirModalGestionLibros: withState(abrirModalGestionLibros),
        refreshGestionLibrosInventoryStatus: withState(refreshGestionLibrosInventoryStatus),
        confirmFinalizeInventoryFromGestion: withState(confirmFinalizeInventoryFromGestion),
        confirmAdjustFinishedInventoryFromGestion: withState(confirmAdjustFinishedInventoryFromGestion),
        _cleanupBackdrop: withState(_cleanupBackdrop),
        renderBookForm: withState(renderBookForm),
        saveBook: withState(saveBook),
        renderBookEditSearch: withState(renderBookEditSearch),
        handleEditSearch: withState(handleEditSearch),
        renderEditBookCard: withState(renderEditBookCard),
        abrirModalConfig: withState(abrirModalConfig),
        abrirModalDiasInhabiles: withState(abrirModalDiasInhabiles),
        cambiarMesDiasInhabiles: withState(cambiarMesDiasInhabiles),
        irMesActualDiasInhabiles: withState(irMesActualDiasInhabiles),
        iniciarArrastreDiasInhabiles: withState(iniciarArrastreDiasInhabiles),
        arrastrarDiaInhabil: withState(arrastrarDiaInhabil),
        finalizarArrastreDiasInhabiles: withState(finalizarArrastreDiasInhabiles),
        toggleDiaInhabil: withState(toggleDiaInhabil),
        handleHolidayRangeInput: withState(handleHolidayRangeInput),
        limpiarDiasInhabiles: withState(limpiarDiasInhabiles),
        guardarDiasInhabiles: withState(guardarDiasInhabiles),
        loadConfigAssets: withState(loadConfigAssets),
        openAddAssetModal: withState(openAddAssetModal),
        createAsset: withState(createAsset),
        confirmDeleteAsset: withState(confirmDeleteAsset),
        toggleAssetStatus: withState(toggleAssetStatus)
    };
})();

