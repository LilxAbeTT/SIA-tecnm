// public/services/comunidad-service.js
// Servicio base de Comunidad

if (!window.ComunidadService) {
    window.ComunidadService = (function () {
        const C_POSTS = 'comunidad_posts';
        const C_COMMENTS = 'comunidad_comments';
        const C_REACTIONS = 'comunidad_reactions';
        const C_REPORTS = 'comunidad_reports';
        const C_USER_STATES = 'comunidad_user_states';

        function getDb(ctx) {
            return ctx?.db || window.SIA?.db || firebase.firestore();
        }

        function getStorage(ctx) {
            return ctx?.storage || window.SIA?.storage || firebase.storage();
        }

        function getFieldValue() {
            return window.SIA?.FieldValue || firebase.firestore.FieldValue;
        }

        function getShared() {
            return window.ComunidadModule?.Shared;
        }

        function ensureComunidadAdmin(ctx) {
            if (!window.SIA?.canAdminComunidad?.(ctx?.profile || {})) {
                throw new Error('Solo admins de Comunidad pueden realizar esta acción.');
            }
        }

        function safeLimit(limit, fallback) {
            const parsed = parseInt(limit, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        }

        function sanitizeFileName(name) {
            return String(name || 'archivo')
                .replace(/[^a-z0-9._-]/gi, '_')
                .replace(/_+/g, '_')
                .slice(-90);
        }

        function normalizeText(value, max = 2000) {
            return String(value || '').trim().slice(0, max);
        }

        function normalizeBullets(values) {
            return (Array.isArray(values) ? values : [])
                .map((item) => normalizeText(item, 160))
                .filter(Boolean)
                .slice(0, 6);
        }

        function normalizeType(value) {
            const shared = getShared();
            const type = String(value || 'general').trim();
            return shared?.TYPE_CONFIG?.[type] ? type : 'general';
        }

        function normalizeScope(value) {
            const scope = String(value || 'global').trim();
            return ['global', 'career'].includes(scope) ? scope : 'global';
        }

        function getProfileCareer(profile) {
            return String(profile?.career || profile?.carrera || '').trim();
        }

        function canSeePostForProfile(post, profile, uid) {
            if (!post) return false;
            if (window.SIA?.canAdminComunidad?.(profile)) return true;
            if (post.status && post.status !== 'active') return false;
            if (post.hiddenByAdmin) return false;
            if (post.authorId === uid) return true;

            const scope = post.scope || 'global';
            if (scope === 'global') return true;
            if (scope === 'career') {
                const career = getProfileCareer(profile);
                const targets = Array.isArray(post.careerTargets) ? post.careerTargets : [];
                return !!career && targets.includes(career);
            }
            return false;
        }

        async function uploadPostMedia(ctx, files, uid) {
            const storage = getStorage(ctx);
            if (!storage?.ref) throw new Error('Firebase Storage no está disponible.');

            const selected = Array.from(files || [])
                .filter((file) => file && /^image\//i.test(file.type || ''))
                .slice(0, 3);

            const uploads = [];
            for (let index = 0; index < selected.length; index += 1) {
                const file = selected[index];
                const ref = storage.ref().child(`users/${uid}/comunidad/posts/${Date.now()}_${index}_${sanitizeFileName(file.name)}`);
                const snapshot = await ref.put(file, { contentType: file.type || 'image/jpeg' });
                const url = await snapshot.ref.getDownloadURL();
                uploads.push({
                    url,
                    type: 'image',
                    name: file.name || `imagen_${index + 1}`
                });
            }

            return uploads;
        }

        function mapDocs(snapshot) {
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }

        function sortPosts(posts) {
            return [...posts].sort((a, b) => {
                if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
                const ad = getShared()?.toDate(a.lastActivityAt || a.createdAt)?.getTime?.() || 0;
                const bd = getShared()?.toDate(b.lastActivityAt || b.createdAt)?.getTime?.() || 0;
                return bd - ad;
            });
        }

        function streamFeed(ctx, options = {}, onData, onError) {
            const db = getDb(ctx);
            const shared = getShared();
            const limit = safeLimit(options.limit, 40);
            const uid = shared?.getUserUid(ctx, ctx?.profile) || null;

            return db.collection(C_POSTS)
                .orderBy('lastActivityAt', 'desc')
                .limit(limit)
                .onSnapshot((snapshot) => {
                    const posts = sortPosts(mapDocs(snapshot).filter((post) => canSeePostForProfile(post, ctx?.profile || {}, uid)));
                    onData(posts);
                }, onError);
        }

        async function createPost(ctx, payload = {}) {
            const db = getDb(ctx);
            const shared = getShared();
            const FieldValue = getFieldValue();
            const profile = ctx?.profile || {};
            const uid = shared?.getUserUid(ctx, profile);
            if (!uid) throw new Error('No fue posible identificar al usuario.');

            const type = normalizeType(payload.type);
            const scope = normalizeScope(payload.scope);
            const contentMode = payload.contentMode === 'bullets' ? 'bullets' : 'plain';
            const title = normalizeText(payload.title, 120);
            const text = normalizeText(payload.text, 2400);
            const bullets = normalizeBullets(payload.bullets);
            const media = await uploadPostMedia(ctx, payload.files, uid);

            if (!text && !bullets.length && !media.length) {
                throw new Error('Escribe algo o agrega una imagen antes de publicar.');
            }

            const author = shared.buildAuthorSnapshot(ctx, profile);
            const career = getProfileCareer(profile);
            if (scope === 'career' && !career) {
                throw new Error('Tu perfil no tiene una carrera asignada. Usa alcance global.');
            }
            const doc = {
                ...author,
                type,
                contentMode,
                title,
                text,
                bullets,
                scope,
                careerTargets: scope === 'career' && career ? [career] : [],
                groupId: '',
                media,
                tags: [],
                status: 'active',
                commentsEnabled: true,
                pinned: false,
                hiddenByAdmin: false,
                hiddenReason: '',
                reportCount: 0,
                reactionCount: 0,
                commentCount: 0,
                lastActivityAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };

            const ref = await db.collection(C_POSTS).add(doc);
            return ref.id;
        }

        async function updatePost(ctx, postId, payload = {}) {
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const ref = db.collection(C_POSTS).doc(postId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('La publicación no existe.');

            const current = snap.data() || {};
            const uid = getShared()?.getUserUid(ctx, ctx?.profile);
            if (current.authorId !== uid) throw new Error('Solo puedes editar tus propias publicaciones.');

            const scope = normalizeScope(payload.scope || current.scope);
            const career = getProfileCareer(ctx?.profile || {});
            if (scope === 'career' && !career) {
                throw new Error('Tu perfil no tiene una carrera asignada. Usa alcance global.');
            }
            const contentMode = payload.contentMode === 'bullets' ? 'bullets' : 'plain';
            const next = {
                title: normalizeText(payload.title, 120),
                text: normalizeText(payload.text, 2400),
                bullets: normalizeBullets(payload.bullets),
                type: normalizeType(payload.type || current.type),
                scope,
                careerTargets: scope === 'career' && career ? [career] : [],
                contentMode,
                updatedAt: FieldValue.serverTimestamp()
            };

            if (!next.text && !next.bullets.length && !(Array.isArray(current.media) && current.media.length)) {
                throw new Error('La publicación no puede quedar vacía.');
            }

            await ref.update(next);
            return true;
        }

        async function deletePost(ctx, postId) {
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const ref = db.collection(C_POSTS).doc(postId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('La publicación no existe.');
            const uid = getShared()?.getUserUid(ctx, ctx?.profile);
            if (snap.data()?.authorId !== uid) throw new Error('Solo puedes eliminar tus publicaciones.');
            await ref.update({
                status: 'deleted',
                updatedAt: FieldValue.serverTimestamp()
            });
            return true;
        }

        function streamComments(ctx, postId, onData, onError) {
            const db = getDb(ctx);
            const shared = getShared();
            return db.collection(C_COMMENTS)
                .where('postId', '==', postId)
                .limit(200)
                .onSnapshot((snapshot) => {
                    const comments = mapDocs(snapshot).sort((a, b) => {
                        const ad = shared?.toDate(a.createdAt)?.getTime?.() || 0;
                        const bd = shared?.toDate(b.createdAt)?.getTime?.() || 0;
                        return ad - bd;
                    });
                    onData(comments);
                }, onError);
        }

        async function createComment(ctx, payload = {}) {
            const db = getDb(ctx);
            const shared = getShared();
            const FieldValue = getFieldValue();
            const profile = ctx?.profile || {};
            const uid = shared?.getUserUid(ctx, profile);
            const text = normalizeText(payload.text, 800);

            if (!uid) throw new Error('No fue posible identificar al usuario.');
            if (!text) throw new Error('Escribe un comentario antes de enviar.');

            const postRef = db.collection(C_POSTS).doc(payload.postId);
            const commentRef = db.collection(C_COMMENTS).doc();
            const parentCommentId = payload.parentCommentId || null;
            const parentRef = parentCommentId ? db.collection(C_COMMENTS).doc(parentCommentId) : null;
            const author = shared.buildAuthorSnapshot(ctx, profile);

            await db.runTransaction(async (trx) => {
                const reads = [trx.get(postRef)];
                if (parentRef) reads.push(trx.get(parentRef));
                const [postSnap, parentSnap] = await Promise.all(reads);
                if (!postSnap.exists) throw new Error('La publicación ya no existe.');
                const post = postSnap.data() || {};
                if (post.status !== 'active') throw new Error('La publicación ya no admite comentarios.');
                if (post.commentsEnabled === false) throw new Error('Los comentarios están cerrados en esta publicación.');

                if (parentCommentId) {
                    if (!parentSnap?.exists) throw new Error('El comentario al que intentas responder ya no existe.');
                    const parent = parentSnap.data() || {};
                    if (parent.postId !== payload.postId) throw new Error('No fue posible vincular la respuesta a esta publicación.');
                    trx.update(parentRef, {
                        replyCount: (Number(parent.replyCount) || 0) + 1,
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }

                trx.set(commentRef, {
                    postId: payload.postId,
                    authorId: author.authorId,
                    authorName: author.authorName,
                    authorPhotoURL: author.authorPhotoURL,
                    authorRoleKind: author.authorRoleKind,
                    authorCareer: author.authorCareer,
                    authorArea: author.authorArea,
                    text,
                    parentCommentId,
                    replyCount: 0,
                    reactionCount: 0,
                    status: 'active',
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                trx.update(postRef, {
                    commentCount: (Number(post.commentCount) || 0) + 1,
                    lastActivityAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });
            });

            return commentRef.id;
        }

        async function toggleReaction(ctx, targetType, targetId) {
            const db = getDb(ctx);
            const shared = getShared();
            const FieldValue = getFieldValue();
            const uid = shared?.getUserUid(ctx, ctx?.profile);
            if (!uid) throw new Error('No fue posible identificar al usuario.');

            const safeTargetType = targetType === 'comment' ? 'comment' : 'post';
            const targetCollection = safeTargetType === 'comment' ? C_COMMENTS : C_POSTS;
            const targetRef = db.collection(targetCollection).doc(targetId);
            const reactionRef = db.collection(C_REACTIONS).doc(`${safeTargetType}_${targetId}_${uid}`);

            let result = { active: false, count: 0 };

            await db.runTransaction(async (trx) => {
                const [targetSnap, reactionSnap] = await Promise.all([
                    trx.get(targetRef),
                    trx.get(reactionRef)
                ]);

                if (!targetSnap.exists) throw new Error('El elemento al que intentas reaccionar ya no existe.');

                const target = targetSnap.data() || {};
                const currentCount = Number(target.reactionCount) || 0;

                if (reactionSnap.exists) {
                    trx.delete(reactionRef);
                    trx.update(targetRef, {
                        reactionCount: Math.max(0, currentCount - 1),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                    result = { active: false, count: Math.max(0, currentCount - 1) };
                    return;
                }

                trx.set(reactionRef, {
                    targetType: safeTargetType,
                    targetId,
                    userId: uid,
                    reaction: 'like',
                    createdAt: FieldValue.serverTimestamp()
                });

                trx.update(targetRef, {
                    reactionCount: currentCount + 1,
                    updatedAt: FieldValue.serverTimestamp()
                });

                result = { active: true, count: currentCount + 1 };
            });

            return result;
        }

        async function loadUserPostReactions(ctx, postIds = []) {
            const db = getDb(ctx);
            const shared = getShared();
            const uid = shared?.getUserUid(ctx, ctx?.profile);
            if (!uid) return {};

            const wanted = new Set((Array.isArray(postIds) ? postIds : []).filter(Boolean));
            if (!wanted.size) return {};

            const snap = await db.collection(C_REACTIONS)
                .where('userId', '==', uid)
                .limit(200)
                .get();

            return snap.docs.reduce((acc, doc) => {
                const data = doc.data() || {};
                if (data.targetType === 'post' && wanted.has(data.targetId)) acc[data.targetId] = true;
                return acc;
            }, {});
        }

        async function reportContent(ctx, targetType, targetId, reason, details = '') {
            const db = getDb(ctx);
            const shared = getShared();
            const FieldValue = getFieldValue();
            const uid = shared?.getUserUid(ctx, ctx?.profile);
            if (!uid) throw new Error('No fue posible identificar al usuario.');

            const safeTargetType = targetType === 'comment' ? 'comment' : 'post';
            const reportRef = db.collection(C_REPORTS).doc(`${safeTargetType}_${targetId}_${uid}`);
            const payload = {
                targetType: safeTargetType,
                targetId,
                reason: normalizeText(reason, 80) || 'otro',
                details: normalizeText(details, 300),
                reportedBy: uid,
                updatedAt: FieldValue.serverTimestamp()
            };

            await reportRef.set(payload, { merge: true });
            return true;
        }

        function streamAdminReports(ctx, options = {}, onData, onError) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const limit = safeLimit(options.limit, 40);
            return db.collection(C_REPORTS)
                .orderBy('updatedAt', 'desc')
                .limit(limit)
                .onSnapshot((snapshot) => onData(mapDocs(snapshot)), onError);
        }

        function streamAdminPosts(ctx, options = {}, onData, onError) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const limit = safeLimit(options.limit, 60);
            const orderField = options.orderBy === 'createdAt' ? 'createdAt' : 'updatedAt';
            return db.collection(C_POSTS)
                .orderBy(orderField, 'desc')
                .limit(limit)
                .onSnapshot((snapshot) => onData(mapDocs(snapshot)), onError);
        }

        function streamAdminUserStates(ctx, options = {}, onData, onError) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const limit = safeLimit(options.limit, 40);
            return db.collection(C_USER_STATES)
                .orderBy('updatedAt', 'desc')
                .limit(limit)
                .onSnapshot((snapshot) => onData(mapDocs(snapshot)), onError);
        }

        async function updateReportStatus(ctx, reportId, payload = {}) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const shared = getShared();
            const uid = shared?.getUserUid(ctx, ctx?.profile);
            const profile = ctx?.profile || {};
            const status = ['open', 'in_review', 'resolved', 'dismissed'].includes(payload.status) ? payload.status : 'open';
            const note = normalizeText(payload.note, 400);
            await db.collection(C_REPORTS).doc(reportId).set({
                status,
                moderatorNote: note,
                reviewedAt: FieldValue.serverTimestamp(),
                reviewedBy: uid,
                reviewedByName: profile?.displayName || profile?.nombre || 'Admin Comunidad',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        }

        async function moderatePost(ctx, postId, payload = {}) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const ref = db.collection(C_POSTS).doc(postId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('La publicación no existe.');

            const next = { updatedAt: FieldValue.serverTimestamp() };
            if (typeof payload.hiddenByAdmin === 'boolean') {
                next.hiddenByAdmin = payload.hiddenByAdmin;
                next.hiddenReason = payload.hiddenByAdmin ? normalizeText(payload.hiddenReason, 240) : '';
            }
            if (typeof payload.commentsEnabled === 'boolean') next.commentsEnabled = payload.commentsEnabled;
            if (typeof payload.pinned === 'boolean') next.pinned = payload.pinned;
            if (typeof payload.status === 'string' && ['active', 'archived', 'deleted'].includes(payload.status)) next.status = payload.status;
            await ref.update(next);
            return true;
        }

        async function setUserState(ctx, uid, payload = {}) {
            ensureComunidadAdmin(ctx);
            const db = getDb(ctx);
            const FieldValue = getFieldValue();
            const shared = getShared();
            const profile = ctx?.profile || {};
            const status = ['active', 'muted', 'blocked'].includes(payload.status) ? payload.status : 'active';
            const ref = db.collection(C_USER_STATES).doc(uid);
            const snap = await ref.get();

            await ref.set({
                uid,
                status,
                reason: normalizeText(payload.reason, 240),
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: shared?.getUserUid(ctx, profile) || '',
                updatedByName: profile?.displayName || profile?.nombre || 'Admin Comunidad',
                createdAt: snap.exists ? (snap.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp()
            }, { merge: true });

            return true;
        }

        return {
            streamFeed,
            createPost,
            updatePost,
            deletePost,
            streamComments,
            createComment,
            toggleReaction,
            loadUserPostReactions,
            reportContent,
            streamAdminReports,
            streamAdminPosts,
            streamAdminUserStates,
            updateReportStatus,
            moderatePost,
            setUserState
        };
    })();
}
