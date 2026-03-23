// public/services/profile-service.js

/**
 * Servicio para manejar la información del perfil del usuario (Estudiantes y Personal).
 * Encapsula la lógica de Firestore, Fetch y Storage, manteniendo la UI agnóstica de Firebase.
 */
const ProfileService = (function () {
    const ALLOWED_ROOT_FIELDS = new Set([
        'displayName',
        'genero',
        'fechaNacimiento',
        'telefono',
        'emailPersonal',
        'photoURL',
        'tipoSangre',
        'domicilio',
        'estadoCivil',
        'turno',
        'areaAdscripcion',
        'contactoEmergenciaName',
        'contactoEmergenciaTel',
        'alergias',
        'medicamentosActuales',
        'condicionesCronicas',
        'otraCondicionDetalle',
        'cubiculo',
        'extension',
        'beca',
        'trabaja',
        'dependientes',
        'dependientesQty',
        'discapacidad'
    ]);

    const ALLOWED_OBJECT_FIELDS = new Set(['prefs']);

    const ALLOWED_PREFIXES = [
        'healthData.',
        'personalData.',
        'culturalData.',
        'institutionalContext.',
        'prefs.'
    ];

    function normalizeUpdateKey(key) {
        if (key === 'preferences') return 'prefs';
        if (key.startsWith('preferences.')) return `prefs.${key.slice('preferences.'.length)}`;
        return key;
    }

    function isAllowedField(key) {
        if (ALLOWED_ROOT_FIELDS.has(key) || ALLOWED_OBJECT_FIELDS.has(key)) return true;
        return ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix));
    }

    function sanitizeUpdates(updates) {
        const safeUpdates = {};

        for (const key of Object.keys(updates || {})) {
            const normalizedKey = normalizeUpdateKey(key);
            if (isAllowedField(normalizedKey)) {
                safeUpdates[normalizedKey] = updates[key];
            } else {
                console.warn(`[ProfileService] Campo bloqueado: "${key}" — no está permitido.`);
            }
        }

        return safeUpdates;
    }

    /**
     * Actualiza la información general y de salud (campos públicos) del usuario actual.
     * @param {Object} ctx - Contexto de la aplicación
     * @param {Object} updates - Objeto aplanado con los campos a actualizar en la DB. Ej: {"healthData.alergia": "Ninguna"}
     * @returns {Promise<void>}
     */
    async function updateProfile(ctx, updates) {
        if (!ctx.db || !ctx.auth || !ctx.auth.currentUser) {
            throw new Error("Base de datos o usuario no disponible.");
        }
        const uid = ctx.auth.currentUser.uid;

        const safeUpdates = sanitizeUpdates(updates);

        if (Object.keys(safeUpdates).length === 0) {
            throw new Error('No hay campos válidos para actualizar.');
        }

        const docRef = ctx.db.collection('usuarios').doc(uid);
        await docRef.update(safeUpdates);
    }

    /**
     * Sube una nueva foto de perfil a Storage y actualiza Auth/Firestore
     * @param {Object} ctx - Contexto de la aplicación
     * @param {File} file - Archivo de imagen seleccionado
     * @returns {Promise<string>} Download URL de la nueva imagen
     */
    async function uploadProfilePhoto(ctx, file) {
        if (!ctx.storage || !ctx.auth || !ctx.auth.currentUser) {
            throw new Error("Storage o usuario no disponible.");
        }

        // Validate file size (max 5MB)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            throw new Error("La imagen es demasiado grande. Máximo 5MB.");
        }

        // Validate MIME type
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error("Formato no válido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).");
        }

        const uid = ctx.auth.currentUser.uid;
        const storageRef = ctx.storage.ref().child(`users/${uid}/profile_pic.jpg`);

        const snapshot = await storageRef.put(file);
        let downloadURL = await snapshot.ref.getDownloadURL();

        // Append a cache-busting param so the browser forces an update visually
        if (downloadURL.includes('?')) {
            downloadURL += `&v=${Date.now()}`;
        } else {
            downloadURL += `?v=${Date.now()}`;
        }

        // Actualizar Firebase Auth
        await ctx.auth.currentUser.updateProfile({ photoURL: downloadURL });

        // Actualizar Firestore
        await ctx.db.collection('usuarios').doc(uid).update({ photoURL: downloadURL });

        // Actualizar Contexto Local (si existe en memoria)
        if (ctx.profile) {
            ctx.profile.photoURL = downloadURL;
        }
        if (ctx.currentUserProfile) {
            ctx.currentUserProfile.photoURL = downloadURL;
        }
        if (window.SIA && window.SIA.currentUserProfile) {
            window.SIA.currentUserProfile.photoURL = downloadURL;
        }

        return downloadURL;
    }

    /**
     * Elimina la foto de perfil en Storage y en la DB/Auth
     * @param {Object} ctx 
     */
    async function deleteProfilePhoto(ctx) {
        if (!ctx.storage || !ctx.auth || !ctx.auth.currentUser) {
            throw new Error("Storage o usuario no disponible.");
        }

        const uid = ctx.auth.currentUser.uid;
        const storageRef = ctx.storage.ref().child(`users/${uid}/profile_pic.jpg`);

        try {
            await storageRef.delete(); // Puede fallar si no existe
        } catch (e) {
            // Si el objeto no existe en storage, continuamos limpiando auth y firestore
            console.log("No existía foto previa en Storage o no se pudo eliminar", e);
        }

        // Remover de Auth
        await ctx.auth.currentUser.updateProfile({ photoURL: "" });

        // Remover de Firestore
        await ctx.db.collection('usuarios').doc(uid).update({ photoURL: window.firebase.firestore.FieldValue.delete() });

        // Actualizar Contexto Local
        if (ctx.profile) {
            ctx.profile.photoURL = null;
        }
        if (ctx.currentUserProfile) {
            ctx.currentUserProfile.photoURL = null;
        }
        if (window.SIA && window.SIA.currentUserProfile) {
            window.SIA.currentUserProfile.photoURL = null;
        }
    }

    /**
     * Actualiza la información del Expediente socioeconómico del estudiante.
     * En el modelo actual del sistema, la información socioeconómica de estudiantes
     * se guarda en campos distribuidos como 'personalData', 'healthData' y en la raz.
     * @param {Object} ctx 
     * @param {Object} recordUpdates 
     */
    async function updateStudentRecord(ctx, recordUpdates) {
        if (!ctx.db || !ctx.auth || !ctx.auth.currentUser) {
            throw new Error("Base de datos o usuario no disponible.");
        }
        const uid = ctx.auth.currentUser.uid;
        const safeUpdates = sanitizeUpdates(recordUpdates);
        if (Object.keys(safeUpdates).length === 0) {
            throw new Error('No hay campos válidos para actualizar.');
        }
        await ctx.db.collection('usuarios').doc(uid).update(safeUpdates);
    }

    return {
        updateProfile,
        uploadProfilePhoto,
        deleteProfilePhoto,
        updateStudentRecord
    };
})();

// Exponer globalmente
window.ProfileService = ProfileService;
