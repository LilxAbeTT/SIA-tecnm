// services/quejas-service.js
// Servicio para el modulo de Quejas y Sugerencias.
// Gestiona tickets, respuestas, migracion legacy y estadisticas basicas.

if (!window.QuejasService) {
    window.QuejasService = (function () {
        const C_TICKETS = 'quejas';
        const C_RESPONSES = 'responses';
        const STATS_CACHE_TTL = 5 * 60 * 1000;
        const STATUS_OPTIONS = new Set(['pendiente', 'en-proceso', 'resuelto', 'rechazado']);

        let _statsCache = null;
        let _legacyMigrationSweepPromise = null;

        function isQuejasAdminProfile(profile = {}) {
            const role = String(profile?.role || '').toLowerCase();
            const permission = String(profile?.permissions?.quejas || '').toLowerCase();
            const email = String(profile?.email || profile?.emailInstitucional || '').toLowerCase();
            return role === 'superadmin' || (role === 'department_admin' && permission === 'admin') || email === 'calidad@loscabos.tecnm.mx';
        }

        function toDate(value) {
            if (!value) return null;
            if (value.toDate) return value.toDate();
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function toTimestamp(value) {
            const date = toDate(value);
            return date ? firebase.firestore.Timestamp.fromDate(date) : firebase.firestore.FieldValue.serverTimestamp();
        }

        function sanitizePreview(message) {
            return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 180);
        }

        function legacySummary(history) {
            const entries = Array.isArray(history) ? history : [];
            const publicEntries = entries.filter(entry => entry?.type !== 'internal');
            const internalEntries = entries.filter(entry => entry?.type === 'internal');
            const lastInternal = internalEntries[internalEntries.length - 1] || null;
            const lastPublic = publicEntries[publicEntries.length - 1] || null;

            return {
                publicResponseCount: publicEntries.length,
                internalNoteCount: internalEntries.length,
                lastInternalNotePreview: lastInternal ? sanitizePreview(lastInternal.message) : '',
                lastInternalNoteAt: lastInternal ? toDate(lastInternal.date) : null,
                lastPublicResponseAt: lastPublic ? toDate(lastPublic.date) : null
            };
        }

        function normalizeResponse(docOrData, fallbackId = null) {
            const raw = typeof docOrData?.data === 'function' ? docOrData.data() : (docOrData || {});
            return {
                id: docOrData?.id || fallbackId,
                author: raw.author || 'Sistema',
                authorId: raw.authorId || null,
                message: raw.message || '',
                role: raw.role || 'admin',
                type: raw.type || 'public',
                status: raw.status || null,
                createdAt: toDate(raw.createdAt),
                date: toDate(raw.createdAt) || toDate(raw.date)
            };
        }

        function normalizeTicket(docOrData, idOverride = null) {
            const raw = typeof docOrData?.data === 'function' ? docOrData.data() : (docOrData || {});
            const legacy = legacySummary(raw.history);

            return {
                id: docOrData?.id || idOverride || raw.id,
                ...raw,
                createdAt: toDate(raw.createdAt),
                updatedAt: toDate(raw.updatedAt),
                lastPublicResponseAt: toDate(raw.lastPublicResponseAt) || legacy.lastPublicResponseAt,
                lastInternalNoteAt: toDate(raw.lastInternalNoteAt) || legacy.lastInternalNoteAt,
                publicResponseCount: Number.isInteger(raw.publicResponseCount) ? raw.publicResponseCount : legacy.publicResponseCount,
                internalNoteCount: Number.isInteger(raw.internalNoteCount) ? raw.internalNoteCount : legacy.internalNoteCount,
                lastInternalNotePreview: typeof raw.lastInternalNotePreview === 'string' ? raw.lastInternalNotePreview : legacy.lastInternalNotePreview,
                _doc: typeof docOrData?.data === 'function' ? docOrData : null
            };
        }

        function getPublicResponseCount(data) {
            if (Number.isInteger(data?.publicResponseCount)) return data.publicResponseCount;
            return legacySummary(data?.history).publicResponseCount;
        }

        function getInternalNoteCount(data) {
            if (Number.isInteger(data?.internalNoteCount)) return data.internalNoteCount;
            return legacySummary(data?.history).internalNoteCount;
        }

        function getLastInternalNotePreview(data) {
            if (typeof data?.lastInternalNotePreview === 'string') return data.lastInternalNotePreview;
            return legacySummary(data?.history).lastInternalNotePreview;
        }

        function getSafeExtension(file) {
            const type = String(file?.type || '').toLowerCase();
            if (type.includes('png')) return 'png';
            if (type.includes('webp')) return 'webp';
            if (type.includes('gif')) return 'gif';

            const name = typeof file?.name === 'string' ? file.name : '';
            const fromName = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
            return fromName || 'jpg';
        }

        async function createTicket(ctx, data) {
            if (!ctx.user) throw new Error('Usuario no identificado');

            const ticket = {
                userId: ctx.user.uid,
                userEmail: ctx.user.email || '',
                userName: ctx.profile?.displayName || 'Estudiante',
                matricula: ctx.profile?.matricula || '',
                tipo: data.tipo,
                categoria: data.categoria,
                descripcion: data.descripcion,
                evidenciaUrl: data.evidenciaUrl || '',
                isAnonymous: !!data.isAnonymous,
                status: 'pendiente',
                publicResponseCount: 0,
                internalNoteCount: 0,
                lastPublicResponseAt: null,
                lastInternalNoteAt: null,
                lastInternalNotePreview: '',
                historyMigrationVersion: 1,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const ref = ctx.db.collection(C_TICKETS).doc();
            await ref.set(ticket);
            _statsCache = null;
            return { id: ref.id, ...ticket };
        }

        async function uploadEvidence(ctx, file) {
            if (!file) return null;
            const storage = ctx.storage || (window.SIA && window.SIA.storage);
            if (!storage) throw new Error('Storage no disponible');

            const ext = getSafeExtension(file);
            const filename = `${Date.now()}_evidence.${ext}`;
            const ref = storage.ref().child(`quejas/${ctx.user.uid}/${filename}`);
            const metadata = { contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}` };

            const snapshot = await ref.put(file, metadata);
            return await snapshot.ref.getDownloadURL();
        }

        async function getTicketsByUser(ctx, userId, options = {}) {
            let q = ctx.db.collection(C_TICKETS)
                .where('userId', '==', userId)
                .orderBy('updatedAt', 'desc');

            if (options.lastDoc) q = q.startAfter(options.lastDoc);

            const limit = options.limit || 50;
            const snap = await q.limit(limit).get();
            return snap.docs.map(doc => normalizeTicket(doc));
        }

        async function getAllTickets(ctx, filters = {}, options = {}) {
            let q = ctx.db.collection(C_TICKETS);
            if (filters.status && filters.status !== 'all') {
                q = q.where('status', '==', filters.status);
            }

            q = q.orderBy('updatedAt', 'desc');
            if (options.lastDoc) q = q.startAfter(options.lastDoc);

            const limit = options.limit || 50;
            const snap = await q.limit(limit).get();
            return snap.docs.map(doc => normalizeTicket(doc));
        }

        async function getAllTicketsForExport(ctx, filters = {}) {
            const results = [];
            let lastDoc = null;

            while (true) {
                const page = await getAllTickets(ctx, filters, { limit: 200, lastDoc });
                if (!page.length) break;

                results.push(...page);
                lastDoc = page[page.length - 1]._doc;
                if (page.length < 200) break;
            }

            return results;
        }

        async function getTicketDetail(ctx, ticketId) {
            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);
            let snap = await ref.get();
            if (!snap.exists) throw new Error('Ticket no encontrado');

            if (isQuejasAdminProfile(ctx.profile) && Array.isArray(snap.data().history) && snap.data().history.length) {
                await migrateLegacyTicket(ctx, ticketId, snap.data());
                snap = await ref.get();
            }

            const ticket = normalizeTicket(snap);
            const responseSnap = await ref.collection(C_RESPONSES).orderBy('createdAt', 'asc').get();
            let responses = responseSnap.docs.map(doc => normalizeResponse(doc));

            if (Array.isArray(snap.data().history) && snap.data().history.length) {
                const legacyResponses = snap.data().history.map((entry, index) => normalizeResponse({
                    id: `legacy-${index}`,
                    data: () => ({
                        author: entry.author,
                        authorId: entry.authorId || null,
                        message: entry.message,
                        role: entry.role,
                        type: entry.type || 'public',
                        status: entry.status || null,
                        createdAt: entry.date,
                        date: entry.date
                    })
                }, `legacy-${index}`));

                responses = responses.concat(legacyResponses);
            }

            responses.sort((a, b) => {
                const left = a.date?.getTime?.() || 0;
                const right = b.date?.getTime?.() || 0;
                return left - right;
            });

            if (!isQuejasAdminProfile(ctx.profile)) {
                responses = responses.filter(response => response.type !== 'internal');
            }

            return {
                ...ticket,
                responses
            };
        }

        async function addResponse(ctx, ticketId, message, authorName, role, type = 'public') {
            const trimmed = String(message || '').trim();
            if (!trimmed) throw new Error('Escribe una respuesta valida');

            const responseType = type === 'internal' ? 'internal' : 'public';
            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);
            const responseRef = ref.collection(C_RESPONSES).doc();

            await ctx.db.runTransaction(async tx => {
                const ticketSnap = await tx.get(ref);
                if (!ticketSnap.exists) throw new Error('Ticket no encontrado');

                const ticketData = ticketSnap.data() || {};
                const publicCount = getPublicResponseCount(ticketData);
                const internalCount = getInternalNoteCount(ticketData);

                tx.set(responseRef, {
                    author: authorName,
                    authorId: ctx.user?.uid || null,
                    message: trimmed,
                    role,
                    type: responseType,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const updateData = {
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (responseType === 'internal') {
                    updateData.internalNoteCount = internalCount + 1;
                    updateData.lastInternalNoteAt = firebase.firestore.FieldValue.serverTimestamp();
                    updateData.lastInternalNotePreview = sanitizePreview(trimmed);
                } else {
                    updateData.publicResponseCount = publicCount + 1;
                    updateData.lastPublicResponseAt = firebase.firestore.FieldValue.serverTimestamp();
                }

                tx.update(ref, updateData);
            });
        }

        async function updateStatus(ctx, ticketId, newStatus, adminNote) {
            if (!STATUS_OPTIONS.has(newStatus)) throw new Error('Estado invalido');

            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);
            const responseRef = ref.collection(C_RESPONSES).doc();

            await ctx.db.runTransaction(async tx => {
                const ticketSnap = await tx.get(ref);
                if (!ticketSnap.exists) throw new Error('Ticket no encontrado');

                const ticketData = ticketSnap.data() || {};
                if (ticketData.status === newStatus) return;

                tx.set(responseRef, {
                    author: 'Administracion',
                    authorId: ctx.user?.uid || null,
                    message: adminNote || `Estado actualizado a ${newStatus.toUpperCase()}`,
                    role: 'admin',
                    type: 'status_change',
                    status: newStatus,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                tx.update(ref, {
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    publicResponseCount: getPublicResponseCount(ticketData) + 1,
                    lastPublicResponseAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            _statsCache = null;
            return { success: true };
        }

        async function getStats(ctx, options = {}) {
            const now = Date.now();
            if (!options.force && _statsCache && (now - _statsCache.timestamp) < STATS_CACHE_TTL) {
                return _statsCache.data;
            }

            const q = await ctx.db.collection(C_TICKETS).get();
            const stats = {
                total: q.size,
                pendiente: 0,
                en_proceso: 0,
                resuelto: 0,
                rechazado: 0,
                byType: {},
                lastWeek: 0
            };

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            q.docs.forEach(doc => {
                const data = doc.data() || {};
                const key = data.status === 'en-proceso' ? 'en_proceso' : data.status;
                if (stats[key] !== undefined) stats[key]++;

                const tipo = data.tipo || 'otro';
                stats.byType[tipo] = (stats.byType[tipo] || 0) + 1;

                const createdAt = toDate(data.createdAt);
                if (createdAt && createdAt > oneWeekAgo) {
                    stats.lastWeek++;
                }
            });

            _statsCache = {
                timestamp: now,
                data: stats
            };

            return stats;
        }

        async function migrateLegacyTicket(ctx, ticketId, knownData = null) {
            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);

            await ctx.db.runTransaction(async tx => {
                const ticketSnap = await tx.get(ref);
                if (!ticketSnap.exists) return;

                const data = ticketSnap.data() || knownData || {};
                const history = Array.isArray(data.history) ? data.history : [];
                if (!history.length) return;

                history.forEach((entry, index) => {
                    const legacyRef = ref.collection(C_RESPONSES).doc(`legacy_${String(index).padStart(4, '0')}`);
                    tx.set(legacyRef, {
                        author: entry.author || 'Sistema',
                        authorId: entry.authorId || null,
                        message: entry.message || '',
                        role: entry.role || 'admin',
                        type: entry.type || 'public',
                        status: entry.status || null,
                        createdAt: toTimestamp(entry.date)
                    }, { merge: true });
                });

                const summary = legacySummary(history);
                tx.update(ref, {
                    publicResponseCount: summary.publicResponseCount,
                    internalNoteCount: summary.internalNoteCount,
                    lastInternalNotePreview: summary.lastInternalNotePreview,
                    lastPublicResponseAt: summary.lastPublicResponseAt ? firebase.firestore.Timestamp.fromDate(summary.lastPublicResponseAt) : null,
                    lastInternalNoteAt: summary.lastInternalNoteAt ? firebase.firestore.Timestamp.fromDate(summary.lastInternalNoteAt) : null,
                    historyMigrationVersion: 1,
                    history: firebase.firestore.FieldValue.delete()
                });
            });
        }

        async function migrateLegacyTickets(ctx, tickets = []) {
            if (!isQuejasAdminProfile(ctx.profile)) return;
            for (const ticket of tickets) {
                if (Array.isArray(ticket?.history) && ticket.history.length) {
                    try {
                        await migrateLegacyTicket(ctx, ticket.id, ticket);
                    } catch (error) {
                        console.warn('[QuejasService] No se pudo migrar ticket legacy:', ticket.id, error);
                    }
                }
            }
        }

        async function migrateAllLegacyTickets(ctx, options = {}) {
            if (!isQuejasAdminProfile(ctx.profile)) return;
            if (_legacyMigrationSweepPromise) return _legacyMigrationSweepPromise;

            const pageSize = options.pageSize || 100;
            const maxPages = options.maxPages || 50;

            _legacyMigrationSweepPromise = (async () => {
                let lastDoc = null;

                for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
                    let query = ctx.db.collection(C_TICKETS).orderBy('updatedAt', 'desc').limit(pageSize);
                    if (lastDoc) query = query.startAfter(lastDoc);

                    const snap = await query.get();
                    if (snap.empty) break;

                    for (const doc of snap.docs) {
                        const data = doc.data() || {};
                        if (Array.isArray(data.history) && data.history.length) {
                            try {
                                await migrateLegacyTicket(ctx, doc.id, data);
                            } catch (error) {
                                console.warn('[QuejasService] No se pudo migrar ticket legacy en barrido:', doc.id, error);
                            }
                        }
                    }

                    lastDoc = snap.docs[snap.docs.length - 1];
                    if (snap.size < pageSize) break;
                }
            })().catch(error => {
                _legacyMigrationSweepPromise = null;
                throw error;
            });

            return _legacyMigrationSweepPromise;
        }

        return {
            createTicket,
            getTicketsByUser,
            getAllTickets,
            getAllTicketsForExport,
            getTicketDetail,
            updateStatus,
            addResponse,
            getStats,
            uploadEvidence,
            migrateLegacyTickets,
            migrateAllLegacyTickets,
            isQuejasAdminProfile
        };
    })();
}
