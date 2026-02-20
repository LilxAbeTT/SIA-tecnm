import { Store } from './core/state.js';
import { UiManager } from './core/ui.js';
import { Router } from './core/router.js';
import { AuthManager } from './core/auth.js';

// Initialize Managers
const ui = new UiManager();
const router = new Router(ui);
const auth = new AuthManager(router, ui);

// Global Access (for legacy modules)
window.SIA_CORE = {
    Store,
    ui,
    router,
    auth
};

document.addEventListener('DOMContentLoaded', () => {

    // Initialize Navigation
    // Initialize Navigation
    // router.init(); // FIXED: Removed to prevent flashing Landing Page before Auth is ready. AuthManager will trigger routing.

    // Initialize Auth (needs global SIA.auth/SIA.db from firebase.js)
    // We assume firebase.js runs before this and sets SIA.auth
    const checkFirebase = setInterval(() => {
        if (window.SIA && window.SIA.auth && window.SIA.db) {
            clearInterval(checkFirebase);
            auth.init(window.SIA.auth, window.SIA.db);
        }
    }, 100);

    // Visibility Logic
    Store.on('user-changed', async (user) => {
        if (!user) return;

        // 1. Check Lactario Access
        let showLactario = false;

        // Use window.LactarioService to avoid scope issues in module
        const LactarioService = window.LactarioService;

        if (LactarioService) {
            const acc = await LactarioService.checkAccess(user.profile || user);
            showLactario = acc.allowed;
        } else {
            console.warn("[SIA Main] LactarioService not loaded yet.");
        }

        const btnLactario = document.getElementById('smart-card-lactario-wrapper');
        if (btnLactario) {
            if (showLactario) btnLactario.classList.remove('d-none');
            else btnLactario.classList.add('d-none');
        }

        // 2. Check Allowed Views (for Departamentos/Admins)
        // If allowedViews is defined, ONLY show those modules.
        const moduleMap = {
            'view-aula': '.smart-card[onclick*="view-aula"]',
            'view-medi': '.smart-card[onclick*="view-medi"]',
            'view-biblio': '.smart-card[onclick*="view-biblio"]',
            'view-foro': '.smart-card[onclick*="view-foro"]',
            'view-quejas': '.smart-card[onclick*="view-quejas"]',
            'view-profile': '.smart-card[onclick*="view-profile"]'
        };

        const toggleModule = (key, show) => {
            const card = document.querySelector(moduleMap[key]);
            if (card) {
                const col = card.closest('.col-6'); // Target the bootstrap column to hide layout gap
                if (col) {
                    if (show) col.classList.remove('d-none');
                    else col.classList.add('d-none');
                }
            }
        };

        if (user.allowedViews && Array.isArray(user.allowedViews)) {
            // Hide ALL first
            Object.keys(moduleMap).forEach(key => toggleModule(key, false));

            // Show allowed
            user.allowedViews.forEach(view => toggleModule(view, true));

            // Special Case: Lactario
            const elLact = document.getElementById('smart-card-lactario-wrapper');
            if (user.allowedViews.includes('view-lactario') && elLact) elLact.classList.remove('d-none');

        } else {
            // Normal Student / No restrictions: Show all STANDARD modules
            Object.keys(moduleMap).forEach(key => toggleModule(key, true));
        }
    });
});

// Expose Auth functions to global scope if buttons use onclick="login()"
window.loginWithMicrosoft = () => auth.loginWithMicrosoft();
window.logout = () => auth.logout();
window.navigate = (view) => router.navigate(view);
