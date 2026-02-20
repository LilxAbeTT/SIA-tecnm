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
        slotEnd: 22,
        slotStep: 30, // Visual step (Legacy) - Now we use slotDuration
        slotDuration: 60, // [NEW] Default duration in minutes (45 or 60)
        diasHabiles: [1, 2, 3, 4, 5], // Lun-Vie
        availableMedico: true,
        availablePsicologo: true
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
                console.log('⚠️ [MediService] No hay config en Firestore, usando defaults (Silencioso)');
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
    // --- SHIFT PROFILE MANAGEMENT ---
    async function getShiftProfile(ctx, role, shift) {
        if (!role || !shift) return null;
        try {
            const key = `${role.toLowerCase()}_${shift.toLowerCase()}`;
            const docRef = ctx.db.collection(CONFIG_COLL).doc('staff_directory');
            const snap = await docRef.get();
            if (snap.exists && snap.data()[key]) {
                return snap.data()[key];
            }
        } catch (e) { console.error("Error reading shift profile:", e); }
        return null;
    }

    async function updateShiftProfile(ctx, role, shift, { name, cedula }) {
        const key = `${role.toLowerCase()}_${shift.toLowerCase()}`;
        const updateData = {};
        updateData[key] = {
            name: name,
            cedula: cedula,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: ctx.auth.currentUser.uid
        };
        // Use set with merge to ensure doc exists
        return ctx.db.collection(CONFIG_COLL).doc('staff_directory').set(updateData, { merge: true });
    }

    // [NEW] Strict Resolution for Booking (Matricula + Shift Profile)
    async function resolveProfessionalForBooking(ctx, tipo, date) {
        let targetMatricula = '';
        if (tipo === 'Medico') targetMatricula = 'atencionmedica';
        else if (tipo === 'Psicologo') targetMatricula = 'atencionpsicopedagogica';
        else return null;

        try {
            // A. Find Main User Account by Matricula
            const q = await ctx.db.collection('usuarios').where('matricula', '==', targetMatricula).limit(1).get();
            if (q.empty) {
                console.warn(`[MediService] Alert: No account found for matricula: ${targetMatricula}`);
                return null;
            }

            const mainUserDoc = q.docs[0];
            const mainUserData = mainUserDoc.data();
            const mainUid = mainUserDoc.id;

            // Base Result (Account Owner)
            let result = {
                id: mainUid,
                displayName: mainUserData.displayName || (tipo === 'Medico' ? 'Atención Médica' : 'Atención Psicopedagógica'),
                email: mainUserData.email,
                profileId: null
            };

            // B. If Psicologo, find specific Profile based on Time
            if (tipo === 'Psicologo') {
                const hour = date.getHours();
                // Logic: Matutino (Edrey) until 15:00, Vespertino (Carmen) after 15:00
                const targetShift = hour < 15 ? 'Matutino' : 'Vespertino';

                const profilesSnap = await ctx.db.collection('usuarios').doc(mainUid).collection('profiles').get();
                if (!profilesSnap.empty) {
                    // Find match by legacyShift (or role if we wanted generic)
                    const match = profilesSnap.docs.find(d => {
                        const p = d.data();
                        return p.legacyShift === targetShift;
                    });

                    if (match) {
                        const pData = match.data();
                        result.profileId = match.id;
                        // Use ShortName for friendlier chat header if available
                        result.displayName = pData.shortName || pData.displayName || result.displayName;
                        console.log(`[MediService] Resolved Profile for Booking: ${result.displayName} (${targetShift})`);
                    }
                }
            }

            return result;

        } catch (e) {
            console.error("[MediService] Error resolving professional:", e);
            return null;
        }
    }

    // --- PUBLIC METHODS ---

    async function checkActiveAppointment(ctx, studentId) {
        // [NEW] Strict Check: Only one active appointment allowed (Pending or Confirmed)
        // Refactored to avoid composite index requirements (created + studentId + estado) which might be missing.
        // We fetch all active appointments for this student (low volume) and sort in memory.

        try {
            const q = await ctx.db.collection(C_CITAS)
                .where('studentId', '==', studentId)
                .where('estado', 'in', ['pendiente', 'confirmada'])
                .get(); // No orderBy here to avoid index error

            if (q.empty) return null;

            const docs = q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            // Sort by date desc (newest first)
            docs.sort((a, b) => b.safeDate - a.safeDate);

            return docs[0]; // Return the latest one
        } catch (e) {
            console.error("Error checking active appointment:", e);
            return null; // Fail safe
        }
    }

    async function getOccupiedSlots(ctx, date, tipo) {
        // Range for the whole day
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(date); end.setHours(23, 59, 59, 999);

        let query = ctx.db.collection(C_CITAS)
            .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(start))
            .where('fechaHoraSlot', '<=', firebase.firestore.Timestamp.fromDate(end))
            .where('estado', 'in', ['pendiente', 'confirmada']); // Only active

        // [NEW] Filter by Type if provided
        if (tipo) {
            query = query.where('tipoServicio', '==', tipo);
        }

        const q = await query.get();

        // [NEW] Normalize IDs:
        // If we find a legacy ID (no suffix) that belongs to this Type, we treat it as if it had the suffix.
        // This ensures old appointments block the correct schedule.
        return q.docs.map(d => {
            const data = d.data();
            const sid = data.slotId;
            if (!sid) return null;

            // Check if legacy (no underscores after time part, or simple heuristic)
            // Format: YYYY-MM-DD_HH:MM
            // New Format: YYYY-MM-DD_HH:MM_Type

            // If it already has the suffix matching the type, return it.
            if (tipo && sid.endsWith(`_${tipo}`)) return sid;

            // If it has NO suffix (Legacy) AND matches the requested type in data, 
            // return it AS IF it had the suffix (so UI marks it occupied).
            if (tipo && !sid.includes('_Medico') && !sid.includes('_Psicologo')) {
                // It's a legacy ID. Since we filtered by Type, this Appointment belongs to 'tipo'.
                // So we upgrade its ID for the UI check.
                return `${sid}_${tipo}`;
            }

            return sid;
        }).filter(Boolean);
    }

    async function reservarCita(ctx, { user, date, slotId, tipo, motivo, replaceCitaId, profesionalId, profesionalName, profesionalProfileId }) {
        // Matutino: 8:00 - 14:59 (< 15). Vespertino: 15:00 - 21:00 (>= 15).
        const h = date.getHours();
        const computedShift = h < 15 ? 'Matutino' : 'Vespertino';

        console.log(`[MediService] Reservando cita para ${user.email} con ${profesionalName || 'General'} (${tipo})`);

        return ctx.db.runTransaction(async tx => {
            // 1. READS FIRST (Rule: All reads before any write)

            // A. Check New Slot Availability
            const slotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
            const snap = await tx.get(slotRef);
            if (snap.exists) throw new Error('Este horario ya no está disponible.');

            // B. If replacing...
            let oldRef = null;
            let oldData = null;
            if (replaceCitaId) {
                oldRef = ctx.db.collection(C_CITAS).doc(replaceCitaId);
                const oldSnap = await tx.get(oldRef);
                if (oldSnap.exists) oldData = oldSnap.data();
            }

            // 2. WRITES
            tx.set(slotRef, { holder: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

            if (oldRef && oldData) {
                if (oldData.slotId) {
                    const oldSlotRef = ctx.db.collection(SLOTS_COLL).doc(oldData.slotId);
                    tx.delete(oldSlotRef);
                }
                tx.update(oldRef, {
                    estado: 'cancelada',
                    motivoCancelacion: 'Re-agendada por usuario (Upgrade)',
                    fechaCancelacion: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            const ref = ctx.db.collection(C_CITAS).doc();
            const citaData = {
                studentId: user.uid,
                studentEmail: user.email,
                studentName: user.displayName || user.email,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
                slotId: slotId,
                tipoServicio: tipo,
                motivo: motivo,
                shift: computedShift,
                estado: 'pendiente',
                profesionalId: profesionalId || null,
                profesionalName: profesionalName || null,
                profesionalProfileId: profesionalProfileId || null
            };
            tx.set(ref, citaData);
            return ref.id; // Return ID for reference
        });
    }

    // [REMOVED] Legacy reservarCitaAdmin without profileData — see refactored version at line ~637

    async function modificarCita(ctx, citaId, { date, slotId, tipo, motivo }) {
        return ctx.db.runTransaction(async tx => {
            const citaRef = ctx.db.collection(C_CITAS).doc(citaId);
            const citaSnap = await tx.get(citaRef);
            if (!citaSnap.exists) throw new Error("La cita no existe.");
            const oldData = citaSnap.data();

            if (oldData.slotId !== slotId) {
                const oldSlotRef = ctx.db.collection(SLOTS_COLL).doc(oldData.slotId);
                const newSlotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
                const newSlotSnap = await tx.get(newSlotRef);
                if (newSlotSnap.exists) throw new Error("El nuevo horario ya está ocupado.");

                tx.delete(oldSlotRef);
                tx.set(newSlotRef, { holder: oldData.studentId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            tx.update(citaRef, {
                fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
                slotId: slotId,
                tipoServicio: tipo,
                motivo: motivo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }


    async function cancelarCitaEstudiante(ctx, citaId, motivo) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data();

        if (data.slotId) {
            await ctx.db.collection(SLOTS_COLL).doc(data.slotId).delete().catch(() => { });
        }

        return ref.update({
            estado: 'cancelada',
            motivoCancelacion: motivo || "Cancelada por el estudiante",
            fechaCancelacion: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    function streamStudentHistory(ctx, uid, callback) {
        // Citas: Eliminamos orderBy para evitar el error de índice compuesto
        const unsubCitas = ctx.db.collection(C_CITAS)
            .where('studentId', '==', uid)
            .onSnapshot(snap => {
                console.log(`[MediService] Stream Citas Update: ${snap.size} docs found for ${uid}`);
                const citas = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    safeDate: safeDate(d.data().fechaHoraSlot)
                }));

                // Ordenamos manualmente por fecha descendente en el cliente
                citas.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

                callback({ type: 'citas', data: citas.slice(0, 50) });
            }, err => console.error("Error stream Citas:", err));

        // Expedientes - CORRECCIÓN: Apuntar a la subcolección 'consultas'
        // Estructura: expedientes-clinicos/{uid}/consultas/{consultaId}
        const unsubExp = ctx.db.collection(C_EXP).doc(uid).collection('consultas')
            .orderBy('createdAt', 'desc') // Ahora sí podemos usar orderBy porque es una colección simple por usuario
            .limit(20) // Traemos más para el "Ver más"
            .onSnapshot(snap => {
                const exps = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    safeDate: safeDate(d.data().createdAt)
                }));
                // Orden ya viene del query
                callback({ type: 'expedientes', data: exps });
            }, err => {
                console.error("Error stream Expedientes:", err);
                // Fallback a array vacío si falla (ej. permisos o no existe)
                callback({ type: 'expedientes', data: [] });
            });

        return () => { unsubCitas(); unsubExp(); };
    }

    function streamSalaEspera(ctx, role, shiftTag, callback) {
        console.log(`[MediService] Abriendo Sala de Espera para area: ${role} [Shift: ${shiftTag || 'All'}]`);

        // Base Query
        let ref = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'pendiente')
            .where('tipoServicio', '==', role);

        return ref.onSnapshot(snap => {
            let docs = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            // CLIENT-SIDE FILTER FOR SHIFT (If applicable)
            // Logic: 
            // - If Medical General: No shift filter needed usually (unless they want it).
            // - If Psicologo: 
            //    - If appointment has 'targetShift', match it.
            //    - If not, maybe show to both? Or just use time of day? 
            //    - Current Plan: We filter by TIME of the slot to auto-assign to morning/evening queue visually if not explicitly tagged?
            //    - BETTER: We show ALL pending to both, but when TAKING it, we tag it.
            //    - OR: User asked to "Filter data". 
            //    Let's filter by time for Sala de Espera if it's Psicologo.

            if (role === 'Psicologo' && shiftTag) {
                // [MOD] Filtrado por Turno (Matutino vs Vespertino)
                // Solicitud explícita: Matutino ve hasta las 2 PM (14:59), Vespertino ve desde las 3 PM (15:00).

                docs = docs.filter(d => {
                    // 1. Si la cita ya tiene turno asignado, lo respetamos (prioridad)
                    if (d.shift) return d.shift === shiftTag;

                    // 2. Fallback (Citas viejas o sin turno): Filtrar por hora
                    // Matutino: < 15:00
                    // Vespertino: >= 15:00
                    const h = d.safeDate ? d.safeDate.getHours() : 0;
                    if (shiftTag === 'Matutino') return h < 15;
                    return h >= 15;
                });
            }

            // Ordenamos en el cliente (Descendente por fecha)
            docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

            callback(docs);
        }, err => {
            console.error("❌ Error en Acceso a Citas:", err);
            if (err.code === 'permission-denied') {
                showToast("Error de permisos: No puedes leer las citas de esta área.", "danger");
            }
        });
    }

    // [REMOVED] Old streamAgenda (4 params, no profileId) — replaced by refactored version below

    // [REMOVED] Old tomarPaciente (5 params, no profileData) — replaced by refactored version below

    // NUEVO: Rechazar cita (Eliminación lógica con motivo)
    async function rechazarCita(ctx, citaId, motivo) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data();

        // Liberar slot
        if (data.slotId) await ctx.db.collection(SLOTS_COLL).doc(data.slotId).delete().catch(() => { });

        // 🔔 NOTIFICAR AL ESTUDIANTE
        if (window.Notify) {
            Notify.send(data.studentId, {
                title: 'Cita Rechazada',
                message: `Tu solicitud de cita ha sido rechazada. Motivo: ${motivo}`,
                type: 'medi'
            });
        }

        return ref.update({
            estado: 'rechazada',
            motivoRechazo: motivo,
            fechaAccion: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // MODIFICADO: Cancelar (Devolver a sala) con bandera de re-entrada
    async function cancelarCitaAdmin(ctx, citaId, motivo, returnToQueue = false) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get(); // Necesitamos el studentId

        const updateData = returnToQueue
            ? {
                estado: 'pendiente',
                profesionalId: null,
                profesionalEmail: null,
                reentrada: true, // Bandera para la UI
                ultimoMotivo: motivo,
                shift: returnToQueue // Si se pasa shift como 4to arg (hacky pero efectivo si cambiamos firma) o usamos un objeto opciones
            }
            : { estado: 'cancelada', motivoCancelacion: motivo };

        // FIX: returnToQueue ahora puede ser booleano O un string de turno.
        // Ajustamos la lógica para soportar ambos casos.
        if (typeof returnToQueue === 'string') {
            updateData.shift = returnToQueue;
            updateData.estado = 'pendiente';
            updateData.profesionalId = null;
            updateData.profesionalEmail = null;
            updateData.reentrada = true;
            updateData.ultimoMotivo = motivo;
            // Removemos 'shift' del chequeo ternario anterior para evitar errores
        } else if (returnToQueue === true) {
            // Keep calculated updateData
            delete updateData.shift; // No shift update if just true
        }

        // [FIX] Liberar Slot si se cancela (no si se devuelve a fila)
        if (!returnToQueue) {
            if (snap.exists && snap.data().slotId) {
                const slotId = snap.data().slotId;
                // Usamos SLOTS_COLL del closure (definido arriba como 'medi-slots')
                // Como estamos dentro del modulo, tenemos acceso a SLOTS_COLL??
                // Si, SLOTS_COLL esta en linea 8.
                await ctx.db.collection(SLOTS_COLL).doc(slotId).delete().catch(err => console.warn("Error liberando slot:", err));
            }
        }

        // 🔔 NOTIFICAR AL ESTUDIANTE

        // 🔔 NOTIFICAR AL ESTUDIANTE
        if (snap.exists) {
            const data = snap.data();
            const msg = returnToQueue
                ? `Tu cita ha sido devuelta a la fila de espera. Motivo: ${motivo}`
                : `Tu cita ha sido cancelada. Motivo: ${motivo}`;

            if (window.Notify) {
                Notify.send(data.studentId, {
                    title: returnToQueue ? 'Cita Re-programada' : 'Cita Cancelada',
                    message: msg,
                    type: 'medi'
                });
            }
        }

        return ref.update(updateData);
    }

    // [FIX] Clean pass-through to refactored version — now forwards profileId (6th arg)
    async function getExpedienteHistory(ctx, studentId, role, profesionalId, shiftTag, profileId) {
        return getExpedienteHistoryRefactored(ctx, studentId, role, profesionalId, shiftTag, profileId);
    }

    // [REMOVED] Old getExpedienteHistoryRefactored (5 params, no profileId) + Legacy stub — replaced by refactored version below

    // [REMOVED] Old saveConsulta — replaced by profile-aware version below

    async function buscarPaciente(ctx, term) {
        const t = term.trim();
        // 1. Try by Matricula (Exact match)
        let snap = await ctx.db.collection('usuarios').where('matricula', '==', t).get();
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

        // 2. Try by Email (Exact match, lowercase)
        snap = await ctx.db.collection('usuarios').where('email', '==', t.toLowerCase()).get();
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

        // 3. Try by Name (Prefix search - Case Sensitive)
        // Note: Firestore is case-sensitive. This assumes Title Case or exact match.
        try {
            snap = await ctx.db.collection('usuarios')
                .where('displayName', '>=', t)
                .where('displayName', '<=', t + '\uf8ff')
                .limit(5)
                .get();
            if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { console.warn("Search error:", e); }

        return null;
    }

    function calculateAge(birthDateString) {
        if (!birthDateString) return null;
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return isNaN(age) ? null : age;
    }



    // --- PROFILE MANAGEMENT (PIN SYSTEM) ---
    async function getProfiles(ctx, uid) {
        try {
            const snap = await ctx.db.collection('usuarios').doc(uid).collection('profiles').get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error fetching profiles:", e);
            return [];
        }
    }

    async function verifyPin(ctx, uid, pin) {
        const profiles = await getProfiles(ctx, uid);
        const match = profiles.find(p => p.pin === pin);
        return match || null;
    }

    // Self-seeding for development/migration
    async function seedInitialProfiles(ctx, uid) {
        const profilesRef = ctx.db.collection('usuarios').doc(uid).collection('profiles');
        const snap = await profilesRef.get();

        if (snap.empty) {
            console.log("Seeding initial profiles for:", uid);
            const batch = ctx.db.batch();

            // Profile 1: Matutino
            const p1Ref = profilesRef.doc();
            batch.set(p1Ref, {
                displayName: "Psic. Edrey Ruiz",
                shortName: "Edrey",
                cedula: "12345678",
                pin: "2024",
                legacyShift: "Matutino",
                role: "psicologo"
            });

            // Profile 2: Vespertino
            const p2Ref = profilesRef.doc();
            batch.set(p2Ref, {
                displayName: "Psic. Carmen Espinoza",
                shortName: "Carmen",
                cedula: "87654321",
                pin: "2025",
                legacyShift: "Vespertino",
                role: "psicologo"
            });

            await batch.commit();
            return true;
        }
        return false;
    }


    // [NEW] Check Slot Conflict Internal
    async function checkSlotConflict(ctx, date) {
        // Check confirmed appointments at this exact time
        const q = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'confirmada')
            .where('fechaHoraSlot', '==', date);
        const snap = await q.get();
        return !snap.empty;
    }

    // [NEW] Get Occupied Slots for a Day (Public)
    async function getOccupiedSlots(ctx, role, isoDate) {
        // Start/End of Day
        // We need to check 'confirmada' appointments for the whole day
        const start = new Date(isoDate + 'T00:00:00');
        const end = new Date(isoDate + 'T23:59:59');

        // Query Citas Confirmadas
        // Note: Ideally we filter by Role (Medico/Psicologo) if they share the same schedule/slots?
        // Or if they have different rooms.
        // Assuming shared slots for simplicity or filter by tipoServicio if needed.
        // For now, let's assume if ANYONE booked it, it's busy (Single Resource Model).
        // OR: Filter by 'tipoServicio' == role.

        // Let's filter by role to allow concurrent Medical/Psych appointments if they are different resources
        let q = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'confirmada')
            .where('fechaHoraSlot', '>=', start)
            .where('fechaHoraSlot', '<=', end);

        if (role) {
            q = q.where('tipoServicio', '==', role);
        }

        const snap = await q.get();
        return snap.docs.map(d => d.data().fechaHoraSlot.toDate().toISOString());
    }

    // --- PUBLIC METHODS (UPDATED) ---



    // --- PUBLIC METHODS (UPDATED) ---

    // Updated to accept profile info
    async function tomarPaciente(ctx, citaId, profesionalId, profesionalEmail, shiftTag, profileData = null) {
        return ctx.db.runTransaction(async (tx) => {
            const ref = ctx.db.collection(C_CITAS).doc(citaId);
            const snap = await tx.get(ref);

            if (!snap.exists) throw new Error("Cita no encontrada");
            const cita = snap.data();

            if (cita.estado !== 'pendiente') {
                throw new Error("Esta cita ya no está disponible.");
            }

            // Validar conflicto horario (DOBLE VERIFICACION)
            // Aunque getOccupiedSlots lo usa el UI, el backend debe protegerse
            const isOccupied = await checkSlotConflict(ctx, cita.fechaHoraSlot);
            if (isOccupied) throw new Error("Este horario ya fue ocupado por otra persona.");

            // Validar conflicto horario
            const conflictQuery = ctx.db.collection(C_CITAS)
                .where('profesionalId', '==', profesionalId) // This is Auth UID
                .where('estado', '==', 'confirmada')
                .where('fechaHoraSlot', '==', cita.fechaHoraSlot);

            const conflictSnap = await conflictQuery.get();

            if (!conflictSnap.empty) {
                // Si es el mismo usuario pero diferente perfil, technically conflict?
                // For now, simple check on UID.
                throw new Error('Ya tienes cita a esa hora.');
            }

            const updateData = {
                estado: 'confirmada',
                profesionalId: profesionalId, // Auth UID
                profesionalEmail: profesionalEmail,
                profesionalShift: shiftTag || null // Legacy Shift or Profile Shift
            };

            // NEW: Add Profile Info if available
            if (profileData) {
                updateData.profesionalProfileId = profileData.id;
                updateData.profesionalName = profileData.displayName;
                updateData.profesionalCedula = profileData.cedula;
            }

            tx.update(ref, updateData);

            // 🔔 NOTIFICAR AL ESTUDIANTE
            if (window.Notify) {
                Notify.send(cita.studentId, {
                    title: 'Cita Confirmada',
                    message: `Tu cita ha sido confirmada con ${profileData ? profileData.displayName : (profesionalEmail || 'un especialista')}.`,
                    type: 'medi',
                    link: '/medi'
                });
            }

            return cita;
        });
    }

    async function reservarCitaAdmin(ctx, { student, date, slotId, tipo, motivo, shift, profileData }) {
        return ctx.db.runTransaction(async tx => {
            const slotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
            const slotSnap = await tx.get(slotRef);
            if (slotSnap.exists) throw new Error("El horario seleccionado ya no está disponible.");

            tx.set(slotRef, { holder: student.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

            const newCitaRef = ctx.db.collection(C_CITAS).doc();

            const docData = {
                studentId: student.uid,
                studentEmail: student.email,
                studentName: student.displayName || student.email,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
                slotId: slotId,
                tipoServicio: tipo,
                motivo: motivo,
                estado: 'confirmada',
                profesionalId: ctx.auth.currentUser.uid,
                profesionalShift: shift,
                shift: shift
            };

            if (profileData) {
                docData.profesionalProfileId = profileData.id;
                docData.profesionalName = profileData.displayName;
            }

            tx.set(newCitaRef, docData);
        });
    }

    // Refactor streamAgenda to support Profile ID filtering
    function streamAgenda(ctx, profesionalId, shiftTag, profileId, callback) {
        let ref = ctx.db.collection(C_CITAS)
            .where('profesionalId', '==', profesionalId)
            .where('estado', '==', 'confirmada');

        return ref.onSnapshot(snap => {
            let docs = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            // Filter logic
            if (profileId) {
                // If we have a profile ID, show appointments for this profile OR legacy appointments for this shift
                docs = docs.filter(d => {
                    if (d.profesionalProfileId) return d.profesionalProfileId === profileId;
                    if (shiftTag && d.profesionalShift) return d.profesionalShift === shiftTag;
                    return false;
                });
            } else if (shiftTag) {
                // Legacy strict shift filter
                docs = docs.filter(d => d.profesionalShift === shiftTag);
            }

            docs.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));
            callback(docs);
        }, err => console.error("❌ Error en Stream Agenda:", err));
    }

    // Refactor getExpedienteHistory to support Profile ID
    async function getExpedienteHistoryRefactored(ctx, studentId, role, profesionalId, shiftTag, profileId) {
        let docs = [];

        // 1. LEGACY: Colección Plana 'expedientes-clinicos'
        if (role === 'Medico') {
            const legacyMedSnap = await ctx.db.collection(C_EXP)
                .where('studentId', '==', studentId)
                .where('tipoServicio', '==', 'Medico')
                .get();
            legacyMedSnap.forEach(d => docs.push({ id: d.id, ...d.data(), safeDate: safeDate(d.data().createdAt), source: 'legacy' }));
        }

        if (role === 'Psicologo') {
            const legacyPsychSnap = await ctx.db.collection(C_EXP)
                .where('studentId', '==', studentId)
                .where('tipoServicio', '==', 'Psicologico')
                .where('autorId', '==', profesionalId)
                .get();

            legacyPsychSnap.forEach(d => {
                const val = d.data();
                // Filter: If profileId matches OR if legacy shift matches
                let include = false;
                if (profileId && val.profesionalProfileId === profileId) include = true;
                else if (shiftTag && val.shift === shiftTag) include = true;
                // If it's a legacy doc without profileId but we are viewing from a profile, relying on shift is the Way.

                if (include) {
                    docs.push({ id: d.id, ...val, safeDate: safeDate(val.createdAt), source: 'legacy' });
                }
            });
        }

        // 2. NUEVA ESTRUCTURA
        try {
            const consultasRef = ctx.db.collection(C_EXP).doc(studentId).collection('consultas');
            let newQuery = consultasRef;

            if (role === 'Medico') {
                newQuery = newQuery.where('tipoServicio', '==', 'Medico');
            } else if (role === 'Psicologo') {
                // Remove strict autorId filter to allow seeing history from same department (maybe?)
                // Or keep it strict. If strict, profiles are under same UID, so it works.
                newQuery = newQuery.where('tipoServicio', '==', 'Psicologico')
                    .where('autorId', '==', profesionalId);
            }

            const newSnap = await newQuery.get();

            newSnap.forEach(d => {
                const val = d.data();
                let include = false;

                if (role === 'Psicologo') {
                    // Logic: Show if matches Current Profile ID or if Legacy Shift matches
                    const matchesProfile = profileId && val.profesionalProfileId === profileId;
                    const matchesShift = shiftTag && val.shift === shiftTag;

                    const hasProfile = !!val.profesionalProfileId;

                    // STRICT LOGIC:
                    // 1. If the doc has a Profile ID, it MUST match the current profile (Ownership).
                    // 2. If the doc has NO Profile ID (Legacy), it MUST match the shift (Department Continuity).

                    if (hasProfile) {
                        if (matchesProfile) include = true;
                    } else {
                        if (matchesShift) include = true;
                    }

                } else {
                    include = true;
                }

                if (include) {
                    // [FIX] Filter out non-finalized consultations from History View/Sidebar
                    if (val.estado !== 'finalizada') {
                        include = false;
                    }
                }

                if (include) {
                    docs.push({ id: d.id, ...val, safeDate: safeDate(val.createdAt), source: 'new' });
                }
            });

        } catch (e) {
            console.warn("Error leyendo nueva estructura:", e);
        }

        docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));
        return docs;
    }

    // Updated saveConsulta to include profile info
    async function saveConsulta(ctx, payload, citaId) {
        return ctx.db.runTransaction(async (tx) => {
            const masterRef = ctx.db.collection(C_EXP).doc(payload.studentId);
            const consultaRef = masterRef.collection('consultas').doc();

            const masterData = {
                studentId: payload.studentId,
                studentEmail: payload.studentEmail,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(masterRef, masterData, { merge: true });
            tx.set(consultaRef, payload);

            if (citaId && citaId !== 'null' && !citaId.startsWith('walkin_')) {
                // [FIX] Only finalize the appointment slot if the consultation is truly finalized.
                // If paused, we might want to keep it 'confirmada' or update to 'en_proceso' (if column existed),
                // but definitely NOT 'finalizada'.
                if (payload.estado === 'finalizada') {
                    const citaRef = ctx.db.collection(C_CITAS).doc(citaId);
                    // Check if doc exists before update to prevent "No document to update" error
                    const cSnap = await tx.get(citaRef);
                    if (cSnap.exists) {
                        tx.update(citaRef, { estado: 'finalizada' });
                    }
                }
            }
        });
    }

    // [NEW] DASHBOARD HELPER (STREAM)
    function streamRecentConsultations(ctx, role, uid, profileId, limit = 5, callback) {
        try {
            console.log(`[MediService] Stream Recent Request -> Role: ${role}, UID: ${uid}, Profile: ${profileId}`);
            let q = ctx.db.collectionGroup('consultas');

            // Filter logic
            if (role === 'Psicologo' && profileId) {
                // Strict Profile Filtering
                q = q.where('profesionalProfileId', '==', profileId);
            } else {
                // Legacy / General User Filtering (Medico)
                // STRICT: Must match autorId to the current user
                const effectiveUid = uid || (ctx.auth.currentUser ? ctx.auth.currentUser.uid : null);

                if (!effectiveUid) {
                    console.error("[MediService] UID missing/null for streamRecentConsultations - Aborting query.");
                    callback([]);
                    return () => { };
                }

                console.log(`[MediService] Filtering by autorId: ${effectiveUid}`);
                q = q.where('autorId', '==', effectiveUid);
            }

            // Order & Limit
            // [FIX] Filter by finalized only to hide paused/drafts from "Recent" list
            q = q.where('estado', '==', 'finalizada');
            q = q.orderBy('createdAt', 'desc').limit(limit);

            const unsubscribe = q.onSnapshot(async (snap) => {
                console.log(`[MediService] Stream Recent Update: ${snap.size} docs found.`);
                const docs = [];
                // Process docs sequentially to fetch names if needed
                for (const d of snap.docs) {
                    const val = d.data();
                    let patientName = val.studentName || val.pacienteNombre;

                    // If name is missing, try to fetch from 'usuarios' (Optimized: In a real app we'd cache this)
                    if (!patientName && val.studentId) {
                        try {
                            const uSnap = await ctx.db.collection('usuarios').doc(val.studentId).get();
                            if (uSnap.exists) {
                                patientName = uSnap.data().displayName || uSnap.data().nombre;
                            }
                        } catch (err) { console.warn("Error fetching user name:", err); }
                    }

                    docs.push({
                        id: d.id,
                        ...val,
                        patientName: patientName || val.studentEmail || "Estudiante", // Fallback
                        safeDate: safeDate(val.createdAt)
                    });
                }
                callback(docs);
            }, (error) => {
                console.error("Error streaming recent consultations:", error);
                callback([]);
            });

            return unsubscribe; // Return unsub function

        } catch (e) {
            console.error("Error setting up stream:", e);
            callback([]);
            return () => { };
        }
    }

    // --- C1: Day Stats for Dashboard ---
    async function getDayStats(ctx, role, uid, profileId) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 1. Consultations completed today
        let q = ctx.db.collectionGroup('consultas')
            .where('createdAt', '>=', startOfDay)
            .where('estado', '==', 'finalizada');

        if (role === 'Psicologo' && profileId) {
            q = q.where('profesionalProfileId', '==', profileId);
        } else {
            q = q.where('autorId', '==', uid);
        }

        const snap = await q.get();
        const consultas = snap.docs.map(d => d.data());

        const totalAtendidos = consultas.length;

        // 2. Average consultation duration
        const duraciones = consultas.filter(c => c.duracionMinutos > 0).map(c => c.duracionMinutos);
        const avgDuracion = duraciones.length > 0 ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0;

        // 3. Diagnoses frequency (top 5)
        const diagMap = {};
        consultas.forEach(c => {
            if (c.diagnostico) {
                const key = c.diagnostico.trim().toLowerCase();
                diagMap[key] = (diagMap[key] || 0) + 1;
            }
        });
        const topDiagnosticos = Object.entries(diagMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([diag, count]) => ({ diagnostico: diag, count }));

        // 4. Pending appointments today (waiting room)
        let pendQ = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'pendiente')
            .where('fechaSolicitud', '>=', startOfDay);

        if (role === 'Psicologo' && profileId) {
            // Psicologos filter by their service type
        } else {
            pendQ = pendQ.where('tipoServicio', '==', role);
        }

        let enEspera = 0;
        try {
            const pendSnap = await pendQ.get();
            enEspera = pendSnap.size;
        } catch (e) { /* index may not exist */ }

        // 5. Average wait time (from fechaSolicitud to fechaConfirmacion for today's finalized citas)
        let citasQ = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'finalizada')
            .where('fechaSolicitud', '>=', startOfDay);

        let avgEspera = 0;
        try {
            const citasSnap = await citasQ.get();
            const waits = [];
            citasSnap.docs.forEach(d => {
                const data = d.data();
                const sol = safeDate(data.fechaSolicitud);
                const conf = safeDate(data.fechaConfirmacion);
                if (sol && conf) {
                    const diffMin = Math.round((conf.getTime() - sol.getTime()) / 60000);
                    if (diffMin > 0 && diffMin < 480) waits.push(diffMin);
                }
            });
            if (waits.length > 0) avgEspera = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
        } catch (e) { /* ignore */ }

        return { totalAtendidos, avgDuracion, avgEspera, enEspera, topDiagnosticos };
    }

    // --- C7: Follow-ups ---
    async function getFollowUps(ctx, role, uid, profileId) {
        let q = ctx.db.collectionGroup('consultas')
            .where('followUp.required', '==', true)
            .where('estado', '==', 'finalizada');

        if (role === 'Psicologo' && profileId) {
            q = q.where('profesionalProfileId', '==', profileId);
        } else {
            q = q.where('autorId', '==', uid);
        }

        const snap = await q.orderBy('createdAt', 'desc').limit(20).get();
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                studentId: data.studentId,
                studentEmail: data.studentEmail,
                diagnostico: data.diagnostico,
                followUpDate: data.followUp?.date || null,
                followUpNotes: data.followUp?.notes || '',
                createdAt: safeDate(data.createdAt)
            };
        });
    }

    async function getStudentFollowUps(ctx, studentId) {
        // Query consultas subcollection for this student
        // Note: 'consultas' are in expedientes-clinicos/{studentId}/consultas
        const ref = ctx.db.collection(C_EXP).doc(studentId).collection('consultas');
        const q = ref.where('followUp.required', '==', true)
            .where('estado', '==', 'finalizada')
            .orderBy('createdAt', 'desc')
            .limit(1);

        const snap = await q.get();
        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            followUpDate: d.data().followUp?.date,
            followUpNotes: d.data().followUp?.notes
        }));
    }

    // --- Shift Profiles (Missing Definitions) ---
    async function getShiftProfile(ctx, type, shift) {
        const docId = `${type}_${shift}`;
        console.log(`[MediService] Requesting Shift Profile: ${docId}`);
        try {
            const snap = await ctx.db.collection('medi-shift-profiles').doc(docId).get();
            if (snap.exists) {
                return snap.data();
            } else {
                console.warn(`[MediService] Shift Profile NOT found for ${docId}. Attempting auto-recovery...`);

                // Fallback: Find ANY user with this role
                const usersRef = ctx.db.collection('usuarios');
                const q = usersRef.where('role', '==', type.toLowerCase()).limit(1);
                const uSnap = await q.get();

                let newProfile = {
                    id: 'fallback_' + Date.now(),
                    displayName: `Profesional ${shift}`,
                    cedula: "PENDIENTE",
                    legacyShift: shift,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (!uSnap.empty) {
                    const uData = uSnap.docs[0].data();
                    newProfile = {
                        id: uSnap.docs[0].id,
                        displayName: uData.displayName || uData.email || "Profesional Asignado",
                        cedula: uData.cedula || "",
                        legacyShift: shift,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                } else {
                    console.error(`[MediService] CRITICAL: No users found with role ${type}. Using generic fallback.`);
                }

                await updateShiftProfile(ctx, type, shift, newProfile);
                console.log(`[MediService] Auto-created Shift Profile for ${docId}`, newProfile);
                return newProfile;
            }
        } catch (e) { console.error("Error getting shift profile:", e); }
        return null;
    }

    async function updateShiftProfile(ctx, type, shift, profileData) {
        const docId = `${type}_${shift}`;
        const ref = ctx.db.collection('medi-shift-profiles').doc(docId);
        await ref.set(profileData, { merge: true });
        return profileData;
    }



    return {
        loadConfig,
        updateConfig,
        getConfig,
        safeDate,
        checkActiveAppointment,
        checkActiveAppointment,
        getOccupiedSlots,
        reservarCita,
        reservarCitaAdmin,
        modificarCita,
        cancelarCitaEstudiante,
        streamStudentHistory,
        streamSalaEspera,
        streamAgenda,
        tomarPaciente,
        cancelarCitaAdmin,
        streamRecentActivity: streamRecentConsultations, // [FIX] Aliased to existing function

        saveConsulta,

        getProfiles,
        getExpedienteHistory,
        verifyPin,
        seedInitialProfiles,
        rechazarCita,
        streamRecentConsultations,
        buscarPaciente,
        getDayStats, getFollowUps, getStudentFollowUps,

        // Shift Profile Management (Newly Added)
        getShiftProfile,
        updateShiftProfile,
        resolveProfessionalForBooking,

        // Utils
        pad, toISO, slotIdFromDate, calculateAge
    };


})();
