if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Inventario = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _inventorySession = null;
    let _inventoryCatalogSummary = null;
    let _inventoryFoundEntries = [];
    let _inventoryMissingEntries = [];
    let _inventoryLookupResults = [];
    let _inventorySelectedBook = null;
    let _inventoryAssociateMode = false;
    let _inventoryCopyLookupResults = [];
    let _inventorySelectedCopyBase = null;
    let _inventoryMoreCopiesMode = false;
    let _inventoryPendingCopyCodes = [];
    let _inventoryDraftQuantity = null;
    let _inventorySearchDebounce = null;
    let _inventoryScannerActive = false;
    let _inventoryScannerStream = null;
    let _inventoryScannerLoopId = null;
    let _inventoryScannerSupported = false;
    let _inventoryDetector = null;
    let _inventoryModalHiddenBound = false;
    let _inventorySaving = false;
    let _inventoryDuplicateSearch = false;
    let _inventoryUnregisteredMode = 'new';
    let _inventoryUnregisteredCopyBase = null;
    let _inventoryReviewPage = 1;
    let _inventoryReviewEditingId = '';
    let _inventoryReviewDraftQuantity = 0;
    let _inventoryReviewPendingCopyCodes = [];
    let _inventoryReviewAdjusting = false;
    let _inventoryReviewAdjustInterval = null;
    let _inventoryReviewSearchTerm = '';
    let _inventoryReviewKnownCopies = [];
    let _inventoryReviewCopiesLoading = false;
    let _inventorySearchQuery = '';

    function syncFromState() {
        _ctx = state.ctx;
        _inventorySession = state.inventorySession || null;
        _inventoryCatalogSummary = state.inventoryCatalogSummary || null;
        _inventoryFoundEntries = Array.isArray(state.inventoryFoundEntries) ? state.inventoryFoundEntries.slice() : [];
        _inventoryMissingEntries = Array.isArray(state.inventoryMissingEntries) ? state.inventoryMissingEntries.slice() : [];
        _inventoryLookupResults = Array.isArray(state.inventoryLookupResults) ? state.inventoryLookupResults.slice() : [];
        _inventorySelectedBook = state.inventorySelectedBook || null;
        _inventoryAssociateMode = state.inventoryAssociateMode === true;
        _inventoryCopyLookupResults = Array.isArray(state.inventoryCopyLookupResults) ? state.inventoryCopyLookupResults.slice() : [];
        _inventorySelectedCopyBase = state.inventorySelectedCopyBase || null;
        _inventoryMoreCopiesMode = state.inventoryMoreCopiesMode === true;
        _inventoryPendingCopyCodes = Array.isArray(state.inventoryPendingCopyCodes) ? state.inventoryPendingCopyCodes.slice() : [];
        _inventoryDraftQuantity = state.inventoryDraftQuantity == null ? null : Number(state.inventoryDraftQuantity);
        _inventorySearchDebounce = state.inventorySearchDebounce || null;
        _inventoryScannerActive = state.inventoryScannerActive === true;
        _inventoryScannerStream = state.inventoryScannerStream || null;
        _inventoryScannerLoopId = state.inventoryScannerLoopId || null;
        _inventoryScannerSupported = state.inventoryScannerSupported === true;
        _inventoryDetector = state.inventoryDetector || null;
        _inventoryModalHiddenBound = state.inventoryModalHiddenBound === true;
        _inventorySaving = state.inventorySaving === true;
        _inventoryDuplicateSearch = state.inventoryDuplicateSearch === true;
        _inventoryUnregisteredMode = state.inventoryUnregisteredMode || 'new';
        _inventoryUnregisteredCopyBase = state.inventoryUnregisteredCopyBase || null;
        _inventoryReviewPage = Math.max(1, Number(state.inventoryReviewPage) || 1);
        _inventoryReviewEditingId = state.inventoryReviewEditingId || '';
        _inventoryReviewDraftQuantity = Math.max(0, Number(state.inventoryReviewDraftQuantity) || 0);
        _inventoryReviewPendingCopyCodes = Array.isArray(state.inventoryReviewPendingCopyCodes) ? state.inventoryReviewPendingCopyCodes.slice() : [];
        _inventoryReviewAdjusting = state.inventoryReviewAdjusting === true;
        _inventoryReviewAdjustInterval = state.inventoryReviewAdjustInterval || null;
        _inventoryReviewSearchTerm = state.inventoryReviewSearchTerm || '';
        _inventoryReviewKnownCopies = Array.isArray(state.inventoryReviewKnownCopies) ? state.inventoryReviewKnownCopies.slice() : [];
        _inventoryReviewCopiesLoading = state.inventoryReviewCopiesLoading === true;
        _inventorySearchQuery = state.inventorySearchQuery || '';
    }

    function syncToState() {
        state.ctx = _ctx;
        state.inventorySession = _inventorySession || null;
        state.inventoryCatalogSummary = _inventoryCatalogSummary || null;
        state.inventoryFoundEntries = Array.isArray(_inventoryFoundEntries) ? _inventoryFoundEntries.slice() : [];
        state.inventoryMissingEntries = Array.isArray(_inventoryMissingEntries) ? _inventoryMissingEntries.slice() : [];
        state.inventoryLookupResults = Array.isArray(_inventoryLookupResults) ? _inventoryLookupResults.slice() : [];
        state.inventorySelectedBook = _inventorySelectedBook || null;
        state.inventoryAssociateMode = _inventoryAssociateMode === true;
        state.inventoryCopyLookupResults = Array.isArray(_inventoryCopyLookupResults) ? _inventoryCopyLookupResults.slice() : [];
        state.inventorySelectedCopyBase = _inventorySelectedCopyBase || null;
        state.inventoryMoreCopiesMode = _inventoryMoreCopiesMode === true;
        state.inventoryPendingCopyCodes = Array.isArray(_inventoryPendingCopyCodes) ? _inventoryPendingCopyCodes.slice() : [];
        state.inventoryDraftQuantity = _inventoryDraftQuantity == null ? null : _inventoryDraftQuantity;
        state.inventorySearchDebounce = _inventorySearchDebounce || null;
        state.inventoryScannerActive = _inventoryScannerActive === true;
        state.inventoryScannerStream = _inventoryScannerStream || null;
        state.inventoryScannerLoopId = _inventoryScannerLoopId || null;
        state.inventoryScannerSupported = _inventoryScannerSupported === true;
        state.inventoryDetector = _inventoryDetector || null;
        state.inventoryModalHiddenBound = _inventoryModalHiddenBound === true;
        state.inventorySaving = _inventorySaving === true;
        state.inventoryDuplicateSearch = _inventoryDuplicateSearch === true;
        state.inventoryUnregisteredMode = _inventoryUnregisteredMode || 'new';
        state.inventoryUnregisteredCopyBase = _inventoryUnregisteredCopyBase || null;
        state.inventoryReviewPage = _inventoryReviewPage || 1;
        state.inventoryReviewEditingId = _inventoryReviewEditingId || '';
        state.inventoryReviewDraftQuantity = _inventoryReviewDraftQuantity || 0;
        state.inventoryReviewPendingCopyCodes = Array.isArray(_inventoryReviewPendingCopyCodes) ? _inventoryReviewPendingCopyCodes.slice() : [];
        state.inventoryReviewAdjusting = _inventoryReviewAdjusting === true;
        state.inventoryReviewAdjustInterval = _inventoryReviewAdjustInterval || null;
        state.inventoryReviewSearchTerm = _inventoryReviewSearchTerm || '';
        state.inventoryReviewKnownCopies = Array.isArray(_inventoryReviewKnownCopies) ? _inventoryReviewKnownCopies.slice() : [];
        state.inventoryReviewCopiesLoading = _inventoryReviewCopiesLoading === true;
        state.inventorySearchQuery = _inventorySearchQuery || '';
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
    function encodeItemPayload(...args) { return shared.encodeItemPayload(...args); }
    function decodeItemPayload(...args) { return shared.decodeItemPayload(...args); }
    function showConfirmModal(...args) { return shared.showConfirmModal(...args); }

    function getAdminModalConfig() {
        const modalEl = document.getElementById('modal-admin-action');
        if (!modalEl) return { modalEl: null, modal: null, body: null, dialog: null };
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        return {
            modalEl,
            modal,
            body: document.getElementById('modal-admin-body'),
            dialog: modalEl.querySelector('.modal-dialog')
        };
    }

    function ensureInventoryModalVisibility() {
        const { modalEl, modal, dialog } = getAdminModalConfig();
        if (!modalEl || !modal) return;

        if (dialog) {
            dialog.classList.add('modal-xl', 'modal-dialog-scrollable');
        }

        if (modalEl.dataset.inventoryHiddenBound !== '1') {
            modalEl.addEventListener('hidden.bs.modal', async () => {
                window.AdminBiblio.stopInventoryScanner?.();
                try {
                    const activeSession = state.inventorySession || _inventorySession;
                    const activeCtx = state.ctx || _ctx;
                    if (activeCtx && activeSession?.id && activeSession?.status === 'active') {
                        const details = await BiblioService.pauseInventorySession(activeCtx, activeSession.id);
                        state.inventorySession = details?.session || activeSession;
                    }
                } catch (error) {
                    console.warn('[BiblioAdmin] No se pudo pausar automaticamente el inventario al cerrar el modal:', error);
                }
                try {
                    window.AdminBiblio._cleanupBackdrop?.();
                } catch (error) {}
                syncModalScrollLock();
            });
            modalEl.dataset.inventoryHiddenBound = '1';
            _inventoryModalHiddenBound = true;
        }

        if (!modalEl.classList.contains('show')) {
            modal.show();
        }
    }

    function clearInventoryDraftUi() {
        _inventoryLookupResults = [];
        _inventorySelectedBook = null;
        _inventoryAssociateMode = false;
        _inventoryCopyLookupResults = [];
        _inventorySelectedCopyBase = null;
        _inventoryMoreCopiesMode = false;
        _inventoryPendingCopyCodes = [];
        _inventoryDraftQuantity = null;
        _inventoryDuplicateSearch = false;
        _inventoryUnregisteredMode = 'new';
        _inventoryUnregisteredCopyBase = null;
        _inventorySearchQuery = '';
        const selectedEl = document.getElementById('inventory-selection-card');
        const missingName = document.getElementById('inventory-missing-name');
        const missingQty = document.getElementById('inventory-missing-qty');
        const copySearch = document.getElementById('inventory-copy-search-input');
        const extraCopyInput = document.getElementById('inventory-extra-copy-input');
        const missingWrap = document.getElementById('inventory-missing-wrap');
        renderInventorySearchFeedback();
        if (selectedEl) selectedEl.innerHTML = '';
        if (missingName) missingName.value = '';
        if (missingQty) missingQty.value = '1';
        if (copySearch) copySearch.value = '';
        if (extraCopyInput) extraCopyInput.value = '';
        if (missingWrap) missingWrap.classList.add('d-none');
        renderInventoryCopyResults();
        renderInventoryCopySelectedBase();
    }

    function renderInventorySearchFeedback(message = 'Ingresa el No. de adquisicion y presiona Buscar.', tone = 'muted') {
        const feedbackEl = document.getElementById('inventory-search-feedback');
        if (!feedbackEl) return;

        const classMap = {
            muted: 'text-muted',
            success: 'text-success',
            warning: 'text-warning',
            danger: 'text-danger'
        };
        feedbackEl.className = `small ${classMap[tone] || classMap.muted}`;
        feedbackEl.textContent = message;
    }

    function focusInventorySearchInput() {
        setTimeout(() => {
            const input = document.getElementById('inventory-search-input');
            if (!input) return;
            if (_inventorySearchQuery && input.value !== _inventorySearchQuery) {
                input.value = _inventorySearchQuery;
            }
            try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
            input.focus();
            if (typeof input.select === 'function') input.select();
        }, 40);
    }

    function focusInventoryQuantityInput() {
        setTimeout(() => {
            const target = document.getElementById('inventory-more-copies-card');
            if (!target) return;
            try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
            if (typeof target.focus === 'function') target.focus();
        }, 40);
    }

    function focusInventoryCopySearchInput() {
        setTimeout(() => {
            const input = document.getElementById('inventory-copy-search-input');
            if (!input) return;
            input.focus();
            if (typeof input.select === 'function') input.select();
        }, 40);
    }

    function moveCaretToEnd(input) {
        if (!input) return;
        const value = String(input.value || '');
        const end = value.length;
        try {
            input.setSelectionRange(end, end);
        } catch (error) {}
    }

    function focusInventoryExtraCopyInput() {
        setTimeout(() => {
            const input = document.getElementById('inventory-extra-copy-input');
            if (!input) return;
            try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
            input.focus();
            moveCaretToEnd(input);
        }, 40);
    }

    function getSuggestedNextAcquisitionCode(value = '') {
        const raw = String(value || '').trim().toUpperCase();
        const match = raw.match(/^(.*?)(\d+)$/);
        if (!match) return '';
        const prefix = match[1] || '';
        const digits = match[2] || '';
        if (!digits) return '';
        const next = String(Number(digits) + 1).padStart(digits.length, '0');
        return `${prefix}${next}`;
    }

    function getInventoryCopySeedCode() {
        if (_inventoryPendingCopyCodes.length > 0) {
            return _inventoryPendingCopyCodes[_inventoryPendingCopyCodes.length - 1];
        }
        return normalizeInventoryAcquisitionCode(_inventorySelectedBook?.matchedAcquisition || _inventorySelectedBook?.adquisicion || document.getElementById('inventory-search-input')?.value || '');
    }

    function suggestNextInventoryCopyCode(seedCode = '') {
        setTimeout(() => {
            const input = document.getElementById('inventory-extra-copy-input');
            if (!input) return;
            const suggested = getSuggestedNextAcquisitionCode(seedCode || getInventoryCopySeedCode());
            if (suggested) {
                input.value = suggested;
            }
            try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
            input.focus();
            moveCaretToEnd(input);
        }, 40);
    }

    function formatSessionBadge(status) {
        if (status === 'active') return '<span class="badge rounded-pill text-bg-success">En curso</span>';
        if (status === 'paused') return '<span class="badge rounded-pill text-bg-warning text-dark">Pausado</span>';
        if (status === 'finished') return '<span class="badge rounded-pill text-bg-secondary">Finalizado</span>';
        return '<span class="badge rounded-pill text-bg-light text-dark">Sin iniciar</span>';
    }

    function formatInventoryDate(value) {
        if (!value) return '--';
        const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function renderInventoryTimelineItem(entry = {}, type = 'catalogo') {
        const iconClass = type === 'faltante' ? 'bi bi-exclamation-diamond-fill text-danger' : 'bi bi-book-fill text-success';
        const qty = Number(entry.totalObserved || entry.cantidad || entry.lastQuantity || 0) || 0;
        const subtitle = type === 'faltante'
            ? `Faltante registrado - ${qty} ejemplar(es)`
            : `${escapeHtml(entry.adquisicion || 'Sin adquisicion')} - ${qty} ejemplar(es)`;

        return `
            <div class="d-flex align-items-start gap-3 rounded-4 border bg-white p-3 shadow-sm">
                <div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style="width:42px;height:42px;">
                    <i class="${iconClass}"></i>
                </div>
                <div class="flex-grow-1 min-w-0">
                    <div class="fw-semibold text-dark text-break">${escapeHtml(entry.titulo || entry.displayName || 'Registro sin nombre')}</div>
                    <div class="small text-muted text-break">${subtitle}</div>
                </div>
            </div>
        `;
    }

    function getInventorySuggestedQuantity(book = {}) {
        return 1;
    }

    function setInventoryDraftQuantity(value) {
        const parsed = Math.max(1, Math.floor(Number(value) || 1));
        _inventoryDraftQuantity = parsed;
    }

    function setInventorySearchQuery(value = '') {
        _inventorySearchQuery = String(value || '');
    }

    function getInventoryLastEntryInline(entry = {}) {
        if (!entry?.adquisicion && !entry?.catalogAdquisicion && !entry?.query) return 'Sin capturas aun';
        const qty = Number(entry.cantidad) || 0;
        const acquisition = escapeHtml(entry.adquisicion || entry.catalogAdquisicion || entry.query || 'Sin adquisicion');
        if (entry.type === 'faltante') {
            return `${acquisition} (${qty} faltante${qty === 1 ? '' : 's'})`;
        }
        return `${acquisition} x${qty}`;
    }

    function syncModalScrollLock() {
        const hasOpenModal = Boolean(document.querySelector('.modal.show'));
        document.body.classList.toggle('modal-open', hasOpenModal);
        document.body.style.overflow = hasOpenModal ? 'hidden' : '';
        document.documentElement.style.overflow = hasOpenModal ? 'hidden' : '';
    }

    function sumInventoryObserved(entries = []) {
        return (entries || []).reduce((total, entry) => total + (Number(entry?.totalObserved || entry?.cantidad || entry?.lastQuantity || 0) || 0), 0);
    }

    function buildInventorySummary(session = {}, foundEntries = [], missingEntries = [], catalogSummary = null) {
        const systemTotal = Number(catalogSummary?.totalCopies) || 0;
        const registeredCatalog = sumInventoryObserved(foundEntries);
        const outsideCatalog = sumInventoryObserved(missingEntries);
        const totalCaptured = Number(session?.totalObserved) || (registeredCatalog + outsideCatalog);
        const estimatedMissing = Math.max(systemTotal - registeredCatalog, 0);
        const progress = systemTotal > 0
            ? Math.min(100, Math.max(0, Math.round((registeredCatalog / systemTotal) * 100)))
            : 0;

        return {
            systemTotal,
            registeredCatalog,
            outsideCatalog,
            totalCaptured,
            estimatedMissing,
            progress
        };
    }

    function getInventoryResolvedSummary(session = _inventorySession) {
        if (session?.summary) return session.summary;
        return buildInventorySummary(session, _inventoryFoundEntries, _inventoryMissingEntries, _inventoryCatalogSummary);
    }

    function formatInventorySummaryBadges(summary = {}) {
        const badges = [
            `<span class="badge text-bg-light border">${Number(summary.systemTotal) || 0} sistema</span>`,
            `<span class="badge text-bg-light border">${Number(summary.registeredCatalog) || 0} registrados</span>`,
            `<span class="badge text-bg-warning border">${Number(summary.estimatedMissing) || 0} faltan</span>`
        ];

        if (Number(summary.outsideCatalog) > 0) {
            badges.push(`<span class="badge text-bg-light border">${Number(summary.outsideCatalog) || 0} fuera de sistema</span>`);
        }

        return badges.join('');
    }

    async function resolveInventorySummaryForPdf(sessionId = '') {
        if (!_ctx) throw new Error('No hay contexto disponible para exportar.');

        let details = null;
        if (sessionId) {
            details = await BiblioService.getInventorySessionDetails(_ctx, sessionId, { includeLists: true });
        }

        if (!details?.session) {
            details = await BiblioService.getLatestFinishedInventorySession(_ctx, { includeLists: true });
        }

        if (!details?.session) {
            throw new Error('No hay un inventario cerrado para exportar.');
        }

        const catalogSummary = _inventoryCatalogSummary || await BiblioService.getInventoryCatalogSummary(_ctx);
        return {
            session: details.session,
            summary: details.session.summary || buildInventorySummary(details.session, details.foundEntries, details.missingEntries, catalogSummary),
            catalogSummary
        };
    }

    function normalizeInventoryAcquisitionCode(value) {
        return String(value || '').trim().toUpperCase();
    }

    function compareInventoryAcquisitionCodes(left = '', right = '') {
        return String(left || '').localeCompare(String(right || ''), 'es-MX', { numeric: true, sensitivity: 'base' });
    }

    function renderInventoryPendingCopyCodes() {
        if (!_inventoryPendingCopyCodes.length) {
            return '<div class="small text-muted">Sin copias agregadas.</div>';
        }

        return `
            <div class="d-flex flex-wrap gap-2">
                ${_inventoryPendingCopyCodes.map((code) => `<span class="badge text-bg-light border">${escapeHtml(code)}</span>`).join('')}
            </div>
        `;
    }

    function getFilteredInventoryReviewEntries() {
        const term = normalizeInventoryAcquisitionCode(_inventoryReviewSearchTerm || '');
        if (!term) return _inventoryFoundEntries.slice();
        return _inventoryFoundEntries.filter((entry) => {
            const acq = normalizeInventoryAcquisitionCode(entry?.adquisicion || entry?.catalogAdquisicion || '');
            return acq.includes(term);
        });
    }

    function getInventoryReviewTotalPages() {
        return Math.max(1, Math.ceil((getFilteredInventoryReviewEntries().length || 0) / 10));
    }

    function getInventoryReviewPageEntries() {
        const filtered = getFilteredInventoryReviewEntries();
        const page = Math.min(_inventoryReviewPage, getInventoryReviewTotalPages());
        const start = (page - 1) * 10;
        return filtered.slice(start, start + 10);
    }

    function formatInventoryReviewTitle(value = '') {
        const raw = String(value || '').trim();
        return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
    }

    function getInventoryReviewEntryById(entryId = '') {
        return _inventoryFoundEntries.find((entry) => String(entry?.id || '') === String(entryId || '')) || null;
    }

    function resetInventoryReviewEditor() {
        _inventoryReviewEditingId = '';
        _inventoryReviewDraftQuantity = 0;
        _inventoryReviewPendingCopyCodes = [];
        _inventoryReviewKnownCopies = [];
        _inventoryReviewCopiesLoading = false;
        stopInventoryReviewAdjust();
    }

    function getInventoryReviewEntryBaseCode(entry = null) {
        return normalizeInventoryAcquisitionCode(entry?.catalogAdquisicion || entry?.adquisicion || '');
    }

    function getInventoryReviewKnownCopyCodes(entry = null) {
        const baseCode = getInventoryReviewEntryBaseCode(entry);
        const known = Array.isArray(_inventoryReviewKnownCopies) ? _inventoryReviewKnownCopies : [];
        const merged = [...new Set([
            ...known.map((code) => normalizeInventoryAcquisitionCode(code)),
            baseCode
        ].filter(Boolean))];
        merged.sort(compareInventoryAcquisitionCodes);
        return merged;
    }

    function getInventoryReviewLastKnownCopy(entry = null) {
        const codes = getInventoryReviewKnownCopyCodes(entry);
        return codes[codes.length - 1] || '';
    }

    function renderInventoryReviewKnownCopies(entry = null) {
        const baseCode = getInventoryReviewEntryBaseCode(entry);
        const knownCodes = getInventoryReviewKnownCopyCodes(entry);
        const copyCodes = knownCodes.filter((code) => code !== baseCode);
        const suggestedCode = getSuggestedNextAcquisitionCode(getInventoryReviewSeedCode(entry));

        return `
            <div class="rounded-4 border bg-white p-3 d-grid gap-2">
                ${baseCode && (Number(_inventoryReviewDraftQuantity) || 0) > 0
                    ? `<div class="small text-muted">Base</div><div><span class="badge text-bg-light border">${escapeHtml(baseCode)}</span></div>`
                    : ''}
                ${_inventoryReviewCopiesLoading
                    ? '<div class="small text-muted">Cargando copias...</div>'
                    : copyCodes.length
                        ? `
                            <div class="small text-muted">Copias contempladas</div>
                            <div class="d-flex flex-wrap gap-2">
                                ${copyCodes.map((code) => `
                                    <button type="button" class="btn btn-sm btn-light border rounded-pill" onclick="AdminBiblio.removeInventoryReviewKnownCopyCode('${escapeHtml(code)}')">
                                        ${escapeHtml(code)} <span class="ms-1">x</span>
                                    </button>
                                `).join('')}
                            </div>
                        `
                        : '<div class="small text-muted">Sin copias extra contempladas en este registro.</div>'}
                ${suggestedCode ? `<div class="small text-muted">Siguiente sugerido: <span class="fw-semibold">${escapeHtml(suggestedCode)}</span></div>` : ''}
            </div>
        `;
    }

    function getInventoryReviewExplicitCount(entry = null) {
        const baseCount = (Number(_inventoryReviewDraftQuantity) || 0) > 0 ? 1 : 0;
        return baseCount + _inventoryReviewKnownCopies.length + _inventoryReviewPendingCopyCodes.length;
    }

    function getInventoryReviewMissingCodes(entry = null) {
        return Math.max(0, (Number(_inventoryReviewDraftQuantity) || 0) - getInventoryReviewExplicitCount(entry));
    }

    function canSaveInventoryReviewEdit(entry = null) {
        if ((Number(_inventoryReviewDraftQuantity) || 0) <= 0) return true;
        return getInventoryReviewMissingCodes(entry) === 0;
    }

    function renderInventoryReviewEditStatus(entry = null) {
        const missingCodes = getInventoryReviewMissingCodes(entry);
        if ((Number(_inventoryReviewDraftQuantity) || 0) <= 0) {
            return '<div class="small text-muted">Se eliminara este registro del inventario.</div>';
        }
        if (missingCodes > 0) {
            return `<div class="small text-danger">Faltan ${missingCodes} codigo(s) por capturar antes de guardar.</div>`;
        }
        return '<div class="small text-success">Cantidad y codigos listos para guardar.</div>';
    }

    function getInventoryReviewSeedCode(entry = null) {
        if (_inventoryReviewPendingCopyCodes.length > 0) {
            return _inventoryReviewPendingCopyCodes[_inventoryReviewPendingCopyCodes.length - 1];
        }
        return getInventoryReviewLastKnownCopy(entry) || getInventoryReviewEntryBaseCode(entry);
    }

    function focusInventoryReviewCopyInput(entry = null) {
        setTimeout(() => {
            const input = document.getElementById('inventory-review-copy-input');
            if (!input) return;
            const suggested = getSuggestedNextAcquisitionCode(getInventoryReviewSeedCode(entry));
            if (suggested && !String(input.value || '').trim()) {
                input.value = suggested;
            }
            input.focus();
            moveCaretToEnd(input);
        }, 40);
    }

    async function openInventoryReviewModal() {
        if (!_inventorySession?.id) return;

        const details = await BiblioService.getCurrentInventorySession(_ctx, { includeLists: true });
        _inventorySession = details?.session || _inventorySession;
        _inventoryFoundEntries = Array.isArray(details?.foundEntries) ? details.foundEntries : [];
        _inventoryReviewPage = 1;
        _inventoryReviewSearchTerm = '';
        resetInventoryReviewEditor();

        document.getElementById('inventory-review-modal')?.remove();
        const modalHtml = `
            <div class="modal fade" id="inventory-review-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" style="max-width:min(960px,calc(100vw - 1rem));margin:.5rem auto;">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0">
                            <div class="d-flex align-items-center gap-2 flex-wrap min-w-0">
                                <h5 class="mb-0">Revision</h5>
                                <span class="badge text-bg-light border" id="inventory-review-total-badge">${Number(_inventorySession?.totalObserved) || 0} registrados</span>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill" onclick="AdminBiblio.focusInventoryReviewSearch()">
                                    <i class="bi bi-search"></i>
                                </button>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                        </div>
                        <div class="modal-body pt-0 px-3 px-md-4" id="inventory-review-modal-body" style="max-height:min(78vh,780px);overflow:auto;">
                            <div class="position-sticky top-0 bg-white pb-2" style="z-index:2;">
                                <div class="input-group">
                                    <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                                    <input type="search" class="form-control" id="inventory-review-search-input" placeholder="Buscar por adquisicion" value="${escapeHtml(_inventoryReviewSearchTerm)}" oninput="AdminBiblio.setInventoryReviewSearch(this.value)" onkeydown="if(event.key === 'Escape'){ this.value=''; AdminBiblio.setInventoryReviewSearch(''); }">
                                </div>
                                <div class="small text-muted mt-2" id="inventory-review-results-count"></div>
                            </div>
                            <div class="d-grid gap-3" id="inventory-review-results"></div>
                            <div class="position-sticky bottom-0 bg-white pt-2 border-top mt-3" id="inventory-review-pagination"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-review-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => {
            syncModalScrollLock();
            renderInventoryReviewModalBody();
        }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => {
            stopInventoryReviewAdjust();
            modalEl.remove();
            syncModalScrollLock();
        }, { once: true });
        syncModalScrollLock();
        modal.show();
    }

    function renderInventoryReviewPendingCopyCodes() {
        if (!_inventoryReviewPendingCopyCodes.length) {
            return '<div class="small text-muted">Sin copias nuevas.</div>';
        }

        return `
            <div class="d-flex flex-wrap gap-2">
                ${_inventoryReviewPendingCopyCodes.map((code) => `
                    <button type="button" class="btn btn-sm btn-light border rounded-pill" onclick="AdminBiblio.removeInventoryReviewCopyCode('${escapeHtml(code)}')">
                        ${escapeHtml(code)} <span class="ms-1">x</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    function renderInventoryReviewModalBody() {
        const resultsEl = document.getElementById('inventory-review-results');
        const countEl = document.getElementById('inventory-review-results-count');
        const paginationEl = document.getElementById('inventory-review-pagination');
        const totalBadgeEl = document.getElementById('inventory-review-total-badge');
        if (!resultsEl || !countEl || !paginationEl) return;

        const entries = getInventoryReviewPageEntries();
        const totalPages = getInventoryReviewTotalPages();
        const totalFiltered = getFilteredInventoryReviewEntries().length;
        if (totalBadgeEl) totalBadgeEl.textContent = `${Number(_inventorySession?.totalObserved) || 0} registrados`;
        countEl.textContent = `${totalFiltered} resultado(s)`;
        resultsEl.innerHTML = entries.length ? entries.map((entry) => {
            const entryId = String(entry.id || '');
            return `
                <div class="rounded-4 border p-3">
                    <div class="d-flex align-items-start justify-content-between gap-3">
                        <div class="min-w-0">
                            <div class="fw-semibold text-dark">${escapeHtml(entry.adquisicion || entry.catalogAdquisicion || 'S/N')}</div>
                            <div class="small text-muted text-break">${escapeHtml(formatInventoryReviewTitle(entry.titulo || 'Sin titulo'))}</div>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-shrink-0">
                            <span class="badge text-bg-light border">${Number(entry.totalObserved) || 0} copias</span>
                            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill" onclick="AdminBiblio.startInventoryReviewEdit('${entryId}')">Editar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-muted small">No hay registros para esa busqueda.</div>';
        paginationEl.innerHTML = `
            <div class="d-flex align-items-center justify-content-between gap-2">
                <button type="button" class="btn btn-light rounded-pill" onclick="AdminBiblio.setInventoryReviewPage(${Math.max(1, _inventoryReviewPage - 1)})" ${_inventoryReviewPage <= 1 ? 'disabled' : ''}>Anterior</button>
                <div class="small text-muted text-center flex-grow-1">Pagina ${_inventoryReviewPage} de ${totalPages}</div>
                <button type="button" class="btn btn-light rounded-pill" onclick="AdminBiblio.setInventoryReviewPage(${Math.min(totalPages, _inventoryReviewPage + 1)})" ${_inventoryReviewPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
        `;
    }

    function setInventoryReviewSearch(value = '') {
        _inventoryReviewSearchTerm = normalizeInventoryAcquisitionCode(value || '');
        _inventoryReviewPage = 1;
        resetInventoryReviewEditor();
        renderInventoryReviewModalBody();
    }

    function focusInventoryReviewSearch() {
        setTimeout(() => {
            const input = document.getElementById('inventory-review-search-input');
            if (!input) return;
            input.focus();
            moveCaretToEnd(input);
        }, 40);
    }

    function setInventoryReviewPage(page = 1) {
        _inventoryReviewPage = Math.min(getInventoryReviewTotalPages(), Math.max(1, Number(page) || 1));
        resetInventoryReviewEditor();
        renderInventoryReviewModalBody();
    }

    function renderInventoryReviewEditModal() {
        const entry = getInventoryReviewEntryById(_inventoryReviewEditingId);
        const body = document.getElementById('inventory-review-edit-modal-body');
        if (!entry || !body) return;

        body.innerHTML = `
            <div class="d-grid gap-3">
                <div>
                    <div class="fw-semibold text-dark">${escapeHtml(entry.adquisicion || entry.catalogAdquisicion || 'S/N')}</div>
                    <div class="small text-muted text-break">${escapeHtml(entry.titulo || 'Sin titulo')}</div>
                </div>
                <div class="rounded-4 border p-3 d-grid gap-2">
                    <div class="small text-muted">Total del registro</div>
                    <div class="d-flex align-items-center justify-content-center gap-3">
                        <button type="button" class="btn btn-outline-secondary rounded-circle" style="width:44px;height:44px;" onpointerdown="AdminBiblio.startInventoryReviewAdjust(-1)" onpointerup="AdminBiblio.stopInventoryReviewAdjust()" onpointerleave="AdminBiblio.stopInventoryReviewAdjust()" onpointercancel="AdminBiblio.stopInventoryReviewAdjust()">-</button>
                        <div class="fw-bold fs-4 text-center" id="inventory-review-draft-quantity">${Math.max(0, Number(_inventoryReviewDraftQuantity) || 0)}</div>
                        <button type="button" class="btn btn-outline-secondary rounded-circle" style="width:44px;height:44px;" onpointerdown="AdminBiblio.startInventoryReviewAdjust(1)" onpointerup="AdminBiblio.stopInventoryReviewAdjust()" onpointerleave="AdminBiblio.stopInventoryReviewAdjust()" onpointercancel="AdminBiblio.stopInventoryReviewAdjust()">+</button>
                    </div>
                    <div id="inventory-review-edit-status">${renderInventoryReviewEditStatus(entry)}</div>
                </div>
                ${renderInventoryReviewKnownCopies(entry)}
                <div class="rounded-4 border bg-light p-3 d-grid gap-2">
                    <div class="small text-muted">Agregar copia nueva</div>
                    <div class="input-group">
                        <input type="search" class="form-control" id="inventory-review-copy-input" placeholder="No. adquisicion nueva copia" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.addInventoryReviewCopyCode(); }">
                        <button type="button" class="btn btn-primary fw-bold px-4" onclick="AdminBiblio.addInventoryReviewCopyCode()">+</button>
                    </div>
                    ${renderInventoryReviewPendingCopyCodes()}
                </div>
            </div>
        `;

        const saveBtn = document.getElementById('inventory-review-edit-save-btn');
        if (saveBtn) {
            saveBtn.disabled = _inventorySaving || !canSaveInventoryReviewEdit(entry);
            saveBtn.textContent = _inventorySaving ? 'Guardando...' : 'Guardar';
        }
    }

    function openInventoryReviewEditModal() {
        const entry = getInventoryReviewEntryById(_inventoryReviewEditingId);
        if (!entry) return;

        document.getElementById('inventory-review-edit-modal')?.remove();
        const modalHtml = `
            <div class="modal fade" id="inventory-review-edit-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered" style="max-width:min(560px,calc(100vw - 1rem));margin:.5rem auto;">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-2">
                            <h5 class="mb-0">Editar registro</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-0 px-3 px-md-4" id="inventory-review-edit-modal-body"></div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold" id="inventory-review-edit-save-btn" onclick="AdminBiblio.saveInventoryReviewEntry()">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-review-edit-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => {
            syncModalScrollLock();
            renderInventoryReviewEditModal();
        }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => {
            stopInventoryReviewAdjust();
            modalEl.remove();
            syncModalScrollLock();
            if (!_inventorySaving) {
                resetInventoryReviewEditor();
                renderInventoryReviewModalBody();
            }
        }, { once: true });
        syncModalScrollLock();
        modal.show();
    }

    function closeInventoryReviewEditModal({ preserveState = false } = {}) {
        const modalEl = document.getElementById('inventory-review-edit-modal');
        if (!modalEl) {
            if (!preserveState) {
                resetInventoryReviewEditor();
                renderInventoryReviewModalBody();
            }
            return;
        }
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (!preserveState) {
            resetInventoryReviewEditor();
            renderInventoryReviewModalBody();
        }
        modal?.hide();
    }

    async function startInventoryReviewEdit(entryId = '') {
        const entry = getInventoryReviewEntryById(entryId);
        if (!entry) return;
        _inventoryReviewEditingId = String(entryId || '');
        _inventoryReviewDraftQuantity = Math.max(0, Number(entry.totalObserved) || 0);
        _inventoryReviewPendingCopyCodes = [];
        _inventoryReviewKnownCopies = [];
        _inventoryReviewCopiesLoading = true;
        openInventoryReviewEditModal();

        try {
            const lookup = await BiblioService.findInventoryBookByCode(_ctx, {
                code: entry.catalogAdquisicion || entry.adquisicion || '',
                sessionId: _inventorySession?.id || ''
            });
            const baseCode = getInventoryReviewEntryBaseCode(entry);
            const relatedCodes = [...new Set((Array.isArray(lookup?.relatedAdquisiciones) ? lookup.relatedAdquisiciones : [])
                .map((code) => normalizeInventoryAcquisitionCode(code))
                .filter(Boolean))]
                .sort(compareInventoryAcquisitionCodes);
            const observedCodes = [...new Set((Array.isArray(entry?.observedAcquisitions) ? entry.observedAcquisitions : [])
                .map((code) => normalizeInventoryAcquisitionCode(code))
                .filter(Boolean))];

            let initialCodes = observedCodes;
            if (!initialCodes.length) {
                const maxCodes = Math.max(1, Number(entry.totalObserved) || 0);
                const fallbackCodes = [baseCode, ...relatedCodes.filter((code) => code !== baseCode)]
                    .filter(Boolean)
                    .slice(0, maxCodes);
                initialCodes = fallbackCodes;
            }

            _inventoryReviewKnownCopies = initialCodes
                .filter((code) => code && code !== baseCode)
                .sort(compareInventoryAcquisitionCodes);
        } catch (error) {
            console.warn('[BiblioAdmin] No se pudieron cargar las copias del registro en revision:', error);
            _inventoryReviewKnownCopies = [];
        } finally {
            _inventoryReviewCopiesLoading = false;
            if (_inventoryReviewEditingId === String(entryId || '')) {
                renderInventoryReviewEditModal();
            }
        }
    }

    function cancelInventoryReviewEdit() {
        closeInventoryReviewEditModal();
    }

    function adjustInventoryReviewQuantity(step = 0) {
        const numericStep = Math.trunc(Number(step) || 0);
        if (numericStep < 0) {
            for (let index = 0; index < Math.abs(numericStep); index += 1) {
                const currentValue = Math.max(0, Number(_inventoryReviewDraftQuantity) || 0);
                if (currentValue <= 0) break;
                const explicitCount = 1 + _inventoryReviewKnownCopies.length + _inventoryReviewPendingCopyCodes.length;
                if (currentValue > explicitCount) {
                    _inventoryReviewDraftQuantity = currentValue - 1;
                    continue;
                }
                if (_inventoryReviewPendingCopyCodes.length > 0) {
                    _inventoryReviewPendingCopyCodes = _inventoryReviewPendingCopyCodes.slice(0, -1);
                    _inventoryReviewDraftQuantity = currentValue - 1;
                    continue;
                }
                if (_inventoryReviewKnownCopies.length > 0) {
                    _inventoryReviewKnownCopies = _inventoryReviewKnownCopies.slice(0, -1);
                    _inventoryReviewDraftQuantity = currentValue - 1;
                    continue;
                }
                _inventoryReviewDraftQuantity = currentValue - 1;
            }
        } else if (numericStep > 0) {
            _inventoryReviewDraftQuantity = Math.max(0, Number(_inventoryReviewDraftQuantity) || 0) + numericStep;
        }
        const label = document.getElementById('inventory-review-draft-quantity');
        if (label) label.textContent = String(Math.max(0, Number(_inventoryReviewDraftQuantity) || 0));
        const entry = getInventoryReviewEntryById(_inventoryReviewEditingId);
        const statusEl = document.getElementById('inventory-review-edit-status');
        if (statusEl) statusEl.innerHTML = renderInventoryReviewEditStatus(entry);
        const saveBtn = document.getElementById('inventory-review-edit-save-btn');
        if (saveBtn) saveBtn.disabled = _inventorySaving || !canSaveInventoryReviewEdit(entry);
    }

    function startInventoryReviewAdjust(step = -1) {
        stopInventoryReviewAdjust();
        adjustInventoryReviewQuantity(step);
        _inventoryReviewAdjusting = true;
        _inventoryReviewAdjustInterval = setInterval(() => {
            adjustInventoryReviewQuantity(step);
        }, 120);
    }

    function stopInventoryReviewAdjust() {
        _inventoryReviewAdjusting = false;
        if (_inventoryReviewAdjustInterval) {
            clearInterval(_inventoryReviewAdjustInterval);
            _inventoryReviewAdjustInterval = null;
        }
    }

    function addInventoryReviewCopyCode() {
        const entry = getInventoryReviewEntryById(_inventoryReviewEditingId);
        if (!entry) return;

        const input = document.getElementById('inventory-review-copy-input');
        const rawCode = normalizeInventoryAcquisitionCode(input?.value || '');
        const baseCode = getInventoryReviewEntryBaseCode(entry);
        const knownCodes = getInventoryReviewKnownCopyCodes(entry);
        if (!rawCode) {
            showToast('Ingresa la adquisicion de la nueva copia.', 'warning');
            return;
        }
        if (rawCode === baseCode || knownCodes.includes(rawCode) || _inventoryReviewPendingCopyCodes.includes(rawCode)) {
            showToast('Ese numero ya esta en uso para este registro.', 'warning');
            return;
        }

        _inventoryReviewPendingCopyCodes = [..._inventoryReviewPendingCopyCodes, rawCode];
        _inventoryReviewDraftQuantity = Math.max(0, Number(_inventoryReviewDraftQuantity) || 0) + 1;
        renderInventoryReviewEditModal();
        focusInventoryReviewCopyInput(entry);
    }

    function removeInventoryReviewCopyCode(code = '') {
        _inventoryReviewPendingCopyCodes = _inventoryReviewPendingCopyCodes.filter((item) => item !== code);
        _inventoryReviewDraftQuantity = Math.max(0, (Number(_inventoryReviewDraftQuantity) || 0) - 1);
        renderInventoryReviewEditModal();
    }

    function removeInventoryReviewKnownCopyCode(code = '') {
        const normalized = normalizeInventoryAcquisitionCode(code);
        if (!normalized) return;
        _inventoryReviewKnownCopies = _inventoryReviewKnownCopies.filter((item) => item !== normalized);
        _inventoryReviewDraftQuantity = Math.max(0, (Number(_inventoryReviewDraftQuantity) || 0) - 1);
        renderInventoryReviewEditModal();
    }

    async function saveInventoryReviewEntry() {
        if (_inventorySaving || !_inventorySession?.id || !_inventoryReviewEditingId) return;

        const entry = getInventoryReviewEntryById(_inventoryReviewEditingId);
        const baseCode = getInventoryReviewEntryBaseCode(entry);
        const explicitCodes = [...new Set([
            (Number(_inventoryReviewDraftQuantity) || 0) > 0 ? baseCode : '',
            ..._inventoryReviewKnownCopies,
            ..._inventoryReviewPendingCopyCodes
        ].map((code) => normalizeInventoryAcquisitionCode(code)).filter(Boolean))];
        const missingCodes = Math.max(0, (Number(_inventoryReviewDraftQuantity) || 0) - explicitCodes.length);
        if (missingCodes > 0) {
            showToast(`Faltan ${missingCodes} codigo(s) por capturar para guardar.`, 'warning');
            renderInventoryReviewEditModal();
            return;
        }

        const previousEntries = _inventoryFoundEntries.slice();
        const previousSession = _inventorySession ? { ..._inventorySession } : null;
        const nextQuantity = Math.max(0, Number(_inventoryReviewDraftQuantity) || 0);
        const previousTotal = Number(entry?.totalObserved) || 0;
        const delta = nextQuantity - previousTotal;

        try {
            _inventorySaving = true;
            renderInventoryReviewEditModal();

            if (nextQuantity <= 0) {
                _inventoryFoundEntries = _inventoryFoundEntries.filter((item) => String(item?.id || '') !== String(_inventoryReviewEditingId || ''));
            } else {
                _inventoryFoundEntries = _inventoryFoundEntries.map((item) => {
                    if (String(item?.id || '') !== String(_inventoryReviewEditingId || '')) return item;
                    return {
                        ...item,
                        totalObserved: nextQuantity,
                        observedAcquisitions: explicitCodes,
                        updatedAtMs: Date.now()
                    };
                });
            }

            if (_inventorySession) {
                _inventorySession = {
                    ..._inventorySession,
                    totalObserved: Math.max(0, (Number(_inventorySession.totalObserved) || 0) + delta),
                    matchedItems: Math.max(0, (Number(_inventorySession.matchedItems) || 0) + (nextQuantity <= 0 ? -1 : 0)),
                    lastEntry: {
                        type: 'catalogo',
                        adquisicion: baseCode || entry?.adquisicion || '',
                        cantidad: nextQuantity,
                        atMs: Date.now()
                    }
                };
            }

            closeInventoryReviewEditModal({ preserveState: true });
            renderInventorySessionContent();
            renderInventoryReviewModalBody();

            const result = await BiblioService.reviewInventoryFoundEntry(_ctx, {
                sessionId: _inventorySession.id,
                entryId: _inventoryReviewEditingId,
                quantity: nextQuantity,
                addedAcquisitions: _inventoryReviewPendingCopyCodes,
                observedAcquisitions: explicitCodes
            });

            if (result?.deleted) {
                _inventoryFoundEntries = _inventoryFoundEntries.filter((item) => String(item?.id || '') !== String(_inventoryReviewEditingId || ''));
            } else if (result?.entry) {
                let replaced = false;
                _inventoryFoundEntries = _inventoryFoundEntries.map((item) => {
                    if (String(item?.id || '') !== String(result.entryId || _inventoryReviewEditingId || '')) return item;
                    replaced = true;
                    return { ...item, ...result.entry };
                });
                if (!replaced) {
                    _inventoryFoundEntries.unshift(result.entry);
                }
            }
            if (result?.session) {
                _inventorySession = { ...(_inventorySession || {}), ...result.session };
            }

            resetInventoryReviewEditor();
            renderInventorySessionContent();
            renderInventoryReviewModalBody();
            void ensureInventoryCatalogSummary(true)
                .then(() => renderInventorySessionContent())
                .catch((error) => console.warn('[BiblioAdmin] No se pudo refrescar el resumen del catalogo tras editar revision:', error));
            showToast('Registro actualizado.', 'success');
        } catch (error) {
            _inventoryFoundEntries = previousEntries;
            _inventorySession = previousSession;
            renderInventorySessionContent();
            renderInventoryReviewModalBody();
            showToast(error.message || 'No se pudo actualizar el registro.', 'danger');
        } finally {
            _inventorySaving = false;
            renderInventoryReviewModalBody();
        }
    }

    function renderInventorySelectedCard() {
        const selectedEl = document.getElementById('inventory-selection-card');
        if (!selectedEl) return;
        if (!_inventorySelectedBook) {
            selectedEl.innerHTML = '';
            return;
        }

        const duplicateMessage = _inventoryDuplicateSearch
            ? '<div class="small text-warning">Este libro ya fue guardado en este inventario. Si esta captura corresponde a otra copia, agrega su No. de adquisicion.</div>'
            : '';
        const canSave = _inventoryDuplicateSearch ? _inventoryPendingCopyCodes.length > 0 : true;
        const saveLabel = _inventorySaving ? 'Guardando...' : (_inventoryDuplicateSearch ? 'Guardar copia(s)' : 'Guardar');

        selectedEl.innerHTML = `
            <div class="card border-0 shadow-sm rounded-4 bg-success-subtle">
                <div class="card-body p-3">
                    <div class="d-flex flex-column gap-3">
                        <div>
                            <div class="fw-semibold text-dark lh-sm">${escapeHtml(_inventorySelectedBook.titulo || 'Sin titulo')}</div>
                            ${duplicateMessage}
                        </div>
                        <div class="d-grid gap-2">
                            <div class="rounded-4 border bg-white p-3" id="inventory-more-copies-card" tabindex="-1">
                                <div class="fw-semibold text-dark mb-2">¿Hay mas copias?</div>
                                <div class="d-flex gap-2">
                                    <button type="button" class="btn ${_inventoryMoreCopiesMode ? 'btn-outline-secondary' : 'btn-secondary'} rounded-pill fw-semibold flex-fill py-2" onclick="AdminBiblio.setInventoryMoreCopiesMode(false)">No</button>
                                    <button type="button" class="btn ${_inventoryMoreCopiesMode ? 'btn-primary' : 'btn-outline-primary'} rounded-pill fw-semibold flex-fill py-2" onclick="AdminBiblio.setInventoryMoreCopiesMode(true)">Si</button>
                                </div>
                            </div>
                            <div class="rounded-4 border bg-white p-2 d-none">
                                <div class="fw-semibold text-dark small mb-2">¿Hay mas copias?</div>
                                <div class="d-flex gap-2">
                                    <button type="button" class="btn ${_inventoryMoreCopiesMode ? 'btn-outline-secondary' : 'btn-secondary'} rounded-pill fw-semibold flex-fill" onclick="AdminBiblio.setInventoryMoreCopiesMode(false)">No</button>
                                    <button type="button" class="btn ${_inventoryMoreCopiesMode ? 'btn-primary' : 'btn-outline-primary'} rounded-pill fw-semibold flex-fill" onclick="AdminBiblio.setInventoryMoreCopiesMode(true)">Si</button>
                                </div>
                            </div>
                            ${_inventoryMoreCopiesMode ? `
                                <div class="rounded-4 border bg-white p-2" id="inventory-extra-copy-wrap">
                                    <div class="input-group mb-2">
                                        <input type="search" class="form-control" id="inventory-extra-copy-input" placeholder="No. adquisicion copia" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.addInventoryCopyCode(); }">
                                        <button type="button" class="btn btn-primary fw-bold px-4" onclick="AdminBiblio.addInventoryCopyCode()" ${_inventorySaving ? 'disabled' : ''}>+</button>
                                    </div>
                                    ${renderInventoryPendingCopyCodes()}
                                </div>
                            ` : ''}
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-success rounded-pill fw-bold flex-fill" onclick="AdminBiblio.registerInventoryMatch()" ${_inventorySaving || !canSave ? 'disabled' : ''}>
                                    <i class="bi bi-check2-circle me-2"></i>${saveLabel}
                                </button>
                                <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="AdminBiblio.clearInventoryFlow()">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderInventoryCopyResults() {
        const resultsEl = document.getElementById('inventory-copy-results');
        if (!resultsEl) return;

        if (!_inventoryAssociateMode) {
            resultsEl.innerHTML = '';
            return;
        }

        if (!_inventoryCopyLookupResults.length) {
            resultsEl.innerHTML = '<div class="small text-muted">Busca por titulo, autor o adquisicion del libro base.</div>';
            return;
        }

        resultsEl.innerHTML = _inventoryCopyLookupResults.map((book) => {
            const payload = encodeItemPayload(book);
            return `
                <button type="button" class="btn text-start w-100 border rounded-4 px-3 py-2 bg-white shadow-sm" onclick="AdminBiblio.selectInventoryCopyBase('${payload}')">
                    <div class="fw-semibold text-dark text-break">${escapeHtml(book.titulo || 'Sin titulo')}</div>
                    <div class="small text-muted text-break">${escapeHtml(book.autor || 'Autor no registrado')}</div>
                    <div class="small text-muted">Base: ${escapeHtml(book.adquisicion || 'S/N')}</div>
                </button>
            `;
        }).join('');
    }

    function renderInventoryCopySelectedBase() {
        const selectedEl = document.getElementById('inventory-copy-selected-base');
        if (!selectedEl) return;

        if (!_inventoryAssociateMode || !_inventorySelectedCopyBase) {
            selectedEl.innerHTML = '';
            return;
        }

        selectedEl.innerHTML = `
            <div class="rounded-4 border bg-light p-3">
                <div class="small text-success fw-bold text-uppercase mb-1">Copia asociada a</div>
                <div class="fw-semibold text-dark">${escapeHtml(_inventorySelectedCopyBase.titulo || 'Sin titulo')}</div>
                <div class="small text-muted">${escapeHtml(_inventorySelectedCopyBase.autor || 'Autor no registrado')}</div>
                <div class="small text-muted mt-1">Adquisicion base: ${escapeHtml(_inventorySelectedCopyBase.adquisicion || 'S/N')}</div>
            </div>
        `;
    }

    function renderInventorySessionContent() {
        const body = document.getElementById('modal-admin-body');
        if (!body) return;

        if (!_inventorySession) {
            body.innerHTML = `
                <div class="modal-header border-0 bg-dark text-white px-4 py-3">
                    <div class="d-flex align-items-center justify-content-between gap-3 w-100">
                        <h4 class="fw-bold mb-0"><i class="bi bi-clipboard2-data me-2"></i>Inventario</h4>
                        <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                </div>
                <div class="modal-body p-3 p-md-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                    <div class="card border-0 shadow-sm rounded-4">
                        <div class="card-body p-4 text-center">
                            <div class="small text-muted mb-2">Sin sesion activa</div>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold w-100" onclick="AdminBiblio.startInventorySession()">
                                <i class="bi bi-play-circle me-2"></i>Iniciar
                            </button>
                            <div class="small text-muted mt-3">Todo se guarda automaticamente.</div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const status = _inventorySession.status || 'active';
        const lastEntry = _inventorySession.lastEntry || null;
        const systemCopies = Number(_inventoryCatalogSummary?.totalCopies) || 0;
        const finalSummary = getInventoryResolvedSummary(_inventorySession);

        body.innerHTML = `
            <div class="modal-header border-0 bg-dark text-white px-4 py-3">
                <div class="d-flex align-items-center justify-content-between gap-3 w-100">
                    <div class="d-flex flex-wrap align-items-center gap-2 min-w-0">
                        <h4 class="fw-bold mb-0"><i class="bi bi-clipboard2-data me-2"></i>Inventario</h4>
                        ${formatSessionBadge(status)}
                    </div>
                    <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
            </div>
            <div class="modal-body p-3 p-md-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="card border-0 shadow-sm rounded-4 mb-3">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center justify-content-between gap-2 small flex-nowrap">
                            <span class="badge text-bg-light border flex-shrink-0">${systemCopies} sistema</span>
                            <div class="d-flex align-items-center gap-2 min-w-0">
                                <span class="badge text-bg-light border text-truncate" style="max-width:70%;">${getInventoryLastEntryInline(lastEntry)}</span>
                                ${status !== 'finished' ? `
                                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill flex-shrink-0" onclick="AdminBiblio.openInventoryReviewModal()">Revision</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                ${status !== 'finished' ? `
                    <div class="card border-0 shadow-sm rounded-4 mb-3">
                        <div class="card-body p-3">
                            <div class="d-grid gap-3">
                                <div>
                                    <div class="input-group input-group-lg mb-3">
                                        <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                                        <input type="search" class="form-control" id="inventory-search-input" placeholder="No. de adquisicion" value="${escapeHtml(_inventorySearchQuery)}" oninput="AdminBiblio.setInventorySearchQuery(this.value)" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.runInventorySearch(); }">
                                        <button type="button" class="btn btn-primary px-4" onclick="AdminBiblio.runInventorySearch()">Buscar</button>
                                    </div>
                                    <div id="inventory-search-feedback" class="small text-muted">Ingresa el No. de adquisicion y presiona Buscar.</div>
                                </div>
                                <div id="inventory-selection-card"></div>
                                <div id="inventory-missing-wrap" class="card border-0 shadow-sm rounded-4 d-none">
                                    <div class="card-body p-3">
                                        <div class="small text-danger fw-bold text-uppercase mb-2">No localizado</div>
                                        <div class="row g-2">
                                            <div class="col-12">
                                                <input type="text" class="form-control" id="inventory-missing-name" placeholder="Nombre del libro">
                                            </div>
                                            <div class="col-12 col-sm-6">
                                                <input type="number" min="1" step="1" class="form-control" id="inventory-missing-qty" value="1">
                                            </div>
                                            <div class="col-12 col-sm-6 d-grid">
                                                <button type="button" class="btn btn-danger rounded-pill fw-bold" onclick="AdminBiblio.registerInventoryMissing()">
                                                    <i class="bi bi-save2 me-2"></i>Guardar
                                                </button>
                                            </div>
                                            <div class="col-12 d-grid">
                                                <button type="button" class="btn btn-outline-primary rounded-pill fw-semibold" onclick="AdminBiblio.startInventoryCopyAssociation()">
                                                    <i class="bi bi-link-45deg me-2"></i>Asociar copia
                                                </button>
                                            </div>
                                            <div class="col-12 ${_inventoryAssociateMode ? '' : 'd-none'}" id="inventory-copy-association-wrap">
                                                <div class="rounded-4 border bg-primary-subtle p-3 mt-2">
                                                    <div class="input-group mb-2">
                                                        <input type="search" class="form-control" id="inventory-copy-search-input" placeholder="Libro base" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.searchInventoryCopyBase(); }">
                                                        <button type="button" class="btn btn-primary" onclick="AdminBiblio.searchInventoryCopyBase()">Buscar</button>
                                                    </div>
                                                    <div id="inventory-copy-results" class="d-grid gap-2 mb-2"></div>
                                                    <div id="inventory-copy-selected-base" class="mb-2"></div>
                                                    <div class="d-grid">
                                                        <button type="button" class="btn btn-primary rounded-pill fw-bold" onclick="AdminBiblio.registerInventoryAssociatedCopy()">
                                                            <i class="bi bi-node-plus me-2"></i>Guardar copia
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="card border-0 shadow-sm rounded-4">
                        <div class="card-body p-3 p-md-4">
                            <div class="fw-semibold text-dark mb-1">Inventario cerrado</div>
                            <div class="small text-muted mb-3">Resumen rapido sin listado detallado.</div>
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${formatInventorySummaryBadges(finalSummary)}
                            </div>
                            <div class="small text-muted mb-3">Avance final: ${Number(finalSummary.progress) || 0}% del catalogo confirmado.</div>
                            <div class="d-grid">
                                <button type="button" class="btn btn-dark rounded-pill fw-bold" onclick="AdminBiblio.downloadInventorySummaryPdf()">
                                    <i class="bi bi-file-earmark-pdf me-2"></i>Descargar PDF
                                </button>
                            </div>
                        </div>
                    </div>
                `}
            </div>
        `;

        renderInventorySelectedCard();
        renderInventorySearchFeedback();
        renderInventoryCopyResults();
        renderInventoryCopySelectedBase();
    }

    async function ensureInventoryCatalogSummary(forceReload = false) {
        if (!_ctx) return null;
        if (!forceReload && _inventoryCatalogSummary) return _inventoryCatalogSummary;
        _inventoryCatalogSummary = await BiblioService.getInventoryCatalogSummary(_ctx);
        return _inventoryCatalogSummary;
    }

    async function refreshInventorySession(includeLists = false) {
        const details = await BiblioService.getCurrentInventorySession(_ctx, { includeLists });
        _inventorySession = details.session;
        _inventoryFoundEntries = Array.isArray(details.foundEntries) ? details.foundEntries : [];
        _inventoryMissingEntries = Array.isArray(details.missingEntries) ? details.missingEntries : [];
        renderInventorySessionContent();
        if (_inventorySession?.status !== 'finished') {
            focusInventorySearchInput();
        }
    }

    async function abrirModalInventario(forceNewSession = false) {
        const { body } = getAdminModalConfig();
        if (!body) return;

        window.AdminBiblio.stopInventoryScanner?.();
        _inventoryScannerSupported = typeof window.BarcodeDetector !== 'undefined'
            && !!navigator.mediaDevices?.getUserMedia;

        body.innerHTML = `
            <div class="modal-header border-0 bg-dark text-white px-4 py-3">
                <div class="d-flex align-items-center justify-content-between gap-3 w-100">
                    <h4 class="fw-bold mb-0"><i class="bi bi-clipboard2-data me-2"></i>Inventario</h4>
                    <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
            </div>
            <div class="modal-body p-4 pb-5" style="padding-bottom:calc(5rem + env(safe-area-inset-bottom));">
                <div class="text-center text-muted py-5">
                    <span class="spinner-border spinner-border-sm me-2"></span>Cargando inventario...
                </div>
            </div>
        `;

        ensureInventoryModalVisibility();

        try {
            await ensureInventoryCatalogSummary(true);
            await BiblioService.preloadInventoryLookup(_ctx);

            if (forceNewSession) {
                const current = await BiblioService.getCurrentInventorySession(_ctx);
                if (current.session) {
                    _inventorySession = current.session;
                    _inventoryFoundEntries = current.foundEntries || [];
                    _inventoryMissingEntries = current.missingEntries || [];
                    renderInventorySessionContent();
                    showToast('Todavia hay una sesion abierta. Finalizala o pausala antes de iniciar otra.', 'warning');
                    return;
                }
            }

            await refreshInventorySession(false);
        } catch (error) {
            console.error('[BiblioAdmin] Error cargando inventario:', error);
            showToast(error.message || 'No se pudo abrir el inventario.', 'danger');
        }
    }

    async function startInventorySession() {
        try {
            await BiblioService.startInventorySession(_ctx);
            await refreshInventorySession(false);
            showToast('Sesion de inventario iniciada.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo iniciar el inventario.', 'danger');
        }
    }

    async function pauseInventorySession() {
        if (!_inventorySession?.id) return;
        try {
            await BiblioService.pauseInventorySession(_ctx, _inventorySession.id);
            await refreshInventorySession(false);
            showToast('Inventario pausado. Puedes retomarlo despues.', 'warning');
        } catch (error) {
            showToast(error.message || 'No se pudo pausar el inventario.', 'danger');
        }
    }

    async function resumeInventorySession() {
        if (!_inventorySession?.id) return;
        try {
            await BiblioService.resumeInventorySession(_ctx, _inventorySession.id);
            await refreshInventorySession(false);
            showToast('Inventario reanudado.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo reanudar el inventario.', 'danger');
        }
    }

    function confirmFinalizeInventorySession() {
        if (!_inventorySession?.id) return;
        showConfirmModal({
            icon: 'flag-fill',
            iconColor: '#212529',
            title: 'Finalizar inventario',
            message: 'Se cerrara la sesion actual y quedara listo el resumen final de faltantes y libros confirmados.',
            confirmText: 'Finalizar',
            confirmClass: 'btn-dark',
            onConfirm: async () => {
                const details = await BiblioService.finalizeInventorySession(_ctx, _inventorySession.id);
                _inventorySession = details.session;
                _inventoryFoundEntries = Array.isArray(details.foundEntries) ? details.foundEntries : [];
                _inventoryMissingEntries = Array.isArray(details.missingEntries) ? details.missingEntries : [];
                renderInventorySessionContent();
                showToast('Inventario finalizado.', 'success');
            }
        });
    }

    async function downloadInventorySummaryPdf(sessionId = '') {
        try {
            const { session, summary } = await resolveInventorySummaryForPdf(sessionId);
            if (!window.jspdf?.jsPDF) {
                throw new Error('El exportador PDF no esta disponible.');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'letter');
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 18;
            const contentWidth = pageWidth - (margin * 2);
            const title = session?.name || 'Resumen de inventario';
            const closedAt = session?.finishedAt?.toDate?.()
                || session?.updatedAt?.toDate?.()
                || session?.finishedAt
                || session?.updatedAt
                || null;
            const closedLabel = closedAt
                ? new Date(closedAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Sin fecha disponible';

            doc.setFillColor(33, 37, 41);
            doc.roundedRect(margin, 14, contentWidth, 28, 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('Inventario biblioteca', margin + 6, 25);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(title, margin + 6, 32);
            doc.text(`Cierre: ${closedLabel}`, margin + 6, 38);

            const metrics = [
                { label: 'En sistema', value: Number(summary.systemTotal) || 0, fill: [237, 242, 247] },
                { label: 'Registrados', value: Number(summary.registeredCatalog) || 0, fill: [224, 247, 232] },
                { label: 'Faltantes', value: Number(summary.estimatedMissing) || 0, fill: [255, 243, 205] },
                { label: 'Fuera de sistema', value: Number(summary.outsideCatalog) || 0, fill: [248, 249, 250] }
            ];

            const cardGap = 6;
            const cardWidth = (contentWidth - cardGap) / 2;
            let cursorY = 52;
            metrics.forEach((metric, index) => {
                const column = index % 2;
                const row = Math.floor(index / 2);
                const x = margin + (column * (cardWidth + cardGap));
                const y = cursorY + (row * 28);
                doc.setFillColor(...metric.fill);
                doc.roundedRect(x, y, cardWidth, 22, 4, 4, 'F');
                doc.setTextColor(60, 64, 67);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(metric.label, x + 4, y + 7);
                doc.setFontSize(18);
                doc.setTextColor(33, 37, 41);
                doc.text(String(metric.value), x + 4, y + 16);
            });

            cursorY += 62;
            const progress = Math.max(0, Math.min(100, Number(summary.progress) || 0));
            doc.setTextColor(33, 37, 41);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Comparacion principal', margin, cursorY);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`${Number(summary.registeredCatalog) || 0} registrados de ${Number(summary.systemTotal) || 0} esperados`, margin, cursorY + 7);
            doc.setFillColor(233, 236, 239);
            doc.roundedRect(margin, cursorY + 12, contentWidth, 8, 3, 3, 'F');
            doc.setFillColor(25, 135, 84);
            doc.roundedRect(margin, cursorY + 12, contentWidth * (progress / 100), 8, 3, 3, 'F');
            doc.setFontSize(10);
            doc.setTextColor(60, 64, 67);
            doc.text(`Avance final: ${progress}%`, margin, cursorY + 27);

            cursorY += 40;
            doc.setDrawColor(222, 226, 230);
            doc.line(margin, cursorY, margin + contentWidth, cursorY);
            cursorY += 10;
            doc.setFontSize(11);
            doc.setTextColor(33, 37, 41);
            doc.setFont('helvetica', 'bold');
            doc.text('Notas del resumen', margin, cursorY);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 85, 90);
            doc.text('- Registrados: ejemplares confirmados contra catalogo.', margin, cursorY + 8);
            doc.text('- Faltantes: diferencia estimada entre sistema y confirmados.', margin, cursorY + 15);
            doc.text('- Fuera de sistema: capturas que no existian en catalogo.', margin, cursorY + 22);

            const fileDate = new Date().toISOString().slice(0, 10);
            doc.save(`inventario-resumen-${fileDate}.pdf`);
            showToast('PDF de inventario generado.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo generar el PDF.', 'danger');
        }
    }

    async function runInventorySearch(showNotifications = true) {
        const input = document.getElementById('inventory-search-input');
        const query = input?.value?.trim() || '';
        _inventorySearchQuery = query;
        if (!_inventorySession?.id) {
            showToast('Primero inicia o reanuda una sesion de inventario.', 'warning');
            return;
        }
        if (!query) {
            showToast('Ingresa un numero de adquisicion para buscar.', 'warning');
            return;
        }

        renderInventorySearchFeedback('Buscando en catalogo...', 'muted');

        try {
            _inventorySelectedBook = await BiblioService.findInventoryBookByCode(_ctx, {
                sessionId: _inventorySession.id,
                code: query
            });
            _inventoryDuplicateSearch = Number(_inventorySelectedBook?.registeredObserved) > 0;
            _inventoryDraftQuantity = _inventorySelectedBook ? (_inventoryDuplicateSearch ? 0 : 1) : null;
            _inventoryMoreCopiesMode = false;
            _inventoryPendingCopyCodes = [];
            renderInventorySelectedCard();

            if (!_inventorySelectedBook) {
                const missingWrap = document.getElementById('inventory-missing-wrap');
                if (missingWrap) missingWrap.classList.add('d-none');
                renderInventorySearchFeedback('No esta registrado; posiblemente sea una copia o un libro nuevo.', 'warning');
                openInventoryUnregisteredModal(query);
                if (showNotifications) showToast('No esta registrado. Puedes agregarlo rapido.', 'warning');
                return;
            }

            const missingWrap = document.getElementById('inventory-missing-wrap');
            if (missingWrap) missingWrap.classList.add('d-none');
            renderInventorySearchFeedback(_inventoryDuplicateSearch
                ? 'Este libro ya fue guardado en este inventario. Si es otra copia, agrega su No. de adquisicion.'
                : '', _inventoryDuplicateSearch ? 'warning' : 'muted');
            focusInventoryQuantityInput();

            if (_inventorySelectedBook && showNotifications && !_inventoryDuplicateSearch) {
                showToast(`Libro localizado: ${_inventorySelectedBook.titulo || 'Sin titulo'}`, 'success');
            } else if (_inventoryDuplicateSearch && showNotifications) {
                showToast('Ese libro ya fue inventariado. Solo agrega nuevas copias si aplica.', 'warning');
            }
        } catch (error) {
            console.error('[BiblioAdmin] Error buscando inventario:', error);
            renderInventorySearchFeedback(error.message || 'No se pudo buscar.', 'danger');
            showToast(error.message || 'No se pudo buscar en inventario.', 'danger');
        }
    }

    function setInventoryMoreCopiesMode(enabled) {
        _inventoryMoreCopiesMode = enabled === true;
        if (!_inventoryMoreCopiesMode) {
            _inventoryPendingCopyCodes = [];
            _inventoryDraftQuantity = _inventoryDuplicateSearch ? 0 : 1;
        }
        renderInventorySelectedCard();
        if (_inventoryMoreCopiesMode) {
            suggestNextInventoryCopyCode();
        } else {
            focusInventoryQuantityInput();
        }
    }

    function addInventoryCopyCode() {
        if (!_inventorySelectedBook?.id) {
            showToast('Primero localiza el libro base.', 'warning');
            return;
        }

        const input = document.getElementById('inventory-extra-copy-input');
        const rawCode = normalizeInventoryAcquisitionCode(input?.value || '');
        const baseCode = normalizeInventoryAcquisitionCode(_inventorySelectedBook.matchedAcquisition || _inventorySelectedBook.adquisicion || '');

        if (!rawCode) {
            showToast('Ingresa la adquisicion de la copia.', 'warning');
            return;
        }
        if (rawCode === baseCode) {
            showToast('Ese numero ya corresponde al libro base.', 'warning');
            return;
        }
        if (_inventoryPendingCopyCodes.includes(rawCode)) {
            showToast('Esa copia ya fue agregada.', 'warning');
            return;
        }

        _inventoryPendingCopyCodes = [..._inventoryPendingCopyCodes, rawCode];
        _inventoryDraftQuantity = _inventoryDuplicateSearch
            ? _inventoryPendingCopyCodes.length
            : Math.max(1, _inventoryPendingCopyCodes.length + 1);
        if (input) {
            input.value = '';
        }
        renderInventorySelectedCard();
        suggestNextInventoryCopyCode(rawCode);
        showToast(`Copia agregada: ${rawCode}`, 'success');
    }

    function clearInventoryFlow() {
        const searchInput = document.getElementById('inventory-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        clearInventoryDraftUi();
        focusInventorySearchInput();
    }

    function openInventoryUnregisteredModal(acquisition = '') {
        const currentCode = normalizeInventoryAcquisitionCode(acquisition || document.getElementById('inventory-search-input')?.value || '');
        _inventoryUnregisteredMode = 'new';
        _inventoryUnregisteredCopyBase = null;
        document.getElementById('inventory-unregistered-modal')?.remove();

        const modalHtml = `
            <div class="modal fade" id="inventory-unregistered-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <div class="small text-uppercase fw-bold text-warning">No registrado</div>
                                <h6 class="mb-0 text-dark">Posible copia o libro nuevo</h6>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <div class="small text-muted mb-3">El codigo ${escapeHtml(currentCode || 'sin captura')} no existe en el sistema. Puede ser una copia o un libro nuevo.</div>
                            <div class="d-flex gap-2 mb-3">
                                <button type="button" class="btn btn-primary rounded-pill fw-semibold flex-fill" id="inventory-unregistered-mode-new" onclick="AdminBiblio.setInventoryUnregisteredMode('new')">Libro nuevo</button>
                                <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold flex-fill" id="inventory-unregistered-mode-copy" onclick="AdminBiblio.setInventoryUnregisteredMode('copy')">Es copia</button>
                            </div>
                            <div class="d-grid gap-2">
                                <input type="text" class="form-control" value="${escapeHtml(currentCode)}" disabled>
                            </div>
                            <div id="inventory-unregistered-new-fields" class="d-grid gap-2 mt-2">
                                <input type="text" class="form-control" id="inventory-unregistered-title" placeholder="Nombre">
                                <input type="text" class="form-control" id="inventory-unregistered-author" placeholder="Autor">
                                <input type="text" class="form-control" id="inventory-unregistered-classification" placeholder="Clasificacion">
                            </div>
                            <div id="inventory-unregistered-copy-fields" class="d-none mt-2">
                                <div class="input-group mb-2">
                                    <input type="search" class="form-control" id="inventory-unregistered-original-code" placeholder="Codigo del original" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.searchInventoryUnregisteredCopyBase(); }">
                                    <button type="button" class="btn btn-primary" onclick="AdminBiblio.searchInventoryUnregisteredCopyBase()">Buscar</button>
                                </div>
                                <div id="inventory-unregistered-copy-base"></div>
                            </div>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold" id="inventory-unregistered-save-btn" onclick="AdminBiblio.saveInventoryManualBook()">
                                Agregar
                            </button>
                            <button type="button" class="btn btn-primary rounded-pill fw-bold d-none" id="inventory-unregistered-copy-btn" onclick="AdminBiblio.saveInventoryUnregisteredCopy()">
                                Asociar copia
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-unregistered-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => {
            syncModalScrollLock();
        }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => {
            modalEl.remove();
            syncModalScrollLock();
        }, { once: true });
        syncModalScrollLock();
        modal.show();
        setInventoryUnregisteredMode('new');

        setTimeout(() => {
            const titleInput = document.getElementById('inventory-unregistered-title');
            if (titleInput) titleInput.focus();
        }, 80);
    }

    function closeInventoryUnregisteredModal() {
        const modalEl = document.getElementById('inventory-unregistered-modal');
        if (!modalEl) return;
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    function setInventoryUnregisteredMode(mode = 'new') {
        _inventoryUnregisteredMode = mode === 'copy' ? 'copy' : 'new';
        if (_inventoryUnregisteredMode !== 'copy') {
            _inventoryUnregisteredCopyBase = null;
        }

        const newFields = document.getElementById('inventory-unregistered-new-fields');
        const copyFields = document.getElementById('inventory-unregistered-copy-fields');
        const saveBtn = document.getElementById('inventory-unregistered-save-btn');
        const copyBtn = document.getElementById('inventory-unregistered-copy-btn');

        if (newFields) newFields.classList.toggle('d-none', _inventoryUnregisteredMode !== 'new');
        if (copyFields) copyFields.classList.toggle('d-none', _inventoryUnregisteredMode !== 'copy');
        if (saveBtn) saveBtn.classList.toggle('d-none', _inventoryUnregisteredMode !== 'new');
        if (copyBtn) copyBtn.classList.toggle('d-none', _inventoryUnregisteredMode !== 'copy');

        const newToggle = document.getElementById('inventory-unregistered-mode-new');
        const copyToggle = document.getElementById('inventory-unregistered-mode-copy');
        if (newToggle) newToggle.className = `btn ${_inventoryUnregisteredMode === 'new' ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill fw-semibold flex-fill`;
        if (copyToggle) copyToggle.className = `btn ${_inventoryUnregisteredMode === 'copy' ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill fw-semibold flex-fill`;

        renderInventoryUnregisteredCopyBase();
        setTimeout(() => {
            const target = _inventoryUnregisteredMode === 'copy'
                ? document.getElementById('inventory-unregistered-original-code')
                : document.getElementById('inventory-unregistered-title');
            if (target) target.focus();
        }, 40);
    }

    function renderInventoryUnregisteredCopyBase() {
        const target = document.getElementById('inventory-unregistered-copy-base');
        if (!target) return;

        if (!_inventoryUnregisteredCopyBase) {
            target.innerHTML = '<div class="small text-muted">Busca el codigo del libro original para asociarlo como copia.</div>';
            return;
        }

        target.innerHTML = `
            <div class="rounded-4 border bg-light p-2">
                <div class="small text-success fw-bold mb-1">Original encontrado</div>
                <div class="fw-semibold text-dark text-break">${escapeHtml(_inventoryUnregisteredCopyBase.titulo || 'Sin titulo')}</div>
                <div class="small text-muted">Base: ${escapeHtml(_inventoryUnregisteredCopyBase.adquisicion || _inventoryUnregisteredCopyBase.matchedAcquisition || 'S/N')}</div>
            </div>
        `;
    }

    async function searchInventoryUnregisteredCopyBase() {
        const originalCode = normalizeInventoryAcquisitionCode(document.getElementById('inventory-unregistered-original-code')?.value || '');
        if (!originalCode) {
            showToast('Ingresa el codigo del libro original.', 'warning');
            return;
        }

        try {
            const match = await BiblioService.findInventoryBookByCode(_ctx, {
                sessionId: _inventorySession?.id || '',
                code: originalCode
            });
            if (!match?.id) {
                _inventoryUnregisteredCopyBase = null;
                renderInventoryUnregisteredCopyBase();
                showToast('No se encontro el libro original.', 'warning');
                return;
            }

            _inventoryUnregisteredCopyBase = match;
            renderInventoryUnregisteredCopyBase();
            showToast('Libro original localizado.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo localizar el libro original.', 'danger');
        }
    }

    async function saveInventoryUnregisteredCopy() {
        if (_inventorySaving || !_inventorySession?.id) return;

        const acquisition = normalizeInventoryAcquisitionCode(document.getElementById('inventory-search-input')?.value || '');
        if (!acquisition) {
            showToast('Primero captura el numero de adquisicion.', 'warning');
            return;
        }
        if (!_inventoryUnregisteredCopyBase?.id) {
            showToast('Primero localiza el libro original.', 'warning');
            return;
        }

        const saveBtn = document.getElementById('inventory-unregistered-copy-btn');

        try {
            _inventorySaving = true;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Asociando...';
            }

            await BiblioService.registerInventoryAssociatedCopy(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                baseBookId: _inventoryUnregisteredCopyBase.id,
                quantity: 1
            });

            await ensureInventoryCatalogSummary(true);
            await BiblioService.preloadInventoryLookup(_ctx);
            await refreshInventorySession(false);
            closeInventoryUnregisteredModal();
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) searchInput.value = '';
            focusInventorySearchInput();
            showToast('Copia asociada al original y guardada en inventario.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo asociar la copia.', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    async function saveInventoryManualBook() {
        if (_inventorySaving || !_inventorySession?.id) return;

        const acquisition = normalizeInventoryAcquisitionCode(document.getElementById('inventory-search-input')?.value || '');
        const title = String(document.getElementById('inventory-unregistered-title')?.value || '').trim();
        const author = String(document.getElementById('inventory-unregistered-author')?.value || '').trim();
        const classification = String(document.getElementById('inventory-unregistered-classification')?.value || '').trim();

        if (!acquisition) {
            showToast('Primero captura el numero de adquisicion.', 'warning');
            return;
        }
        if (!title) {
            showToast('Escribe el nombre del libro.', 'warning');
            return;
        }

        const saveBtn = document.getElementById('inventory-unregistered-save-btn');

        try {
            _inventorySaving = true;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando...';
            }

            const details = await BiblioService.registerInventoryManualBook(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                title,
                author,
                classification
            });

            closeInventoryUnregisteredModal();
            clearInventoryDraftUi();
            await ensureInventoryCatalogSummary(true);
            await BiblioService.preloadInventoryLookup(_ctx);
            renderInventorySessionContent();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) searchInput.value = acquisition;
            await runInventorySearch(false);
            showToast('Libro agregado al catalogo. Ahora puedes inventariarlo.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo agregar el libro.', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    function showInventoryMissingForm() {
        const query = document.getElementById('inventory-search-input')?.value?.trim() || '';
        const missingWrap = document.getElementById('inventory-missing-wrap');
        const missingName = document.getElementById('inventory-missing-name');
        if (!missingWrap || !missingName) return;
        missingWrap.classList.remove('d-none');
        if (!missingName.value.trim()) missingName.value = query;
        missingName.focus();
        _inventoryAssociateMode = false;
        _inventoryCopyLookupResults = [];
        _inventorySelectedCopyBase = null;
        _inventoryMoreCopiesMode = false;
        _inventoryPendingCopyCodes = [];
        _inventorySelectedBook = null;
        renderInventorySelectedCard();
        renderInventoryCopyResults();
        renderInventoryCopySelectedBase();
    }

    function startInventoryCopyAssociation() {
        const missingWrap = document.getElementById('inventory-missing-wrap');
        if (missingWrap) missingWrap.classList.remove('d-none');
        _inventoryAssociateMode = true;
        _inventoryCopyLookupResults = [];
        _inventorySelectedCopyBase = null;
        renderInventoryCopyResults();
        renderInventoryCopySelectedBase();
        focusInventoryCopySearchInput();
    }

    async function searchInventoryCopyBase() {
        const term = document.getElementById('inventory-copy-search-input')?.value?.trim() || '';
        if (!term) {
            showToast('Escribe el libro base para buscarlo.', 'warning');
            return;
        }

        try {
            _inventoryCopyLookupResults = await BiblioService.searchCatalogoAdmin(_ctx, term, 6);
            _inventorySelectedCopyBase = null;
            renderInventoryCopyResults();
            renderInventoryCopySelectedBase();
            if (!_inventoryCopyLookupResults.length) {
                showToast('No se encontraron libros base con esa busqueda.', 'warning');
            }
        } catch (error) {
            showToast(error.message || 'No se pudo buscar el libro base.', 'danger');
        }
    }

    function selectInventoryCopyBase(payload) {
        const book = decodeItemPayload(payload);
        if (!book) return;
        _inventorySelectedCopyBase = book;
        renderInventoryCopySelectedBase();
    }

    async function registerInventoryAssociatedCopy() {
        if (!_inventorySession?.id) {
            showToast('Primero inicia o reanuda una sesion de inventario.', 'warning');
            return;
        }

        const acquisition = document.getElementById('inventory-search-input')?.value?.trim() || '';
        if (!acquisition) {
            showToast('Escanea o escribe primero la adquisicion que falta.', 'warning');
            return;
        }
        if (!_inventorySelectedCopyBase?.id) {
            showToast('Selecciona el libro base al que pertenece la copia.', 'warning');
            return;
        }

        try {
            await BiblioService.registerInventoryAssociatedCopy(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                baseBookId: _inventorySelectedCopyBase.id,
                quantity: 1
            });
            await ensureInventoryCatalogSummary(true);
            await BiblioService.preloadInventoryLookup(_ctx);
            await refreshInventorySession(false);
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            focusInventorySearchInput();
            showToast('La copia fue creada, agrupada y registrada en inventario.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo asociar la copia.', 'danger');
        }
    }

    async function registerInventoryMatch() {
        if (_inventorySaving) return;
        if (!_inventorySession?.id || !_inventorySelectedBook?.id) {
            showToast('Selecciona un libro antes de registrar.', 'warning');
            return;
        }
        if (_inventoryDuplicateSearch && _inventoryPendingCopyCodes.length < 1) {
            showToast('Ese libro ya fue guardado. Agrega una copia nueva para continuar.', 'warning');
            return;
        }

        const query = document.getElementById('inventory-search-input')?.value?.trim() || '';
        const quantity = Math.max(1, Number(_inventoryDraftQuantity || getInventorySuggestedQuantity(_inventorySelectedBook)) || 1);

        try {
            _inventorySaving = true;
            renderInventorySelectedCard();
            let copySyncResult = null;
            if (_inventoryPendingCopyCodes.length > 0) {
                copySyncResult = await BiblioService.syncInventoryCopyAcquisitions(_ctx, {
                    baseBookId: _inventorySelectedBook.id,
                    acquisitions: _inventoryPendingCopyCodes
                });
                if (_inventoryCatalogSummary && Number(copySyncResult?.created) > 0) {
                    _inventoryCatalogSummary = {
                        ..._inventoryCatalogSummary,
                        totalCopies: (Number(_inventoryCatalogSummary.totalCopies) || 0) + Number(copySyncResult.created || 0)
                    };
                }
            }

            const details = await BiblioService.registerInventoryMatch(_ctx, {
                sessionId: _inventorySession.id,
                bookId: _inventorySelectedBook.id,
                groupKey: _inventorySelectedBook.groupKey,
                systemTotal: _inventorySelectedBook.systemTotal,
                groupSize: _inventorySelectedBook.groupSize,
                matchedAcquisition: _inventorySelectedBook.matchedAcquisition || query,
                quantity,
                query
            });
            _inventorySession = details?.session || _inventorySession;
            renderInventorySessionContent();
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            focusInventorySearchInput();
            showToast('Registro guardado.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar el libro inventariado.', 'danger');
        } finally {
            _inventorySaving = false;
            if (_inventorySelectedBook) renderInventorySelectedCard();
        }
    }

    async function registerInventoryMissing() {
        if (!_inventorySession?.id) {
            showToast('Primero inicia o reanuda una sesion de inventario.', 'warning');
            return;
        }

        const query = document.getElementById('inventory-search-input')?.value?.trim() || '';
        const title = document.getElementById('inventory-missing-name')?.value?.trim() || '';
        const quantity = Number(document.getElementById('inventory-missing-qty')?.value || 1);

        try {
            const details = await BiblioService.registerInventoryMissing(_ctx, {
                sessionId: _inventorySession.id,
                query,
                title,
                quantity
            });
            _inventorySession = details?.session || _inventorySession;
            renderInventorySessionContent();
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            focusInventorySearchInput();
            showToast('Faltante agregado al inventario.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo guardar el faltante.', 'danger');
        }
    }

    async function toggleInventoryScanner() {
        if (_inventoryScannerActive) {
            stopInventoryScanner();
            renderInventorySessionContent();
            return;
        }

        if (!_inventoryScannerSupported) {
            showToast('El escaner no esta disponible en este navegador.', 'warning');
            return;
        }

        try {
            _inventoryDetector = new window.BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
            });
            _inventoryScannerStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false
            });
            _inventoryScannerActive = true;
            renderInventorySessionContent();

            const video = document.getElementById('inventory-scanner-video');
            if (!video) return;
            video.srcObject = _inventoryScannerStream;
            await video.play();
            queueInventoryScannerLoop();
        } catch (error) {
            console.error('[BiblioAdmin] Error iniciando escaner:', error);
            stopInventoryScanner();
            renderInventorySessionContent();
            showToast('No se pudo abrir la camara para escanear.', 'danger');
        }
    }

    function queueInventoryScannerLoop() {
        if (!_inventoryScannerActive) return;
        if (_inventoryScannerLoopId) {
            clearTimeout(_inventoryScannerLoopId);
            _inventoryScannerLoopId = null;
        }
        _inventoryScannerLoopId = setTimeout(() => {
            void scanInventoryFrame();
        }, 260);
    }

    async function scanInventoryFrame() {
        if (!_inventoryScannerActive || !_inventoryDetector) return;
        const video = document.getElementById('inventory-scanner-video');
        if (!video) {
            queueInventoryScannerLoop();
            return;
        }

        try {
            const detections = await _inventoryDetector.detect(video);
            const code = detections?.[0]?.rawValue || '';
            if (code) {
                stopInventoryScanner();
                renderInventorySessionContent();
                const input = document.getElementById('inventory-search-input');
                if (input) input.value = code;
                await runInventorySearch(true);
                return;
            }
        } catch (error) {
            console.warn('[BiblioAdmin] Fallo lectura de codigo:', error);
        }

        queueInventoryScannerLoop();
    }

    function stopInventoryScanner() {
        if (_inventoryScannerLoopId) {
            clearTimeout(_inventoryScannerLoopId);
            _inventoryScannerLoopId = null;
        }
        if (_inventoryScannerStream) {
            _inventoryScannerStream.getTracks().forEach((track) => {
                try { track.stop(); } catch (error) { console.warn('[BiblioAdmin] Error deteniendo camara:', error); }
            });
            _inventoryScannerStream = null;
        }
        _inventoryScannerActive = false;
        const video = document.getElementById('inventory-scanner-video');
        if (video) video.srcObject = null;
    }

    const api = {
        abrirModalInventario: withState(abrirModalInventario),
        startInventorySession: withState(startInventorySession),
        pauseInventorySession: withState(pauseInventorySession),
        resumeInventorySession: withState(resumeInventorySession),
        confirmFinalizeInventorySession: withState(confirmFinalizeInventorySession),
        downloadInventorySummaryPdf: withState(downloadInventorySummaryPdf),
        runInventorySearch: withState(runInventorySearch),
        openInventoryReviewModal: withState(openInventoryReviewModal),
        setInventoryReviewPage: withState(setInventoryReviewPage),
        setInventoryReviewSearch: withState(setInventoryReviewSearch),
        focusInventoryReviewSearch: withState(focusInventoryReviewSearch),
        startInventoryReviewEdit: withState(startInventoryReviewEdit),
        cancelInventoryReviewEdit: withState(cancelInventoryReviewEdit),
        startInventoryReviewAdjust: withState(startInventoryReviewAdjust),
        stopInventoryReviewAdjust: withState(stopInventoryReviewAdjust),
        addInventoryReviewCopyCode: withState(addInventoryReviewCopyCode),
        removeInventoryReviewKnownCopyCode: withState(removeInventoryReviewKnownCopyCode),
        removeInventoryReviewCopyCode: withState(removeInventoryReviewCopyCode),
        saveInventoryReviewEntry: withState(saveInventoryReviewEntry),
        setInventorySearchQuery: withState(setInventorySearchQuery),
        setInventoryDraftQuantity: withState(setInventoryDraftQuantity),
        setInventoryMoreCopiesMode: withState(setInventoryMoreCopiesMode),
        addInventoryCopyCode: withState(addInventoryCopyCode),
        clearInventoryFlow: withState(clearInventoryFlow),
        setInventoryUnregisteredMode: withState(setInventoryUnregisteredMode),
        searchInventoryUnregisteredCopyBase: withState(searchInventoryUnregisteredCopyBase),
        saveInventoryManualBook: withState(saveInventoryManualBook),
        saveInventoryUnregisteredCopy: withState(saveInventoryUnregisteredCopy),
        showInventoryMissingForm: withState(showInventoryMissingForm),
        startInventoryCopyAssociation: withState(startInventoryCopyAssociation),
        searchInventoryCopyBase: withState(searchInventoryCopyBase),
        selectInventoryCopyBase: withState(selectInventoryCopyBase),
        registerInventoryAssociatedCopy: withState(registerInventoryAssociatedCopy),
        registerInventoryMatch: withState(registerInventoryMatch),
        registerInventoryMissing: withState(registerInventoryMissing),
        toggleInventoryScanner: withState(toggleInventoryScanner),
        stopInventoryScanner: withState(stopInventoryScanner)
    };

    Object.assign(window.AdminBiblio, api);
    return api;
})();
