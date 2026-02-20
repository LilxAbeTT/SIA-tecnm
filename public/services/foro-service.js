// public/services/foro-service.js
// Servicio de datos para el Módulo FORO v6.0 — Eventos Académicos

if (!window.ForoService) {
    window.ForoService = (function () {

        const C_EVENTS = 'foro_events';
        const C_TICKETS = 'foro_tickets';

        const VALID_TYPES = ['conferencia', 'exposicion', 'otro'];

        // ===============================================
        // 1. GESTIÓN DE EVENTOS
        // ===============================================

        // ===============================================
        // 1. GESTIÓN DE EVENTOS
        // ===============================================

        // Para Difusión: Ver TODO (especialmente pendientes)
        async function getPendingEvents(ctx) {
            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', '==', 'pending')
                .orderBy('date', 'asc')
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Para Difusión: Historial (Aprobados/Rechazados)
        async function getHistoryEvents(ctx) {
            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', 'in', ['active', 'rejected', 'cancelled'])
                .orderBy('date', 'desc')
                .limit(50)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Para Jefes de División: Sus propios eventos (cualquier estado)
        async function getMyEvents(ctx) {
            const uid = ctx.auth.currentUser.uid;
            const snap = await ctx.db.collection(C_EVENTS)
                .where('createdBy', '==', uid)
                .orderBy('date', 'desc')
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fallback si índice falla temporalmente (filtrado cliente)
            /*
            const allSnap = await ctx.db.collection(C_EVENTS).orderBy('date', 'desc').limit(100).get();
            return allSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(e => e.createdBy === uid);
            */
        }

        // Legacy (mantener por compatibilidad si es necesario, OJO: usa getActiveEvents para alumnos)
        async function getAllEventsAdmin(ctx) {
            // Este método podría ser ambiguo ahora, lo redirigimos a getMyEvents si no es difusion
            // Pero mantendremos la lógica original si es Difusion para ver todo.
            const user = ctx.profile || {};
            if (user.email === 'difusion@loscabos.tecnm.mx') {
                const snap = await ctx.db.collection(C_EVENTS).orderBy('date', 'desc').get();
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else {
                return getMyEvents(ctx);
            }
        }

        async function getActiveEvents(ctx) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', '==', 'active') // IMPORTANTE: Solo activos
                .where('date', '>=', yesterday)
                .orderBy('date', 'asc')
                .get();

            const user = ctx.profile || {};
            const userCareer = user.career || 'GENERIC';

            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(evt => {
                    if (!evt.targetAudience || evt.targetAudience.includes('ALL')) return true;
                    return evt.targetAudience.includes(userCareer);
                });
        }

        async function createEvent(ctx, data) {
            if (data.type && !VALID_TYPES.includes(data.type)) {
                throw new Error('Tipo de evento inválido. Usa: conferencia, exposicion, otro');
            }

            const user = ctx.profile || {};
            const isDifusion = user.email === 'difusion@loscabos.tecnm.mx';

            // ESTADO INICIAL: Active si es Difusion, Pending si es Jefe
            const initialStatus = isDifusion ? 'active' : 'pending';

            await ctx.db.collection(C_EVENTS).add({
                ...data,
                type: data.type || 'otro',
                coverImage: data.coverImage || '',
                registeredCount: 0,
                status: initialStatus,
                createdBy: ctx.auth.currentUser.uid,
                createdByName: user.displayName || 'Admin',
                createdByEmail: user.email || '',
                createdAt: new Date(),
                division: user.departmentConfig ? Object.keys(user.departmentConfig)[0] : 'general'
            });
        }

        async function updateEvent(ctx, id, data) {
            await ctx.db.collection(C_EVENTS).doc(id).update(data);
        }

        async function deleteEvent(ctx, id) {
            // Soft delete: Change status to 'cancelled'
            await ctx.db.collection(C_EVENTS).doc(id).update({
                status: 'cancelled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // --- VALIDACIÓN ---

        async function approveEvent(ctx, eventId) {
            await ctx.db.collection(C_EVENTS).doc(eventId).update({
                status: 'active',
                validatedBy: ctx.profile.email,
                validatedAt: new Date(),
                rejectionReason: null // Limpiar si hubo rechazo previo
            });
        }

        async function rejectEvent(ctx, eventId, reason) {
            await ctx.db.collection(C_EVENTS).doc(eventId).update({
                status: 'rejected',
                rejectedBy: ctx.profile.email,
                rejectedAt: new Date(),
                rejectionReason: reason || 'Sin motivo especificado'
            });
        }

        // ===============================================
        // 2. INSCRIPCIÓN Y TICKETS
        // ===============================================

        async function registerUser(ctx, event, userProfile) {
            const evtRef = ctx.db.collection(C_EVENTS).doc(event.id);

            return ctx.db.runTransaction(async (t) => {
                const doc = await t.get(evtRef);
                const evtData = doc.data();

                if (evtData.registeredCount >= evtData.capacity) {
                    throw new Error("El evento está lleno.");
                }

                // Verificar duplicado
                const existing = await ctx.db.collection(C_TICKETS)
                    .where('eventId', '==', event.id)
                    .where('userId', '==', userProfile.uid)
                    .limit(1)
                    .get();

                if (!existing.empty) {
                    throw new Error("Ya estás inscrito a este evento.");
                }

                const ticketRef = ctx.db.collection(C_TICKETS).doc();

                t.set(ticketRef, {
                    eventId: event.id,
                    eventTitle: evtData.title,
                    eventLocation: evtData.location,
                    eventDate: evtData.date,
                    eventType: evtData.type || 'otro',
                    userId: userProfile.uid,
                    userName: userProfile.displayName,
                    userMatricula: userProfile.matricula,
                    userCareer: userProfile.career || 'N/A',
                    qrCodeData: `SIA:FORO:${event.id}:${userProfile.uid}`,
                    status: 'registered',
                    registeredAt: new Date()
                });

                t.update(evtRef, { registeredCount: evtData.registeredCount + 1 });
            });
        }

        async function getUserTickets(ctx, uid) {
            const snap = await ctx.db.collection(C_TICKETS)
                .where('userId', '==', uid)
                .where('status', 'in', ['registered', 'attended'])
                .orderBy('eventDate', 'desc')
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // ===============================================
        // 3. ASISTENCIA (QR)
        // ===============================================

        async function markAttendance(ctx, qrData) {
            const parts = qrData.split(':');
            if (parts.length !== 4 || parts[0] !== 'SIA' || parts[1] !== 'FORO') {
                throw new Error("Código QR inválido o de otro sistema.");
            }

            const [, , eventId, userId] = parts;

            const ticketQuery = await ctx.db.collection(C_TICKETS)
                .where('eventId', '==', eventId)
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (ticketQuery.empty) {
                throw new Error("El alumno no está inscrito a este evento.");
            }

            const ticketDoc = ticketQuery.docs[0];
            const ticket = ticketDoc.data();

            if (ticket.status === 'attended') {
                throw new Error(`${ticket.userName} YA registró asistencia.`);
            }

            await ctx.db.collection(C_TICKETS).doc(ticketDoc.id).update({
                status: 'attended',
                attendedAt: new Date()
            });

            return { userName: ticket.userName, eventTitle: ticket.eventTitle };
        }

        async function markBulkAttendance(ctx, eventId) {
            const snap = await ctx.db.collection(C_TICKETS)
                .where('eventId', '==', eventId)
                .where('status', '==', 'registered')
                .get();

            if (snap.empty) return { count: 0 };

            const batch = ctx.db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'attended',
                    attendedAt: new Date()
                });
            });

            await batch.commit();
            return { count: snap.size };
        }

        async function getEventAttendees(ctx, eventId) {
            const snap = await ctx.db.collection(C_TICKETS)
                .where('eventId', '==', eventId)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // ===============================================
        // 4. DASHBOARD STORIES
        // ===============================================

        async function getEventsForStories(ctx) {
            if (!ctx.user) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const snap = await ctx.db.collection(C_EVENTS)
                .where('date', '>=', today)
                .where('status', '==', 'active')
                .orderBy('date', 'asc')
                .limit(10)
                .get();

            const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const results = [];
            for (const event of events) {
                const ticketSnap = await ctx.db.collection(C_TICKETS)
                    .where('eventId', '==', event.id)
                    .where('userId', '==', ctx.user.uid)
                    .limit(1)
                    .get();

                results.push({
                    ...event,
                    registered: !ticketSnap.empty,
                    source: 'foro'
                });
            }

            return results;
        }

        // ===============================================
        // 5. CANCELACIÓN DE INSCRIPCIÓN
        // ===============================================

        async function cancelRegistration(ctx, ticketId, eventId) {
            const ticketRef = ctx.db.collection(C_TICKETS).doc(ticketId);
            const eventRef = ctx.db.collection(C_EVENTS).doc(eventId);

            return ctx.db.runTransaction(async (t) => {
                const ticket = await t.get(ticketRef);
                const event = await t.get(eventRef);

                if (!ticket.exists) throw new Error("Ticket no encontrado.");
                if (!event.exists) throw new Error("Evento no encontrado.");

                const ticketData = ticket.data();
                const eventData = event.data();

                const eventDate = ticketData.eventDate?.toDate
                    ? ticketData.eventDate.toDate()
                    : new Date(ticketData.eventDate);
                if (eventDate < new Date()) {
                    throw new Error("No puedes cancelar despues de que inicio el evento.");
                }
                if (ticketData.status === 'attended') {
                    throw new Error("No puedes cancelar un evento al que ya asististe.");
                }

                t.delete(ticketRef);
                t.update(eventRef, {
                    registeredCount: Math.max(0, (eventData.registeredCount || 1) - 1)
                });
            });
        }

        // ===============================================
        // 6. HISTORIAL DE PARTICIPACIÓN
        // ===============================================

        async function getUserEventHistory(ctx, uid) {
            const snap = await ctx.db.collection(C_TICKETS)
                .where('userId', '==', uid)
                .where('status', '==', 'attended')
                .orderBy('attendedAt', 'desc')
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // ===============================================
        // 7. FEEDBACK POST-EVENTO
        // ===============================================

        async function submitEventFeedback(ctx, ticketId, eventId, userId, rating, comment) {
            await ctx.db.collection(C_EVENTS).doc(eventId)
                .collection('feedback').add({
                    ticketId,
                    eventId,
                    userId,
                    rating: parseInt(rating),
                    comment: comment || '',
                    submittedAt: new Date()
                });

            await ctx.db.collection(C_TICKETS).doc(ticketId).update({
                feedbackSubmitted: true
            });
        }

        function canSubmitFeedback(ticket) {
            if (!ticket || ticket.status !== 'attended') return false;
            if (ticket.feedbackSubmitted) return false;
            const attendedAt = ticket.attendedAt?.toDate
                ? ticket.attendedAt.toDate()
                : new Date(ticket.attendedAt);
            const hoursSince = (new Date() - attendedAt) / 3600000;
            return hoursSince <= 48;
        }

        // ===============================================
        // 8. CONSTANCIA PDF
        // ===============================================

        async function generateAttendanceCertificate(ctx, uid, userProfile) {
            if (!window.jspdf) throw new Error('jsPDF no disponible');

            const history = await getUserEventHistory(ctx, uid);
            if (!history.length) throw new Error('No tienes asistencias registradas');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'letter');
            const pw = doc.internal.pageSize.getWidth();
            const m = 20;

            // Header
            doc.setFillColor(27, 57, 106);
            doc.rect(0, 0, pw, 50, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CONSTANCIA DE PARTICIPACION', pw / 2, 22, { align: 'center' });
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('Eventos Academicos — TecNM Campus Los Cabos', pw / 2, 32, { align: 'center' });
            doc.text('Sistema Integral de Asistencia (SIA)', pw / 2, 40, { align: 'center' });

            // Body
            let y = 65;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(11);
            doc.text('Se hace constar que:', m, y);
            y += 12;
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile.displayName || userProfile.email || 'Alumno', pw / 2, y, { align: 'center' });
            y += 7;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Matricula: ${userProfile.matricula || 'N/A'}  |  Carrera: ${userProfile.career || 'N/A'}`, pw / 2, y, { align: 'center' });
            y += 12;
            doc.text(`Ha participado en ${history.length} evento${history.length > 1 ? 's' : ''} academico${history.length > 1 ? 's' : ''}:`, m, y);
            y += 10;

            history.forEach((evt, i) => {
                if (y > 240) { doc.addPage(); y = m; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`${i + 1}. ${evt.eventTitle || 'Evento'}`, m + 5, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                const dateStr = evt.eventDate
                    ? (evt.eventDate.toDate ? evt.eventDate.toDate() : new Date(evt.eventDate)).toLocaleDateString('es-MX', { dateStyle: 'long' })
                    : '';
                doc.text(`   ${dateStr} — ${evt.eventLocation || 'Campus'}`, m + 5, y);
                y += 8;
            });

            // Footer
            y = 250;
            doc.setDrawColor(100);
            doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
            y += 5;
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text('Desarrollo Academico', pw / 2, y, { align: 'center' });
            y += 8;
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Emitido: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });

            doc.save(`Constancia_Eventos_${userProfile.matricula || 'SIA'}_${Date.now()}.pdf`);
        }

        // ===============================================
        // 9. UTILIDADES
        // ===============================================

        function getEventQRData(eventId) {
            return `SIA:FORO_EVENT:${eventId}`;
        }

        /**
         * Marca asistencia cuando el ESTUDIANTE escanea el QR del evento proyectado.
         * El QR del evento tiene formato: SIA:FORO_EVENT:{eventId}
         */
        async function markAttendanceByEventQR(ctx, qrData, userId) {
            const parts = qrData.split(':');
            if (parts.length !== 3 || parts[0] !== 'SIA' || parts[1] !== 'FORO_EVENT') {
                throw new Error("Código QR inválido. Escanea el QR del evento proyectado.");
            }

            const eventId = parts[2];

            const ticketQuery = await ctx.db.collection(C_TICKETS)
                .where('eventId', '==', eventId)
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (ticketQuery.empty) {
                throw new Error("No estás inscrito a este evento.");
            }

            const ticketDoc = ticketQuery.docs[0];
            const ticket = ticketDoc.data();

            if (ticket.status === 'attended') {
                throw new Error("Ya registraste tu asistencia a este evento.");
            }

            await ctx.db.collection(C_TICKETS).doc(ticketDoc.id).update({
                status: 'attended',
                attendedAt: new Date()
            });

            return { eventTitle: ticket.eventTitle };
        }

        // --- PUBLIC API ---
        return {
            getAllEventsAdmin,
            getPendingEvents,
            getHistoryEvents,
            getMyEvents,
            approveEvent,
            rejectEvent,
            getActiveEvents,
            createEvent,
            updateEvent,
            deleteEvent,
            registerUser,
            getUserTickets,
            markAttendance,
            markBulkAttendance,
            getEventAttendees,
            getEventsForStories,
            getEventQRData,
            markAttendanceByEventQR,
            cancelRegistration,
            getUserEventHistory,
            submitEventFeedback,
            canSubmitFeedback,
            generateAttendanceCertificate
        };

    })();
}
