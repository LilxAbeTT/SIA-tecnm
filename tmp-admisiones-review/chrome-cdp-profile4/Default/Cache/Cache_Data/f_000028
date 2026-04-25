import { Store } from './state.js';
import { Breadcrumbs } from './breadcrumbs.js';

export class Router {
    constructor(uiManager) {
        this.ui = uiManager;
        this._activeSubscriptions = []; // Initialize array
        this.qaSecretRoute = window.SIA?.getQaSecretLoginConfig?.()?.route || '/qa-portal-k9m2x7c4';
        this.routes = {
            'view-dashboard': '/dashboard',
            'view-aula': '/aula',
            'view-comunidad': '/comunidad',
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
            'view-admisiones-public': '/admisiones',
            'view-register': '/register',
            'view-test-vocacional': '/test-vocacional',
            'view-vocacional-test-active': '/vocacional/test',
            'view-vocacional-admin': '/vocacional-admin',
            'view-cafeteria': '/cafeteria',
            'view-avisos': '/avisos',
            'view-campus-map': '/mapa-campus',
            'view-notificaciones': '/notificaciones',
            'view-qa-secret-login': this.qaSecretRoute
        };

        // Reverse map for URL -> View ID
        this.urlMap = Object.entries(this.routes).reduce((acc, [k, v]) => {
            acc[v] = k;
            return acc;
        }, {});

        // Listen to hashchange for robust SPA routing on any server
        window.addEventListener('hashchange', () => { void this.handleLocation(); });

        // Keep popstate for backward compatibility
        window.addEventListener('popstate', () => {
            void this.handleLocation();
        });
    }

    init() {
        return this.handleLocation();
    }

    // New helper to parse path regardless of Hash or History mode
    _getCurrentPath() {
        // Priority: Hash (e.g. #/aula) -> Path (e.g. /aula)
        const hash = window.location.hash.slice(1); // Remove #
        if (hash) return hash;

        const path = window.location.pathname;
        return path === '/index.html' ? '/' : path;
    }

    _getPathForView(viewId) {
        if (viewId === 'view-aula-course') {
            const courseId = window.SIA_currentCourseId;
            if (courseId) {
                return `/aula/curso/${encodeURIComponent(courseId)}`;
            }
            return this.routes['view-aula'] || '/aula';
        }

        return this.routes[viewId] || '/dashboard';
    }

    async handleLocation() {
        // FIX: Support both Hash (priority) and Path
        const path = this._getCurrentPath();
        const role = Store.userProfile ? Store.userProfile.role : null;

        if (path === '/' || path === '' || path === '/index.html') {
            if (Store.user) {
                const defaultView = this._getDefaultView(role);
                await this.navigate(defaultView, true, true);
            } else {
                this.ui.showLanding();
            }
            return;
        }

        // Check explicit routes
        let viewId = this.urlMap[path];
        if (viewId === 'view-campus-map' && !Store.user) {
            viewId = 'view-campus-map-public';
        }

        // Handle sub-routes via simple matching
        if (!viewId) {
            if (path.startsWith('/aula/curso/')) {
                const rawCourseId = path.split('/aula/curso/')[1] || '';
                const courseId = decodeURIComponent(rawCourseId.split(/[?#]/)[0] || '');
                if (courseId) {
                    window.SIA_currentCourseId = courseId;
                    viewId = 'view-aula-course';
                }
            } else if (path.startsWith('/aula')) viewId = 'view-aula';
            else if (path.startsWith('/comunidad')) viewId = 'view-comunidad';
            else if (path.startsWith('/biblio')) viewId = 'view-biblio';
            else if (path.startsWith('/medi')) viewId = 'view-medi';
            else if (path.startsWith('/foro')) viewId = 'view-foro';
            else if (path.startsWith('/profile')) viewId = 'view-profile';
            else if (path.startsWith('/lactario')) viewId = 'view-lactario';
            else if (path.startsWith('/quejas')) viewId = 'view-quejas';
            else if (path.startsWith('/reportes')) viewId = 'view-reportes';
            else if (path.startsWith('/encuestas')) viewId = 'view-encuestas';
            else if (path.startsWith('/admisiones')) viewId = 'view-admisiones-public';
            else if (path.startsWith('/superadmin')) viewId = 'view-superadmin-dashboard';
            else if (path.startsWith('/test-vocacional')) viewId = 'view-test-vocacional';
            else if (path.startsWith('/vocacional/test')) viewId = 'view-vocacional-test-active';
            else if (path.startsWith('/vocacional-admin')) viewId = 'view-vocacional-admin';
            else if (path.startsWith('/cafeteria')) viewId = 'view-cafeteria';
            else if (path.startsWith('/avisos')) viewId = 'view-avisos';
            else if (path.startsWith('/mapa-campus')) {
                viewId = Store.user ? 'view-campus-map' : 'view-campus-map-public';
            }
            else if (path.startsWith('/notificaciones')) viewId = 'view-notificaciones';
        }

        // Public routes - no auth required
        if (viewId === 'view-encuesta-publica'
            || viewId === 'view-admisiones-public'
            || viewId === 'view-test-vocacional'
            || viewId === 'view-vocacional-test-active'
            || viewId === 'view-campus-map-public'
            || viewId === 'view-qa-secret-login') {
            this.ui.showLoader();
            await this._loadModuleDependencies(viewId);
            this.ui.hideLoader();
            this._renderView(viewId);
            return;
        }

        if (viewId && Store.user) {
            if (this._canAccess(viewId, role)) {
                await this.navigate(viewId, false, true);
            } else {
                const defaultView = this._getDefaultView(role);
                await this.navigate(defaultView, true, true);
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
        Store.currentView = viewId;

        // Ocultar landing y app-shell si es una vista publica
        if (viewId === 'view-test-vocacional'
            || viewId === 'view-vocacional-test-active'
            || viewId === 'view-encuesta-publica'
            || viewId === 'view-admisiones-public'
            || viewId === 'view-campus-map-public'
            || viewId === 'view-qa-secret-login') {
            const landing = document.getElementById('landing-view');
            const appshell = document.getElementById('app-shell');
            if (landing) landing.classList.add('d-none');
            // Check if it's external or inner app
            if (viewId !== 'view-encuesta-publica') {
                if (appshell) appshell.classList.add('d-none');
            }
            document.querySelectorAll('.sia-public-view').forEach(el => el.classList.add('d-none'));
        }

        // Hide all views first
        document.querySelectorAll('.app-view').forEach(el => el.classList.add('d-none'));

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('d-none');

            // Forzar refresh si es landing de vocacional
            if (viewId === 'view-test-vocacional') {
                const landingComp = target.querySelector('vocacional-landing');
                if (landingComp && typeof landingComp.refresh === 'function') {
                    setTimeout(() => landingComp.refresh(), 0);
                }
            }
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
        const profile = Store.userProfile;
        if (window.SIA?.getHomeView) {
            return window.SIA.getHomeView(profile || { role });
        }

        if (!role) return 'view-dashboard';
        if (role === 'bibliotecario' || role === 'biblio' || role === 'biblio_admin') return 'view-biblio';
        if (role === 'medico' || role === 'medico_oficial') return 'view-medi'; // Doctor goes strictly to Medi

        // Psicologo has multiple views (medi + lactario), so if it wasn't caught above (no profile yet?), fallback to dashboard or medi
        if (role === 'psicologo' || role === 'medico_psicologo') return 'view-medi';

        if (role === 'aula_admin') return 'view-aula';
        if (role === 'foro_admin') return 'view-foro';
        if (role === 'superadmin') return 'view-superadmin-dashboard';
        return 'view-dashboard';
    }

    _canTeachInAula(profile) {
        if (window.SIA?.canTeachInAula) {
            return window.SIA.canTeachInAula(profile);
        }
        const role = profile?.role || '';
        return ['docente', 'aula_admin', 'admin', 'aula', 'superadmin'].includes(role) ||
            (profile && profile.permissions && (profile.permissions.aula === 'admin' || profile.permissions.aula === 'docente'));
    }

    _canAccess(viewId, role) {
        const profile = Store.userProfile;
        if (window.SIA?.canAccessView) {
            return window.SIA.canAccessView(profile || { role }, viewId);
        }

        if (!role) return false;
        if (viewId === 'view-profile' || viewId === 'view-campus-map') return true;

        if (viewId === 'view-avisos') {
            if (role === 'department_admin') {
                return profile?.permissions?.avisos === 'admin';
            }
            return true;
        }

        // [NEW] 1. Priority: Check allowedViews from Profile (Dynamic Permissions)
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

        if (role === 'aula_admin') return viewId === 'view-aula' || viewId.startsWith('view-aula-') || viewId === 'view-dashboard'; // Allow dashboard for testing
        if (role === 'foro_admin') return viewId === 'view-foro';
        if (role === 'superadmin') return true;

        if (viewId === 'view-quejas') return true; // Allow all authenticated roles to access Quejas
        if (viewId === 'view-encuestas') return true; // Allow all authenticated roles to access Encuestas
        if (viewId === 'view-cafeteria') return true; // Allow all authenticated roles to access Cafeteria

        return false;
    }

    async navigate(viewId, pushState = true, skipAuthCheck = false) {
        if (viewId === 'view-aula-course' && !window.SIA_currentCourseId) {
            viewId = 'view-aula';
        }

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
            const path = this._getPathForView(viewId);
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
        const profile = Store && Store.userProfile ? Store.userProfile : null;
        const isMediAdmin = window.SIA?.canAdminMedi ? window.SIA.canAdminMedi(profile) : false;
        const isBiblioAdmin = window.SIA?.canAdminBiblio ? window.SIA.canAdminBiblio(profile) : false;
        const isForoAdmin = window.SIA?.canAdminForo ? window.SIA.canAdminForo(profile) : false;
        const isComunidadAdmin = window.SIA?.canAdminComunidad ? window.SIA.canAdminComunidad(profile) : false;
        const isAulaAdmin = this._canTeachInAula(profile);
        const isCafeteriaAdmin = window.SIA?.canAdminCafeteria ? window.SIA.canAdminCafeteria(profile) : false;
        const aulaDependencies = [
            '/config/aula-subject-catalog.js',
            '/modules/aula/aula-class-form.js',
            '/services/aula-service.js',
            '/modules/aula/aula-clase.js',
            '/modules/aula/aula-publicar.js',
            '/modules/aula/aula-entregas.js',
            '/modules/aula/aula-portfolio.js',
            '/modules/aula/aula-grupos.js',
            ...(isAulaAdmin
                ? ['/modules/aula/aula-analytics.js', '/modules/admin.aula.js']
                : ['/modules/aula/aula-deadlines.js', '/modules/aula/aula-student.js']),
            '/modules/aula.js'
        ];

        const modules = {
            'view-biblio': [
                '/services/biblio-service.js',
                '/services/biblio-assets-service.js',
                ...(isBiblioAdmin ? [
                    '/services/scanner-service.js',
                    '/modules/admin-biblio/shared.js',
                    '/modules/admin-biblio/catalogo.js',
                    '/modules/admin-biblio/prestamos.js',
                    '/modules/admin-biblio/devoluciones.js',
                    '/modules/admin-biblio/historial.js',
                    '/modules/admin-biblio/inventario.js',
                    '/modules/admin-biblio/reportes.js',
                    '/modules/admin.biblio.js'
                ] : ['/modules/biblio.js'])
            ],
            'view-medi': [
                '/services/medi-service.js',
                '/services/medi-chat-service.js',
                ...(isMediAdmin ? [
                    '/modules/admin-medi/ui.js',
                    '/modules/admin-medi/agenda.js',
                    '/modules/admin-medi/chat.js',
                    '/modules/admin-medi/consultas.js',
                    '/modules/admin-medi/tools.js',
                    '/modules/admin.medi.js' // Orquestador va al final
                ] : [
                    '/modules/medi/student-experience.js',
                    '/modules/medi/student-chat.js',
                    '/modules/medi/student-appointments.js',
                    '/modules/medi.js'
                ])
            ],
            'view-aula': aulaDependencies,
            'view-aula-course': aulaDependencies,
            'view-comunidad': [
                '/services/comunidad-service.js',
                '/services/comunidad-chat-service.js',
                '/modules/comunidad/comunidad.shared.js',
                '/modules/comunidad/comunidad.student.js',
                '/modules/comunidad.js',
                ...(isComunidadAdmin ? ['/modules/comunidad/comunidad.admin.js', '/modules/admin.comunidad.js'] : [])
            ],
            'view-foro': [
                '/services/push-service.js',
                '/services/foro-service.js',
                '/services/foro-chat-service.js',
                '/modules/foro/foro.shared.js',
                ...(isForoAdmin
                    ? ['/modules/foro/foro.admin.js', '/modules/admin.foro.js']
                    : ['/modules/foro/foro.student.js', '/modules/foro.js'])
            ],
            'view-profile': [
                '/services/push-service.js',
                '/modules/profile.js'
            ],
            'view-superadmin-dashboard': [
                '/services/superadmin-service.js',
                '/modules/superadmin.js'
            ],
            'view-lactario': [
                '/services/medi-service.js',
                '/services/lactario-service.js',
                '/modules/lactario/lactario.shared.js',
                '/modules/lactario/lactario.student.js',
                '/modules/lactario/lactario.admin.js',
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
                '/services/encuestas-servicio-service.js',
                '/modules/encuestas/encuestas-ui.js',
                '/modules/encuestas/encuestas-forms.js',
                '/modules/encuestas/encuestas-responses.js',
                '/modules/encuestas/encuestas-nav.js',
                '/modules/encuestas.js'
            ],
            'view-encuesta-publica': [
                '/services/encuestas-service.js',
                '/modules/encuestas/encuestas-ui.js',
                '/modules/encuestas/encuestas-forms.js',
                '/modules/encuestas/encuestas-responses.js',
                '/modules/encuestas/encuestas-nav.js',
                '/modules/encuestas.js'
            ],
            'view-admisiones-public': [
                '/modules/admisiones-public.js'
            ],
            'view-vocacional-admin': [
                '/services/vocacional-service.js',
                '/modules/vocacional-admin.js'
            ],
            'view-cafeteria': [
                '/services/cafeteria-service.js',
                isCafeteriaAdmin ? '/modules/admin.cafeteria.js' : '/modules/cafeteria.js'
            ],
            'view-avisos': [
                '/modules/avisos.js'
            ],
            'view-campus-map': [
                '/modules/campus-map/data.js',
                '/modules/campus-map.js'
            ],
            'view-campus-map-public': [
                '/modules/campus-map/data.js',
                '/modules/campus-map.js'
            ],
            'view-notificaciones': [
                '/services/push-service.js',
                '/modules/notifications.js'
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
        const effectiveProfile = Store.userProfile;
        const effectiveAuth = window.SIA?.getEffectiveAuth
            ? window.SIA.getEffectiveAuth(window.SIA ? window.SIA.auth : null, effectiveProfile)
            : (window.SIA ? window.SIA.auth : null);
        const effectiveUser = window.SIA?.getEffectiveSessionUser
            ? window.SIA.getEffectiveSessionUser(window.SIA?.auth?.currentUser || Store.user, effectiveProfile)
            : Store.user;
        const ctx = {
            db: window.SIA ? window.SIA.db : null,
            auth: effectiveAuth,
            storage: window.SIA ? window.SIA.storage : null,
            user: effectiveUser,
            realUser: window.SIA?.auth?.currentUser || Store.user,
            qaActingAs: effectiveProfile?.qaActor || null,
            profile: effectiveProfile,
            // Pass a ModuleManager that links to Router's subscription manager
            ModuleManager: {
                addSubscription: (fn) => this._addSubscription(fn),
                clearAll: () => this._clearSubscriptions()
            },
            Notify: window.Notify,
            navigate: this.navigate.bind(this),
            activeUnsubs: { push: (fn) => this._addSubscription(fn) }
        };
        if (viewId === 'view-biblio') {
            const profile = Store && Store.userProfile ? Store.userProfile : null;
            const isBiblioAdmin = window.SIA?.canAdminBiblio ? window.SIA.canAdminBiblio(profile) : false;

            if (isBiblioAdmin && window.AdminBiblio && window.AdminBiblio.init) {
                window.AdminBiblio.init(ctx);
            } else if (!isBiblioAdmin && window.Biblio && window.Biblio.init) {
                window.Biblio.init(ctx);
            }
        }

        if (viewId === 'view-medi') {
            const profile = Store && Store.userProfile ? Store.userProfile : null;
            const isMediAdmin = window.SIA?.canAdminMedi ? window.SIA.canAdminMedi(profile) : false;

            if (isMediAdmin && window.AdminMedi && window.AdminMedi.init) {
                window.AdminMedi.init(ctx);
            } else if (!isMediAdmin && window.Medi && window.Medi.initStudent) {
                window.Medi.initStudent(ctx);
            }
        }

        if (viewId === 'view-aula' && window.Aula && window.Aula.init) {
            window.Aula.init(ctx);
        }

        if (viewId === 'view-aula-course') {
            const courseId = window.SIA_currentCourseId;
            if (courseId && window.AulaClase && window.AulaClase.init) {
                window.AulaClase.init(ctx, courseId);
            } else if (window.Aula && window.Aula.init) {
                window.Aula.init(ctx);
            }
        }

        if (viewId === 'view-comunidad') {
            const profile = Store && Store.userProfile ? Store.userProfile : null;
            const isComunidadAdmin = window.SIA?.canAdminComunidad ? window.SIA.canAdminComunidad(profile) : false;

            if (isComunidadAdmin && window.AdminComunidad && window.AdminComunidad.init) {
                window.AdminComunidad.init(ctx);
            } else if (window.Comunidad && window.Comunidad.init) {
                window.Comunidad.init(ctx);
            }
        }

        if (viewId === 'view-foro') {
            const profile = Store && Store.userProfile ? Store.userProfile : null;
            const isForoAdmin = window.SIA?.canAdminForo ? window.SIA.canAdminForo(profile) : false;

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

        if (viewId === 'view-vocacional-admin') {
            if (window.AdminVocacional && window.AdminVocacional.init) {
                window.AdminVocacional.init(ctx);
            } else {
                console.error('[Router] AdminVocacional module not found!');
            }
        }

        if (viewId === 'view-superadmin-dashboard') {
            if (window.SuperAdmin && window.SuperAdmin.init) window.SuperAdmin.init(ctx);
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

        if (viewId === 'view-admisiones-public') {
            if (window.AdmisionesPublic && window.AdmisionesPublic.init) {
                window.AdmisionesPublic.init(ctx);
            }
        }

        if (viewId === 'view-cafeteria') {
            const profile = Store && Store.userProfile ? Store.userProfile : null;
            const isCafAdmin = window.SIA?.canAdminCafeteria ? window.SIA.canAdminCafeteria(profile) : false;

            if (isCafAdmin && window.AdminCafeteria && window.AdminCafeteria.init) {
                window.AdminCafeteria.init(ctx);
            } else if (window.Cafeteria && window.Cafeteria.init) {
                window.Cafeteria.init(ctx);
            } else {
                console.error('[Router] Cafeteria module not found!');
            }
        }

        if (viewId === 'view-notificaciones') {
            if (window.Notifications && window.Notifications.init) {
                window.Notifications.init(ctx);
            }
        }

        if (viewId === 'view-avisos') {
            if (window.Avisos && window.Avisos.init) {
                window.Avisos.init(ctx);
            }
        }

        if ((viewId === 'view-campus-map' || viewId === 'view-campus-map-public') && window.CampusMap && window.CampusMap.init) {
            window.CampusMap.init(ctx, { viewId });
        }
    }

    _updateBreadcrumbs(viewId) {
        const currentState = Breadcrumbs.getState();
        if (currentState?.viewId === viewId && currentState.source && currentState.source !== 'view') {
            return currentState;
        }

        return Breadcrumbs.setView(viewId);
        const breadcrumb = document.getElementById('breadcrumb-current');

        if (breadcrumb) {
            const labels = {
                'view-dashboard': 'Inicio',
                'view-aula': 'Aula',
                'view-comunidad': 'Comunidad',
                'view-biblio': 'Biblioteca',
                'view-medi': 'Servicios Médicos',
                'view-foro': 'Eventos',
                'view-lactario': 'Lactario',
                'view-quejas': 'Quejas',
                'view-reportes': 'Reportes',
                'view-encuestas': 'Encuestas',
                'view-profile': 'Mi Perfil',
                'view-superadmin-dashboard': 'SuperAdmin',
                'view-cafeteria': 'Cafetería',
                'view-avisos': 'Avisos',
                'view-campus-map': 'Mapa del Campus',
                'view-notificaciones': 'Notificaciones'
            };
            breadcrumb.textContent = labels[viewId] || 'SIA';
        }
    }
}
