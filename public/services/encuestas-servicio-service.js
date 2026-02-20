// services/encuestas-servicio-service.js
// Servicio para el Módulo de Encuestas de Servicio
// Gestiona encuestas predeterminadas por servicio, triggers automáticos y respuestas

if (!window.EncuestasServicioService) {
    window.EncuestasServicioService = (function () {
        const C_SERVICE_SURVEYS = 'encuestas-servicio';
        const C_SERVICE_RESPONSES = 'encuestas-servicio-respuestas';
        const C_SERVICE_TRIGGERS = 'encuestas-servicio-triggers';

        // =============================================
        // CRUD - ENCUESTAS DE SERVICIO
        // =============================================

        /**
         * Crear o actualizar encuesta de servicio
         * @param {Object} ctx - Contexto de usuario
         * @param {string} serviceType - Tipo de servicio (biblioteca, servicio-medico, psicologia, etc.)
         * @param {Object} data - Datos de la encuesta
         */
        async function createServiceSurvey(ctx, serviceType, data) {
            const db = ctx.db;
            const docRef = db.collection(C_SERVICE_SURVEYS).doc(serviceType);

            const surveyData = {
                serviceType,
                title: data.title,
                description: data.description || '',
                questions: data.questions || [],
                enabled: data.enabled !== undefined ? data.enabled : false,
                config: {
                    frequency: data.config?.frequency || 'per-use', // per-use, weekly, monthly, custom
                    customDays: data.config?.customDays || null,
                    showToAll: data.config?.showToAll || false,
                    maxSkips: data.config?.maxSkips || 2
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: ctx.profile.email
            };

            await docRef.set(surveyData, { merge: true });
            return { id: serviceType, ...surveyData };
        }

        /**
         * Obtener encuesta de un servicio específico
         */
        async function getServiceSurvey(ctx, serviceType) {
            const db = ctx.db;
            const doc = await db.collection(C_SERVICE_SURVEYS).doc(serviceType).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        }

        /**
         * Obtener todas las encuestas de servicio
         */
        async function getAllServiceSurveys(ctx) {
            const db = ctx.db;
            const snapshot = await db.collection(C_SERVICE_SURVEYS).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        /**
         * Actualizar configuración de encuesta de servicio
         */
        async function updateServiceSurvey(ctx, serviceType, data) {
            const db = ctx.db;
            const updateData = {
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection(C_SERVICE_SURVEYS).doc(serviceType).update(updateData);
        }

        /**
         * Habilitar/deshabilitar encuesta de servicio
         */
        async function toggleServiceSurvey(ctx, serviceType, enabled) {
            const db = ctx.db;
            await db.collection(C_SERVICE_SURVEYS).doc(serviceType).update({
                enabled,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // =============================================
        // SISTEMA DE TRIGGERS
        // =============================================

        /**
         * Registrar uso de un servicio
         * @param {Object} ctx - Contexto de usuario
         * @param {string} serviceType - Tipo de servicio
         * @param {Object} metadata - Metadatos del uso (action, timestamp, etc.)
         * @param {string} [targetUid] - ID del usuario objetivo (si es diferente al actual, ej. medico -> estudiante)
         */
        async function registerServiceUsage(ctx, serviceType, metadata, targetUid = null) {
            const db = ctx.db;
            // Usar targetUid si existe (acción de admin/medico), sino el usuario actual (autoservicio)
            const userId = targetUid || ctx.profile.uid;

            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            const triggerDoc = await triggerRef.get();
            const usageRecord = {
                action: metadata.action,
                timestamp: firebase.firestore.Timestamp.now(),
                ...metadata
            };

            if (triggerDoc.exists) {
                // Actualizar registro existente
                // CRITICAL: Resetear flags para volver a activar la encuesta
                await triggerRef.update({
                    userId, // Asegurar que el ID está correcto
                    lastUsage: firebase.firestore.Timestamp.now(),
                    usageHistory: firebase.firestore.FieldValue.arrayUnion(usageRecord),
                    updatedAt: firebase.firestore.Timestamp.now(),
                    responded: false, // RESET: Permitir nueva respuesta
                    skipCount: 0      // RESET: Reiniciar skips
                });
            } else {
                // Crear nuevo registro
                await triggerRef.set({
                    userId,
                    serviceType,
                    lastUsage: firebase.firestore.Timestamp.now(),
                    lastSurveyShown: null,
                    skipCount: 0,
                    responded: false,
                    responseId: null,
                    usageHistory: [usageRecord],
                    createdAt: firebase.firestore.Timestamp.now(),
                    updatedAt: firebase.firestore.Timestamp.now()
                });
            }
        }

        /**
         * Verificar si debe mostrar encuesta al usuario
         * @returns {Object|null} - Datos de la encuesta si debe mostrarla, null si no
         */
        async function checkPendingSurvey(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;

            // Obtener configuración de la encuesta
            const survey = await getServiceSurvey(ctx, serviceType);
            if (!survey || !survey.enabled) return null;

            // Obtener registro de triggers del usuario
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);
            const triggerDoc = await triggerRef.get();
            const triggerData = triggerDoc.exists ? triggerDoc.data() : null;

            // 1. CHEQUEO DE DISPARADOR MANUAL (LANZAR A TODOS)
            if (survey.config.showToAll && survey.config.triggerTimestamp) {
                const triggerTime = survey.config.triggerTimestamp.toDate ? survey.config.triggerTimestamp.toDate() : new Date(survey.config.triggerTimestamp);
                const lastResponse = triggerData?.lastResponseAt ? (triggerData.lastResponseAt.toDate ? triggerData.lastResponseAt.toDate() : new Date(triggerData.lastResponseAt)) : null;

                // Si nunca respondió O si el disparo manual es más reciente que su última respuesta
                if (!lastResponse || triggerTime > lastResponse) {
                    return { ...survey, isMandatory: true, reason: 'manual_trigger' };
                }
            }

            // Si no hay registro de uso y no es manual, no mostrar
            if (!triggerData) return null;

            // Si ya respondió (y no cayó en el caso manual de arriba), no mostrar
            if (triggerData.responded) return null;

            // Verificar si debe mostrar según la frecuencia
            const shouldShow = await shouldShowSurvey(ctx, serviceType, survey, triggerData);
            if (!shouldShow) return null;

            // Retornar datos de la encuesta con información de skip
            return {
                ...survey,
                skipCount: triggerData?.skipCount || 0,
                maxSkips: survey.config.maxSkips,
                isMandatory: (triggerData?.skipCount || 0) >= survey.config.maxSkips
            };
        }

        /**
         * Lógica para determinar si debe mostrar la encuesta
         */
        async function shouldShowSurvey(ctx, serviceType, survey, triggerData) {
            // Si está configurado para mostrar a todos, siempre mostrar
            if (survey.config.showToAll) return true;

            // Si no hay registro de uso, no mostrar
            if (!triggerData) return false;

            const now = Date.now();
            const lastUsage = triggerData.lastUsage?.toDate?.() || new Date(triggerData.lastUsage);
            const lastSurveyShown = triggerData.lastSurveyShown?.toDate?.() || null;

            // Si nunca se ha mostrado la encuesta, mostrarla
            if (!lastSurveyShown) return true;

            const config = survey.config;

            switch (config.frequency) {
                case 'per-use':
                    // Mostrar después de cada uso
                    return lastUsage > lastSurveyShown;

                case 'weekly':
                    // Mostrar si han pasado 7 días desde la última vez que se mostró
                    const weekInMs = 7 * 24 * 60 * 60 * 1000;
                    return (now - lastSurveyShown.getTime()) >= weekInMs;

                case 'monthly':
                    // Mostrar si han pasado 30 días
                    const monthInMs = 30 * 24 * 60 * 60 * 1000;
                    return (now - lastSurveyShown.getTime()) >= monthInMs;

                case 'custom':
                    // Mostrar según días personalizados
                    if (!config.customDays) return false;
                    const customMs = config.customDays * 24 * 60 * 60 * 1000;
                    return (now - lastSurveyShown.getTime()) >= customMs;

                default:
                    return false;
            }
        }

        /**
         * Registrar que el usuario saltó la encuesta
         */
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

        /**
         * Marcar que se mostró la encuesta (sin skip ni respuesta aún)
         */
        async function markSurveyShown(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.set({
                lastSurveyShown: firebase.firestore.Timestamp.now(),
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });
        }

        // =============================================
        // RESPUESTAS
        // =============================================

        /**
         * Guardar respuesta de encuesta de servicio
         */
        async function submitServiceSurveyResponse(ctx, serviceType, answers) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const profile = ctx.profile;

            // Guardar respuesta
            const responseData = {
                serviceType,
                userId,
                userName: profile.name || profile.displayName || 'Anónimo',
                userEmail: profile.email,
                userCareer: profile.career || null,
                userRole: profile.role || 'student',
                answers,
                submittedAt: firebase.firestore.Timestamp.now()
            };

            const responseRef = await db.collection(C_SERVICE_RESPONSES).add(responseData);

            // Actualizar trigger: marcar como respondido
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);
            await triggerRef.set({
                responded: true,
                responseId: responseRef.id,
                skipCount: 0, // Resetear contador de skips
                lastResponseAt: firebase.firestore.Timestamp.now(), // SAVE TIMESTAMP FOR MANUAL TRIGGERS
                updatedAt: firebase.firestore.Timestamp.now()
            }, { merge: true });

            // Incrementar contador de respuestas en la encuesta
            const surveyRef = db.collection(C_SERVICE_SURVEYS).doc(serviceType);
            await surveyRef.update({
                responseCount: firebase.firestore.FieldValue.increment(1)
            });

            return { id: responseRef.id, ...responseData };
        }

        /**
         * Obtener respuestas de una encuesta de servicio
         */
        async function getServiceSurveyResponses(ctx, serviceType, filters = {}) {
            const db = ctx.db;
            let query = db.collection(C_SERVICE_RESPONSES).where('serviceType', '==', serviceType);

            if (filters.startDate) {
                query = query.where('submittedAt', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('submittedAt', '<=', filters.endDate);
            }

            query = query.orderBy('submittedAt', 'desc');

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // =============================================
        // ESTADÍSTICAS
        // =============================================

        /**
         * Obtener estadísticas de una encuesta de servicio
         */
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

            // Analizar respuestas por pregunta
            survey.questions.forEach(q => {
                stats.byQuestion[q.id] = {
                    questionText: q.text,
                    questionType: q.type,
                    answers: {},
                    textAnswers: [],
                    average: null
                };
            });

            responses.forEach(r => {
                // Por carrera
                const career = r.userCareer || 'Sin carrera';
                stats.byCareers[career] = (stats.byCareers[career] || 0) + 1;

                // Por rol
                const role = r.userRole || 'student';
                stats.byRole[role] = (stats.byRole[role] || 0) + 1;

                // Por fecha
                const date = r.submittedAt?.toDate?.() || new Date(r.submittedAt);
                const dateKey = date.toISOString().split('T')[0];
                stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;

                // Por pregunta
                Object.entries(r.answers).forEach(([qId, answer]) => {
                    const qStats = stats.byQuestion[qId];
                    if (!qStats) return;

                    if (qStats.questionType === 'open') {
                        if (answer && answer.trim()) {
                            qStats.textAnswers.push(answer);
                        }
                    } else if (qStats.questionType === 'scale') {
                        const key = String(answer);
                        qStats.answers[key] = (qStats.answers[key] || 0) + 1;
                    } else {
                        const key = String(answer);
                        qStats.answers[key] = (qStats.answers[key] || 0) + 1;
                    }
                });
            });

            // Calcular promedios para escalas
            Object.values(stats.byQuestion).forEach(qStats => {
                if (qStats.questionType === 'scale') {
                    const values = Object.entries(qStats.answers).map(([k, count]) => {
                        return parseInt(k) * count;
                    });
                    const total = Object.values(qStats.answers).reduce((a, b) => a + b, 0);
                    const sum = values.reduce((a, b) => a + b, 0);
                    qStats.average = total > 0 ? (sum / total).toFixed(1) : null;
                }
            });

            return stats;
        }

        /**
         * Obtener estadísticas generales de todas las encuestas de servicio
         */
        async function getOverviewStats(ctx) {
            const surveys = await getAllServiceSurveys(ctx);

            const stats = {
                totalSurveys: surveys.length,
                enabled: surveys.filter(s => s.enabled).length,
                disabled: surveys.filter(s => !s.enabled).length,
                totalResponses: surveys.reduce((sum, s) => sum + (s.responseCount || 0), 0),
                byService: {}
            };

            surveys.forEach(s => {
                stats.byService[s.serviceType] = {
                    title: s.title,
                    enabled: s.enabled,
                    responseCount: s.responseCount || 0
                };
            });

            return stats;
        }

        // =============================================
        // HELPERS
        // =============================================

        /**
         * Resetear estado de encuesta para un usuario (para testing)
         */
        async function resetUserSurveyState(ctx, serviceType) {
            const db = ctx.db;
            const userId = ctx.profile.uid;
            const triggerRef = db.collection(C_SERVICE_TRIGGERS).doc(`${userId}_${serviceType}`);

            await triggerRef.update({
                responded: false,
                responseId: null,
                skipCount: 0,
                lastSurveyShown: null,
                updatedAt: firebase.firestore.Timestamp.now()
            });
        }

        // =============================================
        // PUBLIC API
        // =============================================

        return {
            // CRUD
            createServiceSurvey,
            getServiceSurvey,
            getAllServiceSurveys,
            updateServiceSurvey,
            toggleServiceSurvey,

            // Triggers
            registerServiceUsage,
            checkPendingSurvey,
            shouldShowSurvey,
            recordSurveySkip,
            markSurveyShown,

            // Respuestas
            submitServiceSurveyResponse,
            getServiceSurveyResponses,

            // Estadísticas
            getServiceSurveyStats,
            getOverviewStats,

            // Helpers
            resetUserSurveyState
        };

    })();
}

window.EncuestasServicioService = EncuestasServicioService;
