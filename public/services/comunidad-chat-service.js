// public/services/comunidad-chat-service.js
// Mensajeria privada para Comunidad

if (!window.ComunidadChatService) {
    window.ComunidadChatService = (function () {
        const C_CONVERSATIONS = 'comunidad_conversations';
        const C_MESSAGES = 'messages';
        const C_USER_STATES = 'comunidad_user_states';

        function getDb(ctx) {
            return ctx?.db || window.SIA?.db || firebase.firestore();
        }

        function getFieldValue() {
            return window.SIA?.FieldValue || firebase.firestore.FieldValue;
        }

        function getShared() {
            return window.ComunidadModule?.Shared;
        }

        function safeLimit(limit, fallback) {
            const parsed = parseInt(limit, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        }

        function normalizeText(value, max = 1200) {
            return String(value || '').trim().slice(0, max);
        }

        function getUserUid(ctx, profile) {
            const shared = getShared();
            return shared?.getUserUid(ctx, profile || ctx?.profile || {}) || null;
        }

        function buildConversationId(uidA, uidB) {
            return [String(uidA || '').trim(), String(uidB || '').trim()]
                .filter(Boolean)
                .sort()
                .join('__');
        }

        function sanitizeParticipantProfile(input = {}, fallbackUid = '') {
            const shared = getShared();
            const identity = shared?.determineIdentity?.(input) || { kind: 'student', label: 'Alumno' };
            return {
                uid: String(input.uid || input.authorId || fallbackUid || '').trim(),
                name: String(input.displayName || input.nombre || input.authorName || 'Usuario').trim() || 'Usuario',
                photoURL: String(input.photoURL || input.authorPhotoURL || '').trim(),
                roleKind: String(input.authorRoleKind || identity.kind || 'student').trim() || 'student',
                roleLabel: String(input.authorRoleLabel || identity.label || '').trim(),
                career: String(shared?.getCareerLabel?.(input) || input.authorCareer || '').trim(),
                area: String(shared?.getAreaLabel?.(input) || input.authorArea || '').trim()
            };
        }

        async function ensureCanMessage(ctx, uid) {
            if (!uid) throw new Error('No fue posible identificar al usuario.');
            const db = getDb(ctx);
            const snap = await db.collection(C_USER_STATES).doc(uid).get();
            if (!snap.exists) return true;

            const status = String(snap.data()?.status || 'active').trim();
            if (status === 'blocked') throw new Error('Tu acceso a Comunidad esta bloqueado.');
            if (status === 'muted') throw new Error('Tu cuenta esta silenciada en Comunidad.');
            return true;
        }

        function getConversationPeer(conversation, currentUid) {
            const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
            const peerId = participants.find((uid) => uid && uid !== currentUid) || '';
            const peerMap = conversation?.participantProfiles || {};
            const peer = peerMap?.[peerId] || {};
            return sanitizeParticipantProfile({
                uid: peerId,
                displayName: peer.name,
                photoURL: peer.photoURL,
                authorRoleKind: peer.roleKind,
                authorRoleLabel: peer.roleLabel,
                authorCareer: peer.career,
                authorArea: peer.area
            }, peerId);
        }

        async function getOrCreateConversation(ctx, otherProfile = {}) {
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const currentUid = getUserUid(ctx, ctx?.profile);
            const otherUid = String(otherProfile.uid || otherProfile.authorId || '').trim();

            if (!currentUid || !otherUid) throw new Error('No fue posible preparar la conversacion privada.');
            if (currentUid === otherUid) throw new Error('No puedes iniciar una conversacion contigo.');

            await ensureCanMessage(ctx, currentUid);

            const conversationId = buildConversationId(currentUid, otherUid);
            const ref = db.collection(C_CONVERSATIONS).doc(conversationId);
            const me = sanitizeParticipantProfile({ ...(ctx?.profile || {}), uid: currentUid }, currentUid);
            const peer = sanitizeParticipantProfile(otherProfile, otherUid);

            const payload = {
                participants: [currentUid, otherUid],
                participantNames: [me.name, peer.name],
                participantProfiles: {
                    [currentUid]: me,
                    [otherUid]: peer
                },
                lastMessage: '',
                lastMessageAt: null,
                lastSenderId: '',
                unreadBy: {
                    [currentUid]: 0,
                    [otherUid]: 0
                },
                status: 'active',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };

            try {
                await ref.update({
                    participantNames: payload.participantNames,
                    participantProfiles: payload.participantProfiles
                });
                const synced = await ref.get();
                return { id: synced.id, ...(synced.data() || {}), participantProfiles: payload.participantProfiles };
            } catch (error) {
                if (error?.code !== 'not-found') throw error;
            }

            await ref.set(payload);
            return { id: conversationId, ...payload };
        }

        function streamConversations(ctx, options = {}, onData, onError) {
            const db = getDb(ctx);
            const uid = getUserUid(ctx, ctx?.profile);
            const limit = safeLimit(options.limit, 30);
            if (!uid) return () => { };

            return db.collection(C_CONVERSATIONS)
                .where('participants', 'array-contains', uid)
                .orderBy('updatedAt', 'desc')
                .limit(limit)
                .onSnapshot((snapshot) => {
                    const conversations = snapshot.docs
                        .map((doc) => ({ id: doc.id, ...doc.data() }))
                        .filter((item) => String(item.status || 'active') !== 'deleted');
                    onData(conversations);
                }, onError);
        }

        function streamMessages(ctx, conversationId, onData, onError) {
            const db = getDb(ctx);
            if (!conversationId) return () => { };
            return db.collection(C_CONVERSATIONS)
                .doc(conversationId)
                .collection(C_MESSAGES)
                .orderBy('createdAt', 'asc')
                .limit(150)
                .onSnapshot((snapshot) => {
                    onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
                }, onError);
        }

        async function sendMessage(ctx, conversationId, text) {
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const cleanText = normalizeText(text, 1600);
            const currentUid = getUserUid(ctx, ctx?.profile);
            if (!cleanText) throw new Error('Escribe un mensaje antes de enviarlo.');

            await ensureCanMessage(ctx, currentUid);

            const conversationRef = db.collection(C_CONVERSATIONS).doc(conversationId);
            const messageRef = conversationRef.collection(C_MESSAGES).doc();
            let recipientUid = '';
            let senderProfile = null;

            await db.runTransaction(async (trx) => {
                const conversationSnap = await trx.get(conversationRef);
                if (!conversationSnap.exists) throw new Error('La conversacion ya no esta disponible.');

                const conversation = conversationSnap.data() || {};
                const participants = Array.isArray(conversation.participants) ? conversation.participants.filter(Boolean) : [];
                if (!participants.includes(currentUid)) throw new Error('No tienes acceso a esta conversacion.');
                if (String(conversation.status || 'active') !== 'active') throw new Error('La conversacion no admite mas mensajes.');

                recipientUid = participants.find((uid) => uid !== currentUid) || '';
                senderProfile = sanitizeParticipantProfile({ ...(ctx?.profile || {}), uid: currentUid }, currentUid);

                const unreadBy = { ...(conversation.unreadBy || {}) };
                participants.forEach((uid) => { unreadBy[uid] = Number(unreadBy[uid]) || 0; });
                unreadBy[currentUid] = 0;
                if (recipientUid) unreadBy[recipientUid] = (Number(unreadBy[recipientUid]) || 0) + 1;

                trx.set(messageRef, {
                    senderId: currentUid,
                    senderName: senderProfile.name,
                    senderPhotoURL: senderProfile.photoURL,
                    senderRoleKind: senderProfile.roleKind,
                    text: cleanText,
                    status: 'active',
                    createdAt: FieldValue.serverTimestamp()
                });

                trx.set(conversationRef, {
                    lastMessage: cleanText,
                    lastMessageAt: FieldValue.serverTimestamp(),
                    lastSenderId: currentUid,
                    unreadBy,
                    participantProfiles: {
                        ...(conversation.participantProfiles || {}),
                        [currentUid]: senderProfile
                    },
                    updatedAt: FieldValue.serverTimestamp()
                }, { merge: true });
            });

            if (recipientUid && recipientUid !== currentUid && window.Notify?.send) {
                const preview = cleanText.length > 110 ? `${cleanText.slice(0, 107).trim()}...` : cleanText;
                window.Notify.send(recipientUid, {
                    titulo: `${senderProfile?.name || 'Alguien'} te escribio`,
                    mensaje: preview,
                    tipo: 'info',
                    link: `/comunidad?tab=mensajes&conversation=${encodeURIComponent(conversationId)}`
                }).catch?.(() => null);
            }

            return { id: messageRef.id, text: cleanText };
        }

        async function markAsRead(ctx, conversationId) {
            const db = getDb(ctx);
            const currentUid = getUserUid(ctx, ctx?.profile);
            if (!conversationId || !currentUid) return false;

            const ref = db.collection(C_CONVERSATIONS).doc(conversationId);
            const snap = await ref.get();
            if (!snap.exists) return false;

            const data = snap.data() || {};
            const participants = Array.isArray(data.participants) ? data.participants : [];
            if (!participants.includes(currentUid)) throw new Error('No tienes acceso a esta conversacion.');

            const unreadBy = { ...(data.unreadBy || {}) };
            if ((Number(unreadBy[currentUid]) || 0) === 0) return true;
            unreadBy[currentUid] = 0;
            await ref.set({ unreadBy }, { merge: true });
            return true;
        }

        return {
            buildConversationId,
            getConversationPeer,
            getOrCreateConversation,
            streamConversations,
            streamMessages,
            sendMessage,
            markAsRead
        };
    })();
}
