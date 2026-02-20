// avisos-service.js
// Servicio de Avisos/Anuncios Institucionales para SIA
// Gestión CRUD + consultas para el dashboard de estudiantes y stories

(function () {
    'use strict';

    const COLLECTION = 'avisos';

    // ========================================
    // HELPERS
    // ========================================

    function _getDb() {
        return window.SIA?.db;
    }

    function _now() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    function _toDate(ts) {
        if (!ts) return null;
        if (ts.toDate) return ts.toDate();
        if (ts instanceof Date) return ts;
        return new Date(ts);
    }

    // ========================================
    // ADMIN CRUD (Difusión)
    // ========================================

    /**
     * Crea un nuevo aviso
     * @param {object} ctx - Contexto (auth, db, user, profile)
     * @param {object} data - { title, type, imageUrl, body, priority, startDate, endDate }
     * @returns {string} ID del documento creado
     */
    async function createAviso(ctx, data) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');

        const user = ctx.user || ctx.auth?.currentUser;
        if (!user) throw new Error('No autenticado');

        const doc = {
            title: data.title || 'Sin título',
            type: data.type || 'text',          // 'image' | 'text' | 'mixed'
            imageUrl: data.imageUrl || '',
            body: data.body || '',
            status: 'active',                    // 'active' | 'paused' | 'expired'
            priority: data.priority || 'normal', // 'normal' | 'urgent'
            displayDuration: data.displayDuration || 8,
            startDate: data.startDate ? firebase.firestore.Timestamp.fromDate(new Date(data.startDate)) : _now(),
            endDate: data.endDate ? firebase.firestore.Timestamp.fromDate(new Date(data.endDate)) : null,
            createdAt: _now(),
            updatedAt: _now(),
            createdBy: {
                uid: user.uid,
                email: user.email,
                displayName: ctx.profile?.displayName || user.displayName || ''
            },
            viewCount: 0
        };

        const ref = await db.collection(COLLECTION).add(doc);
        console.log('[AvisosService] ✅ Aviso creado:', ref.id);
        return ref.id;
    }

    /**
     * Actualiza un aviso existente
     */
    async function updateAviso(ctx, id, data) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');

        const updates = { ...data, updatedAt: _now() };

        // Convertir fechas si vienen como string
        if (updates.startDate && typeof updates.startDate === 'string') {
            updates.startDate = firebase.firestore.Timestamp.fromDate(new Date(updates.startDate));
        }
        if (updates.endDate && typeof updates.endDate === 'string') {
            updates.endDate = firebase.firestore.Timestamp.fromDate(new Date(updates.endDate));
        }

        // No permitir sobreescribir ciertos campos
        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.viewCount;

        await db.collection(COLLECTION).doc(id).update(updates);
        console.log('[AvisosService] ✏️ Aviso actualizado:', id);
    }

    /**
     * Elimina un aviso
     */
    async function deleteAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');

        await db.collection(COLLECTION).doc(id).delete();
        console.log('[AvisosService] 🗑️ Aviso eliminado:', id);
    }

    /**
     * Pausa o reactiva un aviso
     */
    async function toggleAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');

        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Aviso no encontrado');

        const current = doc.data().status;
        const newStatus = current === 'active' ? 'paused' : 'active';

        await db.collection(COLLECTION).doc(id).update({
            status: newStatus,
            updatedAt: _now()
        });

        console.log(`[AvisosService] ⏯️ Aviso ${id} → ${newStatus}`);
        return newStatus;
    }

    // ========================================
    // QUERIES
    // ========================================

    /**
     * Obtiene todos los avisos (para el panel admin de Difusión)
     * Ordenados por createdAt desc
     */
    async function getAllAvisos(ctx) {
        const db = _getDb();
        if (!db) return [];

        const snap = await db.collection(COLLECTION)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    /**
     * Obtiene avisos activos vigentes (para el modal del estudiante)
     * Solo los que están 'active' y dentro de su ventana de fechas
     */
    async function getActiveAvisos(ctx) {
        const db = _getDb();
        if (!db) return [];

        const now = new Date();

        const snap = await db.collection(COLLECTION)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        // Filtrar por ventana de fechas en el cliente
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => {
                const start = _toDate(a.startDate);
                const end = _toDate(a.endDate);
                if (start && start > now) return false; // Aún no empieza
                if (end && end < now) return false;     // Ya expiró
                return true;
            });
    }

    /**
     * Obtiene avisos activos formateados para la sección de stories del dashboard
     */
    async function getAvisosForStories(ctx) {
        const avisos = await getActiveAvisos(ctx);

        return avisos.map(a => ({
            id: a.id,
            title: a.title,
            type: a.type,
            imageUrl: a.imageUrl,
            body: a.body,
            priority: a.priority,
            createdAt: a.createdAt,
            _source: 'aviso' // Tag para el renderer de stories
        }));
    }

    /**
     * Incrementa el contador de vistas de un aviso
     */
    async function incrementViewCount(ctx, id) {
        const db = _getDb();
        if (!db) return;

        try {
            await db.collection(COLLECTION).doc(id).update({
                viewCount: firebase.firestore.FieldValue.increment(1)
            });
        } catch (e) {
            console.warn('[AvisosService] Error incrementando viewCount:', e);
        }
    }

    // ========================================
    // EXPONER API PÚBLICA
    // ========================================

    window.AvisosService = {
        createAviso,
        updateAviso,
        deleteAviso,
        toggleAviso,
        getAllAvisos,
        getActiveAvisos,
        getAvisosForStories,
        incrementViewCount
    };

    console.log('[AvisosService] ✅ Servicio de Avisos cargado.');
})();
