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
    let _labelsPrintQueue = [];
    let _statusSearchResults = [];
    let _statusSearchCurrentPage = 1;
    const STATUS_RESULTS_PER_PAGE = 5;

    function syncFromState() {
        _ctx = state.ctx;
        _configAssetsUnsub = state.configAssetsUnsub;
        _holidayCalendarCursor = state.holidayCalendarCursor;
        _holidaySelectedDates = Array.isArray(state.holidaySelectedDates) ? state.holidaySelectedDates.slice() : [];
        _holidayBlockedDates = Array.isArray(state.holidayBlockedDates) ? state.holidayBlockedDates.slice() : [];
        _holidaySelectionAnchor = state.holidaySelectionAnchor;
        _holidayCalendarMeta = state.holidayCalendarMeta;
        _labelsPrintQueue = Array.isArray(state.labelsPrintQueue) ? state.labelsPrintQueue.slice() : [];
    }

    function syncToState() {
        state.ctx = _ctx;
        state.configAssetsUnsub = _configAssetsUnsub;
        state.holidayCalendarCursor = _holidayCalendarCursor;
        state.holidaySelectedDates = Array.isArray(_holidaySelectedDates) ? _holidaySelectedDates.slice() : [];
        state.holidayBlockedDates = Array.isArray(_holidayBlockedDates) ? _holidayBlockedDates.slice() : [];
        state.holidaySelectionAnchor = _holidaySelectionAnchor;
        state.holidayCalendarMeta = _holidayCalendarMeta;
        state.labelsPrintQueue = Array.isArray(_labelsPrintQueue) ? _labelsPrintQueue.slice() : [];
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
        const registeredCatalog = Number(summary.registeredCatalog) || 0;
        const outsideCatalog = Number(summary.outsideCatalog) || 0;
        const extraMaterials = Number(summary.extraMaterials) || 0;
        const totalCaptured = registeredCatalog + outsideCatalog + extraMaterials || Number(summary.totalCaptured) || 0;

        return `
            <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="badge text-bg-light border">${totalCaptured} observados</span>
                <span class="badge text-bg-light border">${registeredCatalog} en catalogo</span>
                ${outsideCatalog > 0 ? `<span class="badge text-bg-warning border">${outsideCatalog} fuera de sistema</span>` : ''}
                ${extraMaterials > 0 ? `<span class="badge text-bg-info text-white border">${extraMaterials} otros materiales</span>` : ''}
            </div>
        `;
    }

    function sumInventoryStatusObserved(entries = []) {
        return (entries || []).reduce((total, entry) => total + (Number(entry?.totalObserved || entry?.cantidad || entry?.lastQuantity || 0) || 0), 0);
    }

    function buildInventoryBackupFilename(session = {}) {
        const rawName = String(session?.name || session?.id || 'inventario')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'inventario';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `respaldo-biblio-${rawName}-${stamp}.json`;
    }

    function downloadJsonBackup(payload, filename) {
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
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
            registeredCatalog: sumInventoryStatusObserved((latestFinished?.foundEntries || []).filter(e => e.type !== 'material')),
            outsideCatalog: sumInventoryStatusObserved((latestFinished?.missingEntries || []).filter(e => e.type !== 'material')),
            extraMaterials: sumInventoryStatusObserved([...(latestFinished?.foundEntries || []), ...(latestFinished?.missingEntries || [])].filter(e => e.type === 'material'))
        } : null);
        if (finishedSession && summary) {
            return `
                <div class="fw-semibold text-dark">Ultimo inventario cerrado</div>
                <div class="small text-muted mb-2">${escapeHtml(finishedSession.name || 'Resumen final listo')}</div>
                ${formatInventoryStatusSummary(summary)}
                <div class="d-grid gap-2">
                    <button class="btn btn-dark rounded-pill fw-bold" type="button" onclick="AdminBiblio.openInventoryPdfOptionsModal('${escapeJsString(finishedSession.id || '')}')">
                        <i class="bi bi-file-earmark-pdf me-2"></i>Exportar PDF
                    </button>
                    <button class="btn btn-outline-dark rounded-pill fw-bold" type="button" onclick="AdminBiblio.downloadInventoryAdjustmentBackupFromGestion('${escapeJsString(finishedSession.id || '')}')">
                        <i class="bi bi-download me-2"></i>Descargar respaldo
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
            const [currentState, catalogSummary, latestFinishedBase] = await Promise.all([
                BiblioService.getCurrentInventorySession(_ctx),
                BiblioService.getInventoryCatalogSummary(_ctx),
                BiblioService.getLatestFinishedInventorySession(_ctx)
            ]);
            const latestFinished = latestFinishedBase?.session && !latestFinishedBase.session.summary
                ? await BiblioService.getInventorySessionDetails(_ctx, latestFinishedBase.session.id, { includeLists: true })
                : latestFinishedBase;

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
            let details = sessionId
                ? await BiblioService.getInventorySessionDetails(_ctx, sessionId)
                : await BiblioService.getLatestFinishedInventorySession(_ctx);
            const session = details?.session || null;
            if (!session?.id) {
                showToast('No hay un inventario cerrado para ajustar.', 'warning');
                return;
            }

            if (!session.summary) {
                details = await BiblioService.getInventorySessionDetails(_ctx, session.id, { includeLists: true });
            }

            const summary = details?.session?.summary || {
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
                        <div class="small text-muted mb-2">Se activaran solo los ejemplares inventariados; el excedente quedara fuera del catalogo activo, sin borrarse.</div>
                        <div class="small text-muted mb-2">Los libros y copias capturados durante el inventario se agregaran al catalogo en este ajuste.</div>
                        <div class="small text-muted">Si hay ejemplares con prestamos activos, se conservaran temporalmente para no romper el stock.</div>
                        ${Number(summary.outsideCatalog) > 0 ? `<div class="small text-warning mt-2">Hay ${Number(summary.outsideCatalog) || 0} captura(s) fuera de sistema. Solo se ajustaran automaticamente los libros catalogados o ya asociados.</div>` : ''}
                    </div>
                `,
                confirmText: 'Confirmar ajuste',
                confirmClass: 'btn-warning',
                onConfirm: async () => {
                    showToast('Generando respaldo antes del ajuste...', 'info');
                    const backup = await BiblioService.createInventoryAdjustmentBackup(_ctx, session.id);
                    downloadJsonBackup(backup, buildInventoryBackupFilename(session));
                    await BiblioService.applyFinishedInventoryToCatalog(_ctx, session.id);
                    state.inventoryCatalogSummary = null;
                    await refreshGestionLibrosInventoryStatus();
                    showToast('Respaldo descargado y catalogo ajustado al inventario real.', 'success');
                }
            });
        } catch (error) {
            showToast(error.message || 'No se pudo ajustar el catalogo.', 'danger');
        }
    }

    async function downloadInventoryAdjustmentBackupFromGestion(sessionId = '') {
        if (!_ctx) return;

        try {
            const details = sessionId
                ? await BiblioService.getInventorySessionDetails(_ctx, sessionId)
                : await BiblioService.getLatestFinishedInventorySession(_ctx);
            const session = details?.session || null;
            if (!session?.id) {
                showToast('No hay un inventario cerrado para respaldar.', 'warning');
                return;
            }

            showToast('Generando respaldo de catalogo e inventario...', 'info');
            const backup = await BiblioService.createInventoryAdjustmentBackup(_ctx, session.id);
            downloadJsonBackup(backup, buildInventoryBackupFilename(session));
            showToast('Respaldo descargado.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo generar el respaldo.', 'danger');
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
            <div class="modal-body p-3 p-md-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                
                <div class="row g-4">
                    <div class="col-12 col-md-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalGestionarLibros()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-journals fs-3 text-success"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Gestionar libros</h5>
                                <p class="small text-muted mb-0">Agregar, editar o dar de baja ejemplares en el catalogo.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-md-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalEtiquetas()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-tags fs-3 text-primary"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Generar etiquetas</h5>
                                <p class="small text-muted mb-0">Impresion de codigos de barras y lomos.</p>
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
    }

    function abrirSubmodalEtiquetas() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-tags me-3"></i>Generar Etiquetas</h3>
                    <div class="small text-white-50">Busca libros y genera etiquetas de códigos de barras.</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="label-search-input" placeholder="Ingresa No. Adquisicion (Ej: 00001)" onkeydown="if(event.key === 'Enter') AdminBiblio.handleLabelSearch()">
                    <button class="btn btn-primary px-4 fw-bold" onclick="AdminBiblio.handleLabelSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                <div id="label-search-result" class="mb-4"></div>

                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="fw-bold text-muted text-uppercase small">Lista de Impresión</div>
                    <button class="btn btn-sm btn-outline-danger" onclick="AdminBiblio.clearLabelsQueue()">Limpiar Lista</button>
                </div>
                
                <div id="labels-queue-container" class="list-group shadow-sm mb-4">
                    <!-- Lista de etiquetas a imprimir -->
                </div>
                
                <div class="d-grid">
                    <button class="btn btn-dark rounded-pill fw-bold p-3" id="btn-export-labels" onclick="AdminBiblio.exportLabelsPdf()" disabled>
                        <i class="bi bi-file-earmark-pdf me-2"></i>Exportar Etiquetas a PDF (Hoja Carta)
                    </button>
                </div>
            </div>
        `;
        renderLabelsQueue();
    }

    async function handleLabelSearch() {
        const q = document.getElementById('label-search-input').value.trim();
        if (!q) return showToast("Ingresa un número de adquisición", "warning");

        const container = document.getElementById('label-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando ejemplares...</div>';

        try {
            const searchedBook = await BiblioService.getBookByAdquisicion(_ctx, q.toUpperCase());
            if (!searchedBook) {
                container.innerHTML = '<div class="alert alert-warning border-0 shadow-sm"><i class="bi bi-exclamation-triangle me-2"></i>No se encontró el libro.</div>';
                return;
            }

            let copies = [];
            if (window.BiblioService && window.BiblioService.getCopiesByTitleAndAuthorAdmin) {
                copies = await window.BiblioService.getCopiesByTitleAndAuthorAdmin(_ctx, searchedBook.titulo, searchedBook.autor);
            } else {
                const copiesSnap = await _ctx.db.collection('biblio-catalogo')
                    .where('titulo', '==', searchedBook.titulo)
                    .get();

                copiesSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.autor === searchedBook.autor) {
                        copies.push({ id: doc.id, ...data });
                    }
                });
            }

            copies.sort((a, b) => a.adquisicion.localeCompare(b.adquisicion));

            copies = copies.map((c, index) => {
                c.copyTag = `ITES Ej. ${index + 1}`;
                return c;
            });

            let html = `
                <div class="card border-0 shadow-sm rounded-4 mb-3">
                    <div class="card-body">
                        <h6 class="fw-bold mb-1">${escapeHtml(searchedBook.titulo)}</h6>
                        <div class="small text-muted mb-3">${escapeHtml(searchedBook.autor)} | ${copies.length} ejemplar(es) encontrado(s)</div>
                        <ul class="list-group list-group-flush mb-3">
            `;

            copies.forEach(c => {
                const isSearched = c.adquisicion === searchedBook.adquisicion;
                const inQueue = _labelsPrintQueue.some(item => item.adquisicion === c.adquisicion);
                const badgeClass = isSearched ? 'bg-primary' : 'bg-secondary';
                html += `
                    <li class="list-group-item d-flex flex-column gap-2 px-0 py-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-semibold">${c.adquisicion} <span class="badge ${badgeClass} ms-1">${c.copyTag}</span></div>
                                <div class="small text-muted">Clasificación: ${escapeHtml(c.clasificacion || 'N/A')}</div>
                            </div>
                            <button class="btn btn-sm ${inQueue ? 'btn-success disabled' : 'btn-outline-primary'}" 
                                onclick="AdminBiblio.addLabelToQueue('${escapeJsString(c.adquisicion)}', '${escapeJsString(c.clasificacion || '')}', '${escapeJsString(c.copyTag)}')">
                                ${inQueue ? '<i class="bi bi-check-circle me-1"></i>Añadido' : '<i class="bi bi-plus-lg me-1"></i>Añadir'}
                            </button>
                        </div>
                    </li>
                `;
            });

            html += `
                        </ul>
                        <div class="d-grid">
                            <button class="btn btn-outline-dark btn-sm rounded-pill fw-bold" onclick="AdminBiblio.addAllLabelsToQueue('${escapeJsString(encodeURIComponent(JSON.stringify(copies)))}')">
                                Añadir todos a la lista
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger border-0 shadow-sm"><i class="bi bi-x-circle me-2"></i>Error al buscar ejemplares.</div>';
        }
    }

    function addLabelToQueue(adquisicion, clasificacion, copyTag) {
        if (!_labelsPrintQueue.some(i => i.adquisicion === adquisicion)) {
            _labelsPrintQueue.push({ adquisicion, clasificacion, copyTag });
            showToast(`Añadido ${adquisicion}`, 'success');
            renderLabelsQueue();
            const q = document.getElementById('label-search-input')?.value;
            if (q) handleLabelSearch();
        }
    }

    function addAllLabelsToQueue(encodedCopies) {
        try {
            const copies = JSON.parse(decodeURIComponent(encodedCopies));
            let addedCount = 0;
            copies.forEach(c => {
                if (!_labelsPrintQueue.some(i => i.adquisicion === c.adquisicion)) {
                    _labelsPrintQueue.push({ 
                        adquisicion: c.adquisicion, 
                        clasificacion: c.clasificacion || '', 
                        copyTag: c.copyTag 
                    });
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                showToast(`Se añadieron ${addedCount} etiquetas a la lista`, 'success');
                renderLabelsQueue();
                handleLabelSearch();
            } else {
                showToast(`Las etiquetas ya estaban en la lista`, 'info');
            }
        } catch(e) {
            console.error(e);
        }
    }

    function removeLabelFromQueue(index) {
        _labelsPrintQueue.splice(index, 1);
        renderLabelsQueue();
        const q = document.getElementById('label-search-input')?.value;
        if (q) handleLabelSearch();
    }

    function clearLabelsQueue() {
        if (_labelsPrintQueue.length === 0) return;
        showConfirmModal({
            icon: 'trash-fill',
            iconColor: '#dc3545',
            title: 'Limpiar Lista',
            message: '¿Estás seguro de que deseas vaciar la lista de impresión?',
            confirmText: 'Limpiar',
            confirmClass: 'btn-danger',
            onConfirm: () => {
                _labelsPrintQueue = [];
                renderLabelsQueue();
                const q = document.getElementById('label-search-input')?.value;
                if (q) handleLabelSearch();
            }
        });
    }

    function renderLabelsQueue() {
        const container = document.getElementById('labels-queue-container');
        const btnExport = document.getElementById('btn-export-labels');
        if (!container) return;

        if (_labelsPrintQueue.length === 0) {
            container.innerHTML = '<div class="list-group-item text-center py-4 text-muted border-0 bg-transparent">La lista de impresión está vacía.</div>';
            if (btnExport) btnExport.disabled = true;
            return;
        }

        let html = '';
        _labelsPrintQueue.forEach((item, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                            <i class="bi bi-upc-scan"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${item.adquisicion}</div>
                            <div class="small text-muted">${item.clasificacion} &bull; ${item.copyTag}</div>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="AdminBiblio.removeLabelFromQueue(${index})">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
        if (btnExport) btnExport.disabled = false;
    }

    function exportLabelsPdf() {
        if (_labelsPrintQueue.length === 0) return showToast('No hay etiquetas para imprimir', 'warning');
        
        const btn = document.getElementById('btn-export-labels');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando PDF...';
        }

        try {
            PDFGenerator.generateLabelsReport(_labelsPrintQueue);
            showToast('PDF generado correctamente.', 'success');
        } catch(e) {
            console.error(e);
            showToast('Error al generar PDF de etiquetas.', 'danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Exportar Etiquetas a PDF (Hoja Carta)';
            }
        }
    }

    function abrirModalMenuInventario() {
        clearLiveAssetStreams();
        const body = document.getElementById('modal-admin-body');
        const modalEl = document.getElementById('modal-admin-action');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

        body.innerHTML = `
            <div class="modal-header border-0 bg-danger text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-clipboard2-data me-3"></i>Inventario</h3>
                    <div class="small text-white-50">Elige el tipo de inventario a realizar.</div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-3 p-md-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                
                <div class="row g-4">
                    <div class="col-12 col-md-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalInventario()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-clipboard2-data fs-3 text-danger"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Inventario Semestral</h5>
                                <p class="small text-muted mb-0">Auditoria del catalogo de la biblioteca.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 col-md-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100" style="cursor: pointer;" onclick="AdminBiblio.abrirSubmodalInventarioFisico()">
                            <div class="card-body p-4 text-center">
                                <div class="bg-info bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="bi bi-box-seam fs-3 text-info"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-2">Inventario Físico</h5>
                                <p class="small text-muted mb-0">Sillas, mesas, anaqueles, equipos, etc.</p>
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
    }

    function abrirSubmodalInventario() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-danger text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-clipboard2-data me-3"></i>Inventario Semestral</h3>
                    <div class="small text-white-50">Auditoria del catalogo de la biblioteca.</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalMenuInventario()"></button>
            </div>
            <div class="modal-body p-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="card border-0 shadow-sm rounded-4 bg-danger-subtle mb-4">
                    <div class="card-body p-4 text-center">
                        <h5 class="fw-bold text-dark mb-3">Iniciar Sesion de Inventario</h5>
                        <p class="small text-muted mb-4">Abre el escaner y comienza a contar libros o ajusta el inventario pendiente.</p>
                        <button class="btn btn-danger rounded-pill fw-bold w-100 px-4" type="button" onclick="AdminBiblio.abrirModalInventario()">
                            <i class="bi bi-play-circle me-2"></i>Abrir inventario
                        </button>
                    </div>
                </div>
                
                <div class="small fw-bold text-muted text-uppercase mb-2 text-start">Estado de Sesion actual</div>
                <div id="gestion-libros-inventory-status" class="rounded-4 border bg-white shadow-sm p-4 text-muted small text-start">
                    <span class="spinner-border spinner-border-sm me-2"></span>Revisando estado...
                </div>
            </div>
        `;
        void refreshGestionLibrosInventoryStatus();
    }

    function abrirSubmodalGestionarLibros() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-success text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-journals me-3"></i>Gestionar libros</h3>
                    <div class="small text-white-50">Administra el catalogo de ejemplares.</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirModalGestionLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5 bg-light" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="d-flex flex-column gap-3 mb-4">
                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookForm()">
                        <div class="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-plus-lg text-success"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Agregar nuevo libro</div>
                            <div class="small text-muted">Registrar un ejemplar que no existe en el sistema.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>
                    
                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookEditSearch()">
                        <div class="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-pencil-square text-warning"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Modificar libro</div>
                            <div class="small text-muted">Editar informacion de un ejemplar existente.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>

                    <button class="btn btn-white border shadow-sm rounded-pill p-3 text-start d-flex align-items-center" onclick="AdminBiblio.renderBookStatusSearch()">
                        <div class="bg-danger bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;">
                            <i class="bi bi-power text-danger"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">Habilitar / Deshabilitar</div>
                            <div class="small text-muted">Dar de baja ejemplares o reactivarlos.</div>
                        </div>
                        <i class="bi bi-chevron-right ms-auto text-muted"></i>
                    </button>
                </div>

                <div class="small fw-bold text-muted text-uppercase mb-2">Ultimo agregado</div>
                <div id="gestion-libros-last-book" class="rounded-4 border bg-white shadow-sm p-3 text-muted small">
                    <span class="spinner-border spinner-border-sm me-2"></span>Cargando referencia...
                </div>
            </div>
        `;

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
    }

    function _cleanupBackdrop() {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
            backdrops.forEach(b => b.remove());
            document.body.classList.remove('modal-open');
        }
    }

    async function getNextSequentialAdquisicion(baseAdq) {
        const inUse = new Set();
        const mainInput = document.getElementById('bf-adq');
        if (mainInput && mainInput.value && mainInput.value !== 'Generando...') inUse.add(mainInput.value.trim().toUpperCase());
        
        const copyInputs = document.querySelectorAll('.copy-adq-input');
        if (copyInputs) {
            copyInputs.forEach(input => {
                if (input.value && input.value !== 'Generando...') {
                    inUse.add(input.value.trim().toUpperCase());
                }
            });
        }

        if (!baseAdq) {
            let num;
            let attempts = 0;
            while(attempts < 50) {
                num = String(Math.floor(10000 + Math.random() * 90000));
                if (!inUse.has(num)) {
                    try {
                        const book = await BiblioService.getBookByAdquisicion(_ctx, num);
                        if (!book) return num;
                    } catch(e) {}
                }
                attempts++;
            }
            return String(Math.floor(10000 + Math.random() * 90000));
        }
        
        const match = baseAdq.match(/^([a-zA-Z\-]*)(\d+)$/);
        if (match) {
            const prefix = match[1];
            let numStr = match[2];
            let num = parseInt(numStr, 10);
            
            let exists = true;
            let attempts = 0;
            while (exists && attempts < 50) {
                num++;
                let newNumStr = String(num).padStart(numStr.length, '0');
                let newAdq = prefix + newNumStr;
                let newAdqUpper = newAdq.toUpperCase();
                
                if (inUse.has(newAdqUpper)) {
                    attempts++;
                    continue;
                }
                
                try {
                    const book = await BiblioService.getBookByAdquisicion(_ctx, newAdq);
                    exists = !!book;
                    if (!exists) return newAdq;
                } catch (e) { exists = true; }
                attempts++;
            }
        }
        
        return String(Math.floor(10000 + Math.random() * 90000));
    }

    async function generateRandomAdquisicion(inputId, inputElement = null) {
        const el = inputElement || document.getElementById(inputId);
        if (!el) return;
        
        el.disabled = true;
        const originalValue = el.value;
        el.value = 'Generando...';
        
        try {
            let baseAdq = '';
            const mainInput = document.getElementById('bf-adq');
            if (mainInput && mainInput.value && mainInput.value !== 'Generando...' && mainInput !== el) {
                baseAdq = mainInput.value.trim();
            } else if (originalValue) {
                baseAdq = originalValue.trim();
            }

            let adq = await getNextSequentialAdquisicion(baseAdq);
            el.value = adq;
        } catch (e) {
            el.value = originalValue;
            showToast('Error autogenerando numero.', 'danger');
        } finally {
            el.disabled = false;
        }
    }

    function addCopyRow() {
        const container = document.getElementById('copies-container');
        const id = 'copy-' + Date.now();
        const div = document.createElement('div');
        div.className = 'd-flex gap-2 copy-row align-items-center mb-2';
        div.id = id;
        div.innerHTML = `
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-light text-muted">Copia</span>
                <input type="text" class="form-control copy-adq-input" required placeholder="No. Adquisicion">
                <button class="btn btn-outline-secondary" type="button" onclick="AdminBiblio.generateRandomAdquisicion(null, this.previousElementSibling)" title="Generar numero secuencial">
                    <i class="bi bi-magic"></i>
                </button>
            </div>
            <button class="btn btn-outline-danger btn-sm" type="button" onclick="document.getElementById('${id}').remove()">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(div);
        
        const allInputs = container.querySelectorAll('.copy-adq-input');
        if (allInputs.length > 0) {
            const input = allInputs[allInputs.length - 1];
            AdminBiblio.generateRandomAdquisicion(null, input);
        }
    }

    function renderCopySearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-primary text-white px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-files me-2"></i>Agregar Copia Existente</h5>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.renderBookForm()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="small text-muted mb-3">Busca el libro o una de sus copias por su numero de adquisicion para copiar sus datos.</div>
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="copy-search-input" placeholder="Ingresa No. Adquisicion (Ej: 00001)" onkeydown="if(event.key === 'Enter') AdminBiblio.handleCopySearch()">
                    <button class="btn btn-primary px-4 fw-bold" onclick="AdminBiblio.handleCopySearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                <div id="copy-search-result" class="card border-0 shadow-sm">
                    <div class="text-center py-4 text-muted"><i class="bi bi-info-circle mb-2 fs-3 d-block"></i>Ingresa un codigo para buscar.</div>
                </div>
            </div>
        `;
    }

    async function handleCopySearch() {
        const q = document.getElementById('copy-search-input').value.trim();
        if (!q) return showToast("Ingresa un numero de adquisicion", "warning");

        const container = document.getElementById('copy-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm"></span> Buscando...</div>';

        try {
            const bookByCode = await BiblioService.getBookByAdquisicion(_ctx, q.toUpperCase());
                
            if (!bookByCode) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No se encontro el libro.</div>';
                return;
            }
            
            const book = bookByCode;
            const bookPayload = encodeItemPayload(book);
            const titulo = escapeHtml(book.titulo || 'Sin titulo');
            const autor = escapeHtml(book.autor || 'Desconocido');

            let maxAdqStr = book.adquisicion;
            if (book.titulo) {
                try {
                    let copies = [];
                    if (window.BiblioService && window.BiblioService.getCopiesByTitleAndAuthorAdmin) {
                        copies = await window.BiblioService.getCopiesByTitleAndAuthorAdmin(_ctx, book.titulo, book.autor);
                    } else {
                        const titleSnap = await _ctx.db.collection('biblio-catalogo')
                            .where('titulo', '==', book.titulo)
                            .get();
                        titleSnap.forEach(doc => copies.push(doc.data()));
                    }
                        
                    let maxNum = -1;
                    copies.forEach(data => {
                        const adq = data.adquisicion;
                        if (adq) {
                            const match = adq.match(/^([a-zA-Z\-]*)(\d+)$/);
                            if (match) {
                                const num = parseInt(match[2], 10);
                                if (num > maxNum) {
                                    maxNum = num;
                                    maxAdqStr = adq;
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.error("Error buscando copias por titulo:", err);
                }
            }

            const nextAdq = await getNextSequentialAdquisicion(maxAdqStr);
            book.adquisicion = nextAdq; 
            const nextPayload = encodeItemPayload(book);

            container.innerHTML = `
                <div class="card-body p-4">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="bg-primary bg-opacity-10 p-3 rounded-3 text-primary">
                            <i class="bi bi-book fs-3"></i>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="fw-bold mb-1 text-truncate">${titulo}</h6>
                            <small class="text-muted d-block text-truncate">${autor}</small>
                        </div>
                    </div>
                    <div class="alert alert-info py-2 px-3 small d-flex flex-column gap-2 mb-0">
                        <span>Sugerencia autogenerada para la nueva copia: <strong>${nextAdq}</strong></span>
                        <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold w-100" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('${nextPayload}'), true)">
                            Usar datos y continuar <i class="bi bi-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div class="p-4 text-center text-danger">Error: ${e.message}</div>`;
        }
    }

    async function renderBookForm(bookToEdit = null, isCopyMode = false) {
        const isEdit = !!bookToEdit && !isCopyMode;
        const title = isEdit ? 'Modificar Libro' : (isCopyMode ? 'Agregar Copia' : 'Agregar Nuevo Libro');
        const btnText = isEdit ? 'Actualizar Libro' : (isCopyMode ? 'Guardar Copia' : 'Guardar Libro(s)');
        const btnColor = isEdit ? 'btn-warning' : 'btn-success';

        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 ${isEdit ? 'bg-warning' : 'bg-success'} text-white px-4 py-3">
                <div>
                    <h5 class="fw-bold mb-1"><i class="bi ${isEdit ? 'bi-pencil-square' : 'bi-plus-circle'} me-2"></i>${title}</h5>
                    <div class="small ${isEdit ? 'text-dark-emphasis' : 'text-white-50'}">${isEdit ? 'Ajusta el registro localizado antes de guardar.' : 'Captura los datos para darlo de alta en el catalogo.'}</div>
                </div>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                ${!isEdit && !isCopyMode ? `
                    <div class="d-flex justify-content-end mb-3">
                        <button class="btn btn-outline-primary btn-sm rounded-pill fw-bold" onclick="AdminBiblio.renderCopySearch()">
                            <i class="bi bi-files me-1"></i>Agregar una copia existente
                        </button>
                    </div>
                ` : ''}
                
                <div class="alert alert-light border rounded-4 shadow-sm mb-4">
                    <div class="small text-muted mb-0">${isEdit ? 'El numero de adquisicion permanece fijo para evitar cambiar la referencia del ejemplar.' : (isCopyMode ? 'Se copiaron los detalles del libro original. Confirma el numero de adquisicion nuevo y guarda.' : 'Llena los campos para el libro principal. Podras agregar copias extra al final si lo deseas.')}</div>
                </div>
                <form id="book-form" onsubmit="event.preventDefault(); AdminBiblio.saveBook('${isEdit ? (bookToEdit?.id || '') : ''}', ${isCopyMode})">
                    <div class="row g-3">
                        <div class="col-md-5">
                            <label class="form-label small fw-bold text-muted">No. Adquisicion *</label>
                            <div class="input-group">
                                <input type="text" class="form-control rounded-start" id="bf-adq" required placeholder="Ej. 01542" value="${escapeHtml(bookToEdit?.adquisicion || '')}" ${isEdit ? 'readonly' : ''}>
                                ${!isEdit ? `
                                <button class="btn btn-secondary" type="button" onclick="AdminBiblio.generateRandomAdquisicion('bf-adq')" title="Generar numero secuencial">
                                    <i class="bi bi-magic"></i>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="col-md-7">
                            <label class="form-label small fw-bold text-muted">Titulo del Libro *</label>
                            <input type="text" class="form-control rounded-3" id="bf-titulo" required placeholder="Nombre del libro" value="${escapeHtml(bookToEdit?.titulo || '')}" ${isCopyMode ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Autor *</label>
                            <input type="text" class="form-control rounded-3" id="bf-autor" required placeholder="Autor principal" value="${escapeHtml(bookToEdit?.autor || '')}" ${isCopyMode ? 'readonly' : ''}>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Anio</label>
                            <input type="text" class="form-control rounded-3" id="bf-anio" placeholder="2024" value="${escapeHtml(bookToEdit?.anio ?? bookToEdit?.['año'] ?? '')}" ${isCopyMode ? 'readonly' : ''}>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">Categoria *</label>
                            <select class="form-select rounded-3" id="bf-cat" required ${isCopyMode ? 'disabled' : ''}>
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
                            <input type="text" class="form-control rounded-3" id="bf-clasif" placeholder="Ej: HM251 W46" value="${escapeHtml(bookToEdit?.clasificacion || '')}" ${isCopyMode ? 'readonly' : ''}>
                        </div>
                    </div>
                    
                    ${!isEdit && !isCopyMode ? `
                    <div class="mt-4 pt-3 border-top">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <label class="form-label small fw-bold text-muted mb-0">¿Este libro viene con copias extra?</label>
                            <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill" onclick="AdminBiblio.addCopyRow()">
                                <i class="bi bi-plus-lg me-1"></i> Agregar copia
                            </button>
                        </div>
                        <div id="copies-container" class="d-flex flex-column gap-2">
                        </div>
                    </div>
                    ` : ''}

                    <div class="d-grid mt-4">
                        <button type="submit" class="btn ${btnColor} py-2 rounded-pill fw-bold shadow-sm" id="btn-save-book">
                            <i class="bi bi-check-lg me-2"></i>${btnText}
                        </button>
                    </div>
                </form>
            </div>
        `;

        if (bookToEdit?.categoria) {
            const sel = document.getElementById('bf-cat');
            if (sel) sel.value = bookToEdit.categoria;
        }
    }

    async function saveBook(editId, isCopyMode = false) {
        const adqInput = document.getElementById('bf-adq');
        const adqBase = adqInput ? adqInput.value.trim().toUpperCase() : '';
        const titulo = document.getElementById('bf-titulo').value.trim();
        const autor = document.getElementById('bf-autor').value.trim();
        const anio = document.getElementById('bf-anio').value.trim();
        const catInput = document.getElementById('bf-cat');
        const categoria = catInput ? catInput.value : '';
        const clasificacion = document.getElementById('bf-clasif').value.trim();

        if (!adqBase || !titulo || !autor || (!isCopyMode && !categoria)) {
            return showToast("Completa los campos obligatorios (*)", "warning");
        }

        const btnSave = document.getElementById('btn-save-book');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        }

        try {
            const dataBase = {
                adquisicion: adqBase,
                titulo,
                autor,
                anio,
                copiasTotales: 1, 
                categoria: isCopyMode && catInput && catInput.disabled && catInput.querySelector('option[selected]') ? catInput.querySelector('option[selected]').value : categoria,
                clasificacion,
                ubicacion: 'Estanteria'
            };
            
            // Si estaba disabled, categoria no agarra el value bien. Vamos a forzarlo.
            if (isCopyMode && !dataBase.categoria) {
                // we have to get it from the bookToEdit if possible. Wait, the select maintains its value even if disabled, but let's be safe.
                if (catInput) dataBase.categoria = catInput.value;
            }

            if (editId) {
                await BiblioService.updateLibro(_ctx, editId, dataBase);
                showToast("Libro actualizado correctamente", "success");
            } else {
                await BiblioService.addLibro(_ctx, dataBase);
                let savedCount = 1;

                if (!isCopyMode) {
                    const copiesContainer = document.getElementById('copies-container');
                    if (copiesContainer) {
                        const copyInputs = copiesContainer.querySelectorAll('.copy-adq-input');
                        const copiesData = [];
                        copyInputs.forEach(input => {
                            const val = input.value.trim().toUpperCase();
                            if (val && val !== adqBase) {
                                copiesData.push({ ...dataBase, adquisicion: val });
                            }
                        });

                        for (const copyData of copiesData) {
                            try {
                                await BiblioService.addLibro(_ctx, copyData);
                                savedCount++;
                            } catch (err) {
                                console.error('Error saving copy', copyData.adquisicion, err);
                                showToast(`Error al guardar copia ${copyData.adquisicion}`, 'danger');
                            }
                        }
                    }
                }
                showToast(`Se ${savedCount === 1 ? 'guardo 1 ejemplar' : 'guardaron ' + savedCount + ' ejemplares'} exitosamente`, "success");
            }
            AdminBiblio.abrirSubmodalGestionarLibros(); 
        } catch (e) {
            showToast("Error al guardar: " + e.message, "danger");
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="bi bi-check-lg me-2"></i>Guardar';
            }
        }
    }

    async function renderBookEditSearch() {
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-warning text-dark px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-search me-2"></i>Buscar para Modificar</h5>
                <button class="btn-close" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
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
            const bookByCode = await BiblioService.getBookByAdquisicion(_ctx, q.toUpperCase());
            
            if (!bookByCode) {
                container.innerHTML = '<div class="p-4 text-center text-muted">No se encontro el libro.</div>';
                return;
            }
            const book = bookByCode;
            
            if (book.active === false) {
                container.innerHTML = `
                    <div class="p-4 text-center">
                        <i class="bi bi-exclamation-circle text-danger fs-3 d-block mb-2"></i>
                        <h6 class="fw-bold text-dark">Libro Dado de Baja</h6>
                        <p class="small text-muted mb-3">Este ejemplar se encuentra deshabilitado en el sistema.</p>
                        <button class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-bold" onclick="AdminBiblio.renderBookForm(AdminBiblio.decodeItemPayload('${encodeItemPayload(book)}'))">
                            Modificar de todos modos
                        </button>
                    </div>
                `;
                return;
            }
            
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

    function renderBookStatusSearch() {
        _statusSearchResults = [];
        _statusSearchCurrentPage = 1;
        const body = document.getElementById('modal-admin-body');
        body.innerHTML = `
            <div class="modal-header border-0 bg-danger text-white px-4 py-3">
                <h5 class="fw-bold mb-0"><i class="bi bi-power me-2"></i>Habilitar / Deshabilitar</h5>
                <button class="btn-close btn-close-white" onclick="AdminBiblio.abrirSubmodalGestionarLibros()"></button>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="input-group mb-4 shadow-sm">
                    <input type="text" class="form-control border-0 p-3" id="status-search-input" placeholder="Ingresa No. Adquisicion o nombre del libro" onkeydown="if(event.key === 'Enter') AdminBiblio.handleStatusSearch()">
                    <button class="btn btn-danger px-4 fw-bold" onclick="AdminBiblio.handleStatusSearch()">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold text-muted small mb-0 text-uppercase ls-1">Resultado de busqueda</h6>
                    <button class="btn btn-sm btn-outline-danger rounded-pill fw-bold" onclick="AdminBiblio.renderDisabledBooksList()">Ver libros deshabilitados</button>
                </div>

                <div id="status-search-result" class="card border-0 shadow-sm bg-transparent">
                    <div class="text-center py-4 text-muted bg-white rounded"><i class="bi bi-info-circle mb-2 fs-3 d-block"></i>Busca un libro para cambiar su estado.</div>
                </div>
            </div>
        `;
    }

    async function handleStatusSearch() {
        const q = document.getElementById('status-search-input').value.trim();
        if (!q) return showToast("Ingresa un codigo o nombre", "warning");

        const container = document.getElementById('status-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted bg-white rounded"><span class="spinner-border spinner-border-sm"></span> Buscando en el catalogo...</div>';

        try {
            _statusSearchResults = await BiblioService.searchCatalogoAdmin(_ctx, q, 100);
            _statusSearchCurrentPage = 1;
            
            if (!_statusSearchResults || _statusSearchResults.length === 0) {
                container.innerHTML = '<div class="p-4 text-center text-muted bg-white rounded">No se encontraron libros.</div>';
                return;
            }
            
            AdminBiblio.renderStatusSearchPage();
        } catch (e) {
            container.innerHTML = `<div class="p-4 text-center text-danger bg-white rounded">Error: ${e.message}</div>`;
        }
    }

    async function renderStatusSearchPage() {
        const container = document.getElementById('status-search-result');
        if (!_statusSearchResults || _statusSearchResults.length === 0) return;

        const totalPages = Math.ceil(_statusSearchResults.length / STATUS_RESULTS_PER_PAGE);
        const start = (_statusSearchCurrentPage - 1) * STATUS_RESULTS_PER_PAGE;
        const pageItems = _statusSearchResults.slice(start, start + STATUS_RESULTS_PER_PAGE);

        let html = '';
        
        for (const book of pageItems) {
            const copies = await BiblioService.getCopiesByTitleAndAuthorAdmin(_ctx, book.titulo, book.autor);
            copies.sort((a, b) => (a.adquisicion || '').localeCompare(b.adquisicion || ''));
            
            const titulo = escapeHtml(book.titulo || 'Sin titulo');
            const autor = escapeHtml(book.autor || 'Desconocido');
            
            let copiesHtml = '';
            copies.forEach((copy, index) => {
                const isActive = copy.active !== false;
                const adq = escapeHtml(copy.adquisicion || 'S/N');
                const label = index === 0 ? `${adq} Original` : `${adq} Copia`;
                
                const btnAction = isActive 
                    ? `<button class="btn btn-sm btn-outline-danger py-0 px-2 fw-bold" onclick="AdminBiblio.toggleBookStatusFromSearch('${copy.id}', false, this)"><i class="bi bi-x"></i> Deshabilitar</button>`
                    : `<button class="btn btn-sm btn-outline-success py-0 px-2 fw-bold" onclick="AdminBiblio.toggleBookStatusFromSearch('${copy.id}', true, this)"><i class="bi bi-check"></i> Habilitar</button>`;
                
                const statusDot = isActive ? '<span class="text-success"><i class="bi bi-circle-fill" style="font-size:0.5rem;vertical-align:middle;"></i></span>' : '<span class="text-danger"><i class="bi bi-circle-fill" style="font-size:0.5rem;vertical-align:middle;"></i></span>';
                const statusText = isActive ? 'Activo' : 'Baja';

                copiesHtml += `
                    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div class="small fw-semibold d-flex align-items-center gap-2">
                            ${statusDot} <span class="${isActive ? '' : 'text-muted text-decoration-line-through'}">${label}</span> <span class="badge ${isActive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill" style="font-size: 0.65em;">${statusText}</span>
                        </div>
                        <div>
                            ${btnAction}
                        </div>
                    </div>
                `;
            });
            
            let copiasText = 'Unico ejemplar';
            if (copies.length > 1) {
                const adqs = copies.slice(1).map(c => c.adquisicion || 'S/N').join(', ');
                copiasText = `${copies[0].adquisicion || 'S/N'} Original, Copias: ${adqs}`;
            }

            html += `
                <div class="card mb-3 border-0 shadow-sm overflow-hidden">
                    <div class="card-body p-0">
                        <div class="p-3 bg-light border-bottom">
                            <h6 class="fw-bold mb-1 text-dark">${titulo}</h6>
                            <div class="small text-muted d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-person me-1"></i>${autor}</span>
                                <span class="badge bg-secondary rounded-pill">${copies.length} ejemplares</span>
                            </div>
                            <div class="small text-muted mt-1" style="font-size:0.75rem;">
                                <i class="bi bi-upc-scan me-1"></i>${escapeHtml(copiasText)}
                            </div>
                        </div>
                        <div class="px-3 pb-2 pt-1 bg-white">
                            ${copiesHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        if (totalPages > 1) {
            html += `
                <div class="d-flex justify-content-between align-items-center mt-4 bg-white p-3 rounded shadow-sm border">
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" onclick="AdminBiblio.changeStatusSearchPage(-1)" ${_statusSearchCurrentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left me-1"></i>Anterior
                    </button>
                    <span class="small text-muted fw-bold">Pagina ${_statusSearchCurrentPage} de ${totalPages}</span>
                    <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" onclick="AdminBiblio.changeStatusSearchPage(1)" ${_statusSearchCurrentPage === totalPages ? 'disabled' : ''}>
                        Siguiente<i class="bi bi-chevron-right ms-1"></i>
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function changeStatusSearchPage(delta) {
        const totalPages = Math.ceil(_statusSearchResults.length / STATUS_RESULTS_PER_PAGE);
        const newPage = _statusSearchCurrentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            _statusSearchCurrentPage = newPage;
            AdminBiblio.renderStatusSearchPage();
            const resEl = document.getElementById('status-search-result');
            if (resEl) resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async function toggleBookStatusFromSearch(bookId, isActive, btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
        try {
            await BiblioService.toggleLibroStatus(_ctx, bookId, isActive);
            showToast(isActive ? 'Libro reactivado' : 'Libro dado de baja', 'success');
            
            const container = document.getElementById('status-search-result');
            if (container && container.innerHTML.includes('Libros dados de baja')) {
                AdminBiblio.renderDisabledBooksList();
            } else {
                AdminBiblio.renderStatusSearchPage();
            }
        } catch (e) {
            showToast("Error al cambiar estado: " + e.message, "danger");
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = isActive ? '<i class="bi bi-check"></i> Habilitar' : '<i class="bi bi-x"></i> Deshabilitar';
            }
        }
    }

    let _disabledBooksCache = [];

    async function renderDisabledBooksList() {
        const container = document.getElementById('status-search-result');
        container.innerHTML = '<div class="text-center py-4 text-muted bg-white rounded"><span class="spinner-border spinner-border-sm"></span> Cargando libros deshabilitados...</div>';

        try {
            _disabledBooksCache = await BiblioService.getAllDisabledBooksAdmin(_ctx);
            if (!_disabledBooksCache || _disabledBooksCache.length === 0) {
                container.innerHTML = '<div class="p-4 text-center text-muted bg-white rounded">No hay libros dados de baja.</div>';
                return;
            }

            let html = `
                <div class="card mb-3 border-0 shadow-sm overflow-hidden">
                    <div class="card-body p-0">
                        <div class="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                            <h6 class="fw-bold mb-0 text-dark">Libros dados de baja (${_disabledBooksCache.length})</h6>
                            <button class="btn btn-sm btn-danger fw-bold rounded-pill" onclick="AdminBiblio.downloadDisabledBooksReport()">
                                <i class="bi bi-file-earmark-pdf me-1"></i> Descargar Reporte
                            </button>
                        </div>
                        <div class="px-3 pb-2 pt-1 bg-white" style="max-height: 400px; overflow-y: auto;">
            `;

            for (const book of _disabledBooksCache) {
                const titulo = escapeHtml(book.titulo || 'Sin titulo');
                const adq = escapeHtml(book.adquisicion || 'S/N');
                const label = book.isCopy ? `${adq} Copia` : `${adq} Original`;
                const statusText = 'Dado de baja';

                const btnAction = `<button class="btn btn-sm btn-outline-success py-0 px-2 fw-bold" onclick="AdminBiblio.toggleBookStatusFromSearch('${book.id}', true, this)"><i class="bi bi-check"></i> Habilitar</button>`;

                html += `
                    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div>
                            <div class="fw-bold text-dark small">${titulo}</div>
                            <div class="small text-muted d-flex align-items-center gap-2 mt-1">
                                <span class="text-danger"><i class="bi bi-circle-fill" style="font-size:0.5rem;vertical-align:middle;"></i></span> 
                                <span class="text-muted text-decoration-line-through">${label}</span> 
                                <span class="badge bg-danger-subtle text-danger rounded-pill" style="font-size: 0.65em;">${statusText}</span>
                            </div>
                        </div>
                        <div>
                            ${btnAction}
                        </div>
                    </div>
                `;
            }

            html += `
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = `<div class="p-4 text-center text-danger bg-white rounded">Error: ${e.message}</div>`;
        }
    }

    async function downloadDisabledBooksReport() {
        if (!window.ExportUtils) {
            alert('Las utilidades de exportacion no estan disponibles.');
            return;
        }

        const btnEl = event.currentTarget;
        const originalHtml = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generando...';

        try {
            const config = {
                title: 'Reporte de Libros Dados de Baja',
                headers: ['No. Adquisicion', 'Titulo', 'Autor', 'Tipo', 'Estado'],
                widths: ['auto', '*', '*', 'auto', 'auto']
            };

            const rows = _disabledBooksCache.map(b => [
                b.adquisicion || 'S/N',
                b.titulo || 'Sin titulo',
                b.autor || 'Desconocido',
                b.isCopy ? 'Copia' : 'Original',
                'Dado de baja'
            ]);

            const payload = {
                rows,
                pdfRows: rows,
                description: ['Listado de ejemplares que actualmente se encuentran dados de baja o deshabilitados en el sistema.']
            };

            await window.ExportUtils.generatePDF(config, payload, 'BIBLIO');
        } catch (error) {
            console.error('[BIBLIO] Error generating disabled books report', error);
            showToast('Error al generar el reporte', 'danger');
        } finally {
            btnEl.disabled = false;
            btnEl.innerHTML = originalHtml;
        }
    }


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



    // --- INVENTARIO FISICO ---

    async function abrirSubmodalInventarioFisico() {
        const body = document.getElementById('modal-admin-body');
        
        body.innerHTML = `
            <div class="modal-header border-0 bg-info text-white p-4">
                <div>
                    <h3 class="fw-bold mb-1"><i class="bi bi-box-seam me-3"></i>Inventario Físico</h3>
                    <div class="small text-white-75">Sillas, mesas, anaqueles, equipos y otros.</div>
                </div>
                <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="bg-light px-4 py-2 border-bottom d-flex align-items-center">
                <button class="btn btn-sm btn-outline-secondary rounded-pill me-2" onclick="AdminBiblio.abrirModalMenuInventario()">
                    <i class="bi bi-arrow-left me-1"></i>Volver
                </button>
            </div>
            <div class="modal-body p-4 bg-light">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body p-4">
                        <h5 class="fw-bold mb-3">Agregar Elemento</h5>
                        <form id="formInventarioFisico" onsubmit="event.preventDefault(); AdminBiblio.guardarInventarioFisicoItem();">
                            <input type="hidden" id="invFisicoId" value="">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label small fw-bold text-muted">Nombre del objeto</label>
                                    <input type="text" id="invFisicoNombre" class="form-control" placeholder="Ej. Sillas de lectura" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold text-muted">Cantidad</label>
                                    <input type="number" id="invFisicoCantidad" class="form-control" min="0" placeholder="0" required>
                                </div>
                                <div class="col-12 text-end mt-3">
                                    <button type="button" class="btn btn-light me-2 d-none" id="btnInvFisicoCancelar" onclick="AdminBiblio.cancelarEdicionInventarioFisico()">Cancelar</button>
                                    <button type="submit" class="btn btn-info text-white px-4 fw-bold" id="btnInvFisicoGuardar">Agregar al inventario</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <h5 class="fw-bold mb-3 px-1 text-muted">Elementos Registrados</h5>
                <div id="listaInventarioFisico" class="d-flex flex-column gap-2 pb-5">
                    <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Cargando...</div>
                </div>
            </div>
        `;
        
        cargarListaInventarioFisico();
    }

    async function cargarListaInventarioFisico(forceRefresh = false) {
        const container = document.getElementById('listaInventarioFisico');
        if (!container) return;
        
        try {
            const data = await BiblioService.getResumenInventarioFisico(_ctx, forceRefresh);
            
            if (!data || data.length === 0) {
                container.innerHTML = `<div class="text-center py-5 text-muted bg-white rounded-4 border-0 shadow-sm">
                    <i class="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                    No hay elementos físicos registrados.
                </div>`;
                return;
            }
            
            let html = '';
            let totalItems = 0;
            
            data.forEach(item => {
                totalItems += Number(item.cantidad) || 0;
                // escape strings to prevent xss
                const nombreSeguro = escapeHtml(item.nombre);
                html += `
                    <div class="card border-0 shadow-sm rounded-3">
                        <div class="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <h6 class="fw-bold mb-0 text-dark">${nombreSeguro}</h6>
                                <div class="small text-muted mt-1">Ultima act: ${new Date(item.ultimaActualizacion).toLocaleDateString()}</div>
                            </div>
                            <div class="d-flex align-items-center gap-3">
                                <div class="bg-light rounded-pill px-3 py-1 fw-bold text-info border">${item.cantidad}</div>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-light rounded-circle" type="button" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                        <li><a class="dropdown-item small" href="#" onclick="event.preventDefault(); AdminBiblio.editarInventarioFisicoItem('${item.id}', '${nombreSeguro.replace(/'/g, "\\'")}', ${item.cantidad})"><i class="bi bi-pencil me-2 text-primary"></i>Editar</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item small text-danger" href="#" onclick="event.preventDefault(); AdminBiblio.eliminarInventarioFisicoItem('${item.id}')"><i class="bi bi-trash me-2"></i>Eliminar</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html = `
                <div class="bg-info bg-opacity-10 rounded-3 p-3 mb-2 d-flex justify-content-between align-items-center text-info fw-bold">
                    <span>Total de Objetos</span>
                    <span class="fs-5">${totalItems}</span>
                </div>
            ` + html;
            
            container.innerHTML = html;
            
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger shadow-sm border-0"><i class="bi bi-exclamation-triangle me-2"></i>Error al cargar: ${error.message}</div>`;
        }
    }
    
    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    async function guardarInventarioFisicoItem() {
        const idInput = document.getElementById('invFisicoId');
        const nombreInput = document.getElementById('invFisicoNombre');
        const cantidadInput = document.getElementById('invFisicoCantidad');
        const btnGuardar = document.getElementById('btnInvFisicoGuardar');
        
        const id = idInput.value;
        const nombre = nombreInput.value.trim();
        const cantidad = Number(cantidadInput.value);
        
        if (!nombre) {
            if(window.showToast) window.showToast('El nombre es requerido', 'warning');
            return;
        }
        
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        
        try {
            await BiblioService.saveInventarioFisicoItem(_ctx, id, { nombre, cantidad });
            if(window.showToast) window.showToast('Guardado correctamente', 'success');
            
            // reset form
            cancelarEdicionInventarioFisico();
            
            // refresh list
            cargarListaInventarioFisico(true);
        } catch (error) {
            if(window.showToast) window.showToast(error.message, 'error');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = 'Agregar al inventario';
        }
    }

    function editarInventarioFisicoItem(id, nombre, cantidad) {
        document.getElementById('invFisicoId').value = id;
        document.getElementById('invFisicoNombre').value = nombre;
        document.getElementById('invFisicoCantidad').value = cantidad;
        
        document.getElementById('btnInvFisicoCancelar').classList.remove('d-none');
        document.getElementById('btnInvFisicoGuardar').innerHTML = 'Guardar Cambios';
        document.getElementById('btnInvFisicoGuardar').classList.replace('btn-info', 'btn-primary');
        
        // scroll to top
        document.querySelector('.modal-body').scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelarEdicionInventarioFisico() {
        document.getElementById('invFisicoId').value = '';
        document.getElementById('invFisicoNombre').value = '';
        document.getElementById('invFisicoCantidad').value = '';
        
        document.getElementById('btnInvFisicoCancelar').classList.add('d-none');
        document.getElementById('btnInvFisicoGuardar').disabled = false;
        document.getElementById('btnInvFisicoGuardar').innerHTML = 'Agregar al inventario';
        document.getElementById('btnInvFisicoGuardar').classList.replace('btn-primary', 'btn-info');
    }

    async function eliminarInventarioFisicoItem(id) {
        if (!confirm('¿Seguro que deseas eliminar este elemento del inventario?')) return;
        
        try {
            await BiblioService.deleteInventarioFisicoItem(_ctx, id);
            if(window.showToast) window.showToast('Elemento eliminado', 'success');
            cargarListaInventarioFisico(true);
        } catch (error) {
            if(window.showToast) window.showToast(error.message, 'error');
        }
    }

    return {
        abrirModalGestionLibros: withState(abrirModalGestionLibros),
        abrirModalMenuInventario: withState(abrirModalMenuInventario),
        abrirSubmodalInventarioFisico: withState(abrirSubmodalInventarioFisico),
        guardarInventarioFisicoItem: withState(guardarInventarioFisicoItem),
        editarInventarioFisicoItem: withState(editarInventarioFisicoItem),
        cancelarEdicionInventarioFisico: withState(cancelarEdicionInventarioFisico),
        eliminarInventarioFisicoItem: withState(eliminarInventarioFisicoItem),
        refreshGestionLibrosInventoryStatus: withState(refreshGestionLibrosInventoryStatus),
        confirmFinalizeInventoryFromGestion: withState(confirmFinalizeInventoryFromGestion),
        confirmAdjustFinishedInventoryFromGestion: withState(confirmAdjustFinishedInventoryFromGestion),
        downloadInventoryAdjustmentBackupFromGestion: withState(downloadInventoryAdjustmentBackupFromGestion),
        _cleanupBackdrop: withState(_cleanupBackdrop),
        renderBookForm: withState(renderBookForm),
        saveBook: withState(saveBook),
        renderBookEditSearch: withState(renderBookEditSearch),
        handleEditSearch: withState(handleEditSearch),
        renderEditBookCard: withState(renderEditBookCard),
        abrirSubmodalEtiquetas: withState(abrirSubmodalEtiquetas),
        abrirSubmodalInventario: withState(abrirSubmodalInventario),
        abrirSubmodalGestionarLibros: withState(abrirSubmodalGestionarLibros),
        addCopyRow: withState(addCopyRow),
        generateRandomAdquisicion: withState(generateRandomAdquisicion),
        renderCopySearch: withState(renderCopySearch),
        handleCopySearch: withState(handleCopySearch),
        renderBookStatusSearch: withState(renderBookStatusSearch),
        handleStatusSearch: withState(handleStatusSearch),
        renderStatusSearchPage: withState(renderStatusSearchPage),
        changeStatusSearchPage: withState(changeStatusSearchPage),
        toggleBookStatusFromSearch: withState(toggleBookStatusFromSearch),
        renderDisabledBooksList: withState(renderDisabledBooksList),
        downloadDisabledBooksReport: withState(downloadDisabledBooksReport),
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
        toggleAssetStatus: withState(toggleAssetStatus),
        handleLabelSearch: withState(handleLabelSearch),
        addLabelToQueue: withState(addLabelToQueue),
        addAllLabelsToQueue: withState(addAllLabelsToQueue),
        removeLabelFromQueue: withState(removeLabelFromQueue),
        clearLabelsQueue: withState(clearLabelsQueue),
        exportLabelsPdf: withState(exportLabelsPdf),
        renderLabelsQueue: withState(renderLabelsQueue)
    };
})();

// Re-expose to AdminBiblio directly to support hot-reloading without requiring admin.biblio.js to re-run
if (window.AdminBiblio && window.AdminBiblio.Catalogo) {
    Object.assign(window.AdminBiblio, window.AdminBiblio.Catalogo);
}
