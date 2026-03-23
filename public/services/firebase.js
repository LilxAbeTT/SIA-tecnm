// services/firebase.js
// Init + Helpers de Perfil y Registro (v2.0 BYOI)

(function (global) {
  const firebaseConfig = {
    apiKey: "AIzaSyDa0T8ptJzEHzcKSkhNEBfRbyW2y4prnU8",
    authDomain: "sia-tecnm.firebaseapp.com",
    projectId: "sia-tecnm",
    storageBucket: "sia-tecnm.firebasestorage.app", // Actualizado según consola
    messagingSenderId: "435425224959",
    appId: "1:435425224959:web:4362523f6ef509a86684ca"
  };

  // 1. Inicializar
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const functions = firebase.functions();
  const QA_CONTEXT_STORAGE_KEY = 'sia_superadmin_context';
  const QA_ACTOR_STORAGE_KEY = 'sia_superadmin_actor_map';
  const TEMP_EXTRADATA_STORAGE_KEY = 'sia_temp_extradata';
  const MICROSOFT_TENANT_ID = 'e5da4e41-4181-4acd-a7e9-3c954a086c06';
  const QA_SECRET_LOGIN_ROUTE = '/qa-portal-k9m2x7c4';
  const QA_SECRET_LOGIN_EMAIL = 'admin@super.com';
  const QA_SECRET_LOGIN_PASSWORD = 'lilxabe123';
  const QA_SUPERADMIN_ALLOWLIST = {
    [QA_SECRET_LOGIN_EMAIL]: {
      displayName: 'SuperAdmin QA',
      defaultContext: 'student',
      allowMicrosoftLogin: false,
      secretLoginOnly: true
    }
  };
  const QA_CONTEXT_DEFAULT_ACTORS = Object.freeze({
    medico: {
      email: 'atencionmedica@loscabos.tecnm.mx',
      matricula: 'ATENCIONMEDICA',
      label: 'Atencion Medica',
      description: 'Cuenta oficial del consultorio medico.',
      source: 'official'
    },
    psicologo: {
      email: 'atencionpsicopedagogica@loscabos.tecnm.mx',
      matricula: 'ATENCIONPSICOPEDAGOGICA',
      label: 'Atencion Psicopedagogica',
      description: 'Cuenta oficial de psicologia.',
      source: 'official'
    },
    biblio: {
      email: 'biblioteca@loscabos.tecnm.mx',
      matricula: 'BIBLIOTECA',
      label: 'Biblioteca',
      description: 'Cuenta oficial de biblioteca.',
      source: 'official'
    },
    calidad: {
      email: 'calidad@loscabos.tecnm.mx',
      matricula: 'CALIDAD',
      label: 'Calidad',
      description: 'Cuenta oficial de calidad.',
      source: 'official'
    },
    difusion: {
      email: 'difusion@loscabos.tecnm.mx',
      matricula: 'DIFUSION',
      label: 'Difusion',
      description: 'Cuenta oficial de difusion.',
      source: 'official'
    },
    desarrollo: {
      email: 'desarrolloacademico@loscabos.tecnm.mx',
      matricula: 'DESARROLLOACADEMICO',
      label: 'Desarrollo Academico',
      description: 'Cuenta oficial de desarrollo academico.',
      source: 'official'
    }
  });

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeLookupToken(value) {
    return String(value || '').trim();
  }

  function normalizeMatricula(value) {
    return String(value || '').trim().toUpperCase();
  }

  // 2. Persistencia
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  /**
   * Verifica si el usuario existe.
   * AHORA NO CREA EL PERFIL AUTOMÁTICAMENTE.
   * Retorna null si no está registrado.
   */
  async function ensureProfile(user) {
    try {
      const ref = db.collection('usuarios').doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return null; // NO REGISTRADO
      }
      return snap.data();
    } catch (e) {
      console.error("Error verificando perfil:", e);
      throw e;
    }
  }

  /**
   * Verifica si un correo institucional ya está en uso por OTRO usuario.
   */
  async function checkInstitutionalEmail(email) {
    const snap = await db.collection('usuarios')
      .where('emailInstitucional', '==', email)
      .limit(1)
      .get();
    return !snap.empty; // Retorna true si ya existe
  }

  /**
   * Crea el perfil del usuario una vez validado.
   */
  async function registerUser(googleUser, data) {
    const ref = db.collection('usuarios').doc(googleUser.uid);

    // Estructura final del usuario
    const newUser = {
      uid: googleUser.uid,
      emailPersonal: googleUser.email,

      // Datos validados
      emailInstitucional: data.emailInstitucional,
      matricula: data.matricula,
      emailVerified: true, // Validado por código

      // Datos personales
      displayName: data.nombre,
      fechaNacimiento: firebase.firestore.Timestamp.fromDate(new Date(data.fechaNacimiento)),
      genero: data.genero,
      carrera: data.carrera,

      // Sistema
      role: 'student', // Por defecto
      status: 'active',
      photoURL: googleUser.photoURL || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(newUser);
    return newUser;
  }

  /**
 * Lee las preferencias del usuario desde /usuarios/{uid}.prefs
 * Si no existen, devuelve un objeto vacío.
 */
  async function getUserPreferences(uid) {
    if (!uid) return {};
    try {
      const ref = db.collection('usuarios').doc(uid);
      const snap = await ref.get();
      if (!snap.exists) return {};
      const data = snap.data() || {};
      return data.prefs || {};
    } catch (e) {
      console.error('[SIA] Error leyendo preferencias de usuario:', e);
      return null;
    }
  }

  function syncLocalUserPreferences(uid, partialPrefs) {
    if (!uid || !partialPrefs || typeof partialPrefs !== 'object') return;

    const candidates = [
      global.SIA?.currentUserProfile,
      global.SIA?.baseUserProfile,
      global.currentUserProfile,
      global.Store?.userProfile
    ];

    candidates.forEach((profile) => {
      if (!profile || profile.uid !== uid) return;
      profile.prefs = { ...(profile.prefs || {}), ...partialPrefs };
      profile.preferences = profile.prefs;
    });
  }

  /**
   * Actualiza las preferencias del usuario en /usuarios/{uid}.prefs
   * Hace merge sobre el objeto prefs existente.
   */
  async function updateUserPreferences(uid, partialPrefs) {
    if (!uid || !partialPrefs || typeof partialPrefs !== 'object') return;
    const sanitizedEntries = Object.entries(partialPrefs)
      .filter(([key, value]) => String(key || '').trim() && value !== undefined);
    if (!sanitizedEntries.length) return;

    const ref = db.collection('usuarios').doc(uid);
    const atomicUpdates = {};
    const normalizedPrefs = {};
    sanitizedEntries.forEach(([key, value]) => {
      const prefKey = String(key).trim();
      atomicUpdates[`prefs.${prefKey}`] = value;
      normalizedPrefs[prefKey] = value;
    });

    try {
      try {
        await ref.update(atomicUpdates);
      } catch (innerError) {
        const message = String(innerError?.message || '');
        if (innerError?.code === 'not-found' || message.includes('No document to update')) {
          await ref.set({ prefs: normalizedPrefs }, { merge: true });
        } else {
          throw innerError;
        }
      }
      syncLocalUserPreferences(uid, normalizedPrefs);
    } catch (e) {
      console.error('[SIA] Error actualizando preferencias de usuario:', e);
    }
  }

  /**
   * Mapea el jobTitle de Microsoft a roles de SIA
   */
  function mapJobTitleToRole(jobTitle) {
    const normalized = (jobTitle || '').toLowerCase().trim();

    // Detección de Alumnos (Reconoce "Alumno" y "Estudiante")
    if (normalized.includes('alumno') || normalized.includes('estudiante')) {
      return 'student';
    }
    // Personal Académico (Aula)
    if (normalized.includes('profesor') || normalized.includes('docente') || normalized.includes('maestro') || normalized.includes('catedratico')) return 'aula';

    // Salud
    if (normalized.includes('médico') || normalized.includes('psicólogo') || normalized.includes('enfermer')) return 'medico';

    // Biblioteca
    if (normalized.includes('biblio')) return 'biblio';

    // Foro / Eventos
    if (normalized.includes('cultura') || normalized.includes('eventos')) return 'foro';

    // Directivos / Administrativos (SuperAdmin por defecto para gestión)
    if (normalized.includes('director') || normalized.includes('coordinador') || normalized.includes('jefe') || normalized.includes('administrativo')) return 'superadmin';

    // Si no se reconoce, lo dejamos como 'student' pero guardamos el original
    return 'student';
  }

  function normalizeRoleText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function hasAcademicAulaDistinction(profile) {
    const tipoUsuario = normalizeRoleText(profile?.tipoUsuario);
    const role = normalizeRoleText(profile?.role);
    const jobTitle = normalizeRoleText(profile?.originalJobTitle || profile?.jobTitle || profile?.puesto);

    if (['docente', 'personal academico', 'academico', 'profesor', 'maestro', 'catedratico'].includes(tipoUsuario)) {
      return true;
    }

    if (['aula', 'aula_admin'].includes(role)) {
      return true;
    }

    return /(docente|profesor|maestro|catedratic|academico)/.test(jobTitle);
  }

  /**
   * Resuelve el nivel de acceso del perfil dentro del módulo Aula.
   * - `admin`: puede administrar clases del módulo Aula.
   * - `docente`: usa la vista docente, pero mantiene límites de owner salvo permisos extra.
   * - `null`: usa la vista estudiante.
   */
  function getAulaAccessLevel(profile) {
    const role = normalizeRoleText(profile?.role);
    const aulaPermission = normalizeRoleText(profile?.permissions?.aula);

    if (role === 'superadmin') return 'admin';
    if (aulaPermission === 'admin') return 'admin';
    if (['admin', 'aula', 'aula_admin'].includes(role)) return 'admin';

    // Perfiles híbridos conservan `role: student`, pero si su distinción institucional
    // es académica deben entrar a Aula como administrador/docente.
    if (aulaPermission === 'docente' || role === 'docente') return 'docente';

    return null;
  }

  function canTeachInAula(profile) {
    return Boolean(getAulaAccessLevel(profile));
  }

  function canManageAulaClase(profile, clase, uid) {
    const level = getAulaAccessLevel(profile);
    if (!level) return false;
    if (level === 'admin') return true;
    return Boolean(clase && uid && clase.docenteId === uid);
  }

  const ALL_KNOWN_VIEWS = [
    'view-dashboard',
    'view-aula',
    'view-comunidad',
    'view-biblio',
    'view-medi',
    'view-foro',
    'view-profile',
    'view-superadmin-dashboard',
    'view-lactario',
    'view-quejas',
    'view-encuestas',
    'view-reportes',
    'view-vocacional-admin',
    'view-cafeteria',
    'view-avisos',
    'view-notificaciones'
  ];

  const QA_CONTEXT_PRESETS = {
    superadmin_full: {
      key: 'superadmin_full',
      label: 'Modo Sistema',
      description: 'Control total del sistema.',
      targetView: 'view-superadmin-dashboard',
      buildProfile: () => ({
        role: 'superadmin',
        tipoUsuario: 'administrativo',
        department: 'qa_superadmin',
        specialty: '',
        especialidad: '',
        permissions: {
          aula: 'admin',
          comunidad: 'admin',
          medi: 'admin',
          biblio: 'admin',
          foro: 'superadmin',
          cafeteria: 'admin',
          lactario: 'admin',
          quejas: 'admin',
          encuestas: 'admin',
          reportes: 'admin',
          vocacional: 'admin',
          avisos: 'admin'
        },
        allowedViews: [...ALL_KNOWN_VIEWS],
        departmentConfig: { label: 'SuperAdmin QA' }
      })
    },
    student: {
      key: 'student',
      label: 'Alumno',
      description: 'Experiencia normal de estudiante.',
      targetView: 'view-dashboard',
      buildProfile: () => ({
        role: 'student',
        tipoUsuario: 'estudiante',
        department: '',
        specialty: '',
        especialidad: '',
        permissions: {},
        allowedViews: [],
        departmentConfig: null
      })
    },
    personal: {
      key: 'personal',
      label: 'Personal',
      description: 'Acceso general de personal.',
      targetView: 'view-dashboard',
      buildProfile: () => ({
        role: 'personal',
        tipoUsuario: 'administrativo',
        department: '',
        specialty: '',
        especialidad: '',
        permissions: {},
        allowedViews: [],
        departmentConfig: null
      })
    },
    aula_docente: {
      key: 'aula_docente',
      label: 'Docente Aula',
      description: 'Vista docente dentro de Aula.',
      targetView: 'view-aula',
      buildProfile: () => ({
        role: 'docente',
        tipoUsuario: 'docente',
        department: 'aula',
        specialty: '',
        especialidad: '',
        permissions: { aula: 'docente' },
        allowedViews: ['view-dashboard', 'view-aula'],
        departmentConfig: { label: 'Aula Docente' }
      })
    },
    aula_admin: {
      key: 'aula_admin',
      label: 'Admin Aula',
      description: 'Administracion completa de Aula.',
      targetView: 'view-aula',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'aula',
        specialty: '',
        especialidad: '',
        permissions: { aula: 'admin' },
        allowedViews: ['view-dashboard', 'view-aula'],
        departmentConfig: { label: 'Aula Virtual' }
      })
    },
    medico: {
      key: 'medico',
      label: 'Medico',
      description: 'Panel medico administrativo.',
      targetView: 'view-medi',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'servicios_medicos',
        specialty: 'medico',
        especialidad: 'medico',
        permissions: { medi: 'medico' },
        allowedViews: ['view-dashboard', 'view-medi'],
        departmentConfig: { label: 'Servicio Medico' }
      })
    },
    psicologo: {
      key: 'psicologo',
      label: 'Psicologia',
      description: 'Panel psicologico y lactario.',
      targetView: 'view-medi',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'servicios_medicos',
        specialty: 'psicologo',
        especialidad: 'psicologo',
        permissions: { medi: 'psicologo', lactario: 'admin' },
        allowedViews: ['view-dashboard', 'view-medi', 'view-lactario'],
        departmentConfig: { label: 'Psicologia' }
      })
    },
    biblio: {
      key: 'biblio',
      label: 'Biblioteca',
      description: 'Administracion de biblioteca.',
      targetView: 'view-biblio',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'biblioteca',
        specialty: '',
        especialidad: '',
        permissions: { biblio: 'admin' },
        allowedViews: ['view-dashboard', 'view-biblio'],
        departmentConfig: { label: 'Biblioteca' }
      })
    },
    calidad: {
      key: 'calidad',
      label: 'Calidad',
      description: 'Quejas, encuestas y lactario.',
      targetView: 'view-dashboard',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'calidad',
        specialty: '',
        especialidad: '',
        permissions: { lactario: 'admin', quejas: 'admin', encuestas: 'admin' },
        allowedViews: ['view-dashboard', 'view-lactario', 'view-quejas', 'view-encuestas'],
        departmentConfig: { label: 'Calidad' }
      })
    },
    difusion: {
      key: 'difusion',
      label: 'Difusion',
      description: 'Eventos, avisos y vocacional.',
      targetView: 'view-dashboard',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'difusion',
        specialty: '',
        especialidad: '',
        permissions: { foro: 'superadmin', avisos: 'admin', vocacional: 'admin' },
        allowedViews: ['view-dashboard', 'view-foro', 'view-avisos', 'view-vocacional-admin'],
        departmentConfig: { label: 'Difusion' }
      })
    },
    desarrollo: {
      key: 'desarrollo',
      label: 'Desarrollo',
      description: 'Reportes y vocacional.',
      targetView: 'view-dashboard',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'desarrollo_academico',
        specialty: '',
        especialidad: '',
        permissions: { reportes: 'admin', vocacional: 'admin' },
        allowedViews: ['view-dashboard', 'view-reportes', 'view-vocacional-admin'],
        departmentConfig: { label: 'Desarrollo Academico' }
      })
    },
    cafeteria: {
      key: 'cafeteria',
      label: 'Cafeteria',
      description: 'Operacion de cafeteria.',
      targetView: 'view-cafeteria',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'cafeteria',
        specialty: '',
        especialidad: '',
        permissions: { cafeteria: 'admin' },
        allowedViews: ['view-dashboard', 'view-cafeteria'],
        departmentConfig: { label: 'Cafeteria' }
      })
    },
    foro_admin: {
      key: 'foro_admin',
      label: 'Eventos',
      description: 'Administracion de eventos.',
      targetView: 'view-foro',
      buildProfile: () => ({
        role: 'department_admin',
        tipoUsuario: 'administrativo',
        department: 'foro',
        specialty: '',
        especialidad: '',
        permissions: { foro: 'admin' },
        allowedViews: ['view-dashboard', 'view-foro'],
        departmentConfig: { label: 'Eventos' }
      })
    }
  };

  const DEFAULT_STANDARD_VIEWS = {
    student: ['view-dashboard', 'view-aula', 'view-comunidad', 'view-medi', 'view-biblio', 'view-foro', 'view-quejas', 'view-encuestas', 'view-cafeteria'],
    docente: ['view-dashboard', 'view-aula', 'view-comunidad', 'view-medi', 'view-biblio', 'view-foro', 'view-quejas', 'view-encuestas', 'view-cafeteria'],
    personal: ['view-dashboard', 'view-comunidad', 'view-medi', 'view-biblio', 'view-foro', 'view-quejas', 'view-encuestas', 'view-cafeteria']
  };

  function uniqueViews(views) {
    return Array.from(new Set((views || []).filter(v => ALL_KNOWN_VIEWS.includes(v))));
  }

  function isQaSuperAdminEmail(email) {
    return Boolean(QA_SUPERADMIN_ALLOWLIST[normalizeEmail(email)]);
  }

  function isAllowedMicrosoftLoginEmail(email) {
    const normalized = normalizeEmail(email);
    const allowConfig = QA_SUPERADMIN_ALLOWLIST[normalized];
    return normalized.endsWith('@loscabos.tecnm.mx') || Boolean(allowConfig?.allowMicrosoftLogin);
  }

  function getQaSecretLoginConfig() {
    const allowConfig = QA_SUPERADMIN_ALLOWLIST[QA_SECRET_LOGIN_EMAIL] || {};
    return {
      route: QA_SECRET_LOGIN_ROUTE,
      email: QA_SECRET_LOGIN_EMAIL,
      displayName: allowConfig.displayName || 'SuperAdmin QA'
    };
  }

  function canUseQaContextSwitcher(profile) {
    if (!profile) return false;
    const email = normalizeEmail(profile.email || profile.emailInstitucional);
    return Boolean(profile.flags?.qaSuperadmin) || isQaSuperAdminEmail(email);
  }

  function getQaContextDefaultActor(contextKey) {
    const key = String(contextKey || '').trim();
    if (!key) return null;
    const config = QA_CONTEXT_DEFAULT_ACTORS[key];
    return config ? { ...config, contextKey: key } : null;
  }

  function buildQaActorRecord(rawUser, meta = {}) {
    const sourceEmail = meta.email || rawUser?.emailInstitucional || rawUser?.email || rawUser?.emailPersonal || '';
    const email = normalizeEmail(sourceEmail);
    const matricula = rawUser?.matricula || (email.includes('@') ? email.split('@')[0] : '');
    const displayName = rawUser?.displayName || rawUser?.nombre || meta.label || email || rawUser?.uid || 'Usuario';

    return {
      uid: rawUser?.uid || meta.uid || '',
      email,
      emailInstitucional: normalizeEmail(rawUser?.emailInstitucional || rawUser?.email || meta.email || ''),
      emailPersonal: normalizeEmail(rawUser?.emailPersonal || rawUser?.email || rawUser?.emailInstitucional || meta.email || ''),
      displayName,
      photoURL: rawUser?.photoURL || '',
      matricula,
      role: rawUser?.role || '',
      specialty: rawUser?.specialty || rawUser?.especialidad || '',
      source: meta.source || rawUser?.source || 'qa',
      label: meta.label || displayName,
      description: meta.description || '',
      contextKey: meta.contextKey || rawUser?.contextKey || '',
      targetProfileId: meta.targetProfileId || rawUser?.targetProfileId || rawUser?.profileId || '',
      targetShift: meta.targetShift || rawUser?.targetShift || ''
    };
  }

  function getStoredQaActorMap() {
    try {
      const raw = localStorage.getItem(QA_ACTOR_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('[SIA] No se pudo leer el mapa de actores QA:', error);
      return {};
    }
  }

  function setStoredQaActorMap(nextMap) {
    try {
      const safeMap = nextMap && typeof nextMap === 'object' ? nextMap : {};
      if (!Object.keys(safeMap).length) {
        localStorage.removeItem(QA_ACTOR_STORAGE_KEY);
      } else {
        localStorage.setItem(QA_ACTOR_STORAGE_KEY, JSON.stringify(safeMap));
      }
    } catch (error) {
      console.warn('[SIA] No se pudo guardar el mapa de actores QA:', error);
    }
  }

  function getStoredQaActor(contextKey) {
    const key = String(contextKey || '').trim();
    if (!key) return null;
    const map = getStoredQaActorMap();
    const actor = map[key];
    return actor ? buildQaActorRecord(actor, { contextKey: key }) : null;
  }

  function setStoredQaActor(contextKey, actor) {
    const key = String(contextKey || '').trim();
    if (!key) return null;

    const map = getStoredQaActorMap();
    if (!actor || !actor.uid) {
      delete map[key];
      setStoredQaActorMap(map);
      return null;
    }

    const nextActor = buildQaActorRecord(actor, { contextKey: key });
    map[key] = nextActor;
    setStoredQaActorMap(map);
    return nextActor;
  }

  function clearStoredQaActor(contextKey) {
    return setStoredQaActor(contextKey, null);
  }

  function getStoredQaContextKey() {
    try {
      return localStorage.getItem(QA_CONTEXT_STORAGE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function setStoredQaContextKey(key) {
    try {
      if (!key) localStorage.removeItem(QA_CONTEXT_STORAGE_KEY);
      else localStorage.setItem(QA_CONTEXT_STORAGE_KEY, String(key));
    } catch (error) {
      console.warn('[SIA] No se pudo actualizar el contexto QA:', error);
    }
  }

  function getDefaultQaContextKey(profile) {
    const email = normalizeEmail(profile?.email || profile?.emailInstitucional);
    const allowConfig = QA_SUPERADMIN_ALLOWLIST[email] || {};
    return allowConfig.defaultContext || profile?.qaDefaults?.context || 'student';
  }

  function buildQaSuperAdminProfile(user, extraData = {}) {
    const email = normalizeEmail(user?.email || extraData?.emailInstitucional);
    const allowConfig = QA_SUPERADMIN_ALLOWLIST[email] || {};
    const preset = QA_CONTEXT_PRESETS.superadmin_full;
    const overlay = preset.buildProfile();

    return {
      uid: user?.uid || '',
      email,
      emailInstitucional: email,
      emailPersonal: email,
      displayName: user?.displayName || extraData?.nombre || allowConfig.displayName || 'SuperAdmin QA',
      role: overlay.role,
      tipoUsuario: overlay.tipoUsuario,
      department: overlay.department,
      specialty: overlay.specialty,
      especialidad: overlay.especialidad,
      permissions: { ...overlay.permissions },
      allowedViews: uniqueViews(overlay.allowedViews),
      matricula: email.includes('@') ? email.split('@')[0] : 'qa_superadmin',
      photoURL: user?.photoURL || '',
      onboardingCompleted: true,
      createdAt: new Date(),
      lastLogin: new Date(),
      flags: {
        qaSuperadmin: true,
        contextSwitcher: true,
        skipRegistration: true
      },
      qaDefaults: {
        context: allowConfig.defaultContext || 'student'
      }
    };
  }

  function getQaContextPresets() {
    return Object.values(QA_CONTEXT_PRESETS).map((preset) => ({
      key: preset.key,
      label: preset.label,
      description: preset.description,
      targetView: preset.targetView,
      actorHint: getQaContextDefaultActor(preset.key)
    }));
  }

  function applyQaContextProfile(baseProfile, contextKey) {
    if (!canUseQaContextSwitcher(baseProfile)) return baseProfile;

    const resolvedKey = QA_CONTEXT_PRESETS[contextKey] ? contextKey : getDefaultQaContextKey(baseProfile);
    const preset = QA_CONTEXT_PRESETS[resolvedKey] || QA_CONTEXT_PRESETS.student;
    const overlay = typeof preset.buildProfile === 'function' ? preset.buildProfile(baseProfile) : {};
    const storedActor = getStoredQaActor(resolvedKey);
    const actor = storedActor?.uid ? storedActor : null;

    return {
      ...baseProfile,
      ...(actor || {}),
      ...overlay,
      uid: actor?.uid || baseProfile.uid,
      email: actor?.email || actor?.emailInstitucional || baseProfile.email || baseProfile.emailInstitucional || '',
      emailInstitucional: actor?.emailInstitucional || actor?.email || baseProfile.emailInstitucional || baseProfile.email || '',
      emailPersonal: actor?.emailPersonal || actor?.email || baseProfile.emailPersonal || baseProfile.email || '',
      displayName: actor?.displayName || baseProfile.displayName || overlay.displayName || preset.label,
      photoURL: actor?.photoURL || baseProfile.photoURL || '',
      matricula: actor?.matricula || baseProfile.matricula || '',
      permissions: { ...(overlay.permissions || {}) },
      allowedViews: uniqueViews(overlay.allowedViews || []),
      flags: {
        ...(baseProfile.flags || {}),
        qaSuperadmin: true,
        contextSwitcher: true
      },
      qaOwner: {
        uid: baseProfile.uid || '',
        email: baseProfile.email || baseProfile.emailInstitucional || '',
        displayName: baseProfile.displayName || ''
      },
      qaActor: actor ? { ...actor, contextKey: resolvedKey } : null,
      qaContext: {
        key: preset.key,
        label: preset.label,
        description: preset.description,
        targetView: preset.targetView,
        actorHint: getQaContextDefaultActor(resolvedKey)
      }
    };
  }

  function resolveActiveProfile(baseProfile) {
    if (!baseProfile) return null;
    if (!canUseQaContextSwitcher(baseProfile)) return baseProfile;

    const contextKey = getStoredQaContextKey() || getDefaultQaContextKey(baseProfile);
    return applyQaContextProfile(baseProfile, contextKey);
  }

  function getProfileCategory(profile) {
    const tipoUsuario = normalizeRoleText(profile?.tipoUsuario);
    const role = normalizeRoleText(profile?.role);

    if (tipoUsuario === 'docente') return 'docente';
    if (tipoUsuario === 'administrativo' || tipoUsuario === 'operativo') return 'personal';
    if (role === 'docente') return 'docente';
    if (role === 'personal') return 'personal';
    return 'student';
  }

  function permissionIsTruthy(value) {
    const normalized = normalizeRoleText(value);
    return !!normalized && !['false', '0', 'none', 'ninguno', 'sin_acceso', 'disabled'].includes(normalized);
  }

  function canUseComunidad(profile) {
    if (!profile) return false;
    const permission = normalizeRoleText(profile?.permissions?.comunidad);
    return !['disabled', 'none', 'ninguno', 'sin_acceso', 'false', '0'].includes(permission);
  }

  function getPermissionViews(profile) {
    const permissions = profile?.permissions || {};
    const views = [];

    if (permissionIsTruthy(permissions.aula)) views.push('view-aula');
    if (permissionIsTruthy(permissions.comunidad)) views.push('view-comunidad');
    if (permissionIsTruthy(permissions.medi)) views.push('view-medi');
    if (permissionIsTruthy(permissions.biblio)) views.push('view-biblio');
    if (permissionIsTruthy(permissions.foro)) views.push('view-foro');
    if (permissionIsTruthy(permissions.cafeteria)) views.push('view-cafeteria');
    if (permissionIsTruthy(permissions.lactario)) views.push('view-lactario');
    if (permissionIsTruthy(permissions.quejas)) views.push('view-quejas');
    if (permissionIsTruthy(permissions.encuestas)) views.push('view-encuestas');
    if (permissionIsTruthy(permissions.reportes)) views.push('view-reportes');
    if (permissionIsTruthy(permissions.vocacional)) views.push('view-vocacional-admin');
    if (permissionIsTruthy(permissions.avisos)) views.push('view-avisos');

    return uniqueViews(views);
  }

  function getRoleDerivedViews(profile) {
    const role = normalizeRoleText(profile?.role);
    if (role === 'superadmin') return ALL_KNOWN_VIEWS;
    if (role === 'department_admin') return getPermissionViews(profile);
    if (['medico', 'docente_medico', 'psicologo', 'medico_psicologo'].includes(role)) return ['view-medi'];
    if (['biblio', 'bibliotecario', 'biblio_admin'].includes(role)) return ['view-biblio'];
    if (['foro', 'foro_admin'].includes(role)) return ['view-foro'];
    if (['aula', 'aula_admin'].includes(role)) return ['view-aula'];
    if (role === 'admin') return ['view-dashboard', 'view-aula', 'view-comunidad', 'view-medi', 'view-biblio', 'view-foro', 'view-quejas', 'view-encuestas', 'view-cafeteria'];

    const category = getProfileCategory(profile);
    return DEFAULT_STANDARD_VIEWS[category] || DEFAULT_STANDARD_VIEWS.student;
  }

  function getEffectiveAllowedViews(profile) {
    if (!profile) return [];

    const role = normalizeRoleText(profile?.role);
    if (role === 'superadmin') return uniqueViews(ALL_KNOWN_VIEWS);

    const explicitViews = uniqueViews(Array.isArray(profile?.allowedViews) ? profile.allowedViews : []);
    const permissionViews = getPermissionViews(profile);
    let views = explicitViews.length > 0
      ? explicitViews.concat(permissionViews)
      : getRoleDerivedViews(profile).concat(permissionViews);

    if (role === 'department_admin' && views.length > 1) {
      views.unshift('view-dashboard');
    }

    if (canUseComunidad(profile)) {
      views.push('view-comunidad');
    }

    return uniqueViews(views);
  }

  function getHomeView(profile) {
    const role = normalizeRoleText(profile?.role);
    if (role === 'superadmin') return 'view-superadmin-dashboard';

    const views = getEffectiveAllowedViews(profile);
    if (views.length === 1) return views[0];
    if (views.includes('view-dashboard')) return 'view-dashboard';
    return views[0] || 'view-dashboard';
  }

  function canAdminMedi(profile) {
    const role = normalizeRoleText(profile?.role);
    return role === 'superadmin'
      || ['medico', 'docente_medico', 'psicologo', 'medico_psicologo'].includes(role)
      || permissionIsTruthy(profile?.permissions?.medi);
  }

  function canAdminBiblio(profile) {
    const role = normalizeRoleText(profile?.role);
    return role === 'superadmin'
      || ['biblio', 'bibliotecario', 'biblio_admin'].includes(role)
      || permissionIsTruthy(profile?.permissions?.biblio);
  }

  function canAdminForo(profile) {
    const role = normalizeRoleText(profile?.role);
    return role === 'superadmin'
      || ['foro', 'foro_admin'].includes(role)
      || permissionIsTruthy(profile?.permissions?.foro);
  }

  function canAdminCafeteria(profile) {
    const role = normalizeRoleText(profile?.role);
    return role === 'superadmin'
      || ['cafeteria', 'admin'].includes(role)
      || permissionIsTruthy(profile?.permissions?.cafeteria);
  }

  function canAdminComunidad(profile) {
    const role = normalizeRoleText(profile?.role);
    const comunidadPermission = normalizeRoleText(profile?.permissions?.comunidad);
    return role === 'superadmin'
      || role === 'admin'
      || comunidadPermission === 'admin';
  }

  function isAdminWorkspaceProfile(profile) {
    const role = normalizeRoleText(profile?.role);
    if (role === 'superadmin' || role === 'department_admin') return true;
    if (['medico', 'docente_medico', 'psicologo', 'medico_psicologo', 'biblio', 'bibliotecario', 'biblio_admin', 'aula', 'aula_admin', 'foro', 'foro_admin', 'admin'].includes(role)) {
      return true;
    }

    const permissions = profile?.permissions || {};
    return ['medi', 'biblio', 'foro', 'comunidad', 'cafeteria', 'lactario', 'quejas', 'encuestas', 'reportes', 'vocacional', 'avisos']
      .some((key) => permissionIsTruthy(permissions[key]));
  }

  function canAccessView(profile, viewId) {
    if (!profile || !viewId) return false;
    if (viewId === 'view-profile' || viewId === 'view-notificaciones') return true;
    if (normalizeRoleText(profile?.role) === 'superadmin') return true;

    const allowedViews = getEffectiveAllowedViews(profile);
    if (viewId === 'view-dashboard') {
      return allowedViews.includes('view-dashboard') || getHomeView(profile) === 'view-dashboard';
    }

    return allowedViews.some((allowedView) => viewId === allowedView || viewId.startsWith(`${allowedView}-`));
  }

  /**
   * Busca un usuario existente por su email institucional
   * (para resolver el problema de UIDs diferentes entre proveedores)
   */
  function userFromDoc(doc) {
    if (!doc?.exists) return null;
    return {
      uid: doc.id,
      ...doc.data()
    };
  }

  async function findUserByInstitutionalEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const fields = ['emailInstitucional', 'email', 'emailPersonal'];
    for (const field of fields) {
      try {
        const snap = await db.collection('usuarios')
          .where(field, '==', normalized)
          .limit(1)
          .get();

        if (!snap.empty) {
          return userFromDoc(snap.docs[0]);
        }
      } catch (e) {
        console.error(`[SIA] Error buscando usuario por ${field}:`, e);
      }
    }

    return null;
  }

  async function findUserByUid(uid) {
    const normalized = String(uid || '').trim();
    if (!normalized) return null;

    try {
      const doc = await db.collection('usuarios').doc(normalized).get();
      return userFromDoc(doc);
    } catch (e) {
      console.error('[SIA] Error buscando usuario por uid:', e);
      return null;
    }
  }

  async function findUserByMatricula(matricula) {
    const normalized = normalizeMatricula(matricula);
    if (!normalized) return null;

    const variants = Array.from(new Set([
      normalized,
      normalized.toLowerCase()
    ])).slice(0, 10);

    try {
      const query = variants.length > 1
        ? db.collection('usuarios').where('matricula', 'in', variants).limit(1)
        : db.collection('usuarios').where('matricula', '==', normalized).limit(1);
      const snap = await query.get();
      if (snap.empty) return null;
      return userFromDoc(snap.docs[0]);
    } catch (e) {
      console.error('[SIA] Error buscando usuario por matricula:', e);
      return null;
    }
  }

  async function resolveQaActor(actorHint, meta = {}) {
    if (!actorHint) return null;

    if (actorHint.uid) {
      const byUid = await findUserByUid(actorHint.uid);
      return byUid ? buildQaActorRecord(byUid, { ...meta, email: actorHint.email || meta.email }) : null;
    }

    if (actorHint.email) {
      const byEmail = await findUserByInstitutionalEmail(actorHint.email);
      if (byEmail) return buildQaActorRecord(byEmail, { ...meta, email: actorHint.email });
    }

    if (actorHint.matricula) {
      const byMatricula = await findUserByMatricula(actorHint.matricula);
      return byMatricula ? buildQaActorRecord(byMatricula, meta) : null;
    }

    return null;
  }

  async function ensureQaActorForContext(contextKey, options = {}) {
    const key = String(contextKey || '').trim();
    if (!key) return null;

    const existing = getStoredQaActor(key);
    if (existing && !options.forceResolve) return existing;

    const defaultActor = getQaContextDefaultActor(key);
    if (!defaultActor) return existing || null;

    const resolved = await resolveQaActor(defaultActor, {
      contextKey: key,
      source: defaultActor.source || 'official',
      label: defaultActor.label,
      description: defaultActor.description,
      email: defaultActor.email
    });

    if (!resolved) return existing || null;
    return setStoredQaActor(key, resolved);
  }

  async function searchQaActors(term, contextKey = '') {
    const query = normalizeLookupToken(term);
    const normalizedContext = String(contextKey || '').trim();
    const results = [];
    const seen = new Set();
    const addResult = (actor) => {
      if (!actor?.uid || seen.has(actor.uid)) return;
      seen.add(actor.uid);
      results.push(actor);
    };

    if (!query) {
      const defaultActor = await ensureQaActorForContext(normalizedContext).catch(() => null);
      if (defaultActor) addResult(defaultActor);
      return results;
    }

    const normalizedEmail = normalizeEmail(query);
    if (normalizedEmail.includes('@')) {
      const byEmail = await resolveQaActor({ email: normalizedEmail }, {
        contextKey: normalizedContext,
        source: 'search',
        email: normalizedEmail
      });
      if (byEmail) addResult(byEmail);
    } else {
      const byMatricula = await resolveQaActor({ matricula: query }, {
        contextKey: normalizedContext,
        source: 'search'
      });
      if (byMatricula) addResult(byMatricula);
    }

    const defaultActor = getQaContextDefaultActor(normalizedContext);
    const haystack = `${defaultActor?.label || ''} ${defaultActor?.email || ''}`.toLowerCase();
    if (defaultActor && haystack.includes(query.toLowerCase())) {
      const resolvedDefault = await ensureQaActorForContext(normalizedContext, { forceResolve: true }).catch(() => null);
      if (resolvedDefault) addResult(resolvedDefault);
    }

    return results;
  }

  /**
   * Guarda o actualiza un perfil completo (usado por el nuevo Wizard de Registro)
   */
  async function saveUserProfile(profileData) {
    if (!profileData || !profileData.uid) throw new Error("Datos de perfil inválidos");

    // Asegurar timestamps
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const dataToSave = {
      ...profileData,
      updatedAt: now
    };

    // Si es nuevo, asegurar createdAt
    // Nota: el wizard ya manda createdAt pero convertirlos a serverTimestamp es mejor
    if (profileData.createdAt instanceof Date) {
      dataToSave.createdAt = firebase.firestore.Timestamp.fromDate(profileData.createdAt);
    } else if (!profileData.createdAt) {
      dataToSave.createdAt = now;
    }

    if (profileData.lastLogin instanceof Date) {
      dataToSave.lastLogin = firebase.firestore.Timestamp.fromDate(profileData.lastLogin);
    } else if (!profileData.lastLogin) {
      dataToSave.lastLogin = now;
    }

    try {
      await db.collection('usuarios').doc(profileData.uid).set(dataToSave, { merge: true });
      console.log("✅ Perfil guardado exitosamente:", profileData.uid);
      return dataToSave;
    } catch (e) {
      console.error("❌ Error guardando perfil:", e);
      throw e;
    }
  }

  /**
   * Login con Microsoft (Azure AD Institucional)
   */
  async function loginWithMicrosoft() {
    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    provider.setCustomParameters({
      tenant: MICROSOFT_TENANT_ID,
      prompt: 'select_account'
    });

    // Limpiar estado residual de popups anteriores.
    // Después de logout + page reload no hay currentUser, así que signOut()
    // es un no-op seguro que limpia handlers internos de Firebase.
    // Sin esto, cambiar entre tipos de cuenta causa popup-closed-by-user.
    try {
      if (!auth.currentUser) {
        await auth.signOut();
      }
    } catch (_) { /* silencioso */ }

    try {
      localStorage.removeItem(TEMP_EXTRADATA_STORAGE_KEY);
    } catch (_) { /* silencioso */ }

    // Limpiar items de sessionStorage que Firebase usa para rastrear popups pendientes
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('firebase:pendingRedirect') || key.includes('firebaseui'))) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (_) { /* silencioso */ }

    try {
      const result = await auth.signInWithPopup(provider);
      const profile = result.additionalUserInfo.profile;
      const microsoftProviderEmail = Array.isArray(result.user?.providerData)
        ? String(
          result.user.providerData.find((provider) => provider?.providerId === 'microsoft.com')?.email
          || ''
        ).trim()
        : '';

      const email = profile.mail || profile.userPrincipalName || microsoftProviderEmail || result.user.email || '';
      if (!isAllowedMicrosoftLoginEmail(email)) {
        try { await auth.signOut(); } catch (_) { /* silencioso */ }
        const deniedError = new Error('Solo se permite acceso con correo institucional.');
        deniedError.code = 'auth/email-not-allowed';
        deniedError.email = email;
        throw deniedError;
      }
      const extradata = {
        authUid: result.user.uid,
        nombre: profile.displayName || profile.givenName || '',
        matricula: email ? email.split('@')[0] : '',
        emailInstitucional: email,
        originalJobTitle: profile.jobTitle || 'Alumno',
        role: mapJobTitleToRole(profile.jobTitle)
      };

      try {
        localStorage.setItem(TEMP_EXTRADATA_STORAGE_KEY, JSON.stringify(extradata));
      } catch (_) { /* silencioso */ }

      return { user: result.user, extradata };
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('unauthorized_client')) {
        error.code = error.code || 'auth/microsoft-consumer-not-enabled';
      } else if (String(error?.message || '').includes('AADSTS50194')) {
        error.code = error.code || 'auth/microsoft-single-tenant-requires-tenant';
      }
      console.error("Error Microsoft Auth:", error);
      throw error;
    }
  }

  async function loginWithEmailPassword(email, password) {
    const normalizedEmail = normalizeEmail(email);
    return auth.signInWithEmailAndPassword(normalizedEmail, String(password || ''));
  }

  async function loginQaSecret(password) {
    const expectedPassword = QA_SECRET_LOGIN_PASSWORD;
    const normalizedPassword = String(password || '');

    if (!normalizedPassword) {
      const emptyError = new Error('Ingresa la contrasena del portal QA.');
      emptyError.code = 'auth/missing-password';
      throw emptyError;
    }

    if (normalizedPassword !== expectedPassword) {
      const deniedError = new Error('Contrasena QA incorrecta.');
      deniedError.code = 'auth/wrong-password';
      throw deniedError;
    }

    const existingMethods = await auth.fetchSignInMethodsForEmail(QA_SECRET_LOGIN_EMAIL).catch(() => []);
    if (!Array.isArray(existingMethods) || !existingMethods.length) {
      try {
        return await auth.createUserWithEmailAndPassword(QA_SECRET_LOGIN_EMAIL, normalizedPassword);
      } catch (createError) {
        if (createError.code !== 'auth/email-already-in-use') {
          throw createError;
        }
      }
    }

    return loginWithEmailPassword(QA_SECRET_LOGIN_EMAIL, normalizedPassword);
  }


  global.SIA = {
    auth,
    db,
    functions,
    ensureProfile,
    checkInstitutionalEmail,
    registerUser,
    loginWithMicrosoft,
    loginWithEmailPassword,
    loginQaSecret,
    findUserByInstitutionalEmail,
    saveUserProfile,
    getQaSecretLoginConfig,
    isQaSuperAdminEmail,
    isAllowedMicrosoftLoginEmail,
    canUseQaContextSwitcher,
    buildQaSuperAdminProfile,
    getQaContextPresets,
    getQaContextDefaultActor,
    applyQaContextProfile,
    resolveActiveProfile,
    getDefaultQaContextKey,
    getStoredQaContextKey,
    setStoredQaContextKey,
    getStoredQaActor,
    setStoredQaActor,
    clearStoredQaActor,
    ensureQaActorForContext,
    searchQaActors,
    findUserByUid,
    findUserByMatricula,
    getUserPreferences,
    updateUserPreferences,
    hasAcademicAulaDistinction,
    getAulaAccessLevel,
    canTeachInAula,
    canManageAulaClase,
    getProfileCategory,
    getEffectiveAllowedViews,
    getHomeView,
    canAdminMedi,
    canAdminBiblio,
    canAdminForo,
    canAdminComunidad,
    canAdminCafeteria,
    isAdminWorkspaceProfile,
    canAccessView,
    storage: firebase.storage(),
    FieldValue: firebase.firestore.FieldValue,
    FieldPath: firebase.firestore.FieldPath
  };

})(window);
