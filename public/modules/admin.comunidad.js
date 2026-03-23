// public/modules/admin.comunidad.js
// Admin entrypoint/orchestrator for Comunidad

if (!window.AdminComunidad) {
    const shared = window.ComunidadModule?.Shared;
    if (!shared?.createDelegatedApi) throw new Error('[AdminComunidad] Shared no cargado.');

    window.AdminComunidad = shared.createDelegatedApi('AdminComunidad', () => {
        if (!window.ComunidadModule?.Admin?.create) throw new Error('[AdminComunidad] Admin controller no disponible.');
        return window.ComunidadModule.Admin.create();
    }, [
        'init',
        'cleanup',
        'switchTab',
        'setReportStatus',
        'togglePostHidden',
        'togglePostComments',
        'togglePostPinned',
        'setUserStatus',
        'openPost'
    ]);
}
