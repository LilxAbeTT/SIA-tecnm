// avisos-service.js
// Servicio de Avisos Institucionales para SIA.
// Expone CRUD, filtros de visibilidad y tracking de lecturas por usuario.

(function () {
    'use strict';

    const COLLECTION = 'avisos';
    const USER_VIEWS_SUBCOLLECTION = 'avisoViews';
    const DEFAULT_LIMIT = 40;
    const SEEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

    function _getDb() {
        return window.SIA?.db;
    }

    function _getAuth() {
        return window.SIA?.auth;
    }

    function _getUid(ctx) {
        return ctx?.user?.uid || ctx?.auth?.currentUser?.uid || _getAuth()?.currentUser?.uid || null;
    }

    function _getProfile(ctx) {
        return ctx?.profile || ctx?.currentUserProfile || null;
    }

    function _now() {
        return firebase.firestore.FieldValue.serverTimestamp();
    }

    function _timestampFrom(value) {
        if (!value) return null;
        if (value.toDate || value.seconds) return value;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return firebase.firestore.Timestamp.fromDate(parsed);
    }

    function _toDate(value) {
        if (!value) return null;
        if (value.toDate) return value.toDate();
        if (value instanceof Date) return value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function _isStudentRole(role) {
        return (role || '') === 'student';
    }

    function _canManageAvisos(ctx) {
        const profile = _getProfile(ctx) || {};
        const email = profile.email || ctx?.auth?.currentUser?.email || '';
        return profile.role === 'superadmin'
            || profile.permissions?.avisos === 'admin'
            || email === 'difusion@loscabos.tecnm.mx';
    }

    function _normalizeAudience(value) {
        const allowed = ['all', 'students', 'staff', 'admins'];
        return allowed.includes(value) ? value : 'all';
    }

    function _matchesAudience(aviso, profile) {
        const audience = _normalizeAudience(aviso?.audience);
        const role = profile?.role || '';
        if (audience === 'all') return true;
        if (audience === 'students') return _isStudentRole(role);
        if (audience === 'staff') return !_isStudentRole(role);
        if (audience === 'admins') return role === 'department_admin' || role === 'superadmin';
        return true;
    }

    function resolveStatus(aviso, now) {
        const current = now || new Date();
        const rawStatus = aviso?.status || 'active';
        const startDate = _toDate(aviso?.startDate);
        const endDate = _toDate(aviso?.endDate);

        if (rawStatus === 'draft') return 'draft';
        if (rawStatus === 'archived') return 'archived';
        if (rawStatus === 'paused') return 'paused';
        if (startDate && startDate > current) return 'scheduled';
        if (endDate && endDate < current) return 'expired';
        return 'active';
    }

    function _decorateAviso(id, data) {
        const aviso = { id, ...data };
        aviso.effectiveStatus = resolveStatus(aviso);
        aviso.analytics = aviso.analytics || {};
        aviso.viewCount = typeof aviso.viewCount === 'number' ? aviso.viewCount : (aviso.analytics.totalViews || 0);
        return aviso;
    }

    function _getSeenStorageKey(ctx) {
        const uid = _getUid(ctx) || 'guest';
        return `sia:avisos:seen:${uid}`;
    }

    function _readSeenMap(ctx) {
        try {
            const raw = localStorage.getItem(_getSeenStorageKey(ctx)) || '{}';
            const parsed = JSON.parse(raw);
            const now = Date.now();
            let changed = false;
            Object.keys(parsed).forEach((key) => {
                if (!parsed[key] || now - parsed[key] > SEEN_TTL_MS) {
                    delete parsed[key];
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem(_getSeenStorageKey(ctx), JSON.stringify(parsed));
            }
            return parsed;
        } catch (_) {
            return {};
        }
    }

    function _writeSeenMap(ctx, map) {
        try {
            localStorage.setItem(_getSeenStorageKey(ctx), JSON.stringify(map || {}));
        } catch (_) {
        }
    }

    function getLocalSeenMap(ctx) {
        return _readSeenMap(ctx);
    }

    function hasSeenLocal(ctx, avisoId) {
        return !!_readSeenMap(ctx)[avisoId];
    }

    function markSeenLocal(ctx, avisoId) {
        if (!avisoId) return;
        const seen = _readSeenMap(ctx);
        seen[avisoId] = Date.now();
        _writeSeenMap(ctx, seen);
    }

    async function createAviso(ctx, data) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para crear avisos');

        const user = ctx?.user || ctx?.auth?.currentUser || _getAuth()?.currentUser;
        if (!user) throw new Error('No autenticado');

        const startDate = _timestampFrom(data.startDate) || _now();
        const endDate = _timestampFrom(data.endDate);
        const doc = {
            title: data.title || 'Sin titulo',
            type: data.type || 'text',
            imageUrl: data.imageUrl || '',
            body: data.body || '',
            audience: _normalizeAudience(data.audience),
            status: data.status || 'active',
            priority: data.priority || 'normal',
            displayDuration: Number(data.displayDuration) || 8,
            startDate,
            endDate: endDate || null,
            createdAt: _now(),
            updatedAt: _now(),
            createdBy: {
                uid: user.uid,
                email: user.email || '',
                displayName: ctx?.profile?.displayName || user.displayName || ''
            },
            analytics: {
                totalViews: 0,
                uniqueViewers: 0,
                completedViews: 0,
                viewsBySource: {}
            },
            viewCount: 0
        };

        const ref = await db.collection(COLLECTION).add(doc);
        return ref.id;
    }

    async function updateAviso(ctx, id, data) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para editar avisos');

        const updates = {
            ...data,
            updatedAt: _now()
        };

        if (Object.prototype.hasOwnProperty.call(updates, 'startDate')) {
            updates.startDate = _timestampFrom(updates.startDate) || _now();
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'endDate')) {
            updates.endDate = _timestampFrom(updates.endDate);
        }

        updates.audience = _normalizeAudience(updates.audience);

        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.analytics;
        delete updates.viewCount;
        delete updates.effectiveStatus;

        await db.collection(COLLECTION).doc(id).update(updates);
    }

    async function deleteAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para eliminar avisos');
        await db.collection(COLLECTION).doc(id).delete();
    }

    async function duplicateAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para duplicar avisos');

        const snap = await db.collection(COLLECTION).doc(id).get();
        if (!snap.exists) throw new Error('Aviso no encontrado');

        const source = snap.data() || {};
        const payload = {
            ...source,
            title: `${source.title || 'Aviso'} (Copia)`,
            status: 'draft',
            analytics: {
                totalViews: 0,
                uniqueViewers: 0,
                completedViews: 0,
                viewsBySource: {}
            },
            viewCount: 0,
            createdAt: _now(),
            updatedAt: _now()
        };

        delete payload.effectiveStatus;

        const ref = await db.collection(COLLECTION).add(payload);
        return ref.id;
    }

    async function toggleAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para cambiar estado');

        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Aviso no encontrado');

        const current = doc.data()?.status || 'active';
        const newStatus = current === 'active' ? 'paused' : 'active';
        await db.collection(COLLECTION).doc(id).update({
            status: newStatus,
            updatedAt: _now()
        });
        return newStatus;
    }

    async function archiveAviso(ctx, id) {
        const db = _getDb();
        if (!db) throw new Error('Firestore no disponible');
        if (!_canManageAvisos(ctx)) throw new Error('Sin permisos para archivar avisos');
        await db.collection(COLLECTION).doc(id).update({
            status: 'archived',
            updatedAt: _now()
        });
    }

    async function getAllAvisos(ctx, options) {
        const db = _getDb();
        if (!db) return [];

        const limit = Number(options?.limit) || 80;
        const snap = await db.collection(COLLECTION)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map((doc) => _decorateAviso(doc.id, doc.data()));
    }

    async function getActiveAvisos(ctx, options) {
        const profile = _getProfile(ctx) || {};
        const all = await getAllAvisos(ctx, { limit: Number(options?.limit) || DEFAULT_LIMIT });
        return all.filter((aviso) => {
            return resolveStatus(aviso) === 'active' && _matchesAudience(aviso, profile);
        });
    }

    async function getAvisosForStories(ctx) {
        const avisos = await getActiveAvisos(ctx, { limit: DEFAULT_LIMIT });
        return avisos.map((aviso) => ({
            id: aviso.id,
            title: aviso.title,
            type: aviso.type,
            imageUrl: aviso.imageUrl,
            body: aviso.body,
            priority: aviso.priority,
            createdAt: aviso.createdAt,
            audience: aviso.audience || 'all',
            _source: 'aviso'
        }));
    }

    async function getUserViewsMap(ctx, limit) {
        const db = _getDb();
        const uid = _getUid(ctx);
        if (!db || !uid) return {};

        const snap = await db.collection('usuarios')
            .doc(uid)
            .collection(USER_VIEWS_SUBCOLLECTION)
            .limit(Number(limit) || 120)
            .get();

        const map = {};
        snap.docs.forEach((doc) => {
            map[doc.id] = doc.data() || {};
        });
        return map;
    }

    async function recordView(ctx, avisoId, options) {
        const db = _getDb();
        const uid = _getUid(ctx);
        if (!db || !uid || !avisoId) return false;

        const source = (options?.source || 'center').toLowerCase();
        const completed = !!options?.completed;
        const ref = db.collection('usuarios').doc(uid).collection(USER_VIEWS_SUBCOLLECTION).doc(avisoId);

        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(ref);
            const current = snap.exists ? (snap.data() || {}) : {};

            const payload = {
                avisoId,
                userId: uid,
                openCount: (current.openCount || 0) + 1,
                completedCount: (current.completedCount || 0) + (completed ? 1 : 0),
                lastSource: source,
                lastSeenAt: _now(),
                updatedAt: _now()
            };

            if (!snap.exists) {
                payload.firstSeenAt = _now();
            }
            if (completed && !current.firstCompletedAt) {
                payload.firstCompletedAt = _now();
            }
            if (completed) {
                payload.lastCompletedAt = _now();
            }

            transaction.set(ref, payload, { merge: true });
        });

        markSeenLocal(ctx, avisoId);
        return true;
    }

    async function incrementViewCount(ctx, avisoId) {
        return recordView(ctx, avisoId, { source: 'legacy', completed: true });
    }

    window.AvisosService = {
        createAviso,
        updateAviso,
        deleteAviso,
        duplicateAviso,
        toggleAviso,
        archiveAviso,
        getAllAvisos,
        getActiveAvisos,
        getAvisosForStories,
        getUserViewsMap,
        recordView,
        incrementViewCount,
        getLocalSeenMap,
        hasSeenLocal,
        markSeenLocal,
        resolveStatus,
        matchesAudience: _matchesAudience,
        canManage: _canManageAvisos
    };
})();
