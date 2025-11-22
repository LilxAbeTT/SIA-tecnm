// services/medi-service.js
// Servicio de Datos para Módulo Medi
// Separa la lógica de Firestore de la UI

const MediService = (function () {
    const C_CITAS = 'citas-medi';
    const C_EXP = 'expedientes-clinicos';
    const SLOTS_COLL = 'medi-slots';
    const CONFIG_COLL = 'medi-config';

    // Default config (fallback si no hay en Firestore)
    let config = {
        slotStart: 8,
        slotEnd: 20,
        slotStep: 30,
        diasHabiles: [1, 2, 3, 4, 5], // Lun-Vie
        enabled: true
    };



    // --- HELPERS ---
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const slotIdFromDate = d =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}:${pad(d.getMinutes())}`;

    // Helper robusto para fechas (Timestamp, Date, String, Number)
    const safeDate = (val) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        if (val instanceof Date) return val;
        return new Date(val);
    };

    const ts = d => firebase.firestore.Timestamp.fromDate(d);

    // --- CONFIG MANAGEMENT ---
    async function loadConfig(ctx) {
        try {
            const snap = await ctx.db.collection(CONFIG_COLL).doc('schedule').get();
            if (snap.exists) {
                const data = snap.data();
                config = { ...config, ...data };
                console.log('✅ [MediService] Config cargada:', config);
            } else {
                console.log('⚠️ [MediService] No hay config en Firestore, usando defaults');
            }
        } catch (e) {
            if (e.code === 'permission-denied') {
                console.warn('⚠️ [MediService] Sin permisos para leer config (usando defaults).');
            } else {
                console.error('❌ [MediService] Error cargando config:', e);
            }
        }
        return config;
    }

    async function updateConfig(ctx, newConfig) {
        try {
            await ctx.db.collection(CONFIG_COLL).doc('schedule').set(newConfig, { merge: true });
            config = { ...config, ...newConfig };
            return { success: true };
        } catch (e) {
            console.error('❌ [MediService] Error guardando config:', e);
            return { success: false, error: e.message };
        }
    }

    function getConfig() {
        return config;
    }

    // --- PUBLIC METHODS ---

    async function checkExistingAppointment(ctx, studentId, dateStart, dateEnd) {
        const q = await ctx.db.collection(C_CITAS)
            .where('studentId', '==', studentId)
            .where('estado', 'in', ['pendiente', 'confirmada']).get();

        return q.docs.find(d => {
            const data = d.data();
            if (!data.fechaHoraSlot) return false;
            const t = safeDate(data.fechaHoraSlot);
            return t >= dateStart && t < dateEnd;
        });
    }

    async function reservarCita(ctx, { user, date, slotId, tipo, motivo }) {
        return ctx.db.runTransaction(async tx => {
            const slotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
            const snap = await tx.get(slotRef);
            if (snap.exists) throw new Error('Lo sentimos, este horario acaba de ser ocupado.');

            tx.set(slotRef, { holder: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

            const ref = ctx.db.collection(C_CITAS).doc();
            tx.set(ref, {
                studentId: user.uid,
                studentEmail: user.email,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaHoraSlot: ts(date),
                slotId: slotId,
                tipoServicio: tipo,
                motivo: motivo,
                estado: 'pendiente',
                profesionalId: null,
                profesionalEmail: null
            });
        });
    }

    function streamStudentHistory(ctx, uid, callback) {
        // Citas
        const unsubCitas = ctx.db.collection(C_CITAS)
            .where('studentId', '==', uid)
            .orderBy('fechaHoraSlot', 'desc').limit(10)
            .onSnapshot(snap => {
                const citas = snap.docs.map(d => ({ id: d.id, ...d.data(), safeDate: safeDate(d.data().fechaHoraSlot) }));
                callback({ type: 'citas', data: citas });
            });

        // Expedientes
        const unsubExp = ctx.db.collection(C_EXP)
            .where('studentId', '==', uid)
            .where('visiblePaciente', '==', true)
            .orderBy('createdAt', 'desc').limit(10)
            .onSnapshot(snap => {
                const exps = snap.docs.map(d => ({ id: d.id, ...d.data(), safeDate: safeDate(d.data().createdAt) }));
                callback({ type: 'expedientes', data: exps });
            });

        return () => { unsubCitas(); unsubExp(); };
    }

    function streamSalaEspera(ctx, role, callback) {
        return ctx.db.collection(C_CITAS)
            .where('estado', '==', 'pendiente')
            .where('tipoServicio', '==', role)
            .orderBy('fechaHoraSlot', 'asc')
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), safeDate: safeDate(d.data().fechaHoraSlot) }));
                callback(docs);
            });
    }

    function streamAgenda(ctx, profesionalId, callback) {
        return ctx.db.collection(C_CITAS)
            .where('profesionalId', '==', profesionalId)
            .where('estado', '==', 'confirmada')
            .orderBy('fechaHoraSlot', 'asc')
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), safeDate: safeDate(d.data().fechaHoraSlot) }));
                callback(docs);
            });
    }

    async function tomarPaciente(ctx, citaId, profesionalId, profesionalEmail) {
        return ctx.db.runTransaction(async (tx) => {
            const ref = ctx.db.collection(C_CITAS).doc(citaId);
            const snap = await tx.get(ref);

            if (!snap.exists) throw new Error("Cita no encontrada");
            const cita = snap.data();

            if (cita.estado !== 'pendiente') {
                throw new Error("Esta cita ya no está disponible.");
            }

            // Validar conflicto horario
            const conflictQuery = ctx.db.collection(C_CITAS)
                .where('profesionalId', '==', profesionalId)
                .where('estado', '==', 'confirmada')
                .where('fechaHoraSlot', '==', cita.fechaHoraSlot);

            const conflictSnap = await conflictQuery.get();

            if (!conflictSnap.empty) {
                throw new Error('Ya tienes cita a esa hora.');
            }

            tx.update(ref, {
                estado: 'confirmada',
                profesionalId: profesionalId,
                profesionalEmail: profesionalEmail
            });

            return cita; // Return data for notifications
        });
    }

    async function cancelarCitaAdmin(ctx, citaId, motivo, returnToQueue = false) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const updateData = returnToQueue
            ? { estado: 'pendiente', profesionalId: null, profesionalEmail: null }
            : { estado: 'cancelada', motivoCancelacion: motivo };

        await ref.update(updateData);

        // Fetch for notification context
        const snap = await ref.get();
        return snap.data();
    }

    async function getExpedienteHistory(ctx, studentId, role, profesionalId) {
        let queries = [];
        // 1. Médico General (visible para todos roles salud)
        queries.push(
            ctx.db.collection(C_EXP)
                .where('studentId', '==', studentId)
                .where('tipoServicio', '==', 'Medico')
                .get()
        );

        // 2. Psicológico (solo si soy psicólogo y son MÍAS)
        if (role === 'Psicologo') {
            queries.push(
                ctx.db.collection(C_EXP)
                    .where('studentId', '==', studentId)
                    .where('tipoServicio', '==', 'Psicologico')
                    .where('autorId', '==', profesionalId)
                    .get()
            );
        }

        const snapshots = await Promise.all(queries);
        let docs = [];
        snapshots.forEach(s => s.docs.forEach(d => docs.push({ ...d.data(), safeDate: safeDate(d.data().createdAt) })));

        // Ordenar
        docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));
        return docs;
    }

    async function saveConsulta(ctx, payload, citaId) {
        return ctx.db.runTransaction(async (tx) => {
            const expRef = ctx.db.collection(C_EXP).doc();
            tx.set(expRef, payload);

            if (citaId) {
                const citaRef = ctx.db.collection(C_CITAS).doc(citaId);
                tx.update(citaRef, { estado: 'finalizada' });
            }
        });
    }

    async function buscarPaciente(ctx, email) {
        const snap = await ctx.db.collection('usuarios').where('email', '==', email.trim()).get();
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    return {
        // Config
        loadConfig,
        updateConfig,
        getConfig,
        // Data methods


        safeDate,
        checkExistingAppointment,
        reservarCita,
        streamStudentHistory,
        streamSalaEspera,
        streamAgenda,
        tomarPaciente,
        cancelarCitaAdmin,
        getExpedienteHistory,
        saveConsulta,
        buscarPaciente,
        // Helpers exportados
        pad, toISO, slotIdFromDate
    };

})();
