// app.js
// Lógica principal: Auth, Router, Landing y Módulos (VERSIÓ“N CONSOLIDADA PHASE 1+2)

// --- WEB COMPONENTS IMPORTS ---
import './components/landing-view.js';
import './components/register-wizard.js';
import './components/dev-tools.js';
import './components/superadmin-switcher.js';
import './components/shell-breadcrumbs.js';
import './components/student-dashboard.js';
import './components/onboarding-tour.js';
import './components/admin-medi-tour.js';
// import { DEPARTMENT_DIRECTORY } from './config/departments.js'; // Loaded globally
import { Store } from './core/state.js';
import { Breadcrumbs } from './core/breadcrumbs.js';

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
            console.log(`💾 [StateManager] Estado guardado para ${viewId}:`, state);
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
        console.log(`⏰ [StateManager] Estado de ${viewId} expirado, limpiando...`);
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
        console.log(`🗑️ [StateManager] Estado limpiado para ${viewId}`);
      }
    },

    /**
     * Limpia todos los estados (al recargar o cerrar sesión)
     */
    clearAll() {
      this._states = {};
      this._currentView = null;
      console.log('🗑️ [StateManager] Todos los estados limpiados');
    },

    /**
     * Obtiene el nombre del módulo global desde el viewId
     * @private
     */
    _getModuleName(viewId) {
      const map = {
        'view-aula': 'Aula',
        'view-comunidad': 'Comunidad',
        'view-medi': 'Medi',
        'view-biblio': 'Biblio',
        'view-foro': 'Foro',
        'view-cafeteria': 'Cafeteria',
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
  const landingView = document.getElementById('landing-view');
  const registerWizard = document.getElementById('view-register-wizard');
  const qaSecretLoginView = document.getElementById('view-qa-secret-login');
  const appShell = document.getElementById('app-shell');
  const verifyShell = document.getElementById('verify-shell');
  const qaSecretLoginForm = document.getElementById('form-qa-secret-login');
  const qaSecretLoginEmail = document.getElementById('qa-secret-login-email');
  const qaSecretLoginPassword = document.getElementById('qa-secret-login-password');
  const qaSecretLoginError = document.getElementById('qa-secret-login-error');
  const qaSecretLoginStatus = document.getElementById('qa-secret-login-status');
  const qaSecretLoginSubmit = document.getElementById('qa-secret-login-submit');
  const qaSecretLoginSignOut = document.getElementById('qa-secret-login-signout');
  const QA_SECRET_LOGIN_CONFIG = window.SIA?.getQaSecretLoginConfig?.() || {
    route: '/qa-portal-k9m2x7c4',
    email: 'admin@super.com',
    displayName: 'SuperAdmin QA'
  };

  // Navbar / User Info
  const userEmailNav = document.getElementById('user-email');
  const userEmailDashboard = document.getElementById('user-email-dashboard');
  const btnIngresar = document.getElementById('btn-ingresar');

  const btnLogout = document.getElementById('btn-logout');
  const btnBrandHome = document.getElementById('btn-brand-home');
  const fabAddCourse = document.getElementById('aula-add-course-fab');

  // Navegación
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
        console.warn("⚠️ Tiempo agotado: SIN CONEXIÓ“N DETECTADA.");
        if (typeof showToast === 'function') showToast("Sin conexión a internet. Esperando red...", "warning");
        return; // Mantenemos el loader esperando red
      }

      // 2. Si hay internet pero Firebase no responde en 10s:
      console.warn("⚠️ Tiempo de espera agotado (10s).");

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
    console.log("🌐 Conexión restaurada.");
    if (appLoader && !appLoader.classList.contains('d-none')) {
      // Si estábamos pegados en loader, tal vez ahora Firebase reaccione
    }
    if (typeof showToast === 'function') showToast("Conexión restaurada.", "success");
  });

  window.addEventListener('offline', () => {
    console.log("🔌 Conexión perdida.");
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
    console.error("❌ ERROR CRÍTICO: SIA/Firebase no está definido. Revisa services/firebase.js");
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
    const local = localStorage.getItem(THEME_KEY_LOCAL);
    if (local === 'light' || local === 'dark') return local;

    const preferredTheme = preferences?.theme;
    if (preferredTheme === 'light' || preferredTheme === 'dark') return preferredTheme;

    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

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

  function getCurrentRoutePath() {
    let path = window.location.pathname || '/';
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      path = window.location.hash.replace('#', '');
    }
    return path;
  }

  function isQaSecretRoute(path = getCurrentRoutePath()) {
    return String(path || '').trim() === QA_SECRET_LOGIN_CONFIG.route;
  }

  function setQaSecretLoginMessage(message = '', level = 'danger') {
    if (!qaSecretLoginError) return;
    if (!message) {
      qaSecretLoginError.className = 'alert d-none';
      qaSecretLoginError.textContent = '';
      return;
    }

    const normalizedLevel = ['warning', 'success', 'info'].includes(level) ? level : 'danger';
    qaSecretLoginError.className = `alert alert-${normalizedLevel} rounded-4 border-0 py-2 px-3`;
    qaSecretLoginError.textContent = message;
  }

  function syncQaSecretLoginState() {
    if (qaSecretLoginEmail) {
      qaSecretLoginEmail.value = QA_SECRET_LOGIN_CONFIG.email || '';
    }

    const activeUser = window.SIA?.auth?.currentUser || null;
    const activeEmail = activeUser?.email || '';
    const isQaActive = Boolean(activeEmail && window.SIA?.isQaSuperAdminEmail?.(activeEmail));

    if (qaSecretLoginStatus) {
      qaSecretLoginStatus.textContent = isQaActive
        ? 'Sesion QA activa. Entrando al panel.'
        : (activeEmail
          ? `Sesion actual detectada: ${activeEmail}. Puedes cambiarla por la cuenta QA desde aqui.`
          : `Acceso interno para ${QA_SECRET_LOGIN_CONFIG.displayName}.`);
    }

    if (qaSecretLoginSignOut) {
      qaSecretLoginSignOut.classList.toggle('d-none', !activeUser || isQaActive);
    }
  }

  function showQaSecretLogin(options = {}) {
    document.querySelectorAll('.sia-public-view').forEach(v => v.classList.add('d-none'));
    if (landingView) landingView.classList.add('d-none');
    if (registerWizard) {
      registerWizard.classList.add('d-none');
      registerWizard.style.display = 'none';
    }
    if (appShell) {
      appShell.classList.add('d-none');
      appShell.style.display = 'none';
    }
    if (verifyShell) verifyShell.classList.add('d-none');
    if (fabAddCourse) fabAddCourse.classList.add('d-none');
    if (qaSecretLoginView) qaSecretLoginView.classList.remove('d-none');

    syncQaSecretLoginState();
    setQaSecretLoginMessage(options.message || '', options.level || 'danger');

    if (qaSecretLoginPassword && options.resetPassword !== false) {
      qaSecretLoginPassword.value = '';
    }

    if (qaSecretLoginPassword && options.focus !== false) {
      requestAnimationFrame(() => qaSecretLoginPassword.focus());
    }
  }

  function hideQaSecretLogin() {
    if (qaSecretLoginView) qaSecretLoginView.classList.add('d-none');
    setQaSecretLoginMessage('');
  }

  function getQaSecretLoginErrorMessage(error) {
    if (!error) return 'No se pudo iniciar sesion en el portal QA.';
    if (error.code === 'auth/missing-password') return 'Ingresa la contrasena del portal QA.';
    if (error.code === 'auth/wrong-password') return 'La contrasena QA no coincide.';
    if (error.code === 'auth/operation-not-allowed') return 'Email/Password no esta habilitado en Firebase Auth.';
    if (error.code === 'auth/too-many-requests') return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    if (error.code === 'auth/network-request-failed') return 'Error de red al iniciar sesion.';
    return 'No se pudo iniciar sesion en el portal QA.';
  }


  // ==========================================
  // 4. AUTENTICACIÓ“N & FLUJO PRINCIPAL
  // ==========================================
  // --- CONFIG: ROLES & VISTAS ---
  const TEMP_EXTRADATA_STORAGE_KEY = 'sia_temp_extradata';
  const DEV_SIM_PROFILE_STORAGE_KEY = 'sia_simulated_profile';
  const DEV_SIM_BASE_PROFILE_STORAGE_KEY = 'sia_dev_base_profile';

  function readStoredRegisterExtraData() {
    try {
      const stored = localStorage.getItem(TEMP_EXTRADATA_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function getProviderEmails(user) {
    if (!Array.isArray(user?.providerData)) return [];
    return user.providerData
      .map((provider) => String(provider?.email || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function resolveEffectiveAuthEmail(user, extraData = null) {
    const parsedExtra = extraData && typeof extraData === 'object' ? extraData : readStoredRegisterExtraData();
    const canUseExtra = !parsedExtra?.authUid || !user?.uid || parsedExtra.authUid === user.uid;
    const candidates = [
      canUseExtra ? parsedExtra.emailInstitucional : '',
      ...getProviderEmails(user),
      user?.email,
      canUseExtra ? parsedExtra.email : '',
      canUseExtra ? parsedExtra.emailPersonal : ''
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);

    const uniqueCandidates = Array.from(new Set(candidates));
    const allowedCandidate = uniqueCandidates.find((email) =>
      window.SIA?.isQaSuperAdminEmail?.(email) || window.SIA?.isAllowedMicrosoftLoginEmail?.(email)
    );

    return allowedCandidate || uniqueCandidates[0] || '';
  }

  // --- HELPERS DE ROL ---
  function detectUserType(email) {
    if (!email) return { type: 'unknown', role: 'guest' };
    email = email.toLowerCase().trim();

    if (window.SIA?.isQaSuperAdminEmail?.(email)) {
      return { type: 'qa_superadmin', role: 'superadmin', name: 'SuperAdmin QA' };
    }

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

    // 3. Default: Personal general
    return { type: 'personal', role: 'personal' };
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

  function getEffectiveAllowedViews(profile = currentUserProfile) {
    return window.SIA?.getEffectiveAllowedViews ? window.SIA.getEffectiveAllowedViews(profile) : (profile?.allowedViews || []);
  }

  function getHomeViewForProfile(profile = currentUserProfile) {
    if (window.SIA?.getHomeView) return window.SIA.getHomeView(profile);
    return (profile?.allowedViews && profile.allowedViews.length === 1)
      ? profile.allowedViews[0]
      : (ROLE_HOME_VIEWS[profile?.role] || 'view-dashboard');
  }

  function canAccessViewForProfile(viewId, profile = currentUserProfile) {
    if (window.SIA?.canAccessView) return window.SIA.canAccessView(profile, viewId);
    return true;
  }

  function isAdminWorkspaceProfile(profile = currentUserProfile) {
    if (profile?.devSimulation?.shell === 'student') {
      return false;
    }
    return window.SIA?.isAdminWorkspaceProfile ? window.SIA.isAdminWorkspaceProfile(profile) : ROLE_HOME_VIEWS[profile?.role] !== undefined;
  }

  function canAdminMedi(profile = currentUserProfile) {
    return window.SIA?.canAdminMedi ? window.SIA.canAdminMedi(profile) : false;
  }

  function canAdminBiblio(profile = currentUserProfile) {
    return window.SIA?.canAdminBiblio ? window.SIA.canAdminBiblio(profile) : false;
  }

  function canAdminForo(profile = currentUserProfile) {
    return window.SIA?.canAdminForo ? window.SIA.canAdminForo(profile) : false;
  }

  function canAdminCafeteria(profile = currentUserProfile) {
    return window.SIA?.canAdminCafeteria ? window.SIA.canAdminCafeteria(profile) : false;
  }

  function getEffectiveSessionUser(authUser = SIA?.auth?.currentUser || null, profile = currentUserProfile) {
    const actor = profile?.qaActor;
    if (!authUser || !actor?.uid) return authUser;

    const effectiveUser = Object.create(authUser);
    effectiveUser.uid = actor.uid;
    effectiveUser.email = actor.email || actor.emailInstitucional || authUser.email || '';
    effectiveUser.displayName = actor.displayName || authUser.displayName || '';
    effectiveUser.photoURL = actor.photoURL || authUser.photoURL || '';
    effectiveUser.qaOwnerUid = authUser.uid || '';
    effectiveUser.qaOwnerEmail = authUser.email || '';
    effectiveUser.qaActingAs = actor;
    return effectiveUser;
  }

  function getEffectiveAuth(authInstance = SIA?.auth || null, profile = currentUserProfile) {
    if (!authInstance) return authInstance;

    const authUser = getEffectiveSessionUser(authInstance.currentUser, profile);
    if (!authUser || authUser === authInstance.currentUser) return authInstance;

    return new Proxy(authInstance, {
      get(target, prop, receiver) {
        if (prop === 'currentUser') return authUser;
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }

  function getEffectiveSessionUid(profile = currentUserProfile) {
    return getEffectiveSessionUser(SIA?.auth?.currentUser || null, profile)?.uid || '';
  }

  function setSessionProfileState(user, effectiveProfile, baseProfile = effectiveProfile, options = {}) {
    currentUserProfile = effectiveProfile;
    window.currentUserProfile = effectiveProfile;

    if (window.SIA) {
      window.SIA.baseUserProfile = baseProfile;
      window.SIA.currentUserProfile = effectiveProfile;
    }

    Store.setUser(user, effectiveProfile);
    updateUserAvatars(effectiveProfile.displayName);
    updateNavbarUserInfo(
      effectiveProfile.displayName,
      effectiveProfile.role,
      effectiveProfile.email,
      effectiveProfile.matricula
    );

    updateMenuVisibility(effectiveProfile);

    if (window.PanicService?.bindSession) {
      try {
        window.PanicService.bindSession(window.SIA, effectiveProfile);
      } catch (error) {
        console.warn('[PanicService] No se pudo enlazar la sesion actual:', error);
      }
    }

    if ((Store.currentView || '') === 'view-dashboard' || options.syncDashboard === true) {
      renderDashboardSurface(effectiveProfile);
    }

    window.dispatchEvent(new CustomEvent('sia-profile-ready', {
      detail: {
        profile: effectiveProfile,
        baseProfile,
        source: options.source || 'app-auth'
      }
    }));

    return effectiveProfile;
  }

  function commitSessionProfile(user, baseProfile, options = {}) {
    const effectiveProfile = window.SIA?.resolveActiveProfile
      ? window.SIA.resolveActiveProfile(baseProfile)
      : baseProfile;

    return setSessionProfileState(user, effectiveProfile, baseProfile, options);
  }

  function safeParseJson(raw, fallback = null) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readStoredDevBaseProfile() {
    return safeParseJson(localStorage.getItem(DEV_SIM_BASE_PROFILE_STORAGE_KEY), null);
  }

  function writeStoredDevBaseProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const snapshot = safeParseJson(JSON.stringify(profile), null);
    if (!snapshot) return null;
    localStorage.setItem(DEV_SIM_BASE_PROFILE_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  function clearStoredDevBaseProfile() {
    localStorage.removeItem(DEV_SIM_BASE_PROFILE_STORAGE_KEY);
  }

  function getResolvedDevBaseProfile() {
    return readStoredDevBaseProfile()
      || window.SIA?.baseUserProfile
      || currentUserProfile
      || null;
  }

  function ensureDevBaseProfileStored(profile) {
    const existing = readStoredDevBaseProfile();
    if (existing) return existing;
    return writeStoredDevBaseProfile(profile);
  }

  function buildDevSyncPayload(profile) {
    const deleteField = window.SIA?.FieldValue?.delete ? window.SIA.FieldValue.delete() : undefined;
    const resolveValue = (value) => {
      if (Array.isArray(value)) return value.length ? value : deleteField;
      if (value && typeof value === 'object') return Object.keys(value).length ? value : deleteField;
      if (value === undefined || value === null || value === '') return deleteField;
      return value;
    };

    return {
      role: resolveValue(profile?.role),
      permissions: resolveValue(profile?.permissions),
      allowedViews: resolveValue(profile?.allowedViews),
      specialty: resolveValue(profile?.specialty),
      especialidad: resolveValue(profile?.especialidad),
      department: resolveValue(profile?.department),
      tipoUsuario: resolveValue(profile?.tipoUsuario)
    };
  }

  async function syncDevProfileToBackend(profile) {
    const uid = Store.user?.uid || window.SIA?.auth?.currentUser?.uid || '';
    if (!uid || !window.SIA?.db) return false;

    const payload = buildDevSyncPayload(profile);
    await window.SIA.db.collection('usuarios').doc(uid).set(payload, { merge: true });
    return true;
  }

  async function resolveFreshProfileForUid(uid, fallbackProfile = null) {
    if (!uid) return fallbackProfile;

    try {
      if (window.SIA?.findUserByUid) {
        const freshProfile = await window.SIA.findUserByUid(uid);
        if (freshProfile) return freshProfile;
      }
    } catch (error) {
      console.warn('[DevMode] No se pudo refrescar el perfil restaurado:', error);
    }

    return fallbackProfile;
  }

  async function applyDevProfileSimulation(simulatedProfile, options = {}) {
    const authUser = window.SIA?.auth?.currentUser || Store.user || null;
    if (!authUser) {
      throw new Error('Debes iniciar sesion para usar el simulador de desarrollo.');
    }

    const baseProfile = getResolvedDevBaseProfile() || currentUserProfile || {};
    ensureDevBaseProfileStored(baseProfile);

    const effectiveProfile = {
      ...baseProfile,
      ...simulatedProfile,
      uid: authUser.uid,
      email: simulatedProfile?.email || baseProfile.email || baseProfile.emailInstitucional || authUser.email || '',
      emailInstitucional: simulatedProfile?.emailInstitucional || baseProfile.emailInstitucional || baseProfile.email || authUser.email || '',
      emailPersonal: simulatedProfile?.emailPersonal || baseProfile.emailPersonal || baseProfile.email || authUser.email || '',
      permissions: { ...(simulatedProfile?.permissions || {}) },
      allowedViews: Array.isArray(simulatedProfile?.allowedViews) ? [...simulatedProfile.allowedViews] : []
    };

    localStorage.setItem(DEV_SIM_PROFILE_STORAGE_KEY, JSON.stringify(effectiveProfile));
    setSessionProfileState(authUser, effectiveProfile, baseProfile, {
      source: 'dev-profile-switch',
      syncDashboard: true
    });

    let backendSynced = true;
    try {
      await syncDevProfileToBackend(effectiveProfile);
    } catch (error) {
      backendSynced = false;
      console.warn('[DevMode] No se pudo sincronizar el perfil simulado en Firestore:', error);
    }

    const currentView = Store.currentView || 'view-dashboard';
    const requestedView = options.viewId || effectiveProfile?.devSimulation?.homeView || '';
    const nextView = (
      options.keepCurrentView !== false && canAccessViewForProfile(currentView, effectiveProfile)
    )
      ? currentView
      : (requestedView && canAccessViewForProfile(requestedView, effectiveProfile)
        ? requestedView
        : getHomeViewForProfile(effectiveProfile));

    if (options.skipNavigate !== true) {
      await navigate(nextView, nextView !== currentView, true);
    }

    return {
      profile: effectiveProfile,
      backendSynced,
      currentView: nextView
    };
  }

  async function clearDevProfileSimulation(options = {}) {
    const authUser = window.SIA?.auth?.currentUser || Store.user || null;
    const baseProfileSnapshot = getResolvedDevBaseProfile();

    localStorage.removeItem(DEV_SIM_PROFILE_STORAGE_KEY);

    let backendSynced = true;
    if (options.restoreBackend !== false && authUser && baseProfileSnapshot) {
      try {
        await syncDevProfileToBackend(baseProfileSnapshot);
      } catch (error) {
        backendSynced = false;
        console.warn('[DevMode] No se pudo restaurar el perfil real en Firestore:', error);
      }
    }

    clearStoredDevBaseProfile();

    if (options.skipSessionSync === true || !authUser) {
      return {
        profile: baseProfileSnapshot,
        backendSynced,
        currentView: Store.currentView || 'view-dashboard'
      };
    }

    const restoredProfile = backendSynced
      ? await resolveFreshProfileForUid(authUser.uid, baseProfileSnapshot)
      : baseProfileSnapshot;
    if (!restoredProfile) {
      return {
        profile: null,
        backendSynced,
        currentView: Store.currentView || 'view-dashboard'
      };
    }

    setSessionProfileState(authUser, restoredProfile, restoredProfile, {
      source: 'dev-profile-clear',
      syncDashboard: true
    });

    const currentView = Store.currentView || 'view-dashboard';
    const requestedView = options.viewId || currentView;
    const nextView = canAccessViewForProfile(requestedView, restoredProfile)
      ? requestedView
      : getHomeViewForProfile(restoredProfile);

    if (options.skipNavigate !== true) {
      await navigate(nextView, nextView !== currentView, true);
    }

    return {
      profile: restoredProfile,
      backendSynced,
      currentView: nextView
    };
  }

  async function applyQaSessionContext(contextKey, options = {}) {
    const authUser = SIA.auth?.currentUser;
    const baseProfile = window.SIA?.baseUserProfile || currentUserProfile;

    if (!authUser || !baseProfile || !window.SIA?.canUseQaContextSwitcher?.(baseProfile)) {
      return null;
    }

    const resolvedContextKey = contextKey || window.SIA?.getDefaultQaContextKey?.(baseProfile) || baseProfile?.qaDefaults?.context || 'student';
    if (!options.skipDefaultActor && window.SIA?.ensureQaActorForContext) {
      try {
        await window.SIA.ensureQaActorForContext(resolvedContextKey);
      } catch (error) {
        console.warn('[QA] No se pudo resolver el actor por defecto:', error);
      }
    }

    window.SIA?.setStoredQaContextKey?.(resolvedContextKey);
    const effectiveProfile = commitSessionProfile(authUser, baseProfile, { source: 'qa-context-switch' });

    const currentView = Store.currentView || 'view-dashboard';
    const preferredView = options.viewId || effectiveProfile?.qaContext?.targetView || currentView;
    const shouldForcePreferredView = options.forceTargetView === true
      && !!preferredView
      && canAccessViewForProfile(preferredView, effectiveProfile);
    const nextView = shouldForcePreferredView
      ? preferredView
      : (canAccessViewForProfile(currentView, effectiveProfile)
        ? currentView
        : (canAccessViewForProfile(preferredView, effectiveProfile) ? preferredView : getHomeViewForProfile(effectiveProfile)));

    window.dispatchEvent(new CustomEvent('sia-qa-context-changed', {
      detail: {
        profile: effectiveProfile,
        baseProfile,
        contextKey: effectiveProfile?.qaContext?.key || contextKey
      }
    }));

    if (options.reload !== false) {
      navigate(nextView, true, true);
    }

    return effectiveProfile;
  }

  async function setQaSessionActor(contextKey, actor, options = {}) {
    const authUser = SIA.auth?.currentUser;
    const baseProfile = window.SIA?.baseUserProfile || currentUserProfile;
    if (!authUser || !baseProfile || !window.SIA?.canUseQaContextSwitcher?.(baseProfile)) {
      return null;
    }

    const activeContextKey = contextKey
      || currentUserProfile?.qaContext?.key
      || window.SIA?.getStoredQaContextKey?.()
      || window.SIA?.getDefaultQaContextKey?.(baseProfile)
      || 'student';

    if (options.resolveDefault) {
      await window.SIA?.ensureQaActorForContext?.(activeContextKey, { forceResolve: true });
    } else if (actor?.uid) {
      window.SIA?.setStoredQaActor?.(activeContextKey, actor);
    } else {
      window.SIA?.clearStoredQaActor?.(activeContextKey);
    }

    return applyQaSessionContext(activeContextKey, {
      reload: options.reload !== false,
      viewId: options.viewId,
      forceTargetView: options.forceTargetView,
      skipDefaultActor: !actor?.uid && !options.resolveDefault
    });
  }

  let _authProcessing = false;
  let _loginPopupInProgress = false; // Guard: no llamar showLanding() mientras el popup esta abierto
  SIA.auth.onAuthStateChanged(async (user) => {
    // Guard against concurrent executions (Firebase can fire this rapidly)
    if (_authProcessing) return;
    _authProcessing = true;

    try {

      let path = window.location.pathname || '/';
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        path = window.location.hash.replace('#', '');
      }
      const isVerifyRoute = path.startsWith('/verify/');
      const isVocacionalRoute = path === '/test-vocacional' || path === '/vocacional/test';
      const isCampusMapPublicRoute = path === '/mapa-campus';
      const isQaSecretRoutePath = isQaSecretRoute(path);

      if (!user) {

        // === THEME: invitado ===
        const guestTheme = resolveInitialTheme(null);
        applyTheme(guestTheme, false);
        initThemeToggle(null);

        // CASO 1: INVITADO (Sin Google)
        currentUserProfile = null;
        window.currentUserProfile = null;
        if (window.SIA) {
          window.SIA.currentUserProfile = null;
          window.SIA.baseUserProfile = null;
        }
        Store.clear();
        ModuleManager.clearAll();
        // FIX NOTIFICATIONS
        if (window.Notify) Notify.cleanup();
        if (window.PanicService?.cleanup) {
          try {
            window.PanicService.cleanup();
          } catch (error) {
            console.warn('[PanicService] Error limpiando sesion:', error);
          }
        }

        if (globalAvisosUnsub) { globalAvisosUnsub(); globalAvisosUnsub = null; }

        if (isVerifyRoute) {
          startVerifyFlowFromCurrentPath();
        } else if (isQaSecretRoutePath) {
          showQaSecretLogin({ resetPassword: false });
        } else if (isVocacionalRoute || isCampusMapPublicRoute) {
          await restoreCurrentRoute();
        } else if (_loginPopupInProgress) {
          // NO regresar al landing mientras el popup de Microsoft esta abierto
          console.log('[Auth] Popup de login abierto. Esperando autenticacion...');
        } else {
          showLanding();
        }

      } else {
        // ===== CASO 2: LOGUEADO CON GOOGLE/MICROSOFT =====
        try {
          const authExtraData = readStoredRegisterExtraData();
          const canReuseAuthExtraData = !authExtraData?.authUid || authExtraData.authUid === user.uid;
          const authEmail = resolveEffectiveAuthEmail(user, authExtraData);

          if (
            window.SIA?.isAllowedMicrosoftLoginEmail
            && !window.SIA.isAllowedMicrosoftLoginEmail(authEmail)
            && !window.SIA?.isQaSuperAdminEmail?.(authEmail)
          ) {
            if (typeof showToast === 'function') {
              showToast('Esta cuenta no esta autorizada para entrar a SIA.', 'warning');
            }
            await SIA.auth.signOut();
            return;
          }

          const userType = detectUserType(authEmail);

          if (isQaSecretRoutePath && userType.type !== 'qa_superadmin') {
            showQaSecretLogin({
              message: `Hay una sesion activa con ${authEmail || user.email || 'esta cuenta'}. Usa la clave QA para entrar con ${QA_SECRET_LOGIN_CONFIG.email}.`,
              level: 'warning',
              resetPassword: false
            });
            hideLoader();
            return;
          }

          let profile = null;

          if (userType.type === 'qa_superadmin') {
            profile = window.SIA?.buildQaSuperAdminProfile
              ? window.SIA.buildQaSuperAdminProfile(user, { nombre: user.displayName || userType.name })
              : {
                uid: user.uid,
                email: authEmail || user.email,
                emailInstitucional: authEmail || user.email,
                displayName: user.displayName || userType.name || 'SuperAdmin QA',
                role: 'superadmin'
              };

            try {
              await SIA.saveUserProfile(profile);
            } catch (e) {
              console.error('[Auth] Error creando perfil QA SuperAdmin:', e);
            }
          }

          // A) SI ES DEPARTAMENTO OFICIAL -> Forzamos el perfil estático
          if (userType.type === 'department') {
            // ... (existing logic)
          }

          // ⚡ DEV MODE SIMULATION INTERCEPT ⚡
          const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
          const simProfileJson = localStorage.getItem(DEV_SIM_PROFILE_STORAGE_KEY);

          if (isDevMode && simProfileJson) {
            try {
              const simProfile = JSON.parse(simProfileJson);
              // Only use if the underlying Auth UID matches (security/sanity check)
              // or just trust it for dev. Let's trust it but merge UID.
              profile = { ...simProfile, uid: user.uid, email: authEmail || user.email };
              console.log("[DevMode] ⚡ Simulación Activada:", profile.role);
            } catch (e) { console.error("SimProfile Error", e); }
          }

          // D) SI NO HAY PERFIL SIMULADO, BUSCAR REMOTO
          if (!profile) {
            if (userType.type === 'department') {
              console.log("[Auth] 🏢 Es departamento oficial. Forzando datos...");
              profile = {
                uid: user.uid,
                email: authEmail || user.email,
                displayName: userType.name,
                role: userType.role,
                permissions: userType.permissions,
                allowedViews: userType.allowedViews,
                photoURL: user.photoURL || '',
                departmentConfig: userType,
                matricula: (authEmail || user.email || '').split('@')[0],
                lastLogin: new Date()
              };

              // Sync Firestore
              try {
                await SIA.db.collection('usuarios').doc(user.uid).set({
                  email: profile.email,
                  emailInstitucional: profile.email,
                  emailPersonal: profile.email,
                  displayName: profile.displayName,
                  role: profile.role,
                  permissions: profile.permissions,
                  allowedViews: profile.allowedViews,
                  department: profile.departmentConfig?.department || (authEmail || user.email || '').split('@')[0],
                  specialty: profile.departmentConfig?.specialty || '',
                  especialidad: profile.departmentConfig?.specialty || '',
                  matricula: profile.matricula,
                  lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                  photoURL: profile.photoURL
                }, { merge: true });
              } catch (e) { console.error("[Auth] ❌ Error sync departamento:", e); }

            } else {
              // B) SI ES PERSONAL O ESTUDIANTE -> Buscamos en Firestore normalmente
              profile = await SIA.ensureProfile(user);

              if (!profile && authEmail) {
                try { profile = await SIA.findUserByInstitutionalEmail(authEmail); } catch (e) { }
              }
            }
          }

          // C) SI NO EXISTE PERFIL (Y NO ES DEPARTAMENTO) -> REGISTRO
          if (!profile) {
            console.warn("⚠️ Usuario nuevo REAL. Redirigiendo a Registro.");
            hideLoader();

            let extraData = canReuseAuthExtraData ? { ...authExtraData } : {};

            if (!extraData.authUid && user.uid) {
              extraData.authUid = user.uid;
            }

            if (!extraData.emailInstitucional && authEmail) {
              extraData.emailInstitucional = authEmail;
              extraData.matricula = authEmail.split('@')[0];
            }
            if (!extraData.nombre && user.displayName) {
              extraData.nombre = user.displayName;
            }

            try {
              localStorage.setItem(TEMP_EXTRADATA_STORAGE_KEY, JSON.stringify(extraData));
            } catch (e) { }

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
          if (window.SIA?.canUseQaContextSwitcher?.(profile) && window.SIA?.ensureQaActorForContext) {
            const bootstrapContextKey = window.SIA?.getStoredQaContextKey?.() || window.SIA?.getDefaultQaContextKey?.(profile) || 'student';
            try {
              await window.SIA.ensureQaActorForContext(bootstrapContextKey);
            } catch (error) {
              console.warn('[QA] No se pudo preparar el actor inicial:', error);
            }
          }
          profile = commitSessionProfile(user, profile, { source: 'app-auth' });


          // Notificar al dashboard del estudiante (y otros componentes) que el perfil está listo

          // --- NOTIFICACIONES ---
          if (window.Notify) {
            Notify.init(window.SIA, user.uid);
          } else {
            console.warn('[App] Notify service not found.');
          }

          // 📲 PUSH: Solicitar permiso después de 30s (no intrusivo)
          if (window.PushService && PushService.isSupported()) {
            Promise.resolve(
              typeof PushService.getPermissionStateAsync === 'function'
                ? PushService.getPermissionStateAsync()
                : PushService.getPermissionState()
            ).then((perm) => {
              if (perm === 'default' && !localStorage.getItem('sia_push_dismissed')) {
                setTimeout(() => {
                  if (window.Notify) Notify.requestPushPermission(user.uid);
                }, 30000);
              }
            }).catch((e) => {
              console.warn('[App] No se pudo consultar el permiso push:', e);
            });
          }

          // 📲 SW: Manejar mensajes de navegación desde el service worker (notificationclick)
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
              if (event.data && event.data.type === 'SIA_NAVIGATE' && event.data.view) {
                const router = window.SIA?._router;
                if (router) router.navigate(event.data.view);
              }
            });
          }

          // --- ENCUESTAS PENDIENTES (GENERALES Y DE SERVICIO) ---
          // Verificar si hay encuestas pendientes y mostrarlas (Stories/Modal)
          checkAndDisplayPendingSurveys().catch(err => console.error("[App] Error checking surveys:", err));

          // 🚀 DISPARAR CARGA DE DATOS DEL DASHBOARD PARA ESTUDIANTES/DOCENTES
          if (shouldUseStandardDashboard(profile)) {
            setTimeout(() => {
              if (typeof window.SIA?.refreshStudentDashboard === 'function') {
                window.SIA.refreshStudentDashboard();
              } else {
                if (window.SIA?.updateSmartCards) window.SIA.updateSmartCards();
                if (typeof renderDashboardStories === 'function') renderDashboardStories();
                if (typeof checkAndShowAvisos === 'function') checkAndShowAvisos();
              }
            }, 800);
          }

          // 🚀 ENTRAR A LA APP
          showApp();

          // Lazy load librerias pesadas para graficos y exportacion de forma asíncrona
          if (!window._heavyLibsLoaded) {
            window._heavyLibsLoaded = true;
            setTimeout(() => {
              const _loadScript = (src) => new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                document.body.appendChild(s);
              });
              // Load independent libs in parallel, then their plugins
              Promise.all([
                _loadScript("https://cdn.jsdelivr.net/npm/chart.js"),
                _loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
                _loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js")
              ]).then(() => Promise.all([
                _loadScript("https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"),
                _loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js")
              ])).catch(e => console.warn("[App] Error cargando librería:", e));
            }, 800); // Dar respiro al browser antes de empezar la descarga
          }

          const initialTheme = resolveInitialTheme(profile?.prefs || profile?.preferences || null);
          applyTheme(initialTheme, false);

          initThemeToggle(user);

          // --- ENRUTAMIENTO INTELIGENTE ---
          // FIX: Leer hash si existe (SPA con hash routing #/ruta)
          let path = window.location.pathname || '/';
          if (window.location.hash && window.location.hash.startsWith('#/')) {
            path = window.location.hash.replace('#', '');
            console.log('[Nav] Hash detectado en auth:', path);
          }

          // 1. Si es departamento con VISTAS RESTRINGIDAS (ej. solo biblio), forzar esa vista
          if (profile.allowedViews && profile.allowedViews.length === 1) {
            const forcedView = profile.allowedViews[0];
            console.log('[Nav] Usuario con vista unica. Redirigiendo a: ' + forcedView);
            navigate(forcedView, true, true); // Force skipAuthCheck
            return;
          }

          if (isQaSecretRoutePath && userType.type === 'qa_superadmin') {
            navigate(getHomeViewForProfile(profile), true, true);
            return;
          }

          // 2. Si es rol con vista especifica
          const roleHome = ROLE_HOME_VIEWS[currentUserProfile.role];

          // FIX: Rutas vocacionales son publicas, no redirigir al home aunque sea path '/'
          const isHashVocacional = path === '/test-vocacional' || path === '/vocacional/test';

          if (isHashVocacional) {
            // Mostrar la vista vocacional incluso para usuario loggeado
            await restoreCurrentRoute();
          } else if (path === '/' || path === '') {
            if (roleHome) {
              navigate(roleHome, true, true); // Force skipAuthCheck
            } else {
              navigate('view-dashboard', true, true); // Force skipAuthCheck
            }
          } else {
            await restoreCurrentRoute();
          }

        } catch (e) {
          console.error("❌ Error crítico auth:", e);
          showLanding();
        }
      }
      hideLoader();

    } finally {
      _authProcessing = false;
    }
  });


  // --- Funciones de Cambio de Escena ---

  function showLanding() {
    // Ocultar vistas publicas vocacionales al volver al landing
    document.querySelectorAll('.sia-public-view').forEach(v => v.classList.add('d-none'));
    hideQaSecretLogin();
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

    window.SIA?.resetStudentDashboardState?.({ clearDom: true, clearFreshness: true });
    safeSetText('user-email', '');
    currentUserProfile = null;
    window.currentUserProfile = null;
    if (window.SIA) {
      window.SIA.currentUserProfile = null;
      window.SIA.baseUserProfile = null;
    }
    Store.clear();
    ModuleManager.clearAll();
  }

  function showApp() {
    // Ocultar vistas publicas vocacionales al entrar a la app
    document.querySelectorAll('.sia-public-view').forEach(v => v.classList.add('d-none'));
    hideQaSecretLogin();
    if (landingView) landingView.classList.add('d-none');
    if (registerWizard) registerWizard.classList.add('d-none'); // Hide

    if (appShell) {
      appShell.classList.remove('d-none');
      appShell.style.display = ''; // Reset display to default (block/flex)
    }

    if (verifyShell) verifyShell.classList.add('d-none');
  }

  function showVerifyShell() {
    hideQaSecretLogin();
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

  // [REMOVED] Duplicate hashchange listener — Core Router (router.js) already handles this.
  // Keeping this caused double navigation on hash changes.

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
      renderDashboardSurface(currentUserProfile);

      if (shouldUseStandardDashboard(currentUserProfile)) {
        if (typeof window.SIA?.refreshStudentDashboard === 'function') {
          window.SIA.refreshStudentDashboard();
        } else if (window.SIA?.updateSmartCards) {
          window.SIA.updateSmartCards();
        }
      }
    }
  });
  /* ==========================================================================
     🔍 SIA GLOBAL SEARCH MODULE (ROBUST V3)
     ========================================================================== */
  (function initSiaSearch() {

    // Seleccionar TODOS los inputs de búsqueda (Navbar y Modal)
    const inputs = document.querySelectorAll('.search-input-sia');
    const resultsContainers = document.querySelectorAll('.search-results-dropdown');

    if (inputs.length === 0) {
      console.error("[Search] ❌ No se encontraron inputs de búsqueda (.search-input-sia).");
      return;
    }


    const SEARCH_INDEX = [
      // Módulos
      { label: 'Aula Virtual', type: 'Módulo', icon: 'mortarboard-fill', color: 'text-primary', action: () => SIA.navigate('view-aula'), keywords: 'curso clase aprender examen tarea' },
      { label: 'Comunidad', type: 'Módulo', icon: 'people-fill', color: 'text-success', action: () => SIA.navigate('view-comunidad'), keywords: 'social campus comunidad venta perdidos preguntas avisos' },
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
      const categoryOrder = ['Módulo', 'Atajo', 'Cuenta', 'Urgente', 'En el sistema', 'Sistema', 'Otros'];

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
            <div class="rounded-circle  d-flex align-items-center justify-content-center flex-shrink-0"
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

      let _searchTimer = null;
      let _liveSearchTimer = null;

      // C2-05: Live Firestore search
      async function _liveSearch(term) {
        if (!SIA?.db || term.length < 3) return [];
        const results = [];
        try {
          const [booksSnap, coursesSnap] = await Promise.all([
            SIA.db.collection('catalogo-biblio')
              .where('titulo', '>=', term)
              .where('titulo', '<=', term + '\uf8ff')
              .limit(3).get().catch(() => ({ docs: [] })),
            SIA.db.collection('aula-cursos')
              .where('titulo', '>=', term)
              .where('titulo', '<=', term + '\uf8ff')
              .limit(3).get().catch(() => ({ docs: [] }))
          ]);

          booksSnap.docs.forEach(doc => {
            const b = doc.data();
            results.push({
              label: b.titulo || 'Libro',
              type: 'En el sistema',
              icon: 'book-half',
              color: 'text-warning',
              action: () => SIA.navigate('view-biblio'),
              keywords: ''
            });
          });

          coursesSnap.docs.forEach(doc => {
            const c = doc.data();
            results.push({
              label: c.titulo || 'Curso',
              type: 'En el sistema',
              icon: 'mortarboard-fill',
              color: 'text-primary',
              action: () => SIA.navigate('view-aula'),
              keywords: ''
            });
          });
        } catch (e) {
          console.warn('[Search] Live search error:', e);
        }
        return results;
      }

      input.addEventListener('input', (e) => {
        clearTimeout(_searchTimer);
        clearTimeout(_liveSearchTimer);
        const term = e.target.value.trim().toLowerCase();
        if (term.length < 2) {
          resultsContainer.classList.remove('active');
          resultsContainer.classList.add('d-none');
          resultsContainer.style.display = 'none';
          return;
        }

        _searchTimer = setTimeout(() => {
          const matches = SEARCH_INDEX.filter(item =>
            item.label.toLowerCase().includes(term) ||
            (item.keywords && item.keywords.includes(term))
          );

          resultsContainer.classList.add('active');
          resultsContainer.classList.remove('d-none');
          resultsContainer.style.display = 'block';
          renderResults(resultsContainer, matches, input);

          // C2-05: Also fire live search for 3+ chars
          if (term.length >= 3) {
            _liveSearchTimer = setTimeout(async () => {
              const liveResults = await _liveSearch(term);
              if (liveResults.length > 0) {
                const allMatches = [...matches, ...liveResults];
                renderResults(resultsContainer, allMatches, input);
              }
            }, 400);
          }
        }, 200);
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

  // Listener para el boton de Microsoft (Azure AD Institucional)
  const btnLoginMS = document.getElementById('btn-login-microsoft');

  if (!window.SIA) window.SIA = {};
  window.SIA.initiateMicrosoftLogin = async () => {
    if (btnLoginMS && btnLoginMS.disabled) return;

    // Guardar HTML original del boton para restaurarlo despues
    const originalHTML = btnLoginMS ? btnLoginMS.innerHTML : '';
    if (btnLoginMS) {
      btnLoginMS.disabled = true;
      btnLoginMS.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Conectando...';
    }

    // CRITICAL: Indicar a onAuthStateChanged que NO llame showLanding()
    // mientras el popup esta abierto (evita el 'regreso al landing' prematuro)
    _loginPopupInProgress = true;

    try {
      console.log("[Auth] Iniciando login con Microsoft...");
      const result = await SIA.loginWithMicrosoft();
      console.log("[Auth] Login Microsoft exitoso");
      const authEmail = resolveEffectiveAuthEmail(result.user, result.extradata);

      // Delegar perfiles especiales al flujo central de auth para evitar
      // carreras con el wizard de registro.
      const userType = detectUserType(authEmail);

      if (userType.type === 'department' || userType.type === 'qa_superadmin') {
        console.log("[Auth] Perfil especial detectado. Delegando a onAuthStateChanged...");
        return;
      }

      // Buscar perfil existente
      const existingProfile = await SIA.findUserByInstitutionalEmail(authEmail);

      if (existingProfile) {
        console.log("[Auth] Usuario encontrado:", existingProfile.displayName);
        try {
          await SIA.db.collection('usuarios').doc(existingProfile.uid).update({
            lastLogin: SIA.FieldValue.serverTimestamp(),
            photoURL: result.user.photoURL || existingProfile.photoURL || ''
          });
        } catch (updateErr) {
          console.warn("[Auth] No se pudo actualizar lastLogin:", updateErr);
        }
        if (typeof showToast === 'function') {
          showToast('Bienvenido de nuevo, ' + existingProfile.displayName + '!', 'success');
        }
      } else {
        // Usuario nuevo: guardar extradata y lanzar registro
        console.log("[Auth] Usuario nuevo detectado. Iniciando registro...");
        if (typeof showToast === 'function') showToast('Completa tu registro institucional', 'info');
        try {
          const nextExtraData = {
            ...(result.extradata || {}),
            authUid: result.user.uid,
            emailInstitucional: authEmail || result.extradata?.emailInstitucional || ''
          };
          localStorage.setItem(TEMP_EXTRADATA_STORAGE_KEY, JSON.stringify(nextExtraData));
          if (userType.type === 'student') {
            const currentData = nextExtraData;
            currentData.forcedRole = 'student';
            localStorage.setItem(TEMP_EXTRADATA_STORAGE_KEY, JSON.stringify(currentData));
          }
        } catch (e) { console.error('[Auth] Error guardando extradata:', e); }
        if (window.SIA_Register) {
          const registerExtraData = {
            ...(result.extradata || {}),
            authUid: result.user.uid,
            emailInstitucional: authEmail || result.extradata?.emailInstitucional || ''
          };
          SIA_Register.init(result.user, registerExtraData);
        }
      }

    } catch (error) {
      // popup-closed y cancelled-popup: el usuario cerro el popup, no es error real
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log('[Auth] Popup cerrado. Listo para reintentar.');
        if (typeof showToast === 'function') showToast('Inicio de sesion cancelado.', 'info');
      } else if (error.code === 'auth/network-request-failed') {
        if (typeof showToast === 'function') showToast('Error de conexion. Verifica tu internet.', 'danger');
      } else if (error.code === 'auth/microsoft-consumer-not-enabled') {
        if (typeof showToast === 'function') {
          showToast('El proveedor Microsoft del proyecto no acepta cuentas personales. Hay que habilitar Consumers en Azure/Firebase para usar el Outlook QA.', 'warning');
        }
      } else if (error.code === 'auth/microsoft-single-tenant-requires-tenant' || String(error.message || '').includes('AADSTS50194')) {
        if (typeof showToast === 'function') {
          showToast('El login Microsoft del proyecto estaba apuntando a /common. Ya debe usar el tenant institucional.', 'warning');
        }
      } else if (String(error.message || '').toLowerCase().includes('unauthorized_client')) {
        if (typeof showToast === 'function') {
          showToast('El proveedor Microsoft del proyecto no acepta cuentas personales. Hay que habilitar Consumers en Azure/Firebase para usar el Outlook QA.', 'warning');
        }
      } else if (error.code === 'auth/email-not-allowed') {
        if (typeof showToast === 'function') {
          showToast('Solo pueden entrar por Microsoft los correos institucionales.', 'warning');
        }
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        console.warn('[Auth] Cuenta existe con credencial diferente (Google):', error);
        if (typeof showToast === 'function') {
          showToast('Esta cuenta ya existe. Por favor, intenta iniciar sesión con Google.', 'warning');
        } else {
          alert('Esta cuenta está ligada a Google. Inicia sesión con Google.');
        }
      } else {
        console.error('[Auth] Error en Microsoft Auth:', error);
        if (typeof showToast === 'function') showToast('Error de acceso. Intenta de nuevo.', 'danger');
      }
    } finally {
      _loginPopupInProgress = false;
      if (btnLoginMS) {
        btnLoginMS.disabled = false;
        btnLoginMS.innerHTML = originalHTML;
      }
    }
  };

  qaSecretLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = qaSecretLoginSubmit || qaSecretLoginForm.querySelector('button[type="submit"]');
    const originalHTML = submitButton ? submitButton.innerHTML : '';
    setQaSecretLoginMessage('');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Entrando...';
    }

    try {
      await window.SIA?.loginQaSecret?.(qaSecretLoginPassword?.value || '');
      if (typeof showToast === 'function') showToast('Acceso QA verificado.', 'success');
    } catch (error) {
      console.error('[QA Secret] Error de acceso:', error);
      setQaSecretLoginMessage(getQaSecretLoginErrorMessage(error), error?.code === 'auth/operation-not-allowed' ? 'warning' : 'danger');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalHTML;
      }
    }
  });

  qaSecretLoginSignOut?.addEventListener('click', async () => {
    try {
      await window.SIA?.auth?.signOut?.();
      showQaSecretLogin({
        message: 'Sesion actual cerrada. Ahora puedes entrar con la cuenta QA.',
        level: 'success'
      });
    } catch (error) {
      console.error('[QA Secret] Error cerrando sesion previa:', error);
      setQaSecretLoginMessage('No se pudo cerrar la sesion actual.', 'danger');
    }
  });

  if (btnLoginMS) {
    btnLoginMS.addEventListener('click', async (e) => {
      if (e) e.preventDefault();
      await window.SIA.initiateMicrosoftLogin();
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

    try {
      if (window.SIA?.clearDevProfileSimulation) {
        await window.SIA.clearDevProfileSimulation({
          restoreBackend: true,
          skipNavigate: true,
          skipSessionSync: true
        });
      }
    } catch (e) {
      console.warn("Error restoring simulated profile before logout:", e);
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
    localStorage.removeItem(DEV_SIM_PROFILE_STORAGE_KEY); // Clear Dev Simulation
    localStorage.removeItem(DEV_SIM_BASE_PROFILE_STORAGE_KEY);
    localStorage.removeItem('sia_superadmin_context');
    localStorage.removeItem('sia_superadmin_actor_map');
    localStorage.removeItem('sia_reports_cache_biblio_catalogo');
    localStorage.removeItem('sia_reports_cache_biblio_catalogo_meta');
    localStorage.removeItem('sia_reports_cache_biblio_activos');
    localStorage.removeItem('sia_reports_cache_biblio_activos_meta');
    localStorage.removeItem('sia_reports_cache_expedientes');
    localStorage.removeItem('sia_reports_cache_expedientes_meta');
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
  // 5. LÓ“GICA DE MÓ“DULOS (CONTEXTO)
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
    comunidad: [
      'Usa los filtros por tipo para encontrar preguntas, ventas o perdidos mas rapido.',
      'Comunidad distingue visualmente a alumnos, docentes y personal.',
      'Reporta contenido sospechoso para mantener el espacio ordenado.'
    ],
  };

  function getCtx() {
    const activeUnsubs = { push: fn => ModuleManager.addSubscription(fn) };
    const user = getEffectiveSessionUser(SIA?.auth?.currentUser || null, currentUserProfile);
    return {
      auth: getEffectiveAuth(SIA?.auth || null, currentUserProfile),
      db: SIA.db,
      storage: SIA.storage,
      user,
      realUser: SIA?.auth?.currentUser || null,
      qaActingAs: currentUserProfile?.qaActor || null,
      currentUserProfile,
      profile: currentUserProfile,
      ModuleManager,
      activeUnsubs
    };
  }

  function moduleKeyFromView(viewId) {
    if (viewId === 'view-aula') return 'aula';
    if (viewId === 'view-comunidad') return 'comunidad';
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
    if (viewId === 'view-aula-course') {
      Breadcrumbs.setView(viewId, {
        label: extraLabel || 'Curso',
        pillLabel: extraLabel || 'Curso',
        parentLabel: 'Aula Virtual'
      });
      return;
    }

    Breadcrumbs.setView(viewId);
    return;
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
      case 'view-comunidad': label = 'Comunidad'; break;
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
      globalAvisosContainer.innerHTML = `<strong class="text-uppercase"><i class="bi bi-exclamation-triangle-fill me-2"></i>ALERTA:</strong> ${typeof escapeHtml === 'function' ? escapeHtml(aviso.texto) : aviso.texto}`;
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
    if (window.SIA?._router) {
      await window.SIA._router.navigate('view-avisos');
    } else if (window.SIA?.navigate) {
      await window.SIA.navigate('view-avisos');
    }
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

    const canTeachInAula = window.SIA?.canTeachInAula ? window.SIA.canTeachInAula(profile) : (profile?.role === 'aula');

    if (profile?.role === 'superadmin') {
      saWrap?.classList.remove('d-none');
      Aula.initSuperAdmin(ctx);
    } else if (canTeachInAula) {
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
    navigate('view-aula-course', true, true);
  };

  window.SIA_navToAula = function () {
    window.SIA_currentCourseId = null;
    navigate('view-aula', true, true);
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
    'view-comunidad': '/comunidad',
    'view-biblio': '/biblio',
    'view-medi': '/medi',
    'view-foro': '/foro',
    'view-profile': '/profile',
    'view-superadmin-dashboard': '/superadmin',
    'view-lactario': '/lactario',
    'view-quejas': '/quejas',
    'view-reportes': '/reportes',
    'view-encuestas': '/encuestas',
    'view-cafeteria': '/cafeteria',
    'view-avisos': '/avisos',
    'view-notificaciones': '/notificaciones',
    'view-encuesta-publica': '/encuesta-publica',
    'view-test-vocacional': '/test-vocacional',
    'view-vocacional-test-active': '/vocacional/test',
    'view-vocacional-admin': '/vocacional-admin'
  };

  function getPathForView(viewId) {
    if (viewId === 'view-aula-course' && window.SIA_currentCourseId) {
      return `/aula/curso/${encodeURIComponent(window.SIA_currentCourseId)}`;
    }
    return routeMap[viewId] || '/dashboard';
  }

  function getCoreRouter() {
    return window.SIA?._router || window.SIA_CORE?.router || null;
  }

  async function restoreCurrentRoute() {
    const router = getCoreRouter();
    if (router && typeof router.handleLocation === 'function') {
      return router.handleLocation();
    }

    return handleLocation();
  }

  function navigate(viewId, pushState = true, skipAuthCheck = false) {
    // [ARCHITECTURE ADAPTER] Delegate to Core Router if available
    const router = getCoreRouter();
    if (router) {
      return router.navigate(viewId, pushState, skipAuthCheck);
    }

    const path = getPathForView(viewId);
    if (pushState) {
      history.pushState({ viewId }, '', path);
    }

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

    if (!window.Encuestas) {
      console.warn("[App] Encuestas module not available yet.", {
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

    // A. Check Admin-launched campaigns
    if (window.Encuestas?.checkAndShowLaunchedSurvey) {
      try {
        const shown = await window.Encuestas.checkAndShowLaunchedSurvey(ctx);
        if (shown) {
          console.log('[App] Launched campaign shown.');
          return;
        }
      } catch (err) {
        console.error('[App] Error checking launched campaigns:', err);
      }
    }

    // B. Check Service Surveys (Triggered)
    const serviceTypes = ['servicio-medico', 'psicologia', 'biblioteca'];
    console.log('[App] 📋 Checking service types:', serviceTypes);

    if (window.EncuestasServicioService && window.Encuestas.checkAndShowServiceSurvey) {
      for (const type of serviceTypes) {
        try {
          const shown = await window.Encuestas.checkAndShowServiceSurvey(type, ctx);
          if (shown) {
            console.log('[App] ✅ Survey shown for:', type);
            return;
          }
        } catch (err) {
          console.error('[App] Error in loop:', err);
        }
      }
    } else {
      console.warn('[App] Service surveys unavailable, continuing with general blocking surveys only.');
    }

    // C. Check General Blocking Surveys
    if (window.Encuestas?.checkAndShowBlockingSurvey) {
      try {
        const shown = await window.Encuestas.checkAndShowBlockingSurvey(ctx);
        if (shown) {
          console.log('[App] ✅ Blocking survey shown.');
          return;
        }
      } catch (err) {
        console.error('[App] Error checking blocking surveys:', err);
      }
    }
  }


  function handleLocation() {
    let path = window.location.pathname;
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      path = window.location.hash.replace('#', '');
    }

    if (isQaSecretRoute(path)) {
      showQaSecretLogin({ resetPassword: false, focus: false });
      return;
    }

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
      // Default / home logic
      if (path === '/' || path === '' || path === '/index.html') {
        // If we have a user logged in, they should go to dashboard.
        // Otherwise, they'll be trapped in index if they are not authenticated (handled by Auth listener later).
        showView('view-dashboard');
      } else {
        showView('view-dashboard');
      }
    }
  }

  // Variable para trackear la vista anterior (para StateManager)
  let _previousView = null;

  function showView(viewId) {
    // Notificar al StateManager sobre el cambio de vista
    ModuleStateManager.onViewChange(_previousView, viewId);

    // Limpiar suscripciones activas
    ModuleManager.clearAll();

    // Limpiar timer de avisos globales al cambiar de vista
    if (typeof clearGlobalAvisosLoop === 'function') clearGlobalAvisosLoop();

    // Permisos públicos: rutas vocacionales accesibles sin importar auth
    if (viewId === 'view-test-vocacional' || viewId === 'view-vocacional-test-active') {
      console.log('[showView] Ruta publica vocacional:', viewId);

      // 1. Ocultar landingView si está visible (usuario no loggeado)
      const _lv = document.querySelector('sia-landing-view') || document.getElementById('landing-view');
      if (_lv) _lv.classList.add('d-none');

      // 2. Ocultar verify-shell si está visible
      const _vs = document.getElementById('verify-shell');
      if (_vs) _vs.classList.add('d-none');

      // 3. Ocultar app-shell si está visible (para no mezclar con la vista pública)
      const _as = document.getElementById('app-shell');
      if (_as) _as.classList.add('d-none');

      // 4. Ocultar otras sia-public-view si están visibles
      document.querySelectorAll('.sia-public-view').forEach(v => v.classList.add('d-none'));

      // 5. Mostrar la vista vocacional pública solicitada
      const _pubTarget = document.getElementById(viewId);
      if (_pubTarget) {
        _pubTarget.classList.remove('d-none');
        console.log('[showView] Vista publica visible:', viewId);

        // Forzar refresh del componente vocacional-landing si no tiene contenido
        if (viewId === 'view-test-vocacional') {
          const landingComp = _pubTarget ? _pubTarget.querySelector('vocacional-landing') : null;
          if (landingComp && typeof landingComp.refresh === 'function') {
            setTimeout(() => landingComp.refresh(), 0);
          }
        }
      } else {
        console.error('[showView] CRITICO: No se encontro el elemento', viewId);
      }

      _previousView = viewId;

      // 6. Si es el test activo, inicializar el componente
      if (viewId === 'view-vocacional-test-active') {
        const testCmp = document.querySelector('vocacional-test');
        if (testCmp) testCmp.initTest(typeof getCtx === 'function' ? getCtx() : {});
      }

      // 7. Actualizar URL hash
      const expectedHash = viewId === 'view-test-vocacional' ? '#/test-vocacional' : '#/vocacional/test';
      if (window.location.hash !== expectedHash) {
        history.pushState({ viewId }, '', expectedHash);
      }

      return; // Saltar middleware de permisos y resto de showView
    }
    // --- ACCESS CONTROL MIDDLEWARE ---
    else if (window.currentUserProfile) {
      const role = currentUserProfile.role || 'student';
      const isProfile = viewId === 'view-profile';
      const isAllowed = isProfile || canAccessViewForProfile(viewId, currentUserProfile);
      /*
      // 1. Validar restricción de acceso (Staff no puede salir de su módulo)


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
      */
      if (!isAllowed && !isProfile) {
        const redirectTarget = getHomeViewForProfile(currentUserProfile);
        console.warn(`[Access] ⛔ Bloqueado acceso a ${viewId} para rol ${role}. Redirigiendo a ${redirectTarget}`);

        if (viewId !== redirectTarget) {
          setTimeout(() => navigate(redirectTarget, true, true), 0);
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
      console.log(`📝 [Scroll] Respetando scroll guardado para ${viewId} (${hasSavedState.scrollPosition}px)`);
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
      const isAulaAdmin = window.SIA?.canTeachInAula ? window.SIA.canTeachInAula(currentUserProfile) : (currentUserProfile?.role === 'aula');
      const isAulaView = viewId === 'view-aula';
      fabAddCourse.classList.toggle('d-none', !(isAulaAdmin && isAulaView));
    }

    const reportBugFab = document.getElementById('btn-report-problem');
    if (reportBugFab) {
      const currentRole = currentUserProfile?.role || 'student';
      const shouldShowBugFab = currentRole !== 'superadmin' && viewId !== 'view-comunidad';
      reportBugFab.classList.toggle('d-none', !shouldShowBugFab);
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

    if (viewId === 'view-dashboard') {
      if (currentUserProfile?.role === 'superadmin') {
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
      }

      // Carga KPIs y lógica estándar del Dashboard
      renderDashboardSurface(currentUserProfile);

    } else {
      // Lógica para vistas estándar
      const target = document.getElementById(viewId);
      if (target) target.classList.remove('d-none');
    }

    updateGlobalTip(viewId);
    rebuildGlobalAvisosData();
    updateBreadcrumbs(viewId, viewId === 'view-aula-course' ? 'Curso' : '');

    if (viewId === 'view-profile') {
      if (typeof Profile !== 'undefined') {
        Profile.init(getCtx());
      }
    }

    if (viewId === 'view-vocacional-test-active') {
      const testCmp = document.querySelector('vocacional-test');
      if (testCmp) {
        testCmp.initTest(getCtx());
      }
    }

    // Special Case module initializations...
    if (viewId === 'view-medi') {
      if (currentUserProfile?.role === 'superadmin') {
        // ...
      } else if (canAdminMedi(currentUserProfile)) {
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

      if (canAdminBiblio(currentUserProfile)) {
        adm?.classList.remove('d-none');
      } else {
        stu?.classList.remove('d-none');
      }
    }

    if (viewId === 'view-vocacional-admin') {
      if (typeof AdminVocacional !== 'undefined') {
        AdminVocacional.init(getCtx());
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
        console.error("❌ [CRITICAL] Quejas module is UNDEFINED. Check script loading.");
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
      } else if (typeof AulaClase !== 'undefined') {
        AulaClase.init(getCtx(), window.SIA_currentCourseId);
      } else {
        const container = document.getElementById('view-aula-course');
        if (container) container.innerHTML = '<div class="alert alert-danger m-4">Error: La vista de clase de Aula no se carg\u00f3 correctamente.</div>';
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
  window.SIA._router = getCoreRouter();
  window.SIA.navigate = navigate;
  window.SIA.navigateFromDrawer = (viewId) => {
    navigate(viewId);
  }
  window.SIA.logout = logout;
  window.SIA.setQaProfileContext = applyQaSessionContext;
  window.SIA.clearQaProfileContext = async (options = {}) => applyQaSessionContext('', options);
  window.SIA.setQaContextActor = setQaSessionActor;
  window.SIA.clearQaContextActor = async (contextKey, options = {}) => setQaSessionActor(contextKey, null, options);
  window.SIA.applyDevProfileSimulation = applyDevProfileSimulation;
  window.SIA.clearDevProfileSimulation = clearDevProfileSimulation;
  window.SIA.isDevProfileActive = () => Boolean(currentUserProfile?.devSimulation?.key);
  window.SIA.getActiveProfile = () => currentUserProfile;
  window.SIA.getBaseProfile = () => readStoredDevBaseProfile() || window.SIA?.baseUserProfile || currentUserProfile;
  window.SIA.getEffectiveSessionUser = getEffectiveSessionUser;
  window.SIA.getEffectiveSessionUid = getEffectiveSessionUid;
  window.SIA.getEffectiveAuth = getEffectiveAuth;
  window.SIA.getQaSecretLoginLink = () => `${window.location.origin}/#${QA_SECRET_LOGIN_CONFIG.route}`;
  // loginConGoogle eliminado - ahora solo usamos Microsoft
  window.SIA.getCtx = getCtx; // Para depuración


  window.SIA.Breadcrumbs = Breadcrumbs;
  window.SIA.setBreadcrumbs = (viewId, options = {}) => Breadcrumbs.setView(viewId, options);
  window.SIA.setBreadcrumbTrail = (viewId, trail, options = {}) => Breadcrumbs.setTrail(viewId, trail, options);
  window.SIA.setBreadcrumbSection = (viewId, section, options = {}) => Breadcrumbs.setSection(viewId, section, options);

  window.SIA.toggleMobileNotifs = () => {
    /* ... implementación existente ... */
  };

  /**
   * Controla la visibilidad de elementos de navegación según el rol.
   * Staff no debe ver Dashboard global ni selector de módulos.
   */
  function updateMenuVisibility(profileOrRole) {
    const profile = typeof profileOrRole === 'object' ? profileOrRole : currentUserProfile;
    const role = typeof profileOrRole === 'string' ? profileOrRole : (profile?.role || '');
    const isStaff = isAdminWorkspaceProfile(profile);

    // --- NEW LOGIC FOR ENTIRE NAVBARS ---
    const studentNavDt = document.getElementById('student-navbar-dt');
    const adminNavDt = document.getElementById('admin-navbar-dt');
    const studentNavMob = document.getElementById('student-bottom-nav');
    const adminNavMob = document.getElementById('admin-bottom-nav');

    if (isStaff) {
      if (studentNavDt) studentNavDt.classList.remove('d-md-block'); // Hides student dt
      if (adminNavDt) adminNavDt.classList.add('d-md-block'); // Shows admin dt
      if (studentNavMob) studentNavMob.classList.add('d-none'); // Hides student mob
      if (adminNavMob) adminNavMob.classList.remove('d-none'); // Shows admin mob
    } else {
      if (studentNavDt) studentNavDt.classList.add('d-md-block'); // Shows student dt
      if (adminNavDt) adminNavDt.classList.remove('d-md-block'); // Hides admin dt
      if (studentNavMob) studentNavMob.classList.remove('d-none'); // Shows student mob
      if (adminNavMob) adminNavMob.classList.add('d-none'); // Hides admin mob
    }

    // 1. Mobile Nav Items (within student's auth context logically, harmless if preserved)
    const mobileHome = document.getElementById('nav-mobile-home');
    const mobileModules = document.getElementById('nav-mobile-modules');

    if (mobileHome) mobileHome.classList.toggle('d-none', isStaff);
    if (mobileModules) mobileModules.classList.toggle('d-none', isStaff);

    // 2. Desktop Brand Link (Logotipo SIA)
    const brandLink = document.getElementById('btn-brand-home-v2');
    if (brandLink) {
      // Remover listeners previos (clonando) para limpiar comportamiento
      const newBrand = brandLink.cloneNode(true);
      brandLink.parentNode.replaceChild(newBrand, brandLink);

      if (isStaff) {
        const homeView = getHomeViewForProfile(profile);
        newBrand.onclick = (e) => {
          e.preventDefault();
          navigate(homeView, true, true);
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




  function getDashboardSurface(profile = currentUserProfile) {
    if (!profile) return 'standard';
    if (profile.role === 'superadmin') return 'superadmin';



    // Función helper para conteos optimizados
    const effectiveViews = getEffectiveAllowedViews(profile);
    if (isAdminWorkspaceProfile(profile) && effectiveViews.length > 1) {
      return 'department';
    }

    return 'standard';
  }

  function shouldUseStandardDashboard(profile = currentUserProfile) {
    return getDashboardSurface(profile) === 'standard'
      && canAccessViewForProfile('view-dashboard', profile);
  }

  function renderDashboardSurface(profile = currentUserProfile) {
    const surface = getDashboardSurface(profile);
    const dashStandard = document.getElementById('view-dashboard');
    const dashSuper = document.getElementById('view-superadmin-dashboard');
    const dashDept = document.getElementById('view-department-dashboard');

    if (dashStandard) dashStandard.classList.toggle('d-none', surface !== 'standard');
    if (dashSuper) dashSuper.classList.toggle('d-none', surface !== 'superadmin');
    if (dashDept) dashDept.classList.toggle('d-none', surface !== 'department');

    if (surface === 'department') {
      renderDepartmentDashboard(profile);
    }

    return surface;
  }

  function loadDashboard() {
    return renderDashboardSurface(currentUserProfile);
  }

  /* Legacy dashboard loader retired.
    const getCount = async (coll, customQuery) => {
      try {
        const query = customQuery || SIA.db.collection(coll);
        const snap = await query.count().get();
        return snap.data().count;
      } catch (e) {
        const query = customQuery || SIA.db.collection(coll);
        const snap = await query.get();
        return snap.size;
      }
    };

    // --- 1. LÓGICA SUPER ADMIN ---
    if (currentUserProfile.role === 'superadmin') {
      const dashStandard = document.getElementById('view-dashboard');
      const dashSuper = document.getElementById('view-superadmin-dashboard');
      const dashDept = document.getElementById('view-department-dashboard');

      if (dashStandard) dashStandard.classList.add('d-none');
      if (dashDept) dashDept.classList.add('d-none');
      if (dashSuper) dashSuper.classList.remove('d-none');

      try {

        const [tUsers, tCursos, tMedi, tPrestamos, tInsc, tProg] = await Promise.all([
          getCount('usuarios'),
          getCount('aula-cursos'),
          getCount('medi-consultas'),
          getCount('prestamos-biblio', SIA.db.collection('prestamos-biblio').where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado'])),
          getCount('aula-inscripciones'),
          getCount('aula-progress', SIA.db.collection('aula-progress').where('progressPct', '>=', 100))
        ]);

        if (document.getElementById('sa-total-users'))
          document.getElementById('sa-total-users').textContent = tUsers;

        if (document.getElementById('sa-kpi-aula'))
          document.getElementById('sa-kpi-aula').textContent = tCursos;

        if (document.getElementById('sa-kpi-medi'))
          document.getElementById('sa-kpi-medi').textContent = tMedi;

        if (document.getElementById('sa-kpi-biblio'))
          document.getElementById('sa-kpi-biblio').textContent = tPrestamos;

        const rate = tInsc > 0 ? Math.round((tProg / tInsc) * 100) : 0;
        if (document.getElementById('sa-rate-aula'))
          document.getElementById('sa-rate-aula').textContent = `${rate}%`;

      } catch (e) {
        console.error("Error cargando SuperAdmin Dashboard", e);
      }
      return;
    }

    // --- 1.5 LÓ“GICA DASHBOARD DEPARTAMENTAL ---
    // Si tiene allowedViews y NO es estudiante (o un rol que forza estudiante), y tiene más de 1 vista permitida
    const effectiveViews = getEffectiveAllowedViews(currentUserProfile);
    if (isAdminWorkspaceProfile(currentUserProfile) && effectiveViews.length > 1) {

      console.log("[Dashboard] 🏢 Renderizando Dashboard Departamental para:", currentUserProfile.role);

      const dashStandard = document.getElementById('view-dashboard');
      const dashSuper = document.getElementById('view-superadmin-dashboard');
      const dashDept = document.getElementById('view-department-dashboard');

      if (dashStandard) dashStandard.classList.add('d-none');
      if (dashSuper) dashSuper.classList.add('d-none');
      if (dashDept) dashDept.classList.remove('d-none');

      renderDepartmentDashboard(currentUserProfile);
      return;
    }

    // --- 2. LÓ“GICA ESTÓNDAR (Estudiante / Admin Módulo Óšnico) ---
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
      if (canAdminMedi(currentUserProfile)) {
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
      if (canAdminBiblio(currentUserProfile)) {
        biblioCount = await getCount('prestamos-biblio', SIA.db.collection('prestamos-biblio').where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado']));
      } else {
        const s4 = await SIA.db.collection('prestamos-biblio').where('studentId', '==', user.uid).where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado']).get();
        biblioCount = s4.size;
      }
      if (biblioBadge) biblioBadge.textContent = biblioCount === 1 ? '1 Activo' : `${biblioCount} Activos`;

      // AULA COUNT (usa colecciones actuales: aula-clases / aula-miembros)
      let aulaCount = 0;
      if (window.SIA?.canTeachInAula ? window.SIA.canTeachInAula(currentUserProfile) : (currentUserProfile.role === 'aula' || currentUserProfile.role === 'aula_admin')) {
        aulaCount = await getCount('aula-clases', SIA.db.collection('aula-clases').where('archivada', '==', false));
      } else {
        aulaCount = await getCount('aula-miembros', SIA.db.collection('aula-miembros').where('userId', '==', user.uid));
      }
      if (aulaBadge) aulaBadge.textContent = `${aulaCount} ${aulaCount === 1 ? 'Clase' : 'Clases'}`;
      if (headerCursos) headerCursos.textContent = aulaCount;



      // --- 4. WIDGETS DINÓMICOS COMPACTOS ---

      // A) CITAS PRÓ“XIMAS (Renderizado Ultra-Compacto)
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
              <div class="d-flex align-items-center gap-2 mb-2 p-2 rounded-3  border-start border-3 ${color}">
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

  */

  // history.replaceState({ viewId: 'landing' }, '', '/'); // ELIMINADO: Rompe la navegación por hash directo (ej: #/test-vocacional)

  let lastModuleVisited = localStorage.getItem('sia_last_module_view') || null;
  const MOBILE_MODULE_VIEWS = new Set([
    'view-aula',
    'view-comunidad',
    'view-medi',
    'view-biblio',
    'view-foro',
    'view-quejas',
    'view-encuestas',
    'view-lactario',
    'view-cafeteria'
  ]);

  function updateMobileNavState(viewId) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));

    const homeBtn = document.getElementById('nav-mobile-home');
    const modulesBtn = document.getElementById('nav-mobile-modules');
    const notifBtn = document.getElementById('nav-mobile-notifications');
    const profileBtn = document.getElementById('nav-mobile-profile');

    if (viewId === 'view-dashboard') {
      homeBtn?.classList.add('active');
    } else if (viewId === 'view-profile') {
      profileBtn?.classList.add('active');
    } else if (viewId === 'view-notificaciones') {
      notifBtn?.classList.add('active');
    } else if (MOBILE_MODULE_VIEWS.has(viewId)) {
      modulesBtn?.classList.add('active');
      lastModuleVisited = viewId;
      localStorage.setItem('sia_last_module_view', viewId);
    }

    if (window.updateModuleNavIcon) {
      if (MOBILE_MODULE_VIEWS.has(viewId)) {
        window.updateModuleNavIcon(viewId);
      } else {
        window.updateModuleNavIcon('view-dashboard');
      }
    }
  }

  function updateModuleButtonUI_UNUSED(viewId, isActive = false) {
    const btn = document.getElementById('nav-mobile-modules');
    const text = btn?.querySelector('span');
    if (!btn) return;

    btn.classList.toggle('active', Boolean(isActive));

    if (text) text.textContent = 'Modulos';
    if (window.updateModuleNavIcon) {
      if (MOBILE_MODULE_VIEWS.has(viewId)) window.updateModuleNavIcon(viewId);
      else window.updateModuleNavIcon('view-dashboard');
    } else {
      text.textContent = 'Módulos';
    }
  }

  window.SIA.handleMobileModuleClick = () => {

    if (lastModuleVisited && lastModuleVisited !== window.SIA_currentView) {
      navigate(lastModuleVisited);
      return;
    }

    window.SIA?.toggleModulesDrawer?.();
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
        console.log('❌ Usuario rechazó instalar la PWA');
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
              <li>Toca el menú <strong>⋮</strong> (tres puntos)</li>
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
    // Update dynamic icon
    if (e.detail && e.detail.viewId && window.updateModuleNavIcon) {
      window.updateModuleNavIcon(e.detail.viewId);
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

  // Helper for dynamic module icon
  window.updateModuleNavIcon = function (viewId) {
    const iconEl = document.getElementById('nav-mobile-modules-icon');
    if (!iconEl) return;

    const iconMap = {
      'view-aula': 'aula.ico',
      'view-comunidad': 'images/comunidad.png',
      'view-medi': 'medi.ico',
      'view-biblio': 'biblio.ico',
      'view-foro': 'foro.ico',
      'view-cafeteria': 'sia.ico',
      'view-lactario': 'lactario.ico',
      'view-quejas': 'quejas.ico',
      'view-encuestas': 'encuestas.ico',
      'view-profile': 'perfil.ico'
    };

    if (iconMap[viewId]) {
      iconEl.src = iconMap[viewId].includes('/') ? iconMap[viewId] : `assets/icons/${iconMap[viewId]}`;
      // Save last module
      localStorage.setItem('sia_last_module_view', viewId);
    } else if (viewId === 'view-dashboard') {
      // Restoring on dashboard return if available
      const last = localStorage.getItem('sia_last_module_view');
      if (last && iconMap[last]) {
        iconEl.src = `assets/icons/${iconMap[last]}`;
      } else {
        iconEl.src = 'assets/icons/aula.ico';
      }
    }
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
      updateMobileNavState(Store.currentView || 'view-dashboard');
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

    const allowedViews = getEffectiveAllowedViews(currentUserProfile);

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
        id: 'comunidad',
        view: 'view-comunidad',
        label: 'Comunidad',
        icon: 'people-fill',
        color: 'success',
        category: 'comunidad',
        description: 'Feed social del campus'
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
    const visibleModules = allModules.filter(m => {
      if (m.view === 'view-profile') return true;
      return allowedViews.some(av => av === m.view || m.view.startsWith(av));
    });

    // Renderizar
    let html = '';

    visibleModules.forEach(m => {
      const iconMap = {
        'aula': 'aula.png',
        'comunidad': 'comunidad.png',
        'medi': 'medi.png',
        'biblio': 'biblio.png',
        'foro': 'foro.png',
        'lactario': 'lactario.png',
        'quejas': 'quejas.png',
        'encuestas': 'encuestas.png',
        'vocacional': 'vocacional.png',
        'profile': 'perfil.png'
      };

      let iconHtml = `<i class="bi bi-${m.icon}"></i>`;

      if (iconMap[m.id]) {
        iconHtml = `<img src="images/${iconMap[m.id]}" alt="${m.label}" style="width: 42px; height: 42px; object-fit: contain;">`;
      }

      html += `
        <div class="d-flex flex-column align-items-center flex-shrink-0" 
             style="width: 80px; scroll-snap-align: start; cursor: pointer;"
             onclick="window.SIA.navigate('${m.view}'); window.SIA.toggleModulesDrawer();">
          <div class="bg-light rounded-4 shadow-sm d-flex align-items-center justify-content-center mb-2 position-relative" 
               style="width: 60px; height: 60px; overflow: hidden;">
            ${iconHtml}
            <div class="position-absolute bottom-0 w-100" style="height: 4px; background-color: var(--bs-${m.color});"></div>
          </div>
          <span class="fw-bold text-center text-wrap w-100 lh-sm" style="color: var(--text-heading); font-size: 0.65rem;">${m.label}</span>
        </div>
      `;
    });

    if (html === '') {
      html = '<div class="text-center py-5 text-muted small w-100">No hay módulos disponibles</div>';
    }

    drawerBody.innerHTML = html;
  }

  // 3. Notifications View Logic — navega al Centro de Notificaciones
  window.SIA.toggleNotificationsView = function () {
    // Navegar a la vista del Centro de Notificaciones completo (mobile-first)
    if (window.SIA._router) {
      window.SIA._router.navigate('view-notificaciones');
    } else if (window.SIA.navigate) {
      window.SIA.navigate('view-notificaciones');
    } else {
      // Fallback: abrir el drawer antiguo si el router no está listo
      const drawer = document.getElementById('sia-notifications-drawer');
      if (!drawer) return;
      if (drawer.classList.contains('d-none')) {
        drawer.classList.remove('d-none');
        toggleBodyScroll(true);
      } else {
        drawer.classList.add('d-none');
        toggleBodyScroll(false);
      }
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
  // Removido por peticion del usuario para evitar conflictos con el scroll nativo.
  // Refresco de pagina delegada al comportamiento standar del navegador.

  window.toggleDarkMode = function () {
    const inputs = document.querySelectorAll('#switch-dark-mode-notifs');
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    if (typeof window.applyTheme === 'function') {
      window.applyTheme(nextTheme);
    } else {
      document.documentElement.setAttribute('data-bs-theme', nextTheme);
      localStorage.setItem(THEME_KEY_LOCAL, nextTheme);
    }

    inputs.forEach(i => i.checked = nextTheme === 'dark');
  };

  // 4. Global Avisos / Stories Logic
  window.openGlobalAvisosModal = openGlobalAvisosModal;

  // Stories Data - Real Encuestas Integration
  // No more mock data - stories are populated from active surveys

  let _dashboardStoriesRenderVersion = 0;

  function _canCommitDashboardStoriesRender(renderVersion, container) {
    return renderVersion === _dashboardStoriesRenderVersion
      && !!container
      && container.isConnected
      && document.getElementById('dashboard-stories-wrapper') === container;
  }

  function _dedupeDashboardStories(stories) {
    const seenStoryIds = new Set();
    return (Array.isArray(stories) ? stories : []).filter((story) => {
      const storyId = _getStoryStorageId(story);
      if (seenStoryIds.has(storyId)) return false;
      seenStoryIds.add(storyId);
      return true;
    });
  }

  async function renderDashboardStories() {
    const renderVersion = ++_dashboardStoriesRenderVersion;
    const container = document.getElementById('dashboard-stories-wrapper');
    if (!container) return;

    container.innerHTML = '';

    if (!currentUserProfile) {
      if (_canCommitDashboardStoriesRender(renderVersion, container)) {
        _showNoNewsPlaceholder(container);
      }
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

    if (!_canCommitDashboardStoriesRender(renderVersion, container)) return;

    try {
      const baseCtx = getCtx();
      const ctx = {
        ...baseCtx,
        user: baseCtx.auth?.currentUser || null,
        profile: baseCtx.currentUserProfile || currentUserProfile
      };
      if (!ctx.user) {
        if (_canCommitDashboardStoriesRender(renderVersion, container)) {
          _showNoNewsPlaceholder(container);
        }
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

      if (!_canCommitDashboardStoriesRender(renderVersion, container)) return;

      // Merge: encuestas + foro events + avisos como stories unificadas
      const allStories = _dedupeDashboardStories([
        ...allSurveys.map(s => ({ ...s, _source: 'encuesta' })),
        ...foroEvents.map(e => ({ ...e, _source: 'foro' })),
        ...avisosStories.map(a => ({ ...a, _source: 'aviso' }))
      ]);

      // Ordenar: nuevos primero (por createdAt descendente)
      allStories.sort((a, b) => {
        const priorityRank = (item) => item?.priority === 'urgent' ? 0 : item?._source === 'encuesta' && !item?.responded ? 1 : 2;
        const prDiff = priorityRank(a) - priorityRank(b);
        if (prDiff !== 0) return prDiff;
        const getTime = (item) => {
          const d = item.createdAt;
          if (!d) return 0;
          if (d.toDate) return d.toDate().getTime();
          if (d instanceof Date) return d.getTime();
          return new Date(d).getTime();
        };
        return getTime(b) - getTime(a);
      });

      if (!_canCommitDashboardStoriesRender(renderVersion, container)) return;

      _dashStats.stories = allStories.map((story) => ({
        id: _getStoryStorageId(story),
        title: story.title || '',
        source: story._source || 'general'
      }));
      _dashState.stories = _dashStats.stories;
      _updateStoriesMeta(allStories);

      if (allStories.length === 0) {
        _showNoNewsPlaceholder(container);
        return;
      }

      const seenKey = 'sia_stories_seen';
      const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
      const savedStories = new Set(_getSavedStoryIds());

      allStories.forEach((story, storyIdx) => {
        const storyStorageId = _getStoryStorageId(story);
        const storyMeta = _getStoryMeta(story);
        const isSaved = savedStories.has(storyStorageId);
        const isSeen = story._source === 'aviso'
          ? !!window.AvisosService?.hasSeenLocal?.(ctx, story.id)
          : !!seen[story.id];
        const div = document.createElement('div');
        // C1-06: Seen stories get reduced opacity instead of disappearing
        div.className = `story-item text-center animate-fade-in${isSeen ? ' story-item-seen' : ''}`;
        div.style.animationDelay = `${storyIdx * 60}ms`;

        if (story._source === 'encuesta') {
          // --- Encuesta story --- C1-06: Use survey-specific ring color
          const isResponded = !!story.responded;
          const ringActive = !isSeen && !isResponded;
          const ringClass = ringActive ? 'story-ring story-ring-survey active' : 'story-ring';
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
            <span class="story-label">${_escStoryTitle(story.title)}</span>`;

        } else if (story._source === 'aviso') {
          // --- Aviso story (con imagen thumbnail si existe) ---
          const ringActive = !isSeen;
          // C1-06: Urgent avisos pulse
          const urgentClass = story.priority === 'urgent' ? ' story-ring-urgent' : '';
          const ringClass = ringActive ? `story-ring aviso-ring active${urgentClass}` : 'story-ring aviso-ring';
          const hasImage = !!(story.imageUrl && story.imageUrl.trim());
          const iconClass = story.type === 'image' ? 'bi-image-fill' : 'bi-megaphone-fill';
          const bgClass = story.priority === 'urgent' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success';

          div.onclick = () => {
            window.AvisosService?.markSeenLocal?.(ctx, story.id);
            _openAvisoStoryPreviewModal(story, ctx);
            const ring = div.querySelector('.story-ring');
            if (ring) ring.classList.remove('active');
          };

          // Si el aviso tiene imagen, mostrarla como thumbnail en el circulo
          const circleContent = hasImage
            ? `<img src="${story.imageUrl}" alt="" class="story-thumb-img" loading="lazy">`
            : `<i class="bi ${iconClass}"></i>`;
          const circleClass = hasImage
            ? 'story-circle story-circle--has-img'
            : `story-circle ${bgClass} d-flex align-items-center justify-content-center`;

          div.innerHTML = `
            <div class="${ringClass} mb-1">
              <div class="${circleClass} d-flex align-items-center justify-content-center">
                ${circleContent}
              </div>
            </div>
            <span class="story-label">${_escStoryTitle(story.title)}</span>`;

        } else {
          // --- Foro event story --- C1-06: Use event-specific ring color
          const isRegistered = !!story.registered;
          const ringActive = !isSeen && !isRegistered;
          const ringClass = ringActive ? 'story-ring story-ring-event active' : 'story-ring';
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
            <span class="story-label">${_escStoryTitle(story.title)}</span>`;
        }

        const metaChip = document.createElement('span');
        metaChip.className = storyMeta.className;
        metaChip.textContent = storyMeta.label;
        div.appendChild(metaChip);

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = `story-save-btn${isSaved ? ' is-saved' : ''}`;
        saveBtn.title = isSaved ? 'Quitar de guardadas' : 'Guardar para despues';
        saveBtn.innerHTML = `<i class="bi ${isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>`;
        saveBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await window.SIA.toggleSavedDashboardStory(storyStorageId);
        });
        div.appendChild(saveBtn);

        container.appendChild(div);
      });
    } catch (e) {
      if (!_canCommitDashboardStoriesRender(renderVersion, container)) return;
      console.warn('[Stories] Error loading stories:', e);
      _showNoNewsPlaceholder(container);
    }
  }

  // Helper: escapar titulo de story para HTML
  function _escStoryTitle(title) {
    if (!title) return '';
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(String(title));
    return String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _getStoryStorageId(story) {
    return `${story?._source || 'story'}:${story?.id || 'na'}`;
  }

  function _getStoryMeta(story) {
    if (story?._source === 'encuesta') {
      return {
        label: story?.responded ? 'Contestada' : 'Encuesta',
        className: story?.responded ? 'story-meta-chip story-meta-chip--ok' : 'story-meta-chip story-meta-chip--info'
      };
    }
    if (story?._source === 'foro') {
      return {
        label: story?.registered ? 'Inscrito' : 'Evento',
        className: story?.registered ? 'story-meta-chip story-meta-chip--primary' : 'story-meta-chip story-meta-chip--warn'
      };
    }
    const priority = story?.priority === 'urgent' ? 'Urgente' : 'Aviso';
    return {
      label: priority,
      className: story?.priority === 'urgent' ? 'story-meta-chip story-meta-chip--danger' : 'story-meta-chip story-meta-chip--success'
    };
  }

  function _updateStoriesMeta(stories) {
    const metaEl = document.getElementById('dash-stories-meta');
    if (!metaEl) return;
    const savedCount = _getSavedStoryIds().length;
    const total = Array.isArray(stories) ? stories.length : 0;
    metaEl.textContent = savedCount > 0 ? `${savedCount} guardada${savedCount === 1 ? '' : 's'}` : `${total} novedad${total === 1 ? '' : 'es'}`;
  }

  function _showNoNewsPlaceholder(container) {
    _updateStoriesMeta([]);
    container.innerHTML = `
      <div class="d-flex align-items-center justify-content-center w-100 py-3 text-muted flex-column animate-fade-in text-center" style="opacity:0.7;">
        <i class="bi bi-inbox fs-2 mb-2" style="color: var(--bs-secondary-bg);"></i>
        <span class="small fw-bold">Estás al día</span>
        <span class="extra-small">No hay avisos ni encuestas nuevas por el momento.</span>
      </div>`;
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
        <i class="bi bi-calendar-event me-1"></i>Ir a Eventos</button>
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
        <h6 class="fw-bold mb-0"><i class="bi bi-clipboard-data me-2"></i>${_escStoryTitle(survey.title)}</h6>
        <span class="extra-small text-muted">${createdDate}${questionCount ? ' · ' + questionCount + ' preguntas' : ''}</span>
      </div>
      <button class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body p-4" id="story-preview-body">
      ${survey.description ? `<p class="text-muted small mb-3">${_escStoryTitle(survey.description)}</p>` : ''}
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
              await EncuestasService.submitResponse(ctx, survey.id, answers, { source: 'story' });
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
          <label class="form-check-label" for="${prefix}_${q.id}_${j}">${_escStoryTitle(o)}</label></div>`).join('');
      } else if (q.type === 'boolean') {
        input = `<div class="d-flex gap-3">
          <div class="form-check"><input class="form-check-input" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_t" value="true"><label class="form-check-label" for="${prefix}_${q.id}_t">Verdadero</label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="${prefix}_${q.id}" id="${prefix}_${q.id}_f" value="false"><label class="form-check-label" for="${prefix}_${q.id}_f">Falso</label></div></div>`;
      } else if (q.type === 'scale') {
        const min = q.min || 1, max = q.max || 10;
        const steps = [];
        for (let v = min; v <= max; v++) {
          steps.push(`<button type="button" class="btn btn-outline-primary btn-sm scale-btn rounded-pill px-2 py-1" data-val="${v}" onclick="this.parentNode.querySelectorAll('.scale-btn').forEach(b=>b.classList.remove('btn-primary','active'));this.classList.add('btn-primary','active');this.classList.remove('btn-outline-primary');document.getElementById('${prefix}_${q.id}_input').value=${v};document.getElementById('${prefix}_${q.id}_val').textContent=${v}">${v}</button>`);
        }
        input = `<input type="hidden" id="${prefix}_${q.id}_input" value="">
          <div class="d-flex flex-wrap gap-1 mb-1">${steps.join('')}</div>
          <div class="text-center"><span class="badge bg-primary rounded-pill" id="${prefix}_${q.id}_val">Sin seleccionar</span></div>`;
      } else {
        input = `<textarea class="form-control rounded-3" id="${prefix}_${q.id}_input" rows="2" placeholder="Escribe tu respuesta..."></textarea>`;
      }
      return `<div class="mb-4 pb-3 ${i < questions.length - 1 ? 'border-bottom' : ''}" data-qid="${q.id}">
        <div class="d-flex align-items-start mb-2"><span class="badge bg-primary rounded-circle me-2" style="width:28px;height:28px;line-height:20px">${i + 1}</span>
        <div><p class="fw-bold mb-1">${_escStoryTitle(q.text)}${q.required ? ' <span class="text-danger">*</span>' : ''}</p></div></div>${input}</div>`;
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
        if (!el || el.value === '') {
          if (q.required) valid = false;
        } else {
          answers[q.id] = Number(el.value);
        }
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
  // ── Dashboard Stats Cache (shared between updateSmartCards & summary banner) ──
  const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000;
  let _dashboardDataRenderVersion = 0;
  const DASH_SCOPE_OPTIONS = new Set(['today', 'week', 'all']);
  const DASH_SCOPE_LABELS = { today: 'hoy', week: 'esta semana', all: 'todo' };
  const DASH_SEVERITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const DASH_MODULE_META = {
    dashboard: { label: 'Dashboard', viewId: 'view-dashboard', icon: 'bi-bullseye' },
    medi: { label: 'Medi', viewId: 'view-medi', icon: 'bi-heart-pulse-fill' },
    biblio: { label: 'Biblioteca', viewId: 'view-biblio', icon: 'bi-book-half' },
    aula: { label: 'Aula', viewId: 'view-aula', icon: 'bi-mortarboard-fill' },
    comunidad: { label: 'Comunidad', viewId: 'view-comunidad', icon: 'bi-people-fill' },
    foro: { label: 'Eventos', viewId: 'view-foro', icon: 'bi-calendar-event' },
    avisos: { label: 'Novedades', viewId: 'view-avisos', icon: 'bi-megaphone-fill' },
    quejas: { label: 'Quejas', viewId: 'view-quejas', icon: 'bi-chat-heart' },
    encuestas: { label: 'Encuestas', viewId: 'view-encuestas', icon: 'bi-clipboard-check' },
    cafeteria: { label: 'Cafeteria', viewId: 'view-cafeteria', icon: 'bi-cup-hot-fill' }
  };

  function _createEmptyDashboardStats() {
    return {
      citas: 0,
      citaHoy: null,
      libros: 0,
      libroUrgente: null,
      encuestas: 0,
      quejas: 0,
      aulaProgress: null,
      aulaCount: 0,
      aulaCompleted: 0,
      aulaCerts: 0,
      aulaPendingTasks: 0,
      aulaNextDeadline: null,
      aulaTrend: null,
      aulaRisk: 'Estable',
      taskCenter: [],
      recentActivity: [],
      events: [],
      stories: []
    };
  }

  function _createEmptyDashboardState(scope) {
    return {
      scope: _normalizeDashboardScope(scope || _getDashboardPrefs()?.defaultScope || 'week'),
      visibleEvents: [],
      taskCenter: [],
      recentActivity: [],
      stories: []
    };
  }

  let _dashStats = _createEmptyDashboardStats();
  let _dashState = _createEmptyDashboardState();

  const _fetchWithTimeout = (promise, ms = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  };

  function _escapeDashHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _dashToDate(value) {
    if (!value) return null;
    if (value.toDate) {
      const date = value.toDate();
      return Number.isNaN(date?.getTime?.()) ? null : date;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function _dashFormatShortDate(value, includeTime) {
    const date = _dashToDate(value);
    if (!date) return '';
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
    });
  }

  function _dashRelativeDateLabel(value) {
    const date = _dashToDate(value);
    if (!date) return '';
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTarget = new Date(date);
    startTarget.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((startTarget.getTime() - startToday.getTime()) / 86400000);
    if (dayDiff === 0) return 'Hoy';
    if (dayDiff === 1) return 'Manana';
    if (dayDiff > 1) return `En ${dayDiff} dias`;
    if (dayDiff === -1) return 'Ayer';
    return `Hace ${Math.abs(dayDiff)} dias`;
  }

  function _getDashboardPrefs() {
    return currentUserProfile?.prefs?.dashboard || currentUserProfile?.preferences?.dashboard || {};
  }

  function _normalizeDashboardScope(scope) {
    return DASH_SCOPE_OPTIONS.has(scope) ? scope : 'week';
  }

  function _getDashboardScopeEnd(scope) {
    const now = new Date();
    const normalized = _normalizeDashboardScope(scope);
    if (normalized === 'today') {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    if (normalized === 'week') {
      return new Date(now.getTime() + 7 * 86400000);
    }
    return new Date(now.getTime() + 30 * 86400000);
  }

  function _getDashboardCacheKey(uid) {
    return uid ? `sia_dashboard_cache_${uid}` : null;
  }

  function _canCommitDashboardDataRender(renderVersion, uid) {
    return renderVersion === _dashboardDataRenderVersion
      && !!uid
      && uid === getEffectiveSessionUid(currentUserProfile);
  }

  function _canCommitDashboardActivityRender(renderVersion, uid, container) {
    return _canCommitDashboardDataRender(renderVersion, uid)
      && !!container
      && container.isConnected
      && document.getElementById('dash-activity-strip') === container;
  }

  function _setDashboardStatusText(id, text, className = 'extra-small text-muted mb-0', color = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = className;
    el.style.color = color || '';
  }

  function _setDashboardDotState(id, dotClassName) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!dotClassName) {
      el.className = 'status-dot bg-secondary d-none';
      return;
    }
    el.className = `status-dot ${dotClassName}`;
    el.classList.remove('d-none');
  }

  function _renderDashboardCardPlaceholders() {
    _setDashboardStatusText('smart-card-medi-status', 'Consultando citas...');
    _setDashboardStatusText('smart-card-biblio-status', 'Consultando prestamos...');
    _setDashboardStatusText('smart-card-aula-status', 'Consultando cursos...');
    _setDashboardStatusText('smart-card-foro-status', 'Consultando eventos...');
    _setDashboardStatusText('smart-card-quejas-status', 'Consultando buzon...');
    _setDashboardStatusText('smart-card-encuestas-status', 'Consultando encuestas...');
    _setDashboardDotState('smart-dot-medi', null);
    _setDashboardDotState('smart-dot-biblio', null);
    _setDashboardDotState('smart-dot-foro', null);
    _setDashboardDotState('smart-dot-quejas', null);
    _setDashboardDotState('smart-dot-encuestas', null);
    document.getElementById('smart-card-aula-progress-wrap')?.classList.add('d-none');
  }

  function _renderEmptyActivityStrip() {
    const strip = document.getElementById('dash-activity-strip');
    if (!strip) return;
    strip.innerHTML = Array.from({ length: 7 }).map(() => `
      <div class="activity-day-card skeleton-loader flex-fill rounded-4 d-flex flex-column justify-content-center align-items-center"
           style="height: 65px; border: 2px solid rgba(0,0,0,0.15); background: linear-gradient(135deg, rgba(230,230,230,0.4), rgba(200,200,200,0.2));">
        <div style="width: 25px; height: 12px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 4px;"></div>
        <div style="width: 30px; height: 18px; background: rgba(0,0,0,0.2); border-radius: 4px;"></div>
      </div>`).join('');
  }

  function _resetStudentDashboardState(options = {}) {
    _dashboardDataRenderVersion++;
    _dashStats = _createEmptyDashboardStats();
    _dashState = _createEmptyDashboardState(options.scope);

    if (options.clearFreshness) {
      window._dashLastRefresh = 0;
      const freshEl = document.getElementById('dash-data-freshness');
      if (freshEl) {
        freshEl.textContent = '';
        freshEl.classList.add('d-none');
      }
      const syncChip = document.getElementById('dash-header-sync');
      if (syncChip) syncChip.textContent = '';
    }

    if (options.clearDom) {
      _renderDashboardCardPlaceholders();
      _renderEmptyActivityStrip();
      _renderDashboardFromState();
    }
  }

  window.SIA.resetStudentDashboardState = function (options = {}) {
    _resetStudentDashboardState(options);
  };

  async function _loadStudentAulaTasks(ctx, uid, clases, options = {}) {
    const classList = (Array.isArray(clases) ? clases : []).filter((clase) => clase?.id);
    if (!uid || !classList.length || !window.AulaService?.getPublicaciones) {
      return { tasks: [], classTitleMap: {} };
    }

    const submittedIds = new Set((options.portfolio?.entregas || [])
      .map((entrega) => entrega?.publicacionId)
      .filter(Boolean));
    const dueStart = options.dueStart ? _dashToDate(options.dueStart) : null;
    const dueEnd = options.dueEnd ? _dashToDate(options.dueEnd) : null;
    const publicationLimit = Number(options.publicationLimit) || 30;
    const classTitleMap = {};

    classList.forEach((clase) => {
      classTitleMap[clase.id] = clase.titulo || clase.claseTitulo || 'Clase';
    });

    const taskBuckets = await Promise.all(classList.map(async (clase) => {
      try {
        const [miGrupo, publicaciones] = await Promise.all([
          window.AulaService?.getMiGrupo
            ? _fetchWithTimeout(AulaService.getMiGrupo(ctx, clase.id, uid), 5000).catch(() => null)
            : Promise.resolve(null),
          _fetchWithTimeout(AulaService.getPublicaciones(ctx, clase.id, 'tarea', publicationLimit), 7000).catch(() => [])
        ]);

        return (Array.isArray(publicaciones) ? publicaciones : [])
          .map((pub) => {
            if (pub.grupoId && pub.grupoId !== miGrupo?.id) return null;
            const dueAt = _dashToDate(pub.fechaEntrega);
            if (!dueAt) return null;
            if (dueStart && dueAt < dueStart) return null;
            if (dueEnd && dueAt > dueEnd) return null;
            const isSubmitted = submittedIds.has(pub.id);
            if (options.onlyPending && isSubmitted) return null;
            return {
              id: pub.id,
              claseId: clase.id,
              claseTitle: classTitleMap[clase.id],
              titulo: pub.titulo || 'Entrega',
              dueAt,
              createdAt: _dashToDate(pub.createdAt),
              submitted: isSubmitted
            };
          })
          .filter(Boolean);
      } catch (err) {
        console.warn('[Dashboard] Aula tasks skipped class:', clase.id, err?.code || err?.message || err);
        return [];
      }
    }));

    const tasks = taskBuckets
      .flat()
      .sort((a, b) => {
        const byDue = (a.dueAt?.getTime?.() || 0) - (b.dueAt?.getTime?.() || 0);
        if (byDue !== 0) return byDue;
        return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      });

    return { tasks, classTitleMap };
  }

  function _getSavedStoryIds() {
    const ids = _getDashboardPrefs()?.savedStoryIds;
    return Array.isArray(ids) ? ids : [];
  }

  function _getInterestedEventIds() {
    const ids = _getDashboardPrefs()?.interestedEventIds;
    return Array.isArray(ids) ? ids : [];
  }

  function _getDashboardFavoriteModules() {
    const ids = _getDashboardPrefs()?.favoriteModules;
    return Array.isArray(ids) ? ids : [];
  }

  function _getDashboardSemesterGoals() {
    const rawGoals = currentUserProfile?.prefs?.semesterGoals?.items || currentUserProfile?.preferences?.semesterGoals?.items || [];
    return (Array.isArray(rawGoals) ? rawGoals : [])
      .map((goal, index) => ({
        id: goal?.id || `goal_${index + 1}`,
        type: goal?.type || 'course',
        title: String(goal?.title || '').trim(),
        note: String(goal?.note || '').trim(),
        done: Boolean(goal?.done),
        reminderAt: goal?.reminderAt || goal?.when || goal?.dueAt || null
      }))
      .filter((goal) => goal.title);
  }

  async function _saveDashboardPrefs(partialDashboard) {
    const uid = getEffectiveSessionUid(currentUserProfile);
    if (!uid) return;
    const currentDashboard = _getDashboardPrefs();
    const nextDashboard = {
      ...currentDashboard,
      ...(partialDashboard || {})
    };
    if (typeof window.SIA?.updateUserPreferences === 'function') {
      await window.SIA.updateUserPreferences(uid, { dashboard: nextDashboard });
    } else if (SIA?.db) {
      await SIA.db.collection('usuarios').doc(uid).update({ 'prefs.dashboard': nextDashboard });
    }
    if (currentUserProfile) {
      if (!currentUserProfile.prefs) currentUserProfile.prefs = {};
      currentUserProfile.prefs.dashboard = nextDashboard;
      currentUserProfile.preferences = currentUserProfile.prefs;
    }
  }

  function _cacheStudentDashboardState(uid) {
    const key = _getDashboardCacheKey(uid);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        savedAt: Date.now(),
        stats: _dashStats,
        state: _dashState
      }));
    } catch (err) {
      console.warn('[Dashboard] No se pudo cachear estado:', err);
    }
  }

  function _renderDashboardFromState() {
    _updateSummaryBanner();
    _updateScorecard();
    _renderTaskCenter();
    _renderRecentActivity();
    _renderHeaderDashboardMeta();
    _renderEventsStrip(_dashState.visibleEvents || _dashStats.events || []);
    _updateTipOfDay();
  }

  window.SIA.restoreStudentDashboardCache = function (options = {}) {
    const uid = getEffectiveSessionUid(currentUserProfile);
    const key = _getDashboardCacheKey(uid);
    if (!key) return false;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        if (options.resetIfMissing) _resetStudentDashboardState({ clearDom: true, clearFreshness: true });
        return false;
      }
      const parsed = JSON.parse(raw);
      const savedAt = Number(parsed?.savedAt || 0);
      if (!parsed?.stats || !savedAt || (Date.now() - savedAt) > DASHBOARD_CACHE_TTL_MS) {
        localStorage.removeItem(key);
        if (options.resetIfMissing) _resetStudentDashboardState({ clearDom: true, clearFreshness: true });
        return false;
      }
      _dashStats = { ..._createEmptyDashboardStats(), ...parsed.stats };
      _dashState = {
        ..._createEmptyDashboardState(),
        ...(parsed.state || {}),
        scope: _normalizeDashboardScope(parsed?.state?.scope || _getDashboardPrefs()?.defaultScope || 'week')
      };
      _renderDashboardFromState();
      return true;
    } catch (err) {
      console.warn('[Dashboard] No se pudo restaurar cache:', err);
      if (options.resetIfMissing) _resetStudentDashboardState({ clearDom: true, clearFreshness: true });
      return false;
    }
  };

  async function _setDashboardScope(scope, options) {
    const normalized = _normalizeDashboardScope(scope);
    _dashState.scope = normalized;
    document.querySelectorAll('[data-dash-scope]').forEach((btn) => {
      const isActive = btn.dataset.dashScope === normalized;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('btn-light', !isActive);
    });
    if (options?.persist) {
      await _saveDashboardPrefs({ defaultScope: normalized });
    }
    _renderTaskCenter();
    _renderRecentActivity();
    _renderEventsStrip(_dashStats.events || []);
    _renderHeaderDashboardMeta();
    _updateSummaryBanner();
  }

  window.SIA.setStudentDashboardScope = function (scope, options = {}) {
    return _setDashboardScope(scope, options).catch((err) => console.warn('[Dashboard] Scope update failed:', err));
  };

  window.SIA.toggleSavedDashboardStory = async function (storyId) {
    if (!storyId) return;
    const current = new Set(_getSavedStoryIds());
    if (current.has(storyId)) current.delete(storyId);
    else current.add(storyId);
    await _saveDashboardPrefs({ savedStoryIds: Array.from(current) });
    _renderTaskCenter();
    _updateSummaryBanner();
    if (typeof renderDashboardStories === 'function') renderDashboardStories();
  };

  window.SIA.toggleDashboardEventInterest = async function (eventId) {
    if (!eventId) return;
    const current = new Set(_getInterestedEventIds());
    if (current.has(eventId)) current.delete(eventId);
    else current.add(eventId);
    await _saveDashboardPrefs({ interestedEventIds: Array.from(current) });
    _renderEventsStrip(_dashStats.events || []);
    _renderTaskCenter();
    _updateSummaryBanner();
  };

  window.SIA.exportDashboardEvents = function () {
    const events = _dashState.visibleEvents || _dashStats.events || [];
    if (!Array.isArray(events) || !events.length) return;
    const body = events.map((item) => {
      const ev = typeof item?.data === 'function' ? item.data() : item;
      const rawDate = ev?.date || ev?.fecha;
      const start = _dashToDate(rawDate);
      if (!start) return '';
      const dtStart = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const title = String(ev?.title || ev?.titulo || 'Evento').replace(/[\r\n,;]/g, ' ');
      const location = String(ev?.location || ev?.ubicacion || '').replace(/[\r\n]/g, ' ');
      return `BEGIN:VEVENT\r\nDTSTART:${dtStart}\r\nSUMMARY:${title}\r\n${location ? `LOCATION:${location}\r\n` : ''}END:VEVENT\r\n`;
    }).filter(Boolean).join('');
    if (!body) return;
    const icsData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR`;
    const blob = new Blob([icsData], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sia-eventos.ics';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  window.SIA.openDashboardDay = function (dateLabel, moduleId) {
    const meta = DASH_MODULE_META[moduleId];
    if (!meta) {
      if (typeof window.showToast === 'function') window.showToast(`No hay detalle disponible para ${dateLabel}.`, 'info');
      return;
    }
    window.SIA.navigate(meta.viewId);
  };

  window.SIA.updateSmartCards = async function () {
    if (!currentUserProfile) return;
    const user = getEffectiveSessionUser(SIA?.auth?.currentUser || null, currentUserProfile);
    if (!user) return;
    const uid = user.uid;
    const renderVersion = ++_dashboardDataRenderVersion;
    const studentCtx = { ...getCtx(), user, profile: currentUserProfile };
    const studentCareer = currentUserProfile?.career || currentUserProfile?.carrera || 'GENERIC';
    _dashState.scope = _normalizeDashboardScope(_getDashboardPrefs()?.defaultScope || _dashState.scope || 'week');

    let citasDocs = [];
    let prestamosDocs = [];
    let clases = [];
    let portfolio = null;
    let comunidadReciente = [];
    let upcomingTasks = [];
    let tickets = [];
    let pendingSurveys = [];
    let relevantEvents = [];

    try {
      // ── C1-01: MEDI — Citas en vivo ──
      const mediStatus = document.getElementById('smart-card-medi-status');
      const mediDot = document.getElementById('smart-dot-medi');
      if (mediStatus) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const citasSnap = await _fetchWithTimeout(SIA.db.collection('citas-medi')
          .where('studentId', '==', uid)
          .where('estado', 'in', ['pendiente', 'confirmada'])
          .orderBy('fechaHoraSlot', 'asc')
          .limit(5).get()).catch(() => ({ empty: true, size: 0, docs: [] }));
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        citasDocs = citasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        _dashStats.citas = citasSnap.size;
        let citaHoy = null;
        if (!citasSnap.empty) {
          for (const doc of citasSnap.docs) {
            const c = doc.data();
            const slot = c.fechaHoraSlot?.toDate?.();
            if (slot && slot >= todayStart && slot <= todayEnd) {
              citaHoy = c;
              break;
            }
          }
        }
        _dashStats.citaHoy = citaHoy;

        if (citaHoy) {
          const hora = citaHoy.fechaHoraSlot.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          const tipo = citaHoy.tipoServicio || 'Medico';
          mediStatus.innerHTML = `<i class="bi bi-clock-fill me-1"></i>Cita hoy — ${hora}`;
          mediStatus.className = "extra-small fw-bold mb-0";
          mediStatus.style.color = '#10b981';
          if (mediDot) { mediDot.classList.remove('d-none'); mediDot.className = "status-dot bg-success"; }
        } else if (citasSnap.size > 0) {
          const pendCount = citasSnap.docs.filter(d => d.data().estado === 'pendiente').length;
          if (pendCount > 0) {
            mediStatus.textContent = `${pendCount} pendiente${pendCount > 1 ? 's' : ''} de confirmar`;
            mediStatus.className = "extra-small fw-bold text-warning mb-0";
            mediStatus.style.color = '';
            if (mediDot) { mediDot.classList.remove('d-none'); mediDot.className = "status-dot bg-warning"; }
          } else {
            mediStatus.textContent = "Cita programada";
            mediStatus.className = "extra-small text-muted mb-0";
            mediStatus.style.color = '';
            if (mediDot) { mediDot.classList.remove('d-none'); mediDot.className = "status-dot bg-info"; }
          }
        } else {
          mediStatus.textContent = "Sin citas activas";
          mediStatus.className = "extra-small text-muted mb-0";
          mediStatus.style.color = '';
          if (mediDot) mediDot.classList.add('d-none');
        }
      }

      // ── C1-02: BIBLIO — Prestamos con urgencia ──
      const biblioStatus = document.getElementById('smart-card-biblio-status');
      const biblioDot = document.getElementById('smart-dot-biblio');
      if (biblioStatus) {
        const prestaSnap = await _fetchWithTimeout(SIA.db.collection('prestamos-biblio')
          .where('studentId', '==', uid)
          .where('estado', 'in', ['pendiente', 'pendiente_entrega', 'entregado'])
          .limit(10).get()).catch(() => ({ empty: true, size: 0, docs: [] }));
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        prestamosDocs = prestaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        _dashStats.libros = prestaSnap.size;

        if (!prestaSnap.empty) {
          const deliveredLoans = prestaSnap.docs
            .map(doc => doc.data())
            .filter(data => data.estado === 'entregado' && data.fechaVencimiento?.toDate)
            .sort((a, b) => a.fechaVencimiento.toDate() - b.fechaVencimiento.toDate());
          const nearest = deliveredLoans[0];
          const devDate = nearest?.fechaVencimiento?.toDate?.();
          if (devDate) {
            const daysLeft = Math.ceil((devDate - Date.now()) / 86400000);
            _dashStats.libroUrgente = daysLeft;
            if (daysLeft <= 0) {
              biblioStatus.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i>${prestaSnap.size} libro${prestaSnap.size > 1 ? 's' : ''} — Devolucion vencida`;
              biblioStatus.className = "extra-small fw-bold mb-0";
              biblioStatus.style.color = '#ef4444';
              if (biblioDot) { biblioDot.classList.remove('d-none'); biblioDot.className = "status-dot bg-danger"; }
            } else if (daysLeft <= 2) {
              biblioStatus.textContent = `${prestaSnap.size} libro${prestaSnap.size > 1 ? 's' : ''} — Devuelve en ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`;
              biblioStatus.className = "extra-small fw-bold text-warning mb-0";
              biblioStatus.style.color = '';
              if (biblioDot) { biblioDot.classList.remove('d-none'); biblioDot.className = "status-dot bg-warning"; }
            } else {
              biblioStatus.textContent = `${prestaSnap.size} libro${prestaSnap.size > 1 ? 's' : ''} activo${prestaSnap.size > 1 ? 's' : ''}`;
              biblioStatus.className = "extra-small text-muted mb-0";
              biblioStatus.style.color = '';
              if (biblioDot) { biblioDot.classList.remove('d-none'); biblioDot.className = "status-dot bg-info"; }
            }
          } else {
            biblioStatus.textContent = `${prestaSnap.size} libro${prestaSnap.size > 1 ? 's' : ''} activo${prestaSnap.size > 1 ? 's' : ''}`;
            biblioStatus.className = "extra-small text-muted mb-0";
            biblioStatus.style.color = '';
            if (biblioDot) biblioDot.classList.add('d-none');
          }
        } else {
          biblioStatus.textContent = "Visita y llevate un libro a casa";
          biblioStatus.className = "extra-small text-muted mb-0";
          biblioStatus.style.color = '';
          if (biblioDot) biblioDot.classList.add('d-none');
          _dashStats.libroUrgente = null;
        }
      }

      // ── C1-03: AULA — Clases activas (usa aula-miembros / aula-clases) ──
      const aulaStatus = document.getElementById('smart-card-aula-status');
      const aulaProgressWrap = document.getElementById('smart-card-aula-progress-wrap');
      if (aulaStatus) {
        // Membresías del estudiante en el nuevo sistema
        clases = [];
        let membSnap = { empty: true, size: 0, docs: [] };
        if (window.AulaService?.getMisClases) {
          clases = await _fetchWithTimeout(AulaService.getMisClases(studentCtx, uid, 30)).catch(() => []);
        } else {
          membSnap = await _fetchWithTimeout(SIA.db.collection('aula-miembros')
            .where('userId', '==', uid)
            .limit(30).get()).catch(() => ({ empty: true, docs: [] }));

          const claseIds = membSnap.docs
            .map(doc => doc.data()?.claseId)
            .filter(Boolean);

          if (claseIds.length) {
            const batches = [];
            for (let i = 0; i < claseIds.length; i += 10) {
              const batch = claseIds.slice(i, i + 10);
              batches.push(_fetchWithTimeout(
                SIA.db.collection('aula-clases')
                  .where(SIA.FieldPath.documentId(), 'in', batch)
                  .get(),
                5000
              ).catch(() => ({ docs: [] })));
            }

            const results = await Promise.all(batches);
            clases = results.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
              .filter(clase => !clase.archivada)
              .sort((a, b) => {
                const ta = a.updatedAt?.toDate?.()?.getTime?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
                const tb = b.updatedAt?.toDate?.()?.getTime?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
                return tb - ta;
              });
          }
        }
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        _dashStats.aulaCount = clases.length;
        _dashStats.aulaCompleted = 0;
        _dashStats.aulaCerts = 0;

        if (clases.length > 0) {
          // Tomar el claseId más reciente para mostrar en el status
          const latestClase = clases[0] || {};
          const latestClaseId = latestClase.id || null;
          let claseTitle = latestClase.titulo || latestClase.claseTitulo || '';

          // Si no viene el título en el doc de membresía, buscarlo en aula-clases
          if (!claseTitle && latestClaseId) {
            try {
              const claseDoc = await _fetchWithTimeout(SIA.db.collection('aula-clases').doc(latestClaseId).get(), 5000);
              if (claseDoc.exists) claseTitle = claseDoc.data().titulo || '';
            } catch (_) { }
          }
          if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

          _dashStats.aulaProgress = { title: claseTitle, clases: clases.length };
          const title = claseTitle.length > 22 ? claseTitle.substring(0, 20) + '...' : claseTitle;
          aulaStatus.textContent = title ? `${title} y más` : `${membSnap.size} ${membSnap.size === 1 ? 'clase activa' : 'clases activas'}`;
          aulaStatus.className = "extra-small text-muted mb-0";
          aulaStatus.textContent = title
            ? (clases.length > 1 ? `${title} y mas` : title)
            : `${clases.length} ${clases.length === 1 ? 'clase activa' : 'clases activas'}`;
          aulaStatus.style.color = '';
          if (aulaProgressWrap) aulaProgressWrap.classList.add('d-none');
        } else {
          aulaStatus.innerHTML = 'Únete a tu primera clase <i class="bi bi-arrow-right-short"></i>';
          aulaStatus.className = "extra-small mb-0";
          aulaStatus.style.color = 'var(--accent)';
          aulaStatus.innerHTML = 'Unete a tu primera clase <i class="bi bi-arrow-right-short"></i>';
          if (aulaProgressWrap) aulaProgressWrap.classList.add('d-none');
          _dashStats.aulaProgress = null;
        }
      }

      // ── C1-05: QUEJAS — Estado activo ──
      const quejasStatus = document.getElementById('smart-card-quejas-status');
      const quejasDot = document.getElementById('smart-dot-quejas');
      if (quejasStatus) {
        let quejasSnap = { size: 0, empty: true, docs: [] };
        tickets = [];
        if (window.QuejasService?.getTicketsByUser) {
          tickets = await _fetchWithTimeout(QuejasService.getTicketsByUser(studentCtx, uid, { limit: 5 })).catch(() => []);
        } else {
          quejasSnap = await _fetchWithTimeout(SIA.db.collection('quejas')
            .where('userId', '==', uid)
            .orderBy('updatedAt', 'desc')
            .limit(5).get()).catch(() => ({ docs: [] }));
          tickets = quejasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        const activeStatuses = new Set(['pendiente', 'en-proceso', 'en_proceso']);
        const activeTickets = tickets.filter(ticket => activeStatuses.has(ticket.status));
        const latestTicket = activeTickets[0] || null;

        _dashStats.quejas = activeTickets.length;

        if (latestTicket) {
          const estadoMap = {
            'pendiente': 'Pendiente',
            'en-proceso': 'En proceso',
            'en_proceso': 'En proceso'
          };
          const label = estadoMap[latestTicket.status] || latestTicket.status || 'Pendiente';
          const dotColor = latestTicket.status === 'pendiente' ? 'bg-warning' : 'bg-info';
          quejasStatus.textContent = `${quejasSnap.size} queja${quejasSnap.size > 1 ? 's' : ''} — ${label}`;
          quejasStatus.className = "extra-small fw-bold mb-0";
          quejasStatus.textContent = `${activeTickets.length} queja${activeTickets.length > 1 ? 's' : ''} - ${label}`;
          quejasStatus.style.color = '';
          if (quejasDot) { quejasDot.classList.remove('d-none'); quejasDot.className = `status-dot ${dotColor}`; }
        } else {
          quejasStatus.textContent = "Buzon de Calidad";
          quejasStatus.className = "extra-small text-muted mb-0";
          quejasStatus.style.color = '';
          if (quejasDot) quejasDot.classList.add('d-none');
        }
      }

      // ── C1-04: ENCUESTAS — Pendientes ──
      const encuestasStatus = document.getElementById('smart-card-encuestas-status');
      const encuestasDot = document.getElementById('smart-dot-encuestas');
      if (encuestasStatus) {
        try {
          if (window.EncuestasService?.getPendingSurveysForUser) {
            const baseCtx = getCtx();
            const ctx = { ...baseCtx, user: baseCtx.auth?.currentUser, profile: currentUserProfile };
            pendingSurveys = await _fetchWithTimeout(EncuestasService.getPendingSurveysForUser(ctx)).catch(() => []);
            _dashStats.encuestas = pendingSurveys.length;
            if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

            if (pendingSurveys.length > 0) {
              encuestasStatus.textContent = `${pendingSurveys.length} pendiente${pendingSurveys.length > 1 ? 's' : ''}`;
              encuestasStatus.className = "extra-small fw-bold text-warning mb-0";
              if (encuestasDot) { encuestasDot.classList.remove('d-none'); encuestasDot.className = "status-dot bg-warning"; }
            } else {
              encuestasStatus.innerHTML = '<i class="bi bi-check-circle me-1 text-success"></i>Al dia';
              encuestasStatus.className = "extra-small mb-0";
              encuestasStatus.style.color = '#10b981';
              if (encuestasDot) { encuestasDot.classList.remove('d-none'); encuestasDot.className = "status-dot bg-success"; }
            }
          } else {
            encuestasStatus.textContent = "Tu opinion importa";
            encuestasStatus.className = "extra-small text-muted mb-0";
          }
        } catch (e) {
          encuestasStatus.textContent = "Tu opinion importa";
          encuestasStatus.className = "extra-small text-muted mb-0";
        }
      }

      // ── C1-04b: FORO — Proximos eventos ──
      const foroStatus = document.getElementById('smart-card-foro-status');
      const foroDot = document.getElementById('smart-dot-foro');
      if (foroStatus) {
        try {
          const now = new Date();
          const in14d = new Date(now.getTime() + 14 * 86400000);
          let events = [];
          if (window.ForoService?.getActiveEvents) {
            events = await _fetchWithTimeout(ForoService.getActiveEvents(studentCtx)).catch(() => []);
          } else {
            const eventsSnap = await _fetchWithTimeout(SIA.db.collection('foro_events')
              .where('status', '==', 'active')
              .where('date', '>=', now)
              .orderBy('date', 'asc')
              .limit(20).get()).catch(() => ({ docs: [] }));

            events = eventsSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter(evt => {
                if (!evt.targetAudience || evt.targetAudience.includes('ALL')) return true;
                return evt.targetAudience.includes(studentCareer);
              });
          }

          relevantEvents = events
            .filter(evt => {
              const rawDate = evt?.date || evt?.fecha;
              const eventDate = rawDate?.toDate ? rawDate.toDate() : (rawDate ? new Date(rawDate) : null);
              return eventDate && !Number.isNaN(eventDate.getTime()) && eventDate >= now && eventDate <= in14d;
            })
            .slice(0, 5);
          if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

          if (relevantEvents.length > 0) {
            foroStatus.textContent = `${relevantEvents.length} evento${relevantEvents.length > 1 ? 's' : ''} próximos`;
            foroStatus.className = "extra-small fw-bold mb-0";
            foroStatus.style.color = 'var(--accent)';
            if (foroDot) { foroDot.classList.remove('d-none'); foroDot.className = "status-dot bg-info"; }
            _renderEventsStrip(relevantEvents);
          } else {
            foroStatus.textContent = "Conferencias y mas";
            foroStatus.className = "extra-small text-muted mb-0";
            foroStatus.style.color = '';
            if (foroDot) foroDot.classList.add('d-none');
            _renderEventsStrip([]);
          }
        } catch (e) {
          foroStatus.textContent = "Conferencias y mas";
          foroStatus.className = "extra-small text-muted mb-0";
          foroStatus.style.color = '';
          if (foroDot) foroDot.classList.add('d-none');
          _renderEventsStrip([]);
        }
      }

      // ── Update summary banner ──
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(todayStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      let classTitleMap = {};
      let weekAulaTasks = [];

      if (clases.length > 0) {
        if (window.AulaService?.getPortfolioGlobal) {
          portfolio = await _fetchWithTimeout(AulaService.getPortfolioGlobal(studentCtx, uid), 7000).catch(() => null);
        }
        if (window.AulaService?.getComunidadRecientes) {
          comunidadReciente = await _fetchWithTimeout(AulaService.getComunidadRecientes(studentCtx, 6), 7000).catch(() => []);
        }
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        const aulaTaskData = await _loadStudentAulaTasks(studentCtx, uid, clases, {
          portfolio,
          onlyPending: true,
          publicationLimit: 30
        });
        if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

        classTitleMap = aulaTaskData.classTitleMap || {};
        upcomingTasks = (aulaTaskData.tasks || []).filter((task) => task.dueAt && task.dueAt >= now);
        weekAulaTasks = (aulaTaskData.tasks || []).filter((task) => task.dueAt && task.dueAt >= todayStart && task.dueAt <= weekEnd);

        const completedClasses = Object.values(portfolio?.porClase || {}).filter((entries) => Array.isArray(entries) && entries.length > 0).length;
        _dashStats.aulaCompleted = Math.min(_dashStats.aulaCount || 0, completedClasses);
        _dashStats.aulaPendingTasks = upcomingTasks.length;
        _dashStats.aulaNextDeadline = upcomingTasks[0]
          ? {
            title: upcomingTasks[0].titulo || 'Entrega',
            claseTitle: classTitleMap[upcomingTasks[0].claseId] || 'Clase',
            dueAt: upcomingTasks[0].dueAt
          }
          : null;

        const completionPct = _dashStats.aulaCount > 0
          ? Math.round((_dashStats.aulaCompleted / _dashStats.aulaCount) * 100)
          : 0;
        const trendKey = `sia_dashboard_aula_progress_${uid}`;
        let previousPct = null;
        try {
          const previousRaw = localStorage.getItem(trendKey);
          if (previousRaw) previousPct = JSON.parse(previousRaw)?.percent;
          localStorage.setItem(trendKey, JSON.stringify({ percent: completionPct, at: Date.now() }));
        } catch (_) { }
        _dashStats.aulaTrend = typeof previousPct === 'number' ? completionPct - previousPct : null;
        _dashStats.aulaRisk = upcomingTasks.length >= 4 ? 'Alto'
          : upcomingTasks.length >= 2 ? 'Atención'
            : _dashStats.aulaCount === 0 ? 'Sin inicio'
              : 'Estable';
      } else {
        _dashStats.aulaPendingTasks = 0;
        _dashStats.aulaNextDeadline = null;
        _dashStats.aulaTrend = null;
        _dashStats.aulaRisk = _dashStats.aulaCount === 0 ? 'Sin inicio' : 'Estable';
      }

      const activeStatuses = new Set(['pendiente', 'en-proceso', 'en_proceso']);
      const activeTickets = (tickets || []).filter((ticket) => activeStatuses.has(ticket.status));
      const interestedEventIds = new Set(_getInterestedEventIds());
      const savedStoryIds = new Set(_getSavedStoryIds());
      const taskItems = [];

      if (_dashStats.libroUrgente !== null && _dashStats.libroUrgente <= 0) {
        taskItems.push({ id: 'book-overdue', severity: 'urgent', module: 'biblio', title: 'Libro vencido', detail: 'Devuelvelo cuanto antes para evitar bloqueo.', when: new Date(), actionLabel: 'Ir a Biblioteca' });
      } else if (_dashStats.libroUrgente !== null && _dashStats.libroUrgente <= 2) {
        taskItems.push({ id: 'book-soon', severity: 'high', module: 'biblio', title: 'Devolución cercana', detail: `Tu próxima devolución vence en ${_dashStats.libroUrgente} día${_dashStats.libroUrgente === 1 ? '' : 's'}.`, when: new Date(Date.now() + (_dashStats.libroUrgente * 86400000)), actionLabel: 'Revisar préstamo' });
      }
      if (_dashStats.citaHoy) {
        taskItems.push({ id: 'medi-today', severity: 'high', module: 'medi', title: 'Tienes cita hoy', detail: _dashFormatShortDate(_dashStats.citaHoy.fechaHoraSlot, true), when: _dashToDate(_dashStats.citaHoy.fechaHoraSlot), actionLabel: 'Ver cita' });
      } else if (citasDocs[0]?.fechaHoraSlot) {
        taskItems.push({ id: 'medi-next', severity: 'medium', module: 'medi', title: 'Proxima cita', detail: _dashFormatShortDate(citasDocs[0].fechaHoraSlot, true), when: _dashToDate(citasDocs[0].fechaHoraSlot), actionLabel: 'Abrir Medi' });
      }
      if (pendingSurveys.length > 0) {
        taskItems.push({ id: 'surveys', severity: pendingSurveys.length > 2 ? 'high' : 'medium', module: 'encuestas', title: `${pendingSurveys.length} encuesta${pendingSurveys.length === 1 ? '' : 's'} pendientes`, detail: 'Tu participación ayuda a mejorar servicios.', when: _dashToDate(pendingSurveys[0]?.createdAt) || now, actionLabel: 'Responder' });
      }
      if (upcomingTasks.length > 0) {
        taskItems.push({ id: 'aula-pending', severity: upcomingTasks.length > 2 ? 'high' : 'medium', module: 'aula', title: `${upcomingTasks.length} tarea${upcomingTasks.length === 1 ? '' : 's'} por entregar`, detail: `${upcomingTasks[0].titulo || 'Entrega'} en ${classTitleMap[upcomingTasks[0].claseId] || 'Aula'}`, when: upcomingTasks[0].dueAt, actionLabel: 'Ir a Aula' });
      }
      if (activeTickets.length > 0) {
        taskItems.push({ id: 'tickets-active', severity: 'medium', module: 'quejas', title: `${activeTickets.length} caso${activeTickets.length === 1 ? '' : 's'} abierto${activeTickets.length === 1 ? '' : 's'}`, detail: `Último estado: ${activeTickets[0].status || 'pendiente'}`, when: _dashToDate(activeTickets[0]?.updatedAt || activeTickets[0]?.createdAt) || now, actionLabel: 'Revisar caso' });
      }
      if (relevantEvents.length > 0) {
        const highlightedEvent = relevantEvents.find((event) => interestedEventIds.has(event.id)) || relevantEvents[0];
        taskItems.push({ id: 'next-event', severity: interestedEventIds.has(highlightedEvent.id) ? 'medium' : 'low', module: 'foro', title: interestedEventIds.has(highlightedEvent.id) ? 'Evento que sigues' : 'Evento próximo', detail: highlightedEvent.title || highlightedEvent.titulo || 'Evento', when: _dashToDate(highlightedEvent.date || highlightedEvent.fecha), actionLabel: interestedEventIds.has(highlightedEvent.id) ? 'Ver evento' : 'Explorar Foro' });
      }
      if (savedStoryIds.size > 0) {
        taskItems.push({ id: 'saved-stories', severity: 'low', module: 'avisos', title: `${savedStoryIds.size} novedad${savedStoryIds.size === 1 ? '' : 'es'} guardada${savedStoryIds.size === 1 ? '' : 's'}`, detail: 'Recupera avisos y eventos apartados para después.', when: now, actionLabel: 'Ver novedades' });
      }
      const nextGoalReminder = _getDashboardSemesterGoals()
        .filter((goal) => !goal.done && (goal.type === 'reminder' || goal.reminderAt))
        .map((goal) => ({ ...goal, reminderDate: _dashToDate(goal.reminderAt) }))
        .sort((a, b) => {
          const aTime = a.reminderDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
          const bTime = b.reminderDate?.getTime?.() || Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        })[0];
      if (nextGoalReminder) {
        const reminderDate = nextGoalReminder.reminderDate || now;
        const targetDay = new Date(reminderDate);
        targetDay.setHours(0, 0, 0, 0);
        const baseDay = new Date();
        baseDay.setHours(0, 0, 0, 0);
        const dayDiff = Math.round((targetDay.getTime() - baseDay.getTime()) / 86400000);
        taskItems.push({
          id: `goal-reminder-${nextGoalReminder.id}`,
          severity: dayDiff < 0 ? 'urgent' : (dayDiff <= 1 ? 'high' : 'medium'),
          module: 'dashboard',
          title: nextGoalReminder.type === 'reminder' ? 'Recordatorio pendiente' : 'Meta con fecha cercana',
          detail: nextGoalReminder.reminderDate
            ? `${nextGoalReminder.title} • ${_dashRelativeDateLabel(nextGoalReminder.reminderDate)}`
            : nextGoalReminder.title,
          when: nextGoalReminder.reminderDate || now,
          actionLabel: 'Gestionar',
          actionType: 'open-goals-modal'
        });
      }

      _dashStats.taskCenter = taskItems.sort((a, b) => {
        const sevDiff = (DASH_SEVERITY_ORDER[a.severity] || 99) - (DASH_SEVERITY_ORDER[b.severity] || 99);
        if (sevDiff !== 0) return sevDiff;
        return (_dashToDate(a.when)?.getTime?.() || 0) - (_dashToDate(b.when)?.getTime?.() || 0);
      });
      _dashStats.events = relevantEvents;

      const recentActivity = [];
      citasDocs.slice(0, 2).forEach((item) => {
        recentActivity.push({ id: `medi_${item.id}`, module: 'medi', title: item.tipoServicio || 'Cita médica', detail: _dashFormatShortDate(item.fechaHoraSlot, true), at: _dashToDate(item.fechaHoraSlot) });
      });
      prestamosDocs.slice(0, 2).forEach((item) => {
        recentActivity.push({ id: `biblio_${item.id}`, module: 'biblio', title: item.titulo || item.libroTitulo || 'Prestamo activo', detail: _dashFormatShortDate(item.fechaVencimiento || item.fechaExpiracionRecoleccion), at: _dashToDate(item.fechaVencimiento || item.fechaExpiracionRecoleccion) });
      });
      (portfolio?.entregas || []).slice(0, 2).forEach((item) => {
        recentActivity.push({ id: `aula_${item.id}`, module: 'aula', title: item.publicacionTitulo || 'Entrega Aula', detail: item.estado || 'registrada', at: _dashToDate(item.entregadoAt || item.updatedAt || item.createdAt) });
      });
      (comunidadReciente || []).slice(0, 2).forEach((item) => {
        recentActivity.push({ id: `community_${item.id}`, module: 'comunidad', title: item.titulo || item.claseTitulo || 'Actividad reciente', detail: item.claseTitulo || 'Comunidad Aula', at: _dashToDate(item.createdAt) });
      });
      activeTickets.slice(0, 1).forEach((item) => {
        recentActivity.push({ id: `quejas_${item.id}`, module: 'quejas', title: item.subject || item.titulo || 'Caso abierto', detail: item.status || 'pendiente', at: _dashToDate(item.updatedAt || item.createdAt) });
      });
      pendingSurveys.slice(0, 1).forEach((item) => {
        recentActivity.push({ id: `survey_${item.id}`, module: 'encuestas', title: item.title || 'Encuesta pendiente', detail: 'Disponible para responder', at: _dashToDate(item.createdAt) });
      });
      relevantEvents.slice(0, 1).forEach((item) => {
        recentActivity.push({ id: `event_${item.id}`, module: 'foro', title: item.title || item.titulo || 'Evento', detail: _dashFormatShortDate(item.date || item.fecha, true), at: _dashToDate(item.date || item.fecha) });
      });
      _dashStats.recentActivity = recentActivity
        .filter((item) => item.at)
        .sort((a, b) => (_dashToDate(b.at)?.getTime?.() || 0) - (_dashToDate(a.at)?.getTime?.() || 0))
        .slice(0, 6);

      _dashState.visibleEvents = relevantEvents;
      _dashState.taskCenter = _dashStats.taskCenter;
      _dashState.recentActivity = _dashStats.recentActivity;
      if (!_canCommitDashboardDataRender(renderVersion, uid)) return [];

      _updateSummaryBanner();

      // ── Update scorecard ──
      _updateScorecard();
      _renderTaskCenter();
      _renderRecentActivity();
      _renderHeaderDashboardMeta();

      // ── Update activity strip (C3-01) ──
      _updateActivityStrip(uid, { renderVersion, aulaTasks: weekAulaTasks });

      // ── Update tip of the day (C3-05) ──
      _updateTipOfDay();

      // ── Mark timestamp ──
      window._dashLastRefresh = Date.now();
      const freshEl = document.getElementById('dash-data-freshness');
      if (freshEl) freshEl.textContent = 'recien actualizado';
      const syncChip = document.getElementById('dash-header-sync');
      if (syncChip) syncChip.textContent = 'recien actualizado';
      _cacheStudentDashboardState(uid);
      _maybeEmitDashboardReminder();

    } catch (err) {
      if (_canCommitDashboardDataRender(renderVersion, uid) && !window._dashLastRefresh) {
        _renderDashboardCardPlaceholders();
        _renderEmptyActivityStrip();
        _renderDashboardFromState();
      }
      console.error('[SmartCards] Error updating:', err);
    }
  };

  // ── C1-08: Summary Banner ──
  function _getScopedDashboardTasks() {
    const scope = _normalizeDashboardScope(_dashState.scope || _getDashboardPrefs()?.defaultScope || 'week');
    const end = _getDashboardScopeEnd(scope);
    return (_dashStats.taskCenter || []).filter((item) => {
      const when = _dashToDate(item.when);
      if (!when) return true;
      if (scope === 'all') return true;
      return when <= end;
    });
  }

  function _getScopedRecentActivity() {
    const scope = _normalizeDashboardScope(_dashState.scope || _getDashboardPrefs()?.defaultScope || 'week');
    const now = new Date();
    const start = new Date(now);
    if (scope === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (scope === 'week') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 30);
    }
    return (_dashStats.recentActivity || []).filter((item) => {
      const at = _dashToDate(item.at);
      return at && at >= start;
    });
  }

  function _renderHeaderDashboardMeta() {
    const syncChip = document.getElementById('dash-header-sync');
    const freshnessText = document.getElementById('dash-data-freshness')?.textContent;
    if (syncChip && freshnessText) syncChip.textContent = freshnessText;
    document.querySelectorAll('[data-dash-scope]').forEach((btn) => {
      const isActive = btn.dataset.dashScope === _dashState.scope;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('btn-light', !isActive);
    });

    const subtitle = document.getElementById('dash-events-subtitle');
    if (subtitle) {
      const count = (_dashState.visibleEvents || []).length;
      subtitle.textContent = count > 0
        ? `${count} evento${count === 1 ? '' : 's'} en ${DASH_SCOPE_LABELS[_dashState.scope] || 'tu agenda'}`
        : 'Calendario del campus';
    }

    const exportBtn = document.getElementById('dash-events-export-btn');
    if (exportBtn) {
      const hasEvents = Array.isArray(_dashState.visibleEvents) && _dashState.visibleEvents.length > 0;
      exportBtn.classList.toggle('d-none', !hasEvents);
      exportBtn.onclick = () => window.SIA.exportDashboardEvents();
    }
  }

  function _renderTaskCenter() {
    const listEl = document.getElementById('dash-task-center-list');
    const summaryEl = document.getElementById('dash-task-center-summary');
    if (!listEl) return;

    const items = _getScopedDashboardTasks().slice(0, 5);
    _dashState.taskCenter = items;
    if (summaryEl) {
      summaryEl.textContent = items.length > 0
        ? `${items.length} prioridad${items.length === 1 ? '' : 'es'} en ${DASH_SCOPE_LABELS[_dashState.scope] || 'tu tablero'}`
        : `Sin pendientes para ${DASH_SCOPE_LABELS[_dashState.scope] || 'este periodo'}`;
    }

    if (items.length === 0) {
      const favoriteModules = _getDashboardFavoriteModules().slice(0, 3)
        .map((moduleId) => DASH_MODULE_META[moduleId])
        .filter(Boolean);
      listEl.innerHTML = `
        <div class="rounded-4 border p-3 dash-task-empty" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="fw-bold small mb-1">Todo bajo control</div>
          <div class="extra-small text-muted mb-3">No se encontraron tareas prioritarias en este horizonte.</div>
          <div class="d-flex flex-wrap gap-2">
            ${(favoriteModules.length ? favoriteModules : [DASH_MODULE_META.medi, DASH_MODULE_META.aula, DASH_MODULE_META.biblio]).map((module) => `
              <button class="btn btn-outline-secondary btn-sm rounded-pill" type="button" onclick="window.SIA?.navigate('${module.viewId}')">
                <i class="bi ${module.icon} me-1"></i>${module.label}
              </button>`).join('')}
          </div>
        </div>`;
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const moduleMeta = DASH_MODULE_META[item.module] || DASH_MODULE_META.aula;
      const whenLabel = _dashRelativeDateLabel(item.when);
      const actionCode = item.actionType === 'open-goals-modal'
        ? 'window.SIA?.openDashboardGoalsModal?.()'
        : `window.SIA?.navigate('${moduleMeta.viewId}')`;
      return `
        <div class="rounded-4 border p-3 dash-task-card dash-task-card--${item.severity}" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div class="d-flex gap-3 align-items-start">
              <div class="dash-task-icon">
                <i class="bi ${moduleMeta.icon}"></i>
              </div>
              <div>
                <div class="fw-bold small" style="color: var(--text-heading);">${_escapeDashHtml(item.title)}</div>
                <div class="extra-small text-muted mt-1">${_escapeDashHtml(item.detail)}</div>
                <div class="extra-small mt-2" style="color: var(--accent);">${_escapeDashHtml(whenLabel)}</div>
              </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm rounded-pill flex-shrink-0" type="button" onclick="${actionCode}">
              ${_escapeDashHtml(item.actionLabel || 'Abrir')}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function _renderRecentActivity() {
    const listEl = document.getElementById('dash-history-list');
    const metaEl = document.getElementById('dash-history-meta');
    if (!listEl) return;
    const items = _getScopedRecentActivity().slice(0, 5);
    if (metaEl) metaEl.textContent = items.length > 0
      ? `${items.length} movimiento${items.length === 1 ? '' : 's'} recientes`
      : 'Sin actividad reciente en este horizonte';

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="rounded-4 border p-3" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="fw-bold small mb-1">Sin actividad reciente</div>
          <div class="extra-small text-muted">A medida que uses SIA, aqui apareceran tus ultimos movimientos relevantes.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const moduleMeta = DASH_MODULE_META[item.module] || DASH_MODULE_META.aula;
      return `
        <button type="button" class="btn text-start w-100 rounded-4 border p-3 dash-history-card" onclick="window.SIA?.navigate('${moduleMeta.viewId}')" style="background: var(--bg-card); border-color: var(--border-color);">
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div class="d-flex gap-3 align-items-start">
              <div class="dash-task-icon dash-task-icon--muted">
                <i class="bi ${moduleMeta.icon}"></i>
              </div>
              <div>
                <div class="fw-bold small" style="color: var(--text-heading);">${_escapeDashHtml(item.title)}</div>
                <div class="extra-small text-muted mt-1">${_escapeDashHtml(item.detail || '')}</div>
              </div>
            </div>
            <span class="extra-small text-muted flex-shrink-0">${_escapeDashHtml(_dashRelativeDateLabel(item.at))}</span>
          </div>
        </button>`;
    }).join('');
  }

  function _maybeEmitDashboardReminder() {
    const dashboardPrefs = _getDashboardPrefs();
    if (dashboardPrefs?.smartReminders === false) return;
    if ((_getScopedDashboardTasks()[0]?.severity || '') === 'low') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const task = _getScopedDashboardTasks()[0];
    if (!task) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const reminderKey = `sia_dashboard_reminder_${getEffectiveSessionUid(currentUserProfile)}_${todayKey}`;
    const reminderFingerprint = `${task.id}:${task.severity}`;
    if (localStorage.getItem(reminderKey) === reminderFingerprint) return;
    try {
      new Notification(task.title, { body: task.detail || 'Tienes una accion pendiente en SIA.' });
      localStorage.setItem(reminderKey, reminderFingerprint);
    } catch (_) { }
  }

  function _updateSummaryBanner() {
    const s = _dashStats;
    const setCt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setCt('dash-sum-citas', s.citas);
    setCt('dash-sum-libros', s.libros);
    setCt('dash-sum-encuestas', s.encuestas);
    setCt('dash-sum-quejas', s.quejas);

    const ctaBtn = document.getElementById('dash-summary-cta-btn');
    const ctaLabel = document.getElementById('dash-summary-cta-label');
    const okMsg = document.getElementById('dash-summary-ok');
    const priorityEl = document.getElementById('dash-summary-priority');
    const contextEl = document.getElementById('dash-summary-context');
    const scopedTasks = _getScopedDashboardTasks();
    const hasPending = s.citas > 0 || s.libros > 0 || s.encuestas > 0 || s.quejas > 0 || scopedTasks.length > 0;
    const topTask = scopedTasks[0] || null;
    if (ctaBtn) ctaBtn.onclick = null;
    if (ctaLabel && !topTask) ctaLabel.textContent = 'Sin pendientes';

    if (priorityEl) {
      if (topTask?.severity === 'urgent') {
        priorityEl.textContent = 'Urgente';
        priorityEl.className = 'badge rounded-pill bg-danger-subtle text-danger';
      } else if (topTask?.severity === 'high') {
        priorityEl.textContent = 'Atencion hoy';
        priorityEl.className = 'badge rounded-pill bg-warning-subtle text-warning-emphasis';
      } else if (topTask) {
        priorityEl.textContent = 'Pendientes activos';
        priorityEl.className = 'badge rounded-pill bg-info-subtle text-info';
      } else if (hasPending) {
        priorityEl.textContent = 'Pendientes activos';
        priorityEl.className = 'badge rounded-pill bg-info-subtle text-info';
      } else {
        priorityEl.textContent = 'Operando normal';
        priorityEl.className = 'badge rounded-pill text-bg-light text-dark';
      }
    }
    if (contextEl) {
      contextEl.textContent = topTask
        ? `${topTask.title} • ${_dashRelativeDateLabel(topTask.when)}`
        : (hasPending ? 'Tienes actividad pendiente por revisar' : 'Sin acciones urgentes');
    }

    if (hasPending && ctaBtn && ctaLabel) {
      ctaBtn.classList.remove('d-none');
      if (okMsg) okMsg.classList.add('d-none');

      if (topTask) {
        const moduleMeta = DASH_MODULE_META[topTask.module] || DASH_MODULE_META.aula;
        ctaLabel.textContent = topTask.actionLabel || `Abrir ${moduleMeta.label}`;
        ctaBtn.onclick = topTask.actionType === 'open-goals-modal'
          ? () => window.SIA?.openDashboardGoalsModal?.()
          : () => window.SIA.navigate(moduleMeta.viewId);
      } else if (s.libroUrgente !== null && s.libroUrgente <= 0) {
        ctaLabel.textContent = 'Devolver libro vencido';
        ctaBtn.onclick = () => window.SIA.navigate('view-biblio');
      } else if (s.citaHoy) {
        ctaLabel.textContent = 'Ver tu cita de hoy';
        ctaBtn.onclick = () => window.SIA.navigate('view-medi');
      } else if (s.libros > 0) {
        ctaLabel.textContent = 'Ver prestamos activos';
        ctaBtn.onclick = () => window.SIA.navigate('view-biblio');
      } else if (s.citas > 0) {
        ctaLabel.textContent = 'Ver tus citas';
        ctaBtn.onclick = () => window.SIA.navigate('view-medi');
      } else if (s.encuestas > 0) {
        ctaLabel.textContent = 'Responder encuestas';
        ctaBtn.onclick = () => window.SIA.navigate('view-encuestas');
      } else if (s.quejas > 0) {
        ctaLabel.textContent = 'Revisar casos abiertos';
        ctaBtn.onclick = () => window.SIA.navigate('view-quejas');
      } else {
        ctaBtn.classList.add('d-none');
        if (okMsg) okMsg.classList.remove('d-none');
      }
    } else {
      if (ctaBtn) ctaBtn.classList.add('d-none');
      if (ctaBtn) ctaBtn.onclick = null;
      if (okMsg) okMsg.classList.remove('d-none');
    }
  }

  // ── C3-04: Scorecard ──
  function _updateScorecard() {
    const s = _dashStats;
    const setCt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setCt('dash-sc-enrolled', s.aulaCount);
    setCt('dash-sc-completed', s.aulaCompleted);
    setCt('dash-sc-certs', s.aulaCerts);
    setCt('dash-sc-pending-tasks', s.aulaPendingTasks || 0);
    const completionPct = s.aulaCount > 0 ? Math.round(((s.aulaCompleted || 0) / s.aulaCount) * 100) : 0;
    setCt('dash-sc-percent', `${completionPct}%`);
    setCt('dash-sc-risk', s.aulaRisk || 'Estable');
    const trendEl = document.getElementById('dash-sc-trend');
    if (trendEl) {
      if (typeof s.aulaTrend === 'number' && s.aulaTrend !== 0) {
        trendEl.textContent = `${s.aulaTrend > 0 ? '+' : ''}${s.aulaTrend}%`;
        trendEl.style.color = s.aulaTrend > 0 ? '#10b981' : '#ef4444';
      } else {
        trendEl.textContent = 'Sin cambio';
        trendEl.style.color = '';
      }
    }
    const nextDeadlineEl = document.getElementById('dash-sc-next-deadline');
    if (nextDeadlineEl) {
      nextDeadlineEl.textContent = s.aulaNextDeadline?.dueAt
        ? `${_dashFormatShortDate(s.aulaNextDeadline.dueAt)} • ${s.aulaNextDeadline.claseTitle || 'Aula'}`
        : 'Sin pendientes';
    }
    const courseList = document.getElementById('dash-sc-courses-list');
    if (courseList) {
      const pills = [];
      if (s.aulaProgress?.title) pills.push(`<div class="extra-small text-muted mb-2">Curso destacado: <span class="fw-bold" style="color: var(--text-heading);">${_escapeDashHtml(s.aulaProgress.title)}</span></div>`);
      if (s.aulaNextDeadline?.title) pills.push(`<div class="rounded-3 p-2 mb-2" style="background: rgba(245,158,11,0.08);"><div class="small fw-bold">${_escapeDashHtml(s.aulaNextDeadline.title)}</div><div class="extra-small text-muted">${_escapeDashHtml(s.aulaNextDeadline.claseTitle || 'Aula')} • ${_escapeDashHtml(_dashRelativeDateLabel(s.aulaNextDeadline.dueAt))}</div></div>`);
      if ((s.aulaPendingTasks || 0) === 0 && (s.aulaCount || 0) > 0) pills.push(`<div class="rounded-3 p-2" style="background: rgba(16,185,129,0.08);"><div class="small fw-bold text-success">No tienes entregas pendientes inmediatas</div></div>`);
      courseList.innerHTML = pills.join('');
    }

    // Mini donut chart
    const canvas = document.getElementById('dash-scorecard-chart');
    if (canvas && typeof Chart !== 'undefined') {
      const ctx2d = canvas.getContext('2d');
      if (canvas._chartInstance) canvas._chartInstance.destroy();
      const completed = s.aulaCompleted || 0;
      const inProgress = Math.max(0, (s.aulaCount || 0) - completed);
      canvas._chartInstance = new Chart(ctx2d, {
        type: 'doughnut',
        data: {
          labels: ['Completados', 'En progreso'],
          datasets: [{ data: [completed || 0, inProgress || 1], backgroundColor: ['#10b981', 'rgba(255,255,255,0.1)'], borderWidth: 0 }]
        },
        options: {
          cutout: '70%',
          responsive: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }
  }

  // ── C3-01: Activity Strip ──
  async function _updateActivityStrip(uid, options = {}) {
    const strip = document.getElementById('dash-activity-strip');
    if (!strip) return;
    const renderVersion = Number.isInteger(options?.renderVersion) ? options.renderVersion : _dashboardDataRenderVersion;

    const days = [];
    const dayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const now = new Date();

    for (let i = 0; i <= 6; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: d, label: dayLabels[d.getDay()], isToday: i === 0, activities: [] });
    }

    try {
      const today = days[0].date;
      const endOfWeek = new Date(days[6].date);
      endOfWeek.setHours(23, 59, 59, 999);

      // 1. Citas medicas (Filter in memory to avoid missing composite indices)
      const citasSnap = await _fetchWithTimeout(SIA.db.collection('citas-medi')
        .where('studentId', '==', uid)
        .get()).catch(e => { console.warn('Citas Tu Semana:', e); return { docs: [] }; });
      if (!_canCommitDashboardActivityRender(renderVersion, uid, strip)) return;

      citasSnap.docs.forEach(doc => {
        const data = doc.data();
        const slot = data.fechaHoraSlot?.toDate?.();
        if (!slot || slot < today || slot > endOfWeek || data.estado === 'cancelada' || data.estado === 'completada') return;

        const dayIdx = days.findIndex(d => slot >= d.date && slot < new Date(d.date.getTime() + 86400000));
        if (dayIdx !== -1 && !days[dayIdx].activities.includes('medi')) days[dayIdx].activities.push('medi');
      });

      // 2. Libros (Prestamos con devolucion esta semana)
      const biblioSnap = await _fetchWithTimeout(SIA.db.collection('prestamos-biblio')
        .where('studentId', '==', uid)
        .get()).catch(e => { console.warn('Biblio Tu Semana:', e); return { docs: [] }; });
      if (!_canCommitDashboardActivityRender(renderVersion, uid, strip)) return;

      biblioSnap.docs.forEach(doc => {
        const data = doc.data();
        const slot = data.fechaVencimiento?.toDate?.() || data.fechaExpiracionRecoleccion?.toDate?.();
        if (!['pendiente', 'pendiente_entrega', 'entregado'].includes(data.estado)) return;
        if (!slot || slot < today || slot > endOfWeek) return;

        const dayIdx = days.findIndex(d => slot >= d.date && slot < new Date(d.date.getTime() + 86400000));
        if (dayIdx !== -1 && !days[dayIdx].activities.includes('biblio')) days[dayIdx].activities.push('biblio');
      });

      // 3. Aula: publicaciones de tareas con fechaEntrega en la semana (nueva colección aula-publicaciones)
      const aulaTasks = Array.isArray(options?.aulaTasks) ? options.aulaTasks : [];
      aulaTasks.forEach((task) => {
        const slot = _dashToDate(task.dueAt);
        if (!slot) return;
        const dayIdx = days.findIndex(d => slot >= d.date && slot < new Date(d.date.getTime() + 86400000));
        if (dayIdx !== -1 && !days[dayIdx].activities.includes('aula')) days[dayIdx].activities.push('aula');
      });
      if (!_canCommitDashboardActivityRender(renderVersion, uid, strip)) return;

    } catch (e) {
      console.warn("Error cargando actividades semanales:", e);
    }

    const colorMap = {
      medi: '#00d0ff',
      biblio: '#ffd24d',
      aula: '#4e1bda'
    };

    const titleMap = { medi: 'Cita', biblio: 'Libro', aula: 'Curso' };

    // Mapeo de iconos dinamicos
    const iconMap = {
      medi: '<i class="bi bi-heart-pulse-fill"></i>',
      biblio: '<i class="bi bi-book-half"></i>',
      aula: '<i class="bi bi-mortarboard-fill"></i>'
    };

    if (!_canCommitDashboardActivityRender(renderVersion, uid, strip)) return;
    strip.innerHTML = days.map(d => {
      const hasActivity = d.activities.length > 0;
      const mainAct = hasActivity ? d.activities[0] : null;
      const mainColor = hasActivity ? (colorMap[mainAct] || '#0ea5e9') : '';

      // Diseño del nuevo cuadro: borde solido, texto negro.
      const borderStyle = d.isToday
        ? 'border: 2px solid var(--accent, #0ea5e9); background: linear-gradient(135deg, rgba(14,165,233,0.1), rgba(14,165,233,0.05));' // Hoy
        : hasActivity
          ? `border: 2px solid #111827; background: linear-gradient(135deg, ${mainColor}, ${mainColor}dd);` // Con actividad (negro)
          : 'border: 2px solid rgba(0,0,0,0.15); background: linear-gradient(135deg, rgba(240,240,240,0.8), rgba(220,220,220,0.5));'; // Default (gris)

      const textColor = hasActivity ? 'color:#fff;' : 'color: #111827; font-weight: 700;'; // Fuerte negro o blanco
      const dayNum = (d) => d.date.getDate();
      const dateKey = d.date.toLocaleDateString('es-MX');

      const todayLabel = d.isToday ? '<div class="activity-today-dot" style="background:var(--accent); width:6px; height:6px; border-radius:50%; margin: 6px auto 0;"></div>' : '';

      // Construir el min-badge flotante si hay actividades (Círculo con el ícono)
      let dynamicIconsHtml = '';
      if (hasActivity) {
        // Tomamos la primera actividad o mostramos un contador si son multiples
        const mainAct = d.activities[0];
        const mainIcon = iconMap[mainAct] || '<i class="bi bi-calendar-event"></i>';
        const extraCount = d.activities.length > 1 ? `+${d.activities.length - 1}` : '';

        dynamicIconsHtml = `
           <div class="position-absolute d-flex align-items-center justify-content-center shadow-sm" 
                style="top:-6px; right:-6px; background:#111827; color:#fff; width:22px; height:22px; border-radius:50%; font-size:0.6rem; border:2px solid #fff;">
             ${d.activities.length > 1 ? extraCount : mainIcon}
           </div>
         `;
      }

      const activityLabel = hasActivity
        ? `<div class="extra-small mt-2 fw-bold text-center" style="font-size:0.6rem;color:#111827;line-height:1.1;">${d.activities.map(a => titleMap[a] || a).join(', ')}${d.activities.length > 1 ? '<br><span class="text-muted">Carga alta</span>' : ''}</div>`
        : '';

      return `
        <div class="text-center flex-fill position-relative" style="transition: all 0.2s ease; width: 65px; flex-shrink: 0;">
          <div class="extra-small mb-2 fw-bold text-uppercase" style="font-size:0.75rem; letter-spacing: 0.5px; color: #111827;">${d.label}</div>
          <div class="activity-day-card mx-auto d-flex align-items-center justify-content-center shadow-sm position-relative" 
               style="${borderStyle} width:100%; height:60px; border-radius:12px; transition: all 0.3s ease; cursor:pointer;" 
               onclick="window.SIA.openDashboardDay('${dateKey}', '${mainAct || ''}')"
               title="${d.date.toLocaleDateString('es-MX')}${hasActivity ? ' — Actividad: ' + d.activities.map(a => titleMap[a] || a).join(', ') : ' — Sin actividad'}">
            <span style="font-size:1.1rem;${textColor}">${dayNum(d)}</span>
            ${dynamicIconsHtml}
          </div>
          ${todayLabel}
          ${activityLabel}
        </div>`;
    }).join('');
  }

  // ── C3-02: Events Strip ──
  function _renderEventsStrip(eventDocs) {
    const section = document.getElementById('dash-events-section');
    const strip = document.getElementById('dash-events-strip');
    if (!section || !strip) return;

    const scopeEnd = _getDashboardScopeEnd(_dashState.scope || 'week');
    const interestedEventIds = new Set(_getInterestedEventIds());
    const scopedEvents = (Array.isArray(eventDocs) ? eventDocs : []).filter((item) => {
      const ev = typeof item?.data === 'function' ? item.data() : item;
      const eventDate = _dashToDate(ev?.date || ev?.fecha);
      if (!eventDate) return false;
      if ((_dashState.scope || 'week') === 'all') return true;
      return eventDate <= scopeEnd;
    });
    _dashState.visibleEvents = scopedEvents;

    if (scopedEvents.length === 0) {
      strip.innerHTML = '';
      section.classList.add('d-none');
      _renderHeaderDashboardMeta();
      return;
    }

    section.classList.remove('d-none');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const escHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    strip.innerHTML = scopedEvents.map(item => {
      const ev = typeof item?.data === 'function' ? item.data() : item;
      const rawDate = ev?.date || ev?.fecha;
      const fecha = rawDate?.toDate ? rawDate.toDate() : (rawDate ? new Date(rawDate) : null);
      if (!fecha) return '';
      const daysLeft = Math.max(0, Math.ceil((fecha.getTime() - Date.now()) / 86400000));
      const dayNum = fecha.getDate();
      const monthStr = months[fecha.getMonth()];
      const title = String(ev.titulo || ev.title || 'Evento').substring(0, 30);
      const safeTitle = escHtml(title);
      const relativeLabel = daysLeft === 0 ? 'hoy' : `en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;
      const location = escHtml(ev.location || ev.ubicacion || '');
      const modality = escHtml(ev.modalidad || ev.mode || '');
      const capacity = Number(ev.capacity || ev.cupo || 0);
      const registered = Number(ev.registeredCount || ev.inscritos || 0);
      const isInterested = interestedEventIds.has(ev.id || item.id);

      // Generate .ics content
      const dtStart = fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const icsTitle = title.replace(/[\r\n,;]/g, ' ');
      const icsData = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:${dtStart}\r\nSUMMARY:${icsTitle}\r\nEND:VEVENT\r\nEND:VCALENDAR`;

      return `
        <div class="event-countdown-card p-3 rounded-4 shadow-sm position-relative" onclick="window.SIA.navigate('view-foro')">
          <div class="d-flex align-items-center gap-3">
            <div class="event-date-circle text-center flex-shrink-0">
              <div class="fw-bold" style="font-size:1.1rem;line-height:1;">${dayNum}</div>
              <div class="extra-small text-uppercase" style="opacity:0.7;">${monthStr}</div>
            </div>
            <div class="flex-grow-1" style="min-width:0;">
              <div class="fw-bold small text-truncate" style="color: var(--text-heading);">${safeTitle}</div>
              <div class="extra-small" style="color: var(--accent);">${relativeLabel}</div>
              ${(location || modality || capacity > 0) ? `
                <div class="extra-small text-muted mt-1">
                  ${location ? `<span class="me-2"><i class="bi bi-geo-alt me-1"></i>${location}</span>` : ''}
                  ${modality ? `<span class="me-2"><i class="bi bi-broadcast me-1"></i>${modality}</span>` : ''}
                  ${capacity > 0 ? `<span><i class="bi bi-people me-1"></i>${registered}/${capacity}</span>` : ''}
                </div>` : ''}
            </div>
            <button class="btn btn-link btn-sm p-0 flex-shrink-0 event-interest-btn ${isInterested ? 'is-active' : ''}" title="${isInterested ? 'Quitar interés' : 'Marcar interés'}"
              onclick="event.stopPropagation(); window.SIA.toggleDashboardEventInterest('${ev.id || item.id}');">
              <i class="bi ${isInterested ? 'bi-star-fill' : 'bi-star'}" style="color: ${isInterested ? '#f59e0b' : 'var(--accent)'};"></i>
            </button>
            <button class="btn btn-link btn-sm p-0 flex-shrink-0 event-cal-btn" title="Agregar a calendario"
              onclick="event.stopPropagation(); const b=new Blob(['${icsData.replace(/'/g, "\\'")}'],{type:'text/calendar'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='evento.ics'; a.click(); URL.revokeObjectURL(u);">
              <i class="bi bi-calendar-plus" style="color: var(--accent);"></i>
            </button>
          </div>
        </div>`;
    }).join('');
    _renderHeaderDashboardMeta();
  }

  // ── C3-05: Tip of the Day ──
  function _updateTipOfDay() {
    const tipText = document.getElementById('dash-tip-text');
    const tipIcon = document.getElementById('dash-tip-icon');
    const tipAction = document.getElementById('dash-tip-action');
    if (!tipText) return;

    const s = _dashStats;
    const profile = currentUserProfile;

    // Priority chain
    const tips = [];
    if (s.libroUrgente !== null && s.libroUrgente <= 0) {
      tips.push({ text: 'Tienes un libro con fecha de devolución vencida. Regrésalo cuanto antes para evitar sanciones.', icon: 'bi-exclamation-triangle-fill', color: '#ef4444', actionLabel: 'Ir a Biblioteca', action: () => window.SIA.navigate('view-biblio') });
    }
    if (profile && !(profile.tipoSangre || profile.healthData?.tipoSangre)) {
      tips.push({ text: 'Completa tu expediente médico (tipo de sangre, contacto de emergencia) para una atención más rápida en caso de urgencia.', icon: 'bi-heart-pulse', color: '#ef4444', actionLabel: 'Completar perfil', action: () => window.SIA.navigate('view-profile') });
    }
    if (s.aulaCount === 0) {
      tips.push({ text: 'Aún no te has inscrito a ningún curso en Aula Virtual. Explora el catálogo y obtén certificaciones que fortalecen tu CV.', icon: 'bi-mortarboard', color: 'var(--aula)', actionLabel: 'Explorar Aula', action: () => window.SIA.navigate('view-aula') });
    }
    if (s.encuestas > 0) {
      tips.push({ text: `Tienes ${s.encuestas} encuesta${s.encuestas > 1 ? 's' : ''} sin responder. Tu participación ayuda a mejorar los servicios del campus.`, icon: 'bi-clipboard-check', color: '#f59e0b', actionLabel: 'Responder', action: () => window.SIA.navigate('view-encuestas') });
    }

    // General tips pool (Expanded set)
    const generalTips = [
      { text: 'Puedes acceder a tu credencial digital desde el boton "Mi QR" en la esquina superior. Funciona como identificacion oficial dentro del campus.', icon: 'bi-qr-code-scan', color: 'var(--accent)' },
      { text: 'La Biblioteca tiene un amplio catálogo de libros de tu carrera. Pide un préstamo y llévalo a casa por hasta 7 días.', icon: 'bi-book-half', color: 'var(--biblio)' },
      { text: 'Mantente al dia con los Eventos del campus. Conferencias, exposiciones y talleres enriquecen tu formacion profesional y personal.', icon: 'bi-calendar-event', color: '#14532d' },
      { text: 'Si tienes alguna queja o sugerencia, el Buzon de Calidad es 100% confidencial y tu retroalimentacion genera cambios reales y tangibles.', icon: 'bi-chat-heart', color: '#10b981' },
      { text: 'Personaliza tu dashboard reordenando las tarjetas de módulos. Mantén pulsada tu opción favorita y arrástrala al inicio.', icon: 'bi-grid', color: 'var(--accent)' },
      { text: '¿Sabías que puedes ocultar el saldo o datos sensibles de tu cuenta usando el ojo de visibilidad en configuraciones rápidas?', icon: 'bi-eye-slash-fill', color: '#64748b' },
      { text: 'Responder frecuentemente las encuestas de módulo te cataloga como un estudiante destacado, lo que te puede otorgar recompensas especiales al finalizar el semestre.', icon: 'bi-star-fill', color: '#f59e0b' },
      { text: 'Los Servicios Médicos del campus ofrecen atención gratuita general. Puedes agendar citas directamente desde la app en horarios flexibles para ti.', icon: 'bi-heart-pulse', color: 'var(--med)' },
      { text: 'El Scorecard de Aula Virtual evalúa tu progreso. Terminar tus cursos dentro del plazo te dota de insignias especiales visibles para todos.', icon: 'bi-trophy-fill', color: 'var(--aula)' },
      { text: 'Puedes entrar de forma automática usando la app móvil o el escaneo PWA, de forma que el inicio de Microsoft será recordado sin tiempos de espera.', icon: 'bi-phone', color: '#a855f7' },
      { text: 'La herramienta de "Reportar Problema" llega de inmediato al área de IT del campus para resolver problemas técnicos en el menor tiempo.', icon: 'bi-bug-fill', color: '#ef4444' },
      { text: 'Un libro vencido tiene un recargo por día, pero si no se devuelve a tiempo puede causar el bloqueo del resto de los procesos administrativos.', icon: 'bi-exclamation-triangle', color: '#f97316' },
      { text: 'La Credencial SIA te permite entrar como visitante rápido a los otros campus del TecNM si acreditas por código de barras ser un vigente local.', icon: 'bi-building', color: '#3b82f6' },
      { text: 'Si ves la tarjeta de Lactancia significa que cumples con los perfiles del campus. Estas salas proveen recursos higiénicos sin cargo alguno.', icon: 'bi-hospital', color: '#ec4899' },
      { text: '¿Aburrido? El módulo de Novedades se actualiza con artículos diarios recomendados por la dirección sobre innovación en distintas carreras.', icon: 'bi-newspaper', color: '#14b8a6' }
    ];

    // Pick tip: priority first, then daily rotation from general pool
    let tip;
    if (tips.length > 0) {
      tip = tips[0];
    } else {
      const dayIdx = Math.floor(Date.now() / 86400000) % generalTips.length;
      tip = generalTips[dayIdx];
    }

    tipText.textContent = tip.text;
    if (tipIcon) {
      tipIcon.className = `bi ${tip.icon}`;
      tipIcon.style.color = tip.color || 'var(--accent)';
    }
    const iconWrap = document.getElementById('dash-tip-icon-wrap');
    if (iconWrap && tip.color) {
      iconWrap.style.background = tip.color.startsWith('#') ? `${tip.color}18` : `rgba(0,208,255,0.12)`;
    }
    if (tipAction) {
      if (typeof tip.action === 'function') {
        tipAction.classList.remove('d-none');
        tipAction.textContent = tip.actionLabel || 'Resolver ahora';
        tipAction.onclick = tip.action;
      } else {
        tipAction.classList.add('d-none');
        tipAction.onclick = null;
      }
    }
  }

  // Compat legacy: algunos puntos externos todavia invocan window.loadDashboard
  window.loadDashboard = loadDashboard;
  window.SIA.loadDashboard = loadDashboard;

  window.SIA.refreshStudentDashboard = async function () {
    if (!shouldUseStandardDashboard(currentUserProfile)) return [];
    const tasks = [];
    if (typeof window.SIA?.updateSmartCards === 'function') tasks.push(window.SIA.updateSmartCards());
    if (typeof renderDashboardStories === 'function') tasks.push(renderDashboardStories());
    if (typeof checkAndShowAvisos === 'function') tasks.push(checkAndShowAvisos());
    return Promise.allSettled(tasks);
  };

  // Loop para mantener el dashboard "vivo", pero con menos solicitudes a Firestore
  setInterval(() => {
    // Si el tutorial está activo, no refrescamos para evitar que la UI se mueva
    if (window.SIA_TOUR_ACTIVE) return;

    const dash = document.getElementById('view-dashboard');
    if (dash && !dash.classList.contains('d-none') && currentUserProfile) {
      if (typeof window.SIA?.refreshStudentDashboard === 'function') {
        window.SIA.refreshStudentDashboard();
      }
    }
  }, 300000); // 5 minutos (300,000 ms) en lugar de 30 segundos

  // ==============================================
  // 5. SISTEMA DE AVISOS INSTITUCIONALES
  // ==============================================

  // --- 5a. ADMIN PANEL (Difusión) ---

  let _editingAvisoId = null;

  window.openAvisosAdminPanel = async function () {
    if (window.SIA?._router) {
      await window.SIA._router.navigate('view-avisos');
    } else if (window.SIA?.navigate) {
      await window.SIA.navigate('view-avisos');
    }
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

        const typeBadge = { 'image': '🖼️ Imagen', 'text': '📝 Texto', 'mixed': '🔀 Mixto' }[a.type] || a.type;
        const createdDate = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('es-MX') : 'N/A';
        const thumbnailHtml = a.imageUrl ? `<img src="${a.imageUrl}" class="rounded-3" style="width:80px; height:80px; object-fit:cover;">` : `<div class="rounded-3  d-flex align-items-center justify-content-center" style="width:80px; height:80px;"><i class="bi bi-file-text fs-3 text-muted"></i></div>`;

        return `<div class="col-12"><div class="card border-0 shadow-sm rounded-3 overflow-hidden"><div class="card-body p-3 d-flex gap-3 align-items-center">${thumbnailHtml}<div class="flex-grow-1"><div class="d-flex align-items-center gap-2 mb-1"><h6 class="fw-bold mb-0 text-truncate">${a.title}</h6>${statusBadge}</div><div class="d-flex gap-3 extra-small text-muted"><span>${typeBadge}</span><span><i class="bi bi-calendar3 me-1"></i>${createdDate}</span><span><i class="bi bi-eye me-1"></i>${a.viewCount || 0} vistas</span>${a.priority === 'urgent' ? '<span class="text-danger fw-bold">🔴 Urgente</span>' : ''}</div></div><div class="d-flex gap-1"><button class="btn btn-sm btn-outline-${a.status === 'active' ? 'warning' : 'success'} rounded-pill" onclick="window._toggleAviso('${a.id}')"><i class="bi bi-${a.status === 'active' ? 'pause-fill' : 'play-fill'}"></i></button><button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window._editAviso('${a.id}')"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger rounded-pill" onclick="window._deleteAviso('${a.id}')"><i class="bi bi-trash3"></i></button></div></div></div></div>`;
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
  let _avisoTrackTimer = null;
  let _avisoViewerOptions = {};
  let _trackedAvisosInSession = {};

  async function checkAndShowAvisos() {
    if (!window.AvisosService || window.SIA_TOUR_ACTIVE) return;
    try {
      const ctx = getCtx();
      if (!ctx.auth?.currentUser) return;
      const avisos = await AvisosService.getActiveAvisos(ctx);
      const unseen = avisos.filter(a => !AvisosService.hasSeenLocal(ctx, a.id));

      if (unseen.length === 0) return;
      _showAvisoFullscreen(unseen, 0, { source: 'auto', track: true, ctx });
    } catch (e) { console.warn('[Avisos] Error checking avisos:', e); }
  }

  function _clearAvisoTrackingTimer() {
    if (_avisoTrackTimer) {
      clearTimeout(_avisoTrackTimer);
      _avisoTrackTimer = null;
    }
  }

  function _scheduleAvisoTracking(aviso) {
    _clearAvisoTrackingTimer();
    if (!_avisoViewerOptions.track || !aviso?.id || _trackedAvisosInSession[aviso.id]) return;

    _avisoTrackTimer = setTimeout(async () => {
      try {
        const ctx = _avisoViewerOptions.ctx || getCtx();
        if (document.hidden) return;
        _trackedAvisosInSession[aviso.id] = true;
        await window.AvisosService?.recordView?.(ctx, aviso.id, {
          source: _avisoViewerOptions.source || 'center',
          completed: true
        });
        if (window.Avisos?.refresh && (window.location.pathname === '/avisos' || Store.currentView === 'view-avisos')) {
          window.Avisos.refresh();
        }
      } catch (error) {
        console.warn('[Avisos] Error registrando visualizacion:', error);
      }
    }, 1200);
  }

  function _showAvisoFullscreen(avisos, startIndex, options) {
    _currentAvisos = avisos;
    _currentAvisoIndex = startIndex || 0;
    _avisoViewerOptions = options || {};
    _trackedAvisosInSession = {};
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
      _clearAvisoTrackingTimer();
      if (_avisoAnimation) { _avisoAnimation.cancel(); _avisoAnimation = null; }
      document.querySelectorAll('.aviso-progress-fill').forEach(el => el.style.width = '0%');
      modal.hide();
    };

    const prevBtn = document.getElementById('aviso-nav-prev');
    const nextBtn = document.getElementById('aviso-nav-next');
    if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); _navigateAviso(-1); };
    if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); _navigateAviso(1); };

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
    const safeTitle = typeof escapeHtml === 'function' ? escapeHtml(aviso.title || '') : (aviso.title || '');
    const safeBody = typeof escapeHtml === 'function' ? escapeHtml(aviso.body || '') : (aviso.body || '');
    const safeImageUrl = typeof escapeHtml === 'function' ? escapeHtml(aviso.imageUrl || '') : (aviso.imageUrl || '');

    let contentHtml = '';
    if (aviso.type === 'image' && aviso.imageUrl) {
      contentHtml = `<img src="${safeImageUrl}" class="aviso-fullscreen-img" style="max-width:100%; max-height:85vh; object-fit:contain; cursor:pointer;" onclick="window._navigateAviso(1)">`;
    } else if (aviso.type === 'text') {
      contentHtml = `<div class="aviso-text-card text-center text-white p-4 p-md-5" style="max-width:600px;">${aviso.priority === 'urgent' ? '<div class="badge bg-danger mb-3 rounded-pill px-3 py-2">🔴 URGENTE</div>' : ''}<h1 class="fw-bold display-5 mb-4">${aviso.title}</h1><p class="lead opacity-90 mb-4" style="white-space:pre-line;">${aviso.body || ''}</p><div class="d-flex justify-content-center gap-2 mt-4"><img src="/images/logo-sia.png" width="30" class="filter-white opacity-50"><span class="text-white-50 small align-self-center">SIA - TecNM Los Cabos</span></div></div>`;
    } else {
      contentHtml = `<div class="aviso-mixed-card position-relative h-100 w-100 d-flex flex-column rounded-4 overflow-hidden">${aviso.imageUrl ? `<div class="flex-grow-1 d-flex align-items-center justify-content-center overflow-hidden" style="min-height:0;"><img src="${aviso.imageUrl}" style="max-width:100%; max-height:60vh; object-fit:contain;"></div>` : ''}<div class="aviso-mixed-text text-white p-4 text-center" style="background: linear-gradient(transparent, rgba(0,0,0,0.9));">${aviso.priority === 'urgent' ? '<div class="badge bg-danger mb-2 rounded-pill">🔴 URGENTE</div>' : ''}<h3 class="fw-bold mb-2">${aviso.title}</h3><p class="small opacity-90 mb-0" style="white-space:pre-line;">${aviso.body || ''}</p></div></div>`;
    }
    container.innerHTML = contentHtml;

    document.querySelectorAll('.aviso-progress-fill').forEach(fill => {
      const idx = parseInt(fill.dataset.index);
      if (fill.getAnimations) fill.getAnimations().forEach(anim => anim.cancel());
      fill.style.width = (idx < _currentAvisoIndex) ? '100%' : '0%';
    });
    _updateAvisoNav();
    _scheduleAvisoTracking(aviso);
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
    _clearAvisoTrackingTimer();
    if (_avisoAnimation) { _avisoAnimation.cancel(); _avisoAnimation = null; }
    _currentAvisos = [];
    _currentAvisoIndex = 0;
    _avisoViewerOptions = {};
    _trackedAvisosInSession = {};
  });


  // --- 5c. STORY CLICK: Open aviso from stories ---

  function _openAvisoStoryPreviewModal(aviso, ctx) {
    _showAvisoFullscreen([aviso], 0, { source: 'story', track: true, ctx: ctx || getCtx() });
  }

  window.showAvisoFullscreen = function (avisos, startIndex, options) {
    _showAvisoFullscreen(avisos, startIndex, options);
  };


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
      'view-comunidad': { title: "Comunidad", desc: "Publicaciones, preguntas y campus social", img: "images/comunidad.png", color: "success" },
      'view-foro': { title: "Eventos", desc: "Agenda, asistencia y recursos", img: "images/foro.png", color: "info" },
      'view-quejas': { title: "Quejas y Sugerencias", desc: "Gestión de Tickets y Calidad", img: null, icon: "bi-chat-heart-fill", color: "primary" },
      'view-encuestas': { title: "Centro de Encuestas", desc: "Crear y analizar encuestas", img: null, icon: "bi-clipboard2-check-fill", color: "info" },
      'view-avisos': { title: "Avisos Institucionales", desc: "Publicar anuncios para toda la comunidad", img: null, icon: "bi-megaphone-fill", color: "success" },
      'view-vocacional-admin': { title: "Test Vocacional", desc: "CRM de Aspirantes y Métricas", img: null, icon: "bi-compass", color: "primary" }
    };

    gridEl.innerHTML = '';

    const views = getEffectiveAllowedViews(profile);

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
        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden hover-scale cursor-pointer" onclick="SIA.navigate('${viewId}')">
          <div class="card-body p-4 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-4">
              <div class="p-2 rounded-4  d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
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

