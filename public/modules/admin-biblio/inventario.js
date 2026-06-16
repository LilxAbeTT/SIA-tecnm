if (!window.AdminBiblio) window.AdminBiblio = {};
window.AdminBiblio.State = window.AdminBiblio.State || {};
window.AdminBiblio.Inventario = (function () {
    const state = window.AdminBiblio.State;
    let _ctx = null;
    let _inventorySession = null;
    let _inventoryCatalogSummary = null;
    let _inventoryFoundEntries = [];
    let _inventoryMissingEntries = [];
    let _inventoryListsHydrated = false;
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
    let _inventoryCategories = [];
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
    let _inventoryHistoryList = [];
    let _inventoryHistoryLoading = false;
    let _inventoryHistoryPage = 1;
    let _inventoryReactivating = false;

    function syncFromState() {
        _ctx = state.ctx;
        _inventorySession = state.inventorySession || null;
        _inventoryCatalogSummary = state.inventoryCatalogSummary || null;
        _inventoryFoundEntries = Array.isArray(state.inventoryFoundEntries) ? state.inventoryFoundEntries.slice() : [];
        _inventoryMissingEntries = Array.isArray(state.inventoryMissingEntries) ? state.inventoryMissingEntries.slice() : [];
        _inventoryListsHydrated = state.inventoryListsHydrated === true;
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
        state.inventoryListsHydrated = _inventoryListsHydrated === true;
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
    function showPromptModal(...args) { return shared.showPromptModal(...args); }

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
                        state.inventorySession = details?.session
                            ? { ...activeSession, ...details.session }
                            : activeSession;
                    }
                } catch (error) {

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

    function sortLocalInventoryEntries(entries = []) {
        return [...(entries || [])].sort((left, right) => {
            const leftTime = Number(left?.updatedAtMs || left?.createdAtMs || 0);
            const rightTime = Number(right?.updatedAtMs || right?.createdAtMs || 0);
            return rightTime - leftTime;
        });
    }

    function upsertInventoryFoundEntry(entry = null) {
        if (!entry?.id) return;
        const nextEntries = (_inventoryFoundEntries || []).filter((item) => String(item?.id || '') !== String(entry.id || ''));
        nextEntries.unshift(entry);
        _inventoryFoundEntries = sortLocalInventoryEntries(nextEntries);
        _inventoryListsHydrated = true;
    }

    function upsertInventoryMissingEntry(entry = null) {
        if (!entry?.id) return;
        const nextEntries = (_inventoryMissingEntries || []).filter((item) => String(item?.id || '') !== String(entry.id || ''));
        nextEntries.unshift(entry);
        _inventoryMissingEntries = sortLocalInventoryEntries(nextEntries);
        _inventoryListsHydrated = true;
    }

    function findLocalInventoryObservedEntry(book = null) {
        if (!book?.id && !book?.groupKey) return null;
        return (_inventoryFoundEntries || []).find((entry) => {
            if (book.id && String(entry?.id || '') === String(book.id || '')) return true;
            return book.groupKey && entry?.groupKey && String(entry.groupKey) === String(book.groupKey);
        }) || null;
    }

    function buildInventorySummary(session = {}, foundEntries = [], missingEntries = [], catalogSummary = null) {
        const systemTotal = Number(catalogSummary?.totalCopies) || 0;

        const catalogFound = (foundEntries || []).filter(e => e.type !== 'material');
        const materialFound = (foundEntries || []).filter(e => e.type === 'material');

        const registeredCatalog = sumInventoryObserved(catalogFound);
        const outsideCatalog = sumInventoryObserved(missingEntries);
        const extraMaterials = sumInventoryObserved(materialFound);

        const totalCaptured = Number(session?.totalObserved) || (registeredCatalog + outsideCatalog + extraMaterials);
        const estimatedMissing = Math.max(systemTotal - registeredCatalog, 0);
        const progress = systemTotal > 0
            ? Math.min(100, Math.max(0, Math.round((registeredCatalog / systemTotal) * 100)))
            : 0;

        return {
            systemTotal,
            registeredCatalog,
            outsideCatalog,
            extraMaterials,
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
        // Bug fix: systemTotal can be 0 if catalog lookup wasn't cached; use observed totals instead
        const registered = Number(summary.registeredCatalog) || 0;
        const outside = Number(summary.outsideCatalog) || 0;
        const materials = Number(summary.extraMaterials) || 0;
        const total = Number(summary.totalCaptured) || (registered + outside + materials);

        const badges = [
            `<span class="badge text-bg-success-subtle border border-success-subtle text-success-emphasis">${total} total observado</span>`,
            `<span class="badge text-bg-light border">${registered} en catalogo</span>`
        ];

        if (outside > 0) {
            badges.push(`<span class="badge text-bg-light border">${outside} fuera de sistema</span>`);
        }
        if (materials > 0) {
            badges.push(`<span class="badge text-bg-light border">${materials} otros materiales</span>`);
        }

        return badges.join('');
    }

    async function resolveInventorySummaryForPdf(sessionId = '') {
        if (!_ctx) throw new Error('No hay contexto disponible para exportar.');

        let details = null;
        if (sessionId) {
            details = await BiblioService.getInventorySessionDetails(_ctx, sessionId);
        }

        if (!details?.session) {
            details = await BiblioService.getLatestFinishedInventorySession(_ctx);
        }

        if (!details?.session) {
            throw new Error('No hay un inventario cerrado para exportar.');
        }

        if (!details.session.summary) {
            details = sessionId
                ? await BiblioService.getInventorySessionDetails(_ctx, details.session.id, { includeLists: true })
                : await BiblioService.getLatestFinishedInventorySession(_ctx, { includeLists: true });
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

        const needsRemoteLoad = !_inventoryFoundEntries.length && Number(_inventorySession?.matchedItems || 0) > 0;
        if (needsRemoteLoad) {
            const details = await BiblioService.getCurrentInventorySession(_ctx, { includeLists: true });
            _inventorySession = details?.session || _inventorySession;
            _inventoryFoundEntries = Array.isArray(details?.foundEntries) ? details.foundEntries : [];
        }
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
                code: entry.catalogAdquisicion || entry.adquisicion || ''
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
            resultsEl.innerHTML = '<div class="small text-muted">Ingresa el No. de adquisicion del libro base.</div>';
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
                            <button type="button" class="btn btn-primary rounded-pill fw-bold w-100 mb-2" onclick="AdminBiblio.startInventorySession()">
                                <i class="bi bi-play-circle me-2"></i>Iniciar
                            </button>
                            <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold w-100" onclick="AdminBiblio.openInventoryHistoryModal()">
                                <i class="bi bi-clock-history me-2"></i>Historial de inventarios
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
                                <div class="mt-4 border-top pt-3 text-center">
                                    <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="AdminBiblio.openOtherMaterialsModal()">
                                        <i class="bi bi-collection me-2"></i>Agregar otro material...
                                    </button>
                                </div>
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
                                                        <input type="search" class="form-control" id="inventory-copy-search-input" placeholder="No. adquisicion base" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); AdminBiblio.searchInventoryCopyBase(); }">
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
                    <div class="card border-0 shadow-sm rounded-4 mb-3">
                        <div class="card-body p-3 p-md-4">
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 bg-success-subtle" style="width:40px;height:40px;">
                                    <i class="bi bi-check-circle-fill text-success fs-5"></i>
                                </div>
                                <div>
                                    <div class="fw-bold text-dark lh-sm">Inventario cerrado</div>
                                    <div class="small text-muted">${formatInventoryDate(_inventorySession.finishedAt || _inventorySession.updatedAt)}</div>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${formatInventorySummaryBadges(finalSummary)}
                            </div>
                            <div class="mb-3">
                                <div class="d-flex justify-content-between small text-muted mb-1">
                                    <span>Avance final</span>
                                    <span class="fw-semibold">${Number(finalSummary.progress) || 0}%</span>
                                </div>
                                <div class="rounded-pill bg-light overflow-hidden" style="height:8px;">
                                    <div class="rounded-pill bg-success h-100" style="width:${Number(finalSummary.progress) || 0}%;"></div>
                                </div>
                            </div>
                            <div class="d-grid gap-2">
                                <button type="button" class="btn btn-dark rounded-pill fw-bold" onclick="AdminBiblio.openInventoryPdfOptionsModal('${_inventorySession.id}')">
                                    <i class="bi bi-file-earmark-pdf me-2"></i>Exportar PDF
                                </button>
                                <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold" onclick="AdminBiblio.openInventoryHistoryModal()">
                                    <i class="bi bi-clock-history me-2"></i>Ver historial de inventarios
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
        if (includeLists) {
            _inventoryFoundEntries = Array.isArray(details.foundEntries) ? details.foundEntries : [];
            _inventoryMissingEntries = Array.isArray(details.missingEntries) ? details.missingEntries : [];
            _inventoryListsHydrated = true;
        } else if (!_inventorySession) {
            _inventoryFoundEntries = [];
            _inventoryMissingEntries = [];
            _inventoryListsHydrated = false;
        }
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

            await refreshInventorySession(true);
        } catch (error) {
            console.error('[BiblioAdmin] Error cargando inventario:', error);
            showToast(error.message || 'No se pudo abrir el inventario.', 'danger');
        }
    }

    async function startInventorySession() {
        try {
            const details = await BiblioService.startInventorySession(_ctx);
            _inventorySession = details?.session || null;
            _inventoryFoundEntries = [];
            _inventoryMissingEntries = [];
            _inventoryListsHydrated = true;
            renderInventorySessionContent();
            focusInventorySearchInput();
            showToast('Sesion de inventario iniciada.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo iniciar el inventario.', 'danger');
        }
    }

    async function pauseInventorySession() {
        if (!_inventorySession?.id) return;
        try {
            const details = await BiblioService.pauseInventorySession(_ctx, _inventorySession.id);
            _inventorySession = { ...(_inventorySession || {}), ...(details?.session || {}) };
            renderInventorySessionContent();
            showToast('Inventario pausado. Puedes retomarlo despues.', 'warning');
        } catch (error) {
            showToast(error.message || 'No se pudo pausar el inventario.', 'danger');
        }
    }

    async function resumeInventorySession() {
        if (!_inventorySession?.id) return;
        try {
            const details = await BiblioService.resumeInventorySession(_ctx, _inventorySession.id);
            _inventorySession = { ...(_inventorySession || {}), ...(details?.session || {}) };
            renderInventorySessionContent();
            focusInventorySearchInput();
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
                _inventoryListsHydrated = true;
                renderInventorySessionContent();
                showToast('Inventario finalizado.', 'success');
            }
        });
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
            const shouldHydrateSessionEntries = !_inventoryListsHydrated && Number(_inventorySession?.matchedItems || 0) > 0;
            if (shouldHydrateSessionEntries) {
                const details = await BiblioService.getCurrentInventorySession(_ctx, { includeLists: true });
                _inventorySession = details?.session || _inventorySession;
                _inventoryFoundEntries = Array.isArray(details?.foundEntries) ? details.foundEntries : [];
                _inventoryMissingEntries = Array.isArray(details?.missingEntries) ? details.missingEntries : [];
                _inventoryListsHydrated = true;
            }
            _inventorySelectedBook = await BiblioService.findInventoryBookByCode(_ctx, {
                code: query
            });
            const localObservedEntry = findLocalInventoryObservedEntry(_inventorySelectedBook);
            const observedCount = Math.max(
                Number(_inventorySelectedBook?.registeredObserved) || 0,
                Number(localObservedEntry?.totalObserved) || 0
            );
            if (_inventorySelectedBook) {
                _inventorySelectedBook = {
                    ..._inventorySelectedBook,
                    registeredObserved: observedCount
                };
            }
            _inventoryDuplicateSearch = observedCount > 0;
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

    async function openInventoryUnregisteredModal(acquisition = '') {
        const currentCode = normalizeInventoryAcquisitionCode(acquisition || document.getElementById('inventory-search-input')?.value || '');
        _inventoryUnregisteredMode = 'new';
        _inventoryUnregisteredCopyBase = null;
        document.getElementById('inventory-unregistered-modal')?.remove();

        _inventoryCategories = await BiblioService.getInventoryCategories(_ctx);
        const categoriesOptions = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        const modalHtml = `
            <div class="modal fade" id="inventory-unregistered-modal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <div class="small text-uppercase fw-bold text-warning">No registrado</div>
                                <h6 class="mb-0 text-dark">Posible copia, documento o libro nuevo</h6>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <div class="small text-muted mb-3">El codigo ${escapeHtml(currentCode || 'sin captura')} no existe en el sistema.</div>
                            <div class="d-flex gap-2 mb-3">
                                <button type="button" class="btn btn-primary rounded-pill fw-semibold flex-fill px-2" id="inventory-unregistered-mode-new" onclick="AdminBiblio.setInventoryUnregisteredMode('new')">Nuevo registro</button>
                                <button type="button" class="btn btn-outline-secondary rounded-pill fw-semibold flex-fill px-2" id="inventory-unregistered-mode-copy" onclick="AdminBiblio.setInventoryUnregisteredMode('copy')">Es copia</button>
                            </div>
                            <div class="d-grid gap-2">
                                <input type="text" class="form-control" value="${escapeHtml(currentCode)}" disabled>
                            </div>
                            <div id="inventory-unregistered-new-fields" class="d-grid gap-2 mt-2">
                                <div class="input-group">
                                    <select class="form-select" id="inventory-unregistered-category">
                                        <option value="">Categoria (Opcional)</option>
                                        ${categoriesOptions}
                                    </select>
                                    <button class="btn btn-outline-secondary" type="button" onclick="AdminBiblio.promptCreateInventoryCategory()"><i class="bi bi-plus"></i></button>
                                </div>
                                <input type="text" class="form-control" id="inventory-unregistered-title" placeholder="Nombre o Titulo">
                                <input type="text" class="form-control" id="inventory-unregistered-author" placeholder="Autor (Opcional)">
                                <input type="text" class="form-control" id="inventory-unregistered-classification" placeholder="Clasificacion (Opcional)">
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

            const details = await BiblioService.registerInventoryAssociatedCopy(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                baseBookId: _inventoryUnregisteredCopyBase.id,
                quantity: 1
            });

            _inventorySession = details?.session || _inventorySession;
            if (details?.entry) {
                upsertInventoryFoundEntry(details.entry);
            } else {
                await refreshInventorySession(true);
            }
            closeInventoryUnregisteredModal();
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) searchInput.value = '';
            focusInventorySearchInput();
            showToast('Copia asociada y guardada en inventario. Se agregara al catalogo al ajustar.', 'success');
        } catch (error) {
            showToast(error.message || 'No se pudo asociar la copia.', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    function getOtherMaterialsListHtml() {
        const materialEntries = (_inventoryFoundEntries || []).filter(e => e.type === 'material');
        if (materialEntries.length === 0) return `<div class="small text-muted mt-2">No hay materiales extra agregados.</div>`;
        return `
            <div class="d-grid gap-2 mt-2">
                ${materialEntries.map(entry => `
                    <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light border">
                        <div class="min-w-0 flex-fill">
                            <div class="small fw-bold text-dark" style="word-break: break-word;">${escapeHtml(entry.titulo)}</div>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="AdminBiblio.Inventario.adjustInventoryOtherMaterial('${escapeHtml(entry.id)}', -1)">-</button>
                            <span class="small fw-semibold" style="min-width: 20px; text-align: center;">${entry.totalObserved}</span>
                            <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="AdminBiblio.Inventario.adjustInventoryOtherMaterial('${escapeHtml(entry.id)}', 1)">+</button>
                            <button type="button" class="btn btn-sm btn-outline-danger ms-1 py-0 px-2" onclick="AdminBiblio.Inventario.adjustInventoryOtherMaterial('${escapeHtml(entry.id)}', -${entry.totalObserved})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function refreshOtherMaterialsModal() {
        const listWrap = document.getElementById('inventory-other-materials-list');
        if (listWrap) {
            listWrap.innerHTML = getOtherMaterialsListHtml();
        }
    }

    async function adjustInventoryOtherMaterial(entryId, delta) {
        if (_inventorySaving || !_inventorySession?.id) return;
        const entry = (_inventoryFoundEntries || []).find(e => String(e.id) === String(entryId));
        if (!entry) return;

        const nextQuantity = Math.max(0, (Number(entry.totalObserved) || 0) + delta);
        try {
            _inventorySaving = true;
            const result = await BiblioService.reviewInventoryFoundEntry(_ctx, {
                sessionId: _inventorySession.id,
                entryId: entry.id,
                quantity: nextQuantity
            });

            if (result?.deleted) {
                _inventoryFoundEntries = _inventoryFoundEntries.filter(item => String(item?.id || '') !== String(entry.id));
            } else if (result?.entry) {
                let replaced = false;
                _inventoryFoundEntries = _inventoryFoundEntries.map(item => {
                    if (String(item?.id || '') !== String(result.entryId)) return item;
                    replaced = true;
                    return { ...item, ...result.entry };
                });
                if (!replaced) _inventoryFoundEntries.unshift(result.entry);
            }
            if (result?.session) _inventorySession = { ..._inventorySession, ...result.session };

            renderInventorySessionContent();
            refreshOtherMaterialsModal();
        } catch (error) {
            showToast(error.message || 'Error al actualizar cantidad', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    async function openOtherMaterialsModal() {
        if (!_inventorySession?.id) return;
        document.getElementById('inventory-other-materials-modal')?.remove();

        _inventoryCategories = await BiblioService.getInventoryCategories(_ctx);
        const categoriesOptions = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        const modalHtml = `
            <div class="modal fade" id="inventory-other-materials-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <h6 class="mb-0 text-dark"><i class="bi bi-collection me-2"></i>Otro material</h6>
                                <div class="small text-muted">Contabiliza revistas, cds, tesis, etc.</div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <div class="d-grid gap-3">
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Categoria / Tipo</label>
                                    <div class="input-group">
                                        <select class="form-select" id="inventory-other-category">
                                            <option value="">Selecciona...</option>
                                            ${categoriesOptions}
                                        </select>
                                        <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"><i class="bi bi-gear"></i></button>
                                        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                            <li><a class="dropdown-item py-2" href="#" onclick="event.preventDefault(); AdminBiblio.Inventario.promptCreateInventoryCategory()"><i class="bi bi-plus-circle me-2 text-primary"></i>Nueva categoría</a></li>
                                            <li><a class="dropdown-item py-2" href="#" onclick="event.preventDefault(); AdminBiblio.Inventario.promptEditInventoryCategory()"><i class="bi bi-pencil me-2 text-secondary"></i>Editar seleccionada</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item py-2 text-danger" href="#" onclick="event.preventDefault(); AdminBiblio.Inventario.promptDeleteInventoryCategory()"><i class="bi bi-trash me-2"></i>Eliminar seleccionada</a></li>
                                        </ul>
                                    </div>
                                </div>
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Nombre (Opcional)</label>
                                    <input type="text" class="form-control" id="inventory-other-name" placeholder="Ej. Revista Forbes">
                                </div>
                                <div>
                                    <label class="form-label small fw-semibold text-muted mb-1">Cantidad a sumar</label>
                                    <input type="number" class="form-control" id="inventory-other-qty" value="1" min="1">
                                </div>
                                <button type="button" class="btn btn-primary rounded-pill fw-bold" onclick="AdminBiblio.Inventario.saveInventoryOtherMaterial()">
                                    Agregar al inventario
                                </button>

                                <div class="mt-3 pt-3 border-top">
                                    <div class="small fw-semibold text-muted">Materiales agregados</div>
                                    <div id="inventory-other-materials-list">
                                        ${getOtherMaterialsListHtml()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-other-materials-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', () => { syncModalScrollLock(); });
        modalEl.addEventListener('hidden.bs.modal', () => { modalEl.remove(); syncModalScrollLock(); });
        syncModalScrollLock();
        modal.show();
    }

    async function saveInventoryOtherMaterial() {
        if (_inventorySaving || !_inventorySession?.id) return;

        const category = document.getElementById('inventory-other-category')?.value?.trim();
        const name = document.getElementById('inventory-other-name')?.value?.trim();
        const qty = parseInt(document.getElementById('inventory-other-qty')?.value) || 1;

        if (!category && !name) {
            showToast('Selecciona una categoria o escribe un nombre.', 'warning');
            return;
        }

        const displayName = name ? (category ? `${category}: ${name}` : name) : category;

        try {
            _inventorySaving = true;
            const details = await BiblioService.registerInventoryExtraMaterial(_ctx, {
                sessionId: _inventorySession.id,
                nombre: displayName,
                quantity: qty
            });

            _inventorySession = details?.session || _inventorySession;
            if (details?.entry) {
                upsertInventoryFoundEntry(details.entry);
            }
            renderInventorySessionContent();

            const nameInput = document.getElementById('inventory-other-name');
            const qtyInput = document.getElementById('inventory-other-qty');
            if (nameInput) nameInput.value = '';
            if (qtyInput) qtyInput.value = '1';

            refreshOtherMaterialsModal();
            showToast(`${qty} '${displayName}' agregado(s) exitosamente.`, 'success');
        } catch (error) {
            showToast(error.message || 'Error al agregar material', 'danger');
        } finally {
            _inventorySaving = false;
        }
    }

    async function promptCreateInventoryCategory() {
        const result = await showPromptModal({
            icon: 'tags',
            iconColor: '#0d6efd',
            title: 'Nueva Categoría',
            message: 'Escribe el nombre de la categoria (ej. Revistas, CD-ROMs, Tesis)',
            placeholder: 'Nombre de la categoría',
            confirmText: 'Guardar',
            confirmClass: 'btn-primary'
        });
        if (!result) return;
        try {
            _inventoryCategories = await BiblioService.addInventoryCategory(_ctx, result);
            refreshCategorySelects(result);
            showToast('Categoria creada y seleccionada', 'success');
        } catch (error) {
            showToast(error.message || 'Error al crear categoria', 'danger');
        }
    }

    async function promptEditInventoryCategory() {
        const selectEl = document.getElementById('inventory-other-category');
        const oldCat = selectEl?.value;
        if (!oldCat) {
            showToast('Primero selecciona una categoria para editar.', 'warning');
            return;
        }

        const result = await showPromptModal({
            icon: 'pencil',
            iconColor: '#6c757d',
            title: 'Editar Categoría',
            message: 'Escribe el nuevo nombre para la categoria',
            value: oldCat,
            placeholder: 'Nuevo nombre',
            confirmText: 'Actualizar',
            confirmClass: 'btn-primary'
        });

        if (!result || result === oldCat) return;

        try {
            _inventoryCategories = await BiblioService.editInventoryCategory(_ctx, oldCat, result);
            refreshCategorySelects(result);
            showToast('Categoria actualizada exitosamente', 'success');
        } catch (error) {
            showToast(error.message || 'Error al editar categoria', 'danger');
        }
    }

    async function promptDeleteInventoryCategory() {
        const selectEl = document.getElementById('inventory-other-category');
        const cat = selectEl?.value;
        if (!cat) {
            showToast('Primero selecciona una categoria para eliminar.', 'warning');
            return;
        }

        const confirmed = await showConfirmModal({
            icon: 'trash',
            iconColor: '#dc3545',
            title: 'Eliminar Categoría',
            message: `¿Estas seguro de que deseas eliminar la categoria <b>${escapeHtml(cat)}</b>? Esto no afectara a los materiales ya guardados en el inventario.`,
            confirmText: 'Eliminar',
            confirmClass: 'btn-danger'
        });

        if (!confirmed) return;

        try {
            _inventoryCategories = await BiblioService.removeInventoryCategory(_ctx, cat);
            refreshCategorySelects('');
            showToast('Categoria eliminada', 'success');
        } catch (error) {
            showToast(error.message || 'Error al eliminar categoria', 'danger');
        }
    }

    function refreshCategorySelects(selectedValue = '') {
        const options = _inventoryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        const selectEl1 = document.getElementById('inventory-unregistered-category');
        if (selectEl1) {
            selectEl1.innerHTML = `<option value="">Categoria (Opcional)</option>${options}`;
            if (selectedValue) selectEl1.value = selectedValue;
        }

        const selectEl2 = document.getElementById('inventory-other-category');
        if (selectEl2) {
            selectEl2.innerHTML = `<option value="">Selecciona...</option>${options}`;
            if (selectedValue) selectEl2.value = selectedValue;
        }
    }

    async function saveInventoryManualBook() {
        if (_inventorySaving || !_inventorySession?.id) return;

        const acquisition = normalizeInventoryAcquisitionCode(document.getElementById('inventory-search-input')?.value || '');
        const title = String(document.getElementById('inventory-unregistered-title')?.value || '').trim();
        const author = String(document.getElementById('inventory-unregistered-author')?.value || '').trim();
        const classification = String(document.getElementById('inventory-unregistered-classification')?.value || '').trim();
        const category = String(document.getElementById('inventory-unregistered-category')?.value || '').trim();

        if (!acquisition) {
            showToast('Primero captura el numero de adquisicion.', 'warning');
            return;
        }
        if (!title) {
            showToast('Escribe el nombre del documento o libro.', 'warning');
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
                classification,
                categoria: category
            });

            _inventorySession = details?.session || _inventorySession;
            if (details?.entry) {
                upsertInventoryFoundEntry(details.entry);
            }
            closeInventoryUnregisteredModal();
            clearInventoryDraftUi();
            renderInventorySessionContent();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) searchInput.value = '';
            focusInventorySearchInput();
            showToast('Registro guardado en inventario. Se agregara al catalogo al ajustar el inventario final.', 'success');
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
            showToast('Escribe el No. de adquisicion del libro base.', 'warning');
            return;
        }

        try {
            const match = await BiblioService.findInventoryBookByCode(_ctx, { code: term });
            _inventoryCopyLookupResults = match ? [match] : [];
            _inventorySelectedCopyBase = null;
            renderInventoryCopyResults();
            renderInventoryCopySelectedBase();
            if (!_inventoryCopyLookupResults.length) {
                showToast('No se encontro un libro base con esa adquisicion.', 'warning');
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
            const details = await BiblioService.registerInventoryAssociatedCopy(_ctx, {
                sessionId: _inventorySession.id,
                acquisition,
                baseBookId: _inventorySelectedCopyBase.id,
                quantity: 1
            });
            _inventorySession = details?.session || _inventorySession;
            if (details?.entry) {
                upsertInventoryFoundEntry(details.entry);
            } else {
                await refreshInventorySession(true);
            }
            clearInventoryDraftUi();
            const searchInput = document.getElementById('inventory-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            focusInventorySearchInput();
            showToast('Copia agrupada y guardada en inventario. Se agregara al catalogo al ajustar.', 'success');
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
            if (_inventoryPendingCopyCodes.length > 0) {
                await BiblioService.syncInventoryCopyAcquisitions(_ctx, {
                    baseBookId: _inventorySelectedBook.id,
                    acquisitions: _inventoryPendingCopyCodes
                });
            }

            const details = await BiblioService.registerInventoryMatch(_ctx, {
                sessionId: _inventorySession.id,
                bookId: _inventorySelectedBook.id,
                groupKey: _inventorySelectedBook.groupKey,
                systemTotal: _inventorySelectedBook.systemTotal,
                groupSize: _inventorySelectedBook.groupSize,
                matchedAcquisition: _inventorySelectedBook.matchedAcquisition || query,
                observedAcquisitions: [_inventorySelectedBook.matchedAcquisition || query, ..._inventoryPendingCopyCodes],
                quantity,
                query
            });
            _inventorySession = details?.session || _inventorySession;
            if (details?.entry) {
                upsertInventoryFoundEntry(details.entry);
            }
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
            if (details?.entry) {
                upsertInventoryMissingEntry(details.entry);
            }
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

    async function openInventoryHistoryModal() {
        document.getElementById('inventory-history-modal')?.remove();
        const modalHtml = `
            <div class="modal fade" id="inventory-history-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" style="max-width:min(800px,calc(100vw - 1rem));margin:.5rem auto;">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 bg-dark text-white px-4 py-3">
                            <div class="d-flex align-items-center gap-2">
                                <i class="bi bi-clock-history fs-5"></i>
                                <h5 class="mb-0 fw-bold">Historial de Inventarios</h5>
                            </div>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-3 p-md-4" id="inventory-history-modal-body">
                            <div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('inventory-history-modal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('shown.bs.modal', async () => { syncModalScrollLock(); await _renderInventoryHistoryBody(); }, { once: true });
        modalEl.addEventListener('hidden.bs.modal', () => { modalEl.remove(); syncModalScrollLock(); }, { once: true });
        syncModalScrollLock();
        modal.show();
    }

    async function _renderInventoryHistoryBody() {
        const body = document.getElementById('inventory-history-modal-body');
        if (!body) return;
        let list = [];
        try { list = await BiblioService.listInventorySessions(_ctx, { limit: 30 }); } catch (e) { list = []; }

        if (!list.length) {
            body.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>No hay inventarios registrados.</div>`;
            return;
        }

        const statusBadge = (s) => {
            if (s === 'finished') return '<span class="badge text-bg-secondary rounded-pill">Cerrado</span>';
            if (s === 'paused') return '<span class="badge text-bg-warning text-dark rounded-pill">Pausado</span>';
            return '<span class="badge text-bg-success rounded-pill">En curso</span>';
        };

        body.innerHTML = `<div class="d-grid gap-3">` + list.map((inv) => {
            const id = escapeHtml(inv.id || '');
            const nombre = escapeHtml(inv.name || 'Inventario');
            const fecha = formatInventoryDate(inv.createdAt);
            const cierre = inv.finishedAt ? formatInventoryDate(inv.finishedAt) : '—';
            const reg = Number(inv.matchedItems || 0);
            const obs = Number(inv.totalObserved || 0);
            const isFinished = inv.status === 'finished';
            return `
                <div class="rounded-4 border bg-white shadow-sm p-3">
                    <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div class="min-w-0">
                            <div class="fw-semibold text-dark mb-1">${nombre} ${statusBadge(inv.status || 'active')}</div>
                            <div class="small text-muted">Iniciado: ${fecha}</div>
                            ${isFinished ? `<div class="small text-muted">Cerrado: ${cierre}</div>` : ''}
                            <div class="small text-muted mt-1">
                                <span class="badge text-bg-light border me-1">${reg} libros registrados</span>
                                <span class="badge text-bg-light border">${obs} observados</span>
                            </div>
                        </div>
                        <div class="d-flex flex-column gap-2 flex-shrink-0">
                            <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="AdminBiblio.openInventorySessionReview('${id}')">
                                <i class="bi bi-eye me-1"></i>Revisar
                            </button>
                            ${isFinished ? `
                            <button class="btn btn-sm btn-outline-dark rounded-pill" onclick="AdminBiblio.openInventoryPdfOptionsModal('${id}')">
                                <i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF
                            </button>
                            <button class="btn btn-sm btn-outline-warning rounded-pill" onclick="AdminBiblio.confirmReactivateInventory('${id}')">
                                <i class="bi bi-arrow-counterclockwise me-1"></i>Reactivar
                            </button>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('') + `</div>`;
    }

    async function openInventorySessionReview(sessionId) {
        document.getElementById('inventory-history-modal') && bootstrap.Modal.getInstance(document.getElementById('inventory-history-modal'))?.hide();
        if (!sessionId) return;
        const body = document.getElementById('modal-admin-body');
        if (body) body.innerHTML = `<div class="modal-body text-center py-5"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</div>`;
        ensureInventoryModalVisibility();
        try {
            const details = await BiblioService.getInventorySessionDetails(_ctx, sessionId, { includeLists: true });
            if (!details?.session) { showToast('No se pudo cargar el inventario.', 'danger'); return; }
            _inventorySession = details.session;
            _inventoryFoundEntries = details.foundEntries || [];
            _inventoryMissingEntries = details.missingEntries || [];
            _inventoryListsHydrated = true;
            renderInventorySessionContent();
            if (details.session.status !== 'finished') focusInventorySearchInput();
        } catch (e) {
            showToast(e.message || 'No se pudo abrir el inventario.', 'danger');
        }
    }

    function confirmReactivateInventory(sessionId) {
        if (!sessionId) return;
        document.getElementById('inventory-reactivate-modal')?.remove();
        const sid = escapeHtml(String(sessionId));
        const modalHtml = `
            <div class="modal fade" id="inventory-reactivate-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-body p-4 text-center">
                            <div class="rounded-circle bg-warning-subtle mx-auto mb-3 d-flex align-items-center justify-content-center" style="width:56px;height:56px;">
                                <i class="bi bi-arrow-counterclockwise fs-3 text-warning"></i>
                            </div>
                            <div class="fw-bold text-dark mb-2">¿Reactivar inventario?</div>
                            <div class="small text-muted mb-4">El inventario se marcara como activo nuevamente. Esta accion requiere doble confirmacion.</div>
                            <div class="d-grid gap-2">
                                <button class="btn btn-warning fw-bold rounded-pill" id="inventory-reactivate-confirm-btn" onclick="AdminBiblio.executeReactivateInventory('${sid}')">
                                    Si, reactivar inventario
                                </button>
                                <button class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const el = document.getElementById('inventory-reactivate-modal');
        const m = new bootstrap.Modal(el);
        el.addEventListener('hidden.bs.modal', () => { el.remove(); syncModalScrollLock(); }, { once: true });
        syncModalScrollLock();
        m.show();
    }

    async function executeReactivateInventory(sessionId) {
        const btn = document.getElementById('inventory-reactivate-confirm-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Reactivando...'; }
        try {
            await BiblioService.resumeInventorySession(_ctx, sessionId);
            const details = await BiblioService.getInventorySessionDetails(_ctx, sessionId, { includeLists: true });
            _inventorySession = details?.session || null;
            _inventoryFoundEntries = details?.foundEntries || [];
            _inventoryMissingEntries = details?.missingEntries || [];
            _inventoryListsHydrated = true;
            document.getElementById('inventory-reactivate-modal') && bootstrap.Modal.getInstance(document.getElementById('inventory-reactivate-modal'))?.hide();
            document.getElementById('inventory-history-modal') && bootstrap.Modal.getInstance(document.getElementById('inventory-history-modal'))?.hide();
            renderInventorySessionContent();
            ensureInventoryModalVisibility();
            showToast('Inventario reactivado.', 'success');
        } catch (e) {
            showToast(e.message || 'No se pudo reactivar.', 'danger');
            if (btn) { btn.disabled = false; btn.textContent = 'Si, reactivar inventario'; }
        }
    }

    async function openInventoryPdfOptionsModal(sessionId) {
        document.getElementById('inventory-pdf-options-modal')?.remove();
        const sid = escapeHtml(String(sessionId || _inventorySession?.id || ''));
        const modalHtml = `
            <div class="modal fade" id="inventory-pdf-options-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered" style="max-width:min(520px,calc(100vw - 1rem));margin:.5rem auto;">
                    <div class="modal-content border-0 shadow-lg rounded-4">
                        <div class="modal-header border-0 pb-0">
                            <div>
                                <div class="small text-uppercase fw-bold text-muted mb-1">Exportar</div>
                                <h5 class="mb-0 text-dark">Opciones del PDF</h5>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body pt-3">
                            <p class="small text-muted mb-3">El PDF incluira el resumen formal del inventario, libros por categoria, top 10 por copias, materiales extra y el listado completo de libros al final.</p>
                            <div class="rounded-4 border bg-light p-3">
                                <div class="fw-semibold text-dark">Listado completo incluido</div>
                                <div class="small text-muted">Todos los libros registrados en catalogo durante el inventario se agregaran siempre en las ultimas paginas.</div>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-dark rounded-pill fw-bold px-4" id="inventory-pdf-generate-btn" onclick="AdminBiblio.generateInventoryPdf('${sid}')">
                                <i class="bi bi-file-earmark-pdf me-2"></i>Generar PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const el = document.getElementById('inventory-pdf-options-modal');
        const m = new bootstrap.Modal(el);
        el.addEventListener('hidden.bs.modal', () => { el.remove(); syncModalScrollLock(); }, { once: true });
        syncModalScrollLock();
        m.show();
    }

    async function generateInventoryPdf(sessionId) {
        const btn = document.getElementById('inventory-pdf-generate-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...'; }

        try {
            if (!window.jspdf?.jsPDF) throw new Error('El exportador PDF no esta disponible.');
            const sid = String(sessionId || _inventorySession?.id || '');
            let details = sid ? await BiblioService.getInventorySessionDetails(_ctx, sid, { includeLists: true }) : null;
            if (!details?.session) details = await BiblioService.getLatestFinishedInventorySession(_ctx, { includeLists: true });
            if (!details?.session) throw new Error('No hay inventario cerrado para exportar.');

            const foundEntries = details.foundEntries || [];
            const bookEntries = foundEntries.filter(e => e.type !== 'material');
            const materialEntries = foundEntries.filter(e => e.type === 'material');

            const countCopies = (entries = []) => entries.reduce((sum, entry) => sum + (Number(entry?.totalObserved || entry?.cantidad || entry?.lastQuantity || 0) || 0), 0);
            const qtyOf = (entry = {}) => Number(entry.totalObserved || entry.cantidad || entry.lastQuantity || 0) || 0;
            const fmt = (value) => new Intl.NumberFormat('es-MX').format(Number(value) || 0);
            const percent = (part, total) => total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : '0%';
            const clean = (value, fallback = '-') => {
                const text = String(value || '').replace(/\s+/g, ' ').trim();
                return text || fallback;
            };
            const normalizeKey = (value) => clean(value, 'Sin tipo definido').toLocaleLowerCase('es-MX');
            const splitMaterial = (entry = {}) => {
                const raw = clean(entry.titulo || entry.displayName || entry.nombre, 'Sin nombre');
                const colonIndex = raw.indexOf(':');
                if (colonIndex >= 0) {
                    return {
                        raw,
                        type: clean(raw.slice(0, colonIndex), 'Sin tipo definido'),
                        name: clean(raw.slice(colonIndex + 1), 'Sin nombre')
                    };
                }
                return { raw, type: raw, name: '' };
            };

            const bookCopies = countCopies(bookEntries);
            const materialCopies = countCopies(materialEntries);
            const totalProducts = bookCopies + materialCopies;
            const totalUniqueProducts = bookEntries.length + materialEntries.length;

            const categoryMap = new Map();
            bookEntries.forEach((entry) => {
                const label = clean(entry.categoria || entry.categoriaLibro, 'Sin categoria');
                const key = normalizeKey(label);
                const current = categoryMap.get(key) || { label, titles: 0, copies: 0 };
                current.titles += 1;
                current.copies += qtyOf(entry);
                categoryMap.set(key, current);
            });
            const categoryRows = Array.from(categoryMap.values()).sort((a, b) => b.copies - a.copies || a.label.localeCompare(b.label));

            const topCopyRows = [...bookEntries]
                .sort((a, b) => qtyOf(b) - qtyOf(a) || clean(a.titulo || a.displayName).localeCompare(clean(b.titulo || b.displayName)))
                .slice(0, 10);

            const materialTypeMap = new Map();
            const magazineRows = [];
            materialEntries.forEach((entry) => {
                const parts = splitMaterial(entry);
                const key = normalizeKey(parts.type);
                const current = materialTypeMap.get(key) || { label: parts.type, records: 0, copies: 0 };
                current.records += 1;
                current.copies += qtyOf(entry);
                materialTypeMap.set(key, current);
                if (parts.type.toLocaleLowerCase('es-MX').includes('revista')) {
                    magazineRows.push({ name: parts.name || 'Sin nombre especifico', copies: qtyOf(entry) });
                }
            });
            const materialTypeRows = Array.from(materialTypeMap.values()).sort((a, b) => b.copies - a.copies || a.label.localeCompare(b.label));
            magazineRows.sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));

            const averageCopiesPerBook = bookEntries.length > 0 ? Math.round((bookCopies / bookEntries.length) * 10) / 10 : 0;
            const strongestCategory = categoryRows[0] || null;

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'letter');
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const M = 16; const CW = W - M * 2;
            let Y = 16;
            const primary = [20, 34, 51];
            const muted = [92, 101, 112];
            const line = [214, 220, 228];
            const hasAutoTable = typeof doc.autoTable === 'function';
            const newPage = () => { doc.addPage(); Y = 18; };
            const checkY = (n) => { if (Y + n > H - 18) newPage(); };
            const sectionTitle = (title, subtitle = '') => {
                checkY(subtitle ? 18 : 11);
                doc.setDrawColor(...line);
                doc.line(M, Y, M + CW, Y);
                Y += 8;
                doc.setTextColor(...primary);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.text(title, M, Y);
                Y += 5;
                if (subtitle) {
                    doc.setTextColor(...muted);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.5);
                    const lines = doc.splitTextToSize(subtitle, CW);
                    doc.text(lines, M, Y);
                    Y += lines.length * 4 + 2;
                }
            };
            const drawMetric = (label, value, x, y, w, fill) => {
                doc.setFillColor(...fill);
                doc.roundedRect(x, y, w, 22, 2.5, 2.5, 'F');
                doc.setTextColor(...muted);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.text(String(label).toUpperCase(), x + 4, y + 7);
                doc.setTextColor(...primary);
                doc.setFontSize(16);
                doc.text(String(value), x + 4, y + 17);
            };
            const fallbackTable = (columns, rows) => {
                const colW = CW / columns.length;
                checkY(10);
                doc.setFillColor(...primary);
                doc.rect(M, Y, CW, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                columns.forEach((col, index) => doc.text(clean(col.header || col, ''), M + 2 + (colW * index), Y + 5));
                Y += 8;
                rows.forEach((row, rowIndex) => {
                    checkY(8);
                    doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 252 : 255);
                    doc.rect(M, Y, CW, 7, 'F');
                    doc.setTextColor(33, 37, 41);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.2);
                    columns.forEach((col, index) => {
                        const key = col.dataKey || col;
                        doc.text(clean(row[key], '').slice(0, 28), M + 2 + (colW * index), Y + 4.8);
                    });
                    Y += 7;
                });
                Y += 4;
            };
            const table = (columns, rows, options = {}) => {
                if (!rows.length) return;
                if (!hasAutoTable) {
                    fallbackTable(columns, rows);
                    return;
                }
                doc.autoTable({
                    startY: Y,
                    margin: { left: M, right: M },
                    columns,
                    body: rows,
                    theme: 'grid',
                    styles: {
                        font: 'helvetica',
                        fontSize: options.fontSize || 8,
                        cellPadding: 2.4,
                        overflow: 'linebreak',
                        lineColor: line,
                        lineWidth: 0.1,
                        textColor: [33, 37, 41],
                        valign: 'middle'
                    },
                    headStyles: {
                        fillColor: primary,
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: options.headFontSize || 8
                    },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: options.columnStyles || {},
                    ...options.autoTable
                });
                Y = doc.lastAutoTable.finalY + 7;
            };

            doc.setFillColor(...primary);
            doc.rect(0, 0, W, 44, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(19);
            doc.text('Reporte de Inventario Bibliotecario', M, 17);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const nombre = clean(details.session.name, 'Inventario');
            const closedAt = details.session.finishedAt?.toDate?.() || details.session.updatedAt?.toDate?.() || new Date();
            const generatedAt = new Date();
            doc.text(nombre, M, 25);
            doc.text(`Cierre: ${closedAt.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, M, 32);
            doc.text(`Generado: ${generatedAt.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, M, 38);
            doc.text(`ID inventario: ${clean(details.session.id, 'S/N')}`, W - M, 38, { align: 'right' });
            Y = 55;

            // METRICAS — calculadas directamente desde las entradas del inventario
            const cardGap = 5;
            const cardW = (CW - cardGap * 2) / 3;
            drawMetric('Productos inventariados', fmt(totalProducts), M, Y, cardW, [232, 246, 239]);
            drawMetric('Libros', fmt(bookCopies), M + cardW + cardGap, Y, cardW, [235, 242, 252]);
            drawMetric('Otros materiales', fmt(materialCopies), M + (cardW + cardGap) * 2, Y, cardW, [252, 244, 222]);
            Y += 29;
            drawMetric('Registros unicos', fmt(totalUniqueProducts), M, Y, cardW, [244, 246, 248]);
            drawMetric('Categorias de libros', fmt(categoryRows.length), M + cardW + cardGap, Y, cardW, [244, 246, 248]);
            drawMetric('Tipos de material', fmt(materialTypeRows.length), M + (cardW + cardGap) * 2, Y, cardW, [244, 246, 248]);
            Y += 34;

            sectionTitle('Resumen ejecutivo', 'Totales calculados solo con libros encontrados en catalogo y materiales extra registrados. Las capturas no registradas en catalogo no forman parte de este reporte.');
            table(
                [
                    { header: 'Concepto', dataKey: 'concept' },
                    { header: 'Registros', dataKey: 'records' },
                    { header: 'Copias / productos', dataKey: 'copies' },
                    { header: 'Participacion', dataKey: 'share' }
                ],
                [
                    { concept: 'Libros en catalogo', records: fmt(bookEntries.length), copies: fmt(bookCopies), share: percent(bookCopies, totalProducts) },
                    { concept: 'Otros materiales', records: fmt(materialEntries.length), copies: fmt(materialCopies), share: percent(materialCopies, totalProducts) },
                    { concept: 'Total inventariado', records: fmt(totalUniqueProducts), copies: fmt(totalProducts), share: '100%' }
                ],
                {
                    columnStyles: {
                        concept: { cellWidth: 72 },
                        records: { halign: 'right', cellWidth: 32 },
                        copies: { halign: 'right', cellWidth: 42 },
                        share: { halign: 'right', cellWidth: 28 }
                    }
                }
            );

            sectionTitle('Indicadores de lectura rapida');
            [
                `Promedio de copias por libro registrado: ${averageCopiesPerBook}`,
                strongestCategory ? `Categoria con mayor volumen: ${strongestCategory.label} (${fmt(strongestCategory.copies)} copias)` : 'Categoria con mayor volumen: sin datos',
                magazineRows.length > 0 ? `Revistas desglosadas por nombre: ${fmt(magazineRows.length)} registro(s)` : 'Revistas desglosadas por nombre: sin registros'
            ].forEach((lineText) => {
                checkY(6);
                doc.setTextColor(...primary);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(`- ${lineText}`, M + 2, Y);
                Y += 6;
            });
            Y += 3;

            if (categoryRows.length > 0) {
                sectionTitle('Libros por categoria', 'Distribucion de copias inventariadas por categoria del catalogo.');
                table(
                    [
                        { header: 'Categoria', dataKey: 'category' },
                        { header: 'Titulos', dataKey: 'titles' },
                        { header: 'Copias', dataKey: 'copies' },
                        { header: '% libros', dataKey: 'share' }
                    ],
                    categoryRows.map(row => ({
                        category: row.label,
                        titles: fmt(row.titles),
                        copies: fmt(row.copies),
                        share: percent(row.copies, bookCopies)
                    })),
                    {
                        columnStyles: {
                            category: { cellWidth: 88 },
                            titles: { halign: 'right', cellWidth: 27 },
                            copies: { halign: 'right', cellWidth: 29 },
                            share: { halign: 'right', cellWidth: 30 }
                        }
                    }
                );
            }

            if (topCopyRows.length > 0) {
                sectionTitle('Top 10 libros con mas copias registradas');
                table(
                    [
                        { header: '#', dataKey: 'index' },
                        { header: 'Titulo', dataKey: 'title' },
                        { header: 'Autor', dataKey: 'author' },
                        { header: 'Categoria', dataKey: 'category' },
                        { header: 'Copias', dataKey: 'copies' }
                    ],
                    topCopyRows.map((entry, index) => ({
                        index: String(index + 1),
                        title: clean(entry.titulo || entry.displayName, 'Sin titulo'),
                        author: clean(entry.autor, '-'),
                        category: clean(entry.categoria, 'Sin categoria'),
                        copies: fmt(qtyOf(entry))
                    })),
                    {
                        fontSize: 7.7,
                        columnStyles: {
                            index: { halign: 'center', cellWidth: 11 },
                            title: { cellWidth: 66 },
                            author: { cellWidth: 38 },
                            category: { cellWidth: 38 },
                            copies: { halign: 'right', cellWidth: 21 }
                        }
                    }
                );
            }

            if (materialTypeRows.length > 0) {
                sectionTitle('Otros materiales por tipo', 'Los tipos se toman del texto registrado antes de los dos puntos. Ejemplo: "Revistas: Forbes" se contabiliza como tipo "Revistas".');
                table(
                    [
                        { header: 'Tipo de material', dataKey: 'type' },
                        { header: 'Registros', dataKey: 'records' },
                        { header: 'Total', dataKey: 'copies' },
                        { header: '% materiales', dataKey: 'share' }
                    ],
                    materialTypeRows.map(row => ({
                        type: row.label,
                        records: fmt(row.records),
                        copies: fmt(row.copies),
                        share: percent(row.copies, materialCopies)
                    })),
                    {
                        columnStyles: {
                            type: { cellWidth: 88 },
                            records: { halign: 'right', cellWidth: 30 },
                            copies: { halign: 'right', cellWidth: 28 },
                            share: { halign: 'right', cellWidth: 28 }
                        }
                    }
                );
            }

            if (magazineRows.length > 0) {
                sectionTitle('Desglose de revistas', 'Detalle por nombre registrado despues de los dos puntos.');
                table(
                    [
                        { header: 'Nombre de revista', dataKey: 'name' },
                        { header: 'Total', dataKey: 'copies' }
                    ],
                    magazineRows.map(row => ({
                        name: row.name,
                        copies: fmt(row.copies)
                    })),
                    {
                        columnStyles: {
                            name: { cellWidth: 145 },
                            copies: { halign: 'right', cellWidth: 29 }
                        }
                    }
                );
            }

            newPage();
            sectionTitle('Listado completo de libros', 'Relacion completa de libros encontrados en catalogo durante el inventario. Este listado se incluye siempre.');
            if (bookEntries.length > 0) {
                table(
                    [
                        { header: '#', dataKey: 'index' },
                        { header: 'Titulo', dataKey: 'title' },
                        { header: 'Autor', dataKey: 'author' },
                        { header: 'Categoria', dataKey: 'category' },
                        { header: 'Clasificacion', dataKey: 'classification' },
                        { header: 'Adquisicion', dataKey: 'acquisition' },
                        { header: 'Copias', dataKey: 'copies' }
                    ],
                    [...bookEntries]
                        .sort((a, b) => clean(a.titulo || a.displayName).localeCompare(clean(b.titulo || b.displayName)))
                        .map((entry, index) => ({
                            index: String(index + 1),
                            title: clean(entry.titulo || entry.displayName, 'Sin titulo'),
                            author: clean(entry.autor, '-'),
                            category: clean(entry.categoria, 'Sin categoria'),
                            classification: clean(entry.clasificacion, '-'),
                            acquisition: clean(entry.adquisicion || entry.catalogAdquisicion, 'S/N'),
                            copies: fmt(qtyOf(entry))
                        })),
                    {
                        fontSize: 6.8,
                        headFontSize: 7,
                        columnStyles: {
                            index: { halign: 'right', cellWidth: 9 },
                            title: { cellWidth: 48 },
                            author: { cellWidth: 30 },
                            category: { cellWidth: 27 },
                            classification: { cellWidth: 24 },
                            acquisition: { cellWidth: 21 },
                            copies: { halign: 'right', cellWidth: 15 }
                        }
                    }
                );
            } else {
                doc.setTextColor(...muted);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text('No hay libros de catalogo registrados en este inventario.', M, Y);
                Y += 6;
            }

            const pageCount = doc.getNumberOfPages();
            for (let page = 1; page <= pageCount; page += 1) {
                doc.setPage(page);
                doc.setDrawColor(...line);
                doc.line(M, H - 12, W - M, H - 12);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(115, 124, 135);
                doc.text('Reporte de Inventario Bibliotecario', M, H - 7);
                doc.text(`Pagina ${page} de ${pageCount}`, W - M, H - 7, { align: 'right' });
            }

            const fileDate = new Date().toISOString().slice(0, 10);
            doc.save(`inventario-${fileDate}.pdf`);
            document.getElementById('inventory-pdf-options-modal') && bootstrap.Modal.getInstance(document.getElementById('inventory-pdf-options-modal'))?.hide();
            showToast('PDF generado exitosamente.', 'success');
        } catch (err) {
            showToast(err.message || 'No se pudo generar el PDF.', 'danger');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Generar PDF'; }
        }
    }

    const api = {
        abrirModalInventario: withState(abrirModalInventario),
        startInventorySession: withState(startInventorySession),
        pauseInventorySession: withState(pauseInventorySession),
        resumeInventorySession: withState(resumeInventorySession),
        confirmFinalizeInventorySession: withState(confirmFinalizeInventorySession),

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
        promptCreateInventoryCategory: withState(promptCreateInventoryCategory),
        promptEditInventoryCategory: withState(promptEditInventoryCategory),
        promptDeleteInventoryCategory: withState(promptDeleteInventoryCategory),
        adjustInventoryOtherMaterial: withState(adjustInventoryOtherMaterial),
        openOtherMaterialsModal: withState(openOtherMaterialsModal),
        saveInventoryOtherMaterial: withState(saveInventoryOtherMaterial),
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
        stopInventoryScanner: withState(stopInventoryScanner),
        openInventoryHistoryModal: withState(openInventoryHistoryModal),
        openInventorySessionReview: withState(openInventorySessionReview),
        confirmReactivateInventory: withState(confirmReactivateInventory),
        executeReactivateInventory: withState(executeReactivateInventory),
        openInventoryPdfOptionsModal: withState(openInventoryPdfOptionsModal),
        generateInventoryPdf: withState(generateInventoryPdf)
    };

    Object.assign(window.AdminBiblio, api);
    return api;
})();
