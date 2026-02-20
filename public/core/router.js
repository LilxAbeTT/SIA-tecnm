import { Store } from './state.js';

export class Router {
    constructor(uiManager) {
        this.ui = uiManager;
        this._activeSubscriptions = []; // Initialize array
        this.routes = {
            'view-dashboard': '/dashboard',
            'view-aula': '/aula',
            'view-biblio': '/biblio',
            'view-medi': '/medi',
            'view-foro': '/foro',
            'view-profile': '/profile',
            'view-superadmin-dashboard': '/superadmin', // [NEW]
            'view-lactario': '/lactario', // [NEW]
            'view-quejas': '/quejas',
            'view-reportes': '/reportes',
            'view-encuestas': '/encuestas',
            'view-encuesta-publica': '/encuesta-publica',
            'view-register': '/register'
        };

        // Reverse map for URL -> View ID
        this.urlMap = Object.entries(this.routes).reduce((acc, [k, v]) => {
            acc[v] = k;
            return acc;
        }, {});

        // Listen to hashchange for robust SPA routing on any server
        window.addEventListener('hashchange', () => this.handleLocation());

        // Keep popstate for backward compatibility
        window.addEventListener('popstate', (e) => {
            this.handleLocation();
        });
    }

    init() {
        this.handleLocation();
    }

    // New helper to parse path regardless of Hash or History mode
    _getCurrentPath() {
        // Priority: Hash (e.g. #/aula) -> Path (e.g. /aula)
        const hash = window.location.hash.slice(1); // Remove #
        if (hash) return hash;

        const path = window.location.pathname;
        return path === '/index.html' ? '/' : path;
    }

    handleLocation() {
        // FIX: Support both Hash (priority) and Path
        const path = this._getCurrentPath();
        const role = Store.userProfile ? Store.userProfile.role : null;

        if (path === '/' || path === '' || path === '/index.html') {
            if (Store.user) {
                const defaultView = this._getDefaultView(role);
                // Instead of calling navigate (which sets hash), just replace hash if empty
                if (!window.location.hash) {
                    this.navigate(defaultView, true, true);
                } else {
                    this._renderView(defaultView);
                }
            } else {
                this.ui.showLanding();
            }
            return;
        }

        // Check explicit routes
        let viewId = this.urlMap[path];

        // Handle sub-routes via simple matching
        if (!viewId) {
            if (path.startsWith('/aula')) viewId = 'view-aula';
            else if (path.startsWith('/biblio')) viewId = 'view-biblio';
            else if (path.startsWith('/medi')) viewId = 'view-medi';
            else if (path.startsWith('/foro')) viewId = 'view-foro';
            else if (path.startsWith('/profile')) viewId = 'view-profile';
            else if (path.startsWith('/lactario')) viewId = 'view-lactario';
            else if (path.startsWith('/quejas')) viewId = 'view-quejas';
            else if (path.startsWith('/reportes')) viewId = 'view-reportes';
            else if (path.startsWith('/encuesta-publica')) viewId = 'view-encuesta-publica';
            else if (path.startsWith('/encuestas')) viewId = 'view-encuestas';
            else if (path.startsWith('/superadmin')) viewId = 'view-superadmin-dashboard';
        }

        // Public survey route - no auth required
        if (viewId === 'view-encuesta-publica') {
            this._renderView(viewId);
            return;
        }

        if (viewId && Store.user) {
            if (this._canAccess(viewId, role)) {
                this._renderView(viewId);
            } else {
                const defaultView = this._getDefaultView(role);
                this.navigate(defaultView, true, true);
            }
        } else if (viewId && !Store.user) {
            this.ui.showLanding();
        } else {
            // 404 or unknown
            this.ui.showLanding();
        }
    }

    // Separated render logic from navigate to avoid loops
    _renderView(viewId) {
        // Hide all views first
        document.querySelectorAll('.app-view').forEach(el => el.classList.add('d-none'));

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('d-none');
        } else {
            console.error(`Vista no encontrada: ${viewId}`);
            return;
        }

        // Trigger module load (Legacy adaptation)
        this._dispatchViewEvent(viewId);

        // Update breadcrumbs/UI helpers
        this._updateBreadcrumbs(viewId);
    }

    _getDefaultView(role) {
        if (!role) return 'view-dashboard';

        // [NEW] Logic: If multiple allowedViews, default to Dashboard (Department Dashboard)
        const profile = Store.userProfile;
        if (profile && profile.allowedViews && profile.allowedViews.length > 1) {
            return 'view-dashboard';
        }

        if (role === 'bibliotecario' || role === 'biblio' || role === 'biblio_admin') return 'view-biblio';
        if (role === 'medico' || role === 'medico_oficial') return 'view-medi'; // Doctor goes strictly to Medi

        // Psicologo has multiple views (medi + lactario), so if it wasn't caught above (no profile yet?), fallback to dashboard or medi
        if (role === 'psicologo' || role === 'medico_psicologo') return 'view-medi';

        if (role === 'aula_admin') return 'view-aula';
        if (role === 'foro_admin') return 'view-foro';
        if (role === 'superadmin') return 'view-superadmin-dashboard';
        return 'view-dashboard';
    }

    _canAccess(viewId, role) {
        if (!role) return false;
        if (viewId === 'view-profile') return true;

        // [NEW] 1. Priority: Check allowedViews from Profile (Dynamic Permissions)
        const profile = Store.userProfile;
        if (profile && profile.allowedViews && Array.isArray(profile.allowedViews)) {
            // Check if view is in list OR is sub-view (e.g. view-aula-course starts with view-aula)
            const isAllowed = profile.allowedViews.some(av => viewId === av || viewId.startsWith(av + '-'));

            // Exception: Allow DASHBOARD if user has > 1 view (Department Dashboard)
            if (viewId === 'view-dashboard' && profile.allowedViews.length > 1) return true;

            if (isAllowed) return true;
            // Don't return false yet, check legacy roles as fallback? No, Strict Mode.
            // But wait, what if allowedViews is partial? Let's fallback only if allowedViews is empty?
            if (profile.allowedViews.length > 0) return false;
        }

        if (role === 'student' || role === 'admin' || role === 'docente' || role === 'personal' || role === 'department_admin') {
            return true;
        }

        if (role === 'bibliotecario' || role === 'biblio' || role === 'biblio_admin') return viewId === 'view-biblio';

        // Loose role checks for fallback
        if (role === 'medico') return viewId === 'view-medi';
        if (role === 'medico_oficial') return viewId === 'view-medi' || viewId === 'view-dashboard'; // Doctor
        if (role === 'psicologo' || role === 'medico_psicologo') {
            // OLD Strict: return viewId === 'view-medi';
            // NEW: Allow dashboard + lactario + medi
            return viewId === 'view-medi' || viewId === 'view-lactario' || viewId === 'view-dashboard';
        }

        if (role === 'aula_admin') return viewId === 'view-aula' || viewId === 'view-dashboard'; // Allow dashboard for testing
        if (role === 'foro_admin') return viewId === 'view-foro';
        if (role === 'superadmin') return true;

        if (viewId === 'view-quejas') return true; // Allow all authenticated roles to access Quejas
        if (viewId === 'view-encuestas') return true; // Allow all authenticated roles to access Encuestas

        return false;
    }

    async navigate(viewId, pushState = true, skipAuthCheck = false) {
        if (!Store.user && viewId !== 'landing' && !skipAuthCheck) {
            console.warn("Navegación bloqueada: Usuario no autenticado.");
            this.ui.showLanding();
            return;
        }

        const role = Store.userProfile ? Store.userProfile.role : null;

        // Security Check (Fixed)
        if (!skipAuthCheck && Store.user && !this._canAccess(viewId, role)) {
            console.warn(`Acceso denegado a ${viewId} para rol ${role}`);
            const defaultView = this._getDefaultView(role);
            if (viewId !== defaultView) {
                this.navigate(defaultView, true, true);
                return;
            }
        }


        // CLEAR OLD SUBSCRIPTIONS
        this._clearSubscriptions();

        if (viewId === 'landing') {
            this.ui.showLanding();
            if (pushState) history.pushState({ viewId }, '', '/');
            return;
        }

        // LAZY LOAD MODULES (New Architecture)
        this.ui.showLoader();
        await this._loadModuleDependencies(viewId);
        this.ui.hideLoader();

        // Update Store
        Store.currentView = viewId;

        // Show App Shell if hidden
        this.ui.showApp();

        // Update URL
        if (pushState) {
            const path = this.routes[viewId] || '/dashboard';
            history.pushState({ viewId }, '', path);
        }

        // Hide all views first
        document.querySelectorAll('.app-view').forEach(el => el.classList.add('d-none'));

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('d-none');
        } else {
            console.error(`Vista no encontrada: ${viewId}`);
            // Fallback?
        }

        // Trigger module load (Legacy adaptation)
        this._dispatchViewEvent(viewId);

        // Update breadcrumbs/UI helpers
        this._updateBreadcrumbs(viewId);
    }

    async _loadModuleDependencies(viewId) {
        const role = Store && Store.userProfile ? Store.userProfile.role : null;
        const isMediAdmin = role === 'medico' || role === 'docente_medico' || role === 'Psicologo' || role === 'superadmin';
        const isBiblioAdmin = role === 'biblio' || role === 'bibliotecario' || role === 'biblio_admin' || role === 'superadmin';
        const isForoAdmin = (Store && Store.userProfile && Store.userProfile.permissions && (Store.userProfile.permissions.foro === 'admin' || Store.userProfile.permissions.foro === 'superadmin')) || (Store && Store.userProfile && Store.userProfile.email === 'difusion@loscabos.tecnm.mx');

        const modules = {
            'view-biblio': [
                '/services/biblio-service.js',
                '/services/biblio-assets-service.js',
                isBiblioAdmin ? '/modules/admin.biblio.js' : '/modules/biblio.js'
            ],
            'view-medi': [
                '/services/medi-service.js',
                '/services/medi-chat-service.js',
                isMediAdmin ? '/modules/admin.medi.js' : '/modules/medi.js'
            ],
            'view-aula': [
                '/services/aula-service.js',
                '/modules/aula.js',
                '/modules/aula.content.js'
            ],
            'view-aula-course': [
                '/services/aula-service.js',
                '/modules/aula.js',
                '/modules/aula.content.js'
            ],
            'view-foro': [
                '/services/foro-service.js',
                isForoAdmin ? '/modules/admin.foro.js' : '/modules/foro.js'
            ],
            'view-profile': [
                '/modules/profile.js'
            ],
            'view-superadmin-dashboard': [ // [NEW]
                '/services/admin-service.js',
                '/services/audit-service.js',
                '/modules/admin.users.js',
                '/modules/admin.system.js',
                '/modules/admin.audit.js'
            ],
            'view-lactario': [
                '/services/lactario-service.js',
                '/modules/lactario.js'
            ],
            'view-quejas': [
                '/services/quejas-service.js',
                '/modules/quejas.js'
            ],
            'view-reportes': [
                '/services/reportes-service.js',
                '/modules/reportes.js'
            ],
            'view-encuestas': [
                '/services/encuestas-service.js',
                '/modules/encuestas.js'
            ],
            'view-encuesta-publica': [
                '/services/encuestas-service.js',
                '/modules/encuestas.js'
            ]
        };

        const dependencies = modules[viewId];
        if (!dependencies) return;

        for (const src of dependencies) {
            await this._injectScript(src);
        }
    }

    _addSubscription(unsubFunc) {
        if (typeof unsubFunc === 'function') {
            this._activeSubscriptions.push(unsubFunc);
        }
    }

    _clearSubscriptions() {
        if (this._activeSubscriptions && this._activeSubscriptions.length > 0) {
            this._activeSubscriptions.forEach(u => {
                try { u(); } catch (e) { console.warn("[Router] Error unsubscribing:", e); }
            });
        }
        this._activeSubscriptions = [];
    }

    _injectScript(src) {
        if (!this._scriptPromises) this._scriptPromises = {};
        if (this._scriptPromises[src]) {
            return this._scriptPromises[src];
        }

        const promise = new Promise((resolve, reject) => {
            // Check if script already exists dynamically
            const existing = document.querySelector(`script[src^="${src}"]`);
            if (existing) {
                // If script exists and has finished loading, its global should be ready
                const isMedi = src.includes('/modules/medi.js');
                const isAdminMedi = src.includes('/modules/admin.medi.js');

                // If it's fully loaded, the globals exist. If they don't, it MIGHT be currently downloading.
                // But since we track promises now, if it was injected by US, we'd have the promise.
                // If it was injected by index.html, we wait for its load event just in case.
                if ((isMedi && window.Medi) || (isAdminMedi && window.AdminMedi) || (!isMedi && !isAdminMedi)) {
                    resolve();
                    return;
                } else {
                    // It exists but global is missing. It might be downloading from HTML.
                    existing.addEventListener('load', () => resolve());
                    existing.addEventListener('error', (e) => reject(e));
                    // What if it never loads or already failed? We can't easily know without a timeout.
                    // For safety, let's just create a new one if it takes more than 5s.
                    setTimeout(() => resolve(), 5000);
                    return;
                }
            }

            const script = document.createElement('script');
            const version = window.SIA_VERSION || Date.now();
            script.src = `${src}?v=${version}`;
            script.async = false;

            script.onload = () => {
                console.log(`[Router] Loaded: ${src}`);
                resolve();
            };

            script.onerror = (e) => {
                console.error(`[Router] Failed to load: ${src}`, e);
                delete this._scriptPromises[src]; // Allow retry
                reject(e);
            };

            document.body.appendChild(script);
        });

        this._scriptPromises[src] = promise;
        return promise;
    }

    _dispatchViewEvent(viewId) {
        // Here we can call the module logic. 
        const event = new CustomEvent('sia-view-changed', { detail: { viewId } });
        window.dispatchEvent(event);

        // [LEGACY ADAPTER] Initialize Global Modules
        // Mimic app.js getContext()
        const ctx = {
            db: window.SIA ? window.SIA.db : null,
            auth: window.SIA ? window.SIA.auth : null,
            user: Store.user,
            profile: Store.userProfile,
            // Pass a ModuleManager that links to Router's subscription manager
            ModuleManager: {
                addSubscription: (fn) => this._addSubscription(fn),
                clearAll: () => this._clearSubscriptions()
            },
            Notify: window.Notify,
            navigate: this.navigate.bind(this),
            activeUnsubs: { push: (fn) => this._addSubscription(fn) }
        };


        // Specific Legacy Hooks
        if (viewId === 'view-dashboard' && window.updateDashboardWidgets) {
            window.updateDashboardWidgets();
        }

        if (viewId === 'view-biblio') {
            const role = Store && Store.userProfile ? Store.userProfile.role : null;
            const isBiblioAdmin = role === 'biblio' || role === 'bibliotecario' || role === 'biblio_admin' || role === 'superadmin';

            if (isBiblioAdmin && window.AdminBiblio && window.AdminBiblio.init) {
                window.AdminBiblio.init(ctx);
            } else if (!isBiblioAdmin && window.Biblio && window.Biblio.init) {
                window.Biblio.init(ctx);
            }
        }

        if (viewId === 'view-medi') {
            const role = Store && Store.userProfile ? Store.userProfile.role : null;
            const isMediAdmin = role === 'medico' || role === 'docente_medico' || role === 'Psicologo' || role === 'superadmin';

            if (isMediAdmin && window.AdminMedi && window.AdminMedi.init) {
                window.AdminMedi.init(ctx);
            } else if (!isMediAdmin && window.Medi && window.Medi.initStudent) {
                window.Medi.initStudent(ctx);
            }
        }

        if (viewId === 'view-aula' && window.Aula && window.Aula.init) {
            window.Aula.init(ctx);
        }

        if (viewId === 'view-aula-course' && window.SIA_currentCourseId && window.AulaContent) {
            window.AulaContent.initCourse(ctx, window.SIA_currentCourseId);
        }

        if (viewId === 'view-foro') {
            const role = Store && Store.userProfile ? Store.userProfile.role : null;
            const isForoAdmin = (Store && Store.userProfile && Store.userProfile.permissions && (Store.userProfile.permissions.foro === 'admin' || Store.userProfile.permissions.foro === 'superadmin')) || (Store && Store.userProfile && Store.userProfile.email === 'difusion@loscabos.tecnm.mx');

            if (isForoAdmin && window.AdminForo && window.AdminForo.init) {
                window.AdminForo.init(ctx);
            } else if (!isForoAdmin && window.Foro && window.Foro.init) {
                window.Foro.init(ctx);
            }
        }

        if (viewId === 'view-profile' && window.Profile && window.Profile.init) {
            // Profile uses a different signature in some versions, but check:
            if (window.Profile.init) window.Profile.init(ctx);
        }

        if (viewId === 'view-lactario') {
            console.log('[Router] Attempting to init Lactario. window.Lactario exists:', !!window.Lactario);
            if (window.Lactario && window.Lactario.init) {
                window.Lactario.init(ctx);
            } else {
                console.error('[Router] Lactario module not found or missing init!');
            }
        }

        if (viewId === 'view-quejas') {
            if (window.Quejas && window.Quejas.init) {
                window.Quejas.init(ctx);
            } else {
                console.error('[Router] Quejas module not found!');
            }
        }

        if (viewId === 'view-superadmin-dashboard') {
            if (window.AdminUsers && window.AdminUsers.init) window.AdminUsers.init(ctx);
            if (window.AdminSystem && window.AdminSystem.init) window.AdminSystem.init(ctx);
            if (window.AdminAudit && window.AdminAudit.init) window.AdminAudit.init(ctx);
        }

        if (viewId === 'view-reportes') {
            if (window.Reportes && window.Reportes.init) {
                window.Reportes.init(ctx);
            } else {
                console.error('[Router] Reportes module not found!');
            }
        }

        if (viewId === 'view-encuestas') {
            if (window.Encuestas && window.Encuestas.init) {
                window.Encuestas.init(ctx);
            } else {
                console.error('[Router] Encuestas module not found!');
            }
        }

        if (viewId === 'view-encuesta-publica') {
            const hash = window.location.hash || '';
            const surveyId = hash.replace('#/encuesta-publica/', '').split('?')[0];
            if (window.Encuestas && window.Encuestas.initPublic) {
                window.Encuestas.initPublic(surveyId);
            }
        }
    }

    _updateBreadcrumbs(viewId) {
        const breadcrumb = document.getElementById('breadcrumb-current');
        if (breadcrumb) {
            const labels = {
                'view-dashboard': 'Inicio',
                'view-aula': 'Aula Virtual',
                'view-biblio': 'Biblioteca',
                'view-medi': 'Servicios Médicos',
                'view-foro': 'Foro Escolar',
                'view-lactario': 'Lactario',
                'view-reportes': 'Reportes',
                'view-encuestas': 'Encuestas',
                'view-profile': 'Mi Perfil'
            };
            breadcrumb.textContent = labels[viewId] || 'SIA';
        }
    }
}
