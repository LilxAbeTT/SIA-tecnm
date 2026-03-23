// public/modules/admin.foro.js
// Admin entrypoint/orchestrator for Foro

console.log('[LOAD] modules/admin.foro.js loaded');

if (!window.AdminForo) {
    const shared = window.ForoModule?.Shared;
    const methodNames = [
        'init',
        'crearEvento',
        'openEventModal',
        'handleEventSubmit',
        'deleteEvent',
        'confirmCancelEvent',
        'publishEventQR',
        'publishResourcesQR',
        'viewEventAttendees',
        'exportAttendees',
        'openScanner',
        'stopScanner',
        'refreshDifusionData',
        'handleApprove',
        'openRejectModal',
        'handleRejectSubmit',
        'initDivisionHeadView',
        'renderDivisionEventsTable',
        'previewEventCover',
        'previewCover',
        'openEventDetailsModal',
        'openEventMessages',
        'selectConversation',
        'sendConversationReply',
        'addResourceRow',
        'removeResourceRow',
        'cleanup'
    ];

    if (!shared?.createDelegatedApi) {
        throw new Error('[AdminForo] Shared module not loaded before orchestrator.');
    }

    window.AdminForo = shared.createDelegatedApi('AdminForo', () => {
        if (!window.ForoModule?.Admin?.create) {
            throw new Error('[AdminForo] Admin controller not loaded.');
        }
        return window.ForoModule.Admin.create();
    }, methodNames);
}
