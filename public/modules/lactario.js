// public/modules/lactario.js
// Thin orchestrator for Lactario

if (!window.Lactario) {
    window.Lactario = (function () {
        const shared = window.LactarioModule?.Shared;
        const service = window.LactarioService;
        const methodNames = [
            'init',
            'cleanup',
            'openScanner',
            'submitManualQr',
            'cancelBooking',
            'addSpacePrompt',
            'printQR',
            'openFridgeModal',
            'confirmFridgeUse',
            'addFridgePrompt',
            'editFridge',
            'editSpace',
            'switchAdminTab',
            'toggleSpace',
            'deleteSpace',
            'saveAdminConfig',
            'selectDateTab',
            'setStudentDate',
            'selectTime',
            'loadSlotsForDate',
            'refreshStatus',
            'startReschedule',
            'cancelReschedule',
            'loadAdminStats',
            'exportReport',
            'toggleFridge',
            'deleteFridge',
            'refreshAdminOverview',
            'setOverviewDate',
            'loadAdminAgenda',
            'setAgendaDate',
            'setAgendaStatusFilter',
            'setAgendaTypeFilter',
            'adminSetBookingStatus'
        ];

        if (!shared || !service) throw new Error('[Lactario] Shared o Service no cargados.');

        const state = shared.createState();
        let controller = null;

        const api = {
            init,
            cleanup
        };

        methodNames.forEach((name) => {
            if (!api[name]) {
                api[name] = (...args) => delegate(name, ...args);
            }
        });

        return api;

        async function init(ctx) {
            cleanup(false);

            const container = document.getElementById('view-lactario');
            if (!container) return;

            state.ctx = ctx;
            state.profile = ctx?.profile || null;
            state.config = await service.loadConfig(ctx);
            state.access = await service.checkAccess(state.profile);

            if (!state.access?.allowed) {
                controller = null;
                shared.renderAccessDenied(container, state.access?.reason || 'No tienes acceso a Lactario.');
                return;
            }

            state.mode = state.access.isAdmin ? 'admin' : 'student';
            controller = createController(state.mode);
            shared.renderLayout(container, {
                isAdmin: state.access.isAdmin,
                content: controller.render()
            });
            await controller.init(ctx);

            if (ctx?.ModuleManager?.addSubscription) {
                ctx.ModuleManager.addSubscription(() => cleanup(false));
            }
        }

        function cleanup(resetContainer = false) {
            shared.clearTimer(state);
            shared.stopScanner(state).catch(() => { });
            controller?.cleanup?.();
            controller = null;
            state.activeBooking = null;

            if (resetContainer) {
                const container = document.getElementById('view-lactario');
                if (container) container.innerHTML = '';
            }
        }

        function createController(mode) {
            if (mode === 'admin') {
                if (!window.LactarioModule?.Admin?.create) throw new Error('[Lactario] Controlador admin no disponible.');
                return window.LactarioModule.Admin.create(shared, state);
            }

            if (!window.LactarioModule?.Student?.create) throw new Error('[Lactario] Controlador estudiante no disponible.');
            return window.LactarioModule.Student.create(shared, state);
        }

        function delegate(methodName, ...args) {
            if (!controller || typeof controller[methodName] !== 'function') return undefined;
            return controller[methodName](...args);
        }
    })();
}
