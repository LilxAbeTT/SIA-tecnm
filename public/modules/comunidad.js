// public/modules/comunidad.js
// Student entrypoint/orchestrator for Comunidad

if (!window.Comunidad) {
    const shared = window.ComunidadModule?.Shared;
    const methodNames = [
        'init',
        'switchTab',
        'setTypeFilter',
        'setScopeFilter',
        'focusPost',
        'exploreType',
        'jumpToFeed',
        'openComposerModal',
        'closeComposerModal',
        'setComposerType',
        'setComposerMode',
        'submitPost',
        'startEditPost',
        'cancelEditPost',
        'deletePost',
        'toggleComments',
        'setReplyTarget',
        'clearReplyTarget',
        'submitComment',
        'toggleReaction',
        'reportPost',
        'closeReportDialog',
        'selectReportReason',
        'submitReport',
        'sharePost',
        'openMessages',
        'openConversation',
        'openConversationWithPostAuthor',
        'sendMessage',
        'openMediaViewer',
        'closeMediaViewer',
        'zoomMediaViewer',
        'stepMediaViewer',
        'focusCommentComposer',
        'replayTutorial',
        'cleanup'
    ];

    if (!shared?.createDelegatedApi) throw new Error('[Comunidad] Shared no cargado.');

    window.Comunidad = shared.createDelegatedApi('Comunidad', () => {
        if (!window.ComunidadModule?.Student?.create) throw new Error('[Comunidad] Student controller no disponible.');
        return window.ComunidadModule.Student.create();
    }, methodNames);
}
