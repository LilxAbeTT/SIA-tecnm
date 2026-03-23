// public/services/foro-chat-service.js
// Conversaciones alumno-organizador para Eventos

if (!window.ForoChatService) {
    window.ForoChatService = (function () {
        const C_CONVERSATIONS = 'foro_conversations';
        const C_MESSAGES = 'messages';

        function getUserUid(ctx, profile) {
            return ctx?.user?.uid || ctx?.auth?.currentUser?.uid || profile?.uid || ctx?.profile?.uid || null;
        }

        function buildConversationId(eventId, studentId) {
            return `${eventId}__${studentId}`;
        }

        function resolveName(profile) {
            return profile?.displayName || profile?.nombre || profile?.emailInstitucional || profile?.email || 'Usuario';
        }

        async function getOrCreateConversation(ctx, event, profile) {
            const studentId = getUserUid(ctx, profile);
            const organizerId = event?.createdBy || event?.organizerId;
            if (!studentId || !organizerId || !event?.id) {
                throw new Error('No fue posible preparar el chat del evento.');
            }

            const convId = buildConversationId(event.id, studentId);
            const ref = ctx.db.collection(C_CONVERSATIONS).doc(convId);
            const snap = await ref.get();
            if (snap.exists) {
                return { id: snap.id, ...snap.data() };
            }

            const payload = {
                eventId: event.id,
                eventTitle: event.title || event.eventTitle || 'Evento',
                studentId,
                studentName: resolveName(profile),
                organizerId,
                organizerName: event.createdByName || event.organizerName || 'Organizador',
                participants: [studentId, organizerId],
                lastMessage: '',
                unreadByStudent: 0,
                unreadByOrganizer: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await ref.set(payload, { merge: true });
            return { id: convId, ...payload };
        }

        async function sendMessage(ctx, conversationId, senderProfile, senderRole, text) {
            const cleanText = String(text || '').trim();
            if (!cleanText) throw new Error('Escribe un mensaje.');

            const convRef = ctx.db.collection(C_CONVERSATIONS).doc(conversationId);
            const msgRef = convRef.collection(C_MESSAGES).doc();
            const now = firebase.firestore.FieldValue.serverTimestamp();
            const senderId = getUserUid(ctx, senderProfile);
            const batch = ctx.db.batch();

            batch.set(msgRef, {
                text: cleanText,
                senderId,
                senderName: resolveName(senderProfile),
                senderRole,
                createdAt: now,
                read: false
            });

            batch.set(convRef, {
                lastMessage: cleanText,
                updatedAt: now,
                lastMessageAt: now,
                unreadByStudent: senderRole === 'organizer'
                    ? firebase.firestore.FieldValue.increment(1)
                    : 0,
                unreadByOrganizer: senderRole === 'student'
                    ? firebase.firestore.FieldValue.increment(1)
                    : 0
            }, { merge: true });

            await batch.commit();
            return { id: msgRef.id, text: cleanText };
        }

        async function markAsRead(ctx, conversationId, role) {
            const field = role === 'student' ? 'unreadByStudent' : 'unreadByOrganizer';
            await ctx.db.collection(C_CONVERSATIONS).doc(conversationId).update({
                [field]: 0
            });
        }

        function streamMessages(ctx, conversationId, callback) {
            return ctx.db.collection(C_CONVERSATIONS)
                .doc(conversationId)
                .collection(C_MESSAGES)
                .orderBy('createdAt', 'asc')
                .limit(80)
                .onSnapshot((snapshot) => {
                    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
                });
        }

        function streamStudentConversations(ctx, studentId, callback) {
            return ctx.db.collection(C_CONVERSATIONS)
                .where('studentId', '==', studentId)
                .orderBy('updatedAt', 'desc')
                .limit(20)
                .onSnapshot((snapshot) => {
                    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
                });
        }

        function streamEventConversations(ctx, organizerId, eventId, callback) {
            return ctx.db.collection(C_CONVERSATIONS)
                .where('organizerId', '==', organizerId)
                .where('eventId', '==', eventId)
                .orderBy('updatedAt', 'desc')
                .limit(50)
                .onSnapshot((snapshot) => {
                    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
                });
        }

        return {
            getOrCreateConversation,
            sendMessage,
            markAsRead,
            streamMessages,
            streamStudentConversations,
            streamEventConversations
        };
    })();
}
