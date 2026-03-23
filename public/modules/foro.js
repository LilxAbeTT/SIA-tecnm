// public/modules/foro.js
// Student entrypoint/orchestrator for Foro

console.log('[LOAD] modules/foro.js loaded');

if (!window.Foro) {
    const shared = window.ForoModule?.Shared;
    const methodNames = [
        'init',
        'saveState',
        'restoreState',
        'switchTab',
        'setFilter',
        'handleSearch',
        'handleSort',
        'clearSearch',
        'handleRegister',
        'showTicketQR',
        'openEventDetailModal',
        'toggleFavorite',
        'shareEvent',
        'cancelTicket',
        'downloadCertificate',
        'openFeedbackModal',
        'setFeedbackRating',
        'submitFeedback',
        'downloadCalendar',
        'openResourcesModal',
        'openConversationModal',
        'sendConversationMessage',
        'enableReminders',
        'getDashboardWidget',
        'openStudentScanner',
        'stopStudentScanner',
        'cleanup'
    ];

    if (!shared?.createDelegatedApi) {
        throw new Error('[Foro] Shared module not loaded before orchestrator.');
    }

    window.Foro = shared.createDelegatedApi('Foro', () => {
        if (!window.ForoModule?.Student?.create) {
            throw new Error('[Foro] Student controller not loaded.');
        }
        return window.ForoModule.Student.create();
    }, methodNames);
}
