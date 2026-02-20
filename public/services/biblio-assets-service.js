const BiblioAssetsService = (function () {
    const ASSETS_COLL = 'biblio-activos';
    const RES_COLL = 'biblio-reservas';

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

    async function saveAsset(ctx, id, data) {
        const ref = ctx.db.collection(ASSETS_COLL);
        if (id) {
            return ref.doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            const newId = data.nombre.replace(/\s+/g, '-').toUpperCase();
            return ref.doc(newId).set({ ...data, status: 'disponible', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }

    async function getMyReservations(ctx, uid) {
        const snap = await ctx.db.collection(RES_COLL)
            .where('studentId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function deleteAsset(ctx, id) {
        return ctx.db.collection(ASSETS_COLL).doc(id).delete();
    }

    async function checkUserDailyLimit(ctx, uid, date) {
        // Formato fecha: YYYY-MM-DD
        const startOfDay = new Date(date + 'T00:00:00');
        const endOfDay = new Date(date + 'T23:59:59');

        // Convert to Firestore Timestamps for query if stored as such, 
        // but here we stored 'date' string in 'reservarEspacio'.
        // Let's query by string date for simplicity as defined in 'reservarEspacio'

        const snap = await ctx.db.collection(RES_COLL)
            .where('studentId', '==', uid)
            .where('date', '==', date)
            .where('status', '!=', 'cancelado') // Si canceló, permiso de nuevo
            .get();

        return !snap.empty; // True si ya tiene reserva
    }

    async function reservarEspacio(ctx, { studentId, assetId, hourBlock, date, tipo }) {
        // 1. Validar Límite Diario por Usuario
        const hasBooking = await checkUserDailyLimit(ctx, studentId, date);
        if (hasBooking) {
            throw new Error("Ya tienes una reserva para este día. Límite: 1 diaria.");
        }

        // 2. Validar Colisión de Espacio (Concurrency)
        // ID Compuesto: ID_FECHA_HORA
        const resId = `${assetId}_${date}_${hourBlock.replace(':', '')}`;
        const ref = ctx.db.collection(RES_COLL).doc(resId);

        await ctx.db.runTransaction(async t => {
            const doc = await t.get(ref);
            if (doc.exists) {
                const d = doc.data();
                if (d.status !== 'cancelado') throw new Error("Este horario ya fue ocupado por alguien más.");
            }

            t.set(ref, {
                studentId,
                assetId,
                date,
                hourBlock, // "10:00"
                tipo,      // 'pc' or 'sala'
                status: 'activa',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
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
        // Try to find free table
        let freeTablesSnap = await assetsRef
            .where('tipo', '==', 'mesa')
            .where('status', '==', 'disponible')
            .limit(1)
            .get();

        // [FIX] Auto-initialize if running low on tables (ensure 8 exist)
        if (freeTablesSnap.empty) {
            const allTablesSnap = await assetsRef.where('tipo', '==', 'mesa').get();
            const totalTables = allTablesSnap.size;

            if (totalTables < 8) {
                console.log(`[ASSETS] Found ${totalTables} tables. Initializing up to 8...`);
                await initializeDefaultTables(ctx, totalTables + 1);
                freeTablesSnap = await assetsRef.where('tipo', '==', 'mesa').where('status', '==', 'disponible').limit(1).get();
            }
        }

        if (freeTablesSnap.empty) throw new Error("No hay mesas disponibles en este momento. (Todas ocupadas)");

        const table = freeTablesSnap.docs[0];

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora

        await assetsRef.doc(table.id).update({
            status: 'ocupado',
            occupiedBy: uid || 'anonimo',
            occupiedByMatricula: matricula,
            occupiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
        });

        return { id: table.id, nombre: table.data().nombre };
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

    async function asignarActivoManual(ctx, uid, assetId) {
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

        await ctx.db.collection(ASSETS_COLL).doc(assetId).update({
            status: 'ocupado',
            occupiedBy: uid,
            occupiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
        });
    }

    async function liberarActivo(ctx, assetId) {
        await ctx.db.collection(ASSETS_COLL).doc(assetId).update({
            status: 'disponible',
            occupiedBy: null,
            occupiedByMatricula: null,
            occupiedAt: null,
            expiresAt: null
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
                occupiedBy: null,
                occupiedByMatricula: null,
                occupiedAt: null,
                expiresAt: null
            });
        });
        await batch.commit();
        return snap.docs.map(d => d.data().nombre).join(', ');
    }

    // [FIX] Liberar automáticamente activos cuyo tiempo de 1 hora ya expiró
    async function liberarActivosExpirados(ctx) {
        const now = firebase.firestore.Timestamp.now();
        const snap = await ctx.db.collection(ASSETS_COLL)
            .where('status', '==', 'ocupado')
            .get();

        if (snap.empty) return [];

        const batch = ctx.db.batch();
        const liberados = [];

        snap.docs.forEach(doc => {
            const data = doc.data();
            // Si tiene expiresAt y ya pasó, liberar
            if (data.expiresAt && data.expiresAt.toMillis() <= now.toMillis()) {
                batch.update(doc.ref, {
                    status: 'disponible',
                    occupiedBy: null,
                    occupiedByMatricula: null,
                    occupiedAt: null,
                    expiresAt: null
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
        saveAsset,
        deleteAsset,
        reservarEspacio,
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