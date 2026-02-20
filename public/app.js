// app.js
// Lógica principal: Auth, Router, Landing y Módulos (VERSIÃ“N CONSOLIDADA PHASE 1+2)

// --- WEB COMPONENTS IMPORTS ---
import './components/landing-view.js';
import './components/register-wizard.js';
import './components/dev-tools.js';
// import { DEPARTMENT_DIRECTORY } from './config/departments.js'; // Loaded globally
import { Store } from './core/state.js';

document.addEventListener('DOMContentLoaded', () => {

  // --- UTILS: DOM & HELPERS (PHASE 1) ---
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  // Helper: Lock/Unlock Body Scroll for Drawers/Modals
  function toggleBodyScroll(forceLock) {
    if (forceLock) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
  }

  // --- MODULE MANAGER (PHASE 1) ---
  const ModuleManager = {
    _subs: [],

    addSubscription(unsubFunc) {
      if (typeof unsubFunc === 'function') {
        this._subs.push(unsubFunc);
      }
    },

    clearAll() {
      // console.log(`[ModuleManager] Limpiando ${this._subs.length} suscripciones.`);
      this._subs.forEach(u => {
        try { u(); } catch (e) { console.warn("Error unsubscribing:", e); }
      });
      this._subs = [];
    }
  };

  // --- MODULE STATE MANAGER (Session-only State Persistence) ---
  const ModuleStateManager = {
    _states: {}, // Almacena { 'view-medi': { step: 2, formData: {...} }, ... }
    _currentView: null,

    /**
     * Guarda el estado actual del módulo antes de salir
     * @param {string} viewId - ID de la vista (ej: 'view-medi')
     */
    saveState(viewId) {
      if (!viewId) return;

      // Buscar si el módulo tiene un método saveState()
      const moduleName = this._getModuleName(viewId);
      if (window[moduleName] && typeof window[moduleName].saveState === 'function') {
        try {
          const state = window[moduleName].saveState();
          if (state) {
            this._states[viewId] = {
              timestamp: Date.now(),
              data: state
            };
            console.log(`ðŸ’¾ [StateManager] Estado guardado para ${viewId}:`, state);
          }
        } catch (e) {
          console.warn(`[StateManager] Error guardando estado de ${viewId}:`, e);
        }
      }
    },

    /**
     * Restaura el estado del módulo al entrar
     * @param {string} viewId - ID de la vista
     * @returns {object|null} El estado guardado o null
     */
    restoreState(viewId) {
      if (!viewId || !this._states[viewId]) return null;

      const saved = this._states[viewId];
      const moduleName = this._getModuleName(viewId);

      // Verificar que no sea muy antiguo (opcional: limitar a 30 minutos)
      const maxAge = 30 * 60 * 1000; // 30 minutos
      if (Date.now() - saved.timestamp > maxAge) {
        console.log(`â° [StateManager] Estado de ${viewId} expirado, limpiando...`);
        delete this._states[viewId];
        return null;
      }

      // Llamar al método restoreState() del módulo si existe
      if (window[moduleName] && typeof window[moduleName].restoreState === 'function') {
        try {
          window[moduleName].restoreState(saved.data);
          console.log(`✅ [StateManager] Estado restaurado para ${viewId}:`, saved.data);
          return saved.data;
        } catch (e) {
          console.warn(`[StateManager] Error restaurando estado de ${viewId}:`, e);
        }
      }

      return saved.data;
    },

    /**
     * Limpia el estado de un módulo específico
     * @param {string} viewId - ID de la vista
     */
    clearState(viewId) {
      if (this._states[viewId]) {
        delete this._states[viewId];
        console.log(`ðŸ—‘ï¸ [StateManager] Estado limpiado para ${viewId}`);
      }
    },

    /**
     * Limpia todos los estados (al recargar o cerrar sesión)
     */
    clearAll() {
      this._states = {};
      this._currentView = null;
      console.log('ðŸ—‘ï¸ [StateManager] Todos los estados limpiados');
    },

    /**
     * Obtiene el nombre del módulo global desde el viewId
     * @private
     */
    _getModuleName(viewId) {
      const map = {
        'view-aula': 'Aula',
        'view-medi': 'Medi',
        'view-biblio': 'Biblio',
        'view-foro': 'Foro',
        'view-quejas': 'Quejas',
        'view-encuestas': 'Encuestas',
        'view-lactario': 'Lactario',
        'view-profile': 'Profile',
        'view-reportes': 'Reportes'
      };
      return map[viewId] || null;
    },

    /**
     * Obtiene el estado actual guardado (para debug)
     */
    getState(viewId) {
      return this._states[viewId]?.data || null;
    },

    /**
     * Hook que se llama al cambiar de vista
     */
    onViewChange(fromView, toView) {
      // Guardar estado del módulo anterior
      if (fromView) {
        this.saveState(fromView);
      }

      // Actualizar vista actual
      this._currentView = toView;

      // El módulo que entra puede llamar a restoreState() en su init()
      // o lo podemos hacer automáticamente aquí si queremos
    }
  };

  // Exponer globalmente para debug
  window.ModuleStateManager = ModuleStateManager;

  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  if (btnLogoutMobile) btnLogoutMobile.addEventListener('click', logout);

  // ==========================================
  // 1. ESTADO GLOBAL
  // ==========================================
  let currentUserProfile = null;
  // let activeUnsubs = []; // REEMPLAZADO POR ModuleManager

  let globalAvisosUnsub = null;
  let globalAvisosRaw = [];
  let globalAvisosData = [];
  let globalAvisosIndex = 0;
  let globalAvisosTimer = null;
  let currentModuleKey = 'general';

  // let notifUnsub = null; // REEMPLAZADO POR Notify.init()

  let _regGoogleUser = null;
  let _regVerificationCode = null;
  let _regTempData = {};

  // ==========================================
  // 2. ELEMENTOS DEL DOM
  // ==========================================
  const appLoader = document.getElementById('app-loader');
  /* 
   * WEB COMPONENTS & LEGACY FALLBACK
   * Buscamos primero el componente Web <sia-landing-view>.
   * Si no existe, buscamos el div antiguo por compatibilidad mientras se migra.
   */
  const landingView = document.querySelector('sia-landing-view') || document.getElementById('landing-view');
  const registerWizard = document.querySelector('sia-register-wizard') || document.getElementById('view-register-wizard');
  const appShell = document.getElementById('app-shell');
  const verifyShell = document.getElementById('verify-shell');

  // Navbar / User Info
  const userEmailNav = document.getElementById('user-email');
  const userEmailDashboard = document.getElementById('user-email-dashboard');
  const btnIngresar = document.getElementById('btn-ingresar');

  const btnLogout = document.getElementById('btn-logout');
  const btnBrandHome = document.getElementById('btn-brand-home');
  const fabAddCourse = document.getElementById('aula-add-course-fab');

  // Navegación
  const navLinks = document.querySelectorAll('.main-header .nav-link');
  const appViews = document.querySelectorAll('.app-view');
  const globalAvisosBanner = document.getElementById('global-avisos-banner');
  const globalAvisosContainer = document.getElementById('global-avisos-container');
  const btnGlobalAvisosModal = document.getElementById('btn-global-avisos-modal');
  const globalTipText = document.getElementById('global-tip-text');

  // Global Search UI
  const searchInputDesktop = document.getElementById('global-search-input-navbar');

  // KPIs (Dashboard) - Usamos optional chaining (?) más adelante por si faltan
  const dashMediCount = document.getElementById('dash-medi-count');
  const dashBiblioCount = document.getElementById('dash-biblio-count');
  const dashAulaCount = document.getElementById('dash-aula-count');
  const dashMediLabel = document.getElementById('dash-medi-label');
  const dashBiblioLabel = document.getElementById('dash-biblio-label');
  const dashAulaLabel = document.getElementById('dash-aula-label');

  // ==========================================
  // 3. SISTEMA DE SEGURIDAD (TIMEOUT MEJORADO - PHASE 1)
  // ==========================================
  // Si Firebase falla o tarda mucho, forzamos la entrada para no dejar al usuario trabado.
  const safetyTimer = setTimeout(() => {
    if (appLoader && !appLoader.classList.contains('d-none')) {
      // 1. Si no hay internet, damos más tiempo o mostramos mensaje, pero NO cargamos landing rota.
      if (!navigator.onLine) {
        console.warn("âš ï¸ Tiempo agotado: SIN CONEXIÃ“N DETECTADA.");
        if (typeof showToast === 'function') showToast("Sin conexión a internet. Esperando red...", "warning");
        return; // Mantenemos el loader esperando red
      }

      // 2. Si hay internet pero Firebase no responde en 10s:
      console.warn("âš ï¸ Tiempo de espera agotado (10s).");

      // Intentamos ver si ya hay una sesión "flotando" o localStorage antes de tirar al landing
      const hasLocalSession = localStorage.getItem('sia_session_hint');

      if (!hasLocalSession) {
        // Si no hay rastro de sesión, asumimos invitado y vamos al landing
        hideLoader();
        showLanding();
      } else {
        // Si había sesión, quizás es solo lentitud extrema. 
        // Mostramos notificación pero dejamos el loader unos segundos más o damos opción a recargar.
        if (typeof showToast === 'function') showToast("La conexión es inestable. Cargando...", "info");
        // Forzamos un poco más tarde si sigue pegado
        setTimeout(() => {
          if (appLoader && !appLoader.classList.contains('d-none')) {
            hideLoader();
            showLanding();
          }
        }, 5000); // 5s extra
      }
    }
  }, 10000); // AUMENTADO A 10 SEGUNDOS (Mejor para móviles lentos)

  // Monitor de Red
  window.addEventListener('online', () => {
    console.log("ðŸŒ Conexión restaurada.");
    if (appLoader && !appLoader.classList.contains('d-none')) {
      // Si estábamos pegados en loader, tal vez ahora Firebase reaccione
    }
    if (typeof showToast === 'function') showToast("Conexión restaurada.", "success");
  });

  window.addEventListener('offline', () => {
    console.log("ðŸ”Œ Conexión perdida.");
    if (typeof showToast === 'function') showToast("Estás desconectado.", "warning");
  });

  // Helper: Actualizar Info Navbar (NUEVO)
  function updateNavbarUserInfo(name, role, email, matricula) {
    safeSetText('nav-full-name', name);
    safeSetText('nav-matricula', matricula || 'S/M');
    safeSetText('user-role-nav', role ? role.toUpperCase() : 'ESTUDIANTE');
  }

  // Helper: Renderizar Avatares
  function updateUserAvatars(name) {
    const initials = getInitials(name);

    // 1. Avatar del Navbar (Dropdown)
    const navAvatarBtn = document.querySelector('.navbar .dropdown button div');
    if (navAvatarBtn) {
      navAvatarBtn.innerHTML = `<span class="fw-bold text-white" style="font-size: 1rem; letter-spacing: -1px;">${initials}</span>`;
    }

    // 2. Avatar Grande (Vista Perfil)
    safeSetText('profile-avatar-big', initials);
  }


  function hideLoader() {
    if (appLoader) {
      appLoader.style.opacity = '0';
      setTimeout(() => {
        appLoader.classList.add('d-none');
        clearTimeout(safetyTimer); // Limpiamos el timer si ya cargó
      }, 500);
    }
  }

  // Verificar si SIA (Firebase) se cargó correctamente
  if (typeof SIA === 'undefined' || !SIA.auth) {
    console.error("âŒ ERROR CRÃTICO: SIA/Firebase no está definido. Revisa services/firebase.js");
    if (typeof showToast === 'function') showToast("Error de conexión con el sistema.", "danger");
    hideLoader();
    showLanding();
    return; // Detener ejecución para evitar crashes
  }

  // === THEME: Light / Dark (Fase 1) ===

  const THEME_KEY_LOCAL = 'sia:theme';

  function applyTheme(theme, persistLocal = true) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-bs-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }

    if (persistLocal) {
      localStorage.setItem(THEME_KEY_LOCAL, theme);
    }
  }

  window.applyTheme = applyTheme;

  function resolveInitialTheme(preferences) {
    // 1. Check LocalStorage override
    const local = localStorage.getItem(THEME_KEY_LOCAL);
    if (local) return local;

    // 2. Default: Light
    return 'light';
  }

  function initThemeToggle(currentUser) {
    // Optional: Add toggle functionality if UI element exists
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    }
  }


  // ==========================================
  // 4. AUTENTICACIÃ“N & FLUJO PRINCIPAL
  // ==========================================
  // --- CONFIG: ROLES & VISTAS ---
  // --- HELPERS DE ROL ---
  function detectUserType(email) {
    if (!email) return { type: 'unknown', role: 'guest' };
    email = email.toLowerCase().trim();

    // 1. Departamento Oficial
    if (DEPARTMENT_DIRECTORY[email]) {
      // Clonamos para evitar mutar el objeto original
      return { type: 'department', ...DEPARTMENT_DIRECTORY[email] };
    }

    // 2. Estudiante (Regex: 8 o 9 dígitos para matrícula)
    const matriculaRegex = /^\d{8,9}@loscabos\.tecnm\.mx$/;
    if (matriculaRegex.test(email)) {
      return { type: 'student', role: 'student' };
    }

    // 3. Default: Personal (Docente/Admin)
    return { type: 'personal', role: 'docente' };
  }

  // --- CONFIG: ROLES & VISTAS ---
  const ROLE_HOME_VIEWS = {
    'medico': 'view-medi',
    'medico_psicologo': 'view-medi', // Nuevo rol
    'department_admin': 'view-dashboard', // Default, pero se restringirá
    'biblio': 'view-biblio',
    'biblio_admin': 'view-biblio',
    'aula_admin': 'view-aula',
    'foro_admin': 'view-foro',
    // 'student', 'docente' -> view-dashboard
  };

  SIA.auth.onAuthStateChanged(async (user) => {

    const path = window.location.pathname || '/';
    const isVerifyRoute = path.startsWith('/verify/');

    if (!user) {

      // === THEME: invitado ===
      const guestTheme = resolveInitialTheme(null);
      applyTheme(guestTheme, false);
      initThemeToggle(null);

      // CASO 1: INVITADO (Sin Google)
      currentUserProfile = null;
      ModuleManager.clearAll();
      // FIX NOTIFICATIONS
      if (window.Notify) Notify.cleanup();

      if (globalAvisosUnsub) { globalAvisosUnsub(); globalAvisosUnsub = null; }

      if (isVerifyRoute) {
        startVerifyFlowFromCurrentPath();
      } else {
        showLanding();
      }

    } else {
      // ===== CASO 2: LOGUEADO CON GOOGLE/MICROSOFT =====
      try {
        const userType = detectUserType(user.email);

        let profile = null;

        // A) SI ES DEPARTAMENTO OFICIAL -> Forzamos el perfil estático
        if (userType.type === 'department') {
          // ... (existing logic)
        }

        // âš¡ DEV MODE SIMULATION INTERCEPT âš¡
        const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
        const simProfileJson = localStorage.getItem('sia_simulated_profile');

        if (isDevMode && simProfileJson) {
          try {
            const simProfile = JSON.parse(simProfileJson);
            // Only use if the underlying Auth UID matches (security/sanity check)
            // or just trust it for dev. Let's trust it but merge UID.
            profile = { ...simProfile, uid: user.uid, email: user.email };
            console.log("[DevMode] âš¡ Simulación Activada:", profile.role);
          } catch (e) { console.error("SimProfile Error", e); }
        }

        // D) SI NO HAY PERFIL SIMULADO, BUSCAR REMOTO
        if (!profile) {
          if (userType.type === 'department') {
            console.log("[Auth] ðŸ¢ Es departamento oficial. Forzando datos...");
            profile = {
              uid: user.uid,
              email: user.email,
              displayName: userType.name,
              role: userType.role,
              permissions: userType.permissions,
              allowedViews: userType.allowedViews,
              photoURL: user.photoURL || '',
              departmentConfig: userType,
              matricula: user.email.split('@')[0],
              lastLogin: new Date()
            };

            // Sync Firestore
            try {
              await SIA.db.collection('usuarios').doc(user.uid).set({
                email: profile.email,
                displayName: profile.displayName,
                role: profile.role,
                permissions: profile.permissions,
                allowedViews: profile.allowedViews,
                matricula: profile.matricula,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                photoURL: profile.photoURL
              }, { merge: true });
            } catch (e) { console.error("[Auth] âŒ Error sync departamento:", e); }

          } else {
            // B) SI ES PERSONAL O ESTUDIANTE -> Buscamos en Firestore normalmente
            profile = await SIA.ensureProfile(user);

            if (!profile && user.email) {
              try { profile = await SIA.findUserByInstitutionalEmail(user.email); } catch (e) { }
            }
          }
        }

        // C) SI NO EXISTE PERFIL (Y NO ES DEPARTAMENTO) -> REGISTRO
        if (!profile) {
          console.warn("âš ï¸ Usuario nuevo REAL. Redirigiendo a Registro.");
          hideLoader();

          let extraData = {};
          try { extraData = JSON.parse(localStorage.getItem('sia_temp_extradata') || '{}'); } catch (e) { }

          // PRE-FILL ROL SI YA LO SABEMOS (Estudiante)
          if (userType.type === 'student') {
            extraData.forcedRole = 'student';
          }

          if (window.SIA_Register) {
            SIA_Register.init(user, extraData);
          }
          return;
        }

        // ✅ PERFIL CONFIRMADO
        currentUserProfile = profile;
        if (window.SIA) window.SIA.currentUserProfile = profile;

        // SYNC WITH STORE (For Router)
        Store.setUser(user, profile);

        // Actualizar UI
        updateUserAvatars(profile.displayName);
        updateNavbarUserInfo(profile.displayName, profile.role, profile.email, profile.matricula);
        updateMenuVisibility(profile.role);

        // --- NOTIFICACIONES ---
        if (window.Notify) {
          Notify.init(window.SIA, user.uid);
        } else {
          console.warn('[App] Notify service not found.');
        }

        // --- ENCUESTAS PENDIENTES (GENERALES Y DE SERVICIO) ---
        // Verificar si hay encuestas pendientes y mostrarlas (Stories/Modal)
        checkAndDisplayPendingSurveys().catch(err => console.error("[App] Error checking surveys:", err));

        // 🚀 ENTRAR A LA APP
        // 🚀 ENTRAR A LA APP
        showApp();

        // === AUTO THEME BY ROLE ===
        // Si es Departamento/Admin, forzar Light (si no ha elegido otro)
        const savedTheme = localStorage.getItem(THEME_KEY_LOCAL);
        if (!savedTheme) {
          if (profile.role === 'department_admin' || userType.type === 'department') {
            applyTheme('light', false); // Default light for admins
            console.log("[App] 💡 Tema claro aplicado por defecto para Admin.");
          } else {
            applyTheme('light', false); // Default light for others
          }
        } else {
          applyTheme(savedTheme, false);
        }

        initThemeToggle(user);

        // --- ENRUTAMIENTO INTELIGENTE ---
        const path = window.location.pathname || '/';

        // 1. Si es departamento con VISTAS RESTRINGIDAS (ej. solo biblio), forzar esa vista
        if (profile.allowedViews && profile.allowedViews.length === 1) {
          const forcedView = profile.allowedViews[0];
          console.log(`[Nav] ðŸ”’ Usuario con vista única. Redirigiendo a: ${forcedView}`);
          navigate(forcedView, true, true); // Force skipAuthCheck
          return;
        }

        // 2. Si es rol con vista especifica
        const roleHome = ROLE_HOME_VIEWS[currentUserProfile.role];

        if (path === '/' || path === '') {
          if (roleHome) {
            navigate(roleHome, true, true); // Force skipAuthCheck
          } else {
            navigate('view-dashboard', true, true); // Force skipAuthCheck
          }
        } else {
          handleLocation();
        }

      } catch (e) {
        console.error("âŒ Error crítico auth:", e);
        showLanding();
      }
    }
    hideLoader();
  });


  // --- Funciones de Cambio de Escena ---

  function showLanding() {
    if (landingView) landingView.classList.remove('d-none');

    if (appShell) {
      appShell.classList.add('d-none');
      appShell.style.display = 'none'; // Force hide
    }
    if (registerWizard) {
      registerWizard.classList.add('d-none');
      registerWizard.style.display = 'none';
    }
    if (verifyShell) verifyShell.classList.add('d-none');
    if (fabAddCourse) fabAddCourse.classList.add('d-none');

    safeSetText('user-email', '');
    currentUserProfile = null;
    ModuleManager.clearAll();
  }

  function showApp() {
    if (landingView) landingView.classList.add('d-none');
    if (registerWizard) registerWizard.classList.add('d-none'); // Hide

    if (appShell) {
      appShell.classList.remove('d-none');
      appShell.style.display = ''; // Reset display to default (block/flex)
    }

    if (verifyShell) verifyShell.classList.add('d-none');
  }

  function showVerifyShell() {
    if (landingView) landingView.classList.add('d-none');

    if (appShell) {
      appShell.classList.add('d-none');
      appShell.style.display = 'none';
    }

    if (verifyShell) verifyShell.classList.remove('d-none');
    if (fabAddCourse) fabAddCourse.classList.add('d-none');
  }

  // ==========================================
  // 3b. EVENT LISTENERS (CRITICAL FIXES)
  // =========================================

  // [FIX] Listener explícito para cambios de vista (Backup + Smart Scroll Reset)
  window.addEventListener('sia-view-changed', (e) => {
    const viewId = e.detail?.viewId;

    // Solo resetear scroll si NO hay estado guardado con scroll position
    if (viewId) {
      const hasSavedState = ModuleStateManager.getState(viewId);
      const hasSavedScroll = hasSavedState?.scrollPosition !== undefined;

      if (!hasSavedScroll) {
        requestAnimationFrame(() => {
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          window.scrollTo(0, 0);
        });
      }
    }

    if (e.detail && e.detail.viewId === 'view-dashboard') {
      if (typeof loadDashboard === 'function') loadDashboard();
    }
  });
  /* ==========================================================================
     ðŸ” SIA GLOBAL SEARCH MODULE (ROBUST V3)
     ========================================================================== */
  (function initSiaSearch() {

    // Seleccionar TODOS los inputs de búsqueda (Navbar y Modal)
    const inputs = document.querySelectorAll('.search-input-sia');
    const resultsContainers = document.querySelectorAll('.search-results-dropdown');

    if (inputs.length === 0) {
      console.error("[Search] âŒ No se encontraron inputs de búsqueda (.search-input-sia).");
      return;
    }


    const SEARCH_INDEX = [
      // Módulos
      { label: 'Aula Virtual', type: 'Módulo', icon: 'mortarboard-fill', color: 'text-primary', action: () => SIA.navigate('view-aula'), keywords: 'curso clase aprender examen tarea' },
      { label: 'Servicios Médicos', type: 'Módulo', icon: 'heart-pulse-fill', color: 'text-danger', action: () => SIA.navigate('view-medi'), keywords: 'salud doctor cita psicologo medico' },
      { label: 'Quejas y Sugerencias', type: 'Módulo', icon: 'chat-heart-fill', color: 'text-primary', action: () => SIA.navigate('view-quejas'), keywords: 'queja sugerencia reporte calidad felicitacion' },
      { label: 'Encuestas', type: 'Módulo', icon: 'clipboard2-check-fill', color: 'text-info', action: () => SIA.navigate('view-encuestas'), keywords: 'encuesta survey cuestionario opinión calidad formulario' },
      { label: 'Biblioteca', type: 'Módulo', icon: 'book-half', color: 'text-warning', action: () => SIA.navigate('view-biblio'), keywords: 'libro prestamo catalogo tesis' },
      { label: 'Eventos', type: 'Módulo', icon: 'calendar-event', color: 'text-info', action: () => SIA.navigate('view-foro'), keywords: 'evento noticia comunidad auditorio' },
      { label: 'Mi Perfil', type: 'Cuenta', icon: 'person-circle', color: 'text-dark', action: () => SIA.navigate('view-profile'), keywords: 'cuenta datos credencial id' },

      // Atajos
      { label: 'Mis Cursos', type: 'Atajo', icon: 'collection', color: 'text-primary', keywords: 'progreso calificaciones', action: () => { SIA.navigate('view-aula'); setTimeout(() => document.getElementById('tab-aula-mis-cursos-btn')?.click(), 200); } },
      { label: 'Agendar Cita', type: 'Atajo', icon: 'calendar-plus', color: 'text-danger', keywords: 'reservar consulta', action: () => { SIA.navigate('view-medi'); } },
      { label: 'SOS / Emergencia', type: 'Urgente', icon: 'exclamation-circle-fill', color: 'text-danger', keywords: 'ayuda auxilio 911 socorro', action: () => { SIA.navigate('view-medi'); setTimeout(() => Medi.toggleSOS(), 500); } },
      { label: 'Cerrar Sesión', type: 'Sistema', icon: 'box-arrow-right', color: 'text-secondary', keywords: 'salir logout exit', action: () => window.logout() },
      { label: 'Cambiar Tema', type: 'Sistema', icon: 'palette', color: 'text-dark', keywords: 'oscuro claro dark mode', action: () => document.getElementById('theme-toggle-btn')?.click() }
    ];

    // Función helper para renderizar en un contenedor específico con agrupación
    const renderResults = (container, matches, inputEl) => {
      container.innerHTML = '';
      if (matches.length === 0) {
        container.innerHTML = `<div class="p-3 text-center text-muted small">No hay resultados</div>`;
        return;
      }

      // Agrupar resultados por categoría
      const grouped = matches.reduce((acc, match) => {
        const category = match.type || 'Otros';
        if (!acc[category]) acc[category] = [];
        acc[category].push(match);
        return acc;
      }, {});

      // Orden de prioridad de categorías
      const categoryOrder = ['Módulo', 'Atajo', 'Cuenta', 'Urgente', 'Sistema', 'Otros'];

      // Renderizar por categoría
      categoryOrder.forEach(category => {
        if (!grouped[category]) return;

        // Category label
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'search-category px-2 mt-2';
        categoryDiv.innerHTML = `<div class="category-label">${category}${grouped[category].length > 1 ? 's' : ''}</div>`;
        container.appendChild(categoryDiv);

        // Items in category
        grouped[category].forEach(match => {
          const item = document.createElement('div');
          item.className = 'result-item d-flex align-items-center gap-2 p-2';
          item.style.cursor = 'pointer';
          item.innerHTML = `
            <div class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width: 32px; height: 32px;">
              <i class="bi bi-${match.icon} ${match.color || 'text-dark'}"></i>
            </div>
            <div class="flex-grow-1">
              <div class="fw-bold small text-dark lh-1">${match.label}</div>
            </div>
          `;

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            match.action();
            inputEl.value = '';
            container.classList.remove('active');
            container.classList.add('d-none');
            container.style.display = 'none';

            // Cerrar modal si estamos en uno
            const modal = inputEl.closest('.modal');
            if (modal) {
              const modalInstance = bootstrap.Modal.getInstance(modal);
              if (modalInstance) modalInstance.hide();
            }
          });

          container.appendChild(item);
        });
      });
    };

    // Vincular lógica a cada input encontrado
    inputs.forEach(input => {
      const wrapper = input.parentElement;
      const resultsContainer = wrapper.querySelector('.search-results-dropdown');

      if (!resultsContainer) return;

      input.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        if (term.length < 2) {
          resultsContainer.classList.remove('active');
          resultsContainer.classList.add('d-none');
          resultsContainer.style.display = 'none';
          return;
        }

        const matches = SEARCH_INDEX.filter(item =>
          item.label.toLowerCase().includes(term) ||
          (item.keywords && item.keywords.includes(term))
        );

        resultsContainer.classList.add('active');
        resultsContainer.classList.remove('d-none');
        resultsContainer.style.display = 'block';
        renderResults(resultsContainer, matches, input);
      });

      // Hide on blur (delayed)
      input.addEventListener('blur', () => { // focusout
        setTimeout(() => {
          resultsContainer.classList.remove('active');
          resultsContainer.classList.add('d-none');
          resultsContainer.style.display = 'none';
        }, 200);
      });

      // Focus show if content
      input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) {
          resultsContainer.classList.remove('d-none');
          resultsContainer.style.display = 'block';
        }
      });
    });

  })();

  // Listener para el botón de Microsoft (Azure AD Institucional)
  const btnLoginMS = document.getElementById('btn-login-microsoft');
  if (btnLoginMS) {
    btnLoginMS.addEventListener('click', async (e) => {
      if (e) e.preventDefault();

      try {
        console.log("ðŸ” Iniciando login con Microsoft...");
        const result = await SIA.loginWithMicrosoft();
        console.log("✅ Login Microsoft exitoso:", result);

        // 1. Verificar si es DEPARTAMENTO OFICIAL
        const userType = detectUserType(result.user.email);

        if (userType.type === 'department') {
          console.log("✅ Es departamento login. Delegando a onAuthStateChanged...");
          // No hacemos nada mas aqui, dejamos que el listener global maneje la redireccion
          return;
        }

        // 2. Si NO es departamento, buscamos perfil real
        const existingProfile = await SIA.findUserByInstitutionalEmail(result.user.email);

        if (existingProfile) {
          // ===== USUARIO YA EXISTE =====
          console.log("✅ Usuario encontrado por email institucional:", existingProfile);

          // Actualizar lastLogin en el documento existente (Non-blocking)
          try {
            await SIA.db.collection('usuarios').doc(existingProfile.uid).update({
              lastLogin: SIA.FieldValue.serverTimestamp(),
              photoURL: result.user.photoURL || existingProfile.photoURL || ''
            });
          } catch (updateErr) {
            console.warn("âš ï¸ No se pudo actualizar lastLogin (Posible restricción de reglas):", updateErr);
            // Continuamos el flujo de login aunque esto falle
          }

          if (typeof showToast === 'function') {
            showToast(`¡Bienvenido de nuevo, ${existingProfile.displayName}!`, "success");
          }

          // onAuthStateChanged manejará el resto del flujo
          console.log("✅ Login completado. Esperando onAuthStateChanged...");

        } else {
          // ===== USUARIO NUEVO: Iniciar Registro =====
          console.log("â„¹ï¸ Usuario nuevo detectado. Iniciando registro...");
          console.log("ðŸ“‹ Datos para registro:", result.extradata);

          if (typeof showToast === 'function') {
            showToast("Completa tu registro institucional", "info");
          }

          // ðŸ”‘ GUARDAR extradata en localStorage para recuperarlo después de recargar
          try {
            localStorage.setItem('sia_temp_extradata', JSON.stringify(result.extradata));
            console.log("✅ Extradata guardado en localStorage");

            // PRE-FILL ROL SI YA LO SABEMOS (Estudiante detectado por regex)
            if (userType.type === 'student') {
              const currentData = result.extradata || {};
              currentData.forcedRole = 'student';
              localStorage.setItem('sia_temp_extradata', JSON.stringify(currentData));
            }
          } catch (e) {
            console.error("âŒ Error guardando extradata:", e);
          }

          // Mostrar vista de registro con datos pre-llenados
          if (window.SIA_Register) {
            SIA_Register.init(result.user, result.extradata);
          }
        }

      } catch (error) {
        console.error("âŒ Error en Microsoft Auth:", error);

        // Mensajes de error específicos
        if (error.code === 'auth/popup-closed-by-user') {
          if (typeof showToast === 'function') {
            showToast("Ventana cerrada. Intenta de nuevo.", "warning");
          }
        } else if (error.code === 'auth/cancelled-popup-request') {
          console.log("â„¹ï¸ Popup cancelado (normal si se abre otro)");
        } else if (error.code === 'auth/invalid-credential') {
          if (typeof showToast === 'function') {
            showToast("Credencial inválida. Contacta a soporte técnico.", "danger");
          }
        } else if (error.code === 'auth/network-request-failed') {
          if (typeof showToast === 'function') {
            showToast("Error de conexión. Verifica tu internet.", "danger");
          }
        } else {
          if (typeof showToast === 'function') {
            showToast("Error de acceso institucional. Intenta de nuevo.", "danger");
          }
        }
      }
    });
  }

  // Navbar Home Buttons (Avoid Reload)
  [btnBrandHome, document.getElementById('btn-brand-home-v2')].forEach(btn => {
    if (btn) btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUserProfile) navigate('view-dashboard');
      else showLanding();
    });
  });

  // Global Search Desktop
  if (searchInputDesktop) {
    searchInputDesktop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const term = e.target.value;

      }
    });
  }


  // Mobile/Global Avisos Modal
  if (btnGlobalAvisosModal) {
    btnGlobalAvisosModal.addEventListener('click', openGlobalAvisosModal);
  }


  async function logout() {
    // 1. Feedback visual inmediato
    if (appLoader) {
      appLoader.classList.remove('d-none');
      appLoader.style.opacity = '1';
    }

    // 2. Intentar cerrar sesión en Firebase limpio
    try {
      if (typeof SIA !== 'undefined' && SIA.auth) {
        await SIA.auth.signOut();
      }
    } catch (e) {
      console.warn("Error en signOut (no crítico):", e);
    }

    // 3. Limpieza de estado local (Storage & Memory)
    localStorage.removeItem('sia_temp_extradata');
    localStorage.removeItem('sia_simulated_profile'); // Clear Dev Simulation
    try {
      ModuleManager.clearAll();
      ModuleStateManager.clearAll(); // Limpiar estados de módulos
    } catch (e) { }

    // 4. RECARGA FORZADA para garantizar limpieza de memoria, listeners y DOM.
    // Esto soluciona los errores de permisos "fantasmas" y resetea la UI correctamente.
    window.location.href = '/';
  }

  // Exportar logout globalmente
  window.logout = logout;


  // ==========================================
  // 5. LÃ“GICA DE MÃ“DULOS (CONTEXTO)
  // ==========================================
  const GLOBAL_TIPS = {
    general: [
      'Explora los módulos de SIA desde el menú superior.',
      'Mantén tus datos actualizados en tu perfil institucional.',
      'Revisa los avisos para estar al día con el campus.',
    ],
    aula: [
      'Completa tus cursos a tiempo para evitar pendientes.',
      'Descarga tus constancias apenas termines un curso.',
      'Repasa el cuestionario antes de enviar tus respuestas.',
      'Aprovecha Aula para reforzar lo que ves en clase.',
    ],
    biblio: [
      'Devuelve tus préstamos a tiempo para evitar sanciones.',
      'Aprovecha los recursos digitales de la biblioteca.',
      'Consulta el catálogo en línea antes de ir a ventanilla.',
    ],
    medi: [
      'Agenda tus citas con anticipación.',
      'Tu bienestar también es parte de tu formación académica.',
      'Respeta los horarios y lineamientos del consultorio.',
    ],
    foro: [
      'Llega 10 minutos antes para asegurar tu lugar.',
      'Ten listo tu código QR de acceso en la entrada.',
      'Revisa los eventos culturales de esta semana.'
    ],
  };

  function getCtx() {
    const activeUnsubs = { push: fn => ModuleManager.addSubscription(fn) };
    return { auth: SIA.auth, db: SIA.db, storage: SIA.storage, currentUserProfile, profile: currentUserProfile, ModuleManager, activeUnsubs };
  }

  function moduleKeyFromView(viewId) {
    if (viewId === 'view-aula') return 'aula';
    if (viewId === 'view-biblio') return 'biblio';
    if (viewId === 'view-medi') return 'medi';
    if (viewId === 'view-foro') return 'foro';
    return 'general';
  }

  function pickTipForModule(key) {
    const arr = GLOBAL_TIPS[key] || GLOBAL_TIPS.general;
    if (!arr || !arr.length) return '';
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  function updateGlobalTip(viewId) {
    if (!globalTipText) return;
    const key = moduleKeyFromView(viewId);
    currentModuleKey = key;
    const tip = pickTipForModule(key);
    globalTipText.textContent = tip ? `"${tip}"` : '';
  }

  function updateBreadcrumbs(viewId, extraLabel = '') {
    const container = document.getElementById('app-breadcrumbs');
    const currentEl = document.getElementById('breadcrumb-current');
    if (!container || !currentEl) return;

    if (viewId === 'view-dashboard') {
      container.classList.add('d-none');
      return;
    }

    container.classList.remove('d-none');

    let label = 'Sección';
    switch (viewId) {
      case 'view-aula': label = 'Aula Virtual'; break;
      case 'view-biblio': label = 'Biblioteca'; break;
      case 'view-medi': label = 'Servicios Médicos'; break;
      case 'view-profile': label = 'Mi Perfil'; break;
      case 'view-aula-course': label = 'Aula'; break;
      default: label = 'Sección';
    }

    if (viewId === 'view-aula-course') {
      currentEl.innerHTML = `<a href="#" onclick="SIA_navToAula(); return false;" class="text-decoration-none text-muted">Aula</a> <span class="mx-1">/</span> <span class="fw-bold text-primary">${extraLabel || 'Curso'}</span>`;
    } else {
      currentEl.textContent = label;
      currentEl.classList.add('fw-bold', 'text-primary');
    }
  }

  function normalizeAvisoGlobal(data, id) {
    const createdAt = window.TimeUtils ? TimeUtils.toDate(data.createdAt) : null;
    const activaDesde = window.TimeUtils ? TimeUtils.toDate(data.activaDesde) : null;
    const activaHasta = window.TimeUtils ? TimeUtils.toDate(data.activaHasta) : null;

    return {
      id,
      texto: data.texto || '',
      tipo: data.tipo || 'aviso',
      prioridad: typeof data.prioridad === 'number' ? data.prioridad : 2,
      modulo: data.modulo || 'global',
      createdAt,
      activaDesde,
      activaHasta,
    };
  }

  function filtrarYOrdenarAvisosGlobal(lista, moduloKey) {
    const now = new Date();
    return (lista || [])
      .filter((a) => {
        if (!a.texto) return false;
        if (a.activaDesde && a.activaDesde > now) return false;
        if (a.activaHasta && a.activaHasta < now) return false;

        const mod = a.modulo || 'global';
        if (mod === 'global') return true;
        if (moduloKey === 'general') return true;
        return mod === moduloKey;
      })
      .sort((a, b) => {
        const pa = typeof a.prioridad === 'number' ? a.prioridad : 2;
        const pb = typeof b.prioridad === 'number' ? b.prioridad : 2;
        if (pa !== pb) return pa - pb;

        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
  }

  function renderGlobalAvisoActual() {
    if (!globalAvisosContainer) return;
    const aviso = globalAvisosData[globalAvisosIndex] || globalAvisosData[0];
    if (!aviso) return;

    const wrap = document.getElementById('global-avisos-wrap');

    // SI ES EMERGENCIA: Estilo agresivo y persistente
    if (aviso.tipo === 'emergencia') {
      wrap.querySelector('.alert').className = 'alert alert-danger border-0 shadow-lg d-flex align-items-center p-3 mb-0 gap-3 animate-pulse';
      globalAvisosContainer.innerHTML = `<strong class="text-uppercase"><i class="bi bi-exclamation-triangle-fill me-2"></i>ALERTA:</strong> ${aviso.texto}`;
    } else {
      wrap.querySelector('.alert').className = 'alert alert-light border-0 shadow-sm rounded-4 d-flex align-items-center p-3 mb-0 gap-3';
      // ... lógica normal de badges
    }
  }

  function clearGlobalAvisosLoop() {
    if (globalAvisosTimer) {
      clearInterval(globalAvisosTimer);
      globalAvisosTimer = null;
    }
  }

  function resetGlobalAvisosLoop() {
    clearGlobalAvisosLoop();
    if (!globalAvisosData.length || globalAvisosData.length <= 1) return;

    globalAvisosTimer = setInterval(() => {
      if (!globalAvisosData.length) return;
      globalAvisosIndex = (globalAvisosIndex + 1) % globalAvisosData.length;
      renderGlobalAvisoActual();
    }, 8000);
  }

  function rebuildGlobalAvisosData() {
    const container = document.getElementById('global-avisos-container');
    const wrap = document.getElementById('global-avisos-wrap');

    if (!container || !wrap) return;

    if (!globalAvisosRaw.length) {
      globalAvisosData = [];
      wrap.classList.add('d-none');
      clearGlobalAvisosLoop();
      return;
    }

    globalAvisosData = filtrarYOrdenarAvisosGlobal(globalAvisosRaw, currentModuleKey);

    if (globalAvisosData.length === 0) {
      wrap.classList.add('d-none');
    } else {
      wrap.classList.remove('d-none');
      globalAvisosIndex = 0;
      renderGlobalAvisoActual();
      resetGlobalAvisosLoop();
    }
  }

  async function openGlobalAvisosModal() {
    const modalEl = document.getElementById('modalAulaAvisos');
    const listEl = document.getElementById('aula-avisos-modal-list');
    const emptyEl = document.getElementById('aula-avisos-modal-empty');
    if (!modalEl || !listEl || !emptyEl || !SIA.db) return;
    try {
      const ctx = getCtx();
      const docs = await AulaService.getAllAvisos(ctx);
      const norm = docs.map((d) => normalizeAvisoGlobal(d.data(), d.id));
      const data = filtrarYOrdenarAvisosGlobal(norm, currentModuleKey);

      if (!data.length) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('d-none');
      } else {
        emptyEl.classList.add('d-none');
        listEl.innerHTML = data.map((a) => {
          return `<li class="list-group-item border-0 border-bottom px-0">${a.texto}</li>`;
        }).join('');
      }
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch (err) { console.error(err); }
  }

  function initGlobalAvisosListener() {
    if (!globalAvisosContainer || !SIA.db || typeof AulaService === 'undefined') return;
    const ctx = getCtx();

    if (globalAvisosUnsub) { globalAvisosUnsub(); globalAvisosUnsub = null; }

    globalAvisosRaw = [];
    globalAvisosData = [];
    globalAvisosIndex = 0;
    renderGlobalAvisoActual();
    resetGlobalAvisosLoop();

    globalAvisosUnsub = AulaService.streamAvisos(
      ctx,
      (snap) => {
        const docs = snap.docs || [];
        globalAvisosRaw = docs.map((d) => normalizeAvisoGlobal(d.data(), d.id));
        rebuildGlobalAvisosData();
      },
      10
    );
  }

  function setCols(el, cols) {
    if (!el) return;
    ['col-12', 'col-md-6', 'col-lg-5', 'col-lg-7'].forEach(c => el.classList.remove(c));
    cols.forEach(c => el.classList.add(c));
  }

  function mountAula(ctx, profile) {
    const adminWrap = document.getElementById('aula-admin');
    const studentWrap = document.getElementById('aula-student');
    const saWrap = document.getElementById('aula-superadmin');

    if (typeof Aula === 'undefined') return;

    adminWrap?.classList.add('d-none');
    studentWrap?.classList.add('d-none');
    saWrap?.classList.add('d-none');

    if (profile?.role === 'superadmin') {
      saWrap?.classList.remove('d-none');
      Aula.initSuperAdmin(ctx);
    } else if (profile?.role === 'aula') {
      setCols(adminWrap, ['col-12']);
      adminWrap?.classList.remove('d-none');
      Aula.initAdmin(ctx);
    } else {
      studentWrap?.classList.remove('d-none');
      Aula.initStudent(ctx);
    }
  }

  window.SIA_navToCourse = function (courseId) {
    window.SIA_currentCourseId = courseId;
    history.pushState(
      { viewId: 'view-aula-course', courseId },
      '',
      `/aula/curso/${encodeURIComponent(courseId)}`
    );
    showView('view-aula-course');
  };

  window.SIA_navToAula = function () {
    history.pushState({ viewId: 'view-aula' }, '', '/aula');
    showView('view-aula');
  };



  // ==========================================
  // 6. ROUTER (Navegación Interna)
  // ==========================================

  function parseFolioFromPath(path) {
    const p = path || window.location.pathname || '';
    if (!p.startsWith('/verify/')) return null;
    const raw = decodeURIComponent(p.split('/verify/')[1] || '').trim();
    return raw || null;
  }

  async function verifyCertificateByFolio(folioRaw) {
    const badgeEl = document.getElementById('verify-badge');
    const loadingEl = document.getElementById('verify-loading');
    const okEl = document.getElementById('verify-ok');
    const errEl = document.getElementById('verify-error');

    if (!badgeEl || !loadingEl || !okEl || !errEl) return;

    // Estado inicial de UI
    badgeEl.textContent = 'Pendiente';
    loadingEl.classList.remove('d-none');
    okEl.classList.add('d-none');
    errEl.classList.add('d-none');

    // 1. Validar formato básico
    if (!folioRaw || folioRaw.length < 5) {
      loadingEl.classList.add('d-none');
      errEl.classList.remove('d-none');
      document.getElementById('verify-err-msg').textContent = 'Folio inválido o incompleto.';
      return;
    }

    // 2. Consultar BD 
    try {
      const db = SIA.db;
      // Normalizamos folio a mayúsculas por si acaso
      const folio = folioRaw.toUpperCase();
      badgeEl.textContent = folio;

      const snapshot = await db.collection('certificados')
        .where('folio', '==', folio)
        .limit(1)
        .get();

      loadingEl.classList.add('d-none');

      if (snapshot.empty) {
        // NO ENCONTRADO
        errEl.classList.remove('d-none');
        document.getElementById('verify-err-msg').textContent = 'El certificado no existe en nuestros registros.';
      } else {
        // ENCONTRADO
        const data = snapshot.docs[0].data();
        okEl.classList.remove('d-none');

        // Llenar datos en pantalla
        safeSetText('ver-alumno', data.alumnoName || 'Alumno');
        safeSetText('ver-curso', data.cursoTitle || 'Curso');

        // Uso de TimeUtils para fecha
        const fecha = window.TimeUtils ? TimeUtils.formatDate(data.issuedAt) : (data.issuedAt?.toDate ? data.issuedAt.toDate().toLocaleDateString() : 'Fecha indefinida');
        safeSetText('ver-fecha', fecha);

        safeSetText('ver-promedio', data.finalGrade ? `${data.finalGrade}/100` : 'Aprobado');
        safeSetText('ver-instructor', data.instructorName || 'Academia SIA');

        // Link PDF si existe
        const btnPdf = document.getElementById('ver-btn-pdf');
        if (btnPdf) {
          if (data.pdfUrl) {
            btnPdf.href = data.pdfUrl;
            btnPdf.classList.remove('d-none');
          } else {
            btnPdf.classList.add('d-none');
          }
        }
      }

    } catch (e) {
      console.error("Error verificando folio:", e);
      loadingEl.classList.add('d-none');
      errEl.classList.remove('d-none');
      document.getElementById('verify-err-msg').textContent = 'Error de conexión al verificar.';
    }
  }

  function startVerifyFlowFromCurrentPath() {
    const folio = parseFolioFromPath(window.location.pathname);
    showVerifyShell();
    setTimeout(() => { verifyCertificateByFolio(folio); }, 0);
  }

  const routeMap = {
    'view-dashboard': '/dashboard',
    'view-aula': '/aula',
    'view-biblio': '/biblio',
    'view-medi': '/medi',
    'view-foro': '/foro'
  };

  function getPathForView(viewId) {
    return routeMap[viewId] || '/dashboard';
  }

  function navigate(viewId, state = {}) {
    // [ARCHITECTURE ADAPTER] Delegate to Core Router if available
    if (window.SIA_CORE && window.SIA_CORE.router) {
      window.SIA_CORE.router.navigate(viewId);
      return;
    }

    const path = getPathForView(viewId);
    history.pushState({ viewId, ...state }, '', path);

    let label = '';
    if (viewId === 'view-aula-course' && window.SIA_currentCourseId) {
      label = 'Detalle del Curso';
    }
    updateBreadcrumbs(viewId, label);

    showView(viewId); // showView() ya maneja el scroll reset internamente
  }

  // Exportar navigate globalmente para uso en HTML
  window.navigate = navigate;

  // --- ENCUESTAS CHECKER ---
  async function checkAndDisplayPendingSurveys() {
    console.log('[App] 🔍 Starting checkAndDisplayPendingSurveys...');
    // 1. Wait a bit for other services to load
    await new Promise(r => setTimeout(r, 1500));

    if (!window.EncuestasServicioService || !window.Encuestas || !window.Encuestas.checkAndShowServiceSurvey) {
      console.warn("[App] ⚠️ Encuestas services not available yet.", {
        service: !!window.EncuestasServicioService,
        module: !!window.Encuestas,
        method: !!window.Encuestas?.checkAndShowServiceSurvey
      });
      return;
    }

    const baseCtx = getCtx();
    const ctx = { ...baseCtx, user: baseCtx.auth?.currentUser };

    if (!ctx.user && !ctx.profile) {
      console.log('[App] ❌ No active user for surveys (ctx.user and ctx.profile are missing).');
      return;
    }

    console.log('[App] 👤 User Context:', { uid: ctx.user?.uid || ctx.profile?.uid, role: ctx.profile?.role });

    // A. Check Service Surveys (Triggered)
    const serviceTypes = ['servicio-medico', 'psicologia', 'biblioteca'];
    console.log('[App] 📋 Checking service types:', serviceTypes);

    for (const type of serviceTypes) {
      // Logic inside checkAndShowServiceSurvey already handles "shouldShow"
      // We just trigger the check.
      try {
        const shown = await window.Encuestas.checkAndShowServiceSurvey(type, ctx);
        if (shown) {
          console.log('[App] ✅ Survey shown for:', type);
          return; // If one is shown, stop to avoid spamming
        }
      } catch (err) {
        console.error('[App] Error in loop:', err);
      }
    }

    // B. Check General Surveys (Manual/Campaigns) --> "Stories"
    // TODO: Implement "Stories" UI in checking logic if distinct from modal
    // For now, let's assume general surveys might use a different notification mechanism
    // or the same modal if adapted.
  }


  function handleLocation() {
    const path = window.location.pathname;

    if (path.startsWith('/aula/curso/')) {
      const courseId = decodeURIComponent(path.split('/aula/curso/')[1] || '');
      if (courseId) {
        window.SIA_currentCourseId = courseId;
        showView('view-aula-course');
        return;
      }
    }

    if (path.startsWith('/verify/')) {
      startVerifyFlowFromCurrentPath();
      return;
    }

    const entry = Object.entries(routeMap).find(([, p]) => p === path);
    if (entry) {
      const [viewId] = entry;
      showView(viewId);
    } else {
      showView('view-dashboard');
    }
  }

  // Variable para trackear la vista anterior (para StateManager)
  let _previousView = null;

  function showView(viewId) {
    // Notificar al StateManager sobre el cambio de vista
    ModuleStateManager.onViewChange(_previousView, viewId);

    // Limpiar suscripciones activas
    ModuleManager.clearAll();

    // --- ACCESS CONTROL MIDDLEWARE ---
    // --- ACCESS CONTROL MIDDLEWARE ---
    if (window.currentUserProfile) {
      const role = currentUserProfile.role || 'student';
      // 1. Validar restricción de acceso (Staff no puede salir de su módulo)
      const roleHome = ROLE_HOME_VIEWS[role];

      // NEW LOGIC: Support multiple allowed views
      let isAllowed = false;
      const isProfile = viewId === 'view-profile';
      // Always allow dashboard if we are in logic 1.5 (Multi-view Admin)
      const isDashboard = viewId === 'view-dashboard';

      // A) Check explicit allowedViews from profile (Dev Mode / Advanced Roles)
      if (currentUserProfile.allowedViews && Array.isArray(currentUserProfile.allowedViews)) {
        isAllowed = currentUserProfile.allowedViews.some(allowedBase => {
          return viewId === allowedBase || viewId.startsWith(allowedBase + '-');
        });

        // Excepción: Permitir dashboard si tiene múltiples vistas (para el Dept Dashboard)
        if (!isAllowed && isDashboard && currentUserProfile.allowedViews.length > 1) {
          isAllowed = true;
        }
      }
      // B) Fallback to legacy single home role
      else if (roleHome) {
        isAllowed = (viewId === roleHome || viewId.startsWith(roleHome + '-'));
      }
      // C) If no restriction defined (Student), allow all
      else {
        isAllowed = true;
      }

      // Profile is always allowed for everyone
      if (!isAllowed && !isProfile) {
        const redirectTarget = (currentUserProfile.allowedViews && currentUserProfile.allowedViews[0]) || roleHome || 'view-dashboard';
        console.warn(`[Access] â›” Bloqueado acceso a ${viewId} para rol ${role}. Redirigiendo a ${redirectTarget}`);

        if (viewId !== redirectTarget) {
          setTimeout(() => showView(redirectTarget), 0);
          return;
        }
      }
    }

    // Reset scroll to top - SMART (respeta estado guardado)
    const hasSavedState = ModuleStateManager.getState(viewId);
    const hasSavedScroll = hasSavedState?.scrollPosition !== undefined;

    // Solo resetear scroll si NO hay un estado guardado con scroll
    // (Si hay estado guardado, restoreState() se encargará del scroll)
    if (!hasSavedScroll) {
      const resetScroll = () => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0; // For Safari
        window.scrollTo(0, 0); // Legacy support

        // Reset scroll de contenedores internos si existen
        const mainContent = document.querySelector('main') || document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;

        // Reset all scroll containers
        document.querySelectorAll('.scroll-container, [style*="overflow"]').forEach(el => {
          if (el.scrollTop !== undefined) el.scrollTop = 0;
        });
      };

      // Llamada inmediata
      resetScroll();

      // Llamada después del render (asegura que funcione en SPA)
      requestAnimationFrame(() => {
        resetScroll();
        // Double-check después de animaciones
        setTimeout(resetScroll, 50);
      });
    } else {
      console.log(`ðŸ“œ [Scroll] Respetando scroll guardado para ${viewId} (${hasSavedState.scrollPosition}px)`);
    }

    // Haptics (Phase 2 UI/UX) - Safe Wrap
    try {
      if (window.navigator && window.navigator.vibrate && typeof window.navigator.vibrate === 'function') {
        // Solo vibrar si hay interacción reciente (difícil de saber aquí, pero el try-catch evita el crash,
        // el warning de consola es inevitable sin un estado global de 'userInteracted')
        // window.navigator.vibrate(10);
      }
    } catch (e) { }

    const navbarCollapse = document.getElementById('navContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      new bootstrap.Collapse(navbarCollapse).hide();
    }

    if (fabAddCourse) {
      const isAulaAdmin = currentUserProfile?.role === 'aula';
      const isAulaView = viewId === 'view-aula';
      fabAddCourse.classList.toggle('d-none', !(isAulaAdmin && isAulaView));
    }

    const bannerAvisos = document.getElementById('global-avisos-wrap');
    if (bannerAvisos) {
      if (currentUserProfile?.role === 'superadmin') {
        bannerAvisos.classList.add('d-none');
      } else {
        bannerAvisos.classList.remove('d-none');
      }
    }

    // New Mobile Nav Logic
    updateMobileNavState(viewId);

    appViews.forEach(v => v.classList.add('d-none'));

    if (viewId === 'view-dashboard' && currentUserProfile?.role === 'superadmin') {
      const saDash = document.getElementById('view-superadmin-dashboard');
      if (saDash) {
        saDash.classList.remove('d-none'); //

        // --- SIA COMMAND CENTER: INITIALIZATION (PHASES 1, 2 & 3) ---
        const ctx = getCtx(); //

        // Fase 1: Gestión de Usuarios e Identidades
        if (typeof AdminUsers !== 'undefined') {
          AdminUsers.init(ctx);
        }

        // Fase 2: Configuración Global y Comunicaciones
        if (typeof AdminSystem !== 'undefined') {
          AdminSystem.init(ctx);
        }

        // Fase 3: Auditoría e Inteligencia de Datos
        if (typeof AdminAudit !== 'undefined') {
          AdminAudit.init(ctx);
        }
      }

      // Carga KPIs y lógica estándar del Dashboard
      if (typeof loadDashboard === 'function') loadDashboard();

    } else {
      // Lógica para vistas estándar
      const target = document.getElementById(viewId);
      if (target) target.classList.remove('d-none');
    }

    const desktopLinks = document.querySelectorAll('.nav-floating .nav-link');
    desktopLinks.forEach(l => {
      const linkView = l.dataset.view;
      const isActive = (linkView === viewId) ||
        (viewId.startsWith('view-aula') && linkView === 'view-aula') ||
        (viewId.startsWith('view-biblio') && linkView === 'view-biblio') ||
        (viewId.startsWith('view-medi') && linkView === 'view-medi') ||
        (viewId.startsWith('view-foro') && linkView === 'view-foro');
      l.classList.toggle('active', isActive);
    });

    updateGlobalTip(viewId);
    rebuildGlobalAvisosData();

    if (viewId === 'view-dashboard') {
      if (typeof loadDashboard === 'function') loadDashboard();
      if (window.updateDashboardWidgets) window.updateDashboardWidgets();
    }

    if (viewId === 'view-profile') {
      if (typeof Profile !== 'undefined') {
        Profile.init(getCtx());
      }
    }

    // 🚀 Navbar & View Restrictions Logic (Strict Mode)
    const links = document.querySelectorAll('.main-header .nav-link');
    links.forEach(link => {
      const view = link.getAttribute('data-view') || link.dataset.view;
      if (!view) return;

      let visible = true;
      // Rule 1: Role-based default hiding (legacy)
      // Rule 2: Strict 'allowedViews' (Department Mode)
      if (currentUserProfile.allowedViews && currentUserProfile.allowedViews.length > 0) {
        // If user has restricted views, ONLY show those headers
        // Allow 'view-dashboard' if explicitly included or implied? 
        // Usually departments stick to their module.
        // Check if this link's view is in the allow list
        const isAllowed = currentUserProfile.allowedViews.some(av => av === view || av.startsWith(view));
        if (!isAllowed) visible = false;
      }

      if (visible) link.classList.remove('d-none');
      else link.classList.add('d-none');
    });

    // Special Case module initializations...
    if (viewId === 'view-medi') {
      if (currentUserProfile?.role === 'superadmin') {
        // ...
      } else if (currentUserProfile?.role === 'medico' || currentUserProfile?.role === 'docente_medico' || currentUserProfile?.role === 'Psicologo') {
        // ADDED 'Psicologo' check explicitly here to match dev mode role
        document.getElementById('medi-admin')?.classList.remove('d-none');
        document.getElementById('medi-student')?.classList.add('d-none');
        if (typeof AdminMedi !== 'undefined') AdminMedi.init(getCtx());
      } else {
        document.getElementById('medi-student')?.classList.remove('d-none');
        document.getElementById('medi-admin')?.classList.add('d-none');
        if (typeof Medi !== 'undefined') Medi.initStudent(getCtx());
      }
    }

    // ... [Other modules logic matches original] ...

    if (viewId === 'view-biblio') {
      const stu = document.getElementById('biblio-student');
      const adm = document.getElementById('biblio-admin');

      stu?.classList.add('d-none');
      adm?.classList.add('d-none');

      if (currentUserProfile?.role === 'biblio_admin' || currentUserProfile?.role === 'biblio' || currentUserProfile?.role === 'bibliotecario') {
        adm?.classList.remove('d-none');
      } else {
        stu?.classList.remove('d-none');
      }
    }

    if (viewId === 'view-lactario' && typeof Lactario !== 'undefined') {
      Lactario.init(getCtx());
    }

    if (viewId === 'view-quejas') {
      console.log("[DEBUG] Navigation to view-quejas. Checking Quejas module...", typeof Quejas);
      if (typeof Quejas !== 'undefined') {
        Quejas.init(getCtx());
      } else {
        console.error("âŒ [CRITICAL] Quejas module is UNDEFINED. Check script loading.");
        const container = document.getElementById('view-quejas');
        if (container) container.innerHTML = '<div class="alert alert-danger m-4">Error: El módulo de Quejas no se ha cargado correctamente. Intenta recargar (Ctrl+F5).</div>';
      }
    }

    if (viewId === 'view-encuestas') {
      if (typeof Encuestas !== 'undefined') {
        Encuestas.init(getCtx());
      } else {
        const container = document.getElementById('view-encuestas');
        if (container) container.innerHTML = '<div class="alert alert-danger m-4">Error: El módulo de Encuestas no se ha cargado. Intenta recargar (Ctrl+F5).</div>';
      }
    }

    if (viewId === 'view-aula') {
      mountAula(getCtx(), currentUserProfile);
    }

    if (viewId === 'view-aula-course' && window.SIA_currentCourseId) {
      if (typeof AulaContent !== 'undefined') {
        AulaContent.initCourse(getCtx(), window.SIA_currentCourseId);
      }
    }

    // Actualizar vista anterior para el próximo cambio
    _previousView = viewId;

    // ...
  }

  // --- Swipe Gestures (Phase 2 UI/UX) ---
  let touchStartX = 0;
  let touchEndX = 0;

  if (appShell) {
    appShell.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    appShell.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeGesture();
    }, { passive: true });
  }

  function handleSwipeGesture() {
    const SWIPE_THRESHOLD = 100;
    if (touchEndX < touchStartX - SWIPE_THRESHOLD) {
      // Swipe Left (Next)
    }
    if (touchEndX > touchStartX + SWIPE_THRESHOLD) {
      // Swipe Right (Prev)
    }
  }

  // --- MISSING FUNCTIONS RESTORED ---

  // --- LEGACY REGISTRATION REMOVED (Now using modules/register.js) ---




  // --- EXPORTAR GLOBALMENTE (Para HTML onClick) ---
  window.SIA = window.SIA || {};
  window.SIA.navigate = navigate;
  window.SIA.navigateFromDrawer = (viewId) => {
    navigate(viewId);
  }
  window.SIA.logout = logout;
  // loginConGoogle eliminado - ahora solo usamos Microsoft
  window.SIA.getCtx = getCtx; // Para depuración


  window.SIA.toggleMobileNotifs = () => {
    /* ... implementación existente ... */
  };

  /**
   * Controla la visibilidad de elementos de navegación según el rol.
   * Staff no debe ver Dashboard global ni selector de módulos.
   */
  function updateMenuVisibility(role) {
    const isStaff = ROLE_HOME_VIEWS[role] !== undefined;

    // 1. Mobile Nav Items
    const mobileHome = document.getElementById('nav-mobile-home');
    const mobileModules = document.getElementById('nav-mobile-module');

    if (mobileHome) mobileHome.classList.toggle('d-none', isStaff);
    if (mobileModules) mobileModules.classList.toggle('d-none', isStaff);

    // 2. Desktop Brand Link (Logotipo SIA)
    const brandLink = document.getElementById('btn-brand-home-v2');
    if (brandLink) {
      // Remover listeners previos (clonando) para limpiar comportamiento
      const newBrand = brandLink.cloneNode(true);
      brandLink.parentNode.replaceChild(newBrand, brandLink);

      if (isStaff) {
        const homeView = ROLE_HOME_VIEWS[role];
        newBrand.onclick = (e) => {
          e.preventDefault();
          showView(homeView);
        };
        newBrand.style.cursor = 'pointer';
      } else {
        newBrand.onclick = (e) => {
          e.preventDefault();
          navigate('view-dashboard');
        };
      }
    }

    // 3. Waffle Menu (App Drawer) - Escritorio
    // Buscamos el botón del waffle por su icono o clase
    const waffleIcon = document.querySelector('.bi-grid-3x3-gap-fill');
    if (waffleIcon) {
      const waffleBtn = waffleIcon.closest('button');
      if (waffleBtn) {
        const dropdownContainer = waffleBtn.closest('.dropdown');
        if (dropdownContainer) {
          dropdownContainer.classList.toggle('d-none', isStaff);
        }
      }
    }
  }




  async function loadDashboard() {
    const user = SIA.auth.currentUser;
    if (!user || !currentUserProfile) return;



    // --- 1. LÃ“GICA SUPER ADMIN ---
    if (currentUserProfile.role === 'superadmin') {
      const dashStandard = document.getElementById('view-dashboard');
      const dashSuper = document.getElementById('view-superadmin-dashboard');
      const dashDept = document.getElementById('view-department-dashboard');

      if (dashStandard) dashStandard.classList.add('d-none');
      if (dashDept) dashDept.classList.add('d-none');
      if (dashSuper) dashSuper.classList.remove('d-none');

      try {
        const usersSnap = await SIA.db.collection('usuarios').get();
        if (document.getElementById('sa-total-users'))
          document.getElementById('sa-total-users').textContent = usersSnap.size;

        const cursosSnap = await SIA.db.collection('aula-cursos').get();
        if (document.getElementById('sa-kpi-aula'))
          document.getElementById('sa-kpi-aula').textContent = cursosSnap.size;

        const mediSnap = await SIA.db.collection('medi-consultas').get();
        if (document.getElementById('sa-kpi-medi'))
          document.getElementById('sa-kpi-medi').textContent = mediSnap.size;

        const prestamosSnap = await SIA.db.collection('prestamos-biblio').where('estado', '==', 'entregado').get();
        if (document.getElementById('sa-kpi-biblio'))
          document.getElementById('sa-kpi-biblio').textContent = prestamosSnap.size;

        const inscSnap = await SIA.db.collection('aula-inscripciones').get();
        const progSnap = await SIA.db.collection('aula-progress').where('progressPct', '>=', 100).get();
        const rate = inscSnap.size > 0 ? Math.round((progSnap.size / inscSnap.size) * 100) : 0;
        if (document.getElementById('sa-rate-aula'))
          document.getElementById('sa-rate-aula').textContent = `${rate}%`;

      } catch (e) {
        console.error("Error cargando SuperAdmin Dashboard", e);
      }
      return;
    }

    // --- 1.5 LÃ“GICA DASHBOARD DEPARTAMENTAL ---
    // Si tiene allowedViews y NO es estudiante (o un rol que forza estudiante), y tiene más de 1 vista permitida
    if (currentUserProfile.allowedViews &&
      currentUserProfile.allowedViews.length > 1 &&
      currentUserProfile.role !== 'student' &&
      currentUserProfile.role !== 'docente') {

      console.log("[Dashboard] ðŸ¢ Renderizando Dashboard Departamental para:", currentUserProfile.role);

      const dashStandard = document.getElementById('view-dashboard');
      const dashSuper = document.getElementById('view-superadmin-dashboard');
      const dashDept = document.getElementById('view-department-dashboard');

      if (dashStandard) dashStandard.classList.add('d-none');
      if (dashSuper) dashSuper.classList.add('d-none');
      if (dashDept) dashDept.classList.remove('d-none');

      renderDepartmentDashboard(currentUserProfile);
      return;
    }

    // --- 2. LÃ“GICA ESTÃNDAR (Estudiante / Admin Módulo Ãšnico) ---
    const dashSuper = document.getElementById('view-superadmin-dashboard');
    const dashDept = document.getElementById('view-department-dashboard');
    if (dashSuper) dashSuper.classList.add('d-none');
    if (dashDept) dashDept.classList.add('d-none');

    const dashStandard = document.getElementById('view-dashboard');
    if (dashStandard) dashStandard.classList.remove('d-none');

    // Header y Saludo
    const now = new Date();
    const hour = now.getHours();
    let saludo = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const name = currentUserProfile.displayName || user.email.split('@')[0];

    const titleEl = document.getElementById('dash-welcome-title');
    if (titleEl) titleEl.textContent = `${saludo}, ${name}`;

    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const dayEl = document.getElementById('dash-date-day');
    const monthEl = document.getElementById('dash-date-month');
    if (dayEl) dayEl.textContent = String(now.getDate()).padStart(2, '0');
    if (monthEl) monthEl.textContent = months[now.getMonth()];

    // --- 3. CONTADORES Y HEADER STATS ---
    const aulaBadge = document.getElementById('dash-aula-badge');
    const mediBadge = document.getElementById('dash-medi-badge');
    const biblioBadge = document.getElementById('dash-biblio-badge');
    const headerCitas = document.getElementById('dash-stat-citas');
    const headerCursos = document.getElementById('dash-stat-cursos');

    try {
      // MEDI COUNT
      let mediCount = 0;
      if (currentUserProfile.role === 'medico') {
        const s1 = await SIA.db.collection('citas-medi').where('estado', '==', 'pendiente').get();
        mediCount = s1.size;
      } else {
        const s2 = await SIA.db.collection('citas-medi').where('studentId', '==', user.uid).where('estado', '==', 'pendiente').get();
        mediCount = s2.size;
      }
      if (mediBadge) mediBadge.textContent = mediCount === 1 ? '1 Pendiente' : `${mediCount} Pendientes`;
      if (headerCitas) headerCitas.textContent = mediCount;

      // BIBLIO COUNT
      let biblioCount = 0;
      if (currentUserProfile.role === 'biblio') {
        const s3 = await SIA.db.collection('prestamos-biblio').where('estado', '==', 'pendiente').get();
        biblioCount = s3.size;
      } else {
        const s4 = await SIA.db.collection('prestamos-biblio').where('studentId', '==', user.uid).where('estado', '==', 'pendiente').get();
        biblioCount = s4.size;
      }
      if (biblioBadge) biblioBadge.textContent = biblioCount === 1 ? '1 Activo' : `${biblioCount} Activos`;

      // AULA COUNT
      let aulaCount = 0;
      if (currentUserProfile.role === 'aula') {
        const s5 = await SIA.db.collection('aula-cursos').get();
        aulaCount = s5.size;
      } else {
        const s6 = await SIA.db.collection('aula-inscripciones').where('studentId', '==', user.uid).get();
        aulaCount = s6.size;
      }
      if (aulaBadge) aulaBadge.textContent = `${aulaCount} Inscritos`;
      if (headerCursos) headerCursos.textContent = aulaCount;



      // --- 4. WIDGETS DINÃMICOS COMPACTOS ---

      // A) CITAS PRÃ“XIMAS (Renderizado Ultra-Compacto)
      const widgetCitas = document.getElementById('dash-widget-citas');
      if (widgetCitas) {
        const citasSnap = await SIA.db.collection('citas-medi')
          .where('studentId', '==', user.uid)
          .where('estado', 'in', ['pendiente', 'confirmada'])
          .orderBy('fechaHoraSlot', 'asc')
          .limit(2)
          .get()
          .catch(() => ({ empty: true }));

        if (!citasSnap.empty) {
          widgetCitas.innerHTML = citasSnap.docs.map(d => {
            const c = d.data();
            const dateObj = c.fechaHoraSlot ? c.fechaHoraSlot.toDate() : new Date();
            const hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const color = c.estado === 'confirmada' ? 'border-success' : 'border-warning';

            return `
              <div class="d-flex align-items-center gap-2 mb-2 p-2 rounded-3 bg-light border-start border-3 ${color}">
                <div class="fw-bold small" style="min-width: 45px;">${hora}</div>
                <div class="extra-small text-truncate" title="${c.tipoServicio}">${c.tipoServicio}</div>
              </div>`;
          }).join('');
        } else {
          widgetCitas.innerHTML = `<div class="extra-small text-muted text-center py-2">Sin citas pendientes</div>`;
        }
      }

      // B) CURSOS ACTIVOS (Diseño de Barras de Progreso)
      const widgetCursos = document.getElementById('dash-widget-cursos');
      if (widgetCursos && currentUserProfile.role === 'student') {
        const inscSnap = await SIA.db.collection('aula-inscripciones')
          .where('studentId', '==', user.uid)
          .orderBy('fechaInscripcion', 'desc')
          .limit(2)
          .get();

        if (!inscSnap.empty) {
          let htmlCursos = '';
          for (const doc of inscSnap.docs) {
            const insc = doc.data();
            let progress = 0;
            try {
              const progDoc = await SIA.db.collection('aula-progress').doc(`${user.uid}_${insc.cursoId}`).get();
              if (progDoc.exists) progress = progDoc.data().progressPct || 0;
            } catch (e) { }

            htmlCursos += `
              <div class="mb-3" onclick="SIA_navToCourse('${insc.cursoId}')" style="cursor: pointer;">
                <div class="d-flex justify-content-between extra-small mb-1">
                  <span class="fw-bold text-dark text-truncate" style="max-width: 180px;">${insc.cursoTitulo}</span>
                  <span class="text-primary fw-bold">${progress}%</span>
                </div>
                <div class="progress" style="height: 4px; background-color: rgba(0,0,0,0.05);">
                  <div class="progress-bar bg-aula" style="width: ${progress}%"></div>
                </div>
              </div>`;
          }
          widgetCursos.innerHTML = htmlCursos;
        } else {
          widgetCursos.innerHTML = `<div class="text-center py-2 text-muted extra-small">No hay cursos activos</div>`;
        }
      }

    } catch (err) {
      console.error('Dashboard Update Error:', err);
    }
  }

  history.replaceState({ viewId: 'landing' }, '', '/');

  // --- MOBILE NAV LOGIC (Last Module + Waffle) ---
  let lastModuleVisited = null;
  const MOBILE_MODULES = {
    'view-aula': { icon: 'bi-mortarboard-fill', label: 'Aula' },
    'view-medi': { icon: 'bi-heart-pulse-fill', label: 'Medi' },
    'view-biblio': { icon: 'bi-book-half', label: 'Biblio' },
    'view-foro': { icon: 'bi-chat-square-quote-fill', label: 'Foro' }
  };

  function updateMobileNavState(viewId) {
    // 1. Update Active State
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));

    if (viewId === 'view-dashboard') {
      const homeBtn = document.getElementById('nav-mobile-home');
      if (homeBtn) homeBtn.classList.add('active');

      // Reset Module Button to Last Visited or Default
      updateModuleButtonUI(lastModuleVisited);

    } else if (viewId === 'view-profile') {
      const profBtn = document.getElementById('nav-mobile-profile');
      if (profBtn) profBtn.classList.add('active');
      updateModuleButtonUI(lastModuleVisited);

    } else if (MOBILE_MODULES[viewId]) {
      // User is IN a module
      lastModuleVisited = viewId;
      updateModuleButtonUI(viewId, true);
    } else {
      // Other view (e.g. settings) - Generic
      updateModuleButtonUI(lastModuleVisited);
    }
  }

  function updateModuleButtonUI(viewId, isActive = false) {
    const btn = document.getElementById('nav-mobile-module');
    const icon = document.getElementById('nav-mobile-module-icon');
    const text = document.getElementById('nav-mobile-module-text');

    if (!btn || !icon || !text) return;

    if (isActive) btn.classList.add('active');
    else btn.classList.remove('active');

    if (viewId && MOBILE_MODULES[viewId]) {
      icon.className = `bi ${MOBILE_MODULES[viewId].icon}`;
      text.textContent = MOBILE_MODULES[viewId].label;
    } else {
      // Default State (Waffle)
      icon.className = 'bi bi-grid-fill';
      text.textContent = 'Módulos';
    }
  }

  window.SIA.handleMobileModuleClick = () => {

    if (lastModuleVisited && lastModuleVisited !== window.SIA_currentView) {
      navigate(lastModuleVisited);
    } else {

      const drawerBtn = document.querySelector('.dropdown button[data-bs-toggle="dropdown"]');

      if (window.bootstrap) {


        const topWaffleBtn = document.querySelector('.dropdown button[title="Aplicaciones"]');
        if (topWaffleBtn) topWaffleBtn.click();
      }
    }
  };

  // ==============================
  // NAVBAR PROFILE ACTIONS (FIX)
  // ==============================
  document.addEventListener('click', (e) => {

    // Mi Perfil
    const profileBtn = e.target.closest('[data-view="view-profile"]');
    if (profileBtn) {
      e.preventDefault();
      navigate('view-profile');
      return;
    }

    // Logout
    const logoutBtn = e.target.closest('#btn-logout-v2');
    if (logoutBtn) {
      e.preventDefault();
      logout();
      return;
    }

  });


  // --- LONG PRESS LOGIC SETUP ---
  const moduleBtn = document.getElementById('nav-mobile-module');
  if (moduleBtn) {
    let pressTimer;
    moduleBtn.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        // Open Waffle
        const topWaffleBtn = document.querySelector('.dropdown button[title="Aplicaciones"]');
        if (topWaffleBtn) topWaffleBtn.click();

        // Prevent click handling if long pressed
        moduleBtn.dataset.longPressed = "true";
      }, 600);
    }, { passive: true });

    moduleBtn.addEventListener('touchend', (e) => {
      clearTimeout(pressTimer);
    });

    moduleBtn.addEventListener('click', (e) => {
      if (moduleBtn.dataset.longPressed === "true") {
        e.preventDefault();
        e.stopPropagation();
        moduleBtn.dataset.longPressed = "false"; // Reset
        return;
      }
      // Normal click handled by onclick in HTML -> handleMobileModuleClick
    });
  }

  // --- PWA INSTALL LOGIC V2 (Smart Detection + Friendly Banners) ---
  let deferredPrompt = null;

  // Detectar si la app ya está instalada
  function isAppInstalled() {
    // Método 1: display-mode standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // Método 2: iOS standalone
    if (window.navigator.standalone === true) {
      return true;
    }
    // Método 3: Android TWA
    if (document.referrer.includes('android-app://')) {
      return true;
    }
    return false;
  }

  // Verificar si el banner está en cooldown (snoozed)
  function isBannerSnoozed() {
    const snoozed = localStorage.getItem('sia_pwa_snoozed');
    if (!snoozed) return false;

    const snoozeTime = parseInt(snoozed, 10);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - snoozeTime < sevenDays) {
      return true; // Aún en período de snooze
    }

    // Expiró el snooze, limpiar
    localStorage.removeItem('sia_pwa_snoozed');
    return false;
  }

  // Capturar el evento de instalación
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.SIA = window.SIA || {};
    window.SIA.deferredPrompt = e;
    console.log("📱 PWA Install Prompt capturado.");

    // Mostrar banner si corresponde
    checkAndShowPWABanner();
  });

  // Detectar cuando la app es instalada
  window.addEventListener('appinstalled', () => {
    console.log('🎉 PWA instalada exitosamente!');
    deferredPrompt = null;
    const banner = document.getElementById('sia-pwa-banner');
    if (banner) banner.remove();
    // Limpiar snooze si existía
    localStorage.removeItem('sia_pwa_snoozed');
    // Mostrar banner de agradecimiento después de recargar
    setTimeout(() => {
      checkAndShowPWABanner();
    }, 1000);
  });

  // Función principal para mostrar banner inteligente
  function checkAndShowPWABanner() {
    const dashContainer = document.getElementById('view-dashboard');
    if (!dashContainer || dashContainer.classList.contains('d-none')) {
      return; // No estamos en dashboard
    }

    // Verificar si ya existe el banner
    if (document.getElementById('sia-pwa-banner')) return;

    const installed = isAppInstalled();
    const snoozed = isBannerSnoozed();

    // Si está en snooze, no mostrar nada
    if (snoozed) return;

    let banner = null;

    if (installed) {
      // Banner de AGRADECIMIENTO (App ya instalada)
      banner = createInstalledBanner();
    } else if (deferredPrompt) {
      // Banner PROMOCIONAL (App disponible para instalar)
      banner = createPromoBanner();
    }
    // Si no hay deferredPrompt y no está instalada, no mostrar nada (navegador incompatible)

    if (banner) {
      dashContainer.insertBefore(banner, dashContainer.firstChild);
    }
  }

  // Banner promocional cuando la app NO está instalada
  function createPromoBanner() {
    const banner = document.createElement('div');
    banner.id = 'sia-pwa-banner';
    banner.className = 'alert border-0 shadow-sm rounded-4 mb-4 animate-fade-in';
    banner.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    banner.innerHTML = `
      <div class="d-flex align-items-center gap-3 text-white">
        <div class="bg-white bg-opacity-25 rounded-circle p-3 d-flex">
          <i class="bi bi-phone-fill fs-4"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">📱 ¡Descarga la App de SIA!</div>
          <div class="small opacity-90">
            ✨ Acceso instantáneo • 🚀 Más rápida • 📴 Funciona sin conexión
          </div>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-light bg-white bg-opacity-25 text-white border-0 rounded-pill"
                  onclick="window.SIA.snoozePWA()"
                  title="Recordar en 7 días">
            Después
          </button>
          <button class="btn btn-sm btn-light rounded-pill fw-bold shadow"
                  onclick="window.SIA.installApp()">
            <i class="bi bi-download me-1"></i>Instalar
          </button>
        </div>
      </div>
    `;
    return banner;
  }

  // Banner de agradecimiento cuando la app YA está instalada
  function createInstalledBanner() {
    const banner = document.createElement('div');
    banner.id = 'sia-pwa-banner';
    banner.className = 'alert alert-success border-0 shadow-sm rounded-4 mb-4 animate-fade-in';
    banner.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        <div class="bg-success bg-opacity-25 text-success rounded-circle p-2 d-flex">
          <i class="bi bi-check-circle-fill fs-4"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold text-success mb-1">¡Gracias por usar la App de SIA!</div>
          <div class="small text-success">
            Ya tienes instalada nuestra aplicación. Disfruta de acceso rápido y sin conexión.
          </div>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-outline-success rounded-pill"
                  onclick="window.SIA.showReinstallInstructions()"
                  title="Ver cómo reinstalar la app">
            <i class="bi bi-gear me-1"></i>Gestionar
          </button>
          <button class="btn btn-sm btn-light border rounded-pill"
                  onclick="window.SIA.dismissInstalledBanner()"
                  title="Entendido, no volver a mostrar por 7 días">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;
    return banner;
  }

  // Función para instalar la app
  async function installApp() {
    if (!deferredPrompt) {
      // Si no hay prompt, verificar si está instalada
      if (isAppInstalled()) {
        if (typeof showToast === 'function') {
          showToast("¡La app ya está instalada! 🎉", "success");
        }
      } else {
        if (typeof showToast === 'function') {
          showToast("Tu navegador no soporta la instalación de apps web.", "warning");
        }
      }
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`📱 PWA Install choice: ${outcome}`);

      if (outcome === 'accepted') {
        console.log('✅ Usuario aceptó instalar la PWA');
        deferredPrompt = null;
        window.SIA.deferredPrompt = null;
        const banner = document.getElementById('sia-pwa-banner');
        if (banner) banner.remove();

        if (typeof showToast === 'function') {
          showToast("¡App instalada con éxito! 🎉", "success");
        }
      } else {
        console.log('âŒ Usuario rechazó instalar la PWA');
      }
    } catch (err) {
      console.error('Error al intentar instalar PWA:', err);
    }
  }

  // Snooze por 7 días (recordar después)
  function snoozePWA() {
    const banner = document.getElementById('sia-pwa-banner');
    if (banner) banner.remove();

    localStorage.setItem('sia_pwa_snoozed', Date.now().toString());

    if (typeof showToast === 'function') {
      showToast("Te recordaremos en 7 días 📅", "info");
    }
  }

  // Descartar banner de "ya instalada"
  function dismissInstalledBanner() {
    const banner = document.getElementById('sia-pwa-banner');
    if (banner) banner.remove();

    // También usar snooze para este caso
    localStorage.setItem('sia_pwa_snoozed', Date.now().toString());

    if (typeof showToast === 'function') {
      showToast("¡Perfecto! 👍", "success");
    }
  }

  // Mostrar instrucciones de reinstalación
  function showReinstallInstructions() {
    // Detectar si es iOS o Android
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let instructions = '';

    if (isAndroid) {
      instructions = `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-android2 text-success me-2"></i>Cómo Reinstalar en Android</h6>

          <div class="mb-3">
            <div class="badge bg-danger mb-2">1. Desinstalar</div>
            <ul class="small mb-0">
              <li>Mantén presionado el ícono de SIA en tu pantalla</li>
              <li>Selecciona "Desinstalar" o arrastra a "Eliminar"</li>
              <li class="text-muted">O ve a: Configuración → Apps → SIA → Desinstalar</li>
            </ul>
          </div>

          <div class="mb-3">
            <div class="badge bg-success mb-2">2. Reinstalar</div>
            <ul class="small mb-0">
              <li>Abre el sitio web de SIA en Chrome</li>
              <li>Toca el menú <strong>â‹®</strong> (tres puntos)</li>
              <li>Selecciona <strong>"Instalar app"</strong> o <strong>"Agregar a inicio"</strong></li>
            </ul>
          </div>

          <div class="alert alert-info border-0 small mb-0">
            <i class="bi bi-info-circle me-1"></i>
            Después de desinstalar, el banner de instalación aparecerá automáticamente.
          </div>
        </div>
      `;
    } else if (isIOS) {
      instructions = `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-apple text-dark me-2"></i>Cómo Reinstalar en iOS</h6>

          <div class="mb-3">
            <div class="badge bg-danger mb-2">1. Eliminar</div>
            <ul class="small mb-0">
              <li>Mantén presionado el ícono de SIA en tu pantalla</li>
              <li>Toca "Eliminar app" → "Eliminar"</li>
            </ul>
          </div>

          <div class="mb-3">
            <div class="badge bg-success mb-2">2. Reinstalar</div>
            <ul class="small mb-0">
              <li>Abre el sitio de SIA en <strong>Safari</strong></li>
              <li>Toca el botón <strong>Compartir</strong> <i class="bi bi-box-arrow-up"></i></li>
              <li>Selecciona <strong>"Agregar a pantalla de inicio"</strong></li>
            </ul>
          </div>

          <div class="alert alert-warning border-0 small mb-0">
            <i class="bi bi-exclamation-triangle me-1"></i>
            <strong>Importante:</strong> En iOS solo funciona con Safari, no con Chrome.
          </div>
        </div>
      `;
    } else {
      instructions = `
        <div class="text-start">
          <h6 class="fw-bold mb-3"><i class="bi bi-laptop me-2"></i>Gestionar Instalación</h6>

          <div class="mb-3">
            <div class="badge bg-primary mb-2">Desde el Navegador</div>
            <ul class="small mb-0">
              <li>Haz clic en el icono de instalación <i class="bi bi-plus-circle"></i> en la barra de direcciones</li>
              <li>O abre el menú del navegador → "Instalar SIA"</li>
            </ul>
          </div>

          <div class="alert alert-info border-0 small mb-0">
            <i class="bi bi-info-circle me-1"></i>
            Para desinstalar, busca "SIA" en tu lista de aplicaciones y elimínala como cualquier otra app.
          </div>
        </div>
      `;
    }

    // Crear modal o usar SweetAlert si está disponible
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        html: instructions,
        icon: null,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#198754',
        width: '500px',
        customClass: {
          popup: 'text-start'
        }
      });
    } else {
      // Fallback: crear modal con Bootstrap
      const modalId = 'pwa-reinstall-modal';
      let modal = document.getElementById(modalId);

      if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.innerHTML = `
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header border-0">
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body px-4 pb-4">
                ${instructions}
              </div>
              <div class="modal-footer border-0">
                <button type="button" class="btn btn-success rounded-pill px-4" data-bs-dismiss="modal">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      } else {
        modal.querySelector('.modal-body').innerHTML = instructions;
      }

      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  // Monitor view changes para mostrar banner cuando se entre al dashboard
  window.addEventListener('sia-view-changed', (e) => {
    if (e.detail && e.detail.viewId === 'view-dashboard') {
      setTimeout(checkAndShowPWABanner, 500);
    }
  });

  // Exponer funciones a SIA
  window.SIA = window.SIA || {};
  window.SIA.installApp = installApp;
  window.SIA.snoozePWA = snoozePWA;
  window.SIA.dismissPWA = snoozePWA; // Compatibilidad con código antiguo
  window.SIA.dismissInstalledBanner = dismissInstalledBanner;
  window.SIA.checkPWABanner = checkAndShowPWABanner;
  window.SIA.showReinstallInstructions = showReinstallInstructions;

  /* ==========================================================================
     DASHBOARD V3 LOGIC (SMART CARDS & NAV)
     ========================================================================== */

  // 1. Bottom Nav Logic
  window.updateBottomNav = function (element) {
    if (!element) return;
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
  };

  window.openDigitalID = function () {
    const modalEl = document.getElementById('modalDigitalID');
    if (!modalEl) return;

    // A. Populate Data (Robust Fallback)
    const user = (window.SIA && window.SIA.currentUserProfile) ? window.SIA.currentUserProfile : (window.currentUserProfile || {});

    // Name
    const nameEl = document.getElementById('prof-id-name');
    if (nameEl) nameEl.textContent = user.displayName || 'Estudiante';

    // Matricula
    let mat = user.matricula;
    if (!mat && user.email) mat = user.email.split('@')[0]; // Simple fallback
    if (!mat && user.uid) mat = user.uid.substring(0, 8).toUpperCase();
    const matEl = document.getElementById('prof-id-matricula');
    if (matEl) matEl.textContent = mat || '-------';

    // Avatar (NEW)
    const avatarImg = document.getElementById('prof-id-avatar-img');
    const avatarInit = document.getElementById('prof-id-avatar-init');
    if (user.photoURL && avatarImg) {
      avatarImg.src = user.photoURL;
      avatarImg.classList.remove('d-none');
      if (avatarInit) avatarInit.classList.add('d-none');
    } else if (avatarInit) {
      avatarInit.textContent = (user.displayName || 'U').substring(0, 2).toUpperCase();
      avatarInit.classList.remove('d-none');
      if (avatarImg) avatarImg.classList.add('d-none');
    }

    // QR Code
    const qrVal = mat || user.uid || 'SIA-USER';
    const qrImg = document.getElementById('prof-qr-full');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrVal}`;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  };

  // 2. Modules Drawer Logic with Dynamic Content
  window.SIA.toggleModulesDrawer = function () {
    const drawer = document.getElementById('sia-modules-drawer');
    if (!drawer) return;
    const content = drawer.querySelector('.modules-drawer-content');

    if (drawer.classList.contains('d-none')) {
      // Update content before showing
      updateModulesDrawerContent();

      drawer.classList.remove('d-none');
      toggleBodyScroll(true); // Lock Scroll
      content.style.animation = 'none';
      content.offsetHeight;
      content.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    } else {
      drawer.classList.add('d-none');
      toggleBodyScroll(false); // Unlock Scroll
    }
  };

  /**
   * Actualiza el contenido del drawer de módulos dinámicamente
   * basándose en los permisos del usuario
   */
  function updateModulesDrawerContent() {
    const drawerBody = document.getElementById('modules-drawer-body');
    if (!drawerBody) return;

    if (!currentUserProfile) {
      drawerBody.innerHTML = '<div class="text-center py-5 text-muted small">Inicia sesión para ver módulos</div>';
      return;
    }

    const allowedViews = currentUserProfile.allowedViews || [];
    const role = currentUserProfile.role;

    // Definición de todos los módulos disponibles
    const allModules = [
      {
        id: 'aula',
        view: 'view-aula',
        label: 'Aula Virtual',
        icon: 'mortarboard-fill',
        color: 'aula',
        category: 'academico',
        description: 'Cursos y capacitaciones'
      },
      {
        id: 'medi',
        view: 'view-medi',
        label: 'Servicios Médicos',
        icon: 'heart-pulse-fill',
        color: 'danger',
        category: 'servicios',
        description: 'Salud y bienestar'
      },
      {
        id: 'biblio',
        view: 'view-biblio',
        label: 'Biblioteca',
        icon: 'book-half',
        color: 'warning',
        category: 'servicios',
        description: 'Catálogo y préstamos'
      },
      {
        id: 'foro',
        view: 'view-foro',
        label: 'Eventos',
        icon: 'calendar-event',
        color: 'info',
        category: 'comunidad',
        description: 'Eventos del campus'
      },
      {
        id: 'quejas',
        view: 'view-quejas',
        label: 'Quejas y Sugerencias',
        icon: 'chat-heart-fill',
        color: 'primary',
        category: 'comunidad',
        description: 'Tu opinión cuenta'
      },
      {
        id: 'encuestas',
        view: 'view-encuestas',
        label: 'Encuestas',
        icon: 'clipboard2-check-fill',
        color: 'success',
        category: 'comunidad',
        description: 'Evaluaciones y feedback'
      },
      {
        id: 'lactario',
        view: 'view-lactario',
        label: 'Lactario',
        icon: 'heart',
        color: 'pink',
        category: 'servicios',
        description: 'Sala de lactancia'
      },
      {
        id: 'profile',
        view: 'view-profile',
        label: 'Mi Perfil',
        icon: 'person-badge-fill',
        color: 'dark',
        category: 'cuenta',
        description: 'Información personal'
      }
    ];

    // Filtrar módulos basándose en permisos
    let visibleModules = allModules;

    if (allowedViews.length > 0 && role !== 'student' && role !== 'docente') {
      // Usuario con permisos restringidos (ej. departamento)
      visibleModules = allModules.filter(m =>
        allowedViews.some(av => av === m.view || m.view.startsWith(av))
      );
    }

    // Agrupar por categoría
    const categories = {
      academico: { label: 'Académico', modules: [] },
      servicios: { label: 'Servicios', modules: [] },
      comunidad: { label: 'Comunidad', modules: [] },
      cuenta: { label: 'Mi Cuenta', modules: [] }
    };

    visibleModules.forEach(m => {
      if (categories[m.category]) {
        categories[m.category].modules.push(m);
      }
    });

    // Renderizar
    let html = '';

    Object.entries(categories).forEach(([key, cat]) => {
      if (cat.modules.length === 0) return;

      html += `
        <div class="module-group mb-4">
          <div class="group-label mb-3">${cat.label}</div>
          <div class="modules-grid">
      `;


      cat.modules.forEach(m => {
        const iconMap = {
          'aula': 'aula.png',
          'medi': 'medi.png',
          'biblio': 'biblio.png',
          'foro': 'foro.png',
          'lactario': 'lactario.png',
          'quejas': 'quejas.png',
          'encuestas': 'encuestas.png',
          'profile': 'perfil.png'
        };

        let iconHtml = `<i class="bi bi-${m.icon}"></i>`;

        if (iconMap[m.id]) {
          iconHtml = `<img src="images/${iconMap[m.id]}" alt="${m.label}" style="width: 42px; height: 42px; object-fit: contain;">`;
        }

        html += `
            <div class="module-card" onclick="window.SIA.navigate('${m.view}'); window.SIA.toggleModulesDrawer();">
              <div class="module-icon  d-flex align-items-center justify-content-center">
                ${iconHtml}
              </div>
              <span class="module-label">${m.label}</span>
              <span class="extra-small text-muted opacity-75" style="font-size: 0.65rem;">${m.description}</span>
            </div>
          `;
      });

      html += `
          </div>
        </div>
      `;
    });

    if (html === '') {
      html = '<div class="text-center py-5 text-muted small">No hay módulos disponibles</div>';
    }

    drawerBody.innerHTML = html;
  }

  // 3. Notifications View Logic (FIXED: No Bootstrap Modal)
  window.SIA.toggleNotificationsView = function () {
    const drawer = document.getElementById('sia-notifications-drawer');
    if (!drawer) return;
    const content = drawer.querySelector('.modules-drawer-content');

    if (drawer.classList.contains('d-none')) {
      drawer.classList.remove('d-none');
      toggleBodyScroll(true); // Lock Scroll
      content.style.animation = 'none';
      content.offsetHeight;
      content.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    } else {
      drawer.classList.add('d-none');
      toggleBodyScroll(false); // Unlock Scroll
    }
  };

  // 4. Speed Dial Logic (Quick Actions)
  window.SIA.toggleSpeedDial = function () {
    const drawer = document.getElementById('sia-speed-dial-drawer');
    if (!drawer) return;
    const content = drawer.querySelector('.modules-drawer-content');

    if (drawer.classList.contains('d-none')) {
      // Update QR visibility based on role
      if (currentUserProfile) {
        const isAdmin = currentUserProfile.role === 'admin' || currentUserProfile.role === 'superadmin';
        const qrAction = document.getElementById('speed-dial-qr');
        if (qrAction) {
          qrAction.classList.toggle('d-none', isAdmin);
        }
      }

      drawer.classList.remove('d-none');
      toggleBodyScroll(true); // Lock Scroll
      content.style.animation = 'none';
      content.offsetHeight;
      content.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    } else {
      drawer.classList.add('d-none');
      toggleBodyScroll(false); // Unlock Scroll
    }
  };

  // 5. Mobile Search Logic
  window.SIA.openMobileSearch = function () {
    const drawer = document.getElementById('sia-mobile-search-drawer');
    if (!drawer) return;
    const content = drawer.querySelector('.modules-drawer-content');
    const input = document.getElementById('mobile-search-input');

    drawer.classList.remove('d-none');
    toggleBodyScroll(true); // Lock Scroll
    content.style.animation = 'none';
    content.offsetHeight;
    content.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';

    // Focus input after animation
    setTimeout(() => {
      if (input) input.focus();
    }, 350);
  };

  window.SIA.closeMobileSearch = function () {
    const drawer = document.getElementById('sia-mobile-search-drawer');
    if (!drawer) return;
    drawer.classList.add('d-none');
    toggleBodyScroll(false); // Unlock Scroll

    // Clear search
    const input = document.getElementById('mobile-search-input');
    if (input) input.value = '';

    const results = document.getElementById('mobile-search-results');
    if (results) {
      results.classList.add('d-none');
      results.innerHTML = '';
    }
  };

  // 6. Pull-to-Refresh Logic (Mobile)
  (function initPullToRefresh() {
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isPulling = false;
    let refreshThreshold = 80; // pixels to trigger refresh

    // Create refresh indicator
    const refreshIndicator = document.createElement('div');
    refreshIndicator.id = 'pull-to-refresh-indicator';
    refreshIndicator.className = 'd-md-none'; // Only mobile
    refreshIndicator.innerHTML = `
      <div class="text-center py-3" style="transition: all 0.3s ease;">
        <i class="bi bi-arrow-clockwise fs-5 text-primary"></i>
        <div class="extra-small text-muted mt-1">Jala para refrescar</div>
      </div>
    `;
    refreshIndicator.style.cssText = `
      position: fixed;
      top: -100px;
      left: 0;
      right: 0;
      z-index: 9999;
      background: var(--bs-body-bg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: top 0.3s ease;
    `;

    document.body.appendChild(refreshIndicator);

    document.addEventListener('touchstart', (e) => {
      // Only on dashboard and at top of page
      const isDashboard = window.location.pathname === '/dashboard' ||
        window.location.pathname === '/' ||
        document.getElementById('view-dashboard')?.classList.contains('d-none') === false;

      if (!isDashboard) return;
      if (window.scrollY > 0) return; // Not at top

      // Ignore if a Bootstrap modal is open
      if (document.querySelector('.modal.show')) return;

      // Ignore if the modules drawer is open
      const drawer = document.getElementById('sia-modules-drawer');
      if (drawer && !drawer.classList.contains('d-none')) return;

      // Ignore if a Bootstrap dropdown is open
      if (document.querySelector('.dropdown-menu.show')) return;

      // Ignore if an offcanvas is open
      if (document.querySelector('.offcanvas.show')) return;

      // Ignore if touch originates inside a scrollable container
      const target = e.target;
      let el = target;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return; // Inside a scrollable element
        }
        el = el.parentElement;
      }

      touchStartY = e.touches[0].clientY;
      isPulling = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      if (window.scrollY > 0) {
        isPulling = false;
        return;
      }

      touchCurrentY = e.touches[0].clientY;
      const pullDistance = touchCurrentY - touchStartY;

      if (pullDistance > 0 && pullDistance < 150) {
        e.preventDefault();
        const progress = Math.min(pullDistance / refreshThreshold, 1);
        refreshIndicator.style.top = `${-100 + (progress * 100)}px`;

        // Rotate icon based on progress
        const icon = refreshIndicator.querySelector('.bi-arrow-clockwise');
        if (icon) {
          icon.style.transform = `rotate(${progress * 360}deg)`;
        }

        // Change text when threshold reached
        const text = refreshIndicator.querySelector('.extra-small');
        if (text) {
          text.textContent = pullDistance >= refreshThreshold ? 'Suelta para refrescar' : 'Jala para refrescar';
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (!isPulling) return;

      const pullDistance = touchCurrentY - touchStartY;

      if (pullDistance >= refreshThreshold) {
        // Trigger refresh
        refreshIndicator.style.top = '0px';
        const icon = refreshIndicator.querySelector('.bi-arrow-clockwise');
        if (icon) {
          icon.classList.add('spin');
        }

        // Reload dashboard
        setTimeout(() => {
          if (typeof loadDashboard === 'function') {
            loadDashboard();
          }

          // Reset indicator
          setTimeout(() => {
            refreshIndicator.style.top = '-100px';
            if (icon) {
              icon.classList.remove('spin');
              icon.style.transform = 'rotate(0deg)';
            }
          }, 1000);
        }, 500);
      } else {
        // Reset indicator
        refreshIndicator.style.top = '-100px';
        const icon = refreshIndicator.querySelector('.bi-arrow-clockwise');
        if (icon) {
          icon.style.transform = 'rotate(0deg)';
        }
      }

      isPulling = false;
      touchStartY = 0;
      touchCurrentY = 0;
    }, { passive: true });
  })();

  window.toggleDarkMode = function () {
    const html = document.documentElement;
    const inputs = document.querySelectorAll('#switch-dark-mode-notifs');
    const isDark = html.getAttribute('data-bs-theme') === 'dark';

    if (isDark) {
      html.setAttribute('data-bs-theme', 'light');
      inputs.forEach(i => i.checked = false);
    } else {
      html.setAttribute('data-bs-theme', 'dark');
      inputs.forEach(i => i.checked = true);
    }
  };

  // 4. Global Avisos / Stories Logic
  window.openGlobalAvisosModal = function () {
    window.SIA.toggleNotificationsView();
  };

  // Stories Data - Real Encuestas Integration
  // No more mock data - stories are populated from active surveys

  async function renderDashboardStories() {
    const container = document.getElementById('dashboard-stories-wrapper');
    if (!container) return;

    container.innerHTML = '';

    if (!currentUserProfile) {
      _showNoNewsPlaceholder(container);
      return;
    }

    // --- Lazy-load services ---
    async function _loadServiceIfNeeded(globalName, scriptPath) {
      if (window[globalName]) return;
      try {
        await new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${scriptPath}"]`)) {
            let attempts = 0;
            const poll = setInterval(() => {
              if (window[globalName] || attempts > 20) { clearInterval(poll); resolve(); }
              attempts++;
            }, 100);
            return;
          }
          const s = document.createElement('script');
          s.src = scriptPath;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load ' + scriptPath));
          document.head.appendChild(s);
        });
      } catch (e) {
        console.warn('[Stories] Could not load ' + globalName + ':', e);
      }
    }

    await Promise.all([
      _loadServiceIfNeeded('EncuestasService', '/services/encuestas-service.js'),
      _loadServiceIfNeeded('ForoService', '/services/foro-service.js')
    ]);

    try {
      const baseCtx = getCtx();
      const ctx = {
        ...baseCtx,
        user: baseCtx.auth?.currentUser || null,
        profile: baseCtx.currentUserProfile || currentUserProfile
      };
      if (!ctx.user) {
        _showNoNewsPlaceholder(container);
        return;
      }

      // Fetch stories de las 3 fuentes en paralelo
      const [allSurveys, foroEvents, avisosStories] = await Promise.all([
        window.EncuestasService
          ? (EncuestasService.getSurveysForUserStories || EncuestasService.getPendingSurveysForUser)(ctx).catch(() => [])
          : [],
        window.ForoService?.getEventsForStories
          ? ForoService.getEventsForStories(ctx).catch(() => [])
          : [],
        window.AvisosService?.getAvisosForStories
          ? AvisosService.getAvisosForStories(ctx).catch(() => [])
          : []
      ]);

      // Merge: encuestas + foro events + avisos como stories unificadas
      const allStories = [
        ...allSurveys.map(s => ({ ...s, _source: 'encuesta' })),
        ...foroEvents.map(e => ({ ...e, _source: 'foro' })),
        ...avisosStories.map(a => ({ ...a, _source: 'aviso' }))
      ];

      // Ordenar: nuevos primero (por createdAt descendente)
      allStories.sort((a, b) => {
        const getTime = (item) => {
          const d = item.createdAt;
          if (!d) return 0;
          if (d.toDate) return d.toDate().getTime();
          if (d instanceof Date) return d.getTime();
          return new Date(d).getTime();
        };
        return getTime(b) - getTime(a);
      });

      if (allStories.length === 0) {
        _showNoNewsPlaceholder(container);
        return;
      }

      const seenKey = 'sia_stories_seen';
      const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');

      allStories.forEach(story => {
        const isSeen = !!seen[story.id];
        const div = document.createElement('div');
        div.className = 'story-item text-center animate-fade-in';

        if (story._source === 'encuesta') {
          // --- Encuesta story ---
          const isResponded = !!story.responded;
          const ringActive = !isSeen && !isResponded;
          const ringClass = ringActive ? 'story-ring active' : 'story-ring';
          const iconClass = isResponded ? 'bi-clipboard-check-fill' : 'bi-clipboard-check';
          const bgClass = isResponded ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info';

          div.onclick = () => {
            seen[story.id] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
            _openStoryPreviewModal(story, ctx);
            const ring = div.querySelector('.story-ring');
            if (ring) ring.classList.remove('active');
          };

          div.innerHTML = `
            <div class="${ringClass} mb-1">
              <div class="story-circle ${bgClass} d-flex align-items-center justify-content-center">
                <i class="bi ${iconClass}"></i>
              </div>
            </div>
            <span class="d-block extra-small fw-bold text-muted text-truncate" style="max-width: 70px;">${story.title.length > 10 ? story.title.slice(0, 9) + '…' : story.title}</span>`;

        } else if (story._source === 'aviso') {
          // --- Aviso story ---
          const ringActive = !isSeen;
          const ringClass = ringActive ? 'story-ring aviso-ring active' : 'story-ring aviso-ring';
          const iconClass = story.type === 'image' ? 'bi-image-fill' : 'bi-megaphone-fill';
          const bgClass = story.priority === 'urgent' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success';

          div.onclick = () => {
            seen[story.id] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
            _openAvisoStoryPreviewModal(story);
            const ring = div.querySelector('.story-ring');
            if (ring) ring.classList.remove('active');
          };

          div.innerHTML = `
            <div class="${ringClass} mb-1">
              <div class="story-circle ${bgClass} d-flex align-items-center justify-content-center">
                <i class="bi ${iconClass}"></i>
              </div>
            </div>
            <span class="d-block extra-small fw-bold text-muted text-truncate" style="max-width: 70px;">${story.title.length > 10 ? story.title.slice(0, 9) + '...' : story.title}</span>`;

        } else {
          // --- Foro event story ---
          const isRegistered = !!story.registered;
          const ringActive = !isSeen && !isRegistered;
          const ringClass = ringActive ? 'story-ring active' : 'story-ring';
          const iconClass = isRegistered ? 'bi-calendar-check-fill' : 'bi-calendar-event';
          const bgClass = isRegistered ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning';

          div.onclick = () => {
            seen[story.id] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
            _openForoStoryPreviewModal(story, ctx);
            const ring = div.querySelector('.story-ring');
            if (ring) ring.classList.remove('active');
          };

          div.innerHTML = `
            <div class="${ringClass} mb-1">
              <div class="story-circle ${bgClass} d-flex align-items-center justify-content-center">
                <i class="bi ${iconClass}"></i>
              </div>
            </div>
            <span class="d-block extra-small fw-bold text-muted text-truncate" style="max-width: 70px;">${story.title.length > 10 ? story.title.slice(0, 9) + '…' : story.title}</span>`;
        }

        container.appendChild(div);
      });
    } catch (e) {
      console.warn('[Stories] Error loading stories:', e);
      _showNoNewsPlaceholder(container);
    }
  }

  function _showNoNewsPlaceholder(container) {
    const ph = document.createElement('div');
    ph.className = 'story-item text-center animate-fade-in';
    ph.innerHTML = `
      <div class="story-ring mb-1">
        <div class="story-circle bg-light text-muted d-flex align-items-center justify-content-center">
          <i class="bi bi-check-circle"></i>
        </div>
      </div>
      <span class="d-block extra-small fw-bold text-muted text-truncate" style="max-width: 70px;">Al día</span>`;
    container.appendChild(ph);
  }

  // Modal de preview para stories de FORO (eventos)
  function _openForoStoryPreviewModal(event, ctx) {
    const isRegistered = !!event.registered;
    const typeLabels = { 'conferencia': 'Conferencia', 'exposicion': 'Exposición', 'otro': 'Evento' };
    const typeLabel = typeLabels[event.type] || 'Evento';
    const eventDate = event.date
      ? (event.date.toDate ? event.date.toDate() : new Date(event.date)).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      : '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1" id="foroStoryPreviewModal">
  <div class="modal-dialog modal-dialog-centered">
  <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
    ${event.coverImage ? `<img src="${event.coverImage}" class="w-100 object-fit-cover" style="max-height:180px;" onerror="this.style.display='none'">` : ''}
    <div class="modal-header border-0 py-3">
      <div>
        <span class="badge bg-primary-subtle text-primary rounded-pill mb-1">${typeLabel}</span>
        <h6 class="fw-bold mb-0">${event.title}</h6>
        <span class="extra-small text-muted">${eventDate}</span>
      </div>
      <button class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body pt-0">
      ${event.speaker ? `<p class="small text-muted mb-1"><i class="bi bi-person-fill me-1"></i>${event.speaker}</p>` : ''}
      ${event.location ? `<p class="small text-muted mb-1"><i class="bi bi-geo-alt-fill me-1"></i>${event.location}</p>` : ''}
      ${event.capacity ? `<p class="small text-muted mb-2"><i class="bi bi-people-fill me-1"></i>${event.registeredCount || 0}/${event.capacity} inscritos</p>` : ''}
      ${event.description ? `<p class="text-muted small mt-2">${event.description}</p>` : ''}
      ${isRegistered
        ? `<div class="alert alert-success border-0 rounded-3 small mt-3 mb-0"><i class="bi bi-check-circle-fill me-2"></i>Ya estás inscrito a este evento.</div>`
        : `<div class="alert alert-info border-0 rounded-3 small mt-3 mb-0"><i class="bi bi-info-circle me-2"></i>Inscríbete desde la sección Foro.</div>`
      }
    </div>
    <div class="modal-footer border-0 gap-2">
      <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
      <button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="location.hash='#/foro'; bootstrap.Modal.getInstance(document.getElementById('foroStoryPreviewModal')).hide();">
        <i class="bi bi-calendar-event me-1"></i>Ir a Foro</button>
    </div>
  </div></div></div>`;

    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());
  }

  // Modal de preview para stories de encuestas
  function _openStoryPreviewModal(survey, ctx) {
    const isResponded = !!survey.responded;
    const questionCount = (survey.questions || []).length;
    const createdDate = survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="modal fade" tabindex="-1" id="storyPreviewModal">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
  <div class="modal-content border-0 rounded-4 shadow-lg">
    <div class="modal-header border-0 bg-info bg-opacity-10 rounded-top-4 py-3">
      <div>
        <h6 class="fw-bold mb-0"><i class="bi bi-clipboard-data me-2"></i>${survey.title}</h6>
        <span class="extra-small text-muted">${createdDate}${questionCount ? ' · ' + questionCount + ' preguntas' : ''}</span>
      </div>
      <button class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body p-4" id="story-preview-body">
      ${survey.description ? `<p class="text-muted small mb-3">${survey.description}</p>` : ''}
      ${isResponded
        ? `<div class="text-center py-3">
            <i class="bi bi-check-circle-fill text-success fs-1 d-block mb-2"></i>
            <p class="fw-bold mb-1">Ya respondiste esta encuesta</p>
            <p class="text-muted small">Gracias por tu participación.</p>
          </div>`
        : `<div class="text-center py-3">
            <i class="bi bi-clipboard-check text-info fs-1 d-block mb-2"></i>
            <p class="fw-bold mb-1">Encuesta pendiente</p>
            <p class="text-muted small">Tienes ${questionCount} pregunta${questionCount !== 1 ? 's' : ''} por responder.</p>
          </div>`
      }
    </div>
    <div class="modal-footer border-0 gap-2" id="story-preview-footer">
      <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>
      ${!isResponded ? `<button class="btn btn-primary rounded-pill px-4 fw-bold" id="story-respond-btn">
        <i class="bi bi-pencil-square me-1"></i>Responder ahora</button>` : ''}
    </div>
  </div></div></div>`;

    document.body.appendChild(wrapper);
    const modalEl = wrapper.querySelector('.modal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // Cleanup on close
    modalEl.addEventListener('hidden.bs.modal', () => wrapper.remove());

    // "Responder ahora" button
    if (!isResponded) {
      const respondBtn = document.getElementById('story-respond-btn');
      respondBtn?.addEventListener('click', async () => {
        respondBtn.disabled = true;
        respondBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
        try {
          // Load full survey with questions
          const fullSurvey = await EncuestasService.getSurveyById(ctx, survey.id);
          if (!fullSurvey) { alert('Encuesta no encontrada.'); return; }

          // Transform the modal body into the survey form
          const body = document.getElementById('story-preview-body');
          body.innerHTML = `<div id="story-survey-qs">${_renderQuestionsHTML(fullSurvey.questions, 'stry')}</div>`;

          // Replace footer with submit button
          const footer = document.getElementById('story-preview-footer');
          footer.innerHTML = `
            <button class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
            <button class="btn btn-success rounded-pill px-4 fw-bold" id="story-submit-btn">
              <i class="bi bi-send me-1"></i>Enviar respuestas</button>`;

          // Submit handler
          document.getElementById('story-submit-btn')?.addEventListener('click', async () => {
            const submitBtn = document.getElementById('story-submit-btn');
            const answers = _collectAnswersFromContainer(fullSurvey.questions, 'story-survey-qs');
            if (!answers) return;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
            try {
              await EncuestasService.submitResponse(ctx, survey.id, answers);
              body.innerHTML = `<div class="text-center py-4 animate-fade-in">
                <div class="mb-3" style="font-size:3rem">🎉</div>
                <h5 class="fw-bold">¡Gracias por responder!</h5>
                <p class="text-muted small">Tu respuesta ha sido registrada.</p>
              </div>`;
              footer.innerHTML = '<button class="btn btn-primary rounded-pill px-4" data-bs-dismiss="modal">Cerrar</button>';
              renderDashboardStories();
            } catch (err) {
              alert('Error: ' + err.message);
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="bi bi-send me-1"></i>Enviar respuestas';
            }
          });
        } catch (err) {
          alert('Error cargando encuesta: ' + err.message);
          respondBtn.disabled = false;
          respondBtn.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Responder ahora';
        }
      });
    }
  }

  // Render questions HTML for story modal (mirrors Encuestas.renderQuestionsHTML)
  function _renderQuestionsHTML(questions, prefix) {
    prefix = prefix || 'q';
    return questions.map((q, i) => {
      let input = '';
      if (q.type === 'multiple') {
        input = (q.options || []).map((o, j) => `
          <div class="form-check mb-2"><input class="form-check-input" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_${j}" value="${o}">
          <label class="form-check-label" for="${prefix}_${q.id}_${j}">${o}</label></div>`).join('');
      } else if (q.type === 'boolean') {
        input = `<div class="d-flex gap-3">
          <div class="form-check"><input class="form-check-input" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_t" value="true"><label class="form-check-label" for="${prefix}_${q.id}_t">Verdadero</label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_f" value="false"><label class="form-check-label" for="${prefix}_${q.id}_f">Falso</label></div></div>`;
      } else if (q.type === 'scale') {
        const min = q.min || 1, max = q.max || 10;
        const mid = Math.ceil((max - min) / 2) + min;
        const steps = [];
        for (let v = min; v <= max; v++) {
          steps.push(`<button type="button" class="btn btn-outline-primary btn-sm scale-btn rounded-pill px-2 py-1" data-val="${v}" onclick="this.parentNode.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('btn-primary','active'));this.classList.add('btn-primary','active');this.classList.remove('btn-outline-primary');document.getElementById('${prefix}_${q.id}_input').value=${v};document.getElementById('${prefix}_${q.id}_val').textContent=${v}">${v}</button>`);
        }
        input = `<input type="hidden" id="${prefix}_${q.id}_input" value="${mid}">
          <div class="d-flex flex-wrap gap-1 mb-1">${steps.join('')}</div>
          <div class="text-center"><span class="badge bg-primary rounded-pill" id="${prefix}_${q.id}_val">${mid}</span></div>`;
      } else {
        input = `<textarea class="form-control rounded-3" id="${prefix}_${q.id}_input" rows="2" placeholder="Escribe tu respuesta..."></textarea>`;
      }
      return `<div class="mb-4 pb-3 ${i < questions.length - 1 ? 'border-bottom' : ''}" data-qid="${q.id}">
        <div class="d-flex align-items-start mb-2"><span class="badge bg-primary rounded-circle me-2" style="width:28px;height:28px;line-height:20px">${i + 1}</span>
        <div><p class="fw-bold mb-1">${q.text}${q.required ? ' <span class="text-danger">*</span>' : ''}</p></div></div>${input}</div>`;
    }).join('');
  }

  // Collect answers from a question container (mirrors Encuestas.collectAnswers)
  function _collectAnswersFromContainer(questions, containerId) {
    const c = document.getElementById(containerId);
    if (!c) return null;
    const answers = {};
    let valid = true;
    questions.forEach(q => {
      if (q.type === 'multiple' || q.type === 'boolean') {
        const sel = c.querySelector(`input[name$="_${q.id}"]:checked`);
        if (sel) { answers[q.id] = q.type === 'boolean' ? sel.value === 'true' : sel.value; }
        else if (q.required) { valid = false; }
      } else if (q.type === 'scale') {
        const el = c.querySelector(`[id$="_${q.id}_input"]`);
        answers[q.id] = el ? Number(el.value) : null;
      } else {
        const el = c.querySelector(`[id$="_${q.id}_input"]`);
        const val = el?.value?.trim() || '';
        if (q.required && !val) valid = false;
        answers[q.id] = val;
      }
    });
    if (!valid) { alert('Por favor responde todas las preguntas obligatorias.'); return null; }
    return answers;
  }

  // 5. Smart Cards Updater & Periodic Refresh
  window.SIA.updateSmartCards = function () {
    if (!currentUserProfile) return;

    // ... (Existing Smart Card Update Logic) ...
    // AULA
    const aulaStatus = document.getElementById('smart-card-aula-status');
    const aulaDot = document.getElementById('smart-dot-aula');
    if (aulaStatus) {
      const pending = 0; // TODO: Connect
      if (pending > 0) {
        aulaStatus.textContent = `${pending} pendientes`;
        aulaStatus.className = "extra-small fw-bold text-warning mb-0";
        if (aulaDot) aulaDot.className = "status-dot bg-warning";
      } else {
        aulaStatus.textContent = "Sin pendientes";
        aulaStatus.className = "extra-small text-muted mb-0";
        if (aulaDot) aulaDot.className = "status-dot bg-success";
      }
    }

    // MEDI
    const mediStatus = document.getElementById('smart-card-medi-status');
    const mediDot = document.getElementById('smart-dot-medi');
    if (mediStatus) {
      const hasApptToday = false;
      if (hasApptToday) {
        mediStatus.textContent = "Cita hoy 16:00";
        mediStatus.className = "extra-small fw-bold text-danger mb-0";
        if (mediDot) { mediDot.classList.remove('d-none'); mediDot.className = "status-dot bg-danger"; }
      } else {
        mediStatus.textContent = "Sin citas hoy";
        mediStatus.className = "extra-small text-muted mb-0";
        if (mediDot) mediDot.classList.add('d-none');
      }
    }

    // HEADER INFO
    const dashName = document.getElementById('dash-user-name');
    const dashInitials = document.getElementById('dash-avatar-initials');

    if (dashName && dashName.textContent === 'Estudiante' && currentUserProfile.displayName) {
      dashName.textContent = currentUserProfile.displayName.split(' ')[0];
    }
    if (dashInitials && dashInitials.textContent === 'U') {
      dashInitials.textContent = getInitials(currentUserProfile.displayName);
    }
  };

  // Loop para mantener el dashboard "vivo"
  setInterval(() => {
    const dash = document.getElementById('view-dashboard');
    if (dash && !dash.classList.contains('d-none') && currentUserProfile) {
      if (window.SIA.updateSmartCards) window.SIA.updateSmartCards();
      // Actualizar stories cada 30s (evitar queries excesivas a Firestore)
      renderDashboardStories();
    }
  }, 30000);

  // Init once to show stories immediately
  // Init once to show stories immediately
  setTimeout(renderDashboardStories, 1000);

  // Also check for avisos after a short delay (para estudiantes)
  setTimeout(() => {
    if (currentUserProfile && currentUserProfile.role !== 'department_admin') {
      checkAndShowAvisos();
    }
  }, 2000);

  // ==============================================
  // 5. SISTEMA DE AVISOS INSTITUCIONALES
  // ==============================================

  // --- 5a. ADMIN PANEL (Difusión) ---

  let _editingAvisoId = null;

  window.openAvisosAdminPanel = async function () {
    const modal = new bootstrap.Modal(document.getElementById('modalAvisosAdmin'));
    modal.show();
    _resetAvisoForm();
    await _loadAvisosAdminList();
    _setupAvisosAdminForm();
  };

  function _resetAvisoForm() {
    _editingAvisoId = null;
    const form = document.getElementById('form-create-aviso');
    if (form) form.reset();

    document.getElementById('aviso-image-preview')?.classList.add('d-none');
    document.getElementById('aviso-image-field')?.classList.remove('d-none');

    const submitBtn = document.getElementById('btn-submit-aviso');
    if (submitBtn) submitBtn.innerHTML = '<i class="bi bi-megaphone-fill me-2"></i>Publicar Aviso';
    document.getElementById('btn-cancel-edit')?.classList.add('d-none');

    const tabEl = document.querySelector('[data-bs-target="#avisos-tab-create"]');
    if (tabEl) {
      tabEl.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Crear Aviso';
      const val = document.querySelector('[data-bs-target="#avisos-tab-list"]');
      if (val) bootstrap.Tab.getOrCreateInstance(val).show();
    }
  }

  async function _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  document.getElementById('aviso-imageFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await _compressImage(file);
      const urlField = document.getElementById('aviso-imageUrl');
      if (urlField) urlField.value = base64;
      const previewContainer = document.getElementById('aviso-image-preview');
      const img = previewContainer?.querySelector('img');
      if (img) { img.src = base64; previewContainer.classList.remove('d-none'); }
    } catch (err) {
      console.error('Error compressing image:', err);
      showToast('Error al procesar la imagen', 'danger');
    }
  });

  document.getElementById('aviso-imageUrl')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url.length > 500) return;
    const previewContainer = document.getElementById('aviso-image-preview');
    if (!previewContainer) return;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      const img = previewContainer.querySelector('img');
      img.src = url;
      img.onload = () => previewContainer.classList.remove('d-none');
      img.onerror = () => previewContainer.classList.add('d-none');
    } else {
      previewContainer.classList.add('d-none');
    }
  });

  const presetRadios = document.querySelectorAll('input[name="validity"]');
  presetRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const customDates = document.getElementById('aviso-custom-dates');
      if (e.target.value === 'custom') {
        customDates.classList.remove('d-none');
      } else {
        customDates.classList.add('d-none');
      }
    });
  });

  document.getElementById('aviso-type')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const imgField = document.getElementById('aviso-image-field');
    const bodyField = document.getElementById('aviso-body-field');
    if (type === 'image') {
      if (imgField) imgField.classList.remove('d-none');
      if (bodyField) bodyField.classList.add('d-none');
    } else if (type === 'text') {
      if (imgField) imgField.classList.add('d-none');
      if (bodyField) bodyField.classList.remove('d-none');
    } else {
      if (imgField) imgField.classList.remove('d-none');
      if (bodyField) bodyField.classList.remove('d-none');
    }
  });

  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
    _resetAvisoForm();
    showToast('Edición cancelada', 'secondary');
  });

  let _avisosFormSetup = false;
  function _setupAvisosAdminForm() {
    if (_avisosFormSetup) return;
    _avisosFormSetup = true;

    const form = document.getElementById('form-create-aviso');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ctx = getCtx();
      let startDate, endDate;

      const validity = document.querySelector('input[name="validity"]:checked')?.value || 'custom';

      if (validity === 'custom') {
        startDate = document.getElementById('aviso-startDate')?.value || null;
        endDate = document.getElementById('aviso-endDate')?.value || null;
      } else {
        const now = new Date();
        startDate = now.toISOString();
        const end = new Date();
        if (validity === '24h') end.setHours(end.getHours() + 24);
        else if (validity === '3d') end.setDate(end.getDate() + 3);
        else if (validity === '1w') end.setDate(end.getDate() + 7);
        endDate = end.toISOString();
      }

      const data = {
        title: document.getElementById('aviso-title')?.value?.trim(),
        type: document.getElementById('aviso-type')?.value,
        imageUrl: document.getElementById('aviso-imageUrl')?.value?.trim(),
        body: document.getElementById('aviso-body')?.value?.trim(),
        priority: document.getElementById('aviso-priority')?.value,
        displayDuration: parseInt(document.getElementById('aviso-displayDuration')?.value || 8),
        startDate: startDate,
        endDate: endDate
      };

      if (!data.title) {
        showToast('Ingresa un título para el aviso.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-submit-aviso');
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

      try {
        if (_editingAvisoId) {
          await AvisosService.updateAviso(ctx, _editingAvisoId, data);
          showToast('✅ Aviso actualizado exitosamente', 'success');
          _resetAvisoForm();
        } else {
          await AvisosService.createAviso(ctx, data);
          showToast('✅ Aviso publicado exitosamente', 'success');
          form.reset();
          document.getElementById('aviso-image-preview')?.classList.add('d-none');
        }
        await _loadAvisosAdminList();
        const listTab = document.querySelector('[data-bs-target="#avisos-tab-list"]');
        if (listTab) bootstrap.Tab.getOrCreateInstance(listTab).show();
      } catch (err) {
        console.error('[Avisos] Error creando/editando aviso:', err);
        showToast('Error: ' + err.message, 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });
  }

  async function _loadAvisosAdminList() {
    const container = document.getElementById('avisos-admin-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border text-success mb-3"></div><p>Cargando avisos...</p></div>';

    try {
      const ctx = getCtx();
      const avisos = await AvisosService.getAllAvisos(ctx);

      if (!avisos.length) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-megaphone fs-1 opacity-25"></i><p class="mt-2">No hay avisos publicados aún.</p></div>';
        return;
      }

      container.innerHTML = avisos.map(a => {
        const statusBadge = {
          'active': '<span class="badge bg-success rounded-pill">Activo</span>',
          'paused': '<span class="badge bg-warning text-dark rounded-pill">Pausado</span>',
          'expired': '<span class="badge bg-secondary rounded-pill">Expirado</span>'
        }[a.status] || '<span class="badge bg-secondary rounded-pill">-</span>';

        const typeBadge = { 'image': 'ðŸ–¼ï¸ Imagen', 'text': 'ðŸ“ Texto', 'mixed': 'ðŸ”€ Mixto' }[a.type] || a.type;
        const createdDate = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('es-MX') : 'N/A';
        const thumbnailHtml = a.imageUrl ? `<img src="${a.imageUrl}" class="rounded-3" style="width:80px; height:80px; object-fit:cover;">` : `<div class="rounded-3 bg-light d-flex align-items-center justify-content-center" style="width:80px; height:80px;"><i class="bi bi-file-text fs-3 text-muted"></i></div>`;

        return `<div class="col-12"><div class="card border-0 shadow-sm rounded-3 overflow-hidden"><div class="card-body p-3 d-flex gap-3 align-items-center">${thumbnailHtml}<div class="flex-grow-1"><div class="d-flex align-items-center gap-2 mb-1"><h6 class="fw-bold mb-0 text-truncate">${a.title}</h6>${statusBadge}</div><div class="d-flex gap-3 extra-small text-muted"><span>${typeBadge}</span><span><i class="bi bi-calendar3 me-1"></i>${createdDate}</span><span><i class="bi bi-eye me-1"></i>${a.viewCount || 0} vistas</span>${a.priority === 'urgent' ? '<span class="text-danger fw-bold">ðŸ”´ Urgente</span>' : ''}</div></div><div class="d-flex gap-1"><button class="btn btn-sm btn-outline-${a.status === 'active' ? 'warning' : 'success'} rounded-pill" onclick="window._toggleAviso('${a.id}')"><i class="bi bi-${a.status === 'active' ? 'pause-fill' : 'play-fill'}"></i></button><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window._editAviso('${a.id}')"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger rounded-pill" onclick="window._deleteAviso('${a.id}')"><i class="bi bi-trash3"></i></button></div></div></div></div>`;
      }).join('');
    } catch (err) {
      container.innerHTML = '<div class="text-center text-danger py-5"><p>Error al cargar los avisos.</p></div>';
    }
  }

  window._editAviso = async function (id) {
    try {
      const avisos = await AvisosService.getAllAvisos(getCtx());
      const aviso = avisos.find(a => a.id === id);
      if (!aviso) return;
      _editingAvisoId = id;
      document.getElementById('aviso-title').value = aviso.title;
      document.getElementById('aviso-type').value = aviso.type;
      document.getElementById('aviso-priority').value = aviso.priority;
      document.getElementById('aviso-body').value = aviso.body;
      document.getElementById('aviso-imageUrl').value = aviso.imageUrl;
      document.getElementById('aviso-displayDuration').value = aviso.displayDuration || 8;
      document.getElementById('aviso-type').dispatchEvent(new Event('change'));
      document.getElementById('aviso-imageUrl').dispatchEvent(new Event('input'));
      document.querySelector('input[name="validity"][value="custom"]').click();

      document.getElementById('btn-submit-aviso').innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Guardar Cambios';
      document.getElementById('btn-cancel-edit').classList.remove('d-none');
      document.querySelector('[data-bs-target="#avisos-tab-create"]').innerHTML = '<i class="bi bi-pencil-fill me-1"></i>Editar Aviso';
      bootstrap.Tab.getOrCreateInstance(document.querySelector('[data-bs-target="#avisos-tab-create"]')).show();
    } catch (e) { console.error(e); showToast('Error cargando para edición'); }
  };

  window._toggleAviso = async function (id) {
    try {
      const newStatus = await AvisosService.toggleAviso(getCtx(), id);
      showToast(`Aviso ${newStatus === 'active' ? 'reactivado' : 'pausado'}`, 'success');
      await _loadAvisosAdminList();
    } catch (e) { showToast('Error: ' + e.message, 'danger'); }
  };

  window._deleteAviso = async function (id) {
    if (!confirm('¿Estás seguro de eliminar este aviso?')) return;
    try {
      await AvisosService.deleteAviso(getCtx(), id);
      showToast('Aviso eliminado', 'success');
      await _loadAvisosAdminList();
    } catch (e) { showToast('Error: ' + e.message, 'danger'); }
  };

  window._previewAviso = async function (id) {
    // Not implemented in this block directly, reusing fullscreen logic
  };

  // --- 5b. FULLSCREEN MODAL (Estudiantes + Preview) ---

  let _currentAvisos = [];
  let _currentAvisoIndex = 0;
  let _avisoAnimation = null;

  async function checkAndShowAvisos() {
    if (!window.AvisosService) return;
    try {
      const ctx = getCtx();
      if (!ctx.auth?.currentUser) return;
      const seenKey = 'sia_avisos_seen';
      const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
      const now = Date.now();
      Object.keys(seen).forEach(k => { if (now - seen[k] > 7 * 24 * 60 * 60 * 1000) delete seen[k]; });
      localStorage.setItem(seenKey, JSON.stringify(seen));

      const avisos = await AvisosService.getActiveAvisos(ctx);
      const unseen = avisos.filter(a => !seen[a.id]);

      if (unseen.length === 0) return;
      _showAvisoFullscreen(unseen, 0);
      unseen.forEach(a => { seen[a.id] = Date.now(); AvisosService.incrementViewCount(ctx, a.id); });
      localStorage.setItem(seenKey, JSON.stringify(seen));
    } catch (e) { console.warn('[Avisos] Error checking avisos:', e); }
  }

  function _showAvisoFullscreen(avisos, startIndex) {
    _currentAvisos = avisos;
    _currentAvisoIndex = startIndex || 0;
    const modalEl = document.getElementById('modalAvisoFullscreen');
    if (!modalEl) return;
    const progressContainer = document.getElementById('aviso-progress-bars');
    if (progressContainer) {
      progressContainer.innerHTML = avisos.map((_, i) =>
        `<div class="flex-grow-1 rounded-pill overflow-hidden" style="height:6px; background:rgba(255,255,255,0.2);"><div class="h-100 rounded-pill aviso-progress-fill" id="aviso-progress-${i}" data-index="${i}" style="width:${i < _currentAvisoIndex ? '100' : '0'}%; background:white; box-shadow: 0 0 10px rgba(255,255,255,0.5);"></div></div>`).join('');
    }
    _updateAvisoNav();
    _renderCurrentAviso();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    document.getElementById('aviso-fullscreen-close').onclick = () => {
      if (_avisoAnimation) { _avisoAnimation.cancel(); _avisoAnimation = null; }
      document.querySelectorAll('.aviso-progress-fill').forEach(el => el.style.width = '0%');
      modal.hide();
    };

    document.getElementById('aviso-nav-prev')?.addEventListener('click', (e) => { e.stopPropagation(); _navigateAviso(-1); });
    document.getElementById('aviso-nav-next')?.addEventListener('click', (e) => { e.stopPropagation(); _navigateAviso(1); });

    const contentArea = document.querySelector('.modal-aviso-glass .modal-content');
    const pauseAnim = () => { if (_avisoAnimation && _avisoAnimation.playState === 'running') _avisoAnimation.pause(); };
    const resumeAnim = () => { if (_avisoAnimation && _avisoAnimation.playState === 'paused') _avisoAnimation.play(); };
    if (contentArea) {
      contentArea.onmousedown = pauseAnim;
      contentArea.ontouchstart = pauseAnim;
      contentArea.onmouseup = resumeAnim;
      contentArea.onmouseleave = resumeAnim;
      contentArea.ontouchend = resumeAnim;
    }
    _startAvisoAutoTimer();
  }

  function _renderCurrentAviso() {
    const container = document.getElementById('aviso-fullscreen-content');
    if (!container || !_currentAvisos.length) return;
    const aviso = _currentAvisos[_currentAvisoIndex];
    if (!aviso) return;

    let contentHtml = '';
    if (aviso.type === 'image' && aviso.imageUrl) {
      contentHtml = `<img src="${aviso.imageUrl}" class="aviso-fullscreen-img" style="max-width:100%; max-height:85vh; object-fit:contain; cursor:pointer;" onclick="window._navigateAviso(1)">`;
    } else if (aviso.type === 'text') {
      contentHtml = `<div class="aviso-text-card text-center text-white p-4 p-md-5" style="max-width:600px;">${aviso.priority === 'urgent' ? '<div class="badge bg-danger mb-3 rounded-pill px-3 py-2">ðŸ”´ URGENTE</div>' : ''}<h1 class="fw-bold display-5 mb-4">${aviso.title}</h1><p class="lead opacity-90 mb-4" style="white-space:pre-line;">${aviso.body || ''}</p><div class="d-flex justify-content-center gap-2 mt-4"><img src="/images/logo-sia.png" width="30" class="filter-white opacity-50"><span class="text-white-50 small align-self-center">SIA - TecNM Los Cabos</span></div></div>`;
    } else {
      contentHtml = `<div class="aviso-mixed-card position-relative h-100 w-100 d-flex flex-column rounded-4 overflow-hidden">${aviso.imageUrl ? `<div class="flex-grow-1 d-flex align-items-center justify-content-center overflow-hidden" style="min-height:0;"><img src="${aviso.imageUrl}" style="max-width:100%; max-height:60vh; object-fit:contain;"></div>` : ''}<div class="aviso-mixed-text text-white p-4 text-center" style="background: linear-gradient(transparent, rgba(0,0,0,0.9));">${aviso.priority === 'urgent' ? '<div class="badge bg-danger mb-2 rounded-pill">ðŸ”´ URGENTE</div>' : ''}<h3 class="fw-bold mb-2">${aviso.title}</h3><p class="small opacity-90 mb-0" style="white-space:pre-line;">${aviso.body || ''}</p></div></div>`;
    }
    container.innerHTML = contentHtml;

    document.querySelectorAll('.aviso-progress-fill').forEach(fill => {
      const idx = parseInt(fill.dataset.index);
      if (fill.getAnimations) fill.getAnimations().forEach(anim => anim.cancel());
      fill.style.width = (idx < _currentAvisoIndex) ? '100%' : '0%';
    });
    _updateAvisoNav();
  }

  function _startAvisoAutoTimer() {
    if (_avisoAnimation) { _avisoAnimation.cancel(); _avisoAnimation = null; }
    const aviso = _currentAvisos[_currentAvisoIndex];
    if (!aviso) return;
    const currentBar = document.getElementById(`aviso-progress-${_currentAvisoIndex}`);
    if (!currentBar) return;

    currentBar.style.width = '0%';
    const duration = (aviso.displayDuration || (aviso.type === 'image' ? 6 : 8)) * 1000;

    _avisoAnimation = currentBar.animate([{ width: '0%' }, { width: '100%' }], { duration: duration, fill: 'forwards', easing: 'linear' });
    _avisoAnimation.onfinish = () => {
      if (_currentAvisoIndex < _currentAvisos.length - 1) _navigateAviso(1);
      else { const modal = bootstrap.Modal.getInstance(document.getElementById('modalAvisoFullscreen')); if (modal) modal.hide(); }
    };
  }

  function _updateAvisoNav() {
    const prevBtn = document.getElementById('aviso-nav-prev');
    const nextBtn = document.getElementById('aviso-nav-next');
    const total = _currentAvisos.length;
    if (prevBtn) prevBtn.classList.toggle('d-none', _currentAvisoIndex <= 0);
    if (nextBtn) nextBtn.classList.toggle('d-none', _currentAvisoIndex >= total - 1 || total <= 1);
  }

  window._navigateAviso = function (direction) {
    const newIndex = _currentAvisoIndex + direction;
    if (newIndex < 0 || newIndex >= _currentAvisos.length) {
      if (direction > 0) { const modal = bootstrap.Modal.getInstance(document.getElementById('modalAvisoFullscreen')); if (modal) modal.hide(); }
      return;
    }
    _currentAvisoIndex = newIndex;
    _renderCurrentAviso();
    _startAvisoAutoTimer();
  };

  document.getElementById('modalAvisoFullscreen')?.addEventListener('hidden.bs.modal', () => {
    if (_avisoAnimation) { _avisoAnimation.cancel(); _avisoAnimation = null; }
    _currentAvisos = [];
    _currentAvisoIndex = 0;
  });


  // --- 5c. STORY CLICK: Open aviso from stories ---

  function _openAvisoStoryPreviewModal(aviso) {
    _showAvisoFullscreen([aviso], 0);
  }


  function renderDepartmentDashboard(profile) {
    const gridEl = document.getElementById('dept-dash-grid');
    const titleEl = document.getElementById('dept-dash-title');
    const subtitleEl = document.getElementById('dept-dash-subtitle');
    const dateEl = document.getElementById('dept-dash-date');

    if (!gridEl) return;

    // --- 1. HEADER: SALUDO Y HORA (REAL TIME) ---
    // Limpiar intervalo previo si existe para evitar duplicados
    if (window.deptClockInterval) clearInterval(window.deptClockInterval);

    function updateTime() {
      const now = new Date();
      const curHr = now.getHours();
      let saludo = curHr < 12 ? 'Buenos días' : curHr < 18 ? 'Buenas tardes' : 'Buenas noches';

      // Fallback name logic
      const displayName = profile.displayName || "Usuario";

      // Update Title with Greeting
      if (titleEl) {
        const deptLabel = profile.departmentConfig?.label;
        titleEl.innerHTML = `<span class="fw-light">${saludo},</span><br />${deptLabel || displayName}`;
      }

      if (subtitleEl) {
        subtitleEl.textContent = "Bienvenido a tu panel de gestión.";
      }

      // Update Date/Time Box
      if (dateEl) {
        // Formato: 02:30:45 PM (con segundos para feedback visual de real-time)
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const dateStr = now.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });

        const container = dateEl.parentElement;
        if (container) {
          container.innerHTML = `
               <div class="d-flex align-items-center gap-3">
                  <div class="text-end">
                     <div class="fs-4 fw-bold text-dark lh-1" style="font-variant-numeric: tabular-nums;">${timeStr}</div>
                     <div class="text-uppercase extra-small text-muted fw-bold mt-1">${dateStr}</div>
                  </div>
                  <div class="vr opacity-25"></div>
                  <i class="bi bi-clock-history fs-2 text-primary opacity-50"></i>
               </div>
          `;
        }
      }
    }

    // Ejecutar inmediatamente y luego cada segundo
    updateTime();
    window.deptClockInterval = setInterval(updateTime, 1000);

    // --- 2. CONFIGURACIÓN DE TARJETAS (IMÁGENES PNG) ---
    const MODULE_META = {
      'view-biblio': { title: "Biblioteca", desc: "Gestión de Acervo y Préstamos", img: "images/biblio.png", color: "warning" },
      'view-medi': { title: "Servicios Médicos", desc: "Consultas y Expedientes", img: "images/medi.png", color: "danger" },
      'view-lactario': { title: "Sala de Lactancia", desc: "Gestiona espacios, estadisticas y horarios.", img: "images/lactario.png", color: "maternal" },
      'view-aula': { title: "Aula Virtual", desc: "Cursos y Certificaciones", img: "images/aula.png", color: "primary" },
      'view-foro': { title: "Foro y Eventos", desc: "Control de Asistencia", img: "images/foro.png", color: "info" },
      'view-quejas': { title: "Quejas y Sugerencias", desc: "Gestión de Tickets y Calidad", img: null, icon: "bi-chat-heart-fill", color: "primary" },
      'view-encuestas': { title: "Centro de Encuestas", desc: "Crear y analizar encuestas", img: null, icon: "bi-clipboard2-check-fill", color: "info" },
      'view-avisos-admin': { title: "Avisos Institucionales", desc: "Publicar anuncios para toda la comunidad", img: null, icon: "bi-megaphone-fill", color: "success" }
    };

    gridEl.innerHTML = '';

    // Safety check just in case allowedViews is undefined or empty
    const views = profile.allowedViews && profile.allowedViews.length ? [...profile.allowedViews] : [];

    // Inyectar tarjeta de Avisos si tiene permiso avisos:admin
    if (profile.permissions?.avisos === 'admin' && !views.includes('view-avisos-admin')) {
      views.push('view-avisos-admin');
    }

    views.forEach(viewId => {
      // FILTER: Omitir 'view-dashboard' para que no salga una tarjeta recursiva inútil
      if (viewId === 'view-dashboard') return;

      const meta = MODULE_META[viewId] || {
        title: viewId,
        desc: "Módulo Administrativo",
        img: null, // Fallback icon logic below
        color: "dark"
      };

      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4 animate-fade-in';

      // Lógica de Imagen vs Icono Fallback
      let iconOrImgHtml = '';
      if (meta.img) {
        iconOrImgHtml = `<img src="${meta.img}" alt="${meta.title}" class="img-fluid" style="width: 64px; height: 64px; object-fit: contain;">`;
      } else {
        // Use custom icon if provided, else default grid
        const iconClass = meta.icon || 'bi-grid-fill';
        iconOrImgHtml = `<i class="bi ${iconClass} fs-1 text-${meta.color}"></i>`;
      }

      col.innerHTML = `
        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden hover-scale cursor-pointer" onclick="${viewId === 'view-avisos-admin' ? 'window.openAvisosAdminPanel()' : `SIA.navigate('${viewId}')`}">
          <div class="card-body p-4 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-4">
              <div class="p-2 rounded-4 bg-light d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
                 ${iconOrImgHtml}
              </div>
            </div>
            
            <h3 class="fw-bold text-dark mb-2">${meta.title}</h3>
            <p class="text-muted mb-4">${meta.desc}</p>
            
            <div class="mt-auto">
               <span class="btn btn-outline-${meta.color} rounded-pill fw-bold px-4 w-100 text-start d-flex justify-content-between align-items-center">
                 Acceder <i class="bi bi-arrow-right"></i>
               </span>
            </div>
          </div>
          <div class="progress" style="height: 4px;">
            <div class="progress-bar bg-${meta.color}" style="width: 100%"></div>
          </div>
        </div>
      `;
      gridEl.appendChild(col);
    });
  }

});
