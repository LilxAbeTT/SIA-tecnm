// public/services/foro-service.js
// Servicio de Eventos del campus

if (!window.ForoService) {
    window.ForoService = (function () {
        const C_EVENTS = 'foro_events';
        const C_TICKETS = 'foro_tickets';

        function getCtxUid(ctx, fallbackProfile) {
            return (
                ctx?.user?.uid ||
                ctx?.auth?.currentUser?.uid ||
                fallbackProfile?.uid ||
                ctx?.profile?.uid ||
                null
            );
        }

        function getFunctions(ctx) {
            return ctx?.functions || window.SIA?.functions || firebase.functions();
        }

        function getStorage(ctx) {
            return ctx?.storage || window.SIA?.storage || firebase.storage();
        }

        async function callAction(ctx, name, payload = {}) {
            const functions = getFunctions(ctx);
            if (!functions?.httpsCallable) {
                throw new Error('Firebase Functions no esta disponible.');
            }
            const callable = functions.httpsCallable(name);
            const result = await callable(payload);
            return result?.data || {};
        }

        function toDate(value) {
            if (!value) return null;
            if (value.toDate) return value.toDate();
            const date = value instanceof Date ? value : new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function getUserCareer(profile) {
            return profile?.career || profile?.carrera || 'GENERIC';
        }

        function normalizeFeedbackInput(ctx, userIdOrPayload, rating, comment) {
            if (userIdOrPayload && typeof userIdOrPayload === 'object' && !Array.isArray(userIdOrPayload)) {
                return {
                    rating: parseInt(userIdOrPayload.rating, 10),
                    comment: userIdOrPayload.comments || userIdOrPayload.comment || ''
                };
            }

            return {
                rating: parseInt(rating, 10),
                comment: comment || ''
            };
        }

        function safeLimit(limit, fallback) {
            const resolved = parseInt(limit, 10);
            return Number.isFinite(resolved) && resolved > 0 ? resolved : fallback;
        }

        function sanitizeFileName(name) {
            return String(name || 'archivo')
                .replace(/[^a-z0-9._-]/gi, '_')
                .replace(/_+/g, '_')
                .slice(-90);
        }

        function mapDocs(snapshot) {
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }

        function filterEventsByAudience(events, profile) {
            const career = getUserCareer(profile);
            return events.filter((event) => {
                if (!Array.isArray(event.targetAudience) || event.targetAudience.length === 0) return true;
                if (event.targetAudience.includes('ALL')) return true;
                return event.targetAudience.includes(career);
            });
        }

        async function uploadToStorage(ctx, path, file) {
            const storage = getStorage(ctx);
            if (!storage?.ref) {
                throw new Error('Firebase Storage no esta disponible.');
            }
            const ref = storage.ref(path);
            await ref.put(file, {
                contentType: file?.type || 'application/octet-stream'
            });
            return ref.getDownloadURL();
        }

        function serializeEventPayload(data) {
            const resources = Array.isArray(data?.resources)
                ? data.resources.map((item, index) => ({
                    id: item?.id || `res_${Date.now()}_${index}`,
                    title: item?.title || item?.name || '',
                    type: item?.type || 'link',
                    description: item?.description || '',
                    url: item?.url || '',
                    fileName: item?.fileName || '',
                    mimeType: item?.mimeType || ''
                }))
                : [];

            return {
                eventId: data?.eventId || '',
                title: data?.title || '',
                speaker: data?.speaker || '',
                location: data?.location || '',
                description: data?.description || '',
                type: data?.type || 'otro',
                capacity: Number(data?.capacity) || 100,
                targetAudience: Array.isArray(data?.targetAudience) ? data.targetAudience : [],
                date: toDate(data?.date)?.toISOString() || '',
                endDate: toDate(data?.endDate)?.toISOString() || '',
                coverImage: data?.coverImage || '',
                room: data?.room || '',
                mapUrl: data?.mapUrl || '',
                dayInstructions: data?.dayInstructions || '',
                attendanceOpensMinutesBefore: Number(data?.attendanceOpensMinutesBefore) || 30,
                attendanceClosesMinutesAfter: Number(data?.attendanceClosesMinutesAfter) || 120,
                allowSelfCheckIn: data?.allowSelfCheckIn !== false,
                contactEnabled: data?.contactEnabled !== false,
                resources,
                resourcesQrEnabled: data?.resourcesQrEnabled !== false,
                status: data?.status || ''
            };
        }

        async function getPendingEvents(ctx, options = {}) {
            const limit = safeLimit(options.limit, 40);
            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', '==', 'pending')
                .orderBy('date', 'asc')
                .limit(limit)
                .get();
            return mapDocs(snap);
        }

        async function getHistoryEvents(ctx, options = {}) {
            const limit = safeLimit(options.limit, 60);
            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', 'in', ['active', 'rejected', 'cancelled'])
                .orderBy('date', 'desc')
                .limit(limit)
                .get();
            return mapDocs(snap);
        }

        async function getMyEvents(ctx, options = {}) {
            const uid = getCtxUid(ctx);
            const limit = safeLimit(options.limit, 60);
            const snap = await ctx.db.collection(C_EVENTS)
                .where('createdBy', '==', uid)
                .orderBy('date', 'desc')
                .limit(limit)
                .get();
            return mapDocs(snap);
        }

        async function getAllEventsAdmin(ctx, options = {}) {
            return getMyEvents(ctx, options);
        }

        async function getActiveEvents(ctx, options = {}) {
            const limit = safeLimit(options.limit, 48);
            const baseline = new Date();
            baseline.setDate(baseline.getDate() - 1);

            const snap = await ctx.db.collection(C_EVENTS)
                .where('status', '==', 'active')
                .where('date', '>=', baseline)
                .orderBy('date', 'asc')
                .limit(limit)
                .get();

            return filterEventsByAudience(mapDocs(snap), ctx.profile || {});
        }

        async function getEventById(ctx, eventId) {
            const snap = await ctx.db.collection(C_EVENTS).doc(eventId).get();
            if (!snap.exists) throw new Error('El evento no existe.');
            return { id: snap.id, ...snap.data() };
        }

        function streamActiveEvents(ctx, options = {}, onData, onError) {
            const limit = safeLimit(options.limit, 48);
            const baseline = new Date();
            baseline.setDate(baseline.getDate() - 1);

            return ctx.db.collection(C_EVENTS)
                .where('status', '==', 'active')
                .where('date', '>=', baseline)
                .orderBy('date', 'asc')
                .limit(limit)
                .onSnapshot((snapshot) => {
                    onData(filterEventsByAudience(mapDocs(snapshot), ctx.profile || {}));
                }, onError);
        }

        async function createEvent(ctx, data) {
            return callAction(ctx, 'foroUpsertEvent', serializeEventPayload(data));
        }

        async function updateEvent(ctx, id, data) {
            return callAction(ctx, 'foroUpsertEvent', serializeEventPayload({ ...data, eventId: id }));
        }

        async function deleteEvent(ctx, id) {
            return callAction(ctx, 'foroCancelEvent', { eventId: id });
        }

        async function approveEvent(ctx, eventId) {
            return callAction(ctx, 'foroReviewEvent', { eventId, action: 'approve' });
        }

        async function rejectEvent(ctx, eventId, reason) {
            return callAction(ctx, 'foroReviewEvent', { eventId, action: 'reject', reason: reason || '' });
        }

        async function registerUser(ctx, event) {
            return callAction(ctx, 'foroRegister', { eventId: event.id || event });
        }

        async function cancelRegistration(ctx, ticketId) {
            return callAction(ctx, 'foroCancelRegistration', { ticketId });
        }

        async function getUserTickets(ctx, uid, options = {}) {
            const limit = safeLimit(options.limit, 60);
            const snap = await ctx.db.collection(C_TICKETS)
                .where('userId', '==', uid)
                .where('status', 'in', ['registered', 'attended'])
                .orderBy('eventDate', 'desc')
                .limit(limit)
                .get();
            return mapDocs(snap);
        }

        async function getUserEventHistory(ctx, uid, options = {}) {
            const limit = safeLimit(options.limit, 80);
            const snap = await ctx.db.collection(C_TICKETS)
                .where('userId', '==', uid)
                .where('status', '==', 'attended')
                .orderBy('attendedAt', 'desc')
                .limit(limit)
                .get();
            return mapDocs(snap);
        }

        async function markAttendance(ctx, qrData) {
            return callAction(ctx, 'foroMarkAttendance', { qrData });
        }

        async function markAttendanceByEventQR(ctx, qrData) {
            return callAction(ctx, 'foroMarkAttendanceByEventQr', { qrData });
        }

        async function processStudentQr(ctx, qrData) {
            if (String(qrData || '').startsWith('SIA:FORO_EVENT:')) {
                const result = await markAttendanceByEventQR(ctx, qrData);
                return { type: 'attendance', ...result };
            }

            if (String(qrData || '').startsWith('SIA:FORO_RES:')) {
                const parts = String(qrData).split(':');
                const eventId = parts[2];
                const resources = await getEventResources(ctx, { eventId, qrData });
                return { type: 'resources', ...resources };
            }

            throw new Error('El QR no corresponde a asistencia ni a recursos del evento.');
        }

        async function markBulkAttendance() {
            throw new Error('La asistencia masiva ya no esta habilitada en cliente.');
        }

        async function getEventAttendees(ctx, eventId, options = {}) {
            const limit = safeLimit(options.limit, 5000);
            let query = ctx.db.collection(C_TICKETS)
                .where('eventId', '==', eventId);

            if (limit) {
                query = query.limit(limit);
            }

            const snap = await query.get();

            return mapDocs(snap).sort((left, right) => {
                const a = toDate(right.registeredAt) || new Date(0);
                const b = toDate(left.registeredAt) || new Date(0);
                return a.getTime() - b.getTime();
            });
        }

        async function getEventsForStories(ctx) {
            if (!ctx?.user?.uid) return [];
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const [eventsSnap, ticketsSnap] = await Promise.all([
                ctx.db.collection(C_EVENTS)
                    .where('status', '==', 'active')
                    .where('date', '>=', now)
                    .orderBy('date', 'asc')
                    .limit(10)
                    .get(),
                ctx.db.collection(C_TICKETS)
                    .where('userId', '==', ctx.user.uid)
                    .where('status', 'in', ['registered', 'attended'])
                    .orderBy('eventDate', 'desc')
                    .limit(40)
                    .get()
            ]);

            const registeredIds = new Set(mapDocs(ticketsSnap).map((ticket) => ticket.eventId));
            return filterEventsByAudience(mapDocs(eventsSnap), ctx.profile || {}).map((event) => ({
                ...event,
                registered: registeredIds.has(event.id),
                source: 'foro'
            }));
        }

        async function submitEventFeedback(ctx, ticketId, eventId, userIdOrPayload, rating, comment) {
            const normalized = normalizeFeedbackInput(ctx, userIdOrPayload, rating, comment);
            return callAction(ctx, 'foroSubmitFeedback', {
                ticketId,
                eventId,
                rating: normalized.rating,
                comment: normalized.comment
            });
        }

        function canSubmitFeedback(ticket) {
            if (!ticket || ticket.status !== 'attended') return false;
            if (ticket.feedbackSubmitted) return false;
            const attendedAt = toDate(ticket.attendedAt);
            if (!attendedAt) return false;
            return (Date.now() - attendedAt.getTime()) <= 48 * 60 * 60 * 1000;
        }

        async function getEventQrPayload(ctx, eventId, kind = 'attendance') {
            return callAction(ctx, 'foroGetEventQrPayload', { eventId, kind });
        }

        async function getEventResources(ctx, { eventId, qrData } = {}) {
            return callAction(ctx, 'foroGetEventResources', { eventId, qrData: qrData || '' });
        }

        async function uploadCoverImage(ctx, file, uid) {
            if (!file) return '';
            const safeName = sanitizeFileName(file.name);
            const path = `foro/covers/${uid || 'user'}_${Date.now()}_${safeName}`;
            return uploadToStorage(ctx, path, file);
        }

        async function uploadEventMaterial(ctx, file, uid) {
            if (!file) throw new Error('No hay archivo para subir.');
            const safeName = sanitizeFileName(file.name);
            const path = `foro/materials/${uid || 'user'}/${Date.now()}_${safeName}`;
            const url = await uploadToStorage(ctx, path, file);
            return {
                url,
                fileName: file.name || safeName,
                mimeType: file.type || ''
            };
        }

        function buildEventCalendarIcs(event) {
            const start = toDate(event?.date || event?.eventDate);
            if (!start) return null;
            const end = toDate(event?.endDate || event?.eventEndDate) || new Date(start.getTime() + 90 * 60 * 1000);
            const toIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const title = String(event?.title || event?.eventTitle || 'Evento').replace(/[\r\n]/g, ' ');
            const location = String(event?.location || event?.eventLocation || '').replace(/[\r\n]/g, ' ');
            const description = String(event?.description || '').replace(/[\r\n]/g, ' ');
            return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:${toIcsDate(start)}\r\nDTEND:${toIcsDate(end)}\r\nSUMMARY:${title}\r\n${location ? `LOCATION:${location}\r\n` : ''}${description ? `DESCRIPTION:${description}\r\n` : ''}END:VEVENT\r\nEND:VCALENDAR`;
        }

        function downloadEventCalendar(event) {
            const ics = buildEventCalendarIcs(event);
            if (!ics) throw new Error('No fue posible generar el calendario para este evento.');
            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'evento-sia.ics';
            anchor.click();
            URL.revokeObjectURL(url);
        }

        async function generateAttendanceCertificate(ctx, uid, userProfile) {
            if (!window.jspdf) throw new Error('jsPDF no disponible');

            const history = await getUserEventHistory(ctx, uid);
            if (!history.length) throw new Error('No tienes asistencias registradas');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'letter');
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 20;

            doc.setFillColor(16, 49, 82);
            doc.rect(0, 0, pageWidth, 52, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CONSTANCIA DE PARTICIPACION', pageWidth / 2, 22, { align: 'center' });
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('Eventos Academicos - TecNM Campus Los Cabos', pageWidth / 2, 32, { align: 'center' });
            doc.text('Sistema Integral de Asistencia (SIA)', pageWidth / 2, 40, { align: 'center' });

            let cursor = 65;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(11);
            doc.text('Se hace constar que:', margin, cursor);
            cursor += 12;
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile.displayName || userProfile.email || 'Alumno', pageWidth / 2, cursor, { align: 'center' });
            cursor += 7;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Matricula: ${userProfile.matricula || 'N/A'}  |  Carrera: ${getUserCareer(userProfile) || 'N/A'}`, pageWidth / 2, cursor, { align: 'center' });
            cursor += 12;
            doc.text(`Ha participado en ${history.length} evento${history.length > 1 ? 's' : ''} academico${history.length > 1 ? 's' : ''}:`, margin, cursor);
            cursor += 10;

            history.forEach((event, index) => {
                if (cursor > 240) {
                    doc.addPage();
                    cursor = margin;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`${index + 1}. ${event.eventTitle || 'Evento'}`, margin + 5, cursor);
                cursor += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                const dateStr = toDate(event.eventDate)?.toLocaleDateString('es-MX', { dateStyle: 'long' }) || '';
                doc.text(`   ${dateStr} - ${event.eventLocation || 'Campus'}`, margin + 5, cursor);
                cursor += 8;
            });

            cursor = 250;
            doc.setDrawColor(100);
            doc.line(pageWidth / 2 - 40, cursor, pageWidth / 2 + 40, cursor);
            cursor += 5;
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text('Desarrollo Academico', pageWidth / 2, cursor, { align: 'center' });
            cursor += 8;
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Emitido: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, cursor, { align: 'center' });

            doc.save(`Constancia_Eventos_${userProfile.matricula || 'SIA'}_${Date.now()}.pdf`);
        }

        return {
            getAllEventsAdmin,
            getPendingEvents,
            getHistoryEvents,
            getMyEvents,
            getActiveEvents,
            getEventById,
            streamActiveEvents,
            createEvent,
            updateEvent,
            deleteEvent,
            approveEvent,
            rejectEvent,
            registerUser,
            cancelRegistration,
            getUserTickets,
            getUserEventHistory,
            markAttendance,
            markAttendanceByEventQR,
            processStudentQr,
            markBulkAttendance,
            getEventAttendees,
            getEventsForStories,
            submitEventFeedback,
            canSubmitFeedback,
            getEventQrPayload,
            getEventResources,
            uploadCoverImage,
            uploadEventMaterial,
            buildEventCalendarIcs,
            downloadEventCalendar,
            generateAttendanceCertificate
        };
    })();
}
