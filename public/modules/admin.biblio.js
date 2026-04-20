window.AdminBiblio = Object.assign(window.AdminBiblio || {}, (function () {
    const state = window.AdminBiblio.State || {};
    window.AdminBiblio.State = state;

    if (state.ctx === undefined) state.ctx = null;
    if (state.searchDebounce === undefined) state.searchDebounce = null;
    if (state.adminStatsInterval === undefined) state.adminStatsInterval = null;
    if (state.clockInterval === undefined) state.clockInterval = null;
    if (state.pcGridUnsub === undefined) state.pcGridUnsub = null;
    if (state.configAssetsUnsub === undefined) state.configAssetsUnsub = null;
    if (state.scannerStationsUnsub === undefined) state.scannerStationsUnsub = null;
    if (state.currentAdminStats === undefined) state.currentAdminStats = null;
    if (state.lastScannerScanKey === undefined) state.lastScannerScanKey = '';
    if (state.scannerSessions === undefined) state.scannerSessions = {};
    if (state.ultimoDocHistorial === undefined) state.ultimoDocHistorial = null;
    if (state.tipoHistorialActivo === undefined) state.tipoHistorialActivo = null;
    if (state.visitUser === undefined) state.visitUser = null;
    if (state.currentPrestamoData === undefined) state.currentPrestamoData = null;
    if (state.currentDevolData === undefined) state.currentDevolData = null;
    if (state.currentCondonacionData === undefined) state.currentCondonacionData = null;
    if (state.currentServiceType === undefined) state.currentServiceType = null;
    if (state.selectedAssetId === undefined) state.selectedAssetId = null;
    if (state.selectedTimeBlock === undefined) state.selectedTimeBlock = null;
    if (state.holidayCalendarCursor === undefined) state.holidayCalendarCursor = null;
    if (state.holidaySelectedDates === undefined) state.holidaySelectedDates = [];
    if (state.holidayBlockedDates === undefined) state.holidayBlockedDates = [];
    if (state.holidaySelectionAnchor === undefined) state.holidaySelectionAnchor = null;
    if (state.holidayCalendarMeta === undefined) state.holidayCalendarMeta = null;
    if (state.inventorySession === undefined) state.inventorySession = null;
    if (state.inventoryCatalogSummary === undefined) state.inventoryCatalogSummary = null;
    if (state.inventoryFoundEntries === undefined) state.inventoryFoundEntries = [];
    if (state.inventoryMissingEntries === undefined) state.inventoryMissingEntries = [];
    if (state.inventoryLookupResults === undefined) state.inventoryLookupResults = [];
    if (state.inventorySelectedBook === undefined) state.inventorySelectedBook = null;
    if (state.inventoryAssociateMode === undefined) state.inventoryAssociateMode = false;
    if (state.inventoryCopyLookupResults === undefined) state.inventoryCopyLookupResults = [];
    if (state.inventorySelectedCopyBase === undefined) state.inventorySelectedCopyBase = null;
    if (state.inventoryMoreCopiesMode === undefined) state.inventoryMoreCopiesMode = false;
    if (state.inventoryPendingCopyCodes === undefined) state.inventoryPendingCopyCodes = [];
    if (state.inventoryDraftQuantity === undefined) state.inventoryDraftQuantity = null;
    if (state.inventorySearchDebounce === undefined) state.inventorySearchDebounce = null;
    if (state.inventoryScannerActive === undefined) state.inventoryScannerActive = false;
    if (state.inventoryScannerStream === undefined) state.inventoryScannerStream = null;
    if (state.inventoryScannerLoopId === undefined) state.inventoryScannerLoopId = null;
    if (state.inventoryScannerSupported === undefined) state.inventoryScannerSupported = false;
    if (state.inventoryDetector === undefined) state.inventoryDetector = null;
    if (state.inventoryModalHiddenBound === undefined) state.inventoryModalHiddenBound = false;
    if (state.inventorySaving === undefined) state.inventorySaving = false;
    if (state.inventoryDuplicateSearch === undefined) state.inventoryDuplicateSearch = false;
    if (state.inventoryUnregisteredMode === undefined) state.inventoryUnregisteredMode = 'new';
    if (state.inventoryUnregisteredCopyBase === undefined) state.inventoryUnregisteredCopyBase = null;
    if (state.inventoryReviewPage === undefined) state.inventoryReviewPage = 1;
    if (state.inventoryReviewEditingId === undefined) state.inventoryReviewEditingId = '';
    if (state.inventoryReviewDraftQuantity === undefined) state.inventoryReviewDraftQuantity = 0;
    if (state.inventoryReviewPendingCopyCodes === undefined) state.inventoryReviewPendingCopyCodes = [];
    if (state.inventoryReviewAdjusting === undefined) state.inventoryReviewAdjusting = false;
    if (state.inventoryReviewAdjustInterval === undefined) state.inventoryReviewAdjustInterval = null;
    if (state.inventoryReviewSearchTerm === undefined) state.inventoryReviewSearchTerm = '';
    if (state.inventoryReviewKnownCopies === undefined) state.inventoryReviewKnownCopies = [];
    if (state.inventoryReviewCopiesLoading === undefined) state.inventoryReviewCopiesLoading = false;
    if (state.inventorySearchQuery === undefined) state.inventorySearchQuery = '';

    function clearLiveAssetStreams() {
        if (state.pcGridUnsub) {
            try { state.pcGridUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing PC stream:', error); }
            state.pcGridUnsub = null;
        }

        if (state.configAssetsUnsub) {
            try { state.configAssetsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing config stream:', error); }
            state.configAssetsUnsub = null;
        }
    }

    function cleanupRuntime() {
        clearLiveAssetStreams();
        state.currentAdminStats = null;
        state.lastScannerScanKey = '';
        state.scannerSessions = {};

        if (state.scannerStationsUnsub) {
            try { state.scannerStationsUnsub(); } catch (error) { console.warn('[BiblioAdmin] Error clearing scanner stream:', error); }
            state.scannerStationsUnsub = null;
        }

        if (state.adminStatsInterval) {
            clearInterval(state.adminStatsInterval);
            state.adminStatsInterval = null;
        }

        if (state.clockInterval) {
            clearInterval(state.clockInterval);
            state.clockInterval = null;
        }

        if (window.AdminBiblio.stopInventoryScanner) {
            try { window.AdminBiblio.stopInventoryScanner(); } catch (error) { console.warn('[BiblioAdmin] Error clearing inventory scanner:', error); }
        }
    }

    function init(ctx) {
        cleanupRuntime();
        state.ctx = ctx;

        if (state.ctx?.ModuleManager?.addSubscription) {
            state.ctx.ModuleManager.addSubscription(cleanupRuntime);
        }

        const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
        const simProfileJson = localStorage.getItem('sia_simulated_profile');
        let role = state.ctx?.profile?.role || 'student';

        if (isDevMode && simProfileJson) {
            try {
                const sim = JSON.parse(simProfileJson);
                if (sim.role) role = sim.role;
                if (!state.ctx.profile) state.ctx.profile = sim;
                console.log('[Biblio] Dev Mode Detectado: Rol ' + role);
            } catch (error) {
                console.error(error);
            }
        }

        if (!state.ctx?.profile && state.ctx?.auth?.currentUser && !isDevMode) {
            state.ctx.db.collection('usuarios').doc(state.ctx.auth.currentUser.uid).get().then((doc) => {
                const fetchedRole = doc.data()?.role || 'biblio';
                if (!state.ctx.profile) state.ctx.profile = { role: fetchedRole };
                window.AdminBiblio.Reportes.initAdmin();
            });
        } else {
            window.AdminBiblio.Reportes.initAdmin();
        }
    }

    const modExports = {
        init,
        cleanupRuntime,
        clearLiveAssetStreams,
        decodeItemPayload: (...args) => window.AdminBiblio.Shared.decodeItemPayload(...args)
    };

    if (window.AdminBiblio.Catalogo) Object.assign(modExports, window.AdminBiblio.Catalogo);
    if (window.AdminBiblio.Prestamos) Object.assign(modExports, window.AdminBiblio.Prestamos);
    if (window.AdminBiblio.Devoluciones) Object.assign(modExports, window.AdminBiblio.Devoluciones);
    if (window.AdminBiblio.Historial) Object.assign(modExports, window.AdminBiblio.Historial);
    if (window.AdminBiblio.Inventario) Object.assign(modExports, window.AdminBiblio.Inventario);
    if (window.AdminBiblio.Reportes) Object.assign(modExports, window.AdminBiblio.Reportes);

    return Object.assign(window.AdminBiblio || {}, modExports);
})());
