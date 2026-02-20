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
      return {};
    }
  }

  /**
   * Actualiza las preferencias del usuario en /usuarios/{uid}.prefs
   * Hace merge sobre el objeto prefs existente.
   */
  async function updateUserPreferences(uid, partialPrefs) {
    if (!uid || !partialPrefs || typeof partialPrefs !== 'object') return;

    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    const baseData = snap.exists ? (snap.data() || {}) : {};
    const currentPrefs = baseData.prefs || {};
    const newPrefs = { ...currentPrefs, ...partialPrefs };

    try {
      if (snap.exists) {
        await ref.update({ prefs: newPrefs });
      } else {
        await ref.set({ prefs: newPrefs }, { merge: true });
      }
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

  /**
   * Busca un usuario existente por su email institucional
   * (para resolver el problema de UIDs diferentes entre proveedores)
   */
  async function findUserByInstitutionalEmail(email) {
    if (!email) return null;

    try {
      const snap = await db.collection('usuarios')
        .where('emailInstitucional', '==', email)
        .limit(1)
        .get();

      if (snap.empty) return null;

      const doc = snap.docs[0];
      return {
        uid: doc.id,
        ...doc.data()
      };
    } catch (e) {
      console.error('[SIA] Error buscando usuario por email institucional:', e);
      return null;
    }
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
      tenant: 'e5da4e41-4181-4acd-a7e9-3c954a086c06',
      prompt: 'select_account'
    });

    try {
      const result = await auth.signInWithPopup(provider);
      const profile = result.additionalUserInfo.profile;

      const extradata = {
        nombre: profile.displayName || profile.givenName || '',
        matricula: result.user.email.split('@')[0], // Número de Control
        emailInstitucional: result.user.email,
        originalJobTitle: profile.jobTitle || 'Alumno', // RECOLECTA DE ROLES REALES
        role: mapJobTitleToRole(profile.jobTitle)
      };

      return { user: result.user, extradata };
    } catch (error) {
      console.error("❌ Error Microsoft Auth:", error);
      throw error;
    }
  }


  global.SIA = {
    auth,
    db,
    ensureProfile,
    checkInstitutionalEmail,
    registerUser,
    loginWithMicrosoft,
    findUserByInstitutionalEmail,
    saveUserProfile, // 👈 NUEVA FUNCIÓN
    getUserPreferences,
    updateUserPreferences,
    storage: firebase.storage(), // ☁️ STORAGE
    FieldValue: firebase.firestore.FieldValue,
    FieldPath: firebase.firestore.FieldPath
  };

})(window);