const BiblioAssetsService = (function () {
    const ASSETS_COLL = 'biblio-activos';
    const RES_COLL = 'biblio-reservas';
    const USERS_COLL = 'usuarios';
    const CLEAR_OCCUPANCY = {
        occupiedBy: null,
        occupiedByMatricula: null,
        occupiedAt: null,
        expiresAt: null
    };

    function getReservationStart(date, hourBlock) {
        if (!date) return null;
        const safeHour = hourBlock || '00:00';
        return new Date(`${date}T${safeHour}:00`);
    }

    function getReservationEnd(date, hourBlock) {
        const start = getReservationStart(date, hourBlock);
        if (!start || Number.isNaN(start.getTime())) return null;
        return new Date(start.getTime() + 60 * 60 * 1000);
    }

    function isUpcomingReservation(data, now = new Date()) {
        if (!data || data.status !== 'activa' || !data.date) return false;

        const end = getReservationEnd(data.date, data.hourBlock);
        if (!end) return data.date >= now.toISOString().split('T')[0];
        return end > now;
    }

    function getAssetExpiryMillis(data = {}) {
        if (data.expiresAt?.toMillis) return data.expiresAt.toMillis();
        if (typeof data.expiresAt === 'number') return data.expiresAt;

        const occupiedAt = data.occupiedAt?.toMillis
            ? data.occupiedAt.toMillis()
            : (typeof data.occupiedAt === 'number' ? data.occupiedAt : null);
        return occupiedAt ? occupiedAt + (60 * 60 * 1000) : null;
    }

    async function getAssetDoc(ctx, assetId) {
        const assetRef = ctx.db.collection(ASSETS_COLL).doc(assetId);
        const assetSnap = await assetRef.get();
        if (!assetSnap.exists) throw new Error("El activo ya no existe.");
        return { ref: assetRef, snap: assetSnap, data: assetSnap.data() || {} };
    }

    async function getUpcomingReservationsForAsset(ctx, assetId) {
        const snap = await ctx.db.collection(RES_COLL)
            .where('assetId', '==', assetId)
            .get();

        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => isUpcomingReservation(item));
    }

    async function ensureAssetCanBeDisabledOrDeleted(ctx, assetId) {
        const asset = await getAssetDoc(ctx, assetId);
        if (asset.data.status === 'ocupado') {
            throw new Error("El activo está ocupado. Libéralo antes de deshabilitarlo o eliminarlo.");
        }

        const upcomingReservations = await getUpcomingReservationsForAsset(ctx, assetId);
        if (upcomingReservations.length > 0) {
            throw new Error("El activo tiene reservas futuras activas. Cancélalas o reprográmalas antes.");
        }

        return asset;
    }

    // Stream de activos para ver disponibilidad en tiempo real
    function streamAssets(ctx, callback) {
        return ctx.db.collection(ASSETS_COLL)
            .where('status', '!=', 'mantenimiento') // Solo mostrar operativos
            .onSnapshot(snap => {
                callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
    }

    // Para Admin: ver todos incluso mantenimiento
    function streamAssetsAdmin(ctx, callback) {
        return ctx.db.collection(ASSETS_COLL).onSnapshot(snap => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }

    // [NEW] Helper para obtener lista una vez (para calcular nombres)
    async function getAssetsOnce(ctx) {
        const snap = await ctx.db.collection(ASSETS_COLL).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function getServiceCatalog(ctx) {
        const assets = (await getAssetsOnce(ctx))
            .filter(asset => asset.status !== 'mantenimiento');

        const base = {
            pc: { type: 'pc', total: 0, available: 0, occupied: 0 },
            sala: { type: 'sala', total: 0, available: 0, occupied: 0 },
            mesa: { type: 'mesa', total: 0, available: 0, occupied: 0 }
        };

        assets.forEach(asset => {
            const type = asset.tipo;
            if (!base[type]) return;
            base[type].total += 1;
            if (asset.status === 'disponible') base[type].available += 1;
            if (asset.status === 'ocupado') base[type].occupied += 1;
        });

        return base;
    }

    async function saveAsset(ctx, id, data) {
        const ref = ctx.db.collection(ASSETS_COLL);
        if (id) {
            const asset = await getAssetDoc(ctx, id);
            const cleanUpdate = { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

            if (cleanUpdate.status === 'mantenimiento') {
                await ensureAssetCanBeDisabledOrDeleted(ctx, id);
                Object.assign(cleanUpdate, CLEAR_OCCUPANCY);
            } else if (cleanUpdate.status === 'disponible' && asset.data.status !== 'ocupado') {
                Object.assign(cleanUpdate, CLEAR_OCCUPANCY);
            }

            return ref.doc(id).update(cleanUpdate);
        } else {
            const newId = data.nombre.replace(/\s+/g, '-').toUpperCase();
            const docRef = ref.doc(newId);
            await ctx.db.runTransaction(async t => {
                const existing = await t.get(docRef);
                if (existing.exists) throw new Error("Ya existe un activo con ese nombre.");
                t.set(docRef, {
                    ...data,
                    status: 'disponible',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ...CLEAR_OCCUPANCY
                });
            });
            return docRef;
        }
    }

    async function getMyReservations(ctx, uid) {
        const snap = await ctx.db.collection(RES_COLL)
            .where('studentId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(25)
            .get();

        const reservations = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => isUpcomingReservation(item))
            .sort((a, b) => {
                const aStart = getReservationStart(a.date, a.hourBlock) || new Date(8640000000000000);
                const bStart = getReservationStart(b.date, b.hourBlock) || new Date(8640000000000000);
                return aStart.getTime() - bStart.getTime();
            });

        if (reservations.length === 0) return [];

        const assets = await getAssetsOnce(ctx);
        const assetsMap = new Map(assets.map(asset => [asset.id, asset.nombre || asset.id]));

        return reservations.map(item => ({
            ...item,
            assetName: item.assetName || assetsMap.get(item.assetId) || item.assetId
        }));
    }

    async function getUserReservationPerks(ctx, uid) {
        if (!uid) {
            return { maxDailyReservations: 1, reservationLeadMinutes: 15 };
        }

        try {
            const userSnap = await ctx.db.collection(USERS_COLL).doc(uid).get();
            const perks = userSnap.data()?.biblioPerks || {};
            return {
                maxDailyReservations: Math.max(1, Number(perks.maxDailyReservations) || 1),
                reservationLeadMinutes: Math.max(5, Number(perks.reservationLeadMinutes) || 15)
            };
        } catch (error) {
            console.warn('[BIBLIO] No se pudieron leer perks de reserva:', error);
            return { maxDailyReservations: 1, reservationLeadMinutes: 15 };
        }
    }

    async function deleteAsset(ctx, id) {
        await ensureAssetCanBeDisabledOrDeleted(ctx, id);
        return ctx.db.collection(ASSETS_COLL).doc(id).delete();
    }

    async function checkUserDailyLimit(ctx, uid, date) {
        const snap = await ctx.db.collection(RES_COLL)
            .where('studentId', '==', uid)
            .where('date', '==', date)
            .where('status', '!=', 'cancelado') // Si canceló, permiso de nuevo
            .get();

        return snap.size;
    }

    async function reservarEspacio(ctx, { studentId, assetId, hourBlock, date, tipo }) {
        const now = new Date();
        const slotStart = getReservationStart(date, hourBlock);
        const perks = await getUserReservationPerks(ctx, studentId);
        const minLeadMinutes = Math.max(5, Number(perks.reservationLeadMinutes) || 15);
        const maxDailyReservations = Math.max(1, Number(perks.maxDailyReservations) || 1);
        if (!slotStart || Number.isNaN(slotStart.getTime())) {
            throw new Error("El horario seleccionado no es válido.");
        }
        if (slotStart.getTime() - now.getTime() < minLeadMinutes * 60 * 1000) {
            throw new Error(`Las reservas deben realizarse con al menos ${minLeadMinutes} minutos de anticipacion.`);
        }
        // 1. Validar Límite Diario por Usuario
        const reservationCount = await checkUserDailyLimit(ctx, studentId, date);
        if (reservationCount >= maxDailyReservations) {
            throw new Error(`Ya alcanzaste tu limite de ${maxDailyReservations} reserva${maxDailyReservations === 1 ? '' : 's'} para este dia.`);
        }

        // 2. Validar Colisión de Espacio (Concurrency)
        // ID Compuesto: ID_FECHA_HORA
        const resId = `${assetId}_${date}_${hourBlock.replace(':', '')}`;
        const ref = ctx.db.collection(RES_COLL).doc(resId);
        const assetRef = ctx.db.collection(ASSETS_COLL).doc(assetId);
        const userRef = ctx.db.collection(USERS_COLL).doc(studentId);

        await ctx.db.runTransaction(async t => {
            const assetDoc = await t.get(assetRef);
            if (!assetDoc.exists) throw new Error("El activo seleccionado ya no existe.");

            const assetData = assetDoc.data() || {};
            if (assetData.status === 'mantenimiento') {
                throw new Error("Este activo está en mantenimiento y no admite reservas.");
            }
            if (assetData.tipo && assetData.tipo !== tipo) {
                throw new Error("El activo seleccionado no coincide con el tipo solicitado.");
            }
            const occupiedUntil = assetData.expiresAt?.toDate ? assetData.expiresAt.toDate() : null;
            if (assetData.status === 'ocupado' && date === now.toISOString().split('T')[0]) {
                if (!occupiedUntil || occupiedUntil > slotStart) {
                    throw new Error(`${assetData.nombre || 'El activo'} sigue ocupado y no alcanza a liberarse para ese horario.`);
                }
            }

            const doc = await t.get(ref);
            if (doc.exists) {
                const d = doc.data();
                if (d.status !== 'cancelado') throw new Error("Este horario ya fue ocupado por alguien más.");
            }

            t.set(ref, {
                studentId,
                assetId,
                assetName: assetData.nombre || assetId,
                date,
                hourBlock, // "10:00"
                tipo,      // 'pc' or 'sala'
                status: 'activa',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            t.set(userRef, {
                biblioReservationCount: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });
        });
    }

    async function cancelarReserva(ctx, reservationId) {
        const ref = ctx.db.collection(RES_COLL).doc(reservationId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("La reserva ya no existe.");

        const data = snap.data() || {};
        if (data.studentId !== ctx.auth.currentUser.uid) {
            throw new Error("Solo puedes cancelar tus propias reservas.");
        }
        if (data.status !== 'activa') {
            throw new Error("La reserva ya no está activa.");
        }

        await ref.delete();
    }

    async function getAvailability(ctx, date, tipo) {
        // Traer todas las reservas de esa fecha para ese tipo de activo
        const snap = await ctx.db.collection(RES_COLL)
            .where('date', '==', date)
            .where('tipo', '==', tipo)
            .where('status', '==', 'activa')
            .get();

        // Map: assetId -> [occupiedHours]
        const map = {};
        snap.forEach(doc => {
            const d = doc.data();
            if (!map[d.assetId]) map[d.assetId] = [];
            map[d.assetId].push(d.hourBlock);
        });
        return map;
    }

    async function asignarMesaAutomatica(ctx, uid, matricula) {
        const assetsRef = ctx.db.collection(ASSETS_COLL);
        let freeTablesSnap = await assetsRef
            .where('tipo', '==', 'mesa')
            .where('status', '==', 'disponible')
            .limit(8)
            .get();

        // [FIX] Auto-initialize if running low on tables (ensure 8 exist)
        if (freeTablesSnap.empty) {
            const allTablesSnap = await assetsRef.where('tipo', '==', 'mesa').get();
            const totalTables = allTablesSnap.size;

            if (totalTables < 8) {
                console.log(`[ASSETS] Found ${totalTables} tables. Initializing up to 8...`);
                await initializeDefaultTables(ctx, totalTables + 1);
                freeTablesSnap = await assetsRef.where('tipo', '==', 'mesa').where('status', '==', 'disponible').limit(8).get();
            }
        }

        if (freeTablesSnap.empty) throw new Error("No hay mesas disponibles en este momento. (Todas ocupadas)");

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora

        for (const table of freeTablesSnap.docs) {
            try {
                await ctx.db.runTransaction(async t => {
                    const current = await t.get(table.ref);
                    if (!current.exists) throw new Error("Mesa no disponible.");
                    const currentData = current.data() || {};
                    if (currentData.status !== 'disponible') throw new Error("Mesa no disponible.");

                    t.update(table.ref, {
                        status: 'ocupado',
                        occupiedBy: uid || 'anonimo',
                        occupiedByMatricula: matricula || null,
                        occupiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
                    });
                });

                return { id: table.id, nombre: table.data().nombre };
            } catch (error) {
                if ((error.message || '').includes('no disponible')) continue;
                throw error;
            }
        }

        throw new Error("No hay mesas disponibles en este momento. (Todas ocupadas)");
    }

    async function initializeDefaultTables(ctx, startIdx = 1) {
        const batch = ctx.db.batch();
        const ref = ctx.db.collection(ASSETS_COLL);
        for (let i = startIdx; i <= 8; i++) {
            const id = `MESA-${i.toString().padStart(2, '0')}`; // MESA-01 format
            batch.set(ref.doc(id), {
                nombre: `Mesa ${i}`,
                tipo: 'mesa',
                status: 'disponible',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        await batch.commit();
    }

    async function asignarActivoManual(ctx, uid, assetId, meta = {}) {
        // [FIX] Prevent multiple PC assignments
        const existingSession = await ctx.db.collection(ASSETS_COLL)
            .where('occupiedBy', '==', uid)
            .where('tipo', 'in', ['pc', 'sala']) // Check mostly PCs
            .where('status', '==', 'ocupado')
            .limit(1)
            .get();

        if (!existingSession.empty) {
            const asset = existingSession.docs[0].data();
            throw new Error(`El usuario ya está ocupando: ${asset.nombre}`);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora

        const assetRef = ctx.db.collection(ASSETS_COLL).doc(assetId);
        await ctx.db.runTransaction(async t => {
            const assetDoc = await t.get(assetRef);
            if (!assetDoc.exists) throw new Error("El activo ya no existe.");

            const assetData = assetDoc.data() || {};
            if (assetData.status !== 'disponible') {
                throw new Error(`${assetData.nombre || 'El activo'} ya no está disponible.`);
            }

            t.update(assetRef, {
                status: 'ocupado',
                occupiedBy: uid,
                occupiedByMatricula: meta.matricula || assetData.occupiedByMatricula || null,
                occupiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
            });
        });
    }

    async function liberarActivo(ctx, assetId) {
        await ctx.db.collection(ASSETS_COLL).doc(assetId).update({
            status: 'disponible',
            ...CLEAR_OCCUPANCY
        });
    }

    async function liberarActivoDeUsuario(ctx, uid) {
        const snap = await ctx.db.collection(ASSETS_COLL)
            .where('occupiedBy', '==', uid)
            .where('status', '==', 'ocupado')
            .get();

        if (snap.empty) return null; // No active asset

        const batch = ctx.db.batch();
        snap.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: 'disponible',
                ...CLEAR_OCCUPANCY
            });
        });
        await batch.commit();
        return snap.docs.map(d => d.data().nombre).join(', ');
    }

    // [FIX] Liberar automáticamente activos cuyo tiempo de 1 hora ya expiró
    async function liberarActivosExpirados(ctx) {
        const nowMs = Date.now();
        const snap = await ctx.db.collection(ASSETS_COLL)
            .where('status', '==', 'ocupado')
            .get();

        if (snap.empty) return [];

        const batch = ctx.db.batch();
        const liberados = [];

        snap.docs.forEach(doc => {
            const data = doc.data();
            const expiryMs = getAssetExpiryMillis(data);
            if (expiryMs && expiryMs <= nowMs) {
                batch.update(doc.ref, {
                    status: 'disponible',
                    ...CLEAR_OCCUPANCY
                });
                liberados.push(data.nombre);
            }
        });

        if (liberados.length > 0) {
            await batch.commit();
            console.log(`[ASSETS] Auto-liberados: ${liberados.join(', ')}`);
        }
        return liberados;
    }

    return {
        streamAssets,
        streamAssetsAdmin,
        getAssetsOnce, // Exported
        getServiceCatalog,
        saveAsset,
        deleteAsset,
        reservarEspacio,
        cancelarReserva,
        getMyReservations,
        getAvailability,
        asignarMesaAutomatica,
        asignarActivoManual,
        liberarActivo,
        liberarActivoDeUsuario,
        liberarActivosExpirados,
        initializeDefaultTables
    };
})();
window.BiblioAssetsService = BiblioAssetsService;
