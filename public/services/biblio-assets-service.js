// services/biblio-assets-service.js
// Servicio de Gestión de Activos y Ciber-Control (Smart Library)

const BiblioAssetsService = (function () {
    const ASSETS_COLL = 'biblio-activos';
    const RESERVAS_COLL = 'biblio-reservas';

    // --- KIOSK / CLIENT METHODS (PC) ---

    // Escucha en tiempo real el estado de bloqueo de ESTA computadora
    function listenToAssetLock(ctx, assetId, callback) {
        return ctx.db.collection(ASSETS_COLL).doc(assetId)
            .onSnapshot(snap => {
                if (!snap.exists) return callback(null);
                const data = snap.data();
                // Calculamos si el tiempo de uso expiró
                let isExpired = false;
                if (data.unlockUntil) {
                    const now = new Date();
                    const until = data.unlockUntil.toDate();
                    isExpired = now > until;
                }

                callback({
                    id: snap.id,
                    ...data,
                    isExpired
                });
            });
    }

    // --- ADMIN METHODS ---

    function streamAssets(ctx, callback) {
        return ctx.db.collection(ASSETS_COLL).orderBy('tipo').onSnapshot(snap => {
            const assets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(assets);
        });
    }

    async function createAsset(ctx, { id, tipo, nombre }) {
        // El ID es manual (ej. "PC-01") para facilitar configuración física
        await ctx.db.collection(ASSETS_COLL).doc(id).set({
            tipo, // 'pc', 'sala', 'mesa'
            nombre,
            estado: 'locked', // locked, active, maintenance
            currentUser: null,
            unlockUntil: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function unlockAsset(ctx, assetId, minutes, userLabel) {
        const until = new Date();
        until.setMinutes(until.getMinutes() + minutes);

        await ctx.db.collection(ASSETS_COLL).doc(assetId).update({
            estado: 'active',
            currentUser: userLabel || 'Estudiante',
            unlockUntil: firebase.firestore.Timestamp.fromDate(until),
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function lockAsset(ctx, assetId) {
        await ctx.db.collection(ASSETS_COLL).doc(assetId).update({
            estado: 'locked',
            currentUser: null,
            unlockUntil: null,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function deleteAsset(ctx, assetId) {
        await ctx.db.collection(ASSETS_COLL).doc(assetId).delete();
    }

    // --- STUDENT RESERVATION METHODS ---

    async function reserveAsset(ctx, { assetId, date, hourBlock, studentId, studentName }) {
        // date format: "YYYY-MM-DD"
        // hourBlock: "08:00", "09:00", etc.

        const rId = `${assetId}_${date}_${hourBlock}`; // ID compuesto para evitar duplicados
        const ref = ctx.db.collection(RESERVAS_COLL).doc(rId);

        return ctx.db.runTransaction(async tx => {
            const doc = await tx.get(ref);
            if (doc.exists) throw new Error("Este horario ya está ocupado.");

            // Validar que el activo esté activo (no mantenimiento)
            const assetRef = ctx.db.collection(ASSETS_COLL).doc(assetId);
            const assetSnap = await tx.get(assetRef);
            if (!assetSnap.exists || assetSnap.data().estado === 'maintenance') {
                throw new Error("El recurso no está disponible.");
            }

            tx.set(ref, {
                assetId,
                assetName: assetSnap.data().nombre,
                studentId,
                studentName,
                date,
                hourBlock,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active' // active, cancelled, completed
            });
        });
    }

    function streamMyReservations(ctx, uid, callback) {
        const today = new Date().toISOString().split('T')[0];
        return ctx.db.collection(RESERVAS_COLL)
            .where('studentId', '==', uid)
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }

    async function cancelReservation(ctx, id) {
        return ctx.db.collection(RESERVAS_COLL).doc(id).delete();
    }

   

    return {
        listenToAssetLock,
        streamAssets,
        createAsset,
        unlockAsset,
        lockAsset,
        deleteAsset,
        reserveAsset, streamMyReservations, cancelReservation,
    };

})();

window.BiblioAssetsService = BiblioAssetsService;