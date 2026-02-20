// services/encuestas-service.js
// Servicio para el Módulo de Encuestas (Calidad)
// Gestiona encuestas, respuestas, estadísticas y encuestas públicas.


if (!window.EncuestasService) {
    window.EncuestasService = (function () {
        const C_SURVEYS = 'encuestas';
        const C_RESPONSES = 'encuestas-respuestas';

        // =============================================
        // CRUD - ENCUESTAS
        // =============================================

        async function createSurvey(ctx, data) {
            if (!ctx.user) throw new Error("Usuario no identificado");

            const survey = {
                title: data.title || 'Sin título',
                description: data.description || '',
                questions: data.questions || [],
                audience: data.audience || ['estudiantes'],
                isPublic: data.isPublic || false,
                status: data.status || 'draft', // draft, active, paused, closed
                scheduling: data.scheduling || { type: 'manual' },
                createdBy: ctx.user.uid,
                createdByName: ctx.profile?.displayName || 'Administrador',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                responseCount: 0
            };

            const ref = await ctx.db.collection(C_SURVEYS).add(survey);
            return { id: ref.id, ...survey };
        }

        async function getAllSurveys(ctx) {
            const q = await ctx.db.collection(C_SURVEYS)
                .orderBy('createdAt', 'desc')
                .get();

            return q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate(),
                updatedAt: d.data().updatedAt?.toDate()
            }));
        }

        async function getActiveSurveys(ctx, audience) {
            let chain = ctx.db.collection(C_SURVEYS)
                .where('status', '==', 'active');

            const q = await chain.get();

            // Filter by audience client-side (Firestore doesn't support array-contains-any + other where efficiently)
            return q.docs
                .map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate(),
                    updatedAt: d.data().updatedAt?.toDate()
                }))
                .filter(s => {
                    if (!audience) return true;
                    return s.audience.includes(audience) || s.audience.includes('todos');
                });
        }

        // For public surveys - no auth required
        async function getActiveSurveysPublic(db) {
            const q = await db.collection(C_SURVEYS)
                .where('status', '==', 'active')
                .where('isPublic', '==', true)
                .get();

            return q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate()
            }));
        }

        async function getSurveyById(ctx, id) {
            const doc = await ctx.db.collection(C_SURVEYS).doc(id).get();
            if (!doc.exists) return null;
            return {
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate(),
                updatedAt: doc.data().updatedAt?.toDate()
            };
        }

        // No auth version
        async function getSurveyByIdPublic(db, id) {
            const doc = await db.collection(C_SURVEYS).doc(id).get();
            if (!doc.exists) return null;
            const data = doc.data();
            if (data.status !== 'active') return null; // Only return active surveys
            return { id: doc.id, ...data, createdAt: data.createdAt?.toDate() };
        }

        async function updateSurvey(ctx, id, data) {
            const ref = ctx.db.collection(C_SURVEYS).doc(id);
            await ref.update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
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

        async function deleteSurvey(ctx, id) {
            await ctx.db.collection(C_SURVEYS).doc(id).delete();
            // Note: responses are orphaned but kept for data integrity
            return { success: true };
        }

        // =============================================
        // CRUD - RESPUESTAS
        // =============================================

        async function submitResponse(ctx, surveyId, answers) {
            if (!ctx.user) throw new Error("Usuario no identificado");

            // Check duplicate
            const already = await hasUserResponded(ctx, surveyId);
            if (already) throw new Error("Ya respondiste esta encuesta");

            const response = {
                surveyId,
                userId: ctx.user.uid,
                userEmail: ctx.user.email || '',
                userName: ctx.profile?.displayName || 'Usuario',
                userCareer: ctx.profile?.career || ctx.profile?.carrera || null,
                userRole: ctx.profile?.role || 'student',
                answers,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await ctx.db.collection(C_RESPONSES).add(response);

            // Increment response count
            await ctx.db.collection(C_SURVEYS).doc(surveyId).update({
                responseCount: firebase.firestore.FieldValue.increment(1)
            });

            return { success: true };
        }

        // Public response - no auth required
        async function submitPublicResponse(db, surveyId, answers, meta = {}) {
            const response = {
                surveyId,
                userId: 'anonymous',
                userEmail: meta.email || null,
                userName: meta.name || 'Anónimo',
                userCareer: meta.career || null,
                userRole: 'anonymous',
                answers,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection(C_RESPONSES).add(response);

            // Increment response count
            await db.collection(C_SURVEYS).doc(surveyId).update({
                responseCount: firebase.firestore.FieldValue.increment(1)
            });

            return { success: true };
        }

        async function hasUserResponded(ctx, surveyId) {
            if (!ctx.user) return false;
            const q = await ctx.db.collection(C_RESPONSES)
                .where('surveyId', '==', surveyId)
                .where('userId', '==', ctx.user.uid)
                .limit(1)
                .get();
            return !q.empty;
        }

        async function getResponses(ctx, surveyId, filters = {}) {
            let chain = ctx.db.collection(C_RESPONSES)
                .where('surveyId', '==', surveyId);

            const q = await chain.get();
            let results = q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                submittedAt: d.data().submittedAt?.toDate()
            }));

            // Client-side filters
            if (filters.career) {
                results = results.filter(r => r.userCareer === filters.career);
            }
            if (filters.role) {
                results = results.filter(r => r.userRole === filters.role);
            }

            return results.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
        }

        // =============================================
        // ESTADÍSTICAS
        // =============================================

        async function getSurveyStats(ctx, surveyId) {
            const responses = await getResponses(ctx, surveyId);
            const survey = await getSurveyById(ctx, surveyId);

            if (!survey) return null;

            const stats = {
                total: responses.length,
                byCareers: {},
                byRole: {},
                byQuestion: {}
            };

            // Aggregate by career & role
            responses.forEach(r => {
                const career = r.userCareer || 'Sin carrera';
                stats.byCareers[career] = (stats.byCareers[career] || 0) + 1;

                const role = r.userRole || 'unknown';
                stats.byRole[role] = (stats.byRole[role] || 0) + 1;
            });

            // Aggregate answers per question
            survey.questions.forEach(q => {
                const qId = q.id;
                const questionStats = { type: q.type, text: q.text, answers: {} };

                responses.forEach(r => {
                    const ans = r.answers?.[qId];
                    if (ans === undefined || ans === null) return;

                    if (q.type === 'open') {
                        // Collect text answers
                        if (!questionStats.textAnswers) questionStats.textAnswers = [];
                        questionStats.textAnswers.push(ans);
                    } else if (q.type === 'scale') {
                        const val = Number(ans);
                        if (!questionStats.values) questionStats.values = [];
                        questionStats.values.push(val);
                        questionStats.answers[val] = (questionStats.answers[val] || 0) + 1;
                    } else {
                        // multiple, boolean
                        const key = String(ans);
                        questionStats.answers[key] = (questionStats.answers[key] || 0) + 1;
                    }
                });

                // Calculate average for scale
                if (q.type === 'scale' && questionStats.values?.length > 0) {
                    questionStats.average = (questionStats.values.reduce((a, b) => a + b, 0) / questionStats.values.length).toFixed(1);
                }

                stats.byQuestion[qId] = questionStats;
            });

            return stats;
        }

        async function getOverviewStats(ctx) {
            const q = await ctx.db.collection(C_SURVEYS).get();

            const stats = {
                total: q.size,
                active: 0,
                paused: 0,
                closed: 0,
                draft: 0,
                totalResponses: 0
            };

            q.docs.forEach(d => {
                const data = d.data();
                if (stats[data.status] !== undefined) stats[data.status]++;
                stats.totalResponses += data.responseCount || 0;
            });

            return stats;
        }

        // =============================================
        // STORIES HELPER
        // =============================================

        async function getPendingSurveysForUser(ctx) {
            if (!ctx.user) return [];

            const role = ctx.profile?.role || 'student';
            let audience = 'estudiantes';
            if (role === 'docente') audience = 'docentes';
            else if (role === 'department_admin') audience = 'administrativos';
            else if (role === 'personal') audience = 'operativos';

            // Get active surveys for this audience
            const activeSurveys = await getActiveSurveys(ctx, audience);

            // Check which ones user has responded
            const pending = [];
            for (const survey of activeSurveys) {
                if (survey.isPublic) continue; // Public surveys don't show in stories
                const responded = await _checkResponded(ctx, survey.id);
                if (!responded) {
                    pending.push(survey);
                }
            }

            return pending;
        }

        // Returns ALL active surveys for stories (pending + responded with flag)
        async function getSurveysForUserStories(ctx) {
            if (!ctx.user) return [];

            const role = ctx.profile?.role || 'student';
            let audience = 'estudiantes';
            if (role === 'docente') audience = 'docentes';
            else if (role === 'department_admin') audience = 'administrativos';
            else if (role === 'personal') audience = 'operativos';

            const activeSurveys = await getActiveSurveys(ctx, audience);
            const result = [];
            for (const survey of activeSurveys) {
                if (survey.isPublic) continue;
                const responded = await _checkResponded(ctx, survey.id);
                result.push({ ...survey, responded });
            }
            return result;
        }

        // Fast check without full query overhead
        async function _checkResponded(ctx, surveyId) {
            const q = await ctx.db.collection(C_RESPONSES)
                .where('surveyId', '==', surveyId)
                .where('userId', '==', ctx.user.uid)
                .limit(1)
                .get();
            return !q.empty;
        }

        // =============================================
        // PUBLIC API
        // =============================================

        return {
            createSurvey,
            getAllSurveys,
            getActiveSurveys,
            getActiveSurveysPublic,
            getSurveyById,
            getSurveyByIdPublic,
            updateSurvey,
            toggleStatus,
            deleteSurvey,
            submitResponse,
            submitPublicResponse,
            hasUserResponded,
            getResponses,
            getSurveyStats,
            getOverviewStats,
            getPendingSurveysForUser,
            getSurveysForUserStories
        };

    })();
}

window.EncuestasService = EncuestasService;
