// services/quejas-service.js
// Servicio para el Módulo de Quejas y Sugerencias
// Gestiona tickets, respuestas y estadísticas.

if (!window.QuejasService) {
    window.QuejasService = (function () {
        const C_TICKETS = 'quejas'; // Match firestore.rules

        // --- ESTADOS ---
        // ... (comments)

        // --- FUNCIONES PRINCIPALES ---

        async function createTicket(ctx, data) {
            if (!ctx.user) throw new Error("Usuario no identificado");

            const ticket = {
                userId: ctx.user.uid,
                userEmail: ctx.user.email,
                userName: ctx.profile.displayName || 'Estudiante',
                matricula: ctx.profile.matricula || '',

                tipo: data.tipo,
                categoria: data.categoria,
                descripcion: data.descripcion,
                evidenciaUrl: data.evidenciaUrl || '',
                isAnonymous: data.isAnonymous || false,

                status: 'pendiente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                history: []
            };

            const ref = await ctx.db.collection(C_TICKETS).add(ticket);
            return { id: ref.id, ...ticket };
        }

        async function uploadEvidence(ctx, file) {
            if (!file) return null;
            const storage = ctx.storage || (window.SIA && window.SIA.storage);
            if (!storage) throw new Error("Storage no disponible");

            // Path: quejas/{userId}/{timestamp}_{filename}
            const ext = file.name.split('.').pop();
            const filename = `${Date.now()}_evidence.${ext}`;
            const ref = storage.ref().child(`quejas/${ctx.user.uid}/${filename}`);

            const snapshot = await ref.put(file);
            return await snapshot.ref.getDownloadURL();
        }

        async function getTicketsByUser(ctx, userId) {
            const q = await ctx.db.collection(C_TICKETS)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                updatedAt: d.data().updatedAt?.toDate()
            }));
        }

        async function getAllTickets(ctx, filters = {}) {
            let chain = ctx.db.collection(C_TICKETS);

            if (filters.status && filters.status !== 'all') {
                chain = chain.where('status', '==', filters.status);
            }

            // Client-side sort if needed or verify implicit ordering
            chain = chain.orderBy('createdAt', 'desc');

            const q = await chain.get();
            return q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                updatedAt: d.data().updatedAt?.toDate()
            }));
        }

        async function updateStatus(ctx, ticketId, newStatus, adminNote) {
            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);

            const updateData = {
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (adminNote) {
                updateData.history = firebase.firestore.FieldValue.arrayUnion({
                    author: 'Administración',
                    message: adminNote,
                    role: 'admin',
                    date: new Date().toISOString()
                });
            }

            await ref.update(updateData);
            return { success: true };
        }

        async function addResponse(ctx, ticketId, message, authorName, role, type = 'public') {
            const ref = ctx.db.collection(C_TICKETS).doc(ticketId);

            await ref.update({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                history: firebase.firestore.FieldValue.arrayUnion({
                    author: authorName,
                    message: message,
                    role: role,
                    type: type, // 'public' or 'internal'
                    date: new Date().toISOString()
                })
            });
            return { success: true };
        }

        async function getStats(ctx) {
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

            const now = new Date();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            q.docs.forEach(d => {
                const data = d.data();
                const st = data.status === 'en-proceso' ? 'en_proceso' : data.status;
                if (stats[st] !== undefined) stats[st]++;

                const tipo = data.tipo || 'otro';
                stats.byType[tipo] = (stats.byType[tipo] || 0) + 1;

                if (data.createdAt && data.createdAt.toDate() > oneWeekAgo) {
                    stats.lastWeek++;
                }
            });

            return stats;
        }

        return {
            createTicket,
            getTicketsByUser,
            getAllTickets,
            updateStatus,
            addResponse,
            getStats,
            uploadEvidence
        };

    })();
}
