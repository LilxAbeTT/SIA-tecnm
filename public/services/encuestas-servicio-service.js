// services/encuestas-servicio-service.js
// Gestiona encuestas predeterminadas por servicio, triggers automáticos y respuestas.

if (!window.EncuestasServicioService) {
    window.EncuestasServicioService = (function () {
        const C_SERVICE_SURVEYS = 'encuestas-servicio';
        const C_SERVICE_RESPONSES = 'encuestas-servicio-respuestas';
        const C_SERVICE_TRIGGERS = 'encuestas-servicio-triggers';

        function toDate(value) {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value.toDate === 'function') return value.toDate();
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function normalizeQuestions(questions = []) {
            return (questions || []).map((question, index) => {
                const normalized = {
                    id: question.id || `q${index}`,
                    type: question.type || 'open',
                    text: question.text || `Pregunta ${index + 1}`,
                    required: question.required !== false
                };

                if (normalized.type === 'multiple') {
                    normalized.options = (question.options || []).filter(Boolean);
                }
                if (normalized.type === 'scale') {
                    normalized.min = Number.isFinite(Number(question.min)) ? Number(question.min) : 1;
                    normalized.max = Number.isFinite(Number(question.max)) ? Number(question.max) : 10;
                }

                return normalized;
            });
        }

        function normalizeConfig(config = {}) {
            return {
                frequency: config.frequency || 'per-use',
                customDays: Number.isFinite(Number(config.customDays)) ? Number(config.customDays) : null,
                showToAll: !!config.showToAll,
                maxSkips: Number.isFinite(Number(config.maxSkips)) ? Number(config.maxSkips) : 2,
                triggerTimestamp: config.triggerTimestamp || null
            };
        }

        function normalizeSurvey(snapshotOrData, fallbackId = '') {
            const raw = typeof snapshotOrData.data === 'function' ? snapshotOrData.data() : snapshotOrData;
            const id = snapshotOrData.id || fallbackId;
            return {
                id,
                ...raw,
                title: raw.title || 'Encuesta de servicio',
                description: raw.description || '',
                questions: normalizeQuestions(raw.questions || []),
                config: normalizeConfig(raw.config || {}),
                createdAt: toDate(raw.createdAt),
                updatedAt: toDate(raw.updatedAt)
            };
        }

        async function createServiceSurvey(ctx, serviceType, data) {
            const db = ctx.db;
            const docRef = db.collection(C_SERVICE_SURVEYS).doc(serviceType);

            const surveyData = {
                serviceType,
                title: data.title,
                description: data.description || '',
                questions: normalizeQuestions(data.questions || []),
                enabled: data.enabled !== undefined ? data.enabled : false,
                config: normalizeConfig(data.config || {}),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: ctx.profile?.email || ctx.profile?.displayName || 'Administrador',
                responseCount: 0,
                analytics: {
                    totalResponses: 0,
                    notUsedCount: 0,
                    lastResponseAt: null
                }
            };

            await docRef.set(surveyData, { merge: true });
            return { id: serviceType, ...surveyData };
        }

        async function getServiceSurvey(ctx, serviceType) {
            const db = ctx.db;
            const doc = await db.collection(C_SERVICE_SURVEYS).doc(serviceType).get();
            if (!doc.exists) return null;
            return normalizeSurvey(doc);
        }

        async function getAllServiceSurveys(ctx) {
            const db = ctx.db;
            const snapshot = await db.collection(C_SERVICE_SURVEYS).get();
            return snapshot.docs.map((doc) => normalizeSurvey(doc));
        }

        async function updateServiceSurvey(ctx, serviceType, data) {
            const db = ctx.db;
            const ref = db.collection(C_SERVICE_SURVEYS).doc(serviceType);
            const current = await ref.get();
            const currentData = current.exists ? current.data() : {};
            const nextConfig = normalizeConfig({
                ...(currentData.config || {}),
                ...(data.config || {})
            });

            const updateData = {
                ...data,
                questions: data.questions ? normalizeQuestions(data.questions) : normalizeQuestions(currentData.questions || []),
                config: nextConfig,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await ref.set(updateData, { merge: true });
        }

        async function toggleServiceSurvey(ctx, serviceType, enabled) {
            const db = ctx.db;
            await db.collection(C_SERVICE_SURVEYS).doc(serviceType).update({
                enabled,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        async function triggerSurveyToAll(ctx, serviceType) {
            await updateServiceSurvey(ctx, serviceType, {
                enabled: true,
                config: {
                    showToAll: true,
                    triggerTimestamp: firebase.firestore.Timestamp.now()
                }
            });
        }

        async function stopGlobalSurvey(ctx, serviceType) {
            await updateServiceSurvey(ctx, serviceType, {
                config: { showToAll: false }
            });
        }

        async function registerServiceUsage(ctx, serviceType, metadata, targetUid = null) {
            const db = ctx.db;
            const userId = targetUid || ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);
            const triggerDoc = await triggerRef.get();
            const usageRecord = {
                action: metadata.action,
                timestamp: firebase.firestore.Timestamp.now(),
                ...metadata
            };

            if (triggerDoc.exists) {
                await triggerRef.update({
                    userId,
                    lastUsage: firebase.firestore.Timestamp.now(),
                    usageHistory: firebase.firestore.FieldValue.arrayUnion(usageRecord),
                    updatedAt: firebase.firestore.Timestamp.now(),
                    responded: false,
                    exempted: false,
                    skipCount: 0
                });
            } else {
                await triggerRef.set({
                    userId,
                    serviceType,
                    lastUsage: firebase.firestore.Timestamp.now(),
                    lastSurveyShown: null,
                    skipCount: 0,
                    responded: false,
                    exempted: false,
                    responseId: null,
                    usageHistory: [usageRecord],
                    createdAt: firebase.firestore.Timestamp.now(),
                    updatedAt: firebase.firestore.Timestamp.now()
                });
            }
        }

        async function checkPendingSurvey(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const survey = await getServiceSurvey(ctx, serviceType);
            if (!survey || !survey.enabled) return null;

            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);
            const triggerDoc = await triggerRef.get();
            const triggerData = triggerDoc.exists ? triggerDoc.data() : null;

            if (survey.config.showToAll && survey.config.triggerTimestamp) {
                const triggerTime = toDate(survey.config.triggerTimestamp);
                const lastResponse = toDate(triggerData?.lastResponseAt);

                if (!lastResponse || (triggerTime && triggerTime > lastResponse)) {
                    return { ...survey, isMandatory: true, reason: 'manual_trigger' };
                }
            }

            if (!triggerData) return null;
            if (triggerData.responded || triggerData.exempted) return null;

            const shouldShow = await shouldShowSurvey(ctx, serviceType, survey, triggerData);
            if (!shouldShow) return null;

            return {
                ...survey,
                skipCount: triggerData?.skipCount || 0,
                maxSkips: survey.config.maxSkips,
                isMandatory: (triggerData?.skipCount || 0) >= survey.config.maxSkips
            };
        }

        async function shouldShowSurvey(ctx, serviceType, survey, triggerData) {
            if (survey.config.showToAll) return true;
            if (!triggerData) return false;

            const now = Date.now();
            const lastUsage = toDate(triggerData.lastUsage);
            const lastSurveyShown = toDate(triggerData.lastSurveyShown);

            if (!lastSurveyShown) return true;

            switch (survey.config.frequency) {
                case 'per-use':
                    return !!lastUsage && lastUsage > lastSurveyShown;
                case 'weekly':
                    return (now - lastSurveyShown.getTime()) >= (7 * 24 * 60 * 60 * 1000);
                case 'monthly':
                    return (now - lastSurveyShown.getTime()) >= (30 * 24 * 60 * 60 * 1000);
                case 'custom':
                    if (!survey.config.customDays) return false;
                    return (now - lastSurveyShown.getTime()) >= (survey.config.customDays * 24 * 60 * 60 * 1000);
                default:
                    return false;
            }
        }

        async function recordSurveySkip(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.set({
                skipCount: firebase.firestore.FieldValue.increment(1),
                lastSurveyShown: firebase.firestore.Timestamp.now(),
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }

        async function markSurveyShown(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.set({
                lastSurveyShown: firebase.firestore.Timestamp.now(),
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }

        async function submitServiceSurveyResponse(ctx, serviceType, answers, meta = {}) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const profile = ctx.profile;
            const responseData = {
                serviceType,
                userId,
                userName: profile.name || profile.displayName || 'Anonimo',
                userEmail: profile.email || null,
                userCareer: profile.career || profile.carrera || null,
                userRole: profile.role || 'student',
                answers,
                source: meta.source || 'service_modal',
                submittedAt: firebase.firestore.Timestamp.now(),
                isSkip: false
            };

            const responseRef = await db.collection(C_SERVICE_RESPONSES).add(responseData);
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);
            await triggerRef.set({
                responded: true,
                exempted: false,
                responseId: responseRef.id,
                skipCount: 0,
                lastSurveyShown: firebase.firestore.Timestamp.now(),
                lastResponseAt: firebase.firestore.Timestamp.now(),
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });

            return { id: responseRef.id, ...responseData };
        }

        async function markSurveyNotUsed(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.set({
                responded: false,
                exempted: true,
                responseId: null,
                skipCount: 0,
                lastSurveyShown: firebase.firestore.Timestamp.now(),
                lastResponseAt: firebase.firestore.Timestamp.now(),
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });

            return { success: true };
        }

        async function getServiceSurveyResponses(ctx, serviceType, filters = {}) {
            let query = ctx.db.collection(C_SERVICE_RESPONSES)
                .where('serviceType', '==', serviceType)
                .orderBy('submittedAt', 'desc');

            if (filters.startDate) {
                query = query.where('submittedAt', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('submittedAt', '<=', filters.endDate);
            }

            const snapshot = await query.get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                submittedAt: toDate(doc.data().submittedAt)
            }));
        }

        async function getServiceSurveyStats(ctx, serviceType, dateRange = {}) {
            const responses = await getServiceSurveyResponses(ctx, serviceType, dateRange);
            const survey = await getServiceSurvey(ctx, serviceType);

            if (!survey) return null;

            const stats = {
                total: responses.length,
                byQuestion: {},
                byCareers: {},
                byRole: {},
                byDate: {}
            };

            survey.questions.forEach((question) => {
                stats.byQuestion[question.id] = {
                    questionText: question.text,
                    questionType: question.type,
                    answers: {},
                    textAnswers: [],
                    average: null
                };
            });

            responses.forEach((response) => {
                const career = response.userCareer || 'Sin carrera';
                const role = response.userRole || 'student';
                const date = toDate(response.submittedAt) || new Date();
                const dateKey = date.toISOString().split('T')[0];

                stats.byCareers[career] = (stats.byCareers[career] || 0) + 1;
                stats.byRole[role] = (stats.byRole[role] || 0) + 1;
                stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;

                Object.entries(response.answers || {}).forEach(([questionId, answer]) => {
                    const bucket = stats.byQuestion[questionId];
                    if (!bucket) return;

                    if (bucket.questionType === 'open') {
                        if (answer && String(answer).trim()) {
                            bucket.textAnswers.push(answer);
                        }
                        return;
                    }

                    const key = String(answer);
                    bucket.answers[key] = (bucket.answers[key] || 0) + 1;
                });
            });

            Object.values(stats.byQuestion).forEach((bucket) => {
                if (bucket.questionType !== 'scale') return;
                const total = Object.values(bucket.answers).reduce((sum, value) => sum + Number(value), 0);
                const weighted = Object.entries(bucket.answers).reduce((sum, [value, count]) => {
                    return sum + (Number(value) * Number(count));
                }, 0);
                bucket.average = total ? (weighted / total).toFixed(1) : null;
            });

            return stats;
        }

        async function getOverviewStats(ctx) {
            const surveys = await getAllServiceSurveys(ctx);
            const stats = {
                totalSurveys: surveys.length,
                enabled: surveys.filter((survey) => survey.enabled).length,
                disabled: surveys.filter((survey) => !survey.enabled).length,
                totalResponses: surveys.reduce((sum, survey) => sum + (survey.analytics?.totalResponses || survey.responseCount || 0), 0),
                byService: {}
            };

            surveys.forEach((survey) => {
                stats.byService[survey.serviceType] = {
                    title: survey.title,
                    enabled: survey.enabled,
                    responseCount: survey.analytics?.totalResponses || survey.responseCount || 0
                };
            });

            return stats;
        }

        async function resetUserSurveyState(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.update({
                responded: false,
                exempted: false,
                responseId: null,
                skipCount: 0,
                lastSurveyShown: null,
                updatedAt: firebase.firestore.Timestamp.now()
            });
        }

        return {
            createServiceSurvey,
            getServiceSurvey,
            getAllServiceSurveys,
            updateServiceSurvey,
            toggleServiceSurvey,
            triggerSurveyToAll,
            stopGlobalSurvey,
            registerServiceUsage,
            checkPendingSurvey,
            shouldShowSurvey,
            recordSurveySkip,
            markSurveyShown,
            submitServiceSurveyResponse,
            markSurveyNotUsed,
            getServiceSurveyResponses,
            getServiceSurveyStats,
            getOverviewStats,
            resetUserSurveyState
        };
    })();
}

window.EncuestasServicioService = EncuestasServicioService;
