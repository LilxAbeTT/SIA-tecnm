// services/lactario-service.js
// Servicio de Datos para Módulo Lactario
// Gestión de reservas, cubículos y validación de acceso.

const LactarioService = (function () {
    const C_RESERVAS = 'lactario-bookings';
    const C_ESPACIOS = 'lactario-spaces'; // Colección de cubiculos
    const CONFIG_DOC = 'lactario-config/main';
    const MEDI_TYPE = 'Médico';

    // Default config
    let config = {
        openHour: 8,
        closeHour: 20,
        slotDuration: 60, // 60 mins total (usage + cleaning)
        usageTime: 30, // 30 mins usage allowed
        tolerance: 20, // 20 mins tolerance for check-in
        enabled: true
    };

    let spaces = []; // Cache of available spaces (cubicles)

    // --- HELPERS ---
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Genera ID de slot: YYYY-MM-DD_HH:MM
    const getSlotId = (date) => `${toISO(date)}_${pad(date.getHours())}:${pad(date.getMinutes())}`;

    function parseLegacyLactationMonths(rawValue) {
        if (rawValue === null || rawValue === undefined || rawValue === '') return null;
        const match = String(rawValue).trim().match(/\d+/);
        if (!match) return null;

        const months = Number(match[0]);
        return Number.isFinite(months) ? months : null;
    }

    function resolveDateLike(value) {
        if (!value) return null;
        const parsed = value.toDate ? value.toDate() : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function normalizeFlag(value) {
        return String(value || '').trim().toLowerCase().replace('í', 'i');
    }

    function buildBookingDate(dateStr, timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const bookingDate = new Date(`${dateStr}T00:00:00`);
        bookingDate.setHours(h, m, 0, 0);

        if (isNaN(bookingDate.getTime())) {
            throw new Error("Fecha inválida.");
        }

        return bookingDate;
    }

    function getDateRange(dateStr) {
        return {
            start: new Date(`${dateStr}T00:00:00`),
            end: new Date(`${dateStr}T23:59:59.999`)
        };
    }

    function normalizeBookingDoc(doc) {
        const data = doc.data ? doc.data() : doc;
        return {
            id: doc.id || data.id,
            ...data,
            date: resolveDateLike(data.dateQuery) || resolveDateLike(data.date)
        };
    }

    async function createMedicalSupportAppointment(ctx, { user, bookingId, bookingDate, lactarioType }) {
        if (!window.MediService || typeof MediService.reservarCita !== 'function') {
            throw new Error('El servicio médico no está disponible en este momento.');
        }

        const activeAppointment = await MediService.checkActiveAppointment(ctx, user.uid);
        if (activeAppointment) {
            throw new Error('Ya tienes una cita médica activa. Cancélala o reprográmala antes de solicitar asistencia desde lactario.');
        }

        let professional = await MediService.resolveProfessionalForBooking(ctx, MEDI_TYPE, bookingDate);
        if (!professional) {
            professional = {
                id: null,
                displayName: 'Atención Médica',
                profileId: null
            };
        }

        const bookingResult = await MediService.reservarCita(ctx, {
            user,
            date: bookingDate,
            slotId: `${getSlotId(bookingDate)}_${MEDI_TYPE}`,
            tipo: MEDI_TYPE,
            motivo: `[Lactario] Asistencia médica vinculada a sesión de ${lactarioType || 'Lactancia'}`,
            profesionalId: professional.id,
            profesionalName: professional.displayName,
            profesionalProfileId: professional.profileId,
            extraData: {
                linkedLactarioId: bookingId,
                sourceModule: 'lactario',
                lactarioBookingType: lactarioType || 'Lactancia',
                lactarioSupport: true
            }
        });

        const citaSnap = await ctx.db.collection('citas-medi').doc(bookingResult.citaId).get();
        const citaData = citaSnap.exists ? citaSnap.data() : {};

        return {
            citaId: bookingResult.citaId,
            status: citaData.estado || (bookingResult.isQueued ? 'pendiente' : 'confirmada'),
            queuePosition: bookingResult.queuePosition || 0,
            professionalName: citaData.profesionalName || professional.displayName || 'Atención Médica'
        };
    }

    async function cancelLinkedMedicalAppointment(ctx, citaId, reason) {
        if (!citaId) return;

        if (!window.MediService || typeof MediService.cancelarCitaEstudiante !== 'function') {
            throw new Error('No fue posible sincronizar la cancelación con Servicio Médico.');
        }

        await MediService.cancelarCitaEstudiante(ctx, citaId, reason || 'Cancelada desde lactario');
    }

    // --- CORE ---

    async function loadConfig(ctx) {
        try {
            const snap = await ctx.db.doc(CONFIG_DOC).get();
            if (snap.exists) {
                config = { ...config, ...snap.data() };
            }
            // Load Spaces (Get ALL to show in admin list, inactive or not)
            const spaceSnap = await ctx.db.collection(C_ESPACIOS).get();
            if (!spaceSnap.empty) {
                spaces = spaceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else {
                // Initialize default space in DB if none exists
                const defaultSpace = { id: 'cubiculo-1', name: 'Cubículo 1', active: true };
                await ctx.db.collection(C_ESPACIOS).doc(defaultSpace.id).set(defaultSpace);
                spaces = [defaultSpace];
            }
        } catch (e) {
            console.warn('[LactarioService] Warn loading config:', e);
            // Emergency fallback memory-only
            if (spaces.length === 0) spaces = [{ id: 'cubiculo-1', name: 'Cubículo 1', active: true }];
        }
        return config;
    }

    async function getSpaces(ctx) {
        await loadConfig(ctx); // Always refresh
        return spaces;
    }

    // --- LAZY CLEANUP (Auto-Cancel/No-Show) ---
    async function checkExpiredBookings(ctx, uid = null) {
        try {
            const now = new Date();
            // Look for confirmed bookings that might have expired.
            // Optimized query: confirmed bookings with dateQuery < now
            const q = await ctx.db.collection(C_RESERVAS)
                .where('status', '==', 'confirmed')
                .where('dateQuery', '<=', now)
                .get();

            if (q.empty) return;

            const batch = ctx.db.batch();
            let updates = 0;
            const tolerance = config.tolerance || 20;
            const linkedAppointmentsToCancel = [];

            q.docs.forEach(doc => {
                const data = doc.data();
                if (!data.dateQuery) return;
                if (uid && data.userId !== uid) return;

                const bookTime = data.dateQuery.toDate();
                // Expire if: Now > (BookTime + Tolerance)
                const expireTime = new Date(bookTime.getTime() + (tolerance * 60000));

                if (now > expireTime) {
                    batch.update(doc.ref, {
                        status: 'no-show',
                        autoCancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                        medicalSupportStatus: data.linkedMediCitaId ? 'cancelled' : (data.medicalSupportStatus || null)
                    });
                    if (uid && data.linkedMediCitaId) {
                        linkedAppointmentsToCancel.push(data.linkedMediCitaId);
                    }
                    updates++;
                }
            });

            if (updates > 0) {
                await batch.commit();
                for (const citaId of linkedAppointmentsToCancel) {
                    await cancelLinkedMedicalAppointment(ctx, citaId, 'No-show en reserva de lactario');
                }
                console.log(`[Lactario] Marked ${updates} bookings as no-show.`);
            }
        } catch (e) {
            console.warn("[Lactario] Cleanup error:", e);
        }
    }

    // --- CHECK ACCESS ---
    // Regla: Solo mujeres lactantes con periodo de hasta 7 meses
    async function checkAccess(userProfile) {
        if (!userProfile) return { allowed: false, reason: 'No profile' };

        const role = String(userProfile.role || '').toLowerCase();
        const lactarioPermission = String(userProfile.permissions?.lactario || '').toLowerCase();
        const email = String(userProfile.email || '').trim().toLowerCase();

        // Admin access override
        if (
            role === 'superadmin' ||
            lactarioPermission === 'admin' ||
            lactarioPermission === 'superadmin' ||
            email === 'calidad@loscabos.tecnm.mx'
        ) {
            return { allowed: true, isAdmin: true };
        }

        const gender = String(userProfile.personalData?.genero || userProfile.genero || '').trim().toLowerCase();
        const isFemale = ['femenino', 'mujer'].includes(gender);
        const isLactating = normalizeFlag(userProfile.healthData?.lactancia || userProfile.lactancia) === 'si';
        const rawTime = userProfile.healthData?.lactanciaTiempo || userProfile.lactanciaTiempo || '';

        if (!isFemale) return { allowed: false, reason: 'Módulo exclusivo para mujeres.' };
        if (!isLactating) return { allowed: false, reason: 'No estás registrada en periodo de lactancia.' };

        // Nueva lógica: Validar fecha de inicio
        const fechaInicio = userProfile.healthData?.lactanciaInicio || userProfile.lactanciaInicio; // Timestamp or Date

        if (fechaInicio) {
            const startDate = resolveDateLike(fechaInicio);
            const now = new Date();

            if (!startDate) {
                return { allowed: false, reason: 'La fecha de inicio de lactancia en tu perfil es inválida. Actualízala para continuar.' };
            }

            if (startDate > now) {
                return { allowed: false, reason: 'La fecha de inicio de lactancia no puede ser futura. Actualiza tu perfil para continuar.' };
            }

            // Calculate months difference
            let months = (now.getFullYear() - startDate.getFullYear()) * 12;
            months -= startDate.getMonth();
            months += now.getMonth();

            if (now.getDate() < startDate.getDate()) {
                months -= 1;
            }
            months = Math.max(0, months);

            if (months > 7) {
                return {
                    allowed: false,
                    reason: `Tu periodo de lactancia (${months} meses) excede el límite de 7 meses para este servicio.`
                };
            }
        }
        else {
            const legacyMonths = parseLegacyLactationMonths(rawTime);

            if (legacyMonths === null) {
                return { allowed: false, reason: 'Por favor actualiza tu perfil para indicar fecha de inicio de lactancia.' };
            }

            if (legacyMonths > 7) {
                return {
                    allowed: false,
                    reason: `Tu periodo de lactancia (${legacyMonths} meses) excede el límite de 7 meses para este servicio.`
                };
            }
        }

        return { allowed: true, isAdmin: false };
    }

    // --- RESERVAS ---

    // Obtener disponibilidad para un día
    async function getAvailability(ctx, dateStr) {
        // 1. Get all bookings for that day
        const startOfDay = new Date(`${dateStr}T00:00:00`);
        const endOfDay = new Date(`${dateStr}T23:59:59`);
        const now = new Date();

        const q = await ctx.db.collection(C_RESERVAS)
            .where('dateQuery', '>=', startOfDay)
            .where('dateQuery', '<=', endOfDay)
            .where('status', 'in', ['confirmed', 'checked-in'])
            .get();

        const bookings = q.docs.map(d => d.data());

        // 2. Build slots based on open hours
        const slots = [];
        for (let h = config.openHour; h <= config.closeHour; h++) {
            const timeLabel = `${pad(h)}:00`;
            const slotId = `${dateStr}_${timeLabel}`;

            // Check if slot is in the past (only for today)
            // Check if slot is in the past (only for today)
            // Parse explicitly as local time
            const [hSlot] = timeLabel.split(':').map(Number);
            const slotDate = new Date(`${dateStr}T${pad(hSlot)}:00:00`);

            // Add a small buffer (e.g. 5 mins) or strict check?
            if (slotDate < now) {
                // Skip adding this slot if it's already passed
                continue;
            }

            // Count bookings for this slot
            const taken = bookings.filter(b => b.slotId === slotId).length;

            // Fix: Filter only active spaces
            const activeSpaces = spaces.filter(s => s.active !== false);
            const totalSpaces = activeSpaces.length;

            const suffix = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            const formatted = `${h12}:00 ${suffix}`;

            slots.push({
                formattedTime: formatted,
                time: timeLabel,
                slotId: slotId,
                total: totalSpaces,
                taken: taken,
                available: totalSpaces - taken,
                isFull: taken >= totalSpaces
            });
        }
        return slots;
    }

    async function createReservation(ctx, { user, date, timeStr, type, fridge, medicalSupport }) {
        await loadConfig(ctx);
        const bookingDate = buildBookingDate(date, timeStr);
        const now = new Date();

        if (bookingDate < now) {
            throw new Error('Este horario ya no está disponible. Selecciona otro.');
        }

        if (medicalSupport) {
            if (!window.MediService || typeof MediService.checkActiveAppointment !== 'function' || typeof MediService.reservarCita !== 'function') {
                throw new Error('El servicio médico no está disponible en este momento.');
            }

            const activeAppointment = await MediService.checkActiveAppointment(ctx, user.uid);
            if (activeAppointment) {
                throw new Error('Ya tienes una cita médica activa. Cancélala o reprográmala antes de solicitar asistencia desde lactario.');
            }
        }

        const reservationResult = await ctx.db.runTransaction(async tx => {
            // Fix: 'date' is already a YYYY-MM-DD string, so we don't need toISO() which expects a Date object
            const slotId = `${date}_${timeStr}`;
            const activeWindowStart = new Date();
            activeWindowStart.setHours(0, 0, 0, 0);

            // 1. Check user existing active reservation (prevent double booking same time or pending status)
            // Simpler check: Allow only 1 active reservation per user? Let's say yes for now to avoid abuse.
            const userActiveQ = await tx.get(ctx.db.collection(C_RESERVAS)
                .where('userId', '==', user.uid)
                .where('status', 'in', ['confirmed', 'checked-in'])
                .where('dateQuery', '>=', activeWindowStart));

            if (!userActiveQ.empty) {
                // Check if it's the same day? For now blocking multiple future reservations.
                throw new Error("Ya tienes una reserva activa pendiente. Debes completar tu visita actual antes de reservar otra.");
            }

            // 2. Check Space Availability (Active Only)
            const activeSpaces = spaces.filter(s => s.active !== false);
            const totalSpaces = activeSpaces.length;

            if (totalSpaces <= 0) {
                throw new Error("No hay espacios activos disponibles en este momento.");
            }

            // We need to count existing bookings for this specific slotId inside transaction
            const slotQ = await tx.get(ctx.db.collection(C_RESERVAS)
                .where('slotId', '==', slotId)
                .where('status', 'in', ['confirmed', 'checked-in'])
            );

            const takenCount = slotQ.size; // This matches ANY space (active or not)

            // If taken >= active, we are full (or overbooked if we reduced spaces)
            if (takenCount >= totalSpaces) {
                throw new Error("Lo sentimos, este horario ya está lleno.");
            }

            // 3. Assign Space
            // Find which space ID is NOT taken AND is Active
            const takenSpaceIds = slotQ.docs.map(d => d.data().spaceId);
            const availableSpace = activeSpaces.find(s => !takenSpaceIds.includes(s.id));

            if (!availableSpace) {
                throw new Error("Error interno: No se pudo asignar espacio.");
            }

            // Verify firebase global availability
            if (!firebase || !firebase.firestore || !firebase.firestore.Timestamp) {
                console.error("Firebase SDK not ready for Timestamp conversion");
                throw new Error("Error de sistema: Firebase SDK incompleto.");
            }

            const docRef = ctx.db.collection(C_RESERVAS).doc();
            tx.set(docRef, {
                id: docRef.id,
                userId: user.uid,
                userName: user.displayName || 'Usuario',
                userEmail: user.email || '',
                date: date,
                time: timeStr,
                type: type, // 'Lactancia' or 'Extracción'
                slotId: slotId,
                spaceId: availableSpace.id,
                spaceName: availableSpace.name, // SAVE NAME
                dateQuery: firebase.firestore.Timestamp.fromDate(bookingDate),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'confirmed',
                checkIn: null,
                checkOut: null,
                medicalSupportRequested: !!medicalSupport,
                medicalSupportStatus: medicalSupport ? 'creating' : null,
                linkedMediCitaId: null
            });

            return {
                success: true,
                id: docRef.id,
                spaceName: availableSpace.name,
                time: timeStr
            };
        });

        if (!medicalSupport) {
            return reservationResult;
        }

        try {
            const medicalResult = await createMedicalSupportAppointment(ctx, {
                user,
                bookingId: reservationResult.id,
                bookingDate,
                lactarioType: type
            });

            await ctx.db.collection(C_RESERVAS).doc(reservationResult.id).update({
                linkedMediCitaId: medicalResult.citaId,
                medicalSupportRequested: true,
                medicalSupportStatus: medicalResult.status,
                medicalSupportQueuePosition: medicalResult.queuePosition || 0,
                medicalSupportProfessionalName: medicalResult.professionalName || null,
                medicalSupportLinkedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return {
                ...reservationResult,
                medicalSupportStatus: medicalResult.status,
                medicalSupportQueuePosition: medicalResult.queuePosition || 0,
                medicalSupportProfessionalName: medicalResult.professionalName || null
            };
        } catch (error) {
            await ctx.db.collection(C_RESERVAS).doc(reservationResult.id).update({
                status: 'cancelled',
                cancelReason: 'No se pudo generar la asistencia médica vinculada',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                medicalSupportRequested: true,
                medicalSupportStatus: 'error',
                medicalSupportError: error.message || 'Error desconocido'
            });
            throw error;
        }
    }

    async function getUserActiveReservation(ctx, uid) {
        // ... (existing logic)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = await ctx.db.collection(C_RESERVAS)
            .where('userId', '==', uid)
            .where('dateQuery', '>=', today)
            .where('status', 'in', ['confirmed', 'checked-in'])
            .orderBy('dateQuery', 'asc')
            .limit(1)
            .get();

        if (q.empty) return null;

        const data = q.docs[0].data();

        // Backfill spaceName if missing (legacy)
        if (!data.spaceName && data.spaceId) {
            const s = spaces.find(sp => sp.id === data.spaceId);
            if (s) data.spaceName = s.name;
        }

        return { id: q.docs[0].id, ...data, date: data.dateQuery.toDate() };
    }

    // --- QR VALIDATION ---

    async function validateVisit(ctx, reservationId, scannedQrCode) {
        // Scanned QR code should be the spaceId (e.g., 'cubiculo-1')
        const ref = ctx.db.collection(C_RESERVAS).doc(reservationId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Reserva no encontrada");

        const booking = snap.data();

        // 1. Validate Status
        if (booking.status === 'completed') throw new Error("Esta visita ya finalizó.");
        if (booking.status === 'cancelled') throw new Error("Esta reserva fue cancelada.");

        // 2. Validate Space Match (Strict)
        if (booking.spaceId !== scannedQrCode) {
            throw new Error(`QR incorrecto. Tienes asignado el ${booking.spaceName}.`);
        }

        // 3. Validate Time
        const now = new Date();
        const bookingTime = booking.dateQuery.toDate();

        // Tolerance: Can enter from 10 mins before up to 20 mins after start
        const diffMins = (now - bookingTime) / 1000 / 60;

        if (booking.status === 'confirmed') {
            // CHECK-IN
            if (diffMins < -15) {
                const waitMins = Math.abs(Math.ceil(diffMins + 15)); // Time until -15 mark
                const waitSecs = Math.abs(Math.floor(((diffMins + 15) * 60) % 60));

                // Detailed message for countdown
                throw new Error(`Es muy pronto. Faltan ${Math.floor(Math.abs(diffMins))}m para tu hora. (Entrada permitida 15 min antes).`);
            }
            if (diffMins > config.tolerance) throw new Error("Tu tiempo de reserva ha expirado (tolerancia excedida).");

            await ref.update({
                status: 'checked-in',
                checkInTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { action: 'check-in', message: '¡Bienvenida! Tu visita ha iniciado.' };

        } else if (booking.status === 'checked-in') {
            // CHECK-OUT
            await ref.update({
                status: 'completed',
                checkOutTime: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { action: 'check-out', message: 'Visita finalizada. ¡Gracias por dejar el área limpia!' };
        }
    }

    async function cancelReservation(ctx, id, reason) {
        const ref = ctx.db.collection(C_RESERVAS).doc(id);
        const snap = await ref.get();
        if (!snap.exists) return;

        const data = snap.data();

        if (data.linkedMediCitaId) {
            await cancelLinkedMedicalAppointment(ctx, data.linkedMediCitaId, reason || 'Cancelada desde lactario');
        }

        return ref.update({
            status: 'cancelled',
            cancelReason: reason,
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            medicalSupportStatus: data.linkedMediCitaId ? 'cancelled' : (data.medicalSupportStatus || null)
        });
    }

    // --- ADMIN --- 

    // Add logic for adding spaces, generating QRs etc. (Simplified for now)
    // --- ADMIN --- 

    // Spaces
    async function addSpace(ctx, name) {
        const id = 'cubiculo-' + Date.now();
        await ctx.db.collection(C_ESPACIOS).doc(id).set({
            id: id,
            name: name,
            active: true
        });
        await loadConfig(ctx); // Update cache
        return id;
    }

    async function toggleSpace(ctx, spaceId, isActive) {
        await ctx.db.collection(C_ESPACIOS).doc(spaceId).update({ active: isActive });
        await loadConfig(ctx);
    }

    async function updateSpace(ctx, spaceId, data) {
        await ctx.db.collection(C_ESPACIOS).doc(spaceId).update(data);
        await loadConfig(ctx);
    }

    async function deleteSpace(ctx, spaceId) {
        await ctx.db.collection(C_ESPACIOS).doc(spaceId).delete();
        await loadConfig(ctx);
    }

    // Config
    async function updateConfig(ctx, newConfig) {
        // Merge with existing
        const merged = { ...config, ...newConfig };
        await ctx.db.doc(CONFIG_DOC).set(merged, { merge: true });
        config = merged;
        return config;
    }

    // Stats
    async function getStats(ctx, range = '7days') {
        const now = new Date();
        const past = new Date();
        if (range === '7days') past.setDate(now.getDate() - 7);
        if (range === '30days') past.setDate(now.getDate() - 30);

        let query = ctx.db.collection(C_RESERVAS)
            .where('status', 'in', ['confirmed', 'checked-in', 'completed', 'cancelled', 'no-show']);

        if (range !== 'all') {
            query = query.where('dateQuery', '>=', past);
        }

        const q = await query.get();

        const docs = q.docs.map(d => d.data());

        // Initialize Counters
        const stats = {
            total: docs.length,
            statusCounts: { completed: 0, cancelled: 0, confirmed: 0, 'no-show': 0 },
            visitsByDate: {},
            visitsByHour: {}, // 8: 10, 9: 5...
            visitsByReason: {},
            durations: [],
            averageDuration: 0,
            peakHour: '-'
        };

        // Process Data
        docs.forEach(d => {
            // Status
            if (stats.statusCounts[d.status] !== undefined) {
                stats.statusCounts[d.status]++;
            } else {
                stats.statusCounts[d.status] = 1;
            }

            if (d.status === 'completed' || d.status === 'checked-in') {
                // By Date
                const dateKey = toISO(d.dateQuery.toDate());
                stats.visitsByDate[dateKey] = (stats.visitsByDate[dateKey] || 0) + 1;

                // By Hour
                const h = parseInt(d.time.split(':')[0]);
                stats.visitsByHour[h] = (stats.visitsByHour[h] || 0) + 1;

                // Reason
                const reason = d.type || 'Lactancia';
                stats.visitsByReason[reason] = (stats.visitsByReason[reason] || 0) + 1;

                // Duration
                if (d.checkInTime && d.checkOutTime) {
                    const t1 = d.checkInTime.toDate();
                    const t2 = d.checkOutTime.toDate();
                    const diffMins = Math.round((t2 - t1) / 60000);
                    if (diffMins > 0 && diffMins < 120) { // Filter outliers
                        stats.durations.push(diffMins);
                    }
                }
            }
        });

        // Averages & Max
        if (stats.durations.length > 0) {
            const sum = stats.durations.reduce((a, b) => a + b, 0);
            stats.averageDuration = Math.round(sum / stats.durations.length);
        }

        // Peak Hour
        let maxVisits = 0;
        let peakH = null;
        for (const [h, count] of Object.entries(stats.visitsByHour)) {
            if (count > maxVisits) {
                maxVisits = count;
                peakH = h;
            }
        }
        stats.peakHour = peakH ? `${peakH}:00` : '-';

        return stats;
    }

    async function getUserHistorySummary(ctx, uid) {
        const q = await ctx.db.collection(C_RESERVAS)
            .where('userId', '==', uid)
            .where('status', 'in', ['checked-in', 'completed'])
            .orderBy('dateQuery', 'asc')
            .get();

        const docs = q.docs.map(d => d.data());
        let totalMinutes = 0;

        docs.forEach((booking) => {
            if (booking.checkInTime && booking.checkOutTime) {
                const start = resolveDateLike(booking.checkInTime);
                const end = resolveDateLike(booking.checkOutTime);
                if (start && end && end > start) {
                    totalMinutes += Math.round((end - start) / 60000);
                    return;
                }
            }

            if (booking.status === 'checked-in' && booking.checkInTime) {
                const start = resolveDateLike(booking.checkInTime);
                if (start) {
                    const elapsed = Math.max(0, Math.round((Date.now() - start.getTime()) / 60000));
                    totalMinutes += Math.min(elapsed, config.usageTime || 30);
                    return;
                }
            }

            totalMinutes += config.usageTime || 30;
        });

        return {
            visits: docs.length,
            totalMinutes
        };
    }

    async function getUserBookingHistory(ctx, uid, limit = 12) {
        const q = await ctx.db.collection(C_RESERVAS)
            .where('userId', '==', uid)
            .get();

        return q.docs
            .map((doc) => normalizeBookingDoc(doc))
            .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
            .slice(0, limit);
    }

    async function rescheduleReservation(ctx, bookingId, { user, date, timeStr, type, medicalSupport }) {
        await loadConfig(ctx);
        const bookingRef = ctx.db.collection(C_RESERVAS).doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) throw new Error('Reserva no encontrada.');

        const currentBooking = bookingSnap.data();
        if (currentBooking.status !== 'confirmed') {
            throw new Error('Solo puedes reagendar una reserva pendiente de entrada.');
        }

        const bookingDate = buildBookingDate(date, timeStr);
        if (bookingDate < new Date()) {
            throw new Error('No puedes reagendar a un horario pasado.');
        }

        const reservationResult = await ctx.db.runTransaction(async (tx) => {
            const liveSnap = await tx.get(bookingRef);
            if (!liveSnap.exists) throw new Error('Reserva no encontrada.');

            const liveBooking = liveSnap.data();
            if (liveBooking.status !== 'confirmed') {
                throw new Error('La reserva ya cambió de estado. Recarga e intenta de nuevo.');
            }

            const slotId = `${date}_${timeStr}`;
            const activeWindowStart = new Date();
            activeWindowStart.setHours(0, 0, 0, 0);

            const activeBookingsQ = await tx.get(ctx.db.collection(C_RESERVAS)
                .where('userId', '==', user.uid)
                .where('status', 'in', ['confirmed', 'checked-in'])
                .where('dateQuery', '>=', activeWindowStart));

            const otherActiveBookings = activeBookingsQ.docs.filter((doc) => doc.id !== bookingId);
            if (otherActiveBookings.length > 0) {
                throw new Error('Tienes otra reserva activa. Cancélala antes de reagendar esta visita.');
            }

            const activeSpaces = spaces.filter((space) => space.active !== false);
            if (activeSpaces.length <= 0) {
                throw new Error('No hay espacios activos disponibles en este momento.');
            }

            const slotQ = await tx.get(ctx.db.collection(C_RESERVAS)
                .where('slotId', '==', slotId)
                .where('status', 'in', ['confirmed', 'checked-in']));

            const competingBookings = slotQ.docs.filter((doc) => doc.id !== bookingId);
            if (competingBookings.length >= activeSpaces.length) {
                throw new Error('Lo sentimos, este horario ya está lleno.');
            }

            const takenSpaceIds = competingBookings.map((doc) => doc.data().spaceId);
            const preferredSpace = activeSpaces.find((space) => space.id === liveBooking.spaceId && !takenSpaceIds.includes(space.id));
            const availableSpace = preferredSpace || activeSpaces.find((space) => !takenSpaceIds.includes(space.id));

            if (!availableSpace) {
                throw new Error('No fue posible asignar un espacio disponible para el nuevo horario.');
            }

            tx.update(bookingRef, {
                date,
                time: timeStr,
                type: type || liveBooking.type || 'Lactancia',
                slotId,
                spaceId: availableSpace.id,
                spaceName: availableSpace.name,
                dateQuery: firebase.firestore.Timestamp.fromDate(bookingDate),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                medicalSupportRequested: !!medicalSupport,
                medicalSupportQueuePosition: 0,
                medicalSupportProfessionalName: null,
                medicalSupportLinkedAt: null,
                medicalSupportError: null
            });

            return {
                id: bookingId,
                spaceName: availableSpace.name,
                time: timeStr
            };
        });

        let medicalWarning = null;
        if (currentBooking.linkedMediCitaId) {
            try {
                await cancelLinkedMedicalAppointment(ctx, currentBooking.linkedMediCitaId, 'Reagendada desde lactario');
            } catch (error) {
                medicalWarning = error?.message || 'No fue posible cancelar la cita médica previa.';
            }
        }

        if (!medicalSupport) {
            await bookingRef.update({
                linkedMediCitaId: null,
                medicalSupportRequested: false,
                medicalSupportStatus: medicalWarning ? 'warning' : null,
                medicalSupportQueuePosition: 0,
                medicalSupportProfessionalName: null,
                medicalSupportLinkedAt: null,
                medicalSupportError: medicalWarning
            });
            return {
                ...reservationResult,
                medicalSupportStatus: medicalWarning ? 'warning' : null,
                medicalSupportWarning: medicalWarning
            };
        }

        try {
            const medicalResult = await createMedicalSupportAppointment(ctx, {
                user,
                bookingId,
                bookingDate,
                lactarioType: type
            });

            await bookingRef.update({
                linkedMediCitaId: medicalResult.citaId,
                medicalSupportRequested: true,
                medicalSupportStatus: medicalResult.status,
                medicalSupportQueuePosition: medicalResult.queuePosition || 0,
                medicalSupportProfessionalName: medicalResult.professionalName || null,
                medicalSupportLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
                medicalSupportError: medicalWarning
            });

            return {
                ...reservationResult,
                medicalSupportStatus: medicalResult.status,
                medicalSupportQueuePosition: medicalResult.queuePosition || 0,
                medicalSupportProfessionalName: medicalResult.professionalName || null,
                medicalSupportWarning: medicalWarning
            };
        } catch (error) {
            await bookingRef.update({
                linkedMediCitaId: null,
                medicalSupportRequested: true,
                medicalSupportStatus: 'error',
                medicalSupportQueuePosition: 0,
                medicalSupportProfessionalName: null,
                medicalSupportLinkedAt: null,
                medicalSupportError: error?.message || 'No fue posible reprogramar la asistencia médica.'
            });

            return {
                ...reservationResult,
                medicalSupportStatus: 'error',
                medicalSupportError: error?.message || 'No fue posible reprogramar la asistencia médica.',
                medicalSupportWarning: medicalWarning
            };
        }
    }

    async function getAdminBookings(ctx, { dateStr, status = 'all', type = 'all' } = {}) {
        const targetDate = dateStr || toISO(new Date());
        const { start, end } = getDateRange(targetDate);
        const q = await ctx.db.collection(C_RESERVAS)
            .where('dateQuery', '>=', start)
            .where('dateQuery', '<=', end)
            .orderBy('dateQuery', 'asc')
            .get();

        return q.docs
            .map((doc) => normalizeBookingDoc(doc))
            .filter((booking) => status === 'all' ? true : booking.status === status)
            .filter((booking) => type === 'all' ? true : booking.type === type);
    }

    async function getActiveFridgeItems(ctx) {
        const q = await ctx.db.collection(C_RESERVAS)
            .where('fridgeStatus', '==', 'stored')
            .get();

        return q.docs
            .map((doc) => ({
                ...normalizeBookingDoc(doc),
                fridgeTime: resolveDateLike(doc.data().fridgeTime)
            }))
            .sort((a, b) => (b.fridgeTime?.getTime() || 0) - (a.fridgeTime?.getTime() || 0));
    }

    async function getAdminDashboardSnapshot(ctx, dateStr = toISO(new Date())) {
        const [bookings, activeFridgeItems] = await Promise.all([
            getAdminBookings(ctx, { dateStr }),
            getActiveFridgeItems(ctx)
        ]);

        const now = new Date();
        const target = new Date(`${dateStr}T00:00:00`);
        const isToday = target.toDateString() === now.toDateString();

        const summary = {
            total: bookings.length,
            confirmed: bookings.filter((item) => item.status === 'confirmed').length,
            checkedIn: bookings.filter((item) => item.status === 'checked-in').length,
            completed: bookings.filter((item) => item.status === 'completed').length,
            cancelled: bookings.filter((item) => item.status === 'cancelled').length,
            noShow: bookings.filter((item) => item.status === 'no-show').length,
            upcoming: bookings.filter((item) => item.status === 'confirmed' && (!isToday || (item.date && item.date >= now))).length,
            delayedCheckins: bookings.filter((item) => item.status === 'confirmed' && isToday && item.date && item.date < now).length,
            medicalSupport: bookings.filter((item) => item.medicalSupportRequested).length,
            fridgesInUse: activeFridgeItems.length
        };

        return {
            dateStr,
            summary,
            bookings,
            activeFridgeItems
        };
    }

    async function adminUpdateBookingStatus(ctx, bookingId, { status, reason = '' } = {}) {
        const allowedStatuses = ['confirmed', 'checked-in', 'completed', 'cancelled', 'no-show'];
        if (!allowedStatuses.includes(status)) {
            throw new Error('Estado de reserva no válido.');
        }

        const bookingRef = ctx.db.collection(C_RESERVAS).doc(bookingId);
        const snap = await bookingRef.get();
        if (!snap.exists) throw new Error('Reserva no encontrada.');

        const booking = snap.data();
        const updates = {
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (status === 'checked-in' && !booking.checkInTime) {
            updates.checkInTime = firebase.firestore.FieldValue.serverTimestamp();
        }

        if (status === 'completed') {
            if (!booking.checkInTime) {
                updates.checkInTime = firebase.firestore.FieldValue.serverTimestamp();
            }
            updates.checkOutTime = firebase.firestore.FieldValue.serverTimestamp();
        }

        if (status === 'cancelled') {
            updates.cancelReason = reason || 'Cancelada por administración';
            updates.cancelledAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        if (status === 'no-show') {
            updates.autoCancelledAt = firebase.firestore.FieldValue.serverTimestamp();
            updates.cancelReason = reason || 'Marcada como no-show por administración';
        }

        if ((status === 'cancelled' || status === 'no-show') && booking.linkedMediCitaId) {
            try {
                await cancelLinkedMedicalAppointment(ctx, booking.linkedMediCitaId, updates.cancelReason);
                updates.medicalSupportStatus = 'cancelled';
            } catch (error) {
                updates.medicalSupportStatus = 'warning';
                updates.medicalSupportError = error?.message || 'No fue posible cancelar la cita médica vinculada.';
            }
        }

        await bookingRef.update(updates);
        return {
            id: bookingId,
            status,
            reason: updates.cancelReason || null
        };
    }


    // --- FRIDGE MANAGEMENT ---
    async function getFridges(ctx) {
        const snaps = await ctx.db.collection('lactario_fridges').get();
        return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function addFridge(ctx, name, limit = 10) {
        return ctx.db.collection('lactario_fridges').add({
            name,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function toggleFridge(ctx, id, active) {
        return ctx.db.collection('lactario_fridges').doc(id).update({ active });
    }

    async function updateFridge(ctx, id, data) {
        return ctx.db.collection('lactario_fridges').doc(id).update(data);
    }

    async function deleteFridge(ctx, id) {
        return ctx.db.collection('lactario_fridges').doc(id).delete();
    }

    async function useFridge(ctx, bookingId, fridgeQR) {
        const fridgeRef = ctx.db.collection('lactario_fridges').doc(fridgeQR);
        const fridgeSnap = await fridgeRef.get();
        if (!fridgeSnap.exists) {
            throw new Error('El QR del refrigerador no es válido.');
        }
        if (fridgeSnap.data()?.active === false) {
            throw new Error('Este refrigerador está inactivo en este momento.');
        }

        const bookingRef = ctx.db.collection(C_RESERVAS).doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) {
            throw new Error('No se encontró la reserva activa para el frigobar.');
        }

        const booking = bookingSnap.data();
        if (booking.status !== 'checked-in') {
            throw new Error('Solo puedes registrar frigobar durante una visita en curso.');
        }
        if (booking.fridgeStatus === 'stored') {
            throw new Error('Tu contenedor ya está registrado en frigobar.');
        }

        return bookingRef.update({
            fridgeUsed: true,
            fridgeStatus: 'stored', // NEW: track status
            fridgeId: fridgeQR,
            fridgeTime: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function pickupFridge(ctx, bookingId, fridgeQR = null) {
        const bookingRef = ctx.db.collection(C_RESERVAS).doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) {
            throw new Error('No se encontró el registro del frigobar.');
        }

        const booking = bookingSnap.data();
        if (booking.fridgeStatus !== 'stored') {
            throw new Error('Este registro ya no está pendiente de retiro.');
        }
        if (fridgeQR && booking.fridgeId && booking.fridgeId !== fridgeQR) {
            throw new Error('El QR escaneado no coincide con tu resguardo.');
        }

        return ctx.db.collection(C_RESERVAS).doc(bookingId).update({
            fridgeStatus: 'picked_up',
            fridgePickupTime: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function getFridgeStatus(ctx, uid) {
        // Find items "stored" by this user
        const q = await ctx.db.collection(C_RESERVAS)
            .where('userId', '==', uid)
            .where('fridgeStatus', '==', 'stored')
            .orderBy('fridgeTime', 'desc')
            .get();

        return q.docs.map(d => ({ id: d.id, ...d.data(), fridgeTime: d.data().fridgeTime?.toDate() }));
    }

    // --- PSYCH ACCOMPANIMENT ---
    async function registerAccompaniment(ctx, { studentMatricula, studentName, notes }) {
        const docRef = ctx.db.collection('lactario-visits').doc();
        return docRef.set({
            id: docRef.id,
            psychId: ctx.user.uid,
            psychName: ctx.profile.displayName || ctx.user.email,
            studentMatricula,
            studentName,
            notes,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'Acompañamiento'
        });
    }

    async function getAccompanimentHistory(ctx, psychId) {
        const q = await ctx.db.collection('lactario-visits')
            .where('psychId', '==', psychId)
            .orderBy('date', 'desc')
            .limit(20)
            .get();
        return q.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() }));
    }

    return {
        loadConfig,
        getSpaces,
        checkAccess,
        getAvailability,
        createReservation,
        getUserActiveReservation,
        validateVisit,
        cancelReservation,
        // Admin
        addSpace,
        toggleSpace,
        updateSpace,
        deleteSpace,
        updateConfig,
        getStats,
        getUserHistorySummary,
        getUserBookingHistory,
        rescheduleReservation,
        getAdminBookings,
        getActiveFridgeItems,
        getAdminDashboardSnapshot,
        adminUpdateBookingStatus,
        // Fridges
        getFridges,
        addFridge,
        updateFridge,
        toggleFridge,
        deleteFridge,
        useFridge,
        pickupFridge,
        getFridgeStatus,
        // Psych
        registerAccompaniment,
        getAccompanimentHistory,
        checkExpiredBookings
    };

})();

window.LactarioService = LactarioService;
