// services/encuestas-service.js
// Servicio para el Centro de Encuestas institucionales y públicas.

if (!window.EncuestasService) {
    window.EncuestasService = (function () {
        const C_SURVEYS = 'encuestas';
        const C_RESPONSES = 'encuestas-respuestas';
        const MAX_SURVEYS = 120;
        const MAX_RESPONSES = 300;

        const ROLE_AUDIENCE_MAP = {
            student: 'estudiantes',
            docente: 'docentes',
            personal: 'operativos',
            department_admin: 'administrativos'
        };

        function toDate(value) {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value.toDate === 'function') return value.toDate();
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function getAudienceFromProfile(profile = {}) {
            return ROLE_AUDIENCE_MAP[profile.role] || 'estudiantes';
        }

        function isSurveyAdmin(profile = {}) {
            return profile?.role === 'superadmin'
                || profile?.permissions?.encuestas === 'admin'
                || profile?.email === 'calidad@loscabos.tecnm.mx';
        }

        function normalizeAudience(audience, isPublic) {
            if (isPublic) return ['todos'];
            const base = Array.isArray(audience) ? audience.filter(Boolean) : [];
            return base.length ? [...new Set(base)] : ['estudiantes'];
        }

        function questionUsesOptions(type) {
            return ['multiple', 'checkboxes', 'select'].includes(type);
        }

        function normalizeQuestions(questions = []) {
            return (questions || []).map((question, index) => {
                const q = {
                    id: question.id || `q${index}`,
                    type: question.type || 'open',
                    text: question.text || `Pregunta ${index + 1}`,
                    required: question.required !== false
                };

                if (questionUsesOptions(q.type)) {
                    q.options = (question.options || []).filter(Boolean);
                }

                if (q.type === 'scale') {
                    q.min = Number.isFinite(Number(question.min)) ? Number(question.min) : 1;
                    q.max = Number.isFinite(Number(question.max)) ? Number(question.max) : 10;
                }

                return q;
            });
        }

        function normalizeDelivery(data = {}) {
            const mandatoryMode = data.mandatoryMode || (data.blocking ? 'blocking' : (data.isMandatory ? 'required' : 'optional'));
            return {
                mandatoryMode,
                blocking: mandatoryMode === 'blocking',
                showInStories: data.showInStories !== false,
                spotlight: data.spotlight !== false,
                launchToken: data.launchToken || null,
                launchAt: toDate(data.launchAt)
            };
        }

        function normalizeScheduling(data = {}) {
            return {
                type: data.type || 'manual',
                startDate: data.startDate ? toDate(data.startDate) : null,
                endDate: data.endDate ? toDate(data.endDate) : null
            };
        }

        function getRuntimeStatus(survey, now = new Date()) {
            const storedStatus = survey.status || 'draft';
            if (storedStatus === 'archived' || storedStatus === 'draft' || storedStatus === 'paused' || storedStatus === 'closed') {
                return storedStatus;
            }

            const scheduling = survey.scheduling || {};
            const start = toDate(scheduling.startDate);
            const end = toDate(scheduling.endDate);

            if (scheduling.type === 'timed') {
                if (start && now < start) return 'scheduled';
                if (end && now > end) return 'closed';
            }

            return 'active';
        }

        function isSurveyAvailable(survey, now = new Date()) {
            return getRuntimeStatus(survey, now) === 'active';
        }

        function isSurveyVisibleToAudience(survey, audience) {
            if (survey.isPublic) return true;
            if (!audience) return true;
            const targets = survey.audience || [];
            return targets.includes('todos') || targets.includes(audience);
        }

        function normalizeSurvey(snapshotOrData, fallbackId = '') {
            const raw = typeof snapshotOrData.data === 'function' ? snapshotOrData.data() : snapshotOrData;
            const id = snapshotOrData.id || fallbackId;
            const scheduling = normalizeScheduling(raw.scheduling || {});
            const delivery = normalizeDelivery(raw.delivery || {
                mandatoryMode: raw.blocking ? 'blocking' : (raw.isMandatory ? 'required' : 'optional'),
                showInStories: raw.showInStories !== false,
                spotlight: raw.spotlight !== false
            });
            const createdAt = toDate(raw.createdAt);
            const updatedAt = toDate(raw.updatedAt);
            const archivedAt = toDate(raw.archivedAt);

            return {
                id,
                ...raw,
                questions: normalizeQuestions(raw.questions || []),
                audience: normalizeAudience(raw.audience, raw.isPublic),
                scheduling,
                delivery,
                isMandatory: delivery.mandatoryMode !== 'optional',
                blocking: delivery.blocking,
                createdAt,
                updatedAt,
                archivedAt,
                runtimeStatus: getRuntimeStatus({ ...raw, scheduling, delivery }, new Date()),
                analytics: {
                    totalResponses: raw.analytics?.totalResponses || raw.responseCount || 0,
                    uniqueRespondents: raw.analytics?.uniqueRespondents || raw.responseCount || 0,
                    responseSources: raw.analytics?.responseSources || {},
                    lastResponseAt: toDate(raw.analytics?.lastResponseAt)
                }
            };
        }

        function buildResponseDocId(surveyId, uid) {
            return `${surveyId}__${uid}`;
        }

        async function fetchSurveySnapshot(ctxOrDb, id) {
            const db = ctxOrDb.db || ctxOrDb;
            return db.collection(C_SURVEYS).doc(id).get();
        }

        async function fetchCurrentUserResponses(ctx, surveyIds = []) {
            if (!ctx?.user) return {};

            const ids = new Set(surveyIds || []);
            const map = {};
            const readResponsesByUser = async () => {
                const snapshot = await ctx.db.collection(C_RESPONSES)
                    .where('userId', '==', ctx.user.uid)
                    .get();

                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    if (!data?.surveyId) return;
                    if (ids.size && !ids.has(data.surveyId)) return;
                    map[data.surveyId] = {
                        id: doc.id,
                        ...data,
                        submittedAt: toDate(data.submittedAt)
                    };
                });
            };

            // Cuando ya conocemos los surveyIds, usamos los IDs deterministas
            // de respuesta para evitar depender de indices compuestos.
            if (ids.size) {
                try {
                    const docs = await Promise.all(
                        [...ids].map((surveyId) => ctx.db.collection(C_RESPONSES).doc(buildResponseDocId(surveyId, ctx.user.uid)).get())
                    );

                    docs.forEach((doc) => {
                        if (!doc.exists) return;
                        const data = doc.data();
                        map[data.surveyId] = {
                            id: doc.id,
                            ...data,
                            submittedAt: toDate(data.submittedAt)
                        };
                    });
                    return map;
                } catch (error) {
                    // Fallback para reglas antiguas donde el get directo de un doc
                    // inexistente del usuario responde permission-denied.
                    if (error?.code !== 'permission-denied') throw error;
                    await readResponsesByUser();
                    return map;
                }
            }

            await readResponsesByUser();
            return map;
        }

        async function fetchCurrentUserLaunchSeen(ctx, surveyIds = []) {
            if (!ctx?.user) return {};

            const ids = new Set(surveyIds || []);
            const snapshot = await ctx.db.collection('usuarios')
                .doc(ctx.user.uid)
                .collection('surveyLaunchSeen')
                .get();

            const map = {};
            snapshot.docs.forEach((doc) => {
                if (ids.size && !ids.has(doc.id)) return;
                map[doc.id] = doc.data()?.launchToken || null;
            });
            return map;
        }

        async function createSurvey(ctx, data) {
            if (!ctx?.user) throw new Error('Usuario no identificado');

            const questions = normalizeQuestions(data.questions || []);
            const isPublic = !!data.isPublic;
            const delivery = normalizeDelivery({
                mandatoryMode: data.delivery?.mandatoryMode,
                blocking: data.delivery?.blocking,
                showInStories: data.delivery?.showInStories,
                spotlight: data.delivery?.spotlight,
                launchToken: data.delivery?.launchToken,
                launchAt: data.delivery?.launchAt,
                isMandatory: data.isMandatory
            });
            const survey = {
                title: data.title || 'Sin titulo',
                description: data.description || '',
                questions,
                audience: normalizeAudience(data.audience, isPublic),
                isPublic,
                status: data.status || 'draft',
                scheduling: normalizeScheduling(data.scheduling || {}),
                delivery,
                isMandatory: delivery.mandatoryMode !== 'optional',
                blocking: delivery.blocking,
                createdBy: ctx.user.uid,
                createdByName: ctx.profile?.displayName || ctx.profile?.name || 'Administrador',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                archivedAt: null,
                responseCount: 0,
                analytics: {
                    totalResponses: 0,
                    uniqueRespondents: 0,
                    responseSources: {},
                    lastResponseAt: null
                }
            };

            const ref = await ctx.db.collection(C_SURVEYS).add(survey);
            return { id: ref.id, ...survey };
        }

        async function updateSurvey(ctx, id, data) {
            const ref = ctx.db.collection(C_SURVEYS).doc(id);
            const current = await ref.get();
            if (!current.exists) throw new Error('Encuesta no encontrada');

            const base = current.data();
            const nextIsPublic = data.isPublic !== undefined ? !!data.isPublic : !!base.isPublic;
            const delivery = normalizeDelivery({
                ...(base.delivery || {}),
                ...(data.delivery || {}),
                isMandatory: data.isMandatory !== undefined ? data.isMandatory : base.isMandatory,
                blocking: data.blocking !== undefined ? data.blocking : base.blocking
            });
            const payload = {
                ...data,
                audience: data.audience ? normalizeAudience(data.audience, nextIsPublic) : normalizeAudience(base.audience, nextIsPublic),
                isPublic: nextIsPublic,
                delivery,
                isMandatory: delivery.mandatoryMode !== 'optional',
                blocking: delivery.blocking,
                scheduling: data.scheduling ? normalizeScheduling(data.scheduling) : normalizeScheduling(base.scheduling || {}),
                questions: data.questions ? normalizeQuestions(data.questions) : normalizeQuestions(base.questions || []),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await ref.update(payload);
            return { success: true };
        }

        async function toggleStatus(ctx, id, newStatus) {
            const ref = ctx.db.collection(C_SURVEYS).doc(id);
            await ref.update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        async function launchSurveyToAll(ctx, id) {
            const ref = ctx.db.collection(C_SURVEYS).doc(id);
            const current = await ref.get();
            if (!current.exists) throw new Error('Encuesta no encontrada');

            const survey = current.data();
            if ((survey.status || 'draft') === 'archived') {
                throw new Error('No puedes lanzar una encuesta archivada');
            }

            const launchToken = String(Date.now());
            await ref.update({
                status: 'active',
                delivery: {
                    ...(survey.delivery || {}),
                    showInStories: survey.delivery?.showInStories !== false,
                    launchToken,
                    launchAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, launchToken };
        }

        async function archiveSurvey(ctx, id) {
            const ref = ctx.db.collection(C_SURVEYS).doc(id);
            await ref.update({
                status: 'archived',
                archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        async function deleteSurvey(ctx, id) {
            return archiveSurvey(ctx, id);
        }

        async function duplicateSurvey(ctx, id) {
            const survey = await getSurveyById(ctx, id);
            if (!survey) throw new Error('Encuesta no encontrada');

            return createSurvey(ctx, {
                title: `${survey.title} (Copia)`,
                description: survey.description || '',
                questions: survey.questions || [],
                audience: survey.audience || [],
                isPublic: !!survey.isPublic,
                scheduling: survey.scheduling || { type: 'manual' },
                delivery: survey.delivery || {},
                status: 'draft'
            });
        }

        async function getAllSurveys(ctx, filters = {}) {
            const snapshot = await ctx.db.collection(C_SURVEYS)
                .orderBy('createdAt', 'desc')
                .limit(filters.limit || MAX_SURVEYS)
                .get();

            let surveys = snapshot.docs.map((doc) => normalizeSurvey(doc));

            if (!filters.includeArchived) {
                surveys = surveys.filter((survey) => survey.runtimeStatus !== 'archived');
            }
            if (filters.status && filters.status !== 'all') {
                surveys = surveys.filter((survey) => survey.runtimeStatus === filters.status || survey.status === filters.status);
            }
            if (filters.query) {
                const term = String(filters.query).trim().toLowerCase();
                surveys = surveys.filter((survey) => {
                    return `${survey.title} ${survey.description}`.toLowerCase().includes(term);
                });
            }

            return surveys;
        }

        async function getActiveSurveys(ctx, audience, options = {}) {
            const query = ctx.db.collection(C_SURVEYS)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .limit(options.limit || MAX_SURVEYS);

            const snapshot = await query.get();
            return snapshot.docs
                .map((doc) => normalizeSurvey(doc))
                .filter((survey) => options.includePublic ? true : !survey.isPublic)
                .filter((survey) => isSurveyVisibleToAudience(survey, audience))
                .filter((survey) => isSurveyAvailable(survey));
        }

        async function getActiveSurveysPublic(db) {
            const snapshot = await db.collection(C_SURVEYS)
                .where('status', '==', 'active')
                .where('isPublic', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(MAX_SURVEYS)
                .get();

            return snapshot.docs
                .map((doc) => normalizeSurvey(doc))
                .filter((survey) => isSurveyAvailable(survey));
        }

        async function getSurveyById(ctx, id) {
            const doc = await fetchSurveySnapshot(ctx, id);
            if (!doc.exists) return null;
            return normalizeSurvey(doc);
        }

        async function getSurveyByIdPublic(db, id) {
            const doc = await fetchSurveySnapshot(db, id);
            if (!doc.exists) return null;

            const survey = normalizeSurvey(doc);
            if (!survey.isPublic) return null;
            if (!isSurveyAvailable(survey)) return null;
            return survey;
        }

        async function getSurveysByIds(ctx, surveyIds = []) {
            const ids = [...new Set((surveyIds || []).filter(Boolean))].slice(0, MAX_SURVEYS);
            if (!ids.length) return [];

            const docs = await Promise.all(ids.map(async (id) => {
                try {
                    return await fetchSurveySnapshot(ctx, id);
                } catch (error) {
                    if (error?.code === 'permission-denied') return null;
                    throw error;
                }
            }));

            return docs
                .filter((doc) => doc?.exists)
                .map((doc) => normalizeSurvey(doc));
        }

        async function hasUserResponded(ctx, surveyId) {
            if (!ctx?.user) return false;
            const doc = await ctx.db.collection(C_RESPONSES).doc(buildResponseDocId(surveyId, ctx.user.uid)).get();
            return doc.exists;
        }

        async function getResponseStateMap(ctx, surveyIds = []) {
            return fetchCurrentUserResponses(ctx, surveyIds);
        }

        async function submitResponse(ctx, surveyId, answers, meta = {}) {
            if (!ctx?.user) throw new Error('Usuario no identificado');

            const survey = await getSurveyById(ctx, surveyId);
            if (!survey) throw new Error('Encuesta no encontrada');
            if (!isSurveyAvailable(survey)) throw new Error('La encuesta ya no esta disponible');

            const audience = getAudienceFromProfile(ctx.profile);
            if (!survey.isPublic && !isSurveyVisibleToAudience(survey, audience) && !isSurveyAdmin(ctx.profile)) {
                throw new Error('No tienes acceso a esta encuesta');
            }

            const responseRef = ctx.db.collection(C_RESPONSES).doc(buildResponseDocId(surveyId, ctx.user.uid));
            const response = {
                surveyId,
                surveyTitle: survey.title,
                userId: ctx.user.uid,
                userEmail: ctx.user.email || '',
                userName: ctx.profile?.displayName || ctx.profile?.name || 'Usuario',
                userCareer: ctx.profile?.career || ctx.profile?.carrera || null,
                userRole: ctx.profile?.role || 'student',
                answers,
                source: meta.source || 'module',
                isPublicResponse: false,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await ctx.db.runTransaction(async (transaction) => {
                const current = await transaction.get(responseRef);
                if (current.exists) {
                    throw new Error('Ya respondiste esta encuesta');
                }
                transaction.set(responseRef, response);
            });

            return { id: responseRef.id, ...response };
        }

        async function submitPublicResponse(db, surveyId, answers, meta = {}) {
            const survey = await getSurveyByIdPublic(db, surveyId);
            if (!survey) throw new Error('Encuesta publica no disponible');

            const responseRef = db.collection(C_RESPONSES).doc();
            const response = {
                surveyId,
                surveyTitle: survey.title,
                userId: 'anonymous',
                userEmail: meta.email || null,
                userName: meta.name || 'Anonimo',
                userCareer: meta.career || null,
                userRole: 'anonymous',
                answers,
                source: meta.source || 'public_link',
                isPublicResponse: true,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await responseRef.set(response);
            return { id: responseRef.id, ...response };
        }

        async function getResponses(ctx, surveyId, filters = {}) {
            let query = ctx.db.collection(C_RESPONSES)
                .where('surveyId', '==', surveyId)
                .orderBy('submittedAt', 'desc')
                .limit(filters.limit || MAX_RESPONSES);

            const snapshot = await query.get();
            let results = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                submittedAt: toDate(doc.data().submittedAt)
            }));

            if (filters.career) {
                results = results.filter((item) => item.userCareer === filters.career);
            }
            if (filters.role) {
                results = results.filter((item) => item.userRole === filters.role);
            }
            if (filters.excludeAnonymous) {
                results = results.filter((item) => item.userId !== 'anonymous');
            }

            return results;
        }

        async function getSurveyStats(ctx, surveyId) {
            const [survey, responses] = await Promise.all([
                getSurveyById(ctx, surveyId),
                getResponses(ctx, surveyId)
            ]);

            if (!survey) return null;

            const stats = {
                total: responses.length,
                byCareers: {},
                byRole: {},
                byQuestion: {},
                bySource: {}
            };

            survey.questions.forEach((question) => {
                stats.byQuestion[question.id] = {
                    type: question.type,
                    text: question.text,
                    answers: {},
                    textAnswers: [],
                    average: null
                };
            });

            responses.forEach((response) => {
                const career = response.userCareer || 'Sin carrera';
                const role = response.userRole || 'unknown';
                const source = response.source || 'module';

                stats.byCareers[career] = (stats.byCareers[career] || 0) + 1;
                stats.byRole[role] = (stats.byRole[role] || 0) + 1;
                stats.bySource[source] = (stats.bySource[source] || 0) + 1;

                survey.questions.forEach((question) => {
                    const bucket = stats.byQuestion[question.id];
                    const answer = response.answers?.[question.id];
                    if (answer === undefined || answer === null || answer === '') return;

                    if (question.type === 'open') {
                        bucket.textAnswers.push(answer);
                        return;
                    }

                    if (Array.isArray(answer)) {
                        answer.filter((item) => item !== undefined && item !== null && item !== '').forEach((item) => {
                            const key = String(item);
                            bucket.answers[key] = (bucket.answers[key] || 0) + 1;
                        });
                        return;
                    }

                    const key = String(answer);
                    bucket.answers[key] = (bucket.answers[key] || 0) + 1;
                });
            });

            survey.questions.forEach((question) => {
                if (question.type !== 'scale') return;
                const bucket = stats.byQuestion[question.id];
                const values = Object.entries(bucket.answers).map(([value, count]) => Number(value) * Number(count));
                const total = Object.values(bucket.answers).reduce((sum, value) => sum + Number(value), 0);
                const weighted = values.reduce((sum, value) => sum + Number(value), 0);
                bucket.average = total ? (weighted / total).toFixed(1) : null;
            });

            return stats;
        }

        async function getOverviewStats(ctx) {
            const surveys = await getAllSurveys(ctx, { includeArchived: true });
            const stats = {
                total: surveys.length,
                active: 0,
                scheduled: 0,
                paused: 0,
                closed: 0,
                draft: 0,
                archived: 0,
                totalResponses: 0,
                blocking: 0,
                mandatory: 0
            };

            surveys.forEach((survey) => {
                const runtime = survey.runtimeStatus || survey.status || 'draft';
                if (stats[runtime] !== undefined) stats[runtime] += 1;
                stats.totalResponses += survey.analytics?.totalResponses || survey.responseCount || 0;
                if (survey.blocking) stats.blocking += 1;
                if (survey.isMandatory) stats.mandatory += 1;
            });

            return stats;
        }

        async function getStudentSurveyFeed(ctx) {
            if (!ctx?.user) {
                return {
                    current: [],
                    all: [],
                    pending: [],
                    completed: [],
                    mandatory: [],
                    blocking: [],
                    counts: { all: 0, pending: 0, completed: 0, mandatory: 0, blocking: 0 }
                };
            }

            const audience = getAudienceFromProfile(ctx.profile);
            const [currentSurveys, responseMap] = await Promise.all([
                getActiveSurveys(ctx, audience, { includePublic: true }),
                getResponseStateMap(ctx)
            ]);

            const currentSurveyIds = new Set(currentSurveys.map((survey) => survey.id));
            const current = currentSurveys.map((survey) => ({
                ...survey,
                responded: !!responseMap[survey.id],
                response: responseMap[survey.id] || null
            }));

            const historySurveyIds = Object.keys(responseMap).filter((surveyId) => !currentSurveyIds.has(surveyId));
            const historySurveys = await getSurveysByIds(ctx, historySurveyIds);
            const completedHistory = historySurveys.map((survey) => ({
                ...survey,
                responded: true,
                response: responseMap[survey.id] || null
            }));

            const pending = current.filter((survey) => !survey.responded);
            const completed = [
                ...current.filter((survey) => survey.responded),
                ...completedHistory
            ];
            const mandatory = pending.filter((survey) => survey.isMandatory);
            const blocking = pending.filter((survey) => survey.blocking);

            return {
                current,
                all: [...current, ...completedHistory],
                pending,
                completed,
                mandatory,
                blocking,
                counts: {
                    all: current.length + completedHistory.length,
                    pending: pending.length,
                    completed: completed.length,
                    mandatory: mandatory.length,
                    blocking: blocking.length
                }
            };
        }

        async function getPendingSurveysForUser(ctx) {
            const feed = await getStudentSurveyFeed(ctx);
            return feed.pending;
        }

        async function getSurveysForUserStories(ctx) {
            const feed = await getStudentSurveyFeed(ctx);
            return feed.current
                .filter((survey) => survey.delivery?.showInStories !== false)
                .map((survey) => ({ ...survey, responded: !!survey.responded }));
        }

        async function markLaunchSeen(ctx, surveyId, launchToken) {
            if (!ctx?.user || !launchToken) return { success: false };
            await ctx.db.collection('usuarios')
                .doc(ctx.user.uid)
                .collection('surveyLaunchSeen')
                .doc(surveyId)
                .set({
                    surveyId,
                    launchToken,
                    seenAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            return { success: true };
        }

        async function getLaunchSurveyForUser(ctx) {
            if (!ctx?.user) return null;
            if (isSurveyAdmin(ctx.profile)) return null;

            const feed = await getStudentSurveyFeed(ctx);
            const launchMap = await fetchCurrentUserLaunchSeen(ctx, feed.current.map((survey) => survey.id));

            return feed.current
                .filter((survey) => survey.delivery?.launchToken)
                .filter((survey) => launchMap[survey.id] !== survey.delivery.launchToken)
                .sort((left, right) => {
                    const leftTime = left.delivery?.launchAt?.getTime?.() || left.updatedAt?.getTime?.() || 0;
                    const rightTime = right.delivery?.launchAt?.getTime?.() || right.updatedAt?.getTime?.() || 0;
                    return rightTime - leftTime;
                })[0] || null;
        }

        async function getBlockingSurveyForUser(ctx) {
            if (!ctx?.user) return null;
            if (isSurveyAdmin(ctx.profile)) return null;

            const feed = await getStudentSurveyFeed(ctx);
            return feed.blocking
                .sort((left, right) => {
                    const leftWeight = left.delivery?.mandatoryMode === 'blocking' ? 0 : 1;
                    const rightWeight = right.delivery?.mandatoryMode === 'blocking' ? 0 : 1;
                    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
                    return (right.createdAt?.getTime() || 0) - (left.createdAt?.getTime() || 0);
                })[0] || null;
        }

        return {
            createSurvey,
            updateSurvey,
            toggleStatus,
            archiveSurvey,
            deleteSurvey,
            duplicateSurvey,
            launchSurveyToAll,
            getAllSurveys,
            getActiveSurveys,
            getActiveSurveysPublic,
            getSurveyById,
            getSurveyByIdPublic,
            submitResponse,
            submitPublicResponse,
            hasUserResponded,
            getResponseStateMap,
            getResponses,
            getSurveyStats,
            getOverviewStats,
            getPendingSurveysForUser,
            getSurveysForUserStories,
            getStudentSurveyFeed,
            fetchCurrentUserLaunchSeen,
            markLaunchSeen,
            getLaunchSurveyForUser,
            getBlockingSurveyForUser,
            getAudienceFromProfile,
            getRuntimeStatus,
            isSurveyAvailable,
            isSurveyAdmin,
            buildResponseDocId
        };
    })();
}

window.EncuestasService = EncuestasService;
