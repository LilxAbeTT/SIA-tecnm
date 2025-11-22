// app.js
// Lógica principal: Auth, Router, Landing y Módulos (VERSIÓN BLINDADA v2.2)

document.addEventListener('DOMContentLoaded', () => {
  console.log("SIA App: Iniciando...");


  // ==========================================
  // 1. ESTADO GLOBAL
  // ==========================================
  let currentUserProfile = null;
  let activeUnsubs = [];

  let globalAvisosUnsub = null;
  let globalAvisosRaw = [];
  let globalAvisosData = [];
  let globalAvisosIndex = 0;
  let globalAvisosTimer = null;
  let currentModuleKey = 'general';
  let notifUnsub = null;

  const clearSubscriptions = () => {
    activeUnsubs.forEach(u => u && u());
    activeUnsubs = [];
    // NUEVO: Limpiar notificaciones
    if (notifUnsub) { notifUnsub(); notifUnsub = null; }
  };

  // ==========================================
  // 2. ELEMENTOS DEL DOM
  // ==========================================
  const appLoader = document.getElementById('app-loader');
  const landingView = document.getElementById('landing-view');
  const appShell = document.getElementById('app-shell');
  const verifyShell = document.getElementById('verify-shell');

  // Navbar / User Info
  const userEmailNav = document.getElementById('user-email');
  const userEmailDashboard = document.getElementById('user-email-dashboard');
  const btnLoginGoogle = document.getElementById('btn-login-google');
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

  // KPIs (Dashboard) - Usamos optional chaining (?) más adelante por si faltan
  const dashMediCount = document.getElementById('dash-medi-count');
  const dashBiblioCount = document.getElementById('dash-biblio-count');
  const dashAulaCount = document.getElementById('dash-aula-count');
  const dashMediLabel = document.getElementById('dash-medi-label');
  const dashBiblioLabel = document.getElementById('dash-biblio-label');
  const dashAulaLabel = document.getElementById('dash-aula-label');

  // ==========================================
  // 3. SISTEMA DE SEGURIDAD (TIMEOUT)
  // ==========================================
  // Si Firebase falla o tarda mucho, forzamos la entrada para no dejar al usuario trabado.
  const safetyTimer = setTimeout(() => {
    if (appLoader && !appLoader.classList.contains('d-none')) {
      console.warn("⚠️ Tiempo de espera agotado. Forzando ocultamiento del loader.");
      hideLoader();

      const path = window.location.pathname || '/';

      if (path.startsWith('/verify/')) {
        // Si algo salió mal con Firebase/Auth, al menos mostramos la vista de verificación
        showVerifyShell();
        const folio = parseFolioFromPath(path);
        // Llamamos verificación de forma segura
        setTimeout(() => {
          verifyCertificateByFolio(folio);
        }, 0);
      } else if (
        landingView && landingView.classList.contains('d-none') &&
        appShell && appShell.classList.contains('d-none')
      ) {
        showLanding(); // Fallback normal
      }
    }
  }, 5000);

  // Helper: Generar iniciales
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  // Helper: Actualizar Info Navbar (NUEVO)
  function updateNavbarUserInfo(name, role, email) {
    const navName = document.getElementById('user-name-nav');
    const navRole = document.getElementById('user-role-nav');
    const navEmail = document.getElementById('user-email-nav');
    if (navName) navName.textContent = name;
    if (navRole) navRole.textContent = role ? role.toUpperCase() : 'ESTUDIANTE';
    if (navEmail) navEmail.textContent = email;
  }

  // Helper: Renderizar Avatares
  function updateUserAvatars(name) {
    const initials = getInitials(name);

    // 1. Avatar del Navbar (Dropdown)
    const navAvatarBtn = document.querySelector('.navbar .dropdown button div');
    if (navAvatarBtn) {
      navAvatarBtn.innerHTML = `<span class="fw-bold text-white" style="font-size: 1rem; letter-spacing: -1px;">${initials}</span>`;
      // Quitar icono si existe
      // navAvatarBtn.classList.add('avatar-initials'); // Opcional si quieres reusar clase
    }

    // 2. Avatar Grande (Vista Perfil)
    const bigAvatar = document.getElementById('profile-avatar-big');
    if (bigAvatar) bigAvatar.textContent = initials;
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

  // ==========================================
  // 4. AUTENTICACIÓN & FLUJO PRINCIPAL
  // ==========================================
  SIA.auth.onAuthStateChanged(async (user) => {
    console.log("🔐 Estado Auth:", user ? "Usuario Logueado" : "Invitado");

    const path = window.location.pathname || '/';

    if (!user) {
      // ===== CASO 1: NO LOGUEADO =====
      currentUserProfile = null;
      clearSubscriptions();

      // Limpiar suscripción y estado del banner global de avisos
      if (globalAvisosUnsub) {
        globalAvisosUnsub();
        globalAvisosUnsub = null;
      }
      globalAvisosRaw = [];
      globalAvisosData = [];
      globalAvisosIndex = 0;
      clearGlobalAvisosLoop();
      renderGlobalAvisoActual();

      // Si la URL es /verify/<folio>, mostramos directamente el verificador
      if (path.startsWith('/verify/')) {
        startVerifyFlowFromCurrentPath();
      } else {
        showLanding();
      }

    } else {
      // ===== CASO 2: LOGUEADO =====
      try {
        // a) Cargar Perfil
        currentUserProfile = await SIA.ensureProfile(user);
        console.log("👤 Perfil cargado:", currentUserProfile.role);
        // --- FASE 2: Actualizar UI de Identidad ---
        const displayName = currentUserProfile.displayName || user.email.split('@')[0];
        updateUserAvatars(displayName);
        updateNavbarUserInfo(displayName, currentUserProfile.role, user.email);

        // initNotifications(user.uid);
        // Rellenar datos de la vista de perfil
        const profName = document.getElementById('profile-fullname');
        const profMeta = document.getElementById('profile-role-email');
        if (profName) profName.textContent = displayName;
        if (profMeta) profMeta.textContent = `${currentUserProfile.role || 'Estudiante'} • ${user.email}`;
        // ------------------------------------------
        // b) UI Usuario
        if (userEmailNav) userEmailNav.textContent = user.email;
        if (userEmailDashboard) userEmailDashboard.textContent = user.email;

        // c) Verificamos si la ruta es de verificación
        if (path.startsWith('/verify/')) {
          // Vista especial: verificador (sin entrar al shell principal)
          startVerifyFlowFromCurrentPath();
        } else {
          // d) App normal
          showApp();
          initGlobalAvisosListener();

          if (path === '/' || path === '') {
            navigate('view-dashboard');
          } else {
            // Deep link a /aula, /biblio, /medi, etc.
            handleLocation();
          }
        }
      } catch (e) {
        console.error("❌ Error cargando perfil:", e);
        if (typeof showToast === 'function') showToast('Error cargando perfil', 'danger');
        showLanding(); // Fallback si falla el perfil
      }
    }

    // Ocultar Loader (Éxito)
    hideLoader();
  });



  // --- Funciones de Cambio de Escena ---

  function showLanding() {
    if (landingView) landingView.classList.remove('d-none');
    if (appShell) appShell.classList.add('d-none');
    if (verifyShell) verifyShell.classList.add('d-none');
    if (fabAddCourse) fabAddCourse.classList.add('d-none');

    if (userEmailNav) userEmailNav.textContent = '';
    currentUserProfile = null;
    clearSubscriptions();
  }

  function showApp() {
    if (landingView) landingView.classList.add('d-none');
    if (appShell) appShell.classList.remove('d-none');
    if (verifyShell) verifyShell.classList.add('d-none');
  }

  function showVerifyShell() {
    if (landingView) landingView.classList.add('d-none');
    if (appShell) appShell.classList.add('d-none');
    if (verifyShell) verifyShell.classList.remove('d-none');
    if (fabAddCourse) fabAddCourse.classList.add('d-none');
  }

  async function loginConGoogle(e) {
    if (e) e.preventDefault();

    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await SIA.auth.signInWithPopup(provider);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      if (typeof showToast === 'function') {
        showToast('No se pudo iniciar sesión con Google. Revisa el bloqueador de ventanas emergentes.', 'danger');
      }
    }
  }



  function logout() {
    if (appLoader) {
      appLoader.classList.remove('d-none');
      appLoader.style.opacity = '1';
    }

    // 1) Limpiamos estado de la app al instante
    currentUserProfile = null;
    clearSubscriptions();
    if (typeof Medi !== 'undefined' && Medi.cleanup) Medi.cleanup();

    showLanding();
    window.SIA_currentCourseId = null;

    // 2) Reseteamos la URL a la raíz (landing)
    history.pushState({ viewId: 'landing' }, '', '/');

    // 3) Cerramos sesión en Firebase
    SIA.auth.signOut();
  }


  // ==========================================
  // 5. LÓGICA DE MÓDULOS (CONTEXTO)
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
  };

  function getCtx() {
    return { auth: SIA.auth, db: SIA.db, currentUserProfile, activeUnsubs };
  }

  function moduleKeyFromView(viewId) {
    if (viewId === 'view-aula') return 'aula';
    if (viewId === 'view-biblio') return 'biblio';
    if (viewId === 'view-medi') return 'medi';
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

    // Ocultar en dashboard (es la home)
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
      case 'view-aula-course': label = 'Aula'; break; // Caso especial curso
      default: label = 'Sección';
    }

    // Si estamos en un curso específico, agregamos el nivel extra
    if (viewId === 'view-aula-course') {
      // Esto es un truco rápido para breadcrumbs de 3 niveles
      // Lo ideal sería reconstruir el <ol>, pero por simplicidad:
      currentEl.innerHTML = `<a href="#" onclick="SIA_navToAula(); return false;" class="text-decoration-none text-muted">Aula</a> <span class="mx-1">/</span> <span class="fw-bold text-primary">${extraLabel || 'Curso'}</span>`;
    } else {
      currentEl.textContent = label;
      currentEl.classList.add('fw-bold', 'text-primary');
    }
  }

  function normalizeAvisoGlobal(data, id) {
    const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null;
    const activaDesde = data.activaDesde && data.activaDesde.toDate ? data.activaDesde.toDate() : null;
    const activaHasta = data.activaHasta && data.activaHasta.toDate ? data.activaHasta.toDate() : null;

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

    if (!globalAvisosData.length) {
      globalAvisosContainer.textContent = 'No hay avisos activos.';
      return;
    }

    const aviso = globalAvisosData[globalAvisosIndex] || globalAvisosData[0];

    const iconMap = {
      urgente: { icon: 'bi-exclamation-octagon-fill', label: 'Urgente' },
      info: { icon: 'bi-info-circle-fill', label: 'Información' },
      recomendacion: { icon: 'bi-lightbulb-fill', label: 'Recomendación' },
      aviso: { icon: 'bi-megaphone-fill', label: 'Aviso' },
    };

    const meta = iconMap[aviso.tipo] || iconMap.aviso;

    globalAvisosContainer.innerHTML =
      '<span class="badge bg-dark-subtle text-dark me-2">' +
      meta.label +
      '</span>' +
      (aviso.texto || '');
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

  function pauseGlobalAvisos() {
    clearGlobalAvisosLoop();
  }

  function resumeGlobalAvisos() {
    if (!globalAvisosData.length || globalAvisosData.length <= 1) return;
    if (globalAvisosTimer) return;

    globalAvisosTimer = setInterval(() => {
      if (!globalAvisosData.length) return;
      globalAvisosIndex = (globalAvisosIndex + 1) % globalAvisosData.length;
      renderGlobalAvisoActual();
    }, 8000);
  }

  function rebuildGlobalAvisosData() {
    if (!globalAvisosContainer) return;

    if (!globalAvisosRaw.length) {
      globalAvisosData = [];
      globalAvisosIndex = 0;
      renderGlobalAvisoActual();
      resetGlobalAvisosLoop();
      return;
    }

    globalAvisosData = filtrarYOrdenarAvisosGlobal(globalAvisosRaw, currentModuleKey);
    globalAvisosIndex = 0;
    renderGlobalAvisoActual();
    resetGlobalAvisosLoop();
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

        listEl.innerHTML = data
          .map((a) => {
            const dateStr = a.createdAt ? a.createdAt.toLocaleString() : '';

            const iconMap = {
              urgente: 'bi-exclamation-octagon-fill',
              info: 'bi-info-circle-fill',
              recomendacion: 'bi-lightbulb-fill',
              aviso: 'bi-megaphone-fill',
            };
            const icon = iconMap[a.tipo] || iconMap.aviso;
            const tipoLabel = (a.tipo || 'aviso').toUpperCase();
            const moduloLabel = a.modulo ? a.modulo.toUpperCase() : 'GLOBAL';

            return (
              '<li class="list-group-item border-0 border-bottom px-0">' +
              '<div class="d-flex align-items-start gap-2">' +
              '<div class="text-warning mt-1"><i class="bi ' +
              icon +
              '"></i></div>' +
              '<div class="flex-grow-1">' +
              '<div class="d-flex justify-content-between align-items-center mb-1">' +
              '<div>' +
              '<span class="badge text-bg-dark-subtle me-1">' +
              tipoLabel +
              '</span>' +
              '<span class="badge text-bg-light">' +
              moduloLabel +
              '</span>' +
              '</div>' +
              (dateStr
                ? '<span class="small text-muted ms-2">' + dateStr + '</span>'
                : '') +
              '</div>' +
              '<div>' +
              (a.texto || '') +
              '</div>' +
              '</div>' +
              '</div>' +
              '</li>'
            );
          })
          .join('');
      }

      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch (err) {
      console.error('Error listando avisos', err);
    }
  }

  function initGlobalAvisosListener() {
    if (!globalAvisosContainer || !SIA.db || typeof AulaService === 'undefined') return;

    const ctx = getCtx();

    if (globalAvisosUnsub) {
      globalAvisosUnsub();
      globalAvisosUnsub = null;
    }

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
    const saWrap = document.getElementById('aula-superadmin'); // Nuevo contenedor

    if (typeof Aula === 'undefined') return;

    // Reset visibilidad
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
    badgeEl.className = 'badge bg-secondary-subtle text-secondary';
    loadingEl.classList.remove('d-none');
    okEl.classList.add('d-none');
    errEl.classList.add('d-none');
    okEl.innerHTML = '';
    errEl.innerHTML = '';

    const folioInput = (folioRaw || '').trim();
    if (!folioInput) {
      loadingEl.classList.add('d-none');
      badgeEl.textContent = 'Folio inválido';
      badgeEl.className = 'badge bg-danger-subtle text-danger';
      errEl.classList.remove('d-none');
      errEl.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-exclamation-triangle text-danger fs-1 mb-3"></i>
        <h2 class="h5 fw-bold mb-2">Folio inválido</h2>
        <p class="small text-muted mb-0">
          El enlace de verificación no contiene un folio válido.
        </p>
      </div>
    `;
      return;
    }

    try {
      const db = SIA.db;
      if (!db) throw new Error('DB no inicializada');

      const folioTrim = folioInput;            // tal cual viene en la URL
      const folioUpper = folioTrim.toUpperCase();

      let certSnap = null;

      // 1) Intento directo por ID EXACTO (tal cual viene en la URL)
      const directSnap = await db
        .collection('aula-certificados')
        .doc(folioTrim)
        .get();

      if (directSnap.exists) {
        certSnap = directSnap; // DocumentSnapshot
      }

      // 2) Si no existe por ID, buscar por campo "folio" EXACTO
      if (!certSnap) {
        const q1 = await db.collection('aula-certificados')
          .where('folio', '==', folioTrim)
          .limit(1)
          .get();

        if (!q1.empty) {
          certSnap = q1.docs[0]; // QueryDocumentSnapshot
        }
      }

      // 3) Compatibilidad: buscar por "folioUpper" (para aceptar mayús/minús indistinto)
      if (!certSnap) {
        const q2 = await db.collection('aula-certificados')
          .where('folioUpper', '==', folioUpper)
          .limit(1)
          .get();

        if (!q2.empty) {
          certSnap = q2.docs[0];
        }
      }

      // 4) Fallback final: escanear hasta 1000 docs y comparar id.toUpperCase()
      if (!certSnap) {
        const snapAll = await db.collection('aula-certificados')
          .limit(1000)
          .get();

        const match = snapAll.docs.find(d => d.id.toUpperCase() === folioUpper);
        if (match) {
          certSnap = match;
        }
      }

      // 🔴 OJO: aquí el bug que traías era usar "!certSnap.exists".
      // QueryDocumentSnapshot NO tiene "exists", así que eso rompía la verificación.
      if (!certSnap) {
        loadingEl.classList.add('d-none');
        badgeEl.textContent = 'No válida';
        badgeEl.className = 'badge bg-danger-subtle text-danger';

        errEl.classList.remove('d-none');
        errEl.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-exclamation-triangle text-danger fs-1 mb-3"></i>
          <h2 class="h5 fw-bold mb-2">Constancia no válida</h2>
          <p class="small text-muted mb-0">
            No se encontró ninguna constancia asociada al folio
            <strong>${folioTrim}</strong> en SIA.
          </p>
        </div>
      `;
        return;
      }

      // Parche: dejar siempre guardado folio y folioUpper para futuras búsquedas rápidas
      try {
        await db.collection('aula-certificados')
          .doc(certSnap.id)
          .set(
            {
              folio: certSnap.id,
              folioUpper: certSnap.id.toUpperCase()
            },
            { merge: true }
          );
      } catch (e) {
        console.warn('No se pudo actualizar alias de folio al verificar:', e);
      }

      // ====== A PARTIR DE AQUÍ, YA TENEMOS CERTIFICADO VÁLIDO ======
      const cert = certSnap.data() || {};

      const uid = cert.uid || cert.userId || cert.studentId || null;
      const cursoId = cert.cursoId || cert.courseId || null;

      const issuedAt = cert.issuedAt && typeof cert.issuedAt.toDate === 'function'
        ? cert.issuedAt.toDate()
        : null;
      const fechaStr = issuedAt ? issuedAt.toLocaleDateString() : '—';

      const score = (typeof cert.score !== 'undefined' && cert.score !== null)
        ? cert.score
        : '—';

      let horas = cert.horas || cert.duracionHoras || null;

      let name = cert.studentName || cert.alumnoNombre || '';
      let matricula = cert.matricula || cert.matriculaTec || '';

      // Folio REAL (tal cual está en Firestore)
      const folioReal = certSnap.id;

      // =================================================================
      //  Datos extra de curso y usuario  (opcionales, sólo si hay sesión)
      // =================================================================
      let cursoTitulo = cert.cursoTitulo || '';
      let cursoData = null;
      let userData = null;

      const authUser = SIA.auth?.currentUser || null;
      const profile = currentUserProfile || null;
      const loggedIn = !!authUser;

      // Podemos leer aula-cursos si hay sesión (regla: isSignedIn())
      if (cursoId && loggedIn) {
        try {
          const s = await db.collection('aula-cursos').doc(cursoId).get();
          if (s.exists) cursoData = s.data();
        } catch (e) {
          console.warn('No se pudo leer aula-cursos (no bloquea verificación pública):', e);
        }
      }

      // Podemos leer usuarios si:
      //  - somos ese mismo uid, o
      //  - tenemos rol aula o medico
      const canReadUser =
        loggedIn &&
        (
          (authUser.uid === uid) ||
          (profile && (profile.role === 'aula' || profile.role === 'medico'))
        );

      if (uid && canReadUser) {
        try {
          const s = await db.collection('usuarios').doc(uid).get();
          if (s.exists) userData = s.data();
        } catch (e) {
          console.warn('No se pudo leer usuarios (no bloquea verificación pública):', e);
        }
      }

      if (!cursoTitulo && cursoData?.titulo) {
        cursoTitulo = cursoData.titulo;
      }
      if (!horas && cursoData?.duracionHoras) {
        horas = cursoData.duracionHoras;
      }

      if (!name && userData?.displayName) {
        name = userData.displayName;
      }
      if (!matricula && (userData?.matricula || userData?.matriculaTec)) {
        matricula = userData.matricula || userData.matriculaTec;
      }

      const horasStr = horas ? `${horas} hora${horas === 1 ? '' : 's'}` : '—';

      const campus = cert.campus || 'TecNM Campus Los Cabos';
      const proyecto = cert.proyecto || 'Sistema de Integración Académico (SIA)';

      // ¿El usuario actual es el dueño? (solo si hay sesión)
      let ownerNote = '';
      if (authUser && uid && authUser.uid === uid) {
        ownerNote =
          '<p class="small text-success mb-0 mt-2">' +
          '<i class="bi bi-person-badge me-1"></i>' +
          'Esta constancia pertenece a la cuenta con la que has iniciado sesión.' +
          '</p>';
      }

      // 5) Render OK
      loadingEl.classList.add('d-none');
      okEl.classList.remove('d-none');
      badgeEl.textContent = 'Válida';
      badgeEl.className = 'badge bg-success-subtle text-success';

      okEl.innerHTML = `
      <div class="alert alert-success d-flex align-items-start gap-3 mb-4">
        <i class="bi bi-patch-check-fill fs-3"></i>
        <div>
          <h2 class="h6 mb-1">Constancia válida</h2>
          <p class="small mb-0">
            Esta constancia fue emitida electrónicamente por SIA y es auténtica.
          </p>
          ${ownerNote}
        </div>
      </div>

      <dl class="row small mb-0">
        <dt class="col-sm-3 text-muted">Folio</dt>
        <dd class="col-sm-9">${folioReal}</dd>

        <dt class="col-sm-3 text-muted">Alumno</dt>
        <dd class="col-sm-9">${name || '(Dato no disponible)'}</dd>

        ${matricula ? `
        <dt class="col-sm-3 text-muted">Matrícula</dt>
        <dd class="col-sm-9">${matricula}</dd>` : ''}

        <dt class="col-sm-3 text-muted">Curso</dt>
        <dd class="col-sm-9">${cursoTitulo || '(Sin título registrado)'}</dd>

        <dt class="col-sm-3 text-muted">Promedio final</dt>
        <dd class="col-sm-9">${score}</dd>

        <dt class="col-sm-3 text-muted">Duración</dt>
        <dd class="col-sm-9">${horasStr}</dd>

        <dt class="col-sm-3 text-muted">Fecha de emisión</dt>
        <dd class="col-sm-9">${fechaStr}</dd>

        <dt class="col-sm-3 text-muted">Emitido por</dt>
        <dd class="col-sm-9">${proyecto} — ${campus}</dd>
      </dl>
    `;
    } catch (err) {
      console.error('Error verificando constancia', err);
      loadingEl.classList.add('d-none');
      badgeEl.textContent = 'Error';
      badgeEl.className = 'badge bg-danger-subtle text-danger';

      errEl.classList.remove('d-none');
      errEl.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-x-octagon text-danger fs-1 mb-3"></i>
        <h2 class="h5 fw-bold mb-2">No se pudo verificar</h2>
        <p class="small text-muted mb-0">
          Ocurrió un problema al consultar la información. Intenta de nuevo más tarde.
        </p>
      </div>
    `;
    }
  }







  function startVerifyFlowFromCurrentPath() {
    const folio = parseFolioFromPath(window.location.pathname);
    showVerifyShell();

    // Pequeño diferido para no romper onAuthStateChanged si algo falla
    setTimeout(() => {
      verifyCertificateByFolio(folio);
    }, 0);
  }



  const routeMap = {
    'view-dashboard': '/dashboard',
    'view-aula': '/aula',
    'view-biblio': '/biblio',
    'view-medi': '/medi'
  };

  function getPathForView(viewId) {
    return routeMap[viewId] || '/dashboard';
  }

  function navigate(viewId, state = {}) {
    const path = getPathForView(viewId);
    history.pushState({ viewId, ...state }, '', path);

    // --- NUEVO: Breadcrumbs ---
    // Si vamos a un curso, intentamos sacar el título del estado o usar genérico
    let label = '';
    if (viewId === 'view-aula-course' && window.SIA_currentCourseId) {
      label = 'Detalle del Curso'; // Se actualizará mejor si tenemos el título
    }
    updateBreadcrumbs(viewId, label);
    // --------------------------

    showView(viewId);
  }

  function handleLocation() {
    const path = window.location.pathname;

    // Ruta especial: curso de Aula /aula/curso/:id
    if (path.startsWith('/aula/curso/')) {
      const courseId = decodeURIComponent(path.split('/aula/curso/')[1] || '');
      if (courseId) {
        window.SIA_currentCourseId = courseId;
        showView('view-aula-course');
        return;
      }
    }

    // NUEVO: ruta especial /verify/:folio
    if (path.startsWith('/verify/')) {
      startVerifyFlowFromCurrentPath();
      return;
    }

    // Rutas normales
    const entry = Object.entries(routeMap).find(([, p]) => p === path);
    if (entry) {
      const [viewId] = entry;
      showView(viewId);
    } else {
      // Fallback
      showView('view-dashboard');
    }
  }

  function showView(viewId) {
    clearSubscriptions();

    const navbarCollapse = document.getElementById('navContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      new bootstrap.Collapse(navbarCollapse).hide();
    }

    // === Control del FAB de Aula (crear curso) ===
    if (fabAddCourse) {
      const isAulaAdmin = currentUserProfile?.role === 'aula';
      const isAulaView = viewId === 'view-aula';
      fabAddCourse.classList.toggle('d-none', !(isAulaAdmin && isAulaView));
    }

    // === Control del Banner de Avisos (NUEVO) ===
    const bannerAvisos = document.getElementById('global-avisos-wrap');
    if (bannerAvisos) {
      // Ocultar si es Super Admin, mostrar para el resto
      if (currentUserProfile?.role === 'superadmin') {
        bannerAvisos.classList.add('d-none');
      } else {
        bannerAvisos.classList.remove('d-none');
      }
    }

    // Ocultar todas las vistas y mostrar sólo la actual
    appViews.forEach(v => v.classList.add('d-none'));

    // --- LÓGICA DE VISUALIZACIÓN (Super Admin vs Estándar) ---
    if (viewId === 'view-dashboard' && currentUserProfile?.role === 'superadmin') {
      // Si es super admin y va al home, mostrar la Torre de Control
      const saDash = document.getElementById('view-superadmin-dashboard');
      if (saDash) saDash.classList.remove('d-none');
    } else {
      // Comportamiento normal para otras vistas o roles
      const target = document.getElementById(viewId);
      if (target) target.classList.remove('d-none');
    }
    // ---------------------------------------------------------

    // Marcar enlace activo en el navbar
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewId));

    // Actualizar tip y avisos globales
    updateGlobalTip(viewId);
    rebuildGlobalAvisosData();

    // ====== DASHBOARD GENERAL ======
    if (viewId === 'view-dashboard') {
      loadDashboard();
    }

    // ====== MEDI (student / admin) ======
    if (viewId === 'view-medi' && typeof Medi !== 'undefined') {
      const stu = document.getElementById('medi-student');
      const adm = document.getElementById('medi-admin');
      const sa = document.getElementById('medi-superadmin');

      // Reset visibilidad
      stu?.classList.add('d-none');
      adm?.classList.add('d-none');
      sa?.classList.add('d-none');

      if (currentUserProfile?.role === 'superadmin') {
        sa?.classList.remove('d-none');
        Medi.initSuperAdmin(getCtx());
      } else if (currentUserProfile?.role === 'medico') {
        adm?.classList.remove('d-none');
        Medi.initAdmin(getCtx());
      } else {
        stu?.classList.remove('d-none');
        Medi.initStudent(getCtx());
      }
    }

    // ====== BIBLIO (student / admin) ======
    if (viewId === 'view-biblio' && typeof Biblio !== 'undefined') {
      const stu = document.getElementById('biblio-student');
      const adm = document.getElementById('biblio-admin');
      const sa = document.getElementById('biblio-superadmin');

      // Reset visibilidad
      stu?.classList.add('d-none');
      adm?.classList.add('d-none');
      sa?.classList.add('d-none');

      if (currentUserProfile?.role === 'superadmin') {
        sa?.classList.remove('d-none');
        Biblio.initSuperAdmin(getCtx());
      } else if (currentUserProfile?.role === 'biblio') {
        adm?.classList.remove('d-none');
        Biblio.initAdmin(getCtx());
      } else {
        stu?.classList.remove('d-none');
        Biblio.initStudent(getCtx());
      }
    }

    // ====== AULA (student / admin) ======
    if (viewId === 'view-aula') {
      // Usa el helper que ya creaste para decidir vista según rol
      mountAula(getCtx(), currentUserProfile);
    }

    // ====== AULA → PLAYER DE CURSO ======
    if (viewId === 'view-aula-course' && typeof AulaContent !== 'undefined') {
      // Si no hay courseId, regresamos a la vista Aula
      if (!window.SIA_currentCourseId) {
        showView('view-aula');
        return;
      }
      AulaContent.initCourse(getCtx(), window.SIA_currentCourseId);
    }
  }




  async function loadDashboard() {
    const user = SIA.auth.currentUser;
    if (!user || !currentUserProfile) return;

    // --- LÓGICA SUPER ADMIN (NUEVO) ---
    if (currentUserProfile.role === 'superadmin') {
      // 1. Gestión visual: asegurar que se ve el dashboard correcto
      const dashStandard = document.getElementById('view-dashboard');
      const dashSuper = document.getElementById('view-superadmin-dashboard');

      if (dashStandard) dashStandard.classList.add('d-none');
      if (dashSuper) dashSuper.classList.remove('d-none');

      // 2. Cargar Métricas Globales (Torre de Control)
      try {
        // Usuarios Totales
        const usersSnap = await SIA.db.collection('usuarios').get();
        if (document.getElementById('sa-total-users'))
          document.getElementById('sa-total-users').textContent = usersSnap.size;

        // Cursos Aula
        const cursosSnap = await SIA.db.collection('aula-cursos').get();
        if (document.getElementById('sa-kpi-aula'))
          document.getElementById('sa-kpi-aula').textContent = cursosSnap.size;

        // Consultas Medi (Simplificado: total histórico)
        const mediSnap = await SIA.db.collection('medi-consultas').get();
        if (document.getElementById('sa-kpi-medi'))
          document.getElementById('sa-kpi-medi').textContent = mediSnap.size;

        // Préstamos Biblio (Activos/Entregados)
        const prestamosSnap = await SIA.db.collection('prestamos-biblio').where('estado', '==', 'entregado').get();
        if (document.getElementById('sa-kpi-biblio'))
          document.getElementById('sa-kpi-biblio').textContent = prestamosSnap.size;

        // Tasa de Finalización Global (Cálculo rápido)
        const inscSnap = await SIA.db.collection('aula-inscripciones').get();
        const progSnap = await SIA.db.collection('aula-progress').where('progressPct', '>=', 100).get();
        const rate = inscSnap.size > 0 ? Math.round((progSnap.size / inscSnap.size) * 100) : 0;
        if (document.getElementById('sa-rate-aula'))
          document.getElementById('sa-rate-aula').textContent = `${rate}%`;

      } catch (e) {
        console.error("Error cargando SuperAdmin Dashboard", e);
      }
      return; // <--- DETENER AQUÍ para Super Admin
    }

    // --- LÓGICA ESTÁNDAR (Estudiante / Admin Módulo) ---
    // Asegurar que el dashboard de super admin esté oculto si no corresponde
    const dashSuper = document.getElementById('view-superadmin-dashboard');
    if (dashSuper) dashSuper.classList.add('d-none');

    const dashStandard = document.getElementById('view-dashboard');
    if (dashStandard) dashStandard.classList.remove('d-none');


    // --- 1. Header y Saludo (Mismo de Fase 1) ---
    const now = new Date();
    const hour = now.getHours();
    let saludo = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const name = currentUserProfile.displayName || user.email.split('@')[0];

    const titleEl = document.getElementById('dash-welcome-title');
    const subEl = document.getElementById('dash-welcome-subtitle');
    if (titleEl) titleEl.textContent = `${saludo}, ${name}`;

    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const dayEl = document.getElementById('dash-date-day');
    const monthEl = document.getElementById('dash-date-month');
    if (dayEl) dayEl.textContent = String(now.getDate()).padStart(2, '0');
    if (monthEl) monthEl.textContent = months[now.getMonth()];

    // Navbar info moved to global updateNavbarUserInfo



    // --- 2. Contadores (KPIs) ---
    // Mantenemos la lógica de conteo rápido
    const aulaBadge = document.getElementById('dash-aula-badge');
    const mediBadge = document.getElementById('dash-medi-badge');
    const biblioBadge = document.getElementById('dash-biblio-badge');

    try {
      // MEDI COUNT
      let mediCount = 0;
      if (currentUserProfile.role === 'medico') {
        const s1 = await SIA.db.collection('citas-medi').where('estado', '==', 'pendiente').get();
        mediCount = s1.size;
        if (subEl && mediCount > 0) subEl.textContent = `Tienes ${mediCount} citas por atender.`;
      } else {
        const s2 = await SIA.db.collection('citas-medi').where('studentId', '==', user.uid).where('estado', '==', 'pendiente').get();
        mediCount = s2.size;
      }
      if (mediBadge) mediBadge.textContent = mediCount === 1 ? '1 Pendiente' : `${mediCount} Pendientes`;
      if (mediBadge && mediCount > 0) mediBadge.className = 'badge bg-warning text-dark border align-self-start';

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


      // --- 3. WIDGETS DINÁMICOS (NUEVO FASE 2) ---

      // A) WIDGET CITAS PRÓXIMAS (Solo Estudiantes)
      const widgetCitas = document.getElementById('dash-widget-citas');
      if (widgetCitas && currentUserProfile.role === 'student') {
        // Traer próximas 2 citas confirmadas o pendientes, ordenadas por fecha
        const citasSnap = await SIA.db.collection('citas-medi')
          .where('studentId', '==', user.uid)
          .where('estado', 'in', ['pendiente', 'confirmada'])
          .orderBy('fechaHoraSlot', 'asc') // Requiere índice compuesto en Firestore, si falla, Firestore avisará en consola
          .limit(3)
          .get()
          .catch(e => { console.warn("Índice faltante citas dashboard", e); return { empty: true }; });

        if (!citasSnap.empty) {
          widgetCitas.innerHTML = citasSnap.docs.map(d => {
            const c = d.data();
            const dateObj = c.fechaHoraSlot ? c.fechaHoraSlot.toDate() : new Date();
            const dia = String(dateObj.getDate()).padStart(2, '0');
            const mes = months[dateObj.getMonth()];
            const hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const color = c.estado === 'confirmada' ? 'text-success' : 'text-warning';
            const icon = c.tipoServicio === 'Psicologico' ? 'bi-puzzle' : 'bi-heart-pulse';

            return `
              <div class="widget-list-item">
                <div class="widget-date-box me-3">
                  <div class="fw-bold small text-dark">${dia}</div>
                  <div class="text-muted" style="font-size: 0.65rem;">${mes}</div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-semibold small text-dark">${c.tipoServicio}</div>
                  <div class="text-muted extra-small">${hora} • ${c.motivo || 'Consulta'}</div>
                </div>
                <i class="bi ${icon} ${color}"></i>
              </div>
            `;
          }).join('');
        } else {
          // Mantener empty state original del HTML
          widgetCitas.innerHTML = `<div class="empty-state-widget"><i class="bi bi-calendar-check mb-2 d-block fs-4"></i>No tienes citas próximas.</div>`;
        }
      }

      // B) WIDGET CURSOS ACTIVOS (Solo Estudiantes)
      const widgetCursos = document.getElementById('dash-widget-cursos');
      if (widgetCursos && currentUserProfile.role === 'student') {
        // Obtenemos inscripciones
        const inscSnap = await SIA.db.collection('aula-inscripciones')
          .where('studentId', '==', user.uid)
          .orderBy('fechaInscripcion', 'desc')
          .limit(3)
          .get();

        if (!inscSnap.empty) {
          let htmlCursos = '';
          // Iteramos (idealmente usaríamos Promise.all para progreso real, aquí haremos un fetch optimista)
          for (const doc of inscSnap.docs) {
            const insc = doc.data();
            const cursoTitulo = insc.cursoTitulo || 'Curso sin título';

            // Intentar leer progreso rápido
            let progress = 0;
            try {
              const progDoc = await SIA.db.collection('aula-progress').doc(`${user.uid}_${insc.cursoId}`).get();
              if (progDoc.exists) progress = progDoc.data().progressPct || 0;
            } catch (e) { }

            htmlCursos += `
              <div class="widget-list-item" onclick="SIA_navToCourse('${insc.cursoId}')" style="cursor: pointer;">
                <div class="me-3 text-aula fs-4"><i class="bi bi-journal-bookmark-fill"></i></div>
                <div class="flex-grow-1">
                  <div class="d-flex justify-content-between small mb-1">
                    <span class="fw-semibold text-dark text-truncate" style="max-width: 180px;">${cursoTitulo}</span>
                    <span class="text-muted">${progress}%</span>
                  </div>
                  <div class="progress-mini">
                    <div class="progress-bar-mini" style="width: ${progress}%"></div>
                  </div>
                </div>
                <i class="bi bi-chevron-right text-muted ms-3 small"></i>
              </div>
            `;
          }
          widgetCursos.innerHTML = htmlCursos;
        } else {
          widgetCursos.innerHTML = `<div class="empty-state-widget"><i class="bi bi-journal-x mb-2 d-block fs-4"></i>No estás inscrito en cursos.</div>`;
        }
      }

    } catch (err) {
      console.error('Dashboard Update Error:', err);
    }
  }

  // --- Lógica de Notificaciones (Fase 3 - Corregido) ---

  // --- Lógica de Notificaciones (INTEGRACIÓN DIRECTA) ---

  function initNotifications(uid) {
    if (notifUnsub) notifUnsub(); // Limpiar anterior si existe

    const badge = document.getElementById('nav-notif-badge');
    const list = document.getElementById('nav-notif-list');

    if (!list) return;

    console.log("🔔 [App.js] Iniciando escucha DIRECTA para:", uid);

    // USAMOS FIRESTORE DIRECTAMENTE AQUÍ (Bypassing Notify.js para evitar errores de caché/scope)
    notifUnsub = SIA.db.collection('usuarios').doc(uid).collection('notificaciones')
      .onSnapshot(snapshot => {
        console.log(`📨 [App.js] Snapshot recibido: ${snapshot.size} notificaciones`);

        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Ordenar por fecha (el más nuevo primero) en el cliente
        notifs.sort((a, b) => {
          const dateA = a.createdAt ? a.createdAt.toDate() : new Date();
          const dateB = b.createdAt ? b.createdAt.toDate() : new Date();
          return dateB - dateA;
        });

        // Contar no leídas
        const unreadCount = notifs.filter(n => !n.leido).length;

        // 1. Actualizar Badge (Globo Rojo)
        if (badge) {
          if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('d-none');
          } else {
            badge.classList.add('d-none');
          }
        }

        // 2. Renderizar Lista
        if (list) {
          if (notifs.length === 0) {
            list.innerHTML = `
              <li class="text-center p-4 text-muted small">
                <i class="bi bi-bell-slash mb-2 d-block fs-5 opacity-50"></i>
                Sin notificaciones.
              </li>`;
          } else {
            list.innerHTML = notifs.map(n => {
              try { return renderNotificationItem(n); }
              catch (e) { return ''; }
            }).join('');
          }
        }
      }, error => {
        console.error("❌ [App.js] Error en listener directo:", error);
      });

    // Listener para botón "Marcar todas"
    const btnMarkAll = document.getElementById('btn-notif-mark-all');
    if (btnMarkAll) {
      // Clonar para limpiar listeners viejos
      const newBtn = btnMarkAll.cloneNode(true);
      btnMarkAll.parentNode.replaceChild(newBtn, btnMarkAll);
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof showToast === 'function') showToast('Marcando todo como leído...', 'info');
        // Aquí implementaríamos Notify.markAllAsRead(uid, ids)
      });
    }
  }

  function renderNotificationItem(n) {
    // Estilo según leído/no leído
    const isUnread = !n.leido;
    // bg-light para no leídos, bg-white para leídos
    const bgClass = isUnread ? 'bg-light' : 'bg-white';
    const dot = isUnread ? '<span class="position-absolute top-50 start-0 translate-middle p-1 bg-danger border border-light rounded-circle ms-2"></span>' : '';

    // Icono según tipo
    let icon = 'bi-info-circle-fill text-primary';
    if (n.tipo === 'medi') icon = 'bi-heart-pulse-fill text-danger';
    if (n.tipo === 'biblio') icon = 'bi-book-half text-warning';
    if (n.tipo === 'aula') icon = 'bi-mortarboard-fill text-success';

    // --- CORRECCIÓN CRÍTICA DE FECHA ---
    // Si n.createdAt es null (latencia local), mostramos "Ahora"
    let dateStr = 'Ahora';
    if (n.createdAt && typeof n.createdAt.toDate === 'function') {
      dateStr = n.createdAt.toDate().toLocaleDateString() + ' ' +
        n.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // -----------------------------------

    const clickAction = `onclick="handleNotificationClick('${n.id}', '${n.link || ''}')"`;

    return `
      <li class="list-group-item list-group-item-action border-0 border-bottom py-3 px-3 position-relative ${bgClass}" 
          style="cursor: pointer;" ${clickAction}>
        ${dot}
        <div class="d-flex gap-3">
          <div class="mt-1"><i class="bi ${icon} fs-5"></i></div>
          <div class="flex-grow-1" style="line-height: 1.3;">
            <div class="d-flex justify-content-between align-items-start">
                <span class="small fw-bold text-dark mb-1">${n.titulo || 'Notificación'}</span>
                <span class="extra-small text-muted opacity-75 ms-2" style="font-size: 0.7rem; white-space: nowrap;">${dateStr}</span>
            </div>
            <div class="small text-muted text-truncate" style="max-width: 210px;">${n.mensaje || ''}</div>
          </div>
        </div>
      </li>
    `;
  }

  // ==========================================
  // 6. INICIALIZACIÓN
  // ==========================================
  btnLoginGoogle?.addEventListener('click', loginConGoogle);
  btnIngresar?.addEventListener('click', loginConGoogle); // 👈 NUEVO

  btnLogout?.addEventListener('click', logout);
  if (globalAvisosBanner) {
    globalAvisosBanner.addEventListener('click', openGlobalAvisosModal);
    globalAvisosBanner.addEventListener('mouseenter', pauseGlobalAvisos);
    globalAvisosBanner.addEventListener('mouseleave', resumeGlobalAvisos);
  }

  btnGlobalAvisosModal?.addEventListener('click', openGlobalAvisosModal);

  document.getElementById('verify-back-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState({}, '', '/');

    if (SIA.auth.currentUser) {
      // Usuario logueado → ir al dashboard
      showApp();
      navigate('view-dashboard');
    } else {
      // Invitado → volver al landing
      showLanding();
    }
  });

  document.getElementById('aula-course-back')?.addEventListener('click', () => navigate('view-aula'));
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.viewId) {
      if (e.state.viewId === 'view-aula-course' && e.state.courseId) {
        window.SIA_currentCourseId = e.state.courseId;
      }
      showView(e.state.viewId);
    } else {
      handleLocation();
    }
  });



  // --- Configuración de Navegación Unificada ---
  function setupNav() {

    // 1. Lógica para la APP INTERNA (Dashboard, Aula, etc.)
    // Solo seleccionamos elementos que tengan explícitamente 'data-view'
    const appLinks = document.querySelectorAll('[data-view]');

    appLinks.forEach(el => {
      // Clonamos para eliminar listeners viejos y evitar duplicados
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);

      newEl.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = newEl.getAttribute('data-view');
        if (viewId) navigate(viewId);
      });
    });

    // 2. ScrollSpy para el LANDING (Menú "Inicio", "SIA", etc.)
    const landingLinks = document.querySelectorAll('.main-header .nav-link');
    const sections = document.querySelectorAll('section, main#hero');

    // Instancia del collapse de Bootstrap para el menú principal de la landing
    const mainMenu = document.getElementById('mainMenu');
    let landingCollapse = null;

    if (mainMenu && typeof bootstrap !== 'undefined') {
      landingCollapse = bootstrap.Collapse.getOrCreateInstance(mainMenu, {
        toggle: false   // <- evita que se abra solo al iniciar
      });
    }


    // Cerrar el menú hamburguesa al hacer clic en un enlace (solo móvil)
    landingLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 992 && mainMenu?.classList.contains('show') && landingCollapse) {
          landingCollapse.hide();
        }
      });
    });


    const onScroll = () => {
      // Si el landing no es visible, no gastar recursos calculando
      if (!landingView || landingView.classList.contains('d-none')) return;

      let currentSectionId = '';

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        // Margen de -150px para que se active antes de llegar exacto al borde
        if (window.scrollY >= (sectionTop - 150)) {
          currentSectionId = section.getAttribute('id');
        }
      });

      landingLinks.forEach(link => {
        // Limpiamos estado de todos los links
        link.classList.remove('active-glow', 'text-white');
        link.classList.add('text-white-75');

        // Verificamos si el link apunta a la sección actual
        // (Ej: href="#servicios" incluye el id "servicios")
        const href = link.getAttribute('href');
        if (currentSectionId && href.includes(currentSectionId)) {
          link.classList.add('active-glow', 'text-white');
          link.classList.remove('text-white-75');
        }
        // Caso especial: Si estamos hasta arriba, marcar Inicio (#hero)
        else if (window.scrollY < 100 && href === '#hero') {
          link.classList.add('active-glow', 'text-white');
          link.classList.remove('text-white-75');
        }
      });
    };

    // Listener de scroll
    window.removeEventListener('scroll', onScroll); // Limpieza por si acaso
    window.addEventListener('scroll', onScroll);

    // Llamada inicial para marcar el menú correcto al cargar (o recargar)
    onScroll();

    // 3. Botón Volver Arriba
    const btnBackToTop = document.getElementById('btn-back-to-top');
    if (btnBackToTop) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 300) btnBackToTop.classList.remove('d-none');
        else btnBackToTop.classList.add('d-none');
      });

      btnBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 4. Botón Brand del Navbar Interno
    if (btnBrandHome) {
      // Clonamos para limpiar listeners previos
      const newBtn = btnBrandHome.cloneNode(true);
      btnBrandHome.parentNode.replaceChild(newBtn, btnBrandHome);

      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUserProfile) navigate('view-dashboard');
        else {
          showLanding();
          history.pushState({}, '', '/');
        }
      });
    }

    const btnIngresarNav = document.getElementById('btn-ingresar-nav');
    if (btnIngresarNav) {
      btnIngresarNav.addEventListener('click', (e) => {
        e.preventDefault();
        // Si quieres solo scroll al hero:
        // document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });

        // O si quieres que sea igual que el botón grande de Google:
        loginConGoogle();
      });
    }

    const serviceButtons = document.querySelectorAll('.service-btn');

    serviceButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = btn.textContent.toLowerCase();

        if (!SIA.auth.currentUser) {
          // si no está logueado, lo mandas al hero para que inicie sesión
          document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
          return;
        }

        if (text.includes('aula')) {
          navigate('view-aula');
          showApp();
        } else if (text.includes('medi')) {
          navigate('view-medi');
          showApp();
        } else if (text.includes('biblio')) {
          navigate('view-biblio');
          showApp();
        }
      });
    });


  }

  // --- Inicialización ---
  setupNav();
});
