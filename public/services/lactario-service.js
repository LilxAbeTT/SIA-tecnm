// services/lactario-service.js
// Servicio de Datos para Módulo Lactario
// Gestión de reservas, cubículos y validación de acceso.

const LactarioService = (function () {
    const C_RESERVAS = 'lactario-bookings';
    const C_ESPACIOS = 'lactario-spaces'; // Colección de cubiculos
    const CONFIG_DOC = 'lactario-config/main';

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
    async function checkExpiredBookings(ctx) {
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

            q.docs.forEach(doc => {
                const data = doc.data();
                if (!data.dateQuery) return;

                const bookTime = data.dateQuery.toDate();
                // Expire if: Now > (BookTime + Tolerance)
                const expireTime = new Date(bookTime.getTime() + (tolerance * 60000));

                if (now > expireTime) {
                    batch.update(doc.ref, {
                        status: 'no-show',
                        autoCancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    updates++;
                }
            });

            if (updates > 0) {
                await batch.commit();
                console.log(`[Lactario] Marked ${updates} bookings as no-show.`);
            }
        } catch (e) {
            console.warn("[Lactario] Cleanup error:", e);
        }
    }

    // --- CHECK ACCESS ---
    // Regla: Solo mujeres lactantes con tiempo < 10 meses
    async function checkAccess(userProfile) {
        if (!userProfile) return { allowed: false, reason: 'No profile' };

        // Admin access override
        if (userProfile.permissions?.lactario === 'admin' || userProfile.email === 'calidad@loscabos.tecnm.mx') {
            return { allowed: true, isAdmin: true };
        }

        // Psych Access for Accompaniment
        if (userProfile.role === 'Psicologo' || userProfile.role === 'psicologo') {
            return { allowed: true, isAdmin: false, isPsych: true };
        }

        const isFemale = userProfile.personalData?.genero === 'Femenino' || userProfile.genero === 'Femenino';
        const isLactating = userProfile.healthData?.lactancia === 'Sí' || userProfile.lactancia === 'Sí';
        const rawTime = userProfile.healthData?.lactanciaTiempo || userProfile.lactanciaTiempo || '';

        if (!isFemale) return { allowed: false, reason: 'Módulo exclusivo para mujeres.' };
        if (!isLactating) return { allowed: false, reason: 'No estás registrada en periodo de lactancia.' };

        // Nueva lógica: Validar fecha de inicio
        const fechaInicio = userProfile.healthData?.lactanciaInicio || userProfile.lactanciaInicio; // Timestamp or Date

        if (fechaInicio) {
            // Convert to Date if Firestore Timestamp
            const startDate = fechaInicio.toDate ? fechaInicio.toDate() : new Date(fechaInicio);
            const now = new Date();

            // Calculate months difference
            let months = (now.getFullYear() - startDate.getFullYear()) * 12;
            months -= startDate.getMonth();
            months += now.getMonth();

            // Ajuste por días si es necesario, pero mes a mes es suficiente aprox.
            if (months > 7) {
                return {
                    allowed: false,
                    reason: `Tu periodo de lactancia (${months} meses) excede el límite de 7 meses para este servicio.`
                };
            }
        }
        // Fallback for legacy data (though we want strictly new logic)
        else if (rawTime && !['1', '2', '3', '4', '5', '6', '7'].includes(rawTime)) {
            // Si el string no es 1-7, probablemente es legacy (e.g. "Más de 10")
            // Pero mejor asumimos que si no hay fecha, exigimos actualizar.
            // O permitimos si es legacy valid?
            // El usuario pidió: "el usuario debe validarse para saber si no pasaron sus 7 meses"
            // Si no tiene fecha, no podemos calcular.
            return { allowed: false, reason: 'Por favor actualiza tu perfil para indicar fecha de inicio de lactancia.' };
        }

        return { allowed: true, isAdmin: false };

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

    async function createReservation(ctx, { user, date, timeStr, type, fridge, accompaniment }) {
        return ctx.db.runTransaction(async tx => {
            // Fix: 'date' is already a YYYY-MM-DD string, so we don't need toISO() which expects a Date object
            const slotId = `${date}_${timeStr}`;

            // 1. Check user existing active reservation (prevent double booking same time or pending status)
            // Simpler check: Allow only 1 active reservation per user? Let's say yes for now to avoid abuse.
            const userActiveQ = await ctx.db.collection(C_RESERVAS)
                .where('userId', '==', user.uid)
                .where('status', 'in', ['confirmed', 'checked-in'])
                .where('dateQuery', '>', new Date()) // Future bookings
                .get();

            if (!userActiveQ.empty) {
                // Check if it's the same day? For now blocking multiple future reservations.
                throw new Error("Ya tienes una reserva activa pendiente. Debes completar tu visita actual antes de reservar otra.");
            }

            // 2. Check Space Availability (Active Only)
            const activeSpaces = spaces.filter(s => s.active !== false);
            const totalSpaces = activeSpaces.length;

            // We need to count existing bookings for this specific slotId inside transaction
            const slotQ = await ctx.db.collection(C_RESERVAS)
                .where('slotId', '==', slotId)
                .where('status', 'in', ['confirmed', 'checked-in'])
                .get();

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

            // 4. Create Booking
            const [h, m] = timeStr.split(':').map(Number);

            // Fix: Create date safely handling string input
            // Append T00:00:00 to ensure local time is parsed, not UTC
            const bookingDate = new Date(`${date}T00:00:00`);
            bookingDate.setHours(h, m, 0, 0);

            if (isNaN(bookingDate.getTime())) {
                throw new Error("Fecha inválida.");
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
                accompaniment: accompaniment || false
            });

            // 5. Accompaniment Request (Linked to Medi)
            if (accompaniment) {
                const mediRef = ctx.db.collection('citas-medi').doc();
                tx.set(mediRef, {
                    id: mediRef.id,
                    studentId: user.uid,
                    studentEmail: user.email,
                    studentName: user.displayName || user.email,
                    matricula: user.matricula || '',
                    fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                    fechaHoraSlot: firebase.firestore.Timestamp.fromDate(bookingDate),
                    slotId: slotId,
                    tipoServicio: 'Psicologo', // Route to Psych
                    motivo: 'Acompañamiento Lactancia',
                    estado: 'pendiente',
                    linkedLactarioId: docRef.id,
                    color: 'pink' // UI Hint
                });
            }

            return {
                success: true,
                id: docRef.id,
                spaceName: availableSpace.name,
                time: timeStr
            };
        });
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
        return ctx.db.collection(C_RESERVAS).doc(id).update({
            status: 'cancelled',
            cancelReason: reason,
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
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

        const q = await ctx.db.collection(C_RESERVAS)
            .where('dateQuery', '>=', past)
            .where('status', 'in', ['confirmed', 'checked-in', 'completed']) // Include future confirmed
            .get();

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
            const st = d.status === 'checked-in' ? 'completed' : d.status; // Treat check-in as completed for general stats or separate? 
            // Better keep raw status keys but map safely
            if (stats.statusCounts[d.status] !== undefined) {
                stats.statusCounts[d.status]++;
            } else {
                // If distinct like 'checked-in', group into completed or new?
                stats.statusCounts[d.status] = 1;
            }

            if (d.status === 'completed' || d.status === 'checked-in') {
                // By Date
                const dateKey = d.dateQuery.toDate().toISOString().split('T')[0];
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


    // --- FRIDGE MANAGEMENT ---
    async function getFridges(ctx) {
        const snaps = await ctx.db.collection('lactario_fridges').get();
        return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function addFridge(ctx, name) {
        return ctx.db.collection('lactario_fridges').add({
            name,
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
        // Simple update to booking
        return ctx.db.collection(C_RESERVAS).doc(bookingId).update({
            fridgeUsed: true,
            fridgeStatus: 'stored', // NEW: track status
            fridgeId: fridgeQR,
            fridgeTime: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function pickupFridge(ctx, bookingId) {
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
        deleteSpace,
        updateConfig,
        getStats,
        // Fridges
        getFridges,
        addFridge,
        updateFridge,
        toggleFridge,
        deleteFridge,
        useFridge,
        pickupFridge,
        pickupFridge,
        getFridgeStatus,
        // Psych
        registerAccompaniment,
        getAccompanimentHistory,
        checkExpiredBookings
    };

})();

window.LactarioService = LactarioService;
